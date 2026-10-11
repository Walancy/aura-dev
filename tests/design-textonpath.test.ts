import { describe, expect, it } from 'bun:test';
import { pathDOf } from '../src/components/design2/textOnPath';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape => ({ type: 'rect', x: 0, y: 0, width: 100, height: 50, rotation: 0, opacity: 1, visible: true, zIndex: 1, ...p } as Shape);

describe('texto sobre caminho arbitrário', () => {
  it('linha vira segmento; retângulo vira caminho fechado', () => {
    expect(pathDOf(mk({ id: 'l', type: 'line' as any, x: 10, y: 20, width: 100, height: 0 }))).toBe('M 10 20 L 110 20');
    expect(pathDOf(mk({ id: 'r' }))).toBe('M 0 0 L 100 0 L 100 50 L 0 50 Z');
  });

  it('elipse vira duas meias-voltas começando na esquerda', () => {
    expect(pathDOf(mk({ id: 'e', type: 'ellipse' as any, width: 100, height: 100 }))).toBe('M 0 50 A 50 50 0 1 1 100 50 A 50 50 0 1 1 0 50');
  });

  it('caneta usa os nós e as alças', () => {
    const d = pathDOf(mk({ id: 'p', type: 'pen' as any, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], pathHandles: [{ out: { x: 0, y: 40 } }, { in: { x: 0, y: 40 } }] } as any));
    expect(d).toBe('M 0 0 C 0 40 100 40 100 0');
  });

  it('tipos sem contorno de caminho devolvem null', () => {
    expect(pathDOf(mk({ id: 't', type: 'text' as any }))).toBeNull();
    expect(pathDOf(mk({ id: 'p', type: 'pen' as any, points: [{ x: 0, y: 0 }] } as any))).toBeNull();
  });
});
