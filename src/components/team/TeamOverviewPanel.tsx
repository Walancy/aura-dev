import React, { useMemo } from 'react';
import { Activity, AlertTriangle, CalendarOff, Clock, Eye, GitPullRequest, Gauge, ListChecks, Sun, Users, Zap } from 'lucide-react';
import type { ProjectIssue, SprintOption } from '../ProjectsSchedulerView';
import {
  formatHours,
  isAwayNow,
  relativeTime,
  type DailySnapshot,
  type MemberStats,
  type PersonLocalData,
  type TeamAlert,
  type TeamInsightsRaw,
  type TeamMetrics,
} from './teamTypes';
import { Avatar, Bar, EmptyState, LOAD_META, Panel, Pill, SEVERITY_COLOR, SmallButton, Sparkline, StatTile, openUrl, rowHover, type TeamUiCtx } from './teamUi';

interface Props {
  ctx: TeamUiCtx;
  raw: TeamInsightsRaw;
  members: MemberStats[];
  metrics: TeamMetrics;
  issues: ProjectIssue[];
  activeSprint?: SprintOption;
  alerts: TeamAlert[];
  daily: Record<string, DailySnapshot>;
  people: Record<string, PersonLocalData>;
  onOpenMember: (login: string) => void;
  onGoTo: (section: 'membros' | 'ia' | 'auditoria') => void;
  onRequestReview: (pullNumber: number) => void;
}

const AVAILABILITY_LABEL: Record<string, string> = {
  ferias: 'Férias',
  folga: 'Folga',
  ausente: 'Ausente',
  'meio-periodo': 'Meio período',
};

