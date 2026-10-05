// Configurações do DevFlow por repositório (o que o GitHub não guarda).
// Lidas de forma síncrona por várias telas (Sprints, Time, IA), por isso ficam em localStorage.

export type IssueStatus = 'A Fazer' | 'Em Progresso' | 'Concluído';

export interface ProjectSettings {
  version: 1;
  workflow: {
    linkedProject?: { number: number; title?: string; owner?: string } | null;
    statusFieldName?: string; // campo single-select usado como status (default: "Status")
    estimateFieldName?: string; // campo numérico de estimativa (default: qualquer número)
    iterationFieldName?: string; // campo de iteração usado como sprint (default: qualquer iteração)
    statusMapping: Record<string, IssueStatus>; // nome da opção → status do DevFlow
  };
  sprint: {
    durationDays: number;
    startWeekday: number; // 0 = domingo
    namePattern: string; // tokens: {n} {inicio} {fim}
    carryOver: 'next' | 'keep';
  };
  estimates: {
    unit: 'points' | 'hours' | 'tshirt';
    capacityPerPerson: number; // por sprint, na unidade escolhida
  };
  ai: {
    providerId?: string;
    model?: string;
    contextNotes: string;
    automations: {
      issueDescription: boolean;
      weeklySummary: boolean;
      weeklySummaryWeekday: number;
      assigneeSuggestions: boolean;
    };
    permission: 'suggest' | 'act';
  };
  alerts: {
    prNoReviewHours: number;
    reviewWaitHours: number;
    overloadScore: number;
    staleMemberDays: number;
    inactiveAccessDays: number;
    maxAdminsPercent: number;
  };
  notifications: {
    enabled: boolean;
    toast: boolean;
    system: boolean;
    quietStart: string; // HH:mm
    quietEnd: string;
    events: {
      assignedToMe: boolean;
      reviewRequested: boolean;
      ciFailed: boolean;
      milestoneDue: boolean;
    };
    milestoneDueDays: number;
    pollMinutes: number;
  };
  local: {
    path?: string;
    commands: { run?: string; test?: string; build?: string; deploy?: string };
    flutter: { sdkPath?: string; flavor?: string; device?: string; target?: string };
  };
  prefs: {
    defaultView: 'kanban' | 'timeline' | 'spreadsheet';
    dailyAi: boolean;
  };
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  version: 1,
  workflow: { linkedProject: null, statusMapping: {} },
  sprint: { durationDays: 14, startWeekday: 1, namePattern: 'Sprint {n}', carryOver: 'next' },
  estimates: { unit: 'points', capacityPerPerson: 20 },
  ai: {
    contextNotes: '',
    automations: { issueDescription: true, weeklySummary: false, weeklySummaryWeekday: 5, assigneeSuggestions: true },
    permission: 'act',
  },
  alerts: { prNoReviewHours: 48, reviewWaitHours: 48, overloadScore: 8, staleMemberDays: 14, inactiveAccessDays: 60, maxAdminsPercent: 30 },
  notifications: {
    enabled: false,
    toast: true,
    system: true,
    quietStart: '20:00',
    quietEnd: '08:00',
    events: { assignedToMe: true, reviewRequested: true, ciFailed: true, milestoneDue: true },
    milestoneDueDays: 2,
    pollMinutes: 5,
  },
  local: { commands: {}, flutter: {} },
  prefs: { defaultView: 'kanban', dailyAi: true },
};

const KEY = (repo: string) => `devflow_project_settings_v1:${repo.toLowerCase()}`;
const memo = new Map<string, ProjectSettings>();
const listeners = new Set<(repo: string) => void>();

function merge<T>(base: T, patch: any): T {
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return (patch ?? base) as T;
  const out: any = { ...base };
  for (const k of Object.keys(patch)) {
    const b = (base as any)?.[k];
    out[k] = b && typeof b === 'object' && !Array.isArray(b) && k !== 'statusMapping' ? merge(b, patch[k]) : patch[k];
  }
  return out;
}

