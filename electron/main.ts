import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, nativeImage } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import { NativePtyService } from './pty-service';
import { NativeFileSystemService } from './fs-service';
import { NativeProjectsService } from './projects-service';
import { NativePortsService } from './ports-service';
import { setupApplicationMenu } from './menu';
import { NativeCommandsService } from './commands-service';
import { quotaService } from './quota-service';
import { modelService } from './model-service';
import { gitService } from './git-service';
import { extensionsService } from './extensions-service';
import { chatHistoryService } from './chat-history-service';
import { githubAuthService } from './github-auth-service';

// Set macOS application name
app.name = 'Aura Dev';

const getAppIcon = () => {
  const iconLocations = [
    path.join(__dirname, '../icon-mac.png'),
    path.join(__dirname, 'icon-mac.png'),
    path.join(process.cwd(), 'icon-mac.png'),
    path.join(app.getAppPath(), 'icon-mac.png'),
    path.join(__dirname, '../public/icon-mac.png'),
  ];
  for (const loc of iconLocations) {
    try {
      if (fs.existsSync(loc)) return loc;
    } catch {}
  }
  return null;
};

const appIconPath = getAppIcon();
const appIconImage = appIconPath ? nativeImage.createFromPath(appIconPath) : null;

// Immediately set Dock icon on macOS if dock is ready
if (process.platform === 'darwin' && appIconImage && app.dock) {
  try {
    app.dock.setIcon(appIconImage);
  } catch {}
}

let mainWindow: BrowserWindow | null = null;

