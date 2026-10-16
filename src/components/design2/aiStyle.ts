import type { EffectItem, FillItem, GradientStop, Shape, StrokeItem } from './types';

/** "#RRGGBB", "#RRGGBBAA", "#RGB" ou "transparent" -> hex6 + opacidade. */
export function parseColorAlpha(v: unknown, fallback: string): { hex: string; alpha: number } {
  const c = typeof v === 'string' ? v.trim() : '';
  if (c === 'transparent') return { hex: fallback, alpha: 0 };
  const m = /^#([0-9a-fA-F]{6})([0-9a-fA-F]{2})?$/.exec(c);
  if (m) return { hex: `#${m[1].toUpperCase()}`, alpha: m[2] ? parseInt(m[2], 16) / 255 : 1 };
  const short = /^#([0-9a-fA-F]{3})$/.exec(c);
  if (short) return { hex: `#${short[1].split('').map((x) => x + x).join('').toUpperCase()}`, alpha: 1 };
  const rgba = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/.exec(c);
  if (rgba) {
    const h = [1, 2, 3].map((i) => Math.max(0, Math.min(255, parseInt(rgba[i], 10))).toString(16).padStart(2, '0')).join('').toUpperCase();
    return { hex: `#${h}`, alpha: rgba[4] != null ? Math.max(0, Math.min(1, parseFloat(rgba[4]))) : 1 };
  }
  return { hex: fallback, alpha: 1 };
}

const clamp = (v: unknown, fb: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fb;
};

let uidN = 0;
const uid = (p: string) => `${p}${(uidN++).toString(36)}`;

/** "gradient": {type, from, to | stops, angle, center, radius} -> FillItem. Alfa 0 herda a cor do outro extremo (sem "cinza" no meio). */
export function gradientToFill(g: any): FillItem | null {
  if (!g || typeof g !== 'object') return null;
  const raw: Array<{ color: unknown; at?: unknown }> = Array.isArray(g.stops) && g.stops.length >= 2 ? g.stops.slice(0, 6) : [{ color: g.from, at: 0 }, { color: g.to, at: 1 }];
  const firstHex = parseColorAlpha(raw[0].color, '#000000').hex;
  const lastHex = parseColorAlpha(raw[raw.length - 1].color, firstHex).hex;
  const stops: GradientStop[] = raw.map((st, i) => {
    const c = parseColorAlpha(st.color, firstHex);
    // alfa 0 ("#00000000"/transparent) herda a cor do extremo vizinho (evita um cinza no meio do degradê)
    const hex = c.alpha === 0 ? (i === 0 ? lastHex : parseColorAlpha(raw[0].color, lastHex).hex) : c.hex;
    return { position: typeof st.at === 'number' ? clamp(st.at, 0, 0, 1) : i / (raw.length - 1), color: hex, opacity: c.alpha };
  });
  const type = g.type === 'radial' ? 'radial' : g.type === 'angular' || g.type === 'conic' ? 'angular' : g.type === 'diamond' ? 'diamond' : 'linear';
  const center = Array.isArray(g.center) ? { x: clamp(g.center[0], 0.5, -1, 2), y: clamp(g.center[1], 0.5, -1, 2) } : g.center && typeof g.center === 'object' ? { x: clamp(g.center.x, 0.5, -1, 2), y: clamp(g.center.y, 0.5, -1, 2) } : undefined;
  const fill: FillItem = { id: uid('g'), color: stops[0].color, opacity: 1, visible: true, type, gradientStops: stops, gradientAngle: clamp(g.angle, type === 'linear' ? 180 : 0, -360, 720) };
  if (type === 'radial') {
    if (center) fill.gradientCenter = center;
    if (g.radius != null) fill.gradientRadius = clamp(g.radius, 0.5, 0.05, 4);
  }
  return fill;
}

/** Camada de preenchimento da IA ("#RRGGBBAA" | {color,opacity} | {gradient:{...}} | {type:'linear',...}) -> FillItem. */
function layerToFill(layer: unknown): FillItem | null {
  if (typeof layer === 'string') {
    const c = parseColorAlpha(layer, '#000000');
    return { id: uid('f'), color: c.hex, opacity: c.alpha, visible: true, type: 'solid' };
  }
  if (!layer || typeof layer !== 'object') return null;
  const l: any = layer;
  // textura: {"pattern":"grid|dots|lines|checker|noise","color":"#FFFFFF","opacity":0.06,"size":8,"background":"#..."}
  if (typeof l.pattern === 'string' && ['grid', 'dots', 'lines', 'checker', 'noise'].includes(l.pattern)) {
    const c = parseColorAlpha(l.color ?? '#FFFFFF', '#FFFFFF');
    const bg = l.background ? parseColorAlpha(l.background, '#000000').hex : undefined;
    return { id: uid('p'), color: c.hex, opacity: (typeof l.opacity === 'number' ? clamp(l.opacity, 0.06, 0, 1) : 0.06) * c.alpha, visible: true, type: 'pattern', patternKind: l.pattern as FillItem['patternKind'], patternScale: clamp(l.size ?? l.scale, 8, 2, 200), patternBg: bg };
  }
  const g = gradientToFill(l.gradient ?? (l.type && l.type !== 'solid' ? l : null));
  if (g) {
    if (typeof l.opacity === 'number') g.opacity = clamp(l.opacity, 1, 0, 1);
    return g;
  }
  const c = parseColorAlpha(l.color ?? l.fill, '#000000');
  return { id: uid('f'), color: c.hex, opacity: (typeof l.opacity === 'number' ? clamp(l.opacity, 1, 0, 1) : 1) * c.alpha, visible: true, type: 'solid' };
}

