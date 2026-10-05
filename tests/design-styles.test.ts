import { describe, expect, it } from 'bun:test';
import { applyStyles, colorStyleFromShape, textStyleFromShape } from '../src/components/design2/styles';
import type { DesignStyle, Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0, fill: '#ffffff', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, ...p }) as Shape;

describe('styles', () => {
  it('mudar a cor do estilo atualiza fill e fills[0] de todos os shapes ligados', () => {
    const style: DesignStyle = { id: 's1', name: 'Marca', kind: 'color', color: '#ff0000', opacity: 0.8 };
    const shapes = [
      mk({ id: 'a', fillStyleId: 's1', fills: [{ id: 'f', color: '#00ff00', opacity: 1, visible: true }] }),
      mk({ id: 'b', fillStyleId: 's1' }),
      mk({ id: 'c', fill: '#123456' }),
    ];
    const out = applyStyles(shapes, [style]);
    expect(out[0]).toMatchObject({ fill: '#ff0000' });
    expect(out[0].fills![0]).toMatchObject({ color: '#ff0000', opacity: 0.8 });
    expect(out[1].fill).toBe('#ff0000');
    expect(out[2]).toBe(shapes[2]);
  });

  it('estilo de texto aplica tipografia', () => {
    const style: DesignStyle = { id: 't1', name: 'Título', kind: 'text', fontSize: 32, fontWeight: 700, fontFamily: 'Inter' };
    const out = applyStyles([mk({ id: 'x', type: 'text', textStyleId: 't1', fontSize: 12 })], [style]);
    expect(out[0]).toMatchObject({ fontSize: 32, fontWeight: 700, fontFamily: 'Inter' });
  });

  it('sem mudanças devolve a mesma referência e cria estilos a partir do shape', () => {
    const shapes = [mk({ id: 'a' })];
    expect(applyStyles(shapes, [{ id: 's', name: 'x', kind: 'color', color: '#fff', opacity: 1 }])).toBe(shapes);
    expect(colorStyleFromShape(mk({ id: 'a', fill: '#abcdef' }), 'n', 'Azul')).toMatchObject({ kind: 'color', color: '#abcdef', opacity: 1 });
    expect(textStyleFromShape(mk({ id: 'a', fontSize: 20 }), 'n', 'Corpo')).toMatchObject({ kind: 'text', fontSize: 20 });
  });
});
