import { describe, expect, it } from 'bun:test';
import { ellipseArcPath, hasArc } from '../src/components/design2/arc';

describe('elipse como arco/anel', () => {
  it('hasArc só liga fora do padrão', () => {
    expect(hasArc({})).toBe(false);
    expect(hasArc({ start: 0, end: 360, inner: 0 })).toBe(false);
    expect(hasArc({ end: 270 })).toBe(true);
    expect(hasArc({ inner: 0.5 })).toBe(true);
  });

  it('fatia de 90° (pizza): arco do ponto à direita até o de baixo e volta pelo centro', () => {
    expect(ellipseArcPath(100, 100, 50, 50, { start: 0, end: 90 })).toBe('M 150 100 A 50 50 0 0 1 100 150 L 100 100 Z');
  });

  it('arco maior que 180° usa o flag large', () => {
    expect(ellipseArcPath(0, 0, 10, 10, { start: 0, end: 270 })).toContain(' 0 1 1 ');
  });

  it('anel de arco: tem o raio interno e fecha', () => {
    const d = ellipseArcPath(100, 100, 50, 50, { start: 0, end: 90, inner: 0.5 });
    expect(d).toBe('M 150 100 A 50 50 0 0 1 100 150 L 100 125 A 25 25 0 0 0 125 100 Z');
  });

  it('círculo completo com raio interno vira dois círculos (donut)', () => {
    const d = ellipseArcPath(0, 0, 10, 10, { inner: 0.5 });
    expect(d.match(/M /g)).toHaveLength(2);
    expect(d).toContain('A 5 5');
  });

  it('ângulos negativos e fim menor que o início giram corretamente', () => {
    // de 270 até 360(0): quarto superior direito
    expect(ellipseArcPath(0, 0, 10, 10, { start: 270, end: 360 })).toBe('M 0 -10 A 10 10 0 0 1 10 0 L 0 0 Z');
    expect(ellipseArcPath(0, 0, 10, 10, { start: -90, end: 0 })).toBe('M 0 -10 A 10 10 0 0 1 10 0 L 0 0 Z');
  });
});