/** Efeitos da IA ("effects":[...] + atalhos shadow/blur/backdropBlur/noise) -> EffectItem[]. */
export function effectsFromItem(item: any): EffectItem[] {
  const list: any[] = [];
  if (Array.isArray(item.effects)) list.push(...item.effects);
  if (item.shadow) list.push(...(Array.isArray(item.shadow) ? item.shadow : [item.shadow]).map((s: any) => ({ type: 'shadow', ...s })));
  if (typeof item.blur === 'number' && item.blur > 0) list.push({ type: 'blur', blur: item.blur });
  if (typeof item.backdropBlur === 'number' && item.backdropBlur > 0) list.push({ type: 'backdrop-blur', blur: item.backdropBlur });
  if (item.noise) list.push({ type: 'noise', ...(typeof item.noise === 'object' ? item.noise : {}) });
  const out: EffectItem[] = [];
  for (const e of list.slice(0, 6)) {
    if (!e || typeof e !== 'object') continue;
    const t = String(e.type || '');
    const kind: EffectItem['type'] | null =
      t === 'shadow' || t === 'drop-shadow' ? 'drop-shadow'
      : t === 'inner-shadow' || t === 'inset' ? 'inner-shadow'
      : t === 'blur' || t === 'layer-blur' ? 'layer-blur'
      : t === 'backdrop-blur' || t === 'background-blur' || t === 'glass' ? 'background-blur'
      : t === 'noise' || t === 'grain' ? 'noise'
      : null;
    if (!kind) continue;
    const c = parseColorAlpha(e.color, kind === 'noise' ? '#FFFFFF' : '#000000');
    const base: EffectItem = {
      id: uid('e'),
      type: kind,
      color: c.hex,
      opacity: typeof e.opacity === 'number' ? clamp(e.opacity, 0.25, 0, 1) : kind === 'layer-blur' || kind === 'background-blur' ? 1 : c.alpha === 1 && kind !== 'noise' ? 0.25 : c.alpha,
      x: clamp(e.x, 0, -200, 200),
      y: clamp(e.y, kind === 'drop-shadow' || kind === 'inner-shadow' ? 4 : 0, -200, 200),
      blur: clamp(e.blur ?? e.radius, kind === 'layer-blur' || kind === 'background-blur' ? 16 : 8, 0, 400),
      spread: clamp(e.spread, 0, -100, 200),
      visible: true,
    };
    if ((kind === 'layer-blur' || kind === 'background-blur') && e.progressive) {
      // blur progressivo: cresce de "from"% a "to"% da altura/largura, na direção indicada (padrão: mais forte embaixo)
      const dir = ['bottom', 'top', 'left', 'right'].includes(String(e.progressive)) ? String(e.progressive) : String(e.direction || 'bottom');
      base.blurMode = 'progressive';
      base.blurDir = (['bottom', 'top', 'left', 'right'].includes(dir) ? dir : 'bottom') as EffectItem['blurDir'];
      base.blurStart = clamp(e.from ?? e.start, 0, 0, 100);
      base.blurEnd = clamp(e.to ?? e.end, 100, 0, 100);
    }
    if (kind === 'noise') {
      base.noiseMode = 'mono';
      base.noiseSizeX = clamp(e.size, 1.2, 0.5, 8);
      base.noiseSizeY = base.noiseSizeX;
      base.density = clamp(e.density, 0.5, 0, 1);
      base.opacity = typeof e.opacity === 'number' ? clamp(e.opacity, 0.25, 0, 1) : 0.25;
    }
    out.push(base);
  }
  return out;
}

/**
 * Estilo visual que a IA pode pedir além de cor sólida: camadas de preenchimento/degradê, borda com transparência,
 * efeitos (vidro, sombras, neomorfismo, blur, ruído), raios por canto e detalhes de texto.
 * Devolve só os campos que a IA realmente informou (o resto fica com os padrões do conversor).
 */
