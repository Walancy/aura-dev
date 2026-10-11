export interface Pt {
  x: number;
  y: number;
}

/** Alças de um nó, como deslocamentos a partir do nó (`in` chega ao nó, `out` sai dele). */
export interface Handle {
  in?: Pt;
  out?: Pt;
}

export type Handles = Array<Handle | null | undefined>;

const f = (n: number) => Math.round(n * 100) / 100;
const add = (a: Pt, b?: Pt): Pt => (b ? { x: a.x + b.x, y: a.y + b.y } : a);
const lerp = (a: Pt, b: Pt, t: number): Pt => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });

interface Seg {
  a: Pt;
  b: Pt;
  c1?: Pt;
  c2?: Pt;
}

/** Segmentos do caminho: reta ou cúbica (quando algum dos nós tem alça; `smooth` usa Catmull-Rom nos trechos sem alça). */
function segments(points: Pt[], handles: Handles | undefined, closed: boolean, smooth: boolean): Seg[] {
  const n = points.length;
  const out: Seg[] = [];
  const count = closed && n > 2 ? n : n - 1;
  for (let i = 0; i < count; i++) {
    const j = (i + 1) % n;
    const a = points[i];
    const b = points[j];
    const ho = handles?.[i]?.out;
    const hi = handles?.[j]?.in;
    if (ho || hi) {
      out.push({ a, b, c1: add(a, ho), c2: add(b, hi) });
    } else if (smooth && n >= 3) {
      const p0 = points[(i - 1 + n) % n] && (closed || i > 0) ? points[(i - 1 + n) % n] : a;
      const p3 = closed || j + 1 < n ? points[(j + 1) % n] : b;
      out.push({ a, b, c1: { x: a.x + (b.x - p0.x) / 6, y: a.y + (b.y - p0.y) / 6 }, c2: { x: b.x - (p3.x - a.x) / 6, y: b.y - (p3.y - a.y) / 6 } });
    } else out.push({ a, b });
  }
  return out;
}

/** Caminho SVG de um vetor (nós + alças). Com `closed`, fecha com Z. */
export function pathFromVector(points: Pt[], handles?: Handles, closed = false, smooth = false): string {
  if (points.length === 0) return '';
  let d = `M ${f(points[0].x)} ${f(points[0].y)}`;
  const segs = segments(points, handles, closed, smooth);
  segs.forEach((s, i) => {
    if (closed && i === segs.length - 1 && !s.c1) return; // o Z já fecha com uma reta
    d += s.c1 && s.c2 ? ` C ${f(s.c1.x)} ${f(s.c1.y)} ${f(s.c2.x)} ${f(s.c2.y)} ${f(s.b.x)} ${f(s.b.y)}` : ` L ${f(s.b.x)} ${f(s.b.y)}`;
  });
  return closed && points.length > 2 ? `${d} Z` : d;
}

const cubicAt = (s: Seg, t: number): Pt => {
  if (!s.c1 || !s.c2) return lerp(s.a, s.b, t);
  const u = 1 - t;
  return {
    x: u * u * u * s.a.x + 3 * u * u * t * s.c1.x + 3 * u * t * t * s.c2.x + t * t * t * s.b.x,
    y: u * u * u * s.a.y + 3 * u * u * t * s.c1.y + 3 * u * t * t * s.c2.y + t * t * t * s.b.y,
  };
};

