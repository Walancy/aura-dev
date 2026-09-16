import { app, BrowserWindow, ipcMain, dialog, shell } from 'electron';
import * as path from 'node:path';
import { NativePtyService } from './pty-service';
import { NativeFileSystemService } from './fs-service';
import { NativeProjectsService } from './projects-service';
import { NativePortsService } from './ports-service';
import { setupApplicationMenu } from './menu';

// Set macOS application name
app.name = 'Ainaobra IDE';

let mainWindow: BrowserWindow | null = null;

const ptyService = new NativePtyService();
const fsService = new NativeFileSystemService();
const projectsService = new NativeProjectsService();
const portsService = new NativePortsService();

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: '#000000',
    titleBarStyle: 'hidden',
    trafficLightPosition: { x: 14, y: 17 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: false,
    },
  });

  ptyService.setWindow(mainWindow);

  // Setup macOS top menu bar
  setupApplicationMenu(() => mainWindow);

  // Fullscreen event listeners for smooth UI animations
  mainWindow.on('enter-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreen-change', true);
  });

  mainWindow.on('leave-full-screen', () => {
    mainWindow?.webContents.send('window:fullscreen-change', false);
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
ipcMain.handle('pty:create', (_event, { id, type, cwd, cols, rows }) => {
  try {
    const session = ptyService.createSession(id, type, cwd, cols, rows);
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
  const { execSync } = require('node:child_process');
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

  const check = (bin: string): boolean => {
    try {
      execSync(`which ${bin}`, {
        env: { ...process.env, PATH: envPath },
        stdio: 'pipe',
        timeout: 3000,
        shell: '/bin/zsh',
      });
      return true;
    } catch {
      return false;
    }
  };

  return {
    claude: check('claude'),
    antigravity: check('agy') || check('antigravity'),
    codex: check('codex'),
    gemini: check('gemini'),
    ollama: check('ollama'),
  };
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

    exec(
      `${shellPath} -l -c ${JSON.stringify(cmdToRun)}`,
      {
        cwd: targetCwd,
        env,
        timeout: 60000,
        maxBuffer: 20 * 1024 * 1024,
      },
      (error: any, stdout: string, stderr: string) => {
        if (isCd && !error) {
          const lines = (stdout || '').trim().split('\n');
          const newCwd = lines[lines.length - 1]?.trim();
          resolve({
            stdout: '',
            stderr: stderr || '',
            error: null,
            exitCode: 0,
            newCwd: newCwd && fs.existsSync(newCwd) ? newCwd : null,
          });
          return;
        }

        resolve({
          stdout: stdout || '',
          stderr: stderr || '',
          error: error ? (error.message || 'Command failed') : null,
          exitCode: error ? (error.code || 1) : 0,
        });
      }
    );
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

app.whenReady().then(createWindow);

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
