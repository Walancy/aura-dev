import type { Shape } from './types';

export type SimilarKind = 'fill' | 'stroke' | 'font' | 'type';

const norm = (c?: string) => (c || '').trim().toLowerCase();

/** Cor do primeiro preenchimento visível (campo `fills` ou o `fill` simples). */
const fillOf = (s: Shape): string => {
  const f = s.fills?.find((x: any) => x.visible !== false && x.type === 'solid');
  return norm((f as any)?.color || s.fill);
};

const strokeOf = (s: Shape): string => {
  const f = s.strokes?.find((x: any) => x.visible !== false);
  return norm((f as any)?.color || s.stroke);
};

const fontOf = (s: Shape): string => `${norm(s.fontFamily)}|${s.fontSize ?? ''}|${s.fontWeight ?? ''}`;

const isTextual = (s: Shape) => s.type === 'text' || s.type === 'text-path';

/** Ids dos elementos (visíveis, desbloqueados, da mesma página) parecidos com `ref`. */
export function selectSimilar(all: Shape[], ref: Shape, kind: SimilarKind): string[] {
  const page = ref.pageId || 'page-1';
  const pool = all.filter((s) => (s.pageId || 'page-1') === page && s.visible !== false && !s.locked);
  const match = (s: Shape) => {
    if (kind === 'type') return s.type === ref.type;
    if (kind === 'font') return isTextual(s) && isTextual(ref) && fontOf(s) === fontOf(ref);
    if (kind === 'stroke') return strokeOf(s) !== '' && strokeOf(s) !== 'none' && strokeOf(s) === strokeOf(ref) && (s.strokeWidth ?? 1) > 0;
    const f = fillOf(ref);
    return f !== '' && f !== 'none' && f !== 'transparent' && fillOf(s) === f;
  };
  return pool.filter(match).map((s) => s.id);
}
