import { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, nativeImage, desktopCapturer, session, Menu } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { NativePtyService } from './pty-service';
import { NativeFileSystemService } from './fs-service';
import { NativeProjectsService } from './projects-service';
import { NativePortsService } from './ports-service';
import { DesignRoomService } from './design-room-service';
import { setupApplicationMenu } from './menu';
import { NativeCommandsService } from './commands-service';
import { quotaService } from './quota-service';
import { modelService } from './model-service';
import { gitService } from './git-service';
import { chatHistoryService } from './chat-history-service';
import { githubAuthService } from './github-auth-service';
import { skillsService } from './skills-service';
import { orchestratorService } from './orchestrator-service';
import { autonomousService } from './autonomous-service';
import { rolesService } from './roles-service';
import { flutterService } from './flutter-service';
import { getCleanEnv, resolveBinaryPath, normalizeClaudeModel } from './env-utils';

// Set macOS application name
app.name = 'Aura Dev';

// Desativa restrições de Private Network Access (PNA), web security estrita para iframes locais e permite localhost
app.commandLine.appendSwitch('disable-web-security');
app.commandLine.appendSwitch('allow-insecure-localhost');
app.commandLine.appendSwitch(
  'disable-features',
  'BlockInsecurePrivateNetworkRequests,PrivateNetworkAccessRespectPreflightResults,PrivateNetworkAccessSendPreflights'
);

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
// stdout/stderr podem fechar (o app foi iniciado por um terminal que depois foi fechado): sem isto, um console.log vira "write EIO" e derruba o processo principal
for (const stream of [process.stdout, process.stderr]) stream?.on?.('error', () => {});

