import type { Shape } from './types';
import { extractJson } from './aiScreenFromLlm';

/** Design tokens do projeto: quando definidos, TODA geração/edição da IA segue estes valores. */
export interface DesignTokens {
  /** Cada cor tem o valor do modo escuro e do modo claro; "mode" é o que a IA usa (o outro vai como referência) */
  colors: Array<{ name: string; dark: string; light: string }>;
  mode: 'dark' | 'light';
  /** false = a IA ignora os tokens (ficam salvos, mas não são aplicados) */
  enabled?: boolean;
  fontFamily: string;
  type: Array<{ name: string; size: number; weight: number; lineHeight?: number; letterSpacing?: number }>;
  spacing: number[];
  radii: Array<{ name: string; value: number }>;
  shadows: Array<{ name: string; y: number; blur: number; color: string }>;
}

export const DEFAULT_TOKENS: DesignTokens = {
  colors: [
    { name: 'background', dark: '#0F0F10', light: '#FFFFFF' },
    { name: 'surface', dark: '#1A1A1C', light: '#F4F4F5' },
    { name: 'primary', dark: '#F59333', light: '#EA7A12' },
    { name: 'accent', dark: '#34D399', light: '#059669' },
    { name: 'text', dark: '#FFFFFF', light: '#18181B' },
    { name: 'text-secondary', dark: '#9CA3AF', light: '#52525B' },
    { name: 'border', dark: '#2A2A2E', light: '#E4E4E7' },
    { name: 'danger', dark: '#EF4444', light: '#DC2626' },
  ],
  mode: 'dark',
  fontFamily: 'Poppins',
  type: [
    { name: 'display', size: 32, weight: 700 },
    { name: 'title', size: 24, weight: 600 },
    { name: 'subtitle', size: 18, weight: 600 },
    { name: 'body', size: 14, weight: 400 },
    { name: 'caption', size: 12, weight: 400 },
  ],
  spacing: [4, 8, 12, 16, 24, 32, 48],
  radii: [
    { name: 'sm', value: 8 },
    { name: 'md', value: 12 },
    { name: 'lg', value: 20 },
    { name: 'full', value: 999 },
  ],
  shadows: [
    { name: 'sm', y: 2, blur: 8, color: '#00000026' },
    { name: 'md', y: 8, blur: 24, color: '#00000040' },
  ],
};

const HEX = /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/;
const clampNum = (v: unknown, lo: number, hi: number, def: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);

/** Aceita o JSON da IA/arquivo e devolve tokens válidos (ignora o que não faz sentido). Null se não sobrou nada útil. */
export function normalizeTokens(d: any): DesignTokens | null {
  if (!d || typeof d !== 'object') return null;
  const hex = (v: unknown) => (typeof v === 'string' && HEX.test(v.trim()) ? v.trim().toUpperCase() : null);
  const colors = (Array.isArray(d.colors) ? d.colors : [])
    .map((c: any) => {
      if (!c || typeof c.name !== 'string') return null;
      const legacy = hex(c.value);
      const dark = hex(c.dark) || legacy || hex(c.light);
      const light = hex(c.light) || legacy || dark;
      return dark && light ? { name: String(c.name).trim().slice(0, 24), dark, light } : null;
    })
    .filter(Boolean)
    .slice(0, 24) as Array<{ name: string; dark: string; light: string }>;
  const type = (Array.isArray(d.type) ? d.type : [])
    .filter((t: any) => t && typeof t.name === 'string' && typeof t.size === 'number')
    .slice(0, 12)
    .map((t: any) => ({ name: String(t.name).slice(0, 20), size: Math.round(clampNum(t.size, 8, 120, 14)), weight: Math.round(clampNum(t.weight, 100, 900, 400)), ...(typeof t.lineHeight === 'number' ? { lineHeight: t.lineHeight } : {}), ...(typeof t.letterSpacing === 'number' ? { letterSpacing: t.letterSpacing } : {}) }));
  const spacing = (Array.isArray(d.spacing) ? d.spacing : [])
    .filter((n: any) => typeof n === 'number' && n > 0 && n <= 200)
    .map((n: number) => Math.round(n));
  const radii = (Array.isArray(d.radii) ? d.radii : [])
    .filter((r: any) => r && typeof r.name === 'string' && typeof r.value === 'number')
    .slice(0, 8)
    .map((r: any) => ({ name: String(r.name).slice(0, 16), value: Math.round(clampNum(r.value, 0, 999, 8)) }));
  const shadows = (Array.isArray(d.shadows) ? d.shadows : [])
    .filter((s: any) => s && typeof s.name === 'string')
    .slice(0, 6)
    .map((s: any) => ({ name: String(s.name).slice(0, 16), y: Math.round(clampNum(s.y, 0, 80, 4)), blur: Math.round(clampNum(s.blur, 0, 200, 12)), color: typeof s.color === 'string' && HEX.test(s.color) ? s.color.toUpperCase() : '#00000033' }));
  const fontFamily = typeof d.fontFamily === 'string' && /^[\w\s\-]{2,40}$/.test(d.fontFamily) ? d.fontFamily.trim() : 'Poppins';
  if (!colors.length && !type.length && !spacing.length && !radii.length) return null;
  return {
    colors: colors.length ? colors : DEFAULT_TOKENS.colors,
    mode: d.mode === 'light' ? 'light' : 'dark',
    ...(d.enabled === false ? { enabled: false } : {}),
    fontFamily,
    type: type.length ? type : DEFAULT_TOKENS.type,
    spacing: [...new Set<number>(spacing.length ? spacing : DEFAULT_TOKENS.spacing)].sort((a, b) => a - b),
    radii: radii.length ? radii : DEFAULT_TOKENS.radii,
    shadows,
  };
}

