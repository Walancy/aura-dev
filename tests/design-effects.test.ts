import { describe, expect, it } from 'bun:test';
import { svgEffectFilter } from '../src/components/design2/effectsFilter';
import type { EffectItem } from '../src/components/design2/types';

const eff = (p: Partial<EffectItem>): EffectItem => ({ id: 'e', type: 'inner-shadow', color: '#000000', opacity: 0.25, x: 0, y: 4, blur: 4, spread: 0, visible: true, ...p });

describe('svgEffectFilter', () => {
  it('ignora efeitos que não são sombra interna/ruído e os invisíveis', () => {
    expect(svgEffectFilter('f', [eff({ type: 'drop-shadow' }), eff({ visible: false })])).toBeNull();
    expect(svgEffectFilter('f', undefined)).toBeNull();
  });

  it('sombra interna inverte o alfa, desfoca, desloca e recorta pelo shape', () => {
    const f = svgEffectFilter('fx', [eff({ blur: 10, x: 2, y: 6, color: '#ff0000' })])!;
    expect(f).toContain('id="fx"');
    expect(f).toContain('tableValues="1 0"');
    expect(f).toContain('stdDeviation="5"');
    expect(f).toContain('dx="2" dy="6"');
    expect(f).toContain('rgb(255,0,0)');
    expect(f).toContain('in2="SourceAlpha" operator="in"');
  });

  it('ruído usa feTurbulence e empilha sobre o resultado anterior', () => {
    const f = svgEffectFilter('fx', [eff({}), eff({ type: 'noise', noiseSizeX: 4 })])!;
    expect(f).toContain('<feTurbulence');
    expect(f).toContain('baseFrequency="0.250"');
    expect(f).toContain('<feMergeNode in="out0"/>');
  });
});
