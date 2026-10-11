import { describe, expect, it } from 'bun:test';
import { profileAt, variableWidthPath } from '../src/components/design2/widthProfile';

describe('traço de largura variável', () => {
  it('perfis ao longo do caminho', () => {
    expect(profileAt('uniform', 0.5)).toBe(1);
    expect(profileAt('taper-end', 0)).toBe(1);
    expect(profileAt('taper-end', 1)).toBeCloseTo(0.04);
    expect(profileAt('taper-start', 0)).toBeCloseTo(0.04);
    expect(profileAt('lens', 0.5)).toBeCloseTo(1);
    expect(profileAt('lens', 0)).toBeCloseTo(0.04);
    expect(profileAt('dumbbell', 0.5)).toBeCloseTo(0.25);
    expect(profileAt('dumbbell', 0)).toBeCloseTo(1);
  });

  it('linha reta horizontal com afinar no fim: lados abrem 5 no início e fecham na ponta', () => {
    const pts = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 100, y: 0 }];
    const d = variableWidthPath(pts, 10, 'taper-end')!;
    // esquerda: (0,5) … ; direita volta: …(0,-5)
    expect(d.startsWith('M 0 5')).toBe(true);
    expect(d).toContain('L 0 -5');
    // ponto do meio com metade da largura (±2.5)
    expect(d).toContain('50 2.5');
    expect(d.endsWith('Z')).toBe(true);
  });

  it('menos de 2 pontos ou largura 0 não gera caminho', () => {
    expect(variableWidthPath([{ x: 0, y: 0 }], 10, 'lens')).toBeUndefined();
    expect(variableWidthPath([{ x: 0, y: 0 }, { x: 1, y: 0 }], 0, 'lens')).toBeUndefined();
  });
});
