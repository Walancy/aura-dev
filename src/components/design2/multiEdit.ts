import type { Shape } from './types';
import { applyDeltas } from './align';

/** Propriedades que o painel mostra como "Misto" quando a seleção tem valores diferentes */
const MIXABLE: Array<keyof Shape> = ['x', 'y', 'width', 'height', 'rotation', 'opacity', 'cornerRadius', 'fill', 'stroke', 'strokeWidth', 'fontSize', 'fontWeight', 'fontFamily'];

const same = (a: unknown, b: unknown) => (a ?? null) === (b ?? null);

/** Chaves cujos valores diferem entre os shapes (vazio com menos de 2 shapes). */
export function mixedKeys(shapes: Shape[]): Set<string> {
  const out = new Set<string>();
  if (shapes.length < 2) return out;
  for (const k of MIXABLE) {
    const first = shapes[0][k];
    if (shapes.some((s) => !same(s[k], first))) out.add(k as string);
  }
  return out;
}

/**
 * Aplica a edição do painel (feita sobre o shape principal) a todos os selecionados:
 * x/y movem o conjunto pelo mesmo deslocamento do principal; o resto é gravado em cada um.
 */
export function applyPatchToSelection(all: Shape[], ids: string[], primaryId: string, patch: Partial<Shape>): Shape[] {
  const primary = all.find((s) => s.id === primaryId);
  if (!primary) return all;
  const { x, y, ...rest } = patch;
  const set = new Set(ids);
  let next = all.map((s) => (set.has(s.id) ? { ...s, ...rest } : s));
  const dx = typeof x === 'number' ? x - primary.x : 0;
  const dy = typeof y === 'number' ? y - primary.y : 0;
  if (dx !== 0 || dy !== 0) next = applyDeltas(next, new Map(ids.map((id) => [id, { dx, dy }] as const)));
  return next;
}