export function parseTokens(raw: string): DesignTokens | null {
  return normalizeTokens(extractJson(raw));
}

/** Valor da cor no modo ativo dos tokens. */
export const tokenColor = (c: { dark: string; light: string }, mode: 'dark' | 'light') => (mode === 'light' ? c.light : c.dark);

/** Bloco de regras para os prompts da IA (criação, edição e plano). */
export function tokensPromptBlock(t?: DesignTokens | null): string {
  if (!t) return '';
  return `DESIGN TOKENS DO PROJETO (OBRIGATÓRIO — todo elemento criado ou alterado usa SOMENTE estes valores; não invente outros):
- Modo de cores ativo: ${t.mode === 'light' ? 'CLARO' : 'ESCURO'}. Cores: ${t.colors.map((c) => `${c.name} ${tokenColor(c, t.mode)}`).join(', ')}. Fundos, superfícies, textos, bordas e botões usam estas cores (transparências delas com alfa #RRGGBBAA são permitidas; fotos livres). Valores do modo ${t.mode === 'light' ? 'escuro' : 'claro'} (só se o pedido for para esse modo): ${t.colors.map((c) => `${c.name} ${tokenColor(c, t.mode === 'light' ? 'dark' : 'light')}`).join(', ')}.
- Fonte: ${t.fontFamily} em todos os textos. Escala tipográfica (fontSize/fontWeight): ${t.type.map((x) => `${x.name} ${x.size}px/${x.weight}`).join(', ')}.
- Espaçamentos (gap, padding, margens): ${t.spacing.join(', ')} px.
- Raios (cornerRadius): ${t.radii.map((r) => `${r.name} ${r.value}`).join(', ')}.
${t.shadows.length ? `- Sombras: ${t.shadows.map((s) => `${s.name} (y ${s.y}, blur ${s.blur}, ${s.color})`).join(', ')}.\n` : ''}`;
}

const nearest = (n: number, list: number[]) => list.reduce((best, v) => (Math.abs(v - n) < Math.abs(best - n) ? v : best), list[0]);

export const snapSpaceToTokens = (n: number, t?: DesignTokens | null): number => (!t || n <= 0 ? n : nearest(n, [0, ...t.spacing]));
export const snapRadiusToTokens = (n: number, t?: DesignTokens | null): number => (!t || n <= 0 ? n : nearest(n, [0, ...t.radii.map((r) => r.value)]));
/** Tamanho de fonte da escala mais próximo (e o peso do nível escolhido, se o texto não definir um peso). */
export function snapTypeToTokens(size: number, t?: DesignTokens | null): { size: number; weight?: number } {
  if (!t || !t.type.length) return { size };
  const best = t.type.reduce((b, x) => (Math.abs(x.size - size) < Math.abs(b.size - size) ? x : b), t.type[0]);
  return { size: best.size, weight: best.weight };
}

