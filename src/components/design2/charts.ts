import type { FillItem, Shape, StrokeItem } from './types';
import { parseColorAlpha } from './aiStyle';

/**
 * Gráficos descritos pela IA só com dados ({"type":"chart","kind":"line|area|bar|donut",...}); o app calcula a geometria
 * (curva suave, barras, trilhos, grade, marcador e legenda) em vez de a IA tentar desenhar pontos com x/y.
 */
export interface ChartSpec {
  kind: 'line' | 'area' | 'bar' | 'donut';
  data: number[];
  labels?: string[];
  color?: string;
  colors?: string[];
  fillArea?: boolean;
  smooth?: boolean;
  grid?: boolean | number;
  gridColor?: string;
  labelColor?: string;
  labelSize?: number;
  strokeWidth?: number;
  /** ponto destacado (marcador + etiqueta tipo tooltip) */
  highlight?: { index: number; label?: string };
  /** barras: trilho de fundo (cor), valores dentro/acima, raio, proporção do espaço entre barras (0–0.8) */
  track?: string;
  valueLabels?: string[] | boolean;
  barRadius?: number;
  barGap?: number;
  /** donut: espessura do anel (px) */
  ringWidth?: number;
}

let n = 0;
const cid = () => `ch-${Date.now().toString(36)}-${(n++).toString(36)}`;
const clamp = (v: unknown, lo: number, hi: number, def: number) => (typeof v === 'number' && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def);

export function normalizeChartSpec(item: any): ChartSpec | null {
  const kind = item?.kind === 'area' || item?.kind === 'bar' || item?.kind === 'donut' ? item.kind : 'line';
  const data = (Array.isArray(item?.data) ? item.data : []).map((v: any) => Number(v)).filter((v: number) => Number.isFinite(v)).slice(0, kind === 'bar' ? 31 : 60);
  if (data.length < (kind === 'line' || kind === 'area' ? 2 : 1)) return null;
  const hl = item.highlight && Number.isInteger(item.highlight.index) ? { index: Math.max(0, Math.min(data.length - 1, item.highlight.index)), label: item.highlight.label != null ? String(item.highlight.label).slice(0, 24) : undefined } : undefined;
  return {
    kind,
    data,
    labels: Array.isArray(item.labels) ? item.labels.map((l: any) => String(l).slice(0, 12)).slice(0, data.length) : undefined,
    color: typeof item.color === 'string' ? item.color : undefined,
    colors: Array.isArray(item.colors) ? item.colors.filter((c: any) => typeof c === 'string').slice(0, data.length) : undefined,
    fillArea: kind === 'area' ? true : item.fillArea === true,
    smooth: item.smooth !== false,
    grid: item.grid === true ? 4 : typeof item.grid === 'number' ? Math.round(clamp(item.grid, 1, 8, 4)) : false,
    gridColor: typeof item.gridColor === 'string' ? item.gridColor : undefined,
    labelColor: typeof item.labelColor === 'string' ? item.labelColor : undefined,
    labelSize: clamp(item.labelSize, 8, 16, 11),
    strokeWidth: clamp(item.strokeWidth, 1, 8, 3),
    highlight: hl,
    track: typeof item.track === 'string' ? item.track : undefined,
    valueLabels: Array.isArray(item.valueLabels) ? item.valueLabels.map((l: any) => String(l).slice(0, 8)) : item.valueLabels === true,
    barRadius: clamp(item.barRadius, 0, 24, 6),
    barGap: clamp(item.barGap, 0.05, 0.8, 0.4),
    ringWidth: clamp(item.ringWidth, 4, 60, 14),
  };
}