const portsService = new NativePortsService();
const commandsService = new NativeCommandsService();
const designRoomService = new DesignRoomService();

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
      webSecurity: false,
      webviewTag: true,
      // gerações de IA e terminais continuam em ritmo normal com a janela em segundo plano/minimizada
      backgroundThrottling: false,
    },
  });

  // Corretor ortográfico: pt-BR e inglês; em campos editáveis, palavra errada ganha menu com sugestões
  try {
    mainWindow.webContents.session.setSpellCheckerLanguages(['pt-BR', 'en-US']);
  } catch {}
  mainWindow.webContents.on('context-menu', (_event, params) => {
    if (!params.isEditable || !params.misspelledWord) return;
    const wc = mainWindow?.webContents;
    if (!wc) return;
    const items: Electron.MenuItemConstructorOptions[] = params.dictionarySuggestions.slice(0, 6).map((suggestion) => ({
      label: suggestion,
      click: () => wc.replaceMisspelling(suggestion),
    }));
    if (items.length) items.push({ type: 'separator' });
    items.push({ label: 'Adicionar ao dicionário', click: () => wc.session.addWordToSpellCheckerDictionary(params.misspelledWord) });
    Menu.buildFromTemplate(items).popup();
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-attach-webview', (_event, webPreferences, params) => {
    delete webPreferences.preload;
    delete (webPreferences as any).preloadURL;
    webPreferences.nodeIntegration = false;
    webPreferences.contextIsolation = true;
    const isAllowed =
      /^https:\/\/([a-z0-9-]+\.)*penpot\.app(\/|$)/i.test(params.src) ||
      /^http:\/\/localhost:9001(\/|$)/i.test(params.src) ||
      // Previews locais (ex: Flutter web-server) rodando em localhost/127.0.0.1
      /^http:\/\/(localhost|127\.0\.0\.1):\d+(\/|$)/i.test(params.src);
    if (!isAllowed) {
      params.src = 'about:blank';
    }
  });

  if (process.platform === 'darwin' && appIconImage && app.dock) {
    try {
      app.dock.setIcon(appIconImage);
    } catch {}
  }

  ptyService.setWindow(mainWindow);
  designRoomService.setWindow(mainWindow);

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
  req.setTimeout(3000, () => {
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
ipcMain.handle('pty:create', (_event, { id, type, cwd, cols, rows, accentColor, extraOptions }) => {
  try {
    const session = ptyService.createSession(id, type, cwd, cols, rows, accentColor, extraOptions);
    return {
      success: true,
      id: session.id,
      title: session.title,
      type: session.type,
      cwd: session.cwd,
      pid: session.term?.pid,
      reused: !!session.reused,
    };
  } catch (err: any) {
    console.error('[Native PTY] Create failed:', err);
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('pty:writePrompt', async (_event, { id, prompt }) => {
  try {
    const ok = await ptyService.writePrompt(id, prompt);
    return { success: ok };
  } catch (err: any) {
    return { success: false, error: err?.message || String(err) };
  }
});

ipcMain.handle('pty:runPromptInCli', async (_event, { id, prompt, timeoutMs }) => {
  try {
    return await ptyService.runPromptInCli(id, prompt, timeoutMs);
  } catch (err: any) {
    return { response: '', error: err?.message || String(err) };
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

ipcMain.handle('pty:setCwd', (_event, { id, cwd }) => {
  return ptyService.setCwd(id, cwd);
});

ipcMain.handle('pty:setAllCwd', (_event, { cwd }) => {
  ptyService.setAllCwd(cwd);
  return { success: true };
});

ipcMain.handle('pty:foreground', () => ptyService.getForegroundProcesses());

ipcMain.handle('pty:getRunningSessions', () => {
  return ptyService.getRunningSessions();
});

// File System
ipcMain.handle('fs:getHomeDir', () => {
  return os.homedir();
});

ipcMain.handle('fs:getTree', (_event, { dirPath, depth }) => {
  return fsService.getTree(dirPath, depth);
});

// Imagens para o Design: Unsplash (com chave de acesso gratuita) ou picsum.photos (sem chave); devolve data URL
ipcMain.handle('unsplash:image', async (_e, { query, width, height, key, index }: { query: string; width: number; height: number; key?: string; index?: number }) => {
  const w = Math.max(32, Math.min(1200, Math.round(width * 2)));
  const h = Math.max(32, Math.min(1200, Math.round(height * 2)));
  const i = index || 0;
  let url = '';
  let credit = '';
  try {
    if (key) {
      const orientation = width > height * 1.15 ? 'landscape' : height > width * 1.15 ? 'portrait' : 'squarish';
      const headers = { Authorization: `Client-ID ${key}` };
      const r = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(query)}&per_page=10&orientation=${orientation}&content_filter=high`, { headers });
      if (r.ok) {
        const j: any = await r.json();
        const p = j.results?.[i % (j.results?.length || 1)];
        if (p?.urls?.raw) {
          url = `${p.urls.raw}&w=${w}&h=${h}&fit=crop&q=75&auto=format`;
          credit = p.user?.name || '';
          if (p.links?.download_location) fetch(p.links.download_location, { headers }).catch(() => {}); // exigido pelas diretrizes da API
        }
      }
    }
    let wiki = false;
    if (!url) {
      // sem chave do Unsplash: busca no Wikimedia Commons (sem chave) pela descrição, em vez de uma foto aleatória
      try {
        const r = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(`filetype:bitmap ${query}`)}&gsrnamespace=6&gsrlimit=20&prop=imageinfo&iiprop=url|size|mime&iiurlwidth=${w}&format=json`, { headers: { 'User-Agent': 'AuraDevDesktop/1.0 (design tool)' } });
        if (r.ok) {
          const j: any = await r.json();
          const want = width / Math.max(1, height);
          const hits = (Object.values(j.query?.pages || {}) as any[])
            .map((p) => p.imageinfo?.[0])
            .filter((x) => x?.thumburl && /jpeg/.test(x.mime || '') && x.width >= w / 2)
            .sort((a, b) => Math.abs(Math.log(a.width / a.height / want)) - Math.abs(Math.log(b.width / b.height / want)));
          const pick = hits[i % (hits.length || 1)];
          if (pick) { url = pick.thumburl; wiki = true; }
        }
      } catch {}
    }
    const source = wiki ? 'wikimedia' : url ? 'unsplash' : 'picsum';
    if (!url) url = `https://picsum.photos/seed/${encodeURIComponent(`${query}-${i}`)}/${w}/${h}`;
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    const type = res.headers.get('content-type') || 'image/jpeg';
    return { dataUrl: `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`, credit, source };
  } catch (err: any) {
    return { error: err?.message || 'Falha de rede' };
  }
});

// PDF a partir de HTML (proposta do Design): renderiza numa janela oculta e salva onde o usuário escolher
ipcMain.handle('design:exportPdf', async (_e, { html, defaultName }: { html: string; defaultName: string }) => {
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: true, javascript: false } });
  try {
    await win.loadURL(`data:text/html;charset=utf-8;base64,${Buffer.from(html, 'utf8').toString('base64')}`);
    const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', preferCSSPageSize: true });
    const safe = (defaultName || 'proposta').replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80);
    const target = await dialog.showSaveDialog(mainWindow!, { defaultPath: `${safe}.pdf`, filters: [{ name: 'PDF', extensions: ['pdf'] }] });
    if (target.canceled || !target.filePath) return { canceled: true };
    require('node:fs').writeFileSync(target.filePath, pdf);
    shell.showItemInFolder(target.filePath);
    return { path: target.filePath };
  } catch (err: any) {
    return { error: err?.message || 'Falha ao gerar o PDF' };
  } finally {
    win.destroy();
  }
});

// Versão das funções do processo principal usadas pelo Design: o renderer detecta quando o app não foi reiniciado
ipcMain.handle('app:capabilities', () => ({ designAi: 3, stockImage: true, tempImages: true, exportPdf: true }));

// Figma: a API não aceita CORS no renderer, então as chamadas passam pelo main
ipcMain.handle('figma:fetch', async (_e, { token, apiPath }: { token: string; apiPath: string }) => {
  if (!/^\/v1\/(files|images)\//.test(apiPath)) return { error: 'Caminho inválido' };
  try {
    const res = await fetch(`https://api.figma.com${apiPath}`, { headers: { 'X-Figma-Token': token } });
    const text = await res.text();
    if (!res.ok) return { error: res.status === 403 ? 'Token inválido ou sem acesso ao arquivo' : res.status === 404 ? 'Arquivo ou nó não encontrado' : `Figma respondeu ${res.status}`, status: res.status };
    return { data: JSON.parse(text) };
  } catch (err: any) {
    return { error: err?.message || 'Falha de rede' };
  }
});

// Baixa imagens (URLs temporárias do S3 do Figma) e devolve como data URL
ipcMain.handle('figma:downloadImages', async (_e, { urls }: { urls: Record<string, string> }) => {
  const out: Record<string, string> = {};
  await Promise.all(
    Object.entries(urls).map(async ([ref, url]) => {
      try {
        if (!/^https:\/\//.test(url)) return;
        const res = await fetch(url);
        if (!res.ok) return;
        const type = res.headers.get('content-type') || 'image/png';
        out[ref] = `data:${type};base64,${Buffer.from(await res.arrayBuffer()).toString('base64')}`;
      } catch {}
    }),
  );
  return out;
});

// Imagem colada no terminal (Cmd+V): grava num temporário e devolve o caminho para a CLI de IA ler
ipcMain.handle('fs:saveTempImage', (_event, { base64, ext }: { base64: string; ext?: string }) => {
  const os = require('node:os');
  // caminho CURTO (ex.: /tmp/df/1.png): no terminal ele é exibido como [Imagem #N] e o texto seguinte não fica longe
  const dir = process.platform === 'win32' ? path.join(os.tmpdir(), 'df') : '/tmp/df';
  fs.mkdirSync(dir, { recursive: true });
  // limpa imagens coladas há mais de 1 dia
  try {
    for (const f of fs.readdirSync(dir)) {
      const fp = path.join(dir, f);
      if (Date.now() - fs.statSync(fp).mtimeMs > 86400000) fs.unlinkSync(fp);
    }
  } catch {}
  const safeExt = (ext || 'png').replace(/[^a-z0-9]/gi, '').slice(0, 5) || 'png';
  const used = new Set(fs.readdirSync(dir).map((f) => f.replace(/\.[^.]*$/, '')));
  let n = 1;
  while (used.has(String(n))) n++;
  const filePath = path.join(dir, `${n}.${safeExt}`);
  fs.writeFileSync(filePath, Buffer.from(base64, 'base64'));
  return { path: filePath };
});

// Imagem/SVG do projeto como data URL (logos e ícones que a IA do Design usa nas telas). Limite de tamanho para não pesar o design.
ipcMain.handle('fs:readFileDataUrl', (_event, { filePath, maxBytes }: { filePath: string; maxBytes?: number }) => {
  try {
    const st = fs.statSync(filePath);
    if (!st.isFile() || st.size > (maxBytes || 900000)) return { error: 'arquivo grande demais' };
    const ext = path.extname(filePath).slice(1).toLowerCase();
    const mime: Record<string, string> = { svg: 'image/svg+xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', webp: 'image/webp', gif: 'image/gif', ico: 'image/x-icon' };
    if (!mime[ext]) return { error: 'tipo não suportado' };
    return { dataUrl: `data:${mime[ext]};base64,${fs.readFileSync(filePath).toString('base64')}` };
  } catch (err: any) {
    return { error: err?.message || 'falha ao ler' };
  }
});

ipcMain.handle('fs:readFile', (_event, { filePath }) => {
  try {
    return fsService.readFile(filePath);
  } catch (err: any) {
    return { error: err?.message || 'File not found', content: null, size: 0 };
  }
});

// Auditoria permanente: <userData>/transcripts/<sessionId>.jsonl (um passo por linha)
ipcMain.handle('ai:saveTranscript', (_event, { sessionId, history }: { sessionId: string; history: any[] }) => {
  const fs = require('node:fs');
  const path = require('node:path');
  const dir = path.join(app.getPath('userData'), 'transcripts');
  fs.mkdirSync(dir, { recursive: true });
  const safeId = String(sessionId).replace(/[^\w.-]/g, '_');
  const lines = history.map((m, step_index) =>
    JSON.stringify({ step_index, type: m.type, content: m.text, tool_calls: m.executionSteps ?? [], changed_files: m.changedFiles ?? [], timestamp: m.timestamp ?? null })
  );
  fs.writeFileSync(path.join(dir, `${safeId}.jsonl`), lines.join('\n') + '\n', 'utf8');
  return { success: true, path: path.join(dir, `${safeId}.jsonl`) };
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

ipcMain.handle('ports:scanProject', async (_, workspacePath: string) => {
  return { ports: await portsService.scanForWorkspace(workspacePath) };
});

ipcMain.handle('ports:kill', async (_, pid: string | number) => {
  if (String(pid) === String(process.pid)) return { success: false, error: 'Este é o próprio app' };
  return await portsService.kill(pid);
});

// Orchestration agent roles
ipcMain.handle('roles:list', () => {
  return rolesService.list();
});
ipcMain.handle('roles:create', (_event, role: { name: string; color: string; instructions: string }) => {
  return rolesService.create(role);
});
ipcMain.handle('roles:update', (_event, { id, patch }: { id: string; patch: Partial<{ name: string; color: string; instructions: string }> }) => {
  return rolesService.update(id, patch);
});
ipcMain.handle('roles:delete', (_event, id: string) => {
  return rolesService.delete(id);
});

// Design Room (LAN collaboration)
ipcMain.handle('design-room:host', async (_event, { roomName, canEdit }: { roomName: string; canEdit?: boolean }) => {
  return designRoomService.hostRoom(roomName, canEdit !== false);
});
ipcMain.handle('design-room:stop-hosting', () => {
  designRoomService.stopHosting();
});
ipcMain.handle('design-room:start-discovery', () => {
  designRoomService.startDiscovery();
});
ipcMain.handle('design-room:stop-discovery', () => {
  designRoomService.stopDiscovery();
});
ipcMain.handle('design-room:join', (_event, { ip, port }: { ip: string; port: number }) => {
  designRoomService.joinRoom(ip, port);
});
ipcMain.handle('design-room:leave', () => {
  designRoomService.leaveRoom();
});
ipcMain.on('design-room:send-cursor', (_event, { cursor }: { cursor: { x: number; y: number; name: string; color: string } }) => {
  designRoomService.sendCursor(cursor);
});
ipcMain.on('design-room:broadcast-state', (_event, { shapes }: { shapes: unknown[] }) => {
  designRoomService.broadcastState(shapes);
});


// Execuções diretas de CLI em andamento, por diretório de projeto (vários projetos podem gerar ao mesmo tempo)
const activeDirectCliRuns = new Map<string, { child: any; cancel: () => void; streamId?: string }>();
let directRunSeq = 0;

interface ActivePromptEntry {
  child: any;
  timer: NodeJS.Timeout;
  isCancelled: boolean;
  resolve: (val: any) => void;
  runId?: string;
  sessionIds?: string[];
}

const activePromptProcesses = new Set<ActivePromptEntry>();

function killProcessTree(child: any): void {
  if (!child || !child.pid) return;
  const pid = child.pid;
  try {
    if (process.platform === 'win32') {
      const { execSync } = require('node:child_process');
      execSync(`taskkill /pid ${pid} /T /F 2>nul`);
    } else {
      try { process.kill(-pid, 'SIGKILL'); } catch {}
      try { process.kill(pid, 'SIGKILL'); } catch {}
      try {
        const { execSync } = require('node:child_process');
        execSync(`pkill -9 -P ${pid} 2>/dev/null || true`);
      } catch {}
    }
  } catch {}
  try { child.kill('SIGKILL'); } catch {}
}

// Portless (Vercel): só orienta o uso quando o projeto JÁ o utiliza. Nunca manda instalar dependência.
function injectPortlessDirective(prompt: string, targetCwd?: string): string {
  if (!prompt || prompt.startsWith('/') || prompt.includes('PORTLESS')) {
    return prompt;
  }
  let hasPortless = false;
  if (targetCwd) {
    try {
      const pkgPath = path.join(targetCwd, 'package.json');
      if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
        hasPortless =
          Boolean(deps['portless'] || deps['@vercel/portless'] || deps['vercel-labs/portless']) ||
          Object.values(pkg.scripts || {}).some((s) => typeof s === 'string' && s.includes('portless'));
      }
    } catch {}
  }
  if (!hasPortless) return prompt;

  return (
    `\n[PORTLESS]: este projeto já usa o portless da Vercel. Ao rodar o servidor de desenvolvimento, prefira o script que o utiliza e informe a URL .localhost gerada. ` +
    `Nunca derrube processos/portas em uso.\n\n` +
    prompt
  );
}

// AI Agent
ipcMain.handle('ai:prompt', async (_event, { prompt, model, cwd, provider, timeoutMs, runId, sessionIds }: { prompt: string; model?: string; cwd?: string; provider?: string; timeoutMs?: number; runId?: string; sessionIds?: string[] }) => {
  const activeProj = projectsService.getActiveProject();
  const targetCwd = cwd || activeProj?.path || process.env.HOME || process.cwd();

  let cliCmd = 'claude';
  const lowerProvider = (provider || '').toLowerCase();
  const lowerModel = (model || '').toLowerCase();

  if (
    lowerProvider === 'antigravity' ||
    lowerModel.startsWith('agy') ||
    lowerModel.startsWith('antigravity') ||
    (lowerModel.startsWith('gemini') && lowerProvider !== 'gemini')
  ) {
    cliCmd = 'agy';
  } else if (lowerProvider === 'gemini') {
    cliCmd = 'gemini';
  } else if (lowerProvider === 'codex' || lowerProvider === 'openai' || lowerModel.startsWith('codex') || lowerModel.startsWith('gpt')) {
    cliCmd = 'codex';
  } else if (lowerProvider === 'ollama' || lowerModel.startsWith('ollama')) {
    cliCmd = 'ollama';
  } else {
    cliCmd = 'claude';
  }

  const binaryPath = resolveBinaryPath(cliCmd);
  const args: string[] = [];

  let promptToSend = injectPortlessDirective(prompt, targetCwd);
  if (cliCmd === 'claude') {
    const resolvedModel = normalizeClaudeModel(model === 'claude-headless' ? '' : model);
    if (resolvedModel) {
      args.push('--model', resolvedModel);
    }
    args.push('--dangerously-skip-permissions');
    const skillArgs = skillsService.cliArgs('claude');
    if (skillArgs.length) {
      args.push(...skillArgs);
    }
    const preamble = skillsService.promptPreamble('claude');
    if (preamble) {
      promptToSend = preamble + promptToSend;
    }
    args.push('-p', promptToSend);
  } else if (cliCmd === 'agy') {
    let resolvedModel = model;
    if (model) {
      const lm = model.toLowerCase();
      if (lm.includes('3.8') && lm.includes('high')) resolvedModel = 'gemini-3.8-flash-high';
      else if (lm.includes('3.8') && lm.includes('medium')) resolvedModel = 'gemini-3.8-flash-medium';
      else if (lm.includes('3.8') && lm.includes('low')) resolvedModel = 'gemini-3.8-flash-low';
      else if (lm.includes('3.7') && lm.includes('high')) resolvedModel = 'gemini-3.7-flash-high';
      else if (lm.includes('3.7') && lm.includes('medium')) resolvedModel = 'gemini-3.7-flash-medium';
      else if (lm.includes('3.7') && lm.includes('low')) resolvedModel = 'gemini-3.7-flash-low';
      else if (lm.includes('3.6')) resolvedModel = 'gemini-3.6-flash-high';
      else if (lm.includes('3.1') && lm.includes('high')) resolvedModel = 'gemini-3.1-pro-high';
      else if (lm.includes('sonnet')) resolvedModel = 'claude-sonnet-4-6';
    }
    if (resolvedModel && !prompt.startsWith('/')) {
      args.push('--model', resolvedModel);
    }
    args.push('--dangerously-skip-permissions');
    args.push('--add-dir', targetCwd);
    args.push('-p', promptToSend);
  } else if (cliCmd === 'codex') {
    args.push('exec');
    if (model && !prompt.startsWith('/')) {
      args.push('-m', model);
    }
    args.push('--dangerously-bypass-approvals-and-sandbox');
    args.push('--cd', targetCwd);
    args.push(promptToSend);
  } else if (cliCmd === 'gemini') {
    if (model && !prompt.startsWith('/')) {
      args.push('--model', model);
    }
    args.push('-p', promptToSend);
  } else if (cliCmd === 'ollama') {
    args.push('run', model || 'llama3', promptToSend);
  } else {
    args.push(promptToSend);
  }

  const env = getCleanEnv();

  return new Promise((resolve) => {
    const { spawn } = require('node:child_process');
    let stdout = '';
    let stderr = '';
    let resolved = false;

    const timeoutDuration = typeof timeoutMs === 'number' && timeoutMs > 0 ? timeoutMs : 300000;
    const timer = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try {
          if (child.pid && process.platform !== 'win32') {
            process.kill(-child.pid, 'SIGTERM');
          } else {
            child.kill('SIGTERM');
          }
        } catch {}
        resolve({
          response: stdout.trim(),
          error: 'Tempo limite esgotado ao aguardar resposta do CLI',
        });
      }
    }, timeoutDuration);

    const child = spawn(binaryPath, args, {
      cwd: targetCwd,
      env,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    const entry: ActivePromptEntry = {
      child,
      timer,
      isCancelled: false,
      resolve,
      runId,
      sessionIds,
    };
    activePromptProcesses.add(entry);

    const pName = cliCmd.toUpperCase();
    const mName = model ? ` (${model})` : '';
    const promptSnippet = prompt.length > 200 ? prompt.slice(0, 200) + '...' : prompt;
    const startBanner = `\r\n\x1b[1;38;2;255;106;0m╭─ [Aura Dev IA CLI: ${pName}${mName}]\x1b[0m\r\n\x1b[90m│ Prompt: ${promptSnippet.replace(/\r?\n/g, ' ')}\x1b[0m\r\n\x1b[1;38;2;255;106;0m╰──────────────────────────────────────────────────\x1b[0m\r\n`;

    if (sessionIds && sessionIds.length > 0) {
      for (const sId of sessionIds) {
        ptyService.sendOutput(sId, startBanner);
        ptyService.setRunning(sId, true);
      }
    }

    // Indicador dinâmico de progresso em tempo real enquanto a IA raciocina
    let stdoutReceived = false;
    let elapsedSec = 0;
    const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
    const progressTimer = setInterval(() => {
      if (entry.isCancelled || resolved || stdoutReceived) {
        clearInterval(progressTimer);
        return;
      }
      elapsedSec++;
      if (sessionIds && sessionIds.length > 0) {
        const frame = spinnerFrames[elapsedSec % spinnerFrames.length];
        const statusLine = `\r\x1b[2K\x1b[38;2;16;185;129m${frame}\x1b[0m \x1b[90m[Aguardando resposta do modelo ${pName}... ${elapsedSec}s]\x1b[0m`;
        for (const sId of sessionIds) {
          ptyService.sendOutput(sId, statusLine);
        }
      }
    }, 1000);

    child.stdout?.on('data', (data: Buffer) => {
      if (entry.isCancelled) return;
      if (!stdoutReceived) {
        stdoutReceived = true;
        clearInterval(progressTimer);
        if (sessionIds && sessionIds.length > 0) {
          for (const sId of sessionIds) {
            ptyService.sendOutput(sId, '\r\x1b[2K\r\n');
          }
        }
      }
      const text = data.toString();
      stdout += text;
      if (sessionIds && sessionIds.length > 0) {
        const formatted = text.replace(/\r?\n/g, '\r\n');
        for (const sId of sessionIds) {
          ptyService.sendOutput(sId, formatted);
        }
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      if (entry.isCancelled) return;
      const text = data.toString();
      stderr += text;
      if (sessionIds && sessionIds.length > 0) {
        const formatted = text.replace(/\r?\n/g, '\r\n');
        for (const sId of sessionIds) {
          ptyService.sendOutput(sId, `\x1b[33m${formatted}\x1b[0m`);
        }
      }
    });

    child.on('error', (err: Error) => {
      clearTimeout(timer);
      clearInterval(progressTimer);
      activePromptProcesses.delete(entry);
      if (sessionIds && sessionIds.length > 0) {
        for (const sId of sessionIds) {
          ptyService.setRunning(sId, false);
          ptyService.sendOutput(sId, `\r\n\x1b[1;31m✖ Erro ao executar ${pName}: ${err.message}\x1b[0m\r\n\r\n`);
        }
      }
      if (!resolved) {
        resolved = true;
        resolve({
          response: stdout.trim(),
          error: entry.isCancelled ? 'Operação cancelada pelo usuário' : err.message,
          cancelled: entry.isCancelled,
        });
      }
    });

    child.on('close', (code: number) => {
      clearTimeout(timer);
      clearInterval(progressTimer);
      activePromptProcesses.delete(entry);
      if (sessionIds && sessionIds.length > 0) {
        for (const sId of sessionIds) {
          ptyService.setRunning(sId, false);
        }
        const endBanner = entry.isCancelled
          ? `\r\n\x1b[1;31m✖ [${cliCmd.toUpperCase()}] Interrompido pelo usuário.\x1b[0m\r\n\r\n`
          : code === 0
          ? `\r\n\x1b[1;32m✔ [${cliCmd.toUpperCase()}] Finalizado com sucesso.\x1b[0m\r\n\r\n`
          : `\r\n\x1b[1;31m✖ [${cliCmd.toUpperCase()}] Encerrou com código ${code}.\x1b[0m\r\n\r\n`;
        for (const sId of sessionIds) {
          ptyService.sendOutput(sId, endBanner);
        }
      }
      if (!resolved) {
        resolved = true;
        if (entry.isCancelled) {
          resolve({
            response: '',
            error: 'Operação cancelada pelo usuário',
            cancelled: true,
          });
          return;
        }
        if (code === 0 && stdout.trim()) {
          resolve({ response: stdout.trim() });
        } else {
          const errorMsg = (stderr.trim() || stdout.trim() || `CLI encerrou com código ${code}`).trim();
          resolve({
            response: stdout.trim(),
            error: errorMsg,
          });
        }
      }
    });
  });
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

// Check for updates on installed AI CLIs
ipcMain.handle('ai:checkCliUpdates', async () => {
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
  ];
  const envPath = `${customPaths.join(':')}:${process.env.PATH || ''}`;

  const getCliVersion = (cmd: string): Promise<string> => {
    return new Promise((resolve) => {
      exec(cmd, {
        env: { ...process.env, PATH: envPath },
        timeout: 2500,
        shell: '/bin/zsh',
      }, (err: any, stdout: string) => {
        if (err || !stdout) resolve('');
        else {
          const match = stdout.match(/\b\d+\.\d+\.\d+\b/);
          resolve(match ? match[0] : stdout.trim().split('\n')[0]);
        }
      });
    });
  };

  const getLatestNpmVersion = async (pkg: string): Promise<string> => {
    try {
      const controller = new AbortController();
      const id = setTimeout(() => controller.abort(), 2500);
      const res = await fetch(`https://registry.npmjs.org/${pkg}/latest`, { signal: controller.signal });
      clearTimeout(id);
      if (res.ok) {
        const json: any = await res.json();
        return json.version || '';
      }
    } catch {}
    return '';
  };

  const isNewer = (latest: string, current: string): boolean => {
    if (!latest || !current) return false;
    const lParts = latest.split('.').map((n) => parseInt(n, 10) || 0);
    const cParts = current.split('.').map((n) => parseInt(n, 10) || 0);
    for (let i = 0; i < Math.max(lParts.length, cParts.length); i++) {
      const l = lParts[i] || 0;
      const c = cParts[i] || 0;
      if (l > c) return true;
      if (l < c) return false;
    }
    return false;
  };

  const results: Record<string, { hasUpdate: boolean; currentVersion?: string; latestVersion?: string; updateCommand?: string }> = {};

  try {
    // Check Claude
    const claudeCur = await getCliVersion('claude --version');
    if (claudeCur) {
      const claudeLatest = await getLatestNpmVersion('@anthropic-ai/claude-code');
      const hasUpdate = isNewer(claudeLatest, claudeCur);
      results.claude = {
        hasUpdate,
        currentVersion: claudeCur,
        latestVersion: claudeLatest || claudeCur,
        updateCommand: 'npm install -g @anthropic-ai/claude-code@latest',
      };
    }

    // Check Antigravity (agy)
    const agyCur = await getCliVersion('agy --version');
    if (agyCur) {
      // Current agy version: e.g. 1.3.3. Simulated/known remote update 1.3.4
      let agyLatest = '1.3.4';
      try {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), 1500);
        const res = await fetch('https://antigravity.google/cli/version.json', { signal: controller.signal });
        clearTimeout(id);
        if (res.ok) {
          const json: any = await res.json();
          if (json.version) agyLatest = json.version;
        }
      } catch {}
      const hasUpdate = isNewer(agyLatest, agyCur);
      results.antigravity = {
        hasUpdate,
        currentVersion: agyCur,
        latestVersion: agyLatest,
        updateCommand: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
      };
    }

    // Check Gemini
    const geminiCur = await getCliVersion('gemini --version');
    if (geminiCur) {
      const geminiLatest = await getLatestNpmVersion('@google/gemini-cli');
      const hasUpdate = isNewer(geminiLatest, geminiCur);
      results.gemini = {
        hasUpdate,
        currentVersion: geminiCur,
        latestVersion: geminiLatest || geminiCur,
        updateCommand: 'npm install -g @google/gemini-cli@latest',
      };
    }

    // Check Codex
    const codexCur = await getCliVersion('codex --version');
    if (codexCur) {
      const codexLatest = await getLatestNpmVersion('@openai/codex-cli');
      const hasUpdate = isNewer(codexLatest, codexCur);
      results.codex = {
        hasUpdate,
        currentVersion: codexCur,
        latestVersion: codexLatest || codexCur,
        updateCommand: 'npm install -g @openai/codex-cli@latest',
      };
    }
  } catch (e) {
    console.error('Erro ao verificar atualizações de CLI:', e);
  }

  return results;
});

ipcMain.handle('ai:cancel', async (_event, runId?: string, cwd?: string, streamId?: string) => {
  let cancelled = false;
  if (runId) {
    cancelled = orchestratorService.cancel(runId);
  }

  for (const entry of Array.from(activePromptProcesses)) {
    // Se runId for especificado, só cancela os processos vinculados a esse runId.
    // Se NÃO for especificado (ex: Ctrl+C no chat ou Escape na UI), só cancela prompts sem runId.
    // Isso impede que abrir um modal, fechar um popup ou acionar o chat cancele fluxos da orquestração.
    const shouldCancel = runId ? (entry.runId === runId) : !entry.runId;
    if (shouldCancel) {
      entry.isCancelled = true;
      clearTimeout(entry.timer);
      try {
        killProcessTree(entry.child);
      } catch (err) {
        console.warn('[ai:cancel] Erro ao matar subprocesso de prompt:', err);
      }
      if (entry.sessionIds && entry.sessionIds.length > 0) {
        for (const sId of entry.sessionIds) {
          ptyService.sendOutput(sId, `\r\n\x1b[1;31m✖ Execução cancelada pelo usuário.\x1b[0m\r\n\r\n`);
        }
      }
      entry.resolve({
        response: '',
        error: 'Operação cancelada pelo usuário',
        cancelled: true,
      });
      activePromptProcesses.delete(entry);
      cancelled = true;
    }
  }

  if (!runId) {
    // Com cwd cancela só a execução daquele projeto; sem cwd, todas (comportamento anterior)
    for (const [key, run] of Array.from(activeDirectCliRuns.entries())) {
      if (cwd && key.split('\u0000')[0] !== cwd) continue;
      if (streamId && run.streamId !== streamId) continue; // cancela só aquela execução (gerações em paralelo no mesmo projeto)
      run.cancel();
      cancelled = true;
    }
  }
  return { cancelled };
});
ipcMain.handle('ai:orchestratorCancel', async (_event, runId: string) => ({ cancelled: orchestratorService.cancel(runId) }));
ipcMain.handle('ai:autonomousRun', async (_event, input) => autonomousService.run(input, (event) => mainWindow?.webContents.send('ai:orchestrator-event', event)));
ipcMain.handle('ai:autonomousCancel', async (_event, runId: string) => ({ cancelled: autonomousService.cancel(runId) }));

// Flutter apps (preview web-server para o node "webview" da Orquestração)
ipcMain.handle('flutter:run', async (_event, { runId, cwd, port }: { runId: string; cwd: string; port: number }) => {
  return flutterService.run(runId, cwd, port, (event) => mainWindow?.webContents.send('flutter:event', event));
});
ipcMain.handle('flutter:stop', async (_event, runId: string) => {
  return flutterService.stop(runId);
});

// Captura de janelas nativas (usado para embutir o Simulador iOS no macOS, best-effort)
ipcMain.handle('capture:listWindows', async (_event, { filter }: { filter?: string } = {}) => {
  const sources = await desktopCapturer.getSources({ types: ['window'], thumbnailSize: { width: 0, height: 0 } });
  const isSimulator = filter && /simulator/i.test(filter);
  const filtered = filter
    ? sources.filter((s) => {
        if (isSimulator) {
          return /iphone|ipad|ipod|apple\s*watch|simulator/i.test(s.name);
        }
        return s.name.toLowerCase().includes(filter.toLowerCase());
      })
    : sources;
  return filtered.map((s) => ({ id: s.id, name: s.name }));
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
  useOrchestrator,
  orchestratorConfig,
  permissions,
  streamText,
  streamId,
}: {
  cliCmd: string;
  prompt: string;
  model?: string;
  cwd?: string;
  streamText?: boolean;
  streamId?: string;
  additionalDirs?: string[];
  useOrchestrator?: boolean;
  orchestratorConfig?: any;
  permissions?: {
    executionMode: 'always-proceed' | 'request-review' | 'strict' | 'proceed-in-sandbox';
    externalFilesAccess: 'allow' | 'ask' | 'deny';
    networkAccess: 'allow' | 'ask' | 'deny';
    allowlistCommands: string[];
    denylistCommands: string[];
  };
}) => {
  const fs = require('node:fs');
  const path = require('node:path');
  const { spawn } = require('node:child_process');
  const userHome = process.env.HOME || '';
  const targetCwd = cwd && fs.existsSync(cwd) ? cwd : (userHome || process.cwd());
  const promptToSend = injectPortlessDirective(prompt, targetCwd);

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

  // Políticas salvas em "Permissões" do chat. Sem política salva, mantém o comportamento legado (sem aprovação).
  const mode = permissions?.executionMode ?? 'always-proceed';
  if (permissions?.externalFilesAccess === 'deny') additionalDirs = [];
  const claudePermissionArgs = (): string[] => {
    const a: string[] = [];
    if (!permissions || mode === 'always-proceed' || mode === 'proceed-in-sandbox') a.push('--dangerously-skip-permissions');
    else a.push('--permission-mode', mode === 'strict' ? 'default' : 'acceptEdits');
    if (permissions) {
      const bash = (list: string[]) => list.map((c) => `Bash(${c}:*)`);
      const allowed = mode === 'always-proceed' || mode === 'proceed-in-sandbox' ? [] : bash(permissions.allowlistCommands);
      const denied = [...bash(permissions.denylistCommands), ...(permissions.networkAccess === 'deny' ? ['WebFetch', 'WebSearch'] : [])];
      if (allowed.length) a.push('--allowedTools', ...allowed);
      if (denied.length) a.push('--disallowedTools', ...denied);
    }
    return a;
  };

  const args: string[] = [];
  if (cliCmd === 'claude') {
    const resolvedModel = normalizeClaudeModel(model);
    if (resolvedModel && !prompt.startsWith('/')) {
      args.push('--model', resolvedModel);
    }
    args.push(...claudePermissionArgs());
    // Texto em tempo real (Design): o Claude só imprime no fim sem stream-json
    if (streamText) args.push('--output-format', 'stream-json', '--verbose', '--include-partial-messages');
    args.push('-p', promptToSend);
  } else if (cliCmd === 'agy') {
    if (model && !prompt.startsWith('/')) {
      args.push('--model', model);
    }
    args.push('--dangerously-skip-permissions');
    if (streamText) args.push('--output-format', 'stream-json');
    args.push('--add-dir', targetCwd);
    if (additionalDirs && additionalDirs.length > 0) {
      for (const dir of additionalDirs) {
        args.push('--add-dir', dir);
      }
    }
    args.push('-p', promptToSend);
  } else if (cliCmd === 'codex') {
    args.push('exec');
    if (model && !prompt.startsWith('/')) {
      args.push('-m', model);
    }
    if (!permissions || mode === 'always-proceed') args.push('--dangerously-bypass-approvals-and-sandbox');
    else args.push('--sandbox', mode === 'strict' ? 'read-only' : 'workspace-write');
    args.push('--cd', targetCwd);
    args.push(promptToSend);
  } else if (cliCmd === 'gemini') {
    if (model && !prompt.startsWith('/')) {
      args.push('--model', model);
    }
    args.push('-p', promptToSend);
  } else if (cliCmd === 'ollama') {
    args.push('run', model || 'llama3', promptToSend);
  } else {
    args.push(promptToSend);
  }

  // Skills ativas do DevFlow: flags do CLI (ex.: --plugin-dir do Claude) antes do prompt,
  // e índice no prompt para CLIs sem suporte nativo (ex.: Antigravity)
  if (!prompt.startsWith('/')) {
    const skillArgs = skillsService.cliArgs(cliCmd);
    if (skillArgs.length) {
      const promptIdx = args.lastIndexOf(promptToSend);
      args.splice(promptIdx > 0 && args[promptIdx - 1] === '-p' ? promptIdx - 1 : Math.max(0, promptIdx), 0, ...skillArgs);
    }
    const preamble = skillsService.promptPreamble(cliCmd);
    if (preamble) {
      const promptIdx = args.lastIndexOf(promptToSend);
      if (promptIdx >= 0) args[promptIdx] = preamble + promptToSend;
    }
  }

  const env = getCleanEnv();

  // If the orchestrator is active, follow the orchestrator configuration and route through the Rust orchestrator service.
  // Otherwise, use direct CLI execution of the selected AI.
  if (useOrchestrator && !prompt.startsWith('/')) {
    const supportedProviders = ['agy', 'antigravity', 'codex', 'claude'];
    if (supportedProviders.includes(cliCmd)) {
      const orchestratorProvider =
        cliCmd === 'agy' || cliCmd === 'antigravity'
          ? 'antigravity'
          : (cliCmd === 'codex' ? 'codex' : 'claude');

      const resolvedModel = cliCmd === 'claude' ? normalizeClaudeModel(model) : model;

      return orchestratorService.run({
        provider: orchestratorProvider,
        request: promptToSend,
        cwd: targetCwd,
        model: resolvedModel,
        additionalDirs,
        mode: orchestratorConfig?.mode || 'execute',
      }, (event) => mainWindow?.webContents.send('ai:orchestrator-event', event));
    }
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let resolved = false;

    let isCancelled = false;
    const child = spawn(binaryPath, args, {
      cwd: targetCwd,
      env,
      detached: process.platform !== 'win32',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    // chave única por execução (duas execuções no mesmo projeto não podem perder o handle de cancelamento)
    const runKey = `${targetCwd}\u0000${++directRunSeq}`;
    activeDirectCliRuns.set(runKey, {
      child,
      streamId,
      cancel: () => {
        isCancelled = true;
        activeDirectCliRuns.delete(runKey);
        killProcessTree(child);
      },
    });
    const releaseRun = () => {
      activeDirectCliRuns.delete(runKey);
    };

    const emitText = (text: string) =>
      mainWindow?.webContents.send('ai:orchestrator-event', {
        provider: cliCmd,
        kind: 'progress',
        message: 'stdout',
        payload: { text, streamId },
        timestamp_ms: Date.now(),
      });
    const jsonStream = (cliCmd === 'claude' || cliCmd === 'agy') && !!streamText;
    let lineBuf = '';
    let finalResult = '';
    child.stdout?.on('data', (data: Buffer) => {
      if (isCancelled) return;
      const chunk = data.toString();
      if (!jsonStream) {
        stdout += chunk;
        emitText(chunk);
        return;
      }
      // stream-json: uma linha JSON por evento; só os text_delta viram texto
      lineBuf += chunk;
      const lines = lineBuf.split('\n');
      lineBuf = lines.pop() || '';
      for (const line of lines) {
        try {
          const evt = JSON.parse(line);
          const delta = evt.type === 'stream_event' ? evt.event?.delta : null;
          if (delta?.type === 'text_delta' && typeof delta.text === 'string') {
            stdout += delta.text;
            emitText(delta.text);
          } else if (evt.type === 'result' && typeof evt.result === 'string') {
            finalResult = evt.result;
          } else if (evt.event === 'step_update' && evt.step_update?.step_type === 'agent_response' && typeof evt.step_update.text_delta === 'string') {
            // Antigravity: trechos da resposta do agente
            stdout += evt.step_update.text_delta;
            emitText(evt.step_update.text_delta);
          } else if (evt.event === 'result' && typeof evt.result?.response === 'string') {
            finalResult = evt.result.response;
          }
        } catch {}
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      if (isCancelled) return;
      stderr += data.toString();
    });

    child.on('error', (err: Error) => {
      releaseRun();
      if (!resolved) {
        resolved = true;
        resolve({
          stdout: isCancelled ? '' : stdout.trim(),
          stderr: (stderr + '\n' + err.message).trim(),
          exitCode: 1,
          cancelled: isCancelled,
        });
      }
    });

    child.on('close', (code: number) => {
      releaseRun();
      if (!resolved) {
        resolved = true;
        resolve({
          stdout: isCancelled ? '' : (finalResult || stdout).trim(),
          stderr: isCancelled ? 'Interrompido pelo usuário' : stderr.trim(),
          exitCode: isCancelled ? 130 : (code ?? 0),
          cancelled: isCancelled,
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

ipcMain.handle('git:getRecentCommitsSummary', async (_event, options: any = {}) => {
  return gitService.getRecentCommitsSummary(options);
});

// Andares (git worktrees) para a Orquestração
ipcMain.handle('git:worktreeList', async (_event, { repoPath }: { repoPath: string }) => {
  return gitService.listWorktrees(repoPath);
});
ipcMain.handle(
  'git:worktreeCreate',
  async (_event, { repoPath, branchName, targetDir }: { repoPath: string; branchName: string; targetDir: string }) => {
    return gitService.createWorktree(repoPath, branchName, targetDir);
  }
);
ipcMain.handle(
  'git:worktreeRemove',
  async (_event, { repoPath, worktreePath }: { repoPath: string; worktreePath: string }) => {
    return gitService.removeWorktree(repoPath, worktreePath);
  }
);
ipcMain.handle(
  'git:worktreeLand',
  async (_event, { repoPath, branchName, baseBranch }: { repoPath: string; branchName: string; baseBranch: string }) => {
    return gitService.landWorktree(repoPath, branchName, baseBranch);
  }
);

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
  if (!url || !/^(https?:|mailto:)/i.test(url)) {
    return { success: false, error: 'esquema não permitido' };
  }
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

ipcMain.handle('github:fetchOrgProjects', async (_event, { org }: { org: string }) => {
  try {
    const projects = await githubAuthService.fetchOrgProjects(org);
    return { success: true, projects };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:fetchRepoProjects', async (_event, { owner, repo }: { owner: string; repo: string }) => {
  try {
    const projects = await githubAuthService.fetchRepoProjects(owner, repo);
    return { success: true, projects };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:fetchProjectItems', async (_event, { projectNumber, org }: { projectNumber: number; org?: string }) => {
  try {
    const project = await githubAuthService.fetchProjectItems(projectNumber, org);
    return { success: true, project };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:updateProjectItemStatus', async (_event, { projectId, itemId, fieldId, optionId }: { projectId: string; itemId: string; fieldId: string; optionId: string }) => {
  try {
    const item = await githubAuthService.updateProjectItemStatus(projectId, itemId, fieldId, optionId);
    return { success: true, item };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:fetchIssueDetails', async (_event, { owner, repo, number }: { owner: string; repo: string; number: number }) => {
  try {
    const details = await githubAuthService.fetchIssueDetails(owner, repo, number);
    return { success: true, details };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:updateProjectItemField', async (_event, { projectId, itemId, fieldId, value }: { projectId: string; itemId: string; fieldId: string; value: Record<string, any> }) => {
  try {
    const item = await githubAuthService.updateProjectItemField(projectId, itemId, fieldId, value);
    return { success: true, item };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:clearProjectItemField', async (_event, { projectId, itemId, fieldId }: { projectId: string; itemId: string; fieldId: string }) => {
  try {
    const item = await githubAuthService.clearProjectItemField(projectId, itemId, fieldId);
    return { success: true, item };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:addIssueToProject', async (_event, { projectId, contentId }: { projectId: string; contentId: string }) => {
  try {
    const itemId = await githubAuthService.addIssueToProject(projectId, contentId);
    return { success: true, itemId };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:removeProjectItem', async (_event, { projectId, itemId }: { projectId: string; itemId: string }) => {
  try {
    await githubAuthService.removeProjectItem(projectId, itemId);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:setIssueType', async (_event, { issueId, issueTypeId }: { issueId: string; issueTypeId: string | null }) => {
  try {
    const issueType = await githubAuthService.setIssueType(issueId, issueTypeId);
    return { success: true, issueType };
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
    { owner, repo, issueNumber, title, body, state, labels, ensureLabels, milestone, assignees }: {
      owner: string;
      repo: string;
      issueNumber: number;
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      labels?: string[];
      ensureLabels?: Array<{ name: string; color: string }>;
      milestone?: number | null;
      assignees?: string[];
    },
  ) => {
    try {
      const issue = await githubAuthService.updateIssue(owner, repo, issueNumber, { title, body, state, labels, ensureLabels, milestone, assignees });
      return { success: true, issue };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

ipcMain.handle(
  'github:deleteIssue',
  async (_event, input: { nodeId?: string; owner?: string; repo?: string; issueNumber?: number }) => {
    try {
      await githubAuthService.deleteIssue(input);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

ipcMain.handle(
  'github:lockIssue',
  async (_event, { owner, repo, issueNumber, locked }: { owner: string; repo: string; issueNumber: number; locked: boolean }) => {
    try {
      const res = await githubAuthService.lockIssue(owner, repo, issueNumber, locked);
      return { success: true, ...res };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

ipcMain.handle(
  'github:pinIssue',
  async (_event, { issueId, pinned }: { issueId: string; pinned: boolean }) => {
    try {
      const res = await githubAuthService.pinIssue(issueId, pinned);
      return { success: true, ...res };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

ipcMain.handle(
  'github:setIssueSubscription',
  async (_event, { owner, repo, issueNumber, subscribed }: { owner: string; repo: string; issueNumber: number; subscribed: boolean }) => {
    try {
      const res = await githubAuthService.setIssueSubscription(owner, repo, issueNumber, subscribed);
      return { success: true, ...res };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

ipcMain.handle(
  'github:transferIssue',
  async (_event, { owner, repo, issueNumber, newOwner, newRepo }: { owner: string; repo: string; issueNumber: number; newOwner: string; newRepo: string }) => {
    try {
      const issue = await githubAuthService.transferIssue(owner, repo, issueNumber, newOwner, newRepo);
      return { success: true, issue };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },
);

// ---- Time (pessoas, times e acesso) ----
const teamHandler = <A extends any[]>(fn: (...args: A) => Promise<any>, key?: string) => async (_event: any, ...args: A) => {
  try {
    const data = await fn(...args);
    return key ? { success: true, [key]: data } : { success: true, ...(data && typeof data === 'object' && !Array.isArray(data) ? data : {}) };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
};

ipcMain.handle('github:fetchTeamInsights', teamHandler(({ owner, repo }: { owner: string; repo: string }) => githubAuthService.fetchTeamInsights(owner, repo), 'insights'));
ipcMain.handle('github:fetchOrgTeams', teamHandler(({ org }: { org: string }) => githubAuthService.fetchOrgTeams(org), 'teams'));
ipcMain.handle(
  'github:fetchCollaboratorPermissions',
  teamHandler(({ owner, repo }: { owner: string; repo: string }) => githubAuthService.fetchCollaboratorPermissions(owner, repo), 'collaborators'),
);
ipcMain.handle(
  'github:setCollaboratorPermission',
  teamHandler(({ owner, repo, username, role }: { owner: string; repo: string; username: string; role: string }) =>
    githubAuthService.setCollaboratorPermission(owner, repo, username, role),
  ),
);
ipcMain.handle(
  'github:removeCollaborator',
  teamHandler(({ owner, repo, username }: { owner: string; repo: string; username: string }) => githubAuthService.removeCollaborator(owner, repo, username)),
);
ipcMain.handle(
  'github:cancelInvitation',
  teamHandler(({ owner, repo, invitationId }: { owner: string; repo: string; invitationId: number }) =>
    githubAuthService.cancelInvitation(owner, repo, invitationId),
  ),
);
ipcMain.handle(
  'github:setTeamRepoPermission',
  teamHandler(({ org, teamSlug, owner, repo, role }: { org: string; teamSlug: string; owner: string; repo: string; role: string }) =>
    githubAuthService.setTeamRepoPermission(org, teamSlug, owner, repo, role),
  ),
);
ipcMain.handle(
  'github:removeTeamRepo',
  teamHandler(({ org, teamSlug, owner, repo }: { org: string; teamSlug: string; owner: string; repo: string }) =>
    githubAuthService.removeTeamRepo(org, teamSlug, owner, repo),
  ),
);
ipcMain.handle(
  'github:createTeam',
  teamHandler(({ org, name, description }: { org: string; name: string; description?: string }) => githubAuthService.createTeam(org, name, description), 'team'),
);
ipcMain.handle(
  'github:requestReviewers',
  teamHandler(({ owner, repo, pullNumber, reviewers }: { owner: string; repo: string; pullNumber: number; reviewers: string[] }) =>
    githubAuthService.requestReviewers(owner, repo, pullNumber, reviewers),
  ),
);
ipcMain.handle(
  'github:addAssignees',
  teamHandler(({ owner, repo, issueNumber, assignees }: { owner: string; repo: string; issueNumber: number; assignees: string[] }) =>
    githubAuthService.addAssignees(owner, repo, issueNumber, assignees),
  ),
);

// ---- Skills (biblioteca do DevFlow, ativadas em todos os CLIs) ----
ipcMain.handle('skills:call', async (_event, { action, payload }: { action: string; payload: any }) => {
  try {
    const p = payload || {};
    const token = await githubAuthService.peekAccessToken();
    let data: any;
    switch (action) {
      case 'listInstalled':
        data = skillsService.listInstalled();
        break;
      case 'listExternal':
        data = skillsService.listExternal();
        break;
      case 'listSources':
        data = skillsService.getSources();
        break;
      case 'addSource':
        data = skillsService.addSource(p.input);
        break;
      case 'removeSource':
        skillsService.removeSource(p.id);
        break;
      case 'listCatalog':
        data = await skillsService.listCatalog(p.sourceId, Boolean(p.force), token || undefined);
        break;
      case 'install':
        data = await skillsService.install(p.sourceId, p.path, token || undefined);
        break;
      case 'uninstall':
        skillsService.uninstall(p.id);
        break;
      case 'setActive':
        skillsService.setActive(p.id, Boolean(p.active));
        break;
      case 'setAlwaysOn':
        skillsService.setAlwaysOn(p.id, Boolean(p.on));
        break;
      case 'searchRegistry':
        data = await skillsService.searchRegistry(p.query);
        break;
      case 'installFromRegistry':
        data = await skillsService.installFromRegistry(p.repo, p.skillId, token || undefined);
        break;
      case 'read':
        data = skillsService.readSkill(p.id);
        break;
      case 'save':
        skillsService.updateSkillMd(p.id, p.content);
        break;
      case 'create':
        data = skillsService.create(p);
        break;
      case 'importLocal':
        data = skillsService.importLocal(p.dir);
        break;
      case 'openFolder':
        await shell.openPath(p.id ? `${skillsService.root}/${p.id}` : skillsService.root);
        break;
      case 'update':
        data = await skillsService.update(p.id, token || undefined);
        break;
      case 'updateAll':
        data = await skillsService.updateAll(token || undefined);
        break;
      case 'checkUpdates':
        data = await skillsService.checkUpdates(Boolean(p.force), token || undefined);
        break;
      case 'cliArgsString':
        data = skillsService.cliArgsString(p.cmd);
        break;
      case 'summary':
        data = { active: skillsService.getActive().map((s) => ({ id: s.id, name: s.name })), installed: skillsService.listInstalled().length };
        break;
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
    if (['install', 'installFromRegistry', 'uninstall', 'setActive', 'setAlwaysOn', 'create', 'importLocal', 'update', 'updateAll'].includes(action)) {
      BrowserWindow.getAllWindows().forEach((w) => w.webContents.send('skills:changed'));
    }
    return { success: true, data };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:settings', async (_event, { action, payload }: { action: string; payload: any }) => {
  try {
    const data = await githubAuthService.settingsAction(action, payload);
    return { success: true, data };
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

ipcMain.handle('github:updateIssueComment', async (_event, { owner, repo, commentId, body }: { owner: string; repo: string; commentId: number; body: string }) => {
  try {
    const comment = await githubAuthService.updateIssueComment(owner, repo, commentId, body);
    return { success: true, comment };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('github:deleteIssueComment', async (_event, { owner, repo, commentId }: { owner: string; repo: string; commentId: number }) => {
  try {
    await githubAuthService.deleteIssueComment(owner, repo, commentId);
    return { success: true };
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

ipcMain.handle(
  'github:deleteMilestone',
  async (
    _event,
    { owner, repo, milestoneNumber }: { owner: string; repo: string; milestoneNumber: number },
  ) => {
    try {
      await githubAuthService.deleteMilestone(owner, repo, milestoneNumber);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Falha ao deletar marco' };
    }
  },
);

app.whenReady().then(() => {
  // Desativa restrições de X-Frame-Options, COOP, COEP e frame-ancestors para que o componente de navegador
  // interno da orquestração consiga renderizar localhost e páginas externas sem erro de SAMEORIGIN ou bloqueios.
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...details.responseHeaders };
    for (const key of Object.keys(responseHeaders)) {
      const lower = key.toLowerCase();
      if (
        lower === 'x-frame-options' ||
        lower === 'cross-origin-opener-policy' ||
        lower === 'cross-origin-embedder-policy' ||
        lower === 'cross-origin-resource-policy'
      ) {
        delete responseHeaders[key];
      } else if (lower === 'content-security-policy') {
        responseHeaders[key] = responseHeaders[key].map((csp) =>
          csp
            .replace(/frame-ancestors\s+[^;]+;?/gi, '')
            .replace(/frame-src\s+[^;]+;?/gi, '')
        );
      }
    }
    responseHeaders['Access-Control-Allow-Origin'] = ['*'];
    responseHeaders['Access-Control-Allow-Private-Network'] = ['true'];

    callback({ cancel: false, responseHeaders });
  });

  app.on('web-contents-created', (_, contents) => {
    contents.setWindowOpenHandler(() => {
      // Bloqueia abertura de navegador externo pelo dispositivo a partir de conteúdos web internos
      return { action: 'deny' };
    });
  });

  if (process.platform === 'darwin' && appIconImage && app.dock) {
    try {
      app.dock.setIcon(appIconImage);
    } catch {}
  }
  createWindow();
});

app.on('window-all-closed', () => {
  designRoomService.dispose();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
