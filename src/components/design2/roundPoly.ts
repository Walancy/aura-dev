export interface Pt {
  x: number;
  y: number;
}

const f = (n: number) => Math.round(n * 100) / 100;

/** "x,y x,y …" → pontos */
export const parsePoints = (s: string): Pt[] =>
  s.trim().split(/\s+/).map((p) => {
    const [x, y] = p.split(',').map(Number);
    return { x, y };
  });

/**
 * Caminho SVG de um polígono com os vértices arredondados (arcos tangentes às duas arestas).
 * O raio é limitado para não passar da metade da menor aresta vizinha. Raio ≤ 0 → undefined (use <polygon>).
 */
export function roundedPolygonPath(points: Pt[] | string, radius: number): string | undefined {
  const pts = typeof points === 'string' ? parsePoints(points) : points;
  const n = pts.length;
  if (radius <= 0 || n < 3) return undefined;
  const corners = pts.map((v, i) => {
    const p = pts[(i - 1 + n) % n];
    const q = pts[(i + 1) % n];
    const u1 = { x: p.x - v.x, y: p.y - v.y };
    const u2 = { x: q.x - v.x, y: q.y - v.y };
    const l1 = Math.hypot(u1.x, u1.y) || 1;
    const l2 = Math.hypot(u2.x, u2.y) || 1;
    const n1 = { x: u1.x / l1, y: u1.y / l1 };
    const n2 = { x: u2.x / l2, y: u2.y / l2 };
    const cos = Math.max(-1, Math.min(1, n1.x * n2.x + n1.y * n2.y));
    const angle = Math.acos(cos); // ângulo interno do vértice
    const tan = Math.tan(angle / 2) || 1e-6;
    // distância do vértice aos pontos de tangência, limitada a metade da aresta mais curta
    const t = Math.min(radius / tan, l1 / 2, l2 / 2);
    const r = t * tan;
    const cross = n1.x * n2.y - n1.y * n2.x;
    return { a: { x: v.x + n1.x * t, y: v.y + n1.y * t }, b: { x: v.x + n2.x * t, y: v.y + n2.y * t }, r, sweep: cross < 0 ? 1 : 0 };
  });
  let d = '';
  corners.forEach((c, i) => {
    d += `${i === 0 ? 'M' : ' L'} ${f(c.a.x)} ${f(c.a.y)} A ${f(c.r)} ${f(c.r)} 0 0 ${c.sweep} ${f(c.b.x)} ${f(c.b.y)}`;
  });
  return `${d} Z`;
}
