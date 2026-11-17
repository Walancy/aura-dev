// Vault do Brain: as notas são os arquivos .md do projeto (como abrir uma pasta no Obsidian) e o grafo nasce dos links entre elas.

export interface VaultNote {
  /** caminho absoluto; vazio nas notas que só existem como link ([[Nota]] sem arquivo) */
  path: string;
  /** nome sem extensão, usado nos [[links]] */
  name: string;
  /** caminho relativo ao vault, mostrado na lista */
  rel: string;
  content: string;
  tags: string[];
  /** nomes alvo dos links de saída (como escritos na nota) */
  links: string[];
  mtime?: number;
}

export interface GraphNode {
  id: string;
  label: string;
  kind: 'note' | 'tag' | 'missing' | 'attachment';
  path: string;
  rel: string;
  tags: string[];
  /** número de ligações, define o tamanho do ponto */
  degree: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface GraphLink { source: string; target: string }

// pastas de dependências, builds e configs de ferramentas/IAs: os .md delas (skills, regras, docs de libs) não são notas do projeto
const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.turbo', 'release', 'out', 'coverage',
  'vendor', 'venv', '.venv', 'target', 'Pods', '.gradle', '__pycache__', '.cache', 'storybook-static', '.nuxt', '.svelte-kit', '.expo',
  '.claude', '.cursor', '.agent', '.agents', '.codex', '.gemini', '.github', '.vscode', '.idea', '.devflow', '_check', '_reference',
]);
const MAX_FILES = 1500;
const MAX_BYTES = 400_000;
const ATTACHMENT_RE = /\.(png|jpe?g|gif|svg|webp|pdf|mp3|mp4|mov)$/i;

export const BRAIN_NOTES_DIR = '.aura/brain';
/** Marca as notas escritas pela IA: elas podem ser regeneradas, as do usuário nunca. */
export const AI_NOTE_MARK = '<!-- aura:ai-generated -->';

const fsApi = () => (window as any).electronAPI?.fs;

const norm = (s: string) => s.trim().toLowerCase();
export const noteKey = (name: string) => norm(name.replace(/\.md$/i, '').split('/').pop() || name);

