import type { Shape } from './types';
import { descendantIds } from './constraints';

/** Uma cor usada na seleção (como o "Selection colors" do Figma). `opacity` em 0–100. */
export interface SelectionColor { key: string; hex: string; opacity: number; count: number }

const HEX6 = /^#[0-9a-fA-F]{6}$/;
const norm = (c: string) => (HEX6.test(c) ? c.toUpperCase() : /^#[0-9a-fA-F]{3}$/.test(c) ? '#' + c.slice(1).split('').map((x) => x + x).join('').toUpperCase() : null);
export const colorKey = (hex: string, opacity: number) => `${hex.toUpperCase()}@${Math.round(opacity)}`;

function scopeOf(all: Shape[], rootIds: string[]): Shape[] {
  const ids = new Set<string>();
  for (const id of rootIds) { ids.add(id); descendantIds(all, id).forEach((d) => ids.add(d)); }
  return all.filter((s) => ids.has(s.id) && s.visible !== false); // inclui as peças do aparelho (barra de status, ilha, indicador home…)
}

/** Cores sólidas de preenchimento, traço e sombras de TODAS as camadas da seleção (e descendentes), da mais usada à menos. */
export function collectSelectionColors(all: Shape[], rootIds: string[]): SelectionColor[] {
  const map = new Map<string, SelectionColor>();
  const add = (color: unknown, opacity: number) => {
    const hex = typeof color === 'string' ? norm(color.slice(0, 7)) : null;
    if (!hex) return;
    const key = colorKey(hex, opacity * 100);
    const e = map.get(key);
    if (e) e.count++;
    else map.set(key, { key, hex, opacity: Math.round(opacity * 100), count: 1 });
  };
  for (const s of scopeOf(all, rootIds)) {
    if (s.fills?.length) for (const f of s.fills) { if (f.visible !== false && (!f.type || f.type === 'solid')) add(f.color, f.opacity ?? 1); }
    else if (s.fill && s.fill !== 'none' && s.fill !== 'transparent' && s.type !== 'image') add(s.fill, 1);
    if (s.strokes?.length) for (const st of s.strokes) { if (st.visible !== false) add(st.color, st.opacity ?? 1); }
    else if (s.stroke && s.stroke !== 'none' && (s.strokeWidth || 0) > 0) add(s.stroke, 1);
    for (const e of s.effects || []) if (e.visible !== false && (e.type === 'drop-shadow' || e.type === 'inner-shadow')) add(e.color, e.opacity ?? 1);
  }
  return [...map.values()].sort((a, b) => b.count - a.count).slice(0, 40);
}

/** Troca, em toda a seleção, a cor `from` por `to` (hex e/ou opacidade). Devolve os shapes atualizados (os de fora ficam iguais). */
export function replaceSelectionColor(all: Shape[], rootIds: string[], from: { hex: string; opacity: number }, to: { hex: string; opacity: number }): Shape[] {
  const inScope = new Set(scopeOf(all, rootIds).map((s) => s.id));
  const fromKey = colorKey(from.hex, from.opacity);
  const same = (color: unknown, opacity: number) => { const h = typeof color === 'string' ? norm(color.slice(0, 7)) : null; return !!h && colorKey(h, opacity * 100) === fromKey; };
  const toOp = to.opacity / 100;
  return all.map((s) => {
    if (!inScope.has(s.id)) return s;
    let next = s;
    if (s.fills?.length) {
      if (s.fills.some((f) => f.visible !== false && (!f.type || f.type === 'solid') && same(f.color, f.opacity ?? 1))) {
        const fills = s.fills.map((f) => (f.visible !== false && (!f.type || f.type === 'solid') && same(f.color, f.opacity ?? 1) ? { ...f, color: to.hex, opacity: toOp } : f));
        next = { ...next, fills, fill: fills.find((f) => !f.type || f.type === 'solid')?.color || next.fill };
      }
    } else if (s.fill && s.type !== 'image' && same(s.fill, 1)) {
      next = to.opacity === 100 ? { ...next, fill: to.hex } : { ...next, fill: to.hex, fills: [{ id: `f-${s.id}`, color: to.hex, opacity: toOp, visible: true, type: 'solid' }] };
    }
    if (s.strokes?.length) {
      if (s.strokes.some((st) => st.visible !== false && same(st.color, st.opacity ?? 1))) {
        const strokes = s.strokes.map((st) => (st.visible !== false && same(st.color, st.opacity ?? 1) ? { ...st, color: to.hex, opacity: toOp } : st));
        next = { ...next, strokes, stroke: strokes[0]?.color || next.stroke };
      }
    } else if (s.stroke && s.stroke !== 'none' && (s.strokeWidth || 0) > 0 && same(s.stroke, 1)) {
      next = { ...next, stroke: to.hex };
    }
    if (s.effects?.some((e) => e.visible !== false && (e.type === 'drop-shadow' || e.type === 'inner-shadow') && same(e.color, e.opacity ?? 1))) {
      next = { ...next, effects: s.effects.map((e) => ((e.type === 'drop-shadow' || e.type === 'inner-shadow') && e.visible !== false && same(e.color, e.opacity ?? 1) ? { ...e, color: to.hex, opacity: toOp } : e)) };
    }
    return next;
  });
}
