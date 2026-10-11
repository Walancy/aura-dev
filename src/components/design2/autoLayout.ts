import type { Shape } from './types';
import { applyDeltas } from './align';
import { resizeDescendants } from './constraints';
import { defaultMeasure, LINE_HEIGHT, wrapLines } from './textFit';

type Align3 = 'start' | 'center' | 'end';

const ALIGN_MAP: Record<string, { h: Align3; v: Align3 }> = {
  'top-left': { h: 'start', v: 'start' },
  'top-center': { h: 'center', v: 'start' },
  'top-right': { h: 'end', v: 'start' },
  left: { h: 'start', v: 'center' },
  center: { h: 'center', v: 'center' },
  right: { h: 'end', v: 'center' },
  'bottom-left': { h: 'start', v: 'end' },
  'bottom-center': { h: 'center', v: 'end' },
  'bottom-right': { h: 'end', v: 'end' },
};

const isAuto = (f: Shape) => f.hasAutoLayout && (f.layoutFlow === 'horizontal' || f.layoutFlow === 'vertical' || f.layoutFlow === 'freeform' || f.layoutFlow === 'grid') && (f.type === 'frame' || f.type === 'section');

const clampTo = (v: number, min?: number, max?: number) => Math.max(min ?? 0, max !== undefined && max > 0 ? Math.min(v, max) : v);

/** Profundidade de um shape na hierarquia (para processar os filhos antes dos pais). */
function depthOf(all: Map<string, Shape>, s: Shape): number {
  let d = 0;
  let cur: Shape | undefined = s;
  while (cur?.parentId && d < 50) {
    cur = all.get(cur.parentId);
    d++;
  }
  return d;
}

const weightOf = (s: Shape) => Number(s.fontWeight) || 400;
export const flatText = (s: Shape) => {
  // texto "fill" é quebrado pela largura: a fonte do texto é o conteúdo sem as quebras que nós mesmos inserimos
  const flat = (s.text || '').replace(/\s*\n\s*/g, ' ').trim();
  const src = s.wrapSource ? s.wrapSource.replace(/\s+/g, ' ').trim() : '';
  return src && src === flat ? s.wrapSource! : flat;
};

/** Texto dentro de um auto layout se ajusta ao conteúdo como no Figma: largura "hug"/automática e altura automática. */
function measureText(s: Shape): { width: number; height: number } | null {
  if (s.type !== 'text' || s.widthMode === 'fill') return null;
  const size = s.fontSize || 16;
  const lines = (s.wrapSource ? flatText(s) : s.text || '').split('\n');
  const height = s.heightMode === 'fixed' ? s.height : Math.ceil(lines.length * size * LINE_HEIGHT);
  if (s.widthMode === 'fixed') return { width: s.width, height };
  const natural = Math.max(...lines.map((l) => defaultMeasure(l, size, weightOf(s))));
  return { width: Math.ceil(natural) + 2, height };
}

/** Menor largura aceitável de um texto "fill": a maior palavra (ou o texto inteiro se for curto, sem espaços). */
function minContentWidth(s: Shape): number {
  if (s.type !== 'text') return 0;
  const size = s.fontSize || 16;
  const words = flatText(s).split(/\s+/).filter(Boolean);
  if (!words.length) return 0;
  return Math.ceil(Math.max(...words.map((w) => defaultMeasure(w, size, weightOf(s))))) + 2;
}

