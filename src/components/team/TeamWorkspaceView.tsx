import React, { useEffect, useMemo, useState } from 'react';
import { Grid3x3, History, KeyRound, LayoutDashboard, Layers, Loader2, RefreshCw, ShieldAlert, Sparkles, Users } from 'lucide-react';
import type { ProjectIssue, SprintOption } from '../ProjectsSchedulerView';
import { ManageAccessView, type AccessItem } from './ManageAccessView';
import { TeamOverviewPanel } from './TeamOverviewPanel';
import { TeamMembersPanel } from './TeamMembersPanel';
import { TeamMemberDrawer } from './TeamMemberDrawer';
import { TeamTeamsPanel } from './TeamTeamsPanel';
import { TeamAuditPanel, TeamHistoryPanel, TeamMatrixPanel } from './TeamAccessPanels';
import { TeamAiPanel, type TeamAiProvider } from './TeamAiPanel';
import {
  computeAlerts,
  computeAssignmentSuggestions,
  computeAudit,
  computeMemberStats,
  computeTeamMetrics,
  findActiveSprint,
  loadDailyByPerson,
  relativeTime,
  type RepoRole,
  type TeamRaw,
} from './teamTypes';
import { EmptyState, SmallButton, type TeamUiCtx } from './teamUi';
import { useTeamWorkspace } from './useTeamWorkspace';
import { getProjectSettings, subscribeProjectSettings } from '../settings/projectSettingsStore';

type SectionId = 'overview' | 'membros' | 'times' | 'acesso' | 'auditoria' | 'matriz' | 'historico' | 'ia';

export interface TeamConfirmRequest {
  title: string;
  message: string;
  itemDescription?: string;
  confirmLabel?: string;
  onConfirm: () => Promise<void>;
}

interface Props {
  projectName?: string;
  repoFullName?: string;
  issues: ProjectIssue[];
  sprints: SprintOption[];
  sprintMatcher: (issue: ProjectIssue, sprint: SprintOption) => boolean;
  currentUserLogin?: string;
  orgRepoNames: string[];
  aiProvider: TeamAiProvider;
  theme: any;
  accentColor: string;
  accentContrastText: string;
  isEffectiveDark: boolean;
  showToast: (msg: string) => void;
  requestConfirm: (req: TeamConfirmRequest) => void;
  onIssuesChanged?: () => void;
}

