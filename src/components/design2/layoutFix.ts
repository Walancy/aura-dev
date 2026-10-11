import type { Shape } from './types';
import { descendantIds } from './constraints';
import { relayoutAll } from './autoLayout';
import { snapSpacing } from './aiStyle';

const isAuto = (s: Shape) => !!s.hasAutoLayout && (s.layoutFlow === 'vertical' || s.layoutFlow === 'horizontal');

/**
 * Corrige problemas comuns de layout nas telas (e nos elementos) indicados, sem IA:
 * espaçamentos fora da grade de 4px, irmãos da mesma fileira com tamanhos quase iguais, elementos para fora do pai,
 * textos/blocos sobrepostos em frames sem auto layout. Termina recalculando todos os auto layouts.
 */
export function fixLayout(all: Shape[], rootIds: string[]): { shapes: Shape[]; fixes: number } {
  const scope = new Set<string>();
  for (const id of rootIds) { scope.add(id); descendantIds(all, id).forEach((d) => scope.add(d)); }
  let fixes = 0;
  let shapes = all.map((s) => ({ ...s }));
  const byId = () => new Map(shapes.map((s) => [s.id, s]));

  // 1) espaçamentos (gap e padding) na grade de 4px
  for (const s of shapes) {
    if (!scope.has(s.id) || !isAuto(s) || s.deviceChrome) continue;
    const snap = (k: 'layoutGap' | 'paddingHorizontal' | 'paddingVertical' | 'paddingTop' | 'paddingRight' | 'paddingBottom' | 'paddingLeft') => {
      const v = s[k];
      if (typeof v !== 'number') return;
      const n = snapSpacing(v);
      if (n !== v) { (s as any)[k] = n; fixes++; }
    };
    (['layoutGap', 'paddingHorizontal', 'paddingVertical', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft'] as const).forEach(snap);
  }

  // 2) irmãos de uma fileira/coluna com tamanho fixo quase igual ficam do mesmo tamanho (cards, chips, botões)
  for (const f of shapes) {
    if (!scope.has(f.id) || !isAuto(f) || f.deviceChrome) continue;
    const horizontal = f.layoutFlow === 'horizontal';
    const kids = shapes.filter((k) => k.parentId === f.id && k.visible !== false && !k.deviceChrome && k.type === 'frame' && (horizontal ? k.heightMode : k.widthMode) !== 'fill' && (horizontal ? k.heightMode : k.widthMode) !== 'hug');
    if (kids.length < 2) continue;
    const size = (k: Shape) => (horizontal ? k.height : k.width);
    const max = Math.max(...kids.map(size));
    const min = Math.min(...kids.map(size));
    if (max === min || (max - min) / max > 0.2) continue;
    for (const k of kids) if (size(k) !== max) { if (horizontal) k.height = max; else k.width = max; fixes++; }
  }

  // 3) elementos para fora do pai (frames sem auto layout): traz para dentro, com os descendentes
  const move = (id: string, dx: number, dy: number) => {
    if (!dx && !dy) return;
    const ids = new Set([id, ...descendantIds(shapes, id)]);
    shapes = shapes.map((s) => (ids.has(s.id) ? { ...s, x: s.x + dx, y: s.y + dy } : s));
    fixes++;
  };
  {
    const m = byId();
    for (const c of shapes.filter((s) => scope.has(s.id) && s.parentId)) {
      const p = m.get(c.parentId!);
      if (!p || p.type !== 'frame' || isAuto(p) || p.deviceChrome || c.deviceChrome || c.isMask) continue;
      if (c.width > p.width * 0.8 || c.height > p.height * 0.8) continue; // fundos, brilhos e imagens grandes ficam como estão
      if (c.effects?.some((e) => e.visible !== false && (e.type === 'layer-blur'))) continue;
      const cur = shapes.find((s) => s.id === c.id)!;
      const nx = Math.min(Math.max(cur.x, p.x), p.x + p.width - cur.width);
      const ny = Math.min(Math.max(cur.y, p.y), p.y + p.height - cur.height);
      move(c.id, Math.round(nx - cur.x), Math.round(ny - cur.y));
    }
  }

  // 4) sobreposição parcial entre textos/blocos irmãos em frames sem auto layout: empurra o de baixo
  {
    const parents = new Set(shapes.filter((s) => scope.has(s.id) && s.type === 'frame' && !isAuto(s) && !s.deviceChrome).map((s) => s.id));
    for (const pid of parents) {
      const sib = () => shapes.filter((s) => s.parentId === pid && s.visible !== false && !s.deviceChrome && (s.type === 'text' || s.type === 'frame')).sort((a, b) => a.y - b.y);
      const list = sib();
      for (let i = 0; i < list.length; i++) {
        for (let j = i + 1; j < list.length; j++) {
          const a = shapes.find((s) => s.id === list[i].id)!;
          const b = shapes.find((s) => s.id === list[j].id)!;
          if (a.type === 'frame' && b.type === 'frame') continue; // blocos grandes podem se sobrepor de propósito
          const xOverlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const yOverlap = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
          if (xOverlap <= 4 || yOverlap <= 4) continue;
          const contains = (o: Shape, i2: Shape) => i2.x >= o.x - 1 && i2.y >= o.y - 1 && i2.x + i2.width <= o.x + o.width + 1 && i2.y + i2.height <= o.y + o.height + 1;
          if (contains(a, b) || contains(b, a)) continue; // texto dentro de um bloco é normal
          move(b.id, 0, Math.round(yOverlap + 8));
        }
      }
    }
  }

  return { shapes: relayoutAll(shapes), fixes };
}
