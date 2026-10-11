import { describe, expect, it } from 'bun:test';
import { protoArrows } from '../src/components/design2/protoArrows';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape => ({ type: 'frame', x: 0, y: 0, width: 100, height: 100, rotation: 0, opacity: 1, visible: true, zIndex: 1, ...p } as Shape);

describe('setas do protótipo', () => {
  const a = mk({ id: 'a', type: 'rect' as any, x: 10, y: 20, width: 80, height: 40, interactions: [{ id: 'i', trigger: 'click', actions: [{ type: 'navigate', targetId: 'b' }] }] });
  const b = mk({ id: 'b', x: 400, y: 0, width: 300, height: 600 });

  it('destino à direita: sai pela direita do elemento e chega na esquerda do frame', () => {
    const [arrow] = protoArrows([a, b]);
    expect(arrow).toMatchObject({ fromId: 'a', toId: 'b', kind: 'navigate', tip: { x: 400, y: 80, angle: 0 } });
    expect(arrow.d.startsWith('M 90 40 C')).toBe(true);
  });

  it('destino à esquerda chega pelo lado direito do frame', () => {
    const left = mk({ id: 'c', x: -500, y: 0, width: 300, height: 300 });
    const src = { ...a, interactions: [{ id: 'i', trigger: 'click' as const, actions: [{ type: 'navigate' as const, targetId: 'c' }] }] };
    const [arrow] = protoArrows([src, left]);
    // a seta aponta para dentro do frame, vinda da direita
    expect(arrow.tip).toMatchObject({ x: -200, angle: 180 });
  });

  it('overlay e condicional geram setas; destino inexistente e prototypeLink antigo', () => {
    const o = mk({ id: 'o', type: 'rect' as any, x: 0, y: 0, width: 10, height: 10, interactions: [{ id: 'i', trigger: 'click', actions: [{ type: 'overlay', targetId: 'b' }, { type: 'conditional', when: { variable: 'x', op: '==', value: 1 }, then: [{ type: 'navigate', targetId: 'b' }], else: [{ type: 'navigate', targetId: 'nao' }] }] }] });
    const arrows = protoArrows([o, b]);
    expect(arrows.map((x) => x.kind)).toEqual(['overlay', 'navigate']);
    const legacy = mk({ id: 'l', type: 'rect' as any, prototypeLink: { targetId: 'b' } });
    expect(protoArrows([legacy, b])).toHaveLength(1);
  });

  it('elementos ocultos e ligações para si mesmo são ignorados', () => {
    expect(protoArrows([{ ...a, visible: false }, b])).toEqual([]);
    expect(protoArrows([mk({ id: 's', interactions: [{ id: 'i', trigger: 'click', actions: [{ type: 'navigate', targetId: 's' }] }] })])).toEqual([]);
  });
});