/** Deduz tokens do design atual (sem IA): cores mais usadas, fonte, escala tipográfica, raios e espaçamentos. */
export function tokensFromShapes(all: Shape[]): DesignTokens | null {
  const shapes = all.filter((s) => s.visible !== false && !s.deviceChrome);
  if (shapes.length < 3) return null;
  const count = <T,>(m: Map<T, number>, k: T) => m.set(k, (m.get(k) || 0) + 1);
  const colors = new Map<string, number>(), fonts = new Map<string, number>(), sizes = new Map<number, number>(), radii = new Map<number, number>(), gaps = new Map<number, number>();
  const wByS = new Map<number, number>();
  for (const s of shapes) {
    const c = (s.fills?.find((f) => f.type === 'solid' || !f.type)?.color || s.fill || '').toUpperCase();
    if (/^#[0-9A-F]{6}$/.test(c)) count(colors, c);
    if (s.type === 'text') {
      count(fonts, s.fontFamily || 'Poppins');
      const z = Math.round(s.fontSize || 16);
      count(sizes, z);
      wByS.set(z, Number(s.fontWeight) || 400);
    }
    if (s.cornerRadius) count(radii, Math.round(s.cornerRadius));
    if (s.hasAutoLayout) {
      for (const v of [s.layoutGap, s.paddingHorizontal, s.paddingVertical, s.paddingTop, s.paddingLeft]) if (typeof v === 'number' && v > 0) count(gaps, Math.round(v));
    }
  }
  const top = <T,>(m: Map<T, number>, n: number) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([k]) => k);
  const palette = top(colors, 8);
  const names = ['background', 'surface', 'primary', 'accent', 'text', 'text-secondary', 'border', 'extra'];
  const sizeList = top(sizes, 5).sort((a, b) => b - a);
  const typeNames = ['display', 'title', 'subtitle', 'body', 'caption'];
  const radiusList = top(radii, 4).sort((a, b) => a - b);
  const radiusNames = ['sm', 'md', 'lg', 'xl'];
  return normalizeTokens({
    colors: palette.map((value, i) => ({ name: names[i] || `cor-${i + 1}`, dark: value, light: value })),
    fontFamily: top(fonts, 1)[0] || 'Poppins',
    type: sizeList.map((size, i) => ({ name: typeNames[Math.min(i + (5 - sizeList.length), 4)] || `t${i}`, size, weight: wByS.get(size) || 400 })),
    spacing: top(gaps, 7).sort((a, b) => a - b),
    radii: radiusList.map((value, i) => ({ name: radiusNames[i] || `r${i}`, value })),
    shadows: [],
  });
}

/** Qual(is) modo(s) de cor o pedido menciona: "claro/light/lightmode" e/ou "escuro/dark/darkmode". */
export function modesInPrompt(prompt: string): { dark: boolean; light: boolean } {
  const p = prompt.toLowerCase();
  return { dark: /\b(escuro|escura|dark|darkmode|dark mode|noturno)\b/.test(p), light: /\b(claro|clara|light|lightmode|light mode|diurno)\b/.test(p) };
}

/**
 * Garante o escopo do pedido sobre o que a IA devolveu: se só um modo foi citado, o outro modo das cores que já existiam
 * volta ao valor anterior; "use/ative o modo X" troca o modo ativo; sem isso o modo ativo é preservado.
 */
