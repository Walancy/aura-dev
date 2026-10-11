import { describe, expect, it } from 'bun:test';
import { hasAdjust, imageFilterMarkup } from '../src/components/design2/imageFilter';

describe('ajustes de imagem', () => {
  it('sem ajuste não gera filtro', () => {
    expect(hasAdjust(undefined)).toBe(false);
    expect(hasAdjust({ exposure: 0, hue: 0 })).toBe(false);
    expect(imageFilterMarkup('f', {})).toBe('');
  });

  it('exposição e contraste viram uma transferência linear', () => {
    const m = imageFilterMarkup('f1', { exposure: 0.2, contrast: 0.5 });
    expect(m).toContain('<filter id="f1"');
    expect(m).toContain('feComponentTransfer');
    // inclinação = (1 + 0.5) × (1 + 0.2) = 1.8
    expect(m).toContain('slope="1.8"');
  });

  it('saturação −1 vira preto e branco; matiz gira', () => {
    expect(imageFilterMarkup('f', { saturation: -1 })).toContain('type="saturate" values="0"');
    expect(imageFilterMarkup('f', { hue: 90 })).toContain('type="hueRotate" values="90"');
  });

  it('temperatura quente aumenta o vermelho e reduz o azul', () => {
    const m = imageFilterMarkup('f', { temperature: 0.5 });
    expect(m).toContain('1.1 0 0 0 0');
    expect(m).toContain('0 0 0.9 0 0');
  });

  it('a ordem dos passos é a documentada', () => {
    const m = imageFilterMarkup('f', { exposure: 0.1, temperature: 0.2, saturation: 0.3, hue: 10 });
    expect(m.indexOf('feComponentTransfer')).toBeLessThan(m.indexOf('type="matrix"'));
    expect(m.indexOf('type="matrix"')).toBeLessThan(m.indexOf('saturate'));
    expect(m.indexOf('saturate')).toBeLessThan(m.indexOf('hueRotate'));
  });
});
