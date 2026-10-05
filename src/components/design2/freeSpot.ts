import type { Shape } from './types';

/** Primeiro X livre (da esquerda para a direita) para uma área w×h, sem sobrepor frames/elementos de topo da página. */
export function findFreeSpot(shapes: Shape[], startX: number, startY: number, w: number, h: number, gap = 120): { x: number; y: number } {
  const roots = shapes.filter((s) => !s.parentId && s.visible !== false);
  let x = startX;
  for (let i = 0; i < 60; i++) {
    const hit = roots.find((r) => r.x < x + w && r.x + r.width > x && r.y < startY + h && r.y + r.height > startY);
    if (!hit) break;
    x = hit.x + hit.width + gap;
  }
  return { x, y: startY };
}