export const TeamWorkspaceView: React.FC<Props> = ({
  projectName,
  repoFullName,
  issues,
  sprints,
  sprintMatcher,
  currentUserLogin,
  orgRepoNames,
  aiProvider,
  theme,
  accentColor,
  accentContrastText,
  isEffectiveDark,
  showToast,
  requestConfirm,
  onIssuesChanged,
}) => {
  const ctx: TeamUiCtx = { theme, accentColor, accentContrastText, isEffectiveDark };
  const ws = useTeamWorkspace({ repoFullName, currentUserLogin, showToast, onIssuesChanged });
  const { raw } = ws;
  const [section, setSection] = useState<SectionId>('overview');
  const [drawer, setDrawer] = useState<{ login: string; action?: 'assign' | 'review' | 'mention'; prNumber?: number } | null>(null);

  // Configurações do projeto (limites de alerta, capacidade, regras de IA)
  const [projectSettings, setProjectSettings] = useState(() => getProjectSettings(repoFullName));
  useEffect(() => {
    setProjectSettings(getProjectSettings(repoFullName));
    const unsubscribe = subscribeProjectSettings((r) => {
      if (r.toLowerCase() === (repoFullName || '').toLowerCase()) setProjectSettings(getProjectSettings(repoFullName));
    });
    return () => {
      unsubscribe();
    };
  }, [repoFullName]);
  const thresholds = useMemo(() => ({ ...projectSettings.alerts, capacityPerPerson: projectSettings.estimates.capacityPerPerson }), [projectSettings]);
  const aiRules = projectSettings.ai;

  const activeSprint = useMemo(() => findActiveSprint(sprints), [sprints]);
  const members = useMemo(() => (raw ? computeMemberStats(raw, issues, activeSprint, sprintMatcher, thresholds) : []), [raw, issues, activeSprint, sprintMatcher, thresholds]);
  const metrics = useMemo(() => (raw ? computeTeamMetrics(null, raw, issues, sprints, sprintMatcher) : null), [raw, issues, sprints, sprintMatcher]);
  // Relê a daily a cada render de dados (é localStorage, barato) para refletir o que foi preenchido na outra tela
  const daily = useMemo(() => (repoFullName ? loadDailyByPerson(repoFullName, currentUserLogin) : {}), [repoFullName, currentUserLogin, raw]);
  const alerts = useMemo(() => (raw ? computeAlerts(members, raw, issues, daily, ws.people, thresholds) : []), [members, raw, issues, daily, ws.people, thresholds]);
  const audit = useMemo(() => (raw ? computeAudit(members, raw, thresholds) : []), [members, raw, thresholds]);
  const suggestions = useMemo(() => (aiRules.automations.assigneeSuggestions ? computeAssignmentSuggestions(members, issues, ws.people) : []), [members, issues, ws.people, aiRules.automations.assigneeSuggestions]);
  const canManage = Boolean(raw?.canAdmin);

  const accessItems: AccessItem[] = useMemo(() => {
    if (!raw) return [];
    const users: AccessItem[] = raw.collaborators.map((c) => ({
      id: `user-${c.login}`,
      type: 'user',
      name: c.login,
      login: c.login,
      handle: c.affiliation === 'outside' ? `${c.login} • colaborador externo` : c.affiliation === 'organization' ? `${c.login} • via organização` : c.login,
      avatarUrl: c.avatarUrl,
      role: c.roleName,
      accessType: c.affiliation === 'organization' ? 'organization' : 'direct',
    }));
    const teams: AccessItem[] = raw.teams.map((t) => ({
      id: `team-${t.slug}`,
      type: 'team',
      name: t.name,
      login: t.slug,
      handle: `@${ws.owner}/${t.slug} • ${t.members.length} membro(s)`,
      memberCount: t.members.length,
      role: (t.permission as RepoRole) || 'read',
      accessType: 'direct',
    }));
    return [...teams, ...users];
  }, [raw, ws.owner]);

  const confirmRemovePerson = (login: string) =>
    requestConfirm({
      title: 'Remover acesso',
      message: `Revogar o acesso de @${login} ao repositório ${repoFullName}?`,
      itemDescription: 'A pessoa perde o acesso imediatamente no GitHub.',
      confirmLabel: 'Remover acesso',
      onConfirm: async () => {
        await ws.actions.removePerson(login);
      },
    });

  const confirmRemoveTeam = (team: Pick<TeamRaw, 'slug' | 'name'>) =>
    requestConfirm({
      title: 'Remover time',
      message: `Remover o time "${team.name}" do repositório ${repoFullName}?`,
      itemDescription: 'Os membros perdem o acesso concedido por este time (acessos diretos continuam).',
      confirmLabel: 'Remover time',
      onConfirm: async () => {
        await ws.actions.removeTeam(team.slug);
      },
    });

  const confirmDowngrade = (login: string, role: RepoRole) =>
    requestConfirm({
      title: 'Alterar permissão',
      message: `Alterar a permissão de @${login} para "${role}"?`,
      confirmLabel: 'Alterar',
      onConfirm: async () => {
        await ws.actions.changeRole(login, role);
      },
    });

  const sections: Array<{ group: string; items: Array<{ id: SectionId; label: string; icon: any; count?: number; tone?: string }> }> = [
    {
      group: 'Time',
      items: [
        { id: 'overview', label: 'Visão geral', icon: LayoutDashboard },
        { id: 'membros', label: 'Membros', icon: Users, count: members.length },
        { id: 'times', label: 'Times', icon: Layers, count: raw?.teams.length },
      ],
    },
    {
      group: 'Acesso',
      items: [
        { id: 'acesso', label: 'Gerenciar acesso', icon: KeyRound, count: accessItems.length },
        { id: 'auditoria', label: 'Auditoria', icon: ShieldAlert, count: audit.length || undefined, tone: audit.some((a) => a.severity === 'critical') ? '#ef4444' : audit.length ? '#f59e0b' : undefined },
        { id: 'matriz', label: 'Matriz de permissões', icon: Grid3x3 },
        { id: 'historico', label: 'Histórico', icon: History, count: ws.repoData.history.length || undefined },
      ],
    },
    {
      group: 'Inteligência',
      items: [{ id: 'ia', label: 'Insights com IA', icon: Sparkles, count: alerts.length || undefined, tone: alerts.some((a) => a.severity === 'critical') ? '#ef4444' : undefined }],
    },
  ];

  const drawerMember = drawer ? members.find((m) => m.login.toLowerCase() === drawer.login.toLowerCase()) : undefined;
  const openMember = (login: string, action?: 'assign' | 'review' | 'mention', prNumber?: number) => {
    if (members.some((m) => m.login.toLowerCase() === login.toLowerCase())) setDrawer({ login, action, prNumber });
    else window.electronAPI?.shell?.openExternal?.(`https://github.com/${login}`);
  };

  const renderSection = () => {
    if (!raw || !metrics || !repoFullName) {
      return (
        <div style={{ background: theme.viewCanvasBg, borderRadius: 8, flex: 1 }}>
          {ws.loading || !ws.error ? (
            <EmptyState ctx={ctx} icon={<Loader2 size={22} color={accentColor} style={{ animation: 'spin 1s linear infinite' }} />} text="Carregando pessoas, times, PRs e commits do GitHub…" />
          ) : (
            <EmptyState
              ctx={ctx}
              icon={<ShieldAlert size={22} color="#ef4444" />}
              text={
                <>
                  {ws.error}
                  <div style={{ marginTop: 8 }}>
                    <SmallButton ctx={ctx} onClick={() => ws.refresh(true)}>
                      Tentar novamente
                    </SmallButton>
                  </div>
                </>
              }
            />
          )}
        </div>
      );
    }
    switch (section) {
      case 'overview':
        return (
          <TeamOverviewPanel
            ctx={ctx}
            raw={raw}
            members={members}
            metrics={metrics}
            issues={issues}
            activeSprint={activeSprint}
            alerts={alerts}
            daily={daily}
            people={ws.people}
            onOpenMember={(l) => openMember(l)}
            onGoTo={(s) => setSection(s)}
            onRequestReview={(prNumber) => {
              const pr = raw.openPulls.find((p) => p.number === prNumber);
              const candidate = members
                .filter((m) => m.login.toLowerCase() !== pr?.author?.toLowerCase() && m.role !== 'read')
                .sort((a, b) => a.reviewQueue.length - b.reviewQueue.length || a.loadScore - b.loadScore)[0];
              if (candidate) openMember(candidate.login, 'review', prNumber);
            }}
          />
        );
      case 'membros':
        return (
          <TeamMembersPanel
            ctx={ctx}
            raw={raw}
            members={members}
            people={ws.people}
            daily={daily}
            repoData={ws.repoData}
            onOpenMember={(l, a) => openMember(l, a)}
            onStartOnboarding={(login) =>
              ws.updateRepoData((prev) => ({ ...prev, onboarding: { ...prev.onboarding, [login.toLowerCase()]: { startedAt: new Date().toISOString(), manualDone: [] } } }))
            }
          />
        );
      case 'times':
        return (
          <TeamTeamsPanel
            ctx={ctx}
            raw={raw}
            owner={ws.owner}
            repoFullName={repoFullName}
            members={members}
            issues={issues}
            sprints={sprints}
            sprintMatcher={sprintMatcher}
            canManage={canManage}
            onOpenMember={(l) => openMember(l)}
            onChangeTeamRole={(slug, role) => ws.actions.changeTeamRole(slug, role)}
            onRemoveTeam={confirmRemoveTeam}
          />
        );
      case 'acesso':
        return (
          <ManageAccessView
            projectName={projectName}
            repoFullName={repoFullName}
            items={accessItems}
            orgTeams={ws.orgTeams.filter((t) => !raw.teams.some((rt) => rt.slug === t.slug))}
            isOrg={raw.isOrg}
            canManage={canManage}
            isLoading={ws.loading}
            theme={theme}
            accentColor={accentColor}
            accentContrastText={accentContrastText}
            isEffectiveDark={isEffectiveDark}
            onChangeRole={(item, role) => (item.type === 'team' ? ws.actions.changeTeamRole(item.login, role) : ws.actions.changeRole(item.login, role))}
            onAddPerson={(login, role) => ws.actions.addPerson(login, role)}
            onAddTeam={(slug, role) => ws.actions.addTeam(slug, role)}
            onCreateTeam={(name, desc) => ws.actions.createTeam(name, desc)}
            onRequestDeleteCollaborator={(item) => (item.type === 'team' ? confirmRemoveTeam({ slug: item.login, name: item.name }) : confirmRemovePerson(item.login))}
            onRequestBulkDelete={(items) =>
              requestConfirm({
                title: 'Remover acessos em massa',
                message: `Revogar o acesso de ${items.length} ${items.length === 1 ? 'item' : 'itens'} ao repositório ${repoFullName}?`,
                itemDescription: `${items.map((i) => i.name).slice(0, 4).join(', ')}${items.length > 4 ? ` e mais ${items.length - 4}` : ''}.`,
                confirmLabel: 'Remover acessos',
                onConfirm: async () => {
                  for (const it of items) {
                    if (it.type === 'team') await ws.actions.removeTeam(it.login);
                    else await ws.actions.removePerson(it.login);
                  }
                },
              })
            }
            showToast={showToast}
          />
        );
      case 'auditoria':
        return (
          <TeamAuditPanel
            ctx={ctx}
            findings={audit}
            members={members}
            canManage={canManage}
            isOrg={raw.isOrg}
            onChangeRole={confirmDowngrade}
            onRemove={confirmRemovePerson}
            onCancelInvite={(id, login) =>
              requestConfirm({
                title: 'Cancelar convite',
                message: `Cancelar o convite de @${login}?`,
                confirmLabel: 'Cancelar convite',
                onConfirm: async () => {
                  await ws.actions.cancelInvite(id, login);
                },
              })
            }
            onOpenMember={(l) => openMember(l)}
          />
        );
      case 'matriz':
        return <TeamMatrixPanel ctx={ctx} repoFullName={repoFullName} repoOptions={orgRepoNames} matrix={ws.matrix} loading={ws.matrixLoading} onLoad={ws.loadMatrix} />;
      case 'historico':
        return <TeamHistoryPanel ctx={ctx} history={ws.repoData.history} raw={raw} onClear={() => ws.updateRepoData((prev) => ({ ...prev, history: [] }))} />;
      case 'ia':
        return (
          <TeamAiPanel
            ctx={ctx}
            repoFullName={repoFullName}
            raw={raw}
            members={members}
            issues={issues}
            metrics={metrics}
            alerts={alerts}
            daily={daily}
            suggestions={suggestions}
            repoData={ws.repoData}
            provider={aiProvider}
            canAssign={aiRules.permission === 'act' && (canManage || members.some((m) => m.login.toLowerCase() === currentUserLogin?.toLowerCase() && m.role !== 'read'))}
            suggestionsEnabled={aiRules.automations.assigneeSuggestions}
            autoWeekly={aiRules.automations.weeklySummary ? { weekday: aiRules.automations.weeklySummaryWeekday } : undefined}
            pendingAction={ws.pendingAction}
            onSaveSummary={(aiSummary) => ws.updateRepoData((prev) => ({ ...prev, aiSummary }))}
            onAssign={(n, login) => ws.actions.assignIssue(n, login)}
            onOpenMember={(l) => openMember(l)}
            showToast={showToast}
          />
        );
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'stretch', gap: 5, width: '100%', minHeight: 360, boxSizing: 'border-box', fontFamily: "'Poppins', -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <div
        style={{
          width: 'clamp(160px, 20%, 220px)',
          minWidth: 160,
          background: theme.viewCanvasBg,
          borderRadius: 8,
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          boxSizing: 'border-box',
          flexShrink: 0,
        }}
      >
        {sections.map((g) => (
          <React.Fragment key={g.group}>
            <div style={{ fontSize: 10, fontWeight: 600, color: theme.textMuted, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '8px 10px 4px' }}>{g.group}</div>
            {g.items.map((tab) => {
              const isActive = section === tab.id;
              const Icon = tab.icon;
              return (
                <div
                  key={tab.id}
                  onClick={() => setSection(tab.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isActive ? (isEffectiveDark ? '#242424' : '#e2e8f0') : 'transparent',
                    color: isActive ? theme.textPrimary : theme.textSecondary,
                    fontWeight: isActive ? 500 : 400,
                    fontSize: 12.5,
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <Icon size={14} color={isActive ? accentColor : theme.textSecondary} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.label}</span>
                  </div>
                  {tab.count != null && (
                    <span style={{ fontSize: 11, fontWeight: 500, color: tab.tone || (isActive ? accentColor : theme.textSecondary), padding: '1px 6px', borderRadius: 10, background: isActive ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.06)') : 'transparent', flexShrink: 0 }}>
                      {tab.count}
                    </span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
        <div style={{ flex: 1 }} />
        <div style={{ padding: '8px 10px 2px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 10.5, color: theme.textMuted }}>{ws.loading ? 'Sincronizando…' : ws.fetchedAt ? `Atualizado ${relativeTime(new Date(ws.fetchedAt).toISOString())}` : ''}</span>
          <SmallButton ctx={ctx} onClick={() => ws.refresh(true)} disabled={ws.loading}>
            <RefreshCw size={11} style={ws.loading ? { animation: 'spin 1s linear infinite' } : undefined} /> Atualizar
          </SmallButton>
        </div>
      </div>

      {/* Conteúdo */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {raw && raw.errors.length > 0 && (
          <div style={{ background: theme.viewCanvasBg, borderRadius: 8, padding: '6px 12px', fontSize: 11.5, color: '#f59e0b' }}>{raw.errors.join(' ')}</div>
        )}
        {renderSection()}
      </div>

      {drawer && drawerMember && raw && (
        <TeamMemberDrawer
          ctx={ctx}
          member={drawerMember}
          raw={raw}
          issues={issues}
          person={ws.people[drawerMember.login.toLowerCase()] || {}}
          daily={daily[drawerMember.login.toLowerCase()]}
          repoData={ws.repoData}
          initialAction={drawer.action}
          initialPr={drawer.prNumber}
          ws={ws}
          onClose={() => setDrawer(null)}
        />
      )}
    </div>
  );
};
