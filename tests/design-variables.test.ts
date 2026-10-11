import { describe, expect, it } from 'bun:test';
import { applyVariables, createColorVariable, createTypedVariable, DEFAULT_MODES, typedValue, variableValue } from '../src/components/design2/variables';
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

describe('variáveis de número, texto e booleana', () => {
  const shape = (extra: any = {}) => ({ id: 's', type: 'rect', x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1, visible: true, zIndex: 1, ...extra } as any);
  const modes = [{ id: 'light', name: 'Claro' }, { id: 'dark', name: 'Escuro' }];

  it('número ligado à largura e ao raio muda com o modo', () => {
    const v = { ...createTypedVariable('number', 'n1', 'Largura do card', '320', modes), values: { light: '320', dark: '280' } };
    const r = createTypedVariable('number', 'n2', 'Raio', '12', modes);
    const s = shape({ variableBindings: { width: 'n1', cornerRadius: 'n2' } });
    expect(applyVariables([s], [v, r], 'light')[0]).toMatchObject({ width: 320, cornerRadius: 12 });
    expect(applyVariables([s], [v, r], 'dark')[0].width).toBe(280);
  });

  it('texto e booleana controlam o conteúdo e a visibilidade', () => {
    const t = createTypedVariable('text', 't1', 'Título', 'Olá', modes);
    const b = { ...createTypedVariable('boolean', 'b1', 'Mostrar selo', 'true', modes), values: { light: 'true', dark: 'false' } };
    const s = shape({ type: 'text', text: 'x', variableBindings: { text: 't1', visible: 'b1' } });
    expect(applyVariables([s], [t, b], 'light')[0]).toMatchObject({ text: 'Olá', visible: true });
    expect(applyVariables([s], [t, b], 'dark')[0].visible).toBe(false);
  });

  it('valor inválido de número e variável apagada são ignorados; sem mudança devolve a mesma lista', () => {
    const bad = { ...createTypedVariable('number', 'n1', 'x', 'abc', modes) };
    const s = shape({ variableBindings: { width: 'n1', height: 'inexistente' } });
    const list = [s];
    expect(applyVariables(list, [bad], 'light')).toBe(list);
    const ok = createTypedVariable('number', 'n1', 'x', '100', modes);
    expect(applyVariables(list, [ok], 'light')).toBe(list); // largura já é 100
  });

  it('typedValue converte por tipo', () => {
    expect(typedValue(createTypedVariable('number', 'a', 'a', '7.5', modes), 'light')).toBe(7.5);
    expect(typedValue(createTypedVariable('boolean', 'b', 'b', 'false', modes), 'light')).toBe(false);
    expect(typedValue(createTypedVariable('text', 'c', 'c', 'oi', modes), 'dark')).toBe('oi');
  });
});
