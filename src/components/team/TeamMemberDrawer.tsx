import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  AtSign,
  CalendarDays,
  Check,
  CheckCircle2,
  CheckSquare,
  CircleDot,
  Clock,
  Copy,
  ExternalLink,
  Eye,
  FilePlus2,
  GitCommit,
  GitPullRequest,
  GraduationCap,
  PlusCircle,
  Square,
  Tag,
  UserPlus,
  X,
  Zap,
} from 'lucide-react';
import type { ProjectIssue } from '../ProjectsSchedulerView';
import {
  formatHours,
  relativeTime,
  type AvailabilityStatus,
  type DailySnapshot,
  type MemberStats,
  type PersonLocalData,
  type RepoTeamLocalData,
  type TeamInsightsRaw,
} from './teamTypes';
import { Avatar, LOAD_META, Panel, Pill, ROLE_COLOR, SmallButton, inputStyle, openUrl, rowHover, selectStyle, type TeamUiCtx } from './teamUi';
import { computeOnboarding, localTimeFor } from './TeamMembersPanel';
import type { TeamWorkspaceState } from './useTeamWorkspace';
import { logSystemActivity } from '../../utils/brainService';

const COMMON_TZ = ['America/Sao_Paulo', 'America/Manaus', 'America/Recife', 'America/New_York', 'America/Los_Angeles', 'Europe/Lisbon', 'Europe/London', 'Europe/Berlin', 'Asia/Tokyo', 'UTC'];

interface Props {
  ctx: TeamUiCtx;
  member: MemberStats;
  raw: TeamInsightsRaw;
  issues: ProjectIssue[];
  person: PersonLocalData;
  daily?: DailySnapshot;
  repoData: RepoTeamLocalData;
  initialAction?: 'assign' | 'review' | 'mention';
  initialPr?: number;
  ws: TeamWorkspaceState;
  onClose: () => void;
}

