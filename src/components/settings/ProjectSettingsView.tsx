import React, { useCallback, useEffect, useState } from 'react';
import { Bell, Bot, FileStack, GitBranch, KeyRound, Plug, Settings, ShieldAlert, Tags, TerminalSquare, Workflow } from 'lucide-react';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';
import { SmallButton, type TeamUiCtx } from '../team/teamUi';
import { getProjectSettings, saveProjectSettings, subscribeProjectSettings, type ProjectSettings } from './projectSettingsStore';
import { ghSettings, type ConfirmRequest, type SectionProps } from './settingsUi';
import { GeneralSection } from './sections/GeneralSection';
import { BranchesSection } from './sections/BranchesSection';
import { WorkflowSection } from './sections/WorkflowSection';
import { LabelsSection } from './sections/LabelsSection';
import { TemplatesSection } from './sections/TemplatesSection';
import { AiSection } from './sections/AiSection';
import { AlertsSection } from './sections/AlertsSection';
import { LocalEnvSection } from './sections/LocalEnvSection';
import { IntegrationsSection, type CustomLink } from './sections/IntegrationsSection';
import { DangerSection } from './sections/DangerSection';

export interface ProjectSettingsViewProps {
  selectedProject?: any;
  selectedRepoRaw?: any;
  repoFullName?: string;
  workspacePath?: string;
  theme: any;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  onRefreshRepoDetails?: () => void;
  onDataConfigChanged?: () => void;
  onRepoGone?: () => void;
  customLinks?: CustomLink[];
  onSaveCustomLinks?: (links: CustomLink[]) => void;
  showToast: (msg: string) => void;
}

type SectionId = 'geral' | 'branches' | 'fluxo' | 'labels' | 'templates' | 'ia' | 'alertas' | 'local' | 'integracoes' | 'perigo';

const SECTIONS: Array<{ group: string; items: Array<{ id: SectionId; label: string; icon: any }> }> = [
  {
    group: 'Repositório',
    items: [
      { id: 'geral', label: 'Geral', icon: Settings },
      { id: 'branches', label: 'Branches e merge', icon: GitBranch },
      { id: 'labels', label: 'Labels', icon: Tags },
      { id: 'templates', label: 'Templates', icon: FileStack },
    ],
  },
  {
    group: 'DevFlow',
    items: [
      { id: 'fluxo', label: 'Fluxo de trabalho', icon: Workflow },
      { id: 'ia', label: 'IA', icon: Bot },
      { id: 'alertas', label: 'Alertas e notificações', icon: Bell },
      { id: 'local', label: 'Ambiente local', icon: TerminalSquare },
      { id: 'integracoes', label: 'Integrações', icon: Plug },
    ],
  },
  { group: 'Avançado', items: [{ id: 'perigo', label: 'Zona de perigo', icon: ShieldAlert }] },
];

