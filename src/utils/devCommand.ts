import { parseJsonLoose } from './projectCheck';

export interface DevCommand { command: string; label: string }

/** Descobre como subir o projeto: gerenciador de pacotes (campo packageManager, depois lockfile) e script dev/start, ou outras stacks. */
export type PackageManager = 'npm' | 'yarn' | 'bun' | 'pnpm';
export const PACKAGE_MANAGERS: PackageManager[] = ['npm', 'yarn', 'bun', 'pnpm'];

/** Comando para rodar um script do package.json no gerenciador escolhido; `force` repassa --force ao script (ex.: portless, vite) */
export function scriptCommand(pm: PackageManager, script: string, force = false): string {
  const base = pm === 'npm' ? (script === 'start' ? 'npm start' : `npm run ${script}`) : pm === 'bun' ? `bun run ${script}` : `${pm} ${script}`;
  if (!force) return base;
  return pm === 'npm' ? `${base} -- --force` : `${base} --force`; // o npm precisa do "--" para repassar a flag ao script
}

/** Scripts do package.json, os de desenvolvimento (dev, start...) primeiro */
export function listScripts(packageJsonText?: string): string[] {
  const scripts = parseJsonLoose(packageJsonText)?.scripts;
  if (!scripts || typeof scripts !== 'object') return [];
  const names = Object.keys(scripts).filter((k) => typeof scripts[k] === 'string');
  const rank = (n: string) => { const i = ['dev', 'start:dev', 'develop', 'start', 'serve'].indexOf(n); return i < 0 ? (/^(dev|start|serve|preview)/.test(n) ? 10 : 20) : i; };
  return names.sort((a, b) => rank(a) - rank(b));
}

