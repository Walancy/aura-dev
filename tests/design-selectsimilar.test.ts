import { describe, expect, it } from 'bun:test';
import { selectSimilar } from '../src/components/design2/selectSimilar';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1, visible: true, zIndex: 1, fill: '#ffffff', stroke: 'none', strokeWidth: 0, ...p } as Shape);

const doc = [
  mk({ id: 'a', fill: '#FF0000' }),
  mk({ id: 'b', fill: '#ff0000' }),
  mk({ id: 'c', fill: '#00ff00' }),
  mk({ id: 'd', fill: '#ff0000', pageId: 'page-2' }),
  mk({ id: 'e', fill: '#ff0000', locked: true }),
  mk({ id: 't1', type: 'text' as any, fontFamily: 'Inter', fontSize: 16, fontWeight: 400, fill: '#000' }),
  mk({ id: 't2', type: 'text' as any, fontFamily: 'inter', fontSize: 16, fontWeight: 400, fill: '#111' }),
  mk({ id: 't3', type: 'text' as any, fontFamily: 'Inter', fontSize: 24, fontWeight: 400, fill: '#000' }),
];

describe('selecionar parecidos', () => {
  it('mesmo preenchimento: ignora caixa, outra página e travados', () => {
    expect(selectSimilar(doc, doc[0], 'fill').sort()).toEqual(['a', 'b']);
  });

  it('mesma fonte: família (sem diferenciar caixa), tamanho e peso', () => {
    expect(selectSimilar(doc, doc[5], 'font').sort()).toEqual(['t1', 't2']);
  });

  it('mesmo tipo', () => {
    expect(selectSimilar(doc, doc[5], 'type').sort()).toEqual(['t1', 't2', 't3']);
  });

  it('mesmo traço só considera quem tem traço', () => {
    const s = [mk({ id: 'x', stroke: '#000', strokeWidth: 2 }), mk({ id: 'y', stroke: '#000', strokeWidth: 2 }), mk({ id: 'z', stroke: '#000', strokeWidth: 0 })];
    expect(selectSimilar(s, s[0], 'stroke').sort()).toEqual(['x', 'y']);
  });

  it('sem preenchimento de referência não seleciona nada', () => {
    const s = [mk({ id: 'n', fill: 'none' }), mk({ id: 'm', fill: 'none' })];
    expect(selectSimilar(s, s[0], 'fill')).toEqual([]);
  });
});
