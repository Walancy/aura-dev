import { describe, expect, it } from 'bun:test';
import { importSvg, parseSvgXml, pathBBox } from '../src/components/design2/svgImport';

let n = 0;
const id = () => `n${++n}`;

const SVG = `<?xml version="1.0"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 100">
  <!-- fundo -->
  <rect x="10" y="10" width="80" height="40" rx="6" fill="#ff0000" stroke="#000" stroke-width="2"/>
  <g transform="translate(100, 20)" opacity="0.5" fill="#00ff00">
    <circle cx="20" cy="20" r="15"/>
    <path d="M0 0 L30 0 L30 30 Z"/>
  </g>
  <text x="10" y="90" font-size="14" font-family="Inter, sans-serif">Olá</text>
  <line x1="0" y1="95" x2="200" y2="95" stroke="#333"/>
  <defs><linearGradient id="g"/></defs>
</svg>`;

describe('importar SVG', () => {
  it('parser lê tags, atributos e texto', () => {
    const root = parseSvgXml(SVG)!;
    expect(root.tag).toBe('svg');
    expect(root.children.map((c) => c.tag)).toEqual(['rect', 'g', 'text', 'line', 'defs']);
    expect(root.children[2].text).toBe('Olá');
  });

  it('caixa de caminhos: retas, relativos e curvas', () => {
    expect(pathBBox('M10 10 L50 10 L50 40 Z')).toEqual({ x: 10, y: 10, w: 40, h: 30 });
    expect(pathBBox('M0 0 h20 v10')).toEqual({ x: 0, y: 0, w: 20, h: 10 });
    const c = pathBBox('M0 0 C 0 50, 100 50, 100 0')!;
    expect(c.w).toBe(100);
    expect(pathBBox('')).toBeNull();
  });

  it('vira um frame com os elementos, herdando grupo (translate, opacidade, fill)', () => {
    const shapes = importSvg(SVG, 'Ícone', { x: 1000, y: 500 }, id)!;
    const frame = shapes[0];
    expect(frame).toMatchObject({ type: 'frame', name: 'Ícone', x: 1000, y: 500, width: 200, height: 100 });
    const rect = shapes.find((s) => s.type === 'rect')!;
    expect(rect).toMatchObject({ x: 1010, y: 510, width: 80, height: 40, cornerRadius: 6, fill: '#ff0000', strokeWidth: 2, parentId: frame.id });
    const circle = shapes.find((s) => s.type === 'ellipse')!;
    // cx 20 - r 15 + translate 100 → 105; y: 20 - 15 + 20 → 25
    expect(circle).toMatchObject({ x: 1105, y: 525, width: 30, height: 30, fill: '#00ff00', opacity: 0.5 });
    const path = shapes.find((s) => s.type === 'path')!;
    expect(path).toMatchObject({ x: 1100, y: 520, width: 30, height: 30 });
    expect(path.pathD).toBe('M 0 0 L 30 0 L 30 30 Z');
  });

  it('texto e linha; defs ignorados', () => {
    const shapes = importSvg(SVG, 'x', { x: 0, y: 0 }, id)!;
    const t = shapes.find((s) => s.type === 'text')!;
    expect(t).toMatchObject({ text: 'Olá', fontSize: 14, fontFamily: 'Inter', y: 76 });
    expect(shapes.find((s) => s.type === 'line')).toMatchObject({ width: 200, stroke: '#333' });
    expect(shapes.some((s) => s.name === 'g')).toBe(false);
  });

  it('arquivo que não é SVG devolve null', () => {
    expect(importSvg('<html></html>', 'x', { x: 0, y: 0 }, id)).toBeNull();
  });
});
