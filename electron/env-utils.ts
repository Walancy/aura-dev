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
