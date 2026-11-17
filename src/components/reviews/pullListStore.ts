import { ghSettings } from '../settings/settingsUi';
import type { PullListItem } from './PullRequestsList';

export interface PullListData {
  me?: string;
  openCount: number;
  closedCount: number;
  items: PullListItem[];
}

// Lista de PRs por repositório: carrega uma vez, volta instantâneo do cache e só atualiza em segundo plano
const cache = new Map<string, { data: PullListData; at: number }>();
const inflight = new Map<string, Promise<PullListData>>();
const listeners = new Set<() => void>();
const key = (repoFullName: string) => repoFullName.toLowerCase();

export const getCachedPulls = (repoFullName?: string) => (repoFullName ? cache.get(key(repoFullName)) : undefined);
export const subscribePulls = (cb: () => void) => {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
};

// Busca no GitHub e só avisa os ouvintes se algo mudou (PR novo, estado diferente...): sem mudança, nada re-renderiza
export function refreshPulls(repoFullName: string): Promise<PullListData> {
  const k = key(repoFullName);
  const running = inflight.get(k);
  if (running) return running;
  const [owner, repo] = repoFullName.split('/');
  const p = ghSettings<PullListData>('pullList', { owner, repo })
    .then((data) => {
      const prev = cache.get(k);
      const changed = !prev || JSON.stringify(prev.data) !== JSON.stringify(data);
      cache.set(k, { data: changed ? data : prev!.data, at: Date.now() });
      if (changed) listeners.forEach((l) => l());
      return cache.get(k)!.data;
    })
    .finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}
