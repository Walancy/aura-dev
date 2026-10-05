import type { Shape } from './types';
import { applyDeltas } from './align';

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

const isAuto = (f: Shape) => f.hasAutoLayout && (f.layoutFlow === 'horizontal' || f.layoutFlow === 'vertical') && (f.type === 'frame' || f.type === 'section');

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

function layoutOne(shapes: Shape[], frameId: string): Shape[] {
  const frame = shapes.find((s) => s.id === frameId);
  if (!frame || !isAuto(frame)) return shapes;
  const horizontal = frame.layoutFlow === 'horizontal';

  const padTop = frame.independentPadding ? frame.paddingTop ?? 0 : frame.paddingVertical ?? 0;
  const padBottom = frame.independentPadding ? frame.paddingBottom ?? 0 : frame.paddingVertical ?? 0;
  const padLeft = frame.independentPadding ? frame.paddingLeft ?? 0 : frame.paddingHorizontal ?? 0;
  const padRight = frame.independentPadding ? frame.paddingRight ?? 0 : frame.paddingHorizontal ?? 0;
  const gap = frame.layoutGap ?? 0;

  // Filhos na ordem em que estão no eixo principal (arrastar um filho reordena)
  const kids = shapes
    .filter((s) => s.parentId === frame.id && s.visible !== false)
    .sort((a, b) => (horizontal ? a.x + a.width / 2 - (b.x + b.width / 2) : a.y + a.height / 2 - (b.y + b.height / 2)));
  if (kids.length === 0) return shapes;

  const mainSize = (s: Shape) => (horizontal ? s.width : s.height);
  const crossSize = (s: Shape) => (horizontal ? s.height : s.width);
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
    const free = Math.max(0, frameMain - padMain - gap * (kids.length - 1) - fixed);
    const each = free / fillKids.length;
    sizes = sizes.map((z) => (fillKids.some((k) => k.id === z.id) ? { ...z, main: each } : z));
  }
  const innerCross = frameCross - padCross;
  if (!hugCross) sizes = sizes.map((z) => (crossMode(kids.find((k) => k.id === z.id)!) === 'fill' ? { ...z, cross: innerCross } : z));

  // 2) Tamanho do frame quando "hug"
  const contentMain = sizes.reduce((sum, z) => sum + z.main, 0) + gap * (kids.length - 1);
  const contentCross = Math.max(...sizes.map((z) => z.cross));
  const newMain = hugMain ? contentMain + padMain : frameMain;
  const newCross = hugCross ? contentCross + padCross : frameCross;
  const newW = horizontal ? newMain : newCross;
  const newH = horizontal ? newCross : newMain;

  // 3) Posições conforme o alinhamento (3x3)
  const al = ALIGN_MAP[frame.layoutAlign || 'top-left'] || ALIGN_MAP['top-left'];
  const mainAlign = horizontal ? al.h : al.v;
  const crossAlign = horizontal ? al.v : al.h;
  const innerMain = newMain - padMain;
  const innerCrossFinal = newCross - padCross;
  let cursor = (horizontal ? padLeft : padTop) + (mainAlign === 'center' ? (innerMain - contentMain) / 2 : mainAlign === 'end' ? innerMain - contentMain : 0);

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
    cursor += z.main + gap;
  }

  // 4) Aplica: tamanho do frame, tamanho/posição dos filhos e desloca os netos junto
  let next = shapes.map((s) => (s.id === frame.id ? { ...s, width: Math.round(newW), height: Math.round(newH) } : s));
  const deltas = new Map<string, { dx: number; dy: number }>();
  next = next.map((s) => {
    const p = placed.get(s.id);
    if (!p) return s;
    deltas.set(s.id, { dx: Math.round(p.x - s.x), dy: Math.round(p.y - s.y) });
    return { ...s, width: Math.round(p.width), height: Math.round(p.height) };
  });
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
