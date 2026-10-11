import { describe, expect, it } from 'bun:test';
import { gridBands, gridSnapBoxes, gridSnapLines, newLayoutGrid } from '../src/components/design2/layoutGrid';
import { computeSnap } from '../src/components/design2/snap';

const frame = { x: 100, y: 50, width: 400, height: 300 };

describe('layout grid', () => {
  it('colunas stretch: divide a largura útil igualmente, com gutter e margem', () => {
    const g = { ...newLayoutGrid('columns'), count: 4, gutter: 20, margin: 10 };
    const bands = gridBands(g, frame.x, frame.width); // útil = 400 - 20 - 60 = 320 -> 80 cada
    expect(bands.map((b) => b.size)).toEqual([80, 80, 80, 80]);
    expect(bands[0].start).toBe(110);
    expect(bands[3].start + bands[3].size).toBe(490);
  });

  it('colunas com largura fixa e alinhamento ao centro', () => {
    const g = { ...newLayoutGrid('columns'), count: 2, gutter: 20, size: 100, alignment: 'center' as const };
    const bands = gridBands(g, 0, 400); // total 220, começa em 90
    expect(bands.map((b) => b.start)).toEqual([90, 210]);
  });

  it('descarta faixas quando a margem e o gutter não cabem', () => {
    const g = { ...newLayoutGrid('columns'), count: 12, gutter: 50, margin: 0 };
    expect(gridBands(g, 0, 300)).toEqual([]);
  });

  it('grade quadrada gera linhas a cada tamanho a partir do canto do frame', () => {
    const g = { ...newLayoutGrid('grid'), size: 100 };
    const { xs, ys } = gridSnapLines(frame, [g]);
    expect(xs).toEqual([100, 200, 300, 400, 500]);
    expect(ys).toEqual([50, 150, 250, 350]);
  });

  it('grades ocultas não geram linhas de encaixe', () => {
    expect(gridSnapLines(frame, [{ ...newLayoutGrid('columns'), visible: false }])).toEqual({ xs: [], ys: [] });
  });

  it('o shape encaixa na borda de uma coluna', () => {
    const g = { ...newLayoutGrid('columns'), count: 4, gutter: 0, margin: 0 }; // colunas de 100 em 100
    const boxes = gridSnapBoxes(frame, [g]);
    const r = computeSnap({ x: 203, y: 100, width: 40, height: 40 }, boxes, 6);
    expect(r.dx).toBe(-3);
  });
});
