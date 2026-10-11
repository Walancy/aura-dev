import { test, expect } from 'bun:test';
import { computeDailyBudget, parseResetTimestamp } from '../src/utils/dailyBudget';

const at = (d: string) => new Date(d);

test('parseResetTimestamp: data absoluta e relativa', () => {
  const now = at('2026-10-08T12:00:00');
  expect(new Date(parseResetTimestamp('Quinta-feira (15/10) às 15:00 (em 6d 23h 56min)', now)!).getDate()).toBe(15);
  expect(parseResetTimestamp('em 2d 3h', now)).toBe(now.getTime() + (2 * 24 + 3) * 3600000);
  expect(parseResetTimestamp('sem data', now)).toBeNull();
});

test('orçamento = semana restante ÷ dias; estourar reduz os próximos dias, economizar aumenta', () => {
  const reset = at('2026-10-15T15:00:00').getTime();
  const d1 = computeDailyBudget(null, 100, reset, at('2026-10-08T16:00:00')); // 7 dias
  expect(d1.budget).toBeCloseTo(14.3, 1);
  const spent = computeDailyBudget(d1.state, 80, reset, at('2026-10-08T20:00:00')); // gastou 20 > 14.3
  expect(spent.exceeded).toBe(true);
  const d2 = computeDailyBudget(spent.state, 80, reset, at('2026-10-09T09:00:00')); // 6 dias restantes
  expect(d2.budget).toBeCloseTo(13.3, 1); // 80 ÷ 6 dias (gastou demais ontem: bem menos que os 95/6 de quem economizou)
  const saved = computeDailyBudget(d1.state, 95, reset, at('2026-10-09T09:00:00'));
  expect(saved.budget).toBeGreaterThan(d2.budget); // economizou: o dia seguinte tem mais
  const same = computeDailyBudget(saved.state, 90, reset, at('2026-10-09T10:00:00'));
  expect(same.used).toBe(5);
  expect(same.exceeded).toBe(false);
});

test('semana reiniciou (restante subiu): recalcula', () => {
  const s = computeDailyBudget(null, 20, null, at('2026-10-08T10:00:00'));
  const r = computeDailyBudget(s.state, 100, null, at('2026-10-08T11:00:00'));
  expect(r.state.weeklyAtStart).toBe(100);
  expect(r.used).toBe(0);
});
