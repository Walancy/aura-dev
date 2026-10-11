/**
 * Biblioteca local de referências de design: imagens que você anexa ao pedir uma tela são guardadas em
 * `<projeto>/.devflow/design2/references/` (um .txt com a imagem em data URL + um index.json) e as mais parecidas
 * com um pedido novo voltam como INSPIRAÇÃO. Nada é baixado da internet: é o que você mesmo trouxe.
 */
export interface RefEntry {
  id: string;
  file: string;
  tags: string[];
  note?: string;
  addedAt: number;
}

export interface RefFs {
  readFile: (p: string) => Promise<{ content?: string; error?: string }>;
  writeFile: (p: string, c: string) => Promise<unknown>;
}

const STOP = new Set(['para', 'com', 'uma', 'umas', 'uns', 'que', 'por', 'dos', 'das', 'tela', 'telas', 'app', 'sistema', 'crie', 'criar', 'faça', 'faca', 'gere', 'gerar', 'novo', 'nova', 'the', 'and', 'for', 'com', 'meu', 'minha', 'mais', 'muito', 'mesmo', 'como']);
const MAX_REFS = 60;

/** Palavras do pedido que servem de etiqueta (sem acento, minúsculas, sem palavras vazias). */
export function tagsFrom(text: string): string[] {
  const words = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !STOP.has(w));
  return [...new Set(words)].slice(0, 12);
}

const dir = (ws: string) => `${ws.replace(/\/$/, '')}/.devflow/design2/references`;

export async function listRefs(ws: string, fs: RefFs): Promise<RefEntry[]> {
  try {
    const r = await fs.readFile(`${dir(ws)}/index.json`);
    const list = r.content ? JSON.parse(r.content) : [];
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
}

/** Salva as imagens (data URL) com as etiquetas do pedido; mantém no máximo 60 (as mais antigas saem). */
export async function saveRefs(ws: string, dataUrls: string[], prompt: string, fs: RefFs, now = Date.now()): Promise<RefEntry[]> {
  const list = await listRefs(ws, fs);
  const tags = tagsFrom(prompt);
  const added: RefEntry[] = [];
  for (const [i, url] of dataUrls.entries()) {
    if (!url.startsWith('data:image/') || list.some((e) => e.note === url.length + ':' + url.slice(-24))) continue; // mesma imagem
    const id = `ref-${now.toString(36)}-${i}`;
    await fs.writeFile(`${dir(ws)}/${id}.txt`, url);
    added.push({ id, file: `${id}.txt`, tags, note: url.length + ':' + url.slice(-24), addedAt: now });
  }
  if (!added.length) return list;
  const next = [...list, ...added].slice(-MAX_REFS);
  await fs.writeFile(`${dir(ws)}/index.json`, JSON.stringify(next, null, 1));
  return next;
}

/** As referências que mais combinam com o pedido (mais etiquetas em comum; empate → a mais recente). */
export function matchRefs(list: RefEntry[], prompt: string, n = 2): RefEntry[] {
  const want = new Set(tagsFrom(prompt));
  return list
    .map((e) => ({ e, score: e.tags.filter((t) => want.has(t)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.e.addedAt - a.e.addedAt)
    .slice(0, n)
    .map((x) => x.e);
}

/** Lê a imagem de uma referência (data URL). */
export async function readRef(ws: string, e: RefEntry, fs: RefFs): Promise<string | null> {
  const r = await fs.readFile(`${dir(ws)}/${e.file}`);
  return r.content?.startsWith('data:image/') ? r.content : null;
}
