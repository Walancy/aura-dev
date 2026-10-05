import type { EffectItem } from './types';

const rgb01 = (hex: string) => {
  const c = (hex || '#000000').replace('#', '');
  const f = c.length === 3 ? c.split('').map((x) => x + x).join('') : c.padEnd(6, '0');
  return [0, 2, 4].map((i) => ((parseInt(f.slice(i, i + 2), 16) || 0) / 255).toFixed(3));
};

/**
 * <filter> SVG com os efeitos que o CSS `filter` não cobre: sombra interna e ruído.
 * (drop-shadow e blur de camada continuam como funções CSS no canvas.)
 * Retorna null quando não há nenhum desses efeitos visíveis.
 */
export function svgEffectFilter(id: string, effects: EffectItem[] | undefined): string | null {
  const active = (effects || []).filter((e) => e.visible && (e.type === 'inner-shadow' || e.type === 'noise'));
  if (active.length === 0) return null;

  let current = 'SourceGraphic';
  const parts: string[] = [];
  active.forEach((e, k) => {
    const out = `out${k}`;
    if (e.type === 'inner-shadow') {
      const [r, g, b] = rgb01(e.color);
      const spread = Math.max(0, e.spread || 0);
      parts.push(
        `<feComponentTransfer in="SourceAlpha" result="inv${k}"><feFuncA type="table" tableValues="1 0"/></feComponentTransfer>`,
        spread > 0 ? `<feMorphology in="inv${k}" operator="dilate" radius="${spread}" result="inv${k}"/>` : '',
        `<feGaussianBlur in="inv${k}" stdDeviation="${(e.blur ?? 4) / 2}" result="blur${k}"/>`,
        `<feOffset in="blur${k}" dx="${e.x || 0}" dy="${e.y ?? 4}" result="off${k}"/>`,
        `<feFlood flood-color="rgb(${[r, g, b].map((n) => Math.round(Number(n) * 255)).join(',')})" flood-opacity="${e.opacity ?? 0.25}" result="col${k}"/>`,
        `<feComposite in="col${k}" in2="off${k}" operator="in" result="sh${k}"/>`,
        `<feComposite in="sh${k}" in2="SourceAlpha" operator="in" result="clip${k}"/>`,
        `<feMerge result="${out}"><feMergeNode in="${current}"/><feMergeNode in="clip${k}"/></feMerge>`
      );
    } else {
      const [r, g, b] = rgb01(e.color);
      const size = Math.max(0.5, e.noiseSizeX || 2);
      const strength = Math.min(1, (e.opacity ?? 0.25) * (e.density ?? 0.5) * 3);
      parts.push(
        `<feTurbulence type="fractalNoise" baseFrequency="${Math.min(2, 1 / size).toFixed(3)}" numOctaves="2" seed="${k + 1}" result="turb${k}"/>`,
        `<feColorMatrix in="turb${k}" type="matrix" values="0 0 0 0 ${r} 0 0 0 0 ${g} 0 0 0 0 ${b} ${strength.toFixed(3)} 0 0 0 0" result="col${k}"/>`,
        `<feComposite in="col${k}" in2="SourceAlpha" operator="in" result="clip${k}"/>`,
        `<feMerge result="${out}"><feMergeNode in="${current}"/><feMergeNode in="clip${k}"/></feMerge>`
      );
    }
    current = out;
  });
  return `<filter id="${id}" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">${parts.join('')}</filter>`;
}
