import type { Shape } from './types';
import { descendantIds } from './constraints';

const collectSubtree = (all: Shape[], root: Shape): Shape[] => {
  const ids = new Set(descendantIds(all, root.id));
  return [root, ...all.filter((s) => ids.has(s.id))];
};

// Propriedades que pertencem à estrutura/identidade da instância e nunca vêm do componente
const STRUCTURAL = new Set(['id', 'parentId', 'pageId', 'zIndex', 'instanceOf', 'sourceId', 'overrides', 'isComponent', 'name']);

const uid = () => `inst-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

/** Cria uma instância (cópia ligada) do componente principal, deslocada por `offset`. */
export function createInstance(all: Shape[], componentId: string, offset = { x: 40, y: 40 }, idGen: () => string = uid): Shape[] {
  const root = all.find((s) => s.id === componentId);
  if (!root) return [];
  const subtree = collectSubtree(all, root);
  const idMap = new Map(subtree.map((s) => [s.id, idGen()]));
  const maxZ = Math.max(...all.map((s) => s.zIndex), 0);
  return subtree.map((s, i) => ({
    ...s,
    id: idMap.get(s.id)!,
    parentId: s.id === root.id ? s.parentId : idMap.get(s.parentId!)!,
    x: s.x + offset.x,
    y: s.y + offset.y,
    ...(s.points ? { points: s.points.map((p) => ({ x: p.x + offset.x, y: p.y + offset.y })) } : {}),
    zIndex: maxZ + 1 + i,
    isComponent: false,
    instanceOf: s.id === root.id ? root.id : undefined,
    sourceId: s.id,
    overrides: [],
    name: s.id === root.id ? `${s.name || 'Componente'} (instância)` : s.name,
  }));
}

/** Desanexa: a instância vira um grupo de shapes comuns. */
export function detachInstance(all: Shape[], rootId: string): Shape[] {
  const root = all.find((s) => s.id === rootId);
  if (!root) return all;
  const ids = new Set(collectSubtree(all, root).map((s) => s.id));
  return all.map((s) => (ids.has(s.id) ? { ...s, instanceOf: undefined, sourceId: undefined, overrides: undefined } : s));
}

/** Propaga as mudanças do componente principal para todas as instâncias, respeitando os overrides. */
export function syncInstances(all: Shape[]): Shape[] {
  const roots = all.filter((s) => s.instanceOf);
  if (roots.length === 0) return all;
  const byId = new Map(all.map((s) => [s.id, s]));
  let out = all;

  for (const inst of roots) {
    const comp = byId.get(inst.instanceOf!);
    if (!comp) continue;
    const compTree = collectSubtree(all, comp);
    const instTree = collectSubtree(out, out.find((s) => s.id === inst.id)!);
    const instRoot = instTree[0];
    const bySource = new Map(instTree.filter((s) => s.sourceId).map((s) => [s.sourceId!, s]));
    const dx = instRoot.x - comp.x;
    const dy = instRoot.y - comp.y;
    const patches = new Map<string, Partial<Shape>>();
    const toAdd: Shape[] = [];
    const idByCompId = new Map<string, string>([[comp.id, instRoot.id]]);
    bySource.forEach((s, src) => idByCompId.set(src, s.id));

    for (const src of compTree) {
      const target = bySource.get(src.id);
      if (!target) {
        if (src.id === comp.id) continue;
        // Filho novo no componente: cria o correspondente
        const newId = uid();
        idByCompId.set(src.id, newId);
        toAdd.push({
          ...src,
          id: newId,
          parentId: idByCompId.get(src.parentId!) || instRoot.id,
          x: src.x + dx,
          y: src.y + dy,
          ...(src.points ? { points: src.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) } : {}),
          zIndex: instRoot.zIndex + toAdd.length + 1,
          isComponent: false,
          instanceOf: undefined,
          sourceId: src.id,
          overrides: [],
        });
        continue;
      }
      const overrides = new Set(target.overrides || []);
      const patch: Record<string, unknown> = {};
      for (const key of Object.keys(src) as Array<keyof Shape>) {
        if (STRUCTURAL.has(key as string) || overrides.has(key as string)) continue;
        if (key === 'x' && target.id !== instRoot.id) patch.x = src.x + dx;
        else if (key === 'y' && target.id !== instRoot.id) patch.y = src.y + dy;
        else if (key === 'x' || key === 'y') continue; // raiz da instância mantém a própria posição
        else if (key === 'points') patch.points = src.points!.map((p) => ({ x: p.x + dx, y: p.y + dy }));
        else patch[key] = src[key];
      }
      patches.set(target.id, patch as Partial<Shape>);
    }
    // Filhos removidos do componente somem da instância
    const removed = new Set(instTree.filter((s) => s.sourceId && !compTree.some((c) => c.id === s.sourceId) && s.id !== instRoot.id).map((s) => s.id));
    out = out.filter((s) => !removed.has(s.id)).map((s) => (patches.has(s.id) ? { ...s, ...patches.get(s.id) } : s));
    if (toAdd.length) out = [...out, ...toAdd];
  }
  return out;
}

/** Componentes que são variantes do mesmo grupo. */
export function variantsOf(all: Shape[], componentId: string): Shape[] {
  const comp = all.find((s) => s.id === componentId);
  if (!comp?.variantGroup) return comp ? [comp] : [];
  return all.filter((s) => s.isComponent && s.variantGroup === comp.variantGroup);
}

/** Troca a instância para outra variante: a instância é refeita no mesmo lugar (overrides são descartados). */
export function switchVariant(all: Shape[], instanceRootId: string, newComponentId: string, idGen: () => string = uid): { shapes: Shape[]; newRootId: string } | null {
  const inst = all.find((s) => s.id === instanceRootId);
  const target = all.find((s) => s.id === newComponentId);
  if (!inst || !inst.instanceOf || !target?.isComponent) return null;
  const fresh = createInstance(all, newComponentId, { x: inst.x - target.x, y: inst.y - target.y }, idGen);
  if (fresh.length === 0) return null;
  const removed = new Set(collectSubtree(all, inst).map((s) => s.id));
  const root = { ...fresh[0], parentId: inst.parentId, pageId: inst.pageId, zIndex: inst.zIndex };
  return { shapes: [...all.filter((s) => !removed.has(s.id)), root, ...fresh.slice(1).map((s) => ({ ...s, pageId: inst.pageId }))], newRootId: root.id };
}
