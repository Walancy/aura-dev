import type { Shape } from './types';
import { descendantIds } from './constraints';
import { duplicateShapes } from './duplicate';
import { applyDeltas } from './align';
import { unionBox } from './snap';

/** "Tamanho=Grande, Estado=Hover" → { Tamanho: 'Grande', Estado: 'Hover' } */
export function parseVariantName(name?: string): Record<string, string> {
  const out: Record<string, string> = {};
  (name || '').split(',').forEach((part) => {
    const [k, ...v] = part.split('=');
    if (k && v.length) out[k.trim()] = v.join('=').trim();
  });
  return out;
}

export const variantLabel = (axes: Array<{ name: string }>, values: string[]) => axes.map((a, i) => `${a.name}=${values[i]}`).join(', ');

export interface VariantAxis {
  name: string;
  values: string[];
}

/** Eixos do grupo, na ordem em que aparecem nos nomes das variantes. */
export function variantAxes(components: Shape[]): VariantAxis[] {
  const axes: VariantAxis[] = [];
  for (const c of components) {
    for (const [k, v] of Object.entries(parseVariantName(c.variantName))) {
      let ax = axes.find((a) => a.name === k);
      if (!ax) axes.push((ax = { name: k, values: [] }));
      if (!ax.values.includes(v)) ax.values.push(v);
    }
  }
  return axes;
}

/**
 * Organiza as variantes do grupo numa matriz: colunas pelo 1º eixo, linhas pelo 2º (ou uma linha só), a partir do
 * canto superior esquerdo do conjunto. Cada componente leva os filhos.
 */
export function arrangeVariants(all: Shape[], group: string, gap = 40): Shape[] {
  const comps = all.filter((s) => s.isComponent && s.variantGroup === group);
  if (comps.length < 2) return all;
  const axes = variantAxes(comps);
  const origin = unionBox(comps.map((c) => ({ x: c.x, y: c.y, width: c.width, height: c.height })));
  const cell = (c: Shape) => {
    const v = parseVariantName(c.variantName);
    const col = axes[0] ? Math.max(0, axes[0].values.indexOf(v[axes[0].name])) : 0;
    const row = axes[1] ? Math.max(0, axes[1].values.indexOf(v[axes[1].name])) : 0;
    return { col, row };
  };
  const cols = Math.max(...comps.map((c) => cell(c).col)) + 1;
  const rows = Math.max(...comps.map((c) => cell(c).row)) + 1;
  const colW = Array.from({ length: cols }, (_, i) => Math.max(0, ...comps.filter((c) => cell(c).col === i).map((c) => c.width)));
  const rowH = Array.from({ length: rows }, (_, i) => Math.max(0, ...comps.filter((c) => cell(c).row === i).map((c) => c.height)));
  const x0 = (i: number) => origin.x + colW.slice(0, i).reduce((a, b) => a + b + gap, 0);
  const y0 = (i: number) => origin.y + rowH.slice(0, i).reduce((a, b) => a + b + gap, 0);
  const deltas = new Map<string, { dx: number; dy: number }>();
  // sem eixos (nomes livres): fileira única na ordem atual
  const sorted = axes.length ? comps : [...comps].sort((a, b) => a.x - b.x);
  let cursor = origin.x;
  sorted.forEach((c) => {
    if (axes.length) {
      const { col, row } = cell(c);
      deltas.set(c.id, { dx: Math.round(x0(col) - c.x), dy: Math.round(y0(row) - c.y) });
    } else {
      deltas.set(c.id, { dx: Math.round(cursor - c.x), dy: Math.round(origin.y - c.y) });
      cursor += c.width + gap;
    }
  });
  return applyDeltas(all, deltas);
}

/**
 * Cria uma variante para cada combinação dos eixos (produto cartesiano). O componente base vira a primeira
 * combinação; as demais são cópias com os filhos. Retorna os shapes novos já organizados em matriz.
 */
export function createVariantMatrix(all: Shape[], baseId: string, axes: VariantAxis[], idGen: () => string = () => crypto.randomUUID()): { shapes: Shape[]; group: string } | null {
  const base = all.find((s) => s.id === baseId && s.isComponent);
  const clean = axes.map((a) => ({ name: a.name.trim(), values: a.values.map((v) => v.trim()).filter(Boolean) })).filter((a) => a.name && a.values.length);
  if (!base || clean.length === 0) return null;
  const combos = clean.reduce<string[][]>((acc, a) => acc.flatMap((c) => a.values.map((v) => [...c, v])), [[]]);
  const group = base.variantGroup || base.name || 'Componente';
  const baseKids = descendantIds(all, base.id).map((id) => all.find((s) => s.id === id)!).sort((a, b) => a.zIndex - b.zIndex);
  let out = all.map((s) => (s.id === base.id ? { ...s, variantGroup: group, variantName: variantLabel(clean, combos[0]) } : s));
  combos.slice(1).forEach((combo) => {
    const { shapes: copies, newRootIds } = duplicateShapes(all, [base.id], { x: 0, y: 0 }, idGen);
    const root = copies.find((s) => s.id === newRootIds[0])!;
    const copyKids = copies.filter((s) => s.id !== root.id).sort((a, b) => a.zIndex - b.zIndex);
    const idMap = new Map(baseKids.map((k, i) => [k.id, copyKids[i]?.id]));
    const props = base.componentProps?.map((p) => ({ ...p, targetId: idMap.get(p.targetId) || p.targetId }));
    out = [
      ...out,
      ...copies.map((s) =>
        s.id === root.id
          ? { ...s, name: base.name, isComponent: true, variantGroup: group, variantName: variantLabel(clean, combo), ...(props ? { componentProps: props } : {}) }
          : s
      ),
    ];
  });
  return { shapes: arrangeVariants(out, group), group };
}
