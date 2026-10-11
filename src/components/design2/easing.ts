export type EasingKind = 'linear' | 'ease-in' | 'ease-out' | 'ease-in-out' | 'spring';

export const EASING_LABEL: Record<EasingKind, string> = {
  linear: 'Linear',
  'ease-in': 'Entrada suave',
  'ease-out': 'Saída suave',
  'ease-in-out': 'Entrada e saída',
  spring: 'Mola',
};

/** Curva de animação: recebe t (0..1) e devolve o progresso (a mola pode passar de 1 e voltar). */
export function ease(t: number, kind: EasingKind = 'ease-in-out'): number {
  const x = Math.max(0, Math.min(1, t));
  switch (kind) {
    case 'linear':
      return x;
    case 'ease-in':
      return x * x * x;
    case 'ease-out':
      return 1 - Math.pow(1 - x, 3);
    case 'spring': {
      // oscilador amortecido: sobe além de 1 e assenta
      if (x >= 1) return 1;
      return 1 - Math.exp(-7 * x) * Math.cos(9 * x);
    }
    default:
      return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
  }
}
