import type { Shape } from './types';
import { unionBox, type Box } from './snap';
import { descendantIds } from './constraints';

export type AlignMode = 'left' | 'center-x' | 'right' | 'top' | 'center-y' | 'bottom';

const boxOf = (s: Shape): Box => {
  if ((s.type === 'pen' || s.type === 'pencil') && s.points && s.points.length > 0) {
    const xs = s.points.map((p) => p.x);
    const ys = s.points.map((p) => p.y);
    return { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
  }
  return { x: s.x, y: s.y, width: s.width, height: s.height };
};

/** Desloca shapes (e seus descendentes) pelos deltas informados. */
export function applyDeltas(all: Shape[], deltas: Map<string, { dx: number; dy: number }>): Shape[] {
  const effective = new Map<string, { dx: number; dy: number }>();
  deltas.forEach((d, id) => {
    effective.set(id, d);
    descendantIds(all, id).forEach((child) => {
      if (!deltas.has(child)) effective.set(child, d);
    });
  });
  return all.map((s) => {
    const d = effective.get(s.id);
    if (!d || (d.dx === 0 && d.dy === 0)) return s;
    return {
      ...s,
      x: s.x + d.dx,
      y: s.y + d.dy,
      ...(s.points ? { points: s.points.map((p) => ({ x: p.x + d.dx, y: p.y + d.dy })) } : {}),
    };
  });
}

/** Alvo do alinhamento: automático (seleção se vários, senão o pai), a seleção, o frame pai ou a área visível do canvas */
export type AlignTarget = 'auto' | 'selection' | 'parent' | 'canvas';

/** Caixa de referência e margem do alinhamento para o alvo escolhido */
export function alignReference(targets: Box[], parent: Box | null, viewport: Box, target: AlignTarget = 'auto'): { ref: Box; margin: number } {
  const sel = (): Box => unionBox(targets);
  if (target === 'selection') return { ref: sel(), margin: 0 };
  if (target === 'parent') return { ref: parent || viewport, margin: 0 };
  if (target === 'canvas') return { ref: viewport, margin: 0 };
  // automático: vários → a união deles; um só → o pai (com respiro) ou a área visível
  return targets.length > 1 ? { ref: sel(), margin: 0 } : { ref: parent || viewport, margin: 20 };
}

/** Alinha os shapes `ids` à referência (união da seleção, pai ou viewport). */
export function alignDeltas(all: Shape[], ids: string[], mode: AlignMode, ref: Box, margin = 0): Map<string, { dx: number; dy: number }> {
  const out = new Map<string, { dx: number; dy: number }>();
  for (const id of ids) {
    const s = all.find((x) => x.id === id);
    if (!s) continue;
    const b = boxOf(s);
    let dx = 0;
    let dy = 0;
    if (mode === 'left') dx = ref.x + margin - b.x;
    else if (mode === 'right') dx = ref.x + ref.width - margin - (b.x + b.width);
    else if (mode === 'center-x') dx = ref.x + ref.width / 2 - (b.x + b.width / 2);
    else if (mode === 'top') dy = ref.y + margin - b.y;
    else if (mode === 'bottom') dy = ref.y + ref.height - margin - (b.y + b.height);
    else if (mode === 'center-y') dy = ref.y + ref.height / 2 - (b.y + b.height / 2);
    out.set(id, { dx: Math.round(dx), dy: Math.round(dy) });
  }
  return out;
}

/** Distribui com espaços iguais entre os shapes (precisa de 3 ou mais). */
export function distributeDeltas(all: Shape[], ids: string[], axis: 'x' | 'y'): Map<string, { dx: number; dy: number }> {
  const out = new Map<string, { dx: number; dy: number }>();
  const items = ids
    .map((id) => all.find((s) => s.id === id))
    .filter((s): s is Shape => Boolean(s))
    .map((s) => ({ id: s.id, b: boxOf(s) }));
  if (items.length < 3) return out;
  const pos = (b: Box) => (axis === 'x' ? b.x : b.y);
  const size = (b: Box) => (axis === 'x' ? b.width : b.height);
  items.sort((a, b) => pos(a.b) - pos(b.b));
  const first = items[0].b;
  const last = items[items.length - 1].b;
  const span = pos(last) + size(last) - pos(first);
  const gap = (span - items.reduce((sum, it) => sum + size(it.b), 0)) / (items.length - 1);
  let cursor = pos(first);
  for (const it of items) {
    const delta = Math.round(cursor - pos(it.b));
    out.set(it.id, axis === 'x' ? { dx: delta, dy: 0 } : { dx: 0, dy: delta });
    cursor += size(it.b) + gap;
  }
  return out;
}