/** Remove blocos de código para não tratar `[[x]]` ou `#x` de exemplos como link/tag. */
const stripCode = (md: string) => md.replace(/```[\s\S]*?```/g, ' ').replace(/`[^`\n]*`/g, ' ');

export function parseNote(content: string): { tags: string[]; links: string[] } {
  const tags = new Set<string>();
  const links: string[] = [];
  let body = content;
  const fm = content.match(/^---\n([\s\S]*?)\n---/);
  if (fm) {
    body = content.slice(fm[0].length);
    const t = fm[1].match(/^tags:\s*(.*)$/m);
    if (t) t[1].replace(/[\[\]]/g, '').split(/[,\s]+/).filter(Boolean).forEach((x) => tags.add(x.replace(/^#/, '').toLowerCase()));
    const list = fm[1].match(/^tags:\s*\n((?:\s*-\s*.+\n?)+)/m);
    if (list) list[1].split('\n').forEach((l) => { const m = l.match(/^\s*-\s*(.+)$/); if (m) tags.add(m[1].trim().replace(/^#/, '').toLowerCase()); });
  }
  const text = stripCode(body);
  for (const m of text.matchAll(/!?\[\[([^\]|#\n]+)(?:#[^\]|\n]*)?(?:\|[^\]\n]*)?\]\]/g)) links.push(m[1].trim());
  for (const m of text.matchAll(/!?\[[^\]\n]*\]\(([^)\s#]+?)(?:#[^)\s]*)?\)/g)) {
    const href = m[1];
    if (/^[a-z]+:/i.test(href) && !/^file:/i.test(href)) continue;
    try { links.push(decodeURIComponent(href)); } catch { links.push(href); }
  }
  for (const m of text.matchAll(/(?:^|[\s(])#([\p{L}][\p{L}\p{N}_/-]*)/gu)) tags.add(m[1].toLowerCase());
  return { tags: [...tags], links };
}

interface TreeNode { name: string; path: string; isDirectory: boolean; extension?: string; size?: number; children?: TreeNode[] }

function flatten(nodes: TreeNode[], out: TreeNode[]) {
  for (const n of nodes) {
    if (n.isDirectory) {
      if (!IGNORED_DIRS.has(n.name)) flatten(n.children || [], out);
    } else out.push(n);
  }
}

export async function scanVault(root: string): Promise<{ notes: VaultNote[]; attachments: string[] }> {
  const fs = fsApi();
  if (!fs?.getTree) return { notes: [], attachments: [] };
  const base = root.replace(/\/+$/, '');
  const files: TreeNode[] = [];
  const main = await fs.getTree(base, 8).catch(() => null);
  flatten(Array.isArray(main) ? main : main?.tree || [], files);
  // a pasta oculta das notas do Brain não aparece no tree do projeto se for ignorada: garante a leitura
  if (!files.some((f) => f.path.startsWith(`${base}/${BRAIN_NOTES_DIR}/`))) {
    const own = await fs.getTree(`${base}/${BRAIN_NOTES_DIR}`, 4).catch(() => null);
    flatten(Array.isArray(own) ? own : own?.tree || [], files);
  }
  const mds = files.filter((f) => f.extension === '.md' && (f.size ?? 0) <= MAX_BYTES).slice(0, MAX_FILES);
  const attachments = files.filter((f) => ATTACHMENT_RE.test(f.name)).map((f) => f.path.slice(base.length + 1));
  const notes: VaultNote[] = [];
  let i = 0;
  const worker = async () => {
    while (i < mds.length) {
      const f = mds[i++];
      const res = await fs.readFile(f.path).catch(() => null);
      const content: string = res?.content ?? '';
      const { tags, links } = parseNote(content);
      notes.push({ path: f.path, name: f.name.replace(/\.md$/i, ''), rel: f.path.slice(base.length + 1), content, tags, links });
    }
  };
  await Promise.all(Array.from({ length: 8 }, worker));
  notes.sort((a, b) => a.rel.localeCompare(b.rel));
  return { notes, attachments };
}

/** Resolve o alvo de um link como o Obsidian: pelo nome do arquivo (sem pasta/extensão), ignorando maiúsculas. */
export function buildResolver(notes: VaultNote[]) {
  const byKey = new Map<string, VaultNote>();
  const byRel = new Map<string, VaultNote>();
  for (const n of notes) {
    const k = noteKey(n.name);
    // em nomes repetidos vale o arquivo mais perto da raiz, como no Obsidian
    const cur = byKey.get(k);
    if (!cur || n.rel.split('/').length < cur.rel.split('/').length) byKey.set(k, n);
    byRel.set(norm(n.rel.replace(/\.md$/i, '')), n);
  }
  return (target: string): VaultNote | undefined => byRel.get(norm(target.replace(/\.md$/i, ''))) || byKey.get(noteKey(target));
}

export interface VaultGraph {
  nodes: GraphNode[];
  links: GraphLink[];
  /** nota -> notas que apontam para ela */
  backlinks: Map<string, string[]>;
  outgoing: Map<string, string[]>;
}

export function buildGraph(notes: VaultNote[], attachments: string[], prev?: Map<string, GraphNode>): VaultGraph {
  const resolve = buildResolver(notes);
  const nodes = new Map<string, GraphNode>();
  const links: GraphLink[] = [];
  const seen = new Set<string>();
  const backlinks = new Map<string, string[]>();
  const outgoing = new Map<string, string[]>();
  const spawn = (id: string, label: string, kind: GraphNode['kind'], path: string, rel: string, tags: string[]) => {
    const p = prev?.get(id);
    const a = Math.random() * Math.PI * 2;
    const r = 40 + Math.random() * 260;
    nodes.set(id, { id, label, kind, path, rel, tags, degree: 0, x: p?.x ?? Math.cos(a) * r, y: p?.y ?? Math.sin(a) * r, vx: 0, vy: 0 });
  };
  for (const n of notes) spawn(n.path, n.name, 'note', n.path, n.rel, n.tags);
  const add = (s: string, t: string) => {
    if (s === t) return;
    const k = s < t ? `${s}\u0000${t}` : `${t}\u0000${s}`;
    if (seen.has(k)) return;
    seen.add(k);
    links.push({ source: s, target: t });
  };
  const push = (m: Map<string, string[]>, k: string, v: string) => { const l = m.get(k) || []; if (!l.includes(v)) l.push(v); m.set(k, l); };
  const attSet = new Map(attachments.map((a) => [noteKey(a.split('/').pop() || a), a]));
  for (const n of notes) {
    for (const target of n.links) {
      const hit = resolve(target);
      if (hit) {
        add(n.path, hit.path);
        push(outgoing, n.path, hit.path);
        push(backlinks, hit.path, n.path);
        continue;
      }
      const attName = (target.split('/').pop() || target).toLowerCase();
      if (ATTACHMENT_RE.test(attName)) {
        const rel = [...attSet.values()].find((a) => a.toLowerCase().endsWith(attName));
        if (rel) {
          const id = `att:${rel}`;
          if (!nodes.has(id)) spawn(id, rel.split('/').pop() || rel, 'attachment', '', rel, []);
          add(n.path, id);
        }
        continue;
      }
      if (/^[./]/.test(target) || /\.[a-z0-9]{1,5}$/i.test(target)) continue;
      const id = `missing:${noteKey(target)}`;
      if (!nodes.has(id)) spawn(id, target, 'missing', '', '', []);
      add(n.path, id);
    }
    for (const t of n.tags) {
      const id = `tag:${t}`;
      if (!nodes.has(id)) spawn(id, `#${t}`, 'tag', '', '', []);
      add(n.path, id);
    }
  }
  for (const l of links) {
    nodes.get(l.source)!.degree++;
    nodes.get(l.target)!.degree++;
  }
  return { nodes: [...nodes.values()], links, backlinks, outgoing };
}

export function newNoteTemplate(name: string): string {
  return `# ${name}\n\n`;
}

/** Texto das notas para a IA: o que o usuário escreveu no Brain vira contexto dos agentes. */
export function summarizeVaultForAi(notes: VaultNote[], limit = 25): string {
  const own = notes.filter((n) => n.rel.startsWith(`${BRAIN_NOTES_DIR}/`));
  const pool = own.length ? own : notes;
  return pool
    .slice(0, limit)
    .map((n) => {
      // a primeira frase da nota é o resumo: outras IAs entendem o mapa sem abrir cada arquivo
      const first = n.content.replace(AI_NOTE_MARK, '').split('\n').map((l) => l.trim()).find((l) => l && !/^(#|---|\[\[|-|\*)/.test(l));
      return `• [[${n.name}]] (${n.rel})${n.tags.length ? ` #${n.tags.slice(0, 4).join(' #')}` : ''}${first ? `: ${first.slice(0, 140)}` : ''}`;
    })
    .join('\n');
}
