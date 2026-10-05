import type { DesignMode, DesignVariable, Shape } from './types';

export const DEFAULT_MODES: DesignMode[] = [
  { id: 'light', name: 'Claro' },
  { id: 'dark', name: 'Escuro' },
];

/** Valor da variável no modo ativo (cai no primeiro valor definido se o modo não tiver). */
export function variableValue(v: DesignVariable, modeId: string): string {
  return v.values[modeId] ?? Object.values(v.values)[0] ?? '#000000';
}

/** Aplica as variáveis de cor ligadas (fillVariableId) com os valores do modo ativo. */
export function applyVariables(shapes: Shape[], variables: DesignVariable[], modeId: string): Shape[] {
  if (variables.length === 0 || !shapes.some((s) => s.fillVariableId)) return shapes;
  const byId = new Map(variables.map((v) => [v.id, v]));
  let changed = false;
  const out = shapes.map((s) => {
    const v = s.fillVariableId ? byId.get(s.fillVariableId) : undefined;
    if (!v) return s;
    const color = variableValue(v, modeId);
    const first = s.fills && s.fills.length > 0 ? s.fills[0] : null;
    const current = first ? first.color : s.fill;
    if (current === color) return s;
    changed = true;
    return { ...s, fill: color, ...(first ? { fills: s.fills!.map((f, i) => (i === 0 ? { ...f, color } : f)) } : {}) };
  });
  return changed ? out : shapes;
}

export function createColorVariable(id: string, name: string, color: string, modes: DesignMode[] = DEFAULT_MODES): DesignVariable {
  return { id, name, kind: 'color', values: Object.fromEntries(modes.map((m) => [m.id, color])) };
}
