import * as os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';

export function getCustomPaths(): string[] {
  const userHome = process.env.HOME || '';
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

export function getCleanEnv(extraEnv?: Record<string, string>): Record<string, string> {
  const userHome = process.env.HOME || '';
  const customPaths = getCustomPaths();
  const envPath = `${customPaths.join(':')}:${process.env.PATH || ''}`;

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
  for (const p of customPaths) {
    const candidate = path.join(p, cliCmd);
    if (fs.existsSync(candidate)) {
      return candidate;
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
