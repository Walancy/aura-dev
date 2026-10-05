import type { ProjectIssue, SprintOption } from '../ProjectsSchedulerView';

// ---------------------------------------------------------------------------
// Dados crus vindos de github:fetchTeamInsights
// ---------------------------------------------------------------------------

export type RepoRole = 'admin' | 'maintain' | 'write' | 'triage' | 'read';

export interface TeamCollaboratorRaw {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
  roleName: RepoRole;
  affiliation: 'direct' | 'outside' | 'organization';
  contributions?: number;
}

export interface TeamRaw {
  id: number;
  slug: string;
  name: string;
  description: string;
  htmlUrl?: string;
  permission: RepoRole | string;
  members: Array<{ login: string; avatarUrl: string }>;
  repos: Array<{ fullName: string; permission: RepoRole | string }>;
}

export interface TeamPullRaw {
  number: number;
  title: string;
  url: string;
  author?: string;
  authorAvatarUrl?: string;
  createdAt: string;
  updatedAt: string;
  closedAt?: string | null;
  mergedAt?: string | null;
  draft: boolean;
  requestedReviewers: string[];
  requestedTeams: string[];
  reviews: Array<{ login?: string; state: string; submittedAt?: string }>;
}

export interface TeamInsightsRaw {
  isOrg: boolean;
  canAdmin: boolean;
  collaborators: TeamCollaboratorRaw[];
  teams: TeamRaw[];
  invitations: Array<{ id: number; login: string; avatarUrl?: string; permission: string; createdAt: string; inviter?: string; expired: boolean }>;
  openPulls: TeamPullRaw[];
  closedPulls: TeamPullRaw[];
  commits: Array<{ sha: string; author: string | null; authorName: string; date: string; message: string }>;
  codeowners: string | null;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Dados locais (o GitHub não tem conceito de disponibilidade, skills, etc.)
// ---------------------------------------------------------------------------

export type AvailabilityStatus = 'disponivel' | 'ferias' | 'folga' | 'ausente' | 'meio-periodo';

export interface PersonLocalData {
  availability?: { status: AvailabilityStatus; from?: string; to?: string; note?: string };
  timezone?: string;
  skills?: string[];
}

export interface AccessHistoryEntry {
  id: string;
  at: string;
  actor: string;
  action: 'add' | 'remove' | 'role' | 'invite-cancel' | 'team-add' | 'team-remove' | 'team-role' | 'team-create' | 'review-request' | 'assign';
  target: string;
  detail?: string;
}

export interface RepoTeamLocalData {
  onboarding: Record<string, { startedAt: string; manualDone: string[] }>;
  history: AccessHistoryEntry[];
  aiSummary?: { text: string; generatedAt: string; provider?: string };
}

const PEOPLE_KEY = 'devflow_team_people_v1';
const repoKey = (repo: string) => `devflow_team_repo_v1:${repo.toLowerCase()}`;

export function loadPeopleData(): Record<string, PersonLocalData> {
  try {
    return JSON.parse(localStorage.getItem(PEOPLE_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function savePeopleData(data: Record<string, PersonLocalData>) {
  try {
    localStorage.setItem(PEOPLE_KEY, JSON.stringify(data));
  } catch {}
}

export function loadRepoTeamData(repo: string): RepoTeamLocalData {
  try {
    const parsed = JSON.parse(localStorage.getItem(repoKey(repo)) || 'null');
    if (parsed) return { onboarding: parsed.onboarding || {}, history: parsed.history || [], aiSummary: parsed.aiSummary };
  } catch {}
  return { onboarding: {}, history: [] };
}

export function saveRepoTeamData(repo: string, data: RepoTeamLocalData) {
  try {
    localStorage.setItem(repoKey(repo), JSON.stringify({ ...data, history: data.history.slice(0, 300) }));
  } catch {}
}

// ---------------------------------------------------------------------------
// Daily (lê o mesmo storage da tela de Daily)
// ---------------------------------------------------------------------------

export interface DailySnapshot {
  yesterday: string[];
  today: string[];
  blockers: Array<{ title: string; severity?: string }>;
}

export function loadDailyByPerson(repo: string, currentUserLogin?: string): Record<string, DailySnapshot> {
  const out: Record<string, DailySnapshot> = {};
  let items: any[] = [];
  try {
    items = JSON.parse(localStorage.getItem('devflow_daily_items_unified_v2') || '[]') || [];
  } catch {
    return out;
  }
  const repoShort = repo.split('/').pop()?.toLowerCase() || '';
  const today = new Date();
  const todayIso = toLocalIso(today);
  const yesterdayIso = toLocalIso(new Date(today.getTime() - 86400000));

  for (const item of items) {
    const project = String(item.projectName || item.projectId || '').toLowerCase();
    if (project && repoShort && !project.includes(repoShort) && !repoShort.includes(project)) continue;
    if (item.dateIso !== todayIso && item.dateIso !== yesterdayIso) continue;
    const who = String(item.assignee?.name || currentUserLogin || '').toLowerCase();
    if (!who) continue;
    const snap = (out[who] ||= { yesterday: [], today: [], blockers: [] });
    if (item.category === 'blocker') {
      if (item.blockerStatus !== 'Resolvido') snap.blockers.push({ title: item.title, severity: item.blockerSeverity });
    } else if (item.category === 'yesterday') snap.yesterday.push(item.title);
    else if (item.category === 'today') snap.today.push(item.title);
  }
  return out;
}

function toLocalIso(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// ---------------------------------------------------------------------------
// Métricas
// ---------------------------------------------------------------------------

export type LoadLevel = 'idle' | 'ok' | 'high' | 'overloaded';

// Limites configuráveis em Configurações → Alertas / Fluxo de trabalho
export interface TeamThresholds {
  prNoReviewHours: number;
  reviewWaitHours: number;
  overloadScore: number;
  staleMemberDays: number;
  inactiveAccessDays: number;
  maxAdminsPercent: number;
  capacityPerPerson: number;
}

export const DEFAULT_THRESHOLDS: TeamThresholds = {
  prNoReviewHours: 48,
  reviewWaitHours: 48,
  overloadScore: 8,
  staleMemberDays: 14,
  inactiveAccessDays: 60,
  maxAdminsPercent: 30,
  capacityPerPerson: 20,
};

export interface MemberStats {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
  role: RepoRole;
  affiliation: TeamCollaboratorRaw['affiliation'];
  teams: string[];
  openAssigned: ProjectIssue[];
  inProgress: number;
  sprintIssues: number;
  sprintPoints: number;
  openPulls: TeamPullRaw[];
  reviewQueue: Array<{ pull: TeamPullRaw; waitingHours: number }>;
  commits90d: number;
  lastCommitAt?: string;
  lastActivityAt?: string;
  closedLast14d: number;
  firstActivityAt?: string;
  loadScore: number;
  loadLevel: LoadLevel;
  tags: Record<string, number>;
}

const hoursSince = (iso?: string | null) => (iso ? (Date.now() - new Date(iso).getTime()) / 3600000 : Infinity);
const maxIso = (...vals: Array<string | undefined | null>) =>
  vals.filter(Boolean).sort((a, b) => new Date(b as string).getTime() - new Date(a as string).getTime())[0] || undefined;
const minIso = (...vals: Array<string | undefined | null>) =>
  vals.filter(Boolean).sort((a, b) => new Date(a as string).getTime() - new Date(b as string).getTime())[0] || undefined;

export function findActiveSprint(sprints: SprintOption[]): SprintOption | undefined {
  const now = Date.now();
  const open = sprints.filter((s) => s.state === 'open');
  return (
    open.find((s) => {
      const start = s.startDateIso ? new Date(`${s.startDateIso}T00:00:00`).getTime() : -Infinity;
      const end = s.dueDateIso ? new Date(`${s.dueDateIso}T23:59:59`).getTime() : Infinity;
      return start <= now && now <= end;
    }) ||
    open.sort((a, b) => (a.dueDateIso || '9999').localeCompare(b.dueDateIso || '9999'))[0]
  );
}

const issueHasLogin = (issue: ProjectIssue, login: string) =>
  issue.assignees.some((a) => a.name.toLowerCase() === login.toLowerCase());

export function computeMemberStats(
  raw: TeamInsightsRaw,
  issues: ProjectIssue[],
  activeSprint: SprintOption | undefined,
  sprintMatcher: (issue: ProjectIssue, sprint: SprintOption) => boolean,
  th: TeamThresholds = DEFAULT_THRESHOLDS,
): MemberStats[] {
  const now = Date.now();
  const teamByLogin = new Map<string, string[]>();
  raw.teams.forEach((t) =>
    t.members.forEach((m) => {
      const k = m.login.toLowerCase();
      teamByLogin.set(k, [...(teamByLogin.get(k) || []), t.name]);
    }),
  );

  const base = raw.collaborators.map((c) => {
    const key = c.login.toLowerCase();
    const assigned = issues.filter((i) => issueHasLogin(i, c.login));
    const openAssigned = assigned.filter((i) => i.status !== 'Concluído');
    const sprintOpen = activeSprint ? openAssigned.filter((i) => sprintMatcher(i, activeSprint)) : [];
    const myCommits = raw.commits.filter((cm) => cm.author?.toLowerCase() === key);
    const myOpenPulls = raw.openPulls.filter((p) => p.author?.toLowerCase() === key);
    const myAllPulls = [...raw.openPulls, ...raw.closedPulls].filter((p) => p.author?.toLowerCase() === key);
    const reviewQueue = raw.openPulls
      .filter((p) => !p.draft && p.requestedReviewers.some((r) => r.toLowerCase() === key))
      .map((pull) => {
        // Espera conta a partir do último review do próprio revisor (re-request) ou da abertura do PR
        const lastOwn = pull.reviews.filter((r) => r.login?.toLowerCase() === key).map((r) => r.submittedAt);
        return { pull, waitingHours: hoursSince(maxIso(pull.createdAt, ...lastOwn)) };
      })
      .sort((a, b) => b.waitingHours - a.waitingHours);
    const tags: Record<string, number> = {};
    assigned.forEach((i) => {
      [i.tag, ...(i.rawLabels || [])].forEach((l) => {
        const k = String(l || '').toLowerCase();
        if (!k || k === 'geral' || k.startsWith('priority:') || k.startsWith('sprint')) return;
        tags[k] = (tags[k] || 0) + 1;
      });
    });
    const lastCommitAt = maxIso(...myCommits.map((cm) => cm.date));
    const lastActivityAt = maxIso(
      lastCommitAt,
      ...myAllPulls.map((p) => p.updatedAt),
      ...issues.filter((i) => i.author?.toLowerCase() === key).map((i) => i.createdAtIso),
      ...raw.openPulls.flatMap((p) => p.reviews.filter((r) => r.login?.toLowerCase() === key).map((r) => r.submittedAt)),
    );
    const firstActivityAt = minIso(
      ...myCommits.map((cm) => cm.date),
      ...myAllPulls.map((p) => p.createdAt),
      ...issues.filter((i) => i.author?.toLowerCase() === key).map((i) => i.createdAtIso),
    );
    const inProgress = openAssigned.filter((i) => i.status === 'Em Progresso').length;
    const loadScore = openAssigned.length + inProgress * 0.5 + myOpenPulls.length * 0.5 + reviewQueue.length * 0.3;
    return {
      login: c.login,
      avatarUrl: c.avatarUrl,
      htmlUrl: c.htmlUrl,
      role: c.roleName,
      affiliation: c.affiliation,
      teams: teamByLogin.get(key) || [],
      openAssigned,
      inProgress,
      sprintIssues: sprintOpen.length,
      sprintPoints: sprintOpen.reduce((acc, i) => acc + (i.projectV2Estimate || 0), 0),
      openPulls: myOpenPulls,
      reviewQueue,
      commits90d: myCommits.length,
      lastCommitAt,
      lastActivityAt,
      closedLast14d: assigned.filter((i) => i.closedAtIso && now - new Date(i.closedAtIso).getTime() < 14 * 86400000).length,
      firstActivityAt,
      loadScore,
      loadLevel: 'ok' as LoadLevel,
      tags,
    };
  });

  const active = base.filter((m) => m.loadScore > 0);
  const avg = active.length ? active.reduce((a, m) => a + m.loadScore, 0) / active.length : 0;
  base.forEach((m) => {
    const overCapacity = m.sprintPoints > 0 && m.sprintPoints > th.capacityPerPerson;
    if (m.openAssigned.length === 0 && m.openPulls.length === 0) m.loadLevel = 'idle';
    else if (overCapacity || m.loadScore >= Math.max(th.overloadScore, avg * 1.6)) m.loadLevel = 'overloaded';
    else if ((m.sprintPoints > 0 && m.sprintPoints > th.capacityPerPerson * 0.85) || m.loadScore >= Math.max(th.overloadScore * 0.625, avg * 1.25)) m.loadLevel = 'high';
    else m.loadLevel = 'ok';
  });
  return base.sort((a, b) => b.loadScore - a.loadScore);
}

export interface TeamMetrics {
  weeklyThroughput: number[]; // 8 semanas, mais antiga primeiro
  leadTimeHours: number | null;
  openBugs: number;
  openIssues: number;
  mergedPulls: number;
  milestoneShare: Array<{ title: string; mine: number; total: number; done: number }>;
}

const isBug = (i: ProjectIssue) =>
  [i.tag, ...(i.rawLabels || [])].some((l) => /bug|defeito|erro|fix/i.test(String(l || '')));

export function computeTeamMetrics(
  memberLogins: string[] | null,
  raw: TeamInsightsRaw,
  issues: ProjectIssue[],
  sprints: SprintOption[],
  sprintMatcher: (issue: ProjectIssue, sprint: SprintOption) => boolean,
): TeamMetrics {
  const set = memberLogins ? new Set(memberLogins.map((l) => l.toLowerCase())) : null;
  const mine = (i: ProjectIssue) => !set || i.assignees.some((a) => set.has(a.name.toLowerCase()));
  const myIssues = issues.filter(mine);
  const weekMs = 7 * 86400000;
  const now = Date.now();
  const weeklyThroughput = Array.from({ length: 8 }, (_, idx) => {
    const end = now - (7 - idx) * weekMs;
    const start = end - weekMs;
    return myIssues.filter((i) => {
      if (!i.closedAtIso) return false;
      const t = new Date(i.closedAtIso).getTime();
      return t > start && t <= end;
    }).length;
  });
  const merged = raw.closedPulls.filter((p) => p.mergedAt && (!set || (p.author && set.has(p.author.toLowerCase()))));
  const leadTimeHours = merged.length
    ? merged.reduce((acc, p) => acc + (new Date(p.mergedAt as string).getTime() - new Date(p.createdAt).getTime()) / 3600000, 0) / merged.length
    : null;
  const milestoneShare = sprints
    .filter((s) => s.state === 'open')
    .map((s) => {
      const all = issues.filter((i) => sprintMatcher(i, s));
      const ownIssues = all.filter(mine);
      return { title: s.title, mine: ownIssues.length, total: all.length, done: ownIssues.filter((i) => i.status === 'Concluído').length };
    })
    .filter((s) => s.total > 0);
  return {
    weeklyThroughput,
    leadTimeHours,
    openBugs: myIssues.filter((i) => i.status !== 'Concluído' && isBug(i)).length,
    openIssues: myIssues.filter((i) => i.status !== 'Concluído').length,
    mergedPulls: merged.length,
    milestoneShare,
  };
}

// CODEOWNERS: "padrão @dono1 @org/time"
export function parseCodeowners(text: string | null): Array<{ pattern: string; owners: string[] }> {
  if (!text) return [];
  return text
    .split('\n')
    .map((l) => l.replace(/#.*$/, '').trim())
    .filter(Boolean)
    .map((l) => {
      const [pattern, ...owners] = l.split(/\s+/);
      return { pattern, owners: owners.map((o) => o.replace(/^@/, '')) };
    })
    .filter((r) => r.owners.length > 0);
}

// ---------------------------------------------------------------------------
// Alertas, auditoria e sugestões
// ---------------------------------------------------------------------------

export interface TeamAlert {
  id: string;
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  url?: string;
  login?: string;
}

export function computeAlerts(
  members: MemberStats[],
  raw: TeamInsightsRaw,
  issues: ProjectIssue[],
  daily: Record<string, DailySnapshot>,
  people: Record<string, PersonLocalData>,
  th: TeamThresholds = DEFAULT_THRESHOLDS,
): TeamAlert[] {
  const alerts: TeamAlert[] = [];
  const teamNameBySlug = new Map(raw.teams.map((t) => [t.slug, t.name]));

  raw.openPulls
    .filter((p) => !p.draft && p.reviews.length === 0 && hoursSince(p.createdAt) > th.prNoReviewHours)
    .forEach((p) => {
      const days = Math.floor(hoursSince(p.createdAt) / 24);
      alerts.push({
        id: `pr-noreview-${p.number}`,
        severity: hoursSince(p.createdAt) >= th.prNoReviewHours * 2.5 ? 'critical' : 'warning',
        title: `PR #${p.number} sem nenhum review há ${days} dias`,
        detail: `${p.title} — por @${p.author}${p.requestedReviewers.length ? ` • aguardando ${p.requestedReviewers.map((r) => '@' + r).join(', ')}` : ' • ninguém foi solicitado'}`,
        url: p.url,
      });
    });

  // Agrupa PRs parados por time solicitado
  const byTeam = new Map<string, number>();
  raw.openPulls
    .filter((p) => !p.draft && hoursSince(p.updatedAt) > th.reviewWaitHours)
    .forEach((p) => p.requestedTeams.forEach((t) => byTeam.set(t, (byTeam.get(t) || 0) + 1)));
  byTeam.forEach((count, slug) => {
    if (count >= 2)
      alerts.push({
        id: `team-stale-${slug}`,
        severity: 'warning',
        title: `${count} PRs do time ${teamNameBySlug.get(slug) || slug} parados há mais de ${formatHours(th.reviewWaitHours)}`,
        detail: 'Revisões solicitadas ao time sem movimentação recente.',
      });
  });

  members.forEach((m) => {
    if (m.loadLevel === 'overloaded') {
      alerts.push({
        id: `overload-${m.login}`,
        severity: 'warning',
        title: `@${m.login} está sobrecarregado`,
        detail: `${m.openAssigned.length} issues abertas, ${m.inProgress} em progresso, ${m.openPulls.length} PRs e ${m.reviewQueue.length} reviews pendentes.`,
        login: m.login,
      });
    }
    const oldestReview = m.reviewQueue[0];
    if (oldestReview && oldestReview.waitingHours > th.reviewWaitHours) {
      alerts.push({
        id: `review-wait-${m.login}`,
        severity: oldestReview.waitingHours > th.reviewWaitHours * 2.5 ? 'critical' : 'warning',
        title: `@${m.login} segura ${m.reviewQueue.length} review(s)`,
        detail: `O mais antigo (PR #${oldestReview.pull.number}) espera há ${Math.floor(oldestReview.waitingHours / 24)} dias.`,
        url: oldestReview.pull.url,
        login: m.login,
      });
    }
    const snap = daily[m.login.toLowerCase()];
    snap?.blockers.forEach((b, idx) =>
      alerts.push({
        id: `blocker-${m.login}-${idx}`,
        severity: b.severity === 'Crítico' ? 'critical' : 'warning',
        title: `Bloqueio de @${m.login} na daily`,
        detail: b.title,
        login: m.login,
      }),
    );
    const away = people[m.login.toLowerCase()]?.availability;
    if (away && isAwayNow(away) && m.openAssigned.some((i) => i.priority === 'Urgente' || i.priority === 'Alta')) {
      alerts.push({
        id: `away-${m.login}`,
        severity: 'warning',
        title: `@${m.login} está fora com issues de alta prioridade`,
        detail: `${m.openAssigned.filter((i) => i.priority === 'Urgente' || i.priority === 'Alta').length} issue(s) Alta/Urgente atribuídas.`,
        login: m.login,
      });
    }
    if (m.openAssigned.length > 0 && hoursSince(m.lastActivityAt) > th.staleMemberDays * 24) {
      alerts.push({
        id: `stale-${m.login}`,
        severity: 'info',
        title: `@${m.login} sem atividade há mais de ${th.staleMemberDays} dias`,
        detail: `Mas tem ${m.openAssigned.length} issue(s) atribuída(s).`,
        login: m.login,
      });
    }
  });

  const urgentUnassigned = issues.filter((i) => i.status !== 'Concluído' && i.assignees.length === 0 && (i.priority === 'Urgente' || i.priority === 'Alta'));
  if (urgentUnassigned.length > 0) {
    alerts.push({
      id: 'urgent-unassigned',
      severity: urgentUnassigned.some((i) => i.priority === 'Urgente') ? 'critical' : 'warning',
      title: `${urgentUnassigned.length} issue(s) de alta prioridade sem responsável`,
      detail: urgentUnassigned.slice(0, 3).map((i) => `${i.id} ${i.title}`).join(' • '),
    });
  }

  const order = { critical: 0, warning: 1, info: 2 };
  return alerts.sort((a, b) => order[a.severity] - order[b.severity]);
}

export function isAwayNow(av: NonNullable<PersonLocalData['availability']>): boolean {
  if (av.status === 'disponivel' || av.status === 'meio-periodo') return false;
  const today = toLocalIso(new Date());
  if (av.from && today < av.from) return false;
  if (av.to && today > av.to) return false;
  return true;
}

export interface AuditFinding {
  id: string;
  kind: 'inactive' | 'admin-excess' | 'invite' | 'outside' | 'no-contrib';
  severity: 'critical' | 'warning' | 'info';
  title: string;
  detail: string;
  logins: string[];
  invitationId?: number;
}

export function computeAudit(members: MemberStats[], raw: TeamInsightsRaw, th: TeamThresholds = DEFAULT_THRESHOLDS): AuditFinding[] {
  const out: AuditFinding[] = [];
  const inactive = members.filter((m) => hoursSince(m.lastActivityAt) > th.inactiveAccessDays * 24);
  if (inactive.length)
    out.push({
      id: 'inactive',
      kind: 'inactive',
      severity: 'warning',
      title: `${inactive.length} membro(s) sem atividade há ${th.inactiveAccessDays}+ dias`,
      detail: 'Sem commits, PRs, reviews ou issues recentes neste repositório. Considere reduzir o acesso.',
      logins: inactive.map((m) => m.login),
    });
  const admins = members.filter((m) => m.role === 'admin');
  const limit = Math.max(2, Math.ceil(members.length * (th.maxAdminsPercent / 100)));
  if (admins.length > limit)
    out.push({
      id: 'admin-excess',
      kind: 'admin-excess',
      severity: 'critical',
      title: `${admins.length} administradores (recomendado até ${limit})`,
      detail: 'Admins podem apagar o repositório e mudar configurações sensíveis. Rebaixe quem só precisa de push.',
      logins: admins.map((m) => m.login),
    });
  raw.invitations.forEach((inv) =>
    out.push({
      id: `invite-${inv.id}`,
      kind: 'invite',
      severity: inv.expired ? 'warning' : 'info',
      title: `Convite ${inv.expired ? 'expirado' : 'pendente'} para @${inv.login}`,
      detail: `Permissão ${inv.permission}${inv.inviter ? ` • enviado por @${inv.inviter}` : ''} • ${new Date(inv.createdAt).toLocaleDateString('pt-BR')}`,
      logins: [inv.login],
      invitationId: inv.id,
    }),
  );
  const outside = members.filter((m) => m.affiliation === 'outside');
  if (outside.length)
    out.push({
      id: 'outside',
      kind: 'outside',
      severity: outside.some((m) => m.role === 'admin' || m.role === 'maintain') ? 'critical' : 'info',
      title: `${outside.length} colaborador(es) externo(s) à organização`,
      detail: 'Pessoas fora da org com acesso direto. Confirme se o acesso ainda é necessário.',
      logins: outside.map((m) => m.login),
    });
  const noContrib = members.filter(
    (m) => (m.role === 'write' || m.role === 'maintain' || m.role === 'admin') && m.commits90d === 0 && m.openPulls.length === 0 && m.openAssigned.length === 0 && !m.lastActivityAt,
  );
  if (noContrib.length)
    out.push({
      id: 'no-contrib',
      kind: 'no-contrib',
      severity: 'info',
      title: `${noContrib.length} pessoa(s) com escrita e nenhuma contribuição`,
      detail: 'Permissão de escrita ou superior sem nenhum commit, PR ou issue registrado.',
      logins: noContrib.map((m) => m.login),
    });
  return out;
}

export interface AssignmentSuggestion {
  issue: ProjectIssue;
  candidates: Array<{ login: string; score: number; reasons: string[] }>;
}

export function computeAssignmentSuggestions(
  members: MemberStats[],
  issues: ProjectIssue[],
  people: Record<string, PersonLocalData>,
): AssignmentSuggestion[] {
  const unassigned = issues.filter((i) => i.status !== 'Concluído' && i.assignees.length === 0);
  const prioWeight = { Urgente: 0, Alta: 1, Média: 2, Baixa: 3 } as const;
  return unassigned
    .sort((a, b) => prioWeight[a.priority] - prioWeight[b.priority])
    .slice(0, 20)
    .map((issue) => {
      const labels = [issue.tag, ...(issue.rawLabels || [])].map((l) => String(l || '').toLowerCase()).filter(Boolean);
      const text = `${issue.title} ${labels.join(' ')}`.toLowerCase();
      const candidates = members
        .filter((m) => m.role !== 'read')
        .map((m) => {
          const reasons: string[] = [];
          let score = 0;
          const affinity = labels.reduce((acc, l) => acc + (m.tags[l] || 0), 0);
          if (affinity > 0) {
            score += Math.min(affinity, 6) * 2;
            reasons.push(`${affinity} issue(s) parecidas`);
          }
          const skills = people[m.login.toLowerCase()]?.skills || [];
          const skillHits = skills.filter((s) => text.includes(s.toLowerCase()));
          if (skillHits.length) {
            score += skillHits.length * 4;
            reasons.push(`skill: ${skillHits.join(', ')}`);
          }
          const av = people[m.login.toLowerCase()]?.availability;
          if (av && isAwayNow(av)) {
            score -= 20;
            reasons.push('fora no momento');
          }
          if (m.loadLevel === 'idle') {
            score += 3;
            reasons.push('sem carga');
          } else if (m.loadLevel === 'overloaded') {
            score -= 6;
            reasons.push('sobrecarregado');
          } else if (m.loadLevel === 'high') score -= 2;
          score -= m.loadScore * 0.4;
          return { login: m.login, score, reasons };
        })
        .sort((a, b) => b.score - a.score)
        .slice(0, 3);
      return { issue, candidates };
    });
}

export const ROLE_ORDER: RepoRole[] = ['read', 'triage', 'write', 'maintain', 'admin'];

export function relativeTime(iso?: string | null): string {
  if (!iso) return 'nunca';
  const h = hoursSince(iso);
  if (h < 1) return 'agora';
  if (h < 24) return `há ${Math.floor(h)}h`;
  const d = Math.floor(h / 24);
  if (d < 30) return `há ${d}d`;
  const mo = Math.floor(d / 30);
  return mo < 12 ? `há ${mo} mês${mo > 1 ? 'es' : ''}` : `há ${Math.floor(mo / 12)}a`;
}

export function formatHours(h: number | null): string {
  if (h == null) return '—';
  if (h < 24) return `${Math.round(h)}h`;
  return `${(h / 24).toFixed(1)}d`;
}
