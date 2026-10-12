import React, { useMemo, useState } from 'react';
import { AlertCircle, ArrowUpDown, AtSign, Clock, Eye, GraduationCap, LayoutGrid, Search, Table, UserPlus, Users } from 'lucide-react';
import { logSystemActivity } from '../../utils/brainService';
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
  const [sort, setSort] = useState<'load' | 'activity' | 'name' | 'issues' | 'prs' | 'reviews'>('load');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>(() => {
    try {
      return (localStorage.getItem('team_members_view_mode') as 'cards' | 'table') || 'cards';
    } catch {
      return 'cards';
    }
  });

  const changeViewMode = (mode: 'cards' | 'table') => {
    setViewMode(mode);
    try {
      localStorage.setItem('team_members_view_mode', mode);
    } catch {}
    logSystemActivity('membros', 'alternar_visualizacao', mode);
  };

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
    if (sort === 'issues') return [...list].sort((a, b) => b.openAssigned.length - a.openAssigned.length);
    if (sort === 'prs') return [...list].sort((a, b) => b.openPulls.length - a.openPulls.length);
    if (sort === 'reviews') return [...list].sort((a, b) => b.reviewQueue.length - a.reviewQueue.length);
    return list;
  }, [members, query, teamFilter, loadFilter, sort, people]);

  const newcomers = members.filter((m) => isNewcomer(m, repoData.onboarding[m.login.toLowerCase()]));
  const loadMax = Math.max(1, ...members.map((m) => m.loadScore));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0 }}>
      {/* Toolbar */}
      <div style={{ background: ctx.isEffectiveDark ? '#141414' : '#ffffff', borderRadius: 8, padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', border: 'none', boxShadow: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg, borderRadius: 6, padding: '0 8px', height: 28, flex: '1 1 200px', maxWidth: 280 }}>
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
          <option value="issues">Ordenar: issues</option>
          <option value="prs">Ordenar: PRs</option>
          <option value="reviews">Ordenar: reviews</option>
        </select>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
          <span style={{ fontSize: 11.5, color: theme.textMuted }}>{filtered.length} pessoa(s)</span>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg,
              borderRadius: 6,
              padding: 2,
              gap: 2,
              height: 28,
              boxSizing: 'border-box',
            }}
          >
            <button
              type="button"
              onClick={() => changeViewMode('cards')}
              title="Visualização em Cards"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                height: 24,
                padding: '0 8px',
                borderRadius: 4,
                background: viewMode === 'cards' ? (ctx.isEffectiveDark ? '#2a2a2a' : '#e5e5e5') : 'transparent',
                color: viewMode === 'cards' ? theme.textPrimary : theme.textSecondary,
                fontSize: 11.5,
                fontWeight: 400,
                fontFamily: 'inherit',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <LayoutGrid size={12} color={viewMode === 'cards' ? accentColor : 'currentColor'} />
              <span>Cards</span>
            </button>
            <button
              type="button"
              onClick={() => changeViewMode('table')}
              title="Visualização em Tabela"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                height: 24,
                padding: '0 8px',
                borderRadius: 4,
                background: viewMode === 'table' ? (ctx.isEffectiveDark ? '#2a2a2a' : '#e5e5e5') : 'transparent',
                color: viewMode === 'table' ? theme.textPrimary : theme.textSecondary,
                fontSize: 11.5,
                fontWeight: 400,
                fontFamily: 'inherit',
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Table size={12} color={viewMode === 'table' ? accentColor : 'currentColor'} />
              <span>Tabela</span>
            </button>
          </div>
        </div>
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
                  <div style={{ fontSize: 10.5, color: theme.textSecondary }}>
                    Próximo: {ob.steps.find((s) => !s.done)?.label || 'concluído'}
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

      {/* Content: Cards or Table */}
      {filtered.length === 0 ? (
        <Panel ctx={ctx}>
          <EmptyState ctx={ctx} icon={<Users size={24} color={theme.textMuted} />} text="Nenhum membro encontrado com esses filtros." />
        </Panel>
      ) : viewMode === 'cards' ? (
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
                style={{ background: ctx.isEffectiveDark ? '#141414' : '#ffffff', borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, cursor: 'pointer', transition: 'background 0.15s ease', minWidth: 0, border: 'none', boxShadow: 'none' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = ctx.isEffectiveDark ? '#242424' : '#f0f0f0')}
                onMouseLeave={(e) => (e.currentTarget.style.background = ctx.isEffectiveDark ? '#141414' : '#ffffff')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar ctx={ctx} login={m.login} url={m.avatarUrl} size={34} ring={d?.blockers.length ? '#ef4444' : away ? away.color : undefined} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 400, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.login}</span>
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
                    <div key={s.l} style={{ background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg, borderRadius: 6, padding: '5px 0', border: 'none', boxShadow: 'none' }}>
                      <div style={{ fontSize: 14, fontWeight: 400, color: s.warn ? '#ef4444' : theme.textPrimary }}>{s.v}</div>
                      <div style={{ fontSize: 10, color: theme.textSecondary }}>{s.l}</div>
                    </div>
                  ))}
                </div>

                {d && (d.today.length > 0 || d.blockers.length > 0) && (
                  <div style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 1.4 }}>
                    {d.blockers.length > 0 ? (
                      <span style={{ color: '#ef4444', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <AlertCircle size={11} /> {d.blockers[0].title}
                      </span>
                    ) : (
                      <span>Hoje: {d.today[0]}</span>
                    )}
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
      ) : (
        <div
          style={{
            background: ctx.isEffectiveDark ? '#141414' : '#ffffff',
            borderRadius: 8,
            padding: 8,
            overflowX: 'auto',
            minWidth: 0,
            border: 'none',
            boxShadow: 'none',
          }}
        >
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, textAlign: 'left', fontFamily: 'inherit' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${ctx.isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}` }}>
                <th
                  onClick={() => setSort((s) => (s === 'name' ? 'load' : 'name'))}
                  style={{
                    padding: '8px 10px',
                    color: sort === 'name' ? accentColor : theme.textSecondary,
                    fontWeight: 400,
                    fontSize: 11.5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  title="Ordenar por membro"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Membro {sort === 'name' && <ArrowUpDown size={10} color={accentColor} />}
                  </span>
                </th>
                <th
                  onClick={() => setSort((s) => (s === 'load' ? 'name' : 'load'))}
                  style={{
                    padding: '8px 10px',
                    color: sort === 'load' ? accentColor : theme.textSecondary,
                    fontWeight: 400,
                    fontSize: 11.5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  title="Ordenar por carga"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Carga {sort === 'load' && <ArrowUpDown size={10} color={accentColor} />}
                  </span>
                </th>
                <th
                  onClick={() => setSort((s) => (s === 'activity' ? 'name' : 'activity'))}
                  style={{
                    padding: '8px 10px',
                    color: sort === 'activity' ? accentColor : theme.textSecondary,
                    fontWeight: 400,
                    fontSize: 11.5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  title="Ordenar por atividade"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Atividade {sort === 'activity' && <ArrowUpDown size={10} color={accentColor} />}
                  </span>
                </th>
                <th
                  onClick={() => setSort((s) => (s === 'issues' ? 'name' : 'issues'))}
                  style={{
                    padding: '8px 10px',
                    color: sort === 'issues' ? accentColor : theme.textSecondary,
                    fontWeight: 400,
                    fontSize: 11.5,
                    textAlign: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  title="Ordenar por issues"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Issues {sort === 'issues' && <ArrowUpDown size={10} color={accentColor} />}
                  </span>
                </th>
                <th
                  style={{
                    padding: '8px 10px',
                    color: theme.textSecondary,
                    fontWeight: 400,
                    fontSize: 11.5,
                    textAlign: 'center',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Em Prog.
                </th>
                <th
                  onClick={() => setSort((s) => (s === 'prs' ? 'name' : 'prs'))}
                  style={{
                    padding: '8px 10px',
                    color: sort === 'prs' ? accentColor : theme.textSecondary,
                    fontWeight: 400,
                    fontSize: 11.5,
                    textAlign: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  title="Ordenar por PRs"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    PRs {sort === 'prs' && <ArrowUpDown size={10} color={accentColor} />}
                  </span>
                </th>
                <th
                  onClick={() => setSort((s) => (s === 'reviews' ? 'name' : 'reviews'))}
                  style={{
                    padding: '8px 10px',
                    color: sort === 'reviews' ? accentColor : theme.textSecondary,
                    fontWeight: 400,
                    fontSize: 11.5,
                    textAlign: 'center',
                    cursor: 'pointer',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  title="Ordenar por reviews"
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Reviews {sort === 'reviews' && <ArrowUpDown size={10} color={accentColor} />}
                  </span>
                </th>
                <th
                  style={{
                    padding: '8px 10px',
                    color: theme.textSecondary,
                    fontWeight: 400,
                    fontSize: 11.5,
                    whiteSpace: 'nowrap',
                  }}
                >
                  Times & Habilidades
                </th>
                <th
                  style={{
                    padding: '8px 10px',
                    color: theme.textSecondary,
                    fontWeight: 400,
                    fontSize: 11.5,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                  }}
                >
                  Ações
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((m) => {
                const p = people[m.login.toLowerCase()] || {};
                const meta = LOAD_META[m.loadLevel];
                const d = daily[m.login.toLowerCase()];
                const away = p.availability && (isAwayNow(p.availability) || p.availability.status === 'meio-periodo') ? AV_LABEL[p.availability.status] : null;
                const lt = localTimeFor(p.timezone);
                const hasReviewsWarn = m.reviewQueue.length > 0 && m.reviewQueue[0]?.waitingHours > 48;

                return (
                  <tr
                    key={m.login}
                    onClick={() => {
                      onOpenMember(m.login);
                      logSystemActivity('membros', 'abrir_detalhes', m.login);
                    }}
                    style={{
                      borderBottom: `1px solid ${ctx.isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                      cursor: 'pointer',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = ctx.isEffectiveDark ? '#1c1c1c' : '#f5f5f5')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 160 }}>
                        <Avatar ctx={ctx} login={m.login} url={m.avatarUrl} size={28} ring={d?.blockers.length ? '#ef4444' : away ? away.color : undefined} />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 12.5, fontWeight: 400, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {m.login}
                            </span>
                            <Pill color={ROLE_COLOR[m.role] || theme.textSecondary}>{m.role}</Pill>
                            {m.affiliation === 'outside' && <Pill color="#f59e0b">externo</Pill>}
                          </div>
                          {away && <span style={{ fontSize: 10.5, color: away.color }}>{away.label}</span>}
                        </div>
                      </div>
                    </td>

                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 130 }}>
                        <div style={{ width: 60 }}>
                          <Bar ctx={ctx} value={m.loadScore} max={loadMax} color={meta.color} />
                        </div>
                        <Pill color={meta.color}>{meta.label}</Pill>
                      </div>
                    </td>

                    <td style={{ padding: '8px 10px', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2, fontSize: 11, color: theme.textSecondary }}>
                        <span>ativo {relativeTime(m.lastActivityAt)}</span>
                        {lt && (
                          <span title={p.timezone} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Clock size={10} /> {lt}
                          </span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: m.openAssigned.length > 0 ? theme.textPrimary : theme.textMuted }}>
                        {m.openAssigned.length}
                      </span>
                    </td>

                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: m.inProgress > 0 ? '#f59e0b' : theme.textMuted }}>
                        {m.inProgress}
                      </span>
                    </td>

                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: m.openPulls.length > 0 ? '#a855f7' : theme.textMuted }}>
                        {m.openPulls.length}
                      </span>
                    </td>

                    <td style={{ padding: '8px 10px', textAlign: 'center' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 500, color: hasReviewsWarn ? '#ef4444' : m.reviewQueue.length > 0 ? theme.textPrimary : theme.textMuted }}>
                        {m.reviewQueue.length}
                      </span>
                    </td>

                    <td style={{ padding: '8px 10px' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, maxWidth: 220 }}>
                        {m.teams.map((t) => (
                          <Pill key={t} color="#ec4899">
                            {t}
                          </Pill>
                        ))}
                        {(p.skills || []).slice(0, 2).map((s) => (
                          <Pill key={s} color={accentColor}>
                            {s}
                          </Pill>
                        ))}
                        {(p.skills || []).length > 2 && (
                          <span style={{ fontSize: 10, color: theme.textMuted, alignSelf: 'center' }}>
                            +{(p.skills || []).length - 2}
                          </span>
                        )}
                        {m.teams.length === 0 && (!p.skills || p.skills.length === 0) && (
                          <span style={{ fontSize: 11, color: theme.textMuted }}>—</span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: '8px 10px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }} onClick={(e) => e.stopPropagation()}>
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
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
