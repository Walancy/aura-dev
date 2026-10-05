import { describe, expect, it } from 'bun:test';
import { computeSnap, rulerStep, unionBox } from '../src/components/design2/snap';

describe('snap', () => {
  const other = { x: 100, y: 100, width: 200, height: 100 };

  it('encaixa a borda esquerda na borda direita de outro shape dentro do limite', () => {
    const r = computeSnap({ x: 304, y: 400, width: 50, height: 50 }, [other], 6);
    expect(r.dx).toBe(-4);
    expect(r.dy).toBe(0);
    expect(r.guides[0]).toMatchObject({ axis: 'x', pos: 300 });
  });

  it('encaixa centro com centro nos dois eixos e gera duas guias', () => {
    const r = computeSnap({ x: 177, y: 123, width: 50, height: 50 }, [other], 6);
    expect(r.dx).toBe(-2); // centro x 202 -> 200
    expect(r.dy).toBe(2); // centro y 148 -> 150
    expect(r.guides.map((g) => g.axis).sort()).toEqual(['x', 'y']);
  });

  it('não encaixa fora do limite e usa a grade como alternativa', () => {
    expect(computeSnap({ x: 500, y: 500, width: 10, height: 10 }, [other], 6)).toEqual({ dx: 0, dy: 0, guides: [] });
    const g = computeSnap({ x: 503, y: 509, width: 10, height: 10 }, [], 6, 10);
    expect(g.dx).toBe(-3);
    expect(g.dy).toBe(1);
  });

  it('união de boxes e passo da régua', () => {
    expect(unionBox([{ x: 0, y: 0, width: 10, height: 10 }, { x: 20, y: 30, width: 10, height: 10 }])).toEqual({ x: 0, y: 0, width: 30, height: 40 });
    expect(rulerStep(1)).toBe(100);
    expect(rulerStep(0.1)).toBe(1000);
    expect(rulerStep(4)).toBe(20);
  });
});
