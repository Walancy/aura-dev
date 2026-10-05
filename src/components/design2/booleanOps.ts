import polygonClipping from 'polygon-clipping';
import type { Shape } from './types';

export type BooleanOp = 'union' | 'subtract' | 'intersect' | 'exclude';
type Ring = Array<[number, number]>;
type MultiPolygon = Array<Array<Ring>>;

const ARC_STEPS = 8;
const ELLIPSE_STEPS = 72;

function rotate(points: Ring, cx: number, cy: number, deg: number): Ring {
  if (!deg) return points;
  const a = (deg * Math.PI) / 180;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return points.map(([x, y]) => [cx + (x - cx) * cos - (y - cy) * sin, cy + (x - cx) * sin + (y - cy) * cos]);
}

function roundedRect(x: number, y: number, w: number, h: number, r: number): Ring {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  if (rr === 0) return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]];
  const pts: Ring = [];
  const corner = (cx: number, cy: number, start: number) => {
    for (let i = 0; i <= ARC_STEPS; i++) {
      const a = start + (i / ARC_STEPS) * (Math.PI / 2);
      pts.push([cx + rr * Math.cos(a), cy + rr * Math.sin(a)]);
    }
  };
  corner(x + w - rr, y + rr, -Math.PI / 2); // topo-direita
  corner(x + w - rr, y + h - rr, 0); // base-direita
  corner(x + rr, y + h - rr, Math.PI / 2); // base-esquerda
  corner(x + rr, y + rr, Math.PI); // topo-esquerda
  return pts;
}

/** Contorno fechado do shape como polígono (curvas aproximadas por segmentos). Null se não for uma forma fechada. */
export function shapeToRing(s: Shape): Ring | null {
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  let ring: Ring | null = null;
  switch (s.type) {
    case 'rect':
    case 'frame':
    case 'section':
    case 'image':
    case 'text':
      ring = roundedRect(s.x, s.y, s.width, s.height, s.cornerRadius || 0);
      break;
    case 'ellipse': {
      ring = [];
      for (let i = 0; i < ELLIPSE_STEPS; i++) {
        const a = (i / ELLIPSE_STEPS) * Math.PI * 2;
        ring.push([cx + (s.width / 2) * Math.cos(a), cy + (s.height / 2) * Math.sin(a)]);
      }
      break;
    }
    case 'polygon': {
      const n = Math.max(3, Math.round(s.polygonSides ?? 3));
      const r = Math.min(s.width, s.height) / 2;
      ring = Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n - Math.PI / 2;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
      });
      break;
    }
    case 'star': {
      const n = s.starPoints ?? 5;
      const rOuter = Math.min(s.width, s.height) / 2;
      const rInner = rOuter * (s.starInnerRatio ?? 0.5);
      ring = Array.from({ length: 2 * n }, (_, i) => {
        const r = i % 2 === 0 ? rOuter : rInner;
        const a = (i * Math.PI) / n - Math.PI / 2;
        return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
      });
      break;
    }
    case 'path':
      return null; // caminho já resolvido: use o resultado anterior como polígono via pathToMulti (não suportado aqui)
    default:
      return null;
  }
  return ring ? rotate(ring, cx, cy, s.rotation || 0) : null;
}

/** Converte um shape `path` (resultado anterior) de volta para polígonos, aplicando posição/escala atuais. */
export function pathShapeToMulti(s: Shape): MultiPolygon | null {
  if (s.type !== 'path' || !s.pathD || !s.pathW || !s.pathH) return null;
  const kx = s.width / s.pathW;
  const ky = s.height / s.pathH;
  const rings: Ring[] = [];
  for (const sub of s.pathD.split('M').filter(Boolean)) {
    const nums = sub.replace(/[LZ]/g, ' ').trim().split(/\s+/).map(Number);
    const ring: Ring = [];
    for (let i = 0; i + 1 < nums.length; i += 2) ring.push([s.x + nums[i] * kx, s.y + nums[i + 1] * ky]);
    if (ring.length >= 3) rings.push(ring);
  }
  // cada anel vira um polígono simples; com evenodd a ordem original (buracos) é refeita pelo clipping ao unir
  if (rings.length === 0) return null;
  const [head, ...tail] = rings.map((r) => [[r]] as any);
  return (polygonClipping.xor(head, ...tail) as MultiPolygon);
}

function toMulti(s: Shape): MultiPolygon | null {
  if (s.type === 'path') return pathShapeToMulti(s);
  const ring = shapeToRing(s);
  return ring ? [[ring]] : null;
}

export function ringsToPathData(multi: MultiPolygon): { d: string; minX: number; minY: number; width: number; height: number } {
  const all = multi.flatMap((poly) => poly.flatMap((ring) => ring));
  const minX = Math.min(...all.map((p) => p[0]));
  const minY = Math.min(...all.map((p) => p[1]));
  const maxX = Math.max(...all.map((p) => p[0]));
  const maxY = Math.max(...all.map((p) => p[1]));
  const f = (n: number) => Math.round(n * 100) / 100;
  const d = multi
    .flatMap((poly) =>
      poly.map((ring) => {
        const pts = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
        return `M${pts.map(([x, y]) => `${f(x - minX)} ${f(y - minY)}`).join('L')}Z`;
      })
    )
    .join('');
  return { d, minX, minY, width: Math.max(1, maxX - minX), height: Math.max(1, maxY - minY) };
}

/**
 * Operação booleana entre shapes (na ordem de camadas: o primeiro é a base).
 * Retorna um shape `path` com a geometria resultante, ou null se algum shape não for uma forma fechada ou o resultado for vazio.
 */
export function booleanShapes(shapes: Shape[], op: BooleanOp, newId: string): Shape | null {
  if (shapes.length < 2) return null;
  const polys = shapes.map(toMulti);
  if (polys.some((p) => !p)) return null;
  const [first, ...rest] = polys as MultiPolygon[];
  const run = polygonClipping[op === 'subtract' ? 'difference' : op === 'intersect' ? 'intersection' : op === 'exclude' ? 'xor' : 'union'] as (a: any, ...b: any[]) => MultiPolygon;
  const result = run(first, ...rest);
  if (!result || result.length === 0) return null;
  const { d, minX, minY, width, height } = ringsToPathData(result);
  const base = shapes[0];
  return {
    ...base,
    id: newId,
    type: 'path',
    name: `${base.name || 'Shape'} (${op === 'union' ? 'União' : op === 'subtract' ? 'Subtração' : op === 'intersect' ? 'Interseção' : 'Exclusão'})`,
    x: minX,
    y: minY,
    width,
    height,
    rotation: 0,
    pathD: d,
    pathW: width,
    pathH: height,
    cornerRadius: 0,
    parentId: base.parentId,
    zIndex: Math.max(...shapes.map((s) => s.zIndex)),
  } as Shape;
}

/** Converte uma forma fechada em caminho editável como resultado (Flatten). */
export function flattenShape(shape: Shape, newId: string): Shape | null {
  const multi = toMulti(shape);
  if (!multi) return null;
  const { d, minX, minY, width, height } = ringsToPathData(multi);
  return { ...shape, id: newId, type: 'path', x: minX, y: minY, width, height, rotation: 0, pathD: d, pathW: width, pathH: height, cornerRadius: 0 } as Shape;
}
