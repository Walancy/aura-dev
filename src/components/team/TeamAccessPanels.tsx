import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckSquare, ChevronDown, ChevronRight, History, RefreshCw, Search, ShieldAlert, ShieldCheck, Square, X } from 'lucide-react';
import { relativeTime, type AccessHistoryEntry, type AuditFinding, type MemberStats, type RepoRole, type TeamInsightsRaw } from './teamTypes';
import { Avatar, EmptyState, Panel, Pill, ROLE_COLOR, SEVERITY_COLOR, SmallButton, selectStyle, type TeamUiCtx } from './teamUi';

// ---------------------------------------------------------------------------
// Auditoria
// ---------------------------------------------------------------------------

interface AuditProps {
  ctx: TeamUiCtx;
  findings: AuditFinding[];
  members: MemberStats[];
  canManage: boolean;
  isOrg?: boolean;
  onChangeRole: (login: string, role: RepoRole) => void;
  onRemove: (login: string) => void;
  onCancelInvite: (id: number, login: string) => void;
  onOpenMember: (login: string) => void;
}

export const TeamAuditPanel: React.FC<AuditProps> = ({ ctx, findings, members, canManage, isOrg, onChangeRole, onRemove, onCancelInvite, onOpenMember }) => {
  const { theme, accentColor, isEffectiveDark } = ctx;
  const byLogin = new Map(members.map((m) => [m.login.toLowerCase(), m]));
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set());

  const toggleCollapse = (id: string) => {
    setCollapsedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (findings.length === 0) {
    return (
      <Panel ctx={ctx}>
        <EmptyState ctx={ctx} icon={<ShieldCheck size={26} color="#22c55e" />} text="Nenhum problema de acesso encontrado. Admins, convites e colaboradores externos estão em ordem." />
      </Panel>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      {!canManage && (
        <div style={{ background: isEffectiveDark ? '#141414' : '#ffffff', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#f59e0b', border: 'none', boxShadow: 'none' }}>
          Você não é admin deste repositório: a auditoria é parcial e as correções ficam desabilitadas.
        </div>
      )}
      {findings.map((f) => {
        const isCollapsed = collapsedIds.has(f.id);
        return (
          <Panel
            key={f.id}
            ctx={ctx}
            title={
              <div
                onClick={() => toggleCollapse(f.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                <span style={{ fontSize: 13, fontWeight: 500, color: theme.textPrimary }}>
                  {f.title}
                </span>
                {f.logins.length > 0 && (
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 400,
                      color: theme.textSecondary,
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                      padding: '1px 7px',
                      borderRadius: 4,
                    }}
                  >
                    {f.logins.length} {f.logins.length === 1 ? 'membro' : 'membros'}
                  </span>
                )}
              </div>
            }
            right={
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {f.kind === 'invite' && f.invitationId != null && canManage && (
                  <SmallButton ctx={ctx} danger onClick={() => onCancelInvite(f.invitationId!, f.logins[0])}>
                    Cancelar convite
                  </SmallButton>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleCollapse(f.id);
                  }}
                  title={isCollapsed ? 'Expandir' : 'Contrair'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: 26,
                    height: 26,
                    background: 'transparent',
                    border: 'none',
                    color: theme.textSecondary,
                    cursor: 'pointer',
                    borderRadius: 6,
                    transition: 'background 0.15s ease, color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = theme.controlHoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                </button>
              </div>
            }
          >
            {!isCollapsed && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ fontSize: 11.5, color: theme.textSecondary, lineHeight: 1.45 }}>{f.detail}</div>
                {f.kind !== 'invite' && f.logins.length > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      background: isEffectiveDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.03)',
                      borderRadius: 6,
                      padding: 4,
                    }}
                  >
                    {f.logins.map((login) => {
                      const m = byLogin.get(login.toLowerCase());
                      return (
                        <div
                          key={login}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                            padding: '6px 10px',
                            borderRadius: 6,
                            background: 'transparent',
                            transition: 'background 0.12s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = isEffectiveDark
                              ? 'rgba(255, 255, 255, 0.035)'
                              : 'rgba(0, 0, 0, 0.025)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <div
                            onClick={() => onOpenMember(login)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              flex: 1,
                              minWidth: 0,
                              cursor: 'pointer',
                            }}
                          >
                            <Avatar ctx={ctx} login={login} url={m?.avatarUrl} size={22} />
                            <span style={{ fontSize: 12, fontWeight: 500, color: theme.textPrimary }}>
                              {login}
                            </span>
                            {m && <Pill color={ROLE_COLOR[m.role]}>{m.role}</Pill>}
                            <span style={{ fontSize: 11, color: theme.textMuted }}>
                              última atividade {relativeTime(m?.lastActivityAt)}
                            </span>
                          </div>
                          {canManage && m && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              {f.kind === 'admin-excess' && (
                                <SmallButton ctx={ctx} onClick={() => onChangeRole(login, 'write')}>
                                  Rebaixar para write
                                </SmallButton>
                              )}
                              {(f.kind === 'inactive' || f.kind === 'no-contrib') && m.role !== 'read' && (
                                <SmallButton ctx={ctx} onClick={() => onChangeRole(login, 'read')}>
                                  Rebaixar para read
                                </SmallButton>
                              )}
                              {m.affiliation !== 'organization' && (
                                <SmallButton ctx={ctx} danger onClick={() => onRemove(login)}>
                                  Remover
                                </SmallButton>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </Panel>
        );
      })}
      <div style={{ fontSize: 10.5, color: theme.textMuted, padding: '0 4px' }}>
        A atividade considera commits dos últimos 90 dias, os 100 PRs e 100 issues mais recentes.
        {isOrg && (
          <>
            {' '}
            <span style={{ color: accentColor }}>Membros com acesso pela organização</span> só podem ser removidos pela configuração da org.
          </>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Matriz pessoa × repositório
// ---------------------------------------------------------------------------

interface MatrixProps {
  ctx: TeamUiCtx;
  repoFullName: string;
  repoOptions: string[];
  matrix: Record<string, Record<string, string>> | null;
  loading: boolean;
  onLoad: (repos: string[], force?: boolean) => void;
}

export const TeamMatrixPanel: React.FC<MatrixProps> = ({ ctx, repoFullName, repoOptions, matrix, loading, onLoad }) => {
  const { theme, accentColor, isEffectiveDark } = ctx;
  const [selected, setSelected] = useState<string[]>(() => [repoFullName, ...repoOptions.filter((r) => r !== repoFullName)].slice(0, 8));
  const [roleFilter, setRoleFilter] = useState('all');
  const [isRepoPickerOpen, setIsRepoPickerOpen] = useState(false);
  const [repoSearch, setRepoSearch] = useState('');

  const allRepos = useMemo(() => {
    return [repoFullName, ...repoOptions.filter((r) => r !== repoFullName)];
  }, [repoFullName, repoOptions]);

  const filteredRepos = useMemo(() => {
    if (!repoSearch.trim()) return allRepos;
    const q = repoSearch.toLowerCase().trim();
    return allRepos.filter((r) => r.toLowerCase().includes(q));
  }, [allRepos, repoSearch]);

  useEffect(() => {
    onLoad(selected);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected.join('|')]);

  const people = useMemo(() => {
    if (!matrix) return [];
    const set = new Set<string>();
    selected.forEach((r) => Object.keys(matrix[r] || {}).forEach((l) => l !== '__error' && set.add(l)));
    let list = Array.from(set);
    if (roleFilter !== 'all') list = list.filter((l) => selected.some((r) => matrix[r]?.[l] === roleFilter));
    // Quem tem mais acessos elevados primeiro
    const weight = (l: string) => selected.reduce((acc, r) => acc + (matrix[r]?.[l] === 'admin' ? 3 : matrix[r]?.[l] ? 1 : 0), 0);
    return list.sort((a, b) => weight(b) - weight(a) || a.localeCompare(b));
  }, [matrix, selected, roleFilter]);

  const toggleRepo = (r: string) => setSelected((prev) => (prev.includes(r) ? prev.filter((x) => x !== r) : [...prev, r].slice(0, 15)));

  return (
    <Panel
      ctx={ctx}
      title="Matriz de permissões"
      right={
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {/* Seletor Suspenso de Repositórios */}
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsRepoPickerOpen((prev) => !prev)}
              style={{
                ...selectStyle(ctx),
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 10px',
                height: 28,
                cursor: 'pointer',
                fontSize: 12,
                userSelect: 'none',
              }}
            >
              <span>Repositórios ({selected.length}/15)</span>
              <ChevronDown size={12} color={theme.textSecondary} />
            </button>

            {isRepoPickerOpen && (
              <>
                <div
                  onClick={() => setIsRepoPickerOpen(false)}
                  style={{ position: 'fixed', inset: 0, zIndex: 40 }}
                />
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    zIndex: 45,
                    width: 290,
                    background: isEffectiveDark ? '#141414' : '#ffffff',
                    borderRadius: 8,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    border: 'none',
                    boxShadow: 'none',
                  }}
                >
                  {/* Campo de Busca */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: isEffectiveDark ? '#1c1c1c' : '#f0f0f0',
                      borderRadius: 6,
                      padding: '4px 8px',
                      height: 28,
                      boxSizing: 'border-box',
                    }}
                  >
                    <Search size={12} color={theme.textSecondary} />
                    <input
                      type="text"
                      value={repoSearch}
                      onChange={(e) => setRepoSearch(e.target.value)}
                      placeholder="Buscar repositório..."
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: theme.textPrimary,
                        fontSize: 11.5,
                        width: '100%',
                        fontFamily: 'inherit',
                      }}
                    />
                    {repoSearch && (
                      <X
                        size={11}
                        color={theme.textSecondary}
                        style={{ cursor: 'pointer' }}
                        onClick={() => setRepoSearch('')}
                      />
                    )}
                  </div>

                  {/* Ações Rápidas */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
                    <span style={{ fontSize: 10.5, color: theme.textSecondary }}>
                      {selected.length} de 15 selecionados
                    </span>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setSelected(allRepos.slice(0, 8))}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: accentColor,
                          fontSize: 10.5,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Padrão (8)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelected([repoFullName])}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: theme.textSecondary,
                          fontSize: 10.5,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        Limpar
                      </button>
                    </div>
                  </div>

                  {/* Lista com Checkbox */}
                  <div
                    style={{
                      maxHeight: 220,
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 1,
                    }}
                    className="no-scrollbar"
                  >
                    {filteredRepos.length === 0 ? (
                      <div style={{ fontSize: 11, color: theme.textMuted, textAlign: 'center', padding: '12px 0' }}>
                        Nenhum repositório encontrado
                      </div>
                    ) : (
                      filteredRepos.map((r) => {
                        const isSelected = selected.includes(r);
                        const isCurrent = r === repoFullName;
                        const atLimit = !isSelected && selected.length >= 15;
                        return (
                          <div
                            key={r}
                            onClick={() => {
                              if (!atLimit) toggleRepo(r);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 6,
                              padding: '5px 8px',
                              borderRadius: 5,
                              cursor: atLimit ? 'not-allowed' : 'pointer',
                              opacity: atLimit ? 0.45 : 1,
                              background: isSelected
                                ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)')
                                : 'transparent',
                              transition: 'background 0.1s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!atLimit && !isSelected) {
                                e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)';
                              }
                            }}
                            onMouseLeave={(e) => {
                              if (!atLimit && !isSelected) {
                                e.currentTarget.style.background = 'transparent';
                              }
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                              {isSelected ? (
                                <CheckSquare size={13} color={accentColor} />
                              ) : (
                                <Square size={13} color={theme.textSecondary} />
                              )}
                              <span
                                style={{
                                  fontSize: 11.5,
                                  color: isSelected ? theme.textPrimary : theme.textSecondary,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {r.split('/')[1]}
                              </span>
                            </div>
                            {isCurrent && (
                              <span style={{ fontSize: 9.5, color: accentColor, flexShrink: 0 }}>
                                atual
                              </span>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </>
            )}
          </div>

          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={selectStyle(ctx)}>
            <option value="all">Todos os papéis</option>
            {['admin', 'maintain', 'write', 'triage', 'read'].map((r) => (
              <option key={r} value={r}>
                com {r}
              </option>
            ))}
          </select>
          <SmallButton ctx={ctx} onClick={() => onLoad(selected, true)} disabled={loading}>
            <RefreshCw size={11} className={loading ? 'spin' : ''} /> Atualizar
          </SmallButton>
        </div>
      }
    >
      {loading && !matrix ? (
        <EmptyState ctx={ctx} text="Carregando permissões dos repositórios…" />
      ) : people.length === 0 ? (
        <EmptyState ctx={ctx} text="Sem dados — é preciso ser admin dos repositórios para ver os colaboradores." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11.5, minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: theme.textSecondary, fontWeight: 400, position: 'sticky', left: 0, background: isEffectiveDark ? '#141414' : '#ffffff' }}>Pessoa</th>
                {selected.map((r) => (
                  <th
                    key={r}
                    title={r}
                    style={{
                      padding: '6px 8px',
                      color: r === repoFullName ? accentColor : theme.textSecondary,
                      fontWeight: 400,
                      whiteSpace: 'nowrap',
                      userSelect: 'none',
                    }}
                  >
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <span>{r.split('/')[1]}</span>
                      {matrix?.[r]?.__error && <AlertTriangle size={11} color="#f59e0b" style={{ display: 'inline', verticalAlign: -1 }} />}
                      {r !== repoFullName && selected.length > 1 && (
                        <button
                          type="button"
                          onClick={() => toggleRepo(r)}
                          title="Remover coluna da matriz"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: theme.textSecondary,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: 1,
                            borderRadius: 3,
                            opacity: 0.6,
                            transition: 'opacity 0.1s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.6')}
                        >
                          <X size={10} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {selected.length < 15 && (
                  <th style={{ padding: '6px 8px', textAlign: 'left' }}>
                    <button
                      type="button"
                      onClick={() => setIsRepoPickerOpen(true)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: accentColor,
                        cursor: 'pointer',
                        fontSize: 11,
                        fontWeight: 400,
                        padding: '2px 6px',
                        borderRadius: 4,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                      }}
                    >
                      <span>+ Adicionar</span>
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {people.map((login) => (
                <tr key={login} style={{ borderTop: `1px solid ${theme.tableBorder}` }}>
                  <td style={{ padding: '5px 8px', position: 'sticky', left: 0, background: isEffectiveDark ? '#141414' : '#ffffff' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, color: theme.textPrimary, whiteSpace: 'nowrap' }}>
                      <Avatar ctx={ctx} login={login} size={18} /> {login}
                    </span>
                  </td>
                  {selected.map((r) => {
                    const role = matrix?.[r]?.[login] as RepoRole | undefined;
                    return (
                      <td key={r} style={{ padding: '5px 8px', textAlign: 'center' }}>
                        {matrix?.[r]?.__error ? (
                          <span style={{ color: theme.textMuted }}>?</span>
                        ) : role ? (
                          <Pill color={ROLE_COLOR[role] || theme.textSecondary}>{role}</Pill>
                        ) : (
                          <span style={{ color: theme.textMuted }}>—</span>
                        )}
                      </td>
                    );
                  })}
                  {selected.length < 15 && <td />}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 10.5, color: theme.textSecondary }}>* = sem permissão para listar colaboradores daquele repositório. Máximo de 15 repositórios por vez.</div>
    </Panel>
  );
};

// ---------------------------------------------------------------------------
// Histórico
// ---------------------------------------------------------------------------

const ACTION_LABEL: Record<AccessHistoryEntry['action'], { label: string; color: string }> = {
  add: { label: 'adicionou', color: '#22c55e' },
  remove: { label: 'removeu', color: '#ef4444' },
  role: { label: 'mudou papel de', color: '#f59e0b' },
  'invite-cancel': { label: 'cancelou convite de', color: '#ef4444' },
  'team-add': { label: 'adicionou o time', color: '#22c55e' },
  'team-remove': { label: 'removeu o time', color: '#ef4444' },
  'team-role': { label: 'mudou papel do time', color: '#f59e0b' },
  'team-create': { label: 'criou o time', color: '#22c55e' },
  'review-request': { label: 'pediu review a', color: '#3b82f6' },
  'review-approve': { label: 'aprovou o PR de', color: '#22c55e' },
  assign: { label: 'atribuiu issue a', color: '#3b82f6' },
};

interface HistoryProps {
  ctx: TeamUiCtx;
  history: AccessHistoryEntry[];
  raw: TeamInsightsRaw;
  onClear: () => void;
}

export const TeamHistoryPanel: React.FC<HistoryProps> = ({ ctx, history, raw, onClear }) => {
  const { theme, accentColor } = ctx;
  const [filter, setFilter] = useState<'all' | 'access' | 'work'>('all');
  const events = useMemo(() => {
    const inv = raw.invitations.map((i) => ({
      id: `inv-${i.id}`,
      at: i.createdAt,
      actor: i.inviter || '?',
      action: 'add' as const,
      target: i.login,
      detail: `convite ${i.permission}${i.expired ? ' (expirado)' : ' (pendente)'}`,
    }));
    const all = [...history, ...inv.filter((e) => !history.some((h) => h.action === 'add' && h.target.toLowerCase() === e.target.toLowerCase()))];
    return all
      .filter((e) => (filter === 'all' ? true : filter === 'work' ? e.action === 'assign' || e.action === 'review-request' || e.action === 'review-approve' : e.action !== 'assign' && e.action !== 'review-request' && e.action !== 'review-approve'))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [history, raw.invitations, filter]);

  return (
    <Panel
      ctx={ctx}
      title="Histórico de acesso"
      right={
        <div style={{ display: 'flex', gap: 6 }}>
          <select value={filter} onChange={(e) => setFilter(e.target.value as any)} style={selectStyle(ctx)}>
            <option value="all">Tudo</option>
            <option value="access">Só acesso</option>
            <option value="work">Atribuições e reviews</option>
          </select>
          {history.length > 0 && (
            <SmallButton ctx={ctx} onClick={onClear}>
              Limpar
            </SmallButton>
          )}
        </div>
      }
    >
      {events.length === 0 ? (
        <EmptyState ctx={ctx} text="Nenhuma mudança registrada ainda. Alterações feitas por aqui aparecem nesta lista." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          {events.map((e, idx) => {
            const meta = ACTION_LABEL[e.action];
            return (
              <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderTop: idx === 0 ? 'none' : `1px solid ${theme.tableBorder}`, fontSize: 12 }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: meta.color, flexShrink: 0 }} />
                <Avatar ctx={ctx} login={e.actor} size={18} />
                <span style={{ color: theme.textPrimary, flex: 1, minWidth: 0 }}>
                  <b style={{ fontWeight: 500 }}>@{e.actor}</b> <span style={{ color: theme.textSecondary }}>{meta.label}</span> <b style={{ fontWeight: 500 }}>{e.target}</b>
                  {e.detail && <span style={{ color: theme.textMuted }}> • {e.detail}</span>}
                </span>
                <span title={new Date(e.at).toLocaleString('pt-BR')} style={{ fontSize: 11, color: theme.textMuted, whiteSpace: 'nowrap' }}>
                  {relativeTime(e.at)}
                </span>
              </div>
            );
          })}
        </div>
      )}
      <div style={{ fontSize: 10.5, color: theme.textMuted }}>
        Registra o que foi feito pelo Aura Dev e os convites pendentes. O GitHub só expõe o log completo de auditoria em organizações Enterprise.
      </div>
    </Panel>
  );
};
