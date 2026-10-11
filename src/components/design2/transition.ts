import type { Direction, TransitionType } from './prototype';

export const DEFAULT_DURATION: Record<TransitionType, number> = {
  instant: 0,
  dissolve: 300,
  'smart-animate': 400,
  'move-in': 300,
  'move-out': 300,
  push: 300,
  'slide-in': 350,
  'slide-out': 350,
};

/** Posição/opacidade de uma camada, com deslocamento em frações da largura/altura do frame. */
export interface LayerPose {
  tx: number;
  ty: number;
  opacity: number;
}

const VEC: Record<Direction, { x: number; y: number }> = { left: { x: -1, y: 0 }, right: { x: 1, y: 0 }, up: { x: 0, y: -1 }, down: { x: 0, y: 1 } };
export const oppositeDirection = (d: Direction): Direction => (d === 'left' ? 'right' : d === 'right' ? 'left' : d === 'up' ? 'down' : 'up');

/**
 * Poses da tela que sai (`from`) e da que entra (`to`) no progresso `p` (0..1, já com a curva aplicada).
 * `direction` é a direção do movimento (esquerda = o conteúdo anda para a esquerda, a nova tela entra pela direita).
 * Smart animate não passa por aqui (é interpolado camada a camada).
 */
export function transitionPoses(type: TransitionType, direction: Direction, p: number): { from: LayerPose; to: LayerPose } {
  const d = VEC[direction];
  const still: LayerPose = { tx: 0, ty: 0, opacity: 1 };
  const off = (k: number): LayerPose => ({ tx: d.x * k + 0, ty: d.y * k + 0, opacity: 1 }); // + 0 evita -0
  switch (type) {
    case 'instant':
      return { from: { ...still, opacity: p > 0 ? 0 : 1 }, to: { ...still, opacity: p > 0 ? 1 : 0 } };
    case 'dissolve':
    case 'smart-animate':
      return { from: { ...still, opacity: 1 - p }, to: { ...still, opacity: p } };
    case 'move-in':
      return { from: still, to: off(-(1 - p)) };
    case 'move-out':
      return { from: off(p), to: still };
    case 'push':
      return { from: off(p), to: off(-(1 - p)) };
    case 'slide-in':
      return { from: off(p * 0.3), to: off(-(1 - p)) };
    case 'slide-out':
      return { from: off(p), to: off(-(1 - p) * 0.3) };
  }
}
