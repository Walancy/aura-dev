import { describe, expect, it } from 'bun:test';
import { applyVariables, createColorVariable, DEFAULT_MODES, variableValue } from '../src/components/design2/variables';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0, fill: '#ffffff', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, ...p }) as Shape;

describe('variables', () => {
  it('troca a cor conforme o modo ativo', () => {
    const v = { ...createColorVariable('v1', 'Fundo', '#ffffff'), values: { light: '#ffffff', dark: '#111111' } };
    const shapes = [mk({ id: 'a', fillVariableId: 'v1', fills: [{ id: 'f', color: '#ffffff', opacity: 1, visible: true }] }), mk({ id: 'b' })];
    const dark = applyVariables(shapes, [v], 'dark');
    expect(dark[0].fill).toBe('#111111');
    expect(dark[0].fills![0].color).toBe('#111111');
    expect(dark[1]).toBe(shapes[1]);
    expect(applyVariables(dark, [v], 'light')[0].fill).toBe('#ffffff');
  });

  it('sem mudança devolve a mesma referência; modo desconhecido usa o primeiro valor', () => {
    const v = createColorVariable('v1', 'x', '#abcdef');
    const shapes = [mk({ id: 'a', fillVariableId: 'v1', fill: '#abcdef' })];
    expect(applyVariables(shapes, [v], 'light')).toBe(shapes);
    expect(variableValue(v, 'inexistente')).toBe('#abcdef');
    expect(DEFAULT_MODES.map((m) => m.id)).toEqual(['light', 'dark']);
  });
});
