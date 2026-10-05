import { useEffect, useRef } from 'react';
import { getProjectSettings, isQuietNow, subscribeProjectSettings, type ProjectSettings } from '../settings/projectSettingsStore';

// Verifica periodicamente os repositórios com notificações ativadas (Configurações → Alertas e notificações)
// e avisa sobre eventos novos que envolvem o usuário logado.

interface Pending {
  id: string;
  repo: string;
  title: string;
  body: string;
  url?: string;
}

const SETTINGS_PREFIX = 'devflow_project_settings_v1:';
const seenKey = (repo: string) => `devflow_notif_seen_v1:${repo.toLowerCase()}`;
const QUEUE_KEY = 'devflow_notif_queue_v1';

function enabledRepos(): string[] {
  const out: string[] = [];
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k?.startsWith(SETTINGS_PREFIX)) continue;
      const repo = k.slice(SETTINGS_PREFIX.length);
      if (repo.includes('/') && getProjectSettings(repo).notifications.enabled) out.push(repo);
    }
  } catch {}
  return out;
}

function loadSeen(repo: string): { seeded: boolean; ids: string[] } {
  try {
    return JSON.parse(localStorage.getItem(seenKey(repo)) || 'null') || { seeded: false, ids: [] };
  } catch {
    return { seeded: false, ids: [] };
  }
}

function saveSeen(repo: string, ids: string[]) {
  try {
    localStorage.setItem(seenKey(repo), JSON.stringify({ seeded: true, ids: ids.slice(-500) }));
  } catch {}
}

function loadQueue(): Pending[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(q: Pending[]) {
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(q.slice(-100)));
  } catch {}
}

async function collectEvents(repo: string, me: string, cfg: ProjectSettings['notifications']): Promise<Pending[]> {
  const [owner, name] = repo.split('/');
  const gh = window.electronAPI?.github;
  const events: Pending[] = [];
  const meL = me.toLowerCase();

  const [issuesRes, pullsRes, msRes, runsRes] = await Promise.all([
    cfg.events.assignedToMe ? gh?.fetchRepoIssues?.(owner, name) : undefined,
    cfg.events.reviewRequested ? gh?.fetchRepoPulls?.(owner, name) : undefined,
    cfg.events.milestoneDue ? gh?.fetchRepoMilestones?.(owner, name) : undefined,
    cfg.events.ciFailed ? gh?.settings?.('listWorkflowRuns', { owner, repo: name, perPage: 20 }) : undefined,
  ]);

  (issuesRes?.issues || [])
    .filter((i: any) => i.state === 'open' && (i.assignees || []).some((a: any) => a.login?.toLowerCase() === meL))
    .forEach((i: any) => events.push({ id: `assign-${i.number}`, repo, title: `Issue atribuída a você`, body: `${repo}#${i.number} ${i.title}`, url: i.html_url }));

  (pullsRes?.pulls || [])
    .filter((p: any) => p.state === 'open' && (p.requested_reviewers || []).some((u: any) => u.login?.toLowerCase() === meL))
    .forEach((p: any) => events.push({ id: `review-${p.number}-${p.updated_at}`, repo, title: `Review pedido a você`, body: `${repo} PR #${p.number} ${p.title} (@${p.user?.login})`, url: p.html_url }));

  const dueLimit = Date.now() + cfg.milestoneDueDays * 86400000;
  (msRes?.milestones || [])
    .filter((m: any) => m.state === 'open' && m.due_on && new Date(m.due_on).getTime() <= dueLimit && new Date(m.due_on).getTime() >= Date.now() - 86400000)
    .forEach((m: any) =>
      events.push({
        id: `due-${m.number}-${m.due_on}`,
        repo,
        title: `"${m.title}" vence em breve`,
        body: `${repo} • ${m.open_issues} issue(s) aberta(s) • prazo ${new Date(m.due_on).toLocaleDateString('pt-BR')}`,
        url: m.html_url,
      }),
    );

  ((runsRes?.success && runsRes.data) || [])
    .filter((r: any) => r.status === 'completed' && (r.conclusion === 'failure' || r.conclusion === 'timed_out') && (r.actor?.toLowerCase() === meL || ['main', 'master', 'develop'].includes(r.branch)))
    .forEach((r: any) => events.push({ id: `ci-${r.id}`, repo, title: `CI falhou: ${r.name}`, body: `${repo} • ${r.branch} • ${r.title || ''}`, url: r.url }));

  return events;
}

export function useProjectNotifier(showToast: (msg: string) => void) {
  const meRef = useRef<string | null>(null);
  const toastRef = useRef(showToast);
  toastRef.current = showToast;

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const deliver = (items: Pending[]) => {
      if (items.length === 0) return;
      const anyRepo = items[0].repo;
      const cfg = getProjectSettings(anyRepo).notifications;
      if (cfg.toast) toastRef.current(items.length === 1 ? `🔔 ${items[0].title}: ${items[0].body}` : `🔔 ${items.length} novidades: ${items.slice(0, 2).map((i) => i.title).join(' • ')}${items.length > 2 ? '…' : ''}`);
      if (cfg.system && 'Notification' in window && Notification.permission === 'granted') {
        items.slice(0, 5).forEach((it) => {
          const n = new Notification(it.title, { body: it.body });
          if (it.url) n.onclick = () => window.electronAPI?.shell?.openExternal?.(it.url!);
        });
      }
    };

    const tick = async () => {
      const repos = enabledRepos();
      let minPoll = 5;
      if (repos.length > 0) {
        if (!meRef.current) {
          const u = await window.electronAPI?.github?.getUser?.().catch(() => null);
          meRef.current = u?.success ? u.user?.login || null : null;
        }
        const me = meRef.current;
        if (me) {
          const queue = loadQueue();
          for (const repo of repos) {
            const cfg = getProjectSettings(repo).notifications;
            minPoll = Math.min(minPoll, cfg.pollMinutes);
            try {
              const events = await collectEvents(repo, me, cfg);
              const seen = loadSeen(repo);
              const fresh = events.filter((e) => !seen.ids.includes(e.id));
              // Primeira execução só registra o estado atual, para não despejar tudo de uma vez
              if (seen.seeded) queue.push(...fresh);
              saveSeen(repo, [...seen.ids, ...fresh.map((e) => e.id)]);
            } catch {}
          }
          // Horário de silêncio: guarda na fila e entrega quando acabar
          const deliverable = queue.filter((q) => {
            const c = getProjectSettings(q.repo).notifications;
            return c.enabled && !isQuietNow(c.quietStart, c.quietEnd);
          });
          saveQueue(queue.filter((q) => !deliverable.includes(q) && getProjectSettings(q.repo).notifications.enabled));
          deliver(deliverable);
        }
      }
      if (!cancelled) timer = setTimeout(tick, Math.max(2, minPoll) * 60000);
    };

    // Pede permissão de notificação do sistema quando alguém liga o recurso
    const unsubscribe = subscribeProjectSettings((repo) => {
      const cfg = getProjectSettings(repo).notifications;
      if (cfg.enabled && cfg.system && 'Notification' in window && Notification.permission === 'default') Notification.requestPermission();
    });

    timer = setTimeout(tick, 15000);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}