const ptyService = new NativePtyService();
const fsService = new NativeFileSystemService();
const projectsService = new NativeProjectsService();
const portsService = new NativePortsService();
const commandsService = new NativeCommandsService();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#000000',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 17 },
    icon: appIconImage || undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  if (process.platform === 'darwin' && appIconImage && app.dock) {
    try {
      app.dock.setIcon(appIconImage);
    } catch {}
  }

  ptyService.setWindow(mainWindow);

  mainWindow.webContents.on('console-message', (_event, level, message, line, sourceId) => {
    console.log(`[Renderer] [level ${level}] ${message} (${sourceId}:${line})`);
  });

  // Setup macOS top menu bar
  setupApplicationMenu(() => mainWindow);

  // Fullscreen event listeners for smooth UI animations
  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreen-change', true);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreen-change', false);
  });

  // Window Controls & Theme Sync
  ipcMain.on('window:minimize', () => {
    mainWindow?.minimize();
  });

  ipcMain.on('window:maximize', () => {
    if (mainWindow?.isMaximized()) {
      mainWindow.unmaximize();
    } else {
      mainWindow?.maximize();
    }
  });

  ipcMain.on('window:close', () => {
    mainWindow?.close();
  });

  ipcMain.on('theme:set', (_event, mode: 'dark' | 'light') => {
    nativeTheme.themeSource = mode;
    if (mainWindow) {
      mainWindow.setBackgroundColor(mode === 'light' ? '#eaedf1' : '#000000');
    }
  });

  ipcMain.handle('window:setAlwaysOnTop', (_event, flag: boolean) => {
    mainWindow?.setAlwaysOnTop(flag, 'floating');
    return mainWindow?.isAlwaysOnTop() || false;
  });
  ipcMain.handle('window:isAlwaysOnTop', () => {
    return mainWindow?.isAlwaysOnTop() || false;
  });

  // Load from Vite dev server if active, otherwise load compiled dist/index.html
  const indexPath = path.join(__dirname, '../dist/index.html');
  const http = require('http');
  const req = http.get('http://localhost:5185', (res: any) => {
    if (res.statusCode === 200 || res.statusCode === 304) {
      mainWindow?.loadURL('http://localhost:5185');
    } else {
      mainWindow?.loadFile(indexPath);
    }
  });
  req.on('error', () => {
    mainWindow?.loadFile(indexPath);
  });
  req.setTimeout(500, () => {
    req.destroy();
    mainWindow?.loadFile(indexPath);
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// ----------------------------------------------------
// IPC Event Handlers
// ----------------------------------------------------

ipcMain.handle('window:isFullscreen', () => {
  return mainWindow?.isFullScreen() ?? false;
});

// PTY
ipcMain.handle('pty:create', (_event, { id, type, cwd, cols, rows, accentColor }) => {
  try {
    const session = ptyService.createSession(id, type, cwd, cols, rows, accentColor);
    return {
      success: true,
      id: session.id,
      title: session.title,
      type: session.type,
      cwd: session.cwd,
      pid: session.term?.pid,
    };
  } catch (err: any) {
    console.error('[Native PTY] Create failed:', err);
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('pty:setAccentColor', (_event, { accentColor }) => {
  try {
    ptyService.setAccentColor(accentColor);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('pty:getHistory', (_event, { id }) => {
  return ptyService.getHistory(id);
});

ipcMain.on('pty:write', (_event, { id, data }) => {
  ptyService.write(id, data);
});

ipcMain.on('pty:resize', (_event, { id, cols, rows }) => {
  ptyService.resize(id, cols, rows);
});

ipcMain.on('pty:kill', (_event, { id }) => {
  ptyService.kill(id);
});

// File System
ipcMain.handle('fs:getTree', (_event, { dirPath, depth }) => {
  return fsService.getTree(dirPath, depth);
});

ipcMain.handle('fs:readFile', (_event, { filePath }) => {
  return fsService.readFile(filePath);
});

ipcMain.handle('fs:writeFile', (_event, { filePath, content }) => {
  fsService.writeFile(filePath, content);
  return { success: true };
});

ipcMain.handle('fs:createItem', (_event, { itemPath, isDirectory }) => {
  fsService.createItem(itemPath, isDirectory);
  return { success: true };
});

ipcMain.handle('fs:deleteItem', (_event, { itemPath }) => {
  fsService.deleteItem(itemPath);
  return { success: true };
});

ipcMain.handle('fs:renameItem', (_event, { oldPath, newPath }) => {
  fsService.renameItem(oldPath, newPath);
  return { success: true };
});

ipcMain.handle('fs:copyItem', (_event, { srcPath, destPath }) => {
  fsService.copyItem(srcPath, destPath);
  return { success: true };
});

ipcMain.handle('fs:searchInFiles', async (_event, { dirPath, query, isRegex = false, matchCase = false, matchWholeWord = false, maxResults = 250 }) => {
  if (!query || !dirPath) return { results: [] };
  const { exec } = require('node:child_process');
  const fs = require('node:fs');
  if (!fs.existsSync(dirPath)) return { results: [] };

  let flags = '-rnI';
  if (!matchCase) flags += 'i';
  if (matchWholeWord) flags += 'w';
  if (isRegex) flags += 'E'; else flags += 'F';

  const excludeDirs = '--exclude-dir={node_modules,.git,dist,.next,.turbo,build,out,.system_generated}';
  const escapedQuery = query.replace(/'/g, "'\\''");
  const cmd = `grep ${flags} ${excludeDirs} -- '${escapedQuery}' "${dirPath}" | head -n ${maxResults}`;

  return new Promise((resolve) => {
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (err: any, stdout: string) => {
      if (err && !stdout) {
        return resolve({ results: [] });
      }
      const lines = stdout.split('\n').filter(Boolean);
      const results: { file: string; line: number; text: string }[] = [];
      for (const line of lines) {
        const match = line.match(/^([^:]+):(\d+):(.*)$/);
        if (match) {
          results.push({
            file: match[1],
            line: parseInt(match[2], 10),
            text: match[3],
          });
        }
      }
      resolve({ results });
    });
  });
});


// Projects & Tasks
ipcMain.handle('projects:getProjects', () => {
  return {
    projects: projectsService.getProjects(),
    activeProject: projectsService.getActiveProject(),
  };
});

ipcMain.handle('projects:getActiveProject', () => {
  return projectsService.getActiveProject();
});

ipcMain.handle('projects:selectProject', (_event, { id }) => {
  return projectsService.selectProject(id);
});

ipcMain.handle('projects:addProject', (_event, { name, path, description }) => {
  return projectsService.addProject(name, path, description);
});

ipcMain.handle('projects:getTasks', () => {
  return { tasks: projectsService.getTasks() };
});

ipcMain.handle('projects:updateTaskStatus', (_event, { id, status }) => {
  return projectsService.updateTaskStatus(id, status);
});

// Ports
ipcMain.handle('ports:scan', async () => {
  const ports = await portsService.scan();
  return { ports };
});

// Extensions Management via Open VSX Registry & Local Engine
ipcMain.handle('extensions:search', async (_event, { query = '', size = 35, category = '' }) => {
  return extensionsService.search(query, size, category);
});

ipcMain.handle('extensions:getDetails', async (_event, { namespace, name }: { namespace: string; name: string }) => {
  return extensionsService.getDetails(namespace, name);
});

ipcMain.handle('extensions:install', async (_event, { namespace, name, version }: { namespace: string; name: string; version?: string }) => {
  return extensionsService.install(namespace, name, version);
});

ipcMain.handle('extensions:uninstall', async (_event, { namespace, name }: { namespace: string; name: string }) => {
  return extensionsService.uninstall(namespace, name);
});

ipcMain.handle('extensions:toggleEnabled', async (_event, { namespace, name }: { namespace: string; name: string }) => {
  return extensionsService.toggleEnabled(namespace, name);
});

ipcMain.handle('extensions:getInstalled', async () => {
  return extensionsService.getInstalled();
});

// AI Agent
ipcMain.handle('ai:prompt', async (_event, { prompt, model, cwd }) => {
  const activeProj = projectsService.getActiveProject();
  const targetCwd = cwd || activeProj.path;
  
  if (model === 'claude-headless') {
    const { execSync } = require('child_process');
    try {
      const output = execSync(`claude -p "${prompt.replace(/"/g, '\\"')}"`, {
        cwd: targetCwd,
        encoding: 'utf8',
        timeout: 25000,
      });
      return { response: output };
    } catch (err: any) {
      return { response: `[Claude Code CLI Output]: ${err.stdout || err.message}` };
    }
  }

  return {
    response: `### ✦ Google Antigravity Agent (AGY v2.4)\n\n**Projeto Ativo:** \`${activeProj.name}\` (\`${targetCwd}\`)\n\nAnalisando requisição: **"${prompt}"**\n\n- **Modo Agente:** Autônomo com verificação nativa IPC.\n- **Execução:** O binário Claude Code e AGY estão prontos para rodar no terminal nativo abaixo.\n\n> Clique em **"+ Claude Code"** no terminal para aprovar comandos e interagir diretamente.`,
  };
});

// Check Installed AI CLIs on the system
ipcMain.handle('ai:checkClis', async () => {
  const { exec } = require('node:child_process');
  const userHome = process.env.HOME || '';
  const customPaths = [
    path.join(userHome, '.local/bin'),
    path.join(userHome, '.bun/bin'),
    path.join(userHome, '.cargo/bin'),
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/local/sbin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ];
  const envPath = `${customPaths.join(':')}:${process.env.PATH || ''}`;

  const check = (bin: string): Promise<boolean> => {
    for (const dir of customPaths) {
      const fullPath = path.join(dir, bin);
      try {
        if (fs.existsSync(fullPath)) return Promise.resolve(true);
      } catch {}
    }
    return new Promise((resolve) => {
      exec(`which ${bin}`, {
        env: { ...process.env, PATH: envPath },
        stdio: 'pipe',
        timeout: 1000,
        shell: '/bin/zsh',
      }, (err: any) => {
        resolve(!err);
      });
    });
  };

  const [claude, agy, antigravity, codex, gemini, ollama] = await Promise.all([
    check('claude'),
    check('agy'),
    check('antigravity'),
    check('codex'),
    check('gemini'),
    check('ollama'),
  ]);

  return {
    claude,
    antigravity: agy || antigravity,
    codex,
    gemini,
    ollama,
  };
});

// Dynamic Slash Commands extractor from active CLI
ipcMain.handle('ai:getCommands', async (_event, { providerId }: { providerId: string }) => {
  return commandsService.getCommands(providerId);
});

// Live AI Quotas
ipcMain.handle('ai:getQuotas', async () => {
  return quotaService.getQuotas();
});

// Dynamic AI Models extractor and setter
ipcMain.handle('ai:getModels', async (_event, { providerId }: { providerId: string }) => {
  return modelService.getModels(providerId);
});

ipcMain.handle('ai:setModel', async (_event, { providerId, modelId }: { providerId: string; modelId: string }) => {
  return modelService.setModel(providerId, modelId);
});

// Local AI Chat History Persistence & Export with Context
ipcMain.handle('ai:saveChatLocally', async (_event, session: any) => {
  return chatHistoryService.saveSessionLocally(session);
});

ipcMain.handle('ai:exportChatDialog', async (_event, { session, format }: { session: any; format: 'markdown' | 'json' }) => {
  return chatHistoryService.exportSessionDialog(session, format, mainWindow);
});

ipcMain.handle('ai:getSavedChats', async () => {
  return chatHistoryService.listSavedSessions();
});

ipcMain.handle('ai:loadSavedChat', async (_event, sessionId: string) => {
  return chatHistoryService.loadSession(sessionId);
});

ipcMain.handle('ai:deleteSavedChat', async (_event, sessionId: string) => {
  return chatHistoryService.deleteSession(sessionId);
});

// Direct execution of AI CLIs (claude, agy, codex) without shell string interpretation
// This prevents command substitution vulnerabilities (e.g. backticks ```env running /usr/bin/env)
ipcMain.handle('ai:runCli', async (_event, {
  cliCmd,
  prompt,
  model,
  cwd,
  additionalDirs,
}: {
  cliCmd: string;
  prompt: string;
  model?: string;
  cwd?: string;
  additionalDirs?: string[];
}) => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { spawn } = require('node:child_process');
  const userHome = process.env.HOME || '';
  const targetCwd = cwd && fs.existsSync(cwd) ? cwd : (userHome || process.cwd());

  const customPaths = [
    path.join(userHome, '.local/bin'),
    path.join(userHome, '.bun/bin'),
    path.join(userHome, '.cargo/bin'),
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/local/sbin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ];
  const envPath = `${customPaths.join(':')}:${process.env.PATH || ''}`;

  let binaryPath = cliCmd;
  for (const p of customPaths) {
    const candidate = path.join(p, cliCmd);
    if (fs.existsSync(candidate)) {
      binaryPath = candidate;
      break;
    }
  }

  const args: string[] = [];
  if (cliCmd === 'claude') {
    let resolvedModel = model?.trim() || '';
    if (resolvedModel) {
      const lower = resolvedModel.toLowerCase();
      if (lower === 'default' || lower === 'padrão') {
        resolvedModel = '';
      } else if (lower.includes('sonnet') && lower.includes('1m')) {
        resolvedModel = 'sonnet[1m]';
      } else if (lower.includes('opus') && lower.includes('1m')) {
        resolvedModel = 'opus[1m]';
      } else if (lower.includes('fable') && lower.includes('1m')) {
        resolvedModel = 'fable[1m]';
      } else if (lower.includes('opus') && lower.includes('plan')) {
        resolvedModel = 'opusplan';
      } else if (lower.includes('sonnet')) {
        resolvedModel = 'sonnet';
      } else if (lower.includes('opus')) {
        resolvedModel = 'opus';
      } else if (lower.includes('haiku')) {
        resolvedModel = 'haiku';
      } else if (lower.includes('fable')) {
        resolvedModel = 'fable';
      } else if (lower.includes('best')) {
        resolvedModel = 'best';
      }
    }

    if (resolvedModel && !prompt.startsWith('/')) {
      args.push('--model', resolvedModel);
    }
    args.push('--dangerously-skip-permissions');
    args.push('-p', prompt);
  } else if (cliCmd === 'agy') {
    if (model && !prompt.startsWith('/')) {
      args.push('--model', model);
    }
    args.push('--dangerously-skip-permissions');
    args.push('--add-dir', targetCwd);
    if (additionalDirs && additionalDirs.length > 0) {
      for (const dir of additionalDirs) {
        args.push('--add-dir', dir);
      }
    }
    args.push('-p', prompt);
  } else if (cliCmd === 'codex') {
    args.push('exec');
    if (model && !prompt.startsWith('/')) {
      args.push('-m', model);
    }
    args.push('--dangerously-bypass-approvals-and-sandbox');
    args.push('--cd', targetCwd);
    args.push(prompt);
  } else {
    args.push(prompt);
  }

  // Strip Antigravity IDE and Electron internals so the CLI executes in a pristine clean environment
  const cleanEnv = { ...process.env };
  for (const key of Object.keys(cleanEnv)) {
    if (
      key.startsWith('ANTIGRAVITY_') ||
      key.startsWith('VSCODE_') ||
      key.startsWith('ELECTRON_') ||
      key.startsWith('GEMINI_')
    ) {
      delete cleanEnv[key];
    }
  }

  const env = {
    ...cleanEnv,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    PATH: envPath,
    HOME: userHome,
  };

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let resolved = false;

    const child = spawn(binaryPath, args, {
      cwd: targetCwd,
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    child.stdout?.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr?.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('error', (err: Error) => {
      if (!resolved) {
        resolved = true;
        resolve({
          stdout: stdout.trim(),
          stderr: (stderr + '\n' + err.message).trim(),
          exitCode: 1,
        });
      }
    });

    child.on('close', (code: number) => {
      if (!resolved) {
        resolved = true;
        resolve({
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode: code ?? 0,
        });
      }
    });
  });
});

// Live Git & GitHub status IPC
ipcMain.handle('git:getWorkspaceGitInfo', async (_event, { workspacePath, activeFilePath }: { workspacePath: string; activeFilePath?: string }) => {
  return gitService.getWorkspaceGitInfo(workspacePath, activeFilePath);
});

ipcMain.handle('git:listRepos', async (_event, { workspacePath }: { workspacePath: string }) => {
  return gitService.listWorkspaceRepos(workspacePath);
});

ipcMain.handle('git:scanLocalProjects', async (_event, { baseDir }: { baseDir?: string } = {}) => {
  return gitService.scanLocalProjects(baseDir);
});

ipcMain.handle('git:getIssues', async (_event, { workspacePath }: { workspacePath: string }) => {
  const gitDir = gitService.resolveGitDir(workspacePath);
  if (!gitDir) return [];
  let repoFullName = '';
  try {
    const remoteUrl = require('node:child_process').execSync('git config --get remote.origin.url', { cwd: gitDir, encoding: 'utf8', timeout: 3000 }).trim();
    const match = remoteUrl.match(/[:/]([^/:]+\/[^/:]+?)(?:\.git)?$/);
    if (match) repoFullName = match[1];
  } catch {}
  if (!repoFullName) return [];
  return gitService.fetchGitHubIssues(repoFullName);
});

ipcMain.handle('git:createIssue', async (_event, { workspacePath, title, body }: { workspacePath: string; title: string; body?: string }) => {
  const gitDir = gitService.resolveGitDir(workspacePath);
  if (!gitDir) return { success: false, error: 'Repositório Git não encontrado' };
  let repoFullName = '';
  try {
    const remoteUrl = require('node:child_process').execSync('git config --get remote.origin.url', { cwd: gitDir, encoding: 'utf8', timeout: 3000 }).trim();
    const match = remoteUrl.match(/[:/]([^/:]+\/[^/:]+?)(?:\.git)?$/);
    if (match) repoFullName = match[1];
  } catch {}
  if (!repoFullName) return { success: false, error: 'Remote GitHub não configurado' };
  return gitService.createGitHubIssue(repoFullName, title, body);
});

ipcMain.handle('git:clone', async (_event, { repoUrl, targetDir }: { repoUrl: string; targetDir: string }) => {
  return gitService.cloneRepo(repoUrl, targetDir);
});

// Native macOS Dialogs (Abrir Arquivo / Pasta)
ipcMain.handle('dialog:openFile', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    title: 'Abrir Arquivo',
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    try {
      const fileRes = fsService.readFile(filePath);
      return { filePath, name: path.basename(filePath), content: fileRes.content };
    } catch (err: any) {
      return { filePath, name: path.basename(filePath), content: '', error: err.message };
    }
  }
  return null;
});

ipcMain.handle('dialog:openFolder', async () => {
  if (!mainWindow) return null;
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'Abrir Pasta no Explorador',
  });
  if (!result.canceled && result.filePaths.length > 0) {
    const folderPath = result.filePaths[0];
    const tree = fsService.getTree(folderPath, 3);
    return { folderPath, name: path.basename(folderPath), tree };
  }
  return null;
});

// Real Shell Execution on macOS using Login Shell (/bin/zsh -l)
ipcMain.handle('shell:exec', async (_event, { command, cwd }: { command: string; cwd?: string }) => {
  const { exec } = require('node:child_process');
  const fs = require('node:fs');
  const userHome = process.env.HOME || '';
  const targetCwd = cwd && fs.existsSync(cwd) ? cwd : (userHome || process.cwd());
  const shellPath = process.env.SHELL || '/bin/zsh';

  // Ensure workspace trust in ~/.claude.json so Claude Code does not block
  try {
    const claudeJsonPath = path.join(userHome, '.claude.json');
    if (fs.existsSync(claudeJsonPath)) {
      const cJson = JSON.parse(fs.readFileSync(claudeJsonPath, 'utf8'));
      if (!cJson.projects) cJson.projects = {};
      if (!cJson.projects[targetCwd] || !cJson.projects[targetCwd].hasTrustDialogAccepted) {
        cJson.projects[targetCwd] = {
          ...(cJson.projects[targetCwd] || {}),
          hasTrustDialogAccepted: true,
        };
        fs.writeFileSync(claudeJsonPath, JSON.stringify(cJson, null, 2), 'utf8');
      }
    }
  } catch {}

  const customPaths = [
    path.join(userHome, '.local/bin'),
    path.join(userHome, '.bun/bin'),
    path.join(userHome, '.cargo/bin'),
    '/opt/homebrew/bin',
    '/opt/homebrew/sbin',
    '/usr/local/bin',
    '/usr/local/sbin',
    '/usr/bin',
    '/bin',
    '/usr/sbin',
    '/sbin',
  ];
  const envPath = `${customPaths.join(':')}:${process.env.PATH || ''}`;

  return new Promise((resolve) => {
    const { spawn } = require('node:child_process');
    const trimmed = (command || '').trim();
    const isCd = trimmed === 'cd' || trimmed.startsWith('cd ');
    // If cd, execute command and then print the resulting working directory
    const cmdToRun = isCd ? `${trimmed} && pwd` : trimmed;

    const env = {
      ...process.env,
      TERM: 'xterm-256color',
      COLORTERM: 'truecolor',
      PATH: envPath,
      HOME: userHome,
    };

    let stdout = '';
    let stderr = '';
    let resolved = false;

    const authRegex = /Authentication required|Please visit the URL to log in|paste the authorization code|oauth2\/auth|waiting for authentication/i;

    const child = spawn(shellPath, ['-l', '-c', cmdToRun], {
      cwd: targetCwd,
      env,
    });

    const finish = (result: any) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timer);
        resolve(result);
      }
    };

    const timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch {}
      finish({
        stdout,
        stderr,
        error: 'Command timed out',
        exitCode: 124,
      });
    }, 60000);

    child.stdout.on('data', (chunk: any) => {
      const str = chunk.toString();
      stdout += str;
      // Early detection: CLI is prompting for browser login or auth code, return immediately
      if (authRegex.test(str) || authRegex.test(stdout)) {
        try { child.kill('SIGTERM'); } catch {}
        finish({
          stdout,
          stderr,
          error: null,
          exitCode: 0,
        });
      }
    });

    child.stderr.on('data', (chunk: any) => {
      const str = chunk.toString();
      stderr += str;
      if (authRegex.test(str) || authRegex.test(stderr)) {
        try { child.kill('SIGTERM'); } catch {}
        finish({
          stdout,
          stderr,
          error: null,
          exitCode: 0,
        });
      }
    });

    child.on('close', (code: number) => {
      if (isCd && code === 0) {
        const lines = (stdout || '').trim().split('\n');
        const newCwd = lines[lines.length - 1]?.trim();
        finish({
          stdout: '',
          stderr: stderr || '',
          error: null,
          exitCode: 0,
          newCwd: newCwd && fs.existsSync(newCwd) ? newCwd : null,
        });
        return;
      }

      finish({
        stdout: stdout || '',
        stderr: stderr || '',
        error: code !== 0 ? `Command exited with code ${code}` : null,
        exitCode: code || 0,
      });
    });

    child.on('error', (err: any) => {
      finish({
        stdout: '',
        stderr: '',
        error: err.message,
        exitCode: 1,
      });
    });
  });
});

