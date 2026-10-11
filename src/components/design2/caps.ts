import type { Handles, Pt } from './vector';

export type CapKind = 'none' | 'arrow' | 'triangle' | 'circle' | 'diamond' | 'square' | 'bar';

export const CAP_LABEL: Record<CapKind, string> = {
  none: 'Nenhuma',
  arrow: 'Seta',
  triangle: 'Triângulo',
  circle: 'Círculo',
  diamond: 'Losango',
  square: 'Quadrado',
  bar: 'Barra',
};

export interface CapGeometry {
  /** caminho SVG da ponta, em coordenadas absolutas */
  d: string;
  /** true: preencher com a cor do traço; false: só contorno (seta aberta e barra) */
  filled: boolean;
}

const f = (n: number) => Math.round(n * 100) / 100;

/** Tamanho da ponta a partir da espessura do traço. */
export const capSize = (strokeWidth: number) => Math.max(8, strokeWidth * 4);

/**
 * Geometria da ponta na extremidade `tip`. `dir` é o vetor unitário que aponta para FORA da linha
 * (no fim, da linha para a ponta; no início, o oposto).
 */
export function capGeometry(kind: CapKind, tip: Pt, dir: Pt, size: number): CapGeometry | null {
  if (kind === 'none') return null;
  const nx = -dir.y; // normal
  const ny = dir.x;
  const P = (along: number, across: number): Pt => ({ x: tip.x + dir.x * along + nx * across, y: tip.y + dir.y * along + ny * across });
  const poly = (pts: Pt[], close = true) => `M ${pts.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')}${close ? ' Z' : ''}`;
  const h = size / 2;
  switch (kind) {
    case 'arrow':
      return { d: poly([P(-size, h), P(0, 0), P(-size, -h)], false), filled: false };
    case 'triangle':
      return { d: poly([P(0, 0), P(-size, h), P(-size, -h)]), filled: true };
    case 'diamond':
      return { d: poly([P(0, 0), P(-h, h * 0.8), P(-size, 0), P(-h, -h * 0.8)]), filled: true };
    case 'square':
      return { d: poly([P(0, h), P(-size, h), P(-size, -h), P(0, -h)]), filled: true };
    case 'bar':
      return { d: poly([P(0, h), P(0, -h)], false), filled: false };
    case 'circle': {
      const c = P(-h, 0);
      return { d: `M ${f(c.x - h)} ${f(c.y)} a ${h} ${h} 0 1 0 ${f(size)} 0 a ${h} ${h} 0 1 0 ${f(-size)} 0 Z`, filled: true };
    }
  }
}

const unit = (a: Pt, b: Pt): Pt => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
};

/** Direção para fora em cada extremidade de um caminho (nós + alças), a partir da tangente. */
export function pathEndDirections(points: Pt[], handles?: Handles): { start: Pt; end: Pt } | null {
  const n = points.length;
  if (n < 2) return null;
  const first = points[0];
  const last = points[n - 1];
  const outH = handles?.[0]?.out;
  const inH = handles?.[n - 1]?.in;
  const afterFirst = outH && (outH.x || outH.y) ? { x: first.x + outH.x, y: first.y + outH.y } : points[1];
  const beforeLast = inH && (inH.x || inH.y) ? { x: last.x + inH.x, y: last.y + inH.y } : points[n - 2];
  return { start: unit(afterFirst, first), end: unit(beforeLast, last) };
}
