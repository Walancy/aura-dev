import type { Shape } from './types';
import { descendantIds } from './constraints';

export type DropPosition = 'before' | 'after' | 'inside';

/**
 * Arrasta uma camada (com tudo que há dentro) no painel de camadas: antes/depois de outra (mesmo pai dela) ou para
 * DENTRO de um frame/grupo. A ordem da lista (array) e o empilhamento (zIndex) ficam coerentes: só a região do novo pai
 * é renumerada, dentro da faixa de zIndex que ela já ocupava, então nada fora dela muda de lugar na pilha.
 * Devolve null quando o movimento não é permitido (peça do aparelho, ciclo, nível raiz).
 */
export function reorderLayers(all: Shape[], dragId: string, targetId: string, pos: DropPosition): Shape[] | null {
  const byId = new Map(all.map((s) => [s.id, s]));
  const drag = byId.get(dragId);
  const target = byId.get(targetId);
  if (!drag || !target || drag.deviceChrome || dragId === targetId) return null;
  const containerTypes = new Set(['frame', 'group', 'section']);
  if (pos === 'inside' && (!containerTypes.has(target.type) || target.deviceChrome)) return null;
  const newParentId = pos === 'inside' ? target.id : target.parentId;
  if (!newParentId) return null; // reordenar no nível raiz não é suportado
  const blockIds = new Set([dragId, ...descendantIds(all, dragId)]);
  if (blockIds.has(targetId) || blockIds.has(newParentId)) return null;

  const block = all.filter((s) => blockIds.has(s.id)).map((s) => (s.id === dragId ? { ...s, parentId: newParentId } : s));
  const rest = all.filter((s) => !blockIds.has(s.id));
  const subtreeEnd = (id: string) => {
    const ids = new Set([id, ...descendantIds(rest, id)]);
    let last = rest.findIndex((s) => s.id === id);
    rest.forEach((s, i) => { if (ids.has(s.id) && i > last) last = i; });
    return last;
  };
  const at = pos === 'before' ? rest.findIndex((s) => s.id === targetId) : subtreeEnd(targetId) + 1;
  if (at < 0) return null;
  const next = [...rest.slice(0, at), ...block, ...rest.slice(at)];

  // renumera o empilhamento só dentro do novo pai (na ordem da lista)
  const parent = next.find((s) => s.id === newParentId)!;
  const region = new Set(descendantIds(next, newParentId));
  const members = next.filter((s) => region.has(s.id));
  const n = members.length;
  const olds = members.filter((s) => !blockIds.has(s.id)).map((s) => s.zIndex ?? 0);
  const lo = (parent.zIndex ?? 0) + 0.001;
  const hi = Math.max(olds.length ? Math.max(...olds) : lo, lo + n * 0.001);
  const zOf = new Map(members.map((s, i) => [s.id, n > 1 ? lo + ((hi - lo) * i) / (n - 1) : lo]));
  return next.map((s) => (zOf.has(s.id) ? { ...s, zIndex: zOf.get(s.id)! } : s));
}