function layoutOne(shapes: Shape[], frameId: string): Shape[] {
  const frame = shapes.find((s) => s.id === frameId);
  if (!frame || !isAuto(frame)) return shapes;
  if (frame.layoutFlow === 'freeform' || frame.layoutFlow === 'grid') return layoutRows(shapes, frame);
  const horizontal = frame.layoutFlow === 'horizontal';

  const padTop = frame.independentPadding ? frame.paddingTop ?? 0 : frame.paddingVertical ?? 0;
  const padBottom = frame.independentPadding ? frame.paddingBottom ?? 0 : frame.paddingVertical ?? 0;
  const padLeft = frame.independentPadding ? frame.paddingLeft ?? 0 : frame.paddingHorizontal ?? 0;
  const padRight = frame.independentPadding ? frame.paddingRight ?? 0 : frame.paddingHorizontal ?? 0;
  const gap = frame.layoutGap ?? 0;

  // Filhos na ordem em que estão no eixo principal (arrastar um filho reordena)
  const innerW = frame.width - padLeft - padRight;
  const kids = shapes
    .filter((s) => s.parentId === frame.id && s.visible !== false && !s.layoutAbsolute)
    // texto "hug" mais largo que a coluna quebra linha (como no Figma) em vez de estourar ou virar uma coluna estreita
    .map((s) => (!horizontal && frame.widthMode !== 'hug' && s.type === 'text' && s.widthMode === 'hug' && flatText(s).length > 24 && defaultMeasure(flatText(s), s.fontSize || 16, weightOf(s)) > innerW ? { ...s, widthMode: 'fill' as const } : s))
    .sort((a, b) => (horizontal ? a.x + a.width / 2 - (b.x + b.width / 2) : a.y + a.height / 2 - (b.y + b.height / 2)));
  if (kids.length === 0) return shapes;

  const measured = new Map<string, { width: number; height: number }>();
  for (const k of kids) {
    const m = measureText(k);
    if (m) measured.set(k.id, m);
  }
  const mainSize = (s: Shape) => (horizontal ? measured.get(s.id)?.width ?? s.width : measured.get(s.id)?.height ?? s.height);
  const crossSize = (s: Shape) => (horizontal ? measured.get(s.id)?.height ?? s.height : measured.get(s.id)?.width ?? s.width);
  const mainMode = (s: Shape) => (horizontal ? s.widthMode : s.heightMode);
  const crossMode = (s: Shape) => (horizontal ? s.heightMode : s.widthMode);

  const hugW = frame.widthMode === 'hug';
  const hugH = frame.heightMode === 'hug';
  const padMain = horizontal ? padLeft + padRight : padTop + padBottom;
  const padCross = horizontal ? padTop + padBottom : padLeft + padRight;
  const hugMain = horizontal ? hugW : hugH;
  const hugCross = horizontal ? hugH : hugW;

  // 1) Tamanhos: 'fill' reparte o espaço restante (só se o pai não for hug nesse eixo)
  let sizes = kids.map((k) => ({ id: k.id, main: mainSize(k), cross: crossSize(k) }));
  const frameMain = horizontal ? frame.width : frame.height;
  const frameCross = horizontal ? frame.height : frame.width;
  const fillKids = kids.filter((k) => mainMode(k) === 'fill');
  if (fillKids.length > 0 && !hugMain) {
    const fixed = kids.filter((k) => mainMode(k) !== 'fill').reduce((sum, k) => sum + mainSize(k), 0);
    let remaining = Math.max(0, frameMain - padMain - gap * (kids.length - 1) - fixed);
    // reparte igualmente, mas texto nunca fica menor que a sua maior palavra (senão some atrás do vizinho)
    const minOf = (k: Shape) => (horizontal ? minContentWidth(k) : 0);
    const share = new Map<string, number>();
    let pending = [...fillKids];
    for (let guard = 0; guard < pending.length + 2 && pending.length; guard++) {
      const each = remaining / pending.length;
      const tooSmall = pending.filter((k) => minOf(k) > each);
      if (!tooSmall.length) {
        pending.forEach((k) => share.set(k.id, each));
        pending = [];
        break;
      }
      tooSmall.forEach((k) => {
        share.set(k.id, minOf(k));
        remaining = Math.max(0, remaining - minOf(k));
      });
      pending = pending.filter((k) => !tooSmall.includes(k));
    }
    sizes = sizes.map((z) => (share.has(z.id) ? { ...z, main: share.get(z.id)! } : z));
  }
  const innerCross = frameCross - padCross;
  if (!hugCross) sizes = sizes.map((z) => (crossMode(kids.find((k) => k.id === z.id)!) === 'fill' ? { ...z, cross: innerCross } : z));

  // 1b) Texto "fill": quebra as linhas pela largura final e ajusta a altura
  const rewrapped = new Map<string, string>();
  sizes = sizes.map((z) => {
    const k = kids.find((x) => x.id === z.id)!;
    if (k.type !== 'text' || k.widthMode !== 'fill') return z;
    const width = horizontal ? z.main : z.cross;
    const size = k.fontSize || 16;
    const flat = flatText(k);
    // rótulos/valores curtos não quebram (ex.: "R$ 148.520,00" nunca vira "R$" + "148.520,00")
    const lines = flat.length <= 20 && !(k.text || '').includes('\n\n') ? [flat] : wrapLines(flat, Math.max(8, width), size, weightOf(k));
    rewrapped.set(k.id, lines.join('\n'));
    const h = k.heightMode === 'fixed' ? k.height : Math.ceil(lines.length * size * LINE_HEIGHT);
    return horizontal ? { ...z, cross: h } : { ...z, main: h };
  });

  // Texto "hug" que um dia foi quebrado em linhas (coluna estreita no meio do cálculo) e agora cabe numa linha: volta ao texto original
  for (const k of kids) {
    if (k.type !== 'text' || k.widthMode !== 'hug' || !k.wrapSource || rewrapped.has(k.id)) continue;
    const flat = flatText(k);
    if ((k.text || '') !== flat && defaultMeasure(flat, k.fontSize || 16, weightOf(k)) <= (horizontal ? Number.POSITIVE_INFINITY : frame.width - padLeft - padRight)) rewrapped.set(k.id, flat);
  }

  // 1c) Mínimo/máximo de cada filho (largura e altura), nos dois eixos
  sizes = sizes.map((z) => {
    const k = kids.find((x) => x.id === z.id)!;
    return horizontal
      ? { ...z, main: clampTo(z.main, k.minW, k.maxW), cross: clampTo(z.cross, k.minH, k.maxH) }
      : { ...z, main: clampTo(z.main, k.minH, k.maxH), cross: clampTo(z.cross, k.minW, k.maxW) };
  });

  // 2) Tamanho do frame quando "hug"
  const contentMain = sizes.reduce((sum, z) => sum + z.main, 0) + gap * (kids.length - 1);
  const crossFillIds = new Set(kids.filter((k) => crossMode(k) === 'fill').map((k) => k.id));
  const contentCross = Math.max(...sizes.map((z) => z.cross));
  // pai com altura/largura "hug" no eixo cruzado: filhos "fill" esticam até o maior (colunas de mesma altura)
  if (hugCross && crossFillIds.size > 0) sizes = sizes.map((z) => (crossFillIds.has(z.id) ? { ...z, cross: contentCross } : z));
  const rawMain = hugMain ? contentMain + padMain : frameMain;
  const rawCross = hugCross ? contentCross + padCross : frameCross;
  const newW = hugW || hugH ? clampTo(horizontal ? rawMain : rawCross, frame.minW, frame.maxW) : horizontal ? rawMain : rawCross;
  const newH = hugW || hugH ? clampTo(horizontal ? rawCross : rawMain, frame.minH, frame.maxH) : horizontal ? rawCross : rawMain;
  const newMain = horizontal ? newW : newH;
  const newCross = horizontal ? newH : newW;

  // 3) Posições conforme o alinhamento (3x3)
  const al = ALIGN_MAP[frame.layoutAlign || 'top-left'] || ALIGN_MAP['top-left'];
  const mainAlign = horizontal ? al.h : al.v;
  const crossAlign = horizontal ? al.v : al.h;
  const innerMain = newMain - padMain;
  const innerCrossFinal = newCross - padCross;
  // espaçamento "automático" (space between): reparte o espaço livre entre os itens; com hug vale o gap fixo
  const sumMain = sizes.reduce((sum, z) => sum + z.main, 0);
  const spaceBetween = !!frame.layoutGapAuto && !hugMain && kids.length > 1;
  const effGap = spaceBetween ? Math.max(0, (innerMain - sumMain) / (kids.length - 1)) : gap;
  const usedMain = sumMain + effGap * (kids.length - 1);
  let cursor = (horizontal ? padLeft : padTop) + (spaceBetween ? 0 : mainAlign === 'center' ? (innerMain - usedMain) / 2 : mainAlign === 'end' ? innerMain - usedMain : 0);

  const placed = new Map<string, { x: number; y: number; width: number; height: number }>();
  for (const z of sizes) {
    const crossOffset = (horizontal ? padTop : padLeft) + (crossAlign === 'center' ? (innerCrossFinal - z.cross) / 2 : crossAlign === 'end' ? innerCrossFinal - z.cross : 0);
    const mainPos = cursor;
    placed.set(z.id, {
      x: frame.x + (horizontal ? mainPos : crossOffset),
      y: frame.y + (horizontal ? crossOffset : mainPos),
      width: horizontal ? z.main : z.cross,
      height: horizontal ? z.cross : z.main,
    });
    cursor += z.main + effGap;
  }

  return commitLayout(shapes, frame, placed, newW, newH, rewrapped);
}

