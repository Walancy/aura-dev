/** Resumo barato do projeto selecionado (README, docs .md, package.json, estrutura, telas, entidades, cores) para contextualizar a IA. */
const MAX = 9000;

interface FileNode { name: string; path: string; isDirectory: boolean; children?: FileNode[] }

const read = async (fs: any, p: string): Promise<string> => {
  try {
    const r = await fs.readFile(p);
    return typeof r?.content === 'string' ? r.content : '';
  } catch {
    return '';
  }
};

function flatten(nodes: FileNode[], depth: number, out: string[], prefix = ''): void {
  for (const n of nodes) {
    if (out.length >= 90) return;
    if (n.name.startsWith('.') || /^(coverage|build|target|out|tests?|__tests__|docs?|documentation)$/.test(n.name)) continue;
    out.push(`${prefix}${n.name}${n.isDirectory ? '/' : ''}`);
    if (n.isDirectory && depth > 0 && n.children?.length) flatten(n.children, depth - 1, out, prefix + '  ');
  }
}

const DOC_DIRS = /^(docs?|documentation|documentacao|documentação|specs?|\.github)$/i;
const SKIP_DOC = /^(changelog|license|licence|contributing|code_of_conduct|security|history|node_modules)/i;

/** Pontuação de relevância de um .md para entender o produto (maior = mais útil). */
export function docScore(path: string): number {
  const name = path.split('/').pop() || '';
  const base = name.replace(/\.(md|mdx|markdown)$/i, '');
  if (SKIP_DOC.test(base)) return -1;
  if (/^readme$/i.test(base)) return 100;
  if (/^(claude|agents|gemini)$/i.test(base)) return 90;
  if (/(prd|product|produto|spec|requisito|requirement|escopo|visao|visão|vision|overview|sobre)/i.test(base)) return 80;
  if (/(arquitetura|architecture|design|fluxo|flow|domain|dominio|domínio|regras|rules|glossar)/i.test(base)) return 70;
  if (/(roadmap|plan|todo|guide|guia|manual)/i.test(base)) return 50;
  return 30;
}

/** Escolhe os .md mais úteis: raiz e pastas de documentação (até 2 níveis). */
export function pickDocs(tree: FileNode[], max = 6): string[] {
  const found: string[] = [];
  const isMd = (n: FileNode) => !n.isDirectory && /\.(md|mdx|markdown)$/i.test(n.name);
  for (const n of tree) {
    if (isMd(n)) found.push(n.path);
    else if (n.isDirectory && DOC_DIRS.test(n.name)) {
      for (const c of n.children || []) {
        if (isMd(c)) found.push(c.path);
        else if (c.isDirectory) for (const g of c.children || []) if (isMd(g)) found.push(g.path);
      }
    }
  }
  return found
    .map((p) => [p, docScore(p)] as const)
    .filter(([, sc]) => sc >= 0)
    .sort((a, b) => b[1] - a[1] || a[0].length - b[0].length)
    .slice(0, max)
    .map(([p]) => p);
}

/** Markdown enxuto: sem imagens/badges/HTML, linhas em branco e blocos de código longos. */
export function cleanMarkdown(md: string, limit: number): string {
  return md
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[!\[[^\]]*\]\([^)]*\)\]\([^)]*\)/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/```[\s\S]{300,}?```/g, '```…```')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, limit);
}

/** Telas/rotas existentes (nomes de arquivos em pastas típicas) e entidades do domínio (models do Prisma). */
function findScreens(tree: FileNode[]): string[] {
  const out: string[] = [];
  const walk = (nodes: FileNode[], depth: number, inside: boolean) => {
    for (const n of nodes) {
      if (out.length >= 40) return;
      if (n.isDirectory) {
        if (depth < 4) walk(n.children || [], depth + 1, inside || /^(pages?|screens?|views?|routes?|app|features?|modules?)$/i.test(n.name));
      } else if (inside && /\.(tsx|jsx|vue|svelte|dart|html|swift|kt)$/i.test(n.name) && !/\.(test|spec|stories)\./i.test(n.name) && !/^(index|_|layout|loading|error)/i.test(n.name)) {
        out.push(n.name.replace(/\.[^.]+$/, ''));
      }
    }
  };
  walk(tree, 0, false);
  return [...new Set(out)];
}