// Open external URL in default browser
ipcMain.handle('shell:openExternal', async (_event, { url }: { url: string }) => {
  try {
    await shell.openExternal(url);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Reveal a file or folder in the OS file manager (Finder on macOS)
ipcMain.handle('shell:showItemInFolder', (_event, { itemPath }: { itemPath: string }) => {
  try {
    shell.showItemInFolder(itemPath);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Open native system terminal (Terminal.app on macOS) running a command
ipcMain.handle('shell:openInSystemTerminal', async (_event, { command, cwd }: { command: string; cwd?: string }) => {
  const { exec } = require('node:child_process');
  if (process.platform === 'darwin') {
    const escaped = (command || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    const cdPart = cwd ? `cd \\"${cwd.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}\\" && ` : '';
    const script = `tell application "Terminal" to activate\ntell application "Terminal" to do script "${cdPart}${escaped}"`;
    return new Promise((resolve) => {
      exec(`osascript -e '${script.replace(/'/g, "'\\''")}'`, (err: any) => {
        resolve({ success: !err, error: err?.message });
      });
    });
  } else if (process.platform === 'win32') {
    return new Promise((resolve) => {
      exec(`start cmd.exe /k "${command}"`, (err: any) => {
        resolve({ success: !err, error: err?.message });
      });
    });
  } else {
    return new Promise((resolve) => {
      exec(`x-terminal-emulator -e "${command}" || gnome-terminal -- bash -c "${command}; exec bash"`, (err: any) => {
        resolve({ success: !err, error: err?.message });
      });
    });
  }
});

// GitHub OAuth Device Flow login
ipcMain.handle('github:isAuthenticated', () => {
  return { authenticated: githubAuthService.isAuthenticated() };
});

ipcMain.handle('github:getUser', async () => {
  try {
    const user = await githubAuthService.fetchUser();
    return { success: true, user };
  } catch (err: any) {
    console.error('[github:getUser] error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:logout', () => {
  githubAuthService.logout();
  return { success: true };
});

ipcMain.handle('github:startLogin', async () => {
  try {
    const deviceInfo = await githubAuthService.requestDeviceCode();
    shell.openExternal(deviceInfo.verification_uri).catch(() => {});
    githubAuthService.pollForToken(
      deviceInfo.device_code,
      deviceInfo.interval,
      deviceInfo.expires_in,
      (user) => {
        mainWindow?.webContents.send('github:loginResult', { success: true, user });
      },
      (error) => {
        mainWindow?.webContents.send('github:loginResult', { success: false, error });
      },
    );
    return {
      success: true,
      userCode: deviceInfo.user_code,
      verificationUri: deviceInfo.verification_uri,
      expiresIn: deviceInfo.expires_in,
    };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:cancelLogin', () => {
  githubAuthService.stopPolling();
  return { success: true };
});

ipcMain.handle('github:fetchRepos', async () => {
  try {
    const repos = await githubAuthService.fetchRepos();
    return { success: true, repos };
  } catch (err: any) {
    console.error('[github:fetchRepos] error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:fetchProjects', async () => {
  try {
    const projects = await githubAuthService.fetchProjects();
    return { success: true, projects };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:fetchOrgs', async () => {
  try {
    const orgs = await githubAuthService.fetchOrgs();
    return { success: true, orgs };
  } catch (err: any) {
    console.error('[github:fetchOrgs] error:', err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:fetchRepoIssues', async (_event, { owner, repo }: { owner: string; repo: string }) => {
  try {
    const issues = await githubAuthService.fetchRepoIssues(owner, repo);
    return { success: true, issues };
  } catch (err: any) {
    console.error(`[github:fetchRepoIssues] ${owner}/${repo} error:`, err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:fetchRepoPulls', async (_event, { owner, repo }: { owner: string; repo: string }) => {
  try {
    const pulls = await githubAuthService.fetchRepoPulls(owner, repo);
    return { success: true, pulls };
  } catch (err: any) {
    console.error(`[github:fetchRepoPulls] ${owner}/${repo} error:`, err.message);
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:fetchRepoMilestones', async (_event, { owner, repo }: { owner: string; repo: string }) => {
  try {
    const milestones = await githubAuthService.fetchRepoMilestones(owner, repo);
    return { success: true, milestones };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:fetchRepoReleases', async (_event, { owner, repo }: { owner: string; repo: string }) => {
  try {
    const releases = await githubAuthService.fetchRepoReleases(owner, repo);
    return { success: true, releases };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:fetchRepoCollaborators', async (_event, { owner, repo }: { owner: string; repo: string }) => {
  try {
    const collaborators = await githubAuthService.fetchRepoCollaborators(owner, repo);
    return { success: true, collaborators };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle(
  'github:createIssue',
  async (
    _event,
    { owner, repo, title, body, labels, assignees, milestone }: { owner: string; repo: string; title: string; body?: string; labels?: Array<{ name: string; color: string }>; assignees?: string[]; milestone?: number },
  ) => {
    try {
      const issue = await githubAuthService.createIssue(owner, repo, { title, body, labels, assignees, milestone });
      return { success: true, issue };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

ipcMain.handle(
  'github:updateIssue',
  async (
    _event,
    { owner, repo, issueNumber, title, body, state, labels, ensureLabels, milestone }: {
      owner: string;
      repo: string;
      issueNumber: number;
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      labels?: string[];
      ensureLabels?: Array<{ name: string; color: string }>;
      milestone?: number | null;
    },
  ) => {
    try {
      const issue = await githubAuthService.updateIssue(owner, repo, issueNumber, { title, body, state, labels, ensureLabels, milestone });
      return { success: true, issue };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

ipcMain.handle('github:deleteIssue', async (_event, { nodeId }: { nodeId: string }) => {
  try {
    await githubAuthService.deleteIssue(nodeId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:fetchIssueComments', async (_event, { owner, repo, issueNumber }: { owner: string; repo: string; issueNumber: number }) => {
  try {
    const comments = await githubAuthService.fetchIssueComments(owner, repo, issueNumber);
    return { success: true, comments };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:addIssueComment', async (_event, { owner, repo, issueNumber, body }: { owner: string; repo: string; issueNumber: number; body: string }) => {
  try {
    const comment = await githubAuthService.addIssueComment(owner, repo, issueNumber, body);
    return { success: true, comment };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle(
  'github:createMilestone',
  async (
    _event,
    { owner, repo, title, description, due_on }: { owner: string; repo: string; title: string; description?: string; due_on?: string },
  ) => {
    try {
      const milestone = await githubAuthService.createMilestone(owner, repo, { title, description, due_on });
      return { success: true, milestone };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

ipcMain.handle(
  'github:updateMilestone',
  async (
    _event,
    {
      owner,
      repo,
      milestoneNumber,
      title,
      description,
      due_on,
      state,
    }: { owner: string; repo: string; milestoneNumber: number; title?: string; description?: string; due_on?: string; state?: 'open' | 'closed' },
  ) => {
    try {
      const milestone = await githubAuthService.updateMilestone(owner, repo, milestoneNumber, { title, description, due_on, state });
      return { success: true, milestone };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

app.whenReady().then(() => {
  if (process.platform === 'darwin' && appIconImage && app.dock) {
    try {
      app.dock.setIcon(appIconImage);
    } catch {}
  }
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
