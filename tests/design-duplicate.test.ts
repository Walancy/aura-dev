import { describe, expect, it } from 'bun:test';
import { duplicateShapes } from '../src/components/design2/duplicate';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0, fill: '#fff', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, ...p }) as Shape;

describe('duplicateShapes', () => {
  it('copia frame com filhos, desloca e religa a hierarquia', () => {
    let n = 0;
    const all = [mk({ id: 'f', type: 'frame', x: 100, y: 100, zIndex: 1 }), mk({ id: 'a', parentId: 'f', x: 110, y: 110, zIndex: 2 }), mk({ id: 'z', x: 500 })];
    const { shapes, newRootIds } = duplicateShapes(all, ['f'], { x: 20, y: 30 }, () => `n${++n}`);
    expect(shapes).toHaveLength(2);
    expect(newRootIds).toEqual(['n1']);
    expect(shapes[0]).toMatchObject({ id: 'n1', x: 120, y: 130, name: 'undefined (cópia)'.replace('undefined', 'Cópia') });
    expect(shapes[1]).toMatchObject({ id: 'n2', parentId: 'n1', x: 130, y: 140 });
    expect(shapes[0].zIndex).toBeGreaterThan(all[2].zIndex);
  });
});
