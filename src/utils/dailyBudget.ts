/**
 * Limite diário do Claude: o que sobra da semana dividido pelos dias que faltam até o reset.
 * Passar do limite de hoje reduz o dos próximos dias; não usar tudo faz o dos próximos aumentar,
 * porque o orçamento é recalculado a cada dia a partir do que restou da semana.
 */
export interface DailyBudgetState { day: string; weeklyAtStart: number; budget: number }
export interface DailyBudget { state: DailyBudgetState; budget: number; used: number; remaining: number; exceeded: boolean }

const DAY_MS = 86400000;
const r1 = (n: number) => Math.round(n * 10) / 10;
export const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** "Quinta-feira (15/10) às 15:00 (em 6d 23h 56min)" → instante do reset (data absoluta; senão o "em ..." relativo) */
export function parseResetTimestamp(text: string | undefined, now: Date): number | null {
  if (!text) return null;
  const abs = /\((\d{1,2})\/(\d{1,2})\)\s*(?:às|as)\s*(\d{1,2}):(\d{2})/i.exec(text);
  if (abs) {
    let t = new Date(now.getFullYear(), +abs[2] - 1, +abs[1], +abs[3], +abs[4]).getTime();
    if (t < now.getTime() - 7 * DAY_MS) t = new Date(now.getFullYear() + 1, +abs[2] - 1, +abs[1], +abs[3], +abs[4]).getTime();
    return t;
  }
  const rel = /em\s+(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*min)?/i.exec(text);
  if (rel && (rel[1] || rel[2] || rel[3])) return now.getTime() + (+(rel[1] || 0) * 24 * 60 + +(rel[2] || 0) * 60 + +(rel[3] || 0)) * 60000;
  return null;
}

export function computeDailyBudget(prev: DailyBudgetState | null, weeklyNow: number, resetTs: number | null, now: Date): DailyBudget {
  const today = dayKey(now);
  let state = prev;
  // novo dia (ou a semana reiniciou: o restante subiu): o ponto de partida do dia é o que sobrou da semana
  if (!state || state.day !== today || weeklyNow > state.weeklyAtStart) state = { day: today, weeklyAtStart: weeklyNow, budget: 0 };
  // o orçamento é recalculado a cada leitura com os dias que faltam: uma data de reset lida errada antes não fica gravada o dia todo
  // dias de calendário de hoje até o dia do reset (7 no primeiro dia da semana; no dia do reset, 1)
  const startOf = (t: number) => { const d = new Date(t); return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime(); };
  const days = resetTs && resetTs - now.getTime() < 8 * DAY_MS ? Math.max(1, Math.round((startOf(resetTs) - startOf(now.getTime())) / DAY_MS)) : 7;
  state = { ...state, budget: r1(state.weeklyAtStart / days) };
  const used = r1(Math.max(0, state.weeklyAtStart - weeklyNow));
  return { state, budget: state.budget, used, remaining: r1(state.budget - used), exceeded: used > state.budget };
}
