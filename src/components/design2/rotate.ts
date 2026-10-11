import type { Shape } from './types';
import type { Point } from './types';
import { descendantIds } from './constraints';

/** Ângulo (graus) do ponto em relação ao pivô; 0° = para a direita, cresce no sentido horário (eixo y para baixo) */
export const angleDeg = (pivot: Point, p: Point) => (Math.atan2(p.y - pivot.y, p.x - pivot.x) * 180) / Math.PI;

const norm = (deg: number) => {
  const r = ((deg % 360) + 360) % 360;
  return r > 180 ? r - 360 : r;
};

/** Arredonda para múltiplos de `step` graus (padrão 15). */
export const snapAngle = (deg: number, step = 15) => Math.round(deg / step) * step;

/**
 * Gira `ids` (e os descendentes) em `deltaDeg` ao redor de `pivot`, como corpo rígido:
 * o centro de cada shape orbita o pivô e a rotação própria soma o delta. Pen/pencil giram os pontos.
 * Parte sempre dos shapes originais (`orig`), então arrastar não acumula erro.
 */
export function rotateShapes(orig: Shape[], ids: string[], pivot: Point, deltaDeg: number): Shape[] {
  const affected = new Set<string>();
  ids.forEach((id) => {
    affected.add(id);
    descendantIds(orig, id).forEach((d) => affected.add(d));
  });
  const rad = (deltaDeg * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  const rot = (x: number, y: number): Point => ({ x: pivot.x + (x - pivot.x) * cos - (y - pivot.y) * sin, y: pivot.y + (x - pivot.x) * sin + (y - pivot.y) * cos });
  return orig.map((s) => {
    if (!affected.has(s.id)) return s;
    if (s.points && s.points.length) {
      const points = s.points.map((p) => rot(p.x, p.y));
      const xs = points.map((p) => p.x);
      const ys = points.map((p) => p.y);
      return { ...s, points, x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys) };
    }
    const c = rot(s.x + s.width / 2, s.y + s.height / 2);
    return { ...s, x: c.x - s.width / 2, y: c.y - s.height / 2, rotation: norm((s.rotation || 0) + deltaDeg) };
  });
}
