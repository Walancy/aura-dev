import type { Shape, FillItem } from './types';
import { collectSubtree } from './exportDesign';

const top = <T,>(m: Map<T, number>, n: number): T[] => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
const bump = <T,>(m: Map<T, number>, k: T) => m.set(k, (m.get(k) || 0) + 1);

function fillText(fills?: FillItem[], solid?: string): string {
  const layers = (fills?.length ? [...fills].reverse() : solid ? [{ type: 'solid', color: solid, opacity: 1 } as FillItem] : []).filter((f) => f.visible !== false);
  return layers
    .map((f) => {
      const a = f.opacity < 1 ? ` ${Math.round(f.opacity * 100)}%` : '';
      if (f.type && f.type !== 'solid' && f.gradientStops?.length) {
        const where = f.type === 'radial' ? ` centro ${f.gradientCenter ? `${f.gradientCenter.x},${f.gradientCenter.y}` : '0.5,0.5'} raio ${f.gradientRadius ?? 0.5}` : f.type === 'linear' ? ` ${f.gradientAngle ?? 180}°` : '';
        return `${f.type}${where} [${f.gradientStops.map((s) => `${s.color}@${Math.round((s.position ?? 0) * 100)}%`).join(', ')}]${a}`;
      }
      return `${f.color}${a}`;
    })
    .join(' + ');
}

/**
 * Padrão de design de uma tela existente (fundo, paleta, tipografia, formas, efeitos), para regerar mantendo a identidade.
 * `screen` é a tela (o frame com o conteúdo); o aparelho (deviceChrome) é ignorado.
 */
export function describeScreenStyle(all: Shape[], screen: Shape): string {
  const items = collectSubtree(all, screen).filter((s) => s.id !== screen.id && s.visible !== false && !s.deviceChrome);
  const colors = new Map<string, number>();
  const fonts = new Map<string, number>();
  const radii = new Map<number, number>();
  const texts: Shape[] = [];
  let glass = 0, shadows = 0, grain = 0, strokes = 0;
  for (const s of items) {
    if (s.type === 'text') {
      texts.push(s);
      if (s.fill) bump(colors, s.fill.toUpperCase());
      bump(fonts, s.fontFamily || 'Poppins');
      continue;
    }
    if (s.fills?.[0]?.visible !== false) {
      const c = (s.fills?.find((f) => f.type === 'solid' || !f.type)?.color || s.fill || '').toUpperCase();
      if (c && c !== 'NONE' && c !== 'TRANSPARENT') bump(colors, c);
    }
    if (s.cornerRadius) bump(radii, Math.round(s.cornerRadius));
    if (s.effects?.some((e) => e.visible !== false && e.type === 'background-blur')) glass++;
    if (s.effects?.some((e) => e.visible !== false && (e.type === 'drop-shadow' || e.type === 'inner-shadow'))) shadows++;
    if (s.effects?.some((e) => e.visible !== false && e.type === 'noise')) grain++;
    if (s.strokes?.length || (s.stroke && s.stroke !== 'none')) strokes++;
  }
  const sizes = new Map<number, number>();
  texts.forEach((t) => bump(sizes, Math.round(t.fontSize || 16)));
  const weights = new Map<number, number>();
  texts.forEach((t) => bump(weights, Number(t.fontWeight) || 400));
  const lines = [
    `Fundo da tela: ${fillText(screen.fills, screen.fill) || 'não definido'}${screen.effects?.some((e) => e.type === 'noise') ? ' + granulado' : ''}`,
    `Cores mais usadas: ${top(colors, 8).join(', ') || '—'}`,
    `Fonte: ${top(fonts, 2).join(', ') || 'Poppins'}; tamanhos: ${top(sizes, 7).sort((a, b) => b - a).join(', ')}px; pesos: ${top(weights, 3).join(', ')}`,
    `Raios de borda: ${top(radii, 5).join(', ') || '—'}px`,
    `Efeitos: ${glass} componente(s) com vidro (blur de fundo), ${shadows} com sombra, ${strokes} com borda${grain ? ', granulado' : ''}`,
  ];
  return lines.join('\n');
}
