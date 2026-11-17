import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'node:path';
import * as fs from 'node:fs';
import * as os from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';

// Atualização pelo GitHub Releases. Não usa o electron-updater porque o app do macOS sai sem assinatura de desenvolvedor,
// e o Squirrel.Mac recusa instalar atualização de app não assinado: aqui o zip da release é baixado e o .app é trocado por um script.
const REPO = 'Walancy/aura-dev';
const RELEASES_URL = `https://github.com/${REPO}/releases`;

interface ReleaseAsset { name: string; browser_download_url: string; size: number }

export interface UpdateInfo {
  current: string;
  latest: string;
  available: boolean;
  notes: string;
  pageUrl: string;
  asset?: { name: string; url: string; size: number };
}

const parseVer = (v: string) => v.replace(/^v/i, '').split('-')[0].split('.').map((n) => parseInt(n, 10) || 0);

export function isNewer(latest: string, current: string): boolean {
  const a = parseVer(latest);
  const b = parseVer(current);
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const d = (a[i] || 0) - (b[i] || 0);
    if (d !== 0) return d > 0;
  }
  return false;
}

function pickAsset(assets: ReleaseAsset[]): ReleaseAsset | undefined {
  const find = (re: RegExp) => assets.find((a) => re.test(a.name));
  if (process.platform === 'darwin') return find(new RegExp(`mac-${process.arch === 'arm64' ? 'arm64' : 'x64'}\\.zip$`));
  if (process.platform === 'win32') return find(/windows-setup\.exe$/);
  return process.env.APPIMAGE ? find(/\.AppImage$/) : undefined;
}

export async function checkForUpdate(): Promise<UpdateInfo> {
  const current = app.getVersion();
  const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
    headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'aura-dev-updater' },
  });
  if (!res.ok) throw new Error(`GitHub respondeu ${res.status}`);
  const rel: any = await res.json();
  const latest = String(rel.tag_name || '').replace(/^v/i, '');
  const asset = pickAsset(Array.isArray(rel.assets) ? rel.assets : []);
  return {
    current,
    latest,
    available: !!latest && isNewer(latest, current),
    notes: String(rel.body || '').trim(),
    pageUrl: rel.html_url || RELEASES_URL,
    asset: asset ? { name: asset.name, url: asset.browser_download_url, size: asset.size } : undefined,
  };
}

const send = (channel: string, payload: unknown) => {
  for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.webContents.send(channel, payload);
};

async function download(url: string, dest: string, size: number): Promise<void> {
  const res = await fetch(url, { headers: { 'User-Agent': 'aura-dev-updater' } });
  if (!res.ok || !res.body) throw new Error(`Download falhou (${res.status})`);
  const total = Number(res.headers.get('content-length')) || size || 0;
  let got = 0;
  let last = 0;
  const body = Readable.fromWeb(res.body as any);
  body.on('data', (chunk: Buffer) => {
    got += chunk.length;
    const now = Date.now();
    if (total && now - last > 150) {
      last = now;
      send('updater:progress', { stage: 'download', percent: Math.min(99, Math.round((got / total) * 100)) });
    }
  });
  await pipeline(body, fs.createWriteStream(dest));
}

const run = (cmd: string, args: string[]) =>
  new Promise<void>((resolve, reject) => execFile(cmd, args, (err) => (err ? reject(err) : resolve())));

function detachedScript(file: string, body: string): void {
  fs.writeFileSync(file, `#!/bin/sh\n${body}\n`, { mode: 0o755 });
  spawn('/bin/sh', [file], { detached: true, stdio: 'ignore' }).unref();
}

async function installMac(info: UpdateInfo): Promise<void> {
  // .../Aura Dev.app/Contents/MacOS/Aura Dev -> .../Aura Dev.app
  const target = path.resolve(process.execPath, '..', '..', '..');
  if (!target.endsWith('.app')) throw new Error('caminho do app não reconhecido');
  fs.accessSync(path.dirname(target), fs.constants.W_OK);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-update-'));
  const zip = path.join(dir, info.asset!.name);
  await download(info.asset!.url, zip, info.asset!.size);
  send('updater:progress', { stage: 'install', percent: 100 });
  const out = path.join(dir, 'out');
  await run('/usr/bin/ditto', ['-x', '-k', zip, out]);
  const next = fs.readdirSync(out).find((n) => n.endsWith('.app'));
  if (!next) throw new Error('pacote sem o aplicativo');
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  const newApp = path.join(out, next);
  detachedScript(
    path.join(dir, 'install.sh'),
    [
      `while kill -0 ${process.pid} 2>/dev/null; do sleep 0.5; done`,
      `rm -rf ${q(target)}`,
      `/usr/bin/ditto ${q(newApp)} ${q(target)}`,
      `/usr/bin/xattr -dr com.apple.quarantine ${q(target)}`,
      // sem assinatura de desenvolvedor, mexer no bundle invalida a assinatura ad-hoc e o app não abre
      `/usr/bin/codesign --verify --deep ${q(target)} 2>/dev/null || /usr/bin/codesign --force --deep --sign - ${q(target)}`,
      `/usr/bin/open ${q(target)}`,
      `rm -rf ${q(dir)}`,
    ].join('\n'),
  );
}

async function installWindows(info: UpdateInfo): Promise<void> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-update-'));
  const exe = path.join(dir, info.asset!.name);
  await download(info.asset!.url, exe, info.asset!.size);
  send('updater:progress', { stage: 'install', percent: 100 });
  spawn(exe, [], { detached: true, stdio: 'ignore' }).unref();
}

async function installAppImage(info: UpdateInfo): Promise<void> {
  const target = process.env.APPIMAGE!;
  fs.accessSync(path.dirname(target), fs.constants.W_OK);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aura-update-'));
  const file = path.join(dir, info.asset!.name);
  await download(info.asset!.url, file, info.asset!.size);
  fs.chmodSync(file, 0o755);
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  detachedScript(
    path.join(dir, 'install.sh'),
    [`while kill -0 ${process.pid} 2>/dev/null; do sleep 0.5; done`, `mv -f ${q(file)} ${q(target)}`, `nohup ${q(target)} >/dev/null 2>&1 &`].join('\n'),
  );
}

export function registerUpdaterIpc(): void {
  ipcMain.handle('updater:check', async () => {
    try {
      return { success: true, info: await checkForUpdate() };
    } catch (err: any) {
      return { success: false, error: err?.message || 'falha ao verificar' };
    }
  });

  ipcMain.handle('updater:openReleasePage', async (_e, { url }: { url?: string }) => {
    const target = url && url.startsWith(RELEASES_URL) ? url : RELEASES_URL;
    await shell.openExternal(target);
    return { success: true };
  });

  // Baixa e troca o app; ao terminar o app fecha e o script abre a nova versão. Sem instalação possível, abre a página da release.
  ipcMain.handle('updater:install', async () => {
    try {
      const info = await checkForUpdate();
      if (!info.available) return { success: false, error: 'Você já está na versão mais recente.' };
      if (!app.isPackaged || !info.asset) {
        await shell.openExternal(info.pageUrl);
        return { success: true, manual: true };
      }
      send('updater:progress', { stage: 'download', percent: 0 });
      if (process.platform === 'darwin') await installMac(info);
      else if (process.platform === 'win32') await installWindows(info);
      else await installAppImage(info);
      setTimeout(() => app.quit(), 600);
      return { success: true, manual: false, version: info.latest };
    } catch (err: any) {
      return { success: false, error: err?.message || 'falha ao atualizar' };
    }
  });
}
