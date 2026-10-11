import { describe, expect, it } from 'bun:test';
import { boundsOfShapes, buildPdfFromJpeg, collectSubtree, exportFileName, scaleValue } from '../src/components/design2/exportDesign';
import type { Shape } from '../src/components/design2/types';

const mk = (p: Partial<Shape> & { id: string }): Shape =>
  ({ type: 'rect', x: 0, y: 0, width: 10, height: 10, rotation: 0, fill: '#fff', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, ...p }) as Shape;

describe('exportDesign', () => {
  it('coleta o shape e todos os descendentes', () => {
    const all = [mk({ id: 'f', type: 'frame' }), mk({ id: 'a', parentId: 'f' }), mk({ id: 'b', parentId: 'a' }), mk({ id: 'x' })];
    expect(collectSubtree(all, all[0]).map((s) => s.id)).toEqual(['f', 'a', 'b']);
  });

  it('calcula os limites com folga de traço e sombra', () => {
    const b = boundsOfShapes([mk({ id: 'a', x: 100, y: 50, width: 200, height: 100, strokeWidth: 4 })]);
    expect(b).toEqual({ x: 98, y: 48, width: 204, height: 104 });
    const sh = boundsOfShapes([mk({ id: 'a', width: 100, height: 100, effects: [{ id: 'e', type: 'drop-shadow', color: '#000', opacity: 0.25, x: 0, y: 4, blur: 10, spread: 0, visible: true }] })]);
    expect(sh.width).toBeGreaterThan(100);
  });

  it('nome do arquivo usa sufixo e escala', () => {
    expect(exportFileName(mk({ id: 'a', name: 'Tela/Login' }), { id: 'e', format: 'PNG', scale: '2x', suffix: '-dark' })).toBe('Tela-Login-dark@2x.png');
    expect(exportFileName(mk({ id: 'a', name: 'Card' }), { id: 'e', format: 'SVG', scale: '1x' })).toBe('Card.svg');
    expect(scaleValue('1.5x')).toBe(1.5);
  });

  it('gera um PDF válido com xref correto', () => {
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const pdf = buildPdfFromJpeg(jpeg, 10, 10, 10, 10);
    const text = new TextDecoder('latin1').decode(pdf);
    expect(text.startsWith('%PDF-1.4')).toBe(true);
    expect(text.endsWith('%%EOF')).toBe(true);
    const startxref = Number(text.match(/startxref\n(\d+)/)![1]);
    expect(text.slice(startxref, startxref + 4)).toBe('xref');
    const off1 = Number(text.match(/xref\n0 6\n.*\n(\d{10})/)![1]);
    expect(text.slice(off1, off1 + 7)).toBe('1 0 obj');
  });
});

it('raio maior que a metade do lado vira pílula (sem elipse)', async () => {
  const { buildExportSvg: build } = await import('../src/components/design2/exportDesign');
  const mk = (o: any) => ({ rotation: 0, fill: '#111', stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: 1, visible: true, pageId: 'p', ...o });
  const shapes = [mk({ id: 'f', type: 'frame', x: 0, y: 0, width: 200, height: 100 }), mk({ id: 'p', type: 'frame', parentId: 'f', x: 10, y: 10, width: 100, height: 40, cornerRadius: 999 })] as any[];
  const { svg } = build(shapes, shapes[0], 1);
  expect(svg).toContain('rx="20"'); // min(999, 100/2, 40/2)
  expect(svg).not.toContain('rx="999"');
});

describe('ids únicos no SVG', () => {
  it('prefixa ids, url(#) e href="#" juntos', async () => {
    const { uniquifySvgIds } = await import('../src/components/design2/exportDesign');
    const svg = '<svg><defs><clipPath id="c1"/><linearGradient id="g"/></defs><rect clip-path="url(#c1)" fill="url(#g)"/><use href="#g"/></svg>';
    const out = uniquifySvgIds(svg, 'p1');
    expect(out).toContain('id="p1-c1"');
    expect(out).toContain('clip-path="url(#p1-c1)"');
    expect(out).toContain('fill="url(#p1-g)"');
    expect(out).toContain('href="#p1-g"');
    expect(out).not.toContain('id="c1"');
  });
});
