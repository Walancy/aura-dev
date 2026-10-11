import { describe, expect, it } from 'bun:test';
import { computeSnap, roundBoxToPixels, rulerStep, unionBox } from '../src/components/design2/snap';

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

describe('snap por espaçamento igual', () => {
  const row = [
    { x: 0, y: 0, width: 100, height: 50 },
    { x: 120, y: 0, width: 100, height: 50 }, // vão de 20
  ];

  it('encaixa depois do último box com o mesmo vão', () => {
    const r = computeSnap({ x: 243, y: 0, width: 100, height: 50 }, row, 6);
    expect(r.dx).toBe(-3); // 220 + 20 = 240
    expect(r.gaps?.some((g) => g.axis === 'x' && g.value === 20)).toBe(true);
  });

  it('centraliza entre dois boxes com vãos iguais', () => {
    const two = [
      { x: 0, y: 0, width: 100, height: 50 },
      { x: 300, y: 0, width: 100, height: 50 },
    ];
    const r = computeSnap({ x: 153, y: 0, width: 100, height: 50 }, two, 6);
    expect(r.dx).toBe(-3); // (200 - 100) / 2 = 50 de vão -> x = 150
    expect(r.gaps?.map((g) => g.value)).toEqual([50, 50]);
  });

  it('ignora boxes que não se sobrepõem na vertical', () => {
    const r = computeSnap({ x: 243, y: 500, width: 100, height: 50 }, row, 6);
    expect(r.dx).toBe(0);
  });

  it('também encaixa na vertical', () => {
    const col = [
      { x: 0, y: 0, width: 50, height: 100 },
      { x: 0, y: 120, width: 50, height: 100 },
    ];
    const r = computeSnap({ x: 0, y: 243, width: 50, height: 100 }, col, 6);
    expect(r.dy).toBe(-3);
  });
});

describe('encaixe em pixels', () => {
  it('arredonda as bordas e mantém o tamanho mínimo de 1', () => {
    expect(roundBoxToPixels({ x: 10.4, y: 20.6, width: 50.2, height: 30.3 })).toEqual({ x: 10, y: 21, width: 51, height: 30 });
    expect(roundBoxToPixels({ x: 5.2, y: 5.2, width: 0.1, height: 0.1 })).toEqual({ x: 5, y: 5, width: 1, height: 1 });
  });
});
