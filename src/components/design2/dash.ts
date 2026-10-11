/**
 * Padrão de tracejado livre ("8 4 2 4" ou "8,4,2,4"): números positivos separados por espaço ou vírgula.
 * Devolve o texto normalizado para `stroke-dasharray`, ou undefined se for inválido/vazio.
 */
export function parseDashPattern(text?: string): string | undefined {
  const parts = (text || '').split(/[\s,]+/).filter(Boolean);
  if (parts.length === 0 || parts.length > 12) return undefined;
  const nums = parts.map(Number);
  if (nums.some((n) => !Number.isFinite(n) || n < 0) || nums.every((n) => n === 0)) return undefined;
  return nums.map((n) => Math.round(n * 100) / 100).join(',');
}

/** dasharray final do shape: padrão livre, senão o simples (dash/gap), senão nenhum. */
export function dashArrayOf(s: { strokeStyle?: string; strokeDash?: number; strokeGap?: number; strokeDashArray?: string }): string | undefined {
  if (s.strokeStyle !== 'dashed') return undefined;
  return parseDashPattern(s.strokeDashArray) ?? `${s.strokeDash || 6},${s.strokeGap || 6}`;
}
