import type { Shape } from './types';

/**
 * Acesso ao design.json de um projeto, independente de ele estar aberto no Design.
 * As escritas de um mesmo projeto são serializadas (leitura-modificação-gravação sem corrida) e quem for
 * carregar o projeto espera as gravações em andamento (waitWrites).
 */
const chains = new Map<string, Promise<unknown>>();

export const designFilePath = (ws: string) => `${ws}/.devflow/design2/design.json`;
const fsApi = () => (window as any).electronAPI?.fs;

/** Registra uma gravação em andamento para o projeto (ordem preservada). */
export function trackWrite<T>(ws: string, op: () => Promise<T>): Promise<T> {
  const prev = chains.get(ws) ?? Promise.resolve();
  const next = prev.catch(() => {}).then(op);
  chains.set(ws, next);
  next.finally(() => {
    if (chains.get(ws) === next) chains.delete(ws);
  }).catch(() => {});
  return next;
}

/** Espera as gravações pendentes do projeto (usar antes de ler o arquivo). */
export const waitWrites = (ws: string): Promise<void> => (chains.get(ws) ?? Promise.resolve()).then(() => {}, () => {});

async function readDoc(ws: string): Promise<any | null> {
  try {
    const r = await fsApi()?.readFile?.(designFilePath(ws));
    return r?.content ? JSON.parse(r.content) : null;
  } catch {
    return null;
  }
}

/** Todas as shapes salvas do projeto (todas as páginas). */
export async function readProjectShapes(ws: string): Promise<Shape[]> {
  await waitWrites(ws);
  const doc = await readDoc(ws);
  return Array.isArray(doc?.shapes) ? doc.shapes.map((s: Shape) => ({ ...s, pageId: s.pageId || 'page-1' })) : [];
}

/** Aplica `fn` às shapes salvas do projeto e grava (preserva páginas, estilos, variáveis, guias…). */
export function updateProjectShapes(ws: string, fn: (all: Shape[]) => Shape[]): Promise<void> {
  return trackWrite(ws, async () => {
    const doc = (await readDoc(ws)) || {};
    const current: Shape[] = Array.isArray(doc.shapes) ? doc.shapes.map((s: Shape) => ({ ...s, pageId: s.pageId || 'page-1' })) : [];
    const next = { ...doc, shapes: fn(current), updatedAt: Date.now() };
    await fsApi()?.writeFile?.(designFilePath(ws), JSON.stringify(next, null, 2));
  });
}

/** Design tokens salvos do projeto (null se não houver). */
export async function readProjectTokens(ws: string): Promise<any | null> {
  await waitWrites(ws);
  const doc = await readDoc(ws);
  return doc?.designTokens && typeof doc.designTokens === 'object' ? doc.designTokens : null;
}
