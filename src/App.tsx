import React, { useState, useEffect, useRef, useCallback, useMemo, useLayoutEffect } from 'react';
import Editor, { DiffEditor, OnMount } from '@monaco-editor/react';
import {
  Files,
  Search,
  GitBranch,
  Play,
  Link2,
  Monitor,
  Settings,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Pin,
  Folder,
  FolderOpen,
  SplitSquareVertical,
  Columns,
  X,
  Plus,
  Minus,
  Trash2,
  Maximize2,
  Minimize2,
  Square,
  Terminal as TerminalIcon,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  XCircle,
  CheckCircle2,
  Shield,
  ShieldCheck,
  Info,
  Milestone as MilestoneIcon,
  Loader2,
  Radio,
  ExternalLink,
  PanelLeft,
  PanelBottom,
  PanelRight,
  SquareTerminal,
  AtSign,
  Save,
  FileText,
  FilePlus,
  FolderPlus,
  AlertTriangle,
  Sparkles,
  Download,
  Layers,
  PlusCircle,
  MessageSquare,
  Wand2,
  Check,
  RotateCcw,
  Eye,
  GitPullRequest,
  Clock,
  Pencil,
  BookOpen,
  ChevronUp,
  Copy,
  FileCode,
  KeyRound,
  Image as ImageIcon,
  Scissors,
  ClipboardPaste,
  Bug,
  GitCompare,
  History,
  Network,
  Brain,
  Undo2,
  Bell,
  LogOut,
  ArrowUp,
  ArrowUpCircle,
} from 'lucide-react';
import avatarImg from './avatar.png';
import { PreviewTabView } from './components/ide/PreviewTabView';
import { FileIcon, FolderIcon } from './components/FileIcon';
import { PromptEditor, PromptEditorRef } from './components/PromptEditor';
import { SidebarPanels } from './components/ide/SidebarPanels';
import { ProjectsSchedulerView, prefetchProjectsData } from './components/ProjectsSchedulerView';
import { ProjectWorkspaceSelector } from './components/ide/ProjectWorkspaceSelector';
import { HeaderProjectSelector, type HeaderActiveProjectInfo, type HeaderProjectItem, type ProjectAiStatus } from './components/HeaderProjectSelector';
import { OrchestrationCanvas } from './components/OrchestrationCanvas';
import { DailySchedulerView } from './components/daily/DailySchedulerView';
import DesignStudioView from './components/design2/DesignStudioView';
import { CliTerminalView } from './components/CliTerminalView';
import { ProjectTasksDockTab } from './components/dock/ProjectTasksDockTab';
import { PortsDockTab } from './components/dock/PortsDockTab';
import { OutputDockTab } from './components/dock/OutputDockTab';
import { DebugConsoleDockTab } from './components/dock/DebugConsoleDockTab';
import { IssueDetailSidesheet } from './components/modals/IssueDetailSidesheet';
import { ProblemsPanelView, type IdeProblem } from './components/ide/ProblemsPanelView';
import {
  GLOBAL_PROJECTS_CACHE,
  type ProjectIssue,
} from './components/ProjectsSchedulerView';
import { ProjectBrainModal } from './components/brain/ProjectBrainModal';
import { ConfirmUndoModal } from './components/modals/ConfirmUndoModal';
import { ConfirmDeleteModal } from './components/modals/ConfirmDeleteModal';
import { AiChatPermissionsModal, DEFAULT_AI_PERMISSIONS } from './components/ide/chat/AiChatPermissionsModal';
import { AiChatTimeline, type TerminalExecutionRecord } from './components/ide/chat/AiChatTimeline';
import { InteractiveQuestionCard, AlertCallout, type InteractiveQuestionData } from './components/ide/chat/AiChatInteractiveCard';
import { AiChatMessageQueue, type QueuedMessageItem } from './components/ide/chat/AiChatMessageQueue';
import { MermaidDiagram } from './components/ide/chat/MermaidDiagram';
import { AiChatMentionsMenu, type MentionItem } from './components/ide/chat/AiChatMentionsMenu';
import {
  loadProjectBrain,
  switchProjectBrainContext,
  getActiveBrainContextSync,
  generateBrainAiContext,
  logSystemActivity,
} from './utils/brainService';
import {
  CodiconFiles,
  CodiconSearch,
  CodiconSourceControl,
  CodiconDebugAlt,
  CodiconRemoteExplorer,
  CodiconBeaker,
  CodiconSettingsGear,
} from './components/Codicons';

import { CustomizeLayoutIcon, GitDiamondIcon } from './components/icons/MiscIcons';
import { ClaudeIcon, AntigravityIcon, GeminiIcon, OllamaIcon, CodexIcon, renderAiIcon } from './components/icons/AiProviderIcons';
import { getContrastTextColor, hexToRgba, hexToRgb, rgbToHex, rgbToHsv, hsvToRgb, hexToHsv } from './utils/color';
import { MiniSwitch } from './components/ui/MiniSwitch';
import { detectDevCommand, detectPackageManager, listScripts, otherCommands, scriptCommand, PACKAGE_MANAGERS, type PackageManager } from './utils/devCommand';
import { computeDailyBudget, parseResetTimestamp, type DailyBudget, type DailyBudgetState } from './utils/dailyBudget';
import { planChecks, parseTscOutput, parseEslintJson, parseOxlintJson, type CheckResult } from './utils/projectCheck';
import { extractDocumentSymbols, getFileLanguage, isMarkdownFile } from './utils/editor';
import type { DocumentSymbol } from './utils/editor';
import { NativeXTerm } from './components/NativeXTerm';
import type { NativeXTermProps } from './components/NativeXTerm';
import { AI_BRAND_COLORS, AI_MODES, AI_PROVIDERS, DEFAULT_AI_QUOTAS, formatModelDisplayName } from './constants/ai';
import type { AiSlashCommand, AiMode, AiModeConfig, AiProviderConfig, AiQuotaConfig } from './constants/ai';
import { formatQuotaResetDisplay, formatRelativeResetTime } from './utils/quota';
import { ThemePopup } from './components/modals/ThemePopup';
import { CustomizeLayoutPopup } from './components/modals/CustomizeLayoutPopup';
import { QuickOpenModal } from './components/modals/QuickOpenModal';
import { ChatHistoryModal } from './components/modals/ChatHistoryModal';
import { BranchModal } from './components/modals/BranchModal';
import { IssuesModal } from './components/modals/IssuesModal';
import { SettingsModal, type SettingsTabId } from './components/modals/SettingsModal';
import { AiGlobalRulesModal } from './components/modals/AiGlobalRulesModal';
import { GithubLoginScreen } from './components/auth/GithubLoginScreen';
import type { GithubAuthenticatedUser } from './components/auth/GithubLoginScreen';
import { renderMarkdownPreview } from './utils/markdown';
import type {
  TerminalSessionItem,
  OpenFileItem,
  ExplorerNode,
  ReviewSession,
  GitHubIssueItem,
  GitBranchItem,
  ChangedFileItem,
  ExecutionStepItem,
  WalkthroughItem,
  ChatMessageItem,
  AttachedFileItem,
  AttachedImageItem,
  ChatSessionItem,
  QuickOpenItemDef,
} from './types/ide';
import { ProjectAiNotificationToast, ProjectAiNotificationItem } from './components/notifications/ProjectAiNotificationToast';
import NotificationCenterPanel from './components/notifications/NotificationCenterPanel';
import { useNotificationCenter } from './components/notifications/useNotificationCenter';
import { useProjectNotifier } from './components/notifications/useProjectNotifier';
import { SkillsModal } from './components/skills/SkillsModal';

interface DailyBudgetInfoTooltipProps {
  claudeDaily: DailyBudget;
  isEffectiveDark: boolean;
  accentColor: string;
  themeTokens: {
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    bgCardSecondary: string;
    [key: string]: any;
  };
  clampPopupToViewport?: (el: HTMLElement | null) => void;
}

const DailyBudgetInfoTooltip: React.FC<DailyBudgetInfoTooltipProps> = ({
  claudeDaily,
  isEffectiveDark,
  accentColor,
  themeTokens,
  clampPopupToViewport,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const closeTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleMouseEnter = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
    setIsOpen(true);
    logSystemActivity('ai', 'hover_daily_budget_info', 'Claude');
  };

  const handleMouseLeave = () => {
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current);
    }
    closeTimeoutRef.current = setTimeout(() => {
      setIsOpen(false);
      closeTimeoutRef.current = null;
    }, 200);
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen((prev) => {
            const next = !prev;
            if (next) {
              logSystemActivity('ai', 'view_daily_budget_info', 'Claude');
            }
            return next;
          });
        }}
        style={{
          background: isOpen
            ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
            : 'transparent',
          border: 'none',
          boxShadow: 'none',
          borderRadius: 4,
          padding: 2,
          margin: 0,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: isOpen ? accentColor : themeTokens.textMuted,
          transition: 'all 0.15s ease',
        }}
      >
        <Info size={11} />
      </button>

      {isOpen && (
        <div
          ref={(el) => {
            if (el && clampPopupToViewport) {
              clampPopupToViewport(el);
            }
          }}
          onClick={(e) => e.stopPropagation()}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: -40,
            width: 280,
            background: isEffectiveDark ? '#232326' : '#f4f4f6',
            borderRadius: 8,
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            border: 'none',
            boxShadow: 'none',
            zIndex: 1000000,
            pointerEvents: 'auto',
            transition: 'all 0.15s ease',
          }}
        >
          {/* Bridge between button and tooltip */}
          <div
            style={{
              position: 'absolute',
              top: -8,
              left: 0,
              right: 0,
              height: 10,
              pointerEvents: 'auto',
            }}
          />

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 400, color: themeTokens.textPrimary }}>
              Cálculo de Pontuação Diária
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 400,
                color: accentColor,
                background: `${accentColor}18`,
                padding: '1px 5px',
                borderRadius: 4,
              }}
            >
              Dia {claudeDaily.currentDay || 1} de 7
            </span>
          </div>

          {/* Divisória com opacidade baixa */}
          <div
            style={{
              height: 1,
              width: '100%',
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
            }}
          />

          {/* Explicação da Pontuação */}
          <div
            style={{
              fontSize: 9.5,
              fontWeight: 400,
              color: themeTokens.textSecondary,
              lineHeight: 1.45,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            <div>
              O limite semanal (100 pts) é dividido entre os 7 dias da semana (~14.3 pts/dia).
            </div>
            <div>
              A cada dia você recebe a sua cota diária mais a sobra acumulada dos dias anteriores deste ciclo.
            </div>
            <div>
              Caso não utilize todos os pontos hoje, o saldo acumula para o próximo dia até o reset semanal.
            </div>
          </div>

          {/* Detalhe numérico */}
          <div
            style={{
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
              borderRadius: 6,
              padding: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 8.5, color: themeTokens.textMuted, fontWeight: 400 }}>Cota Diária Base</span>
              <span style={{ fontSize: 11, fontWeight: 400, color: themeTokens.textPrimary }}>
                {claudeDaily.dailyShare || 14.3} pts/dia
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, alignItems: 'flex-end' }}>
              <span style={{ fontSize: 8.5, color: themeTokens.textMuted, fontWeight: 400 }}>Disponível Hoje</span>
              <span style={{ fontSize: 11, fontWeight: 400, color: accentColor }}>
                {Math.max(0, claudeDaily.remaining).toFixed(1)} pts
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'projetos' | 'orchestration' | 'daily' | 'ide' | 'cli' | 'design'>('projetos');
  const [activeTermTab, setActiveTermTab] = useState<'problems' | 'output' | 'debug' | 'terminal' | 'ports' | 'tasks'>('terminal');

  // Code Review (Diff View) state
  const [activeReview, setActiveReview] = useState<ReviewSession | null>(null);

  // GitHub Issues state
  const [gitIssues, setGitIssues] = useState<GitHubIssueItem[]>([]);
  const [isIssuesModalOpen, setIsIssuesModalOpen] = useState(false);
  const [sidesheetIssue, setSidesheetIssue] = useState<ProjectIssue | null>(null);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [issuesSearchQuery, setIssuesSearchQuery] = useState('');
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);


  // Attached Task for AI Chat prompt
  const [attachedTask, setAttachedTask] = useState<{
    number: number;
    title: string;
    body?: string;
    state?: string;
    labels?: Array<{ name: string; color?: string }>;
    url?: string;
  } | null>(null);

  // Active working issue across conversation turns
  const [activeWorkingIssue, setActiveWorkingIssue] = useState<{
    number: number;
    title: string;
    body?: string;
    state?: string;
    labels?: Array<{ name: string; color?: string }>;
    url?: string;
  } | null>(null);
  const [isFinalizingIssue, setIsFinalizingIssue] = useState(false);
  const [finalizedIssues, setFinalizedIssues] = useState<Record<number, boolean>>({});

  // Git Branches state
  const [currentBranch, setCurrentBranch] = useState('main');
  const [gitRepoName, setGitRepoName] = useState('aura-dev');
  const [activeHeaderProject, setActiveHeaderProject] = useState<HeaderActiveProjectInfo | null>(null);
  const [headerProjectsList, setHeaderProjectsList] = useState<HeaderProjectItem[]>([]);
  const [branchesList, setBranchesList] = useState<GitBranchItem[]>([]);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  const [newBranchInput, setNewBranchInput] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isSyncingGit, setIsSyncingGit] = useState(false);

  // Open Files in Monaco Editor (isolated per project workspace)
  const [openFiles, setOpenFiles] = useState<OpenFileItem[]>(() => {
    try {
      const savedWs = localStorage.getItem('ide_workspace_path');
      const currentWs = (savedWs && !savedWs.toLowerCase().includes('ainaobra'))
        ? savedWs
        : '/Users/walancy/Documents/codes/devflow-desktop';
      const saved = localStorage.getItem(`ide_open_files_${currentWs}`);
      if (saved) {
        const parsed: OpenFileItem[] = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          const valid = parsed.filter((f) => f.path && f.path.startsWith(currentWs));
          if (valid.length > 0) return valid;
        }
      }
      if (currentWs === '/Users/walancy/Documents/codes/devflow-desktop') {
        return [
          {
            id: '/Users/walancy/Documents/codes/devflow-desktop/src/App.tsx',
            name: 'App.tsx',
            path: '/Users/walancy/Documents/codes/devflow-desktop/src/App.tsx',
            content: '',
            language: 'typescript',
            isDirty: false,
          },
          {
            id: '/Users/walancy/Documents/codes/devflow-desktop/src/components/OrchestrationCanvas.tsx',
            name: 'OrchestrationCanvas.tsx',
            path: '/Users/walancy/Documents/codes/devflow-desktop/src/components/OrchestrationCanvas.tsx',
            content: '',
            language: 'typescript',
            isDirty: false,
          },
        ];
      }
    } catch {}
    return [];
  });
  const [activeFileId, setActiveFileId] = useState<string | null>(() => {
    try {
      const savedWs = localStorage.getItem('ide_workspace_path');
      const currentWs = (savedWs && !savedWs.toLowerCase().includes('ainaobra'))
        ? savedWs
        : '/Users/walancy/Documents/codes/devflow-desktop';
      const saved = localStorage.getItem(`ide_active_file_${currentWs}`);
      if (saved && saved.startsWith(currentWs)) return saved;
      if (currentWs === '/Users/walancy/Documents/codes/devflow-desktop') {
        return '/Users/walancy/Documents/codes/devflow-desktop/src/App.tsx';
      }
    } catch {}
    return null;
  });
  const activeFile = openFiles.find((f) => f.id === activeFileId) || (openFiles.length > 0 ? openFiles[0] : null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // Centro de notificações (lista + histórico no armazenamento local)
  const notifCenter = useNotificationCenter();
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  // Todo toast também vai para o histórico (erros ficam como novos para não passarem despercebidos)
  useEffect(() => {
    if (!toastMessage) return;
    const isError = /\b(erro|falha|falhou|não foi possível)\b/i.test(toastMessage);
    notifCenter.add({ kind: isError ? 'error' : 'info', title: toastMessage, read: !isError });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toastMessage]);
  // Notificações de GitHub por projeto (Configurações → Alertas e notificações)
  useProjectNotifier((msg) => setToastMessage(msg));

  // Auto-dismiss toast notification after 3.5 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Load initial active files contents from disk if available
  useEffect(() => {
    if (window.electronAPI?.fs?.readFile) {
      openFiles.forEach(async (f) => {
        if (!f.content && f.path) {
          try {
            const res = await window.electronAPI.fs.readFile(f.path);
            if (res && res.content) {
              setOpenFiles((prev) =>
                prev.map((item) => (item.id === f.id ? { ...item, content: res.content } : item))
              );
            }
          } catch {}
        }
      });
    }
  }, []);

  // Workspace & Explorer State
  const [workspacePath, setWorkspacePath] = useState<string>(() => {
    const saved = localStorage.getItem('ide_workspace_path');
    if (saved && !saved.toLowerCase().includes('ainaobra')) {
      return saved;
    }
    return '/Users/walancy/Documents/codes/devflow-desktop';
  });

  // Pré-carrega projetos e tarefas em segundo plano para abertura instantânea (0ms de espera)
  useEffect(() => {
    prefetchProjectsData(workspacePath);
  }, [workspacePath]);

  // Sprints / Milestones dynamically extracted from current project issues and Projects cache
  const projectMilestones = useMemo(() => {
    const map = new Map<string, { title: string; number?: number; iterationId?: string; isProjectIteration?: boolean }>();

    // 1. Sprints vindas do cache da tela de Projetos (GLOBAL_PROJECTS_CACHE)
    const cache = GLOBAL_PROJECTS_CACHE?.repoDetailsCache;
    if (cache) {
      const candidates = [
        activeHeaderProject?.fullName,
        activeHeaderProject?.name,
        gitRepoName,
        gitRepoName.toLowerCase(),
        activeHeaderProject?.localDir ? activeHeaderProject.localDir.split('/').filter(Boolean).pop() : '',
        workspacePath ? workspacePath.split('/').filter(Boolean).pop() : '',
      ].filter(Boolean);
      for (const c of candidates) {
        for (const [k, v] of Object.entries(cache)) {
          if (k.toLowerCase() === c!.toLowerCase() || k.toLowerCase().includes(c!.toLowerCase())) {
            (v.sprints || []).forEach((sp) => {
              if (sp.title && sp.title.trim()) {
                const key = sp.title.toLowerCase().trim();
                if (!map.has(key)) {
                  map.set(key, {
                    title: sp.title.trim(),
                    number: sp.number,
                    iterationId: sp.iterationId,
                    isProjectIteration: sp.isProjectIteration,
                  });
                }
              }
            });
            break;
          }
        }
      }
    }

    // 2. Sprints customizadas locais
    try {
      const targetRepoKey = activeHeaderProject?.fullName || gitRepoName;
      const saved = localStorage.getItem(`devflow_custom_sprints_${targetRepoKey}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          parsed.forEach((sp: any) => {
            if (sp.title && sp.title.trim()) {
              const key = sp.title.toLowerCase().trim();
              if (!map.has(key)) {
                map.set(key, { title: sp.title.trim(), number: sp.number });
              }
            }
          });
        }
      }
    } catch {}

    // 3. Sprints das issues atuais (iterações V2, marcos, prefixos no título, labels)
    gitIssues.forEach((issue) => {
      const itTitle = issue.iterationTitle;
      if (itTitle && itTitle.trim()) {
        const key = itTitle.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, { title: itTitle.trim(), iterationId: issue.iterationId, isProjectIteration: true });
        }
      }
      const msTitle = issue.milestoneTitle || issue.milestone?.title;
      if (msTitle && msTitle.trim()) {
        const key = msTitle.toLowerCase().trim();
        if (!map.has(key)) {
          map.set(key, { title: msTitle.trim(), number: issue.milestoneNumber || issue.milestone?.number });
        }
      }
      if (issue.title) {
        const m = issue.title.match(/^sprint\s*([0-9]+(?:-[0-9]+)?)/i);
        if (m) {
          const normTitle = `Sprint ${m[1]}`;
          const key = normTitle.toLowerCase().trim();
          if (!map.has(key)) {
            map.set(key, { title: normTitle });
          }
        }
      }
    });

    return Array.from(map.values());
  }, [gitIssues, gitRepoName, workspacePath, activeHeaderProject]);

  const [fileTree, setFileTree] = useState<ExplorerNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set([
      '/Users/walancy/Documents/codes/devflow-desktop',
      '/Users/walancy/Documents/codes/devflow-desktop/src',
      '/Users/walancy/Documents/codes/devflow-desktop/src/components',
    ])
  );
  const [explorerMenuOpen, setExplorerMenuOpen] = useState(false);
  const explorerMenuRef = useRef<HTMLDivElement>(null);

  // File Explorer right-click context menu (VS Code / Cursor / Antigravity style)
  const [fileContextMenu, setFileContextMenu] = useState<{ x: number; y: number; node: ExplorerNode } | null>(null);
  const fileContextMenuRef = useRef<HTMLDivElement>(null);
  const [fileClipboard, setFileClipboard] = useState<{ path: string; mode: 'copy' | 'cut' } | null>(null);
  const [compareSelectionPath, setCompareSelectionPath] = useState<string | null>(null);

  // Outline & Timeline State (VS Code & Antigravity Style)
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [outlineFilter, setOutlineFilter] = useState('');
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [localTimelineSnapshots, setLocalTimelineSnapshots] = useState<Record<string, Array<{ id: string; time: string; timestamp: number; label: string; desc: string; type: 'edit' | 'save' | 'open' }>>>({});

  // Document Symbols for Outline
  const documentSymbols = useMemo(() => {
    if (!activeFile || !activeFile.content) return [];
    return extractDocumentSymbols(activeFile.content, activeFile.language);
  }, [activeFile?.content, activeFile?.language]);

  const filteredSymbols = useMemo(() => {
    if (!outlineFilter.trim()) return documentSymbols;
    const q = outlineFilter.toLowerCase();
    return documentSymbols.filter((s) => s.name.toLowerCase().includes(q) || s.kind.toLowerCase().includes(q));
  }, [documentSymbols, outlineFilter]);

  // Timeline events for active file
  const activeTimelineEntries = useMemo(() => {
    if (!activeFile) return [];
    const filePath = activeFile.path || activeFile.id;
    const custom = localTimelineSnapshots[filePath] || [];
    const base: Array<{ id: string; time: string; timestamp: number; label: string; desc: string; type: 'edit' | 'save' | 'open' }> = [
      {
        id: 'current',
        time: 'Agora',
        timestamp: Date.now(),
        label: activeFile.isDirty ? 'Edição não salva' : 'Edição atual',
        desc: `${activeFile.name} em edição ativa`,
        type: 'edit',
      },
      {
        id: 'opened',
        time: 'Hoje',
        timestamp: Date.now() - 60000 * 5,
        label: 'Arquivo carregado',
        desc: `Carregado do workspace: ${activeFile.name}`,
        type: 'open',
      },
    ];
    return [...custom, ...base];
  }, [activeFile?.path, activeFile?.id, activeFile?.isDirty, activeFile?.name, localTimelineSnapshots]);

  const handleTakeTimelineSnapshot = () => {
    if (!activeFile) return;
    const filePath = activeFile.path || activeFile.id;
    const newEntry = {
      id: String(Date.now()),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      label: 'Snapshot Local',
      desc: `${activeFile.content ? activeFile.content.split('\n').length : 0} linhas salvas`,
      type: 'save' as const,
    };
    setLocalTimelineSnapshots((prev) => ({
      ...prev,
      [filePath]: [newEntry, ...(prev[filePath] || [])],
    }));
    setToastMessage(`Snapshot criado para ${activeFile.name}`);
  };

  const handleSelectOutlineSymbol = (sym: DocumentSymbol) => {
    if (editorInstanceRef.current) {
      editorInstanceRef.current.revealLineInCenter(sym.line);
      editorInstanceRef.current.setPosition({ lineNumber: sym.line, column: 1 });
      editorInstanceRef.current.focus();
    }
  };

  // Real Terminal Working Directory and Execution State
  const [terminalCwd, setTerminalCwd] = useState<string>(() => {
    const saved = localStorage.getItem('ide_workspace_path') || localStorage.getItem('ide_terminal_cwd');
    if (saved && !saved.toLowerCase().includes('ainaobra')) {
      return saved;
    }
    return '/Users/walancy/Documents/codes/devflow-desktop';
  });

  // Always synchronize terminal working directory and running PTY shells with active project workspace
  useEffect(() => {
    if (workspacePath) {
      setTerminalCwd(workspacePath);
      localStorage.setItem('ide_workspace_path', workspacePath);
      localStorage.setItem('ide_terminal_cwd', workspacePath);
    }
  }, [workspacePath]);

  // Persiste os arquivos abertos e aba ativa por workspace
  useEffect(() => {
    if (workspacePath) {
      try {
        const projectFiles = openFiles.filter((f) => f.path && f.path.startsWith(workspacePath));
        localStorage.setItem(`ide_open_files_${workspacePath}`, JSON.stringify(projectFiles));
        if (activeFileId && activeFileId.startsWith(workspacePath)) {
          localStorage.setItem(`ide_active_file_${workspacePath}`, activeFileId);
        }
      } catch {}
    }
  }, [openFiles, activeFileId, workspacePath]);

  const [terminalCommandHistory, setTerminalCommandHistory] = useState<string[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);
  const terminalScrollRef = useRef<HTMLDivElement>(null);

  const [askPrompt, setAskPrompt] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState<number>(0);
  const [isSlashDismissed, setIsSlashDismissed] = useState<boolean>(false);
  const [aiCommands, setAiCommands] = useState<Record<string, AiSlashCommand[]>>({});
  // AI Mode State (Auto Mode, Plan Mode, Agent, Ask)
  const [aiMode, setAiMode] = useState<AiMode>(() => {
    try {
      return (localStorage.getItem('ide_ai_selected_mode') as AiMode) || 'auto';
    } catch {
      return 'auto';
    }
  });
  const [aiModeDropdown, setAiModeDropdown] = useState<boolean>(false);
  const aiModeDropdownRef = useRef<HTMLDivElement>(null);

  // Bottom Status Bar Dynamic Integration States
  const [cursorPosition, setCursorPosition] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [editorErrors, setEditorErrors] = useState<number>(0);
  const [editorWarnings, setEditorWarnings] = useState<number>(0);
  const [projectProblems, setProjectProblems] = useState<IdeProblem[]>([]);
  const [projectCheckResults, setProjectCheckResults] = useState<CheckResult[]>([]);
  const [editorMarkers, setEditorMarkers] = useState<IdeProblem[]>([]);
  const [isCheckingProject, setIsCheckingProject] = useState<boolean>(false);
  const [lastProjectCheckTime, setLastProjectCheckTime] = useState<Date | null>(null);
  const activeFileRef = useRef(activeFile);
  useEffect(() => {
    activeFileRef.current = activeFile;
  }, [activeFile]);

  const checkedPathRef = useRef(workspacePath);
  const allProblems = useMemo(() => {
    const map = new Map<string, IdeProblem>();
    const root = workspacePath.replace(/\/$/, '') + '/';
    const inProject = (p: IdeProblem) => !p.filePath.startsWith('/') || p.filePath.startsWith(root);
    for (const p of projectProblems.filter(inProject)) {
      map.set(`${p.filePath}:${p.line}:${p.column}:${p.code || ''}`, p);
    }
    for (const m of editorMarkers.filter(inProject)) {
      map.set(`${m.filePath}:${m.line}:${m.column}:${m.code || ''}`, m);
    }
    return Array.from(map.values());
  }, [projectProblems, editorMarkers, workspacePath]);
  const [indentationSize, setIndentationSize] = useState<number>(2);
  const [lineEnding, setLineEnding] = useState<'LF' | 'CRLF'>('LF');
  const [workspaceGitInfo, setWorkspaceGitInfo] = useState<{
    isGit?: boolean;
    branch?: string;
    repoName?: string;
    authorBlame?: string;
    activeFileBlame?: string;
    issuesCount?: number;
    sprintTitle?: string;
    sprintRemaining?: string;
  } | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem('ide_ai_selected_mode', aiMode);
    } catch {}
  }, [aiMode]);

  // Click outside listener for AI Mode Dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (aiModeDropdownRef.current && !aiModeDropdownRef.current.contains(e.target as Node)) {
        setAiModeDropdown(false);
      }
    };
    if (aiModeDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [aiModeDropdown]);

  // Fetch real Git info and blame for the workspace & active file
  const refreshWorkspaceGitInfo = useCallback(async () => {
    if (window.electronAPI?.git?.getWorkspaceGitInfo && workspacePath) {
      try {
        const info = await window.electronAPI.git.getWorkspaceGitInfo(workspacePath, activeFile?.path);
        if (info) {
          setWorkspaceGitInfo((prev: any) => (JSON.stringify(prev) === JSON.stringify(info) ? prev : info));
        }
      } catch {}
    }
  }, [workspacePath, activeFile?.path]);

  useEffect(() => {
    refreshWorkspaceGitInfo();
    const timer = setInterval(refreshWorkspaceGitInfo, 10000);
    return () => clearInterval(timer);
  }, [refreshWorkspaceGitInfo]);

  const [selectedAiProvider, setSelectedAiProvider] = useState<string>(() => {
    return localStorage.getItem('ide_selected_ai_provider') || 'claude';
  });
  useEffect(() => {
    try {
      localStorage.setItem('ide_selected_ai_provider', selectedAiProvider);
    } catch {}
  }, [selectedAiProvider]);
  const [useAiChatThemeColor, setUseAiChatThemeColor] = useState<boolean>(() => {
    const saved = localStorage.getItem('ide_use_ai_chat_color');
    return saved !== null ? saved === 'true' : true;
  });
  const [selectedModel, setSelectedModel] = useState<string>('sonnet');
  const [providerDropdown, setProviderDropdown] = useState(false);
  const [modelDropdown, setModelDropdown] = useState(false);
  const [activeProviderSubmenu, setActiveProviderSubmenu] = useState<string | null>(null);
  const [submenuOpenOnLeft, setSubmenuOpenOnLeft] = useState(false);
  const [activeModels, setActiveModels] = useState<Record<string, { currentModel: string; currentModelId: string; models: Array<{ id: string; label: string; tag?: string; description?: string }> }>>({});
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [quotaTooltipOpen, setQuotaTooltipOpen] = useState(false);
  const [headerQuotaTooltipOpen, setHeaderQuotaTooltipOpen] = useState(false);
  const [aiQuotas, setAiQuotas] = useState<Record<string, AiQuotaConfig>>(DEFAULT_AI_QUOTAS);

  // Helper to dynamically reposition/flip popups to avoid edge clipping or overflow
  const clampPopupToViewport = useCallback((el: HTMLElement | null) => {
    if (!el) return;
    const pad = 8;
    const rect = el.getBoundingClientRect();

    // Horizontal check: right overflow
    if (rect.right > window.innerWidth - pad) {
      el.style.left = 'auto';
      el.style.right = '0px';
      const updated = el.getBoundingClientRect();
      if (updated.left < pad) {
        el.style.left = `${pad}px`;
        el.style.right = `${pad}px`;
        el.style.width = 'auto';
        el.style.maxWidth = `calc(100vw - ${pad * 2}px)`;
      }
    } else if (rect.left < pad) {
      // Horizontal check: left overflow
      el.style.right = 'auto';
      el.style.left = '0px';
      const updated = el.getBoundingClientRect();
      if (updated.right > window.innerWidth - pad) {
        el.style.left = `${pad}px`;
        el.style.right = `${pad}px`;
        el.style.width = 'auto';
        el.style.maxWidth = `calc(100vw - ${pad * 2}px)`;
      }
    }

    // Vertical check: bottom/top overflow
    const vertRect = el.getBoundingClientRect();
    if (vertRect.bottom > window.innerHeight - pad) {
      el.style.bottom = `${pad}px`;
      el.style.maxHeight = `calc(100vh - ${pad * 2}px)`;
      el.style.overflowY = 'auto';
    } else if (vertRect.top < pad) {
      el.style.top = `${pad}px`;
      el.style.maxHeight = `calc(100vh - ${pad * 2}px)`;
      el.style.overflowY = 'auto';
    }
  }, []);

  const MAX_ATTACHED_IMAGES = 7;
  const [attachedFiles, setAttachedFiles] = useState<AttachedFileItem[]>([]);
  const [attachedImages, setAttachedImages] = useState<AttachedImageItem[]>([]);
  const [imageLimitWarning, setImageLimitWarning] = useState<string | null>(null);
  const [isPromptDragOver, setIsPromptDragOver] = useState<boolean>(false);
  const promptDragCounterRef = useRef<number>(0);

  useEffect(() => {
    const handleGlobalDragEnd = () => {
      promptDragCounterRef.current = 0;
      setIsPromptDragOver(false);
    };
    window.addEventListener('dragend', handleGlobalDragEnd);
    window.addEventListener('drop', handleGlobalDragEnd);
    window.addEventListener('mouseleave', handleGlobalDragEnd);
    return () => {
      window.removeEventListener('dragend', handleGlobalDragEnd);
      window.removeEventListener('drop', handleGlobalDragEnd);
      window.removeEventListener('mouseleave', handleGlobalDragEnd);
    };
  }, []);

  const triggerImageLimitWarning = useCallback(() => {
    setImageLimitWarning('Limite máximo de 7 imagens por envio atingido.');
    setTimeout(() => setImageLimitWarning(null), 3500);
  }, []);

  const handleImageFileAttached = useCallback((file: File) => {
    const filePath = (file as any).path;
    const reader = new FileReader();
    reader.onload = () => {
      setAttachedImages((prev) => {
        if (prev.length >= MAX_ATTACHED_IMAGES) {
          triggerImageLimitWarning();
          return prev;
        }
        if (filePath && prev.some((img) => img.path === filePath)) return prev;
        return [
          ...prev,
          {
            id: 'img-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
            name: file.name || (filePath ? filePath.split('/').pop() : `imagem_${Date.now()}.png`),
            dataUrl: reader.result as string,
            type: file.type || 'image/png',
            size: file.size,
            path: filePath,
          },
        ];
      });
    };
    reader.readAsDataURL(file);
  }, [triggerImageLimitWarning]);

  const handlePromptPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    let hasImage = false;
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (item.type.startsWith('image/')) {
        hasImage = true;
        const file = item.getAsFile();
        if (file) {
          const reader = new FileReader();
          reader.onload = () => {
            setAttachedImages((prev) => {
              if (prev.length >= MAX_ATTACHED_IMAGES) {
                triggerImageLimitWarning();
                return prev;
              }
              return [
                ...prev,
                {
                  id: 'img-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
                  name: `imagem_${Date.now()}.png`,
                  dataUrl: reader.result as string,
                  type: file.type,
                  size: file.size,
                },
              ];
            });
          };
          reader.readAsDataURL(file);
        }
      }
    }
    if (hasImage) {
      const hasText = e.clipboardData.getData('text');
      if (!hasText) {
        e.preventDefault();
      }
    }
  }, [triggerImageLimitWarning]);

  const insertMentionAtCaret = useCallback((mentionStr: string, dropEvent?: React.DragEvent) => {
    if (promptEditorRef.current) {
      const matches = Array.from(mentionStr.matchAll(/@\[(.*?)\]/g));
      if (matches.length > 0) {
        matches.forEach((m) => {
          const path = m[1].replace(/^@+/, '');
          const name = path.split('/').pop() || path;
          promptEditorRef.current?.insertPill(path, name);
        });
      } else if (mentionStr.startsWith('/') || mentionStr.includes('.') || mentionStr.includes('\\') || mentionStr.startsWith('@')) {
        const cleanPath = mentionStr.trim().replace(/^@+/, '');
        const name = cleanPath.split('/').pop() || cleanPath;
        promptEditorRef.current.insertPill(cleanPath, name);
      } else {
        promptEditorRef.current.insertText(mentionStr);
      }
      promptEditorRef.current.focus();
      return;
    }

    const textarea = inputRef.current;
    if (!textarea) {
      setAskPrompt((prev) => (prev ? prev + ' ' + mentionStr : mentionStr));
      return;
    }

    let insertPos = textarea.selectionStart ?? textarea.value.length;

    // Detect caret position from drop point in Chromium / Electron
    if (dropEvent) {
      try {
        const x = dropEvent.clientX;
        const y = dropEvent.clientY;
        if (typeof (document as any).caretPositionFromPoint === 'function') {
          const pos = (document as any).caretPositionFromPoint(x, y);
          if (pos && typeof pos.offset === 'number') {
            insertPos = pos.offset;
          }
        } else if (typeof (document as any).caretRangeFromPoint === 'function') {
          const range = (document as any).caretRangeFromPoint(x, y);
          if (range && typeof range.startOffset === 'number') {
            insertPos = range.startOffset;
          }
        }
      } catch {}
    }

    setAskPrompt((currentVal) => {
      const safePos = Math.min(Math.max(0, insertPos), currentVal.length);
      const before = currentVal.substring(0, safePos);
      const after = currentVal.substring(safePos);
      const prefixSpace = before.length > 0 && !before.endsWith(' ') ? ' ' : '';
      const suffixSpace = after.length > 0 && !after.startsWith(' ') ? ' ' : '';
      const result = before + prefixSpace + mentionStr + suffixSpace + after;

      const newCursor = before.length + prefixSpace.length + mentionStr.length + suffixSpace.length;
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          inputRef.current.setSelectionRange?.(newCursor, newCursor);
        }
      }, 15);

      return result;
    });
  }, []);

  const handlePromptDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsPromptDragOver(false);

    // 1. Internal explorer node / open tab drop
    const jsonStr = e.dataTransfer.getData('application/json');
    if (jsonStr) {
      try {
        const data = JSON.parse(jsonStr);
        if (data && data.path) {
          if (promptEditorRef.current) {
            promptEditorRef.current.insertPill(data.path, data.name);
            promptEditorRef.current.focus();
            return;
          }
          insertMentionAtCaret(`@[${data.path}]`, e);
          return;
        }
      } catch {}
    }

    // 2. Native OS files / images drop
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      const mentionsList: string[] = [];
      Array.from(e.dataTransfer.files).forEach((file: File) => {
        const filePath = (file as any).path || file.name;
        mentionsList.push(`@[${filePath}]`);
        if (file.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|svg)$/i.test(filePath)) {
          handleImageFileAttached(file);
        }
        if (promptEditorRef.current) {
          promptEditorRef.current.insertPill(filePath, file.name);
        }
      });
      if (promptEditorRef.current) {
        promptEditorRef.current.focus();
        return;
      }
      if (mentionsList.length > 0) {
        insertMentionAtCaret(mentionsList.join(' '), e);
      }
      return;
    }

    // 3. Plain text path
    const plainText = e.dataTransfer.getData('text/plain');
    if (plainText) {
      if (plainText.startsWith('@[') && plainText.endsWith(']')) {
        const path = plainText.slice(2, -1).replace(/^@+/, '');
        if (promptEditorRef.current) {
          promptEditorRef.current.insertPill(path);
          promptEditorRef.current.focus();
          return;
        }
        insertMentionAtCaret(plainText, e);
      } else if (plainText.startsWith('/') || plainText.includes('.') || plainText.startsWith('@')) {
        const cleanText = plainText.trim().replace(/^@+/, '');
        if (promptEditorRef.current) {
          promptEditorRef.current.insertPill(cleanText);
          promptEditorRef.current.focus();
          return;
        }
        insertMentionAtCaret(`@[${cleanText}]`, e);
      } else {
        if (promptEditorRef.current) {
          promptEditorRef.current.insertText(plainText);
          promptEditorRef.current.focus();
          return;
        }
        insertMentionAtCaret(plainText, e);
      }
    }
  }, [insertMentionAtCaret, handleImageFileAttached]);

  const [aiHistory, setAiHistory] = useState<ChatMessageItem[]>([]);
  const [isAiExecuting, setIsAiExecuting] = useState(false);
  const [showThinkingDots, setShowThinkingDots] = useState(false);
  const [atMentionState, setAtMentionState] = useState<{
    isOpen: boolean;
    query: string;
    atPos: number;
    selectedIndex: number;
  }>({
    isOpen: false,
    query: '',
    atPos: -1,
    selectedIndex: 0,
  });

  // Debounce thinking dots so fast responses never flash the dots
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isAiExecuting) {
      timer = setTimeout(() => {
        setShowThinkingDots(true);
      }, 350);
    } else {
      setShowThinkingDots(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isAiExecuting]);
  const [aiNotInstalledAlert, setAiNotInstalledAlert] = useState<{
    modelName: string;
    command: string;
    url: string;
    guide: string;
  } | null>(null);

  const [quotaExceededAlert, setQuotaExceededAlert] = useState<{
    providerName: string;
    modelName: string;
    resetTime: string;
    quotaType: 'diário' | 'semanal';
    dailyResetTime?: string;
    weeklyResetTime?: string;
  } | null>(null);

  // Orchestrator States
  const [isOrchestratorActive, setIsOrchestratorActive] = useState<boolean>(false);
  const [orchestratorTooltipOpen, setOrchestratorTooltipOpen] = useState<boolean>(false);
  const [orchestratedProviders, setOrchestratedProviders] = useState<Record<string, boolean>>({
    claude: true,
    antigravity: true,
    codex: false,
    gemini: false,
    ollama: false,
  });
  const [orchestratorIndex, setOrchestratorIndex] = useState<number>(0);

  // Installed CLIs state (detected via native shell)
  const [installedClis, setInstalledClis] = useState<Record<string, boolean>>({
    claude: true,
    antigravity: false,
    codex: false,
    gemini: false,
    ollama: false,
  });
  const prevInstalledClisRef = useRef<Record<string, boolean>>({});

  // AI CLI Updates state
  const [aiUpdatesAvailable, setAiUpdatesAvailable] = useState<Record<string, { hasUpdate: boolean; currentVersion?: string; latestVersion?: string; updateCommand?: string }>>({
  });
  const notifiedUpdatesRef = useRef<Set<string>>(new Set());

  // AI Auto-update preference state
  const [aiAutoUpdate, setAiAutoUpdate] = useState<boolean>(() => {
    try {
      return localStorage.getItem('ai_auto_update') === 'true';
    } catch {
      return false;
    }
  });
  const autoUpdatingRef = useRef<Set<string>>(new Set());

  // AI CLI Login & OAuth Authorization Code State
  // Chat Sessions & History Popup

  const [chatHistoryModalOpen, setChatHistoryModalOpen] = useState<boolean>(false);
  const [chatHistorySearch, setChatHistorySearch] = useState<string>('');
  const [chatHistorySelectedIndex, setChatHistorySelectedIndex] = useState<number>(0);
  const [chatHistoryShowAllRecent, setChatHistoryShowAllRecent] = useState<boolean>(false);
  const [diskSavedChats, setDiskSavedChats] = useState<Array<{
    id: string;
    title: string;
    provider: string;
    updatedAt: number;
    messageCount: number;
    path: string;
    projectName?: string;
    workspacePath?: string;
    model?: string;
  }>>([]);
  const chatHistoryInputRef = useRef<HTMLInputElement>(null);

  const [chatSessions, setChatSessions] = useState<ChatSessionItem[]>(() => {
    try {
      const saved = localStorage.getItem('ide_ai_chat_sessions');
      if (saved) {
        const parsed: ChatSessionItem[] = JSON.parse(saved);
        return parsed.map((s) => ({
          ...s,
          provider: s.provider || s.history?.find((h) => h.providerId)?.providerId || 'antigravity',
          history: (s.history || [])
            .map((h) => ({
              ...h,
              providerId: h.providerId || s.provider || 'antigravity',
            }))
            .filter((h) => !h.text?.toLowerCase().includes('executando')),
        }));
      }
    } catch {}
    return [
      {
        id: 'session-1',
        title: 'Chat Inicial',
        provider: 'antigravity',
        updatedAt: Date.now() - 1000 * 60 * 10,
        history: [],
      },
    ];
  });
  const [activeChatSessionId, setActiveChatSessionId] = useState<string>('session-1');
  const [chatHistoryPopupOpen, setChatHistoryPopupOpen] = useState<boolean>(false);
  const chatHistoryPopupRef = useRef<HTMLDivElement>(null);
  const [chatActionsMenuOpen, setChatActionsMenuOpen] = useState<boolean>(false);
  const chatActionsMenuRef = useRef<HTMLDivElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const quotaTooltipRef = useRef<HTMLDivElement>(null);
  const headerQuotaTooltipRef = useRef<HTMLDivElement>(null);
  const headerQuotaCloseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const openHeaderQuotaWithGrace = useCallback((pid: string) => {
    if (headerQuotaCloseTimerRef.current) {
      clearTimeout(headerQuotaCloseTimerRef.current);
      headerQuotaCloseTimerRef.current = null;
    }
    setQuotaTooltipProvider(pid);
    setHeaderQuotaTooltipOpen(true);
    logSystemActivity('ide_header', 'hover_ai_quota', pid);
  }, []);

  const closeHeaderQuotaWithGrace = useCallback(() => {
    if (headerQuotaCloseTimerRef.current) {
      clearTimeout(headerQuotaCloseTimerRef.current);
    }
    headerQuotaCloseTimerRef.current = setTimeout(() => {
      setHeaderQuotaTooltipOpen(false);
      headerQuotaCloseTimerRef.current = null;
    }, 350);
  }, []);

  const cancelHeaderQuotaClose = useCallback(() => {
    if (headerQuotaCloseTimerRef.current) {
      clearTimeout(headerQuotaCloseTimerRef.current);
      headerQuotaCloseTimerRef.current = null;
    }
  }, []);

  // Antigravity Chat System Features State
  const [isPermissionsModalOpen, setIsPermissionsModalOpen] = useState<boolean>(false);
  const [clearHistoryConfirmOpen, setClearHistoryConfirmOpen] = useState<boolean>(false);
  const [rejectAllConfirmOpen, setRejectAllConfirmOpen] = useState<boolean>(false);
  const [rejectAllTargetFiles, setRejectAllTargetFiles] = useState<ChangedFileItem[]>([]);
  const [queuedAiMessages, setQueuedAiMessages] = useState<QueuedMessageItem[]>([]);
  const queuedAiMessagesRef = useRef<QueuedMessageItem[]>([]);
  useEffect(() => {
    queuedAiMessagesRef.current = queuedAiMessages;
  }, [queuedAiMessages]);

  const handleRenameChatDirect = (sessionId: string, newTitle: string) => {
    setChatSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle, updatedAt: Date.now() } : s))
    );
    logSystemActivity('ide_ai_chat', 'rename_chat_session', workspacePath ? workspacePath.split('/').pop() || 'Projeto' : 'Projeto', {
      sessionId,
      newTitle,
    });
  };

  const handleConfirmClearChatHistory = () => {
    setAiHistory([]);
    setChatSessions((prev) =>
      prev.map((s) => (s.id === activeChatSessionId ? { ...s, history: [] } : s))
    );
    setClearHistoryConfirmOpen(false);
    setToastMessage('Histórico da conversa limpo');
    logSystemActivity('ide_ai_chat', 'clear_chat_history', workspacePath ? workspacePath.split('/').pop() || 'Projeto' : 'Projeto', {
      sessionId: activeChatSessionId,
    });
  };

  const handleAcceptAllDiffs = (files?: ChangedFileItem[]) => {
    const targetFiles = files || (activeReview ? activeReview.files : []);
    setActiveReview(null);
    setToastMessage('Todas as alterações foram aceitas');
    logSystemActivity('ide_ai_chat', 'accept_all_diffs', workspacePath ? workspacePath.split('/').pop() || 'Projeto' : 'Projeto', {
      filesCount: targetFiles.length,
    });
  };

  const handleRequestRejectAllDiffs = (files?: ChangedFileItem[]) => {
    const targetFiles = files || (activeReview ? activeReview.files : []);
    if (!targetFiles || targetFiles.length === 0) return;
    setRejectAllTargetFiles(targetFiles);
    setRejectAllConfirmOpen(true);
  };

  const handleConfirmRejectAllDiffs = async () => {
    const baseCwd = workspacePath;
    if (!baseCwd || !window.electronAPI?.shell?.exec) return;
    try {
      // Descarta apenas os arquivos alterados pelo agente (rastreados: checkout; novos: clean)
      for (const f of rejectAllTargetFiles) {
        const q = `'${f.path.replace(/'/g, `'\\''`)}'`;
        await window.electronAPI.shell.exec(
          `git ls-files --error-unmatch -- ${q} >/dev/null 2>&1 && git checkout -- ${q} || git clean -f -- ${q}`,
          baseCwd
        );
      }
      await loadWorkspaceTree(baseCwd);
      setActiveReview(null);
      setToastMessage('Todas as alterações do agente foram descartadas');
      logSystemActivity('ide_ai_chat', 'reject_all_diffs', baseCwd.split('/').pop() || 'Projeto', {
        filesCount: rejectAllTargetFiles.length,
      });
    } catch (err: any) {
      setToastMessage(`Erro ao descartar alterações: ${err?.message || ''}`);
    } finally {
      setRejectAllConfirmOpen(false);
    }
  };

  const handleAnswerInteractiveQuestion = (selected: string[], writeIn?: string) => {
    const answerParts = [...selected];
    if (writeIn) answerParts.push(writeIn);
    if (answerParts.length > 0) {
      const text = `Resposta: ${answerParts.join(', ')}`;
      handleAiSubmit(undefined, text);
    }
  };

  // Switch AI Provider and always initiate a brand new chat session so contexts are not mixed
  const handleSwitchAiProvider = (newProviderId: string) => {
    if (newProviderId === selectedAiProvider) return;
    const prevProvider = selectedAiProvider;
    setSelectedAiProvider(newProviderId);

    // Ao trocar de IA (não de modelo), inicia sempre um novo chat para não misturar os contextos
    const newSessionId = 'session-' + Date.now();
    const projectName = workspacePath ? workspacePath.split('/').filter(Boolean).pop() : 'Projeto';
    const newSession: ChatSessionItem = {
      id: newSessionId,
      title: 'Nova Conversa',
      provider: newProviderId,
      updatedAt: Date.now(),
      history: [],
      workspacePath: workspacePath || undefined,
      projectName,
    };

    setChatSessions((prev) => {
      // Preserva conversas anteriores que possuem histórico de mensagens
      const withHistory = prev.filter((s) => s.history && s.history.length > 0);
      return [newSession, ...withHistory];
    });
    setActiveChatSessionId(newSessionId);
    setAiHistory([]);

    logSystemActivity('ide_ai_chat', 'switch_provider_new_chat', newProviderId, {
      previousProvider: prevProvider,
      newSessionId,
      workspacePath,
    });
  };

  // Undo Chat History to point state (Undo changes up to this point)
  const [undoConfirmTarget, setUndoConfirmTarget] = useState<{ index: number; item: ChatMessageItem } | null>(null);
  const [hoveredUndoIdx, setHoveredUndoIdx] = useState<number | null>(null);
  const [hoveredChatMsgIdx, setHoveredChatMsgIdx] = useState<number | null>(null);

  // Auditoria permanente da conversa em <userData>/transcripts/<sessionId>.jsonl
  useEffect(() => {
    if (aiHistory.length === 0 || isAiExecuting) return;
    window.electronAPI?.ai?.saveTranscript?.(activeChatSessionId, aiHistory).catch(() => {});
  }, [aiHistory, activeChatSessionId, isAiExecuting]);

  const handleOpenUndoModal = (index: number) => {
    const item = aiHistory[index];
    if (!item) return;
    setUndoConfirmTarget({ index, item });
  };

  const handleConfirmUndo = () => {
    if (!undoConfirmTarget) return;
    const { index, item } = undoConfirmTarget;

    // Se desfez a partir de uma mensagem de usuário:
    // Trunca o histórico até antes desse ponto e restaura o prompt no input para permitir ajustes/reenvio
    if (item.type === 'user') {
      const truncatedHistory = aiHistory.slice(0, index);
      setAiHistory(truncatedHistory);

      if (item.text) {
        setAskPrompt(item.text);
        promptEditorRef.current?.setValue(item.text);
      }
      if (item.attachedFiles && item.attachedFiles.length > 0) {
        setAttachedFiles(item.attachedFiles);
      }
      if (item.attachedTask) {
        setAttachedTask(item.attachedTask);
      }

      setChatSessions((allSessions) =>
        allSessions.map((s) =>
          s.id === activeChatSessionId
            ? { ...s, history: truncatedHistory, updatedAt: Date.now() }
            : s
        )
      );
    } else {
      // Se foi mensagem do assistente ou erro: reverte o histórico até antes dessa mensagem
      const truncatedHistory = aiHistory.slice(0, index);
      setAiHistory(truncatedHistory);
      setChatSessions((allSessions) =>
        allSessions.map((s) =>
          s.id === activeChatSessionId
            ? { ...s, history: truncatedHistory, updatedAt: Date.now() }
            : s
        )
      );
    }

    logSystemActivity('ide_ai_chat', 'undo_chat_history', `index_${index}`, {
      messageIndex: index,
      messageType: item.type,
      textSnippet: item.text?.slice(0, 60),
      remainingCount: index,
    });

    setToastMessage('Histórico desfeito até este ponto');
    setTimeout(() => setToastMessage(null), 3000);
    setUndoConfirmTarget(null);
  };

  const handleSelectChatSession = (sessionId: string) => {
    const session = chatSessions.find((s) => s.id === sessionId);
    if (session) {
      setActiveChatSessionId(session.id);
      const histWithProviders = (session.history || []).map((h) => ({
        ...h,
        providerId: h.providerId || session.provider || 'antigravity',
      }));
      setAiHistory(histWithProviders);
      const targetProv = session.provider || session.history?.find((h) => h.providerId)?.providerId;
      if (targetProv && targetProv !== selectedAiProvider) {
        setSelectedAiProvider(targetProv);
      }
    }
    setChatHistoryPopupOpen(false);
  };

  const handleCreateNewChatSession = () => {
    const newId = 'session-' + Date.now();
    const newSession: ChatSessionItem = {
      id: newId,
      title: 'Nova Conversa',
      provider: selectedAiProvider,
      updatedAt: Date.now(),
      history: [],
    };
    setChatSessions((prev) => [newSession, ...prev]);
    setActiveChatSessionId(newId);
    setAiHistory([]);
    setChatHistoryPopupOpen(false);
  };

  // Chat sessions ordered most-recent-first (same order shown in the history popup),
  // used to drive Back/Forward navigation between conversations.
  const orderedChatSessions = useMemo(
    () => [...chatSessions].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)),
    [chatSessions]
  );
  const activeChatSessionNavIndex = orderedChatSessions.findIndex((s) => s.id === activeChatSessionId);

  const handleChatSessionBack = () => {
    if (activeChatSessionNavIndex >= 0 && activeChatSessionNavIndex < orderedChatSessions.length - 1) {
      handleSelectChatSession(orderedChatSessions[activeChatSessionNavIndex + 1].id);
    }
  };

  const handleChatSessionForward = () => {
    if (activeChatSessionNavIndex > 0) {
      handleSelectChatSession(orderedChatSessions[activeChatSessionNavIndex - 1].id);
    }
  };

  const handleDeleteChatSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    setChatSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (sessionId === activeChatSessionId) {
        if (filtered.length > 0) {
          setActiveChatSessionId(filtered[0].id);
          setAiHistory(filtered[0].history || []);
        } else {
          const newId = 'session-' + Date.now();
          const newSession: ChatSessionItem = {
            id: newId,
            title: 'Nova Conversa',
            provider: selectedAiProvider,
            updatedAt: Date.now(),
            history: [],
          };
          setActiveChatSessionId(newId);
          setAiHistory([]);
          return [newSession];
        }
      }
      return filtered;
    });
  };

  const [editingChatSessionId, setEditingChatSessionId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState<string>('');

  const handleStartRenameChatSession = (s: ChatSessionItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingChatSessionId(s.id);
    setEditingChatTitle(s.title);
  };

  const handleSaveRenameChatSession = (sessionId: string) => {
    const trimmed = editingChatTitle.trim();
    if (trimmed) {
      setChatSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: trimmed } : s))
      );
    }
    setEditingChatSessionId(null);
    setEditingChatTitle('');
  };

  const handleCancelRenameChatSession = () => {
    setEditingChatSessionId(null);
    setEditingChatTitle('');
  };

  const refreshSavedChats = useCallback(async () => {
    if (window.electronAPI?.ai?.getSavedChats) {
      try {
        const list = await window.electronAPI.ai.getSavedChats();
        setDiskSavedChats(list || []);
      } catch {}
    }
  }, []);

  const handleOpenChatHistoryModal = useCallback(() => {
    setChatHistoryPopupOpen(false);
    setChatActionsMenuOpen(false);
    setChatHistoryModalOpen(true);
    setChatHistorySearch('');
    setChatHistorySelectedIndex(0);
    setChatHistoryShowAllRecent(false);
    refreshSavedChats();
    setTimeout(() => {
      chatHistoryInputRef.current?.focus();
    }, 60);
  }, [refreshSavedChats]);

  const formatTimeAgo = useCallback((timestamp?: number): string => {
    if (!timestamp) return 'recentemente';
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
    if (diffSec < 60) return 'agora';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `há ${diffMin} min`;
    const diffHours = Math.floor(diffMin / 60);
    if (diffHours < 24) return diffHours === 1 ? 'há 1 hora' : `há ${diffHours} horas`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays === 1) return 'ontem';
    if (diffDays < 7) return `há ${diffDays} dias`;
    const diffWeeks = Math.floor(diffDays / 7);
    return diffWeeks === 1 ? 'há 1 semana' : `há ${diffWeeks} semanas`;
  }, []);

  const handleSelectAnySession = useCallback(async (sessionId: string) => {
    const existing = chatSessions.find((s) => s.id === sessionId);
    if (existing) {
      handleSelectChatSession(sessionId);
      setChatHistoryModalOpen(false);
      return;
    }

    if (window.electronAPI?.ai?.loadSavedChat) {
      try {
        const fullSession = await window.electronAPI.ai.loadSavedChat(sessionId);
        if (fullSession) {
          const newSessionItem: ChatSessionItem = {
            id: fullSession.id || sessionId,
            title: fullSession.title || 'Conversa',
            provider: fullSession.provider || 'antigravity',
            updatedAt: fullSession.updatedAt || Date.now(),
            history: fullSession.history || [],
            projectName: fullSession.context?.projectName,
            workspacePath: fullSession.context?.workspacePath,
            model: fullSession.model,
          };
          setChatSessions((prev) => [newSessionItem, ...prev.filter((s) => s.id !== newSessionItem.id)]);
          setActiveChatSessionId(newSessionItem.id);
          setAiHistory(newSessionItem.history || []);
          if (newSessionItem.provider && newSessionItem.provider !== selectedAiProvider) {
            setSelectedAiProvider(newSessionItem.provider);
          }
        }
      } catch {}
    }
    setChatHistoryModalOpen(false);
  }, [chatSessions, selectedAiProvider]);

  const handleDeleteAnySession = useCallback(async (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    handleDeleteChatSession(sessionId);
    if (window.electronAPI?.ai?.deleteSavedChat) {
      await window.electronAPI.ai.deleteSavedChat(sessionId);
    }
    setDiskSavedChats((prev) => prev.filter((d) => d.id !== sessionId));
  }, []);

  // Unified list of all chat sessions (in-memory + saved on disk)
  const allUnifiedSessions = useMemo(() => {
    const map = new Map<string, {
      id: string;
      title: string;
      provider: string;
      updatedAt: number;
      projectName?: string;
      workspacePath?: string;
      model?: string;
      isCurrent?: boolean;
      isRunning?: boolean;
    }>();

    // 1. In-memory sessions
    chatSessions.forEach((s) => {
      const pName =
        s.projectName ||
        (s.workspacePath ? s.workspacePath.split('/').filter(Boolean).pop() : undefined) ||
        (workspacePath ? workspacePath.split('/').filter(Boolean).pop() : 'Projeto');

      map.set(s.id, {
        id: s.id,
        title: s.title || 'Nova Conversa',
        provider: s.provider || 'antigravity',
        updatedAt: s.updatedAt || Date.now(),
        projectName: pName,
        workspacePath: s.workspacePath || workspacePath,
        model: s.model,
        isCurrent: s.id === activeChatSessionId,
        isRunning: isAiExecuting && s.id === activeChatSessionId,
      });
    });

    // 2. Disk saved sessions
    diskSavedChats.forEach((d) => {
      const existing = map.get(d.id);
      if (!existing) {
        map.set(d.id, {
          id: d.id,
          title: d.title || 'Conversa',
          provider: d.provider || 'antigravity',
          updatedAt: d.updatedAt || Date.now(),
          projectName: d.projectName || (d.workspacePath ? d.workspacePath.split('/').filter(Boolean).pop() : 'Projeto'),
          workspacePath: d.workspacePath,
          model: d.model,
          isCurrent: d.id === activeChatSessionId,
          isRunning: false,
        });
      } else {
        if (d.projectName && !existing.projectName) existing.projectName = d.projectName;
        if (d.model && !existing.model) existing.model = d.model;
        if (d.updatedAt && d.updatedAt > existing.updatedAt) existing.updatedAt = d.updatedAt;
      }
    });

    return Array.from(map.values());
  }, [chatSessions, diskSavedChats, activeChatSessionId, isAiExecuting, workspacePath]);

  const filteredConvos = useMemo(() => {
    const q = chatHistorySearch.trim().toLowerCase();
    if (!q) return allUnifiedSessions;
    return allUnifiedSessions.filter((s) =>
      s.title.toLowerCase().includes(q) ||
      (s.projectName && s.projectName.toLowerCase().includes(q)) ||
      s.provider.toLowerCase().includes(q)
    );
  }, [allUnifiedSessions, chatHistorySearch]);

  const currentConvo = useMemo(() => {
    if (chatHistorySearch.trim()) return undefined;
    return filteredConvos.find((s) => s.isCurrent);
  }, [filteredConvos, chatHistorySearch]);

  const runningConvos = useMemo(() => {
    return filteredConvos.filter((s) => s.isRunning && s.id !== currentConvo?.id);
  }, [filteredConvos, currentConvo]);

  const recentConvos = useMemo(() => {
    return filteredConvos
      .filter((s) => s.id !== currentConvo?.id && !s.isRunning)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [filteredConvos, currentConvo]);

  const visibleRecentConvos = useMemo(() => {
    if (chatHistoryShowAllRecent || chatHistorySearch.trim()) {
      return recentConvos;
    }
    return recentConvos.slice(0, 4);
  }, [recentConvos, chatHistoryShowAllRecent, chatHistorySearch]);

  const selectableConvosList = useMemo(() => {
    const list: typeof allUnifiedSessions = [];
    if (currentConvo) list.push(currentConvo);
    runningConvos.forEach((s) => list.push(s));
    visibleRecentConvos.forEach((s) => list.push(s));
    return list;
  }, [currentConvo, runningConvos, visibleRecentConvos]);

  const handleChatHistoryKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setChatHistoryModalOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setChatHistorySelectedIndex((prev) =>
        selectableConvosList.length > 0 ? (prev + 1) % selectableConvosList.length : 0
      );
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setChatHistorySelectedIndex((prev) =>
        selectableConvosList.length > 0 ? (prev - 1 + selectableConvosList.length) % selectableConvosList.length : 0
      );
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      const target = selectableConvosList[chatHistorySelectedIndex];
      if (target) {
        handleSelectAnySession(target.id);
      }
      return;
    }
  };

  // Save chat session locally on disk with rich context (project, files, branch, provider, model)
  const handleSaveCurrentChatLocally = useCallback(async (sessionId?: string) => {
    const targetId = sessionId || activeChatSessionId;
    const session = chatSessions.find((s) => s.id === targetId);
    if (!session) return;

    const msgs = targetId === activeChatSessionId && aiHistory.length > 0 ? aiHistory : (session.history || []);
    if (msgs.length === 0) {
      setToastMessage('Nenhuma mensagem na conversa para salvar.');
      return;
    }

    const payload = {
      id: session.id,
      title: session.title || 'Conversa',
      provider: session.provider || selectedAiProvider,
      model: activeModels[selectedAiProvider]?.currentModel || selectedAiProvider,
      createdAt: session.updatedAt || Date.now(),
      updatedAt: Date.now(),
      context: {
        workspacePath,
        projectName: workspacePath ? workspacePath.split('/').filter(Boolean).pop() : 'Projeto',
        currentBranch: currentBranch || 'main',
        activeFilePath: activeFile?.path || activeFile?.name || '',
        openTabs: openFiles.map((t) => t.name || t.path),
        provider: session.provider || selectedAiProvider,
        model: activeModels[selectedAiProvider]?.currentModel || selectedAiProvider,
      },
      history: msgs,
    };

    if (window.electronAPI?.ai?.saveChatLocally) {
      const res = await window.electronAPI.ai.saveChatLocally(payload);
      if (res && res.success) {
        setToastMessage('Conversa salva em ~/.devflow/chats/!');
      } else {
        setToastMessage(res?.error ? 'Erro: ' + res.error : 'Erro ao salvar histórico localmente.');
      }
    } else {
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Chat-' + payload.provider + '-' + payload.id + '.json';
      a.click();
      URL.revokeObjectURL(url);
      setToastMessage('Conversa baixada localmente!');
    }
  }, [activeChatSessionId, chatSessions, aiHistory, selectedAiProvider, activeModels, selectedModel, workspacePath, currentBranch, activeFile, openFiles]);

  // Export chat session dialog (Markdown or JSON)
  const handleExportChat = useCallback(async (sessionId?: string, format: 'markdown' | 'json' = 'markdown') => {
    const targetId = sessionId || activeChatSessionId;
    const session = chatSessions.find((s) => s.id === targetId);
    if (!session) return;

    const msgs = targetId === activeChatSessionId && aiHistory.length > 0 ? aiHistory : (session.history || []);
    if (msgs.length === 0) {
      setToastMessage('Nenhuma mensagem na conversa para exportar.');
      return;
    }

    const payload = {
      id: session.id,
      title: session.title || 'Conversa',
      provider: session.provider || selectedAiProvider,
      model: activeModels[selectedAiProvider]?.currentModel || selectedAiProvider,
      createdAt: session.updatedAt || Date.now(),
      updatedAt: Date.now(),
      context: {
        workspacePath,
        projectName: workspacePath ? workspacePath.split('/').filter(Boolean).pop() : 'Projeto',
        currentBranch: currentBranch || 'main',
        activeFilePath: activeFile?.path || activeFile?.name || '',
        openTabs: openFiles.map((t) => t.name || t.path),
        provider: session.provider || selectedAiProvider,
        model: activeModels[selectedAiProvider]?.currentModel || selectedAiProvider,
      },
      history: msgs,
    };

    if (window.electronAPI?.ai?.exportChatDialog) {
      const res = await window.electronAPI.ai.exportChatDialog(payload, format);
      if (res && res.success && res.filePath) {
        setToastMessage('Conversa exportada para: ' + res.filePath.split('/').pop());
      }
    } else {
      const content = format === 'markdown'
        ? `# ${payload.title}\n\nData: ${new Date().toLocaleString()}\nProjeto: ${payload.context.projectName}\n\n` + msgs.map((m: any) => `### ${m.role === 'user' ? 'Usuário' : 'Assistente'}\n\n${m.text}`).join('\n\n---\n\n')
        : JSON.stringify(payload, null, 2);
      const blob = new Blob([content], { type: format === 'markdown' ? 'text/markdown' : 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Chat-' + payload.title.replace(/[^a-zA-Z0-9_-]/g, '_') + '.' + (format === 'markdown' ? 'md' : 'json');
      a.click();
      URL.revokeObjectURL(url);
      setToastMessage('Conversa exportada!');
    }
  }, [activeChatSessionId, chatSessions, aiHistory, selectedAiProvider, activeModels, selectedModel, workspacePath, currentBranch, activeFile, openFiles]);

  const [expandedWorkedMap, setExpandedWorkedMap] = useState<Record<number, boolean>>({});
  const [collapsedDiffMap, setCollapsedDiffMap] = useState<Record<number, boolean>>({});
  const [expandedStepGroupsMap, setExpandedStepGroupsMap] = useState<Record<string, boolean>>({});
  const [liveExecutionSteps, setLiveExecutionSteps] = useState<ExecutionStepItem[]>([]);
  const [liveWorkedDuration, setLiveWorkedDuration] = useState<string>('0s');
  const [isLiveWorkedExpanded, setIsLiveWorkedExpanded] = useState<boolean>(true);
  const [liveCurrentAction, setLiveCurrentAction] = useState<string>('');
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);

  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgIdx(idx);
    setTimeout(() => {
      setCopiedMsgIdx((curr) => (curr === idx ? null : curr));
    }, 2000);
  };

  const renderFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'tsx' || ext === 'jsx') {
      return (
        <svg
          width={14}
          height={14}
          viewBox="-11.5 -10.23174 23 20.46348"
          fill="none"
          style={{ flexShrink: 0, display: 'inline-block', verticalAlign: 'middle' }}
          title="React"
        >
          <circle cx="0" cy="0" r="2.05" fill="#38bdf8" />
          <g stroke="#38bdf8" strokeWidth="1.1" fill="none">
            <ellipse rx="11" ry="4.2" />
            <ellipse rx="11" ry="4.2" transform="rotate(60)" />
            <ellipse rx="11" ry="4.2" transform="rotate(120)" />
          </g>
        </svg>
      );
    }
    if (ext === 'css' || ext === 'scss') {
      return (
        <span
          style={{
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: 13,
            color: '#38bdf8',
            flexShrink: 0,
            lineHeight: 1,
            letterSpacing: -0.5,
            display: 'inline-flex',
            alignItems: 'center',
          }}
          title="CSS"
        >
          {'{ }'}
        </span>
      );
    }
    if (ext === 'ts') {
      return (
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            background: '#3b82f6',
            color: '#fff',
            padding: '1px 3px',
            borderRadius: 2,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          TS
        </span>
      );
    }
    if (ext === 'js') {
      return (
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            background: '#eab308',
            color: '#000',
            padding: '1px 3px',
            borderRadius: 2,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          JS
        </span>
      );
    }
    if (ext === 'json') {
      return (
        <span
          style={{
            fontFamily: 'monospace',
            fontWeight: 700,
            fontSize: 13,
            color: '#f59e0b',
            flexShrink: 0,
            lineHeight: 1,
            letterSpacing: -0.5,
            display: 'inline-flex',
            alignItems: 'center',
          }}
          title="JSON"
        >
          {'{ }'}
        </span>
      );
    }
    if (ext === 'svg') {
      return (
        <span
          style={{
            fontSize: 9.5,
            fontWeight: 700,
            background: '#a855f7',
            color: '#fff',
            padding: '1px 3px',
            borderRadius: 2,
            lineHeight: 1,
            display: 'inline-flex',
            alignItems: 'center',
          }}
        >
          SVG
        </span>
      );
    }
    return <FileText size={13} style={{ color: '#9ca3af' }} />;
  };

  const renderExecutionTimelineSteps = (
    steps: ExecutionStepItem[],
    prefixKey: string,
    onOpenFileAction?: (path: string, name: string) => void
  ) => {
    return steps.map((step, sIdx) => {
      const stepKey = `${prefixKey}-${sIdx}-${step.id || step.file || step.label}`;
      const hasChildren = Boolean(step.children && step.children.length > 0);
      const isStepExpanded = expandedStepGroupsMap[stepKey] ?? (step.isExpanded ?? false);

      if (step.type === 'edit') {
        return (
          <div
            key={stepKey}
            onClick={() => {
              if (step.path || step.file) {
                const p = step.path || step.file!;
                onOpenFileAction?.(p, p.split('/').pop() || p);
              }
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 13,
              color: themeTokens.textPrimary,
              cursor: step.path || step.file ? 'pointer' : 'default',
              padding: '3px 6px',
              borderRadius: 6,
              transition: 'all 0.15s ease',
              fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
              width: 'fit-content',
            }}
            onMouseEnter={(e) => {
              if (step.path || step.file) {
                e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <span style={{ color: '#9ca3af', fontWeight: 400 }}>Edited</span>
            {renderFileIcon(step.file || 'Arquivo')}
            <span style={{ fontWeight: 500, color: themeTokens.textPrimary }}>
              {step.file || 'Arquivo'}
            </span>
            {step.additions !== undefined && (
              <span
                style={{
                  color: '#22c55e',
                  fontSize: 12,
                  fontWeight: 500,
                  marginLeft: 2,
                  fontFamily: 'monospace',
                }}
              >
                +{step.additions}
              </span>
            )}
            {step.deletions !== undefined && (
              <span
                style={{
                  color: '#ef4444',
                  fontSize: 12,
                  fontWeight: 500,
                  fontFamily: 'monospace',
                }}
              >
                -{step.deletions}
              </span>
            )}
          </div>
        );
      }

      if (step.type === 'explore' || step.type === 'search') {
        return (
          <div
            key={stepKey}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              width: '100%',
            }}
          >
            <div
              onClick={() => {
                if (hasChildren) {
                  setExpandedStepGroupsMap((prev) => ({
                    ...prev,
                    [stepKey]: !isStepExpanded,
                  }));
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 13,
                color: isStepExpanded && hasChildren ? themeTokens.textPrimary : '#9ca3af',
                cursor: hasChildren ? 'pointer' : 'default',
                padding: isStepExpanded && hasChildren ? '4px 8px' : '2px 4px',
                borderRadius: 6,
                background: isStepExpanded && hasChildren ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)') : 'transparent',
                transition: 'all 0.15s ease',
                width: 'fit-content',
                maxWidth: '100%',
              }}
              onMouseEnter={(e) => {
                if (hasChildren && !isStepExpanded) {
                  e.currentTarget.style.color = themeTokens.textPrimary;
                }
              }}
              onMouseLeave={(e) => {
                if (hasChildren && !isStepExpanded) {
                  e.currentTarget.style.color = '#9ca3af';
                }
              }}
            >
              <span>{step.label}</span>
              {hasChildren ? (
                isStepExpanded ? <ChevronDown size={13} style={{ color: '#9ca3af' }} /> : <ChevronRight size={13} style={{ color: '#9ca3af' }} />
              ) : (
                <ChevronRight size={13} style={{ color: '#6b7280' }} />
              )}
            </div>

            {hasChildren && isStepExpanded && (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  paddingLeft: 16,
                  paddingTop: 2,
                  paddingBottom: 2,
                }}
              >
                {step.children!.map((child, cIdx) => {
                  const childKey = `${stepKey}-child-${cIdx}`;
                  if (child.type === 'analyze') {
                    return (
                      <div
                        key={childKey}
                        onClick={() => {
                          if (child.path || child.file) {
                            const p = child.path || child.file!;
                            onOpenFileAction?.(p, p.split('/').pop() || p);
                          }
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 12.5,
                          color: themeTokens.textPrimary,
                          cursor: child.path || child.file ? 'pointer' : 'default',
                          padding: '1px 4px',
                          borderRadius: 4,
                          width: 'fit-content',
                          transition: 'background 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (child.path || child.file) {
                            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span style={{ color: '#9ca3af', fontWeight: 400 }}>Analisou</span>
                        {child.file && renderFileIcon(child.file)}
                        <span style={{ fontWeight: 500, color: themeTokens.textPrimary }}>
                          {child.file || child.label}
                        </span>
                        {child.lineRange && (
                          <span style={{ color: '#6b7280', fontSize: 12, fontFamily: 'monospace' }}>
                            {child.lineRange}
                          </span>
                        )}
                      </div>
                    );
                  }
                  if (child.type === 'thought') {
                    return (
                      <div
                        key={childKey}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontSize: 12.5,
                          color: '#9ca3af',
                          padding: '1px 4px',
                        }}
                      >
                        <span>{child.label || `Pensou por ${child.duration || '1s'}`}</span>
                        <ChevronRight size={12} style={{ color: '#6b7280' }} />
                      </div>
                    );
                  }
                  return (
                    <div
                      key={childKey}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        fontSize: 12.5,
                        color: '#9ca3af',
                        padding: '1px 4px',
                      }}
                    >
                      <span>{child.label}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      }

      if (step.type === 'run') {
        return (
          <div
            key={stepKey}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              color: themeTokens.textPrimary,
              padding: '2px 4px',
            }}
          >
            <span style={{ color: '#9ca3af' }}>Ran</span>
            <span style={{ fontFamily: 'monospace', fontWeight: 500, color: themeTokens.textPrimary }}>
              {step.command || step.label}
            </span>
            <ChevronDown size={13} style={{ color: '#6b7280', marginLeft: 2 }} />
          </div>
        );
      }

      return (
        <div
          key={stepKey}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            color: '#9ca3af',
            padding: '2px 4px',
          }}
        >
          <span>{step.label}</span>
          <ChevronRight size={13} style={{ color: '#6b7280', marginLeft: 2 }} />
        </div>
      );
    });
  };

  const aiTerminalScrollRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Panel & Layout Visibility Controls (Antigravity & VS Code Customize Layout)
  const [showExplorer, setShowExplorer] = useState(true);
  const [activeActivityTab, setActiveActivityTab] = useState<'explorer' | 'search' | 'git' | 'debug' | 'preview' | 'testing'>('explorer');
  const [previewTabUrl, setPreviewTabUrl] = useState<string | null>(null);
  const [previewTabActive, setPreviewTabActive] = useState(false);
  const [gitModifiedCount, setGitModifiedCount] = useState<number>(0);

  useEffect(() => {
    let isCancelled = false;
    const fetchGitCount = async () => {
      if (!workspacePath || !window.electronAPI?.shell?.exec) return;
      try {
        const res = await window.electronAPI.shell.exec('git status --porcelain=v1', workspacePath);
        if (!isCancelled && res?.stdout) {
          const lines = res.stdout.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
          setGitModifiedCount(lines.length);
        } else if (!isCancelled && res && res.exitCode === 0) {
          setGitModifiedCount(0);
        }
      } catch {}
    };

    fetchGitCount();
    const timer = setInterval(fetchGitCount, 4000);
    return () => {
      isCancelled = true;
      clearInterval(timer);
    };
  }, [workspacePath]);
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [showActivityBar, setShowActivityBar] = useState(true);
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [sidebarPosition, setSidebarPosition] = useState<'left' | 'right'>('left');
  const [panelAlignment, setPanelAlignment] = useState<'left' | 'right' | 'center' | 'justify'>(() => {
    return (localStorage.getItem('ide_panel_alignment') as any) || 'justify';
  });
  const [quickInputPosition, setQuickInputPosition] = useState<'top' | 'center'>('center');
  const [isZenMode, setIsZenMode] = useState(false);
  const zenChordPendingRef = useRef(false);
  const zenChordTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isCenteredLayout, setIsCenteredLayout] = useState(false);
  const [isCustomizeLayoutOpen, setIsCustomizeLayoutOpen] = useState(false);
  const customizeLayoutRef = useRef<HTMLDivElement>(null);

  // Quick Open / Command Palette State (VS Code & Antigravity Style)
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState('');
  const [quickOpenSelectedIndex, setQuickOpenSelectedIndex] = useState(0);
  const quickOpenInputRef = useRef<HTMLInputElement>(null);
  const quickOpenContainerRef = useRef<HTMLDivElement>(null);

  // Settings & Theme Styling State (VS Code & Antigravity Style)
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [isHeaderAiMenuOpen, setIsHeaderAiMenuOpen] = useState(false);
  // IAs fixadas no cabeçalho (acompanhar o uso de várias); a selecionada sempre aparece
  const [pinnedAis, setPinnedAis] = useState<string[]>(() => {
    try { const v = JSON.parse(localStorage.getItem('header_pinned_ais') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
  });
  const [quotaTooltipProvider, setQuotaTooltipProvider] = useState<string | null>(null);
  const [sidesheetFromList, setSidesheetFromList] = useState(false);
  // servidores (dev server) rodando a partir da pasta do projeto: link para abrir no navegador + encerrar
  const [hoveredServerKey, setHoveredServerKey] = useState<string | null>(null);
  const [projectServers, setProjectServers] = useState<Array<{ port: number; pid: string; url: string; serviceName?: string }>>([]);
  // comando para subir o projeto: detectado pelo gerenciador (packageManager/lockfile) e pelo script dev/start, ou outra stack
  const [devStartCommand, setDevStartCommand] = useState<string | null>(null);
  const [startingServer, setStartingServer] = useState(false);
  const startingSessionRef = useRef<string | null>(null);
  const devExitWatchRef = useRef<(() => void) | null>(null); // cancela a escuta do código de saída do comando do play
  const devSessionRef = useRef<string | null>(null); // terminal do último projeto iniciado pelo play (para acompanhar a saída)
  // opções do menu do play: gerenciador detectado, scripts do package.json e comandos de outras stacks
  const [devOptions, setDevOptions] = useState<{ pm: PackageManager; scripts: string[]; others: Array<{ command: string; label: string }> } | null>(null);
  const [devMenuOpen, setDevMenuOpen] = useState(false);
  const [devMenuPm, setDevMenuPm] = useState<PackageManager>('npm');
  const [devForce, setDevForce] = useState<boolean>(() => localStorage.getItem('dev_run_force') === 'true');
  useEffect(() => { try { localStorage.setItem('dev_run_force', String(devForce)); } catch {} }, [devForce]);
  useEffect(() => {
    setDevStartCommand(null);
    setDevOptions(null);
    setDevMenuOpen(false);
    if (!workspacePath) return;
    let alive = true;
    (async () => {
      try {
        const root = workspacePath.replace(/\/$/, '');
        const read = async (name: string) => { try { const r = await window.electronAPI.fs.readFile(`${root}/${name}`); return r.error ? undefined : r.content; } catch { return undefined; } };
        const ls = await window.electronAPI.shell.exec('ls -A1', workspacePath);
        const rootFiles = (ls.stdout || '').split('\n').map((l) => l.trim()).filter(Boolean);
        // data de modificação dos locks (bun.lock x package-lock.json...): o gerenciador usado por último vence
        const lockMtimes: Record<string, number> = {};
        const lockNames = rootFiles.filter((f) => /^(bun\.lockb?|pnpm-lock\.yaml|yarn\.lock|package-lock\.json|npm-shrinkwrap\.json)$/.test(f));
        if (lockNames.length > 1) {
          const st = await window.electronAPI.shell.exec(`stat -f '%m %N' ${lockNames.map((f) => `'${f}'`).join(' ')}`, workspacePath);
          for (const line of (st.stdout || '').split('\n')) { const m = /^(\d+) (.+)$/.exec(line.trim()); if (m) lockMtimes[m[2]] = Number(m[1]); }
        }
        const found = detectDevCommand({
          lockMtimes,
          rootFiles,
          packageJsonText: await read('package.json'),
          denoJsonText: rootFiles.includes('deno.json') ? await read('deno.json') : rootFiles.includes('deno.jsonc') ? await read('deno.jsonc') : undefined,
          makefileText: rootFiles.includes('Makefile') ? await read('Makefile') : undefined,
        });
        const pkgText = await read('package.json');
        const denoText = rootFiles.includes('deno.json') ? await read('deno.json') : rootFiles.includes('deno.jsonc') ? await read('deno.jsonc') : undefined;
        const makeText = rootFiles.includes('Makefile') ? await read('Makefile') : undefined;
        const scripts = listScripts(pkgText);
        const others = otherCommands({ rootFiles, denoJsonText: denoText, makefileText: makeText });
        const pm = detectPackageManager({ rootFiles, packageJsonText: pkgText, lockMtimes });
        if (alive) {
          setDevStartCommand(found?.command ?? null);
          setDevOptions(scripts.length || others.length ? { pm, scripts, others } : null);
          setDevMenuPm(pm);
        }
      } catch {}
    })();
    return () => { alive = false; };
  }, [workspacePath]);
  useEffect(() => { if (projectServers.length > 0) setStartingServer(false); }, [projectServers.length]);
  // abre o terminal da IDE na sessão do projeto iniciado pelo play, para acompanhar o que está acontecendo
  const openDevTerminal = () => {
    const id = devSessionRef.current;
    if (!id || !terminalSessions.some((t) => t.id === id)) {
      setToastMessage('Nenhum terminal do projeto para acompanhar');
      setTimeout(() => setToastMessage(null), 2200);
      return;
    }
    setActiveTab('ide');
    setIsTerminalCollapsed(false);
    setActiveTermTab('terminal');
    setActiveSessionId(id);
  };

  // sobe o projeto com o comando escolhido num terminal da IDE; o processo inicia já, de qualquer tela
  const startProject = (command: string) => {
    setDevMenuOpen(false);
    setStartingServer(true);
    const sid = handleNewTerminalSession('zsh', `dev · ${workspacePath.split('/').filter(Boolean).pop() || 'projeto'}`, command) as string;
    startingSessionRef.current = sid;
    devSessionRef.current = sid;
    // o terminal da IDE só monta (e inicia o shell) quando a aba da IDE está aberta; quando montar depois, reaproveita esta sessão
    // Erros: o shell avisa o código de saída de cada comando (sequência invisível). O 1º aviso é do prompt inicial; o 2º é do comando.
    devExitWatchRef.current?.();
    let markers = 0;
    let tail = '';
    const stopWatch = window.electronAPI.pty.onData((payload: { id: string; data: string }) => {
      if (payload.id !== sid) return;
      tail = (tail + payload.data).slice(-6000);
      const re = /\x1b\]777;devflow-exit;(\d+)\x07/;
      for (let m = re.exec(tail); m; m = re.exec(tail)) {
        markers += 1;
        if (markers < 2) {
          tail = tail.slice(m.index + m[0].length); // descarta o aviso do prompt inicial e o que veio antes
          continue;
        }
        const code = Number(m[1]);
        const text = tail.slice(0, m.index).replace(/\x1b\][^\x07]*\x07/g, '').replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, '').replace(/\r/g, '');
        const lines = text.split('\n').map((l) => l.replace(/[\u2800-\u28FF]/g, '').trim()).filter((l) => l && !/^\$ /.test(l)); // sem os giradores de progresso do npm
        const reason = [...lines].reverse().find((l) => /error|erro|failed|falha|cannot|não foi possível|EADDRINUSE|ENOENT|not found/i.test(l)) || lines[lines.length - 1] || '';
        stopWatch?.();
        devExitWatchRef.current = null;
        startingSessionRef.current = null;
        setStartingServer(false);
        // 130/143: interrompido pelo usuário (Ctrl+C ou cancelar)
        if (code !== 0 && code !== 130 && code !== 143) {
          setToastMessage(`Não foi possível rodar "${command}" (código ${code})${reason ? `: ${reason.slice(0, 220)}` : ''}`);
          setTimeout(() => setToastMessage(null), 9000);
        } else if (code === 0) {
          setToastMessage(`"${command}" terminou`);
          setTimeout(() => setToastMessage(null), 3500);
        }
        return;
      }
    });
    devExitWatchRef.current = stopWatch || null;
    (async () => {
      try {
        await window.electronAPI.pty.create(sid, 'zsh', workspacePath, 100, 30, accentColor);
        window.electronAPI.pty.write(sid, `${command}\r`);
      } catch (err) {
        stopWatch?.();
        setStartingServer(false);
        setToastMessage('Não consegui iniciar o projeto');
        setTimeout(() => setToastMessage(null), 2500);
      }
    })();
    setToastMessage(`Iniciando: ${command}`);
    setTimeout(() => setToastMessage(null), 2500);
    setTimeout(() => setStartingServer(false), 45000);
  };


  useEffect(() => {
    if (!workspacePath || !window.electronAPI?.ports?.scanProject) { setProjectServers([]); return; }
    let alive = true;
    const poll = async () => {
      if (document.hidden) return;
      try {
        const r = await window.electronAPI.ports.scanProject!(workspacePath);
        if (!alive) return;
        const next = (r?.ports || []).slice(0, 3).map((p) => ({ port: p.port, pid: String(p.pid), url: p.url, serviceName: p.serviceName }));
        setProjectServers((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
      } catch {}
    };
    setProjectServers([]);
    poll();
    const timer = setInterval(poll, 8000);
    return () => { alive = false; clearInterval(timer); };
  }, [workspacePath]);
  // limite diário do Claude (a semana ÷ dias que faltam): recalculado a cada leitura da quota, o dia vira o ponto de partida
  const [claudeDaily, setClaudeDaily] = useState<DailyBudget | null>(null);
  const claudeWeekly = aiQuotas.claude?.weeklyPercent;
  const claudeWeeklyReset = aiQuotas.claude?.weeklyResetTime;
  useEffect(() => {
    if (typeof claudeWeekly !== 'number') return;
    let prev: DailyBudgetState | null = null;
    try { prev = JSON.parse(localStorage.getItem('claude_daily_budget') || 'null'); } catch {}
    const now = new Date();
    const res = computeDailyBudget(prev, claudeWeekly, parseResetTimestamp(claudeWeeklyReset, now), now);
    try { localStorage.setItem('claude_daily_budget', JSON.stringify(res.state)); } catch {}
    setClaudeDaily(res);
  }, [claudeWeekly, claudeWeeklyReset]);
  const togglePinnedAi = (id: string) => setPinnedAis((prev) => {
    // a IA selecionada já aparecia no cabeçalho sem estar fixada: ao fixar a primeira outra, ela fica fixada também (senão sumiria ao trocar)
    const base = prev.length === 0 && id !== selectedAiProvider ? [selectedAiProvider] : prev;
    const next = base.includes(id) ? base.filter((x) => x !== id) : [...base, id];
    try { localStorage.setItem('header_pinned_ais', JSON.stringify(next)); } catch {}
    return next;
  });
  // Skills do DevFlow: modal e contador de ativas no header
  const [isSkillsModalOpen, setIsSkillsModalOpen] = useState(false);
  const [isAiGlobalRulesModalOpen, setIsAiGlobalRulesModalOpen] = useState(false);
  const [isBrainModalOpen, setIsBrainModalOpen] = useState(false);
  const [activeSkills, setActiveSkills] = useState<Array<{ id: string; name: string }>>([]);
  useEffect(() => {
    const load = async () => {
      const res = await window.electronAPI?.skills?.call('summary');
      if (res?.success) setActiveSkills(res.data.active || []);
    };
    load();
    return window.electronAPI?.skills?.onChanged?.(load);
  }, []);
  const [headerAiSubmenuProvider, setHeaderAiSubmenuProvider] = useState<string | null>(null);
  const [headerAiVersionMenuModel, setHeaderAiVersionMenuModel] = useState<string | null>(null);
  const [headerAiVersionMenuTop, setHeaderAiVersionMenuTop] = useState<number>(0);
  const headerAiMenuRef = useRef<HTMLDivElement>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState<SettingsTabId>('general');

  // Minimalist Draggable Theme Popup State
  const [isThemePopupOpen, setIsThemePopupOpen] = useState(false);
  const [themePopupPos, setThemePopupPos] = useState({ x: 0, y: 0 });
  const [isDraggingThemePopup, setIsDraggingThemePopup] = useState(false);
  const themePopupDragRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);

  const openThemePopup = () => {
    setIsSettingsMenuOpen(false);
    setIsSettingsModalOpen(false);
    if (themePopupPos.x === 0 && themePopupPos.y === 0) {
      setThemePopupPos({
        x: Math.max(20, window.innerWidth - 410),
        y: 65,
      });
    }
    setIsThemePopupOpen((prev) => !prev);
  };

  const handleThemePopupMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    themePopupDragRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: themePopupPos.x,
      startY: themePopupPos.y,
    };
    setIsDraggingThemePopup(true);
  };

  useEffect(() => {
    if (!isDraggingThemePopup) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!themePopupDragRef.current) return;
      const dx = e.clientX - themePopupDragRef.current.mouseX;
      const dy = e.clientY - themePopupDragRef.current.mouseY;
      const popupWidth = 380;
      const popupHeight = 350;
      const newX = Math.max(8, Math.min(window.innerWidth - popupWidth - 8, themePopupDragRef.current.startX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - popupHeight - 8, themePopupDragRef.current.startY + dy));
      setThemePopupPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDraggingThemePopup(false);
      themePopupDragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingThemePopup]);
  const [baseAccentColor, setAccentColor] = useState<string>(() => {
    return localStorage.getItem('ide_accent_color') || '#FF6A00';
  });
  // opção: o destaque do sistema segue a cor da IA selecionada no cabeçalho
  const [useAiSystemAccent, setUseAiSystemAccent] = useState<boolean>(() => localStorage.getItem('ide_use_ai_system_accent') === 'true');
  useEffect(() => {
    try { localStorage.setItem('ide_use_ai_system_accent', String(useAiSystemAccent)); } catch {}
  }, [useAiSystemAccent]);
  // destaque rainbow: percorre as cores (pontos) em loop, como um efeito RGB
  const [rainbow, setRainbow] = useState<{ on: boolean; stops: string[]; speed: number }>(() => {
    try {
      const r = JSON.parse(localStorage.getItem('ide_accent_rainbow') || 'null');
      if (r && Array.isArray(r.stops) && r.stops.length >= 2) return { on: !!r.on, stops: r.stops, speed: Number(r.speed) > 0 ? Number(r.speed) : 10 };
    } catch {}
    return { on: false, stops: ['#EF4444', '#EAB308', '#10B981', '#3B82F6', '#A855F7'], speed: 10 };
  });
  useEffect(() => {
    try { localStorage.setItem('ide_accent_rainbow', JSON.stringify(rainbow)); } catch {}
  }, [rainbow]);
  const [rainbowColor, setRainbowColor] = useState<string>(rainbow.stops[0]);
  useEffect(() => {
    if (!rainbow.on) return;
    const rgbs = rainbow.stops.map(hexToRgb);
    const tick = () => {
      const pos = ((Date.now() / (rainbow.speed * 1000)) % 1) * rgbs.length;
      const i = Math.floor(pos);
      const f = pos - i;
      const a = rgbs[i % rgbs.length];
      const b = rgbs[(i + 1) % rgbs.length];
      setRainbowColor(rgbToHex(...([0, 1, 2].map((k) => Math.round(a[k] + (b[k] - a[k]) * f)) as [number, number, number])));
    };
    tick();
    const t = setInterval(tick, 150);
    return () => clearInterval(t);
  }, [rainbow]);
  const accentColor = rainbow.on ? rainbowColor : useAiSystemAccent ? (AI_BRAND_COLORS[selectedAiProvider] || baseAccentColor) : baseAccentColor;
  const accentTextColor = getContrastTextColor(accentColor);
  const chatAccentColor = useAiChatThemeColor
    ? (AI_BRAND_COLORS[selectedAiProvider] || accentColor)
    : accentColor;
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'system'>(() => {
    return (localStorage.getItem('ide_theme_mode') as any) || 'dark';
  });
  const [editorFontSize, setEditorFontSize] = useState<number>(() => {
    const s = localStorage.getItem('ide_editor_font_size');
    return s ? Number(s) : 13;
  });
  const [editorTabSize, setEditorTabSize] = useState<number>(() => {
    const s = localStorage.getItem('ide_editor_tab_size');
    return s ? Number(s) : 2;
  });
  const [editorMinimap, setEditorMinimap] = useState<boolean>(() => {
    return localStorage.getItem('ide_editor_minimap') !== 'false';
  });
  const [editorWordWrap, setEditorWordWrap] = useState<boolean>(() => {
    return localStorage.getItem('ide_editor_word_wrap') === 'true';
  });
  const [editorLineNumbers, setEditorLineNumbers] = useState<boolean>(() => {
    return localStorage.getItem('ide_editor_line_numbers') !== 'false';
  });
  const [editorRenderWhitespace, setEditorRenderWhitespace] = useState<boolean>(() => {
    return localStorage.getItem('ide_editor_render_whitespace') === 'true';
  });
  const [editorSmoothScrolling, setEditorSmoothScrolling] = useState<boolean>(() => {
    return localStorage.getItem('ide_editor_smooth_scrolling') !== 'false';
  });
  const [editorBracketColorization, setEditorBracketColorization] = useState<boolean>(() => {
    return localStorage.getItem('ide_editor_bracket_colorization') !== 'false';
  });
  const [editorFontFamily, setEditorFontFamily] = useState<string>(() => {
    return localStorage.getItem('ide_editor_font_family') || 'JetBrains Mono';
  });
  const [editorLineHeight, setEditorLineHeight] = useState<number>(() => {
    const s = localStorage.getItem('ide_editor_line_height');
    return s ? Number(s) : 1.5;
  });
  const [editorCursorStyle, setEditorCursorStyle] = useState<'line' | 'block' | 'underline' | 'line-thin' | 'block-outline'>(() => {
    return (localStorage.getItem('ide_editor_cursor_style') as any) || 'line';
  });
  const [editorCursorBlinking, setEditorCursorBlinking] = useState<'blink' | 'smooth' | 'phase' | 'expand' | 'solid'>(() => {
    return (localStorage.getItem('ide_editor_cursor_blinking') as any) || 'smooth';
  });
  const [editorGuides, setEditorGuides] = useState<boolean>(() => {
    return localStorage.getItem('ide_editor_guides') !== 'false';
  });
  const [editorAutoClosingBrackets, setEditorAutoClosingBrackets] = useState<boolean>(() => {
    return localStorage.getItem('ide_editor_auto_closing_brackets') !== 'false';
  });
  const [editorHighlightActiveLine, setEditorHighlightActiveLine] = useState<'all' | 'line' | 'none'>(() => {
    return (localStorage.getItem('ide_editor_highlight_active_line') as any) || 'all';
  });
  const [editorFormatOnSave, setEditorFormatOnSave] = useState<boolean>(() => {
    return localStorage.getItem('ide_editor_format_on_save') !== 'false';
  });
  const [editorCodeFolding, setEditorCodeFolding] = useState<boolean>(() => {
    return localStorage.getItem('ide_editor_code_folding') !== 'false';
  });
  // Terminal settings (Settings modal > Terminal tab)
  const [terminalFontSize, setTerminalFontSize] = useState<number>(() => {
    const s = localStorage.getItem('ide_terminal_font_size');
    return s ? Number(s) : 12;
  });
  const [terminalCursorStyle, setTerminalCursorStyle] = useState<'block' | 'bar' | 'underline'>(() => {
    return (localStorage.getItem('ide_terminal_cursor_style') as any) || 'block';
  });
  const [terminalCursorBlink, setTerminalCursorBlink] = useState<boolean>(() => {
    return localStorage.getItem('ide_terminal_cursor_blink') !== 'false';
  });
  const [terminalScrollback, setTerminalScrollback] = useState<number>(() => {
    const s = localStorage.getItem('ide_terminal_scrollback');
    return s ? Number(s) : 5000;
  });
  const [terminalCopyOnSelect, setTerminalCopyOnSelect] = useState<boolean>(() => {
    return localStorage.getItem('ide_terminal_copy_on_select') === 'true';
  });
  const [terminalFontFamily, setTerminalFontFamily] = useState<string>(() => {
    return localStorage.getItem('ide_terminal_font_family') || 'JetBrains Mono';
  });
  const [terminalLineHeight, setTerminalLineHeight] = useState<number>(() => {
    const s = localStorage.getItem('ide_terminal_line_height');
    return s ? Number(s) : 1.15;
  });
  const [terminalThemePreset, setTerminalThemePreset] = useState<string>(() => {
    return localStorage.getItem('ide_terminal_theme_preset') || 'default';
  });
  const [terminalCursorWidth, setTerminalCursorWidth] = useState<number>(() => {
    const s = localStorage.getItem('ide_terminal_cursor_width');
    return s ? Number(s) : 2;
  });
  const [terminalScrollOnUserInput, setTerminalScrollOnUserInput] = useState<boolean>(() => {
    return localStorage.getItem('ide_terminal_scroll_on_input') !== 'false';
  });
  const [terminalDrawBoldTextInBrightColors, setTerminalDrawBoldTextInBrightColors] = useState<boolean>(() => {
    return localStorage.getItem('ide_terminal_bold_bright') !== 'false';
  });
  // AI / Agents defaults (Settings modal > IA & Agentes tab)
  const [aiAutoApprove, setAiAutoApprove] = useState<boolean>(() => {
    return localStorage.getItem('ide_ai_auto_approve') === 'true';
  });
  const [aiConfirmBeforeDelete, setAiConfirmBeforeDelete] = useState<boolean>(() => {
    return localStorage.getItem('ide_ai_confirm_before_delete') !== 'false';
  });
  // General settings (Settings modal > Geral tab)
  const [confirmBeforeClosingUnsaved, setConfirmBeforeClosingUnsaved] = useState<boolean>(() => {
    return localStorage.getItem('ide_confirm_before_closing_unsaved') !== 'false';
  });
  const [restoreLastWorkspace, setRestoreLastWorkspace] = useState<boolean>(() => {
    return localStorage.getItem('ide_restore_last_workspace') !== 'false';
  });
  const [autoRefreshGitStatus, setAutoRefreshGitStatus] = useState<boolean>(() => {
    return localStorage.getItem('ide_auto_refresh_git_status') !== 'false';
  });
  // Markdown "Open Preview to the Side" (VS Code style, per-filetype editor action)
  const [showMarkdownPreview, setShowMarkdownPreview] = useState<boolean>(false);
  // Split Editor and More Actions menu states
  const [isEditorSplit, setIsEditorSplit] = useState<boolean>(false);
  const [editorSplitOrientation, setEditorSplitOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [secondaryFileId, setSecondaryFileId] = useState<string | null>(null);
  const [editorSplitRatio, setEditorSplitRatio] = useState<number>(50);
  const [editorMoreMenuOpen, setEditorMoreMenuOpen] = useState<boolean>(false);
  const editorMoreMenuRef = useRef<HTMLDivElement>(null);
  const [recentlyClosedFiles, setRecentlyClosedFiles] = useState<OpenFileItem[]>([]);

  const [systemIsDark, setSystemIsDark] = useState(() => {
    return window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : true;
  });
  const isEffectiveDark = themeMode === 'system' ? systemIsDark : themeMode === 'dark';

  // Semantic theme tokens for complete Light/Dark adaptation (Border-free UI)
  const themeTokens = {
    bgApp: isEffectiveDark ? '#000000' : '#eaedf1',
    bgCard: isEffectiveDark ? '#101010' : '#ffffff',
    bgCardSecondary: isEffectiveDark ? '#181818' : '#f1f5f9',
    bgCardElevated: isEffectiveDark ? '#1f1f1f' : '#e2e8f0',
    textPrimary: isEffectiveDark ? '#ffffff' : '#0f172a',
    textSecondary: isEffectiveDark ? '#888888' : '#475569',
    textMuted: isEffectiveDark ? '#555555' : '#64748b',
    border: 'transparent',
    borderSubtle: 'transparent',
    hoverBg: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
  };

  // GitHub login gate (Device Flow) — required before the workspace UI is shown
  const [githubAuthStatus, setGithubAuthStatus] = useState<'checking' | 'unauthenticated' | 'authenticated'>(() => {
    try {
      const cached = localStorage.getItem('devflow_github_user');
      if (cached) return 'authenticated';
    } catch {}
    if (typeof window !== 'undefined' && !window.electronAPI?.github?.isAuthenticated) {
      return 'authenticated';
    }
    return 'checking';
  });
  const [githubUser, setGithubUser] = useState<GithubAuthenticatedUser | null>(() => {
    try {
      const cached = localStorage.getItem('devflow_github_user');
      if (cached) return JSON.parse(cached);
    } catch {}
    return null;
  });

  // "Sair" não desloga de verdade: só volta à tela de login, com um card para retomar a sessão do usuário atual
  const [signedOutUser, setSignedOutUser] = useState<{ user: GithubAuthenticatedUser; lastLogin: string | null } | null>(null);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const markLastLogin = () => { try { localStorage.setItem('devflow_github_last_login', new Date().toISOString()); } catch {} };
  useEffect(() => {
    try { if (!localStorage.getItem('devflow_github_last_login')) markLastLogin(); } catch {}
  }, []);

  useEffect(() => {
    let cancelled = false;

    // Safety timeout: never hang indefinitely in checking state
    const timeoutTimer = setTimeout(() => {
      if (cancelled) return;
      setGithubAuthStatus((current) => (current === 'checking' ? 'authenticated' : current));
    }, 1000);

    if (!window.electronAPI?.github?.isAuthenticated) {
      clearTimeout(timeoutTimer);
      setGithubAuthStatus('authenticated');
      return;
    }

    window.electronAPI.github
      .isAuthenticated()
      .then((res) => {
        if (cancelled) return;
        clearTimeout(timeoutTimer);
        if (!res?.authenticated) {
          setGithubAuthStatus('unauthenticated');
          return;
        }
        setGithubAuthStatus('authenticated');
        logSystemActivity('sistema', 'autenticacao_verificada', 'Aura Dev', { authenticated: true });
        window.electronAPI?.github
          ?.getUser?.()
          .then((userRes) => {
            if (cancelled) return;
            if (userRes?.success && userRes.user) {
              setGithubUser(userRes.user);
              try {
                localStorage.setItem('devflow_github_user', JSON.stringify(userRes.user));
              } catch {}
            }
          })
          .catch(() => {});
      })
      .catch((err) => {
        if (cancelled) return;
        clearTimeout(timeoutTimer);
        console.warn('[GitHub Auth Check] Falha ao verificar autenticação:', err);
        setGithubAuthStatus('authenticated');
      });

    return () => {
      cancelled = true;
      clearTimeout(timeoutTimer);
    };
  }, []);

  const [explorerWidth, setExplorerWidth] = useState(() => {
    const saved = localStorage.getItem('ide_explorer_width');
    return saved ? parseInt(saved, 10) : 280;
  });
  const [aiPanelWidth, setAiPanelWidth] = useState(() => {
    const saved = localStorage.getItem('ide_ai_panel_width');
    return saved ? parseInt(saved, 10) : 340;
  });
  const [terminalHeight, setTerminalHeight] = useState(() => {
    const saved = localStorage.getItem('ide_terminal_height');
    return saved ? parseInt(saved, 10) : 220;
  });

  const [isDraggingExplorer, setIsDraggingExplorer] = useState(false);
  const [isDraggingAi, setIsDraggingAi] = useState(false);
  const [isDraggingTerminal, setIsDraggingTerminal] = useState(false);

  // Right Terminal Tabs Width (VS Code Style)
  const [terminalTabsWidth, setTerminalTabsWidth] = useState(() => {
    const saved = localStorage.getItem('ide_term_tabs_width');
    return saved ? parseInt(saved, 10) : 175;
  });
  const [isDraggingTermTabs, setIsDraggingTermTabs] = useState(false);

  // Left Terminal Split Panes Ratio (%)
  const [terminalSplitRatio, setTerminalSplitRatio] = useState(() => {
    const saved = localStorage.getItem('ide_term_split_ratio');
    return saved ? parseInt(saved, 10) : 50;
  });
  const [isDraggingSplitPanes, setIsDraggingSplitPanes] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Terminal Interactive States
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [isSplitTerminal, setIsSplitTerminal] = useState(false);
  const [terminalShell, setTerminalShell] = useState('zsh');
  const [shellDropdownOpen, setShellDropdownOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [terminalCommand, setTerminalCommand] = useState('');
  const [debugCommand, setDebugCommand] = useState('');
  // Debug console e Output são por projeto (chave = caminho do workspace)
  const [debugByProject, setDebugByProject] = useState<Record<string, string[]>>({});
  const debugHistory = debugByProject[workspacePath] || [];
  const outputBuf = useRef<Record<string, { lines: string[]; partial: Record<string, string> }>>({});
  const [outputTick, setOutputTick] = useState(0);
  const outputLines = outputBuf.current[workspacePath]?.lines || [];
  const terminalSessionsRef = useRef<TerminalSessionItem[]>([]);
  useEffect(() => {
    let dirty = false;
    const off = window.electronAPI?.pty?.onData?.((payload) => {
      const proj = terminalSessionsRef.current.find((t) => t.id === payload.id)?.projectPath;
      if (!proj) return;
      const buf = (outputBuf.current[proj] ||= { lines: [], partial: {} });
      const text = (buf.partial[payload.id] || '') + payload.data
        .replace(/\x1b\][^\x07\x1b]*(\x07|\x1b\\)/g, '')
        .replace(/\x1b\[[0-9;?]*[ -\/]*[@-~]/g, '')
        .replace(/\r(?!\n)/g, '\n')
        .replace(/\r/g, '');
      const parts = text.split('\n');
      buf.partial[payload.id] = parts.pop() || '';
      for (const l of parts) if (l.trim()) buf.lines.push(l);
      if (buf.lines.length > 600) buf.lines.splice(0, buf.lines.length - 500);
      dirty = true;
    });
    const timer = setInterval(() => { if (dirty) { dirty = false; setOutputTick((n) => n + 1); } }, 500);
    return () => { off?.(); clearInterval(timer); };
  }, []);
  const [openPortsCount, setOpenPortsCount] = useState<number>(0);

  // Initial scan to populate open ports badge
  useEffect(() => {
    if (window.electronAPI?.ports?.scan) {
      window.electronAPI.ports.scan().then((res) => {
        if (res && Array.isArray(res.ports)) {
          setOpenPortsCount(res.ports.length);
        }
      }).catch(() => {});
    }
  }, []);
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    'walancy@MacBook-Pro-de-Walancy codes % ',
  ]);
  const [terminalSessions, setTerminalSessions] = useState<TerminalSessionItem[]>([
    {
      id: '1',
      name: 'zsh',
      type: 'zsh',
      pid: 61830,
      command: '/bin/zsh -il',
      shellIntegration: 'Rich',
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('1');
  // terminais do CLI são separados dos da IDE: cada tela só enxerga os seus
  // todos os projetos mantêm seus terminais abertos; cada tela mostra só os do projeto ativo (sem projeto = o ativo)
  const inActiveProject = (s: TerminalSessionItem) => !s.projectPath || s.projectPath === workspacePath;
  const allIdeTerminalSessions = useMemo(() => terminalSessions.filter((s) => s.scope !== 'cli'), [terminalSessions]);
  const ideTerminalSessions = useMemo(() => terminalSessions.filter((s) => s.scope !== 'cli' && inActiveProject(s)), [terminalSessions, workspacePath]);
  const cliTerminalSessions = useMemo(() => terminalSessions.filter((s) => s.scope === 'cli' && inActiveProject(s)), [terminalSessions, workspacePath]);
  const [cliActiveSessionId, setCliActiveSessionId] = useState('');
  useEffect(() => {
    if (cliTerminalSessions.length > 0 && !cliTerminalSessions.some((s) => s.id === cliActiveSessionId)) setCliActiveSessionId(cliTerminalSessions[0].id);
  }, [cliTerminalSessions, cliActiveSessionId]);
  const setCliSessions = (update: React.SetStateAction<TerminalSessionItem[]>) =>
    setTerminalSessions((prev) => {
      const isMine = (s: TerminalSessionItem) => s.scope === 'cli' && (!s.projectPath || s.projectPath === workspacePath);
      const mine = prev.filter(isMine);
      const others = prev.filter((s) => !isMine(s));
      const next = typeof update === 'function' ? (update as (p: TerminalSessionItem[]) => TerminalSessionItem[])(mine) : update;
      return [...others, ...next.map((s) => ({ ...s, scope: 'cli' as const, projectPath: s.projectPath || workspacePath }))];
    });
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [popoverTop, setPopoverTop] = useState(25);
  const hoverTimerRef = useRef<any>(null);


  const inputRef = useRef<HTMLInputElement>(null);
  const promptEditorRef = useRef<PromptEditorRef>(null);
  const termInputRef = useRef<HTMLInputElement>(null);
  const editorInstanceRef = useRef<any>(null);

  // Multi-project terminal and AI session references (preserves running state across projects)
  const projectTerminalSessionsRef = useRef<Record<string, { sessions: TerminalSessionItem[]; activeId: string }>>({});
  const projectAiStateRef = useRef<
    Record<
      string,
      {
        provider: string;
        model: string;
        chatSessions: ChatSessionItem[];
        activeChatSessionId: string | null;
      }
    >
  >({});

  // Multi-project runtime status & cross-project AI notifications
  const [projectRuntimes, setProjectRuntimes] = useState<
    Record<
      string,
      {
        isRunning: boolean;
        runningProcessCount: number;
        activeAiProvider: string | null;
        isAiRunning: boolean;
      }
    >
  >({});
  const [aiNotifications, setAiNotifications] = useState<ProjectAiNotificationItem[]>([]);
  // Design: só monta na primeira abertura e continua montado (a geração por IA não pode parar ao trocar de tela)
  const [designMounted, setDesignMounted] = useState(false);
  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;
  useEffect(() => {
    if (activeTab === 'design') setDesignMounted(true);
  }, [activeTab]);
  // Avisa que a IA do Design terminou quando o usuário está em outra tela, em outro projeto ou com o app em segundo plano
  const handleDesignAiDone = useCallback(
    (r: { ok: boolean; message: string; workspace: string }) => {
      const otherProject = !!r.workspace && r.workspace.toLowerCase() !== (workspacePathRef.current || '').toLowerCase();
      const away = activeTabRef.current !== 'design' || otherProject;
      const background = !document.hasFocus();
      const name = r.workspace.split('/').filter(Boolean).pop() || 'Design';
      // sempre fica no histórico; só conta como "nova" se o usuário não estava olhando
      notifCenter.add({
        kind: r.ok ? 'design' : 'error',
        title: r.ok ? `${name}: a IA do Design terminou` : `${name}: a IA do Design falhou`,
        body: r.message,
        projectPath: r.workspace,
        projectName: name,
        provider: selectedAiProvider,
        source: 'design',
        read: !(away || background),
      });
      if (!away && !background) return;
      const notif: ProjectAiNotificationItem = {
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        projectPath: r.workspace,
        projectName: name,
        provider: selectedAiProvider,
        summary: r.ok ? `Design: ${r.message}` : `Design falhou: ${r.message}`,
        timestamp: Date.now(),
        kind: 'done',
        source: 'design',
      };
      setAiNotifications((prev) => [...prev.slice(-4), notif]);
      setTimeout(() => setAiNotifications((prev) => prev.filter((n) => n.id !== notif.id)), 15000);
      try {
        if (background && 'Notification' in window) new Notification(r.ok ? `${name}: a IA do Design terminou` : `${name}: a IA do Design falhou`, { body: notif.summary.slice(0, 140) });
      } catch {}
    },
    [selectedAiProvider, notifCenter.add]
  );


  // Estado da IA por projeto (caminho do workspace): chat da IDE e terminal da CLI rodam em paralelo entre projetos
  const workspacePathRef = useRef(workspacePath);
  workspacePathRef.current = workspacePath;
  const activeChatSessionIdRef = useRef(activeChatSessionId);
  activeChatSessionIdRef.current = activeChatSessionId;
  const aiExecIdsRef = useRef<Record<string, number>>({});
  const runningAiWorkspacesRef = useRef<Set<string>>(new Set());
  const [ideAiStatus, setIdeAiStatus] = useState<Record<string, ProjectAiStatus>>({});
  const [cliAiStatus, setCliAiStatus] = useState<Record<string, ProjectAiStatus>>({});

  terminalSessionsRef.current = terminalSessions;
  const projectAiStatus = useMemo(() => {
    const rank: Record<ProjectAiStatus, number> = { done: 1, generating: 2, waiting: 3 };
    const out: Record<string, ProjectAiStatus> = {};
    const put = (path: string, st: ProjectAiStatus) => {
      if (!out[path] || rank[st] > rank[out[path]]) out[path] = st;
    };
    Object.entries(ideAiStatus).forEach(([k, v]) => put(k, v));
    Object.entries(cliAiStatus).forEach(([k, v]) => put(k, v));
    Object.entries(projectRuntimes).forEach(([k, v]) => v.isAiRunning && put(k, 'generating'));
    return out;
  }, [ideAiStatus, cliAiStatus, projectRuntimes]);

  // Avisa que a IA de OUTRO projeto terminou ou está esperando resposta (nunca para o projeto aberto)
  const notifyProjectAi = useCallback(
    (item: Omit<ProjectAiNotificationItem, 'id' | 'timestamp'>) => {
      const cur = workspacePathRef.current?.toLowerCase();
      if (cur && item.projectPath.toLowerCase() === cur) return;
      const notif: ProjectAiNotificationItem = {
        ...item,
        id: `notif_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        timestamp: Date.now(),
      };
      setAiNotifications((prev) => [...prev.slice(-4), notif]);
      setTimeout(() => setAiNotifications((prev) => prev.filter((n) => n.id !== notif.id)), 12000);
      notifCenter.add({
        kind: 'ai',
        title: `${item.projectName}: ${item.kind === 'question' ? 'a IA precisa da sua resposta' : 'a IA terminou'}`,
        body: item.summary,
        projectPath: item.projectPath,
        projectName: item.projectName,
        provider: item.provider,
        source: item.source,
      });
      try {
        // Com o app em segundo plano o toast não é visto: usa a notificação do sistema
        if (!document.hasFocus() && 'Notification' in window) {
          const title = `${item.projectName}: ${item.kind === 'question' ? 'a IA precisa da sua resposta' : 'a IA terminou'}`;
          new Notification(title, { body: item.summary.slice(0, 140) });
        }
      } catch {}
    },
    [notifCenter.add]
  );

  // Ao abrir um projeto, o que estava pendente nele já foi visto
  useEffect(() => {
    if (!workspacePath) return;
    const clear = (prev: Record<string, ProjectAiStatus>) => {
      if (prev[workspacePath] !== 'done' && prev[workspacePath] !== 'waiting') return prev;
      const next = { ...prev };
      delete next[workspacePath];
      return next;
    };
    setIdeAiStatus(clear);
    setCliAiStatus(clear);
  }, [workspacePath]);

  // Sincroniza processos PTY rodando em background e escuta conclusões de IA entre projetos
  useEffect(() => {
    const syncRunningSessions = async () => {
      if (!window.electronAPI?.pty?.getRunningSessions) return;
      try {
        const sessions = await window.electronAPI.pty.getRunningSessions();
        if (Array.isArray(sessions)) {
          const map: Record<
            string,
            {
              isRunning: boolean;
              runningProcessCount: number;
              activeAiProvider: string | null;
              isAiRunning: boolean;
            }
          > = {};

          sessions.forEach((s) => {
            const cwd = s.cwd || workspacePath || '';
            if (!map[cwd]) {
              map[cwd] = {
                isRunning: true,
                runningProcessCount: 0,
                activeAiProvider: null,
                isAiRunning: false,
              };
            }
            map[cwd].runningProcessCount += 1;
            if (s.isAi) {
              // o ícone da IA no seletor de projetos é só do chat da IDE respondendo (abaixo); terminais de IA não entram
              if (s.isRunning) {
                map[cwd].isAiRunning = true;
              }
            }
          });

          // Chat da IDE também é sessão de IA: projeto aberto com conversa/geração em andamento, ou outro projeto
          // com resposta pendente (gerando / aguardando / pronta)
          const ensureEntry = (path: string) => {
            if (!map[path]) {
              map[path] = { isRunning: false, runningProcessCount: 0, activeAiProvider: null, isAiRunning: false };
            }
            return map[path];
          };
          if (workspacePath) {
            const e = ensureEntry(workspacePath);
            if (!e.runningProcessCount && terminalSessions.length > 0) {
              e.isRunning = true;
              e.runningProcessCount = terminalSessions.length;
            }
            if (isAiExecuting) {
              e.activeAiProvider = selectedAiProvider;
              e.isAiRunning = true;
            }
          }
          Object.keys(ideAiStatus).forEach((path) => {
            const e = ensureEntry(path);
            e.activeAiProvider = e.activeAiProvider || projectAiStateRef.current[path]?.provider || selectedAiProvider;
          });

          setProjectRuntimes((prev) => (JSON.stringify(prev) === JSON.stringify(map) ? prev : map));
          // Voltou a gerar (usuário respondeu ou nova tarefa): o aviso anterior deixou de valer
          setCliAiStatus((prev) => {
            const running = Object.keys(map).filter((k) => map[k].isAiRunning && prev[k]);
            if (running.length === 0) return prev;
            const next = { ...prev };
            running.forEach((k) => delete next[k]);
            return next;
          });
        }
      } catch (err) {
        console.warn('[Multi-Projects] Erro ao sincronizar sessões ativas:', err);
      }
    };

    syncRunningSessions();
    const interval = setInterval(syncRunningSessions, 2200);

    let unsubAiCompleted: (() => void) | undefined;
    if (window.electronAPI?.pty?.onAiCompleted) {
      unsubAiCompleted = window.electronAPI.pty.onAiCompleted((payload) => {
        const isCurrentProject =
          workspacePath &&
          (workspacePath.toLowerCase() === payload.cwd.toLowerCase() ||
            workspacePath.toLowerCase().endsWith('/' + payload.projectName.toLowerCase()));

        // Só avisa se o projeto não estiver aberto; o ícone do dropdown também só acende nesse caso
        if (!isCurrentProject) {
          const kind = payload.needsInput ? 'question' : 'done';
          setCliAiStatus((prev) => ({ ...prev, [payload.cwd]: payload.needsInput ? 'waiting' : 'done' }));
          notifyProjectAi({
            projectPath: payload.cwd,
            projectName: payload.projectName,
            provider: payload.type,
            summary: payload.summary,
            kind,
            source: 'cli',
          });
        }
      });
    }

    (window as any).__showAiCompletedNotification = (item: ProjectAiNotificationItem) => {
      setAiNotifications((prev) => [...prev.slice(-4), item]);
    };

    return () => {
      clearInterval(interval);
      unsubAiCompleted?.();
    };
  }, [workspacePath, selectedAiProvider, isAiExecuting, terminalSessions, notifyProjectAi, ideAiStatus, aiHistory.length]);

  // Fullscreen Detection
  useEffect(() => {
    window.electronAPI?.windowState?.isFullscreen?.().then((fs) => {
      setIsFullscreen(fs);
    });

    const unsubFs = window.electronAPI?.windowState?.onFullscreenChange?.((fs) => {
      setIsFullscreen(fs);
    });

    return () => {
      unsubFs?.();
    };
  }, []);

  // Native Menu Listeners
  useEffect(() => {
    if (window.electronAPI?.menu?.onAction) {
      const unsubscribe = window.electronAPI.menu.onAction((action: string) => {
        if (action === 'focus-ai-prompt') {
          setShowAiPanel(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        } else if (action === 'run-claude') {
          setShowAiPanel(true);
          setSelectedModel('Claude Sonnet 5');
          setAskPrompt('Execute uma análise completa do projeto Aura Dev.');
          setTimeout(() => inputRef.current?.focus(), 50);
        } else if (action === 'run-agy') {
          setShowAiPanel(true);
          setSelectedModel('Google Antigravity (AGY CLI)');
          setAskPrompt('/plan Iniciar verificação autônoma de tarefas.');
          setTimeout(() => inputRef.current?.focus(), 50);
        } else if (action === 'toggle-terminal') {
          setIsTerminalCollapsed((prev) => !prev);
        } else if (action === 'toggle-explorer') {
          setShowExplorer((prev) => !prev);
        } else if (action === 'toggle-ai') {
          setShowAiPanel((prev) => !prev);
        } else if (action === 'scan-ports') {
          setActiveTermTab('ports');
          setIsTerminalCollapsed(false);
        } else if (action === 'new-terminal') {
          handleNewTerminalSession();
        } else if (action === 'split-terminal') {
          handleToggleSplitActiveSession();
        } else if (action === 'clear-terminal') {
          handleClearTerminal();
        }
      });
      return unsubscribe;
    }
  }, [terminalSessions]);

  // ============================================================
  // DRAG RESIZE HANDLERS (VS CODE BEHAVIOR)
  // ============================================================

  // 1. Resize Explorer Width
  const startResizeExplorer = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingExplorer(true);
    document.body.classList.add('resizing-col');

    const startX = e.clientX;
    const startW = explorerWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newW = Math.min(Math.max(startW + delta, 160), 550);
      setExplorerWidth(newW);
      localStorage.setItem('ide_explorer_width', String(newW));
      editorInstanceRef.current?.layout();
    };

    const onMouseUp = () => {
      setIsDraggingExplorer(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      editorInstanceRef.current?.layout();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [explorerWidth]);

  // 2. Resize AI Assistant Panel Width
  const startResizeAiPanel = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingAi(true);
    document.body.classList.add('resizing-col');

    const startX = e.clientX;
    const startW = aiPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newW = Math.min(Math.max(startW + delta, 220), 650);
      setAiPanelWidth(newW);
      localStorage.setItem('ide_ai_panel_width', String(newW));
      editorInstanceRef.current?.layout();
    };

    const onMouseUp = () => {
      setIsDraggingAi(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      editorInstanceRef.current?.layout();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [aiPanelWidth]);

  // 3. Resize Terminal Panel Height
  const startResizeTerminal = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingTerminal(true);
    document.body.classList.add('resizing-row');

    const startY = e.clientY;
    const startH = terminalHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const newH = Math.min(Math.max(startH + delta, 90), 600);
      setTerminalHeight(newH);
      localStorage.setItem('ide_terminal_height', String(newH));
      editorInstanceRef.current?.layout();
    };

    const onMouseUp = () => {
      setIsDraggingTerminal(false);
      document.body.classList.remove('resizing-row');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      editorInstanceRef.current?.layout();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [terminalHeight]);

  // 4. Resize Terminal Tabs Width (Right Pane)
  const startResizeTermTabs = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingTermTabs(true);
    document.body.classList.add('resizing-col');

    const startX = e.clientX;
    const startW = terminalTabsWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newW = Math.min(Math.max(startW + delta, 110), 450);
      setTerminalTabsWidth(newW);
      localStorage.setItem('ide_term_tabs_width', String(newW));
    };

    const onMouseUp = () => {
      setIsDraggingTermTabs(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [terminalTabsWidth]);

  // 5. Resize Split Panes (Left & Right inside Terminal)
  const startResizeSplitPanes = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitPanes(true);
    document.body.classList.add('resizing-col');

    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const offsetX = moveEvent.clientX - rect.left;
      const pct = Math.min(Math.max(Math.round((offsetX / rect.width) * 100), 20), 80);
      setTerminalSplitRatio(pct);
      localStorage.setItem('ide_term_split_ratio', String(pct));
    };

    const onMouseUp = () => {
      setIsDraggingSplitPanes(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorInstanceRef.current = editor;
    (window as any).monaco = monaco;

    // Configure TypeScript / JavaScript options to prevent false noise from missing node_modules/@types in browser
    try {
      const ts = (monaco.languages as any)?.typescript;
      if (ts) {
        ts.typescriptDefaults.setCompilerOptions({
          target: ts.ScriptTarget.ESNext,
          allowNonTsExtensions: true,
          moduleResolution: ts.ModuleResolutionKind.NodeJs,
          module: ts.ModuleKind.CommonJS,
          noEmit: true,
          esModuleInterop: true,
          jsx: ts.JsxEmit.ReactJSX,
          allowJs: true,
        });

        const ignoreCodes = [
          2307, // Cannot find module
          2792, // Cannot find module (moduleResolution)
          7016, // Could not find declaration file
          2686, // 'React' refers to a UMD global
          8006, 8008, 8009, 8010, 8011, 8013, 8016,
          2451, // Cannot redeclare block-scoped variable
          2304, // Cannot find name
          2552, // Cannot find name (suggestion)
          2503, // Cannot find namespace
        ];

        ts.typescriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          diagnosticCodesToIgnore: ignoreCodes,
        });

        ts.javascriptDefaults.setDiagnosticsOptions({
          noSemanticValidation: false,
          noSyntaxValidation: false,
          diagnosticCodesToIgnore: ignoreCodes,
        });
      }
    } catch (e) {
      console.warn('Monaco ts setup error:', e);
    }

    // Track real cursor position (Ln, Col)
    editor.onDidChangeCursorPosition((e) => {
      setCursorPosition({ line: e.position.lineNumber, col: e.position.column });
    });

    const ignoredCodes = new Set([
      2307, 2792, 7016, 2686, 8006, 8008, 8009, 8010, 8011, 8013, 8016, 2451, 2304, 2552, 2503,
    ]);

    // Track real markers (Errors and Warnings)
    const updateMarkers = () => {
      const model = editor.getModel();
      if (model) {
        const markers = monaco.editor.getModelMarkers({ resource: model.uri });
        const clean = markers.filter((m) => {
          const codeVal = typeof m.code === 'object' && m.code ? Number((m.code as any).value) : Number(m.code);
          return !ignoredCodes.has(codeVal);
        });

        const errs = clean.filter((m) => m.severity === 8).length;
        const warns = clean.filter((m) => m.severity === 4).length;
        setEditorErrors(errs);
        setEditorWarnings(warns);

        const currentUriStr = model.uri.toString();
        const activePath = activeFileRef.current?.path || currentUriStr;
        const activeName = activeFileRef.current?.name || 'editor';

        const formatted: IdeProblem[] = clean.map((m, idx) => ({
          id: `marker-${m.startLineNumber}-${m.startColumn}-${idx}`,
          filePath: activePath,
          relPath: activeName,
          fileName: activeName,
          line: m.startLineNumber,
          column: m.startColumn,
          endLine: m.endLineNumber,
          endColumn: m.endColumn,
          message: m.message,
          severity: m.severity === 8 ? 'error' : m.severity === 4 ? 'warning' : 'info',
          severityCode: m.severity,
          code: typeof m.code === 'object' && m.code ? (m.code as any).value : m.code,
          source: m.source || 'monaco',
        }));
        setEditorMarkers(formatted);
      }
    };
    monaco.editor.onDidChangeMarkers(updateMarkers);
    updateMarkers();
    monaco.editor.defineTheme('aura-dev-dark', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff7b72' },
        { token: 'string', foreground: 'a5d6ff' },
        { token: 'number', foreground: '79c0ff' },
        { token: 'type', foreground: 'ffa657' },
        { token: 'function', foreground: 'd2a8ff' },
        { token: 'variable', foreground: 'c9d1d9' },
      ],
      colors: {
        'editor.background': '#101010',
        'editor.foreground': '#d8dade',
        'editorCursor.foreground': accentColor,
        'editor.lineHighlightBackground': '#181818',
        'editorLineNumber.foreground': '#4e5362',
        'editorLineNumber.activeForeground': '#ffffff',
        'editor.selectionBackground': '#264f78',
        'editorGutter.background': '#101010',
      },
    });
    monaco.editor.setTheme('aura-dev-dark');
  };

  const handleNewTerminalSession = (
    type: string = 'zsh',
    name?: string,
    initialCommand?: string,
    scope: 'ide' | 'cli' = 'ide'
  ) => {
    const newId = `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const pid = Math.floor(60000 + Math.random() * 5000);
    const cmd =
      type === 'bash'
        ? '/bin/bash -il'
        : type === 'claude'
        ? 'claude'
        : type === 'agy' || type === 'antigravity'
        ? 'agy'
        : type === 'codex'
        ? 'codex'
        : type === 'gemini'
        ? 'gemini'
        : type === 'ollama'
        ? 'ollama'
        : '/bin/zsh -il';
    const newSession: TerminalSessionItem = {
      id: newId,
      name: name || (type === 'claude' ? 'Claude' : type === 'agy' || type === 'antigravity' ? 'Antigravity' : type === 'codex' ? 'OpenAI Codex' : type),
      type,
      pid,
      command: cmd,
      initialCommand,
      shellIntegration: 'Rich',
      scope,
      projectPath: workspacePath,
    };
    setTerminalSessions((prev) => [...prev, newSession]);
    if (scope === 'cli') {
      setCliActiveSessionId(newId);
    } else {
      setActiveSessionId(newId);
      setIsTerminalCollapsed(false);
      setActiveTermTab('terminal');
    }
    return newId;
  };

  const handleInstallCliInTerminal = async (provider: AiProviderConfig) => {
    setProviderDropdown(false);
    if (window.electronAPI?.shell?.openInSystemTerminal) {
      await window.electronAPI.shell.openInSystemTerminal(provider.installGuide);
      setToastMessage(`Terminal aberto para instalar ${provider.name}. Siga as instruções no terminal!`);
    } else {
      handleNewTerminalSession('zsh', `Instalar ${provider.name}`, provider.installGuide);
      setToastMessage(`Iniciando instalação do CLI ${provider.name} no terminal integrado...`);
    }
  };

  const handleUpdateCliInTerminal = async (providerId: string, notification?: CenterNotification) => {
    setProviderDropdown(false);
    setIsHeaderAiMenuOpen(false);
    const prov = AI_PROVIDERS.find((p) => p.id === providerId) || AI_PROVIDERS.find((p) => p.id === (providerId === 'agy' ? 'antigravity' : providerId));
    const provName = prov?.name || providerId;
    const updateInfo = aiUpdatesAvailable[providerId] || (providerId === 'agy' ? aiUpdatesAvailable['antigravity'] : undefined);
    const cmd = notification?.updateCommand || updateInfo?.updateCommand || (prov ? prov.installGuide : 'curl -fsSL https://antigravity.google/cli/install.sh | bash');

    logSystemActivity('ai_updates', `Atualizar CLI da IA ${provName}`, 'Sistema', {
      providerId,
      currentVersion: updateInfo?.currentVersion,
      latestVersion: updateInfo?.latestVersion || notification?.updateVersion,
      command: cmd,
    });

    if (notification) {
      notifCenter.read(notification.id);
    }

    if (window.electronAPI?.shell?.openInSystemTerminal) {
      await window.electronAPI.shell.openInSystemTerminal(cmd);
      setToastMessage(`Terminal aberto para atualizar ${provName}. Siga as instruções no terminal!`);
    } else {
      handleNewTerminalSession('zsh', `Atualizar ${provName}`, cmd);
      setToastMessage(`Iniciando atualização do CLI ${provName} no terminal integrado...`);
    }
  };

  const triggerAutoUpdate = useCallback(async (providerId: string, info: { hasUpdate: boolean; currentVersion?: string; latestVersion?: string; updateCommand?: string }) => {
    if (autoUpdatingRef.current.has(providerId)) return;
    autoUpdatingRef.current.add(providerId);

    const prov = AI_PROVIDERS.find((p) => p.id === providerId) || { name: providerId, patchNotesUrl: 'https://antigravity.google/changelog' };
    const cmd = info.updateCommand || (prov as any).installGuide || 'curl -fsSL https://antigravity.google/cli/install.sh | bash';
    const patchUrl = prov.patchNotesUrl || 'https://antigravity.google/changelog';

    logSystemActivity('ai_updates', `Iniciando auto-update de IA: ${prov.name}`, 'Sistema', {
      providerId,
      currentVersion: info.currentVersion,
      latestVersion: info.latestVersion,
      command: cmd,
    });

    try {
      if (window.electronAPI?.shell?.exec) {
        const res = await window.electronAPI.shell.exec(cmd);
        if (res.exitCode === 0 || !res.error) {
          setAiUpdatesAvailable((prev) => ({
            ...prev,
            [providerId]: { ...prev[providerId], hasUpdate: false },
          }));

          const pendingUpdates = notifCenter.items.filter(
            (n) => n.isUpdate && (n.provider === providerId || (providerId === 'antigravity' && n.provider === 'agy'))
          );
          for (const pNotif of pendingUpdates) {
            notifCenter.remove(pNotif.id);
          }

          notifCenter.add({
            kind: 'ai',
            title: `IA ${prov.name} atualizada`,
            body: `O CLI ${prov.name} foi atualizado automaticamente com sucesso para a versão ${info.latestVersion || 'mais recente'}. Clique em Patch Notes para ver as notas da versão oficial.`,
            provider: providerId,
            patchNotesUrl: patchUrl,
            read: false,
          });

          setToastMessage(`IA ${prov.name} atualizada automaticamente!`);

          logSystemActivity('ai_updates', `Auto-update concluído com sucesso: ${prov.name}`, 'Sistema', {
            providerId,
            previousVersion: info.currentVersion,
            newVersion: info.latestVersion,
            patchNotesUrl: patchUrl,
          });
        } else {
          console.warn('[Auto-Update] Falha no comando:', res.stderr || res.error);
        }
      }
    } catch (err) {
      console.error('[Auto-Update] Erro durante atualização automática:', err);
    } finally {
      autoUpdatingRef.current.delete(providerId);
    }
  }, [notifCenter]);

  const handleKillTerminalSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTerminalSessions((prev) => {
      const target = prev.find((s) => s.id === sessionId);
      if (!target) return prev;
      const sameProject = (s: TerminalSessionItem) => (s.projectPath || workspacePath) === (target.projectPath || workspacePath);
      const sameScope = prev.filter((s) => (s.scope === 'cli') === (target.scope === 'cli') && sameProject(s));
      if (sameScope.length <= 1) return prev;
      const siblingId = target.splitWithId;

      const next = prev
        .filter((s) => s.id !== sessionId)
        .map((s) => (s.id === siblingId ? { ...s, isSplit: false, splitWithId: undefined } : s));
      const nextSame = next.filter((s) => (s.scope === 'cli') === (target.scope === 'cli') && sameProject(s));

      const fallbackId = siblingId && nextSame.some((s) => s.id === siblingId) ? siblingId : nextSame[0].id;
      if (target.scope === 'cli') {
        if (cliActiveSessionId === sessionId) setCliActiveSessionId(fallbackId);
      } else if (activeSessionId === sessionId) {
        setActiveSessionId(fallbackId);
      }
      return next;
    });
    if (hoveredSessionId === sessionId) {
      setHoveredSessionId(null);
    }
  };

  const handleSplitSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newId = `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const pid = Math.floor(60000 + Math.random() * 5000);
    setTerminalSessions((prev) => {
      const parent = prev.find((s) => s.id === sessionId);
      if (!parent) return prev;

      const newSession: TerminalSessionItem = {
        id: newId,
        name: parent.name,
        type: parent.type,
        pid,
        command: parent.command,
        shellIntegration: 'Rich',
        isSplit: true,
        splitWithId: parent.id,
        scope: parent.scope,
        projectPath: parent.projectPath || workspacePath,
      };

      const updated = prev.map((s) =>
        s.id === parent.id ? { ...s, isSplit: true, splitWithId: newId } : s
      );

      const parentIndex = updated.findIndex((s) => s.id === parent.id);
      const next = [...updated];
      next.splice(parentIndex + 1, 0, newSession);
      return next;
    });
    setActiveSessionId(newId);
    setIsTerminalCollapsed(false);
    setActiveTermTab('terminal');
  };

  const handleToggleSplitActiveSession = () => {
    const current = ideTerminalSessions.find((s) => s.id === activeSessionId);
    if (current?.splitWithId) {
      handleKillTerminalSession(current.splitWithId);
    } else {
      handleSplitSession(activeSessionId);
    }
  };


  // Load Workspace File Tree
  const loadWorkspaceTree = useCallback(async (dirPath: string) => {
    if (window.electronAPI?.fs?.getTree) {
      try {
        const res = await window.electronAPI.fs.getTree(dirPath, 3);
        const tree = Array.isArray(res) ? res : (res as any).tree || [];
        setFileTree(tree);
      } catch (err) {
        console.warn('Error loading tree from electron:', err);
      }
    } else {
      setFileTree([
        {
          name: 'apps',
          path: `${dirPath}/apps`,
          isDirectory: true,
          children: [
            {
              name: 'aura-dev-api',
              path: `${dirPath}/apps/aura-dev-api`,
              isDirectory: true,
              children: [
                { name: 'app.service.ts', path: `${dirPath}/apps/aura-dev-api/src/app.service.ts`, isDirectory: false, extension: '.ts' },
                { name: 'app.service.spec.ts', path: `${dirPath}/apps/aura-dev-api/src/app.service.spec.ts`, isDirectory: false, extension: '.ts' },
                { name: 'main.ts', path: `${dirPath}/apps/aura-dev-api/src/main.ts`, isDirectory: false, extension: '.ts' },
              ],
            },
          ],
        },
        {
          name: 'data',
          path: `${dirPath}/data`,
          isDirectory: true,
          children: [
            { name: 'schema.sql', path: `${dirPath}/data/schema.sql`, isDirectory: false, extension: '.sql' },
          ],
        },
        { name: 'Dockerfile', path: `${dirPath}/Dockerfile`, isDirectory: false, extension: '' },
        { name: 'package.json', path: `${dirPath}/package.json`, isDirectory: false, extension: '.json' },
        { name: 'tsconfig.json', path: `${dirPath}/tsconfig.json`, isDirectory: false, extension: '.json' },
        { name: 'README.md', path: `${dirPath}/README.md`, isDirectory: false, extension: '.md' },
      ]);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceTree(workspacePath);
  }, [workspacePath, loadWorkspaceTree]);

  // Alterna o workspace e projeto ativo globalmente preservando sessões e IA independentes por projeto
  const handleSelectWorkspace = useCallback(
    async (newPath: string, repoName?: string) => {
      // 1. Salva os arquivos abertos, terminais e sessão de IA no workspace anterior antes de alternar
      if (workspacePath && workspacePath !== newPath) {
        try {
          const currentProjectFiles = openFiles.filter((f) => f.path && f.path.startsWith(workspacePath));
          localStorage.setItem(`ide_open_files_${workspacePath}`, JSON.stringify(currentProjectFiles));
          if (activeFileId && activeFileId.startsWith(workspacePath)) {
            localStorage.setItem(`ide_active_file_${workspacePath}`, activeFileId);
          }

          // Salva terminais e sessão ativa deste projeto (os dos outros projetos continuam abertos, cada um no seu)
          const oldProjectSessions = terminalSessions.filter((s) => (s.projectPath || workspacePath) === workspacePath);
          projectTerminalSessionsRef.current[workspacePath] = {
            sessions: oldProjectSessions,
            activeId: activeSessionId,
          };
          localStorage.setItem(`ide_terminal_sessions_${workspacePath}`, JSON.stringify(oldProjectSessions));
          localStorage.setItem(`ide_active_session_${workspacePath}`, activeSessionId);
          // terminais sem projeto (criados antes) passam a pertencer ao projeto de onde estão saindo
          setTerminalSessions((prev) => prev.map((s) => (s.projectPath ? s : { ...s, projectPath: workspacePath })));

          // Salva sessão de IA deste projeto garantindo que a sessão ativa contenha o histórico atual
          const currentSessionsWithActiveHistory = chatSessions.map((s) =>
            s.id === activeChatSessionId && aiHistory.length > 0 ? { ...s, history: aiHistory } : s
          );
          projectAiStateRef.current[workspacePath] = {
            provider: selectedAiProvider,
            model: selectedModel,
            chatSessions: currentSessionsWithActiveHistory,
            activeChatSessionId,
          };
          localStorage.setItem(
            `ide_ai_state_${workspacePath}`,
            JSON.stringify({
              provider: selectedAiProvider,
              model: selectedModel,
              chatSessions: currentSessionsWithActiveHistory,
              activeChatSessionId,
            })
          );
        } catch {}
      }

      setWorkspacePath(newPath);
      setTerminalCwd(newPath);
      if (repoName) {
        setGitRepoName(repoName);
      }
      localStorage.setItem('ide_workspace_path', newPath);
      localStorage.setItem('ide_terminal_cwd', newPath);
      await loadWorkspaceTree(newPath);

      // 2. Carrega os arquivos abertos salvos para o novo workspace (ou limpa os arquivos do workspace antigo)
      try {
        const savedFilesJson = localStorage.getItem(`ide_open_files_${newPath}`);
        const savedActiveId = localStorage.getItem(`ide_active_file_${newPath}`);
        if (savedFilesJson) {
          const parsed = JSON.parse(savedFilesJson);
          if (Array.isArray(parsed) && parsed.length > 0) {
            const validFiles = parsed.filter((f: any) => f.path && f.path.startsWith(newPath));
            setOpenFiles(validFiles);
            setActiveFileId(
              savedActiveId && savedActiveId.startsWith(newPath)
                ? savedActiveId
                : validFiles[0]?.id || null
            );
          } else {
            setOpenFiles([]);
            setActiveFileId(null);
          }
        } else {
          setOpenFiles([]);
          setActiveFileId(null);
        }
      } catch {
        setOpenFiles([]);
        setActiveFileId(null);
      }

      // 3. Restaura ou inicializa as sessões de terminal do novo projeto (sem matar nem misturar os processos)
      const savedTermState = projectTerminalSessionsRef.current[newPath];
      let restoredSessions: TerminalSessionItem[] | null = null;
      let restoredActiveId: string | null = null;

      if (savedTermState && Array.isArray(savedTermState.sessions) && savedTermState.sessions.length > 0) {
        restoredSessions = savedTermState.sessions;
        restoredActiveId = savedTermState.activeId;
      } else {
        try {
          const fromStorage = localStorage.getItem(`ide_terminal_sessions_${newPath}`);
          if (fromStorage) {
            const parsed = JSON.parse(fromStorage);
            if (Array.isArray(parsed) && parsed.length > 0) {
              restoredSessions = parsed;
              restoredActiveId = localStorage.getItem(`ide_active_session_${newPath}`);
            }
          }
        } catch {}
      }

      // A lista de terminais é global: nada é fechado. Acrescenta os salvos deste projeto que ainda não estão abertos
      // e garante um terminal da IDE para ele; só muda o terminal ativo.
      {
        const known = new Set(terminalSessions.map((s) => s.id));
        const fromSaved = (restoredSessions || []).filter((s) => !known.has(s.id)).map((s) => ({ ...s, projectPath: s.projectPath || newPath }));
        const projectOwn = [...terminalSessions.filter((s) => (s.projectPath || workspacePath) === newPath), ...fromSaved];
        const additions: TerminalSessionItem[] = [...fromSaved];
        let ideOfProject = projectOwn.filter((s) => s.scope !== 'cli');
        if (ideOfProject.length === 0) {
          const freshSessionId = `term_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          const freshSession: TerminalSessionItem = {
            id: freshSessionId,
            name: 'zsh',
            type: 'zsh',
            pid: Math.floor(60000 + Math.random() * 5000),
            command: '/bin/zsh -il',
            shellIntegration: 'Rich',
            projectPath: newPath,
          };
          additions.push(freshSession);
          ideOfProject = [freshSession];
        }
        if (additions.length) setTerminalSessions((prev) => [...prev, ...additions.filter((a) => !prev.some((p) => p.id === a.id))]);
        setActiveSessionId(
          restoredActiveId && ideOfProject.some((s) => s.id === restoredActiveId) ? restoredActiveId : ideOfProject[0].id
        );
      }

      // 4. Sessão de IA do projeto: volta a conversa que estava aberta nele (cada projeto tem o seu chat)
      // Reabrir o projeto que já está aberto não pode voltar a uma foto antiga: usa o estado ao vivo
      const savedAiState =
        workspacePath === newPath
          ? {
              provider: selectedAiProvider,
              model: selectedModel,
              chatSessions: chatSessions.map((cs) => (cs.id === activeChatSessionId && aiHistory.length > 0 ? { ...cs, history: aiHistory } : cs)),
              activeChatSessionId,
            }
          : projectAiStateRef.current[newPath];
      let restoredAi: any = null;
      if (savedAiState) {
        restoredAi = savedAiState;
      } else {
        try {
          const fromStorage = localStorage.getItem(`ide_ai_state_${newPath}`);
          if (fromStorage) {
            restoredAi = JSON.parse(fromStorage);
          }
        } catch {}
      }

      const targetProvider = restoredAi?.provider || selectedAiProvider || 'claude';
      const targetModel = restoredAi?.model || selectedModel || 'sonnet';
      setSelectedAiProvider(targetProvider);
      setSelectedModel(targetModel);

      const displayName = repoName || newPath.split('/').filter(Boolean).pop() || 'Projeto';

      // Recupera as sessões do projeto (as com histórico + a que estava ativa) para a conversa voltar como estava
      const savedSessions: ChatSessionItem[] = Array.isArray(restoredAi?.chatSessions) ? restoredAi.chatSessions : [];
      const restoredActiveSession = savedSessions.find((s: ChatSessionItem) => s.id === restoredAi?.activeChatSessionId);
      const priorProjectSessions: ChatSessionItem[] = savedSessions.filter(
        (s: ChatSessionItem) => (s.history && s.history.length > 0) || s.id === restoredActiveSession?.id
      );

      let projectChatSessions: ChatSessionItem[];
      let projectActiveSessionId: string;
      let projectHistory: ChatMessageItem[];
      if (restoredActiveSession) {
        // Mesma conversa, mesmas mensagens: nada de misturar com o projeto anterior
        projectChatSessions = priorProjectSessions;
        projectActiveSessionId = restoredActiveSession.id;
        projectHistory = restoredActiveSession.history || [];
      } else {
        // Primeira vez neste projeto: chat novo e isolado
        const freshChatSessionId = 'session-' + Date.now();
        const freshChatSession: ChatSessionItem = {
          id: freshChatSessionId,
          title: 'Nova Conversa',
          provider: targetProvider,
          updatedAt: Date.now(),
          history: [],
          workspacePath: newPath,
          projectName: displayName,
        };
        projectChatSessions = [freshChatSession, ...priorProjectSessions];
        projectActiveSessionId = freshChatSessionId;
        projectHistory = [];
      }

      setChatSessions(projectChatSessions);
      setActiveChatSessionId(projectActiveSessionId);
      setAiHistory(projectHistory);
      // O estado de execução da tela é o do projeto que está abrindo (outro projeto pode estar gerando em paralelo)
      setIsAiExecuting(runningAiWorkspacesRef.current.has(newPath));
      setQueuedAiMessages([]);
      setLiveExecutionSteps([]);

      projectAiStateRef.current[newPath] = {
        provider: targetProvider,
        model: targetModel,
        chatSessions: projectChatSessions,
        activeChatSessionId: projectActiveSessionId,
      };

      try {
        localStorage.setItem(
          `ide_ai_state_${newPath}`,
          JSON.stringify({
            provider: targetProvider,
            model: targetModel,
            chatSessions: projectChatSessions,
            activeChatSessionId: projectActiveSessionId,
          })
        );
        localStorage.setItem('ide_ai_chat_sessions', JSON.stringify(projectChatSessions));
      } catch {}

      setToastMessage(`Projeto ativo: ${displayName}`);
      setTimeout(() => setToastMessage(null), 3000);

      // 5. Troca de Contexto do Brain (estilo Sistema Operacional)
      switchProjectBrainContext(newPath, repoName).catch((err) => {
        console.warn('[handleSelectWorkspace] Erro ao alternar contexto do Brain:', err);
      });

      logSystemActivity('ide_ai_chat', 'switch_project', displayName, {
        workspacePath: newPath,
        sessionId: projectActiveSessionId,
        provider: targetProvider,
        restored: Boolean(restoredActiveSession),
      });
    },
    [
      loadWorkspaceTree,
      workspacePath,
      openFiles,
      activeFileId,
      terminalSessions,
      activeSessionId,
      selectedAiProvider,
      selectedModel,
      chatSessions,
      activeChatSessionId,
      aiHistory,
    ]
  );

  const handleRunProjectCheck = async () => {
    const ws = workspacePath || '/Users/walancy/Documents/codes/devflow-desktop';
    if (!window.electronAPI?.shell?.exec) return;
    checkedPathRef.current = ws;
    setIsCheckingProject(true);
    try {
      const sh = window.electronAPI.shell.exec;
      const readText = async (name: string) => {
        try { const r = await window.electronAPI.fs.readFile(`${ws.replace(/\/$/, '')}/${name}`); return r.error ? undefined : r.content; } catch { return undefined; }
      };
      const ls = await sh('ls -A1', ws);
      const rootFiles = (ls.stdout || '').split('\n').map((l) => l.trim()).filter(Boolean);
      const plans = planChecks({ tsconfigText: await readText('tsconfig.json'), packageJsonText: await readText('package.json'), rootFiles });
      const parsed: IdeProblem[] = [];
      const results: CheckResult[] = [];
      for (const plan of plans) {
        const res = await sh(plan.command, ws);
        const out = (res.stdout || '') + '\n' + (res.stderr || '');
        let found: IdeProblem[] | null;
        if (plan.kind === 'tsc') {
          found = parseTscOutput(out, ws);
          // sem nenhum erro de TS e com saída de falha: o tsc nem rodou (não instalado, tsconfig inválido...)
          if (!found.length && res.exitCode !== 0 && !/error TS\d+/.test(out)) found = null;
        } else {
          found = plan.kind === 'eslint' ? parseEslintJson(out, ws) : parseOxlintJson(out, ws);
        }
        if (found) {
          parsed.push(...found);
          results.push({ label: plan.label, ok: true, count: found.length });
        } else {
          const firstLine = out.split('\n').map((l) => l.trim()).find((l) => l && !/^npm (warn|notice)/i.test(l)) || 'não foi possível executar';
          results.push({ label: plan.label, ok: false, count: 0, error: firstLine.slice(0, 140) });
        }
      }
      if (!plans.length) results.push({ label: 'Projeto', ok: false, count: 0, error: 'sem tsconfig.json, ESLint ou oxlint configurados nesta pasta' });

      // remove duplicados (a mesma regra vinda de duas ferramentas na mesma posição)
      const seen = new Set<string>();
      const unique = parsed.filter((p) => { const k = `${p.source}:${p.filePath}:${p.line}:${p.column}:${p.code}`; if (seen.has(k)) return false; seen.add(k); return true; });
      if (checkedPathRef.current !== ws) return; // o usuário trocou de projeto durante a checagem
      setProjectProblems(unique);
      setProjectCheckResults(results);
      setLastProjectCheckTime(new Date());
      setEditorErrors(unique.filter((p) => p.severity === 'error').length);
      setEditorWarnings(unique.filter((p) => p.severity === 'warning').length);
    } catch (e) {
      console.error('Error running project check:', e);
    } finally {
      setIsCheckingProject(false);
    }
  };

  // Auto-run project check when Problems tab is selected if not yet checked
  useEffect(() => {
    if (activeTermTab === 'problems' && projectProblems.length === 0 && !isCheckingProject) {
      handleRunProjectCheck();
    }
  }, [activeTermTab]);

  // Trocou o projeto da header: descarta os problemas do projeto anterior e refaz a checagem
  useEffect(() => {
    if (checkedPathRef.current === workspacePath) return;
    checkedPathRef.current = workspacePath;
    setProjectProblems([]);
    setProjectCheckResults([]);
    setEditorMarkers([]);
    setEditorErrors(0);
    setEditorWarnings(0);
    setLastProjectCheckTime(null);
    if (activeTermTab === 'problems') handleRunProjectCheck();
  }, [workspacePath]);

  // Open File in Monaco Editor (with line range / line number precision navigation)
  const handleOpenFile = async (rawFilePath: string, fileName?: string, existingContent?: string, targetLineRange?: string | number) => {
    let filePath = rawFilePath;
    let lineToJump: number | undefined = typeof targetLineRange === 'number' ? targetLineRange : undefined;
    if (typeof targetLineRange === 'string') {
      const parsed = parseInt(targetLineRange.replace(/^#?L?/i, '').split('-')[0], 10);
      if (!isNaN(parsed)) lineToJump = parsed;
    } else if (filePath.includes('#L')) {
      const [pathPart, linePart] = filePath.split('#L');
      filePath = pathPart;
      const parsed = parseInt(linePart.split('-')[0], 10);
      if (!isNaN(parsed)) lineToJump = parsed;
    }

    const existing = openFiles.find((f) => f.path === filePath || f.id === filePath);
    if (existing) {
      setActiveFileId(existing.id);
      if (lineToJump && editorInstanceRef.current) {
        setTimeout(() => {
          try {
            editorInstanceRef.current?.revealLineInCenter(lineToJump);
            editorInstanceRef.current?.setPosition({ lineNumber: lineToJump, column: 1 });
            editorInstanceRef.current?.focus();
          } catch {}
        }, 120);
      }
      return;
    }

    let content = existingContent;
    if (content === undefined && window.electronAPI?.fs?.readFile) {
      try {
        const res = await window.electronAPI.fs.readFile(filePath);
        content = res.content;
      } catch {
        content = `// Não foi possível carregar o arquivo: ${filePath}`;
      }
    }

    const name = fileName || filePath.split('/').pop() || 'untitled';
    const newFile: OpenFileItem = {
      id: filePath,
      name,
      path: filePath,
      content: content || '',
      language: getFileLanguage(name),
      isDirty: false,
    };

    setOpenFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);

    if (lineToJump && editorInstanceRef.current) {
      setTimeout(() => {
        try {
          editorInstanceRef.current?.revealLineInCenter(lineToJump);
          editorInstanceRef.current?.setPosition({ lineNumber: lineToJump, column: 1 });
          editorInstanceRef.current?.focus();
        } catch {}
      }, 200);
    }

    // If opening a file and no workspacePath is set yet, automatically synchronize workspacePath & terminalCwd
    if (!workspacePath && filePath && filePath.startsWith('/')) {
      const parts = filePath.split('/');
      parts.pop();
      const fileDir = parts.join('/');
      if (window.electronAPI?.shell?.exec) {
        window.electronAPI.shell.exec('git rev-parse --show-toplevel', fileDir).then((res) => {
          if (res.exitCode === 0 && res.stdout.trim()) {
            const root = res.stdout.trim();
            if (root) {
              setWorkspacePath(root);
              setTerminalCwd(root);
              localStorage.setItem('ide_workspace_path', root);
              localStorage.setItem('ide_terminal_cwd', root);
            }
          }
        }).catch(() => {});
      }
    }
  };

  // Render user prompt text with interactive @[file] pills (Antigravity Style)
  const renderPromptTextWithMentions = (text: string) => {
    if (!text) return null;
    const parts = text.split(/(@\[.*?\])/g);
    return (
      <span>
        {parts.map((part, pIdx) => {
          const match = part.match(/^@\[(.*?)\]$/);
          if (match) {
            const filePath = match[1];
            const fileName = filePath.split('/').filter(Boolean).pop() || filePath;
            const isImg = /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(filePath);
            return (
              <span
                key={pIdx}
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpenFile(filePath, fileName);
                }}
                title={`Abrir no editor: ${filePath}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: 'rgba(59, 130, 246, 0.18)',
                  border: '1px solid rgba(59, 130, 246, 0.35)',
                  color: '#60a5fa',
                  fontSize: 11.5,
                  fontWeight: 500,
                  fontFamily: 'Poppins, monospace',
                  cursor: 'pointer',
                  verticalAlign: 'baseline',
                  margin: '0 2px',
                  userSelect: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.3)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.6)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.18)';
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.35)';
                }}
              >
                {isImg ? (
                  <ImageIcon size={12} color="#60a5fa" />
                ) : (
                  <FileIcon fileName={fileName} size={12} />
                )}
                <span>@{fileName}</span>
              </span>
            );
          }
          return <span key={pIdx}>{part}</span>;
        })}
      </span>
    );
  };

    // Close Editor More Menu on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (editorMoreMenuRef.current && !editorMoreMenuRef.current.contains(e.target as Node)) {
        setEditorMoreMenuOpen(false);
      }
    };
    if (editorMoreMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [editorMoreMenuOpen]);

  const handleCloseAllFiles = () => {
    setRecentlyClosedFiles((prev) => [...openFiles, ...prev]);
    setOpenFiles([]);
    setActiveFileId('');
    setEditorMoreMenuOpen(false);
  };

  const handleCloseOtherFiles = () => {
    const current = openFiles.find((f) => f.id === activeFileId);
    if (current) {
      setRecentlyClosedFiles((prev) => [...openFiles.filter((f) => f.id !== activeFileId), ...prev]);
      setOpenFiles([current]);
    }
    setEditorMoreMenuOpen(false);
  };

  const handleCloseSavedFiles = () => {
    const unsaved = openFiles.filter((f) => f.isDirty);
    const saved = openFiles.filter((f) => !f.isDirty);
    setRecentlyClosedFiles((prev) => [...saved, ...prev]);
    if (unsaved.length > 0) {
      setOpenFiles(unsaved);
      if (!unsaved.some((f) => f.id === activeFileId)) {
        setActiveFileId(unsaved[0].id);
      }
    }
    setEditorMoreMenuOpen(false);
  };

  const handleReopenClosedFile = () => {
    if (recentlyClosedFiles.length === 0) return;
    const [last, ...rest] = recentlyClosedFiles;
    setRecentlyClosedFiles(rest);
    if (!openFiles.some((f) => f.id === last.id)) {
      setOpenFiles((prev) => [...prev, last]);
    }
    setActiveFileId(last.id);
    setEditorMoreMenuOpen(false);
  };

  const handleCopyPath = () => {
    if (activeFile?.path) {
      navigator.clipboard.writeText(activeFile.path);
      setToastMessage('Caminho absoluto copiado!');
    }
    setEditorMoreMenuOpen(false);
  };

  const handleCopyRelativePath = () => {
    if (activeFile?.path) {
      const rel = activeFile.path.replace(workspacePath, '').replace(/^\//, '');
      navigator.clipboard.writeText(rel);
      setToastMessage('Caminho relativo copiado!');
    }
    setEditorMoreMenuOpen(false);
  };

  const handleRevealInExplorer = () => {
    setShowExplorer(true);
    setActiveActivityTab('explorer');
    setEditorMoreMenuOpen(false);
  };

  const handleFormatDocument = () => {
    try {
      editorInstanceRef.current?.getAction('editor.action.formatDocument')?.run();
      setToastMessage('Documento formatado!');
    } catch {}
    setEditorMoreMenuOpen(false);
  };

  const handleAiReviewCurrentFile = () => {
    setEditorMoreMenuOpen(false);
    setShowAiPanel(true);
    setSelectedAiProvider('antigravity');
    const promptText = `Por favor, faça um code review deste arquivo (${activeTab?.name || 'arquivo atual'}):\n\`\`\`${activeTab?.language || ''}\n${activeTab?.content || ''}\n\`\`\``;
    setAskPrompt(promptText);
  };

  const handleAiExplainCurrentFile = () => {
    setEditorMoreMenuOpen(false);
    setShowAiPanel(true);
    setSelectedAiProvider('antigravity');
    const promptText = `Por favor, explique o funcionamento e a lógica deste arquivo (${activeTab?.name || 'arquivo atual'}):\n\`\`\`${activeTab?.language || ''}\n${activeTab?.content || ''}\n\`\`\``;
    setAskPrompt(promptText);
  };

  const handleCloseFile = (fileId: string, e?: React.MouseEvent) => {
    e?.stopPropagation?.();
    const nextFiles = openFiles.filter((f) => f.id !== fileId);
    setOpenFiles(nextFiles);
    if (activeFileId === fileId) {
      setActiveFileId(nextFiles.length > 0 ? nextFiles[nextFiles.length - 1].id : null);
    }
  };

  // Code Review (Diff View) Handlers
  const handleStartReview = async (files: ChangedFileItem[], index = 0) => {
    if (!files || files.length === 0) return;
    const safeIdx = Math.max(0, Math.min(index, files.length - 1));
    const targetFile = files[safeIdx];
    if (!targetFile) return;

    const baseCwd = workspacePath || targetFile.path.split('/').slice(0, -1).join('/');
    let relPath = targetFile.path;
    if (relPath.startsWith(baseCwd + '/')) {
      relPath = relPath.slice(baseCwd.length + 1);
    }

    let originalContent = '';
    if (window.electronAPI?.shell?.exec) {
      try {
        const gitShowRes = await window.electronAPI.shell.exec(`git show HEAD:"${relPath}"`, baseCwd);
        if (gitShowRes.exitCode === 0) {
          originalContent = gitShowRes.stdout;
        }
      } catch {}
    }

    let modifiedContent = '';
    const openF = openFiles.find((f) => f.path === targetFile.path);
    if (openF) {
      modifiedContent = openF.content;
    } else if (window.electronAPI?.fs?.readFile) {
      try {
        const res = await window.electronAPI.fs.readFile(targetFile.path);
        modifiedContent = res.content || '';
      } catch {}
    }

    setActiveReview({
      files,
      currentIndex: safeIdx,
      originalContent,
      modifiedContent,
      isSideBySide: true,
    });
  };

  const handleReviewNavigate = async (newIndex: number) => {
    if (!activeReview) return;
    if (newIndex < 0 || newIndex >= activeReview.files.length) return;
    await handleStartReview(activeReview.files, newIndex);
  };

  const handleReviewDiscard = async () => {
    if (!activeReview) return;
    const current = activeReview.files[activeReview.currentIndex];
    if (!current) return;

    const baseCwd = workspacePath || current.path.split('/').slice(0, -1).join('/');
    let relPath = current.path;
    if (relPath.startsWith(baseCwd + '/')) {
      relPath = relPath.slice(baseCwd.length + 1);
    }

    try {
      const isTracked = activeReview.originalContent.length > 0;
      if (isTracked) {
        await window.electronAPI.shell.exec(`git checkout -- "${relPath}"`, baseCwd);
      } else {
        await window.electronAPI.fs.deleteItem(current.path);
      }
      setToastMessage(`Alterações descartadas em ${current.name}`);
      await loadWorkspaceTree(baseCwd);

      if (isTracked) {
        const res = await window.electronAPI.fs.readFile(current.path);
        setOpenFiles((prev) =>
          prev.map((f) => (f.path === current.path ? { ...f, content: res.content, isDirty: false } : f))
        );
      } else {
        setOpenFiles((prev) => prev.filter((f) => f.path !== current.path));
      }
    } catch {
      setToastMessage(`Erro ao descartar alterações em ${current.name}`);
    }

    const remaining = activeReview.files.filter((_, i) => i !== activeReview.currentIndex);
    if (remaining.length > 0) {
      await handleStartReview(remaining, Math.min(activeReview.currentIndex, remaining.length - 1));
    } else {
      setActiveReview(null);
    }
  };

  const handleReviewAccept = () => {
    if (!activeReview) return;
    const current = activeReview.files[activeReview.currentIndex];
    setToastMessage(`Alterações aceitas em ${current.name}`);
    if (activeReview.currentIndex < activeReview.files.length - 1) {
      handleReviewNavigate(activeReview.currentIndex + 1);
    } else {
      setActiveReview(null);
      handleOpenFile(current.path, current.name);
    }
  };

  // GitHub Issues Integration unificada com o método e cache da tela de Projetos
  const refreshGitHubIssues = useCallback(async () => {
    const targetProjectFull = activeHeaderProject?.fullName || gitRepoName;
    const cwd = activeHeaderProject?.localDir || workspacePath || process.cwd();
    setIsLoadingIssues(true);

    let owner = '';
    let repo = '';
    if (targetProjectFull && targetProjectFull.includes('/')) {
      const parts = targetProjectFull.split('/');
      owner = parts[0];
      repo = parts[1];
    } else if (targetProjectFull) {
      repo = targetProjectFull;
      owner = activeHeaderProject?.owner || githubUser?.login || 'walancy';
    }

    try {
      // 1. Hidratação imediata via cache de Projetos (GLOBAL_PROJECTS_CACHE)
      const cache = GLOBAL_PROJECTS_CACHE?.repoDetailsCache;
      if (cache) {
        const candidates = [
          targetProjectFull,
          `${owner}/${repo}`,
          activeHeaderProject?.name,
          gitRepoName,
          repo,
          activeHeaderProject?.localDir ? activeHeaderProject.localDir.split('/').filter(Boolean).pop() : '',
          workspacePath ? workspacePath.split('/').filter(Boolean).pop() : '',
        ].filter(Boolean);
        // o cache só pinta a lista na hora; a busca no GitHub abaixo sempre roda (senão "Atualizar" nunca atualiza)
        let hydrated = false;
        for (const c of candidates) {
          if (hydrated) break;
          for (const [k, v] of Object.entries(cache)) {
            // nome exato (ou "dono/repo"): `includes` casava repositórios homônimos e trazia issues de outro projeto
            if ((k.toLowerCase() === c!.toLowerCase() || k.toLowerCase().endsWith(`/${c!.toLowerCase()}`)) && v?.issues?.length > 0) {
              const converted: GitHubIssueItem[] = v.issues.map((pi: any) => ({
                number: pi.githubNumber || (typeof pi.id === 'string' && pi.id.startsWith('#') ? parseInt(pi.id.slice(1), 10) : Number(pi.id)) || 0,
                title: pi.title,
                state: pi.rawState || (pi.status === 'Concluído' ? 'closed' : 'open'),
                updatedAt: pi.dateStr || pi.createdAtIso || new Date().toISOString(),
                createdAt: pi.createdAtIso,
                author: pi.author || 'walancy',
                authorAvatar: pi.authorAvatarUrl,
                assignees: pi.assignees?.map((a: any) => ({ login: a.name, avatarUrl: a.avatarUrl })) || [],
                assignee: pi.assignees?.[0] ? { login: pi.assignees[0].name, avatarUrl: pi.assignees[0].avatarUrl } : null,
                labels: (pi.rawLabels || (pi.tag ? [pi.tag] : [])).map((name: string) => ({ name })),
                milestone: pi.milestoneTitle ? { title: pi.milestoneTitle } : (pi.iterationTitle ? { title: pi.iterationTitle } : null),
                milestoneTitle: pi.milestoneTitle,
                milestoneNumber: pi.milestoneNumber,
                iterationId: pi.iterationId,
                iterationTitle: pi.iterationTitle,
                projectV2Status: pi.projectV2Status,
                projectV2ItemId: pi.projectV2ItemId,
                body: pi.description,
                url: pi.htmlUrl,
              }));
              if (converted.length > 0) {
                setGitIssues(converted);
                hydrated = true;
                break;
              }
            }
          }
        }
      }

      // 2. Busca oficial do GitHub via IPC (fetchRepoIssues + fetchRepoProjects + fetchRepoMilestones)
      if (owner && repo && window.electronAPI?.github?.fetchRepoIssues) {
        const [issuesRes, milestonesRes, projectsRes] = await Promise.allSettled([
          window.electronAPI.github.fetchRepoIssues(owner, repo),
          window.electronAPI.github.fetchRepoMilestones?.(owner, repo),
          window.electronAPI.github.fetchRepoProjects?.(owner, repo),
        ]);

        if (issuesRes.status === 'fulfilled' && issuesRes.value?.success && Array.isArray(issuesRes.value.issues)) {
          const rawIssues = issuesRes.value.issues;
          const milestonesRaw = milestonesRes.status === 'fulfilled' && milestonesRes.value?.success ? milestonesRes.value.milestones || [] : [];
          const projectsRaw = projectsRes.status === 'fulfilled' && projectsRes.value?.success ? projectsRes.value.projects || [] : [];

          // Extrai iterações e itens de Project V2
          const issueIterationsMap = new Map<number, { iterationId?: string; iterationTitle?: string }>();
          if (projectsRaw.length > 0 && window.electronAPI?.github?.fetchProjectItems) {
            for (const proj of projectsRaw) {
              try {
                const itemsRes = await window.electronAPI.github.fetchProjectItems(proj.number, owner);
                if (itemsRes?.success && itemsRes.project?.items?.nodes) {
                  for (const it of itemsRes.project.items.nodes) {
                    const issNumber = it.content?.number;
                    if (issNumber) {
                      const fVals = it.fieldValues?.nodes || [];
                      for (const fv of fVals) {
                        if (fv?.iterationId || fv?.title) {
                          issueIterationsMap.set(issNumber, {
                            iterationId: fv.iterationId,
                            iterationTitle: fv.title,
                          });
                        }
                      }
                    }
                  }
                }
              } catch {}
            }
          }

          const mapped: GitHubIssueItem[] = rawIssues.map((item: any) => {
            const itInfo = issueIterationsMap.get(item.number);
            const mTitle = typeof item.milestone === 'string' ? item.milestone : item.milestone?.title;
            const mNum = item.milestone?.number;

            // Extrai sprint por título de issue (ex: "Sprint13 — ...")
            let titleSprint: string | undefined = undefined;
            if (item.title) {
              const tm = item.title.match(/^sprint\s*([0-9]+(?:-[0-9]+)?)/i);
              if (tm) titleSprint = `Sprint ${tm[1]}`;
            }

            return {
              number: item.number,
              title: item.title,
              state: item.state || 'open',
              updatedAt: item.updated_at || item.updatedAt || new Date().toISOString(),
              createdAt: item.created_at || item.createdAt,
              author: typeof item.user === 'object' && item.user !== null
                ? item.user.login || 'walancy'
                : typeof item.author === 'object' && item.author !== null
                ? item.author.login || 'walancy'
                : String(item.user || item.author || 'walancy'),
              authorAvatar: item.user?.avatar_url || item.authorAvatar,
              assignees: Array.isArray(item.assignees) && item.assignees.length > 0
                ? item.assignees.map((a: any) => ({ login: typeof a === 'string' ? a : a.login, avatarUrl: a.avatar_url }))
                : item.assignee ? [{ login: item.assignee.login, avatarUrl: item.assignee.avatar_url }] : [],
              assignee: item.assignee ? { login: item.assignee.login, avatarUrl: item.assignee.avatar_url } : null,
              labels: (item.labels || []).map((l: any) => ({ name: typeof l === 'string' ? l : l.name, color: l.color })),
              milestone: item.milestone ? { title: mTitle || '', number: mNum } : (itInfo?.iterationTitle ? { title: itInfo.iterationTitle } : titleSprint ? { title: titleSprint } : null),
              milestoneTitle: mTitle || titleSprint,
              milestoneNumber: mNum,
              iterationId: itInfo?.iterationId,
              iterationTitle: itInfo?.iterationTitle || titleSprint,
              body: item.body,
              url: item.html_url || item.url,
            };
          });

          setGitIssues(mapped);
          logSystemActivity('tarefas', 'refresh_issues', targetProjectFull, { count: mapped.length, source: 'github_api' });
          setIsLoadingIssues(false);
          return;
        }
      }

      // 3. Fallback Git IPC local (git.getIssues)
      if (window.electronAPI?.git?.getIssues) {
        const issues = await window.electronAPI.git.getIssues(cwd);
        if (Array.isArray(issues) && issues.length > 0) {
          const normalized = issues.map((item: any) => {
            const mTitle = typeof item.milestone === 'string' ? item.milestone : item.milestone?.title;
            let titleSprint: string | undefined = undefined;
            if (item.title) {
              const tm = item.title.match(/^sprint\s*([0-9]+(?:-[0-9]+)?)/i);
              if (tm) titleSprint = `Sprint ${tm[1]}`;
            }
            return {
              ...item,
              author: typeof item.author === 'object' && item.author !== null
                ? (item.author.login || item.author.name || 'walancy')
                : String(item.author || 'walancy'),
              milestoneTitle: mTitle || titleSprint,
              iterationTitle: item.iterationTitle || titleSprint,
            };
          });
          setGitIssues(normalized);
          logSystemActivity('tarefas', 'refresh_issues', targetProjectFull, { count: normalized.length, source: 'git_ipc' });
          setIsLoadingIssues(false);
          return;
        }
      }

      // 4. Fallback gh CLI
      if (window.electronAPI?.shell?.exec) {
        const res = await window.electronAPI.shell.exec(
          'export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"; gh issue list --limit 100 --state all --json number,title,author,updatedAt,createdAt,closedAt,labels,state,milestone,assignees,body,url',
          cwd
        );
        if (res.exitCode === 0 && res.stdout.trim()) {
          const parsed = JSON.parse(res.stdout.trim());
          if (Array.isArray(parsed)) {
            const normalized = parsed.map((item: any) => {
              const mTitle = typeof item.milestone === 'string' ? item.milestone : item.milestone?.title;
              let titleSprint: string | undefined = undefined;
              if (item.title) {
                const tm = item.title.match(/^sprint\s*([0-9]+(?:-[0-9]+)?)/i);
                if (tm) titleSprint = `Sprint ${tm[1]}`;
              }
              return {
                ...item,
                author: typeof item.author === 'object' && item.author !== null
                  ? (item.author.login || item.author.name || 'walancy')
                  : String(item.author || 'walancy'),
                milestoneTitle: mTitle || titleSprint,
                iterationTitle: item.iterationTitle || titleSprint,
              };
            });
            setGitIssues(normalized);
            logSystemActivity('tarefas', 'refresh_issues', targetProjectFull, { count: normalized.length, source: 'gh_cli' });
          }
        }
      }
    } catch (e) {
      console.warn('Failed to load GitHub issues:', e);
    } finally {
      setIsLoadingIssues(false);
    }
  }, [workspacePath, gitRepoName, activeHeaderProject, githubUser?.login]);

  const handleCreateIssue = async (title: string) => {
    if (!title.trim()) return;
    const cwd = workspacePath || process.cwd();
    setIsLoadingIssues(true);
    try {
      if (window.electronAPI?.git?.createIssue) {
        const res = await window.electronAPI.git.createIssue(cwd, title.trim());
        if (res.success) {
          setToastMessage('Issue criada com sucesso via GitHub API!');
          setNewIssueTitle('');
          setIsCreatingIssue(false);
          await refreshGitHubIssues();
          return;
        }
      }

      // Fallback to gh CLI
      if (window.electronAPI?.shell?.exec) {
        const res = await window.electronAPI.shell.exec(
          `export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"; gh issue create --title "${title.replace(/"/g, '\\"')}" --body "Criada via Aura Dev"`,
          cwd
        );
        if (res.exitCode === 0) {
          setToastMessage('Issue criada com sucesso no GitHub!');
          setNewIssueTitle('');
          setIsCreatingIssue(false);
          await refreshGitHubIssues();
        } else {
          setToastMessage(`Erro ao criar issue: ${res.stderr || res.error}`);
        }
      }
    } catch (e: any) {
      setToastMessage(`Erro: ${e.message}`);
    } finally {
      setIsLoadingIssues(false);
    }
  };

  // "Resolver com IA": no CLI manda a issue para a IA do terminal ativo; na IDE (e nas demais telas) anexa ao chat da IA da IDE
  const handleResolveIssueWithAi = (issue: GitHubIssueItem) => {
    setIsIssuesModalOpen(false);
    if (activeTab !== 'cli') {
      if (activeTab !== 'ide') setActiveTab('ide');
      handleTaskDoWithAi(issue);
      return;
    }
    const sess = cliTerminalSessions.find((x) => x.id === cliActiveSessionId) || cliTerminalSessions[0];
    const kind = (sess?.type || '').toLowerCase();
    if (!sess || !/^(claude|agy|antigravity|gemini|codex|ollama)$/.test(kind)) {
      setToastMessage('O terminal ativo não é uma IA: abra o Claude, Antigravity, Gemini ou Codex nele');
      setTimeout(() => setToastMessage(null), 3000);
      return;
    }
    const body = (issue.body || '').trim().slice(0, 4000);
    const text = `Resolva a issue #${issue.number}: ${issue.title}\n\n${body ? `${body}\n\n` : ''}${issue.url ? `Link: ${issue.url}` : ''}`.trim();
    window.electronAPI?.pty?.write(sess.id, `\x1b[200~${text}\x1b[201~`);
    setTimeout(() => window.electronAPI?.pty?.write(sess.id, '\r'), 200);
    setToastMessage(`Issue #${issue.number} enviada para a IA do terminal ativo`);
    setTimeout(() => setToastMessage(null), 2500);
  };

  const handleLinkIssueToChat = (issue: GitHubIssueItem) => {
    setIsIssuesModalOpen(false);
    setShowAiPanel(true);
    const promptText = `Resolver Issue #${issue.number}: ${issue.title}`;
    setAskPrompt(promptText);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    setToastMessage(`Issue #${issue.number} vinculada ao chat de IA`);
  };

  const handleTaskDoWithAi = useCallback((issue: GitHubIssueItem) => {
    setAttachedTask({
      number: issue.number,
      title: issue.title,
      body: issue.body,
      state: issue.state,
      labels: issue.labels?.map((l) => ({ name: l.name, color: l.color })),
      url: issue.url,
    });
    setShowAiPanel(true);
    setTimeout(() => {
      inputRef.current?.focus();
      promptEditorRef.current?.focus();
    }, 150);
    setToastMessage(`Tarefa #${issue.number} anexada ao chat de IA`);
  }, []);

  const handleOpenIssueInBrowser = (issueNumber: number) => {
    const repo = gitRepoName || 'Walancy/aura-dev';
    const cleanRepo = repo.includes('/') ? repo : `Walancy/${repo}`;
    const url = `https://github.com/${cleanRepo}/issues/${issueNumber}`;
    if (window.electronAPI?.shell?.openExternal) {
      window.electronAPI.shell.openExternal(url);
    }
  };

  const handleOpenIssueSidesheet = useCallback((issueNumber: number) => {
    const rawIssue = gitIssues.find((i) => i.number === issueNumber);
    if (!rawIssue) return;

    const labelNames = (rawIssue.labels || []).map((l: any) => typeof l === 'string' ? l : l.name);
    const isOpen = (rawIssue.state || 'open').toLowerCase() === 'open';

    const assignees = Array.isArray(rawIssue.assignees) && rawIssue.assignees.length > 0
      ? rawIssue.assignees.map((a: any) => {
          const login = typeof a === 'string' ? a : a?.login || 'user';
          return {
            name: login,
            avatarBg: '#3b82f6',
            initial: login.charAt(0).toUpperCase(),
            avatarUrl: typeof a === 'object' ? (a.avatarUrl || a.avatar_url) : undefined,
          };
        })
      : rawIssue.assignee
      ? [{
          name: typeof rawIssue.assignee === 'object' ? rawIssue.assignee.login : String(rawIssue.assignee),
          avatarBg: '#3b82f6',
          initial: String(typeof rawIssue.assignee === 'object' ? rawIssue.assignee.login : rawIssue.assignee).charAt(0).toUpperCase(),
          avatarUrl: typeof rawIssue.assignee === 'object' ? ((rawIssue.assignee as any).avatarUrl || (rawIssue.assignee as any).avatar_url) : undefined,
        }]
      : [];

    const storedSprint = (() => {
      try {
        const scopedKey = gitRepoName ? `devflow_issue_sprints_${gitRepoName}` : 'devflow_issue_sprints';
        const raw = localStorage.getItem(scopedKey);
        const map = raw ? JSON.parse(raw) : {};
        return map[rawIssue.number];
      } catch {
        return null;
      }
    })();

    const iterationTitle = rawIssue.iterationTitle;
    const iterationId = rawIssue.iterationId;
    const projectV2Status = rawIssue.projectV2Status;
    const projectV2ItemId = rawIssue.projectV2ItemId;
    const milestoneTitle = storedSprint || rawIssue.milestoneTitle || rawIssue.milestone?.title || iterationTitle || undefined;
    const milestoneNumber = rawIssue.milestoneNumber || rawIssue.milestone?.number;

    const mapped: ProjectIssue = {
      id: `#${rawIssue.number}`,
      projectId: 0,
      githubNumber: rawIssue.number,
      nodeId: (rawIssue as any).node_id,
      htmlUrl: rawIssue.url || (rawIssue as any).html_url,
      rawLabels: labelNames,
      rawState: isOpen ? 'open' : 'closed',
      author: typeof rawIssue.author === 'object' && rawIssue.author !== null
        ? rawIssue.author.login || 'user'
        : String(rawIssue.author || 'user'),
      authorAvatarUrl: rawIssue.authorAvatar || (typeof rawIssue.author === 'object' ? (rawIssue.author as any).avatar_url : undefined),
      commentsCount: (rawIssue as any).comments || 0,
      title: rawIssue.title,
      description: rawIssue.body || '',
      dateStr: rawIssue.updatedAt || rawIssue.createdAt || (rawIssue as any).created_at || 'Hoje',
      createdAtIso: rawIssue.createdAt || (rawIssue as any).created_at || new Date().toISOString(),
      durationDays: 1,
      tag: labelNames[0] || 'Geral',
      tagColor: { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa' },
      priority: 'Média',
      priorityColor: '#3b82f6',
      status: isOpen ? 'A Fazer' : 'Concluído',
      assignees,
      progress: isOpen ? 0 : 100,
      milestoneNumber,
      milestoneTitle,
      iterationId,
      iterationTitle,
      projectV2Status,
      projectV2ItemId,
    };

    setSidesheetIssue(mapped);
  }, [gitIssues, gitRepoName]);

  // Git Branches Integration
  const refreshGitBranches = useCallback(async () => {
    if (!window.electronAPI?.shell?.exec) return;
    const cwd = activeHeaderProject?.localDir || workspacePath || process.cwd();
    try {
      const curRes = await window.electronAPI.shell.exec('git branch --show-current', cwd);
      if (curRes.exitCode === 0 && curRes.stdout.trim()) {
        setCurrentBranch(curRes.stdout.trim());
      }

      const remoteRes = await window.electronAPI.shell.exec('git config --get remote.origin.url', cwd);
      if (remoteRes.exitCode === 0 && remoteRes.stdout.trim()) {
        const rUrl = remoteRes.stdout.trim();
        const m = rUrl.match(/[:/]([^/:]+\/[^/:]+?)(?:\.git)?$/);
        if (m && m[1]) {
          setGitRepoName(m[1]);
        }
      }

      const branchRes = await window.electronAPI.shell.exec('git branch -a', cwd);
      if (branchRes.exitCode === 0 && branchRes.stdout.trim()) {
        const lines = branchRes.stdout.trim().split('\n');
        const items: GitBranchItem[] = [];
        for (const l of lines) {
          const isCurr = l.startsWith('*');
          const clean = l.replace(/^\*/, '').trim();
          if (!clean || clean.includes('->')) continue;
          const isRem = clean.startsWith('remotes/');
          const name = isRem ? clean.replace(/^remotes\/[^/]+\//, '') : clean;
          if (!items.some((b) => b.name === name)) {
            items.push({
              name,
              isCurrent: isCurr,
              isRemote: isRem,
            });
          }
        }
        setBranchesList(items);
      }
    } catch {}
  }, [workspacePath, activeHeaderProject?.localDir]);

  const handleCheckoutBranch = async (branch: string) => {
    if (!window.electronAPI?.shell?.exec) return;
    const cwd = workspacePath || process.cwd();
    try {
      const res = await window.electronAPI.shell.exec(`git checkout ${branch}`, cwd);
      if (res.exitCode === 0) {
        setCurrentBranch(branch);
        setIsBranchModalOpen(false);
        setToastMessage(`Branch alterada para: ${branch}`);
        await refreshGitBranches();
        await loadWorkspaceTree(cwd);
      } else {
        setToastMessage(`Erro ao trocar de branch: ${res.stderr || res.error}`);
      }
    } catch (e: any) {
      setToastMessage(`Erro: ${e.message}`);
    }
  };

  const handleCreateBranch = async (newBranch: string) => {
    if (!newBranch.trim() || !window.electronAPI?.shell?.exec) return;
    const cwd = workspacePath || process.cwd();
    try {
      const res = await window.electronAPI.shell.exec(`git checkout -b ${newBranch.trim()}`, cwd);
      if (res.exitCode === 0) {
        setCurrentBranch(newBranch.trim());
        setNewBranchInput('');
        setIsCreatingBranch(false);
        setIsBranchModalOpen(false);
        setToastMessage(`Branch criada e ativa: ${newBranch.trim()}`);
        await refreshGitBranches();
      } else {
        setToastMessage(`Erro ao criar branch: ${res.stderr || res.error}`);
      }
    } catch (e: any) {
      setToastMessage(`Erro: ${e.message}`);
    }
  };

  const handleSyncGit = async () => {
    if (!window.electronAPI?.shell?.exec || isSyncingGit) return;
    const cwd = workspacePath || process.cwd();
    setIsSyncingGit(true);
    try {
      const res = await window.electronAPI.shell.exec('git pull --rebase && git push', cwd);
      if (res.exitCode === 0) {
        setToastMessage('Sincronizado com sucesso com o GitHub!');
      } else {
        setToastMessage(`Sincronização: ${res.stdout || res.stderr || 'concluído'}`);
      }
      await refreshGitBranches();
      await refreshGitHubIssues();
    } catch (e: any) {
      setToastMessage(`Erro na sincronização: ${e.message}`);
    } finally {
      setIsSyncingGit(false);
    }
  };

  useEffect(() => {
    refreshGitBranches();
    refreshGitHubIssues();
  }, [refreshGitBranches, refreshGitHubIssues]);

  // Mantém o gitRepoName alinhado com o projeto ativo selecionado no cabeçalho
  useEffect(() => {
    if (activeHeaderProject?.fullName && activeHeaderProject.fullName !== gitRepoName) {
      setGitRepoName(activeHeaderProject.fullName);
    }
  }, [activeHeaderProject?.fullName]);

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    setOpenFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, content: value, isDirty: true } : f))
    );
  };

  const handleSaveActiveFile = useCallback(async () => {
    const currentFile = openFiles.find((f) => f.id === activeFileId);
    if (!currentFile) return;

    if (window.electronAPI?.fs?.writeFile) {
      try {
        await window.electronAPI.fs.writeFile(currentFile.path, currentFile.content);
        setOpenFiles((prev) =>
          prev.map((f) => (f.id === activeFileId ? { ...f, isDirty: false } : f))
        );
        setToastMessage(`Salvo com sucesso: ${currentFile.name}`);
        setTimeout(() => setToastMessage(null), 2500);
      } catch (err: any) {
        setToastMessage(`Erro ao salvar: ${err.message}`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } else {
      setOpenFiles((prev) =>
        prev.map((f) => (f.id === activeFileId ? { ...f, isDirty: false } : f))
      );
      setToastMessage(`Alterações salvas localmente: ${currentFile.name}`);
      setTimeout(() => setToastMessage(null), 2500);
    }
  }, [openFiles, activeFileId]);

  // Generates a commit message from the repo's diff using the AI provider
  // currently selected in the AI chat panel (Source Control "Generate" button)
  const handleGenerateCommitMessage = async (repoDir: string): Promise<string> => {
    const currentProvider = AI_PROVIDERS.find((p) => p.id === selectedAiProvider);
    if (!currentProvider) {
      throw new Error('Selecione uma IA no painel de chat para gerar a mensagem de commit.');
    }

    const cliCmd = currentProvider.cliCommand;
    const checkRes = await window.electronAPI?.shell?.exec(`which ${cliCmd}`, repoDir);
    if (!checkRes || checkRes.exitCode !== 0 || !checkRes.stdout.trim()) {
      throw new Error(`CLI "${cliCmd}" não encontrado. Selecione outra IA no painel de chat ou instale-a.`);
    }

    const [diffRes, statusRes] = await Promise.all([
      window.electronAPI?.shell?.exec('git diff HEAD --', repoDir),
      window.electronAPI?.shell?.exec('git status --porcelain', repoDir),
    ]);

    let diffText = (diffRes?.stdout || '').trim();
    const untracked = (statusRes?.stdout || '')
      .split('\n')
      .filter((l: string) => l.startsWith('??'))
      .map((l: string) => l.slice(3).trim());
    if (untracked.length > 0) {
      diffText += `\n\n[Novos arquivos não rastreados]: ${untracked.join(', ')}`;
    }
    if (!diffText.trim()) {
      throw new Error('Nenhuma alteração encontrada para gerar a mensagem de commit.');
    }

    const activeModelId = activeModels[currentProvider.id]?.currentModelId;
    const prompt = `Baseado no diff abaixo, escreva APENAS a mensagem de commit no padrão Conventional Commits (ex: "fix: ...", "feat: ...", "refactor: ..."), curta e objetiva, em português, sem corpo extra, sem aspas e sem markdown.\n\nDiff:\n${diffText.slice(0, 8000)}`;

    const res = await window.electronAPI?.ai?.runCli?.({
      cliCmd,
      prompt,
      model: activeModelId,
      cwd: repoDir,
    });

    let output = (res?.stdout || res?.stderr || '').trim();
    output = output.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').trim();
    output = output.replace(/^```[a-z]*\n?/i, '').replace(/```$/, '').trim();
    output = output.replace(/^["']|["']$/g, '').trim();

    if (!output) {
      throw new Error('A IA não retornou uma mensagem válida.');
    }
    return output;
  };

  // Helper to detect authentication / OAuth expired errors in AI output
  const isAuthErrorText = (text?: string): boolean => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
      lower.includes('failed to authenticate') ||
      lower.includes('oauth session expired') ||
      lower.includes('session expired and could not be refreshed') ||
      lower.includes('please run claude login') ||
      lower.includes('please login') ||
      lower.includes('authentication required') ||
      lower.includes('not authenticated') ||
      lower.includes('login required') ||
      lower.includes('authorization required') ||
      lower.includes('token expired') ||
      lower.includes('api key is invalid') ||
      lower.includes('please authenticate')
    );
  };

  // Rich Markdown, Code Blocks, and Link Formatter for Assistant Responses
  const renderFormattedMessage = (rawText: string, msgIdx: number) => {
    if (!rawText) return null;
    const cleanText = rawText.replace(/<!--\s*ISSUE_ACTION_PROMPT:#?\d+\s*-->/g, '').trim();
    if (!cleanText) return null;

    // Split by fenced code blocks: ```lang\n...\n```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts: Array<{ type: 'text' | 'code'; content: string; lang?: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(cleanText)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: cleanText.slice(lastIndex, match.index) });
      }
      parts.push({
        type: 'code',
        lang: match[1] || 'text',
        content: match[2].replace(/\n$/, ''),
      });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < cleanText.length) {
      parts.push({ type: 'text', content: cleanText.slice(lastIndex) });
    }

    // Helper to format inline elements: links [label](url), inline code `code`, bold **text**
    const renderInlineElements = (textChunk: string, chunkKey: string) => {
      const inlineRegex = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*)/g;
      const inlineParts: React.ReactNode[] = [];
      let lIndex = 0;
      let inMatch: RegExpExecArray | null;

      while ((inMatch = inlineRegex.exec(textChunk)) !== null) {
        if (inMatch.index > lIndex) {
          inlineParts.push(textChunk.slice(lIndex, inMatch.index));
        }
        const fullMatch = inMatch[0];
        if (fullMatch.startsWith('[')) {
          // Markdown link
          const label = inMatch[2];
          const url = inMatch[3];
          if (url.startsWith('file://')) {
            const filePath = url.replace('file://', '');
            inlineParts.push(
              <span
                key={`${chunkKey}-link-${inMatch.index}`}
                onClick={() => handleOpenFile(filePath, label)}
                title={`Abrir ${label} no editor`}
                style={{
                  color: '#38bdf8',
                  background: isEffectiveDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(56, 189, 248, 0.15)',
                  padding: '1px 7px',
                  borderRadius: 5,
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  margin: '0 2px',
                  border: 'none',
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <FileText size={11} />
                <span>{label}</span>
              </span>
            );
          } else {
            inlineParts.push(
              <a
                key={`${chunkKey}-ext-${inMatch.index}`}
                href={url}
                onClick={(e) => {
                  e.preventDefault();
                  handleOpenExternalLink(url);
                }}
                style={{ color: '#38bdf8', textDecoration: 'underline', cursor: 'pointer' }}
              >
                {label}
              </a>
            );
          }
        } else if (fullMatch.startsWith('`')) {
          // Inline code
          const codeVal = inMatch[4];
          inlineParts.push(
            <code
              key={`${chunkKey}-code-${inMatch.index}`}
              style={{
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                color: isEffectiveDark ? '#f3f4f6' : '#111827',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 12,
                fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
                border: 'none',
              }}
            >
              {codeVal}
            </code>
          );
        } else if (fullMatch.startsWith('**')) {
          // Bold
          const boldVal = inMatch[5];
          inlineParts.push(
            <strong key={`${chunkKey}-b-${inMatch.index}`} style={{ fontWeight: 600, color: themeTokens.textPrimary }}>
              {boldVal}
            </strong>
          );
        }
        lIndex = inMatch.index + fullMatch.length;
      }
      if (lIndex < textChunk.length) {
        inlineParts.push(textChunk.slice(lIndex));
      }
      return inlineParts;
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        {parts.map((p, pIdx) => {
          if (p.type === 'code' && p.lang === 'mermaid') {
            return <MermaidDiagram key={pIdx} code={p.content} isEffectiveDark={isEffectiveDark} />;
          }
          if (p.type === 'code') {
            const codeKey = `${msgIdx}-code-${pIdx}`;
            const isCopied = copiedCodeKey === codeKey;
            return (
              <div
                key={pIdx}
                style={{
                  borderRadius: 6,
                  background: isEffectiveDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.05)',
                  overflow: 'hidden',
                  marginTop: 4,
                  marginBottom: 4,
                  border: 'none',
                }}
              >
                {/* Code Header Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 12px',
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)',
                    fontSize: 11,
                    color: '#9ca3af',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  <span>{p.lang || 'código'}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(p.content);
                      setCopiedCodeKey(codeKey);
                      setTimeout(() => setCopiedCodeKey(null), 2000);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isCopied ? '#22c55e' : '#9ca3af',
                      cursor: 'pointer',
                      fontSize: 11,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 6px',
                      borderRadius: 4,
                      transition: 'color 0.15s ease',
                    }}
                  >
                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{isCopied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                {/* Code Body */}
                <pre
                  style={{
                    margin: 0,
                    padding: '10px 14px',
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
                    color: isEffectiveDark ? '#e5e7eb' : '#1f2937',
                    overflowX: 'auto',
                    lineHeight: '19px',
                    whiteSpace: 'pre',
                  }}
                >
                  <code>{p.content}</code>
                </pre>
              </div>
            );
          }

          // Plain text chunk: split by lines to handle list items cleanly
          const rawLines = p.content.split('\n');
          // Agrupa alertas GitHub (> [!NOTE] ...) em um único item
          const lines: Array<string | { alert: string; content: string }> = [];
          for (let k = 0; k < rawLines.length; k++) {
            const head = rawLines[k].trim().match(/^>\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*(.*)$/i);
            if (!head) {
              lines.push(rawLines[k]);
              continue;
            }
            const body = head[2] ? [head[2]] : [];
            while (k + 1 < rawLines.length && rawLines[k + 1].trim().startsWith('>')) {
              body.push(rawLines[++k].trim().replace(/^>\s?/, ''));
            }
            lines.push({ alert: head[1].toLowerCase(), content: body.join('\n') });
          }
          return (
            <div key={pIdx} style={{ display: 'flex', flexDirection: 'column', gap: 4, lineHeight: '20px' }}>
              {lines.map((entry, lIdx) => {
                if (typeof entry !== 'string') {
                  return <AlertCallout key={lIdx} type={entry.alert as any} content={entry.content} isEffectiveDark={isEffectiveDark} themeTokens={themeTokens} />;
                }
                const line = entry;
                const trimmed = line.trim();
                const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ');
                const bulletText = isBullet ? trimmed.replace(/^[•\-\*]\s*/, '') : line;

                if (isBullet) {
                  return (
                    <div key={lIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, paddingLeft: 4 }}>
                      <span style={{ color: accentColor || '#38bdf8', fontSize: 13, lineHeight: '20px' }}>•</span>
                      <span style={{ flex: 1 }}>{renderInlineElements(bulletText, `${msgIdx}-${pIdx}-${lIdx}`)}</span>
                    </div>
                  );
                }

                if (!line) {
                  return <div key={lIdx} style={{ height: 6 }} />;
                }

                return <div key={lIdx}>{renderInlineElements(line, `${msgIdx}-${pIdx}-${lIdx}`)}</div>;
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // Layout Handlers & Helpers
  const handleResetLayout = () => {
    setShowActivityBar(true);
    setShowExplorer(true);
    setShowAiPanel(true);
    setIsTerminalCollapsed(false);
    setShowStatusBar(true);
    setSidebarPosition('left');
    setPanelAlignment('center');
    setQuickInputPosition('center');
    setIsZenMode(false);
    setIsCenteredLayout(false);
    setToastMessage('Layout redefinido para o padrão');
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleToggleFullscreen = () => {
    if (window.electronAPI?.window?.toggleMaximize) {
      window.electronAPI.window.toggleMaximize();
    } else if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleToggleZenMode = () => {
    setIsZenMode((prev) => {
      const next = !prev;
      if (next) {
        setShowActivityBar(false);
        setShowExplorer(false);
        setShowAiPanel(false);
        setIsTerminalCollapsed(true);
        setShowStatusBar(false);
        setIsCenteredLayout(true);
      } else {
        setShowActivityBar(true);
        setShowExplorer(true);
        setShowAiPanel(true);
        setIsTerminalCollapsed(false);
        setShowStatusBar(true);
        setIsCenteredLayout(false);
      }
      return next;
    });
  };

  // Toggles straight between Dark and Light (if currently following "system", flips to the
  // explicit opposite of whatever is effectively showing right now).
  const handleToggleThemeMode = () => {
    setThemeMode((prev) => {
      if (prev === 'system') return isEffectiveDark ? 'light' : 'dark';
      return prev === 'dark' ? 'light' : 'dark';
    });
  };

  // Close Customize Layout when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (customizeLayoutRef.current && !customizeLayoutRef.current.contains(e.target as Node)) {
        setIsCustomizeLayoutOpen(false);
      }
    };
    if (isCustomizeLayoutOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isCustomizeLayoutOpen]);

  // Quick Open Commands list
  const quickOpenCommands = React.useMemo(() => [
    {
      id: 'view-sidebar',
      label: 'View: Toggle Primary Side Bar',
      badges: ['⌘', 'B'],
      action: () => setShowExplorer((prev) => !prev),
    },
    {
      id: 'view-panel',
      label: 'View: Toggle Panel (Terminal)',
      badges: ['⌘', 'J'],
      action: () => setIsTerminalCollapsed((prev) => !prev),
    },
    {
      id: 'view-ai',
      label: 'View: Toggle Secondary Side Bar (AI)',
      badges: ['⌘', '⇧', 'A'],
      action: () => setShowAiPanel((prev) => !prev),
    },
    {
      id: 'view-fullscreen',
      label: 'View: Toggle Full Screen',
      badges: ['⌘', 'F'],
      action: () => handleToggleFullscreen(),
    },
    {
      id: 'view-zen',
      label: 'View: Toggle Zen Mode',
      badges: ['⌘', 'K', 'Z'],
      action: () => handleToggleZenMode(),
    },
    {
      id: 'view-centered',
      label: 'View: Toggle Centered Layout',
      action: () => setIsCenteredLayout((prev) => !prev),
    },
    {
      id: 'view-activitybar',
      label: 'View: Toggle Activity Bar',
      action: () => setShowActivityBar((prev) => !prev),
    },
    {
      id: 'view-statusbar',
      label: 'View: Toggle Status Bar',
      action: () => setShowStatusBar((prev) => !prev),
    },
    {
      id: 'view-reset',
      label: 'View: Reset Layout',
      action: () => handleResetLayout(),
    },
    {
      id: 'file-save',
      label: 'File: Save Active File',
      badges: ['⌘', 'S'],
      action: () => handleSaveActiveFile(),
    },
    {
      id: 'file-new',
      label: 'File: New Untitled File',
      action: () => {
        const newId = `untitled-${Date.now()}`;
        const newFile: OpenFileItem = {
          id: newId,
          name: 'untitled.ts',
          path: newId,
          content: '',
          language: 'typescript',
          isDirty: false,
        };
        setOpenFiles((prev) => [...prev, newFile]);
        setActiveFileId(newId);
      },
    },
    {
      id: 'term-new',
      label: 'Terminal: Create New Terminal',
      action: () => handleNewTerminalSession(),
    },
    {
      id: 'term-clear',
      label: 'Terminal: Clear Terminal',
      action: () => {
        if (activeSessionId) window.electronAPI?.pty?.write(activeSessionId, 'clear\r');
      },
    },
    {
      id: 'pref-theme',
      label: 'Preferences: Color Theme & Appearance (Tema e Personalização)',
      action: () => openThemePopup(),
    },
    {
      id: 'pref-layout',
      label: 'Preferences: Customize Layout',
      action: () => setIsCustomizeLayoutOpen(true),
    },
    {
      id: 'dev-reload',
      label: 'Developer: Reload Window',
      action: () => window.location.reload(),
    },
  ], [handleResetLayout, handleSaveActiveFile, handleNewTerminalSession, openThemePopup]);

  // Flatten workspace files for quick search
  const allWorkspaceFiles = React.useMemo(() => {
    const list: { name: string; path: string; isGit?: boolean }[] = [];
    const seen = new Set<string>();

    const recurse = (nodes: ExplorerNode[]) => {
      for (const node of nodes) {
        if (!node.isDirectory) {
          if (!seen.has(node.path)) {
            seen.add(node.path);
            list.push({ name: node.name, path: node.path, isGit: node.name.startsWith('.git') });
          }
        }
        if (node.children && node.children.length > 0) {
          recurse(node.children);
        }
      }
    };
    recurse(fileTree);

    for (const f of openFiles) {
      if (!seen.has(f.path)) {
        seen.add(f.path);
        list.push({ name: f.name, path: f.path, isGit: f.name.startsWith('.git') });
      }
    }

    if (!seen.has(`${workspacePath}/.gitignore`) && !list.some((f) => f.name === '.gitignore')) {
      list.unshift({ name: '.gitignore', path: `${workspacePath}/.gitignore`, isGit: true });
    }

    return list;
  }, [fileTree, openFiles, workspacePath]);

  // Check if caret in prompt is currently typing an @ mention
  const checkAtMentionState = useCallback((val: string, cursorIdx: number) => {
    const textBefore = val.slice(0, cursorIdx);
    const lastAt = textBefore.lastIndexOf('@');
    if (lastAt !== -1) {
      const charBefore = lastAt > 0 ? textBefore[lastAt - 1] : ' ';
      const textAfter = textBefore.slice(lastAt + 1);
      // Valid if char before @ is whitespace/newline/start of text, and textAfter has no spaces and no '['
      if ((charBefore === ' ' || charBefore === '\n' || lastAt === 0) && !/\s/.test(textAfter) && !textAfter.includes('[')) {
        setAtMentionState({
          isOpen: true,
          query: textAfter.toLowerCase(),
          atPos: lastAt,
          selectedIndex: 0,
        });
        return;
      }
    }
    setAtMentionState((prev) => (prev.isOpen ? { ...prev, isOpen: false } : prev));
  }, []);

  // Filtered files for @ mention autocomplete in AI prompt
  const filteredAtFiles = useMemo(() => {
    if (!atMentionState.isOpen) return [];
    const q = atMentionState.query.trim().toLowerCase();
    if (!q) {
      const result: { name: string; path: string; isGit?: boolean }[] = [];
      const seen = new Set<string>();
      for (const ofile of openFiles) {
        if (!seen.has(ofile.path)) {
          seen.add(ofile.path);
          result.push({ name: ofile.name, path: ofile.path, isGit: false });
        }
      }
      for (const wfile of allWorkspaceFiles) {
        if (!seen.has(wfile.path)) {
          seen.add(wfile.path);
          result.push(wfile);
        }
      }
      return result.slice(0, 15);
    }
    return allWorkspaceFiles
      .filter((f) => f.name.toLowerCase().includes(q) || f.path.toLowerCase().includes(q))
      .slice(0, 15);
  }, [atMentionState.isOpen, atMentionState.query, openFiles, allWorkspaceFiles]);

  const handleSelectAtItem = (file: { name: string; path: string }) => {
    if (promptEditorRef.current) {
      promptEditorRef.current.insertPill(file.path, file.name);
    } else {
      const currentVal = askPrompt;
      const cursorPos = inputRef.current?.selectionStart ?? currentVal.length;
      const atPos = atMentionState.atPos !== -1 ? atMentionState.atPos : cursorPos;
      const before = currentVal.slice(0, atPos);
      const after = currentVal.slice(cursorPos);
      const mentionText = `@[${file.path}] `;
      const newPrompt = before + mentionText + after;
      setAskPrompt(newPrompt);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
          const nextCaret = before.length + mentionText.length;
          inputRef.current.setSelectionRange?.(nextCaret, nextCaret);
        }
      }, 15);
    }
    setAtMentionState({ isOpen: false, query: '', atPos: -1, selectedIndex: 0 });
  };

  const visibleQuickOpenItems = React.useMemo((): QuickOpenItemDef[] => {
    const q = quickOpenQuery.trim();

    // 1. Command Palette Mode (starts with '>')
    if (quickOpenQuery.startsWith('>')) {
      const cmdQuery = quickOpenQuery.slice(1).trim().toLowerCase();
      return quickOpenCommands
        .filter((c) => !cmdQuery || c.label.toLowerCase().includes(cmdQuery))
        .map((c) => ({
          id: c.id,
          title: c.label,
          badges: c.badges,
          onSelect: () => {
            c.action();
            setIsQuickOpenOpen(false);
          },
        }));
    }

    // 2. Go to Line Mode (starts with ':')
    if (quickOpenQuery.startsWith(':')) {
      const lineNum = quickOpenQuery.slice(1).trim();
      return [
        {
          id: 'goto-line',
          title: lineNum ? `Ir para linha ${lineNum}` : 'Digite o número da linha para navegar...',
          onSelect: () => {
            const num = parseInt(lineNum, 10);
            if (!isNaN(num) && editorInstanceRef.current) {
              editorInstanceRef.current.revealLineInCenter(num);
              editorInstanceRef.current.setPosition({ lineNumber: num, column: 1 });
              editorInstanceRef.current.focus();
            }
            setIsQuickOpenOpen(false);
          },
        },
      ];
    }

    // 3. Symbol in Editor Mode (starts with '@')
    if (quickOpenQuery.startsWith('@')) {
      return [
        {
          id: 'symbol-info',
          title: 'Símbolos no editor ativo',
          subtitle: 'Digite o nome da função, classe ou variável...',
          onSelect: () => {},
        },
      ];
    }

    // 4. File Search Mode (non-empty query without prefix)
    if (q.length > 0) {
      const lower = q.toLowerCase();
      const filtered = allWorkspaceFiles.filter(
        (f) => f.name.toLowerCase().includes(lower) || f.path.toLowerCase().includes(lower)
      );
      return filtered.map((f) => ({
        id: f.path,
        title: f.name,
        subtitle: f.path.replace(workspacePath, '').replace(/^\//, ''),
        icon: f.isGit || f.name.includes('git') ? <GitDiamondIcon size={14} /> : <FileIcon fileName={f.name} size={15} />,
        onSelect: () => {
          handleOpenFile(f.path, f.name);
          setIsQuickOpenOpen(false);
        },
      }));
    }

    // 5. Default Screen (Empty Query - Matching Screenshot perfectly!)
    const items: QuickOpenItemDef[] = [
      {
        id: 'goto-file',
        title: 'Go to File',
        badges: ['⌘', 'P'],
        onSelect: () => {
          quickOpenInputRef.current?.focus();
        },
      },
      {
        id: 'show-commands',
        title: 'Show and Run Commands',
        suffix: '>',
        badges: ['⇧', '⌘', 'P'],
        onSelect: () => {
          setQuickOpenQuery('>');
          setQuickOpenSelectedIndex(0);
        },
      },
      {
        id: 'search-text',
        title: 'Search for Text',
        suffix: '%',
        onSelect: () => {
          setQuickOpenQuery('%');
          setQuickOpenSelectedIndex(0);
        },
      },
      {
        id: 'goto-symbol',
        title: 'Go to Symbol in Editor',
        suffix: '@',
        badges: ['⇧', '⌘', 'O'],
        onSelect: () => {
          setQuickOpenQuery('@');
          setQuickOpenSelectedIndex(0);
        },
      },
      {
        id: 'start-debug',
        title: 'Start Debugging',
        suffix: 'debug',
        onSelect: () => {
          setQuickOpenQuery('debug ');
          setQuickOpenSelectedIndex(0);
        },
      },
      {
        id: 'run-task',
        title: 'Run Task',
        suffix: 'task',
        onSelect: () => {
          setQuickOpenQuery('task ');
          setQuickOpenSelectedIndex(0);
        },
      },
      {
        id: 'more-help',
        title: 'More',
        suffix: '?',
        onSelect: () => {
          setQuickOpenQuery('?');
          setQuickOpenSelectedIndex(0);
        },
      },
      // Divider and recently opened section
      {
        id: 'recent-gitignore',
        title: '.gitignore',
        badgeText: 'recently opened',
        badgeTextColor: '#3794ff',
        isDividerBefore: true,
        icon: <GitDiamondIcon size={14} />,
        onSelect: () => {
          handleOpenFile(`${workspacePath}/.gitignore`, '.gitignore');
          setIsQuickOpenOpen(false);
        },
      },
      {
        id: 'recent-git-review',
        title: 'Review Git Project Commit Request',
        icon: <GitPullRequest size={15} color="#58a6ff" />,
        onSelect: () => {
          setToastMessage('Git Commit Request carregado para revisão.');
          setIsQuickOpenOpen(false);
        },
      },
    ];

    // Add currently open files into recent section
    for (const f of openFiles) {
      if (f.name !== '.gitignore') {
        items.push({
          id: `recent-${f.id}`,
          title: f.name,
          subtitle: f.path.replace(workspacePath, '').replace(/^\//, ''),
          icon: <FileIcon fileName={f.name} size={15} />,
          onSelect: () => {
            handleOpenFile(f.path, f.name);
            setIsQuickOpenOpen(false);
          },
        });
      }
    }

    return items;
  }, [quickOpenQuery, quickOpenCommands, allWorkspaceFiles, workspacePath, openFiles, handleOpenFile]);

  // Quick Open input keyboard navigation
  const handleQuickOpenKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (visibleQuickOpenItems.length > 0) {
        setQuickOpenSelectedIndex((prev) => (prev + 1) % visibleQuickOpenItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (visibleQuickOpenItems.length > 0) {
        setQuickOpenSelectedIndex((prev) => (prev - 1 + visibleQuickOpenItems.length) % visibleQuickOpenItems.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (visibleQuickOpenItems.length > 0 && visibleQuickOpenItems[quickOpenSelectedIndex]) {
        visibleQuickOpenItems[quickOpenSelectedIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsQuickOpenOpen(false);
    }
  };

  // Auto focus input when Quick Open opens
  useEffect(() => {
    if (isQuickOpenOpen) {
      const timer = setTimeout(() => {
        quickOpenInputRef.current?.focus();
        quickOpenInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isQuickOpenOpen]);

  // Close Quick Open on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (quickOpenContainerRef.current && !quickOpenContainerRef.current.contains(e.target as Node)) {
        setIsQuickOpenOpen(false);
      }
    };
    if (isQuickOpenOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isQuickOpenOpen]);

  // Close Settings Menu & Header AI Menu on outside click / escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
      if (headerAiMenuRef.current && !headerAiMenuRef.current.contains(e.target as Node)) {
        setIsHeaderAiMenuOpen(false);
        setHeaderAiSubmenuProvider(null);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (isSettingsMenuOpen) setIsSettingsMenuOpen(false);
        if (isHeaderAiMenuOpen) {
          setIsHeaderAiMenuOpen(false);
          setHeaderAiSubmenuProvider(null);
        }
      }
    };
    if (isSettingsMenuOpen || isHeaderAiMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick, true);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick, true);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isSettingsMenuOpen, isHeaderAiMenuOpen]);

  // Apply accent color and theme to document & native terminal
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', accentColor);
    document.documentElement.style.setProperty('--accent-text-color', accentTextColor);
  }, [accentColor, accentTextColor]);
  useEffect(() => {
    localStorage.setItem('ide_accent_color', baseAccentColor);
    if (window.electronAPI?.pty?.setAccentColor) {
      window.electronAPI.pty.setAccentColor(rainbow.on ? rainbow.stops[0] : accentColor).catch(() => {}); // rainbow: não manda IPC a cada frame
    }
  }, [rainbow.on ? rainbow.stops[0] : accentColor, baseAccentColor]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isEffectiveDark ? 'dark' : 'light');
    document.documentElement.style.setProperty('--bg-app', isEffectiveDark ? '#000000' : '#eaedf1');
    document.documentElement.style.setProperty('--bg-card', isEffectiveDark ? '#101010' : '#ffffff');
    document.documentElement.style.setProperty('--text-primary', isEffectiveDark ? '#ffffff' : '#0f172a');
    document.documentElement.style.setProperty('--text-secondary', isEffectiveDark ? '#888888' : '#475569');
    document.documentElement.style.setProperty('--border-color', 'transparent');
    localStorage.setItem('ide_theme_mode', themeMode);
    // Sync native window theme with Electron
    if ((window as any).electronAPI?.windowState?.setTheme) {
      (window as any).electronAPI.windowState.setTheme(isEffectiveDark ? 'dark' : 'light');
    }
  }, [themeMode, isEffectiveDark]);

  useEffect(() => {
    localStorage.setItem('ide_use_ai_chat_color', String(useAiChatThemeColor));
  }, [useAiChatThemeColor]);

  useEffect(() => {
    localStorage.setItem('ide_editor_font_size', String(editorFontSize));
  }, [editorFontSize]);

  useEffect(() => {
    localStorage.setItem('ide_editor_tab_size', String(editorTabSize));
  }, [editorTabSize]);

  useEffect(() => {
    localStorage.setItem('ide_editor_minimap', String(editorMinimap));
  }, [editorMinimap]);

  useEffect(() => {
    localStorage.setItem('ide_editor_word_wrap', String(editorWordWrap));
  }, [editorWordWrap]);

  useEffect(() => {
    localStorage.setItem('ide_editor_line_numbers', String(editorLineNumbers));
  }, [editorLineNumbers]);

  useEffect(() => {
    localStorage.setItem('ide_editor_render_whitespace', String(editorRenderWhitespace));
  }, [editorRenderWhitespace]);

  useEffect(() => {
    localStorage.setItem('ide_editor_smooth_scrolling', String(editorSmoothScrolling));
  }, [editorSmoothScrolling]);

  useEffect(() => {
    localStorage.setItem('ide_editor_bracket_colorization', String(editorBracketColorization));
  }, [editorBracketColorization]);

  useEffect(() => {
    localStorage.setItem('ide_editor_font_family', editorFontFamily);
  }, [editorFontFamily]);

  useEffect(() => {
    localStorage.setItem('ide_editor_line_height', String(editorLineHeight));
  }, [editorLineHeight]);

  useEffect(() => {
    localStorage.setItem('ide_editor_cursor_style', editorCursorStyle);
  }, [editorCursorStyle]);

  useEffect(() => {
    localStorage.setItem('ide_editor_cursor_blinking', editorCursorBlinking);
  }, [editorCursorBlinking]);

  useEffect(() => {
    localStorage.setItem('ide_editor_guides', String(editorGuides));
  }, [editorGuides]);

  useEffect(() => {
    localStorage.setItem('ide_editor_auto_closing_brackets', String(editorAutoClosingBrackets));
  }, [editorAutoClosingBrackets]);

  useEffect(() => {
    localStorage.setItem('ide_editor_highlight_active_line', editorHighlightActiveLine);
  }, [editorHighlightActiveLine]);

  useEffect(() => {
    localStorage.setItem('ide_editor_format_on_save', String(editorFormatOnSave));
  }, [editorFormatOnSave]);

  useEffect(() => {
    localStorage.setItem('ide_editor_code_folding', String(editorCodeFolding));
  }, [editorCodeFolding]);

  useEffect(() => {
    localStorage.setItem('ide_terminal_font_size', String(terminalFontSize));
  }, [terminalFontSize]);

  useEffect(() => {
    localStorage.setItem('ide_terminal_cursor_style', terminalCursorStyle);
  }, [terminalCursorStyle]);

  useEffect(() => {
    localStorage.setItem('ide_terminal_cursor_blink', String(terminalCursorBlink));
  }, [terminalCursorBlink]);

  useEffect(() => {
    localStorage.setItem('ide_terminal_scrollback', String(terminalScrollback));
  }, [terminalScrollback]);

  useEffect(() => {
    localStorage.setItem('ide_terminal_copy_on_select', String(terminalCopyOnSelect));
  }, [terminalCopyOnSelect]);

  useEffect(() => {
    localStorage.setItem('ide_terminal_font_family', terminalFontFamily);
  }, [terminalFontFamily]);

  useEffect(() => {
    localStorage.setItem('ide_terminal_line_height', String(terminalLineHeight));
  }, [terminalLineHeight]);

  useEffect(() => {
    localStorage.setItem('ide_terminal_theme_preset', terminalThemePreset);
  }, [terminalThemePreset]);

  useEffect(() => {
    localStorage.setItem('ide_terminal_cursor_width', String(terminalCursorWidth));
  }, [terminalCursorWidth]);

  useEffect(() => {
    localStorage.setItem('ide_terminal_scroll_on_input', String(terminalScrollOnUserInput));
  }, [terminalScrollOnUserInput]);

  useEffect(() => {
    localStorage.setItem('ide_terminal_bold_bright', String(terminalDrawBoldTextInBrightColors));
  }, [terminalDrawBoldTextInBrightColors]);

  useEffect(() => {
    localStorage.setItem('ide_ai_auto_approve', String(aiAutoApprove));
  }, [aiAutoApprove]);

  useEffect(() => {
    localStorage.setItem('ide_ai_confirm_before_delete', String(aiConfirmBeforeDelete));
  }, [aiConfirmBeforeDelete]);

  useEffect(() => {
    localStorage.setItem('ide_confirm_before_closing_unsaved', String(confirmBeforeClosingUnsaved));
  }, [confirmBeforeClosingUnsaved]);

  useEffect(() => {
    localStorage.setItem('ide_restore_last_workspace', String(restoreLastWorkspace));
  }, [restoreLastWorkspace]);

  useEffect(() => {
    localStorage.setItem('ide_auto_refresh_git_status', String(autoRefreshGitStatus));
  }, [autoRefreshGitStatus]);

  const handleCancelAiExecutionRef = useRef<() => void>(() => {});

  // Global shortcuts (Antigravity & VS Code layout toggles & Quick Open & Settings)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Interrompe geração da IA se estiver em execução (Ctrl+C ou Escape)
      if (isAiExecuting) {
        if (e.key === 'Escape') {
          e.preventDefault();
          handleCancelAiExecutionRef.current();
          return;
        }
        if (e.ctrlKey && !e.metaKey && (e.key === 'c' || e.key === 'C')) {
          const selection = window.getSelection()?.toString();
          if (!selection) {
            e.preventDefault();
            handleCancelAiExecutionRef.current();
            return;
          }
        }
      }

      // Escape: Exit Zen mode, Close Theme Popup, Settings Modal, Settings Menu, Quick Open, or Customize Layout
      if (e.key === 'Escape') {
        if (chatHistoryModalOpen) {
          setChatHistoryModalOpen(false);
          return;
        }
        if (isThemePopupOpen) {
          setIsThemePopupOpen(false);
          return;
        }
        if (isZenMode) {
          setIsZenMode(false);
          return;
        }
        if (isSettingsModalOpen) {
          setIsSettingsModalOpen(false);
          return;
        }
        if (isSettingsMenuOpen) {
          setIsSettingsMenuOpen(false);
          return;
        }
        if (isQuickOpenOpen) {
          setIsQuickOpenOpen(false);
          return;
        }
        if (isCustomizeLayoutOpen) {
          setIsCustomizeLayoutOpen(false);
          return;
        }
      }
      // Cmd/Ctrl + K, then Z: Zen Mode / then T: Toggle Dark-Light Theme (VS Code-style two-key chords)
      if (zenChordPendingRef.current) {
        zenChordPendingRef.current = false;
        if (zenChordTimeoutRef.current) clearTimeout(zenChordTimeoutRef.current);
        if (e.key.toLowerCase() === 'z' && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          handleToggleZenMode();
          return;
        }
        if (e.key.toLowerCase() === 't' && !e.metaKey && !e.ctrlKey && !e.altKey) {
          e.preventDefault();
          handleToggleThemeMode();
          return;
        }
      }
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        zenChordPendingRef.current = true;
        if (zenChordTimeoutRef.current) clearTimeout(zenChordTimeoutRef.current);
        zenChordTimeoutRef.current = setTimeout(() => {
          zenChordPendingRef.current = false;
        }, 1500);
        return;
      }
      // Ctrl + Cmd + F: Toggle Native Fullscreen (macOS system convention)
      if (e.ctrlKey && e.metaKey && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleToggleFullscreen();
        return;
      }
      // Cmd/Ctrl + Shift + H: Toggle Chat History Modal
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setChatHistoryModalOpen((prev) => {
          if (!prev) handleOpenChatHistoryModal();
          return !prev;
        });
        return;
      }
      // Cmd/Ctrl + ,: Open Settings Modal
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === ',') {
        e.preventDefault();
        setIsSettingsModalOpen((prev) => !prev);
        setIsSettingsMenuOpen(false);
      }
      // Cmd/Ctrl + Shift + E: Explorer
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (showExplorer && activeActivityTab === 'explorer') {
          setShowExplorer(false);
        } else {
          setActiveActivityTab('explorer');
          setShowExplorer(true);
        }
      }
      // Cmd/Ctrl + Shift + F: Search in files
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (showExplorer && activeActivityTab === 'search') {
          setShowExplorer(false);
        } else {
          setActiveActivityTab('search');
          setShowExplorer(true);
        }
      }
      // Ctrl + Shift + G: Source Control / Git
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (showExplorer && activeActivityTab === 'git') {
          setShowExplorer(false);
        } else {
          setActiveActivityTab('git');
          setShowExplorer(true);
        }
      }
      // Cmd/Ctrl + Shift + D: Run and Debug
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (showExplorer && activeActivityTab === 'debug') {
          setShowExplorer(false);
        } else {
          setActiveActivityTab('debug');
          setShowExplorer(true);
        }
      }
      // Cmd/Ctrl + P: Quick Open / Search files
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsQuickOpenOpen((prev) => !prev);
        setQuickOpenQuery('');
        setQuickOpenSelectedIndex(0);
      }
      // Cmd/Ctrl + Shift + P: Command Palette
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsQuickOpenOpen(true);
        setQuickOpenQuery('>');
        setQuickOpenSelectedIndex(0);
      }
      // Cmd/Ctrl + Shift + O: Symbol in editor
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setIsQuickOpenOpen(true);
        setQuickOpenQuery('@');
        setQuickOpenSelectedIndex(0);
      }
      // Cmd/Ctrl + S: Save file
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveActiveFile();
      }
      // Cmd/Ctrl + B: Toggle Explorer (Sidebar)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setShowExplorer((prev) => !prev);
      }
      // Cmd/Ctrl + J: Toggle Bottom Panel (Terminal)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsTerminalCollapsed((prev) => !prev);
      }
      // Cmd/Ctrl + Shift + A or Cmd/Ctrl + Alt + B: Toggle AI Assistant Panel
      if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') ||
          ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        setShowAiPanel((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAiExecuting, handleSaveActiveFile, isCustomizeLayoutOpen, isQuickOpenOpen, isSettingsMenuOpen, isSettingsModalOpen, isThemePopupOpen, isZenMode, chatHistoryModalOpen, handleOpenChatHistoryModal, handleToggleZenMode, handleToggleFullscreen, handleToggleThemeMode]);

  // Check installed CLIs on native machine: startup, window focus, PTY command exits, and low-frequency poll
  useEffect(() => {
    const refreshInstalledClis = () => {
      if (window.electronAPI?.ai?.checkClis) {
        window.electronAPI.ai.checkClis().then((res) => {
          if (!res) return;
          const prev = prevInstalledClisRef.current;
          const newlyInstalled: string[] = [];

          let hasChanges = false;
          for (const p of AI_PROVIDERS) {
            if (res[p.id] !== prev[p.id]) {
              hasChanges = true;
            }
            if (res[p.id] && prev[p.id] === false) {
              newlyInstalled.push(p.id);
            }
          }

          if (hasChanges) {
            prevInstalledClisRef.current = res;
            setInstalledClis(res);
          }

          // If a new CLI was detected as installed, auto-unlock and auto-select it!
          if (newlyInstalled.length > 0) {
            const latestId = newlyInstalled[0];
            const prov = AI_PROVIDERS.find((p) => p.id === latestId);
            if (prov) {
              handleSwitchAiProvider(prov.id);
              setAiNotInstalledAlert(null);
              setToastMessage(`${prov.name} instalado`);
            }
          }
        }).catch(console.error);
      }
    };

    refreshInstalledClis();
    // Low-frequency background poll (30s) - window focus and pty.onExit handle instant updates
    const pollInterval = setInterval(refreshInstalledClis, 30000);
    window.addEventListener('focus', refreshInstalledClis);
    const unsubExit = window.electronAPI?.pty?.onExit?.(() => {
      refreshInstalledClis();
    });

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', refreshInstalledClis);
      if (unsubExit) unsubExit();
    };
  }, []);

  // Check AI CLI updates on startup, focus and interval
  // notifCenter/triggerAutoUpdate mudam a cada render: por ref, senão o efeito refaz a checagem em loop
  const notifCenterRef = useRef(notifCenter);
  notifCenterRef.current = notifCenter;
  const triggerAutoUpdateRef = useRef(triggerAutoUpdate);
  triggerAutoUpdateRef.current = triggerAutoUpdate;
  useEffect(() => {
    const checkUpdates = async () => {
      if (window.electronAPI?.ai?.checkCliUpdates) {
        try {
          const updates = await window.electronAPI.ai.checkCliUpdates();
          if (updates && Object.keys(updates).length > 0) {
            // objeto novo a cada chamada re-renderiza o App, o que refaz este efeito (deps instáveis) e vira loop infinito
            setAiUpdatesAvailable((prev) => (JSON.stringify(prev) === JSON.stringify(updates) ? prev : updates));
            for (const [providerId, info] of Object.entries(updates)) {
              if (info?.hasUpdate) {
                if (aiAutoUpdate) {
                  triggerAutoUpdateRef.current(providerId, info);
                } else {
                  const alreadyNotified =
                    notifiedUpdatesRef.current.has(providerId) ||
                    notifCenterRef.current.items.some(
                      (n) => n.isUpdate && (n.provider === providerId || (providerId === 'antigravity' && n.provider === 'agy'))
                    );
                  if (!alreadyNotified) {
                    notifiedUpdatesRef.current.add(providerId);
                    const prov = AI_PROVIDERS.find((p) => p.id === providerId) || { name: providerId };
                    notifCenterRef.current.add({
                      kind: 'ai',
                      title: `Atualização disponível: ${prov.name}`,
                      body: `Uma nova versão (${info.latestVersion || 'recente'}) do CLI ${prov.name} está disponível para atualização.${info.currentVersion ? ` Versão instalada: ${info.currentVersion}.` : ''}`,
                      provider: providerId,
                      isUpdate: true,
                      updateVersion: info.latestVersion,
                      updateCommand: info.updateCommand,
                      read: false,
                    });
                    logSystemActivity('ai_updates', `Notificação de nova atualização da IA ${prov.name}`, 'Sistema', {
                      providerId,
                      currentVersion: info.currentVersion,
                      latestVersion: info.latestVersion,
                      command: info.updateCommand,
                    });
                  }
                }
              }
            }
          }
        } catch (err) {
          console.error('[AI Update Check] Erro ao verificar atualizações:', err);
        }
      }
    };

    checkUpdates();
    const pollInterval = setInterval(checkUpdates, 60000);
    window.addEventListener('focus', checkUpdates);

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', checkUpdates);
    };
  }, [aiAutoUpdate]);

  // When auto-update is active, auto-update any pending AI CLI updates
  useEffect(() => {
    if (aiAutoUpdate) {
      for (const [providerId, info] of Object.entries(aiUpdatesAvailable)) {
        if (info?.hasUpdate) {
          triggerAutoUpdate(providerId, info);
        }
      }
    }
  }, [aiAutoUpdate, aiUpdatesAvailable, triggerAutoUpdate]);

  // Dynamically synchronize slash commands with the actual CLI on the system (cached & non-blocking)
  useEffect(() => {
    const fetchCliCommands = (provId: string) => {
      if (window.electronAPI?.ai?.getCommands) {
        window.electronAPI.ai.getCommands(provId).then((cmds) => {
          if (cmds && cmds.length > 0) {
            setAiCommands((prev) => {
              if (prev[provId] && prev[provId].length === cmds.length) return prev;
              return { ...prev, [provId]: cmds };
            });
          }
        }).catch(console.error);
      }
    };

    if (!aiCommands[selectedAiProvider] || aiCommands[selectedAiProvider].length === 0) {
      fetchCliCommands(selectedAiProvider);
    }
  }, [selectedAiProvider]);

  // Save chat sessions to localStorage and debounced auto-save to disk (~/.devflow/chats/)
  useEffect(() => {
    try {
      localStorage.setItem('ide_ai_chat_sessions', JSON.stringify(chatSessions));
    } catch {}

    // Auto-save active chat session to local disk with full context automatically
    const activeSession = chatSessions.find((s) => s.id === activeChatSessionId);
    const msgs = (activeSession?.history && activeSession.history.length > 0)
      ? activeSession.history
      : (aiHistory.length > 0 ? aiHistory : []);

    if (activeChatSessionId && msgs.length > 0 && window.electronAPI?.ai?.saveChatLocally) {
      const timer = setTimeout(() => {
        const projectName =
          activeSession?.projectName ||
          (workspacePath ? workspacePath.split('/').filter(Boolean).pop() : 'Projeto');

        window.electronAPI.ai.saveChatLocally({
          id: activeChatSessionId,
          title: activeSession?.title || (msgs[0]?.text ? msgs[0].text.slice(0, 36) : 'Conversa'),
          provider: activeSession?.provider || selectedAiProvider,
          model: activeModels[selectedAiProvider]?.currentModel || selectedAiProvider,
          createdAt: activeSession?.updatedAt || Date.now(),
          updatedAt: Date.now(),
          context: {
            workspacePath,
            projectName,
            currentBranch: currentBranch || 'main',
            activeFilePath: activeFile?.path || activeFile?.name || '',
            openTabs: openFiles.map((t) => t.name || t.path),
            provider: activeSession?.provider || selectedAiProvider,
            model: activeModels[selectedAiProvider]?.currentModel || selectedAiProvider,
          },
          history: msgs,
        }).catch(() => {});
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [chatSessions, aiHistory, activeChatSessionId, selectedAiProvider, activeModels, selectedModel, workspacePath, currentBranch, activeFile, openFiles]);

  // Click outside listener for Explorer 3-dots popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (explorerMenuRef.current && !explorerMenuRef.current.contains(e.target as Node)) {
        setExplorerMenuOpen(false);
      }
    };
    if (explorerMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [explorerMenuOpen]);

  // Click outside / Escape listener for File Explorer right-click context menu
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (fileContextMenuRef.current && !fileContextMenuRef.current.contains(e.target as Node)) {
        setFileContextMenu(null);
      }
    };
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFileContextMenu(null);
    };
    if (fileContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleEscape);
      return () => {
        document.removeEventListener('mousedown', handleClickOutside);
        document.removeEventListener('keydown', handleEscape);
      };
    }
  }, [fileContextMenu]);

  // Click outside listener for Chat History popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (chatHistoryPopupRef.current && !chatHistoryPopupRef.current.contains(e.target as Node)) {
        setChatHistoryPopupOpen(false);
      }
    };
    if (chatHistoryPopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [chatHistoryPopupOpen]);

  // Click outside listener for Chat Actions popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (chatActionsMenuRef.current && !chatActionsMenuRef.current.contains(e.target as Node)) {
        setChatActionsMenuOpen(false);
      }
    };
    if (chatActionsMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [chatActionsMenuOpen]);

  // Click outside listener for Provider Dropdown popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(e.target as Node)) {
        setProviderDropdown(false);
        setActiveProviderSubmenu(null);
      }
    };
    if (providerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [providerDropdown]);

  // Dynamically check if model submenu has space to the right or should open to the left
  useLayoutEffect(() => {
    if (providerDropdown && activeProviderSubmenu && providerDropdownRef.current) {
      const rect = providerDropdownRef.current.getBoundingClientRect();
      const spaceOnRight = window.innerWidth - (rect.left + 220);
      setSubmenuOpenOnLeft(spaceOnRight < 240);
    }
  }, [providerDropdown, activeProviderSubmenu]);

  // Click outside listener for Model Dropdown popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdown(false);
      }
    };
    if (modelDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [modelDropdown]);

  // Fetch real live AI Models from native CLI service
  const refreshAiModels = useCallback(async (providerId?: string) => {
    const target = providerId || selectedAiProvider;
    if (window.electronAPI?.ai?.getModels) {
      setIsLoadingModels(true);
      try {
        const res = await window.electronAPI.ai.getModels(target);
        if (res && res.models?.length > 0) {
          setActiveModels((prev) => ({
            ...prev,
            [target]: res,
          }));
          setSelectedModel(res.currentModel);
        }
      } catch (err) {
        console.error('Error fetching AI models:', err);
      } finally {
        setIsLoadingModels(false);
      }
    }
  }, [selectedAiProvider]);

  useEffect(() => {
    refreshAiModels(selectedAiProvider);
  }, [selectedAiProvider, refreshAiModels]);

  const handleSelectModel = async (modelItem: { id: string; label: string }, targetProviderId?: string) => {
    const provId = targetProviderId || selectedAiProvider;
    setModelDropdown(false);
    setProviderDropdown(false);
    setActiveProviderSubmenu(null);
    if (provId !== selectedAiProvider) {
      handleSwitchAiProvider(provId);
    }
    setSelectedModel(modelItem.label);
    setActiveModels((prev) => {
      const existing = prev[provId];
      return {
        ...prev,
        [provId]: {
          providerId: provId,
          currentModel: modelItem.label,
          currentModelId: modelItem.id,
          models: existing?.models || [],
        },
      };
    });

    if (window.electronAPI?.ai?.setModel) {
      setIsLoadingModels(true);
      try {
        const res = await window.electronAPI.ai.setModel(provId, modelItem.id);
        if (res?.success) {
          setToastMessage(`Modelo: ${modelItem.label}`);
          logSystemActivity('ai_model', 'select_model', activeHeaderProject?.name || 'Sistema', {
            providerId: provId,
            modelId: modelItem.id,
            modelLabel: modelItem.label,
          });
        }
      } catch (err) {
        console.error('Failed to set AI model:', err);
      } finally {
        setIsLoadingModels(false);
      }
    }
  };

  // Fetch real live AI Quotas from native CLI service
  const refreshAiQuotas = useCallback((force = true) => {
    if (window.electronAPI?.ai?.getQuotas) {
      window.electronAPI.ai.getQuotas(force === true).then((quotas) => {
        if (quotas && Object.keys(quotas).length > 0) {
          setAiQuotas(quotas);
        }
      }).catch(console.error);
    }
  }, []);

  useEffect(() => {
    refreshAiQuotas();
    const interval = setInterval(refreshAiQuotas, 120000);
    const onFocus = () => refreshAiQuotas(false);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [refreshAiQuotas]);

  // Click outside listener for Quota Tooltip popups
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quotaTooltipRef.current && !quotaTooltipRef.current.contains(e.target as Node)) {
        setQuotaTooltipOpen(false);
      }
      if (headerQuotaTooltipRef.current && !headerQuotaTooltipRef.current.contains(e.target as Node)) {
        setHeaderQuotaTooltipOpen(false);
      }
    };
    if (quotaTooltipOpen || headerQuotaTooltipOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [quotaTooltipOpen, headerQuotaTooltipOpen]);

  // Dialog Handlers (3 Dots Menu)
  const handleOpenFolderDialog = async () => {
    setExplorerMenuOpen(false);
    if (window.electronAPI?.dialog?.openFolder) {
      const res = await window.electronAPI.dialog.openFolder();
      if (res && res.folderPath) {
        await handleSelectWorkspace(res.folderPath, res.name);
      }
    } else {
      const folder = prompt('Digite o caminho absoluto da pasta:', workspacePath);
      if (folder && folder.trim()) {
        await handleSelectWorkspace(folder.trim());
      }
    }
  };

  const handleOpenFileDialog = async () => {
    setExplorerMenuOpen(false);
    if (window.electronAPI?.dialog?.openFile) {
      const res = await window.electronAPI.dialog.openFile();
      if (res && res.filePath) {
        handleOpenFile(res.filePath, res.name, res.content);
        setToastMessage(`Arquivo aberto: ${res.name}`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } else {
      const file = prompt('Digite o caminho absoluto do arquivo para abrir:');
      if (file && file.trim()) {
        handleOpenFile(file.trim());
      }
    }
  };

  const handleCreateNewFile = async () => {
    setExplorerMenuOpen(false);
    const fileName = prompt('Nome do novo arquivo (ex: app.module.ts, style.css):');
    if (!fileName || !fileName.trim()) return;

    const fullPath = `${workspacePath}/${fileName.trim()}`;
    if (window.electronAPI?.fs?.createItem) {
      try {
        await window.electronAPI.fs.createItem(fullPath, false);
        await loadWorkspaceTree(workspacePath);
        handleOpenFile(fullPath, fileName.trim(), '');
        setToastMessage(`Arquivo criado: ${fileName.trim()}`);
        setTimeout(() => setToastMessage(null), 3000);
      } catch (err: any) {
        alert(`Erro ao criar arquivo: ${err.message}`);
      }
    } else {
      handleOpenFile(fullPath, fileName.trim(), '');
    }
  };

  const handleCreateNewFolder = async () => {
    setExplorerMenuOpen(false);
    const folderName = prompt('Nome da nova pasta:');
    if (!folderName || !folderName.trim()) return;

    const fullPath = `${workspacePath}/${folderName.trim()}`;
    if (window.electronAPI?.fs?.createItem) {
      try {
        await window.electronAPI.fs.createItem(fullPath, true);
        await loadWorkspaceTree(workspacePath);
        setToastMessage(`Pasta criada: ${folderName.trim()}`);
        setTimeout(() => setToastMessage(null), 3000);
      } catch (err: any) {
        alert(`Erro ao criar pasta: ${err.message}`);
      }
    }
  };

  // -------------------------------------------------------------------------
  // File Explorer right-click context menu actions (VS Code / Cursor / Antigravity style)
  // -------------------------------------------------------------------------
  const closeFileContextMenu = () => setFileContextMenu(null);

  const handleFileNodeContextMenu = (e: React.MouseEvent, node: ExplorerNode) => {
    e.preventDefault();
    e.stopPropagation();
    setExplorerMenuOpen(false);
    setFileContextMenu({ x: e.clientX, y: e.clientY, node });
  };

  const getParentDir = (itemPath: string) => itemPath.split('/').slice(0, -1).join('/') || workspacePath;

  const handleCtxOpen = (node: ExplorerNode) => {
    closeFileContextMenu();
    if (!node.isDirectory) handleOpenFile(node.path, node.name);
  };

  const handleCtxOpenToSide = async (node: ExplorerNode) => {
    closeFileContextMenu();
    if (node.isDirectory) return;
    const existing = openFiles.find((f) => f.path === node.path);
    let fileId = existing?.id;
    if (!fileId) {
      let content = '';
      if (window.electronAPI?.fs?.readFile) {
        try {
          const res = await window.electronAPI.fs.readFile(node.path);
          content = res.content || '';
        } catch {}
      }
      const newFile: OpenFileItem = {
        id: node.path,
        name: node.name,
        path: node.path,
        content,
        language: getFileLanguage(node.name),
        isDirty: false,
      };
      setOpenFiles((prev) => [...prev, newFile]);
      fileId = newFile.id;
    }
    if (!activeFileId) {
      setActiveFileId(fileId);
    } else {
      setSecondaryFileId(fileId);
      setEditorSplitOrientation('vertical');
      setIsEditorSplit(true);
    }
  };

  const handleCtxOpenWith = async (node: ExplorerNode) => {
    closeFileContextMenu();
    if (node.isDirectory) return;
    const appName = prompt('Abrir com qual aplicativo? (ex: Visual Studio Code, TextEdit)');
    if (!appName || !appName.trim()) return;
    if (window.electronAPI?.shell?.exec) {
      const escapedApp = appName.trim().replace(/"/g, '\\"');
      const res = await window.electronAPI.shell.exec(`open -a "${escapedApp}" "${node.path}"`);
      if (res?.exitCode !== 0) {
        setToastMessage(`Não foi possível abrir com "${appName.trim()}"`);
      }
    }
  };

  const handleCtxRevealInFinder = async (node: ExplorerNode) => {
    closeFileContextMenu();
    if (window.electronAPI?.shell?.showItemInFolder) {
      await window.electronAPI.shell.showItemInFolder(node.path);
    } else if (window.electronAPI?.shell?.exec) {
      await window.electronAPI.shell.exec(`open -R "${node.path}"`);
    }
  };

  const handleCtxOpenInTerminal = (node: ExplorerNode) => {
    closeFileContextMenu();
    const dir = node.isDirectory ? node.path : getParentDir(node.path);
    handleNewTerminalSession('zsh', node.name, `cd "${dir}"`);
  };

  const handleCtxSelectForCompare = (node: ExplorerNode) => {
    closeFileContextMenu();
    if (node.isDirectory) return;
    setCompareSelectionPath(node.path);
    setToastMessage(`"${node.name}" selecionado para comparação`);
  };

  const handleCtxCompareWithSelected = async (node: ExplorerNode) => {
    closeFileContextMenu();
    if (!compareSelectionPath || node.isDirectory) return;
    try {
      const [originalRes, modifiedRes] = await Promise.all([
        window.electronAPI?.fs?.readFile(compareSelectionPath),
        window.electronAPI?.fs?.readFile(node.path),
      ]);
      setActiveReview({
        files: [
          {
            path: node.path,
            name: node.name,
            dir: getParentDir(node.path),
            additions: 0,
            deletions: 0,
          },
        ],
        currentIndex: 0,
        originalContent: originalRes?.content || '',
        modifiedContent: modifiedRes?.content || '',
        isSideBySide: true,
      });
    } finally {
      setCompareSelectionPath(null);
    }
  };

  const handleCtxOpenTimeline = async (node: ExplorerNode) => {
    closeFileContextMenu();
    if (node.isDirectory) return;
    await handleOpenFile(node.path, node.name);
    setIsTimelineOpen(true);
  };

  const handleCtxCut = (node: ExplorerNode) => {
    closeFileContextMenu();
    setFileClipboard({ path: node.path, mode: 'cut' });
    setToastMessage(`"${node.name}" recortado`);
  };

  const handleCtxCopy = (node: ExplorerNode) => {
    closeFileContextMenu();
    setFileClipboard({ path: node.path, mode: 'copy' });
    setToastMessage(`"${node.name}" copiado`);
  };

  const handleCtxPaste = async (node: ExplorerNode) => {
    closeFileContextMenu();
    if (!fileClipboard) return;
    const targetDir = node.isDirectory ? node.path : getParentDir(node.path);
    const itemName = fileClipboard.path.split('/').pop() || 'item';
    const destPath = `${targetDir}/${itemName}`;
    if (destPath === fileClipboard.path) {
      setFileClipboard(null);
      return;
    }
    try {
      if (fileClipboard.mode === 'copy' && window.electronAPI?.fs?.copyItem) {
        await window.electronAPI.fs.copyItem(fileClipboard.path, destPath);
      } else if (fileClipboard.mode === 'cut' && window.electronAPI?.fs?.renameItem) {
        await window.electronAPI.fs.renameItem(fileClipboard.path, destPath);
        setFileClipboard(null);
      }
      await loadWorkspaceTree(workspacePath);
      setToastMessage(`"${itemName}" colado em ${targetDir.split('/').pop()}`);
    } catch (err: any) {
      setToastMessage(`Erro ao colar: ${err.message}`);
    }
  };

  const handleCtxCopyPath = (node: ExplorerNode) => {
    closeFileContextMenu();
    navigator.clipboard.writeText(node.path);
    setToastMessage('Caminho absoluto copiado!');
  };

  const handleCtxCopyRelativePath = (node: ExplorerNode) => {
    closeFileContextMenu();
    const rel = node.path.replace(workspacePath, '').replace(/^\//, '');
    navigator.clipboard.writeText(rel);
    setToastMessage('Caminho relativo copiado!');
  };

  const isTestFileName = (name: string) => /\.(test|spec)\.[tj]sx?$/i.test(name);

  const handleCtxRunTests = (node: ExplorerNode, mode: 'run' | 'debug' | 'coverage') => {
    closeFileContextMenu();
    const target = node.path;
    const cmd =
      mode === 'coverage'
        ? `bun test --coverage "${target}"`
        : mode === 'debug'
        ? `bun test --inspect-brk "${target}"`
        : `bun test "${target}"`;
    const label = mode === 'coverage' ? `Coverage: ${node.name}` : mode === 'debug' ? `Debug: ${node.name}` : `Test: ${node.name}`;
    handleNewTerminalSession('zsh', label, cmd);
  };

  const handleCtxRename = async (node: ExplorerNode) => {
    closeFileContextMenu();
    const newName = prompt('Novo nome:', node.name);
    if (!newName || !newName.trim() || newName.trim() === node.name) return;
    const newPath = `${getParentDir(node.path)}/${newName.trim()}`;
    if (window.electronAPI?.fs?.renameItem) {
      try {
        await window.electronAPI.fs.renameItem(node.path, newPath);
        await loadWorkspaceTree(workspacePath);
        setOpenFiles((prev) =>
          prev.map((f) =>
            f.path === node.path
              ? { ...f, id: newPath, path: newPath, name: newName.trim(), language: getFileLanguage(newName.trim()) }
              : f
          )
        );
        if (activeFileId === node.path) setActiveFileId(newPath);
        if (secondaryFileId === node.path) setSecondaryFileId(newPath);
        setToastMessage(`Renomeado para "${newName.trim()}"`);
      } catch (err: any) {
        alert(`Erro ao renomear: ${err.message}`);
      }
    }
  };

  const handleCtxDelete = async (node: ExplorerNode) => {
    closeFileContextMenu();
    if (!confirm(`Excluir "${node.name}"? Esta ação não pode ser desfeita.`)) return;
    if (window.electronAPI?.fs?.deleteItem) {
      try {
        await window.electronAPI.fs.deleteItem(node.path);
        await loadWorkspaceTree(workspacePath);
        const remaining = openFiles.filter((f) => f.path !== node.path && !f.path.startsWith(node.path + '/'));
        setOpenFiles(remaining);
        if (activeFileId === node.path || activeFileId?.startsWith(node.path + '/')) {
          setActiveFileId(remaining.length > 0 ? remaining[0].id : null);
        }
        setToastMessage(`"${node.name}" excluído`);
      } catch (err: any) {
        alert(`Erro ao excluir: ${err.message}`);
      }
    }
  };

  const handleCtxNewFile = async (node: ExplorerNode) => {
    closeFileContextMenu();
    const targetDir = node.isDirectory ? node.path : getParentDir(node.path);
    const fileName = prompt('Nome do novo arquivo (ex: app.module.ts, style.css):');
    if (!fileName || !fileName.trim()) return;
    const fullPath = `${targetDir}/${fileName.trim()}`;
    if (window.electronAPI?.fs?.createItem) {
      try {
        await window.electronAPI.fs.createItem(fullPath, false);
        setExpandedFolders((prev) => new Set(prev).add(targetDir));
        await loadWorkspaceTree(workspacePath);
        handleOpenFile(fullPath, fileName.trim(), '');
        setToastMessage(`Arquivo criado: ${fileName.trim()}`);
      } catch (err: any) {
        alert(`Erro ao criar arquivo: ${err.message}`);
      }
    }
  };

  const handleCtxNewFolder = async (node: ExplorerNode) => {
    closeFileContextMenu();
    const targetDir = node.isDirectory ? node.path : getParentDir(node.path);
    const folderName = prompt('Nome da nova pasta:');
    if (!folderName || !folderName.trim()) return;
    const fullPath = `${targetDir}/${folderName.trim()}`;
    if (window.electronAPI?.fs?.createItem) {
      try {
        await window.electronAPI.fs.createItem(fullPath, true);
        setExpandedFolders((prev) => new Set(prev).add(targetDir));
        await loadWorkspaceTree(workspacePath);
        setToastMessage(`Pasta criada: ${folderName.trim()}`);
      } catch (err: any) {
        alert(`Erro ao criar pasta: ${err.message}`);
      }
    }
  };

  const handleClearTerminal = () => {
    const promptPrefix = `walancy@MacBook-Pro ${terminalCwd.split('/').pop() || 'codes'} % `;
    setTerminalHistory([promptPrefix]);
  };

  // Real Terminal Command Submission using native macOS zsh login shell
  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalCommand.trim()) return;

    const cmd = terminalCommand.trim();
    setTerminalCommandHistory((prev) => [...prev, cmd]);
    setHistoryPointer(-1);
    setTerminalCommand('');

    const folderShort = terminalCwd.split('/').filter(Boolean).pop() || 'workspace';
    const promptPrefix = `walancy@MacBook-Pro ${folderShort} % `;
    const cmdLine = `${promptPrefix}${cmd}`;

    if (cmd === 'clear') {
      setTerminalHistory([promptPrefix]);
      return;
    }

    if (cmd === 'claude') {
      setTerminalHistory((prev) => [
        ...prev,
        cmdLine,
        'O Claude Code CLI requer um prompt neste modo de terminal.\nExemplo: claude "analise os arquivos deste projeto"',
        promptPrefix,
      ]);
      return;
    }

    let cmdToExecute = cmd;
    if (cmd.startsWith('claude ') && !cmd.includes('-p ') && !cmd.includes('--print')) {
      const promptArg = cmd.substring(7).trim().replace(/^["']|["']$/g, '');
      cmdToExecute = `claude -p "${promptArg.replace(/"/g, '\\"')}" < /dev/null`;
    }

    // Execute real command in macOS via Electron native shell
    if (window.electronAPI?.shell?.exec) {
      setTerminalHistory((prev) => [...prev, cmdLine]);
      try {
        const res = await window.electronAPI.shell.exec(cmdToExecute, terminalCwd);

        // Update working directory if cd changed it
        let nextCwd = terminalCwd;
        if (res.newCwd) {
          nextCwd = res.newCwd;
          setTerminalCwd(res.newCwd);
          localStorage.setItem('ide_terminal_cwd', res.newCwd);
        }

        const nextFolderShort = nextCwd.split('/').filter(Boolean).pop() || 'workspace';
        const nextPromptPrefix = `walancy@MacBook-Pro ${nextFolderShort} % `;

        const output = (res.stdout || '') + (res.stderr ? (res.stdout ? '\n' : '') + res.stderr : '');
        if (output.trim()) {
          setTerminalHistory((prev) => [
            ...prev,
            output.trimEnd(),
            nextPromptPrefix,
          ]);
        } else if (res.exitCode !== 0 && res.error) {
          setTerminalHistory((prev) => [
            ...prev,
            res.error,
            nextPromptPrefix,
          ]);
        } else {
          setTerminalHistory((prev) => [...prev, nextPromptPrefix]);
        }
      } catch (err: any) {
        setTerminalHistory((prev) => [...prev, `Erro: ${err.message}`, promptPrefix]);
      }
    } else {
      setTerminalHistory((prev) => [
        ...prev,
        cmdLine,
        'Erro: Shell nativo não disponível no navegador web. Execute o app Desktop no Electron para executar comandos da máquina.',
        promptPrefix,
      ]);
    }
  };

  // Keyboard navigation for terminal history (Up / Down arrows)
  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (terminalCommandHistory.length === 0) return;
      const nextPtr = historyPointer === -1 ? terminalCommandHistory.length - 1 : Math.max(0, historyPointer - 1);
      setHistoryPointer(nextPtr);
      setTerminalCommand(terminalCommandHistory[nextPtr]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyPointer === -1) return;
      const nextPtr = historyPointer + 1;
      if (nextPtr >= terminalCommandHistory.length) {
        setHistoryPointer(-1);
        setTerminalCommand('');
      } else {
        setHistoryPointer(nextPtr);
        setTerminalCommand(terminalCommandHistory[nextPtr]);
      }
    }
  };

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalHistory]);

  // Auto-scroll AI terminal to bottom
  useEffect(() => {
    if (aiTerminalScrollRef.current) {
      aiTerminalScrollRef.current.scrollTop = aiTerminalScrollRef.current.scrollHeight;
    }
  }, [aiHistory, quotaExceededAlert]);

  // Reset quota alert when switching AI provider
  useEffect(() => {
    setQuotaExceededAlert(null);
  }, [selectedAiProvider]);

  // Open download or guide link in default system browser
  const handleOpenExternalLink = async (url: string) => {
    if (window.electronAPI?.shell?.openExternal) {
      await window.electronAPI.shell.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };




  // Interrompe a execução atual da IA (como um Ctrl+C)
  const handleCancelAiExecution = async () => {
    if (!isAiExecuting) return;
    const cancelWs = workspacePath || '';
    aiExecIdsRef.current[cancelWs] = 0; // invalida só a execução deste projeto
    runningAiWorkspacesRef.current.delete(cancelWs);
    setIdeAiStatus((prev) => {
      const next = { ...prev };
      delete next[cancelWs];
      return next;
    });
    setIsAiExecuting(false);
    try {
      if (window.electronAPI?.ai?.cancel) {
        await window.electronAPI.ai.cancel(undefined, cancelWs || undefined);
      }
    } catch (err) {
      console.warn('[handleCancelAiExecution] Erro ao cancelar execução da IA:', err);
    }
    const stopMsg: ChatMessageItem = {
      type: 'system',
      text: 'Geração interrompida pelo usuário (Ctrl+C).',
      timestamp: Date.now(),
    };
    setAiHistory((prev) => [...prev, stopMsg]);
    setChatSessions((all) =>
      all.map((s) => (s.id === activeChatSessionId ? { ...s, history: [...s.history, stopMsg], updatedAt: Date.now() } : s))
    );
    setToastMessage('Geração interrompida');
  };
  handleCancelAiExecutionRef.current = handleCancelAiExecution;

  // Execute AI CLI command (e.g., claude, agy, gemini) or check if installed
  const handleAiSubmit = async (e?: React.FormEvent, promptOverride?: string) => {
    if (e) e.preventDefault();
    const prompt = (promptOverride !== undefined ? promptOverride : promptEditorRef.current ? promptEditorRef.current.getValue() : askPrompt).trim();
    if (isAiExecuting) {
      if (prompt) {
        setQueuedAiMessages((prev) => [
          ...prev,
          { id: 'queue-' + Date.now(), prompt, timestamp: Date.now() },
        ]);
        setAskPrompt('');
        promptEditorRef.current?.clear();
        logSystemActivity('ide_ai_chat', 'enqueue_message', workspacePath ? workspacePath.split('/').pop() || 'Projeto' : 'Projeto', {
          prompt: prompt.slice(0, 60),
        });
      }
      return;
    }
    if (!prompt && attachedFiles.length === 0 && attachedImages.length === 0 && !attachedTask) return;

    // Execução presa ao projeto/chat de origem: continua e grava no lugar certo mesmo se o usuário trocar de projeto
    const runWorkspace = workspacePath || '';
    const runSessionId = activeChatSessionId;
    const thisExecutionId = (aiExecIdsRef.current[runWorkspace] = (aiExecIdsRef.current[runWorkspace] || 0) + 1);
    let runOutcome: 'done' | 'waiting' | null = null;
    let runSummary = '';
    const endRun = () => {
      runningAiWorkspacesRef.current.delete(runWorkspace);
      const isVisible = workspacePathRef.current === runWorkspace;
      if (isVisible) endRun();
      // Projeto aberto: não há o que sinalizar. Em segundo plano: marca pronto/aguardando e avisa
      setIdeAiStatus((prev) => {
        const next = { ...prev };
        if (runOutcome && !isVisible) next[runWorkspace] = runOutcome;
        else delete next[runWorkspace];
        return next;
      });
      if (runOutcome && !isVisible) {
        notifyProjectAi({
          projectPath: runWorkspace,
          projectName: runWorkspace.split('/').filter(Boolean).pop() || 'Projeto',
          provider: currentProviderIdForNotice,
          summary: runSummary,
          kind: runOutcome === 'waiting' ? 'question' : 'done',
          source: 'ide',
        });
      }
    };
    let currentProviderIdForNotice = selectedAiProvider;

    // Snapshot attached files, images & task, then clear prompt and attachments
    const currentAttachedFiles = [...attachedFiles];
    const currentAttachedImages = attachedImages.slice(0, MAX_ATTACHED_IMAGES);
    const currentAttachedTask = attachedTask;
    if (currentAttachedTask) {
      setActiveWorkingIssue(currentAttachedTask);
    }
    setAttachedFiles([]);
    setAttachedImages([]);
    setAttachedTask(null);
    promptEditorRef.current?.clear();
    setLiveExecutionSteps([]);
    setLiveWorkedDuration('0s');
    setIsLiveWorkedExpanded(true);
    setLiveCurrentAction('Analisando workspace...');

    // Determine target provider:
    // If orchestrator is active, follow orchestrator configuration (nodes, models, tools, memory from Orchestration screen)
    // If orchestrator is NOT active, strictly use selected AI CLI
    let currentProvider = AI_PROVIDERS.find((p) => p.id === selectedAiProvider) || AI_PROVIDERS[0];
    let isDelegatedByOrchestrator = false;
    let orchestrationConfig: any = null;
    let orchestratorTargetModel: string | undefined = undefined;

    if (isOrchestratorActive) {
      try {
        const savedNodes = localStorage.getItem('devflow_orchestration_nodes_v9');
        const savedEdges = localStorage.getItem('devflow_orchestration_edges_v9');
        if (savedNodes) {
          const nodes = JSON.parse(savedNodes);
          const edges = savedEdges ? JSON.parse(savedEdges) : [];
          orchestrationConfig = { nodes, edges };

          // Follow Model Node configured in the Orchestration Canvas
          const modelNode = nodes.find((n: any) => n.type === 'model' && n.status !== 'disabled');
          if (modelNode) {
            if (modelNode.provider) {
              const matchedProv = AI_PROVIDERS.find((p) => p.id === modelNode.provider);
              if (matchedProv) {
                currentProvider = matchedProv;
              }
            }
            if (modelNode.config?.model) {
              orchestratorTargetModel = modelNode.config.model;
            }
          }
        }
      } catch (e) {
        console.warn('Failed to parse orchestration configuration:', e);
      }

      // If no designated model node in canvas, alternate among active orchestrated providers
      if (!orchestratorTargetModel) {
        const activeOrchestrated = AI_PROVIDERS.filter((p) => orchestratedProviders[p.id]);
        if (activeOrchestrated.length > 0) {
          currentProvider = activeOrchestrated[orchestratorIndex % activeOrchestrated.length];
          setOrchestratorIndex((prev) => prev + 1);
        }
      }
      isDelegatedByOrchestrator = true;
    }

    const cliCmd = currentProvider.cliCommand;
    currentProviderIdForNotice = currentProvider.id;

    // Helper to append message to aiHistory and sync with current chatSession
    const pushAiMessage = (msg: {
      type: 'user' | 'assistant' | 'system' | 'error' | 'auth_required';
      text: string;
      downloadUrl?: string;
      command?: string;
      authUrl?: string;
      providerId?: string;
      timestamp?: number;
      workedDuration?: string;
      executionSteps?: ExecutionStepItem[];
      walkthrough?: WalkthroughItem;
      changedFiles?: ChangedFileItem[];
      interactiveQuestion?: { question: string; options: string[]; isMultiSelect?: boolean };
      attachedFiles?: AttachedFileItem[];
      attachedImages?: AttachedImageItem[];
      attachedTask?: {
        number: number;
        title: string;
        body?: string;
        state?: string;
        labels?: Array<{ name: string; color?: string }>;
        url?: string;
      };
    }) => {
      if (msg.text?.toLowerCase().includes('executando')) return;
      const messageWithProvider: ChatMessageItem = {
        ...msg,
        providerId: msg.providerId || currentProvider.id || selectedAiProvider,
      };
      const titleFor = (current: string) =>
        current === 'Chat Inicial' || current === 'Nova Conversa'
          ? (prompt || (currentAttachedTask ? `#${currentAttachedTask.number} ${currentAttachedTask.title}` : (currentAttachedFiles[0]?.name || 'Nova Conversa'))).slice(0, 36)
          : current;

      // Se o usuário trocou de projeto (ou de chat) durante a execução, grava no chat de origem e não no que está na tela
      const isVisible = workspacePathRef.current === runWorkspace && activeChatSessionIdRef.current === runSessionId;
      if (!isVisible) {
        let saved = projectAiStateRef.current[runWorkspace];
        if (!saved) {
          try {
            saved = JSON.parse(localStorage.getItem(`ide_ai_state_${runWorkspace}`) || 'null');
          } catch {}
        }
        const base = saved || { provider: currentProvider.id, model: selectedModel, chatSessions: [], activeChatSessionId: runSessionId };
        const sessions: ChatSessionItem[] = Array.isArray(base.chatSessions) ? [...base.chatSessions] : [];
        const idx = sessions.findIndex((x) => x.id === runSessionId);
        if (idx >= 0) {
          sessions[idx] = {
            ...sessions[idx],
            title: titleFor(sessions[idx].title),
            updatedAt: Date.now(),
            history: [...sessions[idx].history, messageWithProvider],
          };
        } else {
          sessions.unshift({
            id: runSessionId,
            title: titleFor('Nova Conversa'),
            provider: currentProvider.id,
            updatedAt: Date.now(),
            history: [messageWithProvider],
            workspacePath: runWorkspace,
          });
        }
        const nextState = { ...base, chatSessions: sessions };
        projectAiStateRef.current[runWorkspace] = nextState;
        try {
          localStorage.setItem(`ide_ai_state_${runWorkspace}`, JSON.stringify(nextState));
        } catch {}
        return;
      }

      setAiHistory((prev) => {
        const next = [...prev, messageWithProvider];
        setChatSessions((allSessions) => {
          const idx = allSessions.findIndex((x) => x.id === runSessionId);
          if (idx >= 0) {
            const updated = [...allSessions];
            const curr = updated[idx];
            updated[idx] = {
              ...curr,
              provider: currentProvider.id,
              title: titleFor(curr.title),
              updatedAt: Date.now(),
              history: next,
            };
            return updated;
          } else {
            const newSession: ChatSessionItem = {
              id: runSessionId,
              title: titleFor('Nova Conversa'),
              provider: currentProvider.id,
              updatedAt: Date.now(),
              history: next,
            };
            return [newSession, ...allSessions];
          }
        });
        return next;
      });
    };

    // Add user message to AI history & session with attached items
    const userDisplayPrompt = prompt || (currentAttachedTask ? `Executar tarefa #${currentAttachedTask.number}: ${currentAttachedTask.title}` : currentAttachedFiles.length > 0 ? `Analise o(s) arquivo(s): ${currentAttachedFiles.map((f) => f.name).join(', ')}` : 'Analise a imagem anexada.');
    pushAiMessage({
      type: 'user',
      text: userDisplayPrompt,
      command: `${cliCmd}`,
      attachedFiles: currentAttachedFiles.length > 0 ? currentAttachedFiles : undefined,
      attachedImages: currentAttachedImages.length > 0 ? currentAttachedImages : undefined,
      attachedTask: currentAttachedTask ? { ...currentAttachedTask } : undefined,
    });

    // Check if provider has exhausted credits (0% daily or 0% weekly)
    const currentQuota = aiQuotas[currentProvider.id] || DEFAULT_AI_QUOTAS[currentProvider.id];
    const dailyResetFormatted = formatRelativeResetTime(currentQuota?.dailyResetTime);
    const weeklyResetFormatted = formatRelativeResetTime(currentQuota?.weeklyResetTime);

    const isDailyExhausted = currentQuota && currentQuota.dailyPercent === 0 && dailyResetFormatted !== 'Disponível' && !dailyResetFormatted.includes('resetado');
    const isWeeklyExhausted = currentQuota && currentQuota.weeklyPercent === 0 && weeklyResetFormatted !== 'Disponível' && !weeklyResetFormatted.includes('resetado');
    const isExhausted = isDailyExhausted || isWeeklyExhausted;

    if (isExhausted) {
      const resetTime = isWeeklyExhausted ? currentQuota.weeklyResetTime : currentQuota.dailyResetTime;
      const quotaType = isWeeklyExhausted ? 'semanal' : 'diário';
      setQuotaExceededAlert({
        providerName: currentProvider.name,
        modelName: selectedModel,
        resetTime,
        quotaType,
        dailyResetTime: currentQuota.dailyResetTime,
        weeklyResetTime: currentQuota.weeklyResetTime,
      });
      setAskPrompt('');
      return;
    }

    if (isDelegatedByOrchestrator) {
      const modelLabel = orchestratorTargetModel || selectedModel || currentProvider.name;
      pushAiMessage({
        type: 'system',
        text: `[Orquestrador Ativo: Seguindo fluxo e nós configurados na tela de Orquestração (${currentProvider.name} • ${modelLabel})]`,
      });
    }

    setAskPrompt('');
    setIsAiExecuting(true);
    runningAiWorkspacesRef.current.add(runWorkspace);
    setIdeAiStatus((prev) => ({ ...prev, [runWorkspace]: 'generating' }));
    setAiNotInstalledAlert(null);

    // 1. Check if the CLI is installed using `which <cli>` via login shell
    if (window.electronAPI?.shell?.exec) {
      try {
        const checkRes = await window.electronAPI.shell.exec(`which ${cliCmd}`, terminalCwd);
        const isInstalled = checkRes.exitCode === 0 && checkRes.stdout.trim().length > 0;

        if (!isInstalled) {
          const alertData = {
            modelName: currentProvider.name,
            command: cliCmd,
            url: currentProvider.installUrl,
            guide: currentProvider.installGuide,
          };
          setAiNotInstalledAlert(alertData);
          pushAiMessage({
            type: 'error',
            text: `CLI "${cliCmd}" não encontrado no PATH.\nInstale para utilizar.`,
            downloadUrl: currentProvider.installUrl,
            command: currentProvider.installGuide,
          });
          endRun();
          return;
        }

        // 2. Built-in instant chat commands
        if (prompt === '/clear') {
          setAiHistory([]);
          setChatSessions((prev) =>
            prev.map((s) => (s.id === activeChatSessionId ? { ...s, history: [] } : s))
          );
          endRun();
          return;
        }

        if (prompt === '/help') {
          const cmds = aiCommands[currentProvider.id] || currentProvider.commands || [];
          const helpText = `Comandos disponíveis para ${currentProvider.name}:\n\n` +
            cmds.map((c) => `• \`${c.command}\`${c.usage ? ` (${c.usage})` : ''}: ${c.description}`).join('\n');
          pushAiMessage({
            type: 'assistant',
            text: helpText,
          });
          endRun();
          return;
        }

        // 3. AI prompt & slash command execution directly within the chat panel
        const currentModelData = activeModels[currentProvider.id];
        const activeModelId = currentModelData?.currentModelId;

        // 1. Resolve real project directory dynamically:
        // The selected workspacePath is the PRIMARY source of truth.
        let effectiveCwd = workspacePath;
        if (!effectiveCwd) {
          if (activeFile?.path && activeFile.path.startsWith('/')) {
            const parts = activeFile.path.split('/');
            parts.pop();
            const fileDir = parts.join('/');
            try {
              const revRes = await window.electronAPI.shell.exec('git rev-parse --show-toplevel', fileDir);
              if (revRes.exitCode === 0 && revRes.stdout.trim()) {
                effectiveCwd = revRes.stdout.trim();
              } else {
                effectiveCwd = fileDir;
              }
            } catch {
              effectiveCwd = fileDir;
            }
          }
        }

        // Correct outdated / non-git parent path
        if (!effectiveCwd || effectiveCwd.toLowerCase().includes('ainaobra')) {
          effectiveCwd = '/Users/walancy/Documents/codes/devflow-desktop';
        }

        // Detect subproject/app folder inside monorepo if applicable (only within current project)
        let appSubDir = '';
        if (activeFile?.path && activeFile.path.startsWith(effectiveCwd) && activeFile.path.includes('/apps/')) {
          const match = activeFile.path.match(/(^.*\/apps\/[^/]+)/);
          if (match) {
            appSubDir = match[1];
          }
        }

        // Keep IDE terminal & workspace state synchronized
        setTerminalCwd(effectiveCwd);
        if (!workspacePath) {
          setWorkspacePath(effectiveCwd);
          localStorage.setItem('ide_workspace_path', effectiveCwd);
          localStorage.setItem('ide_terminal_cwd', effectiveCwd);
        }

        // 2. Build full project context for the AI CLI
        let modeInstruction = '';
        if (aiMode === 'auto') {
          modeInstruction = '[Modo Auto]: Execução contínua sem confirmação intermediária.';
        } else if (aiMode === 'plan') {
          modeInstruction = '[Modo Plan]: Apresente o plano detalhado antes de modificar arquivos.';
        } else if (aiMode === 'ask') {
          modeInstruction = '[Modo Ask]: Apenas explicações e respostas conceituais. Não altere arquivos.';
        } else {
          modeInstruction = '[Modo Agente]: Desenvolvimento interativo com validações.';
        }

        // Resolve all @[path] mentions from user prompt and load file contents directly
        const mentionRegex = /@\[(.*?)\]/g;
        const mentions: string[] = [];
        let match;
        while ((match = mentionRegex.exec(prompt)) !== null) {
          if (match[1] && !mentions.includes(match[1].trim())) {
            mentions.push(match[1].trim());
          }
        }

        const mentionedFilesData: Array<{
          path: string;
          name: string;
          content?: string;
          isImage?: boolean;
          error?: string;
        }> = [];

        const specialMentions = mentions.filter((m) => /^@(git|terminal|rules|mcp)$/.test(m));
        for (const mentionPath of mentions) {
          if (specialMentions.includes(mentionPath)) continue;
          const resolvedPath = mentionPath.startsWith('/')
            ? mentionPath
            : `${effectiveCwd}/${mentionPath}`;
          const fileName = resolvedPath.split('/').filter(Boolean).pop() || resolvedPath;
          const isImg = /\.(png|jpe?g|webp|gif|svg|ico)$/i.test(resolvedPath);
          if (isImg) {
            mentionedFilesData.push({ path: resolvedPath, name: fileName, isImage: true });
          } else {
            try {
              const fileRes = await window.electronAPI.fs.readFile(resolvedPath);
              if (fileRes && fileRes.content !== undefined) {
                mentionedFilesData.push({ path: resolvedPath, name: fileName, content: fileRes.content });
              } else {
                mentionedFilesData.push({ path: resolvedPath, name: fileName, error: fileRes?.error || 'Arquivo não encontrado' });
              }
            } catch (err: any) {
              mentionedFilesData.push({ path: resolvedPath, name: fileName, error: err?.message || 'Erro ao ler arquivo' });
            }
          }
        }

        let mentionsContextBlock = '';
        const readShell = async (cmd: string) => {
          try {
            const res = await window.electronAPI.shell.exec(cmd, effectiveCwd);
            return (res.stdout || res.stderr || '').trim().slice(0, 12000);
          } catch {
            return '';
          }
        };
        const catFiles = (files: string) =>
          `for f in ${files}; do [ -f "$f" ] && { echo "--- $f ---"; head -c 8000 "$f"; echo; }; done`;
        for (const sm of specialMentions) {
          let body = '';
          if (sm === '@git') {
            body = await readShell('echo "Branch: $(git branch --show-current)"; git status --short; git diff --stat; git log -5 --oneline');
          } else if (sm === '@rules') {
            body = await readShell(catFiles('CLAUDE.md AGENTS.md GEMINI.md .agents/rules/*.md'));
          } else if (sm === '@mcp') {
            body = await readShell(catFiles('.mcp.json mcp_config.json .agents/mcp_config.json'));
          } else if (sm === '@terminal') {
            const hist = activeSessionId ? await window.electronAPI.pty?.getHistory?.(activeSessionId) : '';
            body = (hist || '').replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').slice(-8000);
          }
          mentionsContextBlock += `\n\n[Contexto ${sm}]:\n${body || '(vazio ou indisponível)'}\n`;
        }
        if (mentionedFilesData.length > 0) {
          mentionsContextBlock += `\n\n[Itens Mencionados pelo Usuário via @]:\n`;
          mentionedFilesData.forEach((item) => {
            mentionsContextBlock += `@[${item.path}] é um [${item.isImage ? 'Arquivo de Imagem' : 'Arquivo de Código/Texto'}]: ${item.path}\n`;
          });

          mentionsContextBlock += `\n[Conteúdo Real dos Arquivos Referenciados no Prompt]:\n`;
          mentionedFilesData.forEach((item) => {
            if (item.content !== undefined) {
              const ext = item.name.split('.').pop() || '';
              const maxChars = 35000;
              const isTruncated = item.content.length > maxChars;
              const text = isTruncated ? item.content.slice(0, maxChars) + '\n... [restante truncado para manter velocidade]' : item.content;
              mentionsContextBlock += `\n--- Início de ${item.path} ---\n\`\`\`${ext}\n${text}\n\`\`\`\n--- Fim de ${item.path} ---\n`;
            } else if (item.isImage) {
              mentionsContextBlock += `\n--- Imagem: ${item.path} (Arquivo de imagem anexado para visualização) ---\n`;
            } else if (item.error) {
              mentionsContextBlock += `\n--- Arquivo: ${item.path} (Aviso: ${item.error}) ---\n`;
            }
          });
        }

        let promptWithContext = prompt || userDisplayPrompt;
        let attachedContextBlock = '';
        if (currentAttachedFiles.length > 0) {
          const filesListStr = currentAttachedFiles
            .map((f) => `- ${f.isDirectory ? '[Pasta/Diretório]' : '[Arquivo]'}: ${f.path}`)
            .join('\n');
          attachedContextBlock += `\n\n[Arquivos e Pastas de Contexto Anexados pelo Usuário]:\n${filesListStr}\nPor favor, consulte e utilize esses arquivos/pastas como contexto prioritário para executar a tarefa.`;
        }
        if (currentAttachedImages.length > 0) {
          attachedContextBlock += `\n\n[Imagens Anexadas]: ${currentAttachedImages.length} imagem(ns) colada(s) ou anexada(s) pelo usuário no chat.`;
        }
        if (currentAttachedTask) {
          attachedContextBlock += `\n\n[Tarefa/Issue Vinculada do Projeto]:
- Issue #${currentAttachedTask.number}: "${currentAttachedTask.title}"
${currentAttachedTask.labels && currentAttachedTask.labels.length > 0 ? `- Labels: ${currentAttachedTask.labels.map((l) => l.name).join(', ')}\n` : ''}${currentAttachedTask.body ? `- Detalhes da Tarefa:\n${currentAttachedTask.body}\n` : ''}
INSTRUÇÕES OBRIGATÓRIAS PARA EXECUÇÃO DA TAREFA:
1. Implemente a solução completa para os requisitos da tarefa #${currentAttachedTask.number}: "${currentAttachedTask.title}".
2. Ao finalizar as alterações, apresente um relatório conciso do que foi implementado/modificado.
3. Ao final da sua resposta, pergunte explicitamente ao usuário se a tarefa está concluída e se deseja finalizar a issue.
4. OBRIGATÓRIO: Termine sua resposta incluindo exatamente a tag abaixo em uma linha separada:
<!-- ISSUE_ACTION_PROMPT:#${currentAttachedTask.number} -->`;
        } else if (activeWorkingIssue && !finalizedIssues[activeWorkingIssue.number]) {
          attachedContextBlock += `\n\n[Tarefa/Issue em Andamento no Fluxo]:
- Issue #${activeWorkingIssue.number}: "${activeWorkingIssue.title}"
O usuário está dando continuidade ou solicitando ajustes nesta tarefa.
INSTRUÇÕES:
1. Realize os ajustes solicitados pelo usuário para a tarefa #${activeWorkingIssue.number}.
2. Ao finalizar, apresente um breve resumo do que foi ajustado.
3. Pergunte novamente ao usuário se deseja finalizar a issue ou se precisa de mais alguma alteração.
4. OBRIGATÓRIO: Termine sua resposta incluindo exatamente a tag abaixo em uma linha separada:
<!-- ISSUE_ACTION_PROMPT:#${activeWorkingIssue.number} -->`;
        }
        if (mentionsContextBlock) {
          attachedContextBlock += mentionsContextBlock;
        }

        const projectName = effectiveCwd.split('/').filter(Boolean).pop() || 'Projeto';
        const projectOpenFiles = openFiles.filter((f) => f.path && f.path.startsWith(effectiveCwd));
        const projectActiveFile = (activeFile?.path && activeFile.path.startsWith(effectiveCwd)) ? activeFile : null;

        // Contexto do Brain do Projeto (Arquitetura, Stack, Regras e Grafo Obsidian)
        let brainContextBlock = '';
        try {
          const projectBrain = getActiveBrainContextSync(effectiveCwd);
          if (projectBrain) {
            brainContextBlock = `\n\n${generateBrainAiContext(projectBrain)}`;
          }
        } catch {}

        let editorCursorPos = '';
        let editorSelectionText = '';
        if (editorInstanceRef.current) {
          try {
            const pos = editorInstanceRef.current.getPosition();
            if (pos) {
              editorCursorPos = `Linha ${pos.lineNumber}, Coluna ${pos.column}`;
            }
            const selection = editorInstanceRef.current.getSelection();
            if (selection && !selection.isEmpty()) {
              editorSelectionText = editorInstanceRef.current.getModel()?.getValueInRange(selection) || '';
            }
          } catch {}
        }

        const silentEditorContext = `\n\n[Metadados da Sessão do Editor]:
- Documento Ativo: ${projectActiveFile?.path || activeFile?.path || 'Nenhum'}
- Linguagem do Arquivo: ${activeFile?.language || 'desconhecida'}
- Posição do Cursor: ${editorCursorPos || 'Não informada'}
${editorSelectionText ? `- Trecho Selecionado no Editor:\n\`\`\`\n${editorSelectionText.slice(0, 4000)}\n\`\`\`\n` : ''}- Abas/Arquivos Abertos: ${openFiles.map((f) => f.name).join(', ') || 'Nenhum'}
- Sistema Operacional: macOS
- Horário Local: ${new Date().toLocaleString('pt-BR')}`;

        if (!prompt.startsWith('/')) {
          promptWithContext = `[Contexto do Projeto Aberto no Aura Dev]:
${modeInstruction}

- Projeto Ativo: ${projectName}
- Diretório Raiz do Projeto: ${effectiveCwd}
${appSubDir ? `- Módulo/Subaplicação em Edição: ${appSubDir}` : ''}
${projectActiveFile?.path ? `- Arquivo Aberto no Editor: ${projectActiveFile.path}` : ''}
${projectOpenFiles.length > 0 ? `- Arquivos Abertos: ${projectOpenFiles.map((f) => f.path).filter(Boolean).join(', ')}` : ''}${brainContextBlock}${attachedContextBlock}${silentEditorContext}

INSTRUÇÕES OBRIGATÓRIAS:
1. Você está executando DIRETAMENTE no diretório do projeto: "${effectiveCwd}" (${projectName}).
2. Crie, leia, modifique e organize TODOS os arquivos e pastas SEMPRE dentro deste projeto ("${effectiveCwd}"${appSubDir ? ` ou mais especificamente em "${appSubDir}"` : ''}).
3. NUNCA assuma outro projeto nem crie arquivos na pasta pessoal do usuário (~ ou /Users/walancy) ou fora da raiz deste projeto.
4. Ao criar novos componentes, páginas ou utilitários, coloque-os na estrutura de pastas correspondente do projeto atual.
5. Se for impossível prosseguir sem uma decisão do usuário, encerre a resposta com UMA linha no formato exato (e pare):
<!-- ASK_QUESTION:{"question":"...","options":["A","B"],"isMultiSelect":false} -->

Instrução do Usuário:
${prompt || userDisplayPrompt}`;
        } else {
          promptWithContext += attachedContextBlock;
        }

        if (isOrchestratorActive && orchestrationConfig?.nodes) {
          const agentNode = orchestrationConfig.nodes.find((n: any) => n.type === 'agent' && n.status !== 'disabled');
          const toolNodes = orchestrationConfig.nodes.filter((n: any) => n.type === 'tool' && n.status !== 'disabled');
          const memoryNode = orchestrationConfig.nodes.find((n: any) => n.type === 'memory' && n.status !== 'disabled');

          let orchBlock = `\n[Configuração do Fluxo de Orquestração Aura Dev]:\n`;
          if (agentNode) {
            orchBlock += `- Agente Coordenador: ${agentNode.title || 'Agente Coordenador'}${agentNode.subtitle ? ` (${agentNode.subtitle})` : ''}\n`;
            if (agentNode.config?.instructions) {
              orchBlock += `- Diretrizes do Agente: ${agentNode.config.instructions}\n`;
            }
          }
          if (toolNodes.length > 0) {
            orchBlock += `- Ferramentas Conectadas: ${toolNodes.map((t: any) => `${t.title}${t.config?.command ? ` (\`${t.config.command}\`)` : ''}`).join(', ')}\n`;
          }
          if (memoryNode) {
            orchBlock += `- Contexto de Memória: ${memoryNode.title || 'Ativo'}\n`;
          }
          promptWithContext = `${orchBlock}\n${promptWithContext}`;
        }

        const mentionedDirFlags = mentionedFilesData
          .map((f) => {
            const parts = f.path.split('/');
            parts.pop();
            const parentDir = parts.join('/');
            if (parentDir && !parentDir.startsWith(effectiveCwd)) {
              return `--add-dir "${parentDir}"`;
            }
            return '';
          })
          .filter(Boolean);

        const additionalDirFlags = Array.from(new Set([
          ...currentAttachedFiles.filter((f) => f.isDirectory).map((f) => `--add-dir "${f.path}"`),
          ...mentionedDirFlags,
        ])).join(' ');

        let fullCommand = `${cliCmd} "${promptWithContext.replace(/"/g, '\\"')}"`;
        if (cliCmd === 'claude') {
          const modelFlag = activeModelId && !prompt.startsWith('/') ? ` --model "${activeModelId}"` : '';
          fullCommand = `export PATH="$HOME/.local/bin:$PATH"; claude${modelFlag} --dangerously-skip-permissions -p "${promptWithContext.replace(/"/g, '\\"')}" < /dev/null`;
        } else if (cliCmd === 'agy') {
          const modelFlag = activeModelId && !prompt.startsWith('/') ? ` --model "${activeModelId}"` : '';
          const dirFlags = additionalDirFlags ? ` ${additionalDirFlags}` : '';
          fullCommand = `export PATH="$HOME/.local/bin:$PATH"; agy${modelFlag} --dangerously-skip-permissions --add-dir "${effectiveCwd}"${dirFlags} -p "${promptWithContext.replace(/"/g, '\\"')}"`;
        } else if (cliCmd === 'codex') {
          const modelFlag = activeModelId && !prompt.startsWith('/') ? ` -m "${activeModelId}"` : '';
          fullCommand = `export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"; codex exec${modelFlag} --dangerously-bypass-approvals-and-sandbox --cd "${effectiveCwd}" "${promptWithContext.replace(/"/g, '\\"')}"`;
        }

        // Snapshot git status BEFORE execution to detect only files modified by this prompt
        const gitStatusBefore = await window.electronAPI.shell.exec('git status --porcelain', effectiveCwd);
        const beforeStatusLines = new Set<string>(
          gitStatusBefore.exitCode === 0 && gitStatusBefore.stdout
            ? gitStatusBefore.stdout.trim().split('\n').map((l: string) => l.trim()).filter(Boolean)
            : []
        );

        // Lifecycle hooks (.agents/hooks.json): { "PreInvocation": [{"command": "..."}], "PostInvocation": [...], "Stop": [...] }
        const runHooks = async (event: 'PreInvocation' | 'PostInvocation' | 'Stop') => {
          try {
            const raw = await window.electronAPI.fs.readFile(`${effectiveCwd}/.agents/hooks.json`);
            const list: Array<{ command: string }> = raw?.content ? JSON.parse(raw.content)?.[event] || [] : [];
            for (const h of list) {
              const res = await window.electronAPI.shell.exec(h.command, effectiveCwd);
              if (res.exitCode !== 0) return `${event}: \`${h.command}\` falhou (${res.exitCode}) ${(res.stderr || res.stdout || '').trim().slice(0, 300)}`;
            }
          } catch {}
          return null;
        };
        const preHookError = await runHooks('PreInvocation');
        if (preHookError) {
          pushAiMessage({ type: 'error', text: `Hook bloqueou a execução. ${preHookError}`, timestamp: Date.now() });
          endRun();
          return;
        }

        const startTime = Date.now();
        let liveSteps: ExecutionStepItem[] = [];
        const touchedFiles = new Map<string, { additions: number; deletions: number }>();

        // Real-time git status & diff watcher to capture files as they are being edited live
        const pollLiveChanges = async () => {
          if (aiExecIdsRef.current[runWorkspace] !== thisExecutionId) return;
          try {
            const currentStatus = await window.electronAPI.shell.exec('git status --porcelain', effectiveCwd);
            if (currentStatus.exitCode === 0 && currentStatus.stdout) {
              const currentLines = currentStatus.stdout.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
              const newlyModifiedFiles: string[] = [];
              for (const line of currentLines) {
                if (!beforeStatusLines.has(line)) {
                  const relPath = line.slice(2).trim();
                  if (relPath && !relPath.endsWith('/')) {
                    newlyModifiedFiles.push(relPath);
                  }
                }
              }

              if (newlyModifiedFiles.length > 200) newlyModifiedFiles.length = 200; // repositório com muita coisa nova: acompanha só os primeiros
              if (newlyModifiedFiles.length > 0) {
                const diffRes = await window.electronAPI.shell.exec('git diff --numstat', effectiveCwd);
                const diffMap = new Map<string, { additions: number; deletions: number }>();
                if (diffRes.exitCode === 0 && diffRes.stdout) {
                  const dl = diffRes.stdout.trim().split('\n');
                  for (const d of dl) {
                    const parts = d.split(/\t+/);
                    if (parts.length >= 3) {
                      diffMap.set(parts[2].trim(), {
                        additions: parseInt(parts[0], 10) || 0,
                        deletions: parseInt(parts[1], 10) || 0,
                      });
                    }
                  }
                }

                let updated = false;
                for (const rel of newlyModifiedFiles) {
                  const fileName = rel.split('/').pop() || rel;
                  const diffInfo = diffMap.get(rel) || { additions: 1, deletions: 0 };
                  const prev = touchedFiles.get(rel);

                  if (!prev) {
                    touchedFiles.set(rel, { additions: diffInfo.additions, deletions: diffInfo.deletions });
                    const exploreStep: ExecutionStepItem = {
                      id: `explore-${rel}`,
                      type: 'explore',
                      label: 'Explorou 1 arquivo',
                      children: [
                        {
                          id: `analyzed-${rel}`,
                          type: 'analyze',
                          label: `Analisou ${fileName}`,
                          file: fileName,
                          path: `${effectiveCwd}/${rel}`,
                        },
                        {
                          id: `thought-${rel}`,
                          type: 'thought',
                          label: 'Pensou por 1s',
                          duration: '1s',
                        },
                      ],
                    };

                    const editStep: ExecutionStepItem = {
                      id: `edit-${rel}`,
                      type: 'edit',
                      label: `Editou ${fileName}`,
                      file: fileName,
                      path: `${effectiveCwd}/${rel}`,
                      additions: diffInfo.additions,
                      deletions: diffInfo.deletions,
                    };

                    liveSteps = [...liveSteps, exploreStep, editStep];
                    updated = true;
                    setLiveCurrentAction(`Editou ${fileName} +${diffInfo.additions} -${diffInfo.deletions}`);
                  } else if (prev.additions !== diffInfo.additions || prev.deletions !== diffInfo.deletions) {
                    prev.additions = diffInfo.additions;
                    prev.deletions = diffInfo.deletions;
                    liveSteps = liveSteps.map((st) => {
                      if (st.type === 'edit' && st.file === fileName) {
                        return { ...st, additions: diffInfo.additions, deletions: diffInfo.deletions };
                      }
                      return st;
                    });
                    updated = true;
                    setLiveCurrentAction(`Editou ${fileName} +${diffInfo.additions} -${diffInfo.deletions}`);
                  }
                }

                if (updated) {
                  setLiveExecutionSteps([...liveSteps]);
                }
              }
            }
          } catch {}
        };

        const liveTimer = setInterval(() => {
          const elapsedSec = Math.max(1, Math.round((Date.now() - startTime) / 1000));
          const durationStr = elapsedSec >= 60 ? `${Math.floor(elapsedSec / 60)}m ${elapsedSec % 60}s` : `${elapsedSec}s`;
          setLiveWorkedDuration(durationStr);
          pollLiveChanges();
        }, 1000);

        const stopAiEventListener = (window.electronAPI as any)?.ai?.onEvent?.((event: any) => {
          if (event?.kind === 'progress' && event?.payload?.text) {
            const txt = event.payload.text;
            const fileMatch = txt.match(/(?:Edited|Editing|Writing|Saving|replace_file_content|write_to_file)\s+([a-zA-Z0-9_\-./]+\.[a-zA-Z0-9]+)/i);
            if (fileMatch) {
              const fName = fileMatch[1].split('/').pop() || fileMatch[1];
              setLiveCurrentAction(`Editando ${fName}...`);
            }
          }
        });

        let execRes: { stdout: string; stderr: string; exitCode: number; error?: string | null };
        try {
          if (window.electronAPI?.ai?.runCli) {
            const additionalDirsList = [
              ...currentAttachedFiles.filter((f) => f.isDirectory).map((f) => f.path),
              ...mentionedFilesData
                .map((f) => {
                  const parts = f.path.split('/');
                  parts.pop();
                  const parentDir = parts.join('/');
                  return parentDir && !parentDir.startsWith(effectiveCwd) ? parentDir : '';
                })
                .filter(Boolean),
            ];

            const targetModel = isOrchestratorActive && orchestratorTargetModel
              ? orchestratorTargetModel
              : (activeModelId && !prompt.startsWith('/') ? activeModelId : undefined);

            execRes = await window.electronAPI.ai.runCli({
              cliCmd,
              prompt: promptWithContext,
              model: targetModel,
              cwd: effectiveCwd,
              additionalDirs: additionalDirsList,
              useOrchestrator: isOrchestratorActive,
              orchestratorConfig: orchestrationConfig,
              permissions: (() => {
                try {
                  const saved = localStorage.getItem('ide_ai_permissions');
                  return saved ? { ...DEFAULT_AI_PERMISSIONS, ...JSON.parse(saved) } : undefined;
                } catch {
                  return undefined;
                }
              })(),
            });
          } else {
            execRes = await window.electronAPI.shell.exec(fullCommand, effectiveCwd);
          }
        } finally {
          clearInterval(liveTimer);
          stopAiEventListener?.();
        }

        await pollLiveChanges();

        if (aiExecIdsRef.current[runWorkspace] !== thisExecutionId || (execRes as any)?.cancelled) {
          // A geração foi cancelada pelo usuário! Não renderiza mensagem da IA.
          endRun();
          return;
        }

        const durationMs = Date.now() - startTime;
        const durationSec = Math.max(1, Math.round(durationMs / 1000));
        const workedDuration = durationSec >= 60 ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : `${durationSec}s`;

        // Refresh file tree immediately so newly created files appear in Explorer
        await loadWorkspaceTree(effectiveCwd);

        // Prefer clean stdout; fallback to stderr/error if stdout is empty
        let cleanOutput = '';
        if (execRes.stdout && execRes.stdout.trim().length > 0) {
          cleanOutput = execRes.stdout.trim();
        } else {
          cleanOutput = (execRes.stderr || execRes.error || '').trim();
        }

        // Strip ANSI terminal escape sequences for clean chat display
        cleanOutput = cleanOutput.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').trim();

        // Check if output is an authentication / OAuth session expired error
        const isAuthError = isAuthErrorText(cleanOutput);
        if (isAuthError) {
          const authCmd =
            currentProvider.id === 'claude'
              ? 'claude login'
              : currentProvider.id === 'antigravity'
              ? 'agy auth login'
              : currentProvider.id === 'codex'
              ? 'codex login'
              : currentProvider.id === 'gemini'
              ? 'gemini auth login'
              : `${currentProvider.cliCommand} login`;

          pushAiMessage({
            type: 'auth_required',
            text: cleanOutput,
            command: authCmd,
            providerId: currentProvider.id,
            timestamp: Date.now(),
          });
          endRun();
          return;
        }

        // Check if output is a permission error or failure
        const hasPermissionOrCriticalError =
          cleanOutput.includes('jetski: no output produced') ||
          cleanOutput.includes('auto-denied') ||
          (execRes.exitCode !== 0 && cleanOutput.toLowerCase().includes('error'));

        // Check git status after to extract only files ACTUALLY changed by this prompt
        let changedFiles: ChangedFileItem[] = [];
        if (!hasPermissionOrCriticalError && execRes.exitCode === 0) {
          try {
            const gitStatusAfter = await window.electronAPI.shell.exec('git status --porcelain', effectiveCwd);
            if (gitStatusAfter.exitCode === 0 && gitStatusAfter.stdout) {
              const afterLines = gitStatusAfter.stdout.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
              const newlyModifiedFiles = new Set<string>();
              for (const line of afterLines) {
                if (!beforeStatusLines.has(line)) {
                  const relPath = line.slice(2).trim();
                  if (relPath && !relPath.endsWith('/')) {
                    newlyModifiedFiles.add(relPath);
                  }
                }
              }

              if (newlyModifiedFiles.size > 0) {
                const gitDiffRes = await window.electronAPI.shell.exec('git diff --numstat', effectiveCwd);
                const diffMap = new Map<string, { additions: number; deletions: number }>();
                if (gitDiffRes.exitCode === 0 && gitDiffRes.stdout.trim()) {
                  const dl = gitDiffRes.stdout.trim().split('\n');
                  for (const d of dl) {
                    const parts = d.split(/\t+/);
                    if (parts.length >= 3) {
                      diffMap.set(parts[2].trim(), {
                        additions: parseInt(parts[0], 10) || 0,
                        deletions: parseInt(parts[1], 10) || 0,
                      });
                    }
                  }
                }

                for (const relPath of [...newlyModifiedFiles].slice(0, 500)) {
                  const partsSlash = relPath.split('/');
                  const fileName = partsSlash[partsSlash.length - 1];
                  const dirName = partsSlash.slice(0, -1).join('/');
                  const diffInfo = diffMap.get(relPath) || { additions: 1, deletions: 0 };
                  changedFiles.push({
                    path: `${effectiveCwd}/${relPath}`,
                    name: fileName,
                    dir: dirName ? `.../${dirName}` : '',
                    additions: diffInfo.additions,
                    deletions: diffInfo.deletions,
                  });
                }
              }
            }
          } catch {}
        }

        // Construct Antigravity-style execution steps only if actual files were modified
        const executionSteps: ExecutionStepItem[] = [];
        if (liveSteps.length > 0) {
          for (const st of liveSteps) executionSteps.push(st); // sem spread: com milhares de arquivos alterados estourava a pilha (Maximum call stack size exceeded)
        } else if (changedFiles.length > 0) {
          changedFiles.forEach((f, cIdx) => {
            executionSteps.push({
              id: `explore-${f.name}-${cIdx}`,
              type: 'explore',
              label: 'Explorou 1 arquivo',
              children: [
                {
                  id: `analyzed-${f.name}-${cIdx}`,
                  type: 'analyze',
                  label: `Analisou ${f.name}`,
                  file: f.name,
                  path: f.path,
                },
                {
                  id: `thought-${f.name}-${cIdx}`,
                  type: 'thought',
                  label: 'Pensou por 1s',
                  duration: '1s',
                },
              ],
            });
            executionSteps.push({
              id: `edit-${f.name}-${cIdx}`,
              type: 'edit',
              label: `Editou ${f.name}`,
              file: f.name,
              path: f.path,
              additions: f.additions,
              deletions: f.deletions,
            });
          });
        }

        // Extract walkthrough summary ONLY when actual code changes were made or explicit walkthrough section exists
        let walkthrough: WalkthroughItem | undefined = undefined;
        if (!hasPermissionOrCriticalError && changedFiles.length > 0 && cleanOutput.length > 20) {
          const nonCodeLines = cleanOutput
            .split('\n')
            .filter((l: string) => l.trim().length > 0 && !l.startsWith('```') && !l.startsWith('>'));
          const firstFew = nonCodeLines.slice(0, 3).join(' ');
          if (firstFew.length > 10) {
            walkthrough = {
              title: 'Walkthrough',
              summary: firstFew.length > 240 ? firstFew.slice(0, 240) + '...' : firstFew,
            };
          }
        }

        let interactiveQuestion: { question: string; options: string[]; isMultiSelect?: boolean } | undefined;
        const askMatch = cleanOutput.match(/<!--\s*ASK_QUESTION:(\{[\s\S]*?\})\s*-->/);
        if (askMatch) {
          try {
            const q = JSON.parse(askMatch[1]);
            if (q?.question && Array.isArray(q.options)) interactiveQuestion = q;
          } catch {}
          cleanOutput = cleanOutput.replace(askMatch[0], '').trim();
        }
        const postHookError = (await runHooks('PostInvocation')) || (await runHooks('Stop'));

        const msgText = (cleanOutput || (execRes.exitCode === 0 ? 'Concluído com sucesso.' : `Comando concluído com status ${execRes.exitCode}`)) + (postHookError ? `\n\n> [!WARNING]\n> ${postHookError}` : '');
        const finalWorkedDuration = liveWorkedDuration !== '0s' ? liveWorkedDuration : workedDuration;

        pushAiMessage({
          type: 'assistant',
          text: msgText,
          timestamp: Date.now(),
          workedDuration: changedFiles.length > 0 || durationSec > 2 ? finalWorkedDuration : undefined,
          executionSteps: executionSteps.length > 0 ? executionSteps : undefined,
          walkthrough,
          changedFiles: changedFiles.length > 0 ? changedFiles : undefined,
          interactiveQuestion,
        });
        runOutcome = interactiveQuestion ? 'waiting' : 'done';
        runSummary = interactiveQuestion
          ? interactiveQuestion.question
          : msgText.replace(/\s+/g, ' ').trim().slice(0, 160);
      } catch (err: any) {
        pushAiMessage({
          type: 'error',
          text: `Erro na execução do terminal de IA: ${err.message}`,
        });
        runOutcome = 'done';
        runSummary = `Erro: ${err?.message || 'falha na execução'}`.slice(0, 160);
      } finally {
        endRun();
        refreshAiQuotas();
        if (prompt.startsWith('/model')) {
          refreshAiModels(currentProvider.id);
        }
        // Fila é do projeto aberto: só continua se o usuário ainda estiver nele
        const nextInQueue = workspacePathRef.current === runWorkspace ? queuedAiMessagesRef.current[0] : undefined;
        if (nextInQueue) {
          setQueuedAiMessages((prev) => prev.slice(1));
          setTimeout(() => {
            handleAiSubmit(undefined, nextInQueue.prompt);
          }, 150);
        }
      }
    } else {
      pushAiMessage({
        type: 'error',
        text: `O provedor "${currentProvider.name || currentProvider.id}" não possui CLI configurado para executar este prompt.`,
        timestamp: Date.now(),
      });
      endRun();
    }
  };

  // Action Handlers for Issues: Revisar e Aceitar/Finalizar
  const handleReviewIssue = (issueNumber: number, issueTitle?: string) => {
    const targetTitle = issueTitle || activeWorkingIssue?.title || `Issue #${issueNumber}`;
    const targetProjectName = activeHeaderProject?.name || gitRepoName || 'devflow-desktop';
    logSystemActivity('tarefas', 'review_issue', targetProjectName, { issueNumber, title: targetTitle });

    const reviewPrompt = `Por favor, faça uma revisão minuciosa e completa de tudo o que foi implementado na tarefa #${issueNumber} ("${targetTitle}").

Verifique criteriosamente:
1. Conteúdo hardcoded ou textos estáticos que deveriam ser dinâmicos ou parametrizados;
2. Falhas de segurança, validações ausentes, tratamento de erros ou vulnerabilidades;
3. Mocks temporários, console.logs residuais ou códigos de teste esquecidos;
4. Qualidade de código, tipagem TypeScript, integridade com o restante do projeto e boas práticas.

Se encontrar qualquer problema, corrija-o imediatamente e explique o ajuste realizado. Caso esteja tudo em ordem, confirme que a revisão foi aprovada com sucesso. Ao final, apresente um relatório conciso da revisão e pergunte novamente se deseja finalizar a issue.`;

    handleAiSubmit(undefined, reviewPrompt);
  };

  const handleAcceptAndFinalizeIssue = async (
    issueNumber: number,
    issueTitle?: string,
    summaryText?: string
  ) => {
    if (isFinalizingIssue) return;
    setIsFinalizingIssue(true);

    try {
      const targetTitle = issueTitle || activeWorkingIssue?.title || `Issue #${issueNumber}`;
      const safeTitle = targetTitle.replace(/"/g, "'").trim();
      const effectiveCwd = activeHeaderProject?.localDir || workspacePath || terminalCwd || process.cwd();
      const targetProjectName = activeHeaderProject?.name || gitRepoName || 'devflow-desktop';

      // 1. Git commit with issue linked
      let commitHash = '';
      let commitError = '';
      if (window.electronAPI?.shell?.exec) {
        try {
          await window.electronAPI.shell.exec('git add -A', effectiveCwd);
          const commitMsg = `feat: resolver tarefa #${issueNumber} - ${safeTitle} (resolves #${issueNumber})`;
          const commitRes = await window.electronAPI.shell.exec(
            `git commit -m "${commitMsg.replace(/"/g, '\\"')}"`,
            effectiveCwd
          );
          if (commitRes.exitCode === 0) {
            const revRes = await window.electronAPI.shell.exec('git rev-parse --short HEAD', effectiveCwd);
            if (revRes.exitCode === 0) {
              commitHash = revRes.stdout.trim();
            }
          } else {
            const out = (commitRes.stdout || commitRes.stderr || '').toLowerCase();
            if (out.includes('nothing to commit') || out.includes('working tree clean')) {
              commitHash = 'clean';
            } else {
              commitError = commitRes.stderr || commitRes.stdout || '';
            }
          }
        } catch (err: any) {
          commitError = err?.message || 'Falha ao executar commit';
        }
      }

      // 2. Close GitHub issue via gh CLI
      let ghClosed = false;
      let ghError = '';
      if (window.electronAPI?.shell?.exec) {
        try {
          const ghRes = await window.electronAPI.shell.exec(
            `export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"; gh issue close ${issueNumber} --reason completed -c "Concluído e comitado via Aura Dev AI"`,
            effectiveCwd
          );
          if (ghRes.exitCode === 0) {
            ghClosed = true;
          } else {
            ghError = ghRes.stderr || ghRes.stdout || '';
          }
        } catch (err: any) {
          ghError = err?.message || 'Falha ao fechar issue via GitHub CLI';
        }
      }

      // Update in-memory gitIssues
      setGitIssues((prev) =>
        prev.map((iss) => (iss.number === issueNumber ? { ...iss, state: 'closed', closedAt: new Date().toISOString() } : iss))
      );

      // 3. Extract short summary text for Daily task card
      let shortSummary = '';
      if (summaryText) {
        const cleaned = summaryText
          .replace(/<!--[\s\S]*?-->/g, '')
          .replace(/```[\s\S]*?```/g, '')
          .replace(/[#*`_]/g, '')
          .trim();
        const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
        const textJoined = lines.slice(0, 3).join(' ');
        shortSummary = textJoined.length > 240 ? textJoined.slice(0, 240) + '...' : textJoined;
      }
      if (!shortSummary) {
        shortSummary = `Implementação e resolução da tarefa #${issueNumber} concluída com sucesso.`;
      }

      // 4. Save completed task into Daily (devflow_daily_items_unified_v2)
      const storageKey = 'devflow_daily_items_unified_v2';
      const todayIso = new Date().toISOString().split('T')[0];
      const newDailyItem: any = {
        id: `issue-${issueNumber}-${Date.now()}`,
        title: `Tarefa #${issueNumber}: ${targetTitle}`,
        description: shortSummary,
        category: 'today',
        dateIso: todayIso,
        tag: 'Concluído',
        priority: 'Média',
        completed: true,
        projectId: targetProjectName,
        projectName: targetProjectName,
        cardTheme: 'cyan',
        assignee: { name: 'Walancy', initials: 'WA' },
        createdAt: new Date().toISOString(),
      };

      try {
        const existing = localStorage.getItem(storageKey);
        const parsed: any[] = existing ? JSON.parse(existing) : [];
        const filtered = parsed.filter((it) => it.id !== newDailyItem.id && it.title !== newDailyItem.title);
        const updated = [newDailyItem, ...filtered];
        localStorage.setItem(storageKey, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('devflow_daily_updated', { detail: { item: newDailyItem } }));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.warn('Erro ao salvar tarefa na Daily:', e);
      }

      // Mark as finalized in state
      setFinalizedIssues((prev) => ({ ...prev, [issueNumber]: true }));
      if (activeWorkingIssue?.number === issueNumber) {
        setActiveWorkingIssue(null);
      }

      const commitStatusText = commitHash && commitHash !== 'clean'
        ? `Commit criado com sucesso (\`${commitHash}\`).`
        : commitHash === 'clean'
        ? 'Repositório já estava limpo / arquivos já versionados.'
        : `Aviso no commit: ${commitError || 'não foi possível commitar'}.`;

      const ghStatusText = ghClosed
        ? `Issue #${issueNumber} fechada no GitHub com status "completed".`
        : `Aviso no GitHub CLI: ${ghError || 'não foi possível fechar via gh'}.`;

      const systemMsg: ChatMessageItem = {
        type: 'system',
        text: `Tarefa #${issueNumber} aceita e concluída com sucesso.\n- ${commitStatusText}\n- ${ghStatusText}\n- Tarefa adicionada à Daily como concluída com o resumo: "${shortSummary}"`,
        timestamp: Date.now(),
        providerId: selectedAiProvider,
      };

      setAiHistory((prev) => {
        const next = [...prev, systemMsg];
        setChatSessions((allSessions) => {
          const idx = allSessions.findIndex((s) => s.id === activeChatSessionId);
          if (idx >= 0) {
            const updated = [...allSessions];
            updated[idx] = { ...updated[idx], updatedAt: Date.now(), history: next };
            return updated;
          }
          return allSessions;
        });
        return next;
      });

      logSystemActivity('tarefas', 'accept_and_finalize_issue', targetProjectName, {
        issueNumber,
        issueTitle: targetTitle,
        commitHash,
        dailyItemId: newDailyItem.id,
      });

      setToastMessage(`Tarefa #${issueNumber} concluída e vinculada à Daily!`);
    } catch (err: any) {
      console.error('Erro ao finalizar tarefa:', err);
      setToastMessage(`Erro ao finalizar tarefa: ${err?.message || err}`);
    } finally {
      setIsFinalizingIssue(false);
    }
  };


  const handleDebugSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debugCommand.trim()) return;

    const expr = debugCommand;
    const ws = workspacePath;
    const push = (...l: string[]) => setDebugByProject((prev) => ({ ...prev, [ws]: [...(prev[ws] || []), ...l] }));
    push(`> ${expr}`);
    setDebugCommand('');
    // avalia com Node na pasta do projeto (o renderer não tem process/require)
    window.electronAPI?.shell?.exec?.(`node -p '${expr.replace(/'/g, `'\\''`)}'`, ws)
      .then((r) => push((r.stdout || r.stderr || r.error || '').trim() || 'undefined'))
      .catch((err: any) => push(`Evaluation Error: ${err?.message || err}`));
  };

  const showTrafficLightSpacer = !isFullscreen;

  if (githubAuthStatus === 'checking') {
    return (
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: themeTokens.bgApp,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 12,
          padding: 12,
          zIndex: 99999,
          userSelect: 'none',
        }}
      >
        <div
          style={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            borderTop: `2px solid ${accentColor}`,
            borderRight: '2px solid transparent',
            borderBottom: '2px solid transparent',
            borderLeft: '2px solid transparent',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <div
          style={{
            fontSize: 12,
            color: themeTokens.textSecondary,
            fontFamily: 'Poppins',
            fontWeight: 400,
            letterSpacing: '0.01em',
          }}
        >
          Carregando ambiente...
        </div>
      </div>
    );
  }

  if (githubAuthStatus === 'unauthenticated') {
    return (
      <GithubLoginScreen
        accentColor={accentColor}
        previousUser={signedOutUser}
        onResume={() => {
          markLastLogin();
          setSignedOutUser(null);
          setGithubAuthStatus('authenticated');
        }}
        onAuthenticated={(user) => {
          markLastLogin();
          setSignedOutUser(null);
          setGithubUser(user);
          try { localStorage.setItem('devflow_github_user', JSON.stringify(user)); } catch {}
          setGithubAuthStatus('authenticated');
        }}
      />
    );
  }

  // Conteúdo das abas do painel do IDE (Problems, Output, Debug console, Ports, Tarefas): usado no IDE e na tela do CLI
  const renderIdeDockTab = (tab: string) => (
    <>
                {/* 2. Problems View */}
                {tab === 'problems' && (
                  <ProblemsPanelView
                    problems={allProblems}
                    activeFile={activeFile}
                    onOpenFile={handleOpenFile}
                    onJumpToLocation={(filePath, line, col) => {
                      if (editorInstanceRef.current) {
                        editorInstanceRef.current.revealPositionInCenter({ lineNumber: line, column: col });
                        editorInstanceRef.current.setPosition({ lineNumber: line, column: col });
                        editorInstanceRef.current.focus();
                      }
                    }}
                    onRunProjectCheck={handleRunProjectCheck}
                    checkResults={projectCheckResults}
                    isCheckingProject={isCheckingProject}
                    lastCheckedTime={lastProjectCheckTime}
                    themeTokens={themeTokens}
                    accentColor={accentColor}
                    isEffectiveDark={isEffectiveDark}
                    onAskAiAboutProblem={(prob) => {
                      setActiveTab('cli');
                    }}
                  />
                )}

                {/* 3. Output View */}
                {tab === 'output' && (
                  <div
                    style={{
                      flex: '1 1 0',
                      alignSelf: 'stretch',
                      padding: 14,
                      background: themeTokens.bgCard,
                      borderRadius: 10,
                      border: '1px solid ' + themeTokens.border,
                      flexDirection: 'column',
                      gap: 6,
                      display: 'flex',
                      overflowY: 'auto',
                      fontFamily: 'JetBrains Mono, Menlo, monospace',
                      fontSize: 12,
                      color: themeTokens.textSecondary,
                    }}
                  >
                    {outputLines.length === 0 && <div>Sem saída dos terminais deste projeto ainda.</div>}
                    {outputLines.slice(-300).map((l, i) => (
                      <div key={i} style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{l}</div>
                    ))}
                  </div>
                )}

                {/* 4. Debug Console View */}
                {tab === 'debug' && (
                  <div
                    style={{
                      flex: '1 1 0',
                      alignSelf: 'stretch',
                      padding: 14,
                      background: themeTokens.bgCard,
                      borderRadius: 10,
                      border: '1px solid ' + themeTokens.border,
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      display: 'flex',
                      fontFamily: 'JetBrains Mono, Menlo, monospace',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
                      {debugHistory.map((item, idx) => (
                        <div key={idx} style={{ color: item.startsWith('>') ? accentColor : themeTokens.textSecondary }}>
                          {item}
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleDebugSubmit} style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid ' + themeTokens.border, paddingTop: 8 }}>
                      <span style={{ color: accentColor }}>&gt;</span>
                      <input
                        type="text"
                        value={debugCommand}
                        onChange={(e) => setDebugCommand(e.target.value)}
                        placeholder="Avaliar expressão (ex: 2 + 2, Date.now(), process.platform)"
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: themeTokens.textPrimary,
                          fontSize: 12,
                          fontFamily: 'JetBrains Mono, Menlo, monospace',
                        }}
                      />
                    </form>
                  </div>
                )}

                {/* 5. Ports View */}
                {tab === 'ports' && (
                  <div
                    style={{
                      flex: '1 1 0',
                      alignSelf: 'stretch',
                      padding: 14,
                      background: themeTokens.bgCard,
                      borderRadius: 10,
                      border: '1px solid ' + themeTokens.border,
                      flexDirection: 'column',
                      gap: 8,
                      display: 'flex',
                      overflowY: 'auto',
                    }}
                  >
                    <div style={{ color: themeTokens.textPrimary, fontSize: 13, fontWeight: 500, marginBottom: 4, whiteSpace: 'nowrap' }}>
                      Portas Encaminhadas e Serviços Ativos
                    </div>
                    {projectServers.length === 0 && (
                      <div style={{ color: themeTokens.textSecondary, fontSize: 12 }}>Nenhuma porta aberta por este projeto.</div>
                    )}
                    {projectServers.map((p) => ({ port: p.port, proc: p.serviceName || `pid ${p.pid}`, url: p.url })).map((p) => (
                      <div
                        key={p.port}
                        style={{
                          padding: '8px 12px',
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Radio size={14} color="#3fb950" />
                          <span style={{ color: themeTokens.textPrimary, fontWeight: 600, fontSize: 12.5 }}>:{p.port}</span>
                          <span style={{ color: themeTokens.textSecondary, fontSize: 12 }}>{p.proc}</span>
                        </div>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: accentColor,
                            fontSize: 12,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {p.url}
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {/* 6. Tasks View */}
                {tab === 'tasks' && (
                  <ProjectTasksDockTab
                    issues={gitIssues}
                    isLoading={isLoadingIssues}
                    onRefresh={refreshGitHubIssues}
                    onDoWithAi={handleTaskDoWithAi}
                    onOpenIssueDetails={handleOpenIssueSidesheet}
                    currentUserLogin={githubUser?.login || 'walancy'}
                    repoName={activeHeaderProject?.fullName || gitRepoName}
                    sprints={projectMilestones}
                    themeTokens={themeTokens}
                    isEffectiveDark={isEffectiveDark}
                    accentColor={accentColor}
                  />
                )}
    </>
  );


  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        padding: 5,
        background: themeTokens.bgApp,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        gap: 5,
        display: 'flex',
        overflow: 'hidden',
        boxSizing: 'border-box',
        position: 'relative',
        transition: 'background 0.2s ease',
      }}
    >

      {/* ============================================================ */}
      {/* 1. TOP BAR WITH ANIMATED TABS & INLINE CONTROLS              */}
      {/* ============================================================ */}
      <div
        style={{
          width: '100%',
          background: themeTokens.bgApp,
          borderRadius: 10,
          justifyContent: 'space-between',
          alignItems: 'center',
          display: 'flex',
          flexShrink: 0,
          WebkitAppRegion: 'drag' as any,
          position: 'relative',
        }}
      >
        {/* Left: Animated Traffic lights spacer + Nav Tabs */}
        <div
          style={{
            justifyContent: 'flex-start',
            alignItems: 'center',
            display: 'flex',
            WebkitAppRegion: 'no-drag' as any,
            flexShrink: 0,
          }}
        >
          {/* Animated Traffic Lights Capsule Container */}
          <div
            style={{
              width: showTrafficLightSpacer ? 72 : 0,
              height: 30,
              marginLeft: showTrafficLightSpacer ? 4 : 0,
              marginRight: showTrafficLightSpacer ? 6 : 0,
              borderRadius: 8,
              background: 'transparent',
              boxShadow: 'none',
              flexShrink: 0,
              transition: isDraggingExplorer || isDraggingAi || isDraggingTerminal ? 'none' : 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
            }}
          />

          <div
            style={{
              padding: 5,
              background: themeTokens.bgCard,
              borderRadius: 10,
              border: '1px solid ' + themeTokens.border,
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 5,
              display: 'flex',
              flexShrink: 0,
            }}
          >
            {[
              { id: 'projetos', label: 'Projetos' },
              { id: 'orchestration', label: 'Orquestração' },
              { id: 'daily', label: 'Daily' },
              { id: 'ide', label: 'IDE' },
              { id: 'cli', label: 'CLI' },
              { id: 'design', label: 'Design' },
            ].map((t) => {
              const isActive = activeTab === t.id;
              const TabIcon = (t as any).icon;
              return (
                <div
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  style={{
                    paddingLeft: 14,
                    paddingRight: 14,
                    paddingTop: 5,
                    paddingBottom: 5,
                    background: isActive ? (isEffectiveDark ? '#2E2E2E' : '#e4e7eb') : 'transparent',
                    borderRadius: 5,
                    border: 'none',
                    justifyContent: 'center',
                    alignItems: 'center',
                    display: 'flex',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  {TabIcon && <TabIcon size={13} style={{ marginRight: 5 }} />}
                  <div
                    style={{
                      color: isActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                      fontSize: 12,
                      fontFamily: 'Poppins',
                      fontWeight: isActive ? '500' : '400',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.label}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Seletor de Projeto Ativo na Header */}
          <HeaderProjectSelector
            workspacePath={workspacePath}
            onSelectWorkspace={handleSelectWorkspace}
            themeTokens={themeTokens}
            isEffectiveDark={isEffectiveDark}
            accentColor={accentColor}
            onToast={(msg) => {
              setToastMessage(msg);
              setTimeout(() => setToastMessage(null), 3000);
            }}
            onActiveProjectChange={setActiveHeaderProject}
            onProjectsListChange={setHeaderProjectsList}
            projectRuntimes={projectRuntimes}
            projectAiStatus={projectAiStatus}
            hideAiProvider={activeTab === 'cli'}
          />

          {/* Botão Brain do Projeto (Grafo Obsidian & Contexto de IA) */}
          <button
            onClick={() => setIsBrainModalOpen(true)}
            title="Aura Dev Brain - Contexto do Projeto e Grafo Obsidian"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: 6,
              borderRadius: 6,
              background: isBrainModalOpen
                ? `${accentColor}18`
                : 'transparent',
              border: 'none',
              boxShadow: 'none',
              cursor: 'pointer',
              color: isBrainModalOpen ? accentColor : themeTokens.textSecondary,
              transition: 'all 0.15s ease',
              fontWeight: 400,
              fontFamily: 'Poppins, sans-serif',
              fontSize: 11.5,
              outline: 'none',
              flexShrink: 0,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = accentColor;
              e.currentTarget.style.background = isEffectiveDark
                ? 'rgba(255, 255, 255, 0.06)'
                : 'rgba(0, 0, 0, 0.05)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = isBrainModalOpen
                ? accentColor
                : themeTokens.textSecondary;
              e.currentTarget.style.background = isBrainModalOpen
                ? `${accentColor}18`
                : 'transparent';
            }}
          >
            <Brain size={14} strokeWidth={1.8} />
          </button>

          {/* Servidor do projeto rodando: link para abrir no navegador e botão para encerrar */}
          {projectServers.length === 0 && devStartCommand && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', borderRadius: 6, flexShrink: 0, background: startingServer ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)') : 'transparent', WebkitAppRegion: 'no-drag' as any }}>
              <button
                type="button"
                disabled={startingServer}
                onClick={() => (devOptions ? setDevMenuOpen((v) => !v) : devStartCommand && startProject(devStartCommand))}
                title={startingServer ? `Iniciando (${devStartCommand})…` : devOptions ? 'Iniciar o projeto: escolha o gerenciador e o script' : `Iniciar o projeto (${devStartCommand})`}
                style={{ display: 'flex', alignItems: 'center', padding: startingServer ? '6px 4px 6px 7px' : 6, borderRadius: 6, border: 'none', background: 'transparent', cursor: startingServer ? 'default' : 'pointer', color: themeTokens.textSecondary }}
                onMouseEnter={(e) => { if (!startingServer) { e.currentTarget.style.color = '#3fb950'; e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'; } }}
                onMouseLeave={(e) => { e.currentTarget.style.color = themeTokens.textSecondary; e.currentTarget.style.background = 'transparent'; }}
              >
                {startingServer ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} strokeWidth={1.8} />}
              </button>
              {devMenuOpen && devOptions && !startingServer && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 99998 }} onClick={() => setDevMenuOpen(false)} />
                  <div
                    style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 232, maxHeight: 420, overflowY: 'auto', background: isEffectiveDark ? '#1a1a1c' : '#ffffff', borderRadius: 12, boxShadow: '0 16px 40px rgba(0,0,0,0.6)', padding: '6px 6px 8px', zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 2, fontFamily: 'Poppins, sans-serif' }}
                  >
                    {devOptions.scripts.length > 0 && (
                      <>
                        {/* gerenciador: texto simples, o escolhido em destaque */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 10px 8px' }}>
                          {PACKAGE_MANAGERS.map((pm) => (
                            <span
                              key={pm}
                              onClick={() => setDevMenuPm(pm)}
                              title={pm === devOptions.pm ? `${pm} (detectado no projeto)` : pm}
                              style={{ fontSize: 12, cursor: 'pointer', fontWeight: devMenuPm === pm ? 600 : 400, color: devMenuPm === pm ? accentColor : themeTokens.textMuted, borderBottom: `1.5px solid ${devMenuPm === pm ? accentColor : 'transparent'}`, paddingBottom: 2, display: 'inline-flex', alignItems: 'center', gap: 4 }}
                            >
                              {pm}
                              {pm === devOptions.pm && <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#3fb950' }} />}
                            </span>
                          ))}
                        </div>
                        {devOptions.scripts.slice(0, 14).map((sc) => (
                          <div
                            key={sc}
                            onClick={() => startProject(scriptCommand(devMenuPm, sc, devForce))}
                            title={scriptCommand(devMenuPm, sc, devForce)}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, color: themeTokens.textPrimary }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = isEffectiveDark ? '#242426' : '#f1f5f9'; const i = e.currentTarget.lastElementChild as HTMLElement | null; if (i) i.style.opacity = '1'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; const i = e.currentTarget.lastElementChild as HTMLElement | null; if (i) i.style.opacity = '0'; }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc}</span>
                            <Play size={11} color="#3fb950" style={{ opacity: 0, flexShrink: 0, transition: 'opacity 0.1s ease' }} />
                          </div>
                        ))}
                        {/* forçar: repassa --force ao script */}
                        <div
                          onClick={() => setDevForce((v) => !v)}
                          title="Repassa --force ao script (ex.: sobrescrever uma rota ou porta já registrada)"
                          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '9px 10px 4px', marginTop: 4, cursor: 'pointer', fontSize: 12, color: themeTokens.textSecondary }}
                        >
                          <span>Forçar <span style={{ color: themeTokens.textMuted, fontFamily: 'JetBrains Mono, Menlo, monospace', fontSize: 11 }}>--force</span></span>
                          <span style={{ width: 28, height: 16, borderRadius: 8, background: devForce ? accentColor : (isEffectiveDark ? '#333' : '#cbd5e1'), position: 'relative', transition: 'background 0.15s ease', flexShrink: 0 }}>
                            <span style={{ position: 'absolute', top: 2, left: devForce ? 14 : 2, width: 12, height: 12, borderRadius: '50%', background: '#fff', transition: 'left 0.15s ease' }} />
                          </span>
                        </div>
                      </>
                    )}
                    {devOptions.others.length > 0 && (
                      <>
                        {devOptions.scripts.length > 0 && <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', margin: '6px 8px 4px' }} />}
                        {devOptions.others.map((o) => (
                          <div
                            key={o.command}
                            onClick={() => startProject(o.command)}
                            title={o.command}
                            style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '7px 10px', borderRadius: 7, cursor: 'pointer', fontSize: 12.5, color: themeTokens.textPrimary }}
                            onMouseEnter={(e) => { e.currentTarget.style.background = isEffectiveDark ? '#242426' : '#f1f5f9'; const i = e.currentTarget.lastElementChild as HTMLElement | null; if (i) i.style.opacity = '1'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; const i = e.currentTarget.lastElementChild as HTMLElement | null; if (i) i.style.opacity = '0'; }}
                          >
                            <span>{o.label}</span>
                            <Play size={11} color="#3fb950" style={{ opacity: 0, flexShrink: 0, transition: 'opacity 0.1s ease' }} />
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </>
              )}
              {startingServer && (
                <button
                  type="button"
                  onClick={openDevTerminal}
                  title="Acompanhar no terminal"
                  style={{ display: 'flex', alignItems: 'center', padding: '6px 3px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeTokens.textSecondary }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
                >
                  <SquareTerminal size={13} />
                </button>
              )}
              {startingServer && (
                <button
                  type="button"
                  onClick={() => {
                    const id = startingSessionRef.current;
                    startingSessionRef.current = null;
                    devExitWatchRef.current?.();
                    devExitWatchRef.current = null;
                    setStartingServer(false);
                    if (id) {
                      window.electronAPI?.pty?.kill?.(id);
                      handleKillTerminalSession(id);
                    }
                    setToastMessage('Inicialização cancelada');
                    setTimeout(() => setToastMessage(null), 2000);
                  }}
                  title="Cancelar a inicialização"
                  style={{ display: 'flex', alignItems: 'center', padding: '6px 7px 6px 3px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeTokens.textMuted }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textMuted)}
                >
                  <X size={13} />
                </button>
              )}
            </div>
          )}
          {projectServers.map((srv) => (
            <div
              key={srv.pid + ':' + srv.port}
              onMouseEnter={() => setHoveredServerKey(srv.pid + ':' + srv.port)}
              onMouseLeave={() => setHoveredServerKey(null)}
              style={{ position: 'relative', display: 'flex', alignItems: 'center', borderRadius: 6, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)', flexShrink: 0, WebkitAppRegion: 'no-drag' as any }}
            >
              <button
                type="button"
                onClick={() => window.electronAPI?.shell?.openExternal?.(srv.url)}
                title={`Abrir ${srv.url} no navegador${srv.serviceName ? ` (${srv.serviceName})` : ''}`}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 5px 6px 7px', border: 'none', background: 'transparent', cursor: 'pointer', color: '#3fb950' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#3fb950')}
              >
                <Link2 size={14} strokeWidth={1.8} />
              </button>
              {hoveredServerKey === srv.pid + ':' + srv.port && (
                <div
                  style={{
                    position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100000, padding: '5px 9px', borderRadius: 6,
                    background: themeTokens.bgCard, border: `1px solid ${themeTokens.border}`, boxShadow: '0 6px 20px rgba(0,0,0,0.45)',
                    color: themeTokens.textPrimary, fontSize: 11.5, whiteSpace: 'nowrap', pointerEvents: 'none',
                  }}
                >
                  {srv.url}{srv.serviceName ? ` · ${srv.serviceName}` : ''}
                </div>
              )}
              {devSessionRef.current && terminalSessions.some((t) => t.id === devSessionRef.current) && (
                <button
                  type="button"
                  onClick={openDevTerminal}
                  title="Ver a saída no terminal"
                  style={{ display: 'flex', alignItems: 'center', padding: '6px 3px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeTokens.textMuted }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textMuted)}
                >
                  <SquareTerminal size={13} />
                </button>
              )}
              <button
                type="button"
                onClick={async () => {
                  await window.electronAPI?.ports?.kill?.(srv.pid);
                  setProjectServers((prev) => prev.filter((x) => x.pid !== srv.pid));
                  setToastMessage(`Servidor da porta ${srv.port} encerrado`);
                  setTimeout(() => setToastMessage(null), 2500);
                }}
                title={`Encerrar o servidor da porta ${srv.port}`}
                style={{ display: 'flex', alignItems: 'center', padding: '6px 7px 6px 3px', border: 'none', background: 'transparent', cursor: 'pointer', color: themeTokens.textMuted }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textMuted)}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        {/* Right: Layout Icons, Dividers, Profile */}
        <div style={{ justifyContent: 'center', alignItems: 'center', gap: 10, display: 'flex', WebkitAppRegion: 'no-drag' as any, flexShrink: 0 }}>
          {activeTab === 'ide' && (
            <>
              {/* Layout Controls: Customize Layout + 3 Panel Toggles */}
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={customizeLayoutRef}>
                <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 6, display: 'flex', WebkitAppRegion: 'no-drag' as any }}>
                  {/* 1. Customize Layout Button */}
                  <div
                    onClick={() => setIsCustomizeLayoutOpen((prev) => !prev)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isCustomizeLayoutOpen ? accentColor : themeTokens.textSecondary,
                      background: isCustomizeLayoutOpen ? hexToRgba(accentColor, 0.12) : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      WebkitAppRegion: 'no-drag' as any,
                    }}
                    onMouseEnter={(e) => {
                      if (!isCustomizeLayoutOpen) (e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary;
                      (e.currentTarget as HTMLElement).style.background = isCustomizeLayoutOpen ? hexToRgba(accentColor, 0.2) : themeTokens.hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = isCustomizeLayoutOpen ? accentColor : themeTokens.textSecondary;
                      (e.currentTarget as HTMLElement).style.background = isCustomizeLayoutOpen ? hexToRgba(accentColor, 0.12) : 'transparent';
                    }}
                    title="Personalizar Layout (Customize Layout)"
                  >
                    <CustomizeLayoutIcon size={17} />
                  </div>

                  {/* 2. Primary Sidebar (Explorer) */}
                  <div
                    onClick={() => setShowExplorer((prev) => !prev)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: showExplorer ? accentColor : themeTokens.textSecondary,
                      background: showExplorer ? hexToRgba(accentColor, 0.12) : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      WebkitAppRegion: 'no-drag' as any,
                    }}
                    onMouseEnter={(e) => {
                      if (!showExplorer) (e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary;
                      (e.currentTarget as HTMLElement).style.background = showExplorer ? hexToRgba(accentColor, 0.2) : themeTokens.hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = showExplorer ? accentColor : themeTokens.textSecondary;
                      (e.currentTarget as HTMLElement).style.background = showExplorer ? hexToRgba(accentColor, 0.12) : 'transparent';
                    }}
                    title={showExplorer ? 'Ocultar Barra Lateral Primária (Explorer) ⌘B' : 'Mostrar Barra Lateral Primária (Explorer) ⌘B'}
                  >
                    <PanelLeft size={18} />
                  </div>

                  {/* 3. Bottom Panel (Terminal) */}
                  <div
                    onClick={() => setIsTerminalCollapsed((prev) => !prev)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: !isTerminalCollapsed ? accentColor : themeTokens.textSecondary,
                      background: !isTerminalCollapsed ? hexToRgba(accentColor, 0.12) : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      WebkitAppRegion: 'no-drag' as any,
                    }}
                    onMouseEnter={(e) => {
                      if (isTerminalCollapsed) (e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary;
                      (e.currentTarget as HTMLElement).style.background = !isTerminalCollapsed ? hexToRgba(accentColor, 0.2) : themeTokens.hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = !isTerminalCollapsed ? accentColor : themeTokens.textSecondary;
                      (e.currentTarget as HTMLElement).style.background = !isTerminalCollapsed ? hexToRgba(accentColor, 0.12) : 'transparent';
                    }}
                    title={!isTerminalCollapsed ? 'Ocultar Painel Inferior (Terminal) ⌘J' : 'Mostrar Painel Inferior (Terminal) ⌘J'}
                  >
                    <PanelBottom size={18} />
                  </div>

                  {/* 4. Secondary Sidebar (AI Assistant Panel) */}
                  <div
                    onClick={() => setShowAiPanel((prev) => !prev)}
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 5,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: showAiPanel ? accentColor : themeTokens.textSecondary,
                      background: showAiPanel ? hexToRgba(accentColor, 0.12) : 'transparent',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      WebkitAppRegion: 'no-drag' as any,
                    }}
                    onMouseEnter={(e) => {
                      if (!showAiPanel) (e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary;
                      (e.currentTarget as HTMLElement).style.background = showAiPanel ? hexToRgba(accentColor, 0.2) : themeTokens.hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      (e.currentTarget as HTMLElement).style.color = showAiPanel ? accentColor : themeTokens.textSecondary;
                      (e.currentTarget as HTMLElement).style.background = showAiPanel ? hexToRgba(accentColor, 0.12) : 'transparent';
                    }}
                    title={showAiPanel ? 'Ocultar Painel de IA ⌘⇧A' : 'Mostrar Painel de IA ⌘⇧A'}
                  >
                    <PanelRight size={18} />
                  </div>
                </div>

                {/* Customize Layout Menu Popup (Matches Image 1 & 2) */}
                {isCustomizeLayoutOpen && (
                  <CustomizeLayoutPopup
                    themeTokens={themeTokens}
                    accentColor={accentColor}
                    onClose={() => setIsCustomizeLayoutOpen(false)}
                    onReset={handleResetLayout}
                    showActivityBar={showActivityBar}
                    setShowActivityBar={setShowActivityBar}
                    showExplorer={showExplorer}
                    setShowExplorer={setShowExplorer}
                    showAiPanel={showAiPanel}
                    setShowAiPanel={setShowAiPanel}
                    isTerminalCollapsed={isTerminalCollapsed}
                    setIsTerminalCollapsed={setIsTerminalCollapsed}
                    showStatusBar={showStatusBar}
                    setShowStatusBar={setShowStatusBar}
                    sidebarPosition={sidebarPosition}
                    setSidebarPosition={setSidebarPosition}
                    panelAlignment={panelAlignment}
                    setPanelAlignment={setPanelAlignment}
                    quickInputPosition={quickInputPosition}
                    setQuickInputPosition={setQuickInputPosition}
                    onToggleFullscreen={handleToggleFullscreen}
                    onToggleZenMode={handleToggleZenMode}
                    isZenMode={isZenMode}
                    isCenteredLayout={isCenteredLayout}
                    setIsCenteredLayout={setIsCenteredLayout}
                  />
                )}
              </div>

              {/* Vertical Divider */}
              <div style={{ width: 1, height: 24, background: isEffectiveDark ? '#373737' : 'rgba(0, 0, 0, 0.1)' }} />

              {/* Search file by name */}
              <div
                onClick={() => {
                  setIsQuickOpenOpen((prev) => !prev);
                  setQuickOpenQuery('');
                  setQuickOpenSelectedIndex(0);
                }}
                style={{
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isQuickOpenOpen ? accentColor : themeTokens.textSecondary,
                  cursor: 'pointer',
                  borderRadius: 4,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = isQuickOpenOpen ? accentColor : themeTokens.textSecondary)}
                title="Search files by name (⌘P)"
              >
                <Search size={18} />
              </div>
            </>
          )}

          {/* Header AI Group (2 Porcentagens de Uso + Seletor de IA) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, WebkitAppRegion: 'no-drag' as any }}>
            {/* IAs fixadas (+ a selecionada): uso de cada uma e troca com um clique */}
            {AI_PROVIDERS.map((p) => p.id).filter((id) => id === selectedAiProvider || pinnedAis.includes(id)).map((pid) => {
              const currentQuota = aiQuotas[pid] || aiQuotas.claude || DEFAULT_AI_QUOTAS.claude;
              const isSelected = pid === selectedAiProvider;
              return (
                <div
                  key={pid}
                  ref={(quotaTooltipProvider ? pid === quotaTooltipProvider : isSelected) ? headerQuotaTooltipRef : undefined}
                  onClick={() => {
                    if (!isSelected) {
                      handleSwitchAiProvider(pid);
                    } else {
                      cancelHeaderQuotaClose();
                      if (headerQuotaTooltipOpen && quotaTooltipProvider === pid) {
                        setHeaderQuotaTooltipOpen(false);
                      } else {
                        setQuotaTooltipProvider(pid);
                        setHeaderQuotaTooltipOpen(true);
                        refreshAiQuotas();
                      }
                    }
                  }}
                  onContextMenu={(e) => { e.preventDefault(); setIsAiGlobalRulesModalOpen(true); }}
                  onMouseEnter={() => openHeaderQuotaWithGrace(pid)}
                  onMouseLeave={closeHeaderQuotaWithGrace}
                  title={isSelected ? `IA ativa: ${AI_PROVIDERS.find((p) => p.id === pid)?.name} · ${selectedModel || 'Padrão'} (Botão direito para Regras Globais)` : `Usar ${AI_PROVIDERS.find((p) => p.id === pid)?.name}`}
                  style={{
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: '2px 4px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    background: isSelected ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)') : 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {/* Bloco de Números de Quota */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'center',
                      alignItems: 'flex-end',
                      lineHeight: 1.05,
                      userSelect: 'none',
                      flexShrink: 0,
                      padding: '2px 4px',
                      borderRadius: 4,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 400,
                          color: accentColor,
                          fontFamily: 'Poppins, -apple-system, sans-serif',
                        }}
                        title={pid === 'claude' ? 'Sessão de 5h' : 'Diário'}
                      >
                        {pid === 'claude' ? '5h' : 'D'}
                      </span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 400,
                          color: currentQuota.dailyPercent === 0 ? '#ef4444' : currentQuota.dailyPercent <= 15 ? '#f97316' : (isEffectiveDark ? '#ffffff' : themeTokens.textPrimary),
                          fontFamily: 'Poppins, -apple-system, sans-serif',
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {currentQuota.dailyPercent}%
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                      <span
                        style={{
                          fontSize: 8,
                          fontWeight: 400,
                          color: accentColor,
                          fontFamily: 'Poppins, -apple-system, sans-serif',
                        }}
                        title={pid === 'claude' ? 'Semanal (7 dias)' : 'Semanal'}
                      >
                        S
                      </span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 400,
                          color: currentQuota.weeklyPercent === 0 ? '#ef4444' : (pid === 'claude' && claudeDaily?.exceeded) ? '#f59e0b' : currentQuota.weeklyPercent <= 15 ? '#f97316' : (isEffectiveDark ? '#ffffff' : themeTokens.textPrimary),
                          fontFamily: 'Poppins, -apple-system, sans-serif',
                          letterSpacing: '-0.02em',
                        }}
                      >
                        {currentQuota.weeklyPercent}%
                      </span>
                    </div>
                  </div>

                  {/* Ícone da IA */}
                  <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {renderAiIcon(pid, 17, undefined, !!aiUpdatesAvailable[pid]?.hasUpdate)}
                  </div>

                  {/* Header Quota Tooltip Popup */}
                  {headerQuotaTooltipOpen && quotaTooltipProvider === pid && (
                    <div
                      ref={clampPopupToViewport}
                      onClick={(e) => e.stopPropagation()}
                      onMouseEnter={cancelHeaderQuotaClose}
                      onMouseLeave={closeHeaderQuotaWithGrace}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 4px)',
                        right: 0,
                        background: isEffectiveDark ? '#1a1a1c' : themeTokens.bgCardSecondary,
                        border: 'none',
                        boxShadow: 'none',
                        borderRadius: 8,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        zIndex: 999999,
                        minWidth: 295,
                        width: 'max-content',
                        maxWidth: 340,
                        boxSizing: 'border-box',
                        pointerEvents: 'auto',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {/* Transparent Hover Bridge connecting trigger to popup */}
                      <div
                        style={{
                          position: 'absolute',
                          top: -12,
                          left: -12,
                          right: -12,
                          height: 16,
                          pointerEvents: 'auto',
                        }}
                      />
                      {/* Header */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                          paddingBottom: 8,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          {pid === 'claude' && <ClaudeIcon size={15} />}
                          {pid === 'antigravity' && <AntigravityIcon size={15} />}
                          {pid === 'codex' && <CodexIcon size={15} />}
                          {pid === 'gemini' && <GeminiIcon size={15} />}
                          {pid === 'ollama' && <OllamaIcon size={15} />}
                          <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary, fontFamily: 'Poppins, sans-serif' }}>
                            {AI_PROVIDERS.find((p) => p.id === pid)?.name || 'IA'}
                          </span>
                        </div>
                      </div>

                      {/* Quotas: título curto à esquerda, barra à direita, divisórias entre as categorias */}
                      {(() => {
                        const short = (t?: string) => { const m = /\(em ([^)]+)\)/.exec(t || ''); return m ? `reseta em ${m[1]}` : (t || '').slice(0, 28); };
                        const tone = (pct: number) => (pct <= 0 ? '#ef4444' : pct <= 15 ? '#f97316' : accentColor);
                        const track = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
                        const row = (label: string, sub: string, pct: number, value: string, color: string, valueColor?: string, used?: string, extra?: React.ReactNode) => (
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, fontFamily: 'Poppins, sans-serif' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>{label}</span>
                                {extra}
                              </div>
                              <span style={{ fontSize: 10, color: themeTokens.textSecondary, whiteSpace: 'nowrap', fontWeight: 400 }}>{sub}</span>
                            </div>
                            <div style={{ width: 118, flexShrink: 0, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
                              <span style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                                {used && <span style={{ fontSize: 10, fontWeight: 400, color: themeTokens.textSecondary }}>{used}</span>}
                                <span style={{ fontSize: 11.5, fontWeight: 400, color: valueColor || themeTokens.textPrimary }}>{value}</span>
                              </span>
                              <div style={{ width: '100%', height: 6, background: track, borderRadius: 999, overflow: 'hidden' }}>
                                <div style={{ width: `${Math.min(100, Math.max(0, pct))}%`, height: '100%', borderRadius: 999, background: `linear-gradient(90deg, ${hexToRgba(color, 0.7)}, ${color})`, boxShadow: 'none', transition: 'width 0.3s ease' }} />
                              </div>
                            </div>
                          </div>
                        );
                        const divider = <div style={{ height: 1, width: '100%', flexShrink: 0, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }} />;
                        return (
                          <>
                            {row(pid === 'claude' ? 'Sessão 5h' : 'Diário', short(currentQuota.dailyResetTime), currentQuota.dailyPercent, `${currentQuota.dailyPercent}%`, tone(currentQuota.dailyPercent))}
                            {divider}
                            {row(pid === 'claude' ? 'Semana' : 'Semanal', short(currentQuota.weeklyResetTime), currentQuota.weeklyPercent, `${currentQuota.weeklyPercent}%`, tone(currentQuota.weeklyPercent))}
                            {pid === 'claude' && claudeDaily && (
                              <>
                                {divider}
                                {(() => {
                                  // 0 a 100: quanto do limite de hoje ainda resta; o dia reinicia à meia-noite
                                  const left = claudeDaily.budget > 0 ? Math.max(0, Math.min(100, Math.round((claudeDaily.remaining / claudeDaily.budget) * 100))) : 0;
                                  const nowD = new Date();
                                  const ms = new Date(nowD.getFullYear(), nowD.getMonth(), nowD.getDate() + 1).getTime() - nowD.getTime();
                                  const h = Math.floor(ms / 3600000);
                                  const m = Math.floor((ms % 3600000) / 60000);
                                  const points = Math.max(0, claudeDaily.remaining).toFixed(1);
                                  return row(
                                    'Hoje',
                                    `reseta em ${h > 0 ? `${h}h ` : ''}${m}min`,
                                    left,
                                    `${points} pts`,
                                    claudeDaily.exceeded ? '#f59e0b' : tone(left),
                                    claudeDaily.exceeded ? '#f59e0b' : undefined,
                                    undefined,
                                    <DailyBudgetInfoTooltip
                                      claudeDaily={claudeDaily}
                                      isEffectiveDark={isEffectiveDark}
                                      accentColor={accentColor}
                                      themeTokens={themeTokens}
                                      clampPopupToViewport={clampPopupToViewport}
                                    />
                                  );
                                })()}
                              </>
                            )}
                          </>
                        );
                      })()}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Header AI Selector Button & Dropdown */}
            <div style={{ position: 'relative' }} ref={headerAiMenuRef}>
            <div
              onClick={() => {
                setIsHeaderAiMenuOpen((prev) => {
                  const next = !prev;
                  if (next) setHeaderAiSubmenuProvider(selectedAiProvider);
                  else setHeaderAiSubmenuProvider(null);
                  return next;
                });
              }}
              style={{
                width: 18,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                borderRadius: 4,
                transition: 'all 0.15s ease',
                background: isHeaderAiMenuOpen ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)') : 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!isHeaderAiMenuOpen) {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isHeaderAiMenuOpen) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setIsAiGlobalRulesModalOpen(true);
              }}
              title="Escolher IA e modelo · fixe com o alfinete para acompanhar o uso"
            >
              <ChevronDown size={14} color={themeTokens.textSecondary} style={{ transform: isHeaderAiMenuOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </div>

            {/* Header AI Dropdown Menu */}
            {isHeaderAiMenuOpen && (
              <>
                <div
                  style={{
                    position: 'fixed',
                    inset: 0,
                    zIndex: 999998,
                    background: 'transparent',
                    cursor: 'default',
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsHeaderAiMenuOpen(false);
                    setHeaderAiSubmenuProvider(null);
                    setHeaderAiVersionMenuModel(null);
                  }}
                  onContextMenu={(e) => {
                    e.preventDefault();
                    setIsHeaderAiMenuOpen(false);
                    setHeaderAiSubmenuProvider(null);
                    setHeaderAiVersionMenuModel(null);
                  }}
                />
                <div
                  ref={clampPopupToViewport}
                style={{
                  position: 'absolute',
                  top: 32,
                  right: 0,
                  background: isEffectiveDark ? '#1a1a1c' : themeTokens.bgCardSecondary,
                  borderRadius: 10,
                  border: `1px solid ${themeTokens.border}`,
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
                  padding: '6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 2,
                  zIndex: 999999,
                  minWidth: 265,
                  userSelect: 'none',
                }}>
                <div style={{ padding: '6px 8px 6px', fontSize: 10.5, fontWeight: 500, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>
                  Selecionar IA & Modelo
                </div>
                {AI_PROVIDERS.map((p) => {
                  const isInstalled = installedClis[p.id] ?? true;
                  const isSelected = selectedAiProvider === p.id;
                  const isSubmenuOpen = headerAiSubmenuProvider === p.id;
                  const dynamicList = activeModels[p.id]?.models || [];
                  const fallbackList = (p.models || []).map((mName) => ({
                    id: mName,
                    label: mName,
                  }));
                  const modelList = dynamicList.length > 0 ? dynamicList : fallbackList;
                  const currentModelName = activeModels[p.id]?.currentModel || (isSelected ? selectedModel : p.models?.[0]);
                  const pQuota = aiQuotas[p.id] || DEFAULT_AI_QUOTAS[p.id] || { dailyPercent: 100, weeklyPercent: 100 };

                  return (
                    <div
                      key={p.id}
                      onClick={() => {
                        if (!isInstalled) {
                          handleInstallCliInTerminal(p);
                          return;
                        }
                        handleSwitchAiProvider(p.id);
                        if (modelList.length > 0) {
                          setHeaderAiSubmenuProvider(p.id);
                        } else {
                          setIsHeaderAiMenuOpen(false);
                          setHeaderAiSubmenuProvider(null);
                        }
                      }}
                      onMouseEnter={() => {
                        if (isInstalled && modelList.length > 0) {
                          setHeaderAiSubmenuProvider(p.id);
                        }
                      }}
                      style={{
                        padding: '7px 10px',
                        color: themeTokens.textPrimary,
                        fontSize: 12,
                        fontFamily: 'Poppins, sans-serif',
                        fontWeight: isSelected ? '600' : '400',
                        cursor: 'pointer',
                        borderRadius: 6,
                        whiteSpace: 'nowrap',
                        background: isSelected
                          ? hexToRgba(accentColor, 0.16)
                          : isSubmenuOpen
                          ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')
                          : 'transparent',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: 8,
                        opacity: isInstalled ? 1 : 0.75,
                        transition: 'background 0.12s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                        {/* Porcentagem de uso à esquerda do ícone */}
                        <div
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'flex-end',
                            justifyContent: 'center',
                            lineHeight: 1.05,
                            flexShrink: 0,
                            minWidth: 32,
                            userSelect: 'none',
                          }}
                          title={`Disponível: ${pQuota.dailyPercent}% diário · ${pQuota.weeklyPercent}% semanal`}
                        >
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                            <span style={{ fontSize: 7.5, fontWeight: 700, color: accentColor }}>D</span>
                            <span
                              style={{
                                fontSize: 8.5,
                                fontWeight: 600,
                                color: pQuota.dailyPercent === 0 ? '#ef4444' : pQuota.dailyPercent <= 15 ? '#f97316' : (isEffectiveDark ? '#ffffff' : themeTokens.textPrimary),
                                letterSpacing: '-0.02em',
                              }}
                            >
                              {pQuota.dailyPercent}%
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
                            <span style={{ fontSize: 7.5, fontWeight: 700, color: accentColor }}>S</span>
                            <span
                              style={{
                                fontSize: 8.5,
                                fontWeight: 600,
                                color: pQuota.weeklyPercent === 0 ? '#ef4444' : pQuota.weeklyPercent <= 15 ? '#f97316' : (isEffectiveDark ? '#ffffff' : themeTokens.textPrimary),
                                letterSpacing: '-0.02em',
                              }}
                            >
                              {pQuota.weeklyPercent}%
                            </span>
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                          {renderAiIcon(p.id, 16, undefined, !!aiUpdatesAvailable[p.id]?.hasUpdate)}
                        </div>
                        <span style={{ color: isSelected ? accentColor : themeTokens.textPrimary }}>{p.name}</span>
                        {isSelected && currentModelName && (
                          <span style={{ fontSize: 11, color: themeTokens.textSecondary, opacity: 0.75, maxWidth: 90, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            • {currentModelName}
                          </span>
                        )}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                        {isInstalled && (
                          <>
                            {aiUpdatesAvailable[p.id]?.hasUpdate && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUpdateCliInTerminal(p.id);
                                }}
                                title={`Atualizar ${p.name} para v${aiUpdatesAvailable[p.id]?.latestVersion || 'nova versão'}`}
                                style={{
                                  fontSize: 10,
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  background: accentColor,
                                  border: 'none',
                                  boxShadow: 'none',
                                  color: '#ffffff',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  cursor: 'pointer',
                                  fontWeight: 400,
                                  transition: 'opacity 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                              >
                                <ArrowUpCircle size={11} strokeWidth={2} />
                                <span>Atualizar</span>
                              </button>
                            )}
                            <span
                              onClick={(e) => { e.stopPropagation(); togglePinnedAi(p.id); }}
                              title={pinnedAis.includes(p.id) ? 'Desafixar do cabeçalho' : 'Fixar no cabeçalho para acompanhar o uso'}
                              style={{ display: 'flex', cursor: 'pointer', padding: 2, borderRadius: 4, opacity: pinnedAis.includes(p.id) ? 1 : 0.55 }}
                            >
                              {pinnedAis.includes(p.id) ? <Pin size={12} color={accentColor} fill={accentColor} /> : <Pin size={12} color={themeTokens.textSecondary} />}
                            </span>
                            {isSelected && (
                              <Check size={13} color={accentColor} />
                            )}
                            {modelList.length > 0 && (
                              <ChevronRight size={13} color={themeTokens.textSecondary} />
                            )}
                          </>
                        )}

                        {!isInstalled && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleInstallCliInTerminal(p);
                            }}
                            title={`Instalar no terminal (${p.installGuide})`}
                            style={{
                              fontSize: 10,
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: accentColor,
                              border: 'none',
                              color: '#fff',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              cursor: 'pointer',
                              fontWeight: 500,
                            }}
                          >
                            <SquareTerminal size={10} />
                            <span>Instalar</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Submenu de Modelos ancorado à esquerda do menu de IA do header */}
                {(() => {
                  if (!headerAiSubmenuProvider) return null;
                  const targetProvider = AI_PROVIDERS.find((p) => p.id === headerAiSubmenuProvider);
                  if (!targetProvider) return null;
                  const isTargetInstalled = installedClis[targetProvider.id] ?? true;
                  if (!isTargetInstalled) return null;

                  const dynamicList = activeModels[targetProvider.id]?.models || [];
                  const fallbackList = (targetProvider.models || []).map((mName) => ({
                    id: mName,
                    label: mName,
                  }));
                  const modelList = dynamicList.length > 0 ? dynamicList : fallbackList;
                  if (modelList.length === 0) return null;

                  const currentId = activeModels[targetProvider.id]?.currentModelId;
                  const currentLabel = activeModels[targetProvider.id]?.currentModel;

                  if (targetProvider.id === 'antigravity') {
                    // Agrupa os modelos do Antigravity por modelo base (ex: Gemini 3.8 Flash, Gemini 3.7 Flash, etc.)
                    const groups: {
                      baseName: string;
                      badge?: string;
                      versions: {
                        id: string;
                        versionLabel: string;
                        rawLabel: string;
                        tag?: string;
                        originalItem: { id: string; label: string; tag?: string };
                      }[];
                    }[] = [];

                    for (const m of modelList) {
                      let versionLabel = 'Padrão';
                      let baseName = m.label;

                      if (m.id.endsWith('-high') || m.label.toLowerCase().includes('(high)')) {
                        versionLabel = 'High';
                        baseName = m.label.replace(/\s*\(high\)/i, '').trim();
                      } else if (m.id.endsWith('-medium') || m.label.toLowerCase().includes('(medium)')) {
                        versionLabel = 'Medium';
                        baseName = m.label.replace(/\s*\(medium\)/i, '').trim();
                      } else if (m.id.endsWith('-low') || m.label.toLowerCase().includes('(low)')) {
                        versionLabel = 'Low';
                        baseName = m.label.replace(/\s*\(low\)/i, '').trim();
                      } else if (m.id.includes('thinking') || m.label.toLowerCase().includes('(thinking)')) {
                        versionLabel = 'Thinking';
                        baseName = m.label.replace(/\s*\(thinking\)/i, '').trim();
                      }

                      let existing = groups.find((g) => g.baseName.toLowerCase() === baseName.toLowerCase());
                      if (!existing) {
                        existing = {
                          baseName,
                          badge: baseName.toLowerCase().includes('flash') ? 'Fast' : undefined,
                          versions: [],
                        };
                        groups.push(existing);
                      }

                      existing.versions.push({
                        id: m.id,
                        versionLabel,
                        rawLabel: m.label,
                        tag: m.tag,
                        originalItem: m,
                      });
                    }

                    // Ordena versões: High -> Medium -> Low -> Thinking
                    const versionOrder: Record<string, number> = { High: 1, Medium: 2, Low: 3, Thinking: 4 };
                    for (const g of groups) {
                      g.versions.sort((a, b) => (versionOrder[a.versionLabel] || 99) - (versionOrder[b.versionLabel] || 99));
                    }

                    const activeVersionGroup = groups.find((g) => g.baseName === headerAiVersionMenuModel);

                    return (
                      <div
                        style={{
                          position: 'absolute',
                          right: 'calc(100% + 4px)',
                          top: 0,
                          zIndex: 1000000,
                        }}
                        onMouseLeave={() => setHeaderAiVersionMenuModel(null)}
                      >
                        {/* 3º Popup: Mostra APENAS as versões (High, Medium, Low) do modelo selecionado pela seta */}
                        {activeVersionGroup && activeVersionGroup.versions.length > 0 && (
                          <div
                            style={{
                              position: 'absolute',
                              right: 'calc(100% + 4px)',
                              top: Math.min(headerAiVersionMenuTop, 220),
                              background: isEffectiveDark ? '#1a1a1c' : themeTokens.bgCardSecondary,
                              borderRadius: 10,
                              border: `1px solid ${themeTokens.border}`,
                              boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
                              padding: 6,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                              zIndex: 1000002,
                              minWidth: 110,
                              userSelect: 'none',
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Ponte invisível que conecta o popup de versões ao submenu de modelos */}
                            <div
                              style={{
                                position: 'absolute',
                                top: -10,
                                bottom: -10,
                                right: -14,
                                width: 20,
                                background: 'transparent',
                                pointerEvents: 'auto',
                              }}
                            />
                            {activeVersionGroup.versions.map((v) => {
                              const isCurrent =
                                targetProvider.id === selectedAiProvider &&
                                (currentId === v.id ||
                                  currentLabel === v.rawLabel ||
                                  selectedModel === v.id ||
                                  selectedModel === v.rawLabel);

                              return (
                                <div
                                  key={v.id}
                                  onClick={() => {
                                    handleSelectModel(v.originalItem, targetProvider.id);
                                    setIsHeaderAiMenuOpen(false);
                                    setHeaderAiSubmenuProvider(null);
                                    setHeaderAiVersionMenuModel(null);
                                  }}
                                  style={{
                                    padding: '6px 12px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    background: isCurrent ? hexToRgba(accentColor, 0.16) : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 12,
                                    transition: 'background 0.12s ease',
                                    whiteSpace: 'nowrap',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isCurrent) {
                                      e.currentTarget.style.background = isEffectiveDark
                                        ? 'rgba(255, 255, 255, 0.06)'
                                        : 'rgba(0, 0, 0, 0.05)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isCurrent) e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 12,
                                      fontFamily: 'Poppins, sans-serif',
                                      fontWeight: isCurrent ? 600 : 400,
                                      color: isCurrent ? accentColor : themeTokens.textPrimary,
                                    }}
                                  >
                                    {v.versionLabel}
                                  </span>
                                  {isCurrent && <Check size={12} color={accentColor} style={{ flexShrink: 0 }} />}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* 2º Popup: Lista de Modelos Antigravity com Seta e Versão */}
                        <div
                          style={{
                            background: isEffectiveDark ? '#1a1a1c' : themeTokens.bgCardSecondary,
                            borderRadius: 10,
                            border: `1px solid ${themeTokens.border}`,
                            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
                            padding: 6,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            minWidth: 265,
                            maxWidth: 320,
                            maxHeight: 'min(420px, calc(100vh - 60px))',
                            overflowY: 'auto',
                            userSelect: 'none',
                          }}
                          className="no-scrollbar"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Ponte invisível que conecta o submenu de modelos ao menu pai */}
                          <div
                            style={{
                              position: 'absolute',
                              top: -10,
                              bottom: -10,
                              right: -14,
                              width: 20,
                              background: 'transparent',
                              pointerEvents: 'auto',
                            }}
                          />
                          <div
                            style={{
                              padding: '3px 8px 5px',
                              fontSize: 10,
                              fontWeight: 600,
                              color: themeTokens.textSecondary,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                              borderBottom: `1px solid ${themeTokens.border}`,
                              marginBottom: 3,
                            }}
                          >
                            Modelos {targetProvider.name}
                          </div>
                          {groups.map((group) => {
                            const isGroupCurrent =
                              targetProvider.id === selectedAiProvider &&
                              group.versions.some(
                                (v) =>
                                  currentId === v.id ||
                                  currentLabel === v.rawLabel ||
                                  selectedModel === v.id ||
                                  selectedModel === v.rawLabel
                              );

                            const activeVersionInGroup = group.versions.find(
                              (v) =>
                                currentId === v.id ||
                                currentLabel === v.rawLabel ||
                                selectedModel === v.id ||
                                selectedModel === v.rawLabel
                            );

                            const displayedVersion =
                              activeVersionInGroup?.versionLabel ||
                              (group.baseName.includes('3.1 Pro')
                                ? 'Low'
                                : group.versions.find((v) => v.versionLabel === 'Medium')?.versionLabel ||
                                  group.versions[0]?.versionLabel);

                            const isVersionMenuOpen = headerAiVersionMenuModel === group.baseName;

                            return (
                              <div
                                key={group.baseName}
                                onMouseEnter={(e) => {
                                  setHeaderAiVersionMenuModel(group.baseName);
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const parent = e.currentTarget.parentElement?.getBoundingClientRect();
                                  if (parent) {
                                    setHeaderAiVersionMenuTop(Math.max(0, rect.top - parent.top));
                                  }
                                }}
                                onClick={() => {
                                  setHeaderAiVersionMenuModel(group.baseName);
                                }}
                                style={{
                                  padding: '7px 10px',
                                  borderRadius: 6,
                                  cursor: 'pointer',
                                  background: isGroupCurrent
                                    ? hexToRgba(accentColor, 0.16)
                                    : isVersionMenuOpen
                                    ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')
                                    : 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  gap: 12,
                                  transition: 'background 0.12s ease',
                                  whiteSpace: 'nowrap',
                                }}
                                onMouseLeave={(e) => {
                                  if (!isGroupCurrent && !isVersionMenuOpen) {
                                    e.currentTarget.style.background = 'transparent';
                                  }
                                }}
                              >
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontFamily: 'Poppins, sans-serif',
                                    fontWeight: isGroupCurrent ? 600 : 400,
                                    color: isGroupCurrent ? accentColor : themeTokens.textPrimary,
                                  }}
                                >
                                  {group.baseName}
                                </span>

                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                                  <span
                                    style={{
                                      fontSize: 11,
                                      fontFamily: 'Poppins, sans-serif',
                                      color: isGroupCurrent ? accentColor : themeTokens.textSecondary,
                                      opacity: isGroupCurrent ? 0.9 : 0.7,
                                    }}
                                  >
                                    {displayedVersion}
                                  </span>

                                  {group.badge && (
                                    <div
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 3,
                                        padding: '1px 5px',
                                        borderRadius: 8,
                                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                                        color: themeTokens.textSecondary,
                                        fontSize: 9.5,
                                        fontFamily: 'Poppins, sans-serif',
                                      }}
                                      title="Modelo otimizado para baixa latência"
                                    >
                                      <span>{group.badge}</span>
                                      <Info size={9.5} style={{ opacity: 0.65 }} />
                                    </div>
                                  )}

                                  <ChevronRight
                                    size={13}
                                    color={isVersionMenuOpen ? themeTokens.textPrimary : themeTokens.textSecondary}
                                    style={{
                                      opacity: 0.7,
                                      transform: isVersionMenuOpen ? 'translateX(2px)' : 'none',
                                      transition: 'transform 0.15s ease',
                                    }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  }

                  // Default behavior for other providers (flat list)
                  return (
                    <div
                      style={{
                        position: 'absolute',
                        right: 'calc(100% + 4px)',
                        top: 0,
                        background: isEffectiveDark ? '#1a1a1c' : themeTokens.bgCardSecondary,
                        borderRadius: 10,
                        border: `1px solid ${themeTokens.border}`,
                        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.65)',
                        padding: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        zIndex: 1000000,
                        minWidth: 170,
                        maxWidth: 260,
                        maxHeight: 'min(420px, calc(100vh - 60px))',
                        overflowY: 'auto',
                      }}
                      className="no-scrollbar"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {/* Ponte invisível que conecta o submenu de modelos ao menu pai */}
                      <div
                        style={{
                          position: 'absolute',
                          top: -10,
                          bottom: -10,
                          right: -14,
                          width: 20,
                          background: 'transparent',
                          pointerEvents: 'auto',
                        }}
                      />
                      <div style={{ padding: '3px 8px 5px', fontSize: 10, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: `1px solid ${themeTokens.border}`, marginBottom: 3 }}>
                        Modelos {targetProvider.name}
                      </div>
                      {modelList.map((m) => {
                        const isCurrent = (targetProvider.id === selectedAiProvider) && (currentId === m.id || currentLabel === m.label || (selectedModel && (selectedModel === m.id || selectedModel === m.label)));

                        return (
                          <div
                            key={m.id}
                            onClick={() => {
                              handleSelectModel(m, targetProvider.id);
                              setIsHeaderAiMenuOpen(false);
                              setHeaderAiSubmenuProvider(null);
                            }}
                            style={{
                              padding: '6px 10px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              background: isCurrent ? hexToRgba(accentColor, 0.16) : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              transition: 'background 0.12s ease',
                              whiteSpace: 'nowrap',
                            }}
                            onMouseEnter={(e) => {
                              if (!isCurrent) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
                            }}
                            onMouseLeave={(e) => {
                              if (!isCurrent) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: isCurrent ? 600 : 400,
                                color: isCurrent ? accentColor : themeTokens.textPrimary,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {m.label}
                            </span>
                            {isCurrent && <Check size={12} color={accentColor} style={{ flexShrink: 0 }} />}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
              </>
            )}
          </div>
        </div>

        {/* Settings Gear Button & Dropdown Menu */}
          <div style={{ position: 'relative' }} ref={settingsMenuRef}>
              <div
                onClick={() => setIsSettingsMenuOpen((prev) => !prev)}
                style={{
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isSettingsMenuOpen ? accentColor : (isEffectiveDark ? '#858585' : themeTokens.textSecondary),
                  cursor: 'pointer',
                  borderRadius: 4,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = isEffectiveDark ? '#ffffff' : themeTokens.textPrimary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = isSettingsMenuOpen ? accentColor : (isEffectiveDark ? '#858585' : themeTokens.textSecondary))}
                title="Settings (⌘,)"
              >
                <Settings size={18} />
              </div>

              {/* Settings Dropdown Menu */}
              {isSettingsMenuOpen && (
                <>
                  <div
                    style={{
                      position: 'fixed',
                      inset: 0,
                      zIndex: 999998,
                      background: 'transparent',
                      cursor: 'default',
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsSettingsMenuOpen(false);
                    }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setIsSettingsMenuOpen(false);
                    }}
                  />
                  <div
                    ref={clampPopupToViewport}
                  style={{
                    position: 'absolute',
                    top: 32,
                    right: 0,
                    background: '#1f1f1f',
                    border: 'none',
                    borderRadius: 6,
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.85)',
                    zIndex: 999999,
                    minWidth: 280,
                    padding: '4px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'fadeIn 0.12s ease-out',
                    userSelect: 'none',
                  }}
                >
                  {/* Configurações */}
                  <div
                    onClick={() => {
                      logSystemActivity('menu_configuracoes', 'abrir_configuracoes', activeHeaderProject?.name || 'Sistema', { tab: 'general' });
                      setSettingsActiveTab('general');
                      setIsSettingsModalOpen(true);
                      setIsSettingsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 12px',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <span>Configurações</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 10, color: '#888888', fontFamily: 'monospace' }}>⌘ ,</span>
                    </div>
                  </div>

                  {/* Temas & Aparência (Cor e Tema) */}
                  <div
                    onClick={() => {
                      logSystemActivity('menu_configuracoes', 'abrir_popup_tema', activeHeaderProject?.name || 'Sistema');
                      openThemePopup();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 12px',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <span>Temas & Aparência (Cor e Tema)</span>
                    <span style={{ fontSize: 10, color: '#888888' }}>
                      {themeMode === 'dark' ? 'Escuro' : themeMode === 'light' ? 'Claro' : 'Sistema'}
                    </span>
                  </div>

                  {/* Alternar Modo Claro / Escuro */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      logSystemActivity('menu_configuracoes', 'alternar_tema', activeHeaderProject?.name || 'Sistema', { proximoTema: isEffectiveDark ? 'light' : 'dark' });
                      handleToggleThemeMode();
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 12px',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span>Alternar Modo Claro / Escuro</span>
                      <span style={{ fontSize: 10, color: '#888888', fontFamily: 'monospace' }}>⌘K ⌘T</span>
                    </div>
                    <div
                      role="switch"
                      aria-checked={isEffectiveDark}
                      title={isEffectiveDark ? 'Escuro' : 'Claro'}
                      style={{
                        width: 30,
                        height: 17,
                        borderRadius: 999,
                        background: isEffectiveDark ? accentColor : 'rgba(255, 255, 255, 0.18)',
                        position: 'relative',
                        flexShrink: 0,
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <div
                        style={{
                          position: 'absolute',
                          top: 2,
                          left: isEffectiveDark ? 15 : 2,
                          width: 13,
                          height: 13,
                          borderRadius: '50%',
                          background: '#ffffff',
                          transition: 'left 0.15s ease',
                          boxShadow: '0 1px 2px rgba(0, 0, 0, 0.4)',
                        }}
                      />
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', margin: '4px 0' }} />

                  {/* Regras Globais da IA */}
                  {(() => {
                    const currentProviderObj = AI_PROVIDERS.find((p) => p.id === selectedAiProvider) || AI_PROVIDERS[0];
                    const providerGlobalFileName =
                      selectedAiProvider === 'claude'
                        ? 'CLAUDE.md'
                        : selectedAiProvider === 'codex'
                        ? 'AGENTS.md'
                        : selectedAiProvider === 'ollama'
                        ? 'rules.md'
                        : 'GEMINI.md';
                    return (
                      <div
                        onClick={() => {
                          logSystemActivity('menu_configuracoes', 'abrir_regras_globais', activeHeaderProject?.name || 'Sistema', { provider: selectedAiProvider });
                          setIsSettingsMenuOpen(false);
                          setIsAiGlobalRulesModalOpen(true);
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '5px 12px',
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 400,
                          color: '#cccccc',
                          transition: 'background 0.08s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = '#04395e';
                          e.currentTarget.style.color = '#ffffff';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                          e.currentTarget.style.color = '#cccccc';
                        }}
                        title={`Regras Globais de ${currentProviderObj.name} (${providerGlobalFileName})`}
                      >
                        <span>Regras Globais da IA</span>
                        <span style={{ fontSize: 9.5, color: '#888888', fontFamily: 'monospace' }}>
                          {providerGlobalFileName}
                        </span>
                      </div>
                    );
                  })()}

                  {/* Skills da IA */}
                  <div
                    onClick={() => {
                      logSystemActivity('menu_configuracoes', 'abrir_skills', activeHeaderProject?.name || 'Sistema', { totalAtivas: activeSkills.length });
                      setIsSettingsMenuOpen(false);
                      setIsSkillsModalOpen(true);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 12px',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 400,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                    title={activeSkills.length ? `Skills ativas: ${activeSkills.map((sk) => sk.name).join(', ')}` : 'Nenhuma skill ativa'}
                  >
                    <span>Skills da IA</span>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 400,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: activeSkills.length ? hexToRgba(accentColor, 0.22) : 'rgba(255, 255, 255, 0.08)',
                        color: activeSkills.length ? accentColor : '#888888',
                      }}
                    >
                      {activeSkills.length} {activeSkills.length === 1 ? 'ativa' : 'ativas'}
                    </span>
                  </div>

                  {/* Configurações de IA */}
                  <div
                    onClick={() => {
                      logSystemActivity('menu_configuracoes', 'abrir_configuracoes_ia', activeHeaderProject?.name || 'Sistema', { tab: 'ai' });
                      setSettingsActiveTab('ai');
                      setIsSettingsModalOpen(true);
                      setIsSettingsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 12px',
                      cursor: 'pointer',
                      fontSize: 11,
                      fontWeight: 400,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <span>Configurações de IA & Agentes</span>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', margin: '4px 0' }} />

                  {/* Configurar Snippets */}
                  <div
                    onClick={() => {
                      logSystemActivity('menu_configuracoes', 'abrir_snippets', activeHeaderProject?.name || 'Sistema', { tab: 'snippets' });
                      setSettingsActiveTab('snippets');
                      setIsSettingsModalOpen(true);
                      setIsSettingsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 12px',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <span>Configurar Snippets</span>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', margin: '4px 0' }} />

                  {/* Tarefas */}
                  <div
                    onClick={() => {
                      logSystemActivity('menu_configuracoes', 'abrir_tarefas', activeHeaderProject?.name || 'Sistema', { tab: 'tasks' });
                      setSettingsActiveTab('tasks');
                      setIsSettingsModalOpen(true);
                      setIsSettingsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 12px',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <span>Tarefas</span>
                  </div>

                  {/* Personalizar Layout */}
                  <div
                    onClick={() => {
                      logSystemActivity('menu_configuracoes', 'personalizar_layout', activeHeaderProject?.name || 'Sistema', { tab: 'layout' });
                      setSettingsActiveTab('layout');
                      setIsSettingsModalOpen(true);
                      setIsSettingsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 12px',
                      cursor: 'pointer',
                      fontSize: 11,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <span>Personalizar Layout</span>
                  </div>
                </div>
                </>
              )}
            </div>

          {/* Notificações (abre a sidebar com a lista e o histórico) */}
          <div
            onClick={() => setIsNotifOpen((v) => !v)}
            style={{ position: 'relative', width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: isNotifOpen ? accentColor : (isEffectiveDark ? '#858585' : themeTokens.textSecondary), cursor: 'pointer', borderRadius: 4, transition: 'all 0.15s ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = isEffectiveDark ? '#ffffff' : themeTokens.textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = isNotifOpen ? accentColor : (isEffectiveDark ? '#858585' : themeTokens.textSecondary))}
            title={notifCenter.unread > 0 ? `Notificações (${notifCenter.unread} novas)` : 'Notificações'}
          >
            <Bell size={18} />
            {notifCenter.unread > 0 && (
              <span style={{ position: 'absolute', top: -5, right: -6, minWidth: 15, height: 15, borderRadius: 8, background: accentColor, color: accentTextColor, fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px', boxSizing: 'border-box' }}>
                {notifCenter.unread > 99 ? '99+' : notifCenter.unread}
              </span>
            )}
          </div>

          {/* Vertical Divider */}
          <div style={{ width: 1, height: 24, background: isEffectiveDark ? '#373737' : 'rgba(0, 0, 0, 0.1)' }} />

          {/* Profile: GitHub name / nick + avatar */}
          <div style={{ position: 'relative' }}>
          <div
            onClick={() => setIsProfileMenuOpen((v) => !v)}
            style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'flex', whiteSpace: 'nowrap', cursor: 'pointer' }}
          >
            <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-end', display: 'inline-flex' }}>
              <div style={{ color: isEffectiveDark ? '#ffffff' : themeTokens.textPrimary, fontSize: 13, fontFamily: 'Poppins', fontWeight: '400', lineHeight: '14px', whiteSpace: 'nowrap' }}>
                {githubUser?.name || githubUser?.login || 'Usuário'}
              </div>
              <div style={{ textAlign: 'right', color: isEffectiveDark ? '#727272' : themeTokens.textSecondary, fontSize: 11, fontFamily: 'Poppins', fontWeight: '500', lineHeight: '15px', whiteSpace: 'nowrap' }}>
                {githubUser?.login ? `@${githubUser.login}` : ''}
              </div>
            </div>
            {/* User Profile Avatar with NO border */}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 9999,
                overflow: 'hidden',
                flexShrink: 0,
                background: isEffectiveDark ? '#1e1e1e' : 'rgba(0, 0, 0, 0.06)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={githubUser?.avatarUrl || avatarImg}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.dataset.triedFallback) {
                    target.dataset.triedFallback = 'true';
                    target.src = avatarImg;
                  }
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 9999,
                  border: 'none',
                  objectFit: 'cover',
                  display: 'block',
                }}
                alt={githubUser?.login || 'Usuário'}
              />
            </div>
          </div>
          {isProfileMenuOpen && (
            <>
              <div onClick={() => setIsProfileMenuOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99998 }} />
              <div style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, minWidth: 170, padding: 6, borderRadius: 10, background: isEffectiveDark ? '#1a1a1c' : '#ffffff', boxShadow: '0 16px 40px rgba(0,0,0,0.6)', zIndex: 99999, fontFamily: 'Poppins, sans-serif' }}>
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    if (githubUser) {
                      let lastLogin: string | null = null;
                      try { lastLogin = localStorage.getItem('devflow_github_last_login'); } catch {}
                      setSignedOutUser({ user: githubUser, lastLogin });
                    }
                    setGithubAuthStatus('unauthenticated');
                  }}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', border: 'none', borderRadius: 6, background: 'transparent', color: themeTokens.textPrimary, fontSize: 12.5, cursor: 'pointer', textAlign: 'left' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <LogOut size={14} />
                  Sair
                </button>
              </div>
            </>
          )}
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. MAIN CONTENT AREA (RESIZABLE COLUMNS & TERMINAL)         */}
      {/* ============================================================ */}
      {/* 2.1 IDE Container (Mantido montado para preservar editores, terminais e chat) */}
      <div
        style={{
          alignSelf: 'stretch',
          flex: '1 1 0',
          justifyContent: 'flex-start',
          alignItems: 'center',
          display: activeTab === 'ide' ? 'inline-flex' : 'none',
          minHeight: 0,
          width: '100%',
        }}
      >
          {/* ---------------------------------------------------- */}
          {/* Activity Bar (Vertical Left Strip)                   */}
          {/* ---------------------------------------------------- */}
          {showActivityBar && !isZenMode && (
            <>
              <div
                style={{
                  alignSelf: 'stretch',
                  width: 48,
                  padding: '10px 0',
                  background: themeTokens.bgCard,
                  borderRadius: 10,
                  border: 'none',
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 6,
                  display: 'inline-flex',
                  flexShrink: 0,
                  order: sidebarPosition === 'right' ? 7 : 1,
                  transition: 'background 0.2s ease',
                  userSelect: 'none',
                }}
              >
                {/* 1. Files / Explorer */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: 'pointer',
                    background: (showExplorer && activeActivityTab === 'explorer')
                      ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                      : 'transparent',
                    color: (showExplorer && activeActivityTab === 'explorer')
                      ? (isEffectiveDark ? '#ffffff' : themeTokens.textPrimary)
                      : (isEffectiveDark ? '#858585' : themeTokens.textSecondary),
                    transition: 'all 0.15s ease',
                  }}
                  title="Explorador de Arquivos (⌘⇧E)"
                  onClick={() => {
                    if (showExplorer && activeActivityTab === 'explorer') {
                      setShowExplorer(false);
                    } else {
                      setActiveActivityTab('explorer');
                      setShowExplorer(true);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!(showExplorer && activeActivityTab === 'explorer')) {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
                      e.currentTarget.style.color = isEffectiveDark ? '#cccccc' : themeTokens.textPrimary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(showExplorer && activeActivityTab === 'explorer')) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = isEffectiveDark ? '#858585' : themeTokens.textSecondary;
                    }
                  }}
                >
                  <CodiconFiles size={22} />
                </div>

                {/* 2. Global Search & Replace */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: 'pointer',
                    background: (showExplorer && activeActivityTab === 'search')
                      ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                      : 'transparent',
                    color: (showExplorer && activeActivityTab === 'search')
                      ? (isEffectiveDark ? '#ffffff' : themeTokens.textPrimary)
                      : (isEffectiveDark ? '#858585' : themeTokens.textSecondary),
                    transition: 'all 0.15s ease',
                  }}
                  title="Buscar em Arquivos (⌘⇧F)"
                  onClick={() => {
                    if (showExplorer && activeActivityTab === 'search') {
                      setShowExplorer(false);
                    } else {
                      setActiveActivityTab('search');
                      setShowExplorer(true);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!(showExplorer && activeActivityTab === 'search')) {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
                      e.currentTarget.style.color = isEffectiveDark ? '#cccccc' : themeTokens.textPrimary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(showExplorer && activeActivityTab === 'search')) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = isEffectiveDark ? '#858585' : themeTokens.textSecondary;
                    }
                  }}
                >
                  <CodiconSearch size={20} />
                </div>

                {/* 3. Source Control / Git */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: 'pointer',
                    background: (showExplorer && activeActivityTab === 'git')
                      ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                      : 'transparent',
                    color: (showExplorer && activeActivityTab === 'git')
                      ? (isEffectiveDark ? '#ffffff' : themeTokens.textPrimary)
                      : (isEffectiveDark ? '#858585' : themeTokens.textSecondary),
                    transition: 'all 0.15s ease',
                  }}
                  title="Controle de Versão / Git (⌃⇧G)"
                  onClick={() => {
                    if (showExplorer && activeActivityTab === 'git') {
                      setShowExplorer(false);
                    } else {
                      setActiveActivityTab('git');
                      setShowExplorer(true);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!(showExplorer && activeActivityTab === 'git')) {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
                      e.currentTarget.style.color = isEffectiveDark ? '#cccccc' : themeTokens.textPrimary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(showExplorer && activeActivityTab === 'git')) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = isEffectiveDark ? '#858585' : themeTokens.textSecondary;
                    }
                  }}
                >
                  <CodiconSourceControl size={22} />
                  {gitModifiedCount > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 4,
                        right: 4,
                        minWidth: 15,
                        height: 15,
                        padding: '0 3.5px',
                        borderRadius: 8,
                        background: accentColor,
                        color: accentTextColor,
                        fontSize: 9.5,
                        fontWeight: 700,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        lineHeight: 1,
                        boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                        pointerEvents: 'none',
                      }}
                    >
                      {gitModifiedCount > 99 ? '99+' : gitModifiedCount}
                    </span>
                  )}
                </div>

                {/* 4. Run and Debug */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: 'pointer',
                    background: (showExplorer && activeActivityTab === 'debug')
                      ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                      : 'transparent',
                    color: (showExplorer && activeActivityTab === 'debug')
                      ? (isEffectiveDark ? '#ffffff' : themeTokens.textPrimary)
                      : (isEffectiveDark ? '#858585' : themeTokens.textSecondary),
                    transition: 'all 0.15s ease',
                  }}
                  title="Executar e Depurar (⌘⇧D)"
                  onClick={() => {
                    if (showExplorer && activeActivityTab === 'debug') {
                      setShowExplorer(false);
                    } else {
                      setActiveActivityTab('debug');
                      setShowExplorer(true);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!(showExplorer && activeActivityTab === 'debug')) {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
                      e.currentTarget.style.color = isEffectiveDark ? '#cccccc' : themeTokens.textPrimary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(showExplorer && activeActivityTab === 'debug')) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = isEffectiveDark ? '#858585' : themeTokens.textSecondary;
                    }
                  }}
                >
                  <CodiconDebugAlt size={22} />
                </div>

                {/* 5. Web Preview & Ports / Remote Explorer */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: 'pointer',
                    background: (showExplorer && activeActivityTab === 'preview')
                      ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                      : 'transparent',
                    color: (showExplorer && activeActivityTab === 'preview')
                      ? (isEffectiveDark ? '#ffffff' : themeTokens.textPrimary)
                      : (isEffectiveDark ? '#858585' : themeTokens.textSecondary),
                    transition: 'all 0.15s ease',
                  }}
                  title="Web Preview, Portas & Remote Explorer"
                  onClick={() => {
                    if (showExplorer && activeActivityTab === 'preview') {
                      setShowExplorer(false);
                    } else {
                      setActiveActivityTab('preview');
                      setShowExplorer(true);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!(showExplorer && activeActivityTab === 'preview')) {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
                      e.currentTarget.style.color = isEffectiveDark ? '#cccccc' : themeTokens.textPrimary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(showExplorer && activeActivityTab === 'preview')) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = isEffectiveDark ? '#858585' : themeTokens.textSecondary;
                    }
                  }}
                >
                  <CodiconRemoteExplorer size={22} />
                </div>

                {/* 7. Testing (VS Code & Antigravity Beaker) */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: 'pointer',
                    background: (showExplorer && activeActivityTab === 'testing')
                      ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                      : 'transparent',
                    color: (showExplorer && activeActivityTab === 'testing')
                      ? (isEffectiveDark ? '#ffffff' : themeTokens.textPrimary)
                      : (isEffectiveDark ? '#858585' : themeTokens.textSecondary),
                    transition: 'all 0.15s ease',
                  }}
                  title="Testes & Validação (Test Explorer)"
                  onClick={() => {
                    if (showExplorer && activeActivityTab === 'testing') {
                      setShowExplorer(false);
                    } else {
                      setActiveActivityTab('testing');
                      setShowExplorer(true);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (!(showExplorer && activeActivityTab === 'testing')) {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
                      e.currentTarget.style.color = isEffectiveDark ? '#cccccc' : themeTokens.textPrimary;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!(showExplorer && activeActivityTab === 'testing')) {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = isEffectiveDark ? '#858585' : themeTokens.textSecondary;
                    }
                  }}
                >
                  <CodiconBeaker size={20} />
                </div>

                {/* Settings Gear (Pinned to Bottom) */}
                <div
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    position: 'relative',
                    cursor: 'pointer',
                    color: isEffectiveDark ? '#858585' : themeTokens.textSecondary,
                    marginTop: 'auto',
                    transition: 'all 0.15s ease',
                  }}
                  title="Configurações (⌘,)"
                  onClick={() => setIsSettingsModalOpen(true)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
                    e.currentTarget.style.color = isEffectiveDark ? '#ffffff' : themeTokens.textPrimary;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = isEffectiveDark ? '#858585' : themeTokens.textSecondary;
                  }}
                >
                  <CodiconSettingsGear size={22} />
                </div>
              </div>

              {/* 5px Spacing */}
              <div style={{ width: 5, flexShrink: 0, order: sidebarPosition === 'right' ? 6 : 1 }} />
            </>
          )}

          {/* ---------------------------------------------------- */}
          {/* Explorer Column (DRAGGABLE RESIZABLE WIDTH)          */}
          {/* ---------------------------------------------------- */}
          {showExplorer && !isZenMode && (
            <>
              <div
                style={{
                  alignSelf: 'stretch',
                  width: explorerWidth,
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  gap: 5,
                  display: 'inline-flex',
                  flexShrink: 0,
                  transition: isDraggingExplorer ? 'none' : 'width 0.1s ease',
                  overflow: 'hidden',
                  order: sidebarPosition === 'right' ? 5 : 2,
                }}
              >
                {activeActivityTab !== 'explorer' ? (
                  <SidebarPanels
                    previewUrl={previewTabUrl}
                    projects={headerProjectsList}
                    onOpenPreview={(u) => { setPreviewTabUrl(u); setPreviewTabActive(true); }}
                    activeTab={activeActivityTab}
                    workspacePath={workspacePath}
                    themeTokens={themeTokens}
                    isEffectiveDark={isEffectiveDark}
                    accentColor={accentColor}
                    accentTextColor={getContrastTextColor(accentColor)}
                    activeFile={activeTab ? { path: activeTab.path, name: activeTab.name, language: activeTab.language } : null}
                    onOpenFile={(filePath, fileName) => {
                      handleOpenFile(filePath, fileName || filePath.split('/').pop() || 'Arquivo');
                    }}
                    onJumpToLine={(filePath, line) => {
                      handleOpenFile(filePath, filePath.split('/').pop() || 'Arquivo');
                      setTimeout(() => {
                        editorInstanceRef.current?.revealLineInCenter(line);
                        editorInstanceRef.current?.setPosition({ lineNumber: line, column: 1 });
                        editorInstanceRef.current?.focus();
                      }, 150);
                    }}
                    onStartReview={(files, index) => {
                      if (files && files.length > 0) {
                        handleStartReview(files, index || 0);
                      }
                    }}
                    onRunTerminalCommand={(name, cmd) => {
                      handleNewTerminalSession('zsh', name, cmd);
                    }}
                    onToast={(msg) => setToastMessage(msg)}
                    onOpenBranchModal={() => setIsBranchModalOpen(true)}
                    currentBranch={currentBranch}
                    onGenerateCommitMessage={handleGenerateCommitMessage}
                  />
                ) : (
                  <>
                    {/* Top Explorer Card */}
                    <div
                  style={{
                    width: '100%',
                    flex: '1 1 0',
                    padding: 10,
                    background: themeTokens.bgCard,
                    borderRadius: 10,
                    border: '1px solid ' + themeTokens.border,
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 10,
                    display: 'flex',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    transition: 'background 0.2s ease',
                  }}
                >
                  {/* Explorer Title + More */}
                  <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex', whiteSpace: 'nowrap' }}>
                    <div style={{ color: themeTokens.textPrimary, fontSize: 12, fontFamily: 'Poppins', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Explorer</span>
                      <span style={{ color: themeTokens.textMuted, fontSize: 11, fontWeight: 400 }}>
                        ({workspacePath.split('/').pop() || 'Workspace'})
                      </span>
                    </div>
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <div
                        onClick={() => setExplorerMenuOpen(!explorerMenuOpen)}
                        title="Opções do Explorador (Abrir pasta/arquivo...)"
                        style={{ color: explorerMenuOpen ? accentColor : themeTokens.textSecondary, cursor: 'pointer', padding: 2, borderRadius: 3, display: 'flex', alignItems: 'center' }}
                      >
                        <MoreHorizontal size={16} />
                      </div>

                      {/* 3 Dots Popup Menu */}
                      {explorerMenuOpen && (
                        <div
                          ref={(el) => {
                            explorerMenuRef.current = el;
                            clampPopupToViewport(el);
                          }}
                          style={{
                            position: 'absolute',
                            top: 'calc(100% + 4px)',
                            right: 0,
                        width: 195,
                        background: themeTokens.bgCardSecondary,
                        border: '1px solid ' + themeTokens.border,
                        borderRadius: 8,
                        padding: '5px 0',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        zIndex: 99999,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        onClick={handleOpenFolderDialog}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <FolderOpen size={14} color={accentColor} />
                        <span>Abrir Pasta...</span>
                      </div>
                      <div
                        onClick={handleOpenFileDialog}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <FileText size={14} color={accentColor} />
                        <span>Abrir Arquivo...</span>
                      </div>
                      <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />
                      <div
                        onClick={handleCreateNewFile}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textSecondary }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <FilePlus size={14} color={themeTokens.textSecondary} />
                        <span>Novo Arquivo</span>
                      </div>
                      <div
                        onClick={handleCreateNewFolder}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textSecondary }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <FolderPlus size={14} color={themeTokens.textSecondary} />
                        <span>Nova Pasta</span>
                      </div>
                      <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />
                      <div
                        onClick={() => {
                          setExplorerMenuOpen(false);
                          loadWorkspaceTree(workspacePath);
                        }}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textSecondary }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <RefreshCw size={14} color={themeTokens.textSecondary} />
                        <span>Atualizar Explorador</span>
                      </div>
                    </div>
                  )}
                    </div>
                  </div>

                  {/* Dynamic Recursive File Tree */}
                  <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex', gap: 1 }}>
                    {fileTree.map((node) => {
                      const renderTreeItem = (item: ExplorerNode, depth = 0): React.ReactNode => {
                        const isExpanded = expandedFolders.has(item.path);
                        const isDir = item.isDirectory;
                        const ext = (item.extension || item.name.split('.').pop() || '').toLowerCase();
                        const isFileActive = activeFileId === item.path;
                        const isCtxTarget = fileContextMenu?.node.path === item.path;

                        return (
                          <div key={item.path} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div
                              draggable={true}
                              onDragStart={(e) => {
                                const dragData = {
                                  type: 'devflow-item',
                                  path: item.path,
                                  name: item.name,
                                  isDirectory: item.isDirectory,
                                };
                                e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                                e.dataTransfer.setData('text/plain', `@[${item.path}]`);
                                e.dataTransfer.effectAllowed = 'copy';
                              }}
                              onClick={() => {
                                if (isDir) {
                                  setExpandedFolders((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(item.path)) next.delete(item.path);
                                    else next.add(item.path);
                                    return next;
                                  });
                                } else {
                                  handleOpenFile(item.path, item.name);
                                }
                              }}
                              onContextMenu={(e) => handleFileNodeContextMenu(e, item)}
                              style={{
                                width: '100%',
                                paddingLeft: depth * 12 + 2,
                                paddingRight: 6,
                                height: 24,
                                borderRadius: 4,
                                background: isFileActive || isCtxTarget ? hexToRgba(accentColor, 0.12) : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                userSelect: 'none',
                                transition: 'background 0.1s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isFileActive && !isCtxTarget) e.currentTarget.style.background = themeTokens.hoverBg;
                              }}
                              onMouseLeave={(e) => {
                                if (!isFileActive && !isCtxTarget) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              {isDir ? (
                                <>
                                  <div style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeTokens.textSecondary, flexShrink: 0 }}>
                                    {isExpanded ? <ChevronDown size={13} color={accentColor} /> : <ChevronRight size={13} color={themeTokens.textSecondary} />}
                                  </div>
                                  <FolderIcon folderName={item.name} isOpen={isExpanded} size={15} />
                                  <span style={{ color: isExpanded ? themeTokens.textPrimary : themeTokens.textSecondary, fontSize: 12, fontFamily: 'Poppins', fontWeight: 400 }}>
                                    {item.name}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <div style={{ width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 2 }}>
                                    <FileIcon fileName={item.name} size={15} />
                                  </div>
                                  <span
                                    style={{
                                      color: isFileActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                                      fontSize: 12,
                                      fontFamily: 'Poppins',
                                      fontWeight: isFileActive ? 500 : 400,
                                    }}
                                  >
                                    {item.name}
                                  </span>
                                </>
                              )}
                            </div>

                            {isDir && isExpanded && item.children && item.children.length > 0 && (
                              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                                <div
                                  style={{
                                    position: 'absolute',
                                    left: depth * 12 + 9,
                                    top: 0,
                                    bottom: 0,
                                    width: 1,
                                    background: isEffectiveDark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)',
                                    pointerEvents: 'none',
                                  }}
                                />
                                {item.children.map((child) => renderTreeItem(child, depth + 1))}
                              </div>
                            )}
                          </div>
                        );
                      };

                      return renderTreeItem(node, 0);
                    })}
                  </div>
                </div>

                {/* Outline Card (VS Code & Antigravity Style) */}
                <div
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: themeTokens.bgCard,
                    borderRadius: 10,
                    border: 'none',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 8,
                    display: 'flex',
                    flexShrink: 0,
                    transition: 'background 0.2s ease',
                  }}
                >
                  {/* Header */}
                  <div
                    onClick={() => setIsOutlineOpen((prev) => !prev)}
                    style={{
                      alignSelf: 'stretch',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      display: 'inline-flex',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      userSelect: 'none',
                      padding: '2px 0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          transform: isOutlineOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          color: themeTokens.textSecondary,
                        }}
                      >
                        <ChevronRight size={13} />
                      </div>
                      <div style={{ color: themeTokens.textPrimary, fontSize: 12, fontFamily: 'Poppins', fontWeight: 500 }}>
                        Outline
                      </div>
                    </div>
                    {activeFile && documentSymbols.length > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: themeTokens.textSecondary,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                          padding: '1px 6px',
                          borderRadius: 10,
                          fontFamily: 'monospace',
                        }}
                      >
                        {documentSymbols.length}
                      </span>
                    )}
                  </div>

                  {/* Collapsible Content */}
                  {isOutlineOpen && (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Search Filter Input */}
                      {documentSymbols.length > 3 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            gap: 6,
                          }}
                        >
                          <Search size={11} color={themeTokens.textSecondary} />
                          <input
                            type="text"
                            placeholder="Filtrar símbolos..."
                            value={outlineFilter}
                            onChange={(e) => setOutlineFilter(e.target.value)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              outline: 'none',
                              color: themeTokens.textPrimary,
                              fontSize: 11,
                              width: '100%',
                              fontFamily: 'Poppins, sans-serif',
                            }}
                          />
                          {outlineFilter && (
                            <X
                              size={11}
                              color={themeTokens.textSecondary}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setOutlineFilter('')}
                            />
                          )}
                        </div>
                      )}

                      {/* Symbols List */}
                      <div
                        className="no-scrollbar"
                        style={{
                          width: '100%',
                          maxHeight: 180,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        {filteredSymbols.length > 0 ? (
                          filteredSymbols.map((sym, idx) => (
                            <div
                              key={`${sym.name}-${sym.line}-${idx}`}
                              onClick={() => handleSelectOutlineSymbol(sym)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '4px 6px',
                                borderRadius: 5,
                                cursor: 'pointer',
                                fontSize: 11.5,
                                color: themeTokens.textPrimary,
                                transition: 'background 0.1s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              title={`Ir para linha ${sym.line}: ${sym.name} (${sym.kind})`}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden' }}>
                                <span
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 3,
                                    background: hexToRgba(sym.color, 0.15),
                                    color: sym.color,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    fontFamily: 'monospace',
                                  }}
                                >
                                  {sym.badge}
                                </span>
                                <span
                                  style={{
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: 11,
                                    color: themeTokens.textPrimary,
                                  }}
                                >
                                  {sym.name}
                                </span>
                              </div>
                              <span style={{ fontSize: 10, color: themeTokens.textSecondary, fontFamily: 'monospace', flexShrink: 0 }}>
                                :{sym.line}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div style={{ padding: '8px 4px', fontSize: 11, color: themeTokens.textSecondary, textAlign: 'center' }}>
                            {activeFile ? 'Nenhum símbolo detectado' : 'Nenhum arquivo ativo'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Timeline Card (VS Code & Antigravity Style) */}
                <div
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: themeTokens.bgCard,
                    borderRadius: 10,
                    border: 'none',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 8,
                    display: 'flex',
                    flexShrink: 0,
                    transition: 'background 0.2s ease',
                  }}
                >
                  {/* Header */}
                  <div
                    onClick={() => setIsTimelineOpen((prev) => !prev)}
                    style={{
                      alignSelf: 'stretch',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      display: 'inline-flex',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      userSelect: 'none',
                      padding: '2px 0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          transform: isTimelineOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          color: themeTokens.textSecondary,
                        }}
                      >
                        <ChevronRight size={13} />
                      </div>
                      <div style={{ color: themeTokens.textPrimary, fontSize: 12, fontFamily: 'Poppins', fontWeight: 500 }}>
                        Timeline
                      </div>
                    </div>
                    {activeFile && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: themeTokens.textSecondary,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                          padding: '1px 6px',
                          borderRadius: 10,
                          fontFamily: 'monospace',
                        }}
                      >
                        {activeTimelineEntries.length}
                      </span>
                    )}
                  </div>

                  {/* Collapsible Content */}
                  {isTimelineOpen && (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Action Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 2px' }}>
                        <span style={{ fontSize: 10.5, color: themeTokens.textSecondary }}>
                          Histórico local
                        </span>
                        <button
                          onClick={handleTakeTimelineSnapshot}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: accentColor,
                            fontSize: 10.5,
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '2px 4px',
                            borderRadius: 4,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = hexToRgba(accentColor, 0.1))}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          title="Criar snapshot manual deste arquivo"
                        >
                          <Plus size={11} />
                          <span>Snapshot</span>
                        </button>
                      </div>

                      {/* Entries List */}
                      <div
                        className="no-scrollbar"
                        style={{
                          width: '100%',
                          maxHeight: 180,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                          position: 'relative',
                        }}
                      >
                        {activeTimelineEntries.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => {
                              setToastMessage(`${item.label} (${item.time})`);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 8,
                              padding: '5px 6px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              transition: 'background 0.1s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {item.type === 'edit' ? (
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                              ) : item.type === 'save' ? (
                                <Save size={12} color={accentColor} />
                              ) : (
                                <Clock size={12} color={themeTokens.textSecondary} />
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                <span style={{ fontSize: 11, fontWeight: 500, color: themeTokens.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.label}
                                </span>
                                <span style={{ fontSize: 9.5, color: themeTokens.textSecondary, flexShrink: 0 }}>
                                  {item.time}
                                </span>
                              </div>
                              <span style={{ fontSize: 10, color: themeTokens.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.desc}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>

              {/* VS Code Style Vertical Resizer for Explorer */}
              <div
                className={`resizer-col ${isDraggingExplorer ? 'dragging' : ''}`}
                onMouseDown={startResizeExplorer}
                onDoubleClick={() => setExplorerWidth(280)}
                title="Arraste para redimensionar o Explorer (Duplo clique para restaurar)"
                style={{ order: sidebarPosition === 'right' ? 4 : 3 }}
              />
            </>
          )}

          {/* ---------------------------------------------------- */}
          {/* Center Area (Editor Tabs, Code Canvas, Terminal)     */}
          {/* ---------------------------------------------------- */}
          <div
            style={{
              flex: '1 1 0',
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              display: 'inline-flex',
              minWidth: 0,
              order: sidebarPosition === 'right' ? 1 : 4,
            }}
          >
            {/* Editor Tabs Row */}
            <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex', flexShrink: 0 }}>
              {/* Left: Tabs pill container */}
              <div
                style={{
                  height: 38,
                  padding: '4px 5px',
                  background: themeTokens.bgCard,
                  borderRadius: 10,
                  border: '1px solid ' + themeTokens.border,
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 5,
                  display: 'flex',
                  boxSizing: 'border-box',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  overflowX: 'auto',
                  maxWidth: 'calc(100% - 150px)',
                  transition: 'background 0.2s ease',
                }}
              >
                {previewTabUrl && (
                  <div
                    onClick={() => setPreviewTabActive(true)}
                    style={{ height: 28, paddingLeft: 10, paddingRight: 8, borderRadius: 5, background: previewTabActive ? (isEffectiveDark ? '#1c1c1c' : '#e5e7eb') : 'transparent', alignItems: 'center', gap: 6, display: 'flex', cursor: 'pointer', whiteSpace: 'nowrap', flexShrink: 0 }}
                  >
                    <Monitor size={14} color={accentColor} />
                    <div style={{ color: previewTabActive ? themeTokens.textPrimary : themeTokens.textSecondary, fontSize: 12, fontFamily: 'Poppins', fontWeight: previewTabActive ? 500 : 400 }}>
                      Preview {previewTabUrl.replace(/^https?:\/\//, '')}
                    </div>
                    <div
                      onClick={(e) => { e.stopPropagation(); setPreviewTabUrl(null); setPreviewTabActive(false); }}
                      title="Fechar preview"
                      style={{ width: 16, height: 16, borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}
                    >
                      <X size={12} color={themeTokens.textSecondary} />
                    </div>
                  </div>
                )}

                {openFiles.length === 0 && !previewTabUrl ? (
                  <div style={{ padding: '0 10px', color: themeTokens.textSecondary, fontSize: 12 }}>Nenhum arquivo aberto</div>
                ) : (
                  openFiles.map((file, idx) => {
                    const isActive = activeFileId === file.id && !previewTabActive;

                    return (
                      <React.Fragment key={file.id}>
                        {idx > 0 && <div style={{ width: 1, height: 16, background: themeTokens.border }} />}
                        <div
                          draggable={true}
                          onDragStart={(e) => {
                            const dragData = {
                              type: 'devflow-item',
                              path: file.path || file.id,
                              name: file.name,
                              isDirectory: false,
                            };
                            e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                            e.dataTransfer.setData('text/plain', `@[${file.path || file.id}]`);
                            e.dataTransfer.effectAllowed = 'copy';
                          }}
                          onClick={() => { setActiveFileId(file.id); setPreviewTabActive(false); }}
                          style={{
                            height: 28,
                            paddingLeft: 10,
                            paddingRight: 8,
                            borderRadius: 5,
                            border: 'none',
                            background: isActive ? (isEffectiveDark ? '#1c1c1c' : '#e5e7eb') : 'transparent',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 6,
                            display: 'flex',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <FileIcon fileName={file.name} size={14} />
                          <div
                            style={{
                              color: isActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                              fontSize: 12,
                              fontFamily: 'Poppins',
                              fontWeight: isActive ? '500' : '400',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {file.name}
                          </div>
                          {file.isDirty ? (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveActiveFile();
                              }}
                              title="Arquivo modificado (Clique ou Cmd+S para salvar)"
                              style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, display: 'inline-block', margin: '0 2px' }}
                            />
                          ) : null}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloseFile(file.id);
                            }}
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 3,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                          >
                            <X size={12} color={themeTokens.textSecondary} />
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>

              {/* Right: Editor action icons pill */}
              <div
                style={{
                  height: 38,
                  padding: '4px 8px',
                  background: themeTokens.bgCard,
                  borderRadius: 10,
                  border: '1px solid ' + themeTokens.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  display: 'flex',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                  transition: 'background 0.2s ease',
                }}
              >
                {activeFile?.isDirty && (
                  <div
                    onClick={handleSaveActiveFile}
                    title="Salvar Arquivo (Cmd+S)"
                    style={{
                      height: 26,
                      paddingLeft: 8,
                      paddingRight: 8,
                      background: accentColor,
                      borderRadius: 5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      fontSize: 11,
                      color: accentTextColor,
                      fontWeight: 600,
                    }}
                  >
                    <Save size={13} color={accentTextColor} />
                    <span>Salvar</span>
                  </div>
                )}
                {/* 0. Markdown Preview (only for .md/.markdown/.mdx files) */}
                {activeFile && isMarkdownFile(activeFile.name) && (
                  <div
                    onClick={() => setShowMarkdownPreview((prev) => !prev)}
                    style={{
                      width: 26,
                      height: 26,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      borderRadius: 4,
                      background: showMarkdownPreview ? hexToRgba(accentColor, 0.2) : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                    title={showMarkdownPreview ? 'Fechar Pré-visualização' : 'Abrir Pré-visualização ao Lado'}
                  >
                    <Eye size={15} color={showMarkdownPreview ? accentColor : themeTokens.textPrimary} />
                  </div>
                )}

                {/* 1. Split Editor Right / Vertical */}
                <div
                  onClick={() => {
                    if (isEditorSplit && editorSplitOrientation === 'vertical') {
                      setIsEditorSplit(false);
                    } else {
                      setIsEditorSplit(true);
                      setEditorSplitOrientation('vertical');
                      if (!secondaryFileId || secondaryFileId === activeFileId) {
                        const other = openFiles.find((f) => f.id !== activeFileId);
                        setSecondaryFileId(other ? other.id : activeFileId);
                      }
                    }
                  }}
                  style={{
                    width: 26,
                    height: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    borderRadius: 4,
                    background: isEditorSplit && editorSplitOrientation === 'vertical' ? hexToRgba(accentColor, 0.2) : 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                  title={isEditorSplit && editorSplitOrientation === 'vertical' ? 'Fechar Divisão do Editor' : 'Dividir Editor à Direita (Lado a Lado)'}
                >
                  <Columns size={15} color={isEditorSplit && editorSplitOrientation === 'vertical' ? accentColor : themeTokens.textPrimary} />
                </div>

                {/* 2. Split Editor Down / Horizontal */}
                <div
                  onClick={() => {
                    if (isEditorSplit && editorSplitOrientation === 'horizontal') {
                      setIsEditorSplit(false);
                    } else {
                      setIsEditorSplit(true);
                      setEditorSplitOrientation('horizontal');
                      if (!secondaryFileId || secondaryFileId === activeFileId) {
                        const other = openFiles.find((f) => f.id !== activeFileId);
                        setSecondaryFileId(other ? other.id : activeFileId);
                      }
                    }
                  }}
                  style={{
                    width: 26,
                    height: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    borderRadius: 4,
                    background: isEditorSplit && editorSplitOrientation === 'horizontal' ? hexToRgba(accentColor, 0.2) : 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                  title={isEditorSplit && editorSplitOrientation === 'horizontal' ? 'Fechar Divisão do Editor' : 'Dividir Editor Abaixo (Horizontal)'}
                >
                  <SplitSquareVertical size={15} color={isEditorSplit && editorSplitOrientation === 'horizontal' ? accentColor : themeTokens.textPrimary} />
                </div>

                {/* 3. More Actions Dropdown */}
                <div style={{ position: 'relative' }} ref={editorMoreMenuRef}>
                  <div
                    onClick={() => setEditorMoreMenuOpen(!editorMoreMenuOpen)}
                    style={{
                      width: 26,
                      height: 26,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      borderRadius: 4,
                      background: editorMoreMenuOpen ? hexToRgba(accentColor, 0.2) : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                    title="Mais Ações do Editor"
                  >
                    <MoreHorizontal size={15} color={editorMoreMenuOpen ? accentColor : themeTokens.textSecondary} />
                  </div>

                  {editorMoreMenuOpen && (
                    <div
                      ref={clampPopupToViewport}
                      style={{
                        position: 'absolute',
                        top: 32,
                        right: 0,
                        width: 240,
                        background: themeTokens.bgCardElevated,
                        borderRadius: 8,
                        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
                        zIndex: 99999,
                        padding: '5px 0',
                        fontSize: 12,
                        fontFamily: 'Poppins, sans-serif',
                        color: themeTokens.textPrimary,
                        animation: 'fadeIn 0.12s ease-out',
                      }}
                    >
                      <div
                        onClick={handleCloseAllFiles}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <X size={13} color={themeTokens.textSecondary} />
                        <span>Fechar Todos os Editores</span>
                      </div>
                      <div
                        onClick={handleCloseOtherFiles}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <X size={13} color={themeTokens.textSecondary} />
                        <span>Fechar Outros</span>
                      </div>
                      <div
                        onClick={handleCloseSavedFiles}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Save size={13} color={themeTokens.textSecondary} />
                        <span>Fechar Salvos</span>
                      </div>
                      <div
                        onClick={handleReopenClosedFile}
                        style={{
                          padding: '6px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: recentlyClosedFiles.length > 0 ? 'pointer' : 'default',
                          opacity: recentlyClosedFiles.length > 0 ? 1 : 0.4,
                        }}
                        onMouseEnter={(e) => {
                          if (recentlyClosedFiles.length > 0) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                        }}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <RotateCcw size={13} color={themeTokens.textSecondary} />
                        <span>Reabrir Último Fechado</span>
                      </div>

                      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', margin: '4px 0' }} />

                      <div
                        onClick={handleCopyPath}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Copy size={13} color={themeTokens.textSecondary} />
                        <span>Copiar Caminho Absoluto</span>
                      </div>
                      <div
                        onClick={handleCopyRelativePath}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Copy size={13} color={themeTokens.textSecondary} />
                        <span>Copiar Caminho Relativo</span>
                      </div>
                      <div
                        onClick={handleRevealInExplorer}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Folder size={13} color={themeTokens.textSecondary} />
                        <span>Revelar no Explorador</span>
                      </div>

                      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', margin: '4px 0' }} />

                      <div
                        onClick={() => {
                          setEditorWordWrap(!editorWordWrap);
                          setEditorMoreMenuOpen(false);
                        }}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span>Quebra de Linha (Word Wrap)</span>
                        {editorWordWrap && <Check size={13} color={accentColor} />}
                      </div>
                      <div
                        onClick={() => {
                          setEditorMinimap(!editorMinimap);
                          setEditorMoreMenuOpen(false);
                        }}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span>Exibir Mini-mapa</span>
                        {editorMinimap && <Check size={13} color={accentColor} />}
                      </div>
                      <div
                        onClick={handleFormatDocument}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <FileCode size={13} color={themeTokens.textSecondary} />
                        <span>Formatar Documento</span>
                      </div>

                      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', margin: '4px 0' }} />

                      <div
                        onClick={handleAiExplainCurrentFile}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Sparkles size={13} color={accentColor} />
                        <span>Explicar Código com IA</span>
                      </div>
                      <div
                        onClick={handleAiReviewCurrentFile}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Sparkles size={13} color={accentColor} />
                        <span>Revisar com Antigravity IA</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 5px Spacing */}
            <div style={{ height: 5, flexShrink: 0 }} />

            {/* Monaco Code Editor Card */}
            <div
              style={{
                alignSelf: (isCenteredLayout || isZenMode) ? 'center' : 'stretch',
                maxWidth: (isCenteredLayout || isZenMode) ? 960 : '100%',
                width: '100%',
                flex: '1 1 0',
                minHeight: 0,
                padding: 10,
                background: themeTokens.bgCard,
                borderRadius: 10,
                border: '1px solid ' + themeTokens.border,
                position: 'relative',
                overflow: 'hidden',
                transition: 'max-width 0.2s ease, background 0.2s ease',
              }}
            >
              {previewTabActive && previewTabUrl ? (
                <PreviewTabView url={previewTabUrl} onUrlChange={setPreviewTabUrl} themeTokens={themeTokens} isEffectiveDark={isEffectiveDark} accentColor={accentColor} />
              ) : activeReview ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                  {/* Review Toolbar */}
                  <div
                    style={{
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 10px',
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                      borderRadius: 6,
                      marginBottom: 8,
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    {/* Left: Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <Eye size={15} color={accentColor} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: themeTokens.textPrimary }}>
                        Revisão de Código
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        {renderFileIcon(activeReview.files[activeReview.currentIndex]?.name || '')}
                        <span style={{ fontWeight: 600, color: themeTokens.textPrimary }}>
                          {activeReview.files[activeReview.currentIndex]?.name}
                        </span>
                        <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>
                          +{activeReview.files[activeReview.currentIndex]?.additions || 0}
                        </span>
                        <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 600 }}>
                          -{activeReview.files[activeReview.currentIndex]?.deletions || 0}
                        </span>
                      </div>
                    </div>

                    {/* Middle: File Navigation */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => handleReviewNavigate(activeReview.currentIndex - 1)}
                        disabled={activeReview.currentIndex <= 0}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 7px',
                          borderRadius: 4,
                          background: 'transparent',
                          border: 'none',
                          cursor: activeReview.currentIndex > 0 ? 'pointer' : 'default',
                          color: activeReview.currentIndex > 0 ? themeTokens.textPrimary : themeTokens.textSecondary,
                          opacity: activeReview.currentIndex > 0 ? 1 : 0.4,
                          fontSize: 11.5,
                        }}
                        title="Arquivo Anterior"
                      >
                        <ArrowLeft size={13} />
                        <span>Ant</span>
                      </button>
                      <span style={{ fontSize: 11.5, color: themeTokens.textSecondary, fontWeight: 500 }}>
                        {activeReview.currentIndex + 1} de {activeReview.files.length}
                      </span>
                      <button
                        onClick={() => handleReviewNavigate(activeReview.currentIndex + 1)}
                        disabled={activeReview.currentIndex >= activeReview.files.length - 1}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 7px',
                          borderRadius: 4,
                          background: 'transparent',
                          border: 'none',
                          cursor: activeReview.currentIndex < activeReview.files.length - 1 ? 'pointer' : 'default',
                          color: activeReview.currentIndex < activeReview.files.length - 1 ? themeTokens.textPrimary : themeTokens.textSecondary,
                          opacity: activeReview.currentIndex < activeReview.files.length - 1 ? 1 : 0.4,
                          fontSize: 11.5,
                        }}
                        title="Próximo Arquivo"
                      >
                        <span>Próx</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>

                    {/* Right: Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => setActiveReview((prev) => (prev ? { ...prev, isSideBySide: !prev.isSideBySide } : null))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)',
                          border: 'none',
                          color: themeTokens.textPrimary,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                        title={activeReview.isSideBySide ? 'Alternar para visualização inline' : 'Alternar para visualização lado a lado'}
                      >
                        <SplitSquareVertical size={13} />
                        <span>{activeReview.isSideBySide ? 'Lado a lado' : 'Inline'}</span>
                      </button>

                      <button
                        onClick={handleReviewDiscard}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 9px',
                          borderRadius: 4,
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: 11.5,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                        title="Descartar alterações deste arquivo"
                      >
                        <RotateCcw size={12} />
                        <span>Descartar</span>
                      </button>

                      <button
                        onClick={handleReviewAccept}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 10px',
                          borderRadius: 4,
                          background: 'rgba(34, 197, 94, 0.2)',
                          border: 'none',
                          color: '#22c55e',
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title="Aceitar alterações e avançar"
                      >
                        <Check size={13} />
                        <span>Aceitar</span>
                      </button>

                      <button
                        onClick={() => setActiveReview(null)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px',
                          borderRadius: 4,
                          background: 'transparent',
                          border: 'none',
                          color: themeTokens.textSecondary,
                          cursor: 'pointer',
                          marginLeft: 4,
                        }}
                        title="Fechar modo de revisão"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Monaco DiffEditor */}
                  <div style={{ flex: '1 1 0', minHeight: 0, position: 'relative' }}>
                    <DiffEditor
                      height="100%"
                      original={activeReview.originalContent}
                      modified={activeReview.modifiedContent}
                      language={getFileLanguage(activeReview.files[activeReview.currentIndex]?.name || '')}
                      theme={isEffectiveDark ? 'aura-dev-dark' : 'light'}
                      options={{
                        fontSize: editorFontSize,
                        fontFamily: `"${editorFontFamily}", Menlo, monospace`,
                        automaticLayout: true,
                        renderSideBySide: activeReview.isSideBySide,
                        readOnly: false,
                        minimap: { enabled: editorMinimap },
                        lineHeight: Math.round(editorFontSize * editorLineHeight),
                        renderLineHighlight: editorHighlightActiveLine,
                        cursorStyle: editorCursorStyle,
                        cursorBlinking: editorCursorBlinking,
                        guides: { indentation: editorGuides },
                        scrollBeyondLastLine: false,
                      }}
                    />
                  </div>
                </div>
              ) : activeFile && isEditorSplit ? (
                <div style={{ display: 'flex', flexDirection: editorSplitOrientation === 'vertical' ? 'row' : 'column', height: '100%', width: '100%' }}>
                  {/* Pane 1 (Primary) */}
                  <div style={{ flex: `0 0 ${editorSplitRatio}%`, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: 26, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', fontSize: 11, color: themeTokens.textSecondary }}>
                      <span>{activeFile.name}</span>
                      <span style={{ fontSize: 10, color: accentColor }}>Painel 1</span>
                    </div>
                    <div style={{ flex: '1 1 0', minHeight: 0 }}>
                      <Editor
                        height="100%"
                        path={activeFile.path || activeFile.name}
                        language={activeFile.language}
                        value={activeFile.content}
                        theme={isEffectiveDark ? 'aura-dev-dark' : 'light'}
                        onChange={handleEditorChange}
                        onMount={handleEditorMount}
                        options={{
                          fontSize: editorFontSize,
                          fontFamily: `"${editorFontFamily}", Menlo, monospace`,
                          tabSize: editorTabSize,
                          lineNumbers: editorLineNumbers ? 'on' : 'off',
                          wordWrap: editorWordWrap ? 'on' : 'off',
                          renderWhitespace: editorRenderWhitespace ? 'all' : 'none',
                          smoothScrolling: editorSmoothScrolling,
                          bracketPairColorization: { enabled: editorBracketColorization },
                          minimap: { enabled: false },
                          automaticLayout: true,
                          lineHeight: Math.round(editorFontSize * editorLineHeight),
                          cursorStyle: editorCursorStyle,
                          cursorBlinking: editorCursorBlinking,
                          guides: { indentation: editorGuides },
                          autoClosingBrackets: editorAutoClosingBrackets ? 'always' : 'never',
                          renderLineHighlight: editorHighlightActiveLine,
                          folding: editorCodeFolding,
                        }}
                      />
                    </div>
                  </div>

                  {/* Divider */}
                  <div
                    style={{
                      width: editorSplitOrientation === 'vertical' ? 3 : '100%',
                      height: editorSplitOrientation === 'vertical' ? '100%' : 3,
                      background: isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      flexShrink: 0,
                    }}
                  />

                  {/* Pane 2 (Secondary) */}
                  <div style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {(() => {
                      const secFile = openFiles.find((f) => f.id === secondaryFileId) || openFiles.find((f) => f.id !== activeFileId) || activeFile;
                      return (
                        <>
                          <div style={{ height: 26, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', fontSize: 11, color: themeTokens.textSecondary }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{secFile.name}</span>
                              {secFile.isDirty && <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor }} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ display: 'inline-flex', cursor: 'pointer' }} onClick={() => setIsEditorSplit(false)} title="Fechar Painel Dividido">
                                <X size={12} />
                              </span>
                            </div>
                          </div>
                          <div style={{ flex: '1 1 0', minHeight: 0 }}>
                            <Editor
                              height="100%"
                              path={secFile.path || secFile.name}
                              language={secFile.language}
                              value={secFile.content}
                              theme={isEffectiveDark ? 'aura-dev-dark' : 'light'}
                              onChange={(val) => {
                                if (val !== undefined) {
                                  setOpenFiles((prev) => prev.map((f) => (f.id === secFile.id ? { ...f, content: val, isDirty: true } : f)));
                                }
                              }}
                              options={{
                                fontSize: editorFontSize,
                                fontFamily: `"${editorFontFamily}", Menlo, monospace`,
                                tabSize: editorTabSize,
                                lineNumbers: editorLineNumbers ? 'on' : 'off',
                                wordWrap: editorWordWrap ? 'on' : 'off',
                                renderWhitespace: editorRenderWhitespace ? 'all' : 'none',
                                smoothScrolling: editorSmoothScrolling,
                                bracketPairColorization: { enabled: editorBracketColorization },
                                minimap: { enabled: false },
                                automaticLayout: true,
                                lineHeight: Math.round(editorFontSize * editorLineHeight),
                                cursorStyle: editorCursorStyle,
                                cursorBlinking: editorCursorBlinking,
                                guides: { indentation: editorGuides },
                                autoClosingBrackets: editorAutoClosingBrackets ? 'always' : 'never',
                                renderLineHighlight: editorHighlightActiveLine,
                                folding: editorCodeFolding,
                              }}
                            />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ) : activeFile && isMarkdownFile(activeFile.name) && showMarkdownPreview ? (
                <div style={{ display: 'flex', height: '100%', width: '100%' }}>
                  {/* Source (left) */}
                  <div style={{ flex: '0 0 50%', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <Editor
                      height="100%"
                      path={activeFile.path || activeFile.name}
                      language={activeFile.language}
                      value={activeFile.content}
                      theme={isEffectiveDark ? 'aura-dev-dark' : 'light'}
                      onChange={handleEditorChange}
                      onMount={handleEditorMount}
                      options={{
                        fontSize: editorFontSize,
                        fontFamily: `"${editorFontFamily}", Menlo, monospace`,
                        tabSize: editorTabSize,
                        lineNumbers: editorLineNumbers ? 'on' : 'off',
                        wordWrap: editorWordWrap ? 'on' : 'off',
                        renderWhitespace: editorRenderWhitespace ? 'all' : 'none',
                        smoothScrolling: editorSmoothScrolling,
                        bracketPairColorization: { enabled: editorBracketColorization },
                        minimap: { enabled: false },
                        automaticLayout: true,
                        lineHeight: Math.round(editorFontSize * editorLineHeight),
                        cursorStyle: editorCursorStyle,
                        cursorBlinking: editorCursorBlinking,
                        guides: { indentation: editorGuides },
                        autoClosingBrackets: editorAutoClosingBrackets ? 'always' : 'never',
                        renderLineHighlight: editorHighlightActiveLine,
                        folding: editorCodeFolding,
                      }}
                    />
                  </div>

                  {/* Divider */}
                  <div style={{ width: 3, background: isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)', flexShrink: 0 }} />

                  {/* Preview (right) */}
                  <div style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: 26, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 6, background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', fontSize: 11, color: themeTokens.textSecondary, flexShrink: 0 }}>
                      <Eye size={11} color={accentColor} />
                      <span>Pré-visualização</span>
                    </div>
                    <div style={{ flex: '1 1 0', minHeight: 0, overflowY: 'auto', padding: '16px 20px', background: themeTokens.bgCard }}>
                      {renderMarkdownPreview(activeFile.content, {
                        textPrimary: themeTokens.textPrimary,
                        textSecondary: themeTokens.textSecondary,
                        textMuted: themeTokens.textMuted,
                        border: themeTokens.border,
                        accentColor,
                        isEffectiveDark,
                      })}
                    </div>
                  </div>
                </div>
              ) : activeFile ? (
                <Editor
                  height="100%"
                  path={activeFile.path || activeFile.name}
                  language={activeFile.language}
                  value={activeFile.content}
                  theme={isEffectiveDark ? 'aura-dev-dark' : 'light'}
                  onChange={handleEditorChange}
                  onMount={handleEditorMount}
                  options={{
                    fontSize: editorFontSize,
                    fontFamily: `"${editorFontFamily}", Menlo, monospace`,
                    tabSize: editorTabSize,
                    lineNumbers: editorLineNumbers ? 'on' : 'off',
                    wordWrap: editorWordWrap ? 'on' : 'off',
                    renderWhitespace: editorRenderWhitespace ? 'all' : 'none',
                    smoothScrolling: editorSmoothScrolling,
                    bracketPairColorization: { enabled: editorBracketColorization },
                    minimap: { enabled: editorMinimap },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    lineHeight: Math.round(editorFontSize * editorLineHeight),
                    renderLineHighlight: editorHighlightActiveLine,
                    cursorStyle: editorCursorStyle,
                    cursorBlinking: editorCursorBlinking,
                    guides: { indentation: editorGuides },
                    autoClosingBrackets: editorAutoClosingBrackets ? 'always' : 'never',
                    folding: editorCodeFolding,
                    padding: { top: 6, bottom: 6 },
                  }}
                />
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: themeTokens.textSecondary,
                    gap: 12,
                  }}
                >
                  <FileText size={48} color={isEffectiveDark ? '#333333' : '#cccccc'} />
                  <div style={{ fontSize: 14, color: themeTokens.textSecondary }}>Selecione um arquivo no Explorer para editar</div>
                  <button
                    onClick={handleOpenFolderDialog}
                    style={{
                      padding: '8px 16px',
                      background: themeTokens.bgCardSecondary,
                      border: '1px solid ' + themeTokens.border,
                      borderRadius: 6,
                      color: themeTokens.textPrimary,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Abrir Pasta do Projeto
                  </button>
                </div>
              )}
            </div>

            {/* ======================================================= */}
            {/* BOTTOM TERMINAL PANEL (RESIZER + TABS + CONTENT PANES)  */}
            {/* ======================================================= */}
            {!isTerminalCollapsed && (
              <>
                {/* VS Code Style Horizontal Resizer for Terminal Panel */}
                <div
                  className={`resizer-row ${isDraggingTerminal ? 'dragging' : ''}`}
                  onMouseDown={startResizeTerminal}
                  onDoubleClick={() => setTerminalHeight(220)}
                  title="Arraste para redimensionar a altura do Terminal (Duplo clique para restaurar)"
                />

                {/* Terminal Alignment Wrapper based on panelAlignment */}
                <div
                  style={{
                    width: panelAlignment === 'justify' ? '100%' : panelAlignment === 'center' ? 'min(980px, 100%)' : 'min(84%, 100%)',
                    alignSelf: panelAlignment === 'center' ? 'center' : panelAlignment === 'left' ? 'flex-start' : panelAlignment === 'right' ? 'flex-end' : 'stretch',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* ======================================================= */}
                  {/* TERMINAL TABS ROW: FULLY RESPONSIVE & NO TEXT WRAP      */}
                  {/* ======================================================= */}
                  <div
                    style={{
                      alignSelf: 'stretch',
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      display: 'flex',
                      flexShrink: 0,
                      gap: 6,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Left Card: Subtabs with responsive shrink & horizontal scroll */}
                    <div
                      className="no-scrollbar"
                      style={{
                        height: 38,
                        padding: '4px 5px',
                        background: themeTokens.bgCard,
                        borderRadius: 10,
                        border: '1px solid ' + themeTokens.border,
                        justifyContent: 'flex-start',
                        alignItems: 'center',
                        gap: 3,
                        display: 'flex',
                        boxSizing: 'border-box',
                        whiteSpace: 'nowrap',
                        flex: '1 1 auto',
                        minWidth: 0,
                        overflowX: 'auto',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      {(() => {
                        const problemsCount = allProblems.length > 0 ? allProblems.length : (editorErrors + editorWarnings);
                        const tasksCount = gitIssues.length > 0 
                          ? gitIssues.length 
                          : (workspaceGitInfo?.issuesCount !== undefined && workspaceGitInfo.issuesCount > 0 
                              ? workspaceGitInfo.issuesCount 
                              : (isLoadingIssues ? undefined : 0));

                        return [
                          { id: 'problems', label: 'Problems', count: problemsCount > 0 ? problemsCount : undefined },
                          { id: 'output', label: 'Output' },
                          { id: 'debug', label: 'Debug console' },
                          { id: 'terminal', label: 'Terminal' },
                          { id: 'ports', label: 'Ports' },
                          { id: 'tasks', label: 'Tarefas', count: tasksCount },
                        ];
                      })().map((st) => {
                        const isActive = activeTermTab === st.id;
                        return (
                          <div
                            key={st.id}
                            onClick={() => {
                              setActiveTermTab(st.id as any);
                              setIsTerminalCollapsed(false);
                            }}
                            style={{
                              height: 28,
                              paddingLeft: 10,
                              paddingRight: 10,
                              background: isActive ? (isEffectiveDark ? '#2E2E2E' : '#e5e7eb') : 'transparent',
                              borderRadius: 5,
                              border: 'none',
                              justifyContent: 'center',
                              alignItems: 'center',
                              display: 'flex',
                              gap: 6,
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div
                              style={{
                                color: isActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                                fontSize: 12,
                                fontFamily: 'Poppins',
                                fontWeight: isActive ? '500' : '400',
                                lineHeight: '12px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {st.label}
                            </div>
                            {st.count !== undefined && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
                                  fontWeight: '600',
                                  padding: '0.5px 5.5px',
                                  borderRadius: 10,
                                  lineHeight: '13px',
                                  height: 14,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  background: isActive
                                    ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.12)')
                                    : (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
                                  color: isActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                {st.count}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Right Card: Action Controls with identical 38px height, fixed to right edge */}
                    <div
                      style={{
                        height: 38,
                        padding: '4px 6px',
                        background: themeTokens.bgCard,
                        borderRadius: 10,
                        border: '1px solid ' + themeTokens.border,
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: 2,
                        display: 'flex',
                        boxSizing: 'border-box',
                        position: 'relative',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        transition: 'background 0.2s ease',
                      }}
                    >
                      {/* Shell selector dropdown button */}
                      <div
                        onClick={() => setShellDropdownOpen(!shellDropdownOpen)}
                        style={{
                          height: 28,
                          paddingLeft: 8,
                          paddingRight: 8,
                          borderRadius: 5,
                          background: shellDropdownOpen ? (isEffectiveDark ? '#2E2E2E' : '#e5e7eb') : 'transparent',
                          justifyContent: 'flex-start',
                          alignItems: 'center',
                          gap: 6,
                          display: 'flex',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          transition: 'background 0.15s ease',
                        }}
                        title="Selecionar Shell"
                      >
                        <TerminalIcon size={14} color={themeTokens.textPrimary} />
                        <div style={{ color: themeTokens.textPrimary, fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', lineHeight: '12px', whiteSpace: 'nowrap' }}>
                          {terminalShell}
                        </div>
                        <ChevronDown size={12} color={themeTokens.textSecondary} />
                      </div>

                      {/* Shell Dropdown Menu */}
                      {shellDropdownOpen && (
                        <div
                          ref={clampPopupToViewport}
                          style={{
                            position: 'absolute',
                            bottom: 44,
                            right: 120,
                            background: themeTokens.bgCardSecondary,
                            borderRadius: 8,
                            border: '1px solid ' + themeTokens.border,
                            padding: 6,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            zIndex: 99999,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                          }}
                        >
                          {[
                            { label: 'zsh (Padrão)', value: 'zsh' },
                            { label: 'bash', value: 'bash' },
                            { label: 'Claude Code CLI', value: 'claude' },
                            { label: 'Google Antigravity (AGY)', value: 'agy' },
                          ].map((sh) => (
                            <div
                              key={sh.value}
                              onClick={() => {
                                setTerminalShell(sh.value);
                                setShellDropdownOpen(false);
                                setTerminalHistory((prev) => [
                                  ...prev,
                                  `[Iniciando sessão com ${sh.label}...]`,
                                ]);
                              }}
                              style={{
                                padding: '6px 12px',
                                color: terminalShell === sh.value ? accentColor : themeTokens.textPrimary,
                                fontSize: 12,
                                fontFamily: 'Poppins',
                                cursor: 'pointer',
                                borderRadius: 4,
                                whiteSpace: 'nowrap',
                                background: terminalShell === sh.value ? hexToRgba(accentColor, 0.12) : 'transparent',
                              }}
                            >
                              {sh.label}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Separator */}
                      <div style={{ width: 1, height: 16, background: themeTokens.border, margin: '0 2px' }} />

                      {/* New Terminal Session (+) */}
                      <div
                        onClick={() => handleNewTerminalSession()}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: themeTokens.textSecondary,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                        title="Novo Terminal"
                      >
                        <Plus size={14} />
                      </div>

                      {/* Minimize Terminal (-) */}
                      <div
                        onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isEffectiveDark ? themeTokens.textSecondary : '#1f2937',
                          background: isEffectiveDark ? 'transparent' : 'rgba(0, 0, 0, 0.04)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
                          (e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'transparent' : 'rgba(0, 0, 0, 0.04)';
                          (e.currentTarget as HTMLElement).style.color = isEffectiveDark ? themeTokens.textSecondary : '#1f2937';
                        }}
                        title="Recolher Terminal"
                      >
                        <Minus size={14} />
                      </div>

                      {/* Split Terminal ([|]) */}
                      {(() => {
                        const activeSession = ideTerminalSessions.find((s) => s.id === activeSessionId);
                        const isCurrentSplit = !!activeSession?.splitWithId;
                        return (
                          <div
                            onClick={handleToggleSplitActiveSession}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isCurrentSplit ? accentColor : themeTokens.textSecondary,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = isCurrentSplit ? accentColor : themeTokens.textPrimary)}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = isCurrentSplit ? accentColor : themeTokens.textSecondary)}
                            title={isCurrentSplit ? "Desfazer Divisão do Terminal" : "Dividir Terminal (Ctrl+Shift+5)"}
                          >
                            <Columns size={14} />
                          </div>
                        );
                      })()}

                      {/* Clear Output (Trash) */}
                      <div
                        onClick={handleClearTerminal}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: themeTokens.textSecondary,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                        title="Limpar Terminal"
                      >
                        <Trash2 size={14} />
                      </div>

                      {/* Maximize Terminal */}
                      <div
                        onClick={() => {
                          setIsTerminalMaximized(!isTerminalMaximized);
                          setIsTerminalCollapsed(false);
                        }}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isTerminalMaximized ? accentColor : themeTokens.textSecondary,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = isTerminalMaximized ? accentColor : themeTokens.textPrimary)}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = isTerminalMaximized ? accentColor : themeTokens.textSecondary)}
                        title={isTerminalMaximized ? 'Restaurar Tamanho' : 'Maximizar Painel'}
                      >
                        {isTerminalMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      </div>

                      {/* More Options (...) */}
                      <div
                        onClick={() => setMoreOptionsOpen(!moreOptionsOpen)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: moreOptionsOpen ? themeTokens.textPrimary : themeTokens.textSecondary,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = moreOptionsOpen ? themeTokens.textPrimary : themeTokens.textSecondary)}
                        title="Mais Opções"
                      >
                        <MoreHorizontal size={14} />
                      </div>

                      {/* More Options Dropdown Menu */}
                      {moreOptionsOpen && (
                        <div
                          ref={clampPopupToViewport}
                          style={{
                            position: 'absolute',
                            bottom: 44,
                            right: 35,
                            background: themeTokens.bgCardSecondary,
                            borderRadius: 8,
                            border: '1px solid ' + themeTokens.border,
                            padding: 6,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            zIndex: 99999,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                          }}
                        >
                          {[
                            { label: 'Reiniciar Sessão PTY', action: () => handleClearTerminal() },
                            { label: 'Copiar Saída Completa', action: () => navigator.clipboard.writeText(terminalHistory.join('\n')) },
                            { label: 'Executar Verificação de Portas', action: () => setActiveTermTab('ports') },
                          ].map((opt, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                opt.action();
                                setMoreOptionsOpen(false);
                              }}
                              style={{
                                padding: '6px 12px',
                                color: themeTokens.textPrimary,
                                fontSize: 12,
                                fontFamily: 'Poppins',
                                cursor: 'pointer',
                                borderRadius: 4,
                                whiteSpace: 'nowrap',
                              }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                            >
                              {opt.label}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Separator */}
                      <div style={{ width: 1, height: 16, background: themeTokens.border, margin: '0 2px' }} />

                      {/* Close Panel (X) */}
                      <div
                        onClick={() => setIsTerminalCollapsed(true)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isEffectiveDark ? themeTokens.textSecondary : '#1f2937',
                          background: isEffectiveDark ? 'transparent' : 'rgba(0, 0, 0, 0.04)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'rgba(255, 95, 86, 0.15)';
                          (e.currentTarget as HTMLElement).style.color = '#ff5f56';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'transparent' : 'rgba(0, 0, 0, 0.04)';
                          (e.currentTarget as HTMLElement).style.color = isEffectiveDark ? themeTokens.textSecondary : '#1f2937';
                        }}
                        title="Fechar Painel"
                      >
                        <X size={14} />
                      </div>
                    </div>
                  </div>

                {/* ======================================================= */}
                {/* TERMINAL CONTENT PANES (DRAGGABLE RESIZABLE HEIGHT)     */}
                {/* ======================================================= */}
                <div
                style={{
                  alignSelf: 'stretch',
                  height: isTerminalMaximized ? 480 : terminalHeight,
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: 0,
                  display: 'inline-flex',
                  flexShrink: 0,
                  transition: isDraggingTerminal ? 'none' : 'height 0.15s ease',
                  overflow: 'hidden',
                  width: '100%',
                }}
              >
                {/* 1. Terminal View */}
                {activeTermTab === 'terminal' && (
                  <>
                    {/* Dual / Single Terminals Card (Left Card) */}
                    <div
                      ref={splitContainerRef}
                      style={{
                        flex: '1 1 0',
                        alignSelf: 'stretch',
                        padding: '6px 8px',
                        background: themeTokens.bgCard,
                        borderRadius: 10,
                        border: '1px solid ' + themeTokens.border,
                        justifyContent: 'flex-start',
                        alignItems: 'stretch',
                        gap: 0,
                        display: 'flex',
                        overflow: 'hidden',
                        minWidth: 0,
                        position: 'relative',
                        transition: 'background 0.2s ease',
                      }}
                    >
                    {/* Native Xterm Terminals Container (VS Code Multi-pane Split Engine) */}
                    {(() => {
                      const currentActive = ideTerminalSessions.find((s) => s.id === activeSessionId) || ideTerminalSessions[0];
                      const sibling = currentActive?.splitWithId
                        ? ideTerminalSessions.find((s) => s.id === currentActive.splitWithId)
                        : null;

                      let leftSession = currentActive;
                      let rightSession = sibling;

                      if (sibling && currentActive) {
                        const activeIdx = ideTerminalSessions.findIndex((s) => s.id === currentActive.id);
                        const siblingIdx = ideTerminalSessions.findIndex((s) => s.id === sibling.id);
                        if (siblingIdx < activeIdx) {
                          leftSession = sibling;
                          rightSession = currentActive;
                        }
                      }

                      const isSplit = !!rightSession;

                      return (
                        <div
                          ref={splitContainerRef}
                          style={{
                            flex: '1 1 0',
                            minHeight: 0,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'row',
                            overflow: 'hidden',
                            position: 'relative',
                            background: isEffectiveDark ? '#0c0c0c' : '#f8f9fa',
                          }}
                        >
                          {/* Left / Main Terminal Pane */}
                          <div
                            onClick={() => leftSession && setActiveSessionId(leftSession.id)}
                            style={{
                              width: isSplit ? `${terminalSplitRatio}%` : '100%',
                              flex: isSplit ? 'none' : '1 1 0',
                              alignSelf: 'stretch',
                              height: '100%',
                              flexDirection: 'column',
                              justifyContent: 'flex-start',
                              alignItems: 'stretch',
                              display: 'flex',
                              overflow: 'hidden',
                              minWidth: 0,
                              position: 'relative',
                            }}
                          >
                            {allIdeTerminalSessions.map((s) => {
                              if (isSplit && s.id === rightSession?.id) return null;
                              return (
                                <NativeXTerm
                                  key={s.id}
                                  sessionId={s.id}
                                  sessionType={s.type}
                                  cwd={s.projectPath || workspacePath || terminalCwd || '/Users/walancy/Documents/codes/devflow-desktop'}
                                  isActive={s.id === leftSession?.id}
                                  initialCommand={s.initialCommand}
                                  accentColor={accentColor}
                                  isDark={isEffectiveDark}
                                  fontSize={terminalFontSize}
                                  cursorStyle={terminalCursorStyle}
                                  cursorBlink={terminalCursorBlink}
                                  scrollback={terminalScrollback}
                                  copyOnSelect={terminalCopyOnSelect}
                                  fontFamily={terminalFontFamily}
                                  lineHeight={terminalLineHeight}
                                  themePreset={terminalThemePreset}
                                  cursorWidth={terminalCursorWidth}
                                  scrollOnUserInput={terminalScrollOnUserInput}
                                  drawBoldTextInBrightColors={terminalDrawBoldTextInBrightColors}
                                />
                              );
                            })}
                          </div>

                          {/* Right Split Pane (Rendered ONLY when current active terminal is split) */}
                          {isSplit && rightSession && (
                            <>
                              {/* VS Code Style Subtle Splitter Resizer */}
                              <div
                                className={`resizer-col resizer-split-term ${isDraggingSplitPanes ? 'dragging' : ''}`}
                                onMouseDown={startResizeSplitPanes}
                                onDoubleClick={() => {
                                  setTerminalSplitRatio(50);
                                  localStorage.setItem('ide_term_split_ratio', '50');
                                }}
                                title="Arraste para redimensionar terminais divididos (Duplo clique para 50/50)"
                                style={{
                                  width: 6,
                                  margin: '0 -3px',
                                  cursor: 'col-resize',
                                  zIndex: 10,
                                  background: 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <div style={{ width: 1, height: '100%', background: isEffectiveDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)' }} />
                              </div>

                              <div
                                onClick={() => setActiveSessionId(rightSession.id)}
                                style={{
                                  flex: '1 1 0',
                                  alignSelf: 'stretch',
                                  height: '100%',
                                  flexDirection: 'column',
                                  justifyContent: 'flex-start',
                                  alignItems: 'stretch',
                                  display: 'flex',
                                  overflow: 'hidden',
                                  minWidth: 0,
                                  position: 'relative',
                                }}
                              >
                                <NativeXTerm
                                  key={rightSession.id}
                                  sessionId={rightSession.id}
                                  sessionType={rightSession.type}
                                  cwd={rightSession.projectPath || workspacePath || terminalCwd || '/Users/walancy/Documents/codes/devflow-desktop'}
                                  isActive={activeSessionId === rightSession.id}
                                  initialCommand={rightSession.initialCommand}
                                  accentColor={accentColor}
                                  isDark={isEffectiveDark}
                                  fontSize={terminalFontSize}
                                  cursorStyle={terminalCursorStyle}
                                  cursorBlink={terminalCursorBlink}
                                  scrollback={terminalScrollback}
                                  copyOnSelect={terminalCopyOnSelect}
                                  fontFamily={terminalFontFamily}
                                  lineHeight={terminalLineHeight}
                                  themePreset={terminalThemePreset}
                                  cursorWidth={terminalCursorWidth}
                                  scrollOnUserInput={terminalScrollOnUserInput}
                                  drawBoldTextInBrightColors={terminalDrawBoldTextInBrightColors}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                    </div>

                    {/* Interactive Resizer between Terminal Card (Left) and Terminal Tabs Panel (Right) */}
                    <div
                      className={`resizer-col ${isDraggingTermTabs ? 'dragging' : ''}`}
                      onMouseDown={startResizeTermTabs}
                      onDoubleClick={() => {
                        setTerminalTabsWidth(175);
                        localStorage.setItem('ide_term_tabs_width', '175');
                      }}
                      title="Arraste para redimensionar painel de abas (Duplo clique para 175px)"
                    />

                    {/* VS Code Style Terminal Tabs Panel (Right Card) */}
                    <div
                      style={{
                        width: terminalTabsWidth,
                        alignSelf: 'stretch',
                        background: themeTokens.bgCard,
                        borderRadius: 10,
                        border: '1px solid ' + themeTokens.border,
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        alignItems: 'stretch',
                        display: 'inline-flex',
                        flexShrink: 0,
                        position: 'relative',
                        zIndex: 20,
                        transition: isDraggingTermTabs ? 'none' : 'width 0.15s ease',
                      }}
                    >
                      {/* Sessions List */}
                      <div
                        style={{
                          flex: 1,
                          overflowY: 'auto',
                          padding: '4px 0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        {ideTerminalSessions.map((s, index) => {
                          const isActive = s.id === activeSessionId;
                          const isHovered = s.id === hoveredRowId;
                          const hasSibling = !!s.splitWithId;
                          const siblingIndex = hasSibling ? ideTerminalSessions.findIndex((other) => other.id === s.splitWithId) : -1;
                          const isFirstSplit = hasSibling && siblingIndex > index;
                          const isSecondSplit = hasSibling && siblingIndex < index;

                          return (
                            <div
                              key={s.id}
                              onClick={() => setActiveSessionId(s.id)}
                              onMouseEnter={(e) => {
                                setHoveredRowId(s.id);
                                if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                                const currentEl = e.currentTarget;
                                const parentEl = currentEl.parentElement;
                                hoverTimerRef.current = setTimeout(() => {
                                  if (!currentEl || !parentEl) return;
                                  const rect = currentEl.getBoundingClientRect();
                                  const parentRect = parentEl.getBoundingClientRect();
                                  if (parentRect) {
                                    setPopoverTop(rect.top - parentRect.top + 28);
                                  }
                                  setHoveredSessionId(s.id);
                                }, 250);
                              }}
                              onMouseLeave={() => {
                                setHoveredRowId(null);
                                if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                                hoverTimerRef.current = setTimeout(() => {
                                  setHoveredSessionId(null);
                                }, 300);
                              }}
                              style={{
                                width: '100%',
                                height: 26,
                                padding: '0 6px 0 0',
                                background: isActive
                                  ? hexToRgba(accentColor, 0.15)
                                  : isHovered
                                  ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)')
                                  : 'transparent',
                                borderLeft: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                userSelect: 'none',
                                transition: 'background 0.1s ease',
                                position: 'relative',
                              }}
                            >
                              {/* Tree Line Connector for Split Terminals */}
                              {hasSibling && (
                                <div style={{ width: 14, height: 26, position: 'relative', flexShrink: 0, marginLeft: 2 }}>
                                  {isFirstSplit && (
                                    <>
                                      <div style={{ position: 'absolute', top: 13, left: 6, width: 7, height: 1, background: '#606060' }} />
                                      <div style={{ position: 'absolute', top: 13, left: 6, width: 1, height: 13, background: '#606060' }} />
                                    </>
                                  )}
                                  {isSecondSplit && (
                                    <>
                                      <div style={{ position: 'absolute', top: 0, left: 6, width: 1, height: 13, background: '#606060' }} />
                                      <div style={{ position: 'absolute', top: 13, left: 6, width: 7, height: 1, background: '#606060' }} />
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Terminal Icon (SquareTerminal codicon style) */}
                              <div style={{ marginLeft: hasSibling ? 2 : 8, marginRight: 6, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                <SquareTerminal size={14} color={isActive ? accentColor : themeTokens.textSecondary} />
                              </div>

                              {/* Session Name */}
                              <div
                                style={{
                                  color: isActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                                  fontSize: 12,
                                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                  fontWeight: isActive ? 500 : 400,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  flex: 1,
                                }}
                              >
                                {s.name}
                              </div>

                              {/* Quick Actions (Hover visible like VS Code) */}
                              {isHovered && (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    marginLeft: 'auto',
                                    paddingLeft: 4,
                                    flexShrink: 0,
                                  }}
                                >
                                  {/* @ Configure / Shell menu */}
                                  <div
                                    title="Configure Terminal"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNewTerminalSession('zsh');
                                    }}
                                    style={{
                                      cursor: 'pointer',
                                      color: themeTokens.textSecondary,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 1,
                                    }}
                                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                                  >
                                    <AtSign size={12} />
                                  </div>

                                  {/* Split Terminal */}
                                  <div
                                    title="Split Terminal (Ctrl+Shift+5)"
                                    onClick={(e) => handleSplitSession(s.id, e)}
                                    style={{
                                      cursor: 'pointer',
                                      color: themeTokens.textSecondary,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 1,
                                    }}
                                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                                  >
                                    <SplitSquareVertical size={12} />
                                  </div>

                                  {/* Kill Terminal */}
                                  <div
                                    title="Kill Terminal"
                                    onClick={(e) => handleKillTerminalSession(s.id, e)}
                                    style={{
                                      cursor: 'pointer',
                                      color: themeTokens.textSecondary,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 1,
                                    }}
                                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ff5f56')}
                                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                                  >
                                    <Trash2 size={12} />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* VS Code Rich Tooltip Popover (Floating to the left of the sessions list) */}
                      {hoveredSessionId && (() => {
                        const hoveredSession = ideTerminalSessions.find((s) => s.id === hoveredSessionId);
                        if (!hoveredSession) return null;

                        return (
                          <div
                            onMouseEnter={() => {
                              if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                            }}
                            onMouseLeave={() => {
                              setHoveredSessionId(null);
                            }}
                            style={{
                              position: 'absolute',
                              right: 'calc(100% + 12px)',
                              top: Math.max(8, popoverTop - 15),
                              width: 330,
                              background: themeTokens.bgCardSecondary,
                              border: '1px solid ' + themeTokens.border,
                              borderRadius: 5,
                              padding: '12px 14px',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                              zIndex: 99999,
                              color: themeTokens.textPrimary,
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: 12,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 9,
                              pointerEvents: 'auto',
                            }}
                          >
                            {/* Pointer triangle arrow pointing to the terminal tab */}
                            <div
                              style={{
                                position: 'absolute',
                                right: -6,
                                top: 18,
                                width: 0,
                                height: 0,
                                borderTop: '6px solid transparent',
                                borderBottom: '6px solid transparent',
                                borderLeft: '6px solid ' + themeTokens.bgCardSecondary,
                              }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                right: -7,
                                top: 18,
                                width: 0,
                                height: 0,
                                borderTop: '6px solid transparent',
                                borderBottom: '6px solid transparent',
                                borderLeft: '7px solid ' + themeTokens.border,
                                zIndex: -1,
                              }}
                            />

                            {/* Title (e.g. zsh) */}
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: themeTokens.textPrimary }}>
                              {hoveredSession.name}
                            </div>

                            {/* Details: PID & Command line */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: themeTokens.textSecondary, fontSize: 12 }}>
                              <div>
                                <span style={{ color: themeTokens.textPrimary, fontWeight: 500 }}>Process ID (PID): </span>
                                <span>{hoveredSession.pid}</span>
                              </div>
                              <div>
                                <span style={{ color: themeTokens.textPrimary, fontWeight: 500 }}>Command line: </span>
                                <span>{hoveredSession.command}</span>
                              </div>
                            </div>

                            {/* Shell integration: Rich */}
                            <div style={{ color: themeTokens.textPrimary, fontSize: 12 }}>
                              <span style={{ fontWeight: 500 }}>Shell integration: </span>
                              <span style={{ color: themeTokens.textSecondary }}>{hoveredSession.shellIntegration}</span>
                            </div>

                            {/* Bottom Blue Action Links */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 3 }}>
                              <span
                                style={{ color: accentColor, fontSize: 11.5, cursor: 'pointer', textDecoration: 'none' }}
                                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
                                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
                                onClick={() => alert('Environment Contributions: PATH=/Users/walancy/.local/bin:/usr/local/bin:/bin, TERM_PROGRAM=vscode')}
                              >
                                Show Environment Contributions
                              </span>
                              <span
                                style={{ color: accentColor, fontSize: 11.5, cursor: 'pointer', textDecoration: 'none' }}
                                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
                                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
                                onClick={() => alert(`Terminal Details:\nProcess: ${hoveredSession.name} (PID: ${hoveredSession.pid})\nCommand: ${hoveredSession.command}\nIntegration: ${hoveredSession.shellIntegration}`)}
                              >
                                Show Details
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}

                {['problems', 'output', 'debug', 'ports', 'tasks'].includes(activeTermTab) && renderIdeDockTab(activeTermTab)}
              </div>
                </div>
            </>
          )}
        </div>

          {/* ---------------------------------------------------- */}
          {/* Right AI Assistant Panel (DRAGGABLE RESIZABLE WIDTH) */}
          {/* ---------------------------------------------------- */}
          {showAiPanel && !isZenMode && (
            <>
              {/* VS Code Style Vertical Resizer for AI Panel */}
              <div
                className={`resizer-col ${isDraggingAi ? 'dragging' : ''}`}
                onMouseDown={startResizeAiPanel}
                onDoubleClick={() => setAiPanelWidth(340)}
                title="Arraste para redimensionar o Painel de IA (Duplo clique para restaurar)"
                style={{ order: sidebarPosition === 'right' ? 2 : 5 }}
              />

              <div
                style={{
                  width: aiPanelWidth,
                  alignSelf: 'stretch',
                  padding: 12,
                  background: isEffectiveDark
                    ? `radial-gradient(ellipse 120.00% 159.98% at 5.85% 100.00%, ${hexToRgba(chatAccentColor, 0.20)} 0%, #101010 100%)`
                    : `radial-gradient(ellipse 120.00% 159.98% at 5.85% 100.00%, ${hexToRgba(chatAccentColor, 0.22)} 0%, #ffffff 100%)`,
                  borderRadius: 10,
                  border: 'none',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'stretch',
                  gap: 10,
                  display: 'flex',
                  position: 'relative',
                  flexShrink: 0,
                  transition: isDraggingAi ? 'none' : 'width 0.18s ease, background 0.2s ease',
                  overflow: 'visible',
                  zIndex: 40,
                  order: sidebarPosition === 'right' ? 3 : 6,
                }}
              >
                {/* Header: Stacked Icons + AI Logo + Provider Name + Clear History */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, padding: '2px 4px', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {/* Stacked icons of other AIs used in orchestrator or with active chats */}
                    {(() => {
                      const otherProviders = AI_PROVIDERS.filter((p) => {
                        if (p.id === selectedAiProvider) return false;
                        const isOrchestrated = isOrchestratorActive && orchestratedProviders[p.id];
                        const hasChat = chatSessions.some((s) => s.provider === p.id && s.history && s.history.length > 0);
                        return isOrchestrated || hasChat;
                      });

                      return (
                        <div
                          onClick={() => setChatHistoryPopupOpen(!chatHistoryPopupOpen)}
                          title="Sessões & Histórico de Chats"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            padding: '2px 3px',
                            borderRadius: 6,
                            background: chatHistoryPopupOpen ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          {otherProviders.length > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {otherProviders.slice(0, 4).map((p, idx) => (
                                <div
                                  key={p.id}
                                  style={{
                                    width: 19,
                                    height: 19,
                                    borderRadius: '50%',
                                    background: '#1c1c1c',
                                    border: '1.5px solid #101010',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginLeft: idx === 0 ? 0 : -7,
                                    zIndex: 10 - idx,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                                    overflow: 'hidden',
                                  }}
                                  title={`${p.name} (Ativo no Orquestrador / Histórico)`}
                                >
                                  {renderAiIcon(p.id, 12)}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 5,
                                background: 'rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="Histórico de Chats"
                            >
                              <MessageSquare size={11} color={themeTokens.textSecondary} />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Active AI Logo, Name & Model Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {renderAiIcon(selectedAiProvider, 17)}
                      <div style={{ color: themeTokens.textPrimary, fontSize: 13, fontFamily: 'Poppins, sans-serif', fontWeight: '500' }}>
                        {AI_PROVIDERS.find((p) => p.id === selectedAiProvider)?.name || 'Claude'}
                      </div>
                      {(() => {
                        const mInfo = activeModels[selectedAiProvider];
                        const raw = mInfo?.currentModel || mInfo?.currentModelId || (selectedAiProvider === 'claude' ? 'sonnet' : null);
                        const label = formatModelDisplayName(raw);
                        if (!label) return null;
                        return (
                          <div
                            onClick={() => setModelDropdown((prev) => !prev)}
                            title="Modelo ativo. Clique para alterar."
                            style={{
                              fontSize: 10.5,
                              color: chatAccentColor,
                              background: 'transparent',
                              padding: '1px 2px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              maxWidth: 140,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              transition: 'opacity 0.15s ease',
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                          >
                            <span>{label}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }} ref={chatActionsMenuRef}>
                    {/* Back / Forward through recent chat sessions */}
                    <button
                      onClick={handleChatSessionBack}
                      disabled={activeChatSessionNavIndex < 0 || activeChatSessionNavIndex >= orderedChatSessions.length - 1}
                      title="Conversa Anterior"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: themeTokens.textSecondary,
                        cursor: activeChatSessionNavIndex < 0 || activeChatSessionNavIndex >= orderedChatSessions.length - 1 ? 'default' : 'pointer',
                        opacity: activeChatSessionNavIndex < 0 || activeChatSessionNavIndex >= orderedChatSessions.length - 1 ? 0.4 : 1,
                        padding: '4px 4px',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary;
                        (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary;
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <ArrowLeft size={13} />
                    </button>
                    <button
                      onClick={handleChatSessionForward}
                      disabled={activeChatSessionNavIndex <= 0}
                      title="Próxima Conversa"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: themeTokens.textSecondary,
                        cursor: activeChatSessionNavIndex <= 0 ? 'default' : 'pointer',
                        opacity: activeChatSessionNavIndex <= 0 ? 0.4 : 1,
                        padding: '4px 4px',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary;
                        (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary;
                        (e.currentTarget as HTMLElement).style.background = 'transparent';
                      }}
                    >
                      <ArrowRight size={13} />
                    </button>

                    <button
                      onClick={() => setChatActionsMenuOpen((prev) => !prev)}
                      title="Mais opções"
                      style={{
                        background: chatActionsMenuOpen
                          ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')
                          : 'transparent',
                        border: 'none',
                        color: chatActionsMenuOpen ? themeTokens.textPrimary : themeTokens.textSecondary,
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary;
                        (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                      }}
                      onMouseLeave={(e) => {
                        if (!chatActionsMenuOpen) {
                          (e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary;
                          (e.currentTarget as HTMLElement).style.background = 'transparent';
                        }
                      }}
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {chatActionsMenuOpen && (
                      <div
                        ref={clampPopupToViewport}
                        style={{
                          position: 'absolute',
                          top: 'calc(100% + 4px)',
                          right: 0,
                          background: themeTokens.bgCardSecondary,
                          border: `1px solid ${themeTokens.border}`,
                          borderRadius: 8,
                          padding: 4,
                          minWidth: 160,
                          zIndex: 100000,
                          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        <div
                          onClick={() => {
                            setChatActionsMenuOpen(false);
                            handleOpenChatHistoryModal();
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontFamily: 'Poppins, sans-serif',
                            color: themeTokens.textPrimary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <Clock size={13} color={accentColor} />
                            <span>Ver Histórico</span>
                          </div>
                          <span style={{ fontSize: 10, color: themeTokens.textSecondary, opacity: 0.7 }}>⌘⇧H</span>
                        </div>

                        <div
                          onClick={() => {
                            setChatActionsMenuOpen(false);
                            handleSaveCurrentChatLocally();
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontFamily: 'Poppins, sans-serif',
                            color: themeTokens.textPrimary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <Save size={13} color={themeTokens.textSecondary} />
                          <span>Salvar</span>
                        </div>

                        <div
                          onClick={() => {
                            setChatActionsMenuOpen(false);
                            handleExportChat(undefined, 'markdown');
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontFamily: 'Poppins, sans-serif',
                            color: themeTokens.textPrimary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <Download size={13} color={themeTokens.textSecondary} />
                          <span>Exportar Markdown</span>
                        </div>

                        <div
                          onClick={() => {
                            setChatActionsMenuOpen(false);
                            handleExportChat(undefined, 'json');
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontFamily: 'Poppins, sans-serif',
                            color: themeTokens.textPrimary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <Download size={13} color={themeTokens.textSecondary} />
                          <span>Exportar JSON</span>
                        </div>

                        <div
                          onClick={() => {
                            setChatActionsMenuOpen(false);
                            setIsPermissionsModalOpen(true);
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontFamily: 'Poppins, sans-serif',
                            color: themeTokens.textPrimary,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <Shield size={13} color={accentColor} />
                          <span>Permissões da IA</span>
                        </div>

                        <div
                          onClick={() => {
                            setChatActionsMenuOpen(false);
                            setClearHistoryConfirmOpen(true);
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            cursor: 'pointer',
                            fontSize: 12,
                            fontFamily: 'Poppins, sans-serif',
                            color: '#ef4444',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = isEffectiveDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <Trash2 size={13} color="#ef4444" />
                          <span>Limpar Conversa</span>
                        </div>
                      </div>
                    )}
                  </div>



                  {/* Chat History & Sessions Popup */}
                  {chatHistoryPopupOpen && (
                    <div
                      ref={(el) => {
                        chatHistoryPopupRef.current = el;
                        clampPopupToViewport(el);
                      }}
                      style={{
                        position: 'absolute',
                        top: 34,
                        left: 0,
                        width: 270,
                        background: themeTokens.bgCardSecondary,
                        borderRadius: 10,
                        border: '1px solid ' + themeTokens.border,
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        zIndex: 9999,
                      }}
                    >
                      {/* Popup Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: themeTokens.textPrimary, fontSize: 12, fontWeight: '500' }}>
                          <MessageSquare size={13} color={accentColor} />
                          <span>Chats Iniciados</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            handleCreateNewChatSession();
                          }}
                          style={{
                            background: accentColor,
                            border: 'none',
                            color: accentTextColor,
                            borderRadius: 4,
                            padding: '3px 8px',
                            fontSize: 10.5,
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Plus size={11} />
                          <span>Novo Chat</span>
                        </button>
                      </div>

                      {/* Chats List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        {chatSessions.length === 0 ? (
                          <div style={{ color: themeTokens.textSecondary, fontSize: 11, textAlign: 'center', padding: '12px 0' }}>
                            Nenhum chat anterior. Inicie uma nova conversa!
                          </div>
                        ) : (
                          [...chatSessions]
                            .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
                            .slice(0, 4)
                            .map((s) => {
                            const sessionProvider = s.provider || s.history?.find((h) => h.providerId)?.providerId || selectedAiProvider || 'claude';
                            const providerObj = AI_PROVIDERS.find((p) => p.id === sessionProvider);
                            const isActive = s.id === activeChatSessionId;

                            const isEditing = editingChatSessionId === s.id;

                            return (
                              <div
                                key={s.id}
                                onClick={() => {
                                  if (!isEditing) handleSelectChatSession(s.id);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 8px',
                                  borderRadius: 5,
                                  cursor: isEditing ? 'default' : 'pointer',
                                  background: isActive ? hexToRgba(accentColor, 0.15) : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'),
                                  border: 'none',
                                  gap: 6,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      width: 16,
                                      height: 16,
                                    }}
                                    title={providerObj?.name || sessionProvider}
                                  >
                                    {renderAiIcon(sessionProvider, 13)}
                                  </div>
                                  {isEditing ? (
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSaveRenameChatSession(s.id);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                                    >
                                      <input
                                        autoFocus
                                        value={editingChatTitle}
                                        onChange={(e) => setEditingChatTitle(e.target.value)}
                                        onBlur={() => handleSaveRenameChatSession(s.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') {
                                            e.preventDefault();
                                            handleCancelRenameChatSession();
                                          }
                                        }}
                                        style={{
                                          flex: 1,
                                          minWidth: 0,
                                          background: isEffectiveDark ? 'rgba(0, 0, 0, 0.45)' : '#ffffff',
                                          color: themeTokens.textPrimary,
                                          border: `1px solid ${accentColor}`,
                                          borderRadius: 4,
                                          padding: '1px 5px',
                                          fontSize: 11.5,
                                          fontFamily: 'Poppins, sans-serif',
                                          outline: 'none',
                                        }}
                                      />
                                      <button
                                        type="submit"
                                        title="Salvar"
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: accentColor,
                                          cursor: 'pointer',
                                          padding: 1,
                                          display: 'flex',
                                          alignItems: 'center',
                                        }}
                                      >
                                        <Check size={11} />
                                      </button>
                                    </form>
                                  ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1, gap: 1 }}>
                                      <span
                                        onDoubleClick={(e) => handleStartRenameChatSession(s, e)}
                                        title="Duplo clique para renomear"
                                        style={{
                                          fontSize: 11.5,
                                          color: themeTokens.textPrimary,
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          whiteSpace: 'nowrap',
                                          fontWeight: isActive ? '500' : '400',
                                        }}
                                      >
                                        {s.title}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: 10,
                                          color: isEffectiveDark ? 'rgba(255, 255, 255, 0.4)' : 'rgba(0, 0, 0, 0.45)',
                                          whiteSpace: 'nowrap',
                                          overflow: 'hidden',
                                          textOverflow: 'ellipsis',
                                          lineHeight: '13px',
                                        }}
                                      >
                                        {formatTimeAgo(s.updatedAt)}
                                      </span>
                                    </div>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                                  {!isEditing && (
                                    <button
                                      onClick={(e) => handleStartRenameChatSession(s, e)}
                                      title="Renomear conversa"
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: themeTokens.textSecondary,
                                        cursor: 'pointer',
                                        padding: 2,
                                        display: 'flex',
                                        alignItems: 'center',
                                        borderRadius: 3,
                                        transition: 'color 0.15s ease',
                                      }}
                                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                                    >
                                      <Pencil size={11} />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleExportChat(s.id, 'markdown');
                                    }}
                                    title="Exportar conversa (.md)"
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: themeTokens.textSecondary,
                                      cursor: 'pointer',
                                      padding: 2,
                                      display: 'flex',
                                      alignItems: 'center',
                                      borderRadius: 3,
                                      transition: 'color 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                                  >
                                    <Download size={11} />
                                  </button>
                                  <button
                                    onClick={(e) => handleDeleteChatSession(s.id, e)}
                                    title="Excluir conversa"
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: themeTokens.textSecondary,
                                      cursor: 'pointer',
                                      padding: 2,
                                      display: 'flex',
                                      alignItems: 'center',
                                      borderRadius: 3,
                                      transition: 'color 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ff5f56')}
                                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}

                        {/* Botao para abrir restante do historico no modal */}
                        <button
                          type="button"
                          onClick={() => handleOpenChatHistoryModal()}
                          title="Abrir modal com histórico completo e detalhes das conversas"
                          style={{
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                            border: `1px dashed ${themeTokens.border}`,
                            color: themeTokens.textSecondary,
                            borderRadius: 5,
                            padding: '6px 10px',
                            fontSize: 11,
                            fontFamily: 'Poppins, sans-serif',
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 6,
                            marginTop: 3,
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = themeTokens.textPrimary;
                            e.currentTarget.style.borderColor = accentColor;
                            e.currentTarget.style.background = hexToRgba(accentColor, 0.08);
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = themeTokens.textSecondary;
                            e.currentTarget.style.borderColor = themeTokens.border;
                            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                          }}
                        >
                          <Clock size={11} color={accentColor} />
                          <span>Ver histórico</span>
                          <ChevronRight size={11} />
                        </button>
                      </div>

                      {/* Popup Footer */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          paddingTop: 6,
                          borderTop: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)'}`,
                          fontSize: 10.5,
                          color: themeTokens.textSecondary,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, opacity: 0.75 }} title="Conversas salvas automaticamente em ~/.devflow/chats/">
                          <Check size={11} color={accentColor} />
                          <span>Salvo automaticamente</span>
                        </div>
                        <span style={{ fontSize: 10, opacity: 0.65 }}>
                          {chatSessions.length > 4 ? `4 de ${chatSessions.length} recentes` : `${chatSessions.length} conversa${chatSessions.length === 1 ? '' : 's'}`}
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Missing CLI installation alert banner */}
                {aiNotInstalledAlert && (
                  <div
                    style={{
                      padding: '8px 12px',
                      background: isEffectiveDark ? 'rgba(255, 75, 75, 0.12)' : 'rgba(255, 75, 75, 0.08)',
                      border: 'none',
                      borderRadius: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ff4b4b', fontSize: 11.5, fontWeight: '600' }}>
                        <AlertTriangle size={13} />
                        <span>CLI não detectada</span>
                      </div>
                      <button
                        onClick={() => setAiNotInstalledAlert(null)}
                        style={{ background: 'transparent', border: 'none', color: '#ff4b4b', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: themeTokens.textSecondary, lineHeight: '15px' }}>
                      {aiNotInstalledAlert.message}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <button
                        onClick={() => {
                          const prov = AI_PROVIDERS.find((p) => p.cliCommand === aiNotInstalledAlert.command || p.name === aiNotInstalledAlert.modelName) || AI_PROVIDERS[0];
                          handleInstallCliInTerminal(prov);
                          setAiNotInstalledAlert(null);
                        }}
                        style={{
                          background: accentColor,
                          border: 'none',
                          borderRadius: 4,
                          color: accentTextColor,
                          fontSize: 11,
                          fontWeight: '500',
                          fontFamily: 'Poppins, sans-serif',
                          padding: '5px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          boxShadow: `0 2px 6px ${hexToRgba(accentColor, 0.3)}`,
                        }}
                      >
                        <SquareTerminal size={12} />
                        Instalar no Terminal ({aiNotInstalledAlert.guide})
                      </button>
                      <button
                        onClick={() => handleOpenExternalLink(aiNotInstalledAlert.url)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 4,
                          color: '#ccc',
                          fontSize: 11,
                          fontWeight: '400',
                          fontFamily: 'Poppins, sans-serif',
                          padding: '5px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <ExternalLink size={11} />
                        Página de Download
                      </button>
                      <button
                        onClick={() => setAiNotInstalledAlert(null)}
                        style={{
                          marginLeft: 'auto',
                          background: 'transparent',
                          border: 'none',
                          color: '#777',
                          fontSize: 11,
                          cursor: 'pointer',
                          fontFamily: 'Poppins, sans-serif',
                          fontWeight: '400',
                        }}
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                )}

                {/* AI Interactive Terminal Scrollable History with Centered Loading Overlay */}
                <div style={{ flex: '1 1 0', minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                  {/* Watermark AI Logo in the background when chat has no messages yet */}
                  {(!aiHistory || !aiHistory.some((item) => item.text && !item.text.toLowerCase().includes('executando'))) && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        zIndex: 0,
                        userSelect: 'none',
                      }}
                    >
                      <div
                        style={{
                          opacity: isEffectiveDark ? 0.08 : 0.06,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'opacity 0.25s ease, transform 0.25s ease',
                        }}
                      >
                        {renderAiIcon(selectedAiProvider, 150)}
                      </div>
                    </div>
                  )}

                  <div
                    ref={aiTerminalScrollRef}
                    onDragOver={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onDrop={handlePromptDrop}
                    style={{
                      flex: '1 1 0',
                      minHeight: 0,
                      background: 'transparent',
                      borderRadius: 8,
                      padding: '4px 2px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: 12,
                      fontWeight: '400',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                  {aiHistory.map((item, idx) => {
                    if (item.text && item.text.toLowerCase().includes('executando')) {
                      return null;
                    }
                    if (item.type === 'user') {
                      const formattedTime = item.timestamp
                        ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div
                          key={idx}
                          onMouseEnter={() => setHoveredChatMsgIdx(idx)}
                          onMouseLeave={() => setHoveredChatMsgIdx(null)}
                          style={{
                            alignSelf: 'flex-end',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: 8,
                            maxWidth: '92%',
                          }}
                        >
                          <div
                            style={{
                              position: 'relative',
                              background: hexToRgba(chatAccentColor, 0.15),
                              color: themeTokens.textPrimary,
                              padding: '8px 12px',
                              borderRadius: '8px 2px 8px 8px',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                              fontWeight: '400',
                              lineHeight: '18px',
                              flex: '1 1 auto',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 6,
                              minHeight: 34,
                              minWidth: 130,
                              boxSizing: 'border-box',
                            }}
                          >
                            {/* Attached Task Tag/Chip on top of user message */}
                            {item.attachedTask && (
                              <div
                                onClick={() => handleOpenIssueSidesheet(item.attachedTask!.number)}
                                title={`Ver detalhes da Tarefa #${item.attachedTask.number}: ${item.attachedTask.title}`}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  alignSelf: 'flex-start',
                                  gap: 6,
                                  background: isEffectiveDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(14, 165, 233, 0.14)',
                                  border: `1px solid ${isEffectiveDark ? 'rgba(56, 189, 248, 0.28)' : 'rgba(14, 165, 233, 0.25)'}`,
                                  borderRadius: 6,
                                  padding: '3px 8px',
                                  fontSize: 11.5,
                                  fontFamily: 'Poppins, sans-serif',
                                  color: isEffectiveDark ? '#38bdf8' : '#0284c7',
                                  userSelect: 'none',
                                  width: 'fit-content',
                                  maxWidth: '100%',
                                  cursor: 'pointer',
                                  transition: 'all 0.15s ease',
                                  marginBottom: 2,
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(56, 189, 248, 0.24)' : 'rgba(14, 165, 233, 0.22)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(14, 165, 233, 0.14)';
                                }}
                              >
                                <span style={{ fontWeight: 700, fontSize: 11, flexShrink: 0 }}>#{item.attachedTask.number}</span>
                                <span
                                  style={{
                                    maxWidth: 240,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontWeight: 500,
                                  }}
                                >
                                  {item.attachedTask.title}
                                </span>
                              </div>
                            )}

                            {/* Attached Images in User Message */}
                            {item.attachedImages && item.attachedImages.length > 0 && (
                              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 2 }}>
                                {item.attachedImages.map((img, imgIdx) => (
                                  <img
                                    key={imgIdx}
                                    src={img.dataUrl}
                                    alt={img.name}
                                    style={{
                                      maxWidth: 180,
                                      maxHeight: 140,
                                      borderRadius: 6,
                                      objectFit: 'cover',
                                      border: '1px solid rgba(255, 255, 255, 0.15)',
                                      boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
                                    }}
                                  />
                                ))}
                              </div>
                            )}

                            <div style={{ lineHeight: '20px' }}>{renderPromptTextWithMentions(item.text)}</div>

                            {/* Attached Files & Folders in User Message */}
                            {item.attachedFiles && item.attachedFiles.length > 0 && (
                              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginTop: 4 }}>
                                {item.attachedFiles.map((f, fIdx) => (
                                  <div
                                    key={fIdx}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 5,
                                      background: isEffectiveDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(255, 255, 255, 0.6)',
                                      border: '1px solid rgba(255, 255, 255, 0.1)',
                                      borderRadius: 4,
                                      padding: '2px 7px 2px 5px',
                                      fontSize: 11,
                                    }}
                                  >
                                    {f.isDirectory ? (
                                      <FolderIcon folderName={f.name} isOpen={false} size={12} />
                                    ) : (
                                      <FileIcon fileName={f.name} size={12} />
                                    )}
                                    <span style={{ fontWeight: 500 }}>{f.name}</span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* User Message Floating Options: only on hover, positioned over bubble text, with background blur */}
                            <div
                              style={{
                                position: 'absolute',
                                bottom: 4,
                                right: 4,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                padding: 6,
                                borderRadius: 6,
                                background: isEffectiveDark ? 'rgba(20, 20, 24, 0.75)' : 'rgba(245, 245, 247, 0.75)',
                                backdropFilter: 'blur(8px)',
                                WebkitBackdropFilter: 'blur(8px)',
                                border: 'none',
                                boxShadow: 'none',
                                opacity: hoveredChatMsgIdx === idx ? 1 : 0,
                                pointerEvents: hoveredChatMsgIdx === idx ? 'auto' : 'none',
                                transform: hoveredChatMsgIdx === idx ? 'translateY(0)' : 'translateY(2px)',
                                transition: 'opacity 0.15s ease, transform 0.15s ease',
                                zIndex: 10,
                                userSelect: 'none',
                                width: 'max-content',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                              }}
                            >
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 400,
                                  color: isEffectiveDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
                                  whiteSpace: 'nowrap',
                                  flexShrink: 0,
                                  lineHeight: 1,
                                }}
                              >
                                {formattedTime}
                              </span>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCopyMessage(item.text, idx);
                                }}
                                title="Copiar prompt"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  color: copiedMsgIdx === idx ? '#22c55e' : (isEffectiveDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'),
                                  display: 'flex',
                                  alignItems: 'center',
                                  flexShrink: 0,
                                  transition: 'color 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
                                onMouseLeave={(e) => (e.currentTarget.style.color = copiedMsgIdx === idx ? '#22c55e' : (isEffectiveDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)'))}
                              >
                                {copiedMsgIdx === idx ? <Check size={12} /> : <Copy size={12} />}
                              </button>

                              {/* Undo Button with exact tooltip matching Image 1 */}
                              <div style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenUndoModal(idx);
                                  }}
                                  onMouseEnter={() => setHoveredUndoIdx(idx)}
                                  onMouseLeave={() => setHoveredUndoIdx(null)}
                                  title="Undo changes up to this point"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    color: isEffectiveDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    flexShrink: 0,
                                    transition: 'color 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = isEffectiveDark ? 'rgba(255, 255, 255, 0.65)' : 'rgba(0, 0, 0, 0.65)')}
                                >
                                  <Undo2 size={12} />
                                </button>
                                {hoveredUndoIdx === idx && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      bottom: 'calc(100% + 7px)',
                                      right: -6,
                                      background: '#262626',
                                      color: '#f4f4f5',
                                      padding: '5px 9px',
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontFamily: 'Poppins, sans-serif',
                                      fontWeight: 400,
                                      whiteSpace: 'nowrap',
                                      boxShadow: 'none',
                                      border: 'none',
                                      zIndex: 100,
                                      pointerEvents: 'none',
                                    }}
                                  >
                                    Undo changes up to this point
                                    <div
                                      style={{
                                        position: 'absolute',
                                        top: '100%',
                                        right: 9,
                                        width: 0,
                                        height: 0,
                                        borderLeft: '5px solid transparent',
                                        borderRight: '5px solid transparent',
                                        borderTop: '5px solid #262626',
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          <img
                            src={githubUser?.avatarUrl || avatarImg}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (!target.dataset.triedFallback) {
                                target.dataset.triedFallback = 'true';
                                target.src = avatarImg;
                              }
                            }}
                            alt={githubUser?.login || 'User'}
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              flexShrink: 0,
                              marginTop: 2,
                              objectFit: 'cover',
                              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
                            }}
                          />
                        </div>
                      );
                    } else if (item.type === 'error') {
                      return (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(255, 60, 60, 0.08)',
                            borderLeft: '2px solid #ff4b4b',
                            padding: '8px 10px',
                            borderRadius: '0 6px 6px 0',
                            color: '#ff8585',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            fontWeight: '400',
                          }}
                        >
                          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '18px' }}>{item.text}</div>
                          {(item.command || item.downloadUrl) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                              {item.command && (
                                <button
                                  onClick={() => {
                                    const prov = AI_PROVIDERS.find((p) => p.installGuide === item.command) || AI_PROVIDERS[0];
                                    handleInstallCliInTerminal(prov);
                                  }}
                                  style={{
                                    alignSelf: 'flex-start',
                                    background: accentColor,
                                    border: 'none',
                                    borderRadius: 4,
                                    color: accentTextColor,
                                    fontSize: 11,
                                    fontWeight: '500',
                                    fontFamily: 'Poppins, sans-serif',
                                    padding: '4px 10px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    boxShadow: `0 2px 6px ${hexToRgba(accentColor, 0.3)}`,
                                  }}
                                >
                                  <SquareTerminal size={11} />
                                  Instalar no Terminal
                                </button>
                              )}
                              {item.downloadUrl && (
                                <button
                                  onClick={() => handleOpenExternalLink(item.downloadUrl!)}
                                  style={{
                                    alignSelf: 'flex-start',
                                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                                    border: '1px solid ' + themeTokens.border,
                                    borderRadius: 4,
                                    color: themeTokens.textSecondary,
                                    fontSize: 11,
                                    fontWeight: '400',
                                    fontFamily: 'Poppins, sans-serif',
                                    padding: '4px 9px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <ExternalLink size={11} />
                                  Página de Download
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    } else if (item.type === 'auth_required' || (item.type === 'assistant' && isAuthErrorText(item.text))) {
                      const prov = AI_PROVIDERS.find((p) => p.id === (item.providerId || selectedAiProvider)) || AI_PROVIDERS[0];
                      const authCmd = item.command || (prov.id === 'claude' ? 'claude login' : prov.id === 'antigravity' ? 'agy auth login' : prov.id === 'codex' ? 'codex login' : `${prov.cliCommand} login`);

                      return (
                        <div
                          key={idx}
                          style={{
                            alignSelf: 'flex-start',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: 8,
                            maxWidth: '96%',
                            width: '100%',
                          }}
                        >
                          {/* Assistant Avatar */}
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 5,
                              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          >
                            <KeyRound size={12} color={accentColor} />
                          </div>

                          {/* Card Content (Borderless, System Theme Standard) */}
                          <div
                            style={{
                              flex: '1 1 auto',
                              background: themeTokens.bgCard,
                              border: 'none',
                              borderRadius: 8,
                              padding: '11px 13px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 9,
                              fontFamily: 'Poppins, sans-serif',
                            }}
                          >
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <span style={{ fontWeight: 600, fontSize: 12.5, color: themeTokens.textPrimary }}>
                                  Sessão expirada
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  color: themeTokens.textSecondary,
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)',
                                  padding: '2px 7px',
                                  borderRadius: 10,
                                }}
                              >
                                {prov.name}
                              </span>
                            </div>

                            {/* Reduced informative text */}
                            <div style={{ fontSize: 12, color: themeTokens.textSecondary, lineHeight: '17px' }}>
                              Faça login para continuar:
                            </div>

                            {/* Raw output box (Borderless) */}
                            {item.text && (
                              <div
                                style={{
                                  background: isEffectiveDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.04)',
                                  padding: '6px 9px',
                                  borderRadius: 6,
                                  fontSize: 11,
                                  fontFamily: 'JetBrains Mono, monospace',
                                  color: isEffectiveDark ? 'rgba(255, 255, 255, 0.65)' : themeTokens.textSecondary,
                                  whiteSpace: 'pre-wrap',
                                  wordBreak: 'break-word',
                                  maxHeight: 70,
                                  overflowY: 'auto',
                                  lineHeight: '15px',
                                  border: 'none',
                                }}
                              >
                                {item.text}
                              </div>
                            )}

                            {/* Action Buttons Row (Borderless) */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginTop: 1 }}>
                              {/* 1. System macOS Terminal */}
                              <button
                                onClick={async () => {
                                  if (window.electronAPI?.shell?.openInSystemTerminal) {
                                    setToastMessage(`Abrindo Terminal com "${authCmd}"...`);
                                    await window.electronAPI.shell.openInSystemTerminal(authCmd, terminalCwd);
                                  } else {
                                    handleNewTerminalSession(prov.id === 'claude' ? 'claude' : 'zsh', `${prov.name} Login`, authCmd);
                                  }
                                }}
                                style={{
                                  background: accentColor,
                                  border: 'none',
                                  borderRadius: 6,
                                  color: accentTextColor,
                                  fontSize: 11.5,
                                  fontWeight: 500,
                                  fontFamily: 'Poppins, sans-serif',
                                  padding: '5px 12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  transition: 'opacity 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                                title="Abrir terminal do macOS para autenticar"
                              >
                                <Monitor size={12} />
                                <span>Terminal do Mac</span>
                              </button>

                              {/* 2. Integrated DevFlow Terminal */}
                              <button
                                onClick={() => {
                                  handleNewTerminalSession(prov.id === 'claude' ? 'claude' : 'zsh', `${prov.name} Login`, authCmd);
                                  setIsTerminalCollapsed(false);
                                  setActiveTermTab('terminal');
                                  setToastMessage(`Iniciando "${authCmd}" no terminal integrado...`);
                                }}
                                style={{
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                                  border: 'none',
                                  borderRadius: 6,
                                  color: themeTokens.textPrimary,
                                  fontSize: 11.5,
                                  fontWeight: 500,
                                  fontFamily: 'Poppins, sans-serif',
                                  padding: '5px 12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  transition: 'background 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.09)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')}
                                title="Abrir terminal integrado para autenticar"
                              >
                                <SquareTerminal size={12} />
                                <span>Terminal Integrado</span>
                              </button>

                              {/* 3. Copy Command */}
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(authCmd);
                                  setToastMessage(`"${authCmd}" copiado!`);
                                }}
                                style={{
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                                  border: 'none',
                                  borderRadius: 6,
                                  color: themeTokens.textSecondary,
                                  fontSize: 11.5,
                                  fontWeight: 400,
                                  fontFamily: 'Poppins, sans-serif',
                                  padding: '5px 10px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  marginLeft: 'auto',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = themeTokens.textPrimary;
                                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.07)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = themeTokens.textSecondary;
                                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                                }}
                                title={`Copiar comando "${authCmd}"`}
                              >
                                <Copy size={11} />
                                <span>Copiar login</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    } else if (item.type === 'system') {
                      return (
                        <div
                          key={idx}
                          style={{
                            color: themeTokens.textSecondary,
                            fontSize: 11,
                            padding: '2px 4px',
                            whiteSpace: 'pre-wrap',
                            fontWeight: '400',
                            lineHeight: '16px',
                          }}
                        >
                          {item.text}
                        </div>
                      );
                    } else {
                      const isWorkedExpanded = expandedWorkedMap[idx] ?? true;
                      const isDiffCollapsed = collapsedDiffMap[idx] ?? true;
                      const steps = item.executionSteps || (item.changedFiles && item.changedFiles.length > 0 ? (
                        item.changedFiles.flatMap((f, fIdx) => [
                          {
                            id: `explore-${f.name}-${fIdx}`,
                            type: 'explore' as const,
                            label: 'Explorou 1 arquivo',
                            children: [
                              {
                                id: `analyzed-${f.name}-${fIdx}`,
                                type: 'analyze' as const,
                                label: `Analisou ${f.name}`,
                                file: f.name,
                                path: f.path,
                              },
                              {
                                id: `thought-${f.name}-${fIdx}`,
                                type: 'thought' as const,
                                label: 'Pensou por 1s',
                                duration: '1s',
                              },
                            ],
                          },
                          {
                            id: `edit-${f.name}-${fIdx}`,
                            type: 'edit' as const,
                            label: `Editou ${f.name}`,
                            file: f.name,
                            path: f.path,
                            additions: f.additions,
                            deletions: f.deletions,
                          },
                        ])
                      ) : null);

                      const changedFiles = item.changedFiles || [];
                      const totalFiles = changedFiles.length;
                      const totalAdditions = changedFiles.reduce((acc, f) => acc + (f.additions || 0), 0);
                      const totalDeletions = changedFiles.reduce((acc, f) => acc + (f.deletions || 0), 0);
                      const formattedTime = item.timestamp
                        ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div
                          key={idx}
                          style={{
                            alignSelf: 'flex-start',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: 8,
                            maxWidth: '96%',
                            width: '100%',
                          }}
                        >
                          {/* Assistant Avatar / Icon */}
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 5,
                              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          >
                            {renderAiIcon(item.providerId || 'antigravity', 14)}
                          </div>

                          {/* Content Container */}
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                              flex: '1 1 auto',
                              minWidth: 0,
                            }}
                          >
                            {/* 1. Antigravity Execution Timeline (Thought, Steps, Terminal, Diffs) */}
                            <AiChatTimeline
                              steps={steps || undefined}
                              workedDuration={item.workedDuration}
                              thoughtSnippet={item.thoughtSnippet}
                              isWorking={isAiExecuting && idx === aiHistory.length - 1 && !(item.text && item.timestamp)}
                              liveAction={liveCurrentAction}
                              terminalCommands={item.terminalCommands || undefined}
                              changedFiles={item.changedFiles || undefined}
                              onOpenFileAction={(path, name, lineRange) => {
                                handleOpenFile(path + (lineRange ? lineRange : ''), name);
                              }}
                              onReviewDiffAction={(files, fileIdx) => {
                                handleStartReview(files, fileIdx);
                              }}
                              onAcceptAllDiffs={handleAcceptAllDiffs}
                              onRejectAllDiffs={() => handleRequestRejectAllDiffs(item.changedFiles)}
                              accentColor={accentColor}
                              themeTokens={themeTokens}
                              isEffectiveDark={isEffectiveDark}
                            />

                            {/* Antigravity Interactive Question Card (if prompt requires decision) */}
                            {item.interactiveQuestion && (
                              <InteractiveQuestionCard
                                data={item.interactiveQuestion}
                                onAnswer={(selected, writeIn) => handleAnswerInteractiveQuestion(selected, writeIn)}
                                accentColor={accentColor}
                                themeTokens={themeTokens}
                                isEffectiveDark={isEffectiveDark}
                              />
                            )}

                            {/* 2. Main Assistant Response Text (Rich Markdown & Code Formatted) */}
                            <div
                              style={{
                                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                                color: themeTokens.textPrimary,
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                wordBreak: 'break-word',
                                lineHeight: '20px',
                                fontSize: 13,
                              }}
                            >
                              {renderFormattedMessage(item.text, idx)}
                            </div>

                            {/* 3. Walkthrough Card (Antigravity Style - Borderless) */}
                            {item.walkthrough && (
                              <div
                                style={{
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                                  border: 'none',
                                  borderRadius: 8,
                                  padding: '10px 14px',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: themeTokens.textPrimary,
                                    marginBottom: 6,
                                  }}
                                >
                                  <BookOpen size={14} style={{ color: '#93c5fd' }} />
                                  <span>Walkthrough</span>
                                </div>
                                <div style={{ fontSize: 12.5, color: '#9ca3af', lineHeight: '18px' }}>
                                  {renderFormattedMessage(
                                    (item.walkthrough.summary || '')
                                      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                                      .replace(/```[a-zA-Z]*\n?/g, '')
                                      .replace(/```/g, ''),
                                    idx + 1000
                                  )}
                                </div>
                              </div>
                            )}

                            {/* 4. Files Changed Card (Resumo de arquivos modificados - Borderless) */}
                            {totalFiles > 0 && (
                              <div
                                style={{
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                                  border: 'none',
                                  borderRadius: 8,
                                  overflow: 'hidden',
                                }}
                              >
                                {/* Card Header */}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    borderBottom: isDiffCollapsed ? 'none' : `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'}`,
                                  }}
                                >
                                  <div
                                    onClick={() => setCollapsedDiffMap((prev) => ({ ...prev, [idx]: !isDiffCollapsed }))}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      cursor: 'pointer',
                                      userSelect: 'none',
                                    }}
                                  >
                                    {isDiffCollapsed ? (
                                      <ChevronRight size={14} style={{ color: '#9ca3af' }} />
                                    ) : (
                                      <ChevronDown size={14} style={{ color: '#9ca3af' }} />
                                    )}
                                    <span style={{ fontSize: 12.5, fontWeight: 500, color: themeTokens.textPrimary }}>
                                      {totalFiles} {totalFiles === 1 ? 'file changed' : 'files changed'}
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', marginLeft: 4 }}>
                                      +{totalAdditions}
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>
                                      -{totalDeletions}
                                    </span>
                                  </div>

                                  <button
                                    onClick={() => {
                                      handleStartReview(changedFiles, 0);
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                                      border: 'none',
                                      borderRadius: 6,
                                      padding: '4px 10px',
                                      fontSize: 11.5,
                                      fontWeight: 500,
                                      color: themeTokens.textPrimary,
                                      cursor: 'pointer',
                                      transition: 'background 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.14)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)')}
                                  >
                                    Review
                                  </button>
                                </div>

                                {/* Changed Files Rows */}
                                {!isDiffCollapsed && (
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {changedFiles.map((file, fIdx) => (
                                      <div
                                        key={fIdx}
                                        onClick={() => handleStartReview(changedFiles, fIdx)}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '6px 12px',
                                          fontSize: 12,
                                          cursor: 'pointer',
                                          transition: 'background 0.15s ease',
                                          borderTop: fIdx > 0 ? `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'}` : 'none',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                                          {renderFileIcon(file.name)}
                                          <span style={{ fontWeight: 600, color: themeTokens.textPrimary }}>{file.name}</span>
                                          {file.dir && (
                                            <span style={{ color: '#6b7280', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {file.dir}
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                                          <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 11.5 }}>
                                            +{file.additions}
                                          </span>
                                          <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 11.5 }}>
                                            -{file.deletions}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Issue Finalization Action Card (DevFlow Task Workflow) */}
                            {(() => {
                              const issueActionMatch = item.text?.match(/<!--\s*ISSUE_ACTION_PROMPT:#?(\d+)\s*-->/);
                              const explicitIssueNumber = issueActionMatch ? parseInt(issueActionMatch[1], 10) : undefined;
                              
                              let isLastAssistant = false;
                              for (let i = aiHistory.length - 1; i >= 0; i--) {
                                if (aiHistory[i].type === 'assistant') {
                                  isLastAssistant = (i === idx);
                                  break;
                                }
                              }
                              
                              const targetIssueNumber = explicitIssueNumber || (isLastAssistant && activeWorkingIssue ? activeWorkingIssue.number : undefined);
                              if (!targetIssueNumber) return null;

                              const isIssueFinalized = Boolean(finalizedIssues[targetIssueNumber]);
                              const targetIssueTitle = (activeWorkingIssue?.number === targetIssueNumber ? activeWorkingIssue.title : undefined) || `Tarefa #${targetIssueNumber}`;

                              if (isIssueFinalized) {
                                return (
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 10,
                                      padding: 10,
                                      background: isEffectiveDark ? 'rgba(34, 197, 94, 0.08)' : 'rgba(34, 197, 94, 0.1)',
                                      borderRadius: 8,
                                      border: 'none',
                                      fontSize: 12,
                                      fontWeight: 400,
                                      color: isEffectiveDark ? '#86efac' : '#15803d',
                                    }}
                                  >
                                    <Check size={15} style={{ flexShrink: 0 }} />
                                    <span>
                                      Tarefa #{targetIssueNumber} finalizada e comitada com sucesso. Registrada na Daily.
                                    </span>
                                  </div>
                                );
                              }

                              return (
                                <div
                                  style={{
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 12,
                                    padding: 12,
                                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                                    borderRadius: 8,
                                    border: 'none',
                                    marginTop: 4,
                                  }}
                                >
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      gap: 8,
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                      <MilestoneIcon size={14} style={{ color: chatAccentColor, flexShrink: 0 }} />
                                      <span
                                        style={{
                                          fontSize: 12.5,
                                          fontWeight: 400,
                                          color: themeTokens.textPrimary,
                                        }}
                                      >
                                        Finalizar tarefa #{targetIssueNumber}?
                                      </span>
                                    </div>
                                    <span
                                      style={{
                                        fontSize: 11,
                                        fontWeight: 400,
                                        color: isEffectiveDark ? '#9ca3af' : '#6b7280',
                                      }}
                                    >
                                      {targetIssueTitle}
                                    </span>
                                  </div>

                                  <div
                                    style={{
                                      fontSize: 12,
                                      fontWeight: 400,
                                      lineHeight: '18px',
                                      color: isEffectiveDark ? '#9ca3af' : '#6b7280',
                                    }}
                                  >
                                    Revise a implementação para assegurar qualidade e ausência de hardcodes/mocks, ou conclua e vincule diretamente à Daily.
                                  </div>

                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 8,
                                      paddingTop: 8,
                                      borderTop: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
                                    }}
                                  >
                                    <button
                                      type="button"
                                      disabled={isAiExecuting || isFinalizingIssue}
                                      onClick={() => handleReviewIssue(targetIssueNumber, targetIssueTitle)}
                                      title="Solicitar à IA revisão de hardcoded, falhas de segurança e mocks"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: 8,
                                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                                        border: 'none',
                                        borderRadius: 6,
                                        color: themeTokens.textPrimary,
                                        fontSize: 12,
                                        fontWeight: 400,
                                        cursor: isAiExecuting || isFinalizingIssue ? 'not-allowed' : 'pointer',
                                        opacity: isAiExecuting || isFinalizingIssue ? 0.5 : 1,
                                        transition: 'all 0.15s ease',
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!isAiExecuting && !isFinalizingIssue) {
                                          e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
                                          e.currentTarget.style.transform = 'translateY(-1px)';
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                      }}
                                    >
                                      <ShieldCheck size={14} style={{ color: '#38bdf8' }} />
                                      <span>Revisar</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={isAiExecuting || isFinalizingIssue}
                                      onClick={() => handleAcceptAndFinalizeIssue(targetIssueNumber, targetIssueTitle, item.text)}
                                      title="Finalizar tarefa no GitHub, fazer commit vinculado e marcar como concluída na Daily"
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 8,
                                        padding: 8,
                                        background: isEffectiveDark ? '#15803d' : '#16a34a',
                                        border: 'none',
                                        borderRadius: 6,
                                        color: '#ffffff',
                                        fontSize: 12,
                                        fontWeight: 400,
                                        cursor: isAiExecuting || isFinalizingIssue ? 'not-allowed' : 'pointer',
                                        opacity: isAiExecuting || isFinalizingIssue ? 0.7 : 1,
                                        transition: 'all 0.15s ease',
                                      }}
                                      onMouseEnter={(e) => {
                                        if (!isAiExecuting && !isFinalizingIssue) {
                                          e.currentTarget.style.background = isEffectiveDark ? '#16a34a' : '#15803d';
                                          e.currentTarget.style.transform = 'translateY(-1px)';
                                        }
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.background = isEffectiveDark ? '#15803d' : '#16a34a';
                                        e.currentTarget.style.transform = 'translateY(0)';
                                      }}
                                    >
                                      {isFinalizingIssue ? (
                                        <>
                                          <Loader2 size={14} className="animate-spin" />
                                          <span>Finalizando...</span>
                                        </>
                                      ) : (
                                        <>
                                          <Check size={14} />
                                          <span>Aceitar</span>
                                        </>
                                      )}
                                    </button>
                                  </div>
                                </div>
                              );
                            })()}

                            {/* 5. Footer: Timestamp, Copy Button & Undo Button */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                paddingLeft: 2,
                                color: '#6b7280',
                                fontSize: 11,
                                marginTop: 2,
                              }}
                            >
                              <span>{formattedTime}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyMessage(item.text, idx)}
                                title="Copiar resposta"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  color: copiedMsgIdx === idx ? '#22c55e' : '#9ca3af',
                                  display: 'flex',
                                  alignItems: 'center',
                                  transition: 'color 0.15s ease',
                                }}
                              >
                                {copiedMsgIdx === idx ? <Check size={13} /> : <Copy size={13} />}
                              </button>

                              <div style={{ position: 'relative', display: 'inline-flex' }}>
                                <button
                                  type="button"
                                  onClick={() => handleOpenUndoModal(idx)}
                                  onMouseEnter={() => setHoveredUndoIdx(idx)}
                                  onMouseLeave={() => setHoveredUndoIdx(null)}
                                  title="Undo changes up to this point"
                                  style={{
                                    background: 'none',
                                    border: 'none',
                                    padding: 0,
                                    cursor: 'pointer',
                                    color: '#9ca3af',
                                    display: 'flex',
                                    alignItems: 'center',
                                    transition: 'color 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
                                  onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
                                >
                                  <Undo2 size={13} />
                                </button>
                                {hoveredUndoIdx === idx && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      bottom: 'calc(100% + 7px)',
                                      left: '50%',
                                      transform: 'translateX(-50%)',
                                      background: '#262626',
                                      color: '#f4f4f5',
                                      padding: '5px 9px',
                                      borderRadius: 6,
                                      fontSize: 11,
                                      fontFamily: 'Poppins, sans-serif',
                                      fontWeight: 400,
                                      whiteSpace: 'nowrap',
                                      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.45)',
                                      zIndex: 100,
                                      pointerEvents: 'none',
                                    }}
                                  >
                                    Undo changes up to this point
                                    <div
                                      style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: '50%',
                                        transform: 'translateX(-50%)',
                                        width: 0,
                                        height: 0,
                                        borderLeft: '5px solid transparent',
                                        borderRight: '5px solid transparent',
                                        borderTop: '5px solid #262626',
                                      }}
                                    />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })}

                  {/* AI Thinking Indicator (3 jumping / bouncing dots) - only while waiting for AI response without flashing for fast responses */}
                  {showThinkingDots && isAiExecuting && aiHistory[aiHistory.length - 1]?.type === 'user' && (
                    <div
                      style={{
                        alignSelf: 'flex-start',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        maxWidth: '96%',
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 5,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {renderAiIcon(selectedAiProvider, 14)}
                      </div>
                      <div
                        style={{
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                          padding: '7px 11px',
                          borderRadius: '2px 8px 8px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3.5,
                        }}
                      >
                        <span className="thinking-dot" style={{ animationDelay: '0ms', backgroundColor: chatAccentColor }} />
                        <span className="thinking-dot" style={{ animationDelay: '180ms', backgroundColor: chatAccentColor }} />
                        <span className="thinking-dot" style={{ animationDelay: '360ms', backgroundColor: chatAccentColor }} />
                      </div>
                    </div>
                  )}

                  {/* Centered Quota Exceeded Notice inside conversation div */}
                  {quotaExceededAlert && (
                    <div
                      onClick={() => setQuotaExceededAlert(null)}
                      title="Clique para fechar"
                      style={{
                        margin: aiHistory.length <= 1 ? 'auto auto' : '24px auto',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        gap: 6,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        boxShadow: 'none',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        animation: 'fadeIn 0.2s ease-out',
                      }}
                    >
                      <AlertTriangle size={18} style={{ color: '#ff5c5c', opacity: 0.9 }} />
                      <div style={{ fontSize: 13, fontWeight: 500, color: themeTokens.textPrimary, letterSpacing: '-0.1px' }}>
                        Limite de créditos atingido
                      </div>
                      <div style={{ fontSize: 11.5, color: '#888' }}>
                        Reset: {formatRelativeResetTime(quotaExceededAlert.resetTime)}
                      </div>
                    </div>
                  )}
                </div>
                </div>

                {/* Floating Bottom Card: Input & Model Selection with Slash Commands Autocomplete */}
                {(() => {
                  const activeAiProvider = AI_PROVIDERS.find((p) => p.id === selectedAiProvider) || AI_PROVIDERS[0];
                  const currentCommands = aiCommands[selectedAiProvider] || activeAiProvider.commands || [];
                  const isSlashActive = askPrompt.startsWith('/') && !askPrompt.includes(' ') && !isSlashDismissed;
                  const slashQuery = isSlashActive ? askPrompt.slice(1).toLowerCase() : '';
                  const filteredSlashCommands = isSlashActive
                    ? currentCommands.filter(
                        (c) =>
                          c.command.slice(1).toLowerCase().includes(slashQuery) ||
                          c.description.toLowerCase().includes(slashQuery)
                      )
                    : [];
                  const safeSelectedIndex = filteredSlashCommands.length > 0 ? Math.min(Math.max(0, selectedSlashIndex), filteredSlashCommands.length - 1) : 0;

                  const handleSelectSlashCommand = (cmd: AiSlashCommand) => {
                    if (promptEditorRef.current) {
                      promptEditorRef.current.setValue(`${cmd.command} `);
                      promptEditorRef.current.focus();
                    } else if (inputRef.current) {
                      setAskPrompt(`${cmd.command} `);
                      inputRef.current.focus();
                    }
                    setIsSlashDismissed(true);
                  };

                  const currentQuota = aiQuotas[selectedAiProvider] || DEFAULT_AI_QUOTAS[selectedAiProvider];
                  const dailyResetFormatted = formatRelativeResetTime(currentQuota?.dailyResetTime);
                  const weeklyResetFormatted = formatRelativeResetTime(currentQuota?.weeklyResetTime);

                  const isDailyExhausted = currentQuota && currentQuota.dailyPercent === 0 && dailyResetFormatted !== 'Disponível' && !dailyResetFormatted.includes('resetado');
                  const isWeeklyExhausted = currentQuota && currentQuota.weeklyPercent === 0 && weeklyResetFormatted !== 'Disponível' && !weeklyResetFormatted.includes('resetado');
                  const isCurrentQuotaExhausted = isDailyExhausted || isWeeklyExhausted;
                  const exhaustedResetTime = isWeeklyExhausted ? currentQuota.weeklyResetTime : currentQuota.dailyResetTime;
                  const relativeReset = formatRelativeResetTime(exhaustedResetTime);

                  return (
                    <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', zIndex: 50 }}>
                      {/* Minimalist Warning Notice above input region (borderless, compact, short text) */}
                      {isCurrentQuotaExhausted && (
                        <div
                          style={{
                            alignSelf: 'stretch',
                            background: 'rgba(255, 75, 75, 0.06)',
                            border: 'none',
                            outline: 'none',
                            boxShadow: 'none',
                            borderRadius: 6,
                            padding: '4px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 6,
                            animation: 'fadeIn 0.15s ease-out',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                            <AlertTriangle size={12} style={{ color: '#ff5c5c', flexShrink: 0 }} />
                            <span
                              style={{
                                fontSize: 11,
                                color: '#e08888',
                                fontFamily: 'Poppins, sans-serif',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={`0 créditos. Reset: ${relativeReset}`}
                            >
                              0 créditos{relativeReset && relativeReset !== 'Disponível' ? ` · Reset ${relativeReset.startsWith('em ') ? relativeReset : `em ${relativeReset}`}` : ''}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                refreshAiQuotas();
                                setToastMessage('Atualizando cota de créditos...');
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: themeTokens.textSecondary,
                                fontSize: 10.5,
                                fontFamily: 'Poppins, sans-serif',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                              title="Verificar se os créditos já resetaram"
                            >
                              <RefreshCw size={10} />
                              <span>Atualizar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setProviderDropdown(true)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: accentColor,
                                fontSize: 11,
                                fontWeight: 500,
                                fontFamily: 'Poppins, sans-serif',
                                padding: '1px 4px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                transition: 'opacity 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                            >
                              <span>Trocar IA</span>
                              <ChevronRight size={11} />
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Antigravity Message Execution Queue */}
                      <AiChatMessageQueue
                        queue={queuedAiMessages}
                        onRemoveFromQueue={(id) => {
                          setQueuedAiMessages((prev) => prev.filter((item) => item.id !== id));
                        }}
                        accentColor={accentColor}
                        themeTokens={themeTokens}
                        isEffectiveDark={isEffectiveDark}
                      />

                      <form
                        onSubmit={handleAiSubmit}
                        onDragEnter={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          promptDragCounterRef.current += 1;
                          setIsPromptDragOver(true);
                        }}
                        onDragOver={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                        }}
                        onDragLeave={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          promptDragCounterRef.current -= 1;
                          if (promptDragCounterRef.current <= 0) {
                            promptDragCounterRef.current = 0;
                            setIsPromptDragOver(false);
                          }
                        }}
                        onDrop={(e) => {
                          promptDragCounterRef.current = 0;
                          setIsPromptDragOver(false);
                          handlePromptDrop(e);
                        }}
                        style={{
                          alignSelf: 'stretch',
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.45)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          borderRadius: 10,
                          border: isPromptDragOver
                            ? '1px solid #3b82f6'
                            : (isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)'),
                          outline: 'none',
                          boxShadow: isPromptDragOver ? '0 0 12px rgba(59, 130, 246, 0.3)' : 'none',
                          flexDirection: 'column',
                          justifyContent: 'flex-start',
                          alignItems: 'flex-start',
                          display: 'flex',
                          overflow: 'visible',
                          position: 'relative',
                          flexShrink: 0,
                          zIndex: 50,
                          transition: 'all 0.2s ease',
                        }}
                      >
                      {/* Image limit warning banner */}
                      {imageLimitWarning && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '6px 12px',
                            margin: '8px 14px 0 14px',
                            borderRadius: 6,
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            color: '#f87171',
                            fontSize: 11.5,
                            fontFamily: 'Poppins, sans-serif',
                            fontWeight: 500,
                          }}
                        >
                          <AlertTriangle size={13} />
                          <span>{imageLimitWarning}</span>
                        </div>
                      )}

                      {/* Attached Images Preview Row (Antigravity Style) */}
                      {attachedImages.length > 0 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 8,
                            padding: '10px 14px 2px 14px',
                            maxWidth: '100%',
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              overflowX: 'auto',
                              minWidth: 0,
                            }}
                          >
                            {attachedImages.map((img) => (
                              <div
                                key={img.id}
                                style={{
                                  position: 'relative',
                                  width: 38,
                                  height: 38,
                                  borderRadius: 6,
                                  overflow: 'hidden',
                                  border: '1px solid rgba(255, 255, 255, 0.2)',
                                  background: '#111',
                                  flexShrink: 0,
                                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
                                }}
                              >
                                <img
                                  src={img.dataUrl}
                                  alt={img.name}
                                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                />
                                <button
                                  type="button"
                                  onClick={() => setAttachedImages((prev) => prev.filter((i) => i.id !== img.id))}
                                  title="Remover imagem"
                                  style={{
                                    position: 'absolute',
                                    top: 2,
                                    right: 2,
                                    width: 14,
                                    height: 14,
                                    borderRadius: '50%',
                                    background: 'rgba(0, 0, 0, 0.75)',
                                    border: 'none',
                                    color: '#fff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'pointer',
                                    padding: 0,
                                  }}
                                >
                                  <X size={9} />
                                </button>
                              </div>
                            ))}
                          </div>

                          <span
                            style={{
                              fontSize: 11,
                              fontWeight: 500,
                              fontFamily: 'Poppins, sans-serif',
                              color: attachedImages.length >= MAX_ATTACHED_IMAGES ? '#f59e0b' : themeTokens.textSecondary,
                              whiteSpace: 'nowrap',
                              userSelect: 'none',
                              padding: '2px 7px',
                              borderRadius: 4,
                              background: attachedImages.length >= MAX_ATTACHED_IMAGES ? 'rgba(245, 158, 11, 0.14)' : 'rgba(255, 255, 255, 0.05)',
                              border: attachedImages.length >= MAX_ATTACHED_IMAGES ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
                              flexShrink: 0,
                            }}
                          >
                            {attachedImages.length}/{MAX_ATTACHED_IMAGES} imagens{attachedImages.length >= MAX_ATTACHED_IMAGES ? ' (máx)' : ''}
                          </span>
                        </div>
                      )}

                      {/* Floating Slash Commands Autocomplete Menu */}
                      {isSlashActive && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 'calc(100% + 8px)',
                            left: 0,
                            right: 0,
                            background: isEffectiveDark ? '#181818' : '#ffffff',
                            borderRadius: 10,
                            border: 'none',
                            boxShadow: isEffectiveDark ? '0 8px 24px rgba(0, 0, 0, 0.7)' : '0 8px 24px rgba(0, 0, 0, 0.12)',
                            padding: 6,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            maxHeight: 240,
                            overflowY: 'auto',
                            zIndex: 99999,
                          }}
                        >
                          {filteredSlashCommands.length > 0 ? (
                            filteredSlashCommands.map((cmd, idx) => {
                              const isSelected = idx === safeSelectedIndex;
                              return (
                                <div
                                  key={cmd.command}
                                  onClick={() => handleSelectSlashCommand(cmd)}
                                  onMouseEnter={() => setSelectedSlashIndex(idx)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '7px 10px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    background: isSelected
                                      ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')
                                      : 'transparent',
                                    transition: 'background 0.15s ease',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <span
                                      style={{
                                        color: isSelected ? themeTokens.textPrimary : (isEffectiveDark ? '#e0e0e0' : '#333333'),
                                        fontFamily: 'monospace',
                                        fontSize: 12,
                                        fontWeight: isSelected ? 600 : 500,
                                      }}
                                    >
                                      {cmd.command}
                                    </span>
                                    {cmd.usage && (
                                      <span
                                        style={{
                                          color: themeTokens.textSecondary,
                                          fontFamily: 'monospace',
                                          fontSize: 10.5,
                                        }}
                                      >
                                        {cmd.usage}
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    style={{
                                      color: isSelected ? themeTokens.textSecondary : (isEffectiveDark ? '#777777' : '#888888'),
                                      fontSize: 11.5,
                                      fontFamily: 'Poppins, sans-serif',
                                      marginLeft: 12,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {cmd.description}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ padding: '8px 10px', color: themeTokens.textSecondary, fontSize: 11.5, fontFamily: 'Poppins, sans-serif' }}>
                              Nenhum comando correspondente para <strong style={{ color: themeTokens.textPrimary }}>{askPrompt}</strong> no {activeAiProvider.name}.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Floating @ Mention Autocomplete Menu (Antigravity Style: Files, Folders, Git, Terminal, Rules, MCP) */}
                      <AiChatMentionsMenu
                        isOpen={atMentionState.isOpen}
                        query={atMentionState.query}
                        selectedIndex={atMentionState.selectedIndex}
                        files={allWorkspaceFiles}
                        gitBranch={currentBranch}
                        onSelect={(item) => handleSelectAtItem(item.path ? { name: item.title, path: item.path } : { name: item.title, path: item.title })}
                        themeTokens={themeTokens}
                        accentColor={accentColor}
                        isEffectiveDark={isEffectiveDark}
                      />

                      {/* Larger Typing Area (Multi-line Support with Enter to Send) */}
                      <div style={{ alignSelf: 'stretch', padding: '10px 14px 6px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <PromptEditor
                          ref={promptEditorRef}
                          placeholder="Pergunte, mencione arquivos com @ ou arraste para cá..."
                          disabled={isAiExecuting}
                          hasAttachedTask={Boolean(attachedTask)}
                          isEffectiveDark={isEffectiveDark}
                          maxImages={MAX_ATTACHED_IMAGES}
                          currentImagesCount={attachedImages.length}
                          onImageLimitReached={triggerImageLimitWarning}
                          onImageAttached={handleImageFileAttached}
                          onSubmit={(prompt) => handleAiSubmit(undefined, prompt)}
                          onAtMentionQuery={(q) => {
                            setAtMentionState((prev) => ({
                              ...prev,
                              isOpen: true,
                              query: q,
                              selectedIndex: 0,
                            }));
                          }}
                          onAtMentionClose={() => {
                            setAtMentionState((prev) => ({ ...prev, isOpen: false }));
                          }}
                          onKeyDownExtra={(e) => {
                            if (atMentionState.isOpen && filteredAtFiles.length > 0) {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setAtMentionState((prev) => ({
                                  ...prev,
                                  selectedIndex: (prev.selectedIndex + 1) % filteredAtFiles.length,
                                }));
                                return true;
                              }
                              if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setAtMentionState((prev) => ({
                                  ...prev,
                                  selectedIndex: (prev.selectedIndex - 1 + filteredAtFiles.length) % filteredAtFiles.length,
                                }));
                                return true;
                              }
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                const selected = filteredAtFiles[atMentionState.selectedIndex] || filteredAtFiles[0];
                                if (selected) {
                                  handleSelectAtItem(selected);
                                }
                                return true;
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                setAtMentionState((prev) => ({ ...prev, isOpen: false }));
                                return true;
                              }
                            }

                            if (isSlashActive && filteredSlashCommands.length > 0) {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setSelectedSlashIndex((prev) => (prev + 1) % filteredSlashCommands.length);
                                return true;
                              }
                              if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setSelectedSlashIndex((prev) => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
                                return true;
                              }
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                const cmd = filteredSlashCommands[safeSelectedIndex] || filteredSlashCommands[0];
                                if (cmd) {
                                  handleSelectSlashCommand(cmd);
                                }
                                return true;
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                setIsSlashDismissed(true);
                                return true;
                              }
                            }
                            return false;
                          }}
                        />

                        {/* Attached Files & Folders Chips (Antigravity Style) */}
                        {attachedFiles.length > 0 && (
                          <div
                            style={{
                              display: 'flex',
                              flexWrap: 'wrap',
                              alignItems: 'center',
                              gap: 6,
                              paddingTop: 2,
                            }}
                          >
                            {attachedFiles.map((file) => (
                              <div
                                key={file.id}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                                  border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`,
                                  borderRadius: 6,
                                  padding: '3px 8px 3px 6px',
                                  fontSize: 12,
                                  fontFamily: 'Poppins, sans-serif',
                                  color: themeTokens.textPrimary,
                                  userSelect: 'none',
                                  maxWidth: '100%',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                  {file.isDirectory ? (
                                    <FolderIcon folderName={file.name} isOpen={false} size={14} />
                                  ) : (
                                    <FileIcon fileName={file.name} size={14} />
                                  )}
                                </div>
                                <span
                                  title={file.path}
                                  style={{
                                    maxWidth: 190,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    fontWeight: 500,
                                  }}
                                >
                                  {file.name}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => setAttachedFiles((prev) => prev.filter((f) => f.id !== file.id))}
                                  title="Remover anexo"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    color: themeTokens.textSecondary,
                                    cursor: 'pointer',
                                    padding: 1,
                                    display: 'flex',
                                    alignItems: 'center',
                                    borderRadius: 3,
                                  }}
                                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
                                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                                >
                                  <X size={11} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Attached Task Chip */}
                        {attachedTask && (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              alignSelf: 'flex-start',
                              width: 'fit-content',
                              gap: 6,
                              background: isEffectiveDark ? 'rgba(56, 189, 248, 0.14)' : 'rgba(14, 165, 233, 0.12)',
                              border: 'none',
                              borderRadius: 6,
                              padding: '3px 8px',
                              fontSize: 12,
                              fontFamily: 'Poppins, sans-serif',
                              color: isEffectiveDark ? '#38bdf8' : '#0284c7',
                              userSelect: 'none',
                              maxWidth: '100%',
                              marginTop: 4,
                            }}
                          >
                            <span style={{ fontWeight: 700, fontSize: 11, flexShrink: 0 }}>#{attachedTask.number}</span>
                            <span
                              title={attachedTask.title}
                              style={{
                                maxWidth: 260,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                fontWeight: 500,
                              }}
                            >
                              {attachedTask.title}
                            </span>
                            <button
                              type="button"
                              onClick={() => setAttachedTask(null)}
                              title="Desvincular tarefa"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: isEffectiveDark ? '#38bdf8' : '#0284c7',
                                cursor: 'pointer',
                                padding: 0,
                                marginLeft: 2,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                borderRadius: 3,
                                flexShrink: 0,
                              }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = isEffectiveDark ? '#38bdf8' : '#0284c7')}
                            >
                              <X size={12} />
                            </button>
                          </div>
                        )}
                      </div>

                  {/* Bottom Row: AI Selector + Model Selector + Send Button */}
                  <div
                    style={{
                      alignSelf: 'stretch',
                      padding: '8px 10px',
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      display: 'flex',
                      position: 'relative',
                      whiteSpace: 'nowrap',
                      borderBottomLeftRadius: 10,
                      borderBottomRightRadius: 10,
                      gap: 6,
                      zIndex: 60,
                    }}
                  >
                    {/* Left Controls: Orchestrator + AI Selector + Model Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '1 1 auto', minWidth: 0, overflow: 'visible' }}>
                      {/* Orchestrator Toggle Button (Icon only with hover tooltip) */}
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <div
                          onClick={() => setIsOrchestratorActive(!isOrchestratorActive)}
                          onMouseEnter={() => setOrchestratorTooltipOpen(true)}
                          onMouseLeave={() => setOrchestratorTooltipOpen(false)}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 5,
                            background: isOrchestratorActive ? accentColor : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'),
                            color: isOrchestratorActive ? accentTextColor : themeTokens.textSecondary,
                            boxShadow: isOrchestratorActive ? `0 0 10px ${hexToRgba(accentColor, 0.4)}` : 'none',
                            justifyContent: 'center',
                            alignItems: 'center',
                            display: 'flex',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            flexShrink: 0,
                            userSelect: 'none',
                          }}
                        >
                          <Wand2 size={13.5} color={isOrchestratorActive ? accentTextColor : themeTokens.textSecondary} />
                        </div>

                        {/* Hover Tooltip */}
                        {orchestratorTooltipOpen && (
                          <div
                            ref={clampPopupToViewport}
                            style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 8px)',
                              left: 0,
                              background: themeTokens.bgCardSecondary,
                              border: `1px solid ${themeTokens.border}`,
                              borderRadius: 6,
                              padding: '5px 9px',
                              color: themeTokens.textPrimary,
                              fontSize: 11,
                              fontFamily: 'Poppins, sans-serif',
                              whiteSpace: 'nowrap',
                              zIndex: 10000,
                              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
                              pointerEvents: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span style={{ color: isOrchestratorActive ? accentColor : themeTokens.textPrimary, fontWeight: 500 }}>
                              {isOrchestratorActive ? 'Orquestrador Ativo' : 'Orquestrador'}
                            </span>
                            <span style={{ color: themeTokens.textSecondary, fontSize: 10 }}>
                              {isOrchestratorActive ? '• Alternando tarefas' : '• Clique para ativar'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Select AI (Provider) Button with Logo */}
                      <div style={{ position: 'relative', flexShrink: 1, minWidth: 0 }} ref={providerDropdownRef}>
                        <div
                          onClick={() => {
                            const willOpen = !providerDropdown;
                            setProviderDropdown(willOpen);
                            if (willOpen) {
                              if (providerDropdownRef.current) {
                                const rect = providerDropdownRef.current.getBoundingClientRect();
                                const spaceOnRight = window.innerWidth - (rect.left + 220);
                                setSubmenuOpenOnLeft(spaceOnRight < 240);
                              }
                              const isInstalled = installedClis[selectedAiProvider] ?? true;
                              if (isInstalled) {
                                setActiveProviderSubmenu(selectedAiProvider);
                              } else {
                                setActiveProviderSubmenu(null);
                              }
                            } else {
                              setActiveProviderSubmenu(null);
                            }
                          }}
                          style={{
                            height: 26,
                            paddingLeft: 7,
                            paddingRight: 7,
                            borderRadius: 5,
                            background: providerDropdown
                              ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                              : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'),
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            gap: 5,
                            display: 'flex',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'background 0.15s ease',
                            maxWidth: 190,
                            minWidth: 0,
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                            {renderAiIcon(selectedAiProvider, 13.5)}
                          </div>
                          <div
                            style={{
                              color: themeTokens.textPrimary,
                              fontSize: 11.5,
                              fontFamily: 'Poppins, sans-serif',
                              fontWeight: '400',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              minWidth: 0,
                              flexShrink: 0,
                            }}
                          >
                            {AI_PROVIDERS.find((p) => p.id === selectedAiProvider)?.name || 'Claude'}
                          </div>
                          {selectedModel && (
                            <div
                              style={{
                                color: themeTokens.textSecondary,
                                opacity: 0.85,
                                fontSize: 10.5,
                                fontFamily: 'Poppins, sans-serif',
                                fontWeight: '400',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                minWidth: 0,
                                flexShrink: 1,
                              }}
                            >
                              {formatModelDisplayName(selectedModel) || selectedModel}
                            </div>
                          )}
                          <ChevronDown size={10} color={themeTokens.textSecondary} style={{ flexShrink: 0 }} />
                        </div>

                        {/* AI Providers Dropdown Menu */}
                        {providerDropdown && (
                          <div
                            ref={clampPopupToViewport}
                            style={{
                              position: 'absolute',
                              bottom: 34,
                              left: 0,
                              background: themeTokens.bgCardSecondary,
                              borderRadius: 10,
                              border: `1px solid ${themeTokens.border}`,
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                              padding: 6,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                              zIndex: 9999,
                              whiteSpace: 'nowrap',
                              minWidth: isOrchestratorActive ? 230 : 190,
                            }}
                          >
                            {AI_PROVIDERS.map((p) => {
                              const isInstalled = installedClis[p.id] ?? true;
                              const isSelected = selectedAiProvider === p.id;
                              const isOrchestrated = !!orchestratedProviders[p.id];
                              const isOpen = activeProviderSubmenu === p.id;

                              const dynamicList = activeModels[p.id]?.models || [];
                              const fallbackList = (p.models || []).map((mName) => ({
                                id: mName,
                                label: mName,
                              }));
                              const modelList = dynamicList.length > 0 ? dynamicList : fallbackList;

                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    if (!isInstalled) {
                                      // If CLI not installed, clicking row opens installer in terminal
                                      handleInstallCliInTerminal(p);
                                      return;
                                    }
                                    handleSwitchAiProvider(p.id);
                                    if (modelList.length > 0) {
                                      if (providerDropdownRef.current) {
                                        const rect = providerDropdownRef.current.getBoundingClientRect();
                                        const spaceOnRight = window.innerWidth - (rect.left + 220);
                                        setSubmenuOpenOnLeft(spaceOnRight < 240);
                                      }
                                      setActiveProviderSubmenu((prev) => (prev === p.id ? null : p.id));
                                    } else {
                                      setProviderDropdown(false);
                                      setActiveProviderSubmenu(null);
                                    }
                                    setAiNotInstalledAlert(null);
                                  }}
                                  title={
                                    !isInstalled
                                      ? `CLI "${p.cliCommand}" não instalado. Clique para instalar no terminal (${p.installGuide})`
                                      : undefined
                                  }
                                  style={{
                                    padding: '7px 10px',
                                    color: themeTokens.textPrimary,
                                    fontSize: 12,
                                    fontFamily: 'Poppins, sans-serif',
                                    fontWeight: isSelected ? '600' : '400',
                                    cursor: 'pointer',
                                    borderRadius: 6,
                                    whiteSpace: 'nowrap',
                                    background: isSelected
                                      ? hexToRgba(accentColor, 0.15)
                                      : isOpen
                                      ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')
                                      : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                    opacity: isInstalled ? 1 : 0.7,
                                    transition: 'background 0.15s ease, opacity 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected && !isOpen) {
                                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected && !isOpen) {
                                      e.currentTarget.style.background = 'transparent';
                                    }
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                    {renderAiIcon(p.id, 15, undefined, !!aiUpdatesAvailable[p.id]?.hasUpdate)}
                                    <span>{p.name}</span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {isInstalled && aiUpdatesAvailable[p.id]?.hasUpdate && (
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleUpdateCliInTerminal(p.id);
                                        }}
                                        title={`Atualizar ${p.name} para v${aiUpdatesAvailable[p.id]?.latestVersion || 'nova versão'}`}
                                        style={{
                                          fontSize: 10,
                                          padding: '2px 7px',
                                          borderRadius: 4,
                                          background: accentColor,
                                          border: 'none',
                                          boxShadow: 'none',
                                          color: '#fff',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 4,
                                          cursor: 'pointer',
                                          fontWeight: 400,
                                          transition: 'opacity 0.15s ease',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                                        onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                                      >
                                        <ArrowUpCircle size={10} strokeWidth={2} />
                                        <span>Atualizar</span>
                                      </button>
                                    )}
                                    {isInstalled && !p.requiresLogin && (
                                      <span
                                        style={{
                                          fontSize: 9.5,
                                          padding: '2px 6px',
                                          borderRadius: 4,
                                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                                          color: themeTokens.textSecondary,
                                          fontFamily: 'Poppins, sans-serif',
                                        }}
                                        title="Roda localmente sem necessidade de login na nuvem"
                                      >
                                        Local
                                      </span>
                                    )}

                                    {!isInstalled && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleInstallCliInTerminal(p);
                                          }}
                                          title={`Executar instalação no terminal: ${p.installGuide}`}
                                          style={{
                                            fontSize: 10,
                                            padding: '2px 7px',
                                            borderRadius: 4,
                                            background: accentColor,
                                            border: 'none',
                                            color: '#fff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            fontWeight: 500,
                                            fontFamily: 'Poppins, sans-serif',
                                            cursor: 'pointer',
                                            boxShadow: `0 2px 6px ${hexToRgba(accentColor, 0.3)}`,
                                          }}
                                        >
                                          <SquareTerminal size={10} />
                                          <span>Instalar</span>
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenExternalLink(p.installUrl);
                                          }}
                                          title="Abrir página oficial de download no navegador"
                                          style={{
                                            fontSize: 10,
                                            padding: '3px 5px',
                                            borderRadius: 4,
                                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                                            border: 'none',
                                            color: themeTokens.textSecondary,
                                            display: 'flex',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          <ExternalLink size={10} />
                                        </button>
                                      </div>
                                    )}

                                    {/* Small Switch for Orchestrator Selection */}
                                    {isOrchestratorActive && (
                                      <MiniSwitch
                                        checked={isOrchestrated}
                                        disabled={!isInstalled}
                                        accentColor={accentColor}
                                        onChange={() => {
                                          setOrchestratedProviders((prev) => ({
                                            ...prev,
                                            [p.id]: !prev[p.id],
                                          }));
                                        }}
                                      />
                                    )}

                                    {/* Arrow to toggle models submenu on click - only if installed */}
                                    {isInstalled && modelList.length > 0 && (
                                      <div
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (providerDropdownRef.current) {
                                            const rect = providerDropdownRef.current.getBoundingClientRect();
                                            const spaceOnRight = window.innerWidth - (rect.left + 220);
                                            setSubmenuOpenOnLeft(spaceOnRight < 240);
                                          }
                                          setActiveProviderSubmenu((prev) => (prev === p.id ? null : p.id));
                                        }}
                                        title="Ver opções de modelos"
                                        style={{
                                          padding: '2px 3px',
                                          borderRadius: 4,
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          background: isOpen ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)') : 'transparent',
                                          cursor: 'pointer',
                                          transition: 'all 0.15s ease',
                                        }}
                                      >
                                        <ChevronRight
                                          size={11}
                                          color={isOpen ? themeTokens.textPrimary : themeTokens.textSecondary}
                                          style={{
                                            opacity: isOpen ? 1 : 0.6,
                                            transform: isOpen ? 'rotate(90deg)' : (submenuOpenOnLeft ? 'rotate(180deg)' : 'none'),
                                            transition: 'transform 0.15s ease',
                                          }}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}

                            {/* Submenu on Click with AI models - anchored to bottom: 0 to never cut off */}
                            {(() => {
                              if (!activeProviderSubmenu) return null;
                              const targetProvider = AI_PROVIDERS.find((p) => p.id === activeProviderSubmenu);
                              if (!targetProvider) return null;
                              const isTargetInstalled = installedClis[targetProvider.id] ?? true;
                              if (!isTargetInstalled) return null;

                              const dynamicList = activeModels[targetProvider.id]?.models || [];
                              const fallbackList = (targetProvider.models || []).map((mName) => ({
                                id: mName,
                                label: mName,
                              }));
                              const modelList = dynamicList.length > 0 ? dynamicList : fallbackList;
                              if (modelList.length === 0) return null;

                              return (
                                <div
                                  ref={(el) => {
                                    if (el && !submenuOpenOnLeft) {
                                      const rect = el.getBoundingClientRect();
                                      if (rect.right > window.innerWidth - 8) {
                                        setSubmenuOpenOnLeft(true);
                                      }
                                    }
                                  }}
                                  style={{
                                    position: 'absolute',
                                    left: submenuOpenOnLeft ? 'auto' : 'calc(100% + 4px)',
                                    right: submenuOpenOnLeft ? 'calc(100% + 4px)' : 'auto',
                                    bottom: 0,
                                    background: themeTokens.bgCardSecondary,
                                    borderRadius: 10,
                                    border: `1px solid ${themeTokens.border}`,
                                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                                    padding: 6,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2,
                                    zIndex: 100002,
                                    minWidth: 160,
                                    width: 'max-content',
                                    maxWidth: 240,
                                    maxHeight: 'min(360px, calc(100vh - 120px))',
                                    overflowY: 'auto',
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div style={{ padding: '3px 8px 5px', fontSize: 10, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                    Modelos {targetProvider.name}
                                  </div>
                                  {modelList.map((m) => {
                                    const currentId = activeModels[targetProvider.id]?.currentModelId;
                                    const currentLabel = activeModels[targetProvider.id]?.currentModel;
                                    const isCurrent = (targetProvider.id === selectedAiProvider) && (currentId === m.id || currentLabel === m.label || (selectedModel && (selectedModel === m.id || selectedModel === m.label)));

                                    return (
                                      <div
                                        key={m.id}
                                        onClick={() => {
                                          handleSelectModel(m, targetProvider.id);
                                        }}
                                        style={{
                                          padding: '6px 10px',
                                          borderRadius: 6,
                                          cursor: 'pointer',
                                          background: isCurrent ? hexToRgba(accentColor, 0.15) : 'transparent',
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 8,
                                          transition: 'background 0.15s ease',
                                          whiteSpace: 'nowrap',
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isCurrent) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
                                        }}
                                        onMouseLeave={(e) => {
                                          if (!isCurrent) e.currentTarget.style.background = 'transparent';
                                        }}
                                      >
                                        {isCurrent ? <Check size={12} color={accentColor} style={{ flexShrink: 0 }} /> : <div style={{ width: 12, flexShrink: 0 }} />}
                                        <span
                                          style={{
                                            fontSize: 12,
                                            fontFamily: 'Poppins, sans-serif',
                                            fontWeight: isCurrent ? 500 : 400,
                                            color: isCurrent ? accentColor : themeTokens.textPrimary,
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {formatModelDisplayName(m.label) || m.label}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              );
                            })()}
                          </div>
                        )}
                      </div>

                      {/* Select AI Mode (Auto, Plan, Agent, Ask) Pill & Dropdown */}
                      <div style={{ position: 'relative', flexShrink: 0 }} ref={aiModeDropdownRef}>
                        <div
                          onClick={() => setAiModeDropdown(!aiModeDropdown)}
                          title="Alternar Modo da IA (Auto Mode, Planejamento, Agente, Perguntar)"
                          style={{
                            height: 26,
                            paddingLeft: 7,
                            paddingRight: 7,
                            borderRadius: 5,
                            background: aiMode === 'auto'
                              ? (isEffectiveDark ? 'rgba(59, 130, 246, 0.18)' : 'rgba(59, 130, 246, 0.12)')
                              : aiMode === 'plan'
                              ? (isEffectiveDark ? 'rgba(234, 179, 8, 0.18)' : 'rgba(234, 179, 8, 0.12)')
                              : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0'),
                            border: 'none',
                            color: aiMode === 'auto' ? '#60a5fa' : aiMode === 'plan' ? '#facc15' : themeTokens.textPrimary,
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            gap: 4,
                            display: 'flex',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          <span
                            style={{
                              fontSize: 11,
                              fontFamily: 'Poppins, sans-serif',
                              fontWeight: 500,
                            }}
                          >
                            {AI_MODES.find((m) => m.id === aiMode)?.shortName || 'Auto'}
                          </span>
                          <ChevronUp
                            size={10}
                            style={{
                              transform: aiModeDropdown ? 'rotate(0deg)' : 'rotate(180deg)',
                              transition: 'transform 0.15s ease',
                              opacity: 0.7,
                            }}
                          />
                        </div>

                        {/* AI Mode Dropdown Menu */}
                        {aiModeDropdown && (
                          <div
                            ref={clampPopupToViewport}
                            style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 8px)',
                              left: 0,
                              background: themeTokens.bgCardSecondary,
                              border: `1px solid ${themeTokens.border}`,
                              borderRadius: 8,
                              padding: 6,
                              minWidth: 260,
                              zIndex: 100000,
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.6)',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 4,
                            }}
                          >
                            <div style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                              Modo de execução
                            </div>
                            {AI_MODES.map((m) => {
                              const isSelected = aiMode === m.id;
                              return (
                                <div
                                  key={m.id}
                                  onClick={() => {
                                    setAiMode(m.id);
                                    setAiModeDropdown(false);
                                    setToastMessage(`Modo: ${m.name}`);
                                  }}
                                  style={{
                                    padding: '7px 9px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    background: isSelected ? hexToRgba(accentColor, 0.15) : 'transparent',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2,
                                    transition: 'background 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                    <span style={{ fontSize: 12, fontWeight: 500, color: themeTokens.textPrimary }}>
                                      {m.name}
                                    </span>
                                    {isSelected && <Check size={12} color={accentColor} />}
                                  </div>
                                  <div style={{ fontSize: 10.5, color: themeTokens.textSecondary, lineHeight: '14px' }}>
                                    {m.description}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Controls: AI Usage Quota Badge + Circular Send Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {/* AI Usage Quota Badge */}
                      {(() => {
                        const currentQuota = aiQuotas[selectedAiProvider] || aiQuotas.claude || DEFAULT_AI_QUOTAS.claude;
                        return (
                          <div
                            ref={quotaTooltipRef}
                            onClick={() => {
                              setQuotaTooltipOpen((prev) => !prev);
                              refreshAiQuotas();
                            }}
                            onMouseEnter={() => setQuotaTooltipOpen(true)}
                            onMouseLeave={() => setQuotaTooltipOpen(false)}
                            title="Clique para ver detalhes de uso e reset das quotas de IA"
                            style={{
                              position: 'relative',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'flex-end',
                              lineHeight: 1.05,
                              cursor: 'pointer',
                              userSelect: 'none',
                              flexShrink: 0,
                              padding: '2px 3px',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                              <span
                                style={{
                                  fontSize: 8,
                                  fontWeight: 700,
                                  color: accentColor,
                                  fontFamily: 'Poppins, -apple-system, sans-serif',
                                }}
                                title="Diário"
                              >
                                {selectedAiProvider === 'claude' ? '5h' : 'D'}
                              </span>
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  color: currentQuota.dailyPercent === 0 ? '#ef4444' : currentQuota.dailyPercent <= 15 ? '#f97316' : themeTokens.textPrimary,
                                  fontFamily: 'Poppins, -apple-system, sans-serif',
                                  letterSpacing: '-0.02em',
                                }}
                              >
                                {currentQuota.dailyPercent}%
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
                              <span
                                style={{
                                  fontSize: 8,
                                  fontWeight: 700,
                                  color: accentColor,
                                  fontFamily: 'Poppins, -apple-system, sans-serif',
                                }}
                                title={selectedAiProvider === 'claude' ? 'Semanal (7 dias)' : 'Semanal'}
                              >
                                {selectedAiProvider === 'claude' ? 'Sem' : 'S'}
                              </span>
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 700,
                                  color: currentQuota.weeklyPercent === 0 ? '#ef4444' : currentQuota.weeklyPercent <= 15 ? '#f97316' : themeTokens.textPrimary,
                                  fontFamily: 'Poppins, -apple-system, sans-serif',
                                  letterSpacing: '-0.02em',
                                }}
                              >
                                {currentQuota.weeklyPercent}%
                              </span>
                            </div>

                            {/* Hover / Click Popup: fundo adaptativo do sistema, sem bordas, sombra suave */}
                            {quotaTooltipOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute',
                                  bottom: 34,
                                  right: 0,
                                  background: themeTokens.bgCardSecondary,
                                  border: `1px solid ${themeTokens.border}`,
                                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                                  borderRadius: 10,
                                  padding: '12px 14px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 10,
                                  zIndex: 99999,
                                  minWidth: 295,
                                  width: 'max-content',
                                  maxWidth: 340,
                                  boxSizing: 'border-box',
                                  pointerEvents: 'auto',
                                }}
                              >
                                {/* Header */}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    borderBottom: `1px solid ${themeTokens.border}`,
                                    paddingBottom: 8,
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                    {selectedAiProvider === 'claude' && <ClaudeIcon size={15} />}
                                    {selectedAiProvider === 'antigravity' && <AntigravityIcon size={15} />}
                                    {selectedAiProvider === 'codex' && <CodexIcon size={15} />}
                                    {selectedAiProvider === 'gemini' && <GeminiIcon size={15} />}
                                    {selectedAiProvider === 'ollama' && <OllamaIcon size={15} />}
                                    <span style={{ fontSize: 12, fontWeight: 600, color: themeTokens.textPrimary, fontFamily: 'Poppins, sans-serif' }}>
                                      {AI_PROVIDERS.find((p) => p.id === selectedAiProvider)?.name || 'IA'}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: 9.5,
                                      color: themeTokens.textSecondary,
                                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                                      padding: '2px 7px',
                                      borderRadius: 4,
                                      fontWeight: 500,
                                      fontFamily: 'Poppins, sans-serif',
                                    }}
                                  >
                                    Quota Restante
                                  </span>
                                </div>

                                {/* Daily / Session Quota */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, fontFamily: 'Poppins, sans-serif' }}>
                                    <span style={{ color: themeTokens.textSecondary }}>
                                      {selectedAiProvider === 'claude' ? 'Sessão atual (5h):' : 'Limite diário:'}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span style={{ color: themeTokens.textPrimary, fontWeight: 700 }}>
                                        {currentQuota.dailyPercent}% disp.
                                      </span>
                                      <span style={{ fontSize: 10.5, color: themeTokens.textSecondary }}>
                                        ({100 - currentQuota.dailyPercent}% usado)
                                      </span>
                                    </div>
                                  </div>
                                  {/* Accent progress bar */}
                                  <div style={{ width: '100%', height: 4, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        width: `${Math.min(100, Math.max(0, currentQuota.dailyPercent))}%`,
                                        height: '100%',
                                        background: accentColor,
                                        borderRadius: 2,
                                        transition: 'width 0.3s ease',
                                      }}
                                    />
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 10.5,
                                      color: themeTokens.textSecondary,
                                      marginTop: 2,
                                      fontFamily: 'Poppins, sans-serif',
                                      whiteSpace: 'normal',
                                      wordBreak: 'break-word',
                                      lineHeight: '14px',
                                    }}
                                  >
                                    Reset {selectedAiProvider === 'claude' ? 'da sessão' : 'diário'}: {formatQuotaResetDisplay(currentQuota.dailyResetTime, currentQuota.dailyResetDay || 'Hoje', false)}
                                  </div>
                                </div>

                                {/* Weekly Quota */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, fontFamily: 'Poppins, sans-serif' }}>
                                    <span style={{ color: themeTokens.textSecondary }}>
                                      {selectedAiProvider === 'claude' ? 'Semana atual (7d):' : 'Limite semanal:'}
                                    </span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                      <span style={{ color: themeTokens.textPrimary, fontWeight: 700 }}>
                                        {currentQuota.weeklyPercent}% disp.
                                      </span>
                                      <span style={{ fontSize: 10.5, color: themeTokens.textSecondary }}>
                                        ({100 - currentQuota.weeklyPercent}% usado)
                                      </span>
                                    </div>
                                  </div>
                                  {/* Accent progress bar */}
                                  <div style={{ width: '100%', height: 4, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        width: `${Math.min(100, Math.max(0, currentQuota.weeklyPercent))}%`,
                                        height: '100%',
                                        background: accentColor,
                                        borderRadius: 2,
                                        transition: 'width 0.3s ease',
                                      }}
                                    />
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 10.5,
                                      color: themeTokens.textSecondary,
                                      marginTop: 2,
                                      fontFamily: 'Poppins, sans-serif',
                                      whiteSpace: 'normal',
                                      wordBreak: 'break-word',
                                      lineHeight: '14px',
                                    }}
                                  >
                                    Reset semanal: {formatQuotaResetDisplay(currentQuota.weeklyResetTime, currentQuota.weeklyResetDay || 'Sexta-feira', true)}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Circular Send / Cancel Button */}
                      {(() => {
                        if (isAiExecuting) {
                          return (
                            <button
                              type="button"
                              onClick={handleCancelAiExecution}
                              title="Interromper geração (Ctrl+C / Esc)"
                              style={{
                                width: 24,
                                height: 24,
                                background: isEffectiveDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.14)',
                                borderRadius: 61,
                                border: '1px solid rgba(239, 68, 68, 0.5)',
                                outline: 'none',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'pointer',
                                flexShrink: 0,
                                transition: 'all 0.15s ease',
                                boxShadow: '0 0 10px rgba(239, 68, 68, 0.25)',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.background = '#ef4444';
                                const inner = e.currentTarget.querySelector('.stop-square-indicator') as HTMLElement;
                                if (inner) inner.style.background = '#ffffff';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.background = isEffectiveDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.14)';
                                const inner = e.currentTarget.querySelector('.stop-square-indicator') as HTMLElement;
                                if (inner) inner.style.background = '#ef4444';
                              }}
                            >
                              <div
                                className="stop-square-indicator"
                                style={{
                                  width: 9,
                                  height: 9,
                                  borderRadius: 2,
                                  background: '#ef4444',
                                  transition: 'background 0.15s ease',
                                }}
                              />
                            </button>
                          );
                        }

                        const canSubmit = (askPrompt.trim().length > 0 || attachedFiles.length > 0 || attachedImages.length > 0 || Boolean(attachedTask)) && !isAiExecuting;
                        const isSendActive = canSubmit;
                        return (
                          <button
                            type="submit"
                            disabled={!canSubmit}
                            title="Enviar mensagem"
                            style={{
                              width: 24,
                              height: 24,
                              background: isSendActive ? chatAccentColor : (isEffectiveDark ? '#333333' : '#e2e8f0'),
                              borderRadius: 61,
                              border: 'none',
                              outline: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isSendActive ? getContrastTextColor(chatAccentColor) : (isEffectiveDark ? '#666666' : '#94a3b8'),
                              cursor: isSendActive ? 'pointer' : 'default',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <ArrowRight size={13} strokeWidth={2.5} color={isSendActive ? getContrastTextColor(chatAccentColor) : (isEffectiveDark ? '#666666' : '#94a3b8')} />
                          </button>
                        );
                      })()}
                    </div>
                  </div>
                </form>
              </div>
            );
          })()}
              </div>
            </>
          )}
        </div>

      {/* 2.2 Projetos Container (Pré-carregado e mantido vivo na memória para abertura instantânea) */}
      <div
        style={{
          alignSelf: 'stretch',
          width: '100%',
          minWidth: 0,
          minHeight: 0,
          flex: '1 1 0',
          display: activeTab === 'projetos' ? 'flex' : 'none',
          overflow: 'hidden',
        }}
      >
        <ProjectsSchedulerView
          workspacePath={workspacePath}
          repoName={gitRepoName}
          onSelectWorkspace={handleSelectWorkspace}
          accentColor={accentColor}
          isEffectiveDark={isEffectiveDark}
          themeTokens={themeTokens}
          selectedAiProvider={selectedAiProvider}
          selectedModel={selectedModel}
          onSelectAiProvider={handleSwitchAiProvider}
          onSelectModel={handleSelectModel}
          installedClis={installedClis}
          activeModels={activeModels}
          onInstallAiCli={handleInstallCliInTerminal}
        />
      </div>

      {/* 2.3 Orchestration Container (mantido vivo na memória para não derrubar CLIs abertos ao trocar de aba) */}
      <div
        style={{
          alignSelf: 'stretch',
          width: '100%',
          minWidth: 0,
          minHeight: 0,
          flex: '1 1 0',
          display: activeTab === 'orchestration' ? 'flex' : 'none',
          overflow: 'hidden',
        }}
      >
        <OrchestrationCanvas
          accentColor={accentColor}
          isEffectiveDark={isEffectiveDark}
          themeTokens={themeTokens}
          workspacePath={workspacePath}
          currentUser={githubUser ? { login: githubUser.login, avatarUrl: githubUser.avatarUrl || avatarImg } : null}
          selectedAiProvider={selectedAiProvider}
          selectedModel={selectedModel}
          installedClis={installedClis}
          activeModels={activeModels}
          onSelectAiProvider={handleSwitchAiProvider}
          onSelectModel={handleSelectModel}
          onSelectWorkspace={handleSelectWorkspace}
          isTabActive={activeTab === 'orchestration'}
          onToast={(msg) => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 3000);
          }}
        />
      </div>

      {/* 2.4 Daily Container (mantido vivo na memória para não perder o chat de IA ao trocar de aba) */}
      <div
        style={{
          alignSelf: 'stretch',
          width: '100%',
          minWidth: 0,
          minHeight: 0,
          flex: '1 1 0',
          display: activeTab === 'daily' ? 'flex' : 'none',
          overflow: 'hidden',
        }}
      >
        <DailySchedulerView
          workspacePath={workspacePath}
          repoName={gitRepoName}
          activeProject={activeHeaderProject}
          availableProjects={headerProjectsList}
          accentColor={accentColor}
          isEffectiveDark={isEffectiveDark}
          themeTokens={themeTokens}
          selectedAiProvider={selectedAiProvider}
          selectedModel={selectedModel}
          onSelectWorkspace={handleSelectWorkspace}
          installedClis={installedClis}
          activeModels={activeModels}
          onSelectAiProvider={handleSwitchAiProvider}
          onSelectModel={handleSelectModel}
          onToast={(msg) => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 3000);
          }}
        />
      </div>

      {/* 2.5 Design Container (editor próprio + sala LAN) */}
      {/* Fica montado depois da primeira abertura: a IA continua gerando mesmo se o usuário for para outra tela */}
      {designMounted && (
      <div style={{ display: activeTab === 'design' ? 'contents' : 'none' }}>
        <DesignStudioView
          isActive={activeTab === 'design'}
          onAiTaskDone={handleDesignAiDone}
          workspacePath={workspacePath}
          repoName={gitRepoName}
          activeProject={activeHeaderProject}
          availableProjects={headerProjectsList}
          onSelectWorkspace={handleSelectWorkspace}
          accentColor={accentColor}
          isEffectiveDark={isEffectiveDark}
          themeTokens={themeTokens}
          selectedAiProvider={selectedAiProvider}
          selectedModel={selectedModel}
          onSelectAiProvider={handleSwitchAiProvider}
          onSelectModel={handleSelectModel}
          installedClis={installedClis}
          activeModels={activeModels}
          onInstallAiCli={handleInstallCliInTerminal}
          onToast={(msg) => setToastMessage(msg)}
          onSendToChat={(text) => {
            // Abre o chat de IA da IDE com o prompt preenchido (o usuário revisa e envia)
            setActiveTab('ide');
            setShowAiPanel(true);
            setTimeout(() => {
              setAskPrompt(text);
              promptEditorRef.current?.setValue(text);
              promptEditorRef.current?.focus();
            }, 350);
          }}
        />
      </div>
      )}

      {/* 2.6 CLI Terminal Workspace (Navegação de arquivos + Terminal com abas) */}
      {activeTab === 'cli' && (
        <CliTerminalView
          dockTabs={(() => {
            const problemsCount = allProblems.length > 0 ? allProblems.length : (editorErrors + editorWarnings);
            return [
              { id: 'problems', label: 'Problems', count: problemsCount },
              { id: 'output', label: 'Output', count: outputLines.length || undefined },
              { id: 'debug', label: 'Debug console', count: debugHistory.length },
              { id: 'terminal', label: 'Terminal' },
              { id: 'ports', label: 'Ports', count: projectServers.length || undefined },
            ];
          })()}
          renderDockContent={renderIdeDockTab}
          problemsSummary={{ errors: allProblems.filter((p) => p.severity === 'error').length, warnings: allProblems.filter((p) => p.severity === 'warning').length }}
          problemsPrompt={(() => {
            if (!allProblems.length) return '';
            const sorted = [...allProblems].sort((a, b) => b.severityCode - a.severityCode);
            const lines = sorted.slice(0, 40).map((p) => `- ${p.relPath || p.filePath}:${p.line}:${p.column} [${p.source || 'editor'}${p.code ? ' ' + p.code : ''}] ${p.severity === 'error' ? 'erro' : 'aviso'}: ${p.message.replace(/\s+/g, ' ').slice(0, 220)}`);
            return `Resolva estes problemas do projeto (${allProblems.length} no total${allProblems.length > 40 ? ', mostrando os 40 mais graves' : ''}). Corrija a causa sem mudar o comportamento e rode a checagem de novo no final:\n${lines.join('\n')}`;
          })()}
          workspacePath={workspacePath}
          fileTree={fileTree}
          expandedFolders={expandedFolders}
          onToggleFolder={(path) => {
            setExpandedFolders((prev) => {
              const next = new Set(prev);
              if (next.has(path)) next.delete(path);
              else next.add(path);
              return next;
            });
          }}
          activeFileId={activeFile?.path || activeFile?.id}
          onOpenFile={(path, name) => {
            handleOpenFile(path, name);
          }}
          onOpenFolderDialog={handleOpenFolderDialog}
          onOpenFileDialog={handleOpenFileDialog}
          onCreateNewFile={handleCreateNewFile}
          onCreateNewFolder={handleCreateNewFolder}
          onRefreshTree={() => loadWorkspaceTree(workspacePath)}
          themeTokens={themeTokens}
          isEffectiveDark={isEffectiveDark}
          accentColor={accentColor}
          selectedAiProvider={selectedAiProvider}
          terminalSessions={cliTerminalSessions}
          setTerminalSessions={setCliSessions}
          activeSessionId={cliActiveSessionId}
          setActiveSessionId={setCliActiveSessionId}
          onNewSession={(type, name, cmd) => handleNewTerminalSession(type, name, cmd, 'cli')}
          onCloseSession={handleKillTerminalSession}
          terminalFontSize={terminalFontSize}
          onSetTerminalFontSize={setTerminalFontSize}
          currentBranch={currentBranch}
          gitRepoName={gitRepoName}
          onToast={(msg) => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 2500);
          }}
          onOpenBranchModal={() => {
            refreshGitBranches();
            setIsBranchModalOpen(true);
          }}
          onOpenIssueDetails={handleOpenIssueSidesheet}
          onOpenIssuesModal={() => {
            refreshGitHubIssues();
            setIsIssuesModalOpen(true);
          }}
          gitIssues={gitIssues}
          refreshGitHubIssues={refreshGitHubIssues}
          onSyncGit={handleSyncGit}
          isSyncingGit={isSyncingGit}
          gitModifiedCount={gitModifiedCount}
          onGenerateCommitMessage={handleGenerateCommitMessage}
          onStartReview={(files, index) => {
            if (files && files.length > 0) {
              handleStartReview(files, index || 0);
            }
          }}
        />
      )}

      {/* 2.7 Container vazio para outras abas */}
      {activeTab !== 'ide' && activeTab !== 'projetos' && activeTab !== 'orchestration' && activeTab !== 'daily' && activeTab !== 'design' && activeTab !== 'cli' && (
        <div style={{ alignSelf: 'stretch', flex: '1 1 0', background: 'black', borderRadius: 10, border: 'none' }} />
      )}

      {/* ============================================================ */}
      {/* 3. BOTTOM STATUS BAR (RESPONSIVE NO-WRAP LAYOUT)             */}
      {/* ============================================================ */}
      {showStatusBar && !isZenMode && activeTab === 'ide' && (
        <div
          style={{
            alignSelf: 'stretch',
            justifyContent: 'space-between',
            alignItems: 'center',
            display: 'inline-flex',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            gap: 5,
          }}
        >
        {/* Left Segment: Branch + Status + Sprint + Issues */}
        <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 5, display: 'flex', flexShrink: 0, whiteSpace: 'nowrap' }}>
          <div style={{ justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex', flexShrink: 0 }}>
            {/* Accent Left Indicator Block (Toggles Terminal) */}
            <div
              onClick={() => {
                if (terminalHeight === 0) {
                  setTerminalHeight(260);
                } else {
                  setTerminalHeight(0);
                }
              }}
              title={terminalHeight === 0 ? "Abrir Terminal Integrado" : "Minimizar Terminal"}
              style={{
                width: 38,
                alignSelf: 'stretch',
                background: accentColor,
                borderTopLeftRadius: 10,
                borderBottomLeftRadius: 10,
                border: 'none',
                justifyContent: 'center',
                alignItems: 'center',
                display: 'flex',
                flexShrink: 0,
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.9')}
              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
            >
              <TerminalIcon size={16} color={accentTextColor} />
            </div>

            {/* Status Card Left */}
            <div
              style={{
                padding: 5,
                background: themeTokens.bgCard,
                border: 'none',
                borderLeft: 'none',
                borderTopRightRadius: 10,
                borderBottomRightRadius: 10,
                justifyContent: 'center',
                alignItems: 'center',
                gap: 5,
                display: 'flex',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <div
                onClick={() => {
                  refreshGitBranches();
                  setIsBranchModalOpen(true);
                }}
                title="Gerenciar Branches e Git"
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  borderRadius: 5,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 6,
                  display: 'flex',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <GitBranch size={13} color={themeTokens.textSecondary} />
                <div style={{ color: themeTokens.textSecondary, fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {gitRepoName.split('/').pop() || 'aura-dev'}
                </div>
                <div style={{ color: accentColor, fontSize: 12, fontFamily: 'Poppins', fontWeight: '500', whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentBranch || 'main'}
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSyncGit();
                  }}
                  title="Sincronizar com GitHub (Pull & Push)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: 2,
                    borderRadius: 3,
                  }}
                >
                  <RefreshCw
                    size={12}
                    color={accentColor}
                    style={{
                      animation: isSyncingGit ? 'spin 1s linear infinite' : 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ width: 1, height: 16, background: themeTokens.border, flexShrink: 0 }} />

              <div
                onClick={() => {
                  if (terminalHeight === 0) setTerminalHeight(260);
                  setActiveTermTab('output');
                }}
                title={`Erros: ${editorErrors} | Avisos: ${editorWarnings} (Clique para ver no terminal)`}
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  borderRadius: 5,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 6,
                  display: 'flex',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <XCircle size={13} color={editorErrors > 0 ? '#ef4444' : themeTokens.textSecondary} />
                <div style={{ color: editorErrors > 0 ? '#ef4444' : themeTokens.textSecondary, fontSize: 12, fontFamily: 'Poppins', fontWeight: editorErrors > 0 ? '500' : '400' }}>
                  {editorErrors}
                </div>
                <AlertTriangle size={12} color={editorWarnings > 0 ? '#f59e0b' : themeTokens.textSecondary} />
                <span style={{ color: editorWarnings > 0 ? '#f59e0b' : themeTokens.textSecondary, fontSize: 12, fontFamily: 'Poppins', fontWeight: editorWarnings > 0 ? '500' : '400' }}>
                  {editorWarnings}
                </span>
              </div>
            </div>
          </div>

          {/* Sprint & Issues Card */}
          <div
            style={{
              padding: 5,
              background: themeTokens.bgCard,
              borderRadius: 10,
              border: `1px solid ${themeTokens.border}`,
              justifyContent: 'center',
              alignItems: 'center',
              gap: 5,
              display: 'flex',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <div style={{ alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'center', gap: 5, display: 'flex', whiteSpace: 'nowrap' }}>
              <div
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  borderRadius: 5,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 5,
                  display: 'flex',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <div style={{ color: themeTokens.textSecondary, fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>{workspaceGitInfo?.sprintTitle || 'Sprint 2'} -</div>
                <div style={{ color: accentColor, fontSize: 12, fontFamily: 'Poppins', fontWeight: '500', whiteSpace: 'nowrap' }}>{workspaceGitInfo?.sprintRemaining || '7 days'}</div>
              </div>

              <div style={{ width: 1, height: 16, background: themeTokens.border, flexShrink: 0 }} />

              <div
                onClick={() => {
                  refreshGitHubIssues();
                  setIsIssuesModalOpen(true);
                }}
                title="Abrir Issues do GitHub"
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  borderRadius: 5,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 5,
                  display: 'flex',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ color: themeTokens.textSecondary, fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>Issues</div>
                <div style={{ color: accentColor, fontSize: 12, fontFamily: 'Poppins', fontWeight: '500', whiteSpace: 'nowrap' }}>
                  {(() => {
                    const openCount = gitIssues.filter((i) => (i.state || 'open').toLowerCase() === 'open').length;
                    if (workspaceGitInfo?.issuesCount !== undefined && workspaceGitInfo.issuesCount > 0) {
                      return `${workspaceGitInfo.issuesCount} abertas`;
                    }
                    return `${openCount} abertas`;
                  })()}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Segment: Position Info + Accent "Aura Dev" Button */}
        <div
          style={{
            background: themeTokens.bgCard,
            overflow: 'hidden',
            borderRadius: 10,
            border: `1px solid ${themeTokens.border}`,
            justifyContent: 'center',
            alignItems: 'center',
            display: 'flex',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 5,
              border: 'none',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              display: 'flex',
              whiteSpace: 'nowrap',
            }}
          >
            {/* Git Blame / Author */}
            <div
              onClick={() => {
                if (workspaceGitInfo?.activeFileBlame) {
                  navigator.clipboard.writeText(workspaceGitInfo.activeFileBlame);
                  setToastMessage(`Git Blame copiado: ${workspaceGitInfo.activeFileBlame}`);
                }
              }}
              title="Git Blame do arquivo atual (Clique para copiar)"
              style={{
                color: themeTokens.textSecondary,
                fontSize: 11.5,
                fontFamily: 'Poppins',
                fontWeight: '400',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {workspaceGitInfo?.activeFileBlame || workspaceGitInfo?.authorBlame || 'Walancy (recently)'}
            </div>

            {/* Monaco Cursor Position: Ln, Col */}
            <div
              onClick={() => {
                if (editorInstanceRef.current) {
                  editorInstanceRef.current.focus();
                  editorInstanceRef.current.trigger('keyboard', 'editor.action.gotoLine', null);
                }
              }}
              title="Ir para Linha/Coluna (Clique para navegar)"
              style={{
                color: isEffectiveDark ? '#888888' : '#666666',
                fontSize: 11.5,
                fontFamily: 'Poppins',
                fontWeight: '400',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              Ln {cursorPosition.line}, Col {cursorPosition.col}
            </div>

            {/* Indentation (Spaces / Tabs) */}
            <div
              onClick={() => {
                const nextSize = indentationSize === 2 ? 4 : indentationSize === 4 ? 8 : 2;
                setIndentationSize(nextSize);
                if (editorInstanceRef.current) {
                  editorInstanceRef.current.getModel()?.updateOptions({ tabSize: nextSize, insertSpaces: true });
                }
                setToastMessage(`Tabulação alterada para Spaces: ${nextSize}`);
              }}
              title="Configurar Indentação (Clique para alternar 2 / 4 / 8)"
              style={{
                color: isEffectiveDark ? '#888888' : '#666666',
                fontSize: 11.5,
                fontFamily: 'Poppins',
                fontWeight: '400',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              Spaces: {indentationSize}
            </div>

            {/* File Encoding */}
            <div
              title="Codificação de Caracteres: UTF-8"
              style={{
                color: isEffectiveDark ? '#888888' : '#666666',
                fontSize: 11.5,
                fontFamily: 'Poppins',
                fontWeight: '400',
                whiteSpace: 'nowrap',
                cursor: 'default',
              }}
            >
              UTF-8
            </div>

            {/* Line Ending LF/CRLF */}
            <div
              onClick={() => {
                const nextEol = lineEnding === 'LF' ? 'CRLF' : 'LF';
                setLineEnding(nextEol);
                if (editorInstanceRef.current) {
                  editorInstanceRef.current.getModel()?.setEOL(nextEol === 'LF' ? 0 : 1);
                }
                setToastMessage(`Fim de linha alterado para ${nextEol}`);
              }}
              title="Fim de Linha (Clique para alternar LF / CRLF)"
              style={{
                color: isEffectiveDark ? '#888888' : '#666666',
                fontSize: 11.5,
                fontFamily: 'Poppins',
                fontWeight: '400',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {lineEnding}
            </div>

            {/* Active Language */}
            <div
              onClick={() => {
                if (editorInstanceRef.current) {
                  editorInstanceRef.current.focus();
                  editorInstanceRef.current.trigger('keyboard', 'editor.action.changeLanguageMode', null);
                }
              }}
              title="Linguagem do Arquivo (Clique para alterar)"
              style={{
                color: isEffectiveDark ? '#888888' : '#666666',
                fontSize: 11.5,
                fontFamily: 'Poppins',
                fontWeight: '400',
                whiteSpace: 'nowrap',
                cursor: 'pointer',
              }}
            >
              {activeFile?.language ? (activeFile.language.charAt(0).toUpperCase() + activeFile.language.slice(1)) : 'TypeScript'}
            </div>
          </div>

          {/* Solid Accent Block "Aura Dev" (Toggles AI Chat & Focuses Input) */}
          <div
            onClick={() => {
              if (activeTab !== 'ide') {
                setActiveTab('ide');
              }
              setShowAiPanel((prev) => {
                const next = !prev;
                if (next) {
                  setTimeout(() => {
                    promptEditorRef.current?.focus();
                    inputRef.current?.focus();
                  }, 80);
                }
                return next;
              });
            }}
            title="Abrir Assistente Aura Dev"
            style={{
              alignSelf: 'stretch',
              paddingLeft: 14,
              paddingRight: 14,
              background: accentColor,
              border: 'none',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 6,
              display: 'flex',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.9')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
          >
            <div style={{ color: accentTextColor, fontSize: 12, fontFamily: 'Poppins', fontWeight: '600', whiteSpace: 'nowrap' }}>Aura Dev</div>
            <TerminalIcon size={14} color={accentTextColor} />
          </div>
        </div>
      </div>
    )}

        {/* File Explorer Right-Click Context Menu (VS Code / Cursor / Antigravity style) */}
        {fileContextMenu && (() => {
          const node = fileContextMenu.node;
          const isDir = node.isDirectory;
          const showTestGroup = isDir || isTestFileName(node.name);

          type MenuEntry =
            | { type: 'divider' }
            | { type: 'item'; icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean };

          const item = (
            icon: React.ReactNode,
            label: string,
            onClick: () => void,
            opts?: { danger?: boolean; disabled?: boolean }
          ): MenuEntry => ({ type: 'item', icon, label, onClick, danger: opts?.danger, disabled: opts?.disabled });
          const divider = (): MenuEntry => ({ type: 'divider' });

          const entries: MenuEntry[] = [];
          if (!isDir) {
            entries.push(item(<Columns size={13} />, 'Abrir ao Lado', () => handleCtxOpenToSide(node)));
            entries.push(item(<ExternalLink size={13} />, 'Abrir Com...', () => handleCtxOpenWith(node)));
          }
          entries.push(item(<FolderOpen size={13} />, 'Revelar no Finder', () => handleCtxRevealInFinder(node)));
          entries.push(item(<SquareTerminal size={13} />, 'Abrir no Terminal Integrado', () => handleCtxOpenInTerminal(node)));

          if (!isDir) {
            entries.push(divider());
            entries.push(item(<GitCompare size={13} />, 'Selecionar para Comparar', () => handleCtxSelectForCompare(node)));
            if (compareSelectionPath && compareSelectionPath !== node.path) {
              entries.push(item(<GitCompare size={13} />, 'Comparar com Selecionado', () => handleCtxCompareWithSelected(node)));
            }
            entries.push(divider());
            entries.push(item(<History size={13} />, 'Abrir Timeline', () => handleCtxOpenTimeline(node)));
          }

          entries.push(divider());
          entries.push(item(<Scissors size={13} />, 'Recortar', () => handleCtxCut(node)));
          entries.push(item(<Copy size={13} />, 'Copiar', () => handleCtxCopy(node)));
          entries.push(item(<ClipboardPaste size={13} />, 'Colar', () => handleCtxPaste(node), { disabled: !fileClipboard }));

          entries.push(divider());
          entries.push(item(<FileText size={13} />, 'Copiar Caminho', () => handleCtxCopyPath(node)));
          entries.push(item(<FileText size={13} />, 'Copiar Caminho Relativo', () => handleCtxCopyRelativePath(node)));

          if (showTestGroup) {
            entries.push(divider());
            entries.push(item(<Play size={13} />, 'Executar Testes', () => handleCtxRunTests(node, 'run')));
            entries.push(item(<Bug size={13} />, 'Depurar Testes', () => handleCtxRunTests(node, 'debug')));
            entries.push(item(<Layers size={13} />, 'Executar Testes com Cobertura', () => handleCtxRunTests(node, 'coverage')));
          }

          entries.push(divider());
          entries.push(item(<FilePlus size={13} />, 'Novo Arquivo...', () => handleCtxNewFile(node)));
          entries.push(item(<FolderPlus size={13} />, 'Nova Pasta...', () => handleCtxNewFolder(node)));

          entries.push(divider());
          entries.push(item(<Pencil size={13} />, 'Renomear...', () => handleCtxRename(node)));
          entries.push(item(<Trash2 size={13} />, 'Excluir', () => handleCtxDelete(node), { danger: true }));

          return (
            <div
              ref={(el) => {
                fileContextMenuRef.current = el;
                clampPopupToViewport(el);
              }}
              style={{
                position: 'fixed',
                top: fileContextMenu.y,
                left: fileContextMenu.x,
                minWidth: 215,
                maxWidth: 260,
                background: themeTokens.bgCardSecondary,
                border: '1px solid ' + themeTokens.border,
                borderRadius: 8,
                padding: '5px 0',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                zIndex: 999999,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {entries.map((entry, idx) =>
                entry.type === 'divider' ? (
                  <div key={idx} style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />
                ) : (
                  <div
                    key={idx}
                    onClick={() => {
                      if (!entry.disabled) entry.onClick();
                    }}
                    style={{
                      padding: '7px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      cursor: entry.disabled ? 'default' : 'pointer',
                      color: entry.disabled ? themeTokens.textMuted : entry.danger ? '#ef4444' : themeTokens.textPrimary,
                      opacity: entry.disabled ? 0.5 : 1,
                    }}
                    onMouseEnter={(e) => {
                      if (!entry.disabled) e.currentTarget.style.background = themeTokens.hoverBg;
                    }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <span style={{ display: 'flex', alignItems: 'center', color: entry.danger ? '#ef4444' : accentColor }}>
                      {entry.icon}
                    </span>
                    <span>{entry.label}</span>
                  </div>
                )
              )}
            </div>
          );
        })()}

        {/* Global Toast Notification (Auto-dismisses & click to dismiss) */}
        {toastMessage && (
          <div
            onClick={() => setToastMessage(null)}
            title="Clique para fechar notificação"
            style={{
              position: 'fixed',
              bottom: 40,
              right: 25,
              background: themeTokens.bgCardSecondary,
              color: themeTokens.textPrimary,
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'Poppins, sans-serif',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              border: 'none',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
            <span style={{ maxWidth: 360, lineHeight: '16px' }}>{toastMessage}</span>
            <X size={12} color={themeTokens.textSecondary} style={{ marginLeft: 6, flexShrink: 0 }} />
          </div>
        )}

        {/* Gerenciador de skills (botão no header) */}
        <SkillsModal
          isOpen={isSkillsModalOpen}
          onClose={() => setIsSkillsModalOpen(false)}
          isEffectiveDark={isEffectiveDark}
          accentColor={accentColor}
          accentContrastText={accentTextColor}
          onToast={(msg) => setToastMessage(msg)}
        />

        {/* Modal de Regras Globais da IA (CLAUDE.md / GEMINI.md / AGENTS.md / rules.md) */}
        <AiGlobalRulesModal
          isOpen={isAiGlobalRulesModalOpen}
          onClose={() => setIsAiGlobalRulesModalOpen(false)}
          isEffectiveDark={isEffectiveDark}
          accentColor={accentColor}
          accentContrastText={accentTextColor}
          selectedProvider={selectedAiProvider}
          onToast={(msg) => setToastMessage(msg)}
          onOpenSettings={() => setIsSettingsModalOpen(true)}
        />

        {/* sempre montado: o próprio painel anima a entrada/saída */}
        {(
          <NotificationCenterPanel
            open={isNotifOpen}
            items={notifCenter.items}
            onClose={() => setIsNotifOpen(false)}
            onRead={notifCenter.read}
            onReadAll={notifCenter.readAll}
            onRemove={notifCenter.remove}
            onClearHistory={notifCenter.clearHistory}
            onUpdateAi={handleUpdateCliInTerminal}
            onOpen={(n) => {
              notifCenter.read(n.id);
              if (n.patchNotesUrl) {
                if (window.electronAPI?.shell?.openExternal) {
                  window.electronAPI.shell.openExternal(n.patchNotesUrl);
                } else {
                  window.open(n.patchNotesUrl, '_blank', 'noopener,noreferrer');
                }
                logSystemActivity('notifications', 'Abrir patch notes da IA', n.projectName || 'Geral', {
                  id: n.id,
                  provider: n.provider,
                  url: n.patchNotesUrl,
                });
              }
              if (n.projectPath && n.projectPath.toLowerCase() !== (workspacePathRef.current || '').toLowerCase()) handleSelectWorkspace(n.projectPath, n.projectName);
              if (n.source) {
                setActiveTab(n.source === 'ide' ? 'ide' : n.source === 'cli' ? 'cli' : 'design');
                setIsNotifOpen(false);
              }
            }}
            accentColor={accentColor}
            isEffectiveDark={isEffectiveDark}
            themeTokens={themeTokens}
          />
        )}

        {/* Notificações flutuantes de conclusão de IA entre projetos */}
        <ProjectAiNotificationToast
          notifications={aiNotifications}
          onDismiss={(id) => setAiNotifications((prev) => prev.filter((n) => n.id !== id))}
          onNavigateToProject={(projectPath, repoName, source) => {
            if (source === 'design') {
              // volta ao projeto onde a IA gerou e abre o Design
              if (projectPath && projectPath.toLowerCase() !== (workspacePathRef.current || '').toLowerCase()) handleSelectWorkspace(projectPath, repoName);
              setActiveTab('design');
              return;
            }
            handleSelectWorkspace(projectPath, repoName);
            setActiveTab(source === 'ide' ? 'ide' : 'cli');
          }}
          accentColor={accentColor}
          isEffectiveDark={isEffectiveDark}
        />

        {/* Floating Zen Mode Escape Chip */}
        {isZenMode && (
          <div
            onClick={() => setIsZenMode(false)}
            title="Sair do Modo Zen (ou pressione Esc)"
            style={{
              position: 'fixed',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 999999,
              background: themeTokens.bgCardSecondary,
              border: `1px solid ${accentColor}`,
              borderRadius: 20,
              padding: '5px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              cursor: 'pointer',
              boxShadow: `0 4px 16px ${hexToRgba(accentColor, 0.35)}`,
              color: themeTokens.textPrimary,
              fontSize: 12,
              fontFamily: 'Poppins, sans-serif',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor }} />
            <span>Sair do Modo Zen</span>
            <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>(Esc)</span>
          </div>
        )}

        {/* Quick Open / Command Palette Modal (VS Code & Antigravity Style) */}
        {isQuickOpenOpen && (
          <QuickOpenModal
            onClose={() => setIsQuickOpenOpen(false)}
            quickInputPosition={quickInputPosition}
            themeTokens={themeTokens}
            isEffectiveDark={isEffectiveDark}
            accentColor={accentColor}
            containerRef={quickOpenContainerRef}
            inputRef={quickOpenInputRef}
            quickOpenQuery={quickOpenQuery}
            setQuickOpenQuery={setQuickOpenQuery}
            setQuickOpenSelectedIndex={setQuickOpenSelectedIndex}
            quickOpenSelectedIndex={quickOpenSelectedIndex}
            onKeyDown={handleQuickOpenKeyDown}
            visibleQuickOpenItems={visibleQuickOpenItems}
          />
        )}

        {/* Chat History & All Convos Modal (Antigravity Style) */}
        {chatHistoryModalOpen && (
          <ChatHistoryModal
            onClose={() => setChatHistoryModalOpen(false)}
            inputRef={chatHistoryInputRef}
            chatHistorySearch={chatHistorySearch}
            setChatHistorySearch={setChatHistorySearch}
            setChatHistorySelectedIndex={setChatHistorySelectedIndex}
            chatHistorySelectedIndex={chatHistorySelectedIndex}
            onKeyDown={handleChatHistoryKeyDown}
            selectableConvosList={selectableConvosList}
            currentConvo={currentConvo}
            runningConvos={runningConvos}
            visibleRecentConvos={visibleRecentConvos}
            recentConvos={recentConvos}
            chatHistoryShowAllRecent={chatHistoryShowAllRecent}
            setChatHistoryShowAllRecent={setChatHistoryShowAllRecent}
            onSelectSession={handleSelectAnySession}
            onDeleteSession={handleDeleteAnySession}
            formatTimeAgo={formatTimeAgo}
          />
        )}

        {/* Settings & Appearance Modal (VS Code & Antigravity Style) */}
        {isSettingsModalOpen && (
          <SettingsModal
            themeTokens={themeTokens}
            isEffectiveDark={isEffectiveDark}
            accentColor={accentColor}
            onClose={() => setIsSettingsModalOpen(false)}
            settingsActiveTab={settingsActiveTab}
            setSettingsActiveTab={setSettingsActiveTab}
            workspacePath={workspacePath}
            currentBranch={currentBranch}
            gitRepoName={gitRepoName}
            branchesList={branchesList}
            onCheckoutBranch={handleCheckoutBranch}
            onCreateBranch={handleCreateBranch}
            isCreatingBranch={isCreatingBranch}
            onSyncGit={handleSyncGit}
            isSyncingGit={isSyncingGit}
            onRefreshBranches={refreshGitBranches}
            onOpenBranchManager={() => {
              setSettingsActiveTab('workspace');
              refreshGitBranches();
            }}
            sidebarPosition={sidebarPosition}
            setSidebarPosition={setSidebarPosition}
            isCenteredLayout={isCenteredLayout}
            setIsCenteredLayout={setIsCenteredLayout}
            restoreLastWorkspace={restoreLastWorkspace}
            setRestoreLastWorkspace={setRestoreLastWorkspace}
            confirmBeforeClosingUnsaved={confirmBeforeClosingUnsaved}
            setConfirmBeforeClosingUnsaved={setConfirmBeforeClosingUnsaved}
            autoRefreshGitStatus={autoRefreshGitStatus}
            setAutoRefreshGitStatus={setAutoRefreshGitStatus}
            setAccentColor={setAccentColor}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            useAiChatThemeColor={useAiChatThemeColor}
            setUseAiChatThemeColor={setUseAiChatThemeColor}
            editorFontSize={editorFontSize}
            setEditorFontSize={setEditorFontSize}
            editorTabSize={editorTabSize}
            setEditorTabSize={setEditorTabSize}
            editorWordWrap={editorWordWrap}
            setEditorWordWrap={setEditorWordWrap}
            editorMinimap={editorMinimap}
            setEditorMinimap={setEditorMinimap}
            editorLineNumbers={editorLineNumbers}
            setEditorLineNumbers={setEditorLineNumbers}
            editorSmoothScrolling={editorSmoothScrolling}
            setEditorSmoothScrolling={setEditorSmoothScrolling}
            editorBracketColorization={editorBracketColorization}
            setEditorBracketColorization={setEditorBracketColorization}
            editorRenderWhitespace={editorRenderWhitespace}
            setEditorRenderWhitespace={setEditorRenderWhitespace}
            editorFontFamily={editorFontFamily}
            setEditorFontFamily={setEditorFontFamily}
            editorLineHeight={editorLineHeight}
            setEditorLineHeight={setEditorLineHeight}
            editorCursorStyle={editorCursorStyle}
            setEditorCursorStyle={setEditorCursorStyle}
            editorCursorBlinking={editorCursorBlinking}
            setEditorCursorBlinking={setEditorCursorBlinking}
            editorGuides={editorGuides}
            setEditorGuides={setEditorGuides}
            editorAutoClosingBrackets={editorAutoClosingBrackets}
            setEditorAutoClosingBrackets={setEditorAutoClosingBrackets}
            editorHighlightActiveLine={editorHighlightActiveLine}
            setEditorHighlightActiveLine={setEditorHighlightActiveLine}
            editorFormatOnSave={editorFormatOnSave}
            setEditorFormatOnSave={setEditorFormatOnSave}
            editorCodeFolding={editorCodeFolding}
            setEditorCodeFolding={setEditorCodeFolding}
            terminalFontSize={terminalFontSize}
            setTerminalFontSize={setTerminalFontSize}
            terminalCursorStyle={terminalCursorStyle}
            setTerminalCursorStyle={setTerminalCursorStyle}
            terminalScrollback={terminalScrollback}
            setTerminalScrollback={setTerminalScrollback}
            terminalCursorBlink={terminalCursorBlink}
            setTerminalCursorBlink={setTerminalCursorBlink}
            terminalCopyOnSelect={terminalCopyOnSelect}
            setTerminalCopyOnSelect={setTerminalCopyOnSelect}
            terminalFontFamily={terminalFontFamily}
            setTerminalFontFamily={setTerminalFontFamily}
            terminalLineHeight={terminalLineHeight}
            setTerminalLineHeight={setTerminalLineHeight}
            terminalThemePreset={terminalThemePreset}
            setTerminalThemePreset={setTerminalThemePreset}
            terminalCursorWidth={terminalCursorWidth}
            setTerminalCursorWidth={setTerminalCursorWidth}
            terminalScrollOnUserInput={terminalScrollOnUserInput}
            setTerminalScrollOnUserInput={setTerminalScrollOnUserInput}
            terminalDrawBoldTextInBrightColors={terminalDrawBoldTextInBrightColors}
            setTerminalDrawBoldTextInBrightColors={setTerminalDrawBoldTextInBrightColors}
            selectedAiProvider={selectedAiProvider}
            setSelectedAiProvider={handleSwitchAiProvider}
            aiMode={aiMode}
            setAiMode={setAiMode}
            aiAutoApprove={aiAutoApprove}
            setAiAutoApprove={setAiAutoApprove}
            aiConfirmBeforeDelete={aiConfirmBeforeDelete}
            setAiConfirmBeforeDelete={setAiConfirmBeforeDelete}
            onOpenAiGlobalRules={() => {
              setIsSettingsModalOpen(false);
              setIsAiGlobalRulesModalOpen(true);
            }}
            onOpenSkills={() => {
              setIsSettingsModalOpen(false);
              setIsSkillsModalOpen(true);
            }}
            activeSkillsCount={activeSkills.length}
            panelAlignment={panelAlignment}
            setPanelAlignment={setPanelAlignment}
            showActivityBar={showActivityBar}
            setShowActivityBar={setShowActivityBar}
            showStatusBar={showStatusBar}
            setShowStatusBar={setShowStatusBar}
            pinnedAis={pinnedAis}
            setPinnedAis={setPinnedAis}
            useAiSystemAccent={useAiSystemAccent}
            setUseAiSystemAccent={setUseAiSystemAccent}
            devForce={devForce}
            setDevForce={setDevForce}
            aiAutoUpdate={aiAutoUpdate}
            setAiAutoUpdate={setAiAutoUpdate}
            rainbow={rainbow}
            setRainbow={setRainbow}
            showExplorer={showExplorer}
            setShowExplorer={setShowExplorer}
            showAiPanel={showAiPanel}
            setShowAiPanel={setShowAiPanel}
            isTerminalCollapsed={isTerminalCollapsed}
            setIsTerminalCollapsed={setIsTerminalCollapsed}
            quickInputPosition={quickInputPosition}
            setQuickInputPosition={setQuickInputPosition}
            onToggleFullscreen={handleToggleFullscreen}
            onToggleZenMode={handleToggleZenMode}
            isZenMode={isZenMode}
            onResetLayout={handleResetLayout}
            onOpenTasksDock={() => {
              setIsSettingsModalOpen(false);
              setActiveTermTab('tasks');
              setIsTerminalCollapsed(false);
            }}
            onToast={setToastMessage}
          />
        )}

        {/* ======================================================= */}
        {/* MINIMALIST DRAGGABLE THEME POPUP (Tema & Aparência)     */}
        {/* ======================================================= */}
        {isThemePopupOpen && (
          <ThemePopup
            themePopupPos={themePopupPos}
            isDraggingThemePopup={isDraggingThemePopup}
            onMouseDown={handleThemePopupMouseDown}
            onClose={() => setIsThemePopupOpen(false)}
            themeTokens={themeTokens}
            isEffectiveDark={isEffectiveDark}
            accentColor={accentColor}
            setAccentColor={setAccentColor}
            themeMode={themeMode}
            setThemeMode={setThemeMode}
            useAiChatThemeColor={useAiChatThemeColor}
            setUseAiChatThemeColor={setUseAiChatThemeColor}
            useAiSystemAccent={useAiSystemAccent}
            setUseAiSystemAccent={setUseAiSystemAccent}
            selectedAiProvider={selectedAiProvider}
            rainbow={rainbow}
            setRainbow={setRainbow}
          />
        )}

        {/* ========================================================================= */}
        {/* GIT BRANCH MANAGER MODAL                                                  */}
        {/* ========================================================================= */}
        {isBranchModalOpen && (
          <BranchModal
            isEffectiveDark={isEffectiveDark}
            themeTokens={themeTokens}
            accentColor={accentColor}
            onClose={() => setIsBranchModalOpen(false)}
            gitRepoName={gitRepoName}
            currentBranch={currentBranch}
            onSyncGit={handleSyncGit}
            isSyncingGit={isSyncingGit}
            newBranchInput={newBranchInput}
            setNewBranchInput={setNewBranchInput}
            onCreateBranch={handleCreateBranch}
            isCreatingBranch={isCreatingBranch}
            branchSearchQuery={branchSearchQuery}
            setBranchSearchQuery={setBranchSearchQuery}
            branchesList={branchesList}
            onCheckoutBranch={handleCheckoutBranch}
          />
        )}

        {/* ========================================================================= */}
        {/* GITHUB ISSUES MODAL                                                       */}
        {/* ========================================================================= */}
        {isIssuesModalOpen && (
          <IssuesModal
            isEffectiveDark={isEffectiveDark}
            themeTokens={themeTokens}
            accentColor={accentColor}
            onClose={() => setIsIssuesModalOpen(false)}
            gitIssues={gitIssues}
            gitRepoName={gitRepoName}
            isCreatingIssue={isCreatingIssue}
            setIsCreatingIssue={setIsCreatingIssue}
            isLoadingIssues={isLoadingIssues}
            onRefresh={refreshGitHubIssues}
            newIssueTitle={newIssueTitle}
            setNewIssueTitle={setNewIssueTitle}
            onCreateIssue={handleCreateIssue}
            issuesSearchQuery={issuesSearchQuery}
            setIssuesSearchQuery={setIssuesSearchQuery}
            onLinkIssueToChat={handleResolveIssueWithAi}
            aiProvider={selectedAiProvider}
            aiProviders={AI_PROVIDERS.map((p) => ({ id: p.id, name: p.name }))}
            onChangeAiProvider={handleSwitchAiProvider}
            renderAiIcon={renderAiIcon}
            onOpenIssueInBrowser={handleOpenIssueInBrowser}
            onOpenIssueDetails={(n) => {
              // abre os detalhes por cima e guarda de onde veio: o Voltar do título retorna a esta lista
              setSidesheetFromList(true);
              setIsIssuesModalOpen(false);
              handleOpenIssueSidesheet(n);
            }}
          />
        )}

        {/* ========================================================================= */}
        {/* ISSUE DETAIL SIDESHEET (GITHUB-STYLE)                                     */}
        {/* ========================================================================= */}
        <IssueDetailSidesheet
          isOpen={Boolean(sidesheetIssue)}
          issue={sidesheetIssue}
          repoFullName={gitRepoName ? (gitRepoName.includes('/') ? gitRepoName : `Walancy/${gitRepoName}`) : 'Walancy/aura-dev'}
          isRepoPrivate={true}
          availableSprints={projectMilestones.map((m, idx) => ({
            number: m.number || idx + 1,
            title: m.title,
            state: 'open' as const,
            openIssues: gitIssues.filter((i) => i.milestone?.title?.toLowerCase() === m.title.toLowerCase() && (i.state === 'open' || !i.closed_at)).length,
            closedIssues: gitIssues.filter((i) => i.milestone?.title?.toLowerCase() === m.title.toLowerCase() && (i.state === 'closed' || !!i.closed_at)).length,
          }))}
          theme={themeTokens}
          isEffectiveDark={isEffectiveDark}
          accentColor={accentColor}
          accentContrastText={getContrastTextColor(accentColor)}
          currentUser={githubUser ? { login: githubUser.login, avatarUrl: githubUser.avatarUrl || avatarImg } : null}
          onClose={() => { setSidesheetIssue(null); setSidesheetFromList(false); }}
          onBackToList={sidesheetFromList ? () => { setSidesheetIssue(null); setSidesheetFromList(false); setIsIssuesModalOpen(true); } : undefined}
          onUpdateIssue={async (updatedFields) => {
            if (!sidesheetIssue) return;
            setSidesheetIssue((prev) => prev ? { ...prev, ...updatedFields } : null);
            if (sidesheetIssue.githubNumber) {
              try {
                const scopedKey = gitRepoName ? `devflow_issue_sprints_${gitRepoName}` : 'devflow_issue_sprints';
                const raw = localStorage.getItem(scopedKey);
                const map = raw ? JSON.parse(raw) : {};
                const sprintTitle =
                  updatedFields.milestoneTitle !== undefined
                    ? updatedFields.milestoneTitle
                    : updatedFields.milestoneNumber !== undefined
                    ? (projectMilestones.find((m) => m.number === updatedFields.milestoneNumber)?.title || (updatedFields.milestoneNumber === null ? '' : undefined))
                    : undefined;
                if (sprintTitle !== undefined) {
                  if (sprintTitle) {
                    map[sidesheetIssue.githubNumber] = sprintTitle;
                  } else {
                    delete map[sidesheetIssue.githubNumber];
                  }
                  localStorage.setItem(scopedKey, JSON.stringify(map));
                  window.dispatchEvent(new Event('devflow_issue_sprints_updated'));
                }
              } catch {}
            }
            if (window.electronAPI?.github?.updateIssue && sidesheetIssue.githubNumber) {
              try {
                const fullRepo = gitRepoName ? (gitRepoName.includes('/') ? gitRepoName : `Walancy/${gitRepoName}`) : 'Walancy/aura-dev';
                const [owner, repo] = fullRepo.split('/');
                await window.electronAPI.github.updateIssue(owner, repo, sidesheetIssue.githubNumber, {
                  title: updatedFields.title,
                  body: updatedFields.description,
                  state: updatedFields.state,
                  labels: updatedFields.rawLabels,
                  milestone: updatedFields.milestoneNumber,
                });
                refreshGitHubIssues();
              } catch (err) {
                console.warn('Erro ao atualizar issue:', err);
              }
            }
          }}
          onCreateBranchForIssue={(issue) => {
            const slug = (issue.title || 'issue')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .slice(0, 30);
            const branchName = `issue-${issue.githubNumber || issue.id}-${slug}`;
            navigator.clipboard?.writeText?.(`git checkout -b ${branchName}`);
            setToastMessage(`Comando copiado: git checkout -b ${branchName}`);
          }}
          onAskAiAboutIssue={(issue) => {
            handleTaskDoWithAi({
              number: issue.githubNumber || 0,
              title: issue.title,
              body: issue.description,
              state: issue.rawState || 'open',
              labels: (issue.rawLabels || []).map((name) => ({ name })),
              url: issue.htmlUrl,
            });
            setSidesheetIssue(null);
          }}
          showToast={(msg) => setToastMessage(msg)}
        />

        {/* ========================================================================= */}
        {/* DEVFLOW BRAIN MODAL (OBSIDIAN-STYLE GRAPH & AI CONTEXT SYSTEM)            */}
        {/* ========================================================================= */}
        <ProjectBrainModal
          isOpen={isBrainModalOpen}
          onClose={() => setIsBrainModalOpen(false)}
          workspacePath={workspacePath || '/Users/walancy/Documents/codes/devflow-desktop'}
          projectName={gitRepoName}
          accentColor={accentColor}
          themeTokens={themeTokens}
          isEffectiveDark={isEffectiveDark}
          onOpenFile={(filePath) => {
            handleOpenFile(filePath, filePath.split('/').pop() || 'Arquivo');
          }}
          onToast={(msg) => {
            setToastMessage(msg);
            setTimeout(() => setToastMessage(null), 3000);
          }}
        />

        {/* ========================================================================= */}
        {/* CONFIRM UNDO MODAL (AI CHAT HISTORY REVERT TO POINT)                      */}
        {/* ========================================================================= */}
        <ConfirmUndoModal
          isOpen={Boolean(undoConfirmTarget)}
          onClose={() => setUndoConfirmTarget(null)}
          onConfirm={handleConfirmUndo}
          messageText="This undo action will not make any code changes."
          themeTokens={themeTokens}
          accentColor={accentColor}
        />

        {/* ========================================================================= */}
        {/* ANTIGRAVITY AI CHAT PERMISSIONS MODAL                                     */}
        {/* ========================================================================= */}
        <AiChatPermissionsModal
          isOpen={isPermissionsModalOpen}
          onClose={() => setIsPermissionsModalOpen(false)}
          projectName={gitRepoName}
          themeTokens={themeTokens}
          accentColor={accentColor}
          isEffectiveDark={isEffectiveDark}
        />

        {/* ========================================================================= */}
        {/* CONFIRM CLEAR CHAT HISTORY MODAL (DEVFLOW RULE: NO NATIVE DIALOGS)         */}
        {/* ========================================================================= */}
        <ConfirmDeleteModal
          isOpen={clearHistoryConfirmOpen}
          title="Limpar Conversa Atual"
          message="Tem certeza que deseja apagar todo o histórico de mensagens desta sessão? Esta ação não pode ser desfeita."
          confirmLabel="Limpar Conversa"
          cancelLabel="Cancelar"
          themeTokens={themeTokens}
          accentColor={accentColor}
          onConfirm={handleConfirmClearChatHistory}
          onClose={() => setClearHistoryConfirmOpen(false)}
        />

        {/* ========================================================================= */}
        {/* CONFIRM REJECT ALL DIFFS MODAL (DEVFLOW RULE: NO NATIVE DIALOGS)          */}
        {/* ========================================================================= */}
        <ConfirmDeleteModal
          isOpen={rejectAllConfirmOpen}
          title="Descartar Todas as Alterações"
          message="Tem certeza que deseja reverter e descartar todas as modificações feitas pelo assistente nos arquivos listados? O código voltará ao estado anterior."
          itemDescription={rejectAllTargetFiles.length > 0 ? `${rejectAllTargetFiles.length} arquivo(s): ${rejectAllTargetFiles.map((f) => f.name).join(', ')}` : undefined}
          confirmLabel="Descartar Alterações"
          cancelLabel="Manter Alterações"
          themeTokens={themeTokens}
          accentColor={accentColor}
          onConfirm={handleConfirmRejectAllDiffs}
          onClose={() => setRejectAllConfirmOpen(false)}
        />
      </div>
  );
};
export default App;
