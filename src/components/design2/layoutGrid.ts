import type { Box } from './snap';

/** Grade de layout de um frame: colunas, linhas ou grade quadrada (como no Figma) */
export interface LayoutGrid {
  id: string;
  kind: 'grid' | 'columns' | 'rows';
  visible: boolean;
  /** columns/rows: quantidade de faixas */
  count: number;
  /** columns/rows: espaço entre as faixas */
  gutter: number;
  /** columns/rows: margem nas duas pontas */
  margin: number;
  /** grid: tamanho da célula. columns/rows com alinhamento ≠ stretch: largura/altura de cada faixa */
  size: number;
  alignment: 'stretch' | 'start' | 'center' | 'end';
  color: string;
  opacity: number;
}

export const newLayoutGrid = (kind: LayoutGrid['kind'] = 'columns'): LayoutGrid => ({
  id: `lg-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
  kind,
  visible: true,
  count: kind === 'grid' ? 0 : 12,
  gutter: 20,
  margin: 0,
  size: kind === 'grid' ? 10 : 80,
  alignment: 'stretch',
  color: kind === 'grid' ? '#808080' : '#FF3B30',
  opacity: kind === 'grid' ? 0.2 : 0.1,
});

export interface GridBand { start: number; size: number }

/** Faixas (x,largura) ou (y,altura) ao longo de um eixo de comprimento `length`, a partir de `origin` */
export function gridBands(g: LayoutGrid, origin: number, length: number): GridBand[] {
  const count = Math.max(1, Math.floor(g.count));
  const gutter = Math.max(0, g.gutter);
  const margin = Math.max(0, g.margin);
  if (g.alignment === 'stretch') {
    const size = (length - margin * 2 - gutter * (count - 1)) / count;
    if (size <= 0) return [];
    return Array.from({ length: count }, (_, i) => ({ start: origin + margin + i * (size + gutter), size }));
  }
  const size = Math.max(1, g.size);
  const total = size * count + gutter * (count - 1);
  const first =
    g.alignment === 'start' ? origin + margin : g.alignment === 'end' ? origin + length - margin - total : origin + (length - total) / 2;
  return Array.from({ length: count }, (_, i) => ({ start: first + i * (size + gutter), size }));
}

/** Posições de encaixe das grades visíveis do frame: x de cada borda das colunas e y de cada borda das linhas */
export function gridSnapLines(frame: Box, grids: LayoutGrid[]): { xs: number[]; ys: number[] } {
  const xs: number[] = [];
  const ys: number[] = [];
  for (const g of grids) {
    if (!g.visible) continue;
    if (g.kind === 'grid') {
      const step = Math.max(1, g.size);
      for (let x = frame.x; x <= frame.x + frame.width + 0.001; x += step) xs.push(x);
      for (let y = frame.y; y <= frame.y + frame.height + 0.001; y += step) ys.push(y);
    } else if (g.kind === 'columns') {
      for (const b of gridBands(g, frame.x, frame.width)) xs.push(b.start, b.start + b.size);
    } else {
      for (const b of gridBands(g, frame.y, frame.height)) ys.push(b.start, b.start + b.size);
    }
  }
  return { xs, ys };
}

/** Boxes finos (largura/altura 0) sobre as linhas de encaixe, prontos para o `computeSnap` */
export function gridSnapBoxes(frame: Box, grids: LayoutGrid[]): Box[] {
  const { xs, ys } = gridSnapLines(frame, grids);
  return [
    ...xs.map((x) => ({ x, y: frame.y, width: 0, height: frame.height })),
    ...ys.map((y) => ({ x: frame.x, y, width: frame.width, height: 0 })),
  ];
}
