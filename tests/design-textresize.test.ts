import { describe, expect, it } from 'bun:test';
import { applyTextResize, fitTextBox } from '../src/components/design2/textResize';
import type { Shape } from '../src/components/design2/types';

// medida previsível: 10px por caractere
const measure = (text: string) => text.length * 10;

const txt = (p: Partial<Shape> = {}): Shape =>
  ({ id: 't', type: 'text', x: 0, y: 0, width: 200, height: 20, rotation: 0, opacity: 1, visible: true, zIndex: 1, fontSize: 16, text: 'Olá mundo', textResize: 'auto-width', ...p } as Shape);

describe('redimensionamento automático do texto', () => {
  it('largura automática: caixa do tamanho da maior linha e altura pelas linhas', () => {
    const p = fitTextBox(txt({ text: 'abc\nabcdef' }), measure)!;
    expect(p.width).toBe(62); // 6 * 10 + 2
    expect(p.height).toBe(40); // 2 linhas × 16 × 1.25
  });

  it('altura automática: quebra pela largura e guarda o original em wrapSource', () => {
    const p = fitTextBox(txt({ textResize: 'auto-height', width: 100, text: 'um dois tres quatro' }), measure)!;
    expect(p.text).toBe('um dois\ntres\nquatro');
    expect(p.height).toBe(60); // 3 linhas
    expect(p.wrapSource).toBe('um dois tres quatro');
  });

  it('largura maior reflui o texto já quebrado a partir do original', () => {
    const wrapped = txt({ textResize: 'auto-height', width: 100, text: 'um dois\ntres\nquatro', wrapSource: 'um dois tres quatro' });
    const p = fitTextBox({ ...wrapped, width: 400 }, measure)!;
    expect(p.text).toBe('um dois tres quatro');
    expect(p.height).toBe(20);
  });

  it('fixo e shapes que não são texto são ignorados; sem mudança devolve a mesma lista', () => {
    expect(fitTextBox(txt({ textResize: 'fixed' }), measure)).toBeNull();
    expect(fitTextBox({ ...txt(), type: 'rect' } as Shape, measure)).toBeNull();
    const ok = txt({ text: 'ab', width: 22, height: 20 });
    const list = [ok];
    expect(applyTextResize(list, measure)).toBe(list);
  });

  it('applyTextResize atualiza só os textos automáticos', () => {
    const a = txt({ id: 'a', text: 'abcd' });
    const b = txt({ id: 'b', textResize: undefined, width: 999 });
    const out = applyTextResize([a, b], measure);
    expect(out[0].width).toBe(42);
    expect(out[1].width).toBe(999);
  });
});

describe('corte vertical', () => {
  it('altura vai do topo das maiúsculas à linha de base da última linha', () => {
    const one = fitTextBox(txt({ text: 'abc', textVerticalTrim: 'cap-height' }), measure)!;
    expect(one.height).toBe(12); // 0.72 × 16 = 11.52 → 12
    const two = fitTextBox(txt({ text: 'abc\nabc', textVerticalTrim: 'cap-height' }), measure)!;
    expect(two.height).toBe(32); // 1 × 20 + 11.52 → 32
  });
});
