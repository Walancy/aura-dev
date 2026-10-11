import type { Shape } from './types';
import { descendantIds } from './constraints';
import { duplicateShapes } from './duplicate';
import { unionBox } from './snap';

/** Conteúdo copiado: os elementos escolhidos (raízes) e todos os descendentes, como estavam. */
export interface Clip {
  shapes: Shape[];
  rootIds: string[];
}

/** Copia a seleção com descendentes. Raízes cujo ancestral também foi escolhido não contam como raiz. */
export function copySubtree(all: Shape[], ids: string[]): Clip | null {
  const chosen = ids.filter((id) => all.some((s) => s.id === id));
  if (!chosen.length) return null;
  const include = new Set<string>();
  chosen.forEach((id) => {
    include.add(id);
    descendantIds(all, id).forEach((d) => include.add(d));
  });
  // raiz = escolhido cujo pai não está no conjunto copiado
  const roots = chosen.filter((id) => {
    const s = all.find((x) => x.id === id)!;
    return !(s.parentId && include.has(s.parentId));
  });
  return { shapes: all.filter((s) => include.has(s.id)).map((s) => ({ ...s })), rootIds: roots };
}

export interface PasteOptions {
  /** desloca a cópia (padrão 30,30; use 0,0 para colar no mesmo lugar) */
  offset?: { x: number; y: number };
  /** em vez de deslocar: leva o canto superior esquerdo do conjunto para este ponto */
  at?: { x: number; y: number };
  pageId?: string;
}

/** Gera as cópias a inserir. Ids novos, hierarquia interna preservada, z acima do que já existe. */
export function pasteClip(clip: Clip, existing: Shape[], opts: PasteOptions = {}, idGen: () => string = () => crypto.randomUUID()): { shapes: Shape[]; newRootIds: string[] } {
  const { shapes: copies, newRootIds } = duplicateShapes(clip.shapes, clip.rootIds, { x: 0, y: 0 }, idGen);
  let dx = opts.offset?.x ?? 30;
  let dy = opts.offset?.y ?? 30;
  if (opts.at) {
    const roots = copies.filter((s) => newRootIds.includes(s.id));
    const box = unionBox(roots.map((s) => ({ x: s.x, y: s.y, width: s.width, height: s.height })));
    dx = opts.at.x - box.x;
    dy = opts.at.y - box.y;
  }
  const ids = new Set(existing.map((s) => s.id));
  let z = Math.max(0, ...existing.map((s) => s.zIndex));
  const out = copies
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((s) => ({
      ...s,
      x: s.x + dx,
      y: s.y + dy,
      ...(s.points ? { points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : {}),
      // raiz sem o pai original na página (copiado de outra página ou apagado) sobe para a raiz
      parentId: s.parentId && (ids.has(s.parentId) || copies.some((c) => c.id === s.parentId)) ? s.parentId : undefined,
      zIndex: ++z,
      ...(opts.pageId ? { pageId: opts.pageId } : {}),
    }));
  return { shapes: out, newRootIds };
}

/** Substitui `targetId` (e descendentes) pelo primeiro item copiado, no mesmo lugar, tamanho e camada. */
export function replaceWithClip(clip: Clip, all: Shape[], targetId: string, idGen: () => string = () => crypto.randomUUID()): { shapes: Shape[]; newRootId: string } | null {
  const target = all.find((s) => s.id === targetId);
  const rootId = clip.rootIds[0];
  const root = clip.shapes.find((s) => s.id === rootId);
  if (!target || !root) return null;
  const single: Clip = { shapes: clip.shapes.filter((s) => s.id === rootId || descendantIds(clip.shapes, rootId).includes(s.id)), rootIds: [rootId] };
  const { shapes: copies, newRootIds } = pasteClip(single, [], { offset: { x: 0, y: 0 } }, idGen);
  const newRoot = copies.find((s) => s.id === newRootIds[0])!;
  const dx = target.x - newRoot.x;
  const dy = target.y - newRoot.y;
  const drop = new Set([targetId, ...descendantIds(all, targetId)]);
  const placed = copies.map((s) => ({
    ...s,
    x: s.x + dx,
    y: s.y + dy,
    ...(s.points ? { points: s.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : {}),
    ...(s.id === newRoot.id ? { width: target.width, height: target.height, parentId: target.parentId, zIndex: target.zIndex, pageId: target.pageId } : { zIndex: Math.max(...all.map((a) => a.zIndex), 0) + 1 }),
  }));
  return { shapes: [...all.filter((s) => !drop.has(s.id)), ...placed], newRootId: newRoot.id };
}
