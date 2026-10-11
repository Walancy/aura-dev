import type { Shape } from './types';
import { descendantIds } from './constraints';

/** Propriedade de componente: expõe uma camada interna na instância (mostrar/ocultar ou trocar o texto) */
export interface ComponentProp {
  id: string;
  name: string;
  type: 'boolean' | 'text';
  /** id da camada dentro do componente principal */
  targetId: string;
}

export type PropValue = boolean | string;

/** Camadas internas do componente que podem virar propriedade (texto só para textos). */
export function propTargets(all: Shape[], componentId: string): Array<{ id: string; name: string; type: Shape['type'] }> {
  return descendantIds(all, componentId)
    .map((id) => all.find((s) => s.id === id))
    .filter((s): s is Shape => Boolean(s))
    .map((s) => ({ id: s.id, name: s.name || s.type, type: s.type }));
}

/** Valor atual da camada alvo no componente principal (valor padrão da propriedade). */
export function defaultPropValue(all: Shape[], prop: ComponentProp): PropValue {
  const t = all.find((s) => s.id === prop.targetId);
  return prop.type === 'boolean' ? t?.visible !== false : t?.text ?? '';
}

/**
 * Aplica os valores de propriedade de cada instância às suas camadas.
 * A camada afetada passa a ter o campo em `overrides`, para a sincronização com o componente não desfazer o valor.
 */
export function applyComponentProps(all: Shape[]): Shape[] {
  const insts = all.filter((s) => s.instanceOf && s.propValues && Object.keys(s.propValues).length > 0);
  if (insts.length === 0) return all;
  const patches = new Map<string, Partial<Shape>>();
  for (const inst of insts) {
    const comp = all.find((s) => s.id === inst.instanceOf);
    if (!comp?.componentProps?.length) continue;
    const tree = new Set([inst.id, ...descendantIds(all, inst.id)]);
    const bySource = new Map(all.filter((s) => tree.has(s.id) && s.sourceId).map((s) => [s.sourceId!, s]));
    for (const prop of comp.componentProps) {
      const value = inst.propValues![prop.id];
      const target = bySource.get(prop.targetId);
      if (value === undefined || !target) continue;
      const field = prop.type === 'boolean' ? 'visible' : 'text';
      const patch = prop.type === 'boolean' ? { visible: Boolean(value) } : { text: String(value), wrapSource: undefined };
      const prev = patches.get(target.id) || {};
      patches.set(target.id, { ...prev, ...patch, overrides: Array.from(new Set([...(prev.overrides || target.overrides || []), field])) });
    }
  }
  if (patches.size === 0) return all;
  return all.map((s) => (patches.has(s.id) ? { ...s, ...patches.get(s.id) } : s));
}
