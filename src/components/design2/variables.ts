import type { DesignMode, DesignVariable, Shape } from './types';

export const DEFAULT_MODES: DesignMode[] = [
  { id: 'light', name: 'Claro' },
  { id: 'dark', name: 'Escuro' },
];

/** Valor da variável no modo ativo (cai no primeiro valor definido se o modo não tiver). */
export function variableValue(v: DesignVariable, modeId: string): string {
  return v.values[modeId] ?? Object.values(v.values)[0] ?? '#000000';
}

/** Propriedades que cada tipo de variável pode controlar */
export const BINDABLE: Record<'number' | 'text' | 'boolean', Array<{ key: string; label: string }>> = {
  number: [
    { key: 'width', label: 'Largura' },
    { key: 'height', label: 'Altura' },
    { key: 'layoutGap', label: 'Espaçamento (gap)' },
    { key: 'paddingHorizontal', label: 'Padding horizontal' },
    { key: 'paddingVertical', label: 'Padding vertical' },
    { key: 'cornerRadius', label: 'Raio da borda' },
    { key: 'strokeWidth', label: 'Espessura do traço' },
    { key: 'fontSize', label: 'Tamanho da fonte' },
    { key: 'opacity', label: 'Opacidade (0–1)' },
  ],
  text: [{ key: 'text', label: 'Texto' }],
  boolean: [{ key: 'visible', label: 'Visível' }],
};

/** Valor tipado da variável (número, texto ou booleana) no modo ativo. */
export function typedValue(v: DesignVariable, modeId: string): number | string | boolean | undefined {
  const raw = v.values[modeId] ?? Object.values(v.values)[0];
  if (raw === undefined) return undefined;
  if (v.kind === 'number') return Number.isFinite(Number(raw)) && raw !== '' ? Number(raw) : undefined;
  if (v.kind === 'boolean') return raw === 'true';
  return raw;
}

/** Aplica as variáveis ligadas: cor no preenchimento (fillVariableId) e número/texto/booleana nas propriedades (variableBindings). */
export function applyVariables(shapes: Shape[], variables: DesignVariable[], modeId: string): Shape[] {
  if (variables.length === 0 || !shapes.some((s) => s.fillVariableId || s.variableBindings)) return shapes;
  const byId = new Map(variables.map((v) => [v.id, v]));
  let changed = false;
  const out = shapes.map((s) => {
    let next = s;
    const v = s.fillVariableId ? byId.get(s.fillVariableId) : undefined;
    if (v && v.kind === 'color') {
      const color = variableValue(v, modeId);
      const first = s.fills && s.fills.length > 0 ? s.fills[0] : null;
      const current = first ? first.color : s.fill;
      if (current !== color) next = { ...next, fill: color, ...(first ? { fills: s.fills!.map((f, i) => (i === 0 ? { ...f, color } : f)) } : {}) };
    }
    if (s.variableBindings) {
      const patch: Record<string, unknown> = {};
      for (const [prop, varId] of Object.entries(s.variableBindings)) {
        const bound = byId.get(varId);
        if (!bound || bound.kind === 'color') continue;
        const value = typedValue(bound, modeId);
        if (value === undefined) continue;
        if ((next as any)[prop] !== value) patch[prop] = value;
      }
      if (Object.keys(patch).length) next = { ...next, ...patch };
    }
    if (next !== s) changed = true;
    return next;
  });
  return changed ? out : shapes;
}

export function createColorVariable(id: string, name: string, color: string, modes: DesignMode[] = DEFAULT_MODES): DesignVariable {
  return { id, name, kind: 'color', values: Object.fromEntries(modes.map((m) => [m.id, color])) };
}

/** Variável de número, texto ou booleana com o mesmo valor inicial em todos os modos. */
export function createTypedVariable(kind: 'number' | 'text' | 'boolean', id: string, name: string, initial: string, modes: DesignMode[] = DEFAULT_MODES): DesignVariable {
  return { id, name, kind, values: Object.fromEntries(modes.map((m) => [m.id, initial])) };
}
