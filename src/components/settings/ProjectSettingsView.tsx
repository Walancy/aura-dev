import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Bot,
  FileStack,
  GitBranch,
  Globe,
  KeyRound,
  Lock,
  Plug,
  RefreshCw,
  Search,
  Settings,
  Shield,
  ShieldAlert,
  Tags,
  TerminalSquare,
  Workflow,
} from 'lucide-react';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';
import { SmallButton, type TeamUiCtx } from '../team/teamUi';
import { logSystemActivity } from '../../utils/brainService';
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
    group: 'Aura Dev',
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

const SECTION_DESCRIPTIONS: Record<SectionId, string> = {
  geral: 'Informações principais, visibilidade, topics e branch padrão do repositório.',
  branches: 'Regras de merge commit, squash, rebase e proteção de branch no GitHub.',
  fluxo: 'Mapeamento de status no GitHub Project V2, durações de sprints e estimativas.',
  labels: 'Gerenciamento de tags, cores e taxonomia de issues do repositório.',
  templates: 'Templates de abertura de Pull Requests e arquivos CODEOWNERS.',
  ia: 'Modelos de linguagem, automações inteligentes de issues e contexto fixo do projeto.',
  alertas: 'Regras de alerta para prazos, sobrecargas de equipe e notificações no app.',
  local: 'Vinculação de diretório local no disco, comandos npm/bun e variáveis .env.',
  integracoes: 'Links rápidos, segredos do GitHub Actions e webhooks configurados.',
  perigo: 'Ações irreversíveis: exportação de dados, arquivamento ou exclusão do repositório.',
};

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

  // Filtro de busca na sidebar (estilo Marcos)
  const [sidebarSearch, setSidebarSearch] = useState('');

  // Redimensionamento horizontal da sidebar (estilo Marcos)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('aura_project_settings_sidebar_width');
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 180 && val <= 450) return val;
      }
    } catch {}
    return 240;
  });
  const [isDraggingLeftSidebar, setIsDraggingLeftSidebar] = useState(false);

  const startResizeLeftSidebar = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingLeftSidebar(true);
      document.body.classList.add('resizing-col');

      const startX = e.clientX;
      const initialWidth = leftSidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const newWidth = Math.max(180, Math.min(450, initialWidth + deltaX));
        setLeftSidebarWidth(newWidth);
        try {
          localStorage.setItem('aura_project_settings_sidebar_width', String(newWidth));
        } catch {}
      };

      const onMouseUp = () => {
        setIsDraggingLeftSidebar(false);
        document.body.classList.remove('resizing-col');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [leftSidebarWidth],
  );

  const resetLeftSidebarWidth = useCallback(() => {
    setLeftSidebarWidth(240);
    try {
      localStorage.setItem('aura_project_settings_sidebar_width', '240');
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      document.body.classList.remove('resizing-col');
    };
  }, []);

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

  // Filtragem das seções na busca da sidebar
  const filteredSections = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return SECTIONS;
    return SECTIONS.map((g) => ({
      ...g,
      items: g.items.filter((item) => item.label.toLowerCase().includes(q) || item.id.toLowerCase().includes(q)),
    })).filter((g) => g.items.length > 0);
  }, [sidebarSearch]);

  const activeItem = useMemo(() => {
    for (const g of SECTIONS) {
      const found = g.items.find((i) => i.id === section);
      if (found) return found;
    }
    return SECTIONS[0].items[0];
  }, [section]);

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

  const ActiveIcon = activeItem.icon;
  const permissionLabel = repoInfo
    ? repoInfo.permissions?.admin
      ? 'Administrador'
      : repoInfo.permissions?.push
      ? 'Escrita'
      : 'Leitura'
    : 'Carregando...';

  return (
    <div
      style={{
        width: '100%',
        flex: 1,
        minHeight: 0,
        height: '100%',
        display: 'flex',
        gap: 5,
        padding: 5,
        boxSizing: 'border-box',
        background: isEffectiveDark ? '#101010' : '#f5f5f5',
        borderRadius: 10,
        border: 'none',
        boxShadow: 'none',
        overflow: 'hidden',
        fontFamily: "'Poppins', -apple-system, sans-serif",
      }}
    >
      {/* ========================================================================= */}
      {/* 1. SIDEBAR ESQUERDA: LISTA MODULAR DE SEÇÕES COM BUSCA E REDIMENSIONAMENTO */}
      {/* ========================================================================= */}
      <div
        style={{
          width: leftSidebarWidth,
          minWidth: 180,
          maxWidth: 450,
          flexShrink: 0,
          height: '100%',
          background: isEffectiveDark ? '#161616' : '#ffffff',
          borderRadius: 8,
          padding: 6,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          boxSizing: 'border-box',
          border: 'none',
          boxShadow: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Cabeçalho da Sidebar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Settings size={14} color={accentColor} />
            <span style={{ fontSize: 13, fontWeight: 400, color: theme.textPrimary }}>Configurações</span>
            <span
              style={{
                fontSize: 10,
                fontWeight: 400,
                padding: '1px 6px',
                borderRadius: 4,
                background: isEffectiveDark ? '#1c1c1c' : 'rgba(0, 0, 0, 0.06)',
                color: theme.textSecondary,
              }}
            >
              {SECTIONS.flatMap((g) => g.items).length}
            </span>
          </div>
        </div>

        {/* Campo de Busca Rápida de Configuração */}
        <div style={{ position: 'relative', width: '100%' }}>
          <Search
            size={12}
            color={theme.textSecondary}
            style={{
              position: 'absolute',
              left: 8,
              top: '50%',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          />
          <input
            type="text"
            value={sidebarSearch}
            onChange={(e) => setSidebarSearch(e.target.value)}
            placeholder="Buscar configuração..."
            style={{
              width: '100%',
              height: 28,
              border: 'none',
              borderRadius: 6,
              padding: '0 8px 0 26px',
              fontSize: 11.5,
              fontFamily: 'inherit',
              background: isEffectiveDark ? '#1c1c1c' : theme.controlBg,
              color: theme.textPrimary,
              outline: 'none',
              boxSizing: 'border-box',
              boxShadow: 'none',
            }}
          />
        </div>

        {/* Lista de seções navegáveis */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            minHeight: 0,
          }}
          className="no-scrollbar"
        >
          {filteredSections.map((g) => (
            <React.Fragment key={g.group}>
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 400,
                  color: theme.textSecondary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  padding: '8px 8px 3px',
                }}
              >
                {g.group}
              </div>
              {g.items.map((tab) => {
                const isActive = section === tab.id;
                const Icon = tab.icon;
                return (
                  <div
                    key={tab.id}
                    onClick={() => {
                      setSection(tab.id);
                      logSystemActivity('configuracoes_projeto', 'trocar_secao', tab.label, { secao: tab.id, repo: repoFullName });
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      height: 28,
                      padding: '0 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isActive ? (isEffectiveDark ? '#2a2a2a' : '#e5e5e5') : 'transparent',
                      color: isActive ? theme.textPrimary : tab.id === 'perigo' ? '#ef4444' : theme.textSecondary,
                      fontWeight: 400,
                      fontSize: 12,
                      transition: 'all 0.15s ease',
                      flexShrink: 0,
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) e.currentTarget.style.background = isEffectiveDark ? '#242424' : '#f0f0f0';
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Icon size={13} color={isActive ? accentColor : tab.id === 'perigo' ? '#ef4444' : theme.textSecondary} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tab.label}</span>
                  </div>
                );
              })}
            </React.Fragment>
          ))}
        </div>

        {/* Rodapé da Sidebar */}
        <div
          style={{
            borderTop: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
            paddingTop: 6,
            fontSize: 10.5,
            color: theme.textSecondary,
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            flexShrink: 0,
          }}
        >
          <KeyRound size={11} color={accentColor} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {permissionLabel} · {repoFullName}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* DIVISOR REDIMENSIONÁVEL ESTILO MARCOS                                    */}
      {/* ========================================================================= */}
      <div
        data-testid="resizer-settings-left"
        className={`resizer-col ${isDraggingLeftSidebar ? 'dragging' : ''}`}
        onMouseDown={startResizeLeftSidebar}
        onDoubleClick={resetLeftSidebarWidth}
        title="Arraste para redimensionar (Duplo clique para restaurar 240px)"
        style={{
          width: 7,
          marginLeft: -6,
          marginRight: -6,
          cursor: 'col-resize',
          position: 'relative',
          zIndex: 25,
          userSelect: 'none',
          alignSelf: 'stretch',
          flexShrink: 0,
        }}
      />

      {/* ========================================================================= */}
      {/* 2. ÁREA PRINCIPAL: CARDS MODULARES DE TOPO + CONTEÚDO VERTICAL             */}
      {/* ========================================================================= */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          overflow: 'hidden',
        }}
      >
        {/* LINHA SUPERIOR: Card de Contexto da Seção + 3 Cards de Status */}
        <div
          style={{
            display: 'flex',
            gap: 5,
            alignItems: 'stretch',
            flexShrink: 0,
          }}
        >
          {/* Card Esquerdo: Informações da Seção Ativa */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              background: isEffectiveDark ? '#161616' : '#ffffff',
              borderRadius: 8,
              padding: '9px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <ActiveIcon size={14} color={accentColor} />
                <span style={{ fontSize: 13.5, fontWeight: 400, color: theme.textPrimary }}>
                  {activeItem.label}
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 400,
                    padding: '1.5px 6px',
                    borderRadius: 10,
                    background: `${accentColor}18`,
                    color: accentColor,
                  }}
                >
                  {owner}/{repo}
                </span>
              </div>
              <div style={{ fontSize: 11, color: theme.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {SECTION_DESCRIPTIONS[section]}
              </div>
            </div>

            <SmallButton ctx={ctx} onClick={reloadRepo} title="Recarregar informações do repositório">
              <RefreshCw size={11} /> Sincronizar
            </SmallButton>
          </div>

          {/* Cards Modulares de Status à Direita (Estilo Marcos) */}
          <div
            style={{
              background: isEffectiveDark ? '#161616' : '#ffffff',
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 2,
              minWidth: 100,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: theme.textSecondary }}>
              <Shield size={11} color={accentColor} />
              <span>Acesso</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 400, color: theme.textPrimary, lineHeight: 1.2 }}>
              {permissionLabel}
            </div>
          </div>

          <div
            style={{
              background: isEffectiveDark ? '#161616' : '#ffffff',
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 2,
              minWidth: 100,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: theme.textSecondary }}>
              {repoInfo?.private ? <Lock size={11} /> : <Globe size={11} />}
              <span>Visibilidade</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 400, color: theme.textPrimary, lineHeight: 1.2 }}>
              {repoInfo ? (repoInfo.private ? 'Privado' : 'Público') : '—'}
            </div>
          </div>

          <div
            style={{
              background: isEffectiveDark ? '#161616' : '#ffffff',
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 2,
              minWidth: 110,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: theme.textSecondary }}>
              <GitBranch size={11} color={accentColor} />
              <span>Branch base</span>
            </div>
            <div style={{ fontSize: 12, fontWeight: 400, color: theme.textPrimary, lineHeight: 1.2 }}>
              {repoInfo?.default_branch || 'main'}
            </div>
          </div>
        </div>

        {/* Área de Conteúdo da Seção Selecionada */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            overflowY: 'auto',
          }}
          className="no-scrollbar"
        >
          {repoError && (
            <div style={{ background: isEffectiveDark ? '#141414' : '#ffffff', borderRadius: 8, padding: '8px 12px', fontSize: 11.5, color: '#f59e0b', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              Não foi possível carregar o repositório: {repoError}
              <SmallButton ctx={ctx} onClick={reloadRepo}>
                Tentar novamente
              </SmallButton>
            </div>
          )}
          {renderSection()}
        </div>
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
