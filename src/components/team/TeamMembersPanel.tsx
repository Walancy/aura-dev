import React, { useMemo, useState } from 'react';
import { AtSign, Clock, Eye, GraduationCap, Search, UserPlus, Users } from 'lucide-react';
import {
  isAwayNow,
  relativeTime,
  type DailySnapshot,
  type MemberStats,
  type PersonLocalData,
  type RepoTeamLocalData,
  type TeamInsightsRaw,
} from './teamTypes';
import { Avatar, Bar, EmptyState, LOAD_META, Panel, Pill, ROLE_COLOR, SmallButton, inputStyle, selectStyle, type TeamUiCtx } from './teamUi';

export const ONBOARDING_MANUAL_STEPS = [
  { id: 'readme', label: 'Leu README / CONTRIBUTING' },
  { id: 'env', label: 'Ambiente local configurado' },
  { id: 'intro', label: 'Apresentado ao time' },
  { id: 'tools', label: 'Acesso às ferramentas (CI, Figma, etc.)' },
];

export function computeOnboarding(m: MemberStats, raw: TeamInsightsRaw, local: RepoTeamLocalData['onboarding'][string] | undefined) {
  const key = m.login.toLowerCase();
  const authored = [...raw.openPulls, ...raw.closedPulls].filter((p) => p.author?.toLowerCase() === key);
  const reviewed = [...raw.openPulls, ...raw.closedPulls].some((p) => p.reviews.some((r) => r.login?.toLowerCase() === key));
  const auto = [
    { id: 'access', label: 'Acesso ao repositório concedido', done: true },
    { id: 'invite', label: 'Convite aceito', done: !raw.invitations.some((i) => i.login.toLowerCase() === key) },
    { id: 'commit', label: 'Primeiro commit', done: m.commits90d > 0 },
    { id: 'pr', label: 'Primeiro PR aberto', done: authored.length > 0 },
    { id: 'merged', label: 'Primeiro PR mergeado', done: authored.some((p) => p.mergedAt) },
    { id: 'issue', label: 'Primeira issue atribuída', done: m.openAssigned.length > 0 || m.closedLast14d > 0 || Object.keys(m.tags).length > 0 },
    { id: 'review', label: 'Primeiro review feito', done: reviewed },
  ];
  const manual = ONBOARDING_MANUAL_STEPS.map((s) => ({ ...s, done: Boolean(local?.manualDone.includes(s.id)) }));
  const steps = [...auto.map((s) => ({ ...s, manual: false })), ...manual.map((s) => ({ ...s, manual: true }))];
  const done = steps.filter((s) => s.done).length;
  return { steps, done, total: steps.length, percent: Math.round((done / steps.length) * 100) };
}

export function isNewcomer(m: MemberStats, local: RepoTeamLocalData['onboarding'][string] | undefined) {
  if (local) return true;
  if (!m.firstActivityAt) return m.affiliation !== 'organization';
  return Date.now() - new Date(m.firstActivityAt).getTime() < 30 * 86400000;
}

export function localTimeFor(tz?: string) {
  if (!tz) return null;
  try {
    return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: tz });
  } catch {
    return null;
  }
}

const AV_LABEL: Record<string, { label: string; color: string }> = {
  ferias: { label: 'Férias', color: '#a855f7' },
  folga: { label: 'Folga', color: '#3b82f6' },
  ausente: { label: 'Ausente', color: '#ef4444' },
  'meio-periodo': { label: 'Meio período', color: '#f59e0b' },
};

interface Props {
  ctx: TeamUiCtx;
  raw: TeamInsightsRaw;
  members: MemberStats[];
  people: Record<string, PersonLocalData>;
  daily: Record<string, DailySnapshot>;
  repoData: RepoTeamLocalData;
  onOpenMember: (login: string, action?: 'assign' | 'review' | 'mention') => void;
  onStartOnboarding: (login: string) => void;
}

