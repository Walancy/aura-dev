/** Mede a largura de um texto em px. */
export type Measure = (text: string, fontSize: number, weight: number) => number;

let ctx: CanvasRenderingContext2D | null | undefined;
/** Canvas 2D quando existe (renderer); senão estimativa por caractere (testes). */
export const defaultMeasure: Measure = (text, fontSize, weight) => {
  try {
    if (ctx === undefined) ctx = typeof document !== 'undefined' ? document.createElement('canvas').getContext('2d') : null;
    if (ctx) {
      ctx.font = `${weight} ${fontSize}px Inter, 'Poppins', sans-serif`;
      return ctx.measureText(text).width;
    }
  } catch {}
  return text.length * fontSize * 0.55;
};

export const LINE_HEIGHT = 1.25;

export function wrapLines(text: string, width: number, fontSize: number, weight: number, measure: Measure = defaultMeasure): string[] {
  const lines: string[] = [];
  for (const par of text.split('\n')) {
    let line = '';
    for (const word of par.split(/\s+/).filter(Boolean)) {
      const next = line ? `${line} ${word}` : word;
      if (line && measure(next, fontSize, weight) > width) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
  }
  return lines;
}

export interface FitInput {
  text: string;
  width: number;
  fontSize: number;
  weight?: number;
  /** espaço disponível dentro do card/tela a partir da posição do texto */
  maxWidth: number;
  maxHeight: number;
  /** o texto foi pensado para uma linha só (títulos, botões, rótulos) */
  singleLine: boolean;
  align?: 'left' | 'center' | 'right';
  minFont?: number;
  measure?: Measure;
}
export interface FitResult { text: string; fontSize: number; width: number; height: number; lines: number }

/**
 * Faz o texto caber: prefere uma linha (reduzindo até 20% a fonte), depois quebra por palavras e,
 * se ainda passar da altura disponível, reduz a fonte e por fim corta com reticências.
 */
export function fitText(i: FitInput): FitResult {
  const measure = i.measure || defaultMeasure;
  const weight = i.weight || 400;
  const minFont = i.minFont ?? 10;
  const text = i.text.replace(/[ \t]+/g, ' ').trim();
  let boxW = Math.max(16, Math.min(i.width, i.maxWidth));
  const done = (t: string, size: number, lines: number): FitResult => ({ text: t, fontSize: size, width: boxW, height: Math.ceil(lines * size * LINE_HEIGHT), lines });

  if (i.singleLine && !text.includes('\n')) {
    const natural = measure(text, i.fontSize, weight);
    // alinhado à esquerda, pode crescer até o limite do card
    if (natural > boxW && (i.align || 'left') === 'left') boxW = Math.min(i.maxWidth, Math.ceil(natural) + 4);
    for (let s = i.fontSize; s >= Math.max(minFont, Math.floor(i.fontSize * 0.8)); s--) {
      if (measure(text, s, weight) <= boxW) return done(text, s, 1);
    }
  }
  for (let s = i.fontSize; s >= minFont; s--) {
    const lines = wrapLines(text, boxW, s, weight, measure);
    if (lines.length * s * LINE_HEIGHT <= i.maxHeight) return done(lines.join('\n'), s, lines.length);
  }
  // não coube nem na fonte mínima: corta com reticências
  const rows = Math.max(1, Math.floor(i.maxHeight / (minFont * LINE_HEIGHT)));
  const lines = wrapLines(text, boxW, minFont, weight, measure).slice(0, rows);
  let last = lines[lines.length - 1] || '';
  while (last.length > 1 && measure(last + '…', minFont, weight) > boxW) last = last.slice(0, -1);
  lines[lines.length - 1] = last.replace(/[\s,.;:]+$/, '') + '…';
  return done(lines.join('\n'), minFont, lines.length);
}