export function getProjectSettings(repo?: string | null): ProjectSettings {
  if (!repo) return DEFAULT_PROJECT_SETTINGS;
  const key = repo.toLowerCase();
  const hit = memo.get(key);
  if (hit) return hit;
  let parsed: any = null;
  try {
    parsed = JSON.parse(localStorage.getItem(KEY(repo)) || 'null');
  } catch {}
  // Migra as preferências antigas da tela de configurações
  if (!parsed) {
    try {
      const oldView = localStorage.getItem(`devflow_pref_default_view_${repo}`);
      const oldDaily = localStorage.getItem(`devflow_pref_daily_ai_${repo}`);
      if (oldView || oldDaily) parsed = { prefs: { ...(oldView ? { defaultView: oldView } : {}), ...(oldDaily ? { dailyAi: oldDaily !== 'false' } : {}) } };
    } catch {}
  }
  const settings = merge(DEFAULT_PROJECT_SETTINGS, parsed || {});
  memo.set(key, settings);
  return settings;
}

export function saveProjectSettings(repo: string, next: ProjectSettings) {
  memo.set(repo.toLowerCase(), next);
  try {
    localStorage.setItem(KEY(repo), JSON.stringify(next));
    // Mantém as chaves antigas em sincronia para quem ainda lê direto
    localStorage.setItem(`devflow_pref_default_view_${repo}`, next.prefs.defaultView);
    localStorage.setItem(`devflow_pref_daily_ai_${repo}`, String(next.prefs.dailyAi));
  } catch {}
  listeners.forEach((fn) => fn(repo));
}

export function updateProjectSettings(repo: string, fn: (prev: ProjectSettings) => ProjectSettings): ProjectSettings {
  const next = fn(getProjectSettings(repo));
  saveProjectSettings(repo, next);
  return next;
}

export function subscribeProjectSettings(fn: (repo: string) => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function exportProjectSettings(repo: string): string {
  return JSON.stringify({ repo, exportedAt: new Date().toISOString(), settings: getProjectSettings(repo) }, null, 2);
}

export function importProjectSettings(repo: string, json: string): ProjectSettings {
  const parsed = JSON.parse(json);
  const incoming = parsed?.settings || parsed;
  if (!incoming || typeof incoming !== 'object') throw new Error('Arquivo inválido.');
  // Caminho local e comandos são da máquina/repo de origem — não faz sentido importar
  const next = merge(DEFAULT_PROJECT_SETTINGS, { ...incoming, local: getProjectSettings(repo).local });
  saveProjectSettings(repo, next);
  return next;
}

// ---------------------------------------------------------------------------
// Status do Project V2 → status do DevFlow
// ---------------------------------------------------------------------------

export function guessStatusFromName(name: string): IssueStatus | undefined {
  const s = name.toLowerCase().trim();
  if (/done|conclu|finaliz|closed|pronto|entregue/.test(s)) return 'Concluído';
  if (/progress|andamento|doing|wip|fazendo|desenvolv|\bdev\b|test|review|revis|\bqa\b/.test(s)) return 'Em Progresso';
  if (/todo|to do|a fazer|backlog|pendente|ready|triage/.test(s)) return 'A Fazer';
  return undefined;
}

export function resolveProjectStatus(repo: string | undefined, optionName: string | undefined): IssueStatus | undefined {
  if (!optionName) return undefined;
  const mapping = getProjectSettings(repo).workflow.statusMapping;
  const explicit = mapping[optionName] || Object.entries(mapping).find(([k]) => k.toLowerCase() === optionName.toLowerCase())?.[1];
  return explicit || guessStatusFromName(optionName);
}

export function formatSprintName(pattern: string, n: number, startIso: string, endIso: string): string {
  const fmt = (iso: string) => new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  return pattern.replace(/\{n\}/g, String(n)).replace(/\{inicio\}/g, fmt(startIso)).replace(/\{fim\}/g, fmt(endIso));
}

export function isQuietNow(start: string, end: string, now = new Date()): boolean {
  const toMin = (hhmm: string) => {
    const [h, m] = hhmm.split(':').map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const cur = now.getHours() * 60 + now.getMinutes();
  const s = toMin(start);
  const e = toMin(end);
  if (s === e) return false;
  return s < e ? cur >= s && cur < e : cur >= s || cur < e;
}
