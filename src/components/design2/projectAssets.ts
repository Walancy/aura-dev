/** Logos e ícones do projeto (arquivos de imagem/SVG) que a IA do Design pode usar nas telas quando o contexto do projeto está ligado. */
export interface ProjectAsset { id: string; name: string; path: string; kind: 'logo' | 'icon' }

interface FileNode { name: string; path: string; isDirectory: boolean; children?: FileNode[] }

const IMG = /\.(svg|png|jpe?g|webp|ico)$/i;
const SKIP_DIR = /^(node_modules|dist|build|coverage|out|target|\.git|\.next|\.nuxt|vendor|__tests__|tests?|storybook-static)$/i;
const LOGO = /(logo|logotipo|brand|marca|wordmark|favicon|symbol|isotipo)/i;
const ICON_DIR = /^(icons?|icones|ícones|svgs?|glyphs?|pictograms?)$/i;

export function pickProjectAssets(tree: FileNode[], max = 24): Array<Omit<ProjectAsset, 'id'>> {
  const found: Array<{ name: string; path: string; kind: 'logo' | 'icon'; score: number }> = [];
  const walk = (nodes: FileNode[], depth: number, inIcons: boolean) => {
    for (const n of nodes) {
      if (n.name.startsWith('.') && n.name !== '.well-known') continue;
      if (n.isDirectory) {
        if (SKIP_DIR.test(n.name) || depth > 5) continue;
        if (n.children?.length) walk(n.children, depth + 1, inIcons || ICON_DIR.test(n.name));
        continue;
      }
      if (!IMG.test(n.name)) continue;
      const logo = LOGO.test(n.name);
      if (!logo && !inIcons) continue;
      // logos primeiro; svg antes de png; arquivos mais perto da raiz antes
      const score = (logo ? 100 : 40) + (/\.svg$/i.test(n.name) ? 15 : 0) - depth * 3 - (/@[23]x|\d{3,}x\d{3,}/.test(n.name) ? 20 : 0);
      found.push({ name: n.name, path: n.path, kind: logo ? 'logo' : 'icon', score });
    }
  };
  walk(tree, 0, false);
  return found.sort((a, b) => b.score - a.score).slice(0, max).map(({ name, path, kind }) => ({ name, path, kind }));
}

const cache = new Map<string, { at: number; list: ProjectAsset[] }>();

/** Lista (com cache curto) os logos/ícones do projeto, com ids curtos (a1, a2…) que a IA referencia nos itens. */
export async function listProjectAssets(ws: string | undefined): Promise<ProjectAsset[]> {
  const fs = (window as any).electronAPI?.fs;
  if (!ws || !fs?.getTree) return [];
  const hit = cache.get(ws);
  if (hit && Date.now() - hit.at < 60000) return hit.list;
  let tree: FileNode[] = [];
  try {
    const res = await fs.getTree(ws, 5);
    tree = Array.isArray(res) ? res : res?.tree || [];
  } catch {}
  const list = pickProjectAssets(tree).map((a, i) => ({ ...a, id: `a${i + 1}` }));
  cache.set(ws, { at: Date.now(), list });
  return list;
}

export function assetsPromptBlock(list?: ProjectAsset[]): string {
  if (!list?.length) return '';
  return `ASSETS REAIS DO PROJETO (logos e ícones do próprio projeto; USE-OS no lugar de logos/ícones inventados quando fizer sentido: logo no cabeçalho/menu lateral/login, ícones de marca). Para usar: {"type":"image","asset":"<id>","width":N,"height":N} (mantém a proporção do arquivo; escolha o tamanho do slot). Prefira a versão clara em fundo escuro e a escura em fundo claro, pelo nome do arquivo:
${list.map((a) => `- ${a.id} = ${a.name} (${a.kind === 'logo' ? 'logo' : 'ícone'})`).join('\n')}
`;
}
