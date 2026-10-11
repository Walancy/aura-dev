import type { Shape } from './types';

export interface ShapeChange {
  id: string;
  name: string;
  /** campos que mudaram, com valor antes → depois */
  fields: Array<{ key: string; from: string; to: string }>;
}

export interface ShapesDiff {
  added: Shape[];
  removed: Shape[];
  changed: ShapeChange[];
}

const KEYS: Array<keyof Shape> = ['name', 'x', 'y', 'width', 'height', 'rotation', 'opacity', 'visible', 'fill', 'stroke', 'strokeWidth', 'cornerRadius', 'text', 'fontSize', 'fontWeight', 'fontFamily', 'parentId', 'imageUrl', 'layoutGap'];

const show = (v: unknown): string => (v === undefined || v === null ? '—' : typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v).length > 40 ? `${String(v).slice(0, 37)}…` : String(v));

/** Diferença entre duas versões do design: elementos novos, removidos e campos que mudaram (por id). */
export function diffShapes(before: Shape[], after: Shape[]): ShapesDiff {
  const b = new Map(before.map((s) => [s.id, s]));
  const a = new Map(after.map((s) => [s.id, s]));
  const added = after.filter((s) => !b.has(s.id));
  const removed = before.filter((s) => !a.has(s.id));
  const changed: ShapeChange[] = [];
  for (const s of after) {
    const old = b.get(s.id);
    if (!old) continue;
    const fields: ShapeChange['fields'] = [];
    for (const k of KEYS) {
      const x = old[k] as unknown;
      const y = s[k] as unknown;
      const same = typeof x === 'number' && typeof y === 'number' ? Math.abs(x - y) < 0.005 : (x ?? null) === (y ?? null);
      if (!same) fields.push({ key: String(k), from: show(x), to: show(y) });
    }
    if (fields.length) changed.push({ id: s.id, name: s.name || s.type, fields });
  }
  return { added, removed, changed };
}
