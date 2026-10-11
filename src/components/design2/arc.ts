export interface ArcSpec {
  /** ângulo inicial em graus (0 = direita, cresce no sentido horário) */
  start?: number;
  /** ângulo final em graus */
  end?: number;
  /** raio interno como fração do externo (0 = fatia/pizza, > 0 = anel/donut) */
  inner?: number;
}

const f = (n: number) => Math.round(n * 100) / 100;
const rad = (d: number) => (d * Math.PI) / 180;

/** A elipse mudou do padrão (círculo inteiro e cheio)? */
export const hasArc = (a: ArcSpec): boolean => (a.start ?? 0) !== 0 || (a.end ?? 360) !== 360 || (a.inner ?? 0) > 0;

/**
 * Caminho SVG de uma elipse como arco, fatia ou anel. Anel completo usa dois círculos com `evenodd`
 * (use fillRule="evenodd" no elemento).
 */
export function ellipseArcPath(cx: number, cy: number, rx: number, ry: number, a: ArcSpec): string {
  const start = a.start ?? 0;
  const end = a.end ?? 360;
  const inner = Math.max(0, Math.min(0.99, a.inner ?? 0));
  const span = end - start;
  const full = Math.abs(span) >= 360;
  const irx = rx * inner;
  const iry = ry * inner;
  const circle = (x: number, y: number, r1: number, r2: number) => `M ${f(x - r1)} ${f(y)} A ${f(r1)} ${f(r2)} 0 1 0 ${f(x + r1)} ${f(y)} A ${f(r1)} ${f(r2)} 0 1 0 ${f(x - r1)} ${f(y)} Z`;
  if (full) return inner > 0 ? `${circle(cx, cy, rx, ry)} ${circle(cx, cy, irx, iry)}` : circle(cx, cy, rx, ry);
  const pt = (deg: number, kx: number, ky: number) => ({ x: cx + Math.cos(rad(deg)) * kx, y: cy + Math.sin(rad(deg)) * ky });
  const sweep = ((span % 360) + 360) % 360 || 360;
  const large = sweep > 180 ? 1 : 0;
  const a0 = pt(start, rx, ry);
  const a1 = pt(start + sweep, rx, ry);
  let d = `M ${f(a0.x)} ${f(a0.y)} A ${f(rx)} ${f(ry)} 0 ${large} 1 ${f(a1.x)} ${f(a1.y)}`;
  if (inner > 0) {
    const b1 = pt(start + sweep, irx, iry);
    const b0 = pt(start, irx, iry);
    d += ` L ${f(b1.x)} ${f(b1.y)} A ${f(irx)} ${f(iry)} 0 ${large} 0 ${f(b0.x)} ${f(b0.y)} Z`;
  } else {
    d += ` L ${f(cx)} ${f(cy)} Z`;
  }
  return d;
}
