import { describe, expect, it } from 'bun:test';
import { alignDeltas, applyDeltas, distributeDeltas } from '../src/components/design2/align';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0, fill: '#fff', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, ...p }) as Shape;

describe('align', () => {
  const all = [mk({ id: 'a', x: 0, y: 0, width: 100, height: 50 }), mk({ id: 'b', x: 50, y: 80, width: 40, height: 20 }), mk({ id: 'c', x: 300, y: 10, width: 60, height: 60 })];

  it('alinha à esquerda e ao centro da seleção', () => {
    const ref = { x: 0, y: 0, width: 360, height: 100 };
    const left = alignDeltas(all, ['a', 'b', 'c'], 'left', ref);
    expect(left.get('c')).toEqual({ dx: -300, dy: 0 });
    const cx = alignDeltas(all, ['a', 'b'], 'center-x', ref);
    expect(cx.get('a')).toEqual({ dx: 130, dy: 0 }); // centro 50 -> 180
  });

  it('alinha à base com margem', () => {
    const d = alignDeltas(all, ['a'], 'bottom', { x: 0, y: 0, width: 360, height: 200 }, 20);
    expect(d.get('a')).toEqual({ dx: 0, dy: 130 }); // base 50 -> 180
  });

  it('distribui com espaços iguais e mantém as pontas', () => {
    const d = distributeDeltas(all, ['a', 'b', 'c'], 'x');
    // span 0..360, larguras 100+40+60=200, gap 80 -> b em 180
    expect(d.get('a')).toEqual({ dx: 0, dy: 0 });
    expect(d.get('b')).toEqual({ dx: 130, dy: 0 });
    expect(d.get('c')).toEqual({ dx: 0, dy: 0 });
    expect(distributeDeltas(all, ['a', 'b'], 'x').size).toBe(0);
  });

  it('mover um frame move os filhos e os pontos de desenho', () => {
    const shapes = [mk({ id: 'f', type: 'frame', x: 0, y: 0 }), mk({ id: 'k', parentId: 'f', x: 5, y: 5, points: [{ x: 5, y: 5 }] })];
    const out = applyDeltas(shapes, new Map([['f', { dx: 10, dy: 20 }]]));
    expect(out[1]).toMatchObject({ x: 15, y: 25, points: [{ x: 15, y: 25 }] });
  });
});
