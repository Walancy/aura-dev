import type { Shape } from './types';
import type { Box } from './snap';
import { rulerStep } from './snap';

export interface RulerGuide {
  id: string;
  axis: 'x' | 'y'; // 'x' = linha vertical em x=pos (arrastada da régua da esquerda); 'y' = horizontal (da régua de cima)
  pos: number;
}

export const RULER_SIZE = 18;
const BIG = 100000;

export interface RulerTick {
  value: number; // coordenada no canvas
  major: boolean;
  label?: string; // valor relativo à origem, só nos principais
}

/** Passos principal/secundário da régua conforme o zoom (principal ≈ 80px na tela; secundário divide em 4 ou 5). */
export function rulerScale(zoom: number): { major: number; minor: number } {
  const major = rulerStep(zoom);
  const mantissa = major / Math.pow(10, Math.floor(Math.log10(major)));
  const minor = mantissa === 2 ? major / 4 : major / 5;
  return { major, minor };
}

/** Marcas visíveis entre `from` e `to` (coordenadas do canvas); rótulos relativos a `origin`. */
export function rulerTicks(from: number, to: number, zoom: number, origin = 0): RulerTick[] {
  const { major, minor } = rulerScale(zoom);
  const ticks: RulerTick[] = [];
  const start = Math.floor((from - origin) / minor) * minor + origin;
  for (let v = start; v <= to; v += minor) {
    const rel = Math.round((v - origin) * 1000) / 1000;
    const isMajor = Math.abs(rel / major - Math.round(rel / major)) < 1e-6;
    ticks.push({ value: v, major: isMajor, label: isMajor ? String(Math.round(rel * 100) / 100) : undefined });
  }
  return ticks;
}

/** Extensão (início/fim) dos shapes selecionados em um eixo, com rótulos relativos à origem. */
export function selectionRange(boxes: Box[], axis: 'x' | 'y', origin = 0): { start: number; end: number; startLabel: string; endLabel: string } | null {
  if (boxes.length === 0) return null;
  const start = Math.min(...boxes.map((b) => (axis === 'x' ? b.x : b.y)));
  const end = Math.max(...boxes.map((b) => (axis === 'x' ? b.x + b.width : b.y + b.height)));
  const f = (n: number) => String(Math.round((n - origin) * 100) / 100);
  return { start, end, startLabel: f(start), endLabel: f(end) };
}

/** Origem das réguas: canto do frame que contém a seleção (ou o próprio frame). Sem seleção em frame: 0,0. */
export function rulerOrigin(selected: Shape[], all: Shape[]): { x: number; y: number } {
  if (selected.length === 0) return { x: 0, y: 0 };
  const first = selected[0];
  let cur: Shape | undefined = first.type === 'frame' ? first : all.find((s) => s.id === first.parentId);
  let guard = 0;
  while (cur && cur.type !== 'frame' && guard++ < 30) cur = all.find((s) => s.id === cur!.parentId);
  return cur && cur.type === 'frame' ? { x: cur.x, y: cur.y } : { x: 0, y: 0 };
}

/** Guias como boxes de largura/altura zero para o encaixe de shapes. */
export function guideBoxes(guides: RulerGuide[]): Box[] {
  return guides.map((g) => (g.axis === 'x' ? { x: g.pos, y: -BIG, width: 0, height: 2 * BIG } : { x: -BIG, y: g.pos, width: 2 * BIG, height: 0 }));
}

/** Encaixa a posição de uma guia arrastada nas bordas/centros dos shapes (ou na grade). */
export function snapGuidePos(pos: number, axis: 'x' | 'y', boxes: Box[], threshold: number, grid = 0): number {
  let best = pos;
  let bestD = threshold + 1;
  for (const b of boxes) {
    const candidates = axis === 'x' ? [b.x, b.x + b.width / 2, b.x + b.width] : [b.y, b.y + b.height / 2, b.y + b.height];
    for (const c of candidates) {
      const d = Math.abs(c - pos);
      if (d <= threshold && d < bestD) {
        best = c;
        bestD = d;
      }
    }
  }
  if (bestD > threshold && grid > 0) {
    const g = Math.round(pos / grid) * grid;
    if (Math.abs(g - pos) <= threshold) best = g;
  }
  return best;
}

export const newGuideId = () => `guide-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
