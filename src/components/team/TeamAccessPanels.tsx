import React, { useEffect, useMemo, useState } from 'react';
import { Grid3x3, History, RefreshCw, ShieldAlert, ShieldCheck } from 'lucide-react';
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
  const { theme, accentColor } = ctx;
  const byLogin = new Map(members.map((m) => [m.login.toLowerCase(), m]));

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
        <div style={{ background: theme.viewCanvasBg, borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#f59e0b' }}>
          Você não é admin deste repositório: a auditoria é parcial e as correções ficam desabilitadas.
        </div>
      )}
      {findings.map((f) => (
        <Panel
          key={f.id}
          ctx={ctx}
          icon={<ShieldAlert size={14} color={SEVERITY_COLOR[f.severity]} />}
          title={f.title}
          right={
            f.kind === 'invite' && f.invitationId != null && canManage ? (
              <SmallButton ctx={ctx} danger onClick={() => onCancelInvite(f.invitationId!, f.logins[0])}>
                Cancelar convite
              </SmallButton>
            ) : undefined
          }
        >
          <div style={{ fontSize: 11.5, color: theme.textSecondary }}>{f.detail}</div>
          {f.kind !== 'invite' && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {f.logins.map((login) => {
                const m = byLogin.get(login.toLowerCase());
                return (
                  <div key={login} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderTop: `1px solid ${theme.tableBorder}` }}>
                    <span onClick={() => onOpenMember(login)} style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0, cursor: 'pointer' }}>
                      <Avatar ctx={ctx} login={login} url={m?.avatarUrl} size={20} />
                      <span style={{ fontSize: 12, color: theme.textPrimary }}>{login}</span>
                      {m && <Pill color={ROLE_COLOR[m.role]}>{m.role}</Pill>}
                      <span style={{ fontSize: 11, color: theme.textMuted }}>última atividade {relativeTime(m?.lastActivityAt)}</span>
                    </span>
                    {canManage && m && (
                      <>
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
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      ))}
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
  const { theme, accentColor } = ctx;
  const [selected, setSelected] = useState<string[]>(() => [repoFullName, ...repoOptions.filter((r) => r !== repoFullName)].slice(0, 8));
  const [roleFilter, setRoleFilter] = useState('all');

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
      icon={<Grid3x3 size={14} color={accentColor} />}
      title="Matriz de permissões"
      right={
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} style={selectStyle(ctx)}>
            <option value="all">Todos os papéis</option>
            {['admin', 'maintain', 'write', 'triage', 'read'].map((r) => (
              <option key={r} value={r}>
                com {r}
              </option>
            ))}
          </select>
          <SmallButton ctx={ctx} onClick={() => onLoad(selected, true)} disabled={loading}>
            <RefreshCw size={11} /> Atualizar
          </SmallButton>
        </div>
      }
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
        {[repoFullName, ...repoOptions.filter((r) => r !== repoFullName)].slice(0, 40).map((r) => (
          <Pill key={r} color={selected.includes(r) ? accentColor : theme.textMuted} onClick={() => toggleRepo(r)}>
            {r.split('/')[1]}
          </Pill>
        ))}
      </div>
      {loading && !matrix ? (
        <EmptyState ctx={ctx} text="Carregando permissões dos repositórios…" />
      ) : people.length === 0 ? (
        <EmptyState ctx={ctx} text="Sem dados — é preciso ser admin dos repositórios para ver os colaboradores." />
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 11.5, minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ textAlign: 'left', padding: '6px 8px', color: theme.textSecondary, fontWeight: 500, position: 'sticky', left: 0, background: theme.viewCanvasBg }}>Pessoa</th>
                {selected.map((r) => (
                  <th key={r} title={r} style={{ padding: '6px 8px', color: r === repoFullName ? accentColor : theme.textSecondary, fontWeight: 500, whiteSpace: 'nowrap' }}>
                    {r.split('/')[1]}
                    {matrix?.[r]?.__error && <span style={{ color: '#f59e0b' }}> ⚠</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {people.map((login) => (
                <tr key={login} style={{ borderTop: `1px solid ${theme.tableBorder}` }}>
                  <td style={{ padding: '5px 8px', position: 'sticky', left: 0, background: theme.viewCanvasBg }}>
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
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div style={{ fontSize: 10.5, color: theme.textMuted }}>⚠ = sem permissão para listar colaboradores daquele repositório. Máximo de 15 repositórios por vez.</div>
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
      .filter((e) => (filter === 'all' ? true : filter === 'work' ? e.action === 'assign' || e.action === 'review-request' : e.action !== 'assign' && e.action !== 'review-request'))
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
  }, [history, raw.invitations, filter]);

  return (
    <Panel
      ctx={ctx}
      icon={<History size={14} color={accentColor} />}
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
        Registra o que foi feito pelo DevFlow e os convites pendentes. O GitHub só expõe o log completo de auditoria em organizações Enterprise.
      </div>
    </Panel>
  );
};
