import type { FillItem, GradientStop } from './types';

export const isGradientFill = (f: Pick<FillItem, 'type' | 'gradientStops'>): boolean =>
  (f.type === 'linear' || f.type === 'radial' || f.type === 'angular' || f.type === 'diamond') && Array.isArray(f.gradientStops) && f.gradientStops.length >= 2;

/** Linear/radial têm gradiente SVG nativo; angular e diamante são desenhados com CSS dentro do shape. */
export const isHtmlGradient = (f: Pick<FillItem, 'type'>): boolean => f.type === 'angular' || f.type === 'diamond';

/** Dois stops que partem da cor atual (a segunda transparente), como no Figma. */
export function defaultGradientStops(color: string, opacity = 1): GradientStop[] {
  return [
    { position: 0, color, opacity },
    { position: 1, color, opacity: 0 },
  ];
}

/** Caminho SVG passando por todos os pontos; com `smooth`, curvas Catmull-Rom convertidas em Bézier cúbicas. */
export function pathFromPoints(points: Array<{ x: number; y: number }>, smooth = false): string {
  if (points.length === 0) return '';
  const f = (n: number) => Math.round(n * 100) / 100;
  if (!smooth || points.length < 3) return `M ${points.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')}`;
  let d = `M ${f(points[0].x)} ${f(points[0].y)}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${f(c1.x)} ${f(c1.y)} ${f(c2.x)} ${f(c2.y)} ${f(p2.x)} ${f(p2.y)}`;
  }
  return d;
}

export const sortStops = (stops: GradientStop[]): GradientStop[] => [...stops].sort((a, b) => a.position - b.position);

/** Vetor do gradiente linear em coordenadas objectBoundingBox (0..1) para um ângulo CSS. */
export function linearVector(angleDeg: number) {
  const phi = ((angleDeg - 90) * Math.PI) / 180;
  const dx = Math.cos(phi);
  const dy = Math.sin(phi);
  return { x1: 0.5 - dx / 2, y1: 0.5 - dy / 2, x2: 0.5 + dx / 2, y2: 0.5 + dy / 2 };
}

/** CSS equivalente (miniaturas e prévias no seletor). */
export function cssGradient(f: Pick<FillItem, 'type' | 'gradientStops' | 'gradientAngle' | 'gradientCenter' | 'gradientRadius'>, forceAngle?: number): string {
  const stops = sortStops(f.gradientStops || [])
    .map((s) => `${hexWithAlpha(s.color, s.opacity)} ${Math.round(s.position * 100)}%`)
    .join(', ');
  if (f.type === 'radial') return `radial-gradient(circle at ${Math.round((f.gradientCenter?.x ?? 0.5) * 100)}% ${Math.round((f.gradientCenter?.y ?? 0.5) * 100)}%, ${stops})`;
  if (f.type === 'angular') return `conic-gradient(from ${forceAngle ?? f.gradientAngle ?? 0}deg at 50% 50%, ${stops})`;
  if (f.type === 'diamond') {
    // quatro quadrantes saindo do centro para os cantos formam o losango
    return [
      ['to top left', 'top left'],
      ['to top right', 'top right'],
      ['to bottom left', 'bottom left'],
      ['to bottom right', 'bottom right'],
    ]
      .map(([dir, pos]) => `linear-gradient(${dir}, ${stops}) ${pos} / 50% 50% no-repeat`)
      .join(', ');
  }
  return `linear-gradient(${forceAngle ?? f.gradientAngle ?? 90}deg, ${stops})`;
}

export function hexWithAlpha(hex: string, alpha: number): string {
  const clean = (hex || '#000000').replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean.padEnd(6, '0');
  const r = parseInt(full.slice(0, 2), 16) || 0;
  const g = parseInt(full.slice(2, 4), 16) || 0;
  const b = parseInt(full.slice(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, alpha))})`;
}
