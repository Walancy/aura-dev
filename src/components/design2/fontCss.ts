/** Eixos de fontes variáveis que o painel oferece, com faixa e padrão. */
export const VARIATION_AXES: Array<{ tag: string; label: string; min: number; max: number; step: number; def: number }> = [
  { tag: 'wght', label: 'Peso', min: 100, max: 900, step: 10, def: 400 },
  { tag: 'wdth', label: 'Largura', min: 50, max: 150, step: 1, def: 100 },
  { tag: 'slnt', label: 'Inclinação', min: -20, max: 20, step: 1, def: 0 },
  { tag: 'opsz', label: 'Tam. óptico', min: 8, max: 144, step: 1, def: 14 },
];

/** Recursos OpenType comuns (tag → rótulo). */
export const OPENTYPE_FEATURES: Array<{ tag: string; label: string; title: string }> = [
  { tag: 'liga', label: 'Ligaduras', title: 'fi, fl, ff… viram um caractere só' },
  { tag: 'tnum', label: 'Números tabulares', title: 'Algarismos de largura fixa (tabelas)' },
  { tag: 'onum', label: 'Números antigos', title: 'Algarismos de estilo antigo' },
  { tag: 'smcp', label: 'Versaletes', title: 'Minúsculas em capitulares pequenas' },
  { tag: 'frac', label: 'Frações', title: '1/2 vira ½' },
  { tag: 'ss01', label: 'Alternativas 1', title: 'Conjunto estilístico 1 (depende da fonte)' },
];

/** `font-variation-settings` a partir do objeto de eixos; undefined se vazio. */
export function variationSettings(v?: Record<string, number>): string | undefined {
  const parts = Object.entries(v || {})
    .filter(([tag, n]) => /^[A-Za-z0-9]{4}$/.test(tag) && Number.isFinite(n))
    .map(([tag, n]) => `"${tag}" ${n}`);
  return parts.length ? parts.join(', ') : undefined;
}

/** `font-feature-settings` a partir da lista de tags ligadas; undefined se vazia. */
export function featureSettings(tags?: string[]): string | undefined {
  const parts = (tags || []).filter((t) => /^[A-Za-z0-9]{4}$/.test(t)).map((t) => `"${t}" 1`);
  return parts.length ? parts.join(', ') : undefined;
}

/** Liga/desliga uma tag numa lista (sem repetir; lista vazia vira undefined). */
export function toggleFeature(tags: string[] | undefined, tag: string): string[] | undefined {
  const list = tags || [];
  const next = list.includes(tag) ? list.filter((t) => t !== tag) : [...list, tag];
  return next.length ? next : undefined;
}

/** Define (ou remove, com `undefined`) um eixo; objeto vazio vira undefined. */
export function setAxis(v: Record<string, number> | undefined, tag: string, value: number | undefined): Record<string, number> | undefined {
  const next = { ...(v || {}) };
  if (value === undefined) delete next[tag];
  else next[tag] = value;
  return Object.keys(next).length ? next : undefined;
}
