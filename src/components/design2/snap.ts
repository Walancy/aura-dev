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

/** Segmento de medida de espaçamento: axis 'x' = linha horizontal de `from` a `to` na altura `cross` */
export interface GapMark {
  axis: 'x' | 'y';
  from: number;
  to: number;
  cross: number;
  value: number;
}

export interface SnapResult {
  dx: number;
  dy: number;
  guides: Guide[];
  gaps?: GapMark[];
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

  let gapMarks: GapMark[] = [];
  if (bestDx === null || bestDy === null) {
    const g = computeGapSnap({ ...moving, y: moving.y + (bestDy ?? 0) }, others, threshold, bestDx === null, bestDy === null);
    if (g.dx !== 0) bestDx = g.dx;
    if (g.dy !== 0) bestDy = g.dy;
    gapMarks = g.gaps;
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
  return { dx, dy, guides, gaps: gapMarks.length ? gapMarks : undefined };
}

const transpose = (b: Box): Box => ({ x: b.y, y: b.x, width: b.height, height: b.width });

/**
 * Encaixe por espaçamento igual no eixo x: o box encosta a esquerda a um vão já existente entre os vizinhos
 * (depois de um box, antes de um box) ou se centraliza entre dois boxes. Só considera boxes que se sobrepõem na vertical.
 */
function gapSnapX(moving: Box, others: Box[], threshold: number): { dx: number; marks: GapMark[] } | null {
  const row = others
    .filter((o) => Math.min(o.y + o.height, moving.y + moving.height) - Math.max(o.y, moving.y) > 0)
    .sort((a, b) => a.x - b.x);
  if (row.length < 2) return null;
  const pairs: Array<{ a: Box; b: Box; gap: number }> = [];
  for (let i = 0; i < row.length - 1; i++) {
    const gap = row[i + 1].x - (row[i].x + row[i].width);
    if (gap > 0) pairs.push({ a: row[i], b: row[i + 1], gap });
  }
  if (!pairs.length) return null;
  const mid = (a: Box, b: Box) => {
    const top = Math.max(a.y, b.y, moving.y);
    return top + (Math.min(a.y + a.height, b.y + b.height, moving.y + moving.height) - top) / 2;
  };
  let best: { x: number; marks: GapMark[] } | null = null;
  const consider = (x: number, marks: GapMark[]) => {
    if (Math.abs(x - moving.x) <= threshold && (!best || Math.abs(x - moving.x) < Math.abs(best.x - moving.x))) best = { x, marks };
  };
  for (const ref of pairs) {
    const refMark: GapMark = { axis: 'x', from: ref.a.x + ref.a.width, to: ref.b.x, cross: mid(ref.a, ref.b), value: ref.gap };
    for (const o of row) {
      // depois do box o (mesmo vão do par de referência) e antes dele
      const xr = o.x + o.width + ref.gap;
      consider(xr, [refMark, { axis: 'x', from: o.x + o.width, to: xr, cross: mid(o, moving), value: ref.gap }]);
      const xl = o.x - ref.gap - moving.width;
      consider(xl, [refMark, { axis: 'x', from: xl + moving.width, to: o.x, cross: mid(o, moving), value: ref.gap }]);
    }
  }
  // centralizado entre dois boxes vizinhos: vãos iguais dos dois lados
  for (const pr of pairs) {
    if (pr.gap > moving.width) {
      const g = (pr.gap - moving.width) / 2;
      const x = pr.a.x + pr.a.width + g;
      consider(x, [
        { axis: 'x', from: pr.a.x + pr.a.width, to: x, cross: mid(pr.a, moving), value: g },
        { axis: 'x', from: x + moving.width, to: pr.b.x, cross: mid(pr.b, moving), value: g },
      ]);
    }
  }
  const r = best as { x: number; marks: GapMark[] } | null;
  return r ? { dx: r.x - moving.x, marks: r.marks } : null;
}

/** Encaixe por espaçamento igual nos dois eixos (só nos eixos em que `needX`/`needY` forem verdadeiros). */
export function computeGapSnap(moving: Box, others: Box[], threshold: number, needX = true, needY = true): { dx: number; dy: number; gaps: GapMark[] } {
  let dx = 0;
  let dy = 0;
  const gaps: GapMark[] = [];
  if (needX) {
    const r = gapSnapX(moving, others, threshold);
    if (r) { dx = r.dx; gaps.push(...r.marks); }
  }
  if (needY) {
    const r = gapSnapX(transpose({ ...moving, x: moving.x + dx }), others.map(transpose), threshold);
    if (r) {
      dy = r.dx;
      gaps.push(...r.marks.map((m) => ({ ...m, axis: 'y' as const })));
    }
  }
  return { dx, dy, gaps };
}

/** Encaixe em pixels inteiros: arredonda as bordas (o tamanho nunca fica abaixo de 1). */
export function roundBoxToPixels(b: Box): Box {
  const x = Math.round(b.x);
  const y = Math.round(b.y);
  return { x, y, width: Math.max(1, Math.round(b.x + b.width) - x), height: Math.max(1, Math.round(b.y + b.height) - y) };
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