export async function buildProjectDigest(workspacePath: string | undefined): Promise<string> {
  const fs = (window as any).electronAPI?.fs;
  if (!workspacePath || !fs) return '';
  const parts: string[] = [];
  try {
    const pkg = await read(fs, `${workspacePath}/package.json`);
    if (pkg) {
      const j = JSON.parse(pkg);
      const deps = Object.keys({ ...j.dependencies, ...j.devDependencies }).slice(0, 25).join(', ');
      parts.push(`package.json: ${j.name || ''} — ${j.description || ''} | deps: ${deps}`);
    }
  } catch {}

  let tree: FileNode[] = [];
  try {
    const res = await fs.getTree(workspacePath, 3);
    tree = Array.isArray(res) ? res : res?.tree || [];
  } catch {}

  // documentação em markdown (README, CLAUDE/AGENTS, PRD/spec, docs/): descreve o produto com as palavras do dono
  try {
    const docs = pickDocs(tree);
    if (!docs.some((p) => /readme/i.test(p))) docs.unshift(`${workspacePath}/README.md`);
    let used = 0;
    for (const p of docs.slice(0, 6)) {
      const limit = /readme/i.test(p) ? 2600 : 1800;
      const text = cleanMarkdown(await read(fs, p), limit);
      if (!text) continue;
      const rel = p.startsWith(workspacePath) ? p.slice(workspacePath.length + 1) : p;
      parts.push(`Documento ${rel}:\n${text}`);
      used += text.length;
      if (used > 6500) break;
    }
  } catch {}

  // pastas da raiz: muitas vezes o nome do módulo/produto está aqui (ex.: EB360_Comercial)
  try {
    const roots = tree.filter((n) => n.isDirectory && !n.name.startsWith('.') && !/^(node_modules|dist|build|coverage|out|target|templates?|scripts?|public|assets?)$/i.test(n.name)).map((n) => n.name);
    if (roots.length) parts.push(`Pastas na raiz: ${roots.slice(0, 20).join(', ')}`);
  } catch {}

  try {
    const src = tree.find((n) => n.isDirectory && /^(src|app|lib|pages)$/.test(n.name));
    const lines: string[] = [];
    flatten(src?.children?.length ? [src] : tree, 2, lines);
    if (lines.length) parts.push(`Estrutura:\n${lines.join('\n')}`);
    const screens = findScreens(tree);
    if (screens.length) parts.push(`Telas/rotas existentes: ${screens.join(', ')}`);
  } catch {}

  // entidades do domínio (Prisma)
  for (const f of ['prisma/schema.prisma', 'schema.prisma']) {
    const text = await read(fs, `${workspacePath}/${f}`);
    const models = [...text.matchAll(/^model\s+(\w+)/gm)].map((m) => m[1]);
    if (models.length) {
      parts.push(`Entidades (${f}): ${models.slice(0, 30).join(', ')}`);
      break;
    }
  }

  // cores do tema: tailwind/css/tokens
  for (const f of ['tailwind.config.ts', 'tailwind.config.js', 'src/index.css', 'src/styles/global.css', 'src/theme.ts', 'src/constants/theme.ts', 'src/tokens/colors.ts', 'src/tokens/tokens.css']) {
    const text = await read(fs, `${workspacePath}/${f}`);
    const colors = [...new Set((text.match(/#[0-9a-fA-F]{6}\b/g) || []).map((c) => c.toUpperCase()))].slice(0, 10);
    if (colors.length >= 3) {
      parts.push(`Cores do projeto (${f}): ${colors.join(', ')}`);
      break;
    }
  }
  return parts.join('\n\n').slice(0, MAX);
}
