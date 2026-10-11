import type { DesignStyle, DesignVariable, Shape } from './types';
import { variableValue } from './variables';

export interface Spec {
  section: 'Layout' | 'Aparência' | 'Preenchimento' | 'Traço' | 'Tipografia' | 'Efeitos' | 'Auto layout';
  label: string;
  value: string;
  /** texto a copiar (padrão: o próprio valor) */
  copy?: string;
  /** cor para mostrar a amostra */
  swatch?: string;
  /** nome do estilo/variável de design ligado */
  token?: string;
}

const n = (v: number) => String(Math.round(v * 100) / 100);

/** Nome do token (estilo ou variável de cor) que aplica a cor ao elemento, se houver. */
function fillToken(s: Shape, styles: DesignStyle[], variables: DesignVariable[]): string | undefined {
  if (s.fillVariableId) return variables.find((v) => v.id === s.fillVariableId)?.name;
  if (s.fillStyleId) return styles.find((x) => x.id === s.fillStyleId)?.name;
  return undefined;
}

/** Especificações de um elemento para o Modo Dev, com a posição relativa ao pai e os tokens de design. */
export function specsOf(s: Shape, all: Shape[], styles: DesignStyle[] = [], variables: DesignVariable[] = [], modeId = 'light'): Spec[] {
  const out: Spec[] = [];
  const parent = s.parentId ? all.find((x) => x.id === s.parentId) : undefined;
  out.push({ section: 'Layout', label: 'Posição', value: `${n(s.x - (parent?.x ?? 0))}, ${n(s.y - (parent?.y ?? 0))}`, copy: `left: ${n(s.x - (parent?.x ?? 0))}px; top: ${n(s.y - (parent?.y ?? 0))}px;` });
  out.push({ section: 'Layout', label: 'Tamanho', value: `${n(s.width)} × ${n(s.height)}`, copy: `width: ${n(s.width)}px; height: ${n(s.height)}px;` });
  if (s.rotation) out.push({ section: 'Layout', label: 'Rotação', value: `${n(s.rotation)}°`, copy: `transform: rotate(${n(s.rotation)}deg);` });
  if (s.hasAutoLayout) {
    const horizontal = s.layoutFlow === 'horizontal';
    out.push({ section: 'Auto layout', label: 'Direção', value: s.layoutFlow === 'grid' ? `Grid ${s.gridCols ?? 3} colunas` : s.layoutFlow === 'freeform' ? 'Wrap' : horizontal ? 'Horizontal' : 'Vertical' });
    out.push({ section: 'Auto layout', label: 'Espaçamento', value: `${n(s.layoutGap ?? 0)}`, copy: `gap: ${n(s.layoutGap ?? 0)}px;` });
    const p = s.independentPadding ? [s.paddingTop ?? 0, s.paddingRight ?? 0, s.paddingBottom ?? 0, s.paddingLeft ?? 0] : [s.paddingVertical ?? 0, s.paddingHorizontal ?? 0, s.paddingVertical ?? 0, s.paddingHorizontal ?? 0];
    if (p.some(Boolean)) out.push({ section: 'Auto layout', label: 'Padding', value: p.map(n).join(' / '), copy: `padding: ${p.map((x) => `${n(x)}px`).join(' ')};` });
  }
  if (s.opacity !== undefined && s.opacity < 1) out.push({ section: 'Aparência', label: 'Opacidade', value: `${Math.round(s.opacity * 100)}%`, copy: `opacity: ${n(s.opacity)};` });
  if (s.cornerRadius) out.push({ section: 'Aparência', label: 'Raio', value: `${n(s.cornerRadius)}`, copy: `border-radius: ${n(s.cornerRadius)}px;` });
  if (s.blendMode && s.blendMode !== 'normal') out.push({ section: 'Aparência', label: 'Mesclagem', value: s.blendMode, copy: `mix-blend-mode: ${s.blendMode};` });

  const isText = s.type === 'text' || s.type === 'text-path';
  const fill = s.fills?.find((f) => f.visible !== false);
  const fillColor = fill?.color ?? s.fill;
  const token = fillToken(s, styles, variables);
  const shownColor = s.fillVariableId ? variableValue(variables.find((v) => v.id === s.fillVariableId)!, modeId) : fillColor;
  if (fillColor && fillColor !== 'none' && fillColor !== 'transparent') {
    out.push({ section: isText ? 'Tipografia' : 'Preenchimento', label: isText ? 'Cor do texto' : 'Cor', value: String(shownColor).toUpperCase(), copy: String(shownColor), swatch: String(shownColor), token });
    if (fill && (fill.type === 'linear' || fill.type === 'radial') && fill.gradientStops?.length) {
      out.push({ section: 'Preenchimento', label: 'Gradiente', value: `${fill.type} · ${fill.gradientStops.map((g) => `${g.color} ${Math.round(g.position * 100)}%`).join(', ')}` });
    }
  }
  const stroke = s.strokes?.find((x) => x.visible !== false);
  const strokeColor = stroke?.color ?? (s.stroke && s.stroke !== 'none' && s.stroke !== 'transparent' ? s.stroke : undefined);
  const strokeW = stroke?.width ?? s.strokeWidth ?? 0;
  if (strokeColor && strokeW > 0) out.push({ section: 'Traço', label: `${n(strokeW)}px`, value: `${strokeColor.toUpperCase()} · ${s.strokePosition || 'inside'}`, copy: `border: ${n(strokeW)}px solid ${strokeColor};`, swatch: strokeColor });

  if (isText) {
    out.push({ section: 'Tipografia', label: 'Fonte', value: `${s.fontFamily || 'Inter'} · ${s.fontWeight || 400}`, copy: `font-family: '${s.fontFamily || 'Inter'}'; font-weight: ${s.fontWeight || 400};` });
    out.push({ section: 'Tipografia', label: 'Tamanho', value: `${n(s.fontSize || 16)}`, copy: `font-size: ${n(s.fontSize || 16)}px;` });
    if (s.lineHeight && s.lineHeight !== 'Auto') out.push({ section: 'Tipografia', label: 'Entrelinha', value: String(s.lineHeight), copy: `line-height: ${s.lineHeight};` });
    if (s.letterSpacing && s.letterSpacing !== '0%' && s.letterSpacing !== 0) out.push({ section: 'Tipografia', label: 'Espaço entre letras', value: String(s.letterSpacing), copy: `letter-spacing: ${s.letterSpacing};` });
    if (s.textStyleId) {
      const ts = styles.find((x) => x.id === s.textStyleId);
      if (ts) out.push({ section: 'Tipografia', label: 'Estilo', value: ts.name, token: ts.name });
    }
  }
  for (const e of s.effects || []) {
    if (e.visible === false) continue;
    if (e.type === 'drop-shadow') out.push({ section: 'Efeitos', label: 'Sombra', value: `${n(e.x)} ${n(e.y)} ${n(e.blur)} ${n(e.spread)} ${e.color}`, copy: `box-shadow: ${n(e.x)}px ${n(e.y)}px ${n(e.blur)}px ${n(e.spread)}px ${e.color};`, swatch: e.color });
    else if (e.type === 'inner-shadow') out.push({ section: 'Efeitos', label: 'Sombra interna', value: `${n(e.x)} ${n(e.y)} ${n(e.blur)} ${e.color}`, copy: `box-shadow: inset ${n(e.x)}px ${n(e.y)}px ${n(e.blur)}px ${e.color};` });
    else if (e.type === 'layer-blur') out.push({ section: 'Efeitos', label: 'Blur', value: `${n(e.blur)}`, copy: `filter: blur(${n(e.blur)}px);` });
    else if (e.type === 'background-blur') out.push({ section: 'Efeitos', label: 'Blur de fundo', value: `${n(e.blur)}`, copy: `backdrop-filter: blur(${n(e.blur)}px);` });
  }
  return out;
}

/** CSS do elemento (declarações separadas por linha) a partir das especificações copiáveis. */
export function cssOf(specs: Spec[]): string {
  return specs.map((x) => x.copy).filter((c): c is string => !!c && c.includes(':') && !c.startsWith('left') && !c.startsWith('top')).join('\n');
}