/** Curva suave (Catmull-Rom → Bézier cúbica) ou poligonal, em coordenadas locais. */
export function linePath(pts: Array<{ x: number; y: number }>, smooth: boolean): string {
  if (!pts.length) return '';
  let d = `M ${pts[0].x.toFixed(2)} ${pts[0].y.toFixed(2)}`;
  if (!smooth || pts.length < 3) {
    for (let i = 1; i < pts.length; i++) d += ` L ${pts[i].x.toFixed(2)} ${pts[i].y.toFixed(2)}`;
    return d;
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 };
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 };
    d += ` C ${c1.x.toFixed(2)} ${c1.y.toFixed(2)}, ${c2.x.toFixed(2)} ${c2.y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
  }
  return d;
}

interface Ctx { pageId: string; parentId: string; z: number; isDark: boolean }

function base(c: Ctx, o: Partial<Shape> & { type: Shape['type'] }): Shape {
  return { id: cid(), rotation: 0, fill: 'none', stroke: 'none', strokeWidth: 0, opacity: 1, visible: true, pageId: c.pageId, parentId: c.parentId, zIndex: c.z, x: 0, y: 0, width: 1, height: 1, ...o } as Shape;
}

const strokeOf = (color: string, width: number): { stroke: string; strokes: StrokeItem[]; strokeWidth: number } => {
  const c = parseColorAlpha(color, '#22C55E');
  return { stroke: c.hex, strokes: [{ id: cid(), color: c.hex, opacity: c.alpha, visible: true, width }], strokeWidth: width };
};

function text(c: Ctx, t: string, x: number, y: number, w: number, size: number, color: string, weight = 400, align: 'left' | 'center' | 'right' = 'center'): Shape {
  const col = parseColorAlpha(color, '#9CA3AF');
  return base(c, { type: 'text', text: t, x, y, width: Math.max(8, w), height: Math.ceil(size * 1.25), fontSize: size, fontWeight: weight, textAlign: align, fill: col.hex, ...(col.alpha < 1 ? { opacity: col.alpha } : {}), fontFamily: 'Poppins' } as any);
}

/** Shapes do gráfico dentro da caixa (x, y, w, h absolutos no canvas). Devolve [] se a caixa for pequena demais. */
export function buildChartShapes(spec: ChartSpec, box: { x: number; y: number; w: number; h: number }, c: Ctx): Shape[] {
  const { x: X, y: Y, w: W, h: H } = box;
  if (W < 24 || H < 24) return [];
  const out: Shape[] = [];
  const color = spec.color || '#22C55E';
  const labelColor = spec.labelColor || (c.isDark ? '#FFFFFF73' : '#00000080');
  const labelSize = spec.labelSize || 11;
  const hasLabels = !!spec.labels?.length && spec.kind !== 'donut';
  const padB = hasLabels ? labelSize * 1.25 + 8 : 0;
  const padT = spec.highlight?.label ? 30 : 6;
  const innerX = X, innerW = W;
  const innerY = Y + padT, innerH = Math.max(12, H - padT - padB);
  const gridColor = spec.gridColor || (c.isDark ? '#FFFFFF14' : '#0000001A');

  if (spec.grid && spec.kind !== 'donut') {
    const lines = typeof spec.grid === 'number' ? spec.grid : 4;
    for (let i = 0; i <= lines; i++) {
      const gy = innerY + (innerH * i) / lines;
      out.push(base(c, { type: 'rect', name: 'Grade', x: innerX, y: Math.round(gy), width: innerW, height: 1, fill: parseColorAlpha(gridColor, '#FFFFFF').hex, ...(parseColorAlpha(gridColor, '#FFFFFF').alpha < 1 ? { opacity: parseColorAlpha(gridColor, '#FFFFFF').alpha } : {}) }));
    }
  }

  if (spec.kind === 'line' || spec.kind === 'area') {
    const min = Math.min(...spec.data), max = Math.max(...spec.data);
    const span = max - min || 1;
    const nPts = spec.data.length;
    const pts = spec.data.map((v, i) => ({ x: (innerW * i) / (nPts - 1), y: innerH - ((v - min) / span) * (innerH - 8) - 4 }));
    const d = linePath(pts, spec.smooth !== false);
    if (spec.fillArea) {
      const col = parseColorAlpha(color, '#22C55E');
      const areaD = `${d} L ${innerW} ${innerH} L 0 ${innerH} Z`;
      const fill: FillItem = { id: cid(), type: 'linear', color: col.hex, opacity: 1, visible: true, gradientAngle: 180, gradientStops: [{ color: col.hex, position: 0, opacity: 0.35 }, { color: col.hex, position: 1, opacity: 0 }] };
      out.push(base(c, { type: 'path', name: 'Área', x: innerX, y: innerY, width: innerW, height: innerH, pathD: areaD, pathW: innerW, pathH: innerH, fill: col.hex, fills: [fill] } as any));
    }
    out.push(base(c, { type: 'path', name: 'Linha', x: innerX, y: innerY, width: innerW, height: innerH, pathD: d, pathW: innerW, pathH: innerH, fill: 'none', fills: [], ...strokeOf(color, spec.strokeWidth || 3), strokeJoin: 'round' } as any));
    if (spec.highlight) {
      const p = pts[spec.highlight.index];
      const col = parseColorAlpha(color, '#22C55E');
      out.push(base(c, { type: 'ellipse', name: 'Marcador', x: innerX + p.x - 6, y: innerY + p.y - 6, width: 12, height: 12, fill: '#FFFFFF', ...strokeOf(col.hex, 3) }));
      if (spec.highlight.label) {
        const tw = Math.max(48, spec.highlight.label.length * 7 + 16);
        const tx = Math.min(Math.max(X, innerX + p.x - tw / 2), X + W - tw);
        out.push(base(c, { type: 'rect', name: 'Etiqueta', x: tx, y: Math.max(Y, innerY + p.y - 38), width: tw, height: 24, cornerRadius: 6, fill: col.hex, opacity: 0.22 }));
        out.push(text(c, spec.highlight.label, tx, Math.max(Y, innerY + p.y - 38) + 4, tw, 12, col.hex, 600));
      }
    }
    if (hasLabels) {
      const step = Math.max(1, Math.ceil(nPts / 8));
      spec.labels!.forEach((l, i) => {
        if (i % step) return;
        const lx = innerX + (innerW * i) / (nPts - 1);
        if (l) out.push(text(c, l, Math.min(Math.max(X, lx - 24), X + W - 48), Y + H - labelSize * 1.25, 48, labelSize, labelColor));
      });
    }
  } else if (spec.kind === 'bar') {
    const nBars = spec.data.length;
    const slot = innerW / nBars;
    const bw = Math.max(4, slot * (1 - (spec.barGap || 0.4)));
    const max = Math.max(...spec.data, 1);
    const radius = Math.min(spec.barRadius ?? 6, bw / 2);
    const showVals = spec.valueLabels === true ? spec.data.map((v) => String(Math.round(v))) : Array.isArray(spec.valueLabels) ? spec.valueLabels : null;
    spec.data.forEach((v, i) => {
      const bx = innerX + slot * i + (slot - bw) / 2;
      const hh = Math.max(2, (v / max) * innerH);
      const barColor = spec.colors?.[i] || color;
      const bc = parseColorAlpha(barColor, '#22C55E');
      if (spec.track) {
        const tc = parseColorAlpha(spec.track, '#FFFFFF');
        out.push(base(c, { type: 'rect', name: 'Trilho', x: bx, y: innerY, width: bw, height: innerH, cornerRadius: radius, fill: tc.hex, ...(tc.alpha < 1 ? { opacity: tc.alpha } : {}) }));
      }
      out.push(base(c, { type: 'rect', name: 'Barra', x: bx, y: innerY + innerH - hh, width: bw, height: hh, cornerRadius: radius, fill: bc.hex, ...(bc.alpha < 1 ? { opacity: bc.alpha } : {}) }));
      if (showVals?.[i]) out.push(text(c, showVals[i], bx - 6, innerY + innerH - hh - labelSize * 1.25 - 4, bw + 12, labelSize, labelColor, 600));
      if (hasLabels && spec.labels![i]) out.push(text(c, spec.labels![i], innerX + slot * i, Y + H - labelSize * 1.25, slot, labelSize, labelColor));
    });
  } else {
    // donut: fatias proporcionais em anel
    const total = spec.data.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const size = Math.min(W, H);
    const ring = Math.min(spec.ringWidth || 14, size / 2 - 2);
    const r = size / 2 - ring / 2 - 1;
    const cx = X + W / 2, cy = Y + H / 2;
    let a0 = -Math.PI / 2;
    spec.data.forEach((v, i) => {
      const frac = Math.max(0, v) / total;
      if (frac <= 0) return;
      const a1 = a0 + Math.min(frac, 0.9999) * Math.PI * 2;
      const p = (a: number) => ({ x: r + ring / 2 + 1 + r * Math.cos(a), y: r + ring / 2 + 1 + r * Math.sin(a) });
      const s0 = p(a0), s1 = p(a1);
      const d = `M ${s0.x.toFixed(2)} ${s0.y.toFixed(2)} A ${r} ${r} 0 ${frac > 0.5 ? 1 : 0} 1 ${s1.x.toFixed(2)} ${s1.y.toFixed(2)}`;
      const sc = spec.colors?.[i] || (i === 0 ? color : ['#6366F1', '#F59E0B', '#EF4444', '#06B6D4', '#A855F7'][i % 5]);
      out.push(base(c, { type: 'path', name: 'Fatia', x: cx - size / 2, y: cy - size / 2, width: size, height: size, pathD: d, pathW: size, pathH: size, fill: 'none', fills: [], ...strokeOf(sc, ring), strokeJoin: 'round' } as any));
      a0 = a1;
    });
  }
  return out.map((s, i) => ({ ...s, zIndex: c.z + i }));
}
