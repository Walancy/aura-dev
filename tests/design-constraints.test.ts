import { describe, expect, it } from 'bun:test';
import { descendantIds, resizeDescendants } from '../src/components/design2/constraints';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0, fill: '#fff', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, ...p }) as Shape;

const parentOld = { x: 0, y: 0, width: 200, height: 100 };
const parentNew = { x: 0, y: 0, width: 400, height: 150 };

describe('constraints', () => {
  it('padrão: filho mantém a distância da esquerda/topo', () => {
    const all = [mk({ id: 'p', type: 'frame', width: 200, height: 100 }), mk({ id: 'c', parentId: 'p', x: 20, y: 10, width: 50, height: 30 })];
    expect(resizeDescendants(all, 'p', parentOld, parentNew, 'constraints').get('c')).toMatchObject({ x: 20, y: 10, width: 50, height: 30 });
  });

  it('end/center/stretch/scale', () => {
    const all = [
      mk({ id: 'p', type: 'frame' }),
      mk({ id: 'end', parentId: 'p', x: 140, y: 0, width: 50, height: 20, constraintH: 'end' }), // gap direita 10
      mk({ id: 'ctr', parentId: 'p', x: 75, y: 0, width: 50, height: 20, constraintH: 'center' }),
      mk({ id: 'str', parentId: 'p', x: 10, y: 0, width: 180, height: 20, constraintH: 'stretch', constraintV: 'end' }),
      mk({ id: 'scl', parentId: 'p', x: 50, y: 25, width: 100, height: 50, constraintH: 'scale', constraintV: 'scale' }),
    ];
    const r = resizeDescendants(all, 'p', parentOld, parentNew, 'constraints');
    expect(r.get('end')).toMatchObject({ x: 340, width: 50 });
    expect(r.get('ctr')).toMatchObject({ x: 175, width: 50 });
    expect(r.get('str')).toMatchObject({ x: 10, width: 380, y: 50 }); // gap inferior 80 -> y = 150-80-20
    expect(r.get('scl')).toMatchObject({ x: 100, width: 200, y: 37.5, height: 75 });
  });

  it('escala proporcional leva fonte, traço e raio e desce na hierarquia', () => {
    const all = [
      mk({ id: 'p', type: 'frame' }),
      mk({ id: 't', parentId: 'p', type: 'text', x: 20, y: 10, width: 100, height: 20, fontSize: 16, strokeWidth: 2, cornerRadius: 8 }),
      mk({ id: 'g', parentId: 't', x: 30, y: 12, width: 10, height: 10 }),
    ];
    const r = resizeDescendants(all, 'p', parentOld, { x: 0, y: 0, width: 400, height: 200 }, 'scale');
    expect(r.get('t')).toMatchObject({ x: 40, y: 20, width: 200, height: 40, fontSize: 32, strokeWidth: 4, cornerRadius: 16 });
    expect(r.has('g')).toBe(true);
    expect(descendantIds(all, 'p')).toEqual(['t', 'g']);
  });
});
