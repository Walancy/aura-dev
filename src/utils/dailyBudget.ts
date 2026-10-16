/**
 * Limite diário do Claude, sem estado, ancorado no reset semanal:
 * o dia começa no horário do reset semanal e cada dia vale 1/7 do total semanal (~14.3 pts).
 * Disponível hoje = restante da semana - reserva dos dias que ainda virão (dias seguintes x 1/7).
 * Sobras acumulam sozinhas; gastar a mais deixa hoje NEGATIVO (os pontos que já saíram da reserva dos próximos dias).
 */
export interface DailyBudget {
  /** teto de pontos do dia: cota base + sobras acumuladas */
  budget: number;
  remaining: number;
  exceeded: boolean;
  currentDay: number;
  dailyShare: number;
  /** ms até o próximo reset diário (mesmo horário do reset semanal) */
  resetsInMs: number;
}

const DAY_MS = 86400000;
const r1 = (n: number) => Math.round(n * 10) / 10;

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

export function computeDailyBudget(weeklyRemaining: number, resetTs: number | null, now: Date): DailyBudget {
  const dailyShare = 100 / 7;
  const msToReset = resetTs && resetTs > now.getTime() ? resetTs - now.getTime() : 7 * DAY_MS;
  const daysLeft = Math.max(1, Math.min(7, Math.ceil(msToReset / DAY_MS))); // inclui hoje
  const reserve = (daysLeft - 1) * dailyShare; // guardado para os dias seguintes
  const available = weeklyRemaining - reserve; // negativo quando já consumiu a reserva dos dias seguintes
  const budget = Math.max(dailyShare, available);
  return {
    budget: r1(budget),
    remaining: r1(available),
    exceeded: weeklyRemaining < reserve,
    currentDay: 8 - daysLeft,
    dailyShare: r1(dailyShare),
    resetsInMs: msToReset - (daysLeft - 1) * DAY_MS,
  };
}
