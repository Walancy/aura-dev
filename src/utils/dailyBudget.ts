/**
 * Limite diário do Claude:
 * O limite semanal (100%) é dividido entre os 7 dias da semana (~14.29%/dia).
 * Cada dia recebe sua cota diária + o que sobrou dos dias anteriores acumulado,
 * até o reset semanal da conta.
 */
export interface DailyBudgetState {
  day: string;
  weeklyAtStart: number;
  budget: number;
  usedBeforeToday?: number;
  cycleResetTs?: number | null;
}

export interface DailyBudget {
  state: DailyBudgetState;
  budget: number;
  used: number;
  remaining: number;
  exceeded: boolean;
  cumulativeAllocated?: number;
  currentDay?: number;
  dailyShare?: number;
}

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
  const dailyShare = 100 / 7; // ~14.2857% da semana por dia

  // Determina quantos dias faltam e qual dia do ciclo de 7 dias estamos (1 a 7)
  let currentDay = 1;
  if (resetTs && resetTs > now.getTime()) {
    const daysUntilReset = (resetTs - now.getTime()) / DAY_MS;
    const daysRemaining = Math.max(1, Math.min(7, Math.ceil(daysUntilReset)));
    currentDay = Math.max(1, Math.min(7, 7 - daysRemaining + 1));
  }

  // Quota cumulativa liberada até hoje no ciclo
  const cumulativeAllocated = Math.min(100, currentDay * dailyShare);
  const totalUsedThisWeek = Math.max(0, 100 - weeklyNow);

  let state = prev;
  const isNewDay = !state || state.day !== today;
  const isNewWeeklyCycle = !state || weeklyNow > state.weeklyAtStart || (state.cycleResetTs && resetTs && resetTs > state.cycleResetTs + DAY_MS);

  if (isNewDay || isNewWeeklyCycle) {
    let usedBeforeToday = 0;
    if (!isNewWeeklyCycle && currentDay > 1) {
      usedBeforeToday = totalUsedThisWeek;
    }
    // O que sobrou dos dias anteriores:
    const allocBeforeToday = (currentDay - 1) * dailyShare;
    const leftoverFromYesterday = Math.max(0, allocBeforeToday - usedBeforeToday);
    const todayBudget = r1(dailyShare + leftoverFromYesterday);

    state = {
      day: today,
      weeklyAtStart: weeklyNow,
      budget: todayBudget,
      usedBeforeToday,
      cycleResetTs: resetTs,
    };
  }

  // Quanto resta hoje considerando a quota liberada acumulada menos o usado na semana
  const remaining = r1(Math.max(0, cumulativeAllocated - totalUsedThisWeek));
  const usedToday = r1(Math.max(0, totalUsedThisWeek - (state?.usedBeforeToday ?? 0)));
  const exceeded = totalUsedThisWeek > cumulativeAllocated;
  const budget = state?.budget && state.budget > 0 ? state.budget : r1(Math.max(dailyShare, remaining + usedToday));

  return {
    state: { ...state, budget },
    budget,
    used: usedToday,
    remaining,
    exceeded,
    cumulativeAllocated: r1(cumulativeAllocated),
    currentDay,
    dailyShare: r1(dailyShare),
  };
}