/** Gerenciador do projeto: campo packageManager; depois o lock mais recente (empate: o que os scripts citam); senão npm */
export function detectPackageManager(opts: { rootFiles: string[]; packageJsonText?: string; lockMtimes?: Record<string, number> }): PackageManager {
  const files = new Set(opts.rootFiles);
  const pkg = parseJsonLoose(opts.packageJsonText);
  const scripts: Record<string, unknown> = pkg?.scripts || {};
  const declared = typeof pkg?.packageManager === 'string' ? String(pkg.packageManager).split('@')[0] : '';
  if ((PACKAGE_MANAGERS as string[]).includes(declared)) return declared as PackageManager;
  const LOCK_PM: Array<[string, PackageManager]> = [['bun.lock', 'bun'], ['bun.lockb', 'bun'], ['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['package-lock.json', 'npm'], ['npm-shrinkwrap.json', 'npm']];
  const present = LOCK_PM.filter(([f]) => files.has(f));
  // empate de datas (um checkout grava todos juntos): o que os próprios scripts citam (bun run, pnpm...) ou o bunfig.toml decide; senão a ordem acima
  const hint = (pmName: string) => (files.has('bunfig.toml') && pmName === 'bun' ? 1 : 0) + (new RegExp(`\\b${pmName}( run| x| install|x)? `).test(JSON.stringify(scripts)) ? 1 : 0);
  const newest = [...present].sort((a, b) => (opts.lockMtimes?.[b[0]] ?? 0) - (opts.lockMtimes?.[a[0]] ?? 0) || hint(b[1]) - hint(a[1]))[0];
  return newest ? newest[1] : 'npm';
}

/** Comandos de outras stacks (sem package.json): deno, Django, docker compose, Flutter, Cargo, Go, Make */
export function otherCommands(opts: { rootFiles: string[]; denoJsonText?: string; makefileText?: string }): DevCommand[] {
  const files = new Set(opts.rootFiles);
  const out: DevCommand[] = [];
  const deno = parseJsonLoose(opts.denoJsonText);
  for (const t of ['dev', 'start', 'serve']) if (typeof deno?.tasks?.[t] === 'string') out.push({ command: `deno task ${t}`, label: `deno task ${t}` });
  if (files.has('pubspec.yaml')) out.push({ command: 'flutter run', label: 'flutter run' });
  if (files.has('manage.py')) out.push({ command: 'python manage.py runserver', label: 'Django runserver' });
  if (['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml'].some((f) => files.has(f))) out.push({ command: 'docker compose up', label: 'docker compose up' });
  if (files.has('Cargo.toml')) out.push({ command: 'cargo run', label: 'cargo run' });
  if (files.has('go.mod')) out.push({ command: 'go run .', label: 'go run .' });
  for (const t of ['dev', 'run', 'start', 'serve']) if (new RegExp(`^${t}:`, 'm').test(opts.makefileText || '')) { out.push({ command: `make ${t}`, label: `make ${t}` }); break; }
  return out;
}

export function detectDevCommand(opts: { rootFiles: string[]; packageJsonText?: string; denoJsonText?: string; makefileText?: string; /** data de modificação (ms) dos arquivos de lock: com mais de um lock, vale o mais recente */ lockMtimes?: Record<string, number> }): DevCommand | null {
  const files = new Set(opts.rootFiles);
  const pkg = parseJsonLoose(opts.packageJsonText);
  const scripts: Record<string, unknown> = pkg?.scripts || {};
  const script = ['dev', 'start:dev', 'develop', 'start', 'serve'].find((k) => typeof scripts[k] === 'string');
  if (pkg && script) {
    const declared = typeof pkg.packageManager === 'string' ? String(pkg.packageManager).split('@')[0] : '';
    const LOCK_PM: Array<[string, string]> = [['bun.lock', 'bun'], ['bun.lockb', 'bun'], ['pnpm-lock.yaml', 'pnpm'], ['yarn.lock', 'yarn'], ['package-lock.json', 'npm'], ['npm-shrinkwrap.json', 'npm']];
    const present = LOCK_PM.filter(([f]) => files.has(f));
    // vários locks (ex.: bun.lock e package-lock.json): usa o gerenciador do lock alterado por último
    // empate de datas (um checkout grava todos juntos): o que os próprios scripts citam (bun run, pnpm...) ou o bunfig.toml decide; senão a ordem acima
    const hint = (pmName: string) => (files.has('bunfig.toml') && pmName === 'bun' ? 1 : 0) + (new RegExp(`\\b${pmName}( run| x| install|x)? `).test(JSON.stringify(scripts)) ? 1 : 0);
    const newest = [...present].sort((a, b) => (opts.lockMtimes?.[b[0]] ?? 0) - (opts.lockMtimes?.[a[0]] ?? 0) || hint(b[1]) - hint(a[1]))[0];
    const pm = ['bun', 'pnpm', 'yarn', 'npm'].includes(declared) ? declared : newest ? newest[1] : 'npm';
    const command = pm === 'npm' ? (script === 'start' ? 'npm start' : `npm run ${script}`) : pm === 'bun' ? `bun run ${script}` : `${pm} ${script}`;
    return { command, label: command };
  }
  const deno = parseJsonLoose(opts.denoJsonText);
  const denoTask = ['dev', 'start', 'serve'].find((k) => typeof deno?.tasks?.[k] === 'string');
  if (denoTask) return { command: `deno task ${denoTask}`, label: `deno task ${denoTask}` };
  if (files.has('pubspec.yaml')) return { command: 'flutter run', label: 'flutter run' };
  if (files.has('manage.py')) return { command: 'python manage.py runserver', label: 'Django runserver' };
  if (files.has('docker-compose.yml') || files.has('docker-compose.yaml') || files.has('compose.yml') || files.has('compose.yaml')) return { command: 'docker compose up', label: 'docker compose up' };
  if (files.has('Cargo.toml')) return { command: 'cargo run', label: 'cargo run' };
  if (files.has('go.mod')) return { command: 'go run .', label: 'go run .' };
  if (files.has('Makefile') && /^(dev|run|start|serve):/m.test(opts.makefileText || '')) {
    const t = /^(dev|run|start|serve):/m.exec(opts.makefileText || '')![1];
    return { command: `make ${t}`, label: `make ${t}` };
  }
  return null;
}
