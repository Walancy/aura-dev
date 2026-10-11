import type { Shape } from './types';
import { descendantIds } from './constraints';

export interface AiReviewEntry {
  id: string;
  prompt: string;
  busy?: boolean;
  w?: number;
  h?: number;
  refs?: string[];
  /** usar o contexto do projeto (regerar mantém o modo) */
  useCtx?: boolean;
  /** especificação visual das imagens de referência (regerar reaproveita sem analisar de novo) */
  refSpec?: string;
  /** a tela que esta versão substituiu (para desfazer a regeração) */
  previous?: Shape[];
  /** a entrada de revisão que a tela substituída tinha (Aceitar/Regerar voltam ao desfazer) */
  prevEntry?: AiReviewEntry;
}

/** Guarda a versão substituída na entrada da nova versão (profundidade 1: não encadeia desfazeres). */
export function withPrevious(entry: Omit<AiReviewEntry, 'previous' | 'prevEntry'>, removed: Shape[], prevEntry?: AiReviewEntry): AiReviewEntry {
  if (!removed.length) return entry;
  return { ...entry, previous: removed, prevEntry: prevEntry ? { ...prevEntry, busy: false, previous: undefined, prevEntry: undefined } : undefined };
}

/** Troca a nova versão (e tudo dentro dela) pela versão anterior. */
export function restorePrevious(all: Shape[], newId: string, previous: Shape[]): Shape[] {
  const gone = new Set([newId, ...descendantIds(all, newId)]);
  const back = new Set(previous.map((s) => s.id));
  return [...all.filter((s) => !gone.has(s.id) && !back.has(s.id)), ...previous];
}

/** Entradas de revisão depois de desfazer: sai a da nova versão; volta a da antiga (se era uma tela da IA). */
export function reviewAfterUndo(list: AiReviewEntry[], entry: AiReviewEntry): AiReviewEntry[] {
  return [...list.filter((r) => r.id !== entry.id), ...(entry.prevEntry ? [entry.prevEntry] : [])];
}
