import { describe, expect, it } from 'bun:test';
import { arrangeVariants, createVariantMatrix, parseVariantName, variantAxes } from '../src/components/design2/variantMatrix';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 100, height: 40, rotation: 0, opacity: 1, visible: true, zIndex: 1, ...p } as Shape);

const base = () => [
  mk({ id: 'btn', type: 'frame' as any, name: 'Botão', isComponent: true, zIndex: 1 } as any),
  mk({ id: 'lbl', type: 'text' as any, parentId: 'btn', name: 'Rótulo', text: 'OK', zIndex: 2 } as any),
];

describe('matriz de variantes', () => {
  it('lê "Prop=Valor, Prop2=Valor2"', () => {
    expect(parseVariantName('Tamanho=Grande, Estado=Hover')).toEqual({ Tamanho: 'Grande', Estado: 'Hover' });
    expect(parseVariantName('livre')).toEqual({});
  });

  it('cria o produto cartesiano dos eixos e organiza em colunas × linhas', () => {
    let n = 0;
    const r = createVariantMatrix(base(), 'btn', [{ name: 'Tamanho', values: ['P', 'G'] }, { name: 'Estado', values: ['Normal', 'Hover', 'Off'] }], () => `c${++n}`)!;
    const comps = r.shapes.filter((s) => s.isComponent);
    expect(comps).toHaveLength(6);
    expect(comps.every((c) => c.variantGroup === 'Botão')).toBe(true);
    // cada componente leva o seu filho
    expect(r.shapes.filter((s) => s.parentId && comps.some((c) => c.id === s.parentId))).toHaveLength(6);
    const at = (name: string) => comps.find((c) => c.variantName === name)!;
    expect(at('Tamanho=P, Estado=Normal')).toMatchObject({ x: 0, y: 0 });
    expect(at('Tamanho=G, Estado=Normal').x).toBe(140); // colunas: 1º eixo (100 + 40 de gap)
    expect(at('Tamanho=P, Estado=Hover').y).toBe(80); // linhas: 2º eixo (40 + 40)
    expect(variantAxes(comps).map((a) => a.name)).toEqual(['Tamanho', 'Estado']);
  });

  it('as propriedades do componente apontam para os filhos da própria cópia', () => {
    const b = base();
    b[0] = { ...b[0], componentProps: [{ id: 'p', name: 'Rótulo', type: 'text', targetId: 'lbl' }] } as any;
    let n = 0;
    const r = createVariantMatrix(b, 'btn', [{ name: 'Estado', values: ['A', 'B'] }], () => `c${++n}`)!;
    const copy = r.shapes.find((s) => s.isComponent && s.id !== 'btn')!;
    const target = copy.componentProps![0].targetId;
    expect(target).not.toBe('lbl');
    expect(r.shapes.find((s) => s.id === target)!.parentId).toBe(copy.id);
  });

  it('organizar reposiciona variantes soltas e leva os filhos', () => {
    const a = [
      mk({ id: 'a', isComponent: true, variantGroup: 'G', variantName: 'Estado=A', x: 500, y: 300 } as any),
      mk({ id: 'ak', parentId: 'a', x: 510, y: 310, width: 10, height: 10 } as any),
      mk({ id: 'b', isComponent: true, variantGroup: 'G', variantName: 'Estado=B', x: 0, y: 0 } as any),
    ];
    const out = arrangeVariants(a, 'G');
    const get = (id: string) => out.find((s) => s.id === id)!;
    expect(get('a')).toMatchObject({ x: 0, y: 0 });
    expect(get('b').x).toBe(140);
    expect(get('ak')).toMatchObject({ x: 10, y: 10 }); // o filho acompanhou
  });

  it('sem nome base ou sem eixos válidos não faz nada', () => {
    expect(createVariantMatrix(base(), 'nao-existe', [{ name: 'X', values: ['a'] }])).toBeNull();
    expect(createVariantMatrix(base(), 'btn', [{ name: '', values: [] }])).toBeNull();
  });
});
