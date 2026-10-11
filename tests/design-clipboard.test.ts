import { describe, expect, it } from 'bun:test';
import { copySubtree, pasteClip, replaceWithClip } from '../src/components/design2/clipboard';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 100, height: 50, rotation: 0, opacity: 1, visible: true, zIndex: 1, ...p } as Shape);

const doc = [
  mk({ id: 'f', type: 'frame' as any, x: 100, y: 100, width: 300, height: 200, zIndex: 1 }),
  mk({ id: 'c1', parentId: 'f', x: 110, y: 110, zIndex: 2 } as any),
  mk({ id: 'c2', parentId: 'f', x: 130, y: 150, zIndex: 3 } as any),
  mk({ id: 'z', x: 600, y: 0, zIndex: 4 }),
];

describe('clipboard', () => {
  it('copiar um frame leva os filhos; raízes são só os escolhidos sem ancestral escolhido', () => {
    const clip = copySubtree(doc, ['f', 'c1'])!;
    expect(clip.shapes.map((s) => s.id).sort()).toEqual(['c1', 'c2', 'f']);
    expect(clip.rootIds).toEqual(['f']);
  });

  it('copiar só um filho mantém só ele como raiz', () => {
    const clip = copySubtree(doc, ['c1'])!;
    expect(clip.rootIds).toEqual(['c1']);
    expect(clip.shapes).toHaveLength(1);
  });

  it('colar desloca 30px por padrão, remapeia ids e hierarquia e fica acima de tudo', () => {
    const clip = copySubtree(doc, ['f'])!;
    let n = 0;
    const { shapes, newRootIds } = pasteClip(clip, doc, {}, () => `n${++n}`);
    expect(shapes).toHaveLength(3);
    const root = shapes.find((s) => s.id === newRootIds[0])!;
    expect([root.x, root.y]).toEqual([130, 130]);
    const kids = shapes.filter((s) => s.parentId === root.id);
    expect(kids).toHaveLength(2);
    expect(Math.min(...shapes.map((s) => s.zIndex))).toBeGreaterThan(4);
    expect(shapes.some((s) => s.id === 'f' || s.id === 'c1')).toBe(false);
  });

  it('colar no lugar não desloca; "at" leva o canto do conjunto ao ponto', () => {
    const clip = copySubtree(doc, ['f'])!;
    const inPlace = pasteClip(clip, doc, { offset: { x: 0, y: 0 } });
    expect(inPlace.shapes.find((s) => s.id === inPlace.newRootIds[0])!.x).toBe(100);
    const at = pasteClip(clip, doc, { at: { x: 500, y: 400 } });
    const kid = at.shapes.find((s) => s.parentId === at.newRootIds[0])!;
    expect(at.shapes.find((s) => s.id === at.newRootIds[0])).toMatchObject({ x: 500, y: 400 });
    expect(kid.x).toBe(510); // o filho acompanha
  });

  it('cola em outra página: filho sem pai existente sobe para a raiz', () => {
    const clip = copySubtree(doc, ['c1'])!;
    const { shapes } = pasteClip(clip, [mk({ id: 'other', zIndex: 1 })], { pageId: 'page-2' });
    expect(shapes[0].parentId).toBeUndefined();
    expect(shapes[0].pageId).toBe('page-2');
  });

  it('substituir troca o alvo (e filhos) pelo copiado, mantendo lugar, tamanho e camada', () => {
    const clip = copySubtree(doc, ['z'])!;
    const r = replaceWithClip(clip, doc, 'f', () => 'novo')!;
    const novo = r.shapes.find((s) => s.id === 'novo')!;
    expect(novo).toMatchObject({ x: 100, y: 100, width: 300, height: 200, zIndex: 1 });
    expect(r.shapes.some((s) => ['f', 'c1', 'c2'].includes(s.id))).toBe(false);
  });
});
