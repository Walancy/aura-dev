import { describe, expect, it } from 'bun:test';
import { patternTile } from '../src/components/design2/pattern';

describe('padrões de preenchimento', () => {
  it('linhas: uma barra fina na altura da peça', () => {
    const t = patternTile('lines', 10, '#000');
    expect(t).toEqual({ w: 10, h: 10, items: [{ tag: 'rect', x: 0, y: 0, w: 1.4, h: 10, fill: '#000' }] });
  });

  it('pontos: círculo centrado', () => {
    const t = patternTile('dots', 20, '#f00');
    expect(t.items[0]).toEqual({ tag: 'circle', cx: 10, cy: 10, r: 3.2, fill: '#f00' });
  });

  it('grade tem duas barras; xadrez, dois quadrados na diagonal', () => {
    expect(patternTile('grid', 10, '#000').items).toHaveLength(2);
    const c = patternTile('checker', 10, '#000').items;
    expect(c).toEqual([{ tag: 'rect', x: 0, y: 0, w: 5, h: 5, fill: '#000' }, { tag: 'rect', x: 5, y: 5, w: 5, h: 5, fill: '#000' }]);
  });

  it('fundo opcional entra primeiro; tamanho mínimo de 2', () => {
    const t = patternTile('dots', 1, '#000', '#fff');
    expect(t.w).toBe(2);
    expect(t.items[0]).toEqual({ tag: 'rect', x: 0, y: 0, w: 2, h: 2, fill: '#fff' });
  });

  it('ruído usa peça fixa de 64px', () => {
    expect(patternTile('noise', 5, '#000')).toEqual({ w: 64, h: 64, items: [{ tag: 'noise' }] });
  });
});