/** Filhos na ordem de leitura atual (linhas de cima para baixo, cada linha da esquerda para a direita): arrastar um filho reordena. */
export function readingOrder<T extends { x: number; y: number; width: number; height: number }>(items: T[]): T[] {
  const sorted = [...items].sort((a, b) => a.y + a.height / 2 - (b.y + b.height / 2));
  const rows: Array<{ items: T[]; cy: number; h: number }> = [];
  for (const it of sorted) {
    const cy = it.y + it.height / 2;
    const row = rows.find((r) => Math.abs(cy - r.cy) <= Math.max(it.height, r.h) / 2);
    if (row) {
      row.items.push(it);
      row.cy = row.items.reduce((sum, x) => sum + x.y + x.height / 2, 0) / row.items.length;
      row.h = Math.max(row.h, it.height);
    } else rows.push({ items: [it], cy, h: it.height });
  }
  return rows.sort((a, b) => a.cy - b.cy).flatMap((r) => r.items.sort((a, b) => a.x - b.x));
}

/**
 * Wrap (fluxo 'freeform') e Grid (fluxo 'grid'): os filhos se organizam em linhas.
 * Wrap quebra a linha quando não cabe na largura útil do frame; Grid usa `gridCols` colunas.
 */
function layoutRows(shapes: Shape[], frame: Shape): Shape[] {
  const isGrid = frame.layoutFlow === 'grid';
  const padTop = frame.independentPadding ? frame.paddingTop ?? 0 : frame.paddingVertical ?? 0;
  const padBottom = frame.independentPadding ? frame.paddingBottom ?? 0 : frame.paddingVertical ?? 0;
  const padLeft = frame.independentPadding ? frame.paddingLeft ?? 0 : frame.paddingHorizontal ?? 0;
  const padRight = frame.independentPadding ? frame.paddingRight ?? 0 : frame.paddingHorizontal ?? 0;
  const gap = frame.layoutGap ?? 0;
  const rowGap = frame.layoutCounterGap ?? gap;
  const hugW = frame.widthMode === 'hug';
  const hugH = frame.heightMode === 'hug';
  const innerW = frame.width - padLeft - padRight;

  const kids = readingOrder(shapes.filter((s) => s.parentId === frame.id && s.visible !== false && !s.layoutAbsolute));
  if (kids.length === 0) return shapes;

  // tamanho natural de cada filho (texto se ajusta ao conteúdo; min/max valem sempre)
  const size = new Map<string, { w: number; h: number }>();
  for (const k of kids) {
    const m = measureText(k);
    size.set(k.id, { w: clampTo(m?.width ?? k.width, k.minW, k.maxW), h: clampTo(m?.height ?? k.height, k.minH, k.maxH) });
  }
  const cols = Math.max(1, Math.floor(frame.gridCols || 3));

  // 1) distribui os filhos em linhas
  const rows: Shape[][] = [];
  if (isGrid) {
    kids.forEach((k, i) => {
      if (i % cols === 0) rows.push([]);
      rows[rows.length - 1].push(k);
    });
  } else {
    let used = 0;
    for (const k of kids) {
      const w = size.get(k.id)!.w;
      if (!rows.length || (!hugW && rows[rows.length - 1].length > 0 && used + gap + w > innerW + 0.001)) {
        rows.push([]);
        used = 0;
      }
      rows[rows.length - 1].push(k);
      used += (rows[rows.length - 1].length > 1 ? gap : 0) + w;
    }
  }

  // 2) larguras de coluna (grid) e alturas de linha
  const colW: number[] = [];
  if (isGrid) {
    for (let c = 0; c < cols; c++) {
      const inCol = rows.map((r) => r[c]).filter(Boolean) as Shape[];
      colW[c] = hugW ? Math.max(0, ...inCol.map((k) => size.get(k.id)!.w)) : Math.max(0, (innerW - gap * (cols - 1)) / cols);
    }
  }
  const al = ALIGN_MAP[frame.layoutAlign || 'top-left'] || ALIGN_MAP['top-left'];
  const fillW = (k: Shape) => isGrid && k.widthMode === 'fill';
  const widthOf = (k: Shape, c: number) => (fillW(k) ? clampTo(colW[c], k.minW, k.maxW) : size.get(k.id)!.w);
  const rowH = rows.map((r) => Math.max(0, ...r.map((k) => size.get(k.id)!.h)));
  const rowW = rows.map((r) => r.reduce((sum, k, c) => sum + widthOf(k, c), 0) + gap * Math.max(0, r.length - 1));

  // 3) tamanho do frame (hug) com min/max
  const contentW = isGrid ? colW.reduce((a, b) => a + b, 0) + gap * (cols - 1) : Math.max(0, ...rowW);
  const contentH = rowH.reduce((a, b) => a + b, 0) + rowGap * Math.max(0, rows.length - 1);
  const newW = hugW ? clampTo(contentW + padLeft + padRight, frame.minW, frame.maxW) : frame.width;
  const newH = hugH ? clampTo(contentH + padTop + padBottom, frame.minH, frame.maxH) : frame.height;
  const availW = newW - padLeft - padRight;
  const availH = newH - padTop - padBottom;

  // 4) posições: linhas empilhadas; dentro da linha o alinhamento horizontal vem do 3×3 e o vertical alinha na linha
  const placed: Placed = new Map();
  const rewrapped = new Map<string, string>();
  const stackH = contentH;
  let y = padTop + (al.v === 'center' ? (availH - stackH) / 2 : al.v === 'end' ? availH - stackH : 0);
  rows.forEach((r, ri) => {
    const startX = isGrid ? padLeft : padLeft + (al.h === 'center' ? (availW - rowW[ri]) / 2 : al.h === 'end' ? availW - rowW[ri] : 0);
    let x = startX;
    r.forEach((k, c) => {
      const w = widthOf(k, c);
      const h = k.heightMode === 'fill' ? rowH[ri] : size.get(k.id)!.h;
      const cell = isGrid ? colW[c] : w;
      const dx = isGrid ? (al.h === 'center' ? (cell - w) / 2 : al.h === 'end' ? cell - w : 0) : 0;
      const dy = al.v === 'center' ? (rowH[ri] - h) / 2 : al.v === 'end' ? rowH[ri] - h : 0;
      placed.set(k.id, { x: frame.x + x + dx, y: frame.y + y + (isGrid ? dy : dy), width: w, height: h });
      x += (isGrid ? cell : w) + gap;
    });
    y += rowH[ri] + rowGap;
  });
  return commitLayout(shapes, frame, placed, newW, newH, rewrapped);
}

