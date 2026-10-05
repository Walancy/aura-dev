/** Resumo barato do projeto selecionado (README, package.json, estrutura, cores do tema) para contextualizar a IA. */
const MAX = 3500;

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
    if (n.name.startsWith('.') || /^(coverage|build|target|out|tests?|__tests__|docs)$/.test(n.name)) continue;
    out.push(`${prefix}${n.name}${n.isDirectory ? '/' : ''}`);
    if (n.isDirectory && depth > 0 && n.children?.length) flatten(n.children, depth - 1, out, prefix + '  ');
  }
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
  const readme = (await read(fs, `${workspacePath}/README.md`)).replace(/!\[.*?\]\(.*?\)/g, '').replace(/\n{2,}/g, '\n').slice(0, 1200);
  if (readme) parts.push(`README:\n${readme}`);
  try {
    const res = await fs.getTree(workspacePath, 3);
    const tree: FileNode[] = Array.isArray(res) ? res : res?.tree || [];
    const src = tree.find((n) => n.isDirectory && /^(src|app|lib|pages)$/.test(n.name));
    const lines: string[] = [];
    flatten(src?.children?.length ? [src] : tree, 2, lines);
    if (lines.length) parts.push(`Estrutura:\n${lines.join('\n')}`);
  } catch {}
  // cores do tema: tailwind/css/tokens
  for (const f of ['tailwind.config.ts', 'tailwind.config.js', 'src/index.css', 'src/styles/global.css', 'src/theme.ts', 'src/constants/theme.ts']) {
    const text = await read(fs, `${workspacePath}/${f}`);
    const colors = [...new Set((text.match(/#[0-9a-fA-F]{6}\b/g) || []).map((c) => c.toUpperCase()))].slice(0, 10);
    if (colors.length >= 3) {
      parts.push(`Cores do projeto (${f}): ${colors.join(', ')}`);
      break;
    }
  }
  return parts.join('\n').slice(0, MAX);
}
