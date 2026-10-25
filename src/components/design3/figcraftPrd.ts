export interface Prd { name: string; text: string }

const PRD_NAME = /(^|[^a-z])(prd|product[-_ ]?requirements?|requisitos?|escopo|especifica(c|ç)(a|ã)o)([^a-z]|$)/i;
const PRD_EXT = /\.(md|mdx|markdown|txt)$/i;
const MAX_CHARS = 60000;

interface Node { name: string; path: string; isDirectory: boolean; children?: Node[] }

/** Procura o PRD na pasta do projeto (raiz, docs/ e subpastas até 3 níveis): arquivo .md/.txt com "prd", "requisitos" ou "escopo" no nome. */
export async function findProjectPrd(ws: string): Promise<Prd | null> {
  const fs = (window as any).electronAPI?.fs;
  if (!ws || !fs?.getTree || !fs?.readFile) return null;
  const res = await fs.getTree(ws, 3).catch(() => null);
  const tree: Node[] = Array.isArray(res) ? res : res?.tree || [];
  const found: Node[] = [];
  const walk = (nodes: Node[]) => {
    for (const n of nodes) {
      if (n.name === 'node_modules' || n.name.startsWith('.git')) continue;
      if (n.isDirectory) walk(n.children || []);
      else if (PRD_EXT.test(n.name) && PRD_NAME.test(n.name)) found.push(n);
    }
  };
  walk(tree);
  // o mais próximo da raiz ganha; entre iguais, o que tem "prd" no nome
  found.sort((a, b) => a.path.split('/').length - b.path.split('/').length || Number(/prd/i.test(b.name)) - Number(/prd/i.test(a.name)));
  const hit = found[0];
  if (!hit) return null;
  const r = await fs.readFile(hit.path).catch(() => null);
  return typeof r?.content === 'string' && r.content.trim() ? { name: hit.name, text: r.content.slice(0, MAX_CHARS) } : null;
}

/** Arquivo de texto escolhido pelo usuário (.md, .txt...) como PRD. */
export async function readPrdFile(file: File): Promise<Prd | null> {
  const text = await file.text().catch(() => '');
  return text.trim() ? { name: file.name, text: text.slice(0, MAX_CHARS) } : null;
}

/** O pedido cita o PRD ("crie as telas do PRD")? */
export const mentionsPrd = (prompt: string) => /\bprd\b|documento de requisitos|requisitos do (projeto|produto)/i.test(prompt);