export const TeamMembersPanel: React.FC<Props> = ({ ctx, raw, members, people, daily, repoData, onOpenMember, onStartOnboarding }) => {
  const { theme, accentColor } = ctx;
  const [query, setQuery] = useState('');
  const [teamFilter, setTeamFilter] = useState('all');
  const [loadFilter, setLoadFilter] = useState('all');
  const [sort, setSort] = useState<'load' | 'activity' | 'name'>('load');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = members.filter((m) => {
      if (q) {
        const skills = people[m.login.toLowerCase()]?.skills || [];
        if (!m.login.toLowerCase().includes(q) && !skills.some((s) => s.toLowerCase().includes(q)) && !m.teams.some((t) => t.toLowerCase().includes(q))) return false;
      }
      if (teamFilter !== 'all' && !m.teams.includes(teamFilter)) return false;
      if (loadFilter !== 'all' && m.loadLevel !== loadFilter) return false;
      return true;
    });
    if (sort === 'name') return [...list].sort((a, b) => a.login.localeCompare(b.login));
    if (sort === 'activity') return [...list].sort((a, b) => new Date(b.lastActivityAt || 0).getTime() - new Date(a.lastActivityAt || 0).getTime());
    return list;
  }, [members, query, teamFilter, loadFilter, sort, people]);

  const newcomers = members.filter((m) => isNewcomer(m, repoData.onboarding[m.login.toLowerCase()]));
  const loadMax = Math.max(1, ...members.map((m) => m.loadScore));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      {/* Toolbar */}
      <div style={{ background: theme.viewCanvasBg, borderRadius: 8, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: theme.controlBg, borderRadius: 6, padding: '0 8px', height: 28, flex: '1 1 200px', maxWidth: 280 }}>
          <Search size={13} color={theme.textSecondary} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nome, skill ou time..." style={{ ...inputStyle(ctx), background: 'transparent', padding: 0 }} />
        </div>
        {raw.teams.length > 0 && (
          <select value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)} style={selectStyle(ctx)}>
            <option value="all">Todos os times</option>
            {raw.teams.map((t) => (
              <option key={t.slug} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        )}
        <select value={loadFilter} onChange={(e) => setLoadFilter(e.target.value)} style={selectStyle(ctx)}>
          <option value="all">Qualquer carga</option>
          {Object.entries(LOAD_META).map(([k, v]) => (
            <option key={k} value={k}>
              {v.label}
            </option>
          ))}
        </select>
        <select value={sort} onChange={(e) => setSort(e.target.value as any)} style={selectStyle(ctx)}>
          <option value="load">Ordenar: carga</option>
          <option value="activity">Ordenar: atividade</option>
          <option value="name">Ordenar: nome</option>
        </select>
        <span style={{ fontSize: 11.5, color: theme.textMuted, marginLeft: 'auto' }}>{filtered.length} pessoa(s)</span>
      </div>

      {/* Onboarding */}
      {newcomers.length > 0 && (
        <Panel ctx={ctx} icon={<GraduationCap size={14} color={accentColor} />} title="Onboarding" right={<span style={{ fontSize: 11, color: theme.textMuted }}>quem chegou nos últimos 30 dias</span>}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 6 }}>
            {newcomers.map((m) => {
              const ob = computeOnboarding(m, raw, repoData.onboarding[m.login.toLowerCase()]);
              const started = Boolean(repoData.onboarding[m.login.toLowerCase()]);
              return (
                <div key={m.login} onClick={() => onOpenMember(m.login)} style={{ background: theme.controlBg, borderRadius: 8, padding: 10, display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Avatar ctx={ctx} login={m.login} url={m.avatarUrl} size={24} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: theme.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.login}</span>
                    <span style={{ fontSize: 11, color: ob.percent === 100 ? '#22c55e' : theme.textSecondary }}>
                      {ob.done}/{ob.total}
                    </span>
                  </div>
                  <Bar ctx={ctx} value={ob.done} max={ob.total} color={ob.percent === 100 ? '#22c55e' : accentColor} />
                  <div style={{ fontSize: 10.5, color: theme.textMuted }}>
                    Próximo: {ob.steps.find((s) => !s.done)?.label || 'concluído 🎉'}
                  </div>
                  {!started && (
                    <SmallButton ctx={ctx} onClick={() => onStartOnboarding(m.login)}>
                      <UserPlus size={11} /> Acompanhar onboarding
                    </SmallButton>
                  )}
                </div>
              );
            })}
          </div>
        </Panel>
      )}

      {/* Cards */}
      {filtered.length === 0 ? (
        <Panel ctx={ctx}>
          <EmptyState ctx={ctx} icon={<Users size={24} color={theme.textMuted} />} text="Nenhum membro encontrado com esses filtros." />
        </Panel>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(270px, 1fr))', gap: 5 }}>
          {filtered.map((m) => {
            const p = people[m.login.toLowerCase()] || {};
            const meta = LOAD_META[m.loadLevel];
            const d = daily[m.login.toLowerCase()];
            const away = p.availability && (isAwayNow(p.availability) || p.availability.status === 'meio-periodo') ? AV_LABEL[p.availability.status] : null;
            const lt = localTimeFor(p.timezone);
            return (
              <div
                key={m.login}
                onClick={() => onOpenMember(m.login)}
                style={{ background: theme.viewCanvasBg, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', transition: 'background 0.15s ease', minWidth: 0 }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.viewCardHoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = theme.viewCanvasBg)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar ctx={ctx} login={m.login} url={m.avatarUrl} size={34} ring={d?.blockers.length ? '#ef4444' : away ? away.color : undefined} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.login}</span>
                      <Pill color={ROLE_COLOR[m.role] || theme.textSecondary}>{m.role}</Pill>
                      {m.affiliation === 'outside' && <Pill color="#f59e0b">externo</Pill>}
                    </div>
                    <div style={{ fontSize: 11, color: theme.textSecondary, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                      <span>ativo {relativeTime(m.lastActivityAt)}</span>
                      {lt && (
                        <span title={p.timezone}>
                          <Clock size={10} style={{ verticalAlign: -1 }} /> {lt}
                        </span>
                      )}
                      {away && <Pill color={away.color}>{away.label}</Pill>}
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Bar ctx={ctx} value={m.loadScore} max={loadMax} color={meta.color} />
                  <Pill color={meta.color}>{meta.label}</Pill>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4, textAlign: 'center' }}>
                  {[
                    { v: m.openAssigned.length, l: 'issues' },
                    { v: m.inProgress, l: 'em prog.' },
                    { v: m.openPulls.length, l: 'PRs' },
                    { v: m.reviewQueue.length, l: 'reviews', warn: m.reviewQueue[0]?.waitingHours > 48 },
                  ].map((s) => (
                    <div key={s.l} style={{ background: theme.controlBg, borderRadius: 6, padding: '5px 0' }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: s.warn ? '#ef4444' : theme.textPrimary }}>{s.v}</div>
                      <div style={{ fontSize: 10, color: theme.textMuted }}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {d && (d.today.length > 0 || d.blockers.length > 0) && (
                  <div style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 1.4 }}>
                    {d.blockers.length > 0 ? <span style={{ color: '#ef4444' }}>⛔ {d.blockers[0].title}</span> : <span>Hoje: {d.today[0]}</span>}
                  </div>
                )}

                {(m.teams.length > 0 || (p.skills || []).length > 0) && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {m.teams.map((t) => (
                      <Pill key={t} color="#ec4899">
                        {t}
                      </Pill>
                    ))}
                    {(p.skills || []).map((s) => (
                      <Pill key={s} color={accentColor}>
                        {s}
                      </Pill>
                    ))}
                  </div>
                )}

                <div style={{ display: 'flex', gap: 4 }}>
                  <SmallButton ctx={ctx} onClick={() => onOpenMember(m.login, 'assign')}>
                    <UserPlus size={11} /> Atribuir
                  </SmallButton>
                  <SmallButton ctx={ctx} onClick={() => onOpenMember(m.login, 'review')}>
                    <Eye size={11} /> Review
                  </SmallButton>
                  <SmallButton ctx={ctx} onClick={() => onOpenMember(m.login, 'mention')}>
                    <AtSign size={11} /> Mencionar
                  </SmallButton>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
