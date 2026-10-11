import type { Shape } from './types';
import { pathFromVector } from './vector';

/** Tipos de shape cujo contorno pode servir de caminho para um texto. */
export const PATH_TARGET_TYPES: Array<Shape['type']> = ['pen', 'pencil', 'line', 'arrow', 'ellipse', 'rect'];

const f = (n: number) => Math.round(n * 100) / 100;

/** Caminho SVG (coordenadas absolutas do canvas) do shape para `<textPath>`; null se o tipo não é suportado. */
export function pathDOf(s: Shape): string | null {
  if ((s.type === 'pen' || s.type === 'pencil') && s.points && s.points.length >= 2) return pathFromVector(s.points, s.pathHandles, !!s.closed, !!s.smooth);
  if (s.type === 'line' || s.type === 'arrow') return `M ${f(s.x)} ${f(s.y)} L ${f(s.x + s.width)} ${f(s.y + s.height)}`;
  if (s.type === 'ellipse') {
    const rx = s.width / 2;
    const ry = s.height / 2;
    const cx = s.x + rx;
    const cy = s.y + ry;
    // começa à esquerda e dá a volta no sentido horário (o texto fica por fora, no topo)
    return `M ${f(cx - rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 1 1 ${f(cx + rx)} ${f(cy)} A ${f(rx)} ${f(ry)} 0 1 1 ${f(cx - rx)} ${f(cy)}`;
  }
  if (s.type === 'rect') return `M ${f(s.x)} ${f(s.y)} L ${f(s.x + s.width)} ${f(s.y)} L ${f(s.x + s.width)} ${f(s.y + s.height)} L ${f(s.x)} ${f(s.y + s.height)} Z`;
  return null;
}
