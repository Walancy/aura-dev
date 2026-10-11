import { describe, expect, it } from 'bun:test';
import { outlineStroke, strokeToMulti } from '../src/components/design2/outlineStroke';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 100, height: 50, rotation: 0, opacity: 1, visible: true, zIndex: 1, fill: 'none', stroke: '#ff0000', strokeWidth: 10, ...p } as Shape);

const bbox = (m: any) => {
  const pts = m.flatMap((poly: any) => poly.flatMap((r: any) => r));
  const xs = pts.map((p: any) => p[0]), ys = pts.map((p: any) => p[1]);
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) };
};

describe('outline stroke', () => {
  it('linha com ponta redonda: comprimento + largura do traço', () => {
    const b = bbox(strokeToMulti([{ x: 0, y: 0 }, { x: 100, y: 0 }], 10, false, { cap: 'round' }));
    expect(b.x).toBeCloseTo(-5, 0);
    expect(b.w).toBeCloseTo(110, 0);
    expect(b.h).toBeCloseTo(10, 0);
  });

  it('ponta reta (butt) não passa das extremidades; quadrada passa meia espessura', () => {
    expect(bbox(strokeToMulti([{ x: 0, y: 0 }, { x: 100, y: 0 }], 10, false, { cap: 'butt' })).w).toBeCloseTo(100, 0);
    expect(bbox(strokeToMulti([{ x: 0, y: 0 }, { x: 100, y: 0 }], 10, false, { cap: 'square' })).w).toBeCloseTo(110, 0);
  });

  it('anel fechado (quadrado): um polígono com buraco', () => {
    const m = strokeToMulti([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }, { x: 0, y: 100 }], 10, true, { join: 'round' })!;
    expect(m).toHaveLength(1);
    expect(m[0]).toHaveLength(2); // contorno externo + buraco
    expect(bbox(m).w).toBeCloseTo(110, 0);
  });

  it('largura zero ou menos de 2 pontos → null', () => {
    expect(strokeToMulti([{ x: 0, y: 0 }, { x: 1, y: 1 }], 0, false)).toBeNull();
    expect(strokeToMulti([{ x: 0, y: 0 }], 4, false)).toBeNull();
  });

  it('shape sem preenchimento é substituído pelo contorno preenchido com a cor do traço', () => {
    const all = [mk({ id: 'a' }), mk({ id: 'z', x: 500 })];
    const r = outlineStroke(all, 'a', 'novo')!;
    expect(r.shapes.some((s) => s.id === 'a')).toBe(false);
    const o = r.shapes.find((s) => s.id === 'novo')!;
    expect(o).toMatchObject({ type: 'path', fill: '#ff0000', strokeWidth: 0 });
    expect(o.pathD!.length).toBeGreaterThan(10);
    expect(o.width).toBeCloseTo(110, 0);
  });

  it('forma com preenchimento continua, sem traço, e o contorno nasce por cima', () => {
    const all = [mk({ id: 'a', fill: '#00ff00' })];
    const r = outlineStroke(all, 'a', 'novo')!;
    const orig = r.shapes.find((s) => s.id === 'a')!;
    expect(orig.strokeWidth).toBe(0);
    expect(orig.fill).toBe('#00ff00');
    expect(r.shapes.find((s) => s.id === 'novo')!.zIndex).toBeGreaterThan(orig.zIndex);
  });

  it('sem traço visível não faz nada', () => {
    expect(outlineStroke([mk({ id: 'a', strokeWidth: 0 })], 'a', 'n')).toBeNull();
  });

  it('caminho da caneta com curva usa os pontos amostrados', () => {
    const pen = mk({ id: 'p', type: 'pen' as any, points: [{ x: 0, y: 0 }, { x: 100, y: 0 }], pathHandles: [{ out: { x: 0, y: 60 } }, { in: { x: 0, y: 60 } }], strokeWidth: 4 } as any);
    const r = outlineStroke([pen], 'p', 'n')!;
    expect(r.shapes[0].height).toBeGreaterThan(40); // acompanha o bojo da curva
  });
});
