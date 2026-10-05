export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Guide {
  axis: 'x' | 'y'; // 'x' = linha vertical em x=pos; 'y' = linha horizontal em y=pos
  pos: number;
  from: number;
  to: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
}

const xs = (b: Box) => [b.x, b.x + b.width / 2, b.x + b.width];
const ys = (b: Box) => [b.y, b.y + b.height / 2, b.y + b.height];

/**
 * Encaixa `moving` nas bordas/centros dos outros boxes (e na grade, se `grid` > 0) dentro de `threshold`.
 * Retorna o deslocamento a aplicar e as guias a desenhar.
 */
export function computeSnap(moving: Box, others: Box[], threshold: number, grid = 0): SnapResult {
  let bestDx: number | null = null;
  let bestDy: number | null = null;
  let xTarget: { pos: number; other?: Box } | null = null;
  let yTarget: { pos: number; other?: Box } | null = null;

  for (const o of others) {
    for (const mx of xs(moving)) {
      for (const ox of xs(o)) {
        const d = ox - mx;
        if (Math.abs(d) <= threshold && (bestDx === null || Math.abs(d) < Math.abs(bestDx))) {
          bestDx = d;
          xTarget = { pos: ox, other: o };
        }
      }
    }
    for (const my of ys(moving)) {
      for (const oy of ys(o)) {
        const d = oy - my;
        if (Math.abs(d) <= threshold && (bestDy === null || Math.abs(d) < Math.abs(bestDy))) {
          bestDy = d;
          yTarget = { pos: oy, other: o };
        }
      }
    }
  }

  if (grid > 0) {
    if (bestDx === null) {
      const d = Math.round(moving.x / grid) * grid - moving.x;
      if (Math.abs(d) <= threshold) bestDx = d;
    }
    if (bestDy === null) {
      const d = Math.round(moving.y / grid) * grid - moving.y;
      if (Math.abs(d) <= threshold) bestDy = d;
    }
  }

  const dx = bestDx ?? 0;
  const dy = bestDy ?? 0;
  const snapped: Box = { ...moving, x: moving.x + dx, y: moving.y + dy };
  const guides: Guide[] = [];
  if (xTarget) {
    const o = xTarget.other!;
    guides.push({ axis: 'x', pos: xTarget.pos, from: Math.min(snapped.y, o.y), to: Math.max(snapped.y + snapped.height, o.y + o.height) });
  }
  if (yTarget) {
    const o = yTarget.other!;
    guides.push({ axis: 'y', pos: yTarget.pos, from: Math.min(snapped.x, o.x), to: Math.max(snapped.x + snapped.width, o.x + o.width) });
  }
  return { dx, dy, guides };
}

/** União dos boxes. */
export function unionBox(boxes: Box[]): Box {
  const minX = Math.min(...boxes.map((b) => b.x));
  const minY = Math.min(...boxes.map((b) => b.y));
  const maxX = Math.max(...boxes.map((b) => b.x + b.width));
  const maxY = Math.max(...boxes.map((b) => b.y + b.height));
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Passo "bonito" das réguas conforme o zoom (1, 2, 5 × 10^n em unidades do canvas, ~80px na tela). */
export function rulerStep(zoom: number): number {
  const target = 80 / Math.max(zoom, 0.001);
  const pow = Math.pow(10, Math.floor(Math.log10(target)));
  for (const m of [1, 2, 5, 10]) if (pow * m >= target) return pow * m;
  return pow * 10;
}
