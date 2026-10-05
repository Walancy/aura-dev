import { describe, expect, it } from 'bun:test';
import { booleanShapes, flattenShape, shapeToRing } from '../src/components/design2/booleanOps';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 100, height: 100, rotation: 0, fill: '#f00', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, ...p }) as Shape;

const area = (s: Shape) => s.width * s.height;

describe('booleanOps', () => {
  const a = mk({ id: 'a', x: 0, y: 0 });
  const b = mk({ id: 'b', x: 50, y: 50, zIndex: 2 });

  it('união cobre as duas formas', () => {
    const r = booleanShapes([a, b], 'union', 'n')!;
    expect(r.type).toBe('path');
    expect(r).toMatchObject({ x: 0, y: 0, width: 150, height: 150 });
  });

  it('interseção fica só com a área comum', () => {
    const r = booleanShapes([a, b], 'intersect', 'n')!;
    expect(r).toMatchObject({ x: 50, y: 50, width: 50, height: 50 });
  });

  it('subtração remove o segundo do primeiro e exclusão deixa os dois cantos', () => {
    const sub = booleanShapes([a, b], 'subtract', 'n')!;
    expect(sub).toMatchObject({ x: 0, y: 0, width: 100, height: 100 });
    expect(sub.pathD!.includes('M')).toBe(true);
    const ex = booleanShapes([a, b], 'exclude', 'n')!;
    expect(ex.pathD!.split('M').length - 1).toBeGreaterThanOrEqual(2);
  });

  it('subtrair uma forma de dentro faz um buraco (2 anéis)', () => {
    const hole = mk({ id: 'h', x: 25, y: 25, width: 50, height: 50, zIndex: 2 });
    const r = booleanShapes([a, hole], 'subtract', 'n')!;
    expect(r.pathD!.split('M').length - 1).toBe(2);
  });

  it('retorna null para formas abertas ou sem sobreposição vazia', () => {
    expect(booleanShapes([a, mk({ id: 'p', type: 'pen' })], 'union', 'n')).toBeNull();
    expect(booleanShapes([a, mk({ id: 'far', x: 500, y: 500 })], 'intersect', 'n')).toBeNull();
  });

  it('flatten converte círculo em caminho e rotação é aplicada', () => {
    const e = mk({ id: 'e', type: 'ellipse' });
    const flat = flattenShape(e, 'f')!;
    expect(flat.type).toBe('path');
    expect(Math.round(area(flat))).toBe(10000);
    const ring = shapeToRing(mk({ id: 'r', width: 100, height: 20, rotation: 90 }))!;
    const xs = ring.map((p) => p[0]);
    expect(Math.round(Math.max(...xs) - Math.min(...xs))).toBe(20);
  });
});
