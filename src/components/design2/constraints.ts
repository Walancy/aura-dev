import type { Shape } from './types';
import type { Box } from './snap';

export type ResizePatch = Partial<Shape>;

function axis(
  start: number,
  size: number,
  oStart: number,
  oSize: number,
  nStart: number,
  nSize: number,
  mode: 'start' | 'end' | 'center' | 'stretch' | 'scale'
): { start: number; size: number } {
  const gapA = start - oStart; // distância até a borda inicial do pai
  const gapB = oStart + oSize - (start + size); // distância até a borda final
  switch (mode) {
    case 'end':
      return { start: nStart + nSize - gapB - size, size };
    case 'center':
      return { start: nStart + nSize / 2 + (start + size / 2 - (oStart + oSize / 2)) - size / 2, size };
    case 'stretch':
      return { start: nStart + gapA, size: Math.max(1, nSize - gapA - gapB) };
    case 'scale': {
      const k = oSize === 0 ? 1 : nSize / oSize;
      return { start: nStart + gapA * k, size: size * k };
    }
    default:
      return { start: nStart + gapA, size };
  }
}

/**
 * Calcula os novos retângulos dos descendentes quando o pai passa de `parentOld` para `parentNew`.
 * - 'constraints': cada filho segue suas restrições (padrão: esquerda/topo).
 * - 'scale': tudo escala proporcionalmente (ferramenta Escala), incluindo fonte, traço e raio.
 */
export function resizeDescendants(
  all: Shape[],
  parentId: string,
  parentOld: Box,
  parentNew: Box,
  mode: 'constraints' | 'scale'
): Map<string, ResizePatch> {
  const out = new Map<string, ResizePatch>();
  const visit = (pid: string, oBox: Box, nBox: Box) => {
    for (const c of all) {
      if (c.parentId !== pid) continue;
      let h: { start: number; size: number };
      let v: { start: number; size: number };
      if (mode === 'scale') {
        h = axis(c.x, c.width, oBox.x, oBox.width, nBox.x, nBox.width, 'scale');
        v = axis(c.y, c.height, oBox.y, oBox.height, nBox.y, nBox.height, 'scale');
      } else {
        h = axis(c.x, c.width, oBox.x, oBox.width, nBox.x, nBox.width, c.constraintH || 'start');
        v = axis(c.y, c.height, oBox.y, oBox.height, nBox.y, nBox.height, c.constraintV || 'start');
      }
      const patch: ResizePatch = { x: h.start, y: v.start, width: h.size, height: v.size };
      if (mode === 'scale') {
        const kx = c.width === 0 ? 1 : h.size / c.width;
        const ky = c.height === 0 ? 1 : v.size / c.height;
        const k = (kx + ky) / 2;
        if (c.fontSize) patch.fontSize = Math.max(1, Math.round(c.fontSize * k * 10) / 10);
        if (c.strokeWidth) patch.strokeWidth = Math.round(c.strokeWidth * k * 100) / 100;
        if (c.cornerRadius) patch.cornerRadius = Math.round(c.cornerRadius * Math.min(kx, ky));
      }
      if (c.points && c.points.length > 0) {
        const kx = c.width === 0 ? 1 : h.size / c.width;
        const ky = c.height === 0 ? 1 : v.size / c.height;
        patch.points = c.points.map((pt) => ({ x: h.start + (pt.x - c.x) * kx, y: v.start + (pt.y - c.y) * ky }));
      }
      out.set(c.id, patch);
      visit(c.id, { x: c.x, y: c.y, width: c.width, height: c.height }, { x: h.start, y: v.start, width: h.size, height: v.size });
    }
  };
  visit(parentId, parentOld, parentNew);
  return out;
}

/** Ids do shape e de todos os descendentes. */
export function descendantIds(all: Shape[], id: string): string[] {
  const out: string[] = [];
  const queue = [id];
  while (queue.length) {
    const cur = queue.shift()!;
    for (const s of all) if (s.parentId === cur) {
      out.push(s.id);
      queue.push(s.id);
    }
  }
  return out;
}
