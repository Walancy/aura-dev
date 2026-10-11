import type { DesignStyle, DesignVariable, Shape } from './types';
import { variableValue } from './variables';

export type AuditKind = 'contrast' | 'small-text' | 'touch' | 'drift-color' | 'drift-font';
export type AuditFix =
  | { type: 'set'; patch: Partial<Shape>; label: string }
  | { type: 'bind-fill-style'; styleId: string; label: string }
  | { type: 'bind-fill-variable'; variableId: string; label: string }
  | { type: 'bind-text-style'; styleId: string; label: string };

export interface AuditIssue {
  id: string;
  shapeId: string;
  kind: AuditKind;
  severity: 'error' | 'warning' | 'info';
  message: string;
  fix?: AuditFix;
}

/** "#rgb", "#rrggbb" ou "#rrggbbaa" → [r,g,b] (0–255); outra coisa → null */
export function parseColor(c?: string): [number, number, number] | null {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec((c || '').trim());
  if (!m) return null;
  let h = m[1];
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

const channel = (v: number) => {
  const s = v / 255;
  return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
};
const luminance = ([r, g, b]: [number, number, number]) => 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);

/** Razão de contraste WCAG entre duas cores (1 a 21). */
export function contrastRatio(a: string, b: string): number | null {
  const ca = parseColor(a);
  const cb = parseColor(b);
  if (!ca || !cb) return null;
  const [hi, lo] = [luminance(ca), luminance(cb)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

/** Texto grande (WCAG): ≥ 24px, ou ≥ 18.66px em negrito. Pede 3:1; o resto pede 4.5:1. */
export const isLargeText = (fontSize: number, weight: number | string | undefined) => fontSize >= 24 || (fontSize >= 18.66 && Number(weight) >= 700);

const solidFill = (s: Shape): string | undefined => {
  const f = s.fills?.find((x: any) => x.visible !== false && (x.type === undefined || x.type === 'solid') && (x.opacity ?? 1) > 0.95) as any;
  const c = f?.color ?? (s.fills?.length ? undefined : s.fill);
  return parseColor(c) ? c : undefined;
};

const dist = (a: [number, number, number], b: [number, number, number]) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

/** Fundo sólido que está atrás do texto: o elemento mais alto abaixo dele que contém o seu centro. */
function backgroundOf(shapes: Shape[], text: Shape): string | undefined {
  const cx = text.x + text.width / 2;
  const cy = text.y + text.height / 2;
  const behind = shapes
    .filter((s) => s.id !== text.id && s.visible !== false && s.type !== 'text' && s.zIndex < text.zIndex && cx >= s.x && cx <= s.x + s.width && cy >= s.y && cy <= s.y + s.height && (s.opacity ?? 1) > 0.95)
    .sort((a, b) => b.zIndex - a.zIndex);
  for (const s of behind) {
    const c = solidFill(s);
    if (c) return c;
    // por cima há um degradê/imagem: o fundo real é desconhecido, então não julga (nem usa o que está embaixo)
    if (s.fills?.some((f: any) => f.visible !== false && f.type && f.type !== 'solid') || s.imageUrl) return undefined;
  }
  return undefined;
}

export interface AuditOptions {
  minFontSize?: number;
  minTouch?: number;
}

/**
 * Revisão do design: contraste (WCAG), texto pequeno, alvos de toque e desvio do sistema (cores e tipografia fora
 * dos estilos/variáveis). Tudo determinístico, sem IA.
 */
export function auditDesign(shapes: Shape[], styles: DesignStyle[] = [], variables: DesignVariable[] = [], modeId = 'light', opts: AuditOptions = {}): AuditIssue[] {
  const minFont = opts.minFontSize ?? 12;
  const minTouch = opts.minTouch ?? 44;
  const issues: AuditIssue[] = [];
  const colorStyles = styles.filter((s): s is Extract<DesignStyle, { kind: 'color' }> => s.kind === 'color');
  const textStyles = styles.filter((s): s is Extract<DesignStyle, { kind: 'text' }> => s.kind === 'text');
  const colorVars = variables.filter((v) => v.kind === 'color');
  type Pal = { rgb: [number, number, number]; fix: AuditFix };
  const palette: Pal[] = [];
  for (const st of colorStyles) {
    const rgb = parseColor(st.color);
    if (rgb) palette.push({ rgb, fix: { type: 'bind-fill-style', styleId: st.id, label: `Usar o estilo "${st.name}"` } });
  }
  for (const v of colorVars) {
    const rgb = parseColor(variableValue(v, modeId));
    if (rgb) palette.push({ rgb, fix: { type: 'bind-fill-variable', variableId: v.id, label: `Usar a variável "${v.name}"` } });
  }

  for (const s of shapes) {
    if (s.visible === false || s.deviceChrome) continue;
    const isText = s.type === 'text' || s.type === 'text-path';
    if (isText) {
      const size = s.fontSize || 16;
      const fg = solidFill(s);
      const bg = backgroundOf(shapes, s);
      if (fg && bg) {
        const ratio = contrastRatio(fg, bg);
        const need = isLargeText(size, s.fontWeight) ? 3 : 4.5;
        if (ratio !== null && ratio < need) {
          const black = contrastRatio('#000000', bg) ?? 0;
          const white = contrastRatio('#FFFFFF', bg) ?? 0;
          const best = black >= white ? '#000000' : '#FFFFFF';
          issues.push({ id: `${s.id}:contrast`, shapeId: s.id, kind: 'contrast', severity: 'error', message: `Contraste ${ratio.toFixed(2)}:1 (mínimo ${need}:1)`, fix: { type: 'set', patch: { fill: best }, label: `Usar ${best === '#000000' ? 'preto' : 'branco'} (${Math.max(black, white).toFixed(1)}:1)` } });
        }
      }
      if (size < minFont) issues.push({ id: `${s.id}:small`, shapeId: s.id, kind: 'small-text', severity: 'warning', message: `Texto de ${size}px (menor que ${minFont}px)`, fix: { type: 'set', patch: { fontSize: minFont }, label: `Aumentar para ${minFont}px` } });
      if (textStyles.length && !s.textStyleId) {
        const match = textStyles.find((t) => (t.fontFamily ?? s.fontFamily) === s.fontFamily && t.fontSize === s.fontSize && String(t.fontWeight ?? s.fontWeight) === String(s.fontWeight));
        if (match) issues.push({ id: `${s.id}:font`, shapeId: s.id, kind: 'drift-font', severity: 'info', message: `Tipografia igual ao estilo "${match.name}", mas não vinculada`, fix: { type: 'bind-text-style', styleId: match.id, label: `Vincular a "${match.name}"` } });
      }
    }
    if (s.prototypeLink && Math.min(s.width, s.height) < minTouch) {
      issues.push({ id: `${s.id}:touch`, shapeId: s.id, kind: 'touch', severity: 'warning', message: `Alvo de toque de ${Math.round(s.width)}×${Math.round(s.height)} (mínimo ${minTouch}px)`, fix: { type: 'set', patch: { width: Math.max(s.width, minTouch), height: Math.max(s.height, minTouch) }, label: `Aumentar para ${minTouch}px` } });
    }
    if (palette.length && !isText && !s.fillStyleId && !s.fillVariableId) {
      const c = solidFill(s);
      const rgb = parseColor(c);
      if (c && rgb) {
        const best = palette.map((p) => ({ p, d: dist(rgb, p.rgb) })).sort((a, b) => a.d - b.d)[0];
        if (best.d === 0) issues.push({ id: `${s.id}:color`, shapeId: s.id, kind: 'drift-color', severity: 'info', message: 'Cor igual à do sistema, mas não vinculada', fix: best.p.fix });
        else if (best.d <= 40) issues.push({ id: `${s.id}:color`, shapeId: s.id, kind: 'drift-color', severity: 'warning', message: `Cor ${c} fora do sistema, parecida com uma existente`, fix: best.p.fix });
      }
    }
  }
  return issues;
}

/** Corrige sozinho só o contraste de texto (usado no resultado da IA): troca a cor do texto por preto ou branco. */
export function fixContrast(shapes: Shape[]): Shape[] {
  return auditDesign(shapes)
    .filter((i) => i.kind === 'contrast' && i.fix)
    .reduce((acc, i) => applyAuditFix(acc, i), shapes);
}

/** Aplica a correção sugerida. */
export function applyAuditFix(shapes: Shape[], issue: AuditIssue): Shape[] {
  const fix = issue.fix;
  if (!fix) return shapes;
  return shapes.map((s) => {
    if (s.id !== issue.shapeId) return s;
    if (fix.type === 'set') return { ...s, ...fix.patch };
    if (fix.type === 'bind-fill-style') return { ...s, fillStyleId: fix.styleId };
    if (fix.type === 'bind-fill-variable') return { ...s, fillVariableId: fix.variableId };
    return { ...s, textStyleId: fix.styleId };
  });
}