export const TeamMemberDrawer: React.FC<Props> = ({
  ctx,
  member: m,
  raw,
  issues,
  person,
  daily,
  repoData,
  initialAction,
  initialPr,
  ws,
  onClose,
}) => {
  const { theme, accentColor } = ctx;
  const key = m.login.toLowerCase();
  const [actionTab, setActionTab] = useState<'assign' | 'create' | 'review' | 'mention'>(initialAction || 'assign');
  const [assignSearch, setAssignSearch] = useState('');
  const [assignIssue, setAssignIssue] = useState('');
  const [reviewPr, setReviewPr] = useState(initialPr ? String(initialPr) : '');
  const [mentionIssue, setMentionIssue] = useState('');
  const [mentionText, setMentionText] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [copiedMention, setCopiedMention] = useState(false);
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [newIssueBody, setNewIssueBody] = useState('');
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);
  const [issueFilter, setIssueFilter] = useState<'all' | 'in_progress' | 'todo'>('all');
  const [prTab, setPrTab] = useState<'author' | 'review'>('author');

  useEffect(() => {
    if (initialAction) setActionTab(initialAction);
    setReviewPr(initialPr ? String(initialPr) : '');
  }, [initialAction, initialPr, m.login]);

  const assignable = useMemo(
    () =>
      issues
        .filter((i) => i.status !== 'Concluído' && i.githubNumber && !i.assignees.some((a) => a.name.toLowerCase() === key))
        .sort((a, b) => a.assignees.length - b.assignees.length),
    [issues, key],
  );

  const filteredAssignable = useMemo(() => {
    if (!assignSearch.trim()) return assignable;
    const q = assignSearch.toLowerCase();
    return assignable.filter((i) => i.id?.toLowerCase().includes(q) || i.title?.toLowerCase().includes(q));
  }, [assignable, assignSearch]);

  const reviewable = raw.openPulls.filter((p) => p.author?.toLowerCase() !== key && !p.requestedReviewers.some((r) => r.toLowerCase() === key));
  const openIssues = issues.filter((i) => i.status !== 'Concluído' && i.githubNumber);
  const ob = computeOnboarding(m, raw, repoData.onboarding[key]);
  const meta = LOAD_META[m.loadLevel];
  const av = person.availability || { status: 'disponivel' as AvailabilityStatus };

  const tzList = useMemo(() => {
    try {
      return (Intl as any).supportedValuesOf?.('timeZone') || COMMON_TZ;
    } catch {
      return COMMON_TZ;
    }
  }, []);

  const toggleManual = (id: string) =>
    ws.updateRepoData((prev) => {
      const cur = prev.onboarding[key] || { startedAt: new Date().toISOString(), manualDone: [] };
      const manualDone = cur.manualDone.includes(id) ? cur.manualDone.filter((x) => x !== id) : [...cur.manualDone, id];
      return { ...prev, onboarding: { ...prev.onboarding, [key]: { ...cur, manualDone } } };
    });

  const addSkill = () => {
    const s = skillInput.trim();
    if (!s) return;
    const skills = Array.from(new Set([...(person.skills || []), s]));
    logSystemActivity('time', 'adicionar_habilidade', `${ws.owner}/${ws.repo}`, { member: m.login, skill: s });
    ws.setPerson(m.login, { skills });
    setSkillInput('');
  };

  const copyMention = () => {
    navigator.clipboard?.writeText(`@${m.login}`);
    setCopiedMention(true);
    setTimeout(() => setCopiedMention(false), 2000);
  };

  const handleCreateIssue = async () => {
    if (!newIssueTitle.trim()) return;
    setIsCreatingIssue(true);
    try {
      const res = await window.electronAPI?.github?.createIssue?.(ws.owner, ws.repo, {
        title: newIssueTitle.trim(),
        body: newIssueBody.trim() || undefined,
        assignees: [m.login],
      });
      if (res?.success) {
        logSystemActivity('time', 'criar_tarefa_membro', `${ws.owner}/${ws.repo}`, { member: m.login, title: newIssueTitle.trim() });
        setNewIssueTitle('');
        setNewIssueBody('');
        setActionTab('assign');
        ws.refresh(true);
      }
    } catch (e: any) {
      console.error(e);
    } finally {
      setIsCreatingIssue(false);
    }
  };

  const filteredAssigned = useMemo(() => {
    if (issueFilter === 'in_progress') {
      return m.openAssigned.filter((i) => i.status === 'Em Progresso');
    }
    if (issueFilter === 'todo') {
      return m.openAssigned.filter((i) => i.status !== 'Em Progresso');
    }
    return m.openAssigned;
  }, [m.openAssigned, issueFilter]);

  const busy = (k: string) => ws.pendingAction === k;
  const label = { fontSize: 11, color: theme.textSecondary, marginBottom: 3, display: 'block' } as const;

  return (
    <>
      {/* Overlay isolado com zIndex alto e backdrop blur */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.65)',
          backdropFilter: 'blur(3px)',
          WebkitBackdropFilter: 'blur(3px)',
          zIndex: 99999,
          border: 'none',
          boxShadow: 'none',
        }}
      />

      {/* Drawer com zIndex 100000 e fundo 100% opaco */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(500px, 100vw)',
          background: ctx.isEffectiveDark ? '#141414' : '#ffffff',
          zIndex: 100000,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'Poppins', -apple-system, sans-serif",
          border: 'none',
          boxShadow: 'none',
          boxSizing: 'border-box',
        }}
      >
        {/* Header do Drawer */}
        <div
          style={{
            padding: '14px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            borderBottom: `1px solid ${ctx.isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
            background: ctx.isEffectiveDark ? '#141414' : '#fafafa',
            flexShrink: 0,
            boxSizing: 'border-box',
          }}
        >
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <Avatar ctx={ctx} login={m.login} url={m.avatarUrl} size={46} />
            <span
              title={`Status: ${av.status}`}
              style={{
                position: 'absolute',
                bottom: -1,
                right: -1,
                width: 12,
                height: 12,
                borderRadius: '50%',
                background:
                  av.status === 'disponivel'
                    ? '#22c55e'
                    : av.status === 'meio-periodo'
                    ? '#3b82f6'
                    : av.status === 'ausente'
                    ? '#ef4444'
                    : '#f59e0b',
              }}
            />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 400, color: theme.textPrimary, letterSpacing: '-0.01em' }}>
                @{m.login}
              </span>
              <Pill color={ROLE_COLOR[m.role]}>{m.role}</Pill>
              <Pill color={meta.color}>{meta.label}</Pill>
            </div>
            <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 3, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span>
                {m.teams.length ? m.teams.join(' • ') : m.affiliation === 'outside' ? 'Colaborador externo' : m.affiliation === 'organization' ? 'Acesso pela organização' : 'Acesso direto'}
              </span>
              {localTimeFor(person.timezone) && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: theme.textMuted }}>
                  • <Clock size={10} /> {localTimeFor(person.timezone)} local
                </span>
              )}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <SmallButton ctx={ctx} onClick={copyMention} title="Copiar menção (@user)">
              {copiedMention ? <Check size={12} color="#22c55e" /> : <Copy size={12} />}
              {copiedMention ? 'Copiado' : '@'}
            </SmallButton>
            <SmallButton ctx={ctx} onClick={() => openUrl(m.htmlUrl || `https://github.com/${m.login}`)} title="Abrir perfil no GitHub">
              <ExternalLink size={12} />
            </SmallButton>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                borderRadius: 6,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: theme.textSecondary,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = ctx.isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Conteúdo com scroll */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10, boxSizing: 'border-box' }} className="no-scrollbar">
          {/* Números / Métricas */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[
              { v: m.commits90d, l: 'Commits 90d', icon: GitCommit, color: '#3b82f6' },
              { v: m.closedLast14d, l: 'Fechadas 14d', icon: CheckCircle2, color: '#22c55e' },
              { v: relativeTime(m.lastCommitAt) || '—', l: 'Último commit', icon: Clock, color: '#a3a3a3' },
              { v: `${m.sprintIssues}${m.sprintPoints > 0 ? ` (${m.sprintPoints}p)` : ''}`, l: 'Na sprint', icon: Zap, color: '#f59e0b' },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div
                  key={s.l}
                  style={{
                    background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg,
                    borderRadius: 8,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 3,
                    border: 'none',
                    boxShadow: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: theme.textMuted }}>
                    <Icon size={11} color={s.color} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.l}</span>
                  </div>
                  <div style={{ fontSize: 13.5, fontWeight: 400, color: theme.textPrimary, lineHeight: 1.2 }}>{s.v}</div>
                </div>
              );
            })}
          </div>

          {/* Ações rápidas */}
          <Panel ctx={ctx}>
            <div style={{ display: 'flex', gap: 4, background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg, borderRadius: 7, padding: 3 }}>
              {(
                [
                  ['assign', 'Atribuir', UserPlus],
                  ['create', 'Nova tarefa', PlusCircle],
                  ['review', 'Pedir review', Eye],
                  ['mention', 'Mencionar', AtSign],
                ] as const
              ).map(([id, text, Icon]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActionTab(id)}
                  style={{
                    flex: 1,
                    height: 28,
                    border: 'none',
                    borderRadius: 5,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 11,
                    fontWeight: 400,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    background: actionTab === id ? (ctx.isEffectiveDark ? '#2a2a2a' : '#ffffff') : 'transparent',
                    color: actionTab === id ? theme.textPrimary : theme.textSecondary,
                    boxShadow: 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  <Icon size={12} color={actionTab === id ? accentColor : theme.textSecondary} />
                  <span>{text}</span>
                </button>
              ))}
            </div>

            {actionTab === 'assign' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <input
                    value={assignSearch}
                    onChange={(e) => setAssignSearch(e.target.value)}
                    placeholder="Filtrar issues abertas por nome ou #ID..."
                    style={{ ...inputStyle(ctx), flex: 1 }}
                  />
                  {assignSearch && (
                    <SmallButton ctx={ctx} onClick={() => setAssignSearch('')}>
                      Limpar
                    </SmallButton>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                  <select
                    value={assignIssue}
                    onChange={(e) => setAssignIssue(e.target.value)}
                    style={{ ...selectStyle(ctx), flex: 1 }}
                  >
                    <option value="">Selecione uma issue ({filteredAssignable.length} disponíveis)…</option>
                    {filteredAssignable.map((i) => (
                      <option key={i.id} value={i.githubNumber}>
                        {i.id} • {i.title.slice(0, 50)} {i.assignees.length === 0 ? '(sem dono)' : ''}
                      </option>
                    ))}
                  </select>
                  <SmallButton
                    ctx={ctx}
                    primary
                    disabled={!assignIssue || busy(`assign-${assignIssue}`)}
                    onClick={async () => {
                      logSystemActivity('time', 'atribuir_issue', `${ws.owner}/${ws.repo}`, { member: m.login, issueNumber: assignIssue });
                      if (await ws.actions.assignIssue(Number(assignIssue), m.login)) {
                        setAssignIssue('');
                        setAssignSearch('');
                      }
                    }}
                  >
                    Atribuir
                  </SmallButton>
                </div>
              </div>
            )}

            {actionTab === 'create' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                <input
                  value={newIssueTitle}
                  onChange={(e) => setNewIssueTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreateIssue()}
                  placeholder="Título da nova tarefa..."
                  style={{ ...inputStyle(ctx), width: '100%' }}
                  autoFocus
                />
                <textarea
                  value={newIssueBody}
                  onChange={(e) => setNewIssueBody(e.target.value)}
                  placeholder={`Descrição ou contexto para @${m.login} (opcional)...`}
                  rows={2}
                  style={{ ...inputStyle(ctx), height: 'auto', padding: 8, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                  <SmallButton
                    ctx={ctx}
                    primary
                    disabled={!newIssueTitle.trim() || isCreatingIssue}
                    onClick={handleCreateIssue}
                  >
                    {isCreatingIssue ? 'Criando…' : `Criar e Atribuir a @${m.login}`}
                  </SmallButton>
                </div>
              </div>
            )}

            {actionTab === 'review' && (
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 4 }}>
                <select
                  value={reviewPr}
                  onChange={(e) => setReviewPr(e.target.value)}
                  style={{ ...selectStyle(ctx), flex: 1 }}
                >
                  <option value="">Selecione um PR aberto ({reviewable.length} disponíveis)…</option>
                  {reviewable.map((p) => (
                    <option key={p.number} value={p.number}>
                      #{p.number} • {p.title.slice(0, 50)} (@{p.author})
                    </option>
                  ))}
                </select>
                <SmallButton
                  ctx={ctx}
                  primary
                  disabled={!reviewPr || busy(`review-${reviewPr}-${m.login}`)}
                  onClick={async () => {
                    logSystemActivity('time', 'pedir_review', `${ws.owner}/${ws.repo}`, { member: m.login, pullNumber: reviewPr });
                    if (await ws.actions.requestReview(Number(reviewPr), m.login)) setReviewPr('');
                  }}
                >
                  Solicitar
                </SmallButton>
              </div>
            )}

            {actionTab === 'mention' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                <select value={mentionIssue} onChange={(e) => setMentionIssue(e.target.value)} style={selectStyle(ctx)}>
                  <option value="">Em qual issue deseja mencionar?</option>
                  {openIssues.map((i) => (
                    <option key={i.id} value={i.githubNumber}>
                      {i.id} • {i.title.slice(0, 60)}
                    </option>
                  ))}
                </select>
                <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                  {[
                    'Qual o status desta tarefa?',
                    'Você tem algum impedimento aqui?',
                    'Pode verificar as alterações?',
                  ].map((preset) => (
                    <Pill
                      key={preset}
                      color={theme.textSecondary}
                      onClick={() => setMentionText((prev) => (prev ? `${prev} ${preset}` : preset))}
                      title="Inserir modelo de mensagem"
                    >
                      + {preset}
                    </Pill>
                  ))}
                </div>
                <textarea
                  value={mentionText}
                  onChange={(e) => setMentionText(e.target.value)}
                  placeholder={`Mensagem para @${m.login}…`}
                  rows={2}
                  style={{ ...inputStyle(ctx), height: 'auto', padding: 8, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <SmallButton
                    ctx={ctx}
                    primary
                    disabled={!mentionIssue || !mentionText.trim() || busy(`mention-${mentionIssue}`)}
                    onClick={async () => {
                      logSystemActivity('time', 'mencionar_membro', `${ws.owner}/${ws.repo}`, { member: m.login, issueNumber: mentionIssue });
                      if (await ws.actions.mention(Number(mentionIssue), m.login, mentionText)) setMentionText('');
                    }}
                  >
                    Comentar
                  </SmallButton>
                </div>
              </div>
            )}
          </Panel>

          {/* Disponibilidade */}
          <Panel ctx={ctx} icon={<CalendarDays size={13} color={accentColor} />} title="Disponibilidade">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Chips de Status rápido */}
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {(
                  [
                    ['disponivel', 'Disponível', '#22c55e'],
                    ['meio-periodo', 'Meio período', '#3b82f6'],
                    ['folga', 'Folga', '#f59e0b'],
                    ['ferias', 'Férias', '#a855f7'],
                    ['ausente', 'Ausente', '#ef4444'],
                  ] as const
                ).map(([statusKey, statusLabel, statusColor]) => {
                  const isActive = av.status === statusKey;
                  return (
                    <button
                      key={statusKey}
                      type="button"
                      onClick={() => {
                        logSystemActivity('time', 'alterar_disponibilidade', `${ws.owner}/${ws.repo}`, { member: m.login, status: statusKey });
                        ws.setPerson(m.login, { availability: { ...av, status: statusKey as AvailabilityStatus } });
                      }}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: 'none',
                        boxShadow: 'none',
                        cursor: 'pointer',
                        fontSize: 11.5,
                        fontFamily: 'inherit',
                        background: isActive ? `${statusColor}22` : ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg,
                        color: isActive ? statusColor : theme.textSecondary,
                        fontWeight: 400,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor }} />
                      <span>{statusLabel}</span>
                    </button>
                  );
                })}
              </div>

              {/* Fuso horário */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 4 }}>
                <span style={label}>Fuso horário (Timezone)</span>
                <select
                  value={person.timezone || ''}
                  onChange={(e) => {
                    logSystemActivity('time', 'alterar_timezone', `${ws.owner}/${ws.repo}`, { member: m.login, timezone: e.target.value });
                    ws.setPerson(m.login, { timezone: e.target.value || undefined });
                  }}
                  style={{ ...selectStyle(ctx), width: '100%' }}
                >
                  <option value="">Não definido</option>
                  {tzList.map((tz: string) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>

              {av.status !== 'disponivel' && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, paddingTop: 4 }}>
                  <div>
                    <span style={label}>Data início</span>
                    <input
                      type="date"
                      value={av.from || ''}
                      onChange={(e) => ws.setPerson(m.login, { availability: { ...av, from: e.target.value || undefined } })}
                      style={inputStyle(ctx)}
                    />
                  </div>
                  <div>
                    <span style={label}>Data retorno</span>
                    <input
                      type="date"
                      value={av.to || ''}
                      onChange={(e) => ws.setPerson(m.login, { availability: { ...av, to: e.target.value || undefined } })}
                      style={inputStyle(ctx)}
                    />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <span style={label}>Observação de ausência / backup</span>
                    <input
                      value={av.note || ''}
                      onChange={(e) => ws.setPerson(m.login, { availability: { ...av, note: e.target.value } })}
                      placeholder="Ex: Cobrindo tarefas com @fulano..."
                      style={inputStyle(ctx)}
                    />
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {/* Habilidades */}
          <Panel ctx={ctx} icon={<Tag size={13} color={accentColor} />} title="Habilidades e Especialidades">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {(person.skills || []).map((s) => (
                  <Pill
                    key={s}
                    color={accentColor}
                    title="Clique para remover"
                    onClick={() => {
                      logSystemActivity('time', 'remover_habilidade', `${ws.owner}/${ws.repo}`, { member: m.login, skill: s });
                      ws.setPerson(m.login, { skills: (person.skills || []).filter((x) => x !== s) });
                    }}
                  >
                    {s} ×
                  </Pill>
                ))}
                {Object.entries(m.tags)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .filter(([t]) => !(person.skills || []).some((s) => s.toLowerCase() === t))
                  .map(([t, n]) => (
                    <Pill
                      key={t}
                      color={theme.textSecondary}
                      title="Sugerido pelo histórico — clique para adicionar"
                      onClick={() => {
                        logSystemActivity('time', 'adicionar_habilidade', `${ws.owner}/${ws.repo}`, { member: m.login, skill: t });
                        ws.setPerson(m.login, { skills: [...(person.skills || []), t] });
                      }}
                    >
                      + {t} ({n})
                    </Pill>
                  ))}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <input
                  value={skillInput}
                  onChange={(e) => setSkillInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                  placeholder="Nova habilidade (ex: React, Flutter, Python, QA)..."
                  style={{ ...inputStyle(ctx), flex: 1 }}
                />
                <SmallButton ctx={ctx} onClick={addSkill}>
                  Adicionar
                </SmallButton>
              </div>
            </div>
          </Panel>

          {/* Daily (se houver dados) */}
          {daily && (daily.yesterday.length > 0 || daily.today.length > 0 || daily.blockers.length > 0) && (
            <Panel ctx={ctx} title="Daily (Hoje e Ontem)">
              <div style={{ fontSize: 11.5, color: theme.textSecondary, display: 'flex', flexDirection: 'column', gap: 4 }}>
                {daily.yesterday.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10.5, fontWeight: 400, color: theme.textMuted, marginBottom: 2 }}>Concluído ontem:</div>
                    {daily.yesterday.map((t, i) => (
                      <div key={`y${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.textPrimary, padding: '2px 0' }}>
                        <Check size={11} color="#22c55e" />
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                )}
                {daily.today.length > 0 && (
                  <div style={{ marginTop: 2 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 400, color: theme.textMuted, marginBottom: 2 }}>Foco de hoje:</div>
                    {daily.today.map((t, i) => (
                      <div key={`t${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.textPrimary, padding: '2px 0' }}>
                        <span style={{ color: accentColor, fontWeight: 400 }}>→</span>
                        <span>{t}</span>
                      </div>
                    ))}
                  </div>
                )}
                {daily.blockers.length > 0 && (
                  <div style={{ marginTop: 2 }}>
                    <div style={{ fontSize: 10.5, fontWeight: 400, color: '#ef4444', marginBottom: 2 }}>Impedimentos:</div>
                    {daily.blockers.map((b, i) => (
                      <div key={`b${i}`} style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ef4444', padding: '2px 0' }}>
                        <AlertCircle size={11} />
                        <span>{b.title}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Panel>
          )}

          {/* Issues abertas */}
          <Panel
            ctx={ctx}
            icon={<CircleDot size={13} color={accentColor} />}
            title={`Issues abertas (${m.openAssigned.length})`}
            right={
              m.openAssigned.length > 0 ? (
                <div style={{ display: 'flex', gap: 3 }}>
                  {(
                    [
                      ['all', 'Todas'],
                      ['in_progress', 'Em Progresso'],
                      ['todo', 'A Fazer'],
                    ] as const
                  ).map(([fKey, fLabel]) => (
                    <button
                      key={fKey}
                      type="button"
                      onClick={() => setIssueFilter(fKey)}
                      style={{
                        border: 'none',
                        borderRadius: 4,
                        padding: '2px 7px',
                        fontSize: 10.5,
                        fontFamily: 'inherit',
                        cursor: 'pointer',
                        background: issueFilter === fKey ? (ctx.isEffectiveDark ? '#2a2a2a' : '#e5e5e5') : 'transparent',
                        color: issueFilter === fKey ? theme.textPrimary : theme.textSecondary,
                        fontWeight: 400,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {fLabel}
                    </button>
                  ))}
                </div>
              ) : undefined
            }
          >
            {filteredAssigned.length === 0 ? (
              <span style={{ fontSize: 11.5, color: theme.textMuted }}>
                {m.openAssigned.length === 0 ? 'Nenhuma issue atribuída.' : 'Nenhuma issue neste filtro.'}
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {filteredAssigned.slice(0, 15).map((i) => (
                  <div
                    key={i.id}
                    {...rowHover(ctx)}
                    onClick={() => openUrl(i.htmlUrl)}
                    style={{
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                      fontSize: 12,
                      padding: '5px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: i.priorityColor, flexShrink: 0 }} />
                    <span style={{ color: theme.textMuted, fontSize: 11, fontFamily: 'monospace' }}>{i.id}</span>
                    <span style={{ color: theme.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {i.title}
                    </span>
                    <Pill color={i.status === 'Em Progresso' ? '#3b82f6' : theme.textSecondary}>{i.status}</Pill>
                    <ExternalLink size={11} color={theme.textMuted} style={{ flexShrink: 0 }} />
                  </div>
                ))}
              </div>
            )}
          </Panel>

          {/* Pull requests */}
          <Panel
            ctx={ctx}
            icon={<GitPullRequest size={13} color={accentColor} />}
            title="Pull requests"
            right={
              (m.openPulls.length > 0 || m.reviewQueue.length > 0) ? (
                <div style={{ display: 'flex', gap: 3 }}>
                  <button
                    type="button"
                    onClick={() => setPrTab('author')}
                    style={{
                      border: 'none',
                      borderRadius: 4,
                      padding: '2px 7px',
                      fontSize: 10.5,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      background: prTab === 'author' ? (ctx.isEffectiveDark ? '#2a2a2a' : '#e5e5e5') : 'transparent',
                      color: prTab === 'author' ? theme.textPrimary : theme.textSecondary,
                      fontWeight: 400,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Autor ({m.openPulls.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrTab('review')}
                    style={{
                      border: 'none',
                      borderRadius: 4,
                      padding: '2px 7px',
                      fontSize: 10.5,
                      fontFamily: 'inherit',
                      cursor: 'pointer',
                      background: prTab === 'review' ? (ctx.isEffectiveDark ? '#2a2a2a' : '#e5e5e5') : 'transparent',
                      color: prTab === 'review' ? theme.textPrimary : theme.textSecondary,
                      fontWeight: 400,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    Fila de review ({m.reviewQueue.length})
                  </button>
                </div>
              ) : undefined
            }
          >
            {prTab === 'author' && (
              m.openPulls.length === 0 ? (
                <span style={{ fontSize: 11.5, color: theme.textMuted }}>Nenhum PR aberto pelo membro.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {m.openPulls.map((p) => (
                    <div
                      key={`o${p.number}`}
                      {...rowHover(ctx)}
                      onClick={() => openUrl(p.url)}
                      style={{
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                        fontSize: 12,
                        padding: '5px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <Pill color="#22c55e">autor</Pill>
                      <span style={{ color: theme.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        #{p.number} {p.title}
                      </span>
                      {p.draft && <Pill color={theme.textSecondary}>draft</Pill>}
                      <span style={{ fontSize: 10.5, color: theme.textMuted }}>{relativeTime(p.createdAt)}</span>
                      <ExternalLink size={11} color={theme.textMuted} style={{ flexShrink: 0 }} />
                    </div>
                  ))}
                </div>
              )
            )}

            {prTab === 'review' && (
              m.reviewQueue.length === 0 ? (
                <span style={{ fontSize: 11.5, color: theme.textMuted }}>Nenhum review aguardando este membro.</span>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {m.reviewQueue.map(({ pull, waitingHours }) => {
                    const isCritical = waitingHours > 48;
                    const isWarning = waitingHours > 24;
                    const waitColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : theme.textSecondary;
                    return (
                      <div
                        key={`r${pull.number}`}
                        {...rowHover(ctx)}
                        onClick={() => openUrl(pull.url)}
                        style={{
                          display: 'flex',
                          gap: 6,
                          alignItems: 'center',
                          fontSize: 12,
                          padding: '5px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          background: ctx.isEffectiveDark ? '#1c1c1c' : theme.controlBg,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <Pill color="#f59e0b">review</Pill>
                        <span style={{ color: theme.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          #{pull.number} {pull.title}
                        </span>
                        <span style={{ fontSize: 10.5, color: theme.textMuted }}>@{pull.author}</span>
                        <Pill color={waitColor}>{formatHours(waitingHours)}</Pill>
                        {m.login.toLowerCase() === ws.currentUserLogin?.toLowerCase() && (
                          <SmallButton
                            ctx={ctx}
                            disabled={busy(`approve-${pull.number}`)}
                            onClick={(e: React.MouseEvent) => {
                              e.stopPropagation();
                              logSystemActivity('time', 'aprovar_review', `${ws.owner}/${ws.repo}`, { member: m.login, pullNumber: pull.number });
                              ws.actions.approveReview(pull.number, pull.author);
                            }}
                          >
                            Aprovar
                          </SmallButton>
                        )}
                        <ExternalLink size={11} color={theme.textMuted} style={{ flexShrink: 0 }} />
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </Panel>

          {/* Onboarding */}
          <Panel
            ctx={ctx}
            icon={<GraduationCap size={13} color={accentColor} />}
            title={`Onboarding (${ob.done}/${ob.total})`}
            right={
              repoData.onboarding[key] ? (
                <SmallButton
                  ctx={ctx}
                  onClick={() => {
                    logSystemActivity('time', 'parar_onboarding', `${ws.owner}/${ws.repo}`, { member: m.login });
                    ws.updateRepoData((prev) => {
                      const { [key]: _, ...rest } = prev.onboarding;
                      return { ...prev, onboarding: rest };
                    });
                  }}
                >
                  Parar de acompanhar
                </SmallButton>
              ) : undefined
            }
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {/* Barra de progresso visual */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: theme.textSecondary }}>
                  <span>Progresso do checklist</span>
                  <span style={{ fontWeight: 400, color: ob.percent === 100 ? '#22c55e' : accentColor }}>
                    {ob.done} de {ob.total} ({ob.percent}%)
                  </span>
                </div>
                <div style={{ width: '100%', height: 6, borderRadius: 6, background: ctx.isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)', overflow: 'hidden' }}>
                  <div style={{ width: `${ob.percent}%`, height: '100%', background: ob.percent === 100 ? '#22c55e' : accentColor, borderRadius: 6, transition: 'width 0.3s ease' }} />
                </div>
              </div>

              {/* Lista de passos */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {ob.steps.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => {
                      if (s.manual) {
                        logSystemActivity('time', 'toggle_onboarding_step', `${ws.owner}/${ws.repo}`, { member: m.login, step: s.id, done: !s.done });
                        toggleManual(s.id);
                      }
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      color: s.done ? theme.textPrimary : theme.textSecondary,
                      cursor: s.manual ? 'pointer' : 'default',
                      padding: '4px 6px',
                      borderRadius: 5,
                      background: s.manual ? (ctx.isEffectiveDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)') : 'transparent',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {s.done ? <CheckSquare size={14} color="#22c55e" /> : <Square size={14} color={theme.textMuted} />}
                    <span style={{ flex: 1 }}>{s.label}</span>
                    {!s.manual && <span style={{ fontSize: 10, color: theme.textMuted, background: ctx.isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)', padding: '1px 5px', borderRadius: 4 }}>auto</span>}
                  </div>
                ))}
              </div>
            </div>
          </Panel>
        </div>
      </div>
    </>
  );
};
