// Quem está usando o Brain agora (chat da IDE com o contexto anexado, CLI lendo as notas, IA do próprio Brain): o botão da header acende enquanto houver alguém.
import { useSyncExternalStore } from 'react';

const active = new Set<string>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const subs = new Set<() => void>();
let snapshot = false;

const emit = () => {
  const next = active.size > 0;
  if (next === snapshot) return;
  snapshot = next;
  subs.forEach((f) => f());
};

export function setBrainActivity(source: string, on: boolean) {
  const t = timers.get(source);
  if (t) { clearTimeout(t); timers.delete(source); }
  if (on) active.add(source); else active.delete(source);
  emit();
}

/** Atividade curta (ex.: a CLI abriu uma nota): fica acesa por `ms` depois do último sinal. */
export function pulseBrainActivity(source: string, ms = 8000) {
  setBrainActivity(source, true);
  timers.set(source, setTimeout(() => setBrainActivity(source, false), ms));
}

export const useBrainActive = () =>
  useSyncExternalStore(
    (cb) => { subs.add(cb); return () => { subs.delete(cb); }; },
    () => snapshot,
  );
