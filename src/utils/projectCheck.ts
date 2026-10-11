import type { IdeProblem } from '../components/ide/ProblemsPanelView';

export type CheckKind = 'tsc' | 'eslint' | 'oxlint';
export interface CheckPlan { kind: CheckKind; label: string; command: string }
export interface CheckResult { label: string; ok: boolean; count: number; error?: string }

/** tsconfig aceita comentários e vírgulas finais */
export function parseJsonLoose(text: string | undefined): any {
  if (!text) return undefined;
  try {
    return JSON.parse(text.replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_m, str) => str || '').replace(/,(\s*[}\]])/g, '$1'));
  } catch { return undefined; }
}

/** Decide o que rodar: tipos (tsc, inclusive tsconfig de referências como o do Vite) + ESLint/oxlint se o projeto os usa. */
export function planChecks(opts: { tsconfigText?: string; packageJsonText?: string; rootFiles: string[] }): CheckPlan[] {
  const plans: CheckPlan[] = [];
  const names = new Set(opts.rootFiles);
  const tsconfig = parseJsonLoose(opts.tsconfigText);
  if (opts.tsconfigText !== undefined || names.has('tsconfig.json')) {
    const refs: string[] = Array.isArray(tsconfig?.references) ? tsconfig.references.map((r: any) => r?.path).filter((p: unknown) => typeof p === 'string') : [];
    if (refs.length) refs.forEach((p) => plans.push({ kind: 'tsc', label: `TypeScript (${p.replace(/^\.\//, '')})`, command: `npx --no-install tsc -p "${p}" --noEmit --pretty false` }));
    else plans.push({ kind: 'tsc', label: 'TypeScript', command: 'npx --no-install tsc --noEmit --pretty false' });
  }
  const pkg = parseJsonLoose(opts.packageJsonText) || {};
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };
  const hasEslintConfig = [...names].some((n) => /^eslint\.config\.(c|m)?(j|t)s$/.test(n) || /^\.eslintrc(\.|$)/.test(n)) || !!pkg.eslintConfig;
  if (deps.eslint && hasEslintConfig) plans.push({ kind: 'eslint', label: 'ESLint', command: 'npx --no-install eslint . -f json' });
  if (deps.oxlint || names.has('.oxlintrc.json')) plans.push({ kind: 'oxlint', label: 'oxlint', command: 'npx --no-install oxlint -f json .' });
  return plans;
}

const abs = (ws: string, p: string) => (p.startsWith('/') ? p : `${ws.replace(/\/$/, '')}/${p}`);
const mk = (ws: string, source: string, relPath: string, line: number, column: number, sev: 'error' | 'warning' | 'info', code: string, message: string, endLine?: number, endColumn?: number): IdeProblem => {
  const filePath = abs(ws, relPath);
  return {
    id: `${source}-${filePath}:${line}:${column}:${code}:${message.slice(0, 24)}`,
    filePath,
    relPath: filePath.startsWith(ws.replace(/\/$/, '') + '/') ? filePath.slice(ws.replace(/\/$/, '').length + 1) : relPath,
    fileName: relPath.split('/').pop() || relPath,
    line, column, endLine, endColumn,
    severity: sev,
    severityCode: sev === 'error' ? 8 : sev === 'warning' ? 4 : 2,
    code, message: message.trim(), source,
  };
};

export function parseTscOutput(output: string, ws: string): IdeProblem[] {
  const re1 = /^([^(]+)\((\d+),(\d+)\):\s*(error|warning|info)\s+([A-Z0-9]+):\s*(.*)$/;
  const re2 = /^([^:]+):(\d+):(\d+)\s*-\s*(error|warning|info)\s+([A-Z0-9]+):\s*(.*)$/;
  const out: IdeProblem[] = [];
  for (const line of output.split('\n')) {
    const m = line.trim().match(re1) || line.trim().match(re2);
    if (m) out.push(mk(ws, 'tsc', m[1], +m[2], +m[3], m[4].toLowerCase() as 'error' | 'warning' | 'info', m[5], m[6]));
  }
  return out;
}

/** a saída pode vir com avisos antes do JSON */
function extractJson(text: string): any {
  const start = text.search(/^[[{]/m);
  if (start < 0) return undefined;
  const body = text.slice(start);
  try { return JSON.parse(body); } catch {
    const end = Math.max(body.lastIndexOf(']'), body.lastIndexOf('}'));
    try { return JSON.parse(body.slice(0, end + 1)); } catch { return undefined; }
  }
}

export function parseEslintJson(text: string, ws: string): IdeProblem[] | null {
  const data = extractJson(text);
  if (!Array.isArray(data)) return null;
  const out: IdeProblem[] = [];
  for (const f of data) {
    for (const m of f?.messages || []) {
      out.push(mk(ws, 'eslint', f.filePath, m.line || 1, m.column || 1, m.severity === 2 ? 'error' : 'warning', m.ruleId || 'eslint', m.message || '', m.endLine, m.endColumn));
    }
  }
  return out;
}

export function parseOxlintJson(text: string, ws: string): IdeProblem[] | null {
  const data = extractJson(text);
  const list = Array.isArray(data) ? data : Array.isArray(data?.diagnostics) ? data.diagnostics : null;
  if (!list) return null;
  return list.map((d: any) => {
    const span = d.labels?.[0]?.span || {};
    const sev = d.severity === 'error' ? 'error' : d.severity === 'advice' ? 'info' : 'warning';
    return mk(ws, 'oxlint', d.filename || '', span.line || 1, span.column || 1, sev, String(d.code || 'oxlint'), d.message || '');
  });
}