type Placed = Map<string, { x: number; y: number; width: number; height: number }>;

/** Aplica o resultado do cálculo: tamanho do frame, tamanho/posição dos filhos e desloca os netos junto. */
function commitLayout(shapes: Shape[], frame: Shape, placed: Placed, newW: number, newH: number, rewrapped: Map<string, string>): Shape[] {
  let next = shapes.map((s) => (s.id === frame.id ? { ...s, width: Math.round(newW), height: Math.round(newH) } : s));
  // filhos com posição absoluta ficam fora do fluxo e seguem as restrições quando o frame muda de tamanho
  if (Math.round(newW) !== frame.width || Math.round(newH) !== frame.height) {
    const abs = shapes.filter((k) => k.parentId === frame.id && k.layoutAbsolute);
    if (abs.length) {
      const patches = resizeDescendants([frame, ...abs], frame.id, { x: frame.x, y: frame.y, width: frame.width, height: frame.height }, { x: frame.x, y: frame.y, width: Math.round(newW), height: Math.round(newH) }, 'constraints');
      next = next.map((k) => (patches.has(k.id) ? { ...k, ...patches.get(k.id) } : k));
    }
  }
  const deltas = new Map<string, { dx: number; dy: number }>();
  next = next.map((s) => {
    const p = placed.get(s.id);
    if (!p) return s;
    deltas.set(s.id, { dx: Math.round(p.x - s.x), dy: Math.round(p.y - s.y) });
    const wrapped = rewrapped.get(s.id);
    return { ...s, width: Math.round(p.width), height: Math.round(p.height), ...(wrapped !== undefined ? { text: wrapped, wrapSource: flatText(s) } : {}) };
  });
  // o primeiro filho fica por cima na pilha (z invertido entre os filhos do frame)
  if (frame.layoutStackFirstOnTop) {
    const order = Array.from(placed.keys());
    const zs = order.map((id) => next.find((s) => s.id === id)!.zIndex).sort((a, b) => b - a);
    const zOf = new Map(order.map((id, i) => [id, zs[i]]));
    next = next.map((s) => (zOf.has(s.id) ? { ...s, zIndex: zOf.get(s.id)! } : s));
  }
  // netos acompanham o deslocamento do pai (o próprio filho é movido via x/y abaixo)
  const grandKids = new Map<string, { dx: number; dy: number }>();
  for (const s of next) {
    const parentDelta = s.parentId ? deltas.get(s.parentId) : undefined;
    if (parentDelta && s.parentId !== frame.id) grandKids.set(s.id, parentDelta);
  }
  next = next.map((s) => {
    const d = deltas.get(s.id);
    if (!d) return s;
    return { ...s, x: s.x + d.dx, y: s.y + d.dy, ...(s.points ? { points: s.points.map((pt) => ({ x: pt.x + d.dx, y: pt.y + d.dy })) } : {}) };
  });
  if (grandKids.size > 0) next = applyDeltas(next, new Map(Array.from(grandKids.entries()).filter(([id]) => !deltas.has(id) || true)));
  return next;
}

