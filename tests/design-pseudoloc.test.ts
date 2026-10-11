import { describe, expect, it } from 'bun:test';
import { pseudoLocalize, pseudoLocalizeShapes, restoreLocalized } from '../src/components/design2/pseudoLoc';
import type { Shape } from '../src/components/design2/types';

const t = (p: Partial<Shape> & { id: string }): Shape => ({ type: 'text', x: 0, y: 0, width: 100, height: 20, rotation: 0, opacity: 1, visible: true, zIndex: 1, ...p } as Shape);

describe('pseudolocalização', () => {
  it('acentua, alonga e envolve em colchetes', () => {
    const r = pseudoLocalize('Comprar agora');
    expect(r.startsWith('[Çómpráŕ'.slice(0, 2))).toBe(true);
    expect(r.endsWith('~]') || r.endsWith('~~]') || r.endsWith('~~~]')).toBe(true);
    expect(r.length).toBeGreaterThan('Comprar agora'.length);
  });

  it('preserva {variáveis} e não mexe em texto vazio', () => {
    expect(pseudoLocalize('Olá {nome}!')).toContain('{nome}');
    expect(pseudoLocalize('   ')).toBe('   ');
  });

  it('aplica nos textos da seleção (e filhos), guarda o original e restaura', () => {
    const all = [
      { id: 'f', type: 'frame', x: 0, y: 0, width: 1, height: 1, rotation: 0, opacity: 1, visible: true, zIndex: 0 } as Shape,
      t({ id: 'a', parentId: 'f', text: 'Entrar' } as any),
      t({ id: 'b', text: 'Fora' }),
    ];
    const loc = pseudoLocalizeShapes(all, ['f']);
    expect(loc[1].text).not.toBe('Entrar');
    expect(loc[1].l10nOriginal).toBe('Entrar');
    expect(loc[2].text).toBe('Fora'); // fora da seleção
    // aplicar de novo não localiza o já localizado
    expect(pseudoLocalizeShapes(loc, ['f'])[1].text).toBe(loc[1].text);
    const back = restoreLocalized(loc, ['f']);
    expect(back[1]).toMatchObject({ text: 'Entrar', l10nOriginal: undefined });
  });
});
