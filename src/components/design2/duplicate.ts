import type { Shape } from './types';
import { descendantIds } from './constraints';

/** Duplica os shapes (com descendentes), deslocados por `offset`, mantendo a hierarquia e o pai original. */
export function duplicateShapes(all: Shape[], ids: string[], offset = { x: 20, y: 20 }, idGen: () => string = () => crypto.randomUUID()): { shapes: Shape[]; newRootIds: string[] } {
  const roots = ids.filter((id) => all.some((s) => s.id === id));
  const include = new Set<string>();
  roots.forEach((id) => {
    include.add(id);
    descendantIds(all, id).forEach((d) => include.add(d));
  });
  const idMap = new Map<string, string>();
  include.forEach((id) => idMap.set(id, idGen()));
  const maxZ = Math.max(...all.map((s) => s.zIndex), 0);
  let z = maxZ;
  const copies = all
    .filter((s) => include.has(s.id))
    .sort((a, b) => a.zIndex - b.zIndex)
    .map((s) => ({
      ...s,
      id: idMap.get(s.id)!,
      parentId: s.parentId && idMap.has(s.parentId) ? idMap.get(s.parentId) : s.parentId,
      x: s.x + offset.x,
      y: s.y + offset.y,
      ...(s.points ? { points: s.points.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y })) } : {}),
      name: roots.includes(s.id) ? `${s.name || 'Cópia'} (cópia)` : s.name,
      zIndex: ++z,
      // cópia de componente vira um novo componente independente; instância continua instância
      ...(s.instanceOf ? {} : {}),
    }));
  return { shapes: copies, newRootIds: roots.map((id) => idMap.get(id)!) };
}
