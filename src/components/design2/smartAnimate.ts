import type { Shape } from './types';
import { descendantIds } from './constraints';
import { parseColor } from './audit';

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const toHex = ([r, g, b]: [number, number, number]) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;

/** Mistura duas cores hex; se alguma não for hex, troca no meio do caminho. */
export function lerpColor(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return t < 0.5 ? a : b;
  return toHex([lerp(ca[0], cb[0], t), lerp(ca[1], cb[1], t), lerp(ca[2], cb[2], t)]);
}

/** O frame e todos os descendentes, deslocados para que o frame fique na origem. */
export function normalizedSubtree(all: Shape[], frameId: string): Shape[] {
  const frame = all.find((s) => s.id === frameId);
  if (!frame) return [];
  const ids = new Set([frameId, ...descendantIds(all, frameId)]);
  return all
    .filter((s) => ids.has(s.id))
    .map((s) => ({
      ...s,
      x: s.x - frame.x,
      y: s.y - frame.y,
      ...(s.points ? { points: s.points.map((p) => ({ x: p.x - frame.x, y: p.y - frame.y })) } : {}),
    }));
}

const keyOf = (s: Shape) => `${s.type}|${s.name || ''}`;

/** Pares de camadas com o mesmo nome e tipo entre os dois frames (a n-ésima de cada nome com a n-ésima do outro). */
export function matchLayers(from: Shape[], to: Shape[]): Map<string, string> {
  const pool = new Map<string, Shape[]>();
  to.forEach((s) => pool.set(keyOf(s), [...(pool.get(keyOf(s)) || []), s]));
  const out = new Map<string, string>();
  // a raiz sempre casa com a raiz
  const fromRoot = from.find((s) => !s.parentId || !from.some((x) => x.id === s.parentId));
  const toRoot = to.find((s) => !s.parentId || !to.some((x) => x.id === s.parentId));
  if (fromRoot && toRoot) {
    out.set(fromRoot.id, toRoot.id);
    pool.set(keyOf(toRoot), (pool.get(keyOf(toRoot)) || []).filter((s) => s.id !== toRoot.id));
  }
  for (const s of from) {
    if (out.has(s.id) || !(s.name || '').trim()) continue; // sem nome não casa
    const cands = pool.get(keyOf(s)) || [];
    const hit = cands.shift();
    if (hit) out.set(s.id, hit.id);
  }
  return out;
}

const firstFillColor = (s: Shape) => s.fills?.find((f) => f.visible !== false)?.color ?? s.fill;

function mix(a: Shape, b: Shape, t: number): Shape {
  const next: Shape = {
    ...a,
    x: lerp(a.x, b.x, t),
    y: lerp(a.y, b.y, t),
    width: lerp(a.width, b.width, t),
    height: lerp(a.height, b.height, t),
    rotation: lerp(a.rotation || 0, b.rotation || 0, t),
    opacity: lerp(a.opacity ?? 1, b.opacity ?? 1, t),
    cornerRadius: lerp(a.cornerRadius || 0, b.cornerRadius || 0, t),
  };
  if (a.fontSize !== undefined || b.fontSize !== undefined) next.fontSize = lerp(a.fontSize ?? b.fontSize ?? 16, b.fontSize ?? a.fontSize ?? 16, t);
  const ca = firstFillColor(a);
  const cb = firstFillColor(b);
  if (ca && cb && ca !== cb) {
    const c = lerpColor(ca, cb, t);
    next.fill = c;
    if (a.fills?.length) next.fills = a.fills.map((f, i) => (i === 0 ? { ...f, color: c } : f));
  }
  if (t >= 0.5) {
    // o que não se interpola (texto, imagem, formato) troca na metade
    next.text = b.text;
    next.imageUrl = b.imageUrl;
  }
  return next;
}

/**
 * Smart animate: interpola as camadas que existem nos dois frames (posição, tamanho, rotação, opacidade, raio, cor,
 * tamanho da fonte); as que só existem em um aparecem/somem com dissolve. `t` vai de 0 (origem) a 1 (destino).
 * Os shapes devem vir de `normalizedSubtree` (frame na origem).
 */
export function interpolateFrames(from: Shape[], to: Shape[], t: number): Shape[] {
  const pairs = matchLayers(from, to);
  const toById = new Map(to.map((s) => [s.id, s]));
  const matchedTo = new Set(pairs.values());
  const out: Shape[] = [];
  for (const s of from) {
    const target = pairs.has(s.id) ? toById.get(pairs.get(s.id)!) : undefined;
    out.push(target ? { ...mix(s, target, t), id: s.id, parentId: s.parentId, zIndex: s.zIndex } : { ...s, opacity: (s.opacity ?? 1) * (1 - t) });
  }
  // entram: camadas só do destino (precisam apontar para um pai que exista na saída)
  const idMap = new Map<string, string>();
  pairs.forEach((toId, fromId) => idMap.set(toId, fromId));
  for (const s of to) {
    if (matchedTo.has(s.id)) continue;
    out.push({ ...s, id: `in-${s.id}`, parentId: s.parentId ? idMap.get(s.parentId) ?? `in-${s.parentId}` : undefined, opacity: (s.opacity ?? 1) * t, zIndex: s.zIndex });
  }
  return out;
}
