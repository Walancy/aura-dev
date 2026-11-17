import { createPortal } from 'react-dom';
import { TreeCollapse } from './ui/TreeCollapse';
import { PullRequestDetail, type PullReviewTarget } from './reviews/PullRequestDetail';
import { PullRequestsList } from './reviews/PullRequestsList';
import { ActionsSidebar, ActionsView } from './actions/ActionsPanels';
import type { TeamAiProvider } from './team/TeamAiPanel';
import type { TerminalSkinId } from './TerminalSkin';
import { getFieldTokens } from '../utils/fieldTokens';
import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  GitPullRequestArrow,
  PlayCircle,
  SquareTerminal,
  Terminal as TerminalIcon,
  Plus,
  X,
  ChevronRight,
  ChevronDown,
  AlertTriangle,
  XCircle,
  Columns3,
  MoreHorizontal,
  ArrowLeft,
  ArrowRight,
  FolderPlus,
  FilePlus,
  RefreshCw,
  FolderOpen,
  FileText,
  Search,
  SplitSquareVertical,
  Trash2,
  Eraser,
  Maximize2,
  Minimize2,
  Copy,
  Folder,
  Sliders,
  ZoomIn,
  ZoomOut,
  Play,
  CornerDownRight,
  PanelLeft,
  GitBranch,
  Grid2x2,
  LayoutGrid,
  Columns2,
  Rows2,
  Square,
  CircleDot,
  CheckCircle2,
  ExternalLink,
  Sparkles,
  RotateCcw,
  Check,
  AtSign,
  Tag,
  User,
  SlidersHorizontal,
  Layers,
  Save,
  Scissors,
  Eye,
  ClipboardPaste,
  Pencil,
} from 'lucide-react';
import { CodiconFiles, CodiconSourceControl } from './Codicons';
import {
  loadDesignBridgeManifest,
  getDesignBridgeManifestSync,
  buildCliTerminalDesignPrompt,
  resolveDesignScreenPreviewUrl,
  buildScreenSvgFallbackDataUrl,
  type DesignBridgeManifest,
  type DesignScreenSpec,
} from '../utils/designBridgeService';
import { FileIcon, FolderIcon } from './FileIcon';
import { NativeXTerm, scrollTerminalToText, TERMINAL_THEMES } from './NativeXTerm';
import { TerminalSkinOverlay, skinDividerVars } from './TerminalSkin';
import Editor, { DiffEditor } from '@monaco-editor/react';
import { defineAuraDarkTheme } from './monacoTheme';
import { AUTOCOMPLETE_OPTIONS, setupAutocomplete } from './monacoAutocomplete';
import { OutlineTimelineCards } from './ide/OutlineTimelineCards';
import { getFileLanguage, isMarkdownFile } from '../utils/editor';
import { renderMarkdownPreview } from '../utils/markdown';
import { ConfirmDeleteModal } from './modals/ConfirmDeleteModal';
import { SidebarPanels } from './ide/SidebarPanels';
import type { ExplorerNode, TerminalSessionItem, ThemeTokens, GitHubIssueItem } from '../types/ide';
import { ClaudeIcon, AntigravityIcon, GeminiIcon, OllamaIcon, CodexIcon } from './icons/AiProviderIcons';
import { getContrastTextColor, hexToRgba } from '../utils/color';
import { logSystemActivity } from '../utils/brainService';
import { AI_BRAND_COLORS } from '../constants/ai';

export 
/** Cor sólida do status da issue (cabeçalho do cartão): aberta, em andamento, em revisão, concluída/fechada */
const issueStatusColor = (issue: { state?: string; closed_at?: unknown; projectV2Status?: string }): string => {
  const st = (issue.projectV2Status || '').toLowerCase();
  if (/done|conclu|complet|finaliz|closed|fechad/.test(st)) return '#8b5cf6';
  if (/progress|andamento|doing|desenvolv|working/.test(st)) return '#f59e0b';
  if (/review|revis|teste|test|qa/.test(st)) return '#3b82f6';
  if (/block|bloque/.test(st)) return '#ef4444';
  if ((issue.state || 'open').toLowerCase() !== 'open' || issue.closed_at) return '#8b5cf6';
  return '#16a34a';
};

/** Nome curto das IAs nos cabeçalhos: só "Claude", "Antigravity"... (terminais comuns mantêm o nome que têm) */
const AI_SHORT_NAMES: Record<string, string> = { claude: 'Claude', antigravity: 'Antigravity', agy: 'Antigravity', gemini: 'Gemini', codex: 'Codex', ollama: 'Ollama' };
const cleanSessionName = (s: { type?: string; name: string }): string => AI_SHORT_NAMES[(s.type || '').toLowerCase()] || s.name;
const AI_SESSION_TYPE = /^(claude|agy|antigravity|gemini|codex|ollama)$/;

interface TerminalWorkspace {
  id: string;
  name: string;
  gridMode: '1x1' | '1x2' | '2x1' | '3' | '1x3' | '2x2';
  slotSessionIds: string[];
  slotTypes?: string[];
  focusedSlotIndex: number;
  splitX: number;
  splitY: number;
  maximizedSlotIndex: number | null;
  /** nome definido pelo usuário: a IA não renomeia mais a aba */
  userNamed?: boolean;
}

export interface CliTerminalViewProps {
  workspacePath: string;
  fileTree: ExplorerNode[];
  expandedFolders: Set<string>;
  onToggleFolder: (path: string) => void;
  activeFileId?: string | null;
  onOpenFile?: (path: string, name?: string) => void;
  onOpenFolderDialog?: () => void;
  onOpenFileDialog?: () => void;
  onCreateNewFile?: () => void;
  onCreateNewFolder?: () => void;
  onRefreshTree?: () => void;
  /** dados do arquivo aberto no visualizador do CLI (alimentam a barra de status do app) */
  onViewerStatus?: (s: { path: string; name: string; language: string; blame: string; line: number; col: number; tabSize: number; eol: 'LF' | 'CRLF' } | null) => void;
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  selectedAiProvider?: string;
  terminalSessions: TerminalSessionItem[];
  setTerminalSessions: React.Dispatch<React.SetStateAction<TerminalSessionItem[]>>;
  activeSessionId: string;
  setActiveSessionId: (id: string) => void;
  onNewSession: (type?: string, name?: string, cmd?: string) => string | void;
  onCloseSession: (id: string, e?: React.MouseEvent) => void;
  terminalFontSize?: number;
  terminalCursorStyle?: 'block' | 'bar' | 'underline';
  terminalCursorBlink?: boolean;
  terminalScrollback?: number;
  terminalCopyOnSelect?: boolean;
  terminalFontFamily?: string;
  terminalLineHeight?: number;
  terminalThemePreset?: string;
  terminalSkin?: TerminalSkinId;
  terminalCursorWidth?: number;
  terminalScrollOnUserInput?: boolean;
  terminalDrawBoldTextInBrightColors?: boolean;
  onSetTerminalFontSize?: (size: number) => void;
  currentBranch?: string;
  gitRepoName?: string;
  onToast?: (msg: string) => void;
  installedClis?: {
    claude: boolean;
    gemini: boolean;
    antigravity: boolean;
    codex: boolean;
    ollama: boolean;
  };
  /** abas do painel do IDE (Problems, Output, Debug console, Terminal, Ports, Tarefas) e o conteúdo de cada uma */
  dockTabs?: Array<{ id: string; label: string; count?: number }>;
  renderDockContent?: (tab: string) => React.ReactNode;
  /** problemas do projeto: mostra o ícone de alerta ao lado do seletor do painel */
  problemsSummary?: { errors: number; warnings: number };
  /** texto pronto para pedir à IA que resolva os problemas do projeto */
  problemsPrompt?: string;
  onOpenBranchModal?: () => void;
  onOpenIssuesModal?: () => void;
  /** pull requests e reviews do repositório do projeto: lista no painel lateral, detalhe na área central */
  openPullCount?: number;
  repoFullName?: string;
  reviewAiProvider?: TeamAiProvider;
  onSendPromptToAi?: (text: string) => void;
  /** pedido externo (notificação "Revisar"): abre este pull request no painel de reviews */
  reviewRequest?: { repo: string; number: number; nonce: number } | null;
  onOpenIssueDetails?: (issueNumber: number) => void;
  gitIssues?: GitHubIssueItem[];
  refreshGitHubIssues?: () => Promise<void>;
  onSyncGit?: () => Promise<void> | void;
  isSyncingGit?: boolean;
  gitModifiedCount?: number;
  onGenerateCommitMessage?: (repoDir: string) => Promise<string>;
  onStartReview?: (files: any[], index?: number) => void;
}

const IssueGitAvatar: React.FC<{
  login: string;
  avatarUrl?: string;
  size?: number;
  isEffectiveDark: boolean;
}> = ({ login, avatarUrl, size = 14, isEffectiveDark }) => {
  const [hasError, setHasError] = useState(false);
  const cleanLogin = (login || '').replace('@', '').trim();
  const src = avatarUrl || (cleanLogin ? `https://github.com/${cleanLogin}.png?size=40` : '');

  if (hasError || !src) {
    return (
      <div
        title={cleanLogin ? `@${cleanLogin}` : 'Git'}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)',
          color: isEffectiveDark ? '#a1a1aa' : '#52525b',
          fontSize: 8,
          fontWeight: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          border: 'none',
          boxShadow: 'none',
          userSelect: 'none',
        }}
      >
        {cleanLogin ? cleanLogin.charAt(0).toUpperCase() : 'G'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={cleanLogin ? `@${cleanLogin}` : 'Git'}
      title={cleanLogin ? `@${cleanLogin}` : 'Git'}
      onError={() => setHasError(true)}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        border: 'none',
        boxShadow: 'none',
        flexShrink: 0,
        display: 'block',
        userSelect: 'none',
      }}
    />
  );
};

// Mini desenho de cada layout de terminais (menu de layout)
const LayoutGlyph: React.FC<{ mode: '1x1' | '1x2' | '2x1' | '1x3' | '3' | '2x2' }> = ({ mode }) => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" style={{ flexShrink: 0 }}>
    <rect x="1.5" y="2.5" width="13" height="11" rx="2" />
    {mode === '1x2' && <path d="M8 2.5v11" />}
    {mode === '2x1' && <path d="M1.5 8h13" />}
    {mode === '1x3' && <path d="M5.8 2.5v11M10.2 2.5v11" />}
    {mode === '3' && <path d="M8 2.5V8M1.5 8h13" />}
    {mode === '2x2' && <path d="M8 2.5v11M1.5 8h13" />}
  </svg>
);