/**
 * Reorganiza todos os frames com auto layout. "Hug" se resolve de dentro para fora e "fill" de fora para dentro,
 * então alterna as duas direções até estabilizar (necessário com frames aninhados em vários níveis).
 */
export function relayoutAll(shapes: Shape[]): Shape[] {
  const autos = shapes.filter(isAuto);
  if (autos.length === 0) return shapes;
  const byId = new Map(shapes.map((s) => [s.id, s]));
  const bottomUp = [...autos].sort((a, b) => depthOf(byId, b) - depthOf(byId, a)).map((f) => f.id);
  const topDown = [...bottomUp].reverse();
  const signature = (list: Shape[]) => list.map((s) => `${s.x},${s.y},${s.width},${s.height}`).join('|');
  let out = shapes;
  for (let i = 0; i < 10; i++) {
    const before = signature(out);
    for (const id of bottomUp) out = layoutOne(out, id);
    for (const id of topDown) out = layoutOne(out, id);
    if (signature(out) === before) break;
  }
  return out;
}

/** Seleção → só as raízes (descarta quem já está dentro de outro selecionado). */
function selectionRoots(all: Shape[], ids: string[]): Shape[] {
  const set = new Set(ids);
  const byId = new Map(all.map((s) => [s.id, s]));
  return ids
    .map((id) => byId.get(id))
    .filter((s): s is Shape => !!s)
    .filter((s) => {
      let p = s.parentId ? byId.get(s.parentId) : undefined;
      while (p) {
        if (set.has(p.id)) return false;
        p = p.parentId ? byId.get(p.parentId) : undefined;
      }
      return true;
    });
}

