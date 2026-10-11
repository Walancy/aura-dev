import type { Shape } from './types';
import { interactionsOf, type Action } from './prototype';

export interface ProtoArrow {
  key: string;
  fromId: string;
  toId: string;
  /** caminho SVG (curva com tangentes horizontais), em coordenadas do canvas */
  d: string;
  /** ponta da seta (direção para onde aponta, em graus) */
  tip: { x: number; y: number; angle: number };
  kind: 'navigate' | 'overlay';
}

const targetsOf = (actions: Action[]): Array<{ id: string; kind: 'navigate' | 'overlay' }> =>
  actions.flatMap((a): Array<{ id: string; kind: 'navigate' | 'overlay' }> => {
    if (a.type === 'navigate') return [{ id: a.targetId, kind: 'navigate' }];
    if (a.type === 'overlay') return [{ id: a.targetId, kind: 'overlay' }];
    if (a.type === 'conditional') return [...targetsOf(a.then), ...targetsOf(a.else || [])];
    return [];
  });

/**
 * Setas das ligações do protótipo: do elemento até o frame de destino. Sai pelo lado direito do elemento e chega
 * no lado do destino mais próximo (esquerdo se o destino está à direita; direito se está à esquerda).
 */
export function protoArrows(shapes: Shape[]): ProtoArrow[] {
  const byId = new Map(shapes.map((s) => [s.id, s]));
  const out: ProtoArrow[] = [];
  for (const s of shapes) {
    if (s.visible === false) continue;
    for (const it of interactionsOf(s)) {
      for (const t of targetsOf(it.actions)) {
        const target = byId.get(t.id);
        if (!target || target.id === s.id) continue;
        const sx = s.x + s.width;
        const sy = s.y + s.height / 2;
        const toRight = target.x >= sx;
        const tx = toRight ? target.x : target.x + target.width;
        const ty = target.y + Math.min(target.height / 2, 80);
        const dx = Math.max(40, Math.abs(tx - sx) / 2);
        const c1x = sx + dx;
        const c2x = toRight ? tx - dx : tx + dx;
        const f = (n: number) => Math.round(n * 100) / 100;
        out.push({
          key: `${s.id}:${it.id}:${t.id}`,
          fromId: s.id,
          toId: t.id,
          d: `M ${f(sx)} ${f(sy)} C ${f(c1x)} ${f(sy)} ${f(c2x)} ${f(ty)} ${f(tx)} ${f(ty)}`,
          tip: { x: tx, y: ty, angle: toRight ? 0 : 180 },
          kind: t.kind,
        });
      }
    }
  }
  return out;
}
