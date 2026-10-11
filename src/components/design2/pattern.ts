export type PatternKind = 'lines' | 'dots' | 'grid' | 'checker' | 'noise';

export const PATTERN_LABEL: Record<PatternKind, string> = {
  lines: 'Linhas',
  dots: 'Pontos',
  grid: 'Grade',
  checker: 'Xadrez',
  noise: 'Ruído',
};

export type TileItem =
  | { tag: 'rect'; x: number; y: number; w: number; h: number; fill: string }
  | { tag: 'circle'; cx: number; cy: number; r: number; fill: string }
  | { tag: 'noise' };

export interface PatternTile {
  w: number;
  h: number;
  items: TileItem[];
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Peça que se repete no preenchimento por padrão. `scale` é o lado da peça em px; `fg` é a cor do desenho e `bg`
 * (opcional) o fundo. O ruído usa uma peça fixa de 64px preenchida por turbulência (filtro SVG feito no canvas).
 */
export function patternTile(kind: PatternKind, scale: number, fg: string, bg?: string): PatternTile {
  const s = Math.max(2, scale);
  const items: TileItem[] = [];
  if (kind === 'noise') return { w: 64, h: 64, items: [{ tag: 'noise' }] };
  if (bg) items.push({ tag: 'rect', x: 0, y: 0, w: s, h: s, fill: bg });
  const thick = Math.max(1, r2(s * 0.14));
  if (kind === 'lines') items.push({ tag: 'rect', x: 0, y: 0, w: thick, h: s, fill: fg });
  else if (kind === 'dots') items.push({ tag: 'circle', cx: r2(s / 2), cy: r2(s / 2), r: Math.max(0.75, r2(s * 0.16)), fill: fg });
  else if (kind === 'grid') items.push({ tag: 'rect', x: 0, y: 0, w: thick, h: s, fill: fg }, { tag: 'rect', x: 0, y: 0, w: s, h: thick, fill: fg });
  else if (kind === 'checker') items.push({ tag: 'rect', x: 0, y: 0, w: r2(s / 2), h: r2(s / 2), fill: fg }, { tag: 'rect', x: r2(s / 2), y: r2(s / 2), w: r2(s / 2), h: r2(s / 2), fill: fg });
  return { w: s, h: s, items };
}
