import type { Pt } from './vector';

export type WidthProfile = 'uniform' | 'taper-end' | 'taper-start' | 'lens' | 'dumbbell';

export const WIDTH_PROFILE_LABEL: Record<WidthProfile, string> = {
  uniform: 'Uniforme',
  'taper-end': 'Afinar no fim',
  'taper-start': 'Afinar no início',
  lens: 'Fino-grosso-fino',
  dumbbell: 'Grosso-fino-grosso',
};

/** Fator de largura (0..1) ao longo do caminho, com t de 0 a 1. */
export function profileAt(profile: WidthProfile, t: number): number {
  switch (profile) {
    case 'taper-end':
      return Math.max(0.04, 1 - t);
    case 'taper-start':
      return Math.max(0.04, t);
    case 'lens':
      return Math.max(0.04, Math.sin(Math.PI * t));
    case 'dumbbell':
      return 0.25 + 0.75 * Math.abs(Math.cos(Math.PI * t));
    default:
      return 1;
  }
}

const f = (n: number) => Math.round(n * 100) / 100;

/**
 * Traço de largura variável como polígono preenchido: percorre o caminho (já amostrado em pontos) e abre
 * `width * profile(t)` para cada lado da tangente. t é a distância percorrida / comprimento total.
 */
export function variableWidthPath(points: Pt[], width: number, profile: WidthProfile): string | undefined {
  const n = points.length;
  if (n < 2 || width <= 0) return undefined;
  const dist = [0];
  for (let i = 1; i < n; i++) dist.push(dist[i - 1] + Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y));
  const total = dist[n - 1] || 1;
  const left: Pt[] = [];
  const right: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    const nx = -(b.y - a.y) / l;
    const ny = (b.x - a.x) / l;
    const hw = (width * profileAt(profile, dist[i] / total)) / 2;
    left.push({ x: points[i].x + nx * hw, y: points[i].y + ny * hw });
    right.push({ x: points[i].x - nx * hw, y: points[i].y - ny * hw });
  }
  const all = [...left, ...right.reverse()];
  return `M ${all.map((p) => `${f(p.x)} ${f(p.y)}`).join(' L ')} Z`;
}
