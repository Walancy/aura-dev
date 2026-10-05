import React, { useEffect, useMemo, useState } from 'react';
import { AtSign, CalendarDays, CheckSquare, CircleDot, ExternalLink, Eye, GitPullRequest, GraduationCap, Square, Tag, UserPlus, X } from 'lucide-react';
import type { ProjectIssue } from '../ProjectsSchedulerView';
import { formatHours, relativeTime, type AvailabilityStatus, type DailySnapshot, type MemberStats, type PersonLocalData, type RepoTeamLocalData, type TeamInsightsRaw } from './teamTypes';
import { Avatar, LOAD_META, Panel, Pill, ROLE_COLOR, SmallButton, inputStyle, openUrl, rowHover, selectStyle, type TeamUiCtx } from './teamUi';
import { computeOnboarding, localTimeFor } from './TeamMembersPanel';
import type { TeamWorkspaceState } from './useTeamWorkspace';

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

export const TeamMemberDrawer: React.FC<Props> = ({ ctx, member: m, raw, issues, person, daily, repoData, initialAction, initialPr, ws, onClose }) => {
  const { theme, accentColor } = ctx;
  const key = m.login.toLowerCase();
  const [actionTab, setActionTab] = useState<'assign' | 'review' | 'mention'>(initialAction || 'assign');
  const [assignIssue, setAssignIssue] = useState('');
  const [reviewPr, setReviewPr] = useState(initialPr ? String(initialPr) : '');
  const [mentionIssue, setMentionIssue] = useState('');
  const [mentionText, setMentionText] = useState('');
  const [skillInput, setSkillInput] = useState('');

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
    ws.setPerson(m.login, { skills });
    setSkillInput('');
  };

  const busy = (k: string) => ws.pendingAction === k;

  const label = { fontSize: 11, color: theme.textSecondary, marginBottom: 3, display: 'block' } as const;

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: theme.modalOverlay, zIndex: 900 }} />
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(480px, 100vw)',
          background: theme.modalBg,
          boxShadow: theme.modalShadow,
          zIndex: 901,
          display: 'flex',
          flexDirection: 'column',
          fontFamily: "'Poppins', -apple-system, sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${theme.tableBorder}` }}>
          <Avatar ctx={ctx} login={m.login} url={m.avatarUrl} size={42} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 15, fontWeight: 600, color: theme.textPrimary }}>{m.login}</span>
              <Pill color={ROLE_COLOR[m.role]}>{m.role}</Pill>
              <Pill color={meta.color}>{meta.label}</Pill>
            </div>
            <div style={{ fontSize: 11.5, color: theme.textSecondary }}>
              {m.teams.length ? m.teams.join(' • ') : m.affiliation === 'outside' ? 'Colaborador externo' : m.affiliation === 'organization' ? 'Acesso pela organização' : 'Acesso direto'}
              {localTimeFor(person.timezone) && ` • ${localTimeFor(person.timezone)} local`}
            </div>
          </div>
          <SmallButton ctx={ctx} onClick={() => openUrl(m.htmlUrl || `https://github.com/${m.login}`)} title="Abrir perfil no GitHub">
            <ExternalLink size={12} />
          </SmallButton>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: theme.textSecondary, cursor: 'pointer' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Números */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 4 }}>
            {[
              { v: m.commits90d, l: 'commits 90d' },
              { v: m.closedLast14d, l: 'fechadas 14d' },
              { v: relativeTime(m.lastCommitAt), l: 'último commit' },
              { v: m.sprintIssues, l: 'na sprint' },
            ].map((s) => (
              <div key={s.l} style={{ background: theme.viewCanvasBg, borderRadius: 6, padding: '8px 4px', textAlign: 'center' }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>{s.v}</div>
                <div style={{ fontSize: 10, color: theme.textMuted }}>{s.l}</div>
              </div>
            ))}
          </div>

          {/* Ações rápidas */}
          <Panel ctx={ctx}>
            <div style={{ display: 'flex', gap: 4 }}>
              {(
                [
                  ['assign', 'Atribuir issue', UserPlus],
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
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    fontSize: 11.5,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    background: actionTab === id ? (ctx.isEffectiveDark ? '#242424' : '#e2e8f0') : 'transparent',
                    color: actionTab === id ? theme.textPrimary : theme.textSecondary,
                  }}
                >
                  <Icon size={12} color={actionTab === id ? accentColor : theme.textSecondary} /> {text}
                </button>
              ))}
            </div>
            {actionTab === 'assign' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={assignIssue} onChange={(e) => setAssignIssue(e.target.value)} style={{ ...selectStyle(ctx), flex: 1 }}>
                  <option value="">Selecione uma issue aberta…</option>
                  {assignable.map((i) => (
                    <option key={i.id} value={i.githubNumber}>
                      {i.id} {i.title.slice(0, 60)} {i.assignees.length === 0 ? '• sem responsável' : ''}
                    </option>
                  ))}
                </select>
                <SmallButton ctx={ctx} primary disabled={!assignIssue || busy(`assign-${assignIssue}`)} onClick={async () => { if (await ws.actions.assignIssue(Number(assignIssue), m.login)) setAssignIssue(''); }}>
                  Atribuir
                </SmallButton>
              </div>
            )}
            {actionTab === 'review' && (
              <div style={{ display: 'flex', gap: 6 }}>
                <select value={reviewPr} onChange={(e) => setReviewPr(e.target.value)} style={{ ...selectStyle(ctx), flex: 1 }}>
                  <option value="">Selecione um PR aberto…</option>
                  {reviewable.map((p) => (
                    <option key={p.number} value={p.number}>
                      #{p.number} {p.title.slice(0, 60)} (@{p.author})
                    </option>
                  ))}
                </select>
                <SmallButton ctx={ctx} primary disabled={!reviewPr || busy(`review-${reviewPr}-${m.login}`)} onClick={async () => { if (await ws.actions.requestReview(Number(reviewPr), m.login)) setReviewPr(''); }}>
                  Solicitar
                </SmallButton>
              </div>
            )}
            {actionTab === 'mention' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <select value={mentionIssue} onChange={(e) => setMentionIssue(e.target.value)} style={selectStyle(ctx)}>
                  <option value="">Em qual issue?</option>
                  {openIssues.map((i) => (
                    <option key={i.id} value={i.githubNumber}>
                      {i.id} {i.title.slice(0, 70)}
                    </option>
                  ))}
                </select>
                <textarea
                  value={mentionText}
                  onChange={(e) => setMentionText(e.target.value)}
                  placeholder={`Mensagem para @${m.login}…`}
                  rows={3}
                  style={{ ...inputStyle(ctx), height: 'auto', padding: 8, resize: 'vertical' }}
                />
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <SmallButton
                    ctx={ctx}
                    primary
                    disabled={!mentionIssue || !mentionText.trim() || busy(`mention-${mentionIssue}`)}
                    onClick={async () => {
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              <div>
                <span style={label}>Status</span>
                <select
                  value={av.status}
                  onChange={(e) => ws.setPerson(m.login, { availability: { ...av, status: e.target.value as AvailabilityStatus } })}
                  style={{ ...selectStyle(ctx), width: '100%' }}
                >
                  <option value="disponivel">Disponível</option>
                  <option value="meio-periodo">Meio período</option>
                  <option value="folga">Folga</option>
                  <option value="ferias">Férias</option>
                  <option value="ausente">Ausente</option>
                </select>
              </div>
              <div>
                <span style={label}>Fuso horário</span>
                <select value={person.timezone || ''} onChange={(e) => ws.setPerson(m.login, { timezone: e.target.value || undefined })} style={{ ...selectStyle(ctx), width: '100%' }}>
                  <option value="">Não definido</option>
                  {tzList.map((tz: string) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
              {av.status !== 'disponivel' && (
                <>
                  <div>
                    <span style={label}>De</span>
                    <input type="date" value={av.from || ''} onChange={(e) => ws.setPerson(m.login, { availability: { ...av, from: e.target.value || undefined } })} style={inputStyle(ctx)} />
                  </div>
                  <div>
                    <span style={label}>Até</span>
                    <input type="date" value={av.to || ''} onChange={(e) => ws.setPerson(m.login, { availability: { ...av, to: e.target.value || undefined } })} style={inputStyle(ctx)} />
                  </div>
                  <div style={{ gridColumn: '1 / -1' }}>
                    <input
                      value={av.note || ''}
                      onChange={(e) => ws.setPerson(m.login, { availability: { ...av, note: e.target.value } })}
                      placeholder="Observação (ex: backup: @fulano)"
                      style={inputStyle(ctx)}
                    />
                  </div>
                </>
              )}
            </div>
          </Panel>

          {/* Skills */}
          <Panel ctx={ctx} icon={<Tag size={13} color={accentColor} />} title="Habilidades">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(person.skills || []).map((s) => (
                <Pill key={s} color={accentColor} title="Clique para remover" onClick={() => ws.setPerson(m.login, { skills: (person.skills || []).filter((x) => x !== s) })}>
                  {s} ×
                </Pill>
              ))}
              {Object.entries(m.tags)
                .sort((a, b) => b[1] - a[1])
                .slice(0, 5)
                .filter(([t]) => !(person.skills || []).some((s) => s.toLowerCase() === t))
                .map(([t, n]) => (
                  <Pill key={t} color={theme.textSecondary} title="Sugerido pelo histórico de issues — clique para adicionar" onClick={() => ws.setPerson(m.login, { skills: [...(person.skills || []), t] })}>
                    + {t} ({n})
                  </Pill>
                ))}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addSkill()}
                placeholder="Flutter, React, backend, QA…"
                style={inputStyle(ctx)}
              />
              <SmallButton ctx={ctx} onClick={addSkill}>
                Adicionar
              </SmallButton>
            </div>
          </Panel>

          {/* Daily */}
          {daily && (
            <Panel ctx={ctx} title="Daily">
              <div style={{ fontSize: 11.5, color: theme.textSecondary, display: 'flex', flexDirection: 'column', gap: 3 }}>
                {daily.yesterday.map((t, i) => (
                  <span key={`y${i}`}>✓ {t}</span>
                ))}
                {daily.today.map((t, i) => (
                  <span key={`t${i}`} style={{ color: theme.textPrimary }}>→ {t}</span>
                ))}
                {daily.blockers.map((b, i) => (
                  <span key={`b${i}`} style={{ color: '#ef4444' }}>⛔ {b.title}</span>
                ))}
              </div>
            </Panel>
          )}

          {/* Issues */}
          <Panel ctx={ctx} icon={<CircleDot size={13} color={accentColor} />} title={`Issues abertas (${m.openAssigned.length})`}>
            {m.openAssigned.length === 0 ? (
              <span style={{ fontSize: 11.5, color: theme.textMuted }}>Nenhuma issue atribuída.</span>
            ) : (
              m.openAssigned.slice(0, 15).map((i) => (
                <div key={i.id} {...rowHover(ctx)} onClick={() => openUrl(i.htmlUrl)} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, padding: '3px 4px', borderRadius: 5, cursor: 'pointer' }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', background: i.priorityColor, flexShrink: 0 }} />
                  <span style={{ color: theme.textMuted }}>{i.id}</span>
                  <span style={{ color: theme.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.title}</span>
                  <Pill color={i.status === 'Em Progresso' ? '#3b82f6' : theme.textSecondary}>{i.status}</Pill>
                </div>
              ))
            )}
          </Panel>

          {/* PRs e reviews */}
          <Panel ctx={ctx} icon={<GitPullRequest size={13} color={accentColor} />} title="Pull requests">
            {m.openPulls.length === 0 && m.reviewQueue.length === 0 && <span style={{ fontSize: 11.5, color: theme.textMuted }}>Nada pendente.</span>}
            {m.openPulls.map((p) => (
              <div key={`o${p.number}`} {...rowHover(ctx)} onClick={() => openUrl(p.url)} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, padding: '3px 4px', borderRadius: 5, cursor: 'pointer' }}>
                <Pill color="#22c55e">autor</Pill>
                <span style={{ color: theme.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  #{p.number} {p.title}
                </span>
                {p.draft && <Pill color={theme.textSecondary}>draft</Pill>}
                <span style={{ fontSize: 10.5, color: theme.textMuted }}>{relativeTime(p.createdAt)}</span>
              </div>
            ))}
            {m.reviewQueue.map(({ pull, waitingHours }) => (
              <div key={`r${pull.number}`} {...rowHover(ctx)} onClick={() => openUrl(pull.url)} style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, padding: '3px 4px', borderRadius: 5, cursor: 'pointer' }}>
                <Pill color="#f59e0b">review</Pill>
                <span style={{ color: theme.textPrimary, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  #{pull.number} {pull.title}
                </span>
                <Pill color={waitingHours > 48 ? '#ef4444' : theme.textSecondary}>{formatHours(waitingHours)}</Pill>
              </div>
            ))}
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
                  onClick={() =>
                    ws.updateRepoData((prev) => {
                      const { [key]: _, ...rest } = prev.onboarding;
                      return { ...prev, onboarding: rest };
                    })
                  }
                >
                  Parar de acompanhar
                </SmallButton>
              ) : undefined
            }
          >
            {ob.steps.map((s) => (
              <div
                key={s.id}
                onClick={() => s.manual && toggleManual(s.id)}
                style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: s.done ? theme.textPrimary : theme.textSecondary, cursor: s.manual ? 'pointer' : 'default' }}
              >
                {s.done ? <CheckSquare size={14} color="#22c55e" /> : <Square size={14} color={theme.textMuted} />}
                <span>{s.label}</span>
                {!s.manual && <span style={{ fontSize: 10, color: theme.textMuted }}>auto</span>}
              </div>
            ))}
          </Panel>
        </div>
      </div>
    </>
  );
};
