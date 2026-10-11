import { describe, expect, it } from 'bun:test';
import { opacityFromKey } from '../src/components/design2/opacityKeys';

describe('opacityFromKey', () => {
  it('um dígito: 1..9 = 10..90%, 0 = 100%', () => {
    expect(opacityFromKey(null, '5', 0)!.opacity).toBe(0.5);
    expect(opacityFromKey(null, '1', 0)!.opacity).toBe(0.1);
    expect(opacityFromKey(null, '0', 0)!.opacity).toBe(1);
  });

  it('dois dígitos rápidos dão o valor exato', () => {
    const a = opacityFromKey(null, '5', 1000)!;
    expect(opacityFromKey(a.state, '5', 1300)!.opacity).toBe(0.55);
    const z = opacityFromKey(null, '0', 1000)!;
    expect(opacityFromKey(z.state, '0', 1200)!.opacity).toBe(0);
  });

  it('o segundo dígito fora do prazo recomeça', () => {
    const a = opacityFromKey(null, '5', 1000)!;
    expect(opacityFromKey(a.state, '3', 1600)!.opacity).toBe(0.3);
  });

  it('terceiro dígito não acumula', () => {
    const a = opacityFromKey(null, '5', 0)!;
    const b = opacityFromKey(a.state, '5', 100)!;
    expect(opacityFromKey(b.state, '7', 200)!.opacity).toBe(0.7);
  });

  it('ignora teclas que não são dígito', () => {
    expect(opacityFromKey(null, 'a', 0)).toBeNull();
  });
});
