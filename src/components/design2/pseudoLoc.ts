import type { Shape } from './types';
import { descendantIds } from './constraints';

const MAP: Record<string, string> = {
  a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú', c: 'ç', n: 'ñ', y: 'ý', s: 'š', z: 'ž',
  A: 'Á', E: 'É', I: 'Í', O: 'Ó', U: 'Ú', C: 'Ç', N: 'Ñ', Y: 'Ý', S: 'Š', Z: 'Ž',
};

/**
 * Pseudolocalização: troca letras por versões acentuadas, alonga ~30% (repetindo vogais) e envolve em colchetes.
 * Serve para testar se o layout aguenta idiomas mais longos e se algum texto ficou fora da tradução (sem colchetes).
 * Trechos {entre chaves} são preservados.
 */
export function pseudoLocalize(text: string, expand = 0.3): string {
  if (!text.trim()) return text;
  const out = text
    .split(/(\{[^}]*\})/)
    .map((part) => (part.startsWith('{') && part.endsWith('}') ? part : part.replace(/[A-Za-z]/g, (c) => MAP[c] ?? c)))
    .join('');
  const letters = (out.match(/[A-Za-zÀ-ÿ]/g) || []).length;
  const extra = Math.round(letters * expand);
  const pad = extra > 0 ? ' ' + '~'.repeat(Math.max(1, Math.round(extra / 2))) : '';
  return `[${out}${pad}]`;
}

/** Aplica a pseudolocalização aos textos dos shapes (e descendentes); guarda o original em `l10nOriginal`. */
export function pseudoLocalizeShapes(all: Shape[], ids: string[]): Shape[] {
  const set = new Set<string>();
  ids.forEach((id) => {
    set.add(id);
    descendantIds(all, id).forEach((d) => set.add(d));
  });
  return all.map((s) => {
    if (!set.has(s.id) || (s.type !== 'text' && s.type !== 'text-path') || !s.text || s.l10nOriginal !== undefined) return s;
    return { ...s, l10nOriginal: s.text, text: pseudoLocalize(s.text), wrapSource: undefined, runs: undefined };
  });
}

/** Volta os textos pseudolocalizados ao original. */
export function restoreLocalized(all: Shape[], ids: string[]): Shape[] {
  const set = new Set<string>();
  ids.forEach((id) => {
    set.add(id);
    descendantIds(all, id).forEach((d) => set.add(d));
  });
  return all.map((s) => (set.has(s.id) && s.l10nOriginal !== undefined ? { ...s, text: s.l10nOriginal, l10nOriginal: undefined, wrapSource: undefined } : s));
}
