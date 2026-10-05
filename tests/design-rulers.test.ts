import { describe, expect, it } from 'bun:test';
import { guideBoxes, rulerOrigin, rulerScale, rulerTicks, selectionRange, snapGuidePos } from '../src/components/design2/rulers';
import { computeSnap } from '../src/components/design2/snap';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0, fill: '#fff', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, ...p }) as Shape;

describe('rulers', () => {
  it('escala: principal ~80px e secundário subdivide', () => {
    expect(rulerScale(1)).toEqual({ major: 100, minor: 20 });
    expect(rulerScale(4)).toEqual({ major: 20, minor: 5 });
    expect(rulerScale(2.5)).toEqual({ major: 50, minor: 10 }); // 80/2.5 = 32 -> 50
  });

  it('marcas: principais com rótulo relativo à origem', () => {
    const ticks = rulerTicks(0, 300, 1, 100);
    const majors = ticks.filter((t) => t.major);
    expect(majors.map((t) => t.value)).toEqual([0, 100, 200, 300]);
    expect(majors.map((t) => t.label)).toEqual(['-100', '0', '100', '200']);
    expect(ticks.filter((t) => !t.major).length).toBe(12); // 4 secundárias por intervalo
  });

  it('extensão da seleção com rótulos relativos', () => {
    const r = selectionRange([{ x: 120, y: 50, width: 80, height: 40 }, { x: 150, y: 70, width: 100, height: 10 }], 'x', 100)!;
    expect(r).toMatchObject({ start: 120, end: 250, startLabel: '20', endLabel: '150' });
    expect(selectionRange([], 'y')).toBeNull();
  });

  it('origem: canto do frame da seleção; sem frame, 0,0', () => {
    const all = [mk({ id: 'f', type: 'frame', x: 300, y: 200 }), mk({ id: 'g', type: 'group', parentId: 'f' }), mk({ id: 'a', parentId: 'g' }), mk({ id: 'z' })];
    expect(rulerOrigin([all[2]], all)).toEqual({ x: 300, y: 200 });
    expect(rulerOrigin([all[0]], all)).toEqual({ x: 300, y: 200 });
    expect(rulerOrigin([all[3]], all)).toEqual({ x: 0, y: 0 });
    expect(rulerOrigin([], all)).toEqual({ x: 0, y: 0 });
  });

  it('guia arrastada encaixa em bordas/centros; shapes encaixam nas guias', () => {
    const boxes = [{ x: 100, y: 0, width: 200, height: 50 }];
    expect(snapGuidePos(103, 'x', boxes, 6)).toBe(100);
    expect(snapGuidePos(198, 'x', boxes, 6)).toBe(200); // centro
    expect(snapGuidePos(150, 'x', boxes, 6)).toBe(150);
    expect(snapGuidePos(143, 'x', [], 6, 10)).toBe(140);
    const snap = computeSnap({ x: 407, y: 10, width: 50, height: 50 }, guideBoxes([{ id: 'g', axis: 'x', pos: 400 }]), 8);
    expect(snap.dx).toBe(-7);
  });
});
