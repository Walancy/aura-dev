import { describe, expect, it } from 'bun:test';
import { applyComponentProps, defaultPropValue, propTargets, type ComponentProp } from '../src/components/design2/componentProps';
import { createInstance, syncInstances } from '../src/components/design2/components';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1, visible: true, zIndex: 1, ...p } as Shape);

const props: ComponentProp[] = [
  { id: 'p-icon', name: 'Mostrar ícone', type: 'boolean', targetId: 'icon' },
  { id: 'p-label', name: 'Rótulo', type: 'text', targetId: 'label' },
];

const comp = () => [
  mk({ id: 'btn', type: 'frame' as any, name: 'Botão', isComponent: true, componentProps: props, zIndex: 1 } as any),
  mk({ id: 'icon', parentId: 'btn', name: 'Ícone', zIndex: 2 } as any),
  mk({ id: 'label', type: 'text' as any, parentId: 'btn', name: 'Rótulo', text: 'Comprar', zIndex: 3 } as any),
];

let n = 0;
const withInstance = () => {
  const base = comp();
  const inst = createInstance(base, 'btn', { x: 300, y: 0 }, () => `i${++n}`);
  return { all: [...base, ...inst], root: inst[0] };
};

describe('propriedades de componente', () => {
  it('lista as camadas internas como alvos possíveis', () => {
    expect(propTargets(comp(), 'btn').map((t) => t.id).sort()).toEqual(['icon', 'label']);
  });

  it('valor padrão vem da camada do componente principal', () => {
    expect(defaultPropValue(comp(), props[0])).toBe(true);
    expect(defaultPropValue(comp(), props[1])).toBe('Comprar');
  });

  it('boolean oculta a camada na instância e texto troca o conteúdo', () => {
    const { all, root } = withInstance();
    const out = applyComponentProps(all.map((s) => (s.id === root.id ? { ...s, propValues: { 'p-icon': false, 'p-label': 'Assinar' } } : s)));
    const icon = out.find((s) => s.sourceId === 'icon')!;
    const label = out.find((s) => s.sourceId === 'label')!;
    expect(icon.visible).toBe(false);
    expect(label.text).toBe('Assinar');
    expect(out.find((s) => s.id === 'icon')!.visible).toBe(true); // o principal não muda
  });

  it('a sincronização com o componente não desfaz o valor da propriedade', () => {
    const { all, root } = withInstance();
    let out = applyComponentProps(all.map((s) => (s.id === root.id ? { ...s, propValues: { 'p-label': 'Assinar' } } : s)));
    // muda outra coisa no principal (cor) e sincroniza
    out = out.map((s) => (s.id === 'label' ? { ...s, fill: '#f00' } : s));
    out = syncInstances(out);
    const label = out.find((s) => s.sourceId === 'label')!;
    expect(label.text).toBe('Assinar');
    expect(label.fill).toBe('#f00');
  });

  it('sem valores definidos nada muda', () => {
    const { all } = withInstance();
    expect(applyComponentProps(all)).toBe(all);
  });
});
