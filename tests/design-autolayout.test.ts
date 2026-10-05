import { describe, expect, it } from 'bun:test';
import { relayoutAll } from '../src/components/design2/autoLayout';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0, fill: '#fff', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, ...p }) as Shape;

const frame = (p: Partial<Shape> = {}) => mk({ id: 'f', type: 'frame', x: 100, y: 50, width: 300, height: 100, hasAutoLayout: true, layoutFlow: 'horizontal', layoutGap: 10, paddingHorizontal: 20, paddingVertical: 8, ...p });

describe('autoLayout', () => {
  it('horizontal: padding, gap e ordem pela posição atual', () => {
    const all = [frame(), mk({ id: 'b', parentId: 'f', x: 500, y: 0, width: 40, height: 20 }), mk({ id: 'a', parentId: 'f', x: 0, y: 0, width: 30, height: 20 })];
    const out = relayoutAll(all);
    const a = out.find((s) => s.id === 'a')!;
    const b = out.find((s) => s.id === 'b')!;
    expect(a).toMatchObject({ x: 120, y: 58 }); // frame.x + padding esquerdo ; frame.y + padding topo
    expect(b).toMatchObject({ x: 160 }); // 120 + 30 + gap 10
  });

  it('hug: o frame passa a medir o conteúdo mais o padding', () => {
    const all = [frame({ widthMode: 'hug', heightMode: 'hug' }), mk({ id: 'a', parentId: 'f', width: 30, height: 20 }), mk({ id: 'b', parentId: 'f', x: 50, width: 40, height: 50 })];
    const f = relayoutAll(all).find((s) => s.id === 'f')!;
    expect(f).toMatchObject({ width: 20 + 30 + 10 + 40 + 20, height: 8 + 50 + 8 });
  });

  it('fill reparte o espaço restante e o alinhamento central centraliza', () => {
    const all = [frame({ width: 300, layoutAlign: 'center', height: 100 }), mk({ id: 'a', parentId: 'f', width: 50, height: 20 }), mk({ id: 'b', parentId: 'f', x: 80, width: 10, height: 20, widthMode: 'fill' })];
    const out = relayoutAll(all);
    expect(out.find((s) => s.id === 'b')!.width).toBe(300 - 40 - 10 - 50); // 200
    expect(out.find((s) => s.id === 'a')!.y).toBe(50 + (100 - 16 - 20) / 2 + 8); // centro vertical
  });

  it('vertical com hug em ambos e frames aninhados propagam o hug', () => {
    const outer = frame({ id: 'o', layoutFlow: 'vertical', widthMode: 'hug', heightMode: 'hug', paddingHorizontal: 0, paddingVertical: 0, layoutGap: 4 });
    const inner = mk({ id: 'i', type: 'frame', parentId: 'o', hasAutoLayout: true, layoutFlow: 'horizontal', layoutGap: 0, paddingHorizontal: 5, paddingVertical: 5, widthMode: 'hug', heightMode: 'hug', width: 1, height: 1 });
    const leaf = mk({ id: 'l', parentId: 'i', width: 30, height: 10 });
    const out = relayoutAll([outer, inner, leaf]);
    expect(out.find((s) => s.id === 'i')).toMatchObject({ width: 40, height: 20 });
    expect(out.find((s) => s.id === 'o')).toMatchObject({ width: 40, height: 20 });
    expect(out.find((s) => s.id === 'l')).toMatchObject({ x: outer.x + 5, y: outer.y + 5 });
  });

  it('sem auto layout nada muda', () => {
    const all = [mk({ id: 'f', type: 'frame' }), mk({ id: 'a', parentId: 'f', x: 7 })];
    expect(relayoutAll(all)).toBe(all);
  });
});