export const ProjectSettingsView: React.FC<ProjectSettingsViewProps> = ({
  selectedProject,
  selectedRepoRaw,
  repoFullName: repoFullNameProp,
  theme,
  isEffectiveDark,
  accentColor,
  accentContrastText,
  onRefreshRepoDetails,
  onDataConfigChanged,
  onRepoGone,
  customLinks = [],
  onSaveCustomLinks,
  showToast,
}) => {
  const ctx: TeamUiCtx = { theme, accentColor, accentContrastText, isEffectiveDark };
  const repoFullName: string = selectedRepoRaw?.full_name || repoFullNameProp || selectedProject?.fullName || '';
  const [owner, repo] = repoFullName.split('/');
  const [section, setSection] = useState<SectionId>('geral');
  const [settings, setSettings] = useState<ProjectSettings>(() => getProjectSettings(repoFullName));
  const [repoInfo, setRepoInfo] = useState<any | null>(null);
  const [repoError, setRepoError] = useState<string | null>(null);
  const [branches, setBranches] = useState<Array<{ name: string; protected: boolean }>>([]);
  const [confirmState, setConfirmState] = useState<(ConfirmRequest & { isOpen: boolean; busy?: boolean }) | null>(null);

  useEffect(() => {
    setSettings(getProjectSettings(repoFullName));
    const unsubscribe = subscribeProjectSettings((r) => {
      if (r.toLowerCase() === repoFullName.toLowerCase()) setSettings(getProjectSettings(repoFullName));
    });
    return () => {
      unsubscribe();
    };
  }, [repoFullName]);

  const reloadRepo = useCallback(async () => {
    if (!owner || !repo) return;
    try {
      setRepoInfo(await ghSettings('getRepo', { owner, repo }));
      setRepoError(null);
    } catch (e: any) {
      setRepoError(e.message);
    }
  }, [owner, repo]);

  const reloadBranches = useCallback(() => {
    if (!owner || !repo) return;
    ghSettings<any[]>('listBranches', { owner, repo })
      .then(setBranches)
      .catch(() => setBranches([]));
  }, [owner, repo]);

  useEffect(() => {
    setRepoInfo(null);
    reloadRepo();
    reloadBranches();
  }, [reloadRepo, reloadBranches]);

  const update = useCallback(
    (fn: (prev: ProjectSettings) => ProjectSettings) => {
      if (!repoFullName) return;
      const next = fn(getProjectSettings(repoFullName));
      saveProjectSettings(repoFullName, next);
      setSettings(next);
    },
    [repoFullName],
  );

  if (!owner || !repo) {
    return (
      <div style={{ flex: 1, background: theme.bgShelf, borderRadius: 10, padding: 24, color: theme.textSecondary, fontSize: 13 }}>
        Selecione um projeto vinculado a um repositório do GitHub para ver as configurações.
      </div>
    );
  }

  const common: SectionProps = {
    ctx,
    repoFullName,
    owner,
    repo,
    repoInfo,
    isAdmin: Boolean(repoInfo?.permissions?.admin),
    reloadRepo,
    settings,
    update,
    showToast,
    confirm: (req) => setConfirmState({ ...req, isOpen: true }),
  };

  const renderSection = () => {
    switch (section) {
      case 'geral':
        return <GeneralSection {...common} branches={branches.map((b) => b.name)} />;
      case 'branches':
        return <BranchesSection {...common} branches={branches} reloadBranches={reloadBranches} />;
      case 'fluxo':
        return <WorkflowSection {...common} onDataConfigChanged={onDataConfigChanged} />;
      case 'labels':
        return <LabelsSection {...common} />;
      case 'templates':
        return <TemplatesSection {...common} />;
      case 'ia':
        return <AiSection {...common} />;
      case 'alertas':
        return <AlertsSection {...common} />;
      case 'local':
        return <LocalEnvSection {...common} detectedPath={selectedProject?.localDir} />;
      case 'integracoes':
        return <IntegrationsSection {...common} customLinks={customLinks} onSaveCustomLinks={(l) => onSaveCustomLinks?.(l)} />;
      case 'perigo':
        return <DangerSection {...common} onRefreshRepoDetails={onRefreshRepoDetails} onRepoGone={onRepoGone} />;
    }
  };

  return (
    <div
      style={{
        width: '100%',
        flex: 1,
        minHeight: 360,
        display: 'flex',
        gap: 5,
        padding: 5,
        boxSizing: 'border-box',
        background: theme.bgShelf,
        borderRadius: 10,
        boxShadow: theme.shelfShadow,
        fontFamily: "'Poppins', -apple-system, sans-serif",
      }}
    >
      <div
        style={{
          width: 'clamp(170px, 20%, 220px)',
          minWidth: 170,
          background: theme.viewCanvasBg,
          borderRadius: 8,
          padding: '8px 6px',
          display: 'flex',
          flexDirection: 'column',
          gap: 2,
          boxSizing: 'border-box',
          flexShrink: 0,
          alignSelf: 'flex-start',
          position: 'sticky',
          top: 0,
        }}
      >
        {SECTIONS.map((g) => (
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
                    gap: 8,
                    padding: '7px 10px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isActive ? (isEffectiveDark ? '#242424' : '#e2e8f0') : 'transparent',
                    color: isActive ? theme.textPrimary : tab.id === 'perigo' ? '#ef4444' : theme.textSecondary,
                    fontWeight: isActive ? 500 : 400,
                    fontSize: 12.5,
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <Icon size={14} color={isActive ? accentColor : tab.id === 'perigo' ? '#ef4444' : theme.textSecondary} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.label}</span>
                </div>
              );
            })}
          </React.Fragment>
        ))}
        <div style={{ padding: '10px 10px 2px', fontSize: 10.5, color: theme.textMuted, lineHeight: 1.4 }}>
          <KeyRound size={10} style={{ verticalAlign: -1 }} /> {repoInfo ? (repoInfo.permissions?.admin ? 'Você é admin' : repoInfo.permissions?.push ? 'Você tem escrita' : 'Somente leitura') : 'Carregando permissões…'}
        </div>
      </div>

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {repoError && (
          <div style={{ background: theme.viewCanvasBg, borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8 }}>
            Não foi possível carregar o repositório: {repoError}
            <SmallButton ctx={ctx} onClick={reloadRepo}>
              Tentar novamente
            </SmallButton>
          </div>
        )}
        {renderSection()}
      </div>

      <ConfirmDeleteModal
        isOpen={Boolean(confirmState?.isOpen)}
        title={confirmState?.title || ''}
        message={confirmState?.message || ''}
        itemDescription={confirmState?.itemDescription}
        confirmLabel={confirmState?.confirmLabel}
        isDeleting={confirmState?.busy}
        accentColor={accentColor}
        onConfirm={async () => {
          if (!confirmState) return;
          setConfirmState({ ...confirmState, busy: true });
          try {
            await confirmState.onConfirm();
          } finally {
            setConfirmState(null);
          }
        }}
        onClose={() => setConfirmState(null)}
      />
    </div>
  );
};
