import { describe, expect, it } from 'bun:test';
import { tidyDeltas } from '../src/components/design2/tidy';

const item = (id: string, x: number, y: number, w = 100, h = 60) => ({ id, box: { x, y, width: w, height: h } });
const apply = (items: ReturnType<typeof item>[]) => {
  const d = tidyDeltas(items);
  return items.map((i) => ({ id: i.id, x: i.box.x + (d.get(i.id)?.dx || 0), y: i.box.y + (d.get(i.id)?.dy || 0), w: i.box.width, h: i.box.height }));
};
const overlap = (a: any, b: any) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('tidy up', () => {
  it('seis cartões soltos viram uma grade 3×2 sem sobreposição', () => {
    const out = apply([
      item('a', 0, 3), item('b', 130, 0), item('c', 255, 8),
      item('d', 4, 100), item('e', 128, 96), item('f', 260, 104),
    ]);
    const rows = new Set(out.map((o) => o.y));
    expect(rows.size).toBe(2);
    for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) expect(overlap(out[i], out[j])).toBe(false);
    const row1 = out.filter((o) => o.y === Math.min(...out.map((p) => p.y))).sort((a, b) => a.x - b.x);
    expect(row1.map((o) => o.id)).toEqual(['a', 'b', 'c']);
  });

  it('usa o vão mais comum entre vizinhos e mantém o canto do conjunto', () => {
    const out = apply([item('a', 50, 50), item('b', 170, 50), item('c', 410, 50)]); // vãos 20 e 140 → mediana 140? (par) usa o do meio
    const xs = out.map((o) => o.x).sort((a, b) => a - b);
    expect(xs[0]).toBe(50);
    const g1 = xs[1] - (xs[0] + 100);
    const g2 = xs[2] - (xs[1] + 100);
    expect(g1).toBe(g2);
  });

  it('uma coluna fica numa coluna com vão igual', () => {
    const out = apply([item('a', 0, 0), item('b', 5, 90), item('c', -3, 200)]);
    expect(new Set(out.map((o) => o.x)).size).toBe(1);
    const ys = out.map((o) => o.y).sort((a, b) => a - b);
    expect(ys[1] - (ys[0] + 60)).toBe(ys[2] - (ys[1] + 60));
  });

  it('menos de 2 elementos não faz nada', () => {
    expect(tidyDeltas([item('a', 0, 0)]).size).toBe(0);
  });
});
