import { describe, expect, it } from 'bun:test';
import { ease } from '../src/components/design2/easing';

describe('curvas de animação', () => {
  it('todas começam em 0 e terminam em 1', () => {
    for (const k of ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'spring'] as const) {
      expect(ease(0, k)).toBeCloseTo(0, 5);
      expect(ease(1, k)).toBeCloseTo(1, 5);
    }
  });
  it('linear é a identidade; entrada começa devagar e saída termina devagar', () => {
    expect(ease(0.3, 'linear')).toBeCloseTo(0.3);
    expect(ease(0.5, 'ease-in')).toBeLessThan(0.5);
    expect(ease(0.5, 'ease-out')).toBeGreaterThan(0.5);
    expect(ease(0.5, 'ease-in-out')).toBeCloseTo(0.5);
  });
  it('a mola ultrapassa 1 em algum ponto e t fora do intervalo é limitado', () => {
    const peak = Math.max(...Array.from({ length: 100 }, (_, i) => ease(i / 100, 'spring')));
    expect(peak).toBeGreaterThan(1);
    expect(ease(-1, 'linear')).toBe(0);
    expect(ease(2, 'linear')).toBe(1);
  });
});
