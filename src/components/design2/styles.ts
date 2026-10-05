import type { DesignStyle, Shape } from './types';

/** Propaga os estilos do documento para os shapes que os usam (cor do preenchimento e tipografia). */
export function applyStyles(shapes: Shape[], styles: DesignStyle[]): Shape[] {
  if (styles.length === 0 || !shapes.some((s) => s.fillStyleId || s.textStyleId)) return shapes;
  const byId = new Map(styles.map((st) => [st.id, st]));
  let changed = false;
  const out = shapes.map((s) => {
    let next = s;
    const fillStyle = s.fillStyleId ? byId.get(s.fillStyleId) : undefined;
    if (fillStyle?.kind === 'color') {
      const first = s.fills && s.fills.length > 0 ? s.fills[0] : null;
      const needs = first ? first.color !== fillStyle.color || first.opacity !== fillStyle.opacity : s.fill !== fillStyle.color;
      if (needs) {
        next = {
          ...next,
          fill: fillStyle.color,
          ...(first ? { fills: s.fills!.map((f, i) => (i === 0 ? { ...f, color: fillStyle.color, opacity: fillStyle.opacity } : f)) } : {}),
        };
      }
    }
    const textStyle = s.textStyleId ? byId.get(s.textStyleId) : undefined;
    if (textStyle?.kind === 'text') {
      const patch: Partial<Shape> = {};
      if (textStyle.fontFamily !== undefined && s.fontFamily !== textStyle.fontFamily) patch.fontFamily = textStyle.fontFamily;
      if (textStyle.fontSize !== undefined && s.fontSize !== textStyle.fontSize) patch.fontSize = textStyle.fontSize;
      if (textStyle.fontWeight !== undefined && s.fontWeight !== textStyle.fontWeight) patch.fontWeight = textStyle.fontWeight;
      if (textStyle.letterSpacing !== undefined && s.letterSpacing !== textStyle.letterSpacing) patch.letterSpacing = textStyle.letterSpacing;
      if (textStyle.lineHeight !== undefined && s.lineHeight !== textStyle.lineHeight) patch.lineHeight = textStyle.lineHeight;
      if (Object.keys(patch).length) next = { ...next, ...patch };
    }
    if (next !== s) changed = true;
    return next;
  });
  return changed ? out : shapes;
}

export function colorStyleFromShape(shape: Shape, id: string, name: string): DesignStyle {
  const first = shape.fills && shape.fills.length > 0 ? shape.fills[0] : null;
  return { id, name, kind: 'color', color: first?.color || shape.fill || '#D9D9D9', opacity: first?.opacity ?? 1 };
}

export function textStyleFromShape(shape: Shape, id: string, name: string): DesignStyle {
  return {
    id,
    name,
    kind: 'text',
    fontFamily: shape.fontFamily,
    fontSize: shape.fontSize,
    fontWeight: shape.fontWeight,
    letterSpacing: shape.letterSpacing,
    lineHeight: shape.lineHeight,
  };
}
