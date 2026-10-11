import type { Shape } from './types';
import { CAP_HEIGHT, defaultMeasure, LINE_HEIGHT, wrapLines, type Measure } from './textFit';
import { flatText } from './autoLayout';

export type TextResize = 'auto-width' | 'auto-height' | 'fixed';

export const TEXT_RESIZE_LABEL: Record<TextResize, string> = {
  'auto-width': 'Largura automática',
  'auto-height': 'Altura automática',
  fixed: 'Tamanho fixo',
};

const weightOf = (s: Shape) => Number(s.fontWeight) || 400;

/** Altura da caixa para n linhas; com corte vertical, vai do topo das maiúsculas à linha de base da última. */
export const boxHeight = (s: Shape, lines: number) => {
  const size = s.fontSize || 16;
  return Math.ceil(s.textVerticalTrim === 'cap-height' ? (lines - 1) * size * LINE_HEIGHT + CAP_HEIGHT * size : lines * size * LINE_HEIGHT);
};

/**
 * Ajusta a caixa do texto ao conteúdo:
 * - largura automática: uma linha por parágrafo, caixa do tamanho da maior;
 * - altura automática: quebra as linhas pela largura atual (o texto original fica em `wrapSource`) e ajusta a altura.
 * Devolve o patch, ou null se nada mudou.
 */
export function fitTextBox(s: Shape, measure: Measure = defaultMeasure): Partial<Shape> | null {
  if ((s.type !== 'text' && s.type !== 'text-path') || !s.textResize || s.textResize === 'fixed') return null;
  const size = s.fontSize || 16;
  if (s.textResize === 'auto-width') {
    const lines = (s.wrapSource ? flatText(s) : s.text || '').split('\n');
    const width = Math.ceil(Math.max(0, ...lines.map((l) => measure(l, size, weightOf(s))))) + 2;
    const height = boxHeight(s, lines.length);
    const text = s.wrapSource ? lines.join('\n') : s.text;
    if (width === Math.round(s.width) && height === Math.round(s.height) && text === s.text && !s.wrapSource) return null;
    return { width, height, text, wrapSource: undefined };
  }
  // altura automática
  const flat = flatText(s);
  const lines = wrapLines(flat, Math.max(8, s.width), size, weightOf(s), measure);
  const text = lines.join('\n');
  const height = boxHeight(s, lines.length);
  if (text === s.text && height === Math.round(s.height) && s.wrapSource === flat) return null;
  return { text, height, wrapSource: flat };
}

/** Aplica `fitTextBox` a todos os textos com redimensionamento automático (mesma lista se nada mudou). */
export function applyTextResize(shapes: Shape[], measure: Measure = defaultMeasure): Shape[] {
  let changed = false;
  const out = shapes.map((s) => {
    const patch = s.textResize && s.textResize !== 'fixed' ? fitTextBox(s, measure) : null;
    if (!patch) return s;
    changed = true;
    return { ...s, ...patch };
  });
  return changed ? out : shapes;
}
