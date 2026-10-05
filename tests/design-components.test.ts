import { describe, expect, it } from 'bun:test';
import { createInstance, detachInstance, switchVariant, syncInstances, variantsOf } from '../src/components/design2/components';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0, fill: '#ffffff', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, ...p }) as Shape;

let n = 0;
const gen = () => `i${++n}`;

const component = () => [
  mk({ id: 'c', type: 'frame', name: 'Botão', x: 100, y: 100, width: 120, height: 40, isComponent: true, fill: '#0066ff' }),
  mk({ id: 'c-t', parentId: 'c', type: 'text', x: 110, y: 110, width: 80, height: 20, text: 'Enviar', fill: '#ffffff' }),
];

describe('components', () => {
  it('cria instância ligada ao componente, deslocada e com ids novos', () => {
    n = 0;
    const inst = createInstance(component(), 'c', { x: 300, y: 0 }, gen);
    expect(inst).toHaveLength(2);
    expect(inst[0]).toMatchObject({ id: 'i1', instanceOf: 'c', sourceId: 'c', x: 400, y: 100, isComponent: false });
    expect(inst[1]).toMatchObject({ id: 'i2', parentId: 'i1', sourceId: 'c-t', x: 410 });
  });

  it('mudar o componente atualiza a instância, exceto o que foi sobrescrito', () => {
    n = 0;
    const all = [...component(), ...createInstance(component(), 'c', { x: 300, y: 0 }, gen)];
    // instância sobrescreve o texto
    const withOverride = all.map((s) => (s.id === 'i2' ? { ...s, text: 'Salvar', overrides: ['text'] } : s));
    // componente muda cor, tamanho e texto
    const changed = withOverride.map((s) => (s.id === 'c' ? { ...s, fill: '#ff0000', width: 200 } : s.id === 'c-t' ? { ...s, text: 'Novo', x: 120 } : s));
    const synced = syncInstances(changed);
    expect(synced.find((s) => s.id === 'i1')).toMatchObject({ fill: '#ff0000', width: 200, x: 400 });
    expect(synced.find((s) => s.id === 'i2')).toMatchObject({ text: 'Salvar', x: 420 }); // texto mantido, posição acompanha
  });

  it('filho novo no componente aparece na instância e removido some', () => {
    n = 0;
    const base = [...component(), ...createInstance(component(), 'c', { x: 300, y: 0 }, gen)];
    const added = [...base, mk({ id: 'c-x', parentId: 'c', x: 105, y: 105, fill: '#00ff00' })];
    const s1 = syncInstances(added);
    expect(s1.filter((s) => s.sourceId === 'c-x')).toHaveLength(1);
    const removed = s1.filter((s) => s.id !== 'c-t');
    const s2 = syncInstances(removed);
    expect(s2.some((s) => s.sourceId === 'c-t')).toBe(false);
  });

  it('desanexar corta o vínculo', () => {
    n = 0;
    const all = [...component(), ...createInstance(component(), 'c', { x: 300, y: 0 }, gen)];
    const det = detachInstance(all, 'i1');
    expect(det.find((s) => s.id === 'i1')).toMatchObject({ instanceOf: undefined, sourceId: undefined });
    expect(syncInstances(det.map((s) => (s.id === 'c' ? { ...s, fill: '#123456' } : s))).find((s) => s.id === 'i1')!.fill).toBe('#0066ff');
  });

  it('variantes: agrupa componentes e troca a instância mantendo a posição', () => {
    n = 0;
    const primary = { ...component()[0], variantGroup: 'Botão', variantName: 'Primário' };
    const secondary = mk({ id: 'c2', type: 'frame', name: 'Botão secundário', x: 600, y: 100, width: 120, height: 40, isComponent: true, variantGroup: 'Botão', variantName: 'Secundário', fill: '#999999' });
    const base = [primary, component()[1], secondary, ...createInstance([primary, component()[1]], 'c', { x: 0, y: 200 }, gen)];
    expect(variantsOf(base, 'c').map((s) => s.id).sort()).toEqual(['c', 'c2']);
    const inst = base.find((s) => s.instanceOf === 'c')!;
    const res = switchVariant(base, inst.id, 'c2', gen)!;
    const novo = res.shapes.find((s) => s.id === res.newRootId)!;
    expect(novo).toMatchObject({ instanceOf: 'c2', x: inst.x, y: inst.y, fill: '#999999' });
    expect(res.shapes.some((s) => s.id === inst.id)).toBe(false);
  });
});
