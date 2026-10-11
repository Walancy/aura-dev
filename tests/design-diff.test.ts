import { describe, expect, it } from 'bun:test';
import { diffShapes } from '../src/components/design2/diffShapes';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape => ({ type: 'rect', x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1, visible: true, zIndex: 1, fill: '#fff', ...p } as Shape);

describe('comparar versões', () => {
  const before = [mk({ id: 'a', name: 'Botão', x: 10 }), mk({ id: 'b', name: 'Título', text: 'Oi' } as any), mk({ id: 'c', name: 'Velho' })];
  const after = [mk({ id: 'a', name: 'Botão', x: 50, fill: '#000' }), mk({ id: 'b', name: 'Título', text: 'Oi' } as any), mk({ id: 'd', name: 'Novo' })];

  it('detecta novos, removidos e alterados', () => {
    const d = diffShapes(before, after);
    expect(d.added.map((s) => s.id)).toEqual(['d']);
    expect(d.removed.map((s) => s.id)).toEqual(['c']);
    expect(d.changed.map((c) => c.id)).toEqual(['a']);
  });

  it('lista os campos que mudaram com antes e depois', () => {
    const [c] = diffShapes(before, after).changed;
    expect(c.fields).toEqual([{ key: 'x', from: '10', to: '50' }, { key: 'fill', from: '#fff', to: '#000' }]);
  });

  it('diferença numérica minúscula é ignorada; listas iguais não têm diferença', () => {
    expect(diffShapes([mk({ id: 'a', x: 1 })], [mk({ id: 'a', x: 1.001 })]).changed).toEqual([]);
    expect(diffShapes(before, before)).toEqual({ added: [], removed: [], changed: [] });
  });
});
