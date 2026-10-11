import { describe, expect, it } from 'bun:test';
import { bboxOfVector, nearestSegment, pathFromVector, removeNode, setHandle, splitSegment } from '../src/components/design2/vector';

const A = { x: 0, y: 0 };
const B = { x: 100, y: 0 };
const C = { x: 100, y: 100 };

describe('vetor com alças', () => {
  it('sem alças vira polilinha; fechado termina com Z', () => {
    expect(pathFromVector([A, B, C])).toBe('M 0 0 L 100 0 L 100 100');
    expect(pathFromVector([A, B, C], undefined, true)).toBe('M 0 0 L 100 0 L 100 100 Z');
  });

  it('alça de saída/entrada vira curva cúbica relativa ao nó', () => {
    const d = pathFromVector([A, B], [{ out: { x: 30, y: 50 } }, { in: { x: -30, y: 50 } }]);
    expect(d).toBe('M 0 0 C 30 50 70 50 100 0');
  });

  it('fechado: o último segmento volta ao primeiro nó usando as alças deles', () => {
    const d = pathFromVector([A, B, C], [{ in: { x: 0, y: -20 } }, undefined, { out: { x: -50, y: 0 } }], true);
    expect(d.endsWith('C 50 100 0 -20 0 0 Z')).toBe(true);
  });

  it('a caixa inclui o bojo da curva, não só os nós', () => {
    const box = bboxOfVector([A, B], [{ out: { x: 0, y: 80 } }, { in: { x: 0, y: 80 } }]);
    expect(box.x).toBe(0);
    expect(box.width).toBe(100);
    expect(box.y).toBe(0);
    expect(box.height).toBeGreaterThan(55); // a curva sobe ~60 mesmo com os nós em y=0
  });

  it('setHandle espelha a oposta, a menos que independente', () => {
    const m = setHandle(undefined, 3, 1, 'out', { x: 10, y: 20 });
    expect(m[1]).toEqual({ out: { x: 10, y: 20 }, in: { x: -10, y: -20 } });
    const i = setHandle(m, 3, 1, 'out', { x: 5, y: 5 }, true);
    expect(i[1]).toEqual({ out: { x: 5, y: 5 }, in: { x: -10, y: -20 } });
  });

  it('dividir um segmento reto cria o nó no ponto e não muda a forma', () => {
    const r = splitSegment([A, B], undefined, false, 0, 0.25);
    expect(r.points).toEqual([A, { x: 25, y: 0 }, B]);
    expect(pathFromVector(r.points, r.handles)).toBe('M 0 0 L 25 0 L 100 0');
  });

  it('dividir uma curva preserva a curva (o ponto médio sai igual)', () => {
    const handles = [{ out: { x: 0, y: 60 } }, { in: { x: 0, y: 60 } }];
    const before = bboxOfVector([A, B], handles);
    const r = splitSegment([A, B], handles, false, 0, 0.5);
    expect(r.points).toHaveLength(3);
    // cúbica em t=.5: y = 3/4 * 60 = 45
    expect(r.points[1].x).toBeCloseTo(50);
    expect(r.points[1].y).toBeCloseTo(45);
    const after = bboxOfVector(r.points, r.handles);
    expect(after.height).toBeCloseTo(before.height, 0);
  });

  it('segmento mais próximo e remover nó', () => {
    const n = nearestSegment([A, B, C], undefined, false, { x: 102, y: 60 });
    expect(n!.index).toBe(1);
    expect(n!.t).toBeCloseTo(0.6, 1);
    const r = removeNode([A, B, C], [undefined, { out: { x: 1, y: 1 } }, undefined], 1);
    expect(r.points).toEqual([A, C]);
    expect(r.handles).toHaveLength(2);
  });
});
