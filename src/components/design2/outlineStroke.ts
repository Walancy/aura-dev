import polygonClipping from 'polygon-clipping';
import type { Shape } from './types';
import { ringsToPathData, shapeToRing } from './booleanOps';
import { flattenVector, type Pt } from './vector';

type Ring = Array<[number, number]>;
type MultiPolygon = Array<Array<Ring>>;

export interface OutlineOptions {
  cap?: 'round' | 'butt' | 'square';
  join?: 'round' | 'miter' | 'bevel';
}

const CIRCLE_STEPS = 20;

// coordenadas na grade de 0,01: evita quase-coincidências que fazem o polygon-clipping falhar
const snap = (n: number) => Math.round(n * 100) / 100;

const circle = (c: Pt, r: number): Ring =>
  Array.from({ length: CIRCLE_STEPS }, (_, i) => {
    const a = (i / CIRCLE_STEPS) * Math.PI * 2;
    return [snap(c.x + r * Math.cos(a)), snap(c.y + r * Math.sin(a))] as [number, number];
  });

/**
 * Contorno do traço de uma polilinha como polígono(s): união de um retângulo por segmento,
 * mais círculos nas pontas/quinas (round) ou chanfros (bevel/miter). Miter é tratado como bevel.
 */
export function strokeToMulti(points: Pt[], width: number, closed: boolean, opts: OutlineOptions = {}): MultiPolygon | null {
  const cap = opts.cap ?? 'round';
  const join = opts.join ?? 'round';
  const h = width / 2;
  const n = points.length;
  if (n < 2 || width <= 0) return null;
  const count = closed ? n : n - 1;
  const parts: MultiPolygon[] = [];
  const dir = (a: Pt, b: Pt): Pt => {
    const l = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    return { x: (b.x - a.x) / l, y: (b.y - a.y) / l };
  };
  for (let i = 0; i < count; i++) {
    const a = points[i];
    const b = points[(i + 1) % n];
    const d = dir(a, b);
    const nx = -d.y * h;
    const ny = d.x * h;
    // cap quadrado: estende as pontas do caminho aberto em h
    const ea = !closed && cap === 'square' && i === 0 ? { x: -d.x * h, y: -d.y * h } : { x: 0, y: 0 };
    const eb = !closed && cap === 'square' && i === count - 1 ? { x: d.x * h, y: d.y * h } : { x: 0, y: 0 };
    parts.push([[[[snap(a.x + nx + ea.x), snap(a.y + ny + ea.y)], [snap(b.x + nx + eb.x), snap(b.y + ny + eb.y)], [snap(b.x - nx + eb.x), snap(b.y - ny + eb.y)], [snap(a.x - nx + ea.x), snap(a.y - ny + ea.y)]]]] as unknown as MultiPolygon);
  }
  // quinas
  for (let i = 0; i < n; i++) {
    const interior = closed || (i > 0 && i < n - 1);
    const v = points[i];
    if (interior) {
      if (join === 'round') parts.push([[circle(v, h)]]);
      else {
        const p = points[(i - 1 + n) % n];
        const q = points[(i + 1) % n];
        const d1 = dir(p, v);
        const d2 = dir(v, q);
        for (const sgn of [1, -1]) {
          parts.push([[[[snap(v.x), snap(v.y)], [snap(v.x - d1.y * h * sgn), snap(v.y + d1.x * h * sgn)], [snap(v.x - d2.y * h * sgn), snap(v.y + d2.x * h * sgn)]]]] as unknown as MultiPolygon);
        }
      }
    } else if (cap === 'round') parts.push([[circle(v, h)]]);
  }
  // une em sequência (acumulando): mais estável que uma união única de dezenas de peças
  let acc: MultiPolygon = parts[0];
  for (let i = 1; i < parts.length; i++) {
    try {
      acc = polygonClipping.union(acc as any, parts[i] as any) as MultiPolygon;
    } catch {
      // peça degenerada: ignora só ela
    }
  }
  return acc.length ? acc : null;
}

/** Polilinha que representa o traço do shape (centro do traço). */
export function strokePolyline(s: Shape): { points: Pt[]; closed: boolean } | null {
  if ((s.type === 'pen' || s.type === 'pencil') && s.points && s.points.length >= 2) {
    return { points: flattenVector(s.points, s.pathHandles, !!s.closed, !!s.smooth), closed: !!s.closed };
  }
  if (s.type === 'line' || s.type === 'arrow') return { points: [{ x: s.x, y: s.y }, { x: s.x + s.width, y: s.y + s.height }], closed: false };
  const ring = shapeToRing(s);
  return ring ? { points: ring.map(([x, y]) => ({ x, y })), closed: true } : null;
}

/**
 * Outline stroke: converte o traço em um caminho preenchido com a cor do traço. Se o shape tem preenchimento visível
 * (forma fechada), ele continua como estava sem traço e o contorno vira um shape novo por cima; senão o shape é substituído.
 */
export function outlineStroke(all: Shape[], shapeId: string, newId: string): { shapes: Shape[]; selectId: string } | null {
  const s = all.find((x) => x.id === shapeId);
  if (!s) return null;
  const poly = strokePolyline(s);
  const st = s.strokes?.find((x) => x.visible !== false);
  const width = st?.width ?? s.strokeWidth ?? 0;
  const color = st?.color ?? s.stroke;
  if (!poly || width <= 0 || !color || color === 'none' || color === 'transparent') return null;
  const multi = strokeToMulti(poly.points, width, poly.closed, { cap: 'round', join: s.strokeJoin === 'bevel' ? 'bevel' : s.strokeJoin === 'miter' ? 'miter' : 'round' });
  if (!multi) return null;
  const { d, minX, minY, width: w, height: h } = ringsToPathData(multi);
  const outline: Shape = {
    ...s,
    id: newId,
    type: 'path',
    name: `${s.name || 'Shape'} (contorno)`,
    x: minX,
    y: minY,
    width: w,
    height: h,
    rotation: 0,
    pathD: d,
    pathW: w,
    pathH: h,
    cornerRadius: 0,
    fill: color,
    fills: [{ id: `fill-${newId}`, color, opacity: st?.opacity ?? 1, visible: true }],
    stroke: 'none',
    strokeWidth: 0,
    strokes: [],
    points: undefined,
    pathHandles: undefined,
    closed: undefined,
    startCap: undefined,
    endCap: undefined,
    zIndex: s.zIndex + 0.001,
  } as Shape;
  const hasFill = poly.closed && s.type !== 'pen' && s.type !== 'pencil' && (s.fills?.some((f) => f.visible !== false) ?? (s.fill && s.fill !== 'none' && s.fill !== 'transparent'));
  const next = hasFill
    ? all.map((x) => (x.id === s.id ? { ...x, strokeWidth: 0, strokes: [], stroke: 'none' } : x))
    : all.filter((x) => x.id !== s.id);
  return { shapes: [...next, outline], selectId: newId };
}