export const TeamOverviewPanel: React.FC<Props> = ({ ctx, raw, members, metrics, issues, activeSprint, alerts, daily, people, onOpenMember, onGoTo, onRequestReview }) => {
  const { theme, accentColor } = ctx;
  const activeMembers = members.filter((m) => m.lastActivityAt && Date.now() - new Date(m.lastActivityAt).getTime() < 14 * 86400000).length;
  const unassigned = issues.filter((i) => i.status !== 'Concluído' && i.assignees.length === 0).length;
  const awaitingReview = raw.openPulls.filter((p) => !p.draft && !p.reviews.some((r) => r.state === 'APPROVED'));
  const blockersCount = Object.values(daily).reduce((a, d) => a + d.blockers.length, 0);
  const throughputTotal = metrics.weeklyThroughput.reduce((a, b) => a + b, 0);

  const loadMax = Math.max(1, ...members.map((m) => m.openAssigned.length + m.openPulls.length));
  const workloadMembers = members.filter((m) => m.openAssigned.length + m.openPulls.length + m.reviewQueue.length > 0 || m.lastActivityAt);

  const reviewQueue = useMemo(
    () =>
      awaitingReview
        .map((p) => ({ p, hours: (Date.now() - new Date(p.createdAt).getTime()) / 3600000 }))
        .sort((a, b) => b.hours - a.hours)
        .slice(0, 8),
    [awaitingReview],
  );

  const awayToday = members.filter((m) => {
    const av = people[m.login.toLowerCase()]?.availability;
    return av && (isAwayNow(av) || av.status === 'meio-periodo');
  });

  const dailyMembers = members.filter((m) => daily[m.login.toLowerCase()]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 5 }}>
        <StatTile ctx={ctx} icon={<Users size={12} />} label="Ativos (14 dias)" value={`${activeMembers}/${members.length}`} hint={`${raw.teams.length} time(s) com acesso`} onClick={() => onGoTo('membros')} />
        <StatTile
          ctx={ctx}
          icon={<ListChecks size={12} />}
          label="Sem responsável"
          value={unassigned}
          tone={unassigned > 0 ? '#f59e0b' : undefined}
          hint={`${issues.filter((i) => i.status !== 'Concluído').length} issues abertas`}
          onClick={() => onGoTo('ia')}
        />
        <StatTile ctx={ctx} icon={<GitPullRequest size={12} />} label="PRs aguardando review" value={awaitingReview.length} hint={`${raw.openPulls.length} PRs abertos`} />
        <StatTile ctx={ctx} icon={<Clock size={12} />} label="Lead time médio (PR)" value={formatHours(metrics.leadTimeHours)} hint={`${metrics.mergedPulls} PRs mergeados recentes`} />
        <StatTile
          ctx={ctx}
          icon={<Activity size={12} />}
          label="Entregas (8 semanas)"
          value={
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 10 }}>
              <span>{throughputTotal}</span>
              <Sparkline values={metrics.weeklyThroughput} color={accentColor} muted={theme.textMuted} width={80} height={24} />
            </div>
          }
          hint="issues fechadas por semana"
        />
        <StatTile ctx={ctx} icon={<AlertTriangle size={12} />} label="Alertas / bloqueios" value={`${alerts.length} / ${blockersCount}`} tone={alerts.some((a) => a.severity === 'critical') ? '#ef4444' : undefined} onClick={() => onGoTo('ia')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 5 }}>
        {/* Carga de trabalho */}
        <Panel
          ctx={ctx}
          icon={<Gauge size={14} color={accentColor} />}
          title="Carga de trabalho"
          right={activeSprint ? <Pill color={accentColor}>{activeSprint.title}</Pill> : <span style={{ fontSize: 11, color: theme.textMuted }}>sem sprint ativa</span>}
        >
          {workloadMembers.length === 0 ? (
            <EmptyState ctx={ctx} text="Ninguém com issues ou PRs abertos." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {workloadMembers.map((m) => {
                const meta = LOAD_META[m.loadLevel];
                return (
                  <div
                    key={m.login}
                    onClick={() => onOpenMember(m.login)}
                    {...rowHover(ctx)}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', borderRadius: 6, cursor: 'pointer' }}
                  >
                    <Avatar ctx={ctx} login={m.login} url={m.avatarUrl} size={22} />
                    <span style={{ width: 110, fontSize: 12, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.login}</span>
                    <Bar ctx={ctx} value={m.openAssigned.length + m.openPulls.length} max={loadMax} color={meta.color} />
                    <span style={{ fontSize: 11, color: theme.textSecondary, width: 92, textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {m.openAssigned.length} iss • {m.openPulls.length} PR
                    </span>
                    {activeSprint && (
                      <span title="Issues na sprint ativa" style={{ fontSize: 11, color: theme.textMuted, width: 44, textAlign: 'right' }}>
                        <Zap size={10} style={{ verticalAlign: -1 }} /> {m.sprintIssues}
                        {m.sprintPoints > 0 ? `/${m.sprintPoints}p` : ''}
                      </span>
                    )}
                    <Pill color={meta.color}>{meta.label}</Pill>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Fila de review */}
        <Panel ctx={ctx} icon={<Eye size={14} color={accentColor} />} title="Fila de review" right={<span style={{ fontSize: 11, color: theme.textMuted }}>mais antigos primeiro</span>}>
          {reviewQueue.length === 0 ? (
            <EmptyState ctx={ctx} text="Nenhum PR aguardando review." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {reviewQueue.map(({ p, hours }) => {
                const stale = hours > 48;
                const changes = p.reviews.some((r) => r.state === 'CHANGES_REQUESTED');
                return (
                  <div key={p.number} {...rowHover(ctx)} onClick={() => openUrl(p.url)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 4px', borderRadius: 6, cursor: 'pointer' }}>
                    <Avatar ctx={ctx} login={p.author || '?'} url={p.authorAvatarUrl} size={20} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ color: theme.textMuted }}>#{p.number}</span> {p.title}
                      </div>
                      <div style={{ fontSize: 10.5, color: theme.textSecondary, display: 'flex', gap: 6, alignItems: 'center' }}>
                        {p.requestedReviewers.length > 0 ? (
                          <>
                            aguardando
                            {p.requestedReviewers.slice(0, 4).map((r) => (
                              <span key={r} onClick={(e) => { e.stopPropagation(); onOpenMember(r); }} style={{ color: theme.textPrimary }}>
                                @{r}
                              </span>
                            ))}
                          </>
                        ) : p.requestedTeams.length > 0 ? (
                          <>aguardando time {p.requestedTeams.join(', ')}</>
                        ) : (
                          <span style={{ color: '#f59e0b' }}>nenhum revisor solicitado</span>
                        )}
                      </div>
                    </div>
                    {changes && <Pill color="#f59e0b">mudanças</Pill>}
                    <Pill color={stale ? '#ef4444' : theme.textSecondary}>{formatHours(hours)}</Pill>
                    <SmallButton ctx={ctx} onClick={() => onRequestReview(p.number)} title="Pedir review a alguém">
                      Pedir review
                    </SmallButton>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Status do dia */}
        <Panel ctx={ctx} icon={<Sun size={14} color={accentColor} />} title="Status do dia (Daily)">
          {dailyMembers.length === 0 ? (
            <EmptyState ctx={ctx} text="Nenhum registro de daily de ontem ou hoje para este projeto. Preencha pela tela de Daily." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dailyMembers.map((m) => {
                const d = daily[m.login.toLowerCase()];
                return (
                  <div key={m.login} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', cursor: 'pointer' }} onClick={() => onOpenMember(m.login)}>
                    <Avatar ctx={ctx} login={m.login} url={m.avatarUrl} size={22} ring={d.blockers.length ? '#ef4444' : undefined} />
                    <div style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: theme.textSecondary, display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ color: theme.textPrimary, fontWeight: 500, fontSize: 12 }}>{m.login}</span>
                      {d.yesterday.length > 0 && <span><b style={{ color: theme.textMuted, fontWeight: 500 }}>Ontem:</b> {d.yesterday.slice(0, 2).join(' • ')}</span>}
                      {d.today.length > 0 && <span><b style={{ color: theme.textMuted, fontWeight: 500 }}>Hoje:</b> {d.today.slice(0, 2).join(' • ')}</span>}
                      {d.blockers.map((b, i) => (
                        <span key={i} style={{ color: '#ef4444' }}>⛔ {b.title}</span>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        {/* Alertas + disponibilidade */}
        <Panel
          ctx={ctx}
          icon={<AlertTriangle size={14} color={accentColor} />}
          title="Atenção"
          right={
            alerts.length > 5 ? (
              <SmallButton ctx={ctx} onClick={() => onGoTo('ia')}>
                Ver todos ({alerts.length})
              </SmallButton>
            ) : undefined
          }
        >
          {awayToday.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center', paddingBottom: 4 }}>
              <CalendarOff size={12} color={theme.textSecondary} />
              {awayToday.map((m) => {
                const av = people[m.login.toLowerCase()]!.availability!;
                return (
                  <span key={m.login} onClick={() => onOpenMember(m.login)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: theme.textPrimary, cursor: 'pointer' }}>
                    <Avatar ctx={ctx} login={m.login} url={m.avatarUrl} size={16} />
                    {m.login} <span style={{ color: theme.textMuted }}>({AVAILABILITY_LABEL[av.status]}{av.to ? ` até ${new Date(`${av.to}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' })}` : ''})</span>
                  </span>
                );
              })}
            </div>
          )}
          {alerts.length === 0 ? (
            <EmptyState ctx={ctx} text="Tudo certo por aqui — nenhum alerta." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {alerts.slice(0, 5).map((a) => (
                <div
                  key={a.id}
                  {...rowHover(ctx)}
                  onClick={() => (a.url ? openUrl(a.url) : a.login ? onOpenMember(a.login) : onGoTo('ia'))}
                  style={{ display: 'flex', gap: 8, padding: '5px 4px', borderRadius: 6, cursor: 'pointer', alignItems: 'flex-start' }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: SEVERITY_COLOR[a.severity], marginTop: 5, flexShrink: 0 }} />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: theme.textPrimary }}>{a.title}</div>
                    <div style={{ fontSize: 11, color: theme.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.detail}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div style={{ fontSize: 10.5, color: theme.textMuted }}>Último commit do time: {relativeTime(raw.commits[0]?.date)}</div>
        </Panel>
      </div>
    </div>
  );
};
