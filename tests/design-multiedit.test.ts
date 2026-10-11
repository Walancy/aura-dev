import { describe, expect, it } from 'bun:test';
import { applyPatchToSelection, mixedKeys } from '../src/components/design2/multiEdit';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 100, height: 50, rotation: 0, opacity: 1, visible: true, zIndex: 1, fill: '#fff', ...p } as Shape);

describe('edição múltipla', () => {
  const a = mk({ id: 'a', x: 10, opacity: 1 });
  const b = mk({ id: 'b', x: 50, opacity: 0.5 });

  it('mixedKeys aponta só o que difere', () => {
    expect([...mixedKeys([a, b])].sort()).toEqual(['opacity', 'x']);
    expect(mixedKeys([a]).size).toBe(0);
    expect(mixedKeys([a, { ...a, id: 'c' }]).size).toBe(0);
  });

  it('propriedades de estilo vão para todos os selecionados', () => {
    const out = applyPatchToSelection([a, b, mk({ id: 'z' })], ['a', 'b'], 'a', { opacity: 0.8, cornerRadius: 12 });
    expect(out.find((s) => s.id === 'a')).toMatchObject({ opacity: 0.8, cornerRadius: 12 });
    expect(out.find((s) => s.id === 'b')).toMatchObject({ opacity: 0.8, cornerRadius: 12 });
    expect(out.find((s) => s.id === 'z')!.opacity).toBe(1);
  });

  it('x/y movem o conjunto pelo deslocamento do principal, mantendo as distâncias', () => {
    const out = applyPatchToSelection([a, b], ['a', 'b'], 'a', { x: 20 });
    expect(out.find((s) => s.id === 'a')!.x).toBe(20);
    expect(out.find((s) => s.id === 'b')!.x).toBe(60);
  });

  it('largura/altura valem para cada um', () => {
    const out = applyPatchToSelection([a, b], ['a', 'b'], 'a', { width: 200 });
    expect(out.map((s) => s.width)).toEqual([200, 200]);
  });
});