/** Direção e espaçamento que melhor descrevem como os itens já estão dispostos. */
export function inferFlow(items: Shape[]): { flow: 'horizontal' | 'vertical'; gap: number } {
  if (items.length < 2) return { flow: 'horizontal', gap: 0 };
  const cx = items.map((s) => s.x + s.width / 2);
  const cy = items.map((s) => s.y + s.height / 2);
  const flow = Math.max(...cx) - Math.min(...cx) >= Math.max(...cy) - Math.min(...cy) ? 'horizontal' : 'vertical';
  const sorted = [...items].sort((a, b) => (flow === 'horizontal' ? a.x - b.x : a.y - b.y));
  const gaps: number[] = [];
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    gaps.push(flow === 'horizontal' ? cur.x - (prev.x + prev.width) : cur.y - (prev.y + prev.height));
  }
  gaps.sort((a, b) => a - b);
  const median = gaps[Math.floor((gaps.length - 1) / 2)];
  return { flow, gap: Math.max(0, Math.round(median)) };
}

/**
 * Shift+A como no Figma:
 * - frame com auto layout → desliga;
 * - frame/seção com filhos → liga (direção e espaçamento inferidos, tamanho mantido);
 * - qualquer outra seleção → envolve os itens num frame novo com auto layout (hug).
 */
