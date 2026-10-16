/** Formas prontas para recortar uma imagem (máscara): caminhos SVG numa caixa 100x100, na ordem de uma curva fechada suave. */

/** Curva fechada suave (Catmull-Rom -> Bézier cúbica) passando por `pts`, em coordenadas 0–100. */
function smooth(pts: Array<[number, number]>): string {
  const n = pts.length;
  const f = (v: number) => Math.round(v * 100) / 100;
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    d += `C${f(p1[0] + (p2[0] - p0[0]) / 6)} ${f(p1[1] + (p2[1] - p0[1]) / 6)} ${f(p2[0] - (p3[0] - p1[0]) / 6)} ${f(p2[1] - (p3[1] - p1[1]) / 6)} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d + 'Z';
}

const polar = (r: (a: number) => number, count: number): Array<[number, number]> =>
  Array.from({ length: count }, (_, i) => { const a = (i / count) * Math.PI * 2 - Math.PI / 2; const rr = r(a); return [50 + rr * Math.cos(a), 50 + rr * Math.sin(a)] as [number, number]; });

export const MASK_NAMES = ['circle', 'squircle', 'flower', 'blob', 'star', 'heart', 'arch', 'drop', 'hexagon'] as const;

/** Caminho (caixa 100x100) de uma forma pronta: flor (pétalas 4–16 e `depth` 0.1–0.4 = profundidade), blob, estrela etc. */
export function maskPathOf(name: string, opts: { petals?: number; depth?: number } = {}): string | undefined {
  switch (name.toLowerCase()) {
    case 'circle': return 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z';
    case 'squircle': return smooth(polar((a) => 50 / Math.pow(Math.abs(Math.cos(a)) ** 4 + Math.abs(Math.sin(a)) ** 4, 1 / 4), 32));
    case 'flower': {
      const n = Math.max(4, Math.min(16, Math.round(opts.petals ?? 8)));
      const depth = Math.max(0.08, Math.min(0.45, opts.depth ?? 0.24));
      return smooth(polar((a) => 50 * (1 - depth + depth * Math.cos(n * (a + Math.PI / 2))), n * 8));
    }
    case 'blob': return smooth(polar((a) => 50 * (0.8 + 0.09 * Math.cos(3 * a + 1) + 0.06 * Math.cos(5 * a + 2) + 0.05 * Math.cos(2 * a)), 40));
    case 'star': {
      const n = Math.max(4, Math.min(12, Math.round(opts.petals ?? 5)));
      return smooth(polar((a) => { const k = Math.cos((n * (a + Math.PI / 2)) / 2); return 50 * (0.56 + 0.44 * (k * k) ** 0.9); }, n * 12));
    }
    case 'heart': {
      const pts: Array<[number, number]> = Array.from({ length: 48 }, (_, i) => {
        const t = (i / 48) * Math.PI * 2;
        const x = 16 * Math.sin(t) ** 3;
        const y = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
        return [50 + (x / 17) * 50, 52 + (y / 17) * 50 * 0.95];
      });
      return smooth(pts);
    }
    case 'arch': return 'M0 100V50A50 50 0 0 1 100 50V100Z';
    case 'drop': return smooth(polar((a) => 50 * (0.74 + 0.26 * Math.cos(a + Math.PI / 2) ** 3 * (Math.sin(a) < 0 ? 1.0 : 0.2)), 40));
    case 'hexagon': return smooth(polar((a) => 50 * (0.9 + 0.1 * Math.cos(6 * (a + Math.PI / 2))), 36));
    default: return undefined;
  }
}