export function applyModeScope(prompt: string, current: DesignTokens | null, next: DesignTokens): DesignTokens {
  if (!current) return next;
  const m = modesInPrompt(prompt);
  const prev = new Map(current.colors.map((c) => [c.name, c]));
  let colors = next.colors;
  if (m.dark !== m.light) {
    colors = next.colors.map((c) => {
      const old = prev.get(c.name);
      if (!old) return c;
      return m.dark ? { ...c, light: old.light } : { ...c, dark: old.dark };
    });
  }
  let mode = current.mode;
  const wantsMode = /\b(use|usar|ative|ativar)\b[^.]*\b(modo|mode)\b/i.test(prompt) || /\b(mude|mudar|troque|trocar|passe|passar|deixe|deixar)\s+(para|pro|pra)\s+(o\s+)?(modo|mode)\b/i.test(prompt) || /\b(modo|mode)\s+(ativo|padr[aã]o|principal)\b/i.test(prompt);
  if (wantsMode && m.dark !== m.light) mode = m.light ? 'light' : 'dark';
  return { ...next, colors, mode };
}

/** Pedido de geração/edição de tokens (texto e/ou imagens de referência de outro projeto). */
export function buildTokensGenPrompt(o: { prompt?: string; imagePaths?: string[]; projectContext?: string; current?: DesignTokens | null }): string {
  return `Você é um designer de sistemas de design sênior. Você cria e edita os DESIGN TOKENS de um produto digital. Responda SEMPRE com o JSON COMPLETO dos tokens (sem markdown, sem texto antes ou depois), em minificado.

COMO OS TOKENS FUNCIONAM:
- "colors": cada cor tem um nome semântico e DOIS valores: "dark" = valor no MODO ESCURO (dark mode, tema escuro) e "light" = valor no MODO CLARO (light mode, tema claro). Os dois valores representam o MESMO papel (ex.: "background" é quase preto no escuro e quase branco no claro; "text" é branco no escuro e quase preto no claro; "primary" costuma ser a mesma matiz com luminosidade ajustada em cada modo).
- "mode": qual modo a IA usa ao gerar telas ("dark" ou "light"). Só mude se o pedido disser para usar/ativar um modo.
- "fontFamily" e "type": família e escala tipográfica (display, title, subtitle, body, caption: tamanho em px e peso 100–900).
- "spacing": escala de espaçamentos em px (múltiplos de 4). "radii": raios de borda (sm, md, lg, full=999). "shadows": sombras (y, blur, cor com alfa).

COMO INTERPRETAR O PEDIDO (português do Brasil):
- Cite "modo escuro / dark / darkmode" → altere SÓ os valores "dark". Cite "modo claro / light / lightmode" → altere SÓ os valores "light". Não cite modo → altere os dois de forma coerente (ex.: "troque a cor primária para azul" → azul no escuro e um azul equivalente no claro).
- "crie/gere o modo claro (ou escuro)" quando só um modo existe de verdade → derive o outro modo de cada cor (inverta luminosidade de fundos/textos/bordas, mantenha a identidade de primary/accent).
- "adicione/crie a cor X" → nova cor com nome em kebab-case e os dois valores. "remova a cor X" → tire do JSON.
- "aumente/diminua o título/corpo", "fonte X", "pesos", "mais espaço", "cantos mais arredondados/quadrados", "sombras mais suaves" → altere só os campos correspondentes (type, fontFamily, spacing, radii, shadows).
- Com TOKENS ATUAIS: devolva o JSON completo ATUALIZADO, preservando exatamente tudo que o pedido não mencionou (nomes, valores e ordem). Sem TOKENS ATUAIS: crie um conjunto completo do zero.
${o.prompt ? `\nPEDIDO DO USUÁRIO: ${o.prompt}\n` : ''}${o.imagePaths?.length ? `\nIMAGENS DE REFERÊNCIA (abra cada arquivo e extraia o sistema visual: paleta real em hex, fonte parecida, escala tipográfica real, raios, espaçamentos e sombras; ignore o conteúdo/marca). O modo da imagem (escuro ou claro) vira "mode" e os valores dessa imagem vão no modo correspondente; derive o modo oposto:\n${o.imagePaths.map((p) => `- ${p}`).join('\n')}\n` : ''}${o.projectContext ? `\nCONTEXTO DO PROJETO: ${o.projectContext.slice(0, 1500)}\n` : ''}${o.current ? `\nTOKENS ATUAIS:\n${JSON.stringify(o.current)}\n` : ''}
FORMATO (exemplo da estrutura, não dos valores):
{"mode":"dark","colors":[{"name":"background","dark":"#0F0F10","light":"#FFFFFF"},{"name":"surface","dark":"#1A1A1C","light":"#F4F4F5"},{"name":"primary","dark":"#F59333","light":"#EA7A12"},{"name":"accent","dark":"#34D399","light":"#059669"},{"name":"text","dark":"#FFFFFF","light":"#18181B"},{"name":"text-secondary","dark":"#9CA3AF","light":"#52525B"},{"name":"border","dark":"#2A2A2E","light":"#E4E4E7"},{"name":"danger","dark":"#EF4444","light":"#DC2626"}],"fontFamily":"Poppins","type":[{"name":"display","size":32,"weight":700},{"name":"title","size":24,"weight":600},{"name":"subtitle","size":18,"weight":600},{"name":"body","size":14,"weight":400},{"name":"caption","size":12,"weight":400}],"spacing":[4,8,12,16,24,32,48],"radii":[{"name":"sm","value":8},{"name":"md","value":12},{"name":"lg","value":20},{"name":"full","value":999}],"shadows":[{"name":"sm","y":2,"blur":8,"color":"#00000026"},{"name":"md","y":8,"blur":24,"color":"#00000040"}]}
REGRAS: 6 a 12 cores com nomes semânticos (background, surface, primary, accent, text, text-secondary, border, success, warning, danger…); cores sempre #RRGGBB; espaçamentos múltiplos de 4; 4 a 6 níveis tipográficos. Com um pedido de EDIÇÃO não troque os valores de exemplo acima: eles são só o formato.`;
}

const rgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
/** Cor opaca (#RRGGBB) muito próxima de um token vira exatamente o token; transparentes e cores distantes ficam como estão. */
export function snapColorToTokens(c: string, t?: DesignTokens | null, maxDist = 40): string {
  if (!t || !/^#[0-9a-fA-F]{6}$/.test(c)) return c;
  const a = rgb(c);
  let best = c, bestD = Infinity;
  for (const k of t.colors) {
    for (const v of [k.dark, k.light]) {
      const b = rgb(v.slice(0, 7));
      const d = Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
      if (d < bestD) { bestD = d; best = v.slice(0, 7); }
    }
  }
  return bestD <= maxDist ? best : c;
}

// ---------------------------------------------------------------------------------------------------------
// Paleta aleatória (estilo Coolors: esquemas de cores harmônicos) e geração de seções com IA
// ---------------------------------------------------------------------------------------------------------

function hslToHex(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(100, s)) / 100;
  l = Math.max(0, Math.min(100, l)) / 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return '#' + [f(0), f(8), f(4)].map((x) => Math.round(x * 255).toString(16).padStart(2, '0')).join('').toUpperCase();
}

const SCHEMES = ['analogous', 'complementary', 'triadic', 'split', 'mono'] as const;
const ROLES = ['background', 'surface', 'primary', 'accent', 'text', 'text-secondary', 'border'];

/**
 * Nova paleta harmônica (matiz base + esquema de cores: análogo, complementar, tríade, complementar dividido, monocromático),
 * com os dois modos. Só troca as funções conhecidas (background, surface, primary, accent, text, text-secondary, border);
 * as demais cores (success, danger, etc.) ficam como estão.
 */
export function randomizePalette(t: DesignTokens, rnd: () => number = Math.random): DesignTokens {
  const r = (lo: number, hi: number) => lo + rnd() * (hi - lo);
  const hue = r(0, 360);
  const scheme = SCHEMES[Math.floor(rnd() * SCHEMES.length)];
  const accentHue = { analogous: hue + r(25, 40), complementary: hue + 180, triadic: hue + 120, split: hue + 150, mono: hue }[scheme];
  const monoShift = scheme === 'mono' ? 12 : 0;
  const tint = r(8, 28);
  const pal: Record<string, { dark: string; light: string }> = {
    background: { dark: hslToHex(hue, tint, r(5, 9)), light: hslToHex(hue, tint + 10, r(97, 99)) },
    surface: { dark: hslToHex(hue, tint, r(10, 14)), light: hslToHex(hue, tint + 5, r(93, 96)) },
    primary: { dark: hslToHex(hue, r(62, 90), r(52, 62)), light: hslToHex(hue, r(62, 90), r(42, 52)) },
    accent: { dark: hslToHex(accentHue, r(55, 85), r(50 + monoShift, 62 + monoShift)), light: hslToHex(accentHue, r(55, 85), r(40 + monoShift, 50 + monoShift)) },
    text: { dark: hslToHex(hue, 12, r(94, 98)), light: hslToHex(hue, r(20, 35), r(8, 14)) },
    'text-secondary': { dark: hslToHex(hue, 10, r(60, 68)), light: hslToHex(hue, 14, r(34, 42)) },
    border: { dark: hslToHex(hue, tint, r(18, 24)), light: hslToHex(hue, tint + 5, r(86, 90)) },
  };
  return { ...t, colors: t.colors.map((c) => (ROLES.includes(c.name) ? { ...c, ...pal[c.name] } : c)) };
}

