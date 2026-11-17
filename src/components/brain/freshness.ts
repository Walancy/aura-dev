// Frescor do Brain: compara o mapa com o projeto (commits desde a última atualização, arquivos citados que sumiram)
// para avisar quando as notas ficaram defasadas e permitir o ajuste focado da IA.
import { AI_NOTE_MARK, BRAIN_NOTES_DIR, type VaultNote } from './vault';

const PATH_ENV = 'export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; ';
const META = (root: string) => `${root}/.aura/brain-meta.json`;
const sh = async (cmd: string, cwd: string) => {
  const r = await (window as any).electronAPI?.shell?.exec?.(PATH_ENV + cmd, cwd).catch(() => null);
  return r && r.exitCode === 0 ? String(r.stdout || '').trim() : null;
};
const clean = (ws: string) => ws.replace(/\/+$/, '');

export const gitHead = (ws: string) => sh('git rev-parse HEAD', clean(ws));

export async function readBrainMeta(ws: string): Promise<{ commit: string; at: number } | null> {
  const res = await (window as any).electronAPI?.fs?.readFile?.(META(clean(ws))).catch(() => null);
  try { return res?.content ? JSON.parse(res.content) : null; } catch { return null; }
}

/** Marca o commit atual como o ponto em que o mapa estava em dia. */
export async function markBrainFresh(ws: string): Promise<void> {
  const commit = await gitHead(ws);
  if (!commit) return;
  await (window as any).electronAPI?.fs?.writeFile?.(META(clean(ws)), JSON.stringify({ commit, at: Date.now() })).catch(() => {});
}

export interface Staleness { commits: number; changed: string[] }

/** Commits e arquivos alterados desde a última atualização; null quando não dá para saber (sem git, sem marca ou histórico reescrito). */
export async function brainStaleness(ws: string): Promise<Staleness | null> {
  const root = clean(ws);
  const meta = await readBrainMeta(root);
  if (!meta?.commit) return null;
  const count = await sh(`git rev-list --count ${meta.commit}..HEAD`, root);
  if (count === null) return null;
  const files = await sh(`git diff --name-only ${meta.commit} HEAD`, root);
  const changed = (files || '').split('\n').map((l) => l.trim()).filter((f) => f && !f.startsWith(`${BRAIN_NOTES_DIR}/`) && !f.startsWith('.aura/') && !/^(CLAUDE|AGENTS|GEMINI)\.md$/.test(f));
  return { commits: Number(count) || 0, changed: changed.slice(0, 80) };
}

/** Caminhos de arquivos que a nota cita (com pasta e extensão), em crase ou solto no texto. */
export function extractPaths(content: string): string[] {
  const text = content.replace(AI_NOTE_MARK, '').replace(/\[\[[^\]]*\]\]/g, ' ').replace(/https?:\/\/\S+/g, ' ');
  const out = new Set<string>();
  for (const m of text.matchAll(/(?:^|[\s`'"(\-*])((?:\.{0,2}\/)?(?:[\w@.\-]+\/)+[\w@.\-]+\.[A-Za-z0-9]{1,6})(?=$|[\s`'"),:;.\]*])/gm)) {
    const p = m[1].replace(/^\.\//, '');
    if (p.startsWith('/') || p.startsWith('..') || p.includes('*') || p.startsWith(`${BRAIN_NOTES_DIR}/`)) continue;
    out.add(p);
  }
  return [...out];
}

/** Para cada nota, os arquivos citados que não existem mais no projeto. */
export async function findBrokenRefs(ws: string, notes: VaultNote[]): Promise<Map<string, string[]>> {
  const root = clean(ws);
  const byNote = new Map<string, string[]>();
  const all = new Set<string>();
  for (const n of notes) {
    const paths = extractPaths(n.content);
    if (paths.length) { byNote.set(n.path, paths); paths.forEach((p) => all.add(p)); }
  }
  const list = [...all].slice(0, 500);
  if (!list.length) return new Map();
  const q = (s: string) => `'${s.replace(/'/g, `'\\''`)}'`;
  const out = await sh(`for p in ${list.map(q).join(' ')}; do [ -e "$p" ] || echo "$p"; done`, root);
  if (out === null) return new Map();
  const missing = new Set(out.split('\n').filter(Boolean));
  const broken = new Map<string, string[]>();
  for (const [path, paths] of byNote) {
    const bad = paths.filter((p) => missing.has(p));
    if (bad.length) broken.set(path, bad);
  }
  return broken;
}
