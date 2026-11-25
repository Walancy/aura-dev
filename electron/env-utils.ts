import * as os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { execFile } from 'node:child_process';

export function getCustomPaths(): string[] {
  const userHome = process.env.HOME || os.homedir();
  if (process.platform === 'win32') {
    return [
      path.join(userHome, '.local', 'bin'),
      path.join(userHome, '.bun', 'bin'),
      path.join(userHome, '.cargo', 'bin'),
      path.join(process.env.APPDATA || path.join(userHome, 'AppData', 'Roaming'), 'npm'),
    ];
  }
  return [
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
}

const isWin = process.platform === 'win32';

/** Shell usado para executar comandos de texto: cmd.exe no Windows, zsh no macOS/Linux. */
export const SHELL_BIN = isWin ? process.env.ComSpec || 'cmd.exe' : '/bin/zsh';
/** Descarta a entrada/saída de um comando no shell acima (`< /dev/null`). */
export const NULL_DEVICE = isWin ? 'NUL' : '/dev/null';

/** Comando que localiza um executável no PATH (`where` no Windows, `which` no resto). */
export const whichCommand = (bin: string) => `${isWin ? 'where' : 'which'} ${bin}`;

/** PATH com os diretórios de CLIs de IA (claude, agy, codex...) na frente. */
export function getAugmentedPath(): string {
  return `${getCustomPaths().join(path.delimiter)}${path.delimiter}${process.env.PATH || ''}`;
}

/** Executável da CLI instalado? (procura nos diretórios conhecidos e no PATH, com .exe/.cmd no Windows) */
export function isBinaryInstalled(bin: string): boolean {
  const resolved = resolveBinaryPath(bin);
  return path.isAbsolute(resolved) && fs.existsSync(resolved);
}

/** Como rodar um comando de texto num shell: PowerShell no Windows, zsh -l -c no resto. */
export function shellInvocation(command: string): { file: string; args: string[] } {
  if (isWin) {
    const sys = path.join(process.env.SystemRoot || 'C:\Windows', 'System32', 'WindowsPowerShell', 'v1.0', 'powershell.exe');
    return { file: sys, args: ['-NoLogo', '-NoProfile', '-Command', command] };
  }
  return { file: process.env.SHELL || '/bin/zsh', args: ['-l', '-c', command] };
}

/** node não executa .cmd/.bat (shims do npm) sem shell: embrulha no cmd.exe. Para .exe e para macOS/Linux devolve igual. */
export function wrapForSpawn(file: string, args: string[]): { file: string; args: string[]; windowsVerbatimArguments?: boolean } {
  if (isWin && /\.(cmd|bat)$/i.test(file)) {
    const q = (a: string) => `"${a.replace(/"/g, '""').replace(/[\r\n]+/g, ' ')}"`;
    return { file: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', `"${[file, ...args].map(q).join(' ')}"`], windowsVerbatimArguments: true };
  }
  return { file, args };
}

export function getCleanEnv(extraEnv?: Record<string, string>): Record<string, string> {
  const userHome = process.env.HOME || '';
  const customPaths = getCustomPaths();
  const envPath = `${customPaths.join(path.delimiter)}${path.delimiter}${process.env.PATH || ''}`;

  const cleanEnv: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (
      value !== undefined &&
      !key.startsWith('ANTIGRAVITY_') &&
      !key.startsWith('VSCODE_') &&
      !key.startsWith('ELECTRON_') &&
      !key.startsWith('GEMINI_')
    ) {
      cleanEnv[key] = value;
    }
  }

  return {
    ...cleanEnv,
    TERM: 'xterm-256color',
    COLORTERM: 'truecolor',
    PATH: envPath,
    HOME: userHome,
    ...extraEnv,
  };
}

export function resolveBinaryPath(cliCmd: string): string {
  if (path.isAbsolute(cliCmd) && fs.existsSync(cliCmd)) {
    return cliCmd;
  }
  const customPaths = getCustomPaths();
  const exts = process.platform === 'win32' ? ['.exe', '.cmd', '.bat', ''] : [''];
  for (const p of [...customPaths, ...(process.env.PATH || '').split(path.delimiter).filter(Boolean)]) {
    for (const ext of exts) {
      const candidate = path.join(p, cliCmd + ext);
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }
  }
  return cliCmd;
}

export function normalizeClaudeModel(model?: string): string {
  const raw = model?.trim() || '';
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (lower === 'default' || lower === 'padrão') return '';
  if (lower.includes('sonnet') && lower.includes('1m')) return 'sonnet[1m]';
  if (lower.includes('opus') && lower.includes('1m')) return 'opus[1m]';
  if (lower.includes('fable') && lower.includes('1m')) return 'fable[1m]';
  if (lower.includes('opus') && lower.includes('plan')) return 'opusplan';
  if (lower.includes('sonnet')) return 'sonnet';
  if (lower.includes('opus')) return 'opus';
  if (lower.includes('haiku')) return 'haiku';
  if (lower.includes('fable')) return 'fable';
  if (lower.includes('best')) return 'best';
  return raw;
}

export function isStatusPass(text: string): boolean {
  const matches = [...text.matchAll(/STATUS:\s*(PASS|FAIL)/gi)];
  if (matches.length === 0) return false;
  const lastMatch = matches[matches.length - 1];
  return lastMatch[1].toUpperCase() === 'PASS';
}

/**
 * Marca a pasta como confiável em ~/.claude.json: numa pasta nova o Claude abre o diálogo "Você confia nesta pasta?" com
 * "Não, sair" como padrão, e o Enter do prompt enviado pelo app escolhe "sair" (o nó falha com "CLI encerrado antes de processar o prompt").
 * Gravação atômica (o Claude Code também escreve neste arquivo).
 */
export function ensureClaudeWorkspaceTrust(cwd: string): void {
  try {
    const file = path.join(process.env.HOME || os.homedir(), '.claude.json');
    if (!fs.existsSync(file)) return;
    const real = (() => { try { return fs.realpathSync(cwd); } catch { return cwd; } })();
    const json = JSON.parse(fs.readFileSync(file, 'utf8'));
    json.projects = json.projects || {};
    let changed = false;
    for (const key of new Set([cwd, real])) {
      if (!json.projects[key]?.hasTrustDialogAccepted) {
        json.projects[key] = { ...(json.projects[key] || {}), hasTrustDialogAccepted: true };
        changed = true;
      }
    }
    if (!changed) return;
    const tmp = `${file}.devflow-${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(json, null, 2), 'utf8');
    fs.renameSync(tmp, file);
  } catch {}
}

/**
 * Texto puro de uma saída de terminal. As TUIs (Claude, Codex) desenham o espaço entre palavras como "cursor para a direita"
 * (`ESC[1C`) e quebras de linha como "cursor para baixo": simplesmente apagar esses códigos cola as palavras
 * ("github.com no card" vira "github.comnocard" e gera URLs inválidas), então eles viram espaço/quebra antes da limpeza.
 */
export function stripTerminalControl(t: string): string {
  return t
    .replace(/\u001b\[(\d*)C/g, (_m, n: string) => ' '.repeat(Math.min(Number(n || 1) || 1, 80)))
    .replace(/\u001b\[(\d*)[BE]/g, (_m, n: string) => '\n'.repeat(Math.min(Number(n || 1) || 1, 5)))
    .replace(
      /[\u001b\u009b](?:\[[\d:;<=>?]*[ !\"#$%&'()*+,-./]*[@-~]|\][^\u0007\u001b]*(?:\u0007|\u001b\\)?|[P_X^][^\u001b]*(?:\u001b\\|\u0007)?|[()#%*+-./][0-9A-Za-z]|[@-Z\\-_])/g,
      ''
    )
    .replace(/[\u0000-\u0008\u000b-\u000c\u000e-\u001f\u007f]/g, '');
}

const LOGIN_RECHECK_MS = 10 * 60 * 1000;
const LOGIN_TEXT = /sign in|log ?in|authenticat/i;
const signedInCache = new Map<string, { ok: boolean; at: number }>();

/**
 * A CLI (agy) sem login abre o fluxo de login a cada chamada em segundo plano (cotas, modelos).
 * Sonda com `<bin> models` (não interativo) e guarda o resultado por 10 min; só falha quando a CLI pede login de forma explícita.
 */
export function isCliSignedIn(name: string, binPath: string): Promise<boolean> {
  const cached = signedInCache.get(name);
  if (cached && Date.now() - cached.at < LOGIN_RECHECK_MS) return Promise.resolve(cached.ok);
  const launch = wrapForSpawn(binPath, ['models']);
  return new Promise((resolve) => {
    execFile(launch.file, launch.args, { timeout: 8000, env: { ...process.env, PATH: getAugmentedPath() }, windowsVerbatimArguments: launch.windowsVerbatimArguments }, (err, stdout, stderr) => {
      const ok = !(err && LOGIN_TEXT.test(`${stdout}
${stderr}
${err.message}`));
      signedInCache.set(name, { ok, at: Date.now() });
      resolve(ok);
    });
  });
}
