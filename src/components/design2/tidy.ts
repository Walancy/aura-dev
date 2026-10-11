import type { Shape } from './types';
import { unionBox, type Box } from './snap';

const median = (v: number[], fallback: number) => {
  const a = v.filter((x) => x > 0).sort((x, y) => x - y);
  return a.length ? a[Math.floor(a.length / 2)] : fallback;
};

/**
 * Organizar (Tidy up): arruma os elementos em linhas/colunas com espaçamento igual.
 * Agrupa em linhas pela posição vertical, usa o vão mais comum entre vizinhos (ou 20) e mantém o canto superior esquerdo do conjunto.
 * Retorna os deslocamentos por id.
 */
export function tidyDeltas(items: Array<{ id: string; box: Box }>): Map<string, { dx: number; dy: number }> {
  const out = new Map<string, { dx: number; dy: number }>();
  if (items.length < 2) return out;
  const origin = unionBox(items.map((i) => i.box));
  const sorted = [...items].sort((a, b) => a.box.y + a.box.height / 2 - (b.box.y + b.box.height / 2));
  const rows: Array<{ items: typeof items; cy: number; h: number }> = [];
  for (const it of sorted) {
    const cy = it.box.y + it.box.height / 2;
    const row = rows.find((r) => Math.abs(cy - r.cy) <= Math.max(it.box.height, r.h) / 2);
    if (row) {
      row.items.push(it);
      row.cy = row.items.reduce((s, x) => s + x.box.y + x.box.height / 2, 0) / row.items.length;
      row.h = Math.max(row.h, it.box.height);
    } else rows.push({ items: [it], cy, h: it.box.height });
  }
  rows.sort((a, b) => a.cy - b.cy);
  rows.forEach((r) => r.items.sort((a, b) => a.box.x - b.box.x));
  const gapsX: number[] = [];
  rows.forEach((r) => r.items.slice(1).forEach((it, i) => gapsX.push(it.box.x - (r.items[i].box.x + r.items[i].box.width))));
  const gapX = Math.round(median(gapsX, 20));
  const rowTop = (r: (typeof rows)[number]) => Math.min(...r.items.map((i) => i.box.y));
  const rowBottom = (r: (typeof rows)[number]) => Math.max(...r.items.map((i) => i.box.y + i.box.height));
  const gapsY = rows.slice(1).map((r, i) => rowTop(r) - rowBottom(rows[i]));
  const gapY = Math.round(median(gapsY, gapX));
  let y = origin.y;
  for (const r of rows) {
    let x = origin.x;
    let rowH = 0;
    for (const it of r.items) {
      out.set(it.id, { dx: Math.round(x - it.box.x), dy: Math.round(y - it.box.y) });
      x += it.box.width + gapX;
      rowH = Math.max(rowH, it.box.height);
    }
    y += rowH + gapY;
  }
  return out;
}

/** Atalho: arruma os shapes escolhidos (precisa de 2 ou mais). */
export function tidyShapes(all: Shape[], ids: string[]): Map<string, { dx: number; dy: number }> {
  const items = ids
    .map((id) => all.find((s) => s.id === id))
    .filter((s): s is Shape => Boolean(s))
    .map((s) => ({ id: s.id, box: { x: s.x, y: s.y, width: s.width, height: s.height } }));
  return tidyDeltas(items);
}
