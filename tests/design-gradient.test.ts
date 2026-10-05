import { describe, expect, it } from 'bun:test';
import { cssGradient, defaultGradientStops, isGradientFill, linearVector, sortStops } from '../src/components/design2/gradient';

describe('gradient', () => {
  it('só considera gradiente com tipo e pelo menos 2 paradas', () => {
    expect(isGradientFill({ type: 'linear', gradientStops: defaultGradientStops('#ff0000') })).toBe(true);
    expect(isGradientFill({ type: 'solid', gradientStops: defaultGradientStops('#ff0000') })).toBe(false);
    expect(isGradientFill({ type: 'radial', gradientStops: [{ position: 0, color: '#000', opacity: 1 }] })).toBe(false);
  });

  it('vetor linear segue a convenção CSS', () => {
    const lr = linearVector(90); // esquerda -> direita
    expect([lr.x1, lr.y1, lr.x2, lr.y2].map((n) => Math.round(n * 100) / 100)).toEqual([0, 0.5, 1, 0.5]);
    const tb = linearVector(180); // cima -> baixo
    expect([tb.x1, tb.y1, tb.x2, tb.y2].map((n) => Math.round(n * 100) / 100)).toEqual([0.5, 0, 0.5, 1]);
  });

  it('gera CSS ordenando as paradas', () => {
    const css = cssGradient({ type: 'linear', gradientAngle: 45, gradientStops: [{ position: 1, color: '#00ff00', opacity: 1 }, { position: 0, color: '#ff0000', opacity: 0.5 }] });
    expect(css).toBe('linear-gradient(45deg, rgba(255, 0, 0, 0.5) 0%, rgba(0, 255, 0, 1) 100%)');
    expect(sortStops([{ position: 1, color: 'a', opacity: 1 }, { position: 0, color: 'b', opacity: 1 }])[0].color).toBe('b');
  });
});

import { isHtmlGradient } from '../src/components/design2/gradient';
describe('gradient angular/diamante', () => {
  it('angular e diamante contam como gradiente e usam CSS', () => {
    const stops = [{ position: 0, color: '#ff0000', opacity: 1 }, { position: 1, color: '#0000ff', opacity: 1 }];
    expect(isGradientFill({ type: 'angular', gradientStops: stops })).toBe(true);
    expect(isGradientFill({ type: 'diamond', gradientStops: stops })).toBe(true);
    expect(isHtmlGradient({ type: 'angular' })).toBe(true);
    expect(isHtmlGradient({ type: 'linear' })).toBe(false);
    expect(cssGradient({ type: 'angular', gradientAngle: 30, gradientStops: stops })).toContain('conic-gradient(from 30deg');
    expect(cssGradient({ type: 'diamond', gradientStops: stops }).split('linear-gradient').length - 1).toBe(4);
  });
});

import { pathFromPoints } from '../src/components/design2/gradient';
describe('pathFromPoints', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 10 }, { x: 20, y: 0 }];
  it('linhas retas por padrão e curvas Bézier quando suavizado', () => {
    expect(pathFromPoints(pts)).toBe('M 0 0 L 10 10 L 20 0');
    const smooth = pathFromPoints(pts, true);
    expect(smooth.startsWith('M 0 0 C')).toBe(true);
    expect(smooth.split('C').length - 1).toBe(2);
    expect(pathFromPoints([], true)).toBe('');
  });
});