/** Caixa que contém a curva inteira (não só os nós). */
export function bboxOfVector(points: Pt[], handles?: Handles, closed = false, smooth = false): { x: number; y: number; width: number; height: number } {
  if (points.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const take = (p: Pt) => {
    minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
  };
  points.forEach(take);
  for (const s of segments(points, handles, closed, smooth)) {
    if (s.c1) for (let k = 1; k < 32; k++) take(cubicAt(s, k / 32));
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
}

/** Define uma alça de um nó. Espelhada por padrão (a oposta fica simétrica); `independent` mexe só nela. */
export function setHandle(handles: Handles | undefined, count: number, index: number, which: 'in' | 'out', offset: Pt, independent = false): Handles {
  const out: Handles = Array.from({ length: count }, (_, i) => (handles?.[i] ? { ...handles[i]! } : undefined));
  const h = { ...(out[index] || {}) };
  h[which] = offset;
  if (!independent) h[which === 'in' ? 'out' : 'in'] = { x: -offset.x, y: -offset.y };
  out[index] = h;
  return out;
}

/** Segmento mais próximo de `p` (índice do nó de partida e parâmetro t) — para inserir um nó na curva. */
export function nearestSegment(points: Pt[], handles: Handles | undefined, closed: boolean, p: Pt, smooth = false): { index: number; t: number; dist: number } | null {
  const segs = segments(points, handles, closed, smooth);
  let best: { index: number; t: number; dist: number } | null = null;
  segs.forEach((s, i) => {
    for (let k = 0; k <= 40; k++) {
      const t = k / 40;
      const q = cubicAt(s, t);
      const dist = Math.hypot(q.x - p.x, q.y - p.y);
      if (!best || dist < best.dist) best = { index: i, t, dist };
    }
  });
  return best;
}

/** Insere um nó no segmento `index` em `t`, preservando a forma da curva (de Casteljau). */
export function splitSegment(points: Pt[], handles: Handles | undefined, closed: boolean, index: number, t: number, smooth = false): { points: Pt[]; handles: Handles } {
  const seg = segments(points, handles, closed, smooth)[index];
  const n = points.length;
  const j = (index + 1) % n;
  const newPts = [...points.slice(0, index + 1), undefined as unknown as Pt, ...points.slice(index + 1)];
  const newHandles: Handles = Array.from({ length: n + 1 }, (_, i) => {
    if (i <= index) return handles?.[i] ? { ...handles[i]! } : undefined;
    if (i === index + 1) return undefined;
    return handles?.[i - 1] ? { ...handles[i - 1]! } : undefined;
  });
  if (!seg.c1 || !seg.c2) {
    newPts[index + 1] = lerp(seg.a, seg.b, t);
  } else {
    const p01 = lerp(seg.a, seg.c1, t), p12 = lerp(seg.c1, seg.c2, t), p23 = lerp(seg.c2, seg.b, t);
    const p012 = lerp(p01, p12, t), p123 = lerp(p12, p23, t);
    const m = lerp(p012, p123, t);
    newPts[index + 1] = m;
    newHandles[index] = { ...(newHandles[index] || {}), out: { x: p01.x - seg.a.x, y: p01.y - seg.a.y } };
    newHandles[index + 1] = { in: { x: p012.x - m.x, y: p012.y - m.y }, out: { x: p123.x - m.x, y: p123.y - m.y } };
    const jj = j <= index ? j : j + 1; // nó de chegada (no fechamento é o primeiro)
    newHandles[jj] = { ...(newHandles[jj] || {}), in: { x: p23.x - seg.b.x, y: p23.y - seg.b.y } };
  }
  return { points: newPts, handles: newHandles };
}

/** Remove um nó (e a alça dele). */
export function removeNode(points: Pt[], handles: Handles | undefined, index: number): { points: Pt[]; handles: Handles } {
  return { points: points.filter((_, i) => i !== index), handles: (handles || []).filter((_, i) => i !== index) };
}

/** Alterna o nó entre canto (sem alças) e suave (alças espelhadas na direção dos vizinhos). */
export function toggleNodeSmooth(points: Pt[], handles: Handles | undefined, index: number, closed = false): Handles {
  const n = points.length;
  const out: Handles = Array.from({ length: n }, (_, i) => (handles?.[i] ? { ...handles[i]! } : undefined));
  const h = out[index];
  if (h && (h.in || h.out)) {
    out[index] = undefined;
    return out;
  }
  const prev = points[index - 1] ?? (closed ? points[n - 1] : points[index]);
  const next = points[index + 1] ?? (closed ? points[0] : points[index]);
  const o = { x: (next.x - prev.x) / 6, y: (next.y - prev.y) / 6 };
  out[index] = { out: o, in: { x: -o.x, y: -o.y } };
  return out;
}

/** Amostra o caminho em pontos (cada curva em `perSeg` passos), para operações geométricas. */
export function flattenVector(points: Pt[], handles?: Handles, closed = false, smooth = false, perSeg = 16): Pt[] {
  if (points.length === 0) return [];
  const out: Pt[] = [points[0]];
  for (const s of segments(points, handles, closed, smooth)) {
    if (!s.c1) out.push(s.b);
    else for (let k = 1; k <= perSeg; k++) out.push(cubicAt(s, k / perSeg));
  }
  // caminho fechado: o último ponto repete o primeiro
  if (closed && out.length > 1 && Math.hypot(out[0].x - out[out.length - 1].x, out[0].y - out[out.length - 1].y) < 1e-6) out.pop();
  return out;
}
