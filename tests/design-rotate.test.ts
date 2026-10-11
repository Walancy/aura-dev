import { describe, expect, it } from 'bun:test';
import { angleDeg, rotateShapes, snapAngle } from '../src/components/design2/rotate';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0, opacity: 1, visible: true, zIndex: 0, ...p } as Shape);

describe('rotate', () => {
  it('ângulo e encaixe de 15°', () => {
    expect(angleDeg({ x: 0, y: 0 }, { x: 10, y: 0 })).toBe(0);
    expect(angleDeg({ x: 0, y: 0 }, { x: 0, y: 10 })).toBe(90);
    expect(snapAngle(22)).toBe(15);
    expect(snapAngle(23)).toBe(30);
    expect(snapAngle(-8)).toBe(-15);
    expect(snapAngle(-6) + 0).toBe(0);
  });

  it('um shape gira ao redor do próprio centro: posição igual, rotação somada', () => {
    const [r] = rotateShapes([mk({ id: 'a', x: 100, y: 100, width: 40, height: 20 })], ['a'], { x: 120, y: 110 }, 30);
    expect(r.x).toBeCloseTo(100);
    expect(r.y).toBeCloseTo(100);
    expect(r.rotation).toBe(30);
  });

  it('um shape fora do pivô orbita: 90° leva o centro (100,0) para (0,100)', () => {
    const out = rotateShapes([mk({ id: 'a', x: 95, y: -5 })], ['a'], { x: 0, y: 0 }, 90);
    expect(out[0].x).toBeCloseTo(-5);
    expect(out[0].y).toBeCloseTo(95);
    expect(out[0].rotation).toBe(90);
  });

  it('descendentes acompanham e quem não foi escolhido não muda', () => {
    const all = [mk({ id: 'f', type: 'frame' as any }), mk({ id: 'c', parentId: 'f', x: 50 } as any), mk({ id: 'z', x: 300 })];
    const out = rotateShapes(all, ['f'], { x: 0, y: 0 }, 180);
    expect(out.find((s) => s.id === 'c')!.rotation).toBe(180);
    expect(out.find((s) => s.id === 'z')).toBe(all[2]);
  });

  it('rotação normaliza para -180..180', () => {
    const [r] = rotateShapes([mk({ id: 'a', rotation: 170 })], ['a'], { x: 5, y: 5 }, 30);
    expect(r.rotation).toBe(-160);
  });

  it('pen/pencil giram os pontos e recalculam a caixa', () => {
    const pen = mk({ id: 'p', type: 'pen' as any, points: [{ x: 10, y: 0 }, { x: 20, y: 0 }] } as any);
    const [r] = rotateShapes([pen], ['p'], { x: 0, y: 0 }, 90);
    expect(r.points![0].x).toBeCloseTo(0);
    expect(r.points![0].y).toBeCloseTo(10);
    expect(r.height).toBeCloseTo(10);
  });
});
