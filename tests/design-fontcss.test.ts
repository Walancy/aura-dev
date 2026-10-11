import { describe, expect, it } from 'bun:test';
import { featureSettings, setAxis, toggleFeature, variationSettings } from '../src/components/design2/fontCss';

describe('CSS de fontes variáveis e OpenType', () => {
  it('variações viram font-variation-settings; vazio ou tag inválida somem', () => {
    expect(variationSettings({ wght: 650, wdth: 90 })).toBe('"wght" 650, "wdth" 90');
    expect(variationSettings({})).toBeUndefined();
    expect(variationSettings({ errado: 1, wght: NaN })).toBeUndefined();
  });

  it('recursos viram font-feature-settings', () => {
    expect(featureSettings(['liga', 'tnum'])).toBe('"liga" 1, "tnum" 1');
    expect(featureSettings([])).toBeUndefined();
    expect(featureSettings(['x'])).toBeUndefined();
  });

  it('toggleFeature liga, desliga e limpa a lista vazia', () => {
    const on = toggleFeature(undefined, 'liga');
    expect(on).toEqual(['liga']);
    expect(toggleFeature(on, 'tnum')).toEqual(['liga', 'tnum']);
    expect(toggleFeature(on, 'liga')).toBeUndefined();
  });

  it('setAxis define e remove eixos', () => {
    const v = setAxis(undefined, 'wght', 700);
    expect(v).toEqual({ wght: 700 });
    expect(setAxis(v, 'wdth', 80)).toEqual({ wght: 700, wdth: 80 });
    expect(setAxis(v, 'wght', undefined)).toBeUndefined();
  });
});