export type TokenSection = 'type' | 'spacing' | 'radii';

const SECTION_HELP: Record<TokenSection, { label: string; keys: string; shape: string }> = {
  type: { label: 'a TIPOGRAFIA (família da fonte e escala tipográfica)', keys: '"fontFamily" e "type"', shape: '{"fontFamily":"Inter","type":[{"name":"display","size":36,"weight":700},{"name":"title","size":26,"weight":600},{"name":"subtitle","size":18,"weight":600},{"name":"body","size":15,"weight":400},{"name":"caption","size":12,"weight":400}]}' },
  spacing: { label: 'a ESCALA DE ESPAÇAMENTOS (px)', keys: '"spacing"', shape: '{"spacing":[2,4,8,12,16,24,32,48,64]}' },
  radii: { label: 'os RAIOS DE BORDA', keys: '"radii"', shape: '{"radii":[{"name":"sm","value":6},{"name":"md","value":12},{"name":"lg","value":24},{"name":"full","value":999}]}' },
};
const FLAVORS = ['compacto e denso', 'arejado e generoso', 'clássico e equilibrado', 'moderno e marcante', 'suave e amigável', 'técnico e preciso'];

/** Pede à IA uma NOVA versão de uma seção (diferente da atual), coerente com o resto dos tokens. Devolve só essa seção. */
export function buildTokensSectionPrompt(section: TokenSection, current: DesignTokens, rnd: () => number = Math.random): string {
  const h = SECTION_HELP[section];
  const flavor = FLAVORS[Math.floor(rnd() * FLAVORS.length)];
  return `Você é um designer de sistemas de design sênior. Crie uma NOVA proposta para ${h.label} de um design system, DIFERENTE da atual, com personalidade "${flavor}", coerente com as cores e o estilo já definidos.

TOKENS ATUAIS (contexto): ${JSON.stringify(current)}

Responda SOMENTE com JSON minificado (sem markdown) contendo apenas ${h.keys}. Exemplo do formato (os valores são só ilustração, não copie): ${h.shape}
Regras: espaçamentos múltiplos de 4 (pode incluir 2); níveis tipográficos display > title > subtitle > body > caption com tamanhos decrescentes e pesos 100–900; raios com "full": 999.`;
}

/** Lê a resposta da IA e devolve os tokens atuais com SÓ a seção trocada (null se a resposta não servir). */
export function applyTokensSection(section: TokenSection, current: DesignTokens, raw: string): DesignTokens | null {
  const d = extractJson(raw);
  if (!d || typeof d !== 'object') return null;
  const probe = normalizeTokens({ ...current, ...(section === 'type' ? { type: d.type, ...(d.fontFamily ? { fontFamily: d.fontFamily } : {}) } : section === 'spacing' ? { spacing: d.spacing } : { radii: d.radii }) });
  if (!probe) return null;
  const got = section === 'type' ? Array.isArray(d.type) && d.type.length : section === 'spacing' ? Array.isArray(d.spacing) && d.spacing.length : Array.isArray(d.radii) && d.radii.length;
  if (!got) return null;
  if (section === 'type') return { ...current, type: probe.type, fontFamily: probe.fontFamily };
  if (section === 'spacing') return { ...current, spacing: probe.spacing };
  return { ...current, radii: probe.radii };
}
