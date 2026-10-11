export interface ImageAdjust {
  /** −1 a 1 (0 = original): brilho */
  exposure?: number;
  /** −1 a 1: contraste */
  contrast?: number;
  /** −1 a 1: saturação (−1 = preto e branco) */
  saturation?: number;
  /** −1 a 1: temperatura (negativo frio/azul, positivo quente/laranja) */
  temperature?: number;
  /** −180 a 180: matiz em graus */
  hue?: number;
}

export const ADJUST_FIELDS: Array<{ key: keyof ImageAdjust; label: string; min: number; max: number; step: number }> = [
  { key: 'exposure', label: 'Exposição', min: -1, max: 1, step: 0.01 },
  { key: 'contrast', label: 'Contraste', min: -1, max: 1, step: 0.01 },
  { key: 'saturation', label: 'Saturação', min: -1, max: 1, step: 0.01 },
  { key: 'temperature', label: 'Temperatura', min: -1, max: 1, step: 0.01 },
  { key: 'hue', label: 'Matiz', min: -180, max: 180, step: 1 },
];

const f = (n: number) => Math.round(n * 1000) / 1000;

export const hasAdjust = (a?: ImageAdjust): boolean => !!a && Object.values(a).some((v) => typeof v === 'number' && Math.abs(v) > 0.0001);

/**
 * Filtro SVG com os ajustes de imagem, na ordem: exposição → contraste → temperatura → saturação → matiz.
 * Devolve o markup de um `<filter id=...>` (ou string vazia se não há ajuste).
 */
export function imageFilterMarkup(id: string, a?: ImageAdjust): string {
  if (!a || !hasAdjust(a)) return '';
  const parts: string[] = [];
  const exp = a.exposure ?? 0;
  const con = a.contrast ?? 0;
  if (exp || con) {
    const slope = (1 + con) * (1 + exp);
    const intercept = 0.5 - 0.5 * (1 + con) + exp * 0.5;
    const fn = (c: string) => `<feFunc${c} type="linear" slope="${f(slope)}" intercept="${f(intercept)}"/>`;
    parts.push(`<feComponentTransfer>${fn('R')}${fn('G')}${fn('B')}</feComponentTransfer>`);
  }
  const t = a.temperature ?? 0;
  if (t) parts.push(`<feColorMatrix type="matrix" values="${f(1 + t * 0.2)} 0 0 0 0  0 1 0 0 0  0 0 ${f(1 - t * 0.2)} 0 0  0 0 0 1 0"/>`);
  const sat = a.saturation ?? 0;
  if (sat) parts.push(`<feColorMatrix type="saturate" values="${f(Math.max(0, 1 + sat))}"/>`);
  const hue = a.hue ?? 0;
  if (hue) parts.push(`<feColorMatrix type="hueRotate" values="${f(hue)}"/>`);
  return `<filter id="${id}" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">${parts.join('')}</filter>`;
}
