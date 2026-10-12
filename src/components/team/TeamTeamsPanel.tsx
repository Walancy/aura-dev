import React, { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, ExternalLink, FolderTree, Layers, Trash2 } from 'lucide-react';
import type { ProjectIssue, SprintOption } from '../ProjectsSchedulerView';
import { computeTeamMetrics, formatHours, parseCodeowners, ROLE_ORDER, type MemberStats, type RepoRole, type TeamInsightsRaw, type TeamMetrics, type TeamRaw } from './teamTypes';
import { Avatar, Bar, EmptyState, LOAD_META, Panel, Pill, ROLE_COLOR, SmallButton, Sparkline, openUrl, selectStyle, type TeamUiCtx } from './teamUi';

interface Props {
  ctx: TeamUiCtx;
  raw: TeamInsightsRaw;
  owner: string;
  repoFullName: string;
  members: MemberStats[];
  issues: ProjectIssue[];
  sprints: SprintOption[];
  sprintMatcher: (issue: ProjectIssue, sprint: SprintOption) => boolean;
  canManage: boolean;
  onOpenMember: (login: string) => void;
  onChangeTeamRole: (slug: string, role: RepoRole) => void;
  onRemoveTeam: (team: TeamRaw) => void;
}

const MetricsRow: React.FC<{ ctx: TeamUiCtx; metrics: TeamMetrics }> = ({ ctx, metrics }) => {
  const { theme, accentColor } = ctx;
  const cell = (label: string, value: React.ReactNode, tone?: string) => (
    <div style={{ background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg, borderRadius: 6, padding: '6px 8px', minWidth: 0, border: 'none', boxShadow: 'none' }}>
      <div style={{ fontSize: 10, color: theme.textSecondary }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 400, color: tone || theme.textPrimary }}>{value}</div>
    </div>
  );
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr 1fr 1fr', gap: 4 }}>
      <div style={{ background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg, borderRadius: 6, padding: '6px 8px', minWidth: 0, border: 'none', boxShadow: 'none' }}>
        <div style={{ fontSize: 10, color: theme.textSecondary }}>Throughput (8 sem.)</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 400, color: theme.textPrimary }}>{metrics.weeklyThroughput.reduce((a, b) => a + b, 0)}</span>
          <Sparkline values={metrics.weeklyThroughput} color={accentColor} muted={theme.textSecondary} width={70} height={20} />
        </div>
      </div>
      {cell('Lead time PR', formatHours(metrics.leadTimeHours))}
      {cell('Issues abertas', metrics.openIssues)}
      {cell('Bugs abertos', metrics.openBugs, metrics.openBugs > 0 ? '#ef4444' : undefined)}
    </div>
  );
};