// Ícone do botão de dividir: mostra onde o novo terminal vai aparecer (direita, embaixo) ou que o clique volta a 1 terminal
const SplitHintIcon: React.FC<{ mode: 'right' | 'bottom' | 'merge'; size?: number }> = ({ mode, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    <rect x="1.5" y="1.5" width="13" height="13" rx="2.5" />
    {mode === 'right' && (
      <>
        <rect x="8" y="2.2" width="5.8" height="11.6" rx="1.6" fill="currentColor" fillOpacity="0.45" stroke="none" />
        <path d="M8 1.5v13" />
      </>
    )}
    {mode === 'bottom' && (
      <>
        <rect x="2.2" y="8" width="11.6" height="5.8" rx="1.6" fill="currentColor" fillOpacity="0.45" stroke="none" />
        <path d="M8 1.5v13M1.5 8h13" />
      </>
    )}
  </svg>
);

export const CliTerminalView: React.FC<CliTerminalViewProps> = ({
  workspacePath,
  fileTree,
  expandedFolders,
  onToggleFolder,
  activeFileId,
  onOpenFile,
  onOpenFolderDialog,
  onOpenFileDialog,
  onCreateNewFile,
  onCreateNewFolder,
  onRefreshTree,
  onViewerStatus,
  themeTokens,
  isEffectiveDark,
  accentColor,
  selectedAiProvider = 'antigravity',
  terminalSessions,
  setTerminalSessions,
  activeSessionId,
  setActiveSessionId,
  onNewSession,
  onCloseSession,
  terminalFontSize = 13,
  terminalCursorStyle,
  terminalCursorBlink,
  terminalScrollback,
  terminalCopyOnSelect,
  terminalFontFamily,
  terminalLineHeight,
  terminalThemePreset,
  terminalSkin,
  terminalCursorWidth,
  terminalScrollOnUserInput,
  terminalDrawBoldTextInBrightColors,
  onSetTerminalFontSize,
  currentBranch,
  gitRepoName = 'Walancy/aura-dev',
  onToast,
  installedClis,
  onOpenBranchModal,
  onOpenIssuesModal,
  openPullCount = 0,
  repoFullName,
  reviewAiProvider,
  onSendPromptToAi,
  reviewRequest,
  dockTabs,
  renderDockContent,
  problemsSummary,
  problemsPrompt,
  onOpenIssueDetails,
  gitIssues = [],
  refreshGitHubIssues,
  onSyncGit,
  isSyncingGit = false,
  gitModifiedCount = 0,
  onGenerateCommitMessage,
  onStartReview,
}) => {
  // Left sidebar tabs: 'files' | 'git' | 'issues' | 'design'
  const [sidebarTab, setSidebarTab] = useState<'files' | 'git' | 'issues' | 'design' | 'reviews' | 'actions'>('files');
  const [actionsWf, setActionsWf] = useState<number | null>(null);
  const [actionsRun, setActionsRun] = useState<number | null>(null);
  const [prTarget, setPrTarget] = useState<PullReviewTarget | null>(null);
  const resolveTabs = useRef<Map<string, string>>(new Map());
  const [designManifest, setDesignManifest] = useState<DesignBridgeManifest | null>(() =>
    getDesignBridgeManifestSync(workspacePath)
  );
  const [designSearchQuery, setDesignSearchQuery] = useState<string>('');
  const [previewDesignScreen, setPreviewDesignScreen] = useState<DesignScreenSpec | null>(null);
  const [previewDesignUrl, setPreviewDesignUrl] = useState<string | null>(null);
  const [resolvedCliDesignThumbs, setResolvedCliDesignThumbs] = useState<Record<string, string>>({});

  useEffect(() => {
    const screens = designManifest?.screens || [];
    if (screens.length === 0) return;
    let alive = true;
    (async () => {
      const next: Record<string, string> = {};
      for (const scr of screens) {
        const url = await resolveDesignScreenPreviewUrl(workspacePath, scr);
        if (!alive) return;
        next[scr.id] = url;
      }
      if (alive) {
        setResolvedCliDesignThumbs((prev) => {
          const changed = Object.keys(next).some((k) => prev[k] !== next[k]);
          return changed ? { ...prev, ...next } : prev;
        });
      }
    })();
    return () => {
      alive = false;
    };
  }, [workspacePath, designManifest]);

  useEffect(() => {
    if (!previewDesignScreen) {
      setPreviewDesignUrl(null);
      return;
    }
    let alive = true;
    resolveDesignScreenPreviewUrl(workspacePath, previewDesignScreen).then((url) => {
      if (alive) setPreviewDesignUrl(url);
    });
    return () => {
      alive = false;
    };
  }, [workspacePath, previewDesignScreen]);

  useEffect(() => {
    let active = true;
    loadDesignBridgeManifest(workspacePath).then((m) => {
      if (active) setDesignManifest(m);
    });
    const onBridgeUpdate = (e: any) => {
      const detail = e?.detail as DesignBridgeManifest | undefined;
      if (detail && (!workspacePath || detail.workspacePath === workspacePath.replace(/\/+$/, ''))) {
        setDesignManifest(detail);
      } else {
        loadDesignBridgeManifest(workspacePath).then((m) => {
          if (active) setDesignManifest(m);
        });
      }
    };
    window.addEventListener('devflow-design-bridge-updated', onBridgeUpdate as EventListener);
    return () => {
      active = false;
      window.removeEventListener('devflow-design-bridge-updated', onBridgeUpdate as EventListener);
    };
  }, [workspacePath]);

  const handleSendDesignToTerminal = useCallback(
    (screen?: DesignScreenSpec, executeNow = false) => {
      if (!designManifest || designManifest.screens.length === 0) {
        onToast?.('Nenhuma tela encontrada na aba Design deste projeto');
        return;
      }
      const targetSessionId = activeSessionId || terminalSessions[0]?.id;
      if (!targetSessionId) {
        onToast?.('Nenhum terminal ativo para enviar o design');
        return;
      }
      const text = executeNow
        ? buildCliTerminalDesignPrompt(designManifest, screen ? [screen] : undefined)
        : screen
        ? `[Design "${screen.name}" (${screen.width}x${screen.height}px) — spec: .devflow/design/index.md | preview: ${screen.imageRelPath}] `
        : `[Designs do Projeto (${designManifest.screens.length} telas) — spec: .devflow/design/index.md] `;

      if (window.electronAPI?.pty?.write) {
        window.electronAPI.pty.write(targetSessionId, `\x1b[200~${text}\x1b[201~`);
        if (executeNow) {
          setTimeout(() => {
            window.electronAPI?.pty?.write(targetSessionId, '\r');
          }, 120);
        }
      } else {
        navigator.clipboard?.writeText(text);
      }

      logSystemActivity('terminal', 'send_design_to_terminal', gitRepoName || 'default', {
        sessionId: targetSessionId,
        screen: screen?.name || 'all',
        executeNow,
      });

      onToast?.(
        executeNow
          ? `Implementando design "${screen?.name || 'Todas as telas'}" no terminal`
          : `Referência do design "${screen?.name || 'Todas as telas'}" inserida no terminal`
      );

      window.dispatchEvent(new CustomEvent('devflow:focus-terminal', { detail: { sessionId: targetSessionId } }));
      setTimeout(() => {
        const helper = (
          document.querySelector(`[data-session-id="${targetSessionId}"] .xterm-helper-textarea`) ||
          document.querySelector('[data-session-id] .xterm-helper-textarea') ||
          document.querySelector('.xterm-helper-textarea')
        ) as HTMLTextAreaElement | null;
        if (helper) helper.focus();
      }, 25);
    },
    [designManifest, activeSessionId, terminalSessions, gitRepoName, onToast]
  );

  // Issues tab state
  const [issuesFilter, setIssuesFilter] = useState<'all' | 'open' | 'closed'>('open');
  const [isIssuesFilterOpen, setIsIssuesFilterOpen] = useState<boolean>(false);
  const issuesFilterRef = useRef<HTMLDivElement>(null);
  const [issuesSearchQuery, setIssuesSearchQuery] = useState<string>('');
  const [isRefreshingIssues, setIsRefreshingIssues] = useState<boolean>(false);

  // Filtro "somente minhas": issues em que o usuário logado no GitHub é assignee
  const [onlyMyIssues, setOnlyMyIssues] = useState<boolean>(() => {
    try { return localStorage.getItem('cli_issues_only_mine') === '1'; } catch { return false; }
  });
  const [myGithubLogin, setMyGithubLogin] = useState<string>('');
  const [myGithubName, setMyGithubName] = useState<string>('');
  useEffect(() => {
    window.electronAPI?.github?.getUser?.().then((res: any) => {
      if (res?.success && res.user?.login) {
        setMyGithubLogin(String(res.user.login).toLowerCase());
        setMyGithubName(String(res.user.name || '').toLowerCase());
      }
    }).catch(() => {});
  }, []);
  const scopedIssues = useMemo(() => {
    if (!onlyMyIssues) return gitIssues || [];
    return (gitIssues || []).filter((i) => {
      const logins = [
        ...(Array.isArray(i.assignees) ? i.assignees : []),
        ...(i.assignee ? [i.assignee] : []),
      ].map((a) => (typeof a === 'string' ? a : a?.login || '').toLowerCase());
      // issues vindas dos Projects trazem o nome de exibição no lugar do login
      return [myGithubLogin, myGithubName].some((me) => me !== '' && logins.includes(me));
    });
  }, [gitIssues, onlyMyIssues, myGithubLogin, myGithubName]);

  useEffect(() => {
    if (!isIssuesFilterOpen) return;
    const close = (e: MouseEvent) => {
      if (!issuesFilterRef.current?.contains(e.target as Node)) setIsIssuesFilterOpen(false);
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [isIssuesFilterOpen]);
  const activeIssueFilters = (issuesFilter !== 'open' ? 1 : 0) + (onlyMyIssues ? 1 : 0);

  // Issues counts & filter logic
  const openIssuesCount = useMemo(() => {
    return scopedIssues.filter((i) => {
      const state = (i.state || 'open').toLowerCase();
      return state === 'open' && !i.closed_at;
    }).length;
  }, [scopedIssues]);

  const closedIssuesCount = useMemo(() => {
    return scopedIssues.filter((i) => {
      const state = (i.state || 'open').toLowerCase();
      return state === 'closed' || !!i.closed_at;
    }).length;
  }, [scopedIssues]);

  const filteredIssues = useMemo(() => {
    let list = scopedIssues;
    if (issuesFilter === 'open') {
      list = list.filter((i) => (i.state || 'open').toLowerCase() === 'open' && !i.closed_at);
    } else if (issuesFilter === 'closed') {
      list = list.filter((i) => (i.state || 'open').toLowerCase() === 'closed' || !!i.closed_at);
    }

    if (issuesSearchQuery.trim()) {
      const q = issuesSearchQuery.toLowerCase().trim();
      list = list.filter((i) => {
        const numStr = `#${i.number}`;
        const matchesNum = numStr.includes(q) || String(i.number).includes(q);
        const matchesTitle = i.title?.toLowerCase().includes(q);
        const matchesLabels = (i.labels || []).some((l) =>
          (typeof l === 'string' ? l : l.name)?.toLowerCase().includes(q)
        );
        const authorLogin = typeof i.author === 'string' ? i.author : i.author?.login;
        const matchesAuthor = authorLogin?.toLowerCase().includes(q);
        return matchesNum || matchesTitle || matchesLabels || matchesAuthor;
      });
    }

    return list;
  }, [scopedIssues, issuesFilter, issuesSearchQuery]);

  // Mentioned issues per terminal session
  const [sessionMentionedIssues, setSessionMentionedIssues] = useState<Record<string, GitHubIssueItem[]>>({});

  const handleMentionIssueInTerminal = useCallback((issue: GitHubIssueItem) => {
    const targetSessionId = activeSessionId || terminalSessions[0]?.id;
    if (!targetSessionId) {
      onToast?.('Nenhum terminal ativo para vincular a menção da issue');
      return;
    }

    setSessionMentionedIssues((prev) => {
      const currentList = prev[targetSessionId] || [];
      if (currentList.some((i) => i.number === issue.number)) {
        return prev;
      }
      return {
        ...prev,
        [targetSessionId]: [...currentList, issue],
      };
    });

    const text = `#${issue.number} `;
    if (window.electronAPI?.pty?.write) {
      window.electronAPI.pty.write(targetSessionId, text);
    }

    logSystemActivity('terminal', 'mention_issue', gitRepoName || 'default', {
      sessionId: targetSessionId,
      issueNumber: issue.number,
      title: issue.title,
    });

    onToast?.(`Issue #${issue.number} mencionada no terminal`);
  }, [activeSessionId, terminalSessions, gitRepoName, onToast]);

  const handleRemoveMentionedIssue = useCallback((sessionId: string, issueNumber: number) => {
    setSessionMentionedIssues((prev) => {
      const currentList = prev[sessionId] || [];
      return {
        ...prev,
        [sessionId]: currentList.filter((i) => i.number !== issueNumber),
      };
    });

    logSystemActivity('terminal', 'remove_mentioned_issue', gitRepoName || 'default', {
      sessionId,
      issueNumber,
    });
  }, [gitRepoName]);

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.issue) {
        handleMentionIssueInTerminal(e.detail.issue);
      }
    };
    window.addEventListener('devflow:mention-issue-terminal', handler);
    return () => window.removeEventListener('devflow:mention-issue-terminal', handler);
  }, [handleMentionIssueInTerminal]);

  const handleSendIssueToTerminal = useCallback((issue: GitHubIssueItem) => {
    const targetSessionId = activeSessionId || terminalSessions[0]?.id;
    if (!targetSessionId) {
      onToast?.('Nenhum terminal ativo para enviar a issue');
      return;
    }

    const text = `#${issue.number}: ${issue.title} `;
    if (window.electronAPI?.pty?.write) {
      window.electronAPI.pty.write(targetSessionId, text);
    } else {
      navigator.clipboard?.writeText(text);
    }

    setSessionMentionedIssues((prev) => {
      const currentList = prev[targetSessionId] || [];
      if (currentList.some((i) => i.number === issue.number)) {
        return prev;
      }
      return {
        ...prev,
        [targetSessionId]: [...currentList, issue],
      };
    });

    logSystemActivity('terminal', 'send_issue_to_terminal', gitRepoName || 'default', {
      sessionId: targetSessionId,
      issueNumber: issue.number,
      title: issue.title,
    });

    onToast?.(`Issue #${issue.number} enviada para o terminal`);

    // Manter e garantir o ponteiro/foco imediatamente no terminal ativo
    window.dispatchEvent(new CustomEvent('devflow:focus-terminal', { detail: { sessionId: targetSessionId } }));
    setTimeout(() => {
      const helper = (
        document.querySelector(`[data-session-id="${targetSessionId}"] .xterm-helper-textarea`) ||
        document.querySelector('[data-session-id] .xterm-helper-textarea') ||
        document.querySelector('.xterm-helper-textarea')
      ) as HTMLTextAreaElement | null;
      if (helper) {
        helper.focus();
      }
    }, 20);
  }, [activeSessionId, terminalSessions, gitRepoName, onToast]);

  const handleInsertIssueToTerminal = handleSendIssueToTerminal;

  useEffect(() => {
    const handler = (e: any) => {
      if (e.detail?.issue) {
        handleSendIssueToTerminal(e.detail.issue);
      }
    };
    window.addEventListener('devflow:send-issue-terminal', handler);
    return () => window.removeEventListener('devflow:send-issue-terminal', handler);
  }, [handleSendIssueToTerminal]);

  const handleCheckoutIssueBranch = (issue: GitHubIssueItem) => {
    const cleanSlug = issue.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 30);
    const branchName = `issue-${issue.number}${cleanSlug ? `-${cleanSlug}` : ''}`;
    const cmd = `git checkout -b "${branchName}"\n`;
    if (activeSessionId && window.electronAPI?.pty?.write) {
      window.electronAPI.pty.write(activeSessionId, cmd);
      onToast?.(`Criando branch ${branchName} no terminal`);
    } else {
      onNewSession('zsh', branchName, cmd);
    }
  };

  const handleOpenIssueInBrowser = (issue: GitHubIssueItem) => {
    const repo = gitRepoName || 'Walancy/aura-dev';
    const cleanRepo = repo.includes('/') ? repo : `Walancy/${repo}`;
    const url = issue.url || `https://github.com/${cleanRepo}/issues/${issue.number}`;
    if (window.electronAPI?.shell?.openExternal) {
      window.electronAPI.shell.openExternal(url);
    }
  };

  const handleRefreshIssuesList = async () => {
    if (!refreshGitHubIssues) return;
    setIsRefreshingIssues(true);
    try {
      await refreshGitHubIssues();
      onToast?.('Issues do GitHub atualizadas');
    } catch (err: any) {
      onToast?.(`Erro ao atualizar issues: ${err.message}`);
    } finally {
      setIsRefreshingIssues(false);
    }
  };

  // Explorer sizing and visibility
  const [explorerWidth, setExplorerWidth] = useState<number>(() => {
    try { const saved = Number(localStorage.getItem('ide_explorer_width')); return Math.max(180, Math.min(800, saved && saved !== 280 ? saved : 340)); } catch { return 340; }
  });
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState<boolean>(false);
  const showPrDetail = sidebarTab === 'reviews' && !isExplorerCollapsed && prTarget !== null;
  const showActions = sidebarTab === 'actions' && !isExplorerCollapsed;
  useEffect(() => {
    if (!reviewRequest) return;
    setSidebarTab('reviews');
    setIsExplorerCollapsed(false);
    setPrTarget({ repo: reviewRequest.repo, number: reviewRequest.number });
  }, [reviewRequest?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps
  const [isDraggingExplorer, setIsDraggingExplorer] = useState<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartWidthRef = useRef<number>(340);

  // Explorer search filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedDir, setSelectedDir] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);
  const [dropSlotId, setDropSlotId] = useState<string | null>(null);
  // O xterm é renderizado via portal (fora da árvore React do slot): drops no terminal não borbulham para o onDrop do slot.
  // Por isso o host do terminal recebe listeners nativos que chamam este handler (sempre o mais recente).
  const termDropRef = useRef<{ over: (id: string) => void; leave: () => void; drop: (id: string, dt: DataTransfer) => void } | null>(null);
  // reordenar abas arrastando: aba em arraste e onde ela entraria (antes/depois da aba sob o mouse)
  const [tabDragId, setTabDragId] = useState<string | null>(null);
  const [tabDrop, setTabDrop] = useState<{ id: string; after: boolean } | null>(null);
  const moveTab = (fromId: string, toId: string, after: boolean) => {
    if (fromId === toId) return;
    setWorkspaces((prev) => {
      const from = prev.find((w) => w.id === fromId);
      if (!from) return prev;
      const rest = prev.filter((w) => w.id !== fromId);
      const idx = rest.findIndex((w) => w.id === toId);
      if (idx < 0) return prev;
      rest.splice(after ? idx + 1 : idx, 0, from);
      return rest;
    });
  };
  const [creating, setCreating] = useState<{ parent: string; isDirectory: boolean } | null>(null);
  const [creatingName, setCreatingName] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ExplorerNode | null>(null);
  const [fileClipboard, setFileClipboard] = useState<{ path: string; mode: 'copy' | 'cut' } | null>(null);
  const [renaming, setRenaming] = useState<{ path: string; name: string } | null>(null);
  const [isDeletingItem, setIsDeletingItem] = useState(false);

  const confirmDeleteItem = async () => {
    if (!deleteTarget) return;
    setIsDeletingItem(true);
    try {
      await window.electronAPI?.fs?.deleteItem(deleteTarget.path);
      onToast?.(`${deleteTarget.isDirectory ? 'Pasta' : 'Arquivo'} excluído: ${deleteTarget.name}`);
      onRefreshTree?.();
    } catch (err: any) {
      onToast?.(`Erro ao excluir: ${err?.message || err}`);
    }
    setIsDeletingItem(false);
    setDeleteTarget(null);
  };

  const startCreating = (isDirectory: boolean, forcedParent?: string) => {
    const parent = forcedParent || (selectedDir && (selectedDir === workspacePath || selectedDir.startsWith(workspacePath + '/')) ? selectedDir : workspacePath);
    if (parent !== workspacePath) {
      // garante que a pasta alvo esteja visível
      if (!expandedFolders.has(parent)) onToggleFolder(parent);
    }
    setCreatingName('');
    setCreating({ parent, isDirectory });
  };

  const commitCreating = async () => {
    const info = creating;
    const name = creatingName.trim();
    setCreating(null);
    if (!info || !name) return;
    if (name.split('/').includes('..')) return;
    const full = `${info.parent}/${name}`;
    try {
      await window.electronAPI?.fs?.createItem(full, info.isDirectory);
      onRefreshTree?.();
      if (!info.isDirectory) openViewer(full, name.split('/').pop() || name);
      onToast?.(`${info.isDirectory ? 'Pasta' : 'Arquivo'} criado: ${name}`);
    } catch (err: any) {
      onToast?.(`Erro ao criar: ${err?.message || err}`);
    }
  };

  const parentDirOf = (itemPath: string) => itemPath.split('/').slice(0, -1).join('/') || workspacePath;

  const pasteIntoNode = async (node: ExplorerNode) => {
    if (!fileClipboard) return;
    const targetDir = node.isDirectory ? node.path : parentDirOf(node.path);
    const itemName = fileClipboard.path.split('/').pop() || 'item';
    const dest = `${targetDir}/${itemName}`;
    if (dest === fileClipboard.path) {
      setFileClipboard(null);
      return;
    }
    try {
      if (fileClipboard.mode === 'copy') await window.electronAPI?.fs?.copyItem(fileClipboard.path, dest);
      else {
        await window.electronAPI?.fs?.renameItem(fileClipboard.path, dest);
        setFileClipboard(null);
      }
      logSystemActivity('terminal', fileClipboard.mode === 'copy' ? 'copiar_item' : 'mover_item', gitRepoName || 'default', { from: fileClipboard.path, to: dest });
      if (targetDir !== workspacePath && !expandedFolders.has(targetDir)) onToggleFolder(targetDir);
      onRefreshTree?.();
      onToast?.(`"${itemName}" colado em ${targetDir.split('/').pop()}`);
    } catch (err: any) {
      onToast?.(`Erro ao colar: ${err?.message || err}`);
    }
  };

  const commitRename = async () => {
    const info = renaming;
    setRenaming(null);
    const name = info?.name.trim();
    if (!info || !name || name.includes('/') || name === info.path.split('/').pop()) return;
    const dest = `${parentDirOf(info.path)}/${name}`;
    try {
      await window.electronAPI?.fs?.renameItem(info.path, dest);
      logSystemActivity('terminal', 'renomear_item', gitRepoName || 'default', { from: info.path, to: dest });
      onRefreshTree?.();
      onToast?.(`Renomeado para "${name}"`);
    } catch (err: any) {
      onToast?.(`Erro ao renomear: ${err?.message || err}`);
    }
  };

  const renderRenameInput = () => (
    <input
      autoFocus
      value={renaming?.name || ''}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => setRenaming((r) => (r ? { ...r, name: e.target.value } : r))}
      onFocus={(e) => e.currentTarget.select()}
      onBlur={commitRename}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commitRename();
        if (e.key === 'Escape') setRenaming(null);
      }}
      style={{ flex: 1, minWidth: 0, height: 20, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, fontWeight: 400, color: skinTk.textPrimary, fontFamily: 'inherit' }}
    />
  );

  const handleTreeDrop = async (e: React.DragEvent, destDir: string) => {
    e.preventDefault();
    e.stopPropagation();
    setDropTarget(null);
    const fs = window.electronAPI?.fs;
    if (!fs) return;
    let changed = false;
    try {
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        for (const file of Array.from(e.dataTransfer.files)) {
          const src = fs.getPathForFile(file);
          if (!src) continue;
          const name = src.split('/').pop() || file.name;
          const dest = `${destDir}/${name}`;
          if (src === dest || destDir === src || destDir.startsWith(src + '/')) continue;
          await fs.copyItem(src, dest);
          changed = true;
        }
        if (changed) onToast?.('Arquivos copiados para o projeto');
      } else {
        const raw = e.dataTransfer.getData('application/json');
        if (!raw) return;
        const data = JSON.parse(raw);
        if (data?.type !== 'devflow-item' || !data.path) return;
        const src: string = data.path;
        const dest = `${destDir}/${data.name}`;
        const parent = src.split('/').slice(0, -1).join('/');
        if (parent === destDir || destDir === src || destDir.startsWith(src + '/')) return;
        await fs.renameItem(src, dest);
        changed = true;
        onToast?.(`Movido para ${destDir.split('/').pop()}`);
      }
      if (changed) {
        if (destDir !== workspacePath && !expandedFolders.has(destDir)) onToggleFolder(destDir);
        onRefreshTree?.();
      }
    } catch (err: any) {
      onToast?.(`Erro ao mover/copiar: ${err?.message || err}`);
    }
  };


  const renderCreateInput = (depth: number) => (
    <div style={{ height: 24, paddingLeft: depth * 12 + 20, paddingRight: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
      {creating?.isDirectory ? <FolderPlus size={14} color={accentColor} /> : <FilePlus size={14} color={accentColor} />}
      <input
        autoFocus
        value={creatingName}
        onChange={(e) => setCreatingName(e.target.value)}
        onBlur={commitCreating}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commitCreating();
          if (e.key === 'Escape') { setCreatingName(''); setCreating(null); }
        }}
        placeholder={creating?.isDirectory ? 'nome-da-pasta' : 'arquivo.ts'}
        style={{ flex: 1, minWidth: 0, height: 20, background: 'transparent', border: 'none', outline: 'none', fontSize: 12, fontWeight: 400, color: skinTk.textPrimary, fontFamily: 'inherit' }}
      />
    </div>
  );

  const dragOverTree = (e: React.DragEvent, dir: string) => {
    const types = Array.from(e.dataTransfer.types);
    if (!types.includes('Files') && !types.includes('application/json')) return;
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = types.includes('Files') ? 'copy' : 'move';
    if (dropTarget !== dir) setDropTarget(dir);
  };
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [explorerMenuOpen, setExplorerMenuOpen] = useState<boolean>(false);
  const [explorerOptionsOpen, setExplorerOptionsOpen] = useState(false);
  const explorerOptionsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!explorerOptionsOpen) return;
    const onDown = (e: MouseEvent) => !explorerOptionsRef.current?.contains(e.target as Node) && setExplorerOptionsOpen(false);
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [explorerOptionsOpen]);

  // File context menu
  const [fileContextMenu, setFileContextMenu] = useState<{
    x: number;
    y: number;
    node: ExplorerNode;
  } | null>(null);

  // New session / workspace menu
  const [newTabMenuOpen, setNewTabMenuOpen] = useState<boolean>(false);
  const [renamingWorkspaceId, setRenamingWorkspaceId] = useState<string | null>(null);
  const [renameWorkspaceValue, setRenameWorkspaceValue] = useState<string>('');

  // Terminal Workspaces state: cada aba funciona como uma Área de Trabalho independente com layout próprio por projeto
  const [workspaces, setWorkspaces] = useState<TerminalWorkspace[]>(() => {
    try {
      const key = workspacePath ? `devflow_cli_workspaces_${workspacePath}` : 'devflow_cli_workspaces';
      const saved = localStorage.getItem(key);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    const initialSessionId = activeSessionId || terminalSessions[0]?.id || `term_${Date.now()}`;
    return [
      {
        id: 'ws_1',
        name: 'Área 1',
        gridMode: '1x1',
        slotSessionIds: [initialSessionId],
        focusedSlotIndex: 0,
        splitX: 50,
        splitY: 50,
        maximizedSlotIndex: null,
      },
    ];
  });
  const [activeWorkspaceId, setActiveWorkspaceId] = useState<string>(() => {
    try {
      const activeKey = workspacePath ? `devflow_cli_active_ws_${workspacePath}` : 'devflow_cli_active_ws';
      const saved = localStorage.getItem(activeKey);
      if (saved && workspaces.some((w) => w.id === saved)) return saved;
    } catch {}
    return workspaces[0]?.id || 'ws_1';
  });

  const prevWorkspacePathRef = useRef<string>(workspacePath);

  // Alternância limpa de Áreas de Trabalho ao trocar de projeto no header
  useEffect(() => {
    if (prevWorkspacePathRef.current !== workspacePath) {
      const oldPath = prevWorkspacePathRef.current;
      if (oldPath) {
        try {
          localStorage.setItem(`devflow_cli_workspaces_${oldPath}`, JSON.stringify(workspaces));
          localStorage.setItem(`devflow_cli_active_ws_${oldPath}`, activeWorkspaceId);
        } catch {}
      }

      prevWorkspacePathRef.current = workspacePath;

      const newKey = workspacePath ? `devflow_cli_workspaces_${workspacePath}` : 'devflow_cli_workspaces';
      const activeKey = workspacePath ? `devflow_cli_active_ws_${workspacePath}` : 'devflow_cli_active_ws';
      let loadedWorkspaces: TerminalWorkspace[] | null = null;
      let loadedActiveId: string | null = null;

      try {
        const saved = localStorage.getItem(newKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed) && parsed.length > 0) {
            loadedWorkspaces = parsed;
          }
        }
        loadedActiveId = localStorage.getItem(activeKey);
      } catch {}

      if (loadedWorkspaces && loadedWorkspaces.length > 0) {
        setWorkspaces(loadedWorkspaces);
        setActiveWorkspaceId(
          loadedActiveId && loadedWorkspaces.some((w) => w.id === loadedActiveId)
            ? loadedActiveId
            : loadedWorkspaces[0].id
        );
      } else {
        const freshSessionId = activeSessionId || terminalSessions[0]?.id || `term_${Date.now()}`;
        const defaultWs: TerminalWorkspace = {
          id: `ws_${Date.now()}`,
          name: 'Área 1',
          gridMode: '1x1',
          slotSessionIds: [freshSessionId],
          focusedSlotIndex: 0,
          splitX: 50,
          splitY: 50,
          maximizedSlotIndex: null,
        };
        setWorkspaces([defaultWs]);
        setActiveWorkspaceId(defaultWs.id);
      }
    }
  }, [workspacePath, workspaces, activeWorkspaceId, activeSessionId, terminalSessions]);

  // Modais de confirmação de exclusão (obrigatório pelas diretrizes AGENTS.md)
  const [isConfirmCloseAllOpen, setIsConfirmCloseAllOpen] = useState<boolean>(false);
  const [isClosingAll, setIsClosingAll] = useState<boolean>(false);
  const [workspaceToClose, setWorkspaceToClose] = useState<TerminalWorkspace | null>(null);
  // aba saindo: roda a animação de saída antes de remover de fato
  const [closingTabId, setClosingTabId] = useState<string | null>(null);
  const [isClosingWorkspace, setIsClosingWorkspace] = useState<boolean>(false);

  const [layoutMenuOpen, setLayoutMenuOpen] = useState<boolean>(false);
  const [activeSlotMenuIndex, setActiveSlotMenuIndex] = useState<number | null>(null);

  // Resizer dragging state
  const [isDraggingSplitX, setIsDraggingSplitX] = useState<boolean>(false);
  const [isDraggingSplitY, setIsDraggingSplitY] = useState<boolean>(false);
  const gridContainerRef = useRef<HTMLDivElement>(null);
  const layoutMenuRef = useRef<HTMLDivElement>(null);
  const newTabMenuRef = useRef<HTMLDivElement>(null);
  const slotMenuRefs = useRef<Map<number, HTMLDivElement>>(new Map());
  const tabsContainerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // Auto-scroll da barra de abas quando uma nova aba é criada ou selecionada
  useEffect(() => {
    if (!activeWorkspaceId) return;
    const scrollTabIntoView = (smooth: boolean = true) => {
      const tabEl = tabRefs.current.get(activeWorkspaceId);
      const container = tabsContainerRef.current;
      if (!tabEl || !container) return;

      const tabLeft = tabEl.offsetLeft;
      const tabRight = tabLeft + tabEl.offsetWidth;
      const viewLeft = container.scrollLeft;
      const viewRight = viewLeft + container.clientWidth;

      if (tabRight > viewRight) {
        const target = tabRight - container.clientWidth + 16;
        container.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
      } else if (tabLeft < viewLeft) {
        const target = Math.max(0, tabLeft - 16);
        container.scrollTo({ left: target, behavior: smooth ? 'smooth' : 'auto' });
      }
    };

    const timer1 = setTimeout(() => scrollTabIntoView(true), 40);
    const timer2 = setTimeout(() => scrollTabIntoView(false), 140);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, [activeWorkspaceId, workspaces.length]);

  // Active workspace memo
  const activeWorkspace = useMemo(() => {
    return workspaces.find((w) => w.id === activeWorkspaceId) || workspaces[0];
  }, [workspaces, activeWorkspaceId]);

  // Helper para atualizar a área de trabalho ativa
  const updateActiveWorkspace = useCallback(
    (updater: (prev: TerminalWorkspace) => TerminalWorkspace) => {
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === activeWorkspaceId ? updater(w) : w))
      );
    },
    [activeWorkspaceId]
  );

  // Derived values for currently active workspace
  const gridMode = activeWorkspace?.gridMode || '1x1';
  const splitX = activeWorkspace?.splitX ?? 50;
  const splitY = activeWorkspace?.splitY ?? 50;
  const maximizedSlotIndex = activeWorkspace?.maximizedSlotIndex ?? null;

  const setSplitX = (val: number) => updateActiveWorkspace((w) => ({ ...w, splitX: val }));
  const setSplitY = (val: number) => updateActiveWorkspace((w) => ({ ...w, splitY: val }));
  const setMaximizedSlotIndex = (idx: number | null) => updateActiveWorkspace((w) => ({ ...w, maximizedSlotIndex: idx }));

  // Salvar áreas de trabalho no localStorage com chave por workspacePath
  useEffect(() => {
    try {
      const key = workspacePath ? `devflow_cli_workspaces_${workspacePath}` : 'devflow_cli_workspaces';
      localStorage.setItem(key, JSON.stringify(workspaces));
      const activeKey = workspacePath ? `devflow_cli_active_ws_${workspacePath}` : 'devflow_cli_active_ws';
      localStorage.setItem(activeKey, activeWorkspaceId);
    } catch {}
  }, [workspaces, activeWorkspaceId, workspacePath]);

  // Active terminal session calculation
  const currentActiveSession = useMemo(() => {
    return terminalSessions.find((s) => s.id === activeSessionId) || terminalSessions[0] || null;
  }, [terminalSessions, activeSessionId]);

  // Ensure at least one terminal session exists
  useEffect(() => {
    if (terminalSessions.length === 0) {
      onNewSession('zsh', 'zsh');
    }
  }, [terminalSessions.length, onNewSession]);

  // Handle Explorer Resizing
  const handleStartExplorerResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingExplorer(true);
    dragStartXRef.current = e.clientX;
    dragStartWidthRef.current = explorerWidth;
  };

  useEffect(() => {
    if (!isDraggingExplorer) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaX = e.clientX - dragStartXRef.current;
      const newWidth = Math.max(180, Math.min(800, dragStartWidthRef.current + deltaX));
      setExplorerWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsDraggingExplorer(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingExplorer]);

  useEffect(() => {
    if (isDraggingExplorer) return;
    try { localStorage.setItem('ide_explorer_width', String(explorerWidth)); } catch {}
  }, [isDraggingExplorer, explorerWidth]);

  // Handle Grid X/Y Resizing
  const handleStartResizeSplitX = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSplitX(true);
  };

  const handleStartResizeSplitY = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingSplitY(true);
  };

  useEffect(() => {
    if (!isDraggingSplitX && !isDraggingSplitY) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!gridContainerRef.current) return;
      const rect = gridContainerRef.current.getBoundingClientRect();

      if (isDraggingSplitX) {
        const relX = e.clientX - rect.left;
        const pctX = Math.max(20, Math.min(80, (relX / rect.width) * 100));
        updateActiveWorkspace((w) => ({ ...w, splitX: pctX }));
      }

      if (isDraggingSplitY) {
        const relY = e.clientY - rect.top;
        const pctY = Math.max(20, Math.min(80, (relY / rect.height) * 100));
        updateActiveWorkspace((w) => ({ ...w, splitY: pctY }));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingSplitX(false);
      setIsDraggingSplitY(false);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingSplitX, isDraggingSplitY, updateActiveWorkspace]);

  // Keep focusedSlotIndex within valid bounds for current grid mode
  useEffect(() => {
    if (!activeWorkspace) return;
    const maxIdx =
      activeWorkspace.gridMode === '2x2' ? 3 : activeWorkspace.gridMode === '3' || activeWorkspace.gridMode === '1x3' ? 2 : activeWorkspace.gridMode === '1x1' ? 0 : 1;
    if (activeWorkspace.focusedSlotIndex > maxIdx) {
      updateActiveWorkspace((w) => ({ ...w, focusedSlotIndex: 0 }));
    }
  }, [activeWorkspace?.gridMode, activeWorkspace?.focusedSlotIndex, updateActiveWorkspace]);

  // Compute effective active sessions for each slot of the active workspace
  const effectiveSlots = useMemo(() => {
    if (!activeWorkspace) {
      return [activeSessionId || terminalSessions[0]?.id].filter(Boolean);
    }
    const mode = activeWorkspace.gridMode;
    if (mode === '1x1') {
      // o terminal salvo da área pode não existir mais (outro projeto, sessão recriada): cai na sessão ativa em vez de um terminal vazio
      const saved = activeWorkspace.slotSessionIds[0];
      const savedAlive = !!saved && terminalSessions.some((x) => x.id === saved);
      const activeAlive = !!activeSessionId && terminalSessions.some((x) => x.id === activeSessionId);
      return [savedAlive ? saved : activeAlive ? activeSessionId : terminalSessions[0]?.id || saved].filter(Boolean);
    }
    const needed = mode === '2x2' ? 4 : mode === '3' || mode === '1x3' ? 3 : 2;
    const current: string[] = [];

    // Prioritize sessions from activeWorkspace.slotSessionIds if they still exist in terminalSessions
    for (const id of activeWorkspace.slotSessionIds) {
      if (terminalSessions.some((s) => s.id === id) && !current.includes(id)) {
        current.push(id);
      }
    }

    // Fill remaining slots with available distinct sessions
    for (const s of terminalSessions) {
      if (current.length >= needed) break;
      if (!current.includes(s.id)) {
        current.push(s.id);
      }
    }

    while (current.length < needed) {
      current.push(`term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
    }

    return current.slice(0, needed);
  }, [activeWorkspace, terminalSessions, activeSessionId]);

  const ensuringSlotsRef = useRef<string | null>(null);
  // Ensure enough distinct sessions exist for current multi-terminal grid mode
  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.gridMode === '1x1') return;
    const needed = activeWorkspace.gridMode === '2x2' ? 4 : activeWorkspace.gridMode === '3' || activeWorkspace.gridMode === '1x3' ? 3 : 2;
    const currentSlots = activeWorkspace.slotSessionIds.filter((id) =>
      terminalSessions.some((s) => s.id === id)
    );
    if (currentSlots.length >= needed) {
      ensuringSlotsRef.current = null;
      return;
    }
    // Já criando para este workspace/layout (efeito disparou de novo antes do estado assentar)
    const key = `${activeWorkspace.id}:${activeWorkspace.gridMode}`;
    if (ensuringSlotsRef.current === key) return;
    ensuringSlotsRef.current = key;
    const newSlots = [...currentSlots];
    // Reaproveita terminais que já existem antes de abrir novos
    for (const s of terminalSessions) {
      if (newSlots.length >= needed) break;
      if (!newSlots.includes(s.id)) newSlots.push(s.id);
    }
    const missing = needed - newSlots.length;
    for (let i = 0; i < missing; i++) {
      const newId = onNewSession('zsh', `Terminal ${terminalSessions.length + i + 1}`);
      if (typeof newId === 'string' && !newSlots.includes(newId)) newSlots.push(newId);
    }
    updateActiveWorkspace((w) => ({ ...w, slotSessionIds: newSlots }));
  }, [activeWorkspace?.gridMode, activeWorkspace?.slotSessionIds, terminalSessions, onNewSession, updateActiveWorkspace]);

  // Sincronizar foco e seleção
  const handleFocusSlot = useCallback(
    (slotIndex: number, sessionId: string) => {
      updateActiveWorkspace((w) => ({ ...w, focusedSlotIndex: slotIndex }));
      setActiveSessionId(sessionId);
    },
    [updateActiveWorkspace, setActiveSessionId]
  );

  useEffect(() => {
    if (activeSessionId && effectiveSlots.length > 0 && activeWorkspace) {
      const idx = effectiveSlots.indexOf(activeSessionId);
      if (idx >= 0 && idx !== activeWorkspace.focusedSlotIndex) {
        updateActiveWorkspace((w) => ({ ...w, focusedSlotIndex: idx }));
      }
    }
  }, [activeSessionId, effectiveSlots, activeWorkspace?.focusedSlotIndex, updateActiveWorkspace]);

  // Switch or apply grid layout mode to active workspace
  const applyGridMode = (mode: '1x1' | '1x2' | '2x1' | '3' | '1x3' | '2x2') => {
    setLayoutMenuOpen(false);
    if (!activeWorkspace) return;

    const needed = mode === '2x2' ? 4 : mode === '3' || mode === '1x3' ? 3 : mode === '1x1' ? 1 : 2;
    const currentSlots = [...effectiveSlots];

    if (currentSlots.length < needed) {
      const missing = needed - currentSlots.length;
      for (let i = 0; i < missing; i++) {
        const pName = `Terminal ${terminalSessions.length + i + 1}`;
        const newId = onNewSession('zsh', pName);
        if (typeof newId === 'string' && !currentSlots.includes(newId)) {
          currentSlots.push(newId);
        }
      }
    }

    const nextSlots = currentSlots.slice(0, needed);
    updateActiveWorkspace((w) => ({
      ...w,
      gridMode: mode,
      slotSessionIds: nextSlots,
      focusedSlotIndex: 0,
      maximizedSlotIndex: null,
    }));
    if (nextSlots[0]) {
      setActiveSessionId(nextSlots[0]);
    }
  };

  // Quick toggle: 1x1 -> 1x2 -> 2x2 -> 1x1
  const handleQuickToggleSplit = () => {
    if (!activeWorkspace) return;
    if (activeWorkspace.gridMode === '1x1') {
      applyGridMode('1x2');
    } else if (activeWorkspace.gridMode === '1x2') {
      applyGridMode('2x2');
    } else {
      applyGridMode('1x1');
    }
  };

  // Selecionar área de trabalho ativa
  const handleSelectWorkspace = (wsId: string) => {
    setActiveWorkspaceId(wsId);
    const targetWs = workspaces.find((w) => w.id === wsId);
    if (targetWs) {
      const targetSessionId =
        targetWs.slotSessionIds[targetWs.focusedSlotIndex] || targetWs.slotSessionIds[0];
      if (targetSessionId) {
        setActiveSessionId(targetSessionId);
      }
    }
  };

  // Criar nova área de trabalho (com layout e tipo especificados)
  const handleCreateWorkspace = (
    mode: '1x1' | '1x2' | '2x1' | '3' | '1x3' | '2x2' = '1x1',
    initialType: string = 'zsh',
    initialName?: string,
    initialCmd?: string
  ): string | undefined => {
    const wsId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const needed = mode === '2x2' ? 4 : mode === '3' || mode === '1x3' ? 3 : mode === '1x1' ? 1 : 2;
    const slotIds: string[] = [];
    const slotTypes: string[] = [];

    for (let i = 0; i < needed; i++) {
      const sName = i === 0 && initialName ? initialName : `Terminal ${terminalSessions.length + i + 1}`;
      const sType = i === 0 ? initialType : 'zsh';
      const sCmd = i === 0 ? initialCmd : undefined;
      const newId = onNewSession(sType, sName, sCmd);
      const resolvedId = typeof newId === 'string' ? newId : `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      slotIds.push(resolvedId);
      slotTypes.push(sType);
    }

    const defaultName =
      initialName && mode === '1x1'
        ? initialName
        : `Área ${workspaces.length + 1}${mode !== '1x1' ? ` (${mode})` : ''}`;

    const newWs: TerminalWorkspace = {
      id: wsId,
      name: defaultName,
      gridMode: mode,
      slotSessionIds: slotIds,
      slotTypes,
      focusedSlotIndex: 0,
      splitX: 50,
      splitY: 50,
      maximizedSlotIndex: null,
    };

    setWorkspaces((prev) => [...prev, newWs]);
    setActiveWorkspaceId(wsId);
    if (slotIds[0]) {
      setActiveSessionId(slotIds[0]);
    }
    setNewTabMenuOpen(false);
    if (onToast) onToast(`Nova área de trabalho "${newWs.name}" criada`);
    return slotIds[0];
  };

  // Escreve o pedido na IA assim que ela termina de abrir (espera a saída começar e ficar quieta)
  const sendPromptWhenReady = (sessionId: string, text: string) => {
    let got = false;
    let last = 0;
    const off = window.electronAPI?.pty?.onData?.((p) => {
      if (p.id === sessionId) {
        got = true;
        last = Date.now();
      }
    });
    const t0 = Date.now();
    const timer = setInterval(() => {
      const quiet = got && Date.now() - last > 1500;
      if (!quiet && Date.now() - t0 < 25000) return;
      clearInterval(timer);
      off?.();
      window.electronAPI?.pty?.write(sessionId, `\x1b[200~${text}\x1b[201~`);
      setTimeout(() => window.electronAPI?.pty?.write(sessionId, '\r'), 250);
    }, 300);
  };

  // "Resolver com IA" (conflito / branch desatualizada do PR): abre uma área nova "Resolvendo conflitos" com a IA selecionada e manda o pedido
  const openResolveWorkspace = (text: string, title: string = 'Resolvendo conflitos') => {
    const pid = reviewAiProvider?.id || 'claude';
    const type = pid === 'antigravity' ? 'agy' : pid;
    if (!/^(claude|agy|codex|gemini|ollama)$/.test(type)) {
      onToast?.('Selecione uma IA com CLI (Claude, Antigravity, Codex ou Gemini) para resolver com IA.');
      return;
    }
    setSidebarTab('files'); // sai do detalhe do PR para mostrar o terminal da IA trabalhando
    // mesma resolução do mesmo PR: reaproveita a aba (se a IA ainda estiver aberta) em vez de criar outra
    const key = `${prTarget ? `${prTarget.repo}#${prTarget.number}` : 'pr'}|${title}|${type}`;
    const prevSid = resolveTabs.current.get(key);
    const ws = prevSid ? workspaces.find((w) => w.slotSessionIds.includes(prevSid)) : undefined;
    if (prevSid && ws && terminalSessions.some((t) => t.id === prevSid)) {
      setActiveWorkspaceId(ws.id);
      setActiveSessionId(prevSid);
      window.electronAPI?.pty?.write(prevSid, `\x1b[200~${text}\x1b[201~`);
      setTimeout(() => window.electronAPI?.pty?.write(prevSid, '\r'), 250);
      logSystemActivity('terminal', 'resolver_pr_com_ia', gitRepoName || 'default', { ia: type, reutilizada: true });
      return;
    }
    const sid = handleCreateWorkspace('1x1', type, title);
    if (!sid) return;
    resolveTabs.current.set(key, sid);
    sendPromptWhenReady(sid, text);
    logSystemActivity('terminal', 'resolver_pr_com_ia', gitRepoName || 'default', { ia: type });
  };

  // pedidos de "Resolver com IA" vindos de painéis renderizados pelo App (ex.: Problems): abrem uma nova aba de IA aqui
  const openResolveRef = useRef(openResolveWorkspace);
  openResolveRef.current = openResolveWorkspace;
  useEffect(() => {
    const onRequest = (e: Event) => {
      const d = (e as CustomEvent<{ text: string; title?: string }>).detail;
      if (d?.text) openResolveRef.current(d.text, d.title || 'Resolvendo problemas');
    };
    window.addEventListener('aura:resolve-with-ai', onRequest);
    return () => window.removeEventListener('aura:resolve-with-ai', onRequest);
  }, []);

  // Solicitar fechamento de área de trabalho (abre modal estilizado)
  const handleRequestCloseWorkspace = (ws: TerminalWorkspace, e?: React.MouseEvent) => {
    e?.stopPropagation();
    let skip = false;
    try {
      skip = localStorage.getItem('aura_cli_skip_close_ws') === '1';
    } catch {}
    if (skip) {
      handleConfirmCloseSingleWorkspace(ws);
      return;
    }
    setWorkspaceToClose(ws);
  };

  // Confirmar fechamento de uma única área de trabalho
  const handleConfirmCloseSingleWorkspace = async (target?: TerminalWorkspace) => {
    const ws = target || workspaceToClose;
    if (!ws) return;
    setIsClosingWorkspace(true);
    setClosingTabId(ws.id);
    await new Promise((r) => setTimeout(r, 180));
    try {
      for (const sid of ws.slotSessionIds) {
        if (window.electronAPI?.pty?.kill) {
          window.electronAPI.pty.kill(sid);
        }
        onCloseSession(sid);
      }

      setWorkspaces((prev) => {
        const next = prev.filter((w) => w.id !== ws.id);
        if (next.length === 0) {
          const freshId = `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
          onNewSession('zsh', 'zsh');
          const defaultWs: TerminalWorkspace = {
            id: `ws_${Date.now()}`,
            name: 'Área 1',
            gridMode: '1x1',
            slotSessionIds: [freshId],
            focusedSlotIndex: 0,
            splitX: 50,
            splitY: 50,
            maximizedSlotIndex: null,
          };
          setActiveWorkspaceId(defaultWs.id);
          setActiveSessionId(freshId);
          return [defaultWs];
        }
        if (activeWorkspaceId === ws.id) {
          setActiveWorkspaceId(next[0].id);
          if (next[0].slotSessionIds[0]) {
            setActiveSessionId(next[0].slotSessionIds[0]);
          }
        }
        return next;
      });

      if (onToast) onToast(`Área de trabalho "${ws.name}" fechada.`);
    } finally {
      setClosingTabId(null);
      setIsClosingWorkspace(false);
      setWorkspaceToClose(null);
    }
  };

  // Confirmar fechamento de todos os terminais e áreas
  const handleConfirmCloseAllTerminals = async () => {
    setIsClosingAll(true);
    try {
      for (const s of terminalSessions) {
        if (window.electronAPI?.pty?.kill) {
          window.electronAPI.pty.kill(s.id);
        }
      }

      const freshId = `term_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const freshSession: TerminalSessionItem = {
        id: freshId,
        name: 'zsh',
        type: 'zsh',
        pid: Math.floor(60000 + Math.random() * 5000),
        command: '/bin/zsh -il',
        shellIntegration: 'Rich',
      };

      setTerminalSessions([freshSession]);
      setActiveSessionId(freshId);

      const freshWs: TerminalWorkspace = {
        id: `ws_${Date.now()}`,
        name: 'Área 1',
        gridMode: '1x1',
        slotSessionIds: [freshId],
        focusedSlotIndex: 0,
        splitX: 50,
        splitY: 50,
        maximizedSlotIndex: null,
      };

      setWorkspaces([freshWs]);
      setActiveWorkspaceId(freshWs.id);

      try {
        localStorage.setItem('devflow_cli_workspaces', JSON.stringify([freshWs]));
      } catch {}

      if (onToast) onToast('Todos os terminais foram fechados com sucesso.');
    } finally {
      setIsClosingAll(false);
      setIsConfirmCloseAllOpen(false);
    }
  };

  // Fechar divisão (split slot) de dentro de um quadrante
  // Arraste de terminal por ponteiro: o terminal fica solto seguindo o mouse e o terminal sob ele desliza para a posição de origem
  const [slotDrag, setSlotDrag] = useState<{ from: number; dx: number; dy: number; over: number | null; settling: boolean } | null>(null);
  const slotRects = useRef<Map<number, DOMRect>>(new Map());
  const startSlotDrag = (e: React.PointerEvent, from: number) => {
    if (e.button !== 0 || (e.target as HTMLElement).closest('button, input, a')) return;
    const sx = e.clientX;
    const sy = e.clientY;
    let active = false;
    const hit = (x: number, y: number) => {
      for (const [i, r] of slotRects.current) if (i !== from && x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return i;
      return null;
    };
    const move = (ev: PointerEvent) => {
      if (!active) {
        if (Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return;
        active = true;
        slotRects.current.clear();
        document.querySelectorAll<HTMLElement>('[data-slot-index]').forEach((el) => slotRects.current.set(Number(el.dataset.slotIndex), el.getBoundingClientRect()));
        document.body.style.userSelect = 'none';
        document.body.style.cursor = 'grabbing';
      }
      setSlotDrag({ from, dx: ev.clientX - sx, dy: ev.clientY - sy, over: hit(ev.clientX, ev.clientY), settling: false });
    };
    const up = (ev: PointerEvent) => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
      if (!active) return;
      const over = hit(ev.clientX, ev.clientY);
      const src = slotRects.current.get(from);
      const dst = over !== null ? slotRects.current.get(over) : undefined;
      // assenta no lugar: o terminal solto desliza até a posição alvo (ou volta) antes de trocar de verdade
      setSlotDrag({ from, dx: dst && src ? dst.left - src.left : 0, dy: dst && src ? dst.top - src.top : 0, over, settling: true });
      window.setTimeout(() => {
        if (over !== null) handleSwapSlots(from, over);
        setSlotDrag(null);
      }, 200);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  const handleSwapSlots = (from: number, to: number) => {
    if (!activeWorkspace || from === to) return;
    const next = [...effectiveSlots];
    if (!next[from] || !next[to]) return;
    [next[from], next[to]] = [next[to], next[from]];
    updateActiveWorkspace((w) => ({ ...w, slotSessionIds: next, focusedSlotIndex: to, maximizedSlotIndex: null }));
    setActiveSessionId(next[to]);
    logSystemActivity('terminal', 'reposicionar_terminal', gitRepoName || 'default', { from, to });
  };

  const handleCloseSplitSlot = (slotIndex: number) => {
    if (!activeWorkspace) return;
    const mode = activeWorkspace.gridMode;
    const closingSessionId = effectiveSlots[slotIndex];

    if (mode === '2x2') {
      const nextSlots = effectiveSlots.filter((_, idx) => idx !== slotIndex);
      updateActiveWorkspace((w) => ({
        ...w,
        gridMode: '3',
        slotSessionIds: nextSlots,
        focusedSlotIndex: 0,
      }));
    } else if (mode === '3' || mode === '1x3') {
      const nextSlots = effectiveSlots.filter((_, idx) => idx !== slotIndex);
      updateActiveWorkspace((w) => ({
        ...w,
        gridMode: '1x2',
        slotSessionIds: nextSlots,
        focusedSlotIndex: 0,
      }));
    } else if (mode === '1x2' || mode === '2x1') {
      const nextSlots = effectiveSlots.filter((_, idx) => idx !== slotIndex);
      updateActiveWorkspace((w) => ({
        ...w,
        gridMode: '1x1',
        slotSessionIds: nextSlots.slice(0, 1),
        focusedSlotIndex: 0,
      }));
    } else {
      setWorkspaceToClose(activeWorkspace);
    }

    if (closingSessionId) {
      if (window.electronAPI?.pty?.kill) {
        window.electronAPI.pty.kill(closingSessionId);
      }
      onCloseSession(closingSessionId);
    }

    // O terminal que sobrou vira o ativo (senão o 1x1 renderiza a sessão fechada e abre em branco)
    const remaining = effectiveSlots.filter((_, idx) => idx !== slotIndex)[0];
    if (remaining && closingSessionId) {
      setActiveSessionId(remaining);
      setTimeout(() => window.dispatchEvent(new CustomEvent('devflow:focus-terminal', { detail: { sessionId: remaining } })), 120);
    }
  };

  // Close context menus & dropdowns on outside click/mousedown
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      const insideFileMenu = (target as HTMLElement).closest?.('[data-file-ctx-menu]');
      if (fileContextMenu && !insideFileMenu) setFileContextMenu(null);
      if (explorerMenuOpen) setExplorerMenuOpen(false);

      if (layoutMenuOpen && layoutMenuRef.current && !layoutMenuRef.current.contains(target)) {
        setLayoutMenuOpen(false);
      }
      if (newTabMenuOpen && newTabMenuRef.current && !newTabMenuRef.current.contains(target)) {
        setNewTabMenuOpen(false);
      }
      if (activeSlotMenuIndex !== null) {
        const slotEl = slotMenuRefs.current.get(activeSlotMenuIndex);
        if (!slotEl || !slotEl.contains(target)) {
          setActiveSlotMenuIndex(null);
        }
      }
    };
    window.addEventListener('mousedown', handleGlobalMouseDown);
    return () => window.removeEventListener('mousedown', handleGlobalMouseDown);
  }, [fileContextMenu, explorerMenuOpen, newTabMenuOpen, layoutMenuOpen, activeSlotMenuIndex]);

  // Helper to send text command directly into a specific or active terminal session
  const writeToSession = useCallback((sessionId: string, text: string) => {
    if (window.electronAPI?.pty?.write) {
      window.electronAPI.pty.write(sessionId, text);
    }
  }, []);

  const writeToActiveTerminal = useCallback(
    (text: string) => {
      if (activeSessionId) {
        writeToSession(activeSessionId, text);
      }
    },
    [activeSessionId, writeToSession]
  );

  // Detecção dinâmica de título do processo para identificar CLIs de IA
  const shellRespawnedAt = useRef(new Map<string, number>());
  // A IA do terminal terminou e o main reabriu um shell: o terminal deixa de ser "de IA" (nome, ícone e cor do cabeçalho voltam ao padrão)
  useEffect(() => {
    return window.electronAPI?.pty?.onSessionStatus?.((st) => {
      if (!st.exited || !st.shellRespawned) return;
      shellRespawnedAt.current.set(st.id, Date.now());
      setTerminalSessions((prev) => prev.map((x) => (x.id === st.id ? { ...x, type: 'zsh', name: 'zsh', command: undefined, initialCommand: undefined } : x)));
      setWorkspaces((prev) =>
        prev.map((w) => {
          const idx = w.slotSessionIds.indexOf(st.id);
          if (idx < 0) return w;
          const slotTypes = w.slotTypes ? w.slotTypes.map((t, i) => (i === idx ? 'zsh' : t)) : w.slotTypes;
          const aiName = idx === 0 && /claude|antigravity|agy|gemini|codex|ollama/i.test(w.name);
          return { ...w, slotTypes, name: aiName ? 'Terminal' : w.name };
        }),
      );
    });
  }, [setTerminalSessions]);

  // Atividade da IA em abas que o usuário não está vendo: 'working' (gerando, ícone pulsa) → 'done' (terminou, ícone pula até abrir a aba)
  const [aiTabState, setAiTabState] = useState<Record<string, 'working' | 'done'>>({});
  const aiTabStateRef = useRef<Record<string, 'working' | 'done'>>({});
  const aiLastOutput = useRef(new Map<string, number>());
  const viewCtxRef = useRef<{ viewed: Set<string>; isAi: (sid: string) => boolean }>({ viewed: new Set(), isAi: () => false });
  const setAiState = useCallback((sid: string, st?: 'working' | 'done') => {
    const cur = aiTabStateRef.current;
    if (cur[sid] === st) return;
    const next = { ...cur };
    if (st) next[sid] = st;
    else delete next[sid];
    aiTabStateRef.current = next;
    setAiTabState(next);
  }, []);
  useEffect(() => {
    const off = window.electronAPI?.pty?.onData?.(({ id }) => {
      const ctx = viewCtxRef.current;
      if (ctx.viewed.has(id) || !ctx.isAi(id)) return;
      aiLastOutput.current.set(id, Date.now());
      if (aiTabStateRef.current[id] !== 'working') setAiState(id, 'working');
    });
    const timer = setInterval(() => {
      const now = Date.now();
      for (const [sid, st] of Object.entries(aiTabStateRef.current)) {
        if (st === 'working' && now - (aiLastOutput.current.get(sid) || 0) > 2500) setAiState(sid, 'done');
      }
    }, 1000);
    return () => {
      off?.();
      clearInterval(timer);
    };
  }, [setAiState]);

  const handleSessionTitleChange = useCallback(
    (sessionId: string, newTitle: string) => {
      if (!newTitle) return;
      // logo depois de a IA encerrar, o título velho dela ainda chega (reprodução do histórico): não pode religar o tipo de IA
      if (Date.now() - (shellRespawnedAt.current.get(sessionId) || 0) < 5000) return;
      const lower = newTitle.toLowerCase();
      let detectedType: string | undefined;
      // o Claude Code põe ✳ (ocioso) ou um spinner braille (gerando) no início do título, sem citar o nome
      if (lower.includes('claude') || /^[\u2733\u273B\u2736\u2800-\u28FF]/.test(newTitle)) detectedType = 'claude';
      else if (lower.includes('antigravity') || lower.includes('agy')) detectedType = 'antigravity';
      else if (lower.includes('gemini')) detectedType = 'gemini';
      else if (lower.includes('codex')) detectedType = 'codex';
      else if (lower.includes('ollama')) detectedType = 'ollama';

      if (detectedType) {
        setTerminalSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, type: detectedType, name: newTitle } : s))
        );
      }

      // a IA resume a conversa no título (ex.: "✳ Corrigindo problemas do login"): vira o nome da aba, salvo junto das áreas de trabalho
      const topic = newTitle.replace(/^[\s\u2733\u273B\u2736\u2800-\u28FF*·•.]+/, '').trim();
      const generic = !topic || /^(claude( code)?|antigravity|agy|gemini|codex|ollama|zsh|bash|sh|terminal|node|python)$/i.test(topic) || /^[~/]/.test(topic) || topic.length < 3;
      if (!generic && (detectedType || /^[\u2733\u273B\u2736\u2800-\u28FF]/.test(newTitle))) {
        const name = topic.length > 40 ? `${topic.slice(0, 39)}…` : topic;
        setWorkspaces((prev) => {
          const w = prev.find((x) => x.slotSessionIds[0] === sessionId);
          if (!w || w.userNamed || w.name === name) return prev;
          return prev.map((x) => (x.id === w.id ? { ...x, name } : x));
        });
      }
    },
    [setTerminalSessions, setWorkspaces]
  );

  const [cliDockTab, setCliDockTab] = useState('terminal');
  const [issueMenuOpen, setIssueMenuOpen] = useState<number | null>(null);
  const [dockMenuOpen, setDockMenuOpen] = useState(false);
  // arquivo aberto no editor de código do CLI (ocupa a área dos terminais até voltar)
  const [viewer, setViewer] = useState<{
    path: string;
    name: string;
    content?: string;
    savedContent?: string;
    initialContent?: string;
    originalHeadContent?: string;
    isDiffMode?: boolean;
    isSideBySide?: boolean;
    gitStatus?: 'modified' | 'added' | 'deleted';
    reviewFiles?: Array<{ path: string; name: string; repoDir?: string; relPath?: string; status?: 'modified' | 'added' | 'deleted' }>;
    reviewIndex?: number;
    dataUrl?: string;
    error?: string;
    isSaving?: boolean;
    savedAt?: number;
  } | null>(null);
  const viewerRef = useRef(viewer);
  viewerRef.current = viewer;
  const cliEditorInstanceRef = useRef<any>(null);
  const [viewerCursor, setViewerCursor] = useState({ line: 1, col: 1, tabSize: 2, eol: 'LF' as 'LF' | 'CRLF' });
  const [viewerBlame, setViewerBlame] = useState('');

  const handleSaveViewerFile = useCallback(
    async (overrideContent?: string, silent?: boolean): Promise<boolean> => {
      const cur = viewerRef.current;
      if (!cur || cur.dataUrl || cur.error || cur.content === undefined) return false;
      const contentToSave = overrideContent !== undefined ? overrideContent : cur.content;
      setViewer((prev) => (prev && prev.path === cur.path ? { ...prev, isSaving: true } : prev));
      try {
        const res = await window.electronAPI?.fs?.writeFile?.(cur.path, contentToSave);
        if (res && res.error) {
          if (!silent) onToast?.(`Erro ao salvar ${cur.name}: ${res.error}`);
          setViewer((prev) => (prev && prev.path === cur.path ? { ...prev, isSaving: false } : prev));
          return false;
        }
        const now = Date.now();
        setViewer((prev) =>
          prev && prev.path === cur.path
            ? { ...prev, content: contentToSave, savedContent: contentToSave, isSaving: false, savedAt: now }
            : prev
        );
        try {
          logSystemActivity(
            workspacePath || '',
            'file_edit',
            `Arquivo editado no CLI: ${cur.name}`,
            `Alterações manuais salvas em ${cur.path}`,
            { path: cur.path, name: cur.name }
          );
        } catch {}
        if (!silent) onToast?.(`Arquivo salvo: ${cur.name}`);
        return true;
      } catch (err: any) {
        setViewer((prev) => (prev && prev.path === cur.path ? { ...prev, isSaving: false } : prev));
        if (!silent) onToast?.(`Falha ao salvar ${cur.name}: ${err?.message || err}`);
        return false;
      }
    },
    [workspacePath, onToast]
  );

  const [mdPreview, setMdPreview] = useState(false);
  // último autor do arquivo aberto (git blame resumido)
  useEffect(() => {
    setViewerBlame('');
    if (!viewer?.path || !window.electronAPI?.shell?.exec) return;
    let stop = false;
    const dir = viewer.path.split('/').slice(0, -1).join('/') || workspacePath;
    window.electronAPI.shell
      .exec(`git log -1 --format='%an (%ar)' -- '${viewer.path.replace(/'/g, "'\\''")}'`, dir)
      .then((r) => !stop && r.exitCode === 0 && setViewerBlame(r.stdout.trim()))
      .catch(() => {});
    return () => {
      stop = true;
    };
  }, [viewer?.path]);

  // a barra de status do app mostra a posição, indentação e linguagem do arquivo do CLI
  useEffect(() => {
    if (!onViewerStatus) return;
    onViewerStatus(viewer && !viewer.dataUrl && !viewer.error ? { path: viewer.path, name: viewer.name, language: getFileLanguage(viewer.name), blame: viewerBlame, line: viewerCursor.line, col: viewerCursor.col, tabSize: viewerCursor.tabSize, eol: viewerCursor.eol } : null);
  }, [viewer?.path, viewer?.name, viewer?.dataUrl, viewer?.error, viewerBlame, viewerCursor]);
  useEffect(() => () => onViewerStatus?.(null), []);

  const openViewer = useCallback(
    async (
      path: string,
      name: string,
      opts?: {
        isDiffMode?: boolean;
        repoDir?: string;
        relPath?: string;
        status?: 'modified' | 'added' | 'deleted';
        reviewFiles?: Array<{ path: string; name: string; repoDir?: string; relPath?: string; status?: 'modified' | 'added' | 'deleted' }>;
        reviewIndex?: number;
      }
    ) => {
      const prev = viewerRef.current;
      if (
        prev &&
        prev.path !== path &&
        prev.content !== undefined &&
        prev.savedContent !== undefined &&
        prev.content !== prev.savedContent
      ) {
        await handleSaveViewerFile(prev.content, true);
      }
      setPreviewDesignScreen(null);
      setMdPreview(!opts?.isDiffMode && isMarkdownFile(name));
      setViewer({
        path,
        name,
        isDiffMode: Boolean(opts?.isDiffMode),
        isSideBySide: prev?.isSideBySide ?? true,
        gitStatus: opts?.status,
        reviewFiles: opts?.reviewFiles,
        reviewIndex: opts?.reviewIndex,
      });
      const fsApi = window.electronAPI?.fs;
      try {
        if (!opts?.isDiffMode && /\.(png|jpe?g|gif|webp|ico|bmp)$/i.test(name)) {
          const r = await fsApi?.readFileDataUrl?.(path, 20 * 1024 * 1024);
          setViewer((v) =>
            v?.path === path
              ? { ...v, dataUrl: r?.dataUrl, error: r?.dataUrl ? undefined : r?.error || 'Não foi possível abrir a imagem' }
              : v
          );
        } else {
          const baseDir = opts?.repoDir || workspacePath || path.split('/').slice(0, -1).join('/');
          let rel = opts?.relPath || path;
          if (baseDir && rel.startsWith(baseDir + '/')) {
            rel = rel.slice(baseDir.length + 1);
          }
          const [r, gitShowRes] = await Promise.all([
            opts?.status === 'deleted' ? Promise.resolve({ content: '', error: undefined }) : fsApi?.readFile(path),
            opts?.isDiffMode && window.electronAPI?.shell?.exec && opts?.status !== 'added'
              ? window.electronAPI.shell.exec(`git show HEAD:"${rel}"`, baseDir).catch(() => null)
              : Promise.resolve(null),
          ]);
          const text = r?.content ?? '';
          const origHead = gitShowRes && gitShowRes.exitCode === 0 ? gitShowRes.stdout : '';
          setViewer((v) =>
            v?.path === path
              ? {
                  ...v,
                  content: text,
                  savedContent: text,
                  initialContent: text,
                  originalHeadContent: origHead,
                  error: opts?.status === 'deleted' ? undefined : r?.error,
                }
              : v
          );
        }
      } catch (err: any) {
        setViewer((v) => (v?.path === path ? { ...v, error: err?.message || 'Falha ao ler o arquivo' } : v));
      }
    },
    [handleSaveViewerFile, workspacePath]
  );

  const openGitDiffInCli = useCallback(
    (
      files: Array<{ path: string; name: string; repoDir?: string; relPath?: string; status?: 'modified' | 'added' | 'deleted' }>,
      index = 0
    ) => {
      if (!files || files.length === 0) return;
      const safeIdx = Math.max(0, Math.min(index, files.length - 1));
      const target = files[safeIdx];
      if (!target) return;
      openViewer(target.path, target.name || target.path.split('/').pop() || 'file', {
        isDiffMode: true,
        repoDir: target.repoDir,
        relPath: target.relPath,
        status: target.status,
        reviewFiles: files,
        reviewIndex: safeIdx,
      });
    },
    [openViewer]
  );

  const closeViewer = useCallback(async () => {
    const cur = viewerRef.current;
    if (
      cur &&
      cur.content !== undefined &&
      cur.savedContent !== undefined &&
      cur.content !== cur.savedContent
    ) {
      await handleSaveViewerFile(cur.content, true);
    }
    setViewer(null);
  }, [handleSaveViewerFile]);

  // Auto-save silencioso após 1s de inatividade ao editar manualmente no CLI
  useEffect(() => {
    if (!viewer || viewer.dataUrl || viewer.error || viewer.content === undefined || viewer.savedContent === undefined) return;
    if (viewer.content === viewer.savedContent) return;
    const timer = setTimeout(() => {
      handleSaveViewerFile(viewer.content, true);
    }, 1000);
    return () => clearTimeout(timer);
  }, [viewer?.path, viewer?.content, viewer?.savedContent, viewer?.dataUrl, viewer?.error, handleSaveViewerFile]);

  // Atalho global Cmd+S / Ctrl+S enquanto um arquivo está aberto no editor do CLI
  useEffect(() => {
    if (!viewer || viewer.dataUrl || viewer.error || viewer.content === undefined) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        e.stopPropagation();
        handleSaveViewerFile();
      }
    };
    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [viewer?.path, viewer?.dataUrl, viewer?.error, viewer?.content !== undefined, handleSaveViewerFile]);

  // Tooltips imediatos e estilizados para qualquer elemento com title (o title nativo é movido para data-tip ao passar o mouse)
  const viewRootRef = useRef<HTMLDivElement>(null);

  // Estilo visual do terminal: o painel da esquerda e a barra de abas também ganham o fundo, a moldura e a paleta do estilo
  const skinId = terminalSkin ?? 'none';
  const skinActive = skinId !== 'none';
  const skinTheme = TERMINAL_THEMES[terminalThemePreset || 'default'] || TERMINAL_THEMES.default;
  const skinTk = skinActive
    ? {
        ...themeTokens,
        bgCard: skinTheme.background,
        bgCardSecondary: skinTheme.black || skinTheme.background,
        textPrimary: skinTheme.foreground,
        textSecondary: skinTheme.brightBlack || themeTokens.textSecondary,
        border: `${skinTheme.foreground}33`,
        hoverBg: `${skinTheme.foreground}14`,
      }
    : themeTokens;
  const [tip, setTip] = useState<{ text: string; x: number; y: number; above: boolean } | null>(null);
  useEffect(() => {
    let timer: any;
    const hide = () => { clearTimeout(timer); setTip(null); };
    const over = (e: MouseEvent) => {
      const root = viewRootRef.current;
      const t = e.target as HTMLElement | null;
      if (!root || !t || !root.contains(t)) return;
      const el = t.closest('[title],[data-tip]') as HTMLElement | null;
      if (!el || !root.contains(el)) { hide(); return; }
      const title = el.getAttribute('title');
      if (title) { el.setAttribute('data-tip', title); el.removeAttribute('title'); }
      const text = el.getAttribute('data-tip');
      if (!text) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        const r = el.getBoundingClientRect();
        const above = r.bottom + 40 > window.innerHeight;
        setTip({ text, x: Math.min(Math.max(r.left + r.width / 2, 120), window.innerWidth - 120), y: above ? r.top - 8 : r.bottom + 8, above });
      }, 120);
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('mousedown', hide, true);
    document.addEventListener('mouseleave', hide);
    return () => { document.removeEventListener('mouseover', over); document.removeEventListener('mousedown', hide, true); document.removeEventListener('mouseleave', hide); clearTimeout(timer); };
  }, []);

  // IA rodando de verdade no terminal (agy, claude, gemini...), mesmo iniciada digitando no shell: olha o processo em primeiro plano
  const autoTypedRef = useRef(new Map<string, { type: string; name: string }>()); // sessões que renomeei por detecção, com o tipo/nome originais
  useEffect(() => {
    const kindOf = (proc: string) => {
      const p = proc.toLowerCase();
      if (p === 'agy' || p.includes('antigravity')) return 'antigravity';
      // o binário nativo do Claude Code aparece com o número da versão (ex.: 2.1.309)
      if (p.includes('claude') || /^\d+\.\d+\.\d+/.test(p)) return 'claude';
      if (p.includes('gemini')) return 'gemini';
      if (p.includes('codex')) return 'codex';
      if (p.includes('ollama')) return 'ollama';
      return undefined;
    };
    const timer = setInterval(async () => {
      const fg = await window.electronAPI?.pty?.foreground?.().catch(() => null);
      if (!fg) return;
      setTerminalSessions((prev) => {
        let changed = false;
        const next = prev.map((s) => {
          const proc = fg[s.id];
          if (proc === undefined) return s;
          const kind = kindOf(proc);
          if (kind && s.type !== kind) {
            if (!autoTypedRef.current.has(s.id)) autoTypedRef.current.set(s.id, { type: s.type, name: s.name });
            changed = true;
            return { ...s, type: kind, name: kind === 'antigravity' ? 'Antigravity' : kind.charAt(0).toUpperCase() + kind.slice(1) };
          }
          if (!kind && autoTypedRef.current.has(s.id) && /^-?(zsh|bash|sh|fish)$/.test(proc)) {
            const orig = autoTypedRef.current.get(s.id)!;
            autoTypedRef.current.delete(s.id);
            changed = true;
            return { ...s, type: orig.type, name: orig.name };
          }
          return s;
        });
        return changed ? next : prev;
      });
    }, 1500);
    return () => clearInterval(timer);
  }, [setTerminalSessions]);

  // IA aberta fora de um quadrante (ex.: botão do header) substitui o terminal do quadrante em foco
  useEffect(() => {
    if (!activeSessionId || !activeWorkspace) return;
    const sess = terminalSessions.find((x) => x.id === activeSessionId);
    if (!sess || !AI_SESSION_TYPE.test(sess.type)) return;
    if (workspaces.some((w) => w.slotSessionIds.includes(activeSessionId))) return;
    updateActiveWorkspace((w) => {
      const slots = [...w.slotSessionIds];
      slots[Math.min(w.focusedSlotIndex, slots.length)] = activeSessionId;
      return { ...w, slotSessionIds: slots };
    });
  }, [activeSessionId, terminalSessions, workspaces, activeWorkspace, updateActiveWorkspace]);

  // "Novo contexto" do aviso de contexto cheio: troca a sessão de IA por uma nova do mesmo tipo, no mesmo quadrante
  const newContextRef = useRef<(sessionId: string) => void>(() => {});
  newContextRef.current = (sessionId: string) => {
    const old = terminalSessions.find((s) => s.id === sessionId);
    if (!old) return;
    const cmd = { claude: 'claude', agy: 'agy', antigravity: 'agy', gemini: 'gemini', codex: 'codex', ollama: 'ollama' }[old.type] as string | undefined;
    const newId = onNewSession(old.type, old.name, cmd);
    if (typeof newId !== 'string') return;
    setWorkspaces((prev) => prev.map((w) => ({ ...w, slotSessionIds: w.slotSessionIds.map((id) => (id === sessionId ? newId : id)) })));
    setActiveSessionId(newId);
    window.electronAPI?.pty?.kill?.(sessionId);
    onCloseSession(sessionId);
    logSystemActivity('terminal', 'novo_contexto_ia', cleanSessionName(old), { type: old.type });
  };
  useEffect(() => {
    const onNewContext = (e: Event) => {
      const id = (e as CustomEvent).detail?.sessionId;
      if (id) newContextRef.current(id);
    };
    window.addEventListener('devflow:new-context', onNewContext);
    return () => window.removeEventListener('devflow:new-context', onNewContext);
  }, []);

  // Terminais que não são de IA e não estão abertos em nenhum quadrante são fechados sozinhos (com uma folga p/ sessões recém-criadas)
  useEffect(() => {
    const timer = setTimeout(() => {
      const inUse = new Set<string>(workspaces.flatMap((w) => w.slotSessionIds));
      if (activeSessionId) inUse.add(activeSessionId);
      const stale = terminalSessions.filter((t) => !inUse.has(t.id) && !AI_SESSION_TYPE.test(t.type));
      if (!stale.length) return;
      stale.forEach((t) => {
        window.electronAPI?.pty?.kill?.(t.id);
        onCloseSession(t.id);
      });
      logSystemActivity('terminal', 'fechar_terminais_vazios_auto', `${stale.length} terminais`, { names: stale.map((t) => cleanSessionName(t)) });
    }, 1500);
    return () => clearTimeout(timer);
  }, [terminalSessions, workspaces, activeSessionId, onCloseSession]);

  // Helper para obter o tipo de IA ou CLI para o slot da área de trabalho
  const getSlotAiType = (ws: TerminalWorkspace, slotIndex: number, session?: TerminalSessionItem): string => {
    if (session?.type && session.type !== 'zsh') return session.type;
    if (session?.name) {
      const n = session.name.toLowerCase();
      if (n.includes('claude')) return 'claude';
      if (n.includes('antigravity') || n.includes('agy')) return 'antigravity';
      if (n.includes('gemini')) return 'gemini';
      if (n.includes('codex')) return 'codex';
      if (n.includes('ollama')) return 'ollama';
      if (n.includes('python')) return 'python';
      if (n.includes('node')) return 'node';
      if (n.includes('bash')) return 'bash';
    }
    if (ws.slotTypes?.[slotIndex]) return ws.slotTypes[slotIndex];
    if (slotIndex === 0 && ws.name) {
      const wn = ws.name.toLowerCase();
      if (wn.includes('claude')) return 'claude';
      if (wn.includes('antigravity') || wn.includes('agy')) return 'antigravity';
      if (wn.includes('gemini')) return 'gemini';
      if (wn.includes('codex')) return 'codex';
      if (wn.includes('ollama')) return 'ollama';
    }
    return session?.type || 'zsh';
  };

  // Helper to get session icon (Claude, Antigravity, Gemini, Codex, Ollama, Bash, Python, Node, Zsh)
  const getSessionIcon = (session: TerminalSessionItem, size: number = 14) => {
    const t = session.type?.toLowerCase() || '';
    const n = session.name?.toLowerCase() || '';
    const c = session.command?.toLowerCase() || '';
    const initCmd = session.initialCommand?.toLowerCase() || '';

    if (t === 'claude' || n.includes('claude') || c.includes('claude') || initCmd.includes('claude')) {
      return <ClaudeIcon size={size} />;
    }
    if (
      t === 'antigravity' ||
      t === 'agy' ||
      n.includes('antigravity') ||
      n.includes('agy') ||
      c.includes('agy') ||
      initCmd.includes('agy')
    ) {
      return <AntigravityIcon size={size} />;
    }
    if (t === 'gemini' || n.includes('gemini') || c.includes('gemini') || initCmd.includes('gemini')) {
      return <GeminiIcon size={size} />;
    }
    if (t === 'codex' || n.includes('codex') || c.includes('codex') || initCmd.includes('codex')) {
      return <CodexIcon size={size} />;
    }
    if (t === 'ollama' || n.includes('ollama') || c.includes('ollama') || initCmd.includes('ollama')) {
      return <OllamaIcon size={size} />;
    }
    if (t === 'bash' || n.includes('bash')) {
      return <TerminalIcon size={size} color="#10b981" />;
    }
    if (t === 'python' || n.includes('python')) {
      return <Play size={size} color="#3b82f6" />;
    }
    if (t === 'node' || n.includes('node')) {
      return <Play size={size} color="#22c55e" />;
    }
    return (
      <SquareTerminal
        size={size}
        color={session.id === activeSessionId ? accentColor : themeTokens.textSecondary}
      />
    );
  };

  // Renderiza o ícone visual correspondente à IA ou shell
  const renderAiIcon = (type: string, size: number = 14) => {
    const t = type.toLowerCase();
    if (t === 'claude') return <ClaudeIcon size={size} />;
    if (t === 'antigravity' || t === 'agy') return <AntigravityIcon size={size} />;
    if (t === 'gemini') return <GeminiIcon size={size} />;
    if (t === 'codex') return <CodexIcon size={size} />;
    if (t === 'ollama') return <OllamaIcon size={size} />;
    if (t === 'bash') return <TerminalIcon size={size} color="#10b981" />;
    if (t === 'python') return <Play size={size} color="#3b82f6" />;
    if (t === 'node') return <Play size={size} color="#22c55e" />;
    return <SquareTerminal size={size} color={accentColor} />;
  };

  // sessões da aba aberta são "vistas": zera o estado delas e não anima mais
  {
    // só "vê" o terminal quem está com ele na tela (PRs, Actions, editor de arquivo ou outras abas do dock escondem o terminal)
    const terminalOnScreen = !showPrDetail && !showActions && !previewDesignScreen && !viewer && !(cliDockTab !== 'terminal' && renderDockContent);
    const viewedWs = terminalOnScreen ? workspaces.find((w) => w.id === activeWorkspaceId) : undefined;
    viewCtxRef.current = {
      viewed: new Set((viewedWs?.slotSessionIds || []).filter(Boolean) as string[]),
      isAi: (sid) => {
        for (const w of workspaces) {
          const idx = w.slotSessionIds.indexOf(sid);
          if (idx >= 0) return getSlotAiType(w, idx, terminalSessions.find((t) => t.id === sid)) !== 'zsh';
        }
        return false;
      },
    };
  }
  useEffect(() => {
    const ws = viewCtxRef.current.viewed;
    ws.forEach((sid) => aiTabStateRef.current[sid] && setAiState(sid, undefined));
  }, [activeWorkspaceId, workspaces, aiTabState, setAiState, showPrDetail, showActions, previewDesignScreen, viewer, cliDockTab]);

  // Renderiza o(s) ícone(s) da área de trabalho na aba:
  // Se for tela única (1x1), exibe o ícone da IA ou CLI em execução.
  // Se for um grid (1x2, 2x1, 3, 2x2), exibe os ícones empilhados (stacked) em cascata!
  const renderWorkspaceTabIcons = (ws: TerminalWorkspace, isActive: boolean) => {
    const needed = ws.gridMode === '2x2' ? 4 : ws.gridMode === '3' || ws.gridMode === '1x3' ? 3 : ws.gridMode === '1x1' ? 1 : 2;
    const slotItems: { type: string; name: string; sid?: string }[] = [];

    for (let i = 0; i < needed; i++) {
      const sid = ws.slotSessionIds?.[i];
      const session = terminalSessions.find((s) => s.id === sid);
      const slotType = getSlotAiType(ws, i, session);
      const slotName =
        session?.name || (slotType !== 'zsh' ? `${slotType.toUpperCase()} CLI` : `Terminal ${i + 1}`);
      slotItems.push({ type: slotType, name: slotName, sid });
    }

    // cada ícone anima pelo estado da própria sessão: só a IA que gerou algo pulsa/pula
    const animFor = (sid?: string) => {
      const st = isActive || !sid ? undefined : aiTabState[sid];
      return st === 'working' ? 'dfTabIconPulse 1.2s ease-in-out infinite' : st === 'done' ? 'dfTabIconBounce 0.9s var(--ease-out) infinite' : undefined;
    };

    // Tela única (1x1) ou apenas 1 terminal: exibe ícone individual limpo
    if (ws.gridMode === '1x1' || slotItems.length <= 1) {
      const item = slotItems[0] || { type: 'zsh', name: 'Terminal' };
      return (
        <div
          title={item.name}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, animation: animFor(item.sid) }}
        >
          {renderAiIcon(item.type, 14.5)}
        </div>
      );
    }

    // Grid ou Split com múltiplos terminais: exibe os ícones EMPILHADOS (avatar stack)
    return (
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          flexShrink: 0,
          paddingRight: 2,
        }}
      >
        {slotItems.map((item, idx) => (
          <div
            key={idx}
            title={`Q${idx + 1}: ${item.name}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 17,
              height: 17,
              borderRadius: 4.5,
              marginLeft: idx === 0 ? 0 : -5,
              zIndex: slotItems.length - idx,
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              animation: animFor(item.sid),
            }}
          >
            {renderAiIcon(item.type, 10.5)}
          </div>
        ))}
      </div>
    );
  };

  // Clear current active terminal
  const handleClearTerminal = () => {
    writeToActiveTerminal('clear\r');
  };

  // Filtered file tree when searching
  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return fileTree;
    const q = searchQuery.toLowerCase();

    const filterNode = (node: ExplorerNode): ExplorerNode | null => {
      const match = node.name.toLowerCase().includes(q);
      if (node.isDirectory && node.children) {
        const filteredChildren = node.children
          .map(filterNode)
          .filter(Boolean) as ExplorerNode[];
        if (filteredChildren.length > 0 || match) {
          return { ...node, children: filteredChildren };
        }
      }
      return match ? node : null;
    };

    return fileTree.map(filterNode).filter(Boolean) as ExplorerNode[];
  }, [fileTree, searchQuery]);

  // Cada terminal vive num elemento próprio e estável, montado por portal fora dos quadrantes: trocar de lugar só move esse elemento
  // (o xterm não é recriado nem relê o histórico, então não pisca)
  const termHosts = useRef(new Map<string, HTMLDivElement>());
  // Cola no terminal o caminho de arquivos soltos nele (do Finder ou da árvore do projeto)
  const dropOnSession = (sessionId: string, dt: DataTransfer) => {
    setDropSlotId(null);
    const paths: string[] = [];
    for (const f of Array.from(dt.files || [])) {
      const real = window.electronAPI?.fs?.getPathForFile?.(f);
      if (real) paths.push(real);
    }
    if (!paths.length) {
      const filePath = dt.getData('text/plain');
      if (filePath) paths.push(filePath);
    }
    if (paths.length) {
      writeToSession(sessionId, paths.map((x) => `"${x}"`).join(' ') + ' ');
      onToast?.(paths.length === 1 ? `Caminho colado: ${paths[0].split('/').pop()}` : `${paths.length} caminhos colados`);
      logSystemActivity('terminal', 'arrastar_arquivos_para_terminal', gitRepoName || 'default', { total: paths.length });
    }
    [0, 120].forEach((ms) => setTimeout(() => window.dispatchEvent(new CustomEvent('devflow:focus-terminal', { detail: { sessionId } })), ms));
  };
  termDropRef.current = { over: (id) => setDropSlotId((cur) => (cur === id ? cur : id)), leave: () => setDropSlotId(null), drop: dropOnSession };

  const getTermHost = (id: string) => {
    let h = termHosts.current.get(id);
    if (!h) {
      h = document.createElement('div');
      h.style.cssText = 'position:relative;width:100%;height:100%';
      const hostId = id;
      h.addEventListener('dragover', (ev) => {
        if (!ev.dataTransfer || Array.from(ev.dataTransfer.types).includes('application/x-aura-tab')) return;
        ev.preventDefault();
        ev.dataTransfer.dropEffect = 'copy';
        termDropRef.current?.over(hostId);
      });
      h.addEventListener('dragleave', (ev) => {
        if (!h!.contains(ev.relatedTarget as Node | null)) termDropRef.current?.leave();
      });
      h.addEventListener('drop', (ev) => {
        if (!ev.dataTransfer || Array.from(ev.dataTransfer.types).includes('application/x-aura-tab')) return;
        ev.preventDefault();
        ev.stopPropagation();
        termDropRef.current?.drop(hostId, ev.dataTransfer);
      });
      termHosts.current.set(id, h);
    }
    return h;
  };
  useEffect(() => {
    const alive = new Set(terminalSessions.map((x) => x.id));
    termHosts.current.forEach((_, id) => !alive.has(id) && termHosts.current.delete(id));
  }, [terminalSessions]);
  const slotTerms = new Map<string, React.ReactNode>();

  // Transformação visual de cada quadrante durante o arraste: o arrastado segue o mouse, o que está sob ele ocupa o lugar do arrastado
  const slotDragStyle = (i: number): React.CSSProperties => {
    if (!slotDrag) return {};
    const { from, dx, dy, over, settling } = slotDrag;
    const src = slotRects.current.get(from);
    if (i === from) {
      const dst = settling && over !== null ? slotRects.current.get(over) : undefined;
      const scale = dst && src ? `scale(${dst.width / src.width}, ${dst.height / src.height})` : 'scale(1.02)';
      return {
        transform: `translate(${dx}px, ${dy}px) ${scale}`,
        transformOrigin: 'top left',
        transition: settling ? 'transform 200ms var(--ease-out)' : 'none',
        zIndex: 50,
        opacity: 0.95,
        pointerEvents: 'none',
      };
    }
    const mine = slotRects.current.get(i);
    const swapping = over === i && src && mine;
    return {
      transform: swapping ? `translate(${src.left - mine.left}px, ${src.top - mine.top}px) scale(${src.width / mine.width}, ${src.height / mine.height})` : 'none',
      transformOrigin: 'top left',
      transition: 'transform 220ms var(--ease-out)',
      pointerEvents: 'none',
    };
  };

  // Render an individual terminal slot (used by 1x1, 1x2, 2x1, 3, 2x2 grid)
  const renderTerminalSlot = (slotIndex: number, sessionId?: string) => {
    const session = terminalSessions.find((s) => s.id === sessionId) || terminalSessions[0];
    if (!session) {
      return (
        <div
          style={{
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: themeTokens.bgCard,
            color: themeTokens.textMuted,
            gap: 8,
          }}
        >
          <SquareTerminal size={24} />
          <span style={{ fontSize: 12 }}>Nenhum terminal selecionado</span>
          <button
            type="button"
            onClick={() => onNewSession('zsh', `Terminal ${slotIndex + 1}`)}
            style={{
              background: accentColor,
              color: getContrastTextColor(accentColor),
              border: 'none',
              borderRadius: 5,
              padding: '5px 12px',
              fontSize: 11,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Abrir Terminal
          </button>
        </div>
      );
    }

    const isSlotActive = (activeWorkspace?.focusedSlotIndex ?? 0) === slotIndex;
    // cor da IA rodando neste quadrante (sem IA, o cabeçalho segue cinza)
    const slotAiType = activeWorkspace ? getSlotAiType(activeWorkspace, slotIndex, session) : undefined;
    const slotAiColor = slotAiType && slotAiType !== 'zsh' ? AI_BRAND_COLORS[slotAiType === 'agy' ? 'antigravity' : slotAiType.toLowerCase()] : undefined;
    const hdrAiColor = skinActive ? undefined : slotAiColor;
    const slotMentionedIssues = sessionMentionedIssues[session.id] || [];
    const issuesInHeader = activeWorkspace?.gridMode !== '1x1';
    const issueTags = slotMentionedIssues.map((mIssue) => {
      const isIssueOpen = (mIssue.state || 'open').toLowerCase() === 'open' && !mIssue.closed_at;
      return (
        <div
          key={mIssue.number}
          className="df-pressable"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            background: (issuesInHeader && slotAiColor) ? 'rgba(0,0,0,0.25)' : (isEffectiveDark
              ? (isIssueOpen ? 'rgba(34, 197, 94, 0.12)' : 'rgba(168, 85, 247, 0.12)')
              : (isIssueOpen ? 'rgba(34, 197, 94, 0.1)' : 'rgba(168, 85, 247, 0.1)')),
            borderRadius: 4,
            padding: '2px 6px',
            fontSize: 10.5,
            color: (issuesInHeader && slotAiColor) ? '#ffffff' : isIssueOpen ? '#22c55e' : '#a855f7',
            userSelect: 'none',
            border: 'none',
            boxShadow: 'none',
            cursor: 'pointer',
            transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
            maxWidth: 240,
          }}
          onClick={() => { if (!scrollTerminalToText(session.id, new RegExp(`#${mIssue.number}(?!\\d)`))) onToast?.(`#${mIssue.number} não aparece no histórico deste terminal`); }}
          title={`#${mIssue.number}: ${mIssue.title} (Clique para ir até onde foi mencionada)`}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = (issuesInHeader && slotAiColor) ? 'rgba(0,0,0,0.4)' : (isEffectiveDark
              ? (isIssueOpen ? 'rgba(34, 197, 94, 0.2)' : 'rgba(168, 85, 247, 0.2)')
              : (isIssueOpen ? 'rgba(34, 197, 94, 0.16)' : 'rgba(168, 85, 247, 0.16)'));
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = (issuesInHeader && slotAiColor) ? 'rgba(0,0,0,0.25)' : (isEffectiveDark
              ? (isIssueOpen ? 'rgba(34, 197, 94, 0.12)' : 'rgba(168, 85, 247, 0.12)')
              : (isIssueOpen ? 'rgba(34, 197, 94, 0.1)' : 'rgba(168, 85, 247, 0.1)'));
          }}
        >
          <span style={{ fontWeight: 500, flexShrink: 0 }}>#{mIssue.number}</span>

          {/* Remove tag */}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleRemoveMentionedIssue(session.id, mIssue.number);
            }}
            title="Remover tag de menção"
            style={{
              background: 'transparent',
              border: 'none',
              color: themeTokens.textMuted,
              cursor: 'pointer',
              padding: 1,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 2,
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
            onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textMuted)}
          >
            <X size={10} />
          </button>
        </div>
      );
    });

    slotTerms.set(
      session.id,
      <NativeXTerm
        transparent={!!slotAiColor}
        sessionId={session.id}
        sessionType={session.type}
        cwd={session.projectPath || workspacePath || ''}
        isActive={isSlotActive}
        alwaysVisible={true}
        initialCommand={session.initialCommand}
        accentColor={accentColor}
        cursorColor={slotAiColor || accentColor}
        isDark={isEffectiveDark}
        fontSize={terminalFontSize}
        cursorStyle={terminalCursorStyle}
        cursorBlink={terminalCursorBlink}
        scrollback={terminalScrollback}
        copyOnSelect={terminalCopyOnSelect}
        fontFamily={terminalFontFamily}
        lineHeight={terminalLineHeight}
        themePreset={terminalThemePreset}
        skin={terminalSkin}
        skinLayers={false}
        cursorWidth={terminalCursorWidth}
        scrollOnUserInput={terminalScrollOnUserInput}
        drawBoldTextInBrightColors={terminalDrawBoldTextInBrightColors}
        onFocus={() => handleFocusSlot(slotIndex, session.id)}
        onTitleChange={(title) => handleSessionTitleChange(session.id, title)}
      />,
    );

    return (
      <div
        key={`slot-${activeWorkspace?.id || 'ws'}-${slotIndex}-${session.id}`}
        onClick={() => handleFocusSlot(slotIndex, session.id)}
        onMouseDown={() => handleFocusSlot(slotIndex, session.id)}
        data-slot-index={slotIndex}
        style={{
          width: '100%',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: skinActive ? 'transparent' : themeTokens.bgCard,
          borderRadius: 6,
          border: 'none',
          boxShadow: 'none',
          position: 'relative',
          outline: dropSlotId === session.id ? `1px dashed ${accentColor}` : 'none',
          outlineOffset: -2,
          transition: 'outline-color 150ms ease',
          ...slotDragStyle(slotIndex),
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
          if (dropSlotId !== session.id) setDropSlotId(session.id);
        }}
        onDragLeave={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropSlotId(null);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleFocusSlot(slotIndex, session.id);
          dropOnSession(session.id, e.dataTransfer);
          // O drag tira o foco do xterm: devolve para poder digitar direto
          const sid = session.id;
          [0, 120].forEach((ms) => setTimeout(() => window.dispatchEvent(new CustomEvent('devflow:focus-terminal', { detail: { sessionId: sid } })), ms));
        }}
      >
        {/* Quadrant Mini Header (height: 27px) */}
        {(
          <div
            onPointerDown={activeWorkspace?.gridMode !== '1x1' ? (e) => startSlotDrag(e, slotIndex) : undefined}
            onClick={() => handleFocusSlot(slotIndex, session.id)}
            onMouseDown={() => handleFocusSlot(slotIndex, session.id)}
            style={{
              height: 27,
              padding: '0 8px',
              background: hdrAiColor
                ? `linear-gradient(90deg, rgba(0,0,0,0.5), rgba(0,0,0,0)), ${hdrAiColor}`
                : skinActive
                  ? 'transparent'
                  : isSlotActive
                    ? (isEffectiveDark ? '#202020' : '#eaeaea')
                    : (isEffectiveDark ? '#141416' : '#f5f5f5'),
              borderBottom: `1px solid ${skinTk.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 6,
              flexShrink: 0,
              userSelect: 'none',
              cursor: 'pointer',
              position: 'relative',
              zIndex: 20,
              overflow: 'visible',
            }}
          >
            {/* Left: Quadrant Badge, Icon, Session Name & Switcher Dropdown */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span
                className="skin-tab"
                data-on={isSlotActive ? '1' : undefined}
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 4,
                  background: hdrAiColor ? 'rgba(0,0,0,0.28)' : isSlotActive ? accentColor : (isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                  color: hdrAiColor || isSlotActive ? '#ffffff' : skinTk.textMuted,
                  letterSpacing: '0.5px',
                  flexShrink: 0,
                  transition: 'background-color 140ms ease, color 140ms ease',
                }}
              >
                Q{slotIndex + 1}
              </span>
              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                {getSessionIcon(session)}
              </div>
              <span
                style={{
                  fontSize: 11.5,
                  fontWeight: isSlotActive ? 600 : 500,
                  color: hdrAiColor ? '#ffffff' : isSlotActive ? skinTk.textPrimary : skinTk.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 120,
                }}
              >
                {cleanSessionName(session)}
              </span>

              {/* Slot session switcher button */}
              <div
                ref={(el) => {
                  if (el) slotMenuRefs.current.set(slotIndex, el);
                  else slotMenuRefs.current.delete(slotIndex);
                }}
                style={{ position: 'relative' }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveSlotMenuIndex(activeSlotMenuIndex === slotIndex ? null : slotIndex);
                  }}
                  title="Trocar terminal deste quadrante"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: skinTk.textMuted,
                    padding: '2px 4px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = hdrAiColor ? '#ffffff' : skinTk.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = hdrAiColor ? 'rgba(255,255,255,0.8)' : skinTk.textMuted)}
                >
                  <ChevronDown
                    size={11}
                    className="df-chevron"
                    style={{ transform: activeSlotMenuIndex === slotIndex ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>

                {/* Session Switcher Dropdown for this slot */}
                {activeSlotMenuIndex === slotIndex && (
                  <div
                    className="df-dropdown-menu"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      width: 180,
                      background: getFieldTokens(isEffectiveDark).dropdownMenuBg,
                      border: getFieldTokens(isEffectiveDark).dropdownBorder,
                      borderRadius: 6,
                      padding: '4px 0',
                      boxShadow: 'none',
                      zIndex: 9999,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    {(() => {
                      // Ativos = terminais abertos nas abas do CLI (todas as áreas) + o ativo agora
                      const inUse = new Set<string>(workspaces.flatMap((w) => w.slotSessionIds));
                      if (activeSessionId) inUse.add(activeSessionId);
                      const idle = terminalSessions.filter((t) => !inUse.has(t.id));
                      if (idle.length === 0) return null;
                      return (
                        <>
                          <div
                            className="df-row-interactive"
                            onClick={() => {
                              idle.forEach((t) => {
                                window.electronAPI?.pty?.kill?.(t.id);
                                onCloseSession(t.id);
                              });
                              logSystemActivity('terminal', 'fechar_terminais_inativos', `${idle.length} terminais`, { names: idle.map((t) => cleanSessionName(t)) });
                              onToast?.(`${idle.length} ${idle.length === 1 ? 'terminal fechado' : 'terminais fechados'}`);
                              setActiveSlotMenuIndex(null);
                            }}
                            style={{ padding: '5px 8px', display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, cursor: 'pointer', color: '#ef4444' }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239,68,68,0.12)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <X size={12} />
                            <span>Fechar terminais inativos ({idle.length})</span>
                          </div>
                          <div style={{ height: 1, background: skinTk.border, margin: '4px 0' }} />
                        </>
                      );
                    })()}
                    <div style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, color: skinTk.textMuted, textTransform: 'uppercase' }}>
                      Selecionar Terminal
                    </div>
                    {terminalSessions.map((s) => (
                      <div
                        key={s.id}
                        className="df-row-interactive"
                        onClick={() => {
                          updateActiveWorkspace((w) => {
                            const nextSlots = [...effectiveSlots];
                            nextSlots[slotIndex] = s.id;
                            return { ...w, slotSessionIds: nextSlots };
                          });
                          setActiveSessionId(s.id);
                          setActiveSlotMenuIndex(null);
                        }}
                        style={{
                          padding: '5px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11,
                          cursor: 'pointer',
                          color: s.id === session.id ? accentColor : skinTk.textPrimary,
                          background: s.id === session.id ? hexToRgba(accentColor, 0.1) : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (s.id !== session.id) e.currentTarget.style.background = skinTk.hoverBg;
                        }}
                        onMouseLeave={(e) => {
                          if (s.id !== session.id) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {getSessionIcon(s, 13)}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1, minWidth: 0 }}>
                          {cleanSessionName(s)}
                        </span>
                        {terminalSessions.length > 1 && (
                          <span
                            title="Fechar este terminal"
                            onClick={(e) => {
                              e.stopPropagation();
                              window.electronAPI?.pty?.kill?.(s.id);
                              onCloseSession(s.id);
                            }}
                            style={{ display: 'flex', alignItems: 'center', padding: 2, borderRadius: 4, color: skinTk.textMuted, flexShrink: 0 }}
                            onMouseEnter={(e) => { e.currentTarget.style.color = '#ef4444'; e.currentTarget.style.background = 'rgba(239,68,68,0.12)'; }}
                            onMouseLeave={(e) => { e.currentTarget.style.color = skinTk.textMuted; e.currentTarget.style.background = 'transparent'; }}
                          >
                            <X size={11} />
                          </span>
                        )}
                      </div>
                    ))}

                    <div style={{ height: 1, background: skinTk.border, margin: '4px 0' }} />

                    <div style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, color: skinTk.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      Iniciar IA neste Quadrante
                    </div>
                    {[
                      { type: 'claude', name: 'Claude CLI', cmd: 'claude', icon: <ClaudeIcon size={13} /> },
                      { type: 'antigravity', name: 'Antigravity CLI (agy)', cmd: 'agy', icon: <AntigravityIcon size={13} /> },
                      { type: 'gemini', name: 'Gemini CLI', cmd: 'gemini', icon: <GeminiIcon size={13} /> },
                      { type: 'codex', name: 'Codex CLI', cmd: 'codex', icon: <CodexIcon size={13} /> },
                      { type: 'zsh', name: 'Zsh Terminal', cmd: undefined, icon: <SquareTerminal size={13} color={accentColor} /> },
                    ].map((opt) => (
                      <div
                        key={opt.type}
                        className="df-row-interactive"
                        onClick={() => {
                          const newId = onNewSession(opt.type, opt.name, opt.cmd);
                          const resolvedId = typeof newId === 'string' ? newId : `term_${Date.now()}`;
                          updateActiveWorkspace((w) => {
                            const nextSlots = [...effectiveSlots];
                            nextSlots[slotIndex] = resolvedId;
                            return { ...w, slotSessionIds: nextSlots };
                          });
                          setActiveSessionId(resolvedId);
                          setActiveSlotMenuIndex(null);
                        }}
                        style={{
                          padding: '5px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          fontSize: 11,
                          cursor: 'pointer',
                          color: skinTk.textPrimary,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        {opt.icon}
                        <span>{opt.name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Right: Issues citadas, divisória e ações (Clear, Maximize/Restore, Close Split) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, minWidth: 0 }}>
              {slotMentionedIssues.length > 0 && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflow: 'hidden' }}>{issueTags}</div>
                  <div style={{ width: 1, height: 14, background: hdrAiColor ? 'rgba(255,255,255,0.4)' : isEffectiveDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.16)', margin: '0 6px', flexShrink: 0 }} />
                </>
              )}
              {/* Clear this slot */}
              <button
                type="button"
                className="df-hdr-act"
                onClick={(e) => {
                  e.stopPropagation();
                  writeToSession(session.id, 'clear\r');
                }}
                title="Limpar este terminal"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: hdrAiColor ? 'rgba(0,0,0,0.75)' : skinTk.textMuted,
                  padding: '2px 4px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = hdrAiColor ? '#000000' : skinTk.textPrimary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = hdrAiColor ? 'rgba(0,0,0,0.75)' : skinTk.textMuted)}
              >
                <Trash2 size={11} />
              </button>

              {/* Maximize / Restore this slot (só faz sentido com mais de um terminal) */}
              {activeWorkspace?.gridMode !== '1x1' && <button
                type="button"
                className="df-hdr-act"
                onClick={(e) => {
                  e.stopPropagation();
                  updateActiveWorkspace((w) => ({
                    ...w,
                    maximizedSlotIndex: w.maximizedSlotIndex === slotIndex ? null : slotIndex,
                  }));
                  setActiveSessionId(session.id);
                }}
                title={activeWorkspace?.maximizedSlotIndex === slotIndex ? 'Restaurar Grid' : 'Maximizar este terminal'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: hdrAiColor ? 'rgba(0,0,0,0.75)' : skinTk.textMuted,
                  padding: '2px 4px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = hdrAiColor ? '#000000' : skinTk.textPrimary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = hdrAiColor ? 'rgba(0,0,0,0.75)' : skinTk.textMuted)}
              >
                {activeWorkspace?.maximizedSlotIndex === slotIndex ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              </button>}

              {/* Close this split slot */}
              {activeWorkspace?.gridMode !== '1x1' && <button
                type="button"
                className="df-hdr-act"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseSplitSlot(slotIndex);
                }}
                title="Fechar divisão deste painel"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: hdrAiColor ? 'rgba(0,0,0,0.75)' : skinTk.textMuted,
                  padding: '2px 4px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = hdrAiColor ? '#000000' : '#ef4444')}
                onMouseLeave={(e) => (e.currentTarget.style.color = hdrAiColor ? 'rgba(0,0,0,0.75)' : skinTk.textMuted)}
              >
                <X size={11} />
              </button>}
            </div>
          </div>
        )}

        {/* Mentioned Issue Tag in Terminal Slot */}
        {(() => {
          if (slotMentionedIssues.length === 0 || issuesInHeader) return null;

          return (
            <div
              style={{
                padding: '4px 8px',
                background: isEffectiveDark ? '#141416' : '#f5f5f5',
                borderBottom: `1px solid ${hexToRgba(themeTokens.border, 0.4)}`,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                flexWrap: 'wrap',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10,
                  color: themeTokens.textMuted,
                  fontWeight: 400,
                  flexShrink: 0,
                }}
              >
                <AtSign size={10} color={accentColor} />
                <span>Issue:</span>
              </div>
              {issueTags}
            </div>
          );
        })()}

        {/* Terminal Canvas */}
        <div
          onMouseDown={() => handleFocusSlot(slotIndex, session.id)}
          style={{
            flex: '1 1 0',
            width: '100%',
            height: '100%',
            minHeight: 0,
            overflow: 'hidden',
            position: 'relative',
            // terminal de IA: degradê com a cor da IA (como no chat da IA da IDE) + a logo ao fundo
            background: slotAiColor && !skinActive
              ? `radial-gradient(ellipse 120% 160% at 6% 100%, ${hexToRgba(slotAiColor, isEffectiveDark ? 0.1 : 0.12)} 0%, ${isEffectiveDark ? '#101010' : '#ffffff'} 100%)`
              : undefined,
            transition: 'background 0.2s ease',
          }}
        >
          {slotAiColor && slotAiType && (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', userSelect: 'none', zIndex: 0, opacity: isEffectiveDark ? 0.04 : 0.03 }}>
              {renderAiIcon(slotAiType === 'agy' ? 'antigravity' : slotAiType, 150)}
            </div>
          )}
          <div
            ref={(el) => {
              const h = getTermHost(session.id);
              if (el && h.parentElement !== el) el.appendChild(h);
            }}
            style={{ position: 'relative', zIndex: 1, width: '100%', height: '100%' }}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      ref={viewRootRef}
      className={['df-cli-surface', skinActive && 'cli-skin'].filter(Boolean).join(' ')}
      data-skin={skinActive ? skinId : undefined}
      style={{
        ...skinDividerVars(skinId),
        isolation: 'isolate',
        alignSelf: 'stretch',
        width: '100%',
        height: '100%',
        minHeight: 0,
        flex: '1 1 0',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        background: skinActive ? 'transparent' : themeTokens.bgApp,
        gap: 0,
        padding: 0,
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {tip && (
        <div
          style={{
            position: 'fixed',
            left: tip.x,
            top: tip.y,
            transform: tip.above ? 'translate(-50%, -100%)' : 'translateX(-50%)',
            background: isEffectiveDark ? '#0b0b0c' : '#1f1f1f',
            color: '#f5f5f5',
            fontSize: 11,
            fontWeight: 400,
            padding: '5px 9px',
            borderRadius: 6,
            border: 'none',
            boxShadow: 'none',
            animation: 'fadeIn 120ms ease',
            maxWidth: 240,
            textAlign: 'center',
            pointerEvents: 'none',
            zIndex: 10000,
            lineHeight: 1.35,
          }}
        >
          {tip.text}
        </div>
      )}
      {/* =================================================================== */}
      {/* 0. ACTIVITY BAR (VERTICAL LEFT STRIP COM ÍCONES IGUAL À IDE)        */}
      {/* =================================================================== */}
      <div
        data-tour="cli-activity-bar"
        style={{
          alignSelf: 'stretch',
          width: 48,
          padding: '10px 0',
          background: skinActive ? 'transparent' : skinTk.bgCard,
          borderRadius: 10,
          border: 'none',
          boxShadow: 'none',
          flexDirection: 'column',
          justifyContent: 'flex-start',
          alignItems: 'center',
          gap: 6,
          display: 'inline-flex',
          flexShrink: 0,
          transition: 'background 0.2s ease',
          userSelect: 'none',
          position: 'relative',
        }}
      >
        {/* 1. Arquivos / Explorer */}
        <div
          className="df-pressable"
          style={{
            width: 38,
            height: 38,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            cursor: 'pointer',
            background:
              !isExplorerCollapsed && sidebarTab === 'files'
                ? isEffectiveDark
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'rgba(0, 0, 0, 0.08)'
                : 'transparent',
            color:
              !isExplorerCollapsed && sidebarTab === 'files'
                ? isEffectiveDark
                  ? '#ffffff'
                  : skinTk.textPrimary
                : isEffectiveDark
                ? '#858585'
                : skinTk.textSecondary,
            transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
          }}
          title="Explorador de Arquivos"
          onClick={() => {
            if (!isExplorerCollapsed && sidebarTab === 'files') {
              setIsExplorerCollapsed(true);
            } else {
              setSidebarTab('files');
              setIsExplorerCollapsed(false);
            }
          }}
          onMouseEnter={(e) => {
            if (!(!isExplorerCollapsed && sidebarTab === 'files')) {
              e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.color = isEffectiveDark ? '#cccccc' : skinTk.textPrimary;
            }
          }}
          onMouseLeave={(e) => {
            if (!(!isExplorerCollapsed && sidebarTab === 'files')) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = isEffectiveDark ? '#858585' : skinTk.textSecondary;
            }
          }}
        >
          {!isExplorerCollapsed && sidebarTab === 'files' && (
            <span className="df-activity-indicator" style={{ background: accentColor }} />
          )}
          <CodiconFiles size={22} />
        </div>

        {/* 2. Controle de Versão / Git */}
        <div
          className="df-pressable"
          style={{
            width: 38,
            height: 38,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            cursor: 'pointer',
            background:
              !isExplorerCollapsed && sidebarTab === 'git'
                ? isEffectiveDark
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'rgba(0, 0, 0, 0.08)'
                : 'transparent',
            color:
              !isExplorerCollapsed && sidebarTab === 'git'
                ? isEffectiveDark
                  ? '#ffffff'
                  : skinTk.textPrimary
                : isEffectiveDark
                ? '#858585'
                : skinTk.textSecondary,
            transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
          }}
          title="Controle de Versão (Git)"
          onClick={() => {
            if (!isExplorerCollapsed && sidebarTab === 'git') {
              setIsExplorerCollapsed(true);
            } else {
              setSidebarTab('git');
              setIsExplorerCollapsed(false);
            }
          }}
          onMouseEnter={(e) => {
            if (!(!isExplorerCollapsed && sidebarTab === 'git')) {
              e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.color = isEffectiveDark ? '#cccccc' : skinTk.textPrimary;
            }
          }}
          onMouseLeave={(e) => {
            if (!(!isExplorerCollapsed && sidebarTab === 'git')) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = isEffectiveDark ? '#858585' : skinTk.textSecondary;
            }
          }}
        >
          {!isExplorerCollapsed && sidebarTab === 'git' && (
            <span className="df-activity-indicator" style={{ background: accentColor }} />
          )}
          <CodiconSourceControl size={22} />
          {(gitModifiedCount ?? 0) > 0 && (
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
                color: getContrastTextColor(accentColor),
                fontSize: 9.5,
                fontWeight: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                pointerEvents: 'none',
              }}
            >
              {(gitModifiedCount ?? 0) > 99 ? '99+' : gitModifiedCount}
            </span>
          )}
        </div>

        {/* 3. Issues do GitHub */}
        <div
          className="df-pressable"
          style={{
            width: 38,
            height: 38,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            cursor: 'pointer',
            background:
              !isExplorerCollapsed && sidebarTab === 'issues'
                ? isEffectiveDark
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'rgba(0, 0, 0, 0.08)'
                : 'transparent',
            color:
              !isExplorerCollapsed && sidebarTab === 'issues'
                ? isEffectiveDark
                  ? '#ffffff'
                  : skinTk.textPrimary
                : isEffectiveDark
                ? '#858585'
                : skinTk.textSecondary,
            transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
          }}
          title="Issues do GitHub"
          onClick={() => {
            if (!isExplorerCollapsed && sidebarTab === 'issues') {
              setIsExplorerCollapsed(true);
            } else {
              setSidebarTab('issues');
              setIsExplorerCollapsed(false);
            }
          }}
          onMouseEnter={(e) => {
            if (!(!isExplorerCollapsed && sidebarTab === 'issues')) {
              e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.color = isEffectiveDark ? '#cccccc' : skinTk.textPrimary;
            }
          }}
          onMouseLeave={(e) => {
            if (!(!isExplorerCollapsed && sidebarTab === 'issues')) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = isEffectiveDark ? '#858585' : skinTk.textSecondary;
            }
          }}
        >
          {!isExplorerCollapsed && sidebarTab === 'issues' && (
            <span className="df-activity-indicator" style={{ background: accentColor }} />
          )}
          <CircleDot size={20} />
          {openIssuesCount > 0 && (
            <span
              style={{
                position: 'absolute',
                bottom: 4,
                right: 4,
                minWidth: 15,
                height: 15,
                padding: '0 3.5px',
                borderRadius: 8,
                background: '#22c55e',
                color: getContrastTextColor('#22c55e'),
                fontSize: 9.5,
                fontWeight: 400,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                pointerEvents: 'none',
              }}
            >
              {openIssuesCount > 99 ? '99+' : openIssuesCount}
            </span>
          )}
        </div>

        {/* Pull requests e reviews pendentes do repositório */}
        <div
          className="df-pressable"
          style={{
            width: 38,
            height: 38,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            cursor: 'pointer',
            background: !isExplorerCollapsed && sidebarTab === 'reviews' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)') : 'transparent',
            color: !isExplorerCollapsed && sidebarTab === 'reviews' ? (isEffectiveDark ? '#ffffff' : skinTk.textPrimary) : isEffectiveDark ? '#858585' : skinTk.textSecondary,
            transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
          }}
          title="Pull requests e reviews"
          onClick={() => {
            if (!isExplorerCollapsed && sidebarTab === 'reviews') {
              setIsExplorerCollapsed(true);
            } else {
              setSidebarTab('reviews');
              setIsExplorerCollapsed(false);
            }
          }}
          onMouseEnter={(e) => {
            if (!(!isExplorerCollapsed && sidebarTab === 'reviews')) {
              e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.color = isEffectiveDark ? '#cccccc' : skinTk.textPrimary;
            }
          }}
          onMouseLeave={(e) => {
            if (!(!isExplorerCollapsed && sidebarTab === 'reviews')) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = isEffectiveDark ? '#858585' : skinTk.textSecondary;
            }
          }}
        >
          {!isExplorerCollapsed && sidebarTab === 'reviews' && <span className="df-activity-indicator" style={{ background: accentColor }} />}
          <GitPullRequestArrow size={20} />
          {openPullCount > 0 && (
            <span style={{ position: 'absolute', bottom: 4, right: 4, minWidth: 15, height: 15, padding: '0 3.5px', borderRadius: 8, background: accentColor, color: getContrastTextColor(accentColor), fontSize: 9.5, fontWeight: 400, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, pointerEvents: 'none' }}>
              {openPullCount > 99 ? '99+' : openPullCount}
            </span>
          )}
        </div>

        {/* GitHub Actions: workflows e execuções do repositório */}
        <div
          className="df-pressable"
          style={{
            width: 38,
            height: 38,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            cursor: 'pointer',
            background: showActions ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)') : 'transparent',
            color: showActions ? (isEffectiveDark ? '#ffffff' : skinTk.textPrimary) : isEffectiveDark ? '#858585' : skinTk.textSecondary,
            transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
          }}
          title="Actions"
          onClick={() => {
            if (showActions) {
              setIsExplorerCollapsed(true);
            } else {
              setSidebarTab('actions');
              setIsExplorerCollapsed(false);
            }
          }}
          onMouseEnter={(e) => {
            if (!showActions) {
              e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.color = isEffectiveDark ? '#cccccc' : skinTk.textPrimary;
            }
          }}
          onMouseLeave={(e) => {
            if (!showActions) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = isEffectiveDark ? '#858585' : skinTk.textSecondary;
            }
          }}
        >
          {showActions && <span className="df-activity-indicator" style={{ background: accentColor }} />}
          <PlayCircle size={20} />
        </div>

        {/* 4. Telas do Design */}
        <div
          className="df-pressable"
          style={{
            width: 38,
            height: 38,
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            cursor: 'pointer',
            background:
              !isExplorerCollapsed && sidebarTab === 'design'
                ? isEffectiveDark
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'rgba(0, 0, 0, 0.08)'
                : 'transparent',
            color:
              !isExplorerCollapsed && sidebarTab === 'design'
                ? isEffectiveDark
                  ? '#ffffff'
                  : skinTk.textPrimary
                : isEffectiveDark
                ? '#858585'
                : skinTk.textSecondary,
            transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
          }}
          title="Telas do Design"
          onClick={() => {
            if (!isExplorerCollapsed && sidebarTab === 'design') {
              setIsExplorerCollapsed(true);
            } else {
              setSidebarTab('design');
              setIsExplorerCollapsed(false);
              loadDesignBridgeManifest(workspacePath).then((m) => {
                if (m) setDesignManifest(m);
              });
            }
          }}
          onMouseEnter={(e) => {
            if (!(!isExplorerCollapsed && sidebarTab === 'design')) {
              e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)';
              e.currentTarget.style.color = isEffectiveDark ? '#cccccc' : skinTk.textPrimary;
            }
          }}
          onMouseLeave={(e) => {
            if (!(!isExplorerCollapsed && sidebarTab === 'design')) {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = isEffectiveDark ? '#858585' : skinTk.textSecondary;
            }
          }}
        >
          {!isExplorerCollapsed && sidebarTab === 'design' && (
            <span className="df-activity-indicator" style={{ background: accentColor }} />
          )}
          <Layers size={19} />
          {(designManifest?.screens?.length ?? 0) > 0 && (
            <span
              style={{
                position: 'absolute',
                top: 5,
                right: 5,
                minWidth: 13,
                height: 13,
                padding: '0 3px',
                borderRadius: 999,
                background: accentColor,
                color: getContrastTextColor(accentColor),
                fontSize: 8.5,
                fontWeight: 400,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: 1,
                pointerEvents: 'none',
              }}
            >
              {designManifest!.screens.length}
            </span>
          )}
        </div>
      </div>

      {/* 5px Spacing */}
      <div style={{ width: 5, flexShrink: 0 }} />

      {/* =================================================================== */}
      {/* 1. LEFT PANE: PAINEL LATERAL (ARQUIVOS / GIT / ISSUES / DESIGN)     */}
      {/* =================================================================== */}
      {!isExplorerCollapsed && (
        <div
          data-tour="cli-sidebar-pane"
          style={{
            width: explorerWidth,
            height: '100%',
            minHeight: 0,
            // nas abas de arquivos e git o painel usa cards separados com gap, igual à IDE
            background: skinActive || sidebarTab === 'files' || sidebarTab === 'git' ? 'transparent' : skinTk.bgCard,
            borderRadius: skinActive ? 'var(--sk-r, 0px)' : 10,
            border: 'none',
            boxShadow: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: sidebarTab === 'files' ? 5 : 0,
            overflow: 'hidden',
            flexShrink: 0,
            transition: isDraggingExplorer ? 'none' : 'width 0.1s ease',
            position: 'relative',
          }}
        >
          {/* ========================================================= */}
          {/* TAB 1: FILES EXPLORER                                    */}
          {/* ========================================================= */}
          {sidebarTab === 'files' && (
            <>
              <div className="df-view-enter" style={{ flex: '1 1 0', minHeight: 0, display: 'flex', flexDirection: 'column', background: skinActive ? 'transparent' : skinTk.bgCard, borderRadius: skinActive ? 'var(--sk-r, 0px)' : 10, overflow: 'hidden' }}>
              {/* Header do Explorador */}
          <div
            style={{
              padding: '11px 14px 0 11px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexShrink: 0,
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 500, color: skinTk.textPrimary, whiteSpace: 'nowrap' }}>
                Explorer
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: skinTk.textMuted,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                ({workspacePath.split('/').pop() || 'Workspace'})
              </span>
            </div>

            {/* Ações do explorador reunidas em um popup */}
            <div ref={explorerOptionsRef} style={{ position: 'relative', display: 'flex' }}>
              <button
                type="button"
                onClick={() => setExplorerOptionsOpen((v) => !v)}
                title="Opções do explorador"
                style={{
                  background: explorerOptionsOpen || isSearchOpen ? `${accentColor}22` : 'transparent',
                  border: 'none',
                  color: explorerOptionsOpen || isSearchOpen ? accentColor : skinTk.textSecondary,
                  padding: 2,
                  borderRadius: 3,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
              >
                <MoreHorizontal size={16} />
              </button>
              {explorerOptionsOpen && (
                <div
                  className="df-dropdown-menu df-popover-right"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    right: 0,
                    minWidth: 180,
                    background: getFieldTokens(isEffectiveDark).dropdownMenuBg,
                    border: getFieldTokens(isEffectiveDark).dropdownBorder,
                    borderRadius: 8,
                    boxShadow: 'none',
                    padding: 4,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    zIndex: 9999,
                  }}
                >
                  {[
                    { icon: <Search size={13} />, label: isSearchOpen ? 'Ocultar filtro' : 'Filtrar arquivos', run: () => setIsSearchOpen((prev) => !prev) },
                    { icon: <FilePlus size={13} />, label: 'Novo Arquivo', run: () => startCreating(false) },
                    { icon: <FolderPlus size={13} />, label: 'Nova Pasta', run: () => startCreating(true) },
                    { icon: <RefreshCw size={13} />, label: 'Atualizar', run: () => onRefreshTree?.() },
                  ].map((o) => (
                    <button
                      key={o.label}
                      type="button"
                      className="df-row-interactive"
                      onClick={() => {
                        setExplorerOptionsOpen(false);
                        o.run();
                      }}
                      style={{ height: 28, padding: '0 10px', border: 'none', borderRadius: 6, background: 'transparent', color: skinTk.textPrimary, fontSize: 11.5, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left', cursor: 'pointer' }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <span style={{ display: 'flex', color: skinTk.textSecondary }}>{o.icon}</span>
                      <span>{o.label}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Search Filter Input (expandable) */}
          {isSearchOpen && (
            <div
              className="df-search-box df-subtle-enter"
              style={{
                margin: '10px 14px 0 11px',
                padding: '5px 8px',
                borderRadius: 6,
                border: getFieldTokens(isEffectiveDark).fieldBorder,
                boxShadow: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: getFieldTokens(isEffectiveDark).fieldBg,
              }}
            >
              <Search size={12} color={skinTk.textSecondary} />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filtrar arquivos..."
                autoFocus
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 11,
                  color: skinTk.textPrimary,
                  fontFamily: 'inherit',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: skinTk.textSecondary,
                    padding: 2,
                    cursor: 'pointer',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>
          )}

          {/* Recursive File Tree Container */}
          <div
            onDragOver={(e) => dragOverTree(e, workspacePath)}
            onDragLeave={() => setDropTarget((cur) => (cur === workspacePath ? null : cur))}
            onDrop={(e) => handleTreeDrop(e, workspacePath)}
            style={{
              background: dropTarget === workspacePath ? hexToRgba(accentColor, 0.06) : 'transparent',
              transition: 'background 0.15s ease',
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '10px 15px 10px 11px',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {creating && creating.parent === workspacePath && renderCreateInput(0)}
            {filteredTree.length === 0 ? (
              <div
                style={{
                  padding: '24px 12px',
                  textAlign: 'center',
                  fontSize: 11.5,
                  color: skinTk.textMuted,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <FolderOpen size={24} strokeWidth={1.5} color={skinTk.textMuted} />
                <span>Nenhum arquivo encontrado</span>
              </div>
            ) : (
              filteredTree.map((node) => {
                const renderTreeItem = (item: ExplorerNode, depth = 0): React.ReactNode => {
                  const isExpanded = expandedFolders.has(item.path);
                  const isDir = item.isDirectory;
                  const isFileActive = viewer?.path === item.path;
                  // soltar sobre um arquivo posiciona dentro da pasta dele; a pasta inteira (linha + filhos) acende como alvo
                  const dropDir = isDir ? item.path : item.path.split('/').slice(0, -1).join('/') || workspacePath;

                  return (
                    <div key={item.path} style={{ width: '100%', display: 'flex', flexDirection: 'column', borderRadius: 4, background: isDir && dropTarget === item.path ? hexToRgba(accentColor, 0.12) : 'transparent', transition: 'background-color 140ms var(--ease-out)' }}>
                      <div
                        className="df-row-interactive"
                        draggable={true}
                        onDragStart={(e) => {
                          const dragData = {
                            type: 'devflow-item',
                            path: item.path,
                            name: item.name,
                            isDirectory: item.isDirectory,
                          };
                          e.dataTransfer.setData('application/json', JSON.stringify(dragData));
                          e.dataTransfer.setData('text/plain', item.path);
                          e.dataTransfer.effectAllowed = 'copyMove';
                        }}
                        onDragOver={(e) => dragOverTree(e, dropDir)}
                        onDragLeave={() => setDropTarget((cur) => (cur === dropDir ? null : cur))}
                        onDrop={(e) => handleTreeDrop(e, dropDir)}
                        onClick={() => {
                          setSelectedDir(isDir ? item.path : item.path.split('/').slice(0, -1).join('/') || null);
                          if (isDir) {
                            onToggleFolder(item.path);
                          } else {
                            openViewer(item.path, item.name);
                          }
                        }}
                        onContextMenu={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setFileContextMenu({
                            x: e.clientX,
                            y: e.clientY,
                            node: item,
                          });
                        }}
                        style={{
                          width: '100%',
                          paddingLeft: depth * 12 + 2,
                          paddingRight: 6,
                          height: 24,
                          borderRadius: 4,
                          background: isFileActive ? hexToRgba(accentColor, 0.12) : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          userSelect: 'none',
                          color: isFileActive ? skinTk.textPrimary : skinTk.textSecondary,
                        }}
                        onMouseEnter={(e) => {
                          if (!isFileActive) e.currentTarget.style.background = skinTk.hoverBg;
                        }}
                        onMouseLeave={(e) => {
                          if (!isFileActive) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {isDir ? (
                          <>
                            <div
                              style={{
                                width: 14,
                                height: 14,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: skinTk.textSecondary,
                                flexShrink: 0,
                              }}
                            >
                              <ChevronRight
                                size={13}
                                className="df-chevron"
                                color={isExpanded ? accentColor : undefined}
                                style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
                              />
                            </div>
                            <FolderIcon folderName={item.name} isOpen={isExpanded} size={15} />
                            {renaming?.path === item.path ? renderRenameInput() : (
                              <span style={{ fontSize: 12, fontWeight: isExpanded ? 500 : 400 }}>
                                {item.name}
                              </span>
                            )}
                          </>
                        ) : (
                          <>
                            <div
                              style={{
                                width: 15,
                                height: 15,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                marginLeft: 2,
                              }}
                            >
                              <FileIcon fileName={item.name} size={15} />
                            </div>
                            {renaming?.path === item.path ? renderRenameInput() : (
                              <span style={{ fontSize: 12, fontWeight: isFileActive ? 500 : 400 }}>
                                {item.name}
                              </span>
                            )}
                          </>
                        )}
                      </div>

                      {/* Sub-children */}
                      {isDir && ((item.children && item.children.length > 0) || (creating && creating.parent === item.path)) && (
                        <TreeCollapse
                          open={isExpanded}
                          depth={depth}
                          accentColor={accentColor}
                          onDragOver={(e) => dragOverTree(e, item.path)}
                          onDrop={(e) => handleTreeDrop(e, item.path)}
                        >
                          {creating && creating.parent === item.path && renderCreateInput(depth + 1)}
                          {(item.children || []).map((child) => renderTreeItem(child, depth + 1))}
                        </TreeCollapse>
                      )}
                    </div>
                  );
                };

                return renderTreeItem(node, 0);
              })
            )}
          </div>
          </div>

          <OutlineTimelineCards
            file={viewer && !viewer.dataUrl ? { path: viewer.path, name: viewer.name, content: viewer.content, language: undefined, isDirty: viewer.content !== undefined && viewer.content !== viewer.savedContent } : null}
            themeTokens={skinTk}
            isEffectiveDark={isEffectiveDark}
            accentColor={accentColor}
            skinned={skinActive}
            onJumpToLine={(line) => {
              const ed = cliEditorInstanceRef.current;
              if (!ed) return;
              ed.revealLineInCenter(line);
              ed.setPosition({ lineNumber: line, column: 1 });
              ed.focus();
            }}
            onToast={onToast}
          />
        </>
      )}

          {/* ========================================================= */}
          {/* TAB 2: GIT SOURCE CONTROL                                */}
          {/* ========================================================= */}
          {sidebarTab === 'git' && (
            <div
              className="skin-bar"
              style={{
                flex: '1 1 0',
                display: 'flex',
                flexDirection: 'column',
                background: 'transparent',
                overflow: 'hidden',
                minHeight: 0,
                width: '100%',
              }}
            >
              <SidebarPanels
                previewUrl={null}
                onOpenPreview={() => {}}
                activeTab="git"
                workspacePath={workspacePath}
                themeTokens={skinTk}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                accentTextColor="#ffffff"
                activeFile={viewer ? { path: viewer.path, name: viewer.name } : activeFileId ? { path: activeFileId, name: activeFileId.split('/').pop() || '' } : null}
                onOpenFile={(filePath, fileName) => openViewer(filePath, fileName || filePath.split('/').pop() || 'file')}
                onJumpToLine={() => {}}
                graphSkinned={skinActive}
                onStartReview={(files, index) => openGitDiffInCli(files, index || 0)}
                onRunTerminalCommand={(name, cmd) => {
                  if (activeSessionId && window.electronAPI?.pty?.write) {
                    window.electronAPI.pty.write(activeSessionId, cmd + '\n');
                  } else {
                    onNewSession('zsh', name, cmd);
                  }
                }}
                onToast={(msg) => onToast?.(msg)}
                onOpenBranchModal={onOpenBranchModal}
                currentBranch={currentBranch}
                onGenerateCommitMessage={onGenerateCommitMessage}
              />
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: GITHUB ISSUES                                      */}
          {/* ========================================================= */}
          {sidebarTab === 'issues' && (
            <div
              className="skin-bar df-view-enter"
              style={{
                flex: '1 1 0',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0,
                width: '100%',
              }}
            >
              {/* Issues Sub-Header */}
              <div
                style={{
                  padding: '8px 10px',
                  borderBottom: `1px solid ${skinTk.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={{ fontSize: 11.5, fontWeight: 500, color: skinTk.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {gitRepoName.split('/').pop() || 'aura-dev'}
                  </span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  <button
                    type="button"
                    onClick={handleRefreshIssuesList}
                    title="Atualizar Issues do GitHub"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: skinTk.textSecondary,
                      padding: 4,
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <RefreshCw size={12} className={isRefreshingIssues ? 'spin-animate' : ''} />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      const repo = gitRepoName || 'Walancy/aura-dev';
                      const cleanRepo = repo.includes('/') ? repo : `Walancy/${repo}`;
                      window.electronAPI?.shell?.openExternal?.(`https://github.com/${cleanRepo}/issues`);
                    }}
                    title="Abrir Issues no GitHub (Navegador)"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: skinTk.textSecondary,
                      padding: 4,
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <ExternalLink size={12} />
                  </button>

                  <button
                    type="button"
                    onClick={onOpenIssuesModal}
                    title="Nova issue"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: accentColor,
                      padding: 4,
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                    }}
                  >
                    <Plus size={13} />
                  </button>
                </div>
              </div>

              {/* Search & Filter bar */}
              <div
                className="skin-strip"
                style={{
                  padding: '6px 10px',
                  borderBottom: `1px solid ${skinTk.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  background: isEffectiveDark ? '#161616' : '#f8f8f8',
                  flexShrink: 0,
                }}
              >
                <div ref={issuesFilterRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  className="skin-field df-search-box"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: getFieldTokens(isEffectiveDark).fieldBg,
                    padding: '4px 8px',
                    borderRadius: 5,
                    border: getFieldTokens(isEffectiveDark).fieldBorder,
                    boxShadow: 'none',
                  }}
                >
                  <Search size={11} color={skinTk.textSecondary} />
                  <input
                    type="text"
                    value={issuesSearchQuery}
                    onChange={(e) => setIssuesSearchQuery(e.target.value)}
                    placeholder="Filtrar por título, # ou label..."
                    style={{
                      flex: 1,
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      fontSize: 10.5,
                      color: skinTk.textPrimary,
                      fontFamily: 'inherit',
                    }}
                  />
                  {issuesSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setIssuesSearchQuery('')}
                      style={{ background: 'transparent', border: 'none', color: skinTk.textSecondary, cursor: 'pointer', padding: 1 }}
                    >
                      <X size={11} />
                    </button>
                  )}
                </div>

                  {/* Botão de filtros (abre popup) */}
                  <button
                    type="button"
                    onClick={() => setIsIssuesFilterOpen((v) => !v)}
                    title="Filtros"
                    className="skin-field df-dropdown-trigger"
                    style={{
                      position: 'relative',
                      width: 26,
                      height: 26,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 5,
                      border: isIssuesFilterOpen ? getFieldTokens(isEffectiveDark).fieldBorderFocus : getFieldTokens(isEffectiveDark).fieldBorder,
                      background: isIssuesFilterOpen ? `${accentColor}22` : getFieldTokens(isEffectiveDark).fieldBg,
                      boxShadow: 'none',
                      color: activeIssueFilters > 0 || isIssuesFilterOpen ? accentColor : skinTk.textSecondary,
                      cursor: 'pointer',
                    }}
                  >
                    <SlidersHorizontal size={12} />
                    {activeIssueFilters > 0 && (
                      <span style={{ position: 'absolute', top: -3, right: -3, width: 8, height: 8, borderRadius: '50%', background: accentColor }} />
                    )}
                  </button>

                  {isIssuesFilterOpen && (
                    <div
                      className="df-dropdown-menu df-popover-right"
                      style={{
                        position: 'absolute',
                        top: 32,
                        right: 0,
                        zIndex: 50,
                        width: 200,
                        padding: 6,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        borderRadius: 8,
                        border: getFieldTokens(isEffectiveDark).dropdownBorder,
                        background: getFieldTokens(isEffectiveDark).dropdownMenuBg,
                        boxShadow: 'none',
                      }}
                    >
                      <div style={{ padding: '2px 8px', fontSize: 9.5, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: skinTk.textMuted }}>Estado</div>
                        <button
                          type="button"
                          onClick={() => setIssuesFilter('open')}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '5px 8px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer',
                            fontWeight: issuesFilter === 'open' ? 600 : 500,
                            background: issuesFilter === 'open' ? (isEffectiveDark ? '#2a2a2a' : '#e5e5e5') : 'transparent',
                            color: issuesFilter === 'open' ? '#22c55e' : skinTk.textSecondary,
                          }}
                        >
                          <span>Abertas</span>
                          <span>{openIssuesCount}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIssuesFilter('closed')}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '5px 8px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer',
                            fontWeight: issuesFilter === 'closed' ? 600 : 500,
                            background: issuesFilter === 'closed' ? (isEffectiveDark ? '#2a2a2a' : '#e5e5e5') : 'transparent',
                            color: issuesFilter === 'closed' ? '#a855f7' : skinTk.textSecondary,
                          }}
                        >
                          <span>Fechadas</span>
                          <span>{closedIssuesCount}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setIssuesFilter('all')}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '5px 8px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer',
                            fontWeight: issuesFilter === 'all' ? 600 : 500,
                            background: issuesFilter === 'all' ? (isEffectiveDark ? '#2a2a2a' : '#e5e5e5') : 'transparent',
                            color: issuesFilter === 'all' ? skinTk.textPrimary : skinTk.textSecondary,
                          }}
                        >
                          <span>Todas</span>
                          <span>{scopedIssues.length}</span>
                        </button>

                      <div style={{ height: 1, margin: '4px 0', background: skinTk.border }} />
                      <button
                        type="button"
                        onClick={() => {
                          const next = !onlyMyIssues;
                          setOnlyMyIssues(next);
                          try { localStorage.setItem('cli_issues_only_mine', next ? '1' : '0'); } catch {}
                        }}
                        title={myGithubLogin ? `Mostrar somente issues atribuídas a @${myGithubLogin}` : 'Mostrar somente issues atribuídas a mim'}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 6,
                          padding: '5px 8px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer',
                          fontWeight: onlyMyIssues ? 600 : 500,
                          background: onlyMyIssues ? `${accentColor}22` : 'transparent',
                          color: onlyMyIssues ? accentColor : skinTk.textSecondary,
                        }}
                      >
                        <User size={12} />
                        <span style={{ flex: 1, textAlign: 'left' }}>Somente minhas</span>
                        {onlyMyIssues && <Check size={12} />}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Issues Scrollable List */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: '4px 6px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                {filteredIssues.length === 0 ? (
                  <div
                    style={{
                      padding: '30px 12px',
                      textAlign: 'center',
                      fontSize: 11,
                      color: skinTk.textMuted,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <CircleDot size={24} strokeWidth={1.5} color={skinTk.textMuted} />
                    <span>Nenhuma issue encontrada</span>
                    <button
                      type="button"
                      onClick={handleRefreshIssuesList}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: skinTk.textSecondary,
                        fontSize: 10.5,
                        padding: '4px 8px',
                        borderRadius: 4,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        marginTop: 4,
                      }}
                    >
                      <RefreshCw size={11} className={isRefreshingIssues ? 'spin-animate' : ''} />
                      <span>Atualizar issues</span>
                    </button>
                  </div>
                ) : (
                  filteredIssues.map((issue, idx) => {
                    const isOpen = (issue.state || 'open').toLowerCase() === 'open' && !issue.closed_at;
                    const authorLogin = typeof issue.author === 'string'
                      ? issue.author
                      : (issue.author?.login || (typeof issue.assignee === 'string' ? issue.assignee : issue.assignee?.login) || (issue.assignees?.[0] ? (typeof issue.assignees[0] === 'string' ? issue.assignees[0] : issue.assignees[0]?.login) : '')) || 'walancy';
                    const authorAvatar = issue.authorAvatar
                      || (typeof issue.assignee === 'object' && issue.assignee?.avatarUrl)
                      || (issue.assignees?.[0] && typeof issue.assignees[0] === 'object' && issue.assignees[0]?.avatarUrl)
                      || (authorLogin ? `https://github.com/${authorLogin.replace('@', '').trim()}.png?size=40` : undefined);

                    const creatorLogin = (typeof issue.author === 'string' ? issue.author : issue.author?.login || '').replace('@', '').trim();
                    // responsáveis (assignees) da issue; o autor não entra
                    const assigneeList: Array<{ login: string; avatar?: string }> = [
                      ...(Array.isArray(issue.assignees) ? issue.assignees : []),
                      ...(issue.assignee ? [issue.assignee] : []),
                    ]
                      .map((a: any) => (typeof a === 'string' ? { login: a, avatar: undefined } : { login: a?.login || '', avatar: a?.avatarUrl }))
                      .filter((a, i, arr) => a.login && arr.findIndex((b) => b.login === a.login) === i)
                      .map((a) => ({ login: a.login.replace('@', '').trim(), avatar: a.avatar || `https://github.com/${a.login.replace('@', '').trim()}.png?size=40` }));

                    return (
                      <div
                        key={issue.number}
                        className="skin-tab df-card-subtle df-stagger-item"
                        style={{
                          '--stagger-idx': idx,
                          textTransform: 'none',
                          letterSpacing: 'normal',
                          padding: 0,
                          overflow: 'hidden',
                          borderRadius: 6,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                          border: 'none',
                          boxShadow: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 0,
                          flexShrink: 0,
                          cursor: 'pointer',
                        } as React.CSSProperties}
                        onClick={() => (onOpenIssueDetails ? onOpenIssueDetails(issue.number) : onOpenIssuesModal?.())}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                        }}
                      >
                        {/* Top row: State icon, Issue #, Git Photo, and Quick Action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, padding: '5px 7px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                            {isOpen ? (
                              <CircleDot size={11} color={issueStatusColor(issue)} style={{ flexShrink: 0 }} />
                            ) : (
                              <CheckCircle2 size={11} color={issueStatusColor(issue)} style={{ flexShrink: 0 }} />
                            )}
                            {creatorLogin && (
                              <>
                                <IssueGitAvatar login={creatorLogin} avatarUrl={issue.authorAvatar} size={14} isEffectiveDark={isEffectiveDark} />
                                <span title={`Criada por @${creatorLogin}`} style={{ fontSize: 10.5, color: skinTk.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                                  {creatorLogin}
                                </span>
                              </>
                            )}
                            {assigneeList.length > 0 && (
                              <div title={assigneeList.map((a) => `@${a.login}`).join(', ')} style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6, minWidth: 0, flexShrink: 1 }}>
                                <span style={{ fontSize: 10.5, color: skinTk.textMuted, flexShrink: 0 }}>Ass:</span>
                                <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                  {assigneeList.slice(0, 3).map((a, i) => (
                                    <div key={a.login} style={{ marginLeft: i === 0 ? 0 : -5, display: 'flex' }}>
                                      <IssueGitAvatar login={a.login} avatarUrl={a.avatar} size={14} isEffectiveDark={isEffectiveDark} />
                                    </div>
                                  ))}
                                </div>
                                {assigneeList.length === 1 && (
                                  <span style={{ fontSize: 10.5, color: skinTk.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{assigneeList[0].login}</span>
                                )}
                              </div>
                            )}
                          </div>

                          {/* Action buttons */}
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {/* Demais ações num popup (…) */}
                            <div style={{ position: 'relative' }}>
                              <button
                                type="button"
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => setIssueMenuOpen((cur) => (cur === issue.number ? null : issue.number))}
                                title="Mais ações"
                                style={{ background: issueMenuOpen === issue.number ? (isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)') : 'transparent', border: 'none', color: skinTk.textSecondary, padding: 2.5, borderRadius: 3, cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              >
                                <MoreHorizontal size={13} />
                              </button>
                              {issueMenuOpen === issue.number && (
                                <>
                                  <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setIssueMenuOpen(null)} />
                                  <div className="df-dropdown-menu df-popover-right" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 4, minWidth: 190, background: getFieldTokens(isEffectiveDark).dropdownMenuBg, border: getFieldTokens(isEffectiveDark).dropdownBorder, borderRadius: 8, boxShadow: 'none', padding: 4, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 1 }}>
                                    {([
                                      [<AtSign size={12} key="a" />, 'Mencionar no terminal', () => handleMentionIssueInTerminal(issue)],
                                      [<GitBranch size={12} key="b" />, `Criar branch issue-${issue.number}`, () => handleCheckoutIssueBranch(issue)],
                                      [<ExternalLink size={12} key="c" />, 'Abrir no GitHub', () => handleOpenIssueInBrowser(issue)],
                                    ] as Array<[React.ReactNode, string, () => void]>).map(([icon, label, run]) => (
                                      <div
                                        key={label}
                                        className="df-row-interactive"
                                        onClick={() => { setIssueMenuOpen(null); run(); }}
                                        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 9px', borderRadius: 5, fontSize: 11.5, color: skinTk.textPrimary, cursor: 'pointer' }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                      >
                                        <span style={{ display: 'flex', color: skinTk.textSecondary }}>{icon}</span>
                                        <span>{label}</span>
                                      </div>
                                    ))}
                                    {/* Etiquetas e responsável da issue */}
                                    <div style={{ height: 1, flexShrink: 0, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)', margin: '4px 2px' }} />
                                    <div style={{ padding: '4px 9px 6px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                                      {(issue.labels || []).length > 0 && (
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                                          {(issue.labels || []).slice(0, 6).map((l: any, idx: number) => {
                                            const name = typeof l === 'string' ? l : l.name;
                                            const colorHex = typeof l === 'object' && l.color ? `#${l.color}` : '#3b82f6';
                                            return (
                                              <span key={idx} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: `${colorHex}22`, color: colorHex }}>{name}</span>
                                            );
                                          })}
                                        </div>
                                      )}
                                      {assigneeList.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                          <div style={{ display: 'flex', alignItems: 'center' }}>
                                            {assigneeList.slice(0, 3).map((a, i) => (
                                              <div key={a.login} style={{ marginLeft: i === 0 ? 0 : -5, display: 'flex' }}>
                                                <IssueGitAvatar login={a.login} avatarUrl={a.avatar} size={14} isEffectiveDark={isEffectiveDark} />
                                              </div>
                                            ))}
                                          </div>
                                          <span style={{ fontSize: 10.5, color: skinTk.textMuted }}>{assigneeList.map((a) => a.login).join(', ')}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Botão para enviar para o terminal */}
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleSendIssueToTerminal(issue)}
                              title="Enviar issue para o terminal ativo"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 2.5,
                                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                                border: 'none',
                                color: skinTk.textPrimary,
                                padding: '2px 5px',
                                borderRadius: 3,
                                cursor: 'pointer',
                                fontSize: 9,
                                fontWeight: 400,
                                transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = accentColor;
                                e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = skinTk.textPrimary;
                                e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                              }}
                            >
                              <ArrowRight size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Issue Title (Compact with regular font) */}
                        <div style={{ padding: '6px 7px 7px' }}>
                          <div
                            style={{
                              fontSize: 10.5,
                              fontWeight: 400,
                              color: skinTk.textPrimary,
                              lineHeight: 1.25,
                              wordBreak: 'break-word',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              display: '-webkit-box',
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: 'vertical',
                            }}
                          >
                            <span style={{ color: skinTk.textMuted, fontWeight: 500, marginRight: 5 }}>#{issue.number}</span>
                            {issue.title}
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 4: DESIGN BRIDGE SCREENS & PROTOTYPES                */}
          {/* ========================================================= */}
          {sidebarTab === 'reviews' && (
            <PullRequestsList
              isActive={!isExplorerCollapsed}
              repoFullName={repoFullName}
              selected={prTarget}
              onSelect={setPrTarget}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              accentContrastText={getContrastTextColor(accentColor)}
              background={skinActive ? 'transparent' : skinTk.bgCard}
            />
          )}

          {sidebarTab === 'actions' && (
            <ActionsSidebar
              isActive={!isExplorerCollapsed}
              repoFullName={repoFullName}
              workflowId={actionsWf}
              onSelect={(id) => {
                setActionsWf(id);
                setActionsRun(null);
              }}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              background={skinActive ? 'transparent' : skinTk.bgCard}
            />
          )}

          {sidebarTab === 'design' && (
            <div
              className="df-view-enter"
              style={{
                flex: 1,
                minHeight: 0,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
              }}
            >
              {/* Top Toolbar: Search + Sync + Implement All */}
              <div
                style={{
                  padding: 8,
                  borderBottom: `1px solid ${skinTk.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div
                    className="df-search-box"
                    style={{
                      flex: 1,
                      height: 26,
                      borderRadius: 6,
                      background: getFieldTokens(isEffectiveDark).fieldBg,
                      border: getFieldTokens(isEffectiveDark).fieldBorder,
                      boxShadow: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '0 8px',
                    }}
                  >
                    <Search size={12} color={skinTk.textMuted} />
                    <input
                      type="text"
                      value={designSearchQuery}
                      onChange={(e) => setDesignSearchQuery(e.target.value)}
                      placeholder="Buscar tela do design..."
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: '100%',
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        color: skinTk.textPrimary,
                        fontSize: 11,
                        fontWeight: 400,
                        fontFamily: 'inherit',
                      }}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      loadDesignBridgeManifest(workspacePath).then((m) => {
                        setDesignManifest(m);
                        onToast?.('Catálogo de Design atualizado');
                      });
                    }}
                    title="Recarregar telas do Design"
                    style={{
                      width: 26,
                      height: 26,
                      borderRadius: 6,
                      border: 'none',
                      background: isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                      color: skinTk.textSecondary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <RefreshCw size={12} />
                  </button>
                </div>

                {(designManifest?.screens?.length ?? 0) > 0 && (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 10.5, color: skinTk.textSecondary, fontWeight: 400 }}>
                      {designManifest!.screens.length} tela{designManifest!.screens.length === 1 ? '' : 's'} sincronizada{designManifest!.screens.length === 1 ? '' : 's'}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleSendDesignToTerminal(undefined, true)}
                      title="Enviar especificação completa de todas as telas para o agente ativo no terminal"
                      style={{
                        height: 24,
                        padding: '0 8px',
                        borderRadius: 5,
                        border: 'none',
                        background: accentColor,
                        color: getContrastTextColor(accentColor),
                        fontSize: 10.5,
                        fontWeight: 400,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        transition: 'opacity 0.15s ease',
                      }}
                    >
                      <span>Implementar todas</span>
                      <ArrowRight size={11} />
                    </button>
                  </div>
                )}
              </div>

              {/* Screens List */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  overflowX: 'hidden',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                {!designManifest || designManifest.screens.length === 0 ? (
                  <div
                    style={{
                      padding: '28px 12px',
                      textAlign: 'center',
                      fontSize: 11,
                      color: skinTk.textMuted,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <LayoutGrid size={22} strokeWidth={1.5} color={skinTk.textMuted} />
                    <span>Nenhuma tela criada na aba Design ainda.</span>
                    <span style={{ fontSize: 10, opacity: 0.8, lineHeight: 1.4 }}>
                      Assim que você desenhar ou gerar telas com IA na aba Design, elas aparecem aqui automaticamente para uso no CLI.
                    </span>
                  </div>
                ) : (
                  designManifest.screens
                    .filter((scr) => {
                      const q = designSearchQuery.trim().toLowerCase();
                      if (!q) return true;
                      return (
                        scr.name.toLowerCase().includes(q) ||
                        scr.slug.toLowerCase().includes(q) ||
                        scr.pageName.toLowerCase().includes(q)
                      );
                    })
                    .map((scr, idx) => {
                      const isPreviewActive = previewDesignScreen?.id === scr.id;
                      const thumbUrl = resolvedCliDesignThumbs[scr.id] || scr.previewDataUrl || buildScreenSvgFallbackDataUrl(scr);
                      return (
                        <div
                          key={scr.id}
                          className="df-card-subtle df-stagger-item"
                          onClick={() => {
                            setViewer(null);
                            setPreviewDesignScreen(scr);
                            logSystemActivity('design_bridge', 'preview_design_in_cli', scr.name, {
                              screenId: scr.id,
                              width: scr.width,
                              height: scr.height,
                            });
                          }}
                          title={`Clique para abrir o preview de "${scr.name}" na área central`}
                          style={{
                            '--stagger-idx': idx,
                            padding: 8,
                            borderRadius: 6,
                            background: isPreviewActive
                              ? hexToRgba(accentColor, isEffectiveDark ? 0.18 : 0.12)
                              : isEffectiveDark
                              ? 'rgba(255, 255, 255, 0.04)'
                              : 'rgba(0, 0, 0, 0.03)',
                            border: 'none',
                            boxShadow: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            cursor: 'pointer',
                          } as React.CSSProperties}
                          onMouseEnter={(e) => {
                            if (!isPreviewActive) {
                              e.currentTarget.style.background = isEffectiveDark
                                ? 'rgba(255, 255, 255, 0.07)'
                                : 'rgba(0, 0, 0, 0.05)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            if (!isPreviewActive) {
                              e.currentTarget.style.background = isEffectiveDark
                                ? 'rgba(255, 255, 255, 0.04)'
                                : 'rgba(0, 0, 0, 0.03)';
                            }
                          }}
                        >
                          <div
                            style={{
                              width: '100%',
                              height: 92,
                              borderRadius: 5,
                              overflow: 'hidden',
                              background: scr.backgroundHex || (isEffectiveDark ? '#121214' : '#f1f5f9'),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <img
                              src={thumbUrl}
                              alt={scr.name}
                              style={{
                                width: '100%',
                                height: '100%',
                                objectFit: 'contain',
                                display: 'block',
                              }}
                            />
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                              <span
                                style={{
                                  fontSize: 11.5,
                                  fontWeight: 400,
                                  color: isPreviewActive ? accentColor : skinTk.textPrimary,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                                title={scr.name}
                              >
                                {scr.name}
                              </span>
                              <span style={{ fontSize: 10, color: skinTk.textSecondary }}>
                                {scr.width}x{scr.height}px · {scr.elementCount} elementos
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendDesignToTerminal(scr, false);
                                }}
                                title="Mencionar esta tela no prompt do terminal (@)"
                                style={{
                                  height: 24,
                                  width: 24,
                                  borderRadius: 5,
                                  border: 'none',
                                  background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                  color: skinTk.textPrimary,
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
                                }}
                              >
                                <AtSign size={12} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSendDesignToTerminal(scr, true);
                                }}
                                title="Implementar esta tela agora no terminal ativo"
                                style={{
                                  height: 24,
                                  padding: '0 7px',
                                  borderRadius: 5,
                                  border: 'none',
                                  background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                                  color: skinTk.textPrimary,
                                  fontSize: 10.5,
                                  fontWeight: 400,
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = accentColor;
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = skinTk.textPrimary;
                                }}
                              >
                                <span>Implementar</span>
                                <ArrowRight size={11} />
                              </button>
                            </div>
                          </div>

                          {scr.colors.length > 0 && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                              {scr.colors.slice(0, 7).map((hex) => (
                                <span
                                  key={hex}
                                  title={hex}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    fontSize: 9.5,
                                    color: skinTk.textSecondary,
                                    background: isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                                    padding: '1px 5px',
                                    borderRadius: 4,
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 7,
                                      height: 7,
                                      borderRadius: 2,
                                      background: hex,
                                      display: 'inline-block',
                                    }}
                                  />
                                  {hex}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })
                )}
              </div>
            </div>
          )}

          <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}><TerminalSkinOverlay skin={skinId} region="sidebar" /></div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. SPLITTER RESIZER (DRAGGABLE)                                     */}
      {/* =================================================================== */}
      {!isExplorerCollapsed && (
        <div
          className={`resizer-col ${isDraggingExplorer ? 'dragging' : ''}`}
          onMouseDown={handleStartExplorerResize}
          onDoubleClick={() => setExplorerWidth(340)}
          title="Arraste para redimensionar (duplo clique restaura)"
          // área de captura maior (sem alterar o layout) para ser fácil de agarrar
          style={{ width: 11, marginLeft: -3, marginRight: -3 }}
        />
      )}

      {/* =================================================================== */}
      {/* 3. RIGHT PANE: TERMINAL COM ABAS (COBRINDO O RESTO DA TELA)         */}
      {/* =================================================================== */}
      <div
        data-tour="cli-terminal-pane"
        style={{
          flex: '1 1 0',
          height: '100%',
          minWidth: 0,
          background: skinActive ? 'transparent' : themeTokens.bgCard,
          borderRadius: 10,
          border: 'none',
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Terminal Header Tabs Bar */}
        <div
          data-tour="cli-terminal-topbar"
          className="skin-bar"
          style={{
            height: 38,
            padding: '0 8px',
            background: skinActive ? 'transparent' : isEffectiveDark ? '#161616' : '#f2f2f2',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexShrink: 0,
            marginBottom: 5, // respiro entre as abas e a área dos terminais
            overflow: 'visible',
            position: 'relative',
            zIndex: 40,
          }}
        >
          {/* Left: Back Arrow (when viewer/preview/PR open) + Collapse Sidebar Button + Tabs List */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1, overflow: 'visible' }}>
            {(viewer || previewDesignScreen || showPrDetail || showActions) && (
              <button
                type="button"
                className="df-pressable"
                onClick={() => {
                  if (showActions) {
                    if (actionsRun !== null) setActionsRun(null);
                    else setSidebarTab('files');
                  } else if (showPrDetail) setPrTarget(null);
                  else if (previewDesignScreen) setPreviewDesignScreen(null);
                  else if (viewer) closeViewer();
                }}
                title="Voltar para os terminais"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: skinTk.textSecondary,
                  padding: '4px 6px',
                  borderRadius: 5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  flexShrink: 0,
                  transition: 'color 150ms ease, background-color 150ms ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = skinTk.textPrimary;
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = skinTk.textSecondary;
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <ArrowLeft size={15} />
              </button>
            )}

            {/* Toggle Explorer Button */}
            <button
              type="button"
              onClick={() => setIsExplorerCollapsed((prev) => !prev)}
              title={isExplorerCollapsed ? 'Expandir Navegador de Arquivos' : 'Recolher Navegador de Arquivos'}
              style={{
                background: 'transparent',
                border: 'none',
                color: skinTk.textSecondary,
                padding: '4px 6px',
                borderRadius: 5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = skinTk.textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = skinTk.textSecondary)}
            >
              <PanelLeft size={15} />
            </button>

            <div style={{ height: 16, width: 1, flexShrink: 0, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.16)', margin: 0 }} />

            {/* Abas do painel do IDE (mesmas do IDE): Terminal mostra os terminais do CLI, as outras o conteúdo do IDE */}
            {dockTabs && dockTabs.length > 0 && (() => {
              const cur = dockTabs.find((t) => t.id === cliDockTab) || dockTabs[0];
              const countBadge = (count: number | undefined, active: boolean) =>
                count !== undefined ? (
                  <span style={{ fontSize: 10, fontWeight: 600, padding: '0 5.5px', borderRadius: 10, height: 14, display: 'inline-flex', alignItems: 'center', background: isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.07)', color: active ? skinTk.textPrimary : skinTk.textSecondary }}>{count}</span>
                ) : null;
              return (
                <>
                  {problemsSummary && problemsSummary.errors + problemsSummary.warnings > 0 && (
                    <button
                      type="button"
                      onClick={() => { setCliDockTab('problems'); setViewer(null); }}
                      title={`${problemsSummary.errors} erro(s), ${problemsSummary.warnings} aviso(s) · abrir Problems`}
                      style={{ display: 'flex', alignItems: 'center', gap: 4, height: 26, padding: '0 6px', borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: problemsSummary.errors > 0 ? '#ef4444' : '#f59e0b', fontSize: 11, fontWeight: 600, flexShrink: 0 }}
                    >
                      <span>{problemsSummary.errors + problemsSummary.warnings > 99 ? '99+' : problemsSummary.errors + problemsSummary.warnings}</span>
                      {problemsSummary.errors > 0 ? <XCircle size={14} /> : <AlertTriangle size={14} />}
                    </button>
                  )}
                  {problemsSummary && problemsSummary.errors + problemsSummary.warnings > 0 && problemsPrompt && (
                    <button
                      type="button"
                      onClick={() => {
                        const idx = activeWorkspace?.focusedSlotIndex ?? 0;
                        const sess = terminalSessions.find((x) => x.id === effectiveSlots[idx]) || terminalSessions.find((x) => x.id === activeSessionId);
                        const kind = activeWorkspace && sess ? getSlotAiType(activeWorkspace, idx, sess) : 'zsh';
                        if (!sess || !/^(claude|agy|antigravity|gemini|codex|ollama)$/.test(kind)) {
                          onToast?.('O terminal ativo não é uma IA: abra o Claude, Antigravity, Gemini ou Codex nele');
                          return;
                        }
                        // colagem "entre colchetes" mantém as quebras de linha como texto; o Enter vem depois
                        window.electronAPI?.pty?.write(sess.id, `\x1b[200~${problemsPrompt}\x1b[201~`);
                        setTimeout(() => window.electronAPI?.pty?.write(sess.id, '\r'), 200);
                        onToast?.('Problemas enviados para a IA do terminal ativo');
                      }}
                      title="Enviar os problemas para a IA do terminal ativo resolver"
                      style={{ display: 'flex', alignItems: 'center', height: 26, padding: '0 5px', borderRadius: 5, border: 'none', background: 'transparent', cursor: 'pointer', color: skinTk.textSecondary, flexShrink: 0 }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = skinTk.textSecondary)}
                    >
                      <ArrowRight size={14} />
                    </button>
                  )}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={() => setDockMenuOpen((v) => !v)}
                      className="skin-chip df-dropdown-trigger"
                      title="Painel: Problems, Output, Debug console, Terminal, Ports, Tarefas"
                      style={{ height: 26, padding: '0 8px 0 10px', borderRadius: 5, border: dockMenuOpen ? getFieldTokens(isEffectiveDark).fieldBorderFocus : getFieldTokens(isEffectiveDark).fieldBorder, boxShadow: 'none', background: dockMenuOpen ? getFieldTokens(isEffectiveDark).fieldBgHover : getFieldTokens(isEffectiveDark).fieldBg, color: skinTk.textPrimary, display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 400, whiteSpace: 'nowrap' }}
                    >
                      <span>{cur.label}</span>
                      {countBadge(cur.count, true)}
                      <ChevronDown size={12} className="df-chevron" color={skinTk.textSecondary} style={{ transform: dockMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                    </button>
                    {dockMenuOpen && (
                      <>
                        <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setDockMenuOpen(false)} />
                        <div className="skin-menu df-dropdown-menu" style={{ position: 'absolute', top: 30, left: 0, minWidth: 170, background: getFieldTokens(isEffectiveDark).dropdownMenuBg, border: getFieldTokens(isEffectiveDark).dropdownBorder, borderRadius: 8, boxShadow: 'none', padding: 4, zIndex: 100, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          {dockTabs.map((st) => {
                            const isActive = cur.id === st.id;
                            return (
                              <div
                                key={st.id}
                                className="skin-tab df-row-interactive"
                                data-on={isActive ? '1' : undefined}
                                onClick={() => { setCliDockTab(st.id); setViewer(null); setDockMenuOpen(false); }}
                                style={{ height: 28, padding: '0 10px', borderRadius: 5, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, cursor: 'pointer', fontSize: 12, fontWeight: isActive ? 500 : 400, color: isActive ? skinTk.textPrimary : skinTk.textSecondary, background: isActive ? (isEffectiveDark ? '#2E2E2E' : '#e5e7eb') : 'transparent' }}
                                onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = skinTk.hoverBg; }}
                                onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                              >
                                <span>{st.label}</span>
                                {countBadge(st.count, isActive)}
                              </div>
                            );
                          })}
                        </div>
                      </>
                    )}
                  </div>
                  <div style={{ height: 16, width: 1, flexShrink: 0, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.16)', margin: 0 }} />
                </>
              );
            })()}

            {/* Scrollable Terminal Session Tabs */}
            <div
              ref={tabsContainerRef}
              className="no-scrollbar"
              onWheel={(e) => {
                if (tabsContainerRef.current && e.deltaY !== 0) {
                  tabsContainerRef.current.scrollLeft += e.deltaY;
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                minWidth: 0,
                flex: '0 1 auto' /* só o espaço das abas: o + fica logo depois da última e nunca é empurrado para fora */,
                overflowX: 'auto',
                overflowY: 'hidden',
                scrollbarWidth: 'none',
              }}
            >
            {workspaces.map((ws) => {
              // a aba só fica ativa quando a área central mostra os terminais (não um arquivo, uma tela de design, um PR ou o painel do dock)
              const centerIsTerminal = !showPrDetail && !showActions && !previewDesignScreen && !viewer && !(cliDockTab !== 'terminal' && renderDockContent);
              const isActive = ws.id === activeWorkspaceId && centerIsTerminal;
              const isRenaming = renamingWorkspaceId === ws.id;



              // durante o arraste as outras abas deslizam para abrir o espaço onde a aba cairia
              let dragShift = 0;
              if (tabDragId && tabDrop && tabDragId !== ws.id) {
                const ids = workspaces.map((w) => w.id);
                const rest = ids.filter((i) => i !== tabDragId);
                const ti = rest.indexOf(tabDrop.id);
                const myRest = rest.indexOf(ws.id);
                if (ti >= 0 && myRest >= 0) {
                  const insertAt = ti + (tabDrop.after ? 1 : 0);
                  const newI = myRest + (myRest >= insertAt ? 1 : 0);
                  const par = tabRefs.current.get(ws.id)?.parentElement;
                  const gap = par ? parseFloat(getComputedStyle(par).columnGap) || 0 : 0;
                  dragShift = (newI - ids.indexOf(ws.id)) * ((tabRefs.current.get(tabDragId)?.offsetWidth || 155) + gap);
                }
              }

              const getTabMinWidth = () => {
                if (isRenaming) return 120;
                switch (ws.gridMode) {
                  case '2x2': return 66;
                  case '3':
                  case '1x3': return 54;
                  case '2x1':
                  case '1x2': return 42;
                  default: return 34;
                }
              };

              return (
                <div
                  key={ws.id}
                  ref={(el) => {
                    if (el) tabRefs.current.set(ws.id, el);
                    else tabRefs.current.delete(ws.id);
                  }}
                  data-on={isActive ? '1' : undefined}
                  className={`workspace-tab skin-tab ${isActive ? 'active' : ''} ${ws.gridMode !== '1x1' ? 'is-grid' : ''}`}
                  draggable={!isRenaming}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('application/x-aura-tab', ws.id);
                    e.dataTransfer.effectAllowed = 'move';
                    setTabDragId(ws.id);
                  }}
                  onDragOver={(e) => {
                    if (!tabDragId) return;
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    // a aba pode estar deslocada pela animação: o teste usa a posição original dela
                    const r = e.currentTarget.getBoundingClientRect();
                    const after = e.clientX > r.left - dragShift + r.width / 2;
                    if (tabDrop?.id !== ws.id || tabDrop.after !== after) setTabDrop({ id: ws.id, after });
                  }}
                  onDrop={(e) => {
                    if (!tabDragId) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (tabDrop) moveTab(tabDragId, tabDrop.id, tabDrop.after);
                    setTabDragId(null);
                    setTabDrop(null);
                  }}
                  onDragEnd={() => {
                    setTabDragId(null);
                    setTabDrop(null);
                  }}
                  onClick={() => {
                    handleSelectWorkspace(ws.id);
                    setCliDockTab('terminal');
                    closeViewer();
                    setPreviewDesignScreen(null);
                    setPrTarget(null);
                    setSidebarTab('files');
                    setIsExplorerCollapsed(false);
                  }}
                  onMouseDown={(e) => {
                    if (e.button === 1) {
                      e.preventDefault();
                      e.stopPropagation();
                      handleRequestCloseWorkspace(ws, e);
                    }
                  }}
                  onDoubleClick={() => {
                    setRenamingWorkspaceId(ws.id);
                    setRenameWorkspaceValue(ws.name);
                  }}
                  title={isActive ? `${ws.name} (Ativo - duplo clique para renomear)` : `${ws.name} (clique para alternar)`}
                  style={{
                    height: 28,
                    padding: '0 6px',
                    borderRadius: 6,
                    background: isActive
                      ? (isEffectiveDark ? hexToRgba(accentColor, 0.16) : hexToRgba(accentColor, 0.12))
                      : 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    width: 155, // largura cheia; o container query do CSS impede o cálculo automático, então a largura é explícita
                    flex: '0 1 auto', // só encolhe, até o mínimo, quando faltar espaço
                    maxWidth: 155,
                    minWidth: getTabMinWidth(),
                    position: 'relative',
                    animation: closingTabId === ws.id ? 'dfTabOut 0.18s var(--ease-out) forwards' : 'dfTabIn 0.26s var(--ease-out)',
                    pointerEvents: closingTabId === ws.id ? 'none' : undefined,
                    opacity: tabDragId === ws.id ? 0.35 : 1,
                    transform: tabDragId === ws.id ? 'scale(0.96)' : dragShift ? `translateX(${dragShift}px)` : undefined,
                    transition: tabDragId
                      ? 'transform 0.22s var(--ease-out), background 0.15s ease, opacity 0.15s ease'
                      : 'background 0.15s ease, color 0.15s ease, opacity 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Workspace Icon(s): AI single icon or Stacked icons for grid */}
                  <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                    {renderWorkspaceTabIcons(ws, isActive)}
                  </div>

                  {/* Title or Inline Rename Input */}
                  {isRenaming ? (
                    <input
                      type="text"
                      value={renameWorkspaceValue}
                      onChange={(e) => setRenameWorkspaceValue(e.target.value)}
                      onBlur={() => {
                        if (renameWorkspaceValue.trim()) {
                          setWorkspaces((prev) =>
                            prev.map((w) => (w.id === ws.id ? { ...w, name: renameWorkspaceValue.trim(), userNamed: true } : w))
                          );
                        }
                        setRenamingWorkspaceId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (renameWorkspaceValue.trim()) {
                            setWorkspaces((prev) =>
                              prev.map((w) => (w.id === ws.id ? { ...w, name: renameWorkspaceValue.trim(), userNamed: true } : w))
                            );
                          }
                          setRenamingWorkspaceId(null);
                        } else if (e.key === 'Escape') {
                          setRenamingWorkspaceId(null);
                        }
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        background: getFieldTokens(isEffectiveDark).fieldBgSolid,
                        border: getFieldTokens(isEffectiveDark).fieldBorderFocus,
                        boxShadow: 'none',
                        color: skinTk.textPrimary,
                        fontSize: 11.5,
                        fontWeight: 400,
                        outline: 'none',
                        borderRadius: 3,
                        padding: '1px 4px',
                        width: 70,
                      }}
                    />
                  ) : (
                    <div
                      className="workspace-tab-text"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        minWidth: 0,
                        flex: '1 1 auto',
                        overflow: 'hidden',
                      }}
                    >
                      <span
                        className="workspace-tab-title"
                        style={{
                          fontSize: 12,
                          fontWeight: 400,
                          color: isActive ? skinTk.textPrimary : skinTk.textSecondary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          minWidth: 0,
                        }}
                      >
                        {ws.name}
                      </span>
                    </div>
                  )}

                  {/* Close Workspace Button */}
                  <button
                    type="button"
                    className="workspace-tab-close"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRequestCloseWorkspace(ws, e);
                    }}
                    title="Fechar área de trabalho"
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: skinTk.textMuted,
                      padding: 2,
                      borderRadius: 3,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      marginLeft: 'auto',
                      flexShrink: 0,
                      opacity: isActive ? 0.8 : 0.4,
                      transition: 'opacity 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = '#ef4444';
                      e.currentTarget.style.opacity = '1';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = skinTk.textMuted;
                      e.currentTarget.style.opacity = isActive ? '0.8' : '0.4';
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              );
            })}
            </div>

            {/* Add New Session / Workspace Button with Dropdown Trigger */}
            <div ref={newTabMenuRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setNewTabMenuOpen((prev) => !prev);
                }}
                title="Nova área de trabalho (Única, Split, Grid ou IA)"
                style={{
                  height: 26,
                  padding: '0 8px',
                  borderRadius: 6,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  border: 'none',
                  color: skinTk.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 500,
                  transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = skinTk.textPrimary;
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = skinTk.textSecondary;
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                }}
              >
                <Plus size={14} />
              </button>

              {/* Presets Popup Dropdown */}
              {newTabMenuOpen && (
                <div
                  className="skin-menu df-dropdown-menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    width: 220,
                    background: getFieldTokens(isEffectiveDark).dropdownMenuBg,
                    border: getFieldTokens(isEffectiveDark).dropdownBorder,
                    borderRadius: 8,
                    padding: '4px 0',
                    boxShadow: 'none',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, color: skinTk.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Áreas de Trabalho & Layouts
                  </div>
                  <div
                    className="df-row-interactive"
                    onClick={() => handleCreateWorkspace('1x1')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: skinTk.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Square size={13} color={accentColor} />
                    <span>Área Simples (1 Terminal)</span>
                  </div>
                  <div
                    className="df-row-interactive"
                    onClick={() => handleCreateWorkspace('1x2')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: skinTk.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Columns2 size={13} color={accentColor} />
                    <span>Split 1x2 (Lado a Lado)</span>
                  </div>
                  <div
                    className="df-row-interactive"
                    onClick={() => handleCreateWorkspace('2x2')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: skinTk.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Grid2x2 size={13} color={accentColor} />
                    <span>Grid 2x2 (4 Terminais)</span>
                  </div>
                  <div
                    className="df-row-interactive"
                    onClick={() => handleCreateWorkspace('2x1')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: skinTk.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Rows2 size={13} color={accentColor} />
                    <span>Split 2x1 (Empilhados)</span>
                  </div>
                  <div
                    className="df-row-interactive"
                    onClick={() => handleCreateWorkspace('3')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: skinTk.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LayoutGrid size={13} color={accentColor} />
                    <span>Grid 3x (3 Terminais)</span>
                  </div>

                  <div style={{ height: 1, background: skinTk.border, margin: '4px 0' }} />

                  <div style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, color: skinTk.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    CLIs de Inteligência Artificial
                  </div>
                  <div
                    className="df-row-interactive"
                    onClick={() => handleCreateWorkspace('1x1', 'claude', 'Claude CLI', 'claude')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: skinTk.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <ClaudeIcon size={14} />
                    <span>Claude CLI</span>
                  </div>
                  <div
                    className="df-row-interactive"
                    onClick={() => handleCreateWorkspace('1x1', 'antigravity', 'Antigravity CLI', 'agy')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: skinTk.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <AntigravityIcon size={14} />
                    <span>Antigravity CLI (agy)</span>
                  </div>
                  <div
                    className="df-row-interactive"
                    onClick={() => handleCreateWorkspace('1x1', 'gemini', 'Gemini CLI', 'gemini')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: skinTk.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <GeminiIcon size={14} />
                    <span>Gemini CLI</span>
                  </div>
                  <div
                    className="df-row-interactive"
                    onClick={() => handleCreateWorkspace('1x1', 'codex', 'OpenAI Codex', 'codex')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: skinTk.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <CodexIcon size={14} />
                    <span>Codex CLI</span>
                  </div>

                  <div style={{ height: 1, background: skinTk.border, margin: '4px 0' }} />

                  <div style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, color: skinTk.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Terminais Shell & REPL
                  </div>
                  <div
                    className="df-row-interactive"
                    onClick={() => handleCreateWorkspace('1x1', 'bash', 'Bash Shell', 'bash')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: skinTk.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <TerminalIcon size={14} color="#10b981" />
                    <span>Bash Shell</span>
                  </div>
                  <div
                    className="df-row-interactive"
                    onClick={() => handleCreateWorkspace('1x1', 'node', 'Node.js REPL', 'node')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: skinTk.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Play size={13} color="#22c55e" />
                    <span>Node.js REPL</span>
                  </div>
                  <div
                    className="df-row-interactive"
                    onClick={() => handleCreateWorkspace('1x1', 'python', 'Python REPL', 'python3')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: skinTk.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = skinTk.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Play size={13} color="#3b82f6" />
                    <span>Python 3 REPL</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Grid Layout Picker, Quick Split, Clear, Zoom Controls */}
          <div className="skin-bar" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, position: 'relative' }}>
            {/* Grid Layout Picker Dropdown */}
            <div ref={layoutMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLayoutMenuOpen((prev) => !prev);
                }}
                title={`Layout do terminal: ${gridMode === '2x2' ? 'Grid 2x2' : gridMode === '1x2' ? '2 lado a lado' : gridMode === '1x3' ? '3 lado a lado' : gridMode === '2x1' ? '2 empilhados' : gridMode === '3' ? '3 (2 topo, 1 base)' : 'terminal único'}`}
                style={{
                  height: 26,
                  padding: '0 8px',
                  borderRadius: 6,
                  background: getFieldTokens(isEffectiveDark).fieldBg,
                  border: getFieldTokens(isEffectiveDark).fieldBorder,
                  boxShadow: 'none',
                  color: skinTk.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 400,
                  transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = skinTk.textPrimary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = skinTk.textSecondary;
                }}
              >
                {gridMode === '2x2' ? (
                  <Grid2x2 size={13} />
                ) : gridMode === '3' ? (
                  <LayoutGrid size={13} />
                ) : gridMode === '1x3' ? (
                  <Columns3 size={13} />
                ) : gridMode === '2x1' ? (
                  <Rows2 size={13} />
                ) : gridMode === '1x2' ? (
                  <Columns2 size={13} />
                ) : (
                  <Square size={13} />
                )}
                <ChevronDown
                  size={11}
                  className="df-chevron"
                  style={{ transform: layoutMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                />
              </button>

              {/* Layout Dropdown Menu */}
              {layoutMenuOpen && (
                <div
                  className="skin-menu df-dropdown-menu df-popover-right"
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    width: 252,
                    background: isEffectiveDark ? '#2a2a2a' : '#ffffff',
                    border: 'none',
                    borderRadius: 10,
                    padding: 8,
                    boxShadow: 'none',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                  }}
                >
                  <div style={{ padding: '4px 8px 6px', fontSize: 10.5, fontWeight: 400, color: isEffectiveDark ? '#a3a3a3' : '#737373', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Layout de terminais
                  </div>
                  {(
                    [
                      { mode: '1x1', label: '1 terminal', hint: 'Tela única' },
                      { mode: '1x2', label: '2 terminais', hint: 'Lado a lado' },
                      { mode: '2x1', label: '2 terminais', hint: 'Empilhados' },
                      { mode: '1x3', label: '3 terminais', hint: 'Lado a lado' },
                      { mode: '3', label: '3 terminais', hint: '2 em cima, 1 embaixo' },
                      { mode: '2x2', label: '4 terminais', hint: 'Grid 2x2' },
                    ] as const
                  ).map((o) => {
                    const on = gridMode === o.mode;
                    return (
                      <div
                        key={o.mode}
                        className="df-pressable"
                        onClick={() => applyGridMode(o.mode)}
                        style={{
                          height: 34,
                          padding: '0 8px',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 10,
                          cursor: 'pointer',
                          fontSize: 12,
                          fontWeight: 400,
                          color: isEffectiveDark ? '#f2f2f2' : '#171717',
                          background: on ? hexToRgba(accentColor, 0.18) : 'transparent',
                          transition: 'background-color 120ms ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!on) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                        }}
                        onMouseLeave={(e) => {
                          if (!on) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <span style={{ display: 'flex', color: on ? accentColor : (isEffectiveDark ? '#a3a3a3' : '#737373') }}>
                          <LayoutGlyph mode={o.mode} />
                        </span>
                        <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap' }}>{o.label}</span>
                        <span style={{ fontSize: 11, color: isEffectiveDark ? '#a3a3a3' : '#737373', whiteSpace: 'nowrap' }}>{o.hint}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Quick Toggle Split */}
            <button
              type="button"
              onClick={handleQuickToggleSplit}
              title={gridMode === '1x1' ? 'Dividir terminal lado a lado' : gridMode === '1x2' ? 'Expandir para Grid 2x2' : 'Voltar para 1 terminal'}
              style={{
                background: getFieldTokens(isEffectiveDark).fieldBg,
                border: 'none',
                boxShadow: 'none',
                color: skinTk.textSecondary,
                height: 26,
                padding: '0 8px',
                borderRadius: 6,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = skinTk.textPrimary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = skinTk.textSecondary;
              }}
            >
              {/* o ícone mostra o que o clique faz: dividir em 2, expandir para 4 ou voltar a 1 */}
              <SplitHintIcon mode={gridMode === '1x1' ? 'right' : gridMode === '1x2' ? 'bottom' : 'merge'} />
            </button>

            {/* Clear Terminal */}
            <button
              type="button"
              onClick={handleClearTerminal}
              title="Limpar terminal ativo (clear)"
              style={{
                background: 'transparent',
                border: 'none',
                color: skinTk.textSecondary,
                padding: '4px 6px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = skinTk.textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = skinTk.textSecondary)}
            >
              <Eraser size={13} />
            </button>

            <div style={{ height: 16, width: 1, flexShrink: 0, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.16)', margin: '0 2px' }} />

            {/* Fechar Todos os Terminais (Apenas ícone vermelho) */}
            <button
              type="button"
              onClick={() => setIsConfirmCloseAllOpen(true)}
              title="Fechar todos os terminais"
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                padding: '4px 6px',
                borderRadius: 5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(239, 68, 68, 0.14)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <Trash2 size={13.5} color="#ef4444" />
            </button>

            {/* Font Zoom Controls */}
            {onSetTerminalFontSize && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <button
                  type="button"
                  onClick={() => onSetTerminalFontSize(Math.max(10, terminalFontSize - 1))}
                  title="Diminuir fonte do terminal"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: skinTk.textSecondary,
                    padding: '4px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ZoomOut size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => onSetTerminalFontSize(Math.min(22, terminalFontSize + 1))}
                  title="Aumentar fonte do terminal"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: skinTk.textSecondary,
                    padding: '4px',
                    borderRadius: 4,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  <ZoomIn size={13} />
                </button>
              </div>
            )}
          </div>
          <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}><TerminalSkinOverlay skin={skinId} region="header" /></div>
        </div>

        {/* Global Resizing Overlay to guarantee smooth dragging over xterm canvases */}
        {(isDraggingExplorer || isDraggingSplitX || isDraggingSplitY) && (
          <div
            style={{
              position: 'fixed',
              inset: 0,
              zIndex: 999999,
              cursor: isDraggingSplitY ? 'row-resize' : 'col-resize',
              userSelect: 'none',
            }}
          />
        )}

        {/* Terminal Body with Grid 2x2 / Split Support */}
        {showPrDetail && reviewAiProvider && (
          <div style={{ flex: '1 1 0', minHeight: 0, minWidth: 0, display: 'flex' }}>
            <PullRequestDetail target={prTarget} isEffectiveDark={isEffectiveDark} accentColor={accentColor} aiProvider={reviewAiProvider} onToast={(m) => onToast?.(m)} onResolveWithAi={openResolveWorkspace} />
          </div>
        )}
        {showActions && (
          <div style={{ flex: '1 1 0', minHeight: 0, minWidth: 0, display: 'flex' }}>
            <ActionsView
              isActive={showActions}
              repoFullName={repoFullName}
              workflowId={actionsWf}
              runId={actionsRun}
              onOpenRun={setActionsRun}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              accentContrastText={getContrastTextColor(accentColor)}
              aiProviderId={reviewAiProvider?.id}
              onToast={(m) => onToast?.(m)}
              onResolveWithAi={openResolveWorkspace}
            />
          </div>
        )}
        {!showPrDetail && !showActions && previewDesignScreen && (
          <div
            key={previewDesignScreen.id}
            className="df-view-enter"
            style={{
              flex: '1 1 0',
              minHeight: 0,
              minWidth: 0,
              display: 'flex',
              flexDirection: 'column',
              background: isEffectiveDark ? '#101010' : '#ffffff',
              padding: 10,
              gap: 10,
              boxSizing: 'border-box',
              overflow: 'hidden',
            }}
          >
            {/* Top Bar: Screen Info + Mencionar + Implementar */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                paddingBottom: 10,
                borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                <span style={{ fontSize: 13, fontWeight: 400, color: themeTokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {previewDesignScreen.name}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 400,
                    color: themeTokens.textSecondary,
                    background: isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                    padding: '2px 8px',
                    borderRadius: 5,
                    flexShrink: 0,
                  }}
                >
                  {previewDesignScreen.width} × {previewDesignScreen.height}px · {previewDesignScreen.elementCount} elementos
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => {
                    handleSendDesignToTerminal(previewDesignScreen, false);
                    setPreviewDesignScreen(null);
                  }}
                  title="Inserir menção desta tela no prompt do terminal ativo (@)"
                  style={{
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: isEffectiveDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                    color: themeTokens.textPrimary,
                    fontSize: 11.5,
                    fontWeight: 400,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <AtSign size={13} />
                  <span>Mencionar</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    handleSendDesignToTerminal(previewDesignScreen, true);
                    setPreviewDesignScreen(null);
                  }}
                  title="Enviar esta tela para o agente no terminal ativo implementar agora"
                  style={{
                    height: 28,
                    padding: '0 12px',
                    borderRadius: 6,
                    border: 'none',
                    background: accentColor,
                    color: getContrastTextColor(accentColor),
                    fontSize: 11.5,
                    fontWeight: 400,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>Implementar</span>
                  <ArrowRight size={13} />
                </button>
              </div>
            </div>

            {/* Fitted Screen Preview Container */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                width: '100%',
                borderRadius: 8,
                background: isEffectiveDark ? '#0b0c0e' : '#f1f5f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 16,
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              <img
                src={previewDesignUrl || buildScreenSvgFallbackDataUrl(previewDesignScreen)}
                alt={previewDesignScreen.name}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  width: 'auto',
                  height: 'auto',
                  objectFit: 'contain',
                  borderRadius: 6,
                  display: 'block',
                }}
              />
            </div>
          </div>
        )}
        {!showPrDetail && !showActions && !previewDesignScreen && viewer && (
          <div className="df-opacity-enter" style={{ flex: '1 1 0', minHeight: 0, minWidth: 0, display: 'flex', flexDirection: 'column', background: isEffectiveDark ? '#101010' : '#ffffff' }}>
            <div
              style={{
                height: 40,
                padding: '0 12px',
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <FileIcon fileName={viewer.name} size={15} />
                <span style={{ fontSize: 12.5, fontWeight: 400, color: themeTokens.textPrimary, flexShrink: 0 }}>{viewer.name}</span>
                <span style={{ fontSize: 11, fontWeight: 400, color: themeTokens.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {workspacePath && viewer.path.startsWith(workspacePath)
                    ? viewer.path.slice(workspacePath.length).replace(/^\/+/, '')
                    : viewer.path}
                </span>
                {viewer.isDiffMode && viewer.gitStatus && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 400,
                      padding: '2px 7px',
                      borderRadius: 4,
                      flexShrink: 0,
                      background:
                        viewer.gitStatus === 'added'
                          ? 'rgba(46, 160, 67, 0.14)'
                          : viewer.gitStatus === 'deleted'
                            ? 'rgba(248, 81, 73, 0.14)'
                            : 'rgba(226, 192, 141, 0.14)',
                      color:
                        viewer.gitStatus === 'added'
                          ? '#3fb950'
                          : viewer.gitStatus === 'deleted'
                            ? '#f85149'
                            : '#e2c08d',
                    }}
                  >
                    {viewer.gitStatus === 'added' ? 'Adicionado' : viewer.gitStatus === 'deleted' ? 'Removido' : 'Alterações'}
                  </span>
                )}
                {viewer.content !== undefined && !viewer.dataUrl && !viewer.error && (
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 400,
                      padding: '2px 7px',
                      borderRadius: 4,
                      flexShrink: 0,
                      background:
                        viewer.content !== viewer.savedContent
                          ? 'rgba(245, 158, 11, 0.14)'
                          : 'rgba(16, 185, 129, 0.12)',
                      color:
                        viewer.content !== viewer.savedContent
                          ? '#f59e0b'
                          : '#10b981',
                    }}
                  >
                    {viewer.isSaving
                      ? 'Salvando...'
                      : viewer.content !== viewer.savedContent
                        ? 'Modificado'
                        : 'Salvo'}
                  </span>
                )}
              </div>

              {viewer.reviewFiles && viewer.reviewFiles.length > 1 && viewer.reviewIndex !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                  <button
                    type="button"
                    className="df-pressable"
                    disabled={viewer.reviewIndex <= 0}
                    onClick={() => openGitDiffInCli(viewer.reviewFiles!, viewer.reviewIndex! - 1)}
                    title="Arquivo anterior alterado"
                    style={{
                      height: 26,
                      width: 26,
                      borderRadius: 6,
                      border: 'none',
                      background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                      color: viewer.reviewIndex > 0 ? themeTokens.textPrimary : themeTokens.textMuted,
                      opacity: viewer.reviewIndex > 0 ? 1 : 0.4,
                      cursor: viewer.reviewIndex > 0 ? 'pointer' : 'default',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ArrowLeft size={13} />
                  </button>
                  <span style={{ fontSize: 11, fontWeight: 400, color: themeTokens.textSecondary, padding: '0 4px', fontVariantNumeric: 'tabular-nums' }}>
                    {viewer.reviewIndex + 1} / {viewer.reviewFiles.length}
                  </span>
                  <button
                    type="button"
                    className="df-pressable"
                    disabled={viewer.reviewIndex >= viewer.reviewFiles.length - 1}
                    onClick={() => openGitDiffInCli(viewer.reviewFiles!, viewer.reviewIndex! + 1)}
                    title="Próximo arquivo alterado"
                    style={{
                      height: 26,
                      width: 26,
                      borderRadius: 6,
                      border: 'none',
                      background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                      color: viewer.reviewIndex < viewer.reviewFiles.length - 1 ? themeTokens.textPrimary : themeTokens.textMuted,
                      opacity: viewer.reviewIndex < viewer.reviewFiles.length - 1 ? 1 : 0.4,
                      cursor: viewer.reviewIndex < viewer.reviewFiles.length - 1 ? 'pointer' : 'default',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <ArrowRight size={13} />
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
                {viewer.originalHeadContent !== undefined && !viewer.dataUrl && !viewer.error && (
                  <>
                    <button
                      type="button"
                      className="df-pressable"
                      onClick={() => setViewer((prev) => (prev ? { ...prev, isDiffMode: !prev.isDiffMode } : null))}
                      title={viewer.isDiffMode ? 'Alternar para o editor de arquivo' : 'Comparar alterações com HEAD (Diff)'}
                      style={{
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: 'none',
                        boxShadow: 'none',
                        background: viewer.isDiffMode ? hexToRgba(accentColor, 0.16) : isEffectiveDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                        color: viewer.isDiffMode ? accentColor : themeTokens.textPrimary,
                        fontSize: 11.5,
                        fontWeight: 400,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <Eye size={13} />
                      <span>{viewer.isDiffMode ? 'Diff' : 'Editor'}</span>
                    </button>

                    {viewer.isDiffMode && (
                      <button
                        type="button"
                        className="df-pressable"
                        onClick={() => setViewer((prev) => (prev ? { ...prev, isSideBySide: !prev.isSideBySide } : null))}
                        title={viewer.isSideBySide ? 'Mudar para visualização inline' : 'Mudar para visualização lado a lado'}
                        style={{
                          height: 28,
                          padding: '0 10px',
                          borderRadius: 6,
                          border: 'none',
                          boxShadow: 'none',
                          background: isEffectiveDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                          color: themeTokens.textPrimary,
                          fontSize: 11.5,
                          fontWeight: 400,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 6,
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <SplitSquareVertical size={13} />
                        <span>{viewer.isSideBySide ? 'Lado a lado' : 'Inline'}</span>
                      </button>
                    )}
                  </>
                )}

                {!viewer.isDiffMode && isMarkdownFile(viewer.name) && viewer.content !== undefined && (
                  <button
                    type="button"
                    onClick={() => setMdPreview((v) => !v)}
                    title={mdPreview ? 'Fechar visualização' : 'Visualizar Markdown'}
                    style={{
                      height: 28,
                      padding: '0 10px',
                      borderRadius: 6,
                      border: 'none',
                      boxShadow: 'none',
                      background: mdPreview ? hexToRgba(accentColor, 0.2) : isEffectiveDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                      color: mdPreview ? accentColor : themeTokens.textPrimary,
                      fontSize: 11.5,
                      fontWeight: 400,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <Eye size={13} />
                    <span>Visualizar</span>
                  </button>
                )}

                {viewer.isDiffMode && viewer.content !== undefined && (
                  <button
                    type="button"
                    onClick={() => {
                      openResolveWorkspace(
                        `Revise as alterações do git neste arquivo: ${viewer.path}\n\nRode \`git diff HEAD -- "${viewer.path}"\` (e leia o arquivo se precisar de contexto). Aponte bugs, regressões, problemas de segurança, tratamento de erro faltando e trechos que podem ser simplificados, citando linha e trecho. Não edite nenhum arquivo: só entregue a revisão, ordenada por gravidade.`,
                        `Revisão: ${viewer.name}`
                      );
                      logSystemActivity('terminal', 'revisar_diff_com_ia', gitRepoName || 'default', { arquivo: viewer.name });
                    }}
                    title="A IA selecionada revisa as alterações deste arquivo"
                    style={{
                      height: 28,
                      padding: '0 10px',
                      borderRadius: 6,
                      border: 'none',
                      boxShadow: 'none',
                      background: isEffectiveDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                      color: themeTokens.textPrimary,
                      fontSize: 11.5,
                      fontWeight: 400,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {renderAiIcon(reviewAiProvider?.id === 'antigravity' ? 'agy' : reviewAiProvider?.id || 'claude', 13)}
                    <span>Revisar com IA</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    writeToActiveTerminal(`"${viewer.path}" `);
                    onToast?.(`Arquivo mencionado no terminal: ${viewer.name}`);
                  }}
                  title="Inserir caminho deste arquivo no terminal ativo"
                  style={{
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 6,
                    border: 'none',
                    boxShadow: 'none',
                    background: isEffectiveDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                    color: themeTokens.textPrimary,
                    fontSize: 11.5,
                    fontWeight: 400,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    transition: 'background 0.15s ease',
                  }}
                >
                  <AtSign size={13} />
                  <span>Mencionar</span>
                </button>

                {viewer.content !== undefined &&
                  viewer.initialContent !== undefined &&
                  viewer.content !== viewer.initialContent && (
                    <button
                      type="button"
                      onClick={() => {
                        const orig = viewer.initialContent ?? '';
                        setViewer((prev) => (prev ? { ...prev, content: orig } : null));
                        if (cliEditorInstanceRef.current && cliEditorInstanceRef.current.getValue() !== orig) {
                          cliEditorInstanceRef.current.setValue(orig);
                        }
                        handleSaveViewerFile(orig, false);
                      }}
                      title="Reverter alterações para o conteúdo original de quando o arquivo foi aberto"
                      style={{
                        height: 28,
                        padding: '0 10px',
                        borderRadius: 6,
                        border: 'none',
                        boxShadow: 'none',
                        background: isEffectiveDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                        color: themeTokens.textSecondary,
                        fontSize: 11.5,
                        fontWeight: 400,
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 6,
                        transition: 'background 0.15s ease',
                      }}
                    >
                      <RotateCcw size={13} />
                      <span>Reverter</span>
                    </button>
                  )}

                {viewer.content !== undefined && !viewer.dataUrl && !viewer.error && viewer.gitStatus !== 'deleted' && (
                  <button
                    type="button"
                    onClick={() => handleSaveViewerFile()}
                    title="Salvar alterações no arquivo (Cmd+S)"
                    style={{
                      height: 28,
                      padding: '0 12px',
                      borderRadius: 6,
                      border: 'none',
                      boxShadow: 'none',
                      background:
                        viewer.content !== viewer.savedContent
                          ? accentColor
                          : isEffectiveDark
                            ? 'rgba(255,255,255,0.07)'
                            : 'rgba(0,0,0,0.05)',
                      color: viewer.content !== viewer.savedContent ? '#ffffff' : themeTokens.textPrimary,
                      fontSize: 11.5,
                      fontWeight: 400,
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
                    }}
                  >
                    <Save size={13} />
                    <span>Salvar</span>
                  </button>
                )}
              </div>
            </div>
            <div style={{ flex: '1 1 0', minHeight: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeTokens.textMuted, fontSize: 12 }}>
              {viewer.error ? (
                <span>{viewer.error}</span>
              ) : viewer.dataUrl ? (
                <img className="df-view-enter" src={viewer.dataUrl} alt={viewer.name} style={{ maxWidth: '90%', maxHeight: '90%', objectFit: 'contain' }} />
              ) : viewer.content === undefined ? (
                <span>Carregando…</span>
              ) : viewer.isDiffMode ? (
                <div style={{ width: '100%', height: '100%' }}>
                  <DiffEditor
                    height="100%"
                    original={viewer.originalHeadContent ?? ''}
                    modified={viewer.content ?? ''}
                    language={getFileLanguage(viewer.name)}
                    theme={isEffectiveDark ? 'cli-viewer-dark' : 'light'}
                    beforeMount={(monaco) => defineAuraDarkTheme(monaco, 'cli-viewer-dark')}
                    onMount={(diffEditor, monaco) => {
                      const modifiedEditor = diffEditor.getModifiedEditor();
                      cliEditorInstanceRef.current = modifiedEditor;
                      const disp = modifiedEditor.onDidChangeModelContent(() => {
                        const nextVal = modifiedEditor.getValue() ?? '';
                        setViewer((prev) => (prev ? { ...prev, content: nextVal } : null));
                      });
                      modifiedEditor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                        handleSaveViewerFile();
                      });
                      return () => disp.dispose();
                    }}
                    options={{
                      readOnly: viewer.gitStatus === 'deleted',
                      renderSideBySide: viewer.isSideBySide ?? true,
                      fontSize: 13,
                      fontFamily: 'JetBrains Mono, Menlo, monospace',
                      minimap: { enabled: false },
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      renderOverviewRuler: false,
                      padding: { top: 8, bottom: 8 },
                    }}
                  />
                </div>
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex' }}>
                  <div style={{ flex: '1 1 0', minWidth: 0, height: '100%' }}>
                  <Editor
                    height="100%"
                    path={viewer.path}
                    language={getFileLanguage(viewer.name)}
                    value={viewer.content}
                    onChange={(val) => {
                      const nextVal = val ?? '';
                      setViewer((prev) => (prev ? { ...prev, content: nextVal } : null));
                    }}
                    theme={isEffectiveDark ? 'cli-viewer-dark' : 'light'}
                    beforeMount={(monaco) => {
                      defineAuraDarkTheme(monaco, 'cli-viewer-dark');
                      setupAutocomplete(monaco);
                    }}
                    onMount={(editor, monaco) => {
                      cliEditorInstanceRef.current = editor;
                      const sync = () => {
                        const pos = editor.getPosition();
                        const model = editor.getModel();
                        setViewerCursor({ line: pos?.lineNumber || 1, col: pos?.column || 1, tabSize: model?.getOptions().tabSize || 2, eol: model?.getEOL() === '\r\n' ? 'CRLF' : 'LF' });
                      };
                      sync();
                      editor.onDidChangeCursorPosition(sync);
                      editor.updateOptions({ readOnly: false, domReadOnly: false });
                      editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                        handleSaveViewerFile();
                      });
                    }}
                    options={{
                      ...AUTOCOMPLETE_OPTIONS,
                      readOnly: false,
                      domReadOnly: false,
                      fontSize: 13,
                      fontFamily: 'JetBrains Mono, Menlo, monospace',
                      minimap: { enabled: false },
                      automaticLayout: true,
                      scrollBeyondLastLine: false,
                      smoothScrolling: true,
                      cursorBlinking: 'smooth',
                      bracketPairColorization: { enabled: true },
                    }}
                  />
                  </div>
                  {mdPreview && isMarkdownFile(viewer.name) && (
                    <div
                      className="df-panel-enter-right"
                      style={{
                        flex: '1 1 0',
                        minWidth: 0,
                        height: '100%',
                        overflowY: 'auto',
                        padding: '16px 20px',
                        textAlign: 'left',
                        borderLeft: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
                        background: themeTokens.bgCard,
                      }}
                    >
                      {renderMarkdownPreview(viewer.content ?? '', {
                        textPrimary: themeTokens.textPrimary,
                        textSecondary: themeTokens.textSecondary,
                        textMuted: themeTokens.textMuted,
                        border: themeTokens.border,
                        accentColor,
                        isEffectiveDark,
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
        {!previewDesignScreen && !viewer && cliDockTab !== 'terminal' && renderDockContent && (
          <div key={cliDockTab} className="df-opacity-enter" style={{ flex: '1 1 0', minHeight: 0, minWidth: 0, display: 'flex', overflow: 'auto', padding: 8, background: isEffectiveDark ? '#0c0c0e' : '#ffffff' }}>
            {renderDockContent(cliDockTab)}
          </div>
        )}
        <div
          ref={gridContainerRef}
          style={{
            flex: '1 1 0',
            width: '100%',
            height: '100%',
            minHeight: 0,
            display: showPrDetail || showActions || previewDesignScreen || viewer || (cliDockTab !== 'terminal' && renderDockContent) ? 'none' : 'flex',
            overflow: 'hidden',
            position: 'relative',
            background: skinActive ? 'transparent' : isEffectiveDark ? '#0c0c0e' : '#ffffff',
          }}
        >
          {/* Maximize banner if a slot is maximized */}
          {maximizedSlotIndex !== null ? (
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div
                style={{
                  padding: '4px 10px',
                  background: hexToRgba(accentColor, 0.12),
                  borderBottom: `1px solid ${hexToRgba(accentColor, 0.25)}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  fontSize: 11,
                  color: accentColor,
                  fontWeight: 500,
                  flexShrink: 0,
                }}
              >
                <span>Terminal maximizado (Quadrante {maximizedSlotIndex + 1})</span>
                <button
                  type="button"
                  onClick={() => setMaximizedSlotIndex(null)}
                  style={{
                    background: accentColor,
                    color: getContrastTextColor(accentColor),
                    border: 'none',
                    borderRadius: 4,
                    padding: '2px 8px',
                    fontSize: 10.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  <Minimize2 size={11} />
                  <span>Restaurar Grid</span>
                </button>
              </div>
              <div style={{ flex: '1 1 0', width: '100%', height: '100%', minHeight: 0 }}>
                {renderTerminalSlot(maximizedSlotIndex, effectiveSlots[maximizedSlotIndex] || activeSessionId)}
              </div>
            </div>
          ) : gridMode === '2x2' ? (
            /* 4 Terminals (Grid 2x2) */
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              {/* Top Row: Q1 and Q2 */}
              <div style={{ height: `${splitY}%`, width: '100%', display: 'flex', flexDirection: 'row', minHeight: 0 }}>
                <div style={{ width: `${splitX}%`, height: '100%', minWidth: 0 }}>
                  {renderTerminalSlot(0, effectiveSlots[0])}
                </div>
                <div
                  className={`resizer-col ${isDraggingSplitX ? 'dragging' : ''}`}
                  onMouseDown={handleStartResizeSplitX}
                  onDoubleClick={() => setSplitX(50)}
                  title="Arraste para redimensionar colunas (Duplo clique para 50%)"
                />
                <div style={{ flex: '1 1 0', height: '100%', minWidth: 0 }}>
                  {renderTerminalSlot(1, effectiveSlots[1])}
                </div>
              </div>

              {/* Horizontal Resizer between rows */}
              <div
                className={`resizer-row ${isDraggingSplitY ? 'dragging' : ''}`}
                onMouseDown={handleStartResizeSplitY}
                onDoubleClick={() => setSplitY(50)}
                title="Arraste para redimensionar linhas (Duplo clique para 50%)"
              />

              {/* Bottom Row: Q3 and Q4 */}
              <div style={{ flex: '1 1 0', width: '100%', display: 'flex', flexDirection: 'row', minHeight: 0 }}>
                <div style={{ width: `${splitX}%`, height: '100%', minWidth: 0 }}>
                  {renderTerminalSlot(2, effectiveSlots[2])}
                </div>
                <div
                  className={`resizer-col ${isDraggingSplitX ? 'dragging' : ''}`}
                  onMouseDown={handleStartResizeSplitX}
                  onDoubleClick={() => setSplitX(50)}
                  title="Arraste para redimensionar colunas (Duplo clique para 50%)"
                />
                <div style={{ flex: '1 1 0', height: '100%', minWidth: 0 }}>
                  {renderTerminalSlot(3, effectiveSlots[3])}
                </div>
              </div>
            </div>
          ) : gridMode === '3' ? (
            /* 3 Terminals (2 on top, 1 on bottom) */
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: `${splitY}%`, width: '100%', display: 'flex', flexDirection: 'row', minHeight: 0 }}>
                <div style={{ width: `${splitX}%`, height: '100%', minWidth: 0 }}>
                  {renderTerminalSlot(0, effectiveSlots[0])}
                </div>
                <div
                  className={`resizer-col ${isDraggingSplitX ? 'dragging' : ''}`}
                  onMouseDown={handleStartResizeSplitX}
                  onDoubleClick={() => setSplitX(50)}
                  title="Arraste para redimensionar colunas (Duplo clique para 50%)"
                />
                <div style={{ flex: '1 1 0', height: '100%', minWidth: 0 }}>
                  {renderTerminalSlot(1, effectiveSlots[1])}
                </div>
              </div>

              <div
                className={`resizer-row ${isDraggingSplitY ? 'dragging' : ''}`}
                onMouseDown={handleStartResizeSplitY}
                onDoubleClick={() => setSplitY(50)}
                title="Arraste para redimensionar linhas (Duplo clique para 50%)"
              />

              <div style={{ flex: '1 1 0', width: '100%', minHeight: 0 }}>
                {renderTerminalSlot(2, effectiveSlots[2])}
              </div>
            </div>
          ) : gridMode === '1x3' ? (
            /* 3 Terminals (Side-by-Side) */
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
              {[0, 1, 2].map((i) => (
                <React.Fragment key={i}>
                  {i > 0 && <div className="resizer-col" style={{ pointerEvents: 'none' }} />}
                  <div style={{ flex: '1 1 0', height: '100%', minWidth: 0 }}>
                    {renderTerminalSlot(i, effectiveSlots[i])}
                  </div>
                </React.Fragment>
              ))}
            </div>
          ) : gridMode === '2x1' ? (
            /* 2 Terminals (Vertical Stack) */
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
              <div style={{ height: `${splitY}%`, width: '100%', minHeight: 0 }}>
                {renderTerminalSlot(0, effectiveSlots[0])}
              </div>
              <div
                className={`resizer-row ${isDraggingSplitY ? 'dragging' : ''}`}
                onMouseDown={handleStartResizeSplitY}
                onDoubleClick={() => setSplitY(50)}
                title="Arraste para redimensionar linhas (Duplo clique para 50%)"
              />
              <div style={{ flex: '1 1 0', width: '100%', minHeight: 0 }}>
                {renderTerminalSlot(1, effectiveSlots[1])}
              </div>
            </div>
          ) : gridMode === '1x2' ? (
            /* 2 Terminals (Horizontal Side-by-Side) */
            <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'row' }}>
              <div style={{ width: `${splitX}%`, height: '100%', minWidth: 0 }}>
                {renderTerminalSlot(0, effectiveSlots[0])}
              </div>
              <div
                className={`resizer-col ${isDraggingSplitX ? 'dragging' : ''}`}
                onMouseDown={handleStartResizeSplitX}
                onDoubleClick={() => setSplitX(50)}
                title="Arraste para redimensionar colunas (Duplo clique para 50%)"
              />
              <div style={{ flex: '1 1 0', height: '100%', minWidth: 0 }}>
                {renderTerminalSlot(1, effectiveSlots[1])}
              </div>
            </div>
          ) : (
            /* 1 Terminal (Full Screen) */
            <div style={{ width: '100%', height: '100%' }}>
              {renderTerminalSlot(0, activeSessionId || terminalSessions[0]?.id)}
            </div>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4. FILE CONTEXT MENU                                                */}
      {/* =================================================================== */}
      {fileContextMenu && (() => {
        const node = fileContextMenu.node;
        const isDir = node.isDirectory;
        const close = () => setFileContextMenu(null);
        type Entry = { divider: true } | { divider: false; icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean; disabled?: boolean };
        const item = (icon: React.ReactNode, label: string, onClick: () => void, opts?: { danger?: boolean; disabled?: boolean }): Entry => ({ divider: false, icon, label, onClick, ...opts });
        const divider: Entry = { divider: true };
        const targetDir = isDir ? node.path : parentDirOf(node.path);
        const exec = (cmd: string) => window.electronAPI?.shell?.exec?.(cmd);
        const entries: Entry[] = [];
        if (!isDir) {
          entries.push(item(<FileText size={13} />, 'Editar no CLI', () => openViewer(node.path, node.name)));
          entries.push(item(<ExternalLink size={13} />, 'Abrir no Editor (IDE)', () => onOpenFile?.(node.path, node.name)));
          entries.push(item(<ExternalLink size={13} />, 'Abrir com o Aplicativo Padrão', () => { exec(`open "${node.path}"`); }));
        }
        entries.push(item(<FolderOpen size={13} />, 'Revelar no Finder', () => {
          if (window.electronAPI?.shell?.showItemInFolder) window.electronAPI.shell.showItemInFolder(node.path);
          else exec(`open -R "${node.path}"`);
        }));
        entries.push(isDir
          ? item(<CornerDownRight size={13} />, 'cd para esta Pasta no Terminal', () => { writeToActiveTerminal(`cd "${node.path}"\r`); onToast?.(`cd ${node.name}`); })
          : item(<ArrowRight size={13} />, 'Inserir Caminho no Terminal', () => writeToActiveTerminal(`"${node.path}" `)));
        entries.push(divider);
        entries.push(item(<Scissors size={13} />, 'Recortar', () => { setFileClipboard({ path: node.path, mode: 'cut' }); onToast?.(`"${node.name}" recortado`); }));
        entries.push(item(<Copy size={13} />, 'Copiar', () => { setFileClipboard({ path: node.path, mode: 'copy' }); onToast?.(`"${node.name}" copiado`); }));
        entries.push(item(<ClipboardPaste size={13} />, 'Colar', () => pasteIntoNode(node), { disabled: !fileClipboard }));
        entries.push(divider);
        entries.push(item(<FileText size={13} />, 'Copiar Caminho', () => { navigator.clipboard.writeText(node.path); onToast?.('Caminho absoluto copiado!'); }));
        entries.push(item(<FileText size={13} />, 'Copiar Caminho Relativo', () => {
          navigator.clipboard.writeText(node.path.replace(workspacePath, '').replace(/^\//, ''));
          onToast?.('Caminho relativo copiado!');
        }));
        entries.push(divider);
        entries.push(item(<FilePlus size={13} />, 'Novo Arquivo...', () => startCreating(false, targetDir)));
        entries.push(item(<FolderPlus size={13} />, 'Nova Pasta...', () => startCreating(true, targetDir)));
        entries.push(divider);
        entries.push(item(<Pencil size={13} />, 'Renomear...', () => setRenaming({ path: node.path, name: node.name })));
        entries.push(item(<Trash2 size={13} />, 'Excluir', () => setDeleteTarget(node), { danger: true }));
        const divColor = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
        return (
          <div
            className="df-dropdown-menu"
            data-file-ctx-menu
            onClick={(e) => e.stopPropagation()}
            onContextMenu={(e) => e.preventDefault()}
            style={{
              position: 'fixed',
              left: Math.min(fileContextMenu.x, window.innerWidth - 240),
              top: Math.min(fileContextMenu.y, Math.max(8, window.innerHeight - entries.length * 30 - 16)),
              minWidth: 220,
              background: getFieldTokens(isEffectiveDark).dropdownMenuBg,
              border: getFieldTokens(isEffectiveDark).dropdownBorder,
              boxShadow: 'none',
              borderRadius: 8,
              padding: '4px 0',
              zIndex: 99999,
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {entries.map((entry, idx) =>
              !('label' in entry) ? (
                <div key={idx} style={{ height: 1, margin: '4px 0', background: divColor }} />
              ) : (
                <div
                  key={idx}
                  className={entry.disabled ? undefined : 'df-row-interactive'}
                  onClick={() => {
                    if (entry.disabled) return;
                    close();
                    entry.onClick();
                  }}
                  style={{
                    padding: '6px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12,
                    cursor: entry.disabled ? 'default' : 'pointer',
                    color: entry.disabled ? themeTokens.textMuted : entry.danger ? '#ef4444' : themeTokens.textPrimary,
                    opacity: entry.disabled ? 0.5 : 1,
                  }}
                  onMouseEnter={(e) => { if (!entry.disabled) e.currentTarget.style.background = themeTokens.hoverBg; }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <span style={{ display: 'flex', alignItems: 'center', color: entry.danger ? '#ef4444' : accentColor }}>{entry.icon}</span>
                  <span>{entry.label}</span>
                </div>
              )
            )}
          </div>
        );
      })()}

      <ConfirmDeleteModal
        isOpen={deleteTarget !== null}
        title={deleteTarget?.isDirectory ? 'Excluir Pasta' : 'Excluir Arquivo'}
        message={`Deseja excluir "${deleteTarget?.name}"? Esta ação não pode ser desfeita.`}
        itemDescription={deleteTarget?.path || ''}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        isDeleting={isDeletingItem}
        iconType="trash"
        themeTokens={themeTokens}
        accentColor={accentColor}
        onConfirm={confirmDeleteItem}
        onClose={() => setDeleteTarget(null)}
      />

      {/* Modal de Confirmação: Fechar Todos os Terminais */}
      <ConfirmDeleteModal
        isOpen={isConfirmCloseAllOpen}
        title="Fechar Todos os Terminais"
        message="Tem certeza que deseja encerrar todos os processos e fechar todos os terminais e áreas de trabalho abertas?"
        itemDescription={`${terminalSessions.length} terminal(is) e ${workspaces.length} área(s) de trabalho serão encerrados. Um novo terminal limpo será iniciado.`}
        confirmLabel="Fechar Todos"
        cancelLabel="Cancelar"
        isDeleting={isClosingAll}
        iconType="trash"
        themeTokens={themeTokens}
        accentColor={accentColor}
        onConfirm={handleConfirmCloseAllTerminals}
        onClose={() => setIsConfirmCloseAllOpen(false)}
      />

      {/* Modal de Confirmação: Fechar Área de Trabalho */}
      <ConfirmDeleteModal
        isOpen={workspaceToClose !== null}
        title="Fechar Área de Trabalho"
        message={`Deseja fechar a área de trabalho "${workspaceToClose?.name}"?`}
        itemDescription={`Esta área possui ${workspaceToClose?.slotSessionIds?.length || 1} terminal(is) configurado(s). Todos os processos em execução nesta área serão encerrados.`}
        confirmLabel="Fechar Área"
        cancelLabel="Cancelar"
        isDeleting={isClosingWorkspace}
        iconType="warning"
        themeTokens={themeTokens}
        accentColor={accentColor}
        onConfirm={() => handleConfirmCloseSingleWorkspace()}
        onDontAskAgain={() => {
          try {
            localStorage.setItem('aura_cli_skip_close_ws', '1');
          } catch {}
        }}
        onClose={() => setWorkspaceToClose(null)}
      />
      {[...slotTerms].map(([id, node]) => createPortal(node, getTermHost(id), id))}
      {skinActive && (
        <div aria-hidden style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
          <TerminalSkinOverlay skin={skinId} region="screen" />
        </div>
      )}
    </div>
  );
};
