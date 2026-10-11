import { describe, expect, it } from 'bun:test';
import { capGeometry, capSize, pathEndDirections } from '../src/components/design2/caps';

describe('pontas de linha', () => {
  const right = { x: 1, y: 0 };

  it('triângulo na ponta de uma linha para a direita: vértice no ponto e base atrás', () => {
    const g = capGeometry('triangle', { x: 100, y: 50 }, right, 10)!;
    expect(g.filled).toBe(true);
    expect(g.d).toBe('M 100 50 L 90 55 L 90 45 Z');
  });

  it('seta é aberta (só traço) e barra é perpendicular', () => {
    expect(capGeometry('arrow', { x: 0, y: 0 }, right, 10)!.filled).toBe(false);
    expect(capGeometry('bar', { x: 0, y: 0 }, right, 10)!.d).toBe('M 0 5 L 0 -5');
  });

  it('círculo preenchido centrado atrás da ponta; nenhuma = sem geometria', () => {
    const g = capGeometry('circle', { x: 100, y: 0 }, right, 10)!;
    expect(g.d.startsWith('M 90 0 a 5 5')).toBe(true);
    expect(capGeometry('none', { x: 0, y: 0 }, right, 10)).toBeNull();
  });

  it('a direção vira junto com a linha (para baixo)', () => {
    const g = capGeometry('triangle', { x: 0, y: 100 }, { x: 0, y: 1 }, 10)!;
    expect(g.d).toBe('M 0 100 L -5 90 L 5 90 Z');
  });

  it('tamanho cresce com a espessura, com mínimo de 8', () => {
    expect(capSize(1)).toBe(8);
    expect(capSize(4)).toBe(16);
  });

  it('direções das extremidades: pela tangente da alça quando existe', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    expect(pathEndDirections(pts)).toEqual({ start: { x: -1, y: 0 }, end: { x: 1, y: 0 } });
    const curved = pathEndDirections(pts, [{ out: { x: 0, y: 50 } }, { in: { x: 0, y: -50 } }])!;
    expect(curved.start.y).toBeCloseTo(-1); // sai para baixo, então "para fora" é para cima
    expect(curved.end.y).toBeCloseTo(1);
    expect(pathEndDirections([{ x: 0, y: 0 }])).toBeNull();
  });
});
