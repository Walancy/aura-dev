import { describe, expect, it } from 'bun:test';
import { parsePoints, roundedPolygonPath } from '../src/components/design2/roundPoly';

const square = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }];

describe('polígono com cantos arredondados', () => {
  it('raio 0 ou sem vértices suficientes devolve undefined (usa <polygon>)', () => {
    expect(roundedPolygonPath(square, 0)).toBeUndefined();
    expect(roundedPolygonPath([{ x: 0, y: 0 }, { x: 1, y: 1 }], 5)).toBeUndefined();
  });

  it('quadrado com raio 10: arcos de raio 10 começando 10px depois de cada vértice', () => {
    const d = roundedPolygonPath(square, 10)!;
    expect(d.startsWith('M 0 10 A 10 10 0 0 1 10 0')).toBe(true);
    expect(d.endsWith('Z')).toBe(true);
    expect((d.match(/A /g) || []).length).toBe(4);
  });

  it('raio grande é limitado à metade da aresta (vira uma pílula/círculo)', () => {
    const d = roundedPolygonPath(square, 999)!;
    expect(d).toContain('A 50 50');
  });

  it('aceita a string "x,y x,y" do canvas', () => {
    expect(parsePoints('0,0 10,0 10,10')).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }]);
    expect(roundedPolygonPath('0,0 100,0 100,100 0,100', 10)).toBe(roundedPolygonPath(square, 10));
  });

  it('triângulo: arco menor que num quadrado para o mesmo raio de tangência', () => {
    const d = roundedPolygonPath([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 50, y: 86.6 }], 8)!;
    expect(d.split(' ').filter((t) => t === 'A')).toHaveLength(3);
  });
});
