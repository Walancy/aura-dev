import type { Box, GapMark } from './snap';

/**
 * Distâncias entre dois boxes, como as linhas vermelhas do Figma ao segurar Alt:
 * boxes separados → vão entre as bordas mais próximas; um dentro do outro (ou cruzados) → distância de cada borda.
 */
export function measureBetween(a: Box, b: Box): GapMark[] {
  const marks: GapMark[] = [];
  const ax2 = a.x + a.width, ay2 = a.y + a.height, bx2 = b.x + b.width, by2 = b.y + b.height;
  const xo = Math.min(ax2, bx2) - Math.max(a.x, b.x);
  const yo = Math.min(ay2, by2) - Math.max(a.y, b.y);
  const midY = yo > 0 ? Math.max(a.y, b.y) + yo / 2 : a.y + a.height / 2;
  const midX = xo > 0 ? Math.max(a.x, b.x) + xo / 2 : a.x + a.width / 2;
  const add = (axis: 'x' | 'y', p: number, q: number, cross: number) => {
    const value = Math.abs(q - p);
    if (value > 0.001) marks.push({ axis, from: Math.min(p, q), to: Math.max(p, q), cross, value });
  };
  // horizontal
  if (ax2 <= b.x) add('x', ax2, b.x, midY);
  else if (bx2 <= a.x) add('x', bx2, a.x, midY);
  else {
    add('x', a.x, b.x, midY);
    add('x', ax2, bx2, midY);
  }
  // vertical
  if (ay2 <= b.y) add('y', ay2, b.y, midX);
  else if (by2 <= a.y) add('y', by2, a.y, midX);
  else {
    add('y', a.y, b.y, midX);
    add('y', ay2, by2, midX);
  }
  return marks;
}
