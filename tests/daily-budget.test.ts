import { test, expect } from 'bun:test';
import { computeDailyBudget, parseResetTimestamp } from '../src/utils/dailyBudget';

const at = (d: string) => new Date(d);

test('parseResetTimestamp: data absoluta e relativa', () => {
  const now = at('2026-10-08T12:00:00');
  expect(new Date(parseResetTimestamp('Quinta-feira (15/10) às 15:00 (em 6d 23h 56min)', now)!).getDate()).toBe(15);
  expect(parseResetTimestamp('em 2d 3h', now)).toBe(now.getTime() + (2 * 24 + 3) * 3600000);
  expect(parseResetTimestamp('sem data', now)).toBeNull();
});

test('semana cheia: dia 1 vale 1/7 e o reset diário cai no horário do reset semanal', () => {
  const now = at('2026-10-08T16:00:00');
  const reset = at('2026-10-15T15:00:00').getTime(); // 6d 23h
  const d = computeDailyBudget(100, reset, now);
  expect(d.currentDay).toBe(1);
  expect(d.remaining).toBeCloseTo(14.3, 1);
  expect(d.resetsInMs).toBe(23 * 3600000); // próximo 15:00
});

test('sobras acumulam; estourar deixa hoje negativo e marca excedido', () => {
  const now = at('2026-10-10T12:00:00');
  const reset = at('2026-10-15T15:00:00').getTime(); // 5d 3h -> 6 dias contando hoje
  const saved = computeDailyBudget(95, reset, now); // 95 - 5*14.29
  expect(saved.remaining).toBeCloseTo(23.6, 1);
  const over = computeDailyBudget(60, reset, now);
  expect(over.remaining).toBeCloseTo(-11.4, 1); // 60 - 5*14.29
  expect(over.exceeded).toBe(true);
});

test('sem data de reset: assume semana cheia pela frente', () => {
  expect(computeDailyBudget(100, null, at('2026-10-08T10:00:00')).currentDay).toBe(1);
});