export const TeamTeamsPanel: React.FC<Props> = ({ ctx, raw, owner, repoFullName, members, issues, sprints, sprintMatcher, canManage, onOpenMember, onChangeTeamRole, onRemoveTeam }) => {
  const { theme, accentColor } = ctx;
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(raw.teams.length === 1 ? [raw.teams[0].slug] : []));
  const codeowners = useMemo(() => parseCodeowners(raw.codeowners), [raw.codeowners]);
  const repoMetrics = useMemo(() => computeTeamMetrics(null, raw, issues, sprints, sprintMatcher), [raw, issues, sprints, sprintMatcher]);
  const memberByLogin = useMemo(() => new Map(members.map((m) => [m.login.toLowerCase(), m])), [members]);

  const toggle = (slug: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(slug) ? next.delete(slug) : next.add(slug);
      return next;
    });

  const teamAreas = (slug: string) => codeowners.filter((r) => r.owners.some((o) => o.toLowerCase() === `${owner}/${slug}`.toLowerCase()));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      {/* Referência: repo inteiro */}
      <Panel ctx={ctx} icon={<Layers size={14} color={accentColor} />} title="Repositório inteiro" right={<span style={{ fontSize: 11, color: theme.textMuted }}>{repoFullName} • referência para comparar os times</span>}>
        <MetricsRow ctx={ctx} metrics={repoMetrics} />
      </Panel>

      {raw.teams.length === 0 ? (
        <Panel ctx={ctx}>
          <EmptyState
            ctx={ctx}
            icon={<Layers size={24} color={theme.textMuted} />}
            text={
              raw.isOrg
                ? 'Nenhum time da organização tem acesso a este repositório. Use "Gerenciar acesso → Adicionar times" para conceder.'
                : 'Este repositório é pessoal — times só existem em organizações do GitHub.'
            }
          />
        </Panel>
      ) : (
        raw.teams.map((team) => {
          const logins = team.members.map((mm) => mm.login);
          const metrics = computeTeamMetrics(logins, raw, issues, sprints, sprintMatcher);
          const isOpen = expanded.has(team.slug);
          const areas = teamAreas(team.slug);
          const role = (team.permission as RepoRole) || 'read';
          return (
            <Panel
              key={team.slug}
              ctx={ctx}
              title={
                <span onClick={() => toggle(team.slug)} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                  {isOpen ? <ChevronDown size={14} color={theme.textSecondary} /> : <ChevronRight size={14} color={theme.textSecondary} />}
                  <span style={{ width: 24, height: 24, borderRadius: 6, background: 'rgba(236, 72, 153, 0.15)', color: '#ec4899', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Layers size={13} />
                  </span>
                  <span>{team.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 400, color: theme.textMuted }}>
                    @{owner}/{team.slug} • {team.members.length} membro(s)
                  </span>
                </span>
              }
              right={
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {canManage ? (
                    <select value={role} onChange={(e) => onChangeTeamRole(team.slug, e.target.value as RepoRole)} style={{ ...selectStyle(ctx), color: ROLE_COLOR[role] }}>
                      {[...ROLE_ORDER].reverse().map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <Pill color={ROLE_COLOR[role] || theme.textSecondary}>{role}</Pill>
                  )}
                  {team.htmlUrl && (
                    <SmallButton ctx={ctx} onClick={() => openUrl(team.htmlUrl)} title="Abrir no GitHub">
                      <ExternalLink size={12} />
                    </SmallButton>
                  )}
                  {canManage && (
                    <SmallButton ctx={ctx} danger onClick={() => onRemoveTeam(team)} title="Remover time do repositório">
                      <Trash2 size={12} />
                    </SmallButton>
                  )}
                </div>
              }
            >
              {team.description && <div style={{ fontSize: 11.5, color: theme.textSecondary }}>{team.description}</div>}
              <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                {team.members.slice(0, 16).map((mm) => (
                  <span key={mm.login} onClick={() => onOpenMember(mm.login)} style={{ cursor: 'pointer' }}>
                    <Avatar ctx={ctx} login={mm.login} url={mm.avatarUrl} size={22} ring={memberByLogin.get(mm.login.toLowerCase()) ? LOAD_META[memberByLogin.get(mm.login.toLowerCase())!.loadLevel].color : undefined} />
                  </span>
                ))}
                {team.members.length > 16 && <span style={{ fontSize: 11, color: theme.textMuted, marginLeft: 4 }}>+{team.members.length - 16}</span>}
                {areas.length > 0 && (
                  <span style={{ marginLeft: 'auto', display: 'flex', gap: 4, alignItems: 'center' }}>
                    <FolderTree size={12} color={theme.textSecondary} />
                    {areas.slice(0, 3).map((a) => (
                      <Pill key={a.pattern} color={theme.textSecondary}>
                        {a.pattern}
                      </Pill>
                    ))}
                    {areas.length > 3 && <span style={{ fontSize: 11, color: theme.textMuted }}>+{areas.length - 3}</span>}
                  </span>
                )}
              </div>
              <MetricsRow ctx={ctx} metrics={metrics} />

              {isOpen && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 6, marginTop: 2 }}>
                  {/* Membros */}
                  <div style={{ background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 4, border: 'none', boxShadow: 'none' }}>
                    <div style={{ fontSize: 11, fontWeight: 400, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Membros</div>
                    {team.members.map((mm) => {
                      const st = memberByLogin.get(mm.login.toLowerCase());
                      return (
                        <div key={mm.login} onClick={() => onOpenMember(mm.login)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
                          <Avatar ctx={ctx} login={mm.login} url={mm.avatarUrl} size={18} />
                          <span style={{ flex: 1, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis' }}>{mm.login}</span>
                          {st ? (
                            <>
                              <span style={{ fontSize: 10.5, color: theme.textMuted }}>{st.openAssigned.length} iss</span>
                              <Pill color={LOAD_META[st.loadLevel].color}>{LOAD_META[st.loadLevel].label}</Pill>
                            </>
                          ) : (
                            <span style={{ fontSize: 10.5, color: theme.textMuted }}>sem dados</span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Repositórios */}
                  <div style={{ background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 4, border: 'none', boxShadow: 'none' }}>
                    <div style={{ fontSize: 11, fontWeight: 400, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Repositórios ({team.repos.length})</div>
                    {team.repos.slice(0, 14).map((r) => (
                      <div key={r.fullName} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
                        <span style={{ flex: 1, color: r.fullName === repoFullName ? accentColor : theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.fullName.split('/')[1]}</span>
                        <Pill color={ROLE_COLOR[r.permission as RepoRole] || theme.textSecondary}>{r.permission}</Pill>
                      </div>
                    ))}
                    {team.repos.length > 14 && <span style={{ fontSize: 11, color: theme.textMuted }}>+{team.repos.length - 14} repositórios</span>}
                  </div>

                  {/* Time × milestone */}
                  <div style={{ background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, border: 'none', boxShadow: 'none' }}>
                    <div style={{ fontSize: 11, fontWeight: 400, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Participação nas sprints/marcos</div>
                    {metrics.milestoneShare.length === 0 ? (
                      <span style={{ fontSize: 11.5, color: theme.textMuted }}>Nenhum marco aberto com issues.</span>
                    ) : (
                      metrics.milestoneShare.map((ms) => (
                        <div key={ms.title} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5 }}>
                            <span style={{ color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ms.title}</span>
                            <span style={{ color: theme.textSecondary }}>
                              {ms.mine}/{ms.total} ({Math.round((ms.mine / ms.total) * 100)}%)
                            </span>
                          </div>
                          <Bar ctx={ctx} value={ms.mine} max={ms.total} color={accentColor} height={5} />
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </Panel>
          );
        })
      )}

      {/* Áreas do código */}
      <Panel ctx={ctx} icon={<FolderTree size={14} color={accentColor} />} title="Áreas do código (CODEOWNERS)">
        {codeowners.length === 0 ? (
          <EmptyState
            ctx={ctx}
            text={
              <>
                Nenhum arquivo CODEOWNERS encontrado. Crie <code>.github/CODEOWNERS</code> com linhas como <code>/lib/features/pagamento/ @{owner}/mobile</code> para definir quem é responsável por cada
                área e receber pedidos de review automáticos.
              </>
            }
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {codeowners.map((r, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: idx === codeowners.length - 1 ? 'none' : `1px solid ${theme.tableBorder}` }}>
                <code style={{ fontSize: 11.5, color: theme.textPrimary, flex: '0 1 45%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.pattern}</code>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', flex: 1 }}>
                  {r.owners.map((o) =>
                    o.includes('/') ? (
                      <Pill key={o} color="#ec4899">
                        <Layers size={9} /> {o.split('/')[1]}
                      </Pill>
                    ) : (
                      <span key={o} onClick={() => onOpenMember(o)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11.5, color: theme.textPrimary, cursor: 'pointer' }}>
                        <Avatar ctx={ctx} login={o} size={16} /> {o}
                      </span>
                    ),
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
};