/** Atalho "glass":true → vidro completo (preenchimento em degradê claro, borda fina, brilho no topo, blur do fundo e sombra suave). */
function withGlass(item: any): any {
  if (!item?.glass) return item;
  const tint = typeof item.glass === 'string' && /^#[0-9a-fA-F]{6}$/.test(item.glass) ? item.glass : '#FFFFFF';
  const blur = typeof item.glass === 'object' && Number(item.glass.blur) > 0 ? Number(item.glass.blur) : 24;
  const hasFill = item.fill != null || item.fills || item.gradient;
  return {
    ...(hasFill ? {} : { fills: [{ gradient: { type: 'linear', angle: 180, from: `${tint}2E`, to: `${tint}0F` } }] }),
    ...(item.stroke != null ? {} : { stroke: `${tint}33`, strokeWidth: 1 }),
    ...(item.effects || item.backdropBlur ? {} : { effects: [{ type: 'backdrop-blur', blur }, { type: 'inner-shadow', x: 0, y: 1, blur: 0, color: `${tint}40` }, { type: 'shadow', x: 0, y: 8, blur: 24, color: '#00000026' }] }),
    ...item,
  };
}

export function styleFromItem(rawItem: any): Partial<Shape> {
  const item = withGlass(rawItem);
  const out: Partial<Shape> = {};
  const layers: unknown[] = Array.isArray(item.fills) ? item.fills.slice(0, 5) : [];
  if (item.gradient && !layers.length) layers.push({ gradient: item.gradient });
  if (layers.length) {
    // a IA descreve de baixo para cima; o canvas desenha o índice 0 por cima
    const fills = layers.map(layerToFill).filter((f): f is FillItem => !!f).reverse();
    if (fills.length) {
      out.fills = fills;
      out.fill = (fills.find((f) => f.type === 'solid') || fills[0]).color;
    }
  } else if (typeof item.fill === 'string') {
    const c = parseColorAlpha(item.fill, '#000000');
    if (c.alpha < 1 && c.alpha > 0) {
      out.fill = c.hex;
      out.fills = [{ id: uid('f'), color: c.hex, opacity: c.alpha, visible: true, type: 'solid' }]; // vidro: #FFFFFF1F
    }
  }
  if (typeof item.stroke === 'string') {
    const c = parseColorAlpha(item.stroke, '#000000');
    if (item.stroke !== 'none' && item.stroke !== 'transparent' && c.alpha < 1) {
      const strokes: StrokeItem[] = [{ id: uid('s'), color: c.hex, opacity: c.alpha, visible: true, width: clamp(item.strokeWidth, 1, 0, 40) }];
      out.stroke = c.hex;
      out.strokes = strokes;
    }
  }
  const effects = effectsFromItem(item);
  if (effects.length) out.effects = effects;
  if (Array.isArray(item.radii) && item.radii.length === 4) {
    const [tl, tr, br, bl] = item.radii.map((r: unknown) => clamp(r, 0, 0, 400));
    Object.assign(out, { independentCorners: true, topLeftRadius: tl, topRightRadius: tr, bottomRightRadius: br, bottomLeftRadius: bl });
  }
  if (typeof item.rotation === 'number') out.rotation = clamp(item.rotation, 0, -360, 360);
  return out;
}

/** Tipografia fina do texto: espaçamento entre letras (px), caixa, família, itálico, decoração. */
export function textStyleFromItem(item: any): Partial<Shape> {
  const out: Partial<Shape> = {};
  if (item.letterSpacing != null) out.letterSpacing = clamp(item.letterSpacing, 0, -10, 40);
  if (item.textCase === 'upper' || item.textCase === 'uppercase') out.textCase = 'uppercase';
  else if (item.textCase === 'lower' || item.textCase === 'lowercase') out.textCase = 'lowercase';
  else if (item.textCase === 'title') out.textCase = 'title';
  if (typeof item.fontFamily === 'string' && /^[\w\s\-]{2,40}$/.test(item.fontFamily)) out.fontFamily = item.fontFamily.trim();
  if (item.italic === true || item.fontStyle === 'italic') out.fontStyle = 'italic';
  if (item.textDecoration === 'underline' || item.textDecoration === 'line-through') out.textDecoration = item.textDecoration;
  return out;
}

// ---------- régua de medidas (consistência) ----------
/** Espaçamento (gap/padding) na grade de 4 px; 2 é aceito (ajustes finos) e abaixo de 2 vira 0. */
export function snapSpacing(n: number): number {
  if (!Number.isFinite(n) || n < 2) return 0;
  if (n < 3) return 2;
  return Math.round(n / 4) * 4;
}

const ICON_SIZES = [12, 14, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64];
/** Tamanho de ícone na escala usual (evita 17px, 23px, 26px…). */
export function snapIconSize(n: number): number {
  return ICON_SIZES.reduce((best, s) => (Math.abs(s - n) < Math.abs(best - n) ? s : best), ICON_SIZES[0]);
}

/** Dimensão fixa em número par (bordas nítidas e centralização sem meio pixel). */
export function snapDimension(n: number): number {
  return Math.max(0, Math.round(n / 2) * 2);
}