export function addAutoLayout(all: Shape[], ids: string[], newId: () => string): { shapes: Shape[]; selectId: string } | null {
  const roots = selectionRoots(all, ids);
  if (roots.length === 0) return null;

  if (roots.length === 1 && (roots[0].type === 'frame' || roots[0].type === 'section')) {
    const f = roots[0];
    if (f.hasAutoLayout) return { shapes: all.map((s) => (s.id === f.id ? { ...s, hasAutoLayout: false } : s)), selectId: f.id };
    const kids = all.filter((s) => s.parentId === f.id && s.visible !== false);
    if (kids.length > 0) {
      const { flow, gap } = inferFlow(kids);
      const minX = Math.min(...kids.map((k) => k.x));
      const minY = Math.min(...kids.map((k) => k.y));
      const maxX = Math.max(...kids.map((k) => k.x + k.width));
      const maxY = Math.max(...kids.map((k) => k.y + k.height));
      const pad = { top: Math.max(0, Math.round(minY - f.y)), left: Math.max(0, Math.round(minX - f.x)), right: Math.max(0, Math.round(f.x + f.width - maxX)), bottom: Math.max(0, Math.round(f.y + f.height - maxY)) };
      return {
        shapes: relayoutAll(all.map((s) => (s.id === f.id ? { ...s, hasAutoLayout: true, layoutFlow: flow, layoutGap: gap, independentPadding: true, paddingTop: pad.top, paddingLeft: pad.left, paddingRight: pad.right, paddingBottom: pad.bottom, layoutAlign: s.layoutAlign || 'top-left' } : s))),
        selectId: f.id,
      };
    }
  }

  // Um componente maior que CONTÉM os outros selecionados (ex.: retângulo de fundo + botão por cima): como no Figma, o maior
  // vira o frame (mantém fundo/borda/raio/tamanho) e o espaço entre a borda dele e os internos vira padding exato.
  if (roots.length >= 2) {
    const containsAll = (c: Shape) => roots.every((o) => o.id === c.id || (o.x >= c.x - 0.5 && o.y >= c.y - 0.5 && o.x + o.width <= c.x + c.width + 0.5 && o.y + o.height <= c.y + c.height + 0.5));
    const container = roots
      .filter((c) => c.type !== 'text' && !c.hasAutoLayout && containsAll(c))
      .sort((a, b) => b.width * b.height - a.width * a.height)[0];
    if (container) {
      const kids = roots.filter((o) => o.id !== container.id);
      const { flow, gap } = inferFlow(kids);
      const minX = Math.min(...kids.map((k) => k.x));
      const minY = Math.min(...kids.map((k) => k.y));
      const maxX = Math.max(...kids.map((k) => k.x + k.width));
      const maxY = Math.max(...kids.map((k) => k.y + k.height));
      const kidIds = new Set(kids.map((k) => k.id));
      const top = Math.max(...all.map((s) => s.zIndex ?? 0));
      const next = all.map((s) => {
        if (s.id === container.id) {
          return { ...s, type: 'frame', hasAutoLayout: true, layoutFlow: flow, layoutGap: gap, independentPadding: true, paddingTop: Math.max(0, Math.round(minY - container.y)), paddingLeft: Math.max(0, Math.round(minX - container.x)), paddingRight: Math.max(0, Math.round(container.x + container.width - maxX)), paddingBottom: Math.max(0, Math.round(container.y + container.height - maxY)), layoutAlign: 'top-left', widthMode: 'fixed', heightMode: 'fixed' } as Shape;
        }
        // os internos ficam por cima do fundo que virou frame
        return kidIds.has(s.id) ? { ...s, parentId: container.id, zIndex: Math.max(s.zIndex ?? 0, (container.zIndex ?? 0) + 0.001) } : s;
      });
      void top;
      return { shapes: relayoutAll(next), selectId: container.id };
    }
  }

  // envolve a seleção
  const { flow, gap } = inferFlow(roots);
  const minX = Math.min(...roots.map((s) => s.x));
  const minY = Math.min(...roots.map((s) => s.y));
  const maxX = Math.max(...roots.map((s) => s.x + s.width));
  const maxY = Math.max(...roots.map((s) => s.y + s.height));
  const first = roots[0];
  const frameId = newId();
  const frame: Shape = {
    id: frameId,
    name: 'Auto layout',
    type: 'frame',
    pageId: first.pageId,
    parentId: first.parentId,
    x: minX,
    y: minY,
    width: maxX - minX,
    height: maxY - minY,
    rotation: 0,
    fill: 'transparent',
    stroke: 'none',
    strokeWidth: 0,
    opacity: 1,
    zIndex: Math.max(...roots.map((s) => s.zIndex)),
    visible: true,
    hasAutoLayout: true,
    layoutFlow: flow,
    layoutGap: gap,
    independentPadding: true,
    paddingTop: 0,
    paddingRight: 0,
    paddingBottom: 0,
    paddingLeft: 0,
    layoutAlign: 'top-left',
    widthMode: 'hug',
    heightMode: 'hug',
  } as Shape;
  const rootIds = new Set(roots.map((s) => s.id));
  // o frame novo fica logo atrás dos itens, sem alterar a ordem de empilhamento entre eles
  const next = all.map((s) => (rootIds.has(s.id) ? { ...s, parentId: frameId } : s));
  return { shapes: relayoutAll([...next, frame]), selectId: frameId };
}
