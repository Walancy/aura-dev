import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import {
  SquareTerminal,
  Terminal as TerminalIcon,
  Plus,
  X,
  ChevronRight,
  ChevronDown,
  FolderPlus,
  FilePlus,
  RefreshCw,
  FolderOpen,
  FileText,
  MoreHorizontal,
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
  ArrowRight,
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
} from 'lucide-react';
import { FileIcon, FolderIcon } from './FileIcon';
import { NativeXTerm } from './NativeXTerm';
import { ConfirmDeleteModal } from './modals/ConfirmDeleteModal';
import { SidebarPanels } from './ide/SidebarPanels';
import type { ExplorerNode, TerminalSessionItem, ThemeTokens, GitHubIssueItem } from '../types/ide';
import { ClaudeIcon, AntigravityIcon, GeminiIcon, OllamaIcon, CodexIcon } from './icons/AiProviderIcons';
import { hexToRgba } from '../utils/color';
import { logSystemActivity } from '../utils/brainService';
import { AI_BRAND_COLORS } from '../constants/ai';

export interface TerminalWorkspace {
  id: string;
  name: string;
  gridMode: '1x1' | '1x2' | '2x1' | '3' | '2x2';
  slotSessionIds: string[];
  slotTypes?: string[];
  focusedSlotIndex: number;
  splitX: number;
  splitY: number;
  maximizedSlotIndex: number | null;
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
  onOpenBranchModal?: () => void;
  onOpenIssuesModal?: () => void;
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
  onSetTerminalFontSize,
  currentBranch,
  gitRepoName = 'Walancy/aura-dev',
  onToast,
  installedClis,
  onOpenBranchModal,
  onOpenIssuesModal,
  onOpenIssueDetails,
  gitIssues = [],
  refreshGitHubIssues,
  onSyncGit,
  isSyncingGit = false,
  gitModifiedCount = 0,
  onGenerateCommitMessage,
  onStartReview,
}) => {
  // Left sidebar tabs: 'files' | 'git' | 'issues'
  const [sidebarTab, setSidebarTab] = useState<'files' | 'git' | 'issues'>('files');

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
    try { return Math.max(180, Math.min(800, Number(localStorage.getItem('cli_explorer_width')) || 270)); } catch { return 270; }
  });
  const [isExplorerCollapsed, setIsExplorerCollapsed] = useState<boolean>(false);
  const [isDraggingExplorer, setIsDraggingExplorer] = useState<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartWidthRef = useRef<number>(270);

  // Explorer search filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [explorerMenuOpen, setExplorerMenuOpen] = useState<boolean>(false);

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
    try { localStorage.setItem('cli_explorer_width', String(explorerWidth)); } catch {}
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
      activeWorkspace.gridMode === '2x2' ? 3 : activeWorkspace.gridMode === '3' ? 2 : activeWorkspace.gridMode === '1x1' ? 0 : 1;
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
      return [activeWorkspace.slotSessionIds[0] || activeSessionId || terminalSessions[0]?.id].filter(Boolean);
    }
    const needed = mode === '2x2' ? 4 : mode === '3' ? 3 : 2;
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

  // Ensure enough distinct sessions exist for current multi-terminal grid mode
  useEffect(() => {
    if (!activeWorkspace || activeWorkspace.gridMode === '1x1') return;
    const needed = activeWorkspace.gridMode === '2x2' ? 4 : activeWorkspace.gridMode === '3' ? 3 : 2;
    const currentSlots = activeWorkspace.slotSessionIds.filter((id) =>
      terminalSessions.some((s) => s.id === id)
    );
    if (currentSlots.length < needed) {
      const missing = needed - currentSlots.length;
      const newSlots = [...currentSlots];
      for (let i = 0; i < missing; i++) {
        const pName = `Terminal ${terminalSessions.length + i + 1}`;
        const newId = onNewSession('zsh', pName);
        if (typeof newId === 'string' && !newSlots.includes(newId)) {
          newSlots.push(newId);
        }
      }
      updateActiveWorkspace((w) => ({ ...w, slotSessionIds: newSlots }));
    }
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
  const applyGridMode = (mode: '1x1' | '1x2' | '2x1' | '3' | '2x2') => {
    setLayoutMenuOpen(false);
    if (!activeWorkspace) return;

    const needed = mode === '2x2' ? 4 : mode === '3' ? 3 : mode === '1x1' ? 1 : 2;
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
    mode: '1x1' | '1x2' | '2x1' | '3' | '2x2' = '1x1',
    initialType: string = 'zsh',
    initialName?: string,
    initialCmd?: string
  ) => {
    const wsId = `ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const needed = mode === '2x2' ? 4 : mode === '3' ? 3 : mode === '1x1' ? 1 : 2;
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
  };

  // Solicitar fechamento de área de trabalho (abre modal estilizado)
  const handleRequestCloseWorkspace = (ws: TerminalWorkspace, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setWorkspaceToClose(ws);
  };

  // Confirmar fechamento de uma única área de trabalho
  const handleConfirmCloseSingleWorkspace = async () => {
    if (!workspaceToClose) return;
    setIsClosingWorkspace(true);
    try {
      const ws = workspaceToClose;
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
    } else if (mode === '3') {
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
  };

  // Close context menus & dropdowns on outside click/mousedown
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (fileContextMenu) setFileContextMenu(null);
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
  const handleSessionTitleChange = useCallback(
    (sessionId: string, newTitle: string) => {
      if (!newTitle) return;
      const lower = newTitle.toLowerCase();
      let detectedType: string | undefined;
      if (lower.includes('claude')) detectedType = 'claude';
      else if (lower.includes('antigravity') || lower.includes('agy')) detectedType = 'antigravity';
      else if (lower.includes('gemini')) detectedType = 'gemini';
      else if (lower.includes('codex')) detectedType = 'codex';
      else if (lower.includes('ollama')) detectedType = 'ollama';

      if (detectedType) {
        setTerminalSessions((prev) =>
          prev.map((s) => (s.id === sessionId ? { ...s, type: detectedType, name: newTitle } : s))
        );
      }
    },
    [setTerminalSessions]
  );

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

  // Cor de destaque da IA ativa (baseada na IA selecionada no IDE ou na sessão ativa da área de trabalho)
  const effectiveAiColor = useMemo(() => {
    if (activeWorkspace) {
      const activeSession = terminalSessions.find(
        (s) => s.id === (activeWorkspace.slotSessionIds?.[activeWorkspace.focusedSlotIndex ?? 0] || activeSessionId)
      );
      const slotType = getSlotAiType(activeWorkspace, activeWorkspace.focusedSlotIndex ?? 0, activeSession);
      const normalizedSlotType = slotType === 'agy' ? 'antigravity' : slotType?.toLowerCase();
      if (normalizedSlotType && normalizedSlotType !== 'zsh' && AI_BRAND_COLORS[normalizedSlotType]) {
        return AI_BRAND_COLORS[normalizedSlotType];
      }
    }
    const normalizedSelected = selectedAiProvider === 'agy' ? 'antigravity' : selectedAiProvider?.toLowerCase();
    if (normalizedSelected && AI_BRAND_COLORS[normalizedSelected]) {
      return AI_BRAND_COLORS[normalizedSelected];
    }
    return accentColor;
  }, [activeWorkspace, activeSessionId, terminalSessions, selectedAiProvider, accentColor]);

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
        color={session.id === activeSessionId ? effectiveAiColor : themeTokens.textSecondary}
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
    return <SquareTerminal size={size} color={effectiveAiColor} />;
  };

  // Renderiza o(s) ícone(s) da área de trabalho na aba:
  // Se for tela única (1x1), exibe o ícone da IA ou CLI em execução.
  // Se for um grid (1x2, 2x1, 3, 2x2), exibe os ícones empilhados (stacked) em cascata!
  const renderWorkspaceTabIcons = (ws: TerminalWorkspace, isActive: boolean) => {
    const needed = ws.gridMode === '2x2' ? 4 : ws.gridMode === '3' ? 3 : ws.gridMode === '1x1' ? 1 : 2;
    const slotItems: { type: string; name: string }[] = [];

    for (let i = 0; i < needed; i++) {
      const sid = ws.slotSessionIds?.[i];
      const session = terminalSessions.find((s) => s.id === sid);
      const slotType = getSlotAiType(ws, i, session);
      const slotName =
        session?.name || (slotType !== 'zsh' ? `${slotType.toUpperCase()} CLI` : `Terminal ${i + 1}`);
      slotItems.push({ type: slotType, name: slotName });
    }

    // Tela única (1x1) ou apenas 1 terminal: exibe ícone individual limpo
    if (ws.gridMode === '1x1' || slotItems.length <= 1) {
      const item = slotItems[0] || { type: 'zsh', name: 'Terminal' };
      return (
        <div
          title={item.name}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
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
              background: isEffectiveDark ? '#1a1a1a' : '#f0f0f0',
              border: `1.5px solid ${
                isActive
                  ? (isEffectiveDark ? '#262626' : '#ffffff')
                  : (isEffectiveDark ? '#161616' : '#e4e4e7')
              }`,
              boxShadow: '0 1px 2px rgba(0, 0, 0, 0.25)',
              transition: 'transform 0.12s ease',
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
              color: '#ffffff',
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

    return (
      <div
        key={`slot-${activeWorkspace?.id || 'ws'}-${slotIndex}-${session.id}`}
        onClick={() => handleFocusSlot(slotIndex, session.id)}
        onMouseDown={() => handleFocusSlot(slotIndex, session.id)}
        style={{
          width: '100%',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: themeTokens.bgCard,
          borderRadius: activeWorkspace?.gridMode === '1x1' ? 0 : 6,
          border: activeWorkspace?.gridMode === '1x1' ? 'none' : `1px solid ${themeTokens.border}`,
          boxShadow: 'none',
          position: 'relative',
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          handleFocusSlot(slotIndex, session.id);
          const filePath = e.dataTransfer.getData('text/plain');
          if (filePath) {
            writeToSession(session.id, `"${filePath}" `);
            if (onToast) onToast(`Caminho colado: ${filePath.split('/').pop()}`);
          }
        }}
      >
        {/* Quadrant Mini Header (height: 27px) - shown in multi-terminal layouts */}
        {activeWorkspace?.gridMode !== '1x1' && (
          <div
            onClick={() => handleFocusSlot(slotIndex, session.id)}
            onMouseDown={() => handleFocusSlot(slotIndex, session.id)}
            style={{
              height: 27,
              padding: '0 8px',
              background: isSlotActive
                ? (isEffectiveDark ? '#202020' : '#eaeaea')
                : (isEffectiveDark ? '#141416' : '#f5f5f5'),
              borderBottom: `1px solid ${themeTokens.border}`,
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
                style={{
                  fontSize: 9,
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: 4,
                  background: isSlotActive ? effectiveAiColor : (isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                  color: isSlotActive ? '#ffffff' : themeTokens.textMuted,
                  letterSpacing: '0.5px',
                  flexShrink: 0,
                  transition: 'all 0.12s ease',
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
                  color: isSlotActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  maxWidth: 120,
                }}
              >
                {session.name}
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
                    color: themeTokens.textMuted,
                    padding: '2px 4px',
                    borderRadius: 3,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textMuted)}
                >
                  <ChevronDown size={11} />
                </button>

                {/* Session Switcher Dropdown for this slot */}
                {activeSlotMenuIndex === slotIndex && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      left: 0,
                      width: 180,
                      background: isEffectiveDark ? '#1f1f1f' : '#ffffff',
                      border: `1px solid ${themeTokens.border}`,
                      borderRadius: 6,
                      padding: '4px 0',
                      boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                      zIndex: 9999,
                      display: 'flex',
                      flexDirection: 'column',
                    }}
                  >
                    <div style={{ padding: '3px 8px', fontSize: 10, fontWeight: 600, color: themeTokens.textMuted, textTransform: 'uppercase' }}>
                      Selecionar Terminal
                    </div>
                    {terminalSessions.map((s) => (
                      <div
                        key={s.id}
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
                          color: s.id === session.id ? accentColor : themeTokens.textPrimary,
                          background: s.id === session.id ? hexToRgba(accentColor, 0.1) : 'transparent',
                        }}
                        onMouseEnter={(e) => {
                          if (s.id !== session.id) e.currentTarget.style.background = themeTokens.hoverBg;
                        }}
                        onMouseLeave={(e) => {
                          if (s.id !== session.id) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {getSessionIcon(s, 13)}
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {s.name}
                        </span>
                      </div>
                    ))}

                    <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />

                    <div style={{ padding: '3px 8px', fontSize: 10, fontWeight: 700, color: themeTokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
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
                          color: themeTokens.textPrimary,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
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

            {/* Right: Actions (Clear, Maximize/Restore, Close Split) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              {/* Clear this slot */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  writeToSession(session.id, 'clear\r');
                }}
                title="Limpar este terminal"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: themeTokens.textMuted,
                  padding: '2px 4px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textMuted)}
              >
                <Trash2 size={11} />
              </button>

              {/* Maximize / Restore this slot */}
              <button
                type="button"
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
                  color: themeTokens.textMuted,
                  padding: '2px 4px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textMuted)}
              >
                {activeWorkspace?.maximizedSlotIndex === slotIndex ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
              </button>

              {/* Close this split slot */}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleCloseSplitSlot(slotIndex);
                }}
                title="Fechar divisão deste painel"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: themeTokens.textMuted,
                  padding: '2px 4px',
                  borderRadius: 3,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textMuted)}
              >
                <X size={11} />
              </button>
            </div>
          </div>
        )}

        {/* Mentioned Issue Tag in Terminal Slot */}
        {(() => {
          const slotMentionedIssues = sessionMentionedIssues[session.id] || [];
          if (slotMentionedIssues.length === 0) return null;

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
                <AtSign size={10} color={effectiveAiColor} />
                <span>Issue:</span>
              </div>
              {slotMentionedIssues.map((mIssue) => {
                const isIssueOpen = (mIssue.state || 'open').toLowerCase() === 'open' && !mIssue.closed_at;
                return (
                  <div
                    key={mIssue.number}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      background: isEffectiveDark
                        ? (isIssueOpen ? 'rgba(34, 197, 94, 0.12)' : 'rgba(168, 85, 247, 0.12)')
                        : (isIssueOpen ? 'rgba(34, 197, 94, 0.1)' : 'rgba(168, 85, 247, 0.1)'),
                      borderRadius: 4,
                      padding: '2px 6px',
                      fontSize: 10.5,
                      color: isIssueOpen ? '#22c55e' : '#a855f7',
                      userSelect: 'none',
                      border: 'none',
                      boxShadow: 'none',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                      maxWidth: 240,
                    }}
                    onClick={() => onOpenIssuesModal?.()}
                    title={`#${mIssue.number}: ${mIssue.title} (Clique para abrir detalhes)`}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isEffectiveDark
                        ? (isIssueOpen ? 'rgba(34, 197, 94, 0.2)' : 'rgba(168, 85, 247, 0.2)')
                        : (isIssueOpen ? 'rgba(34, 197, 94, 0.16)' : 'rgba(168, 85, 247, 0.16)');
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isEffectiveDark
                        ? (isIssueOpen ? 'rgba(34, 197, 94, 0.12)' : 'rgba(168, 85, 247, 0.12)')
                        : (isIssueOpen ? 'rgba(34, 197, 94, 0.1)' : 'rgba(168, 85, 247, 0.1)');
                    }}
                  >
                    {isIssueOpen ? (
                      <CircleDot size={10} color="#22c55e" style={{ flexShrink: 0 }} />
                    ) : (
                      <CheckCircle2 size={10} color="#a855f7" style={{ flexShrink: 0 }} />
                    )}
                    <span style={{ fontWeight: 500, flexShrink: 0 }}>#{mIssue.number}</span>
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        fontWeight: 400,
                        color: themeTokens.textPrimary,
                        flex: '1 1 auto',
                        minWidth: 0,
                      }}
                    >
                      {mIssue.title}
                    </span>

                    {/* Insert reference into terminal */}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.electronAPI?.pty?.write) {
                          window.electronAPI.pty.write(session.id, `#${mIssue.number} `);
                          onToast?.(`Referência #${mIssue.number} inserida no terminal`);
                        }
                      }}
                      title="Inserir texto da issue no terminal"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: themeTokens.textSecondary,
                        cursor: 'pointer',
                        padding: 1,
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: 2,
                        transition: 'color 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
                    >
                      <SquareTerminal size={10} />
                    </button>

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
              })}
            </div>
          );
        })()}

        {/* Terminal Canvas */}
        <div
          onMouseDown={() => handleFocusSlot(slotIndex, session.id)}
          style={{ flex: '1 1 0', width: '100%', height: '100%', minHeight: 0, overflow: 'hidden' }}
        >
          <NativeXTerm
            sessionId={session.id}
            sessionType={session.type}
            cwd={workspacePath || ''}
            isActive={isSlotActive}
            alwaysVisible={true}
            initialCommand={session.initialCommand}
            accentColor={accentColor}
            isDark={isEffectiveDark}
            fontSize={terminalFontSize}
            onFocus={() => handleFocusSlot(slotIndex, session.id)}
            onTitleChange={(title) => handleSessionTitleChange(session.id, title)}
          />
        </div>
      </div>
    );
  };

  return (
    <div
      style={{
        alignSelf: 'stretch',
        width: '100%',
        height: '100%',
        minHeight: 0,
        flex: '1 1 0',
        display: 'flex',
        flexDirection: 'row',
        overflow: 'hidden',
        background: themeTokens.bgApp,
        gap: 0,
        padding: 0,
        boxSizing: 'border-box',
        position: 'relative',
      }}
    >
      {/* =================================================================== */}
      {/* 1. LEFT PANE: NAVEGAÇÃO DE ARQUIVOS (EXPLORER)                      */}
      {/* =================================================================== */}
      {!isExplorerCollapsed && (
        <div
          style={{
            width: explorerWidth,
            height: '100%',
            minHeight: 0,
            background: themeTokens.bgCard,
            borderRadius: 10,
            border: `1px solid ${themeTokens.border}`,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            flexShrink: 0,
            transition: isDraggingExplorer ? 'none' : 'width 0.1s ease',
            position: 'relative',
          }}
        >
          {/* Header Segment Switcher: Arquivos | Git | Issues */}
          <div
            style={{
              padding: '6px 8px',
              borderBottom: `1px solid ${themeTokens.border}`,
              background: isEffectiveDark ? '#141416' : '#f8f8f8',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              flexShrink: 0,
            }}
          >
            {/* Tab: Arquivos */}
            <button
              type="button"
              onClick={() => setSidebarTab('files')}
              title="Explorador de Arquivos"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '5px 6px',
                fontSize: 11,
                fontWeight: sidebarTab === 'files' ? 600 : 500,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: sidebarTab === 'files' ? (isEffectiveDark ? '#232323' : '#ffffff') : 'transparent',
                color: sidebarTab === 'files' ? themeTokens.textPrimary : themeTokens.textSecondary,
                boxShadow: sidebarTab === 'files' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <FolderOpen size={13} color={sidebarTab === 'files' ? accentColor : themeTokens.textSecondary} />
              <span>Arquivos</span>
            </button>

            {/* Tab: Git */}
            <button
              type="button"
              onClick={() => setSidebarTab('git')}
              title="Controle de Versão (Git)"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '5px 6px',
                fontSize: 11,
                fontWeight: sidebarTab === 'git' ? 600 : 500,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: sidebarTab === 'git' ? (isEffectiveDark ? '#232323' : '#ffffff') : 'transparent',
                color: sidebarTab === 'git' ? themeTokens.textPrimary : themeTokens.textSecondary,
                boxShadow: sidebarTab === 'git' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <GitBranch size={13} color={sidebarTab === 'git' ? accentColor : themeTokens.textSecondary} />
              <span>Git</span>
              {(gitModifiedCount ?? 0) > 0 && (
                <span
                  style={{
                    minWidth: 15,
                    height: 15,
                    borderRadius: 8,
                    background: accentColor,
                    color: '#ffffff',
                    fontSize: 9,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    lineHeight: 1,
                  }}
                >
                  {(gitModifiedCount ?? 0) > 99 ? '99+' : gitModifiedCount}
                </span>
              )}
            </button>

            {/* Tab: Issues */}
            <button
              type="button"
              onClick={() => setSidebarTab('issues')}
              title="Issues do GitHub"
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                padding: '5px 6px',
                fontSize: 11,
                fontWeight: sidebarTab === 'issues' ? 600 : 500,
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                background: sidebarTab === 'issues' ? (isEffectiveDark ? '#232323' : '#ffffff') : 'transparent',
                color: sidebarTab === 'issues' ? themeTokens.textPrimary : themeTokens.textSecondary,
                boxShadow: sidebarTab === 'issues' ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
                transition: 'all 0.15s ease',
              }}
            >
              <CircleDot size={13} color={sidebarTab === 'issues' ? '#22c55e' : themeTokens.textSecondary} />
              <span>Issues</span>
              {openIssuesCount > 0 && (
                <span
                  style={{
                    minWidth: 15,
                    height: 15,
                    borderRadius: 8,
                    background: '#22c55e',
                    color: '#ffffff',
                    fontSize: 9,
                    fontWeight: 700,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '0 3px',
                    lineHeight: 1,
                  }}
                >
                  {openIssuesCount > 99 ? '99+' : openIssuesCount}
                </span>
              )}
            </button>
          </div>

          {/* ========================================================= */}
          {/* TAB 1: FILES EXPLORER                                    */}
          {/* ========================================================= */}
          {sidebarTab === 'files' && (
            <>
              {/* Header do Explorador */}
          <div
            style={{
              padding: '10px 12px',
              borderBottom: `1px solid ${themeTokens.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: themeTokens.textPrimary, whiteSpace: 'nowrap' }}>
                Explorer
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: themeTokens.textMuted,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                ({workspacePath.split('/').pop() || 'Workspace'})
              </span>
            </div>

            {/* Quick Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              {/* Search Toggle */}
              <button
                type="button"
                onClick={() => setIsSearchOpen((prev) => !prev)}
                title="Filtrar arquivos"
                style={{
                  background: isSearchOpen ? `${accentColor}22` : 'transparent',
                  border: 'none',
                  color: isSearchOpen ? accentColor : themeTokens.textSecondary,
                  padding: 4,
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <Search size={14} />
              </button>

              {/* Novo Arquivo */}
              <button
                type="button"
                onClick={onCreateNewFile}
                title="Novo Arquivo"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: themeTokens.textSecondary,
                  padding: 4,
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <FilePlus size={14} />
              </button>

              {/* Nova Pasta */}
              <button
                type="button"
                onClick={onCreateNewFolder}
                title="Nova Pasta"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: themeTokens.textSecondary,
                  padding: 4,
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <FolderPlus size={14} />
              </button>

              {/* Atualizar */}
              <button
                type="button"
                onClick={onRefreshTree}
                title="Atualizar Explorador"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: themeTokens.textSecondary,
                  padding: 4,
                  borderRadius: 4,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <RefreshCw size={13} />
              </button>
            </div>
          </div>

          {/* Search Filter Input (expandable) */}
          {isSearchOpen && (
            <div
              style={{
                padding: '6px 10px',
                borderBottom: `1px solid ${themeTokens.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: isEffectiveDark ? '#161616' : '#f8f8f8',
              }}
            >
              <Search size={12} color={themeTokens.textSecondary} />
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
                  color: themeTokens.textPrimary,
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
                    color: themeTokens.textSecondary,
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
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '6px 4px',
              display: 'flex',
              flexDirection: 'column',
              gap: 1,
            }}
          >
            {filteredTree.length === 0 ? (
              <div
                style={{
                  padding: '24px 12px',
                  textAlign: 'center',
                  fontSize: 11.5,
                  color: themeTokens.textMuted,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                <FolderOpen size={24} strokeWidth={1.5} color={themeTokens.textMuted} />
                <span>Nenhum arquivo encontrado</span>
              </div>
            ) : (
              filteredTree.map((node) => {
                const renderTreeItem = (item: ExplorerNode, depth = 0): React.ReactNode => {
                  const isExpanded = expandedFolders.has(item.path);
                  const isDir = item.isDirectory;
                  const isFileActive = activeFileId === item.path;

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
                          e.dataTransfer.setData('text/plain', item.path);
                          e.dataTransfer.effectAllowed = 'copy';
                        }}
                        onClick={() => {
                          if (isDir) {
                            onToggleFolder(item.path);
                          } else {
                            onOpenFile?.(item.path, item.name);
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
                          paddingLeft: depth * 12 + 4,
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
                          transition: 'background 0.1s ease',
                          color: isFileActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                        }}
                        onMouseEnter={(e) => {
                          if (!isFileActive) e.currentTarget.style.background = themeTokens.hoverBg;
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
                                color: themeTokens.textSecondary,
                                flexShrink: 0,
                              }}
                            >
                              {isExpanded ? <ChevronDown size={13} color={accentColor} /> : <ChevronRight size={13} />}
                            </div>
                            <FolderIcon folderName={item.name} isOpen={isExpanded} size={15} />
                            <span style={{ fontSize: 12, fontWeight: isExpanded ? 500 : 400 }}>
                              {item.name}
                            </span>
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
                            <span style={{ fontSize: 12, fontWeight: isFileActive ? 500 : 400 }}>
                              {item.name}
                            </span>
                          </>
                        )}
                      </div>

                      {/* Sub-children */}
                      {isDir && isExpanded && item.children && item.children.length > 0 && (
                        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
                          <div
                            style={{
                              position: 'absolute',
                              left: depth * 12 + 10,
                              top: 0,
                              bottom: 0,
                              width: 1,
                              background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
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
              })
            )}
          </div>
        </>
      )}

          {/* ========================================================= */}
          {/* TAB 2: GIT SOURCE CONTROL                                */}
          {/* ========================================================= */}
          {sidebarTab === 'git' && (
            <div
              style={{
                flex: '1 1 0',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                minHeight: 0,
                width: '100%',
              }}
            >
              <SidebarPanels
                activeTab="git"
                workspacePath={workspacePath}
                themeTokens={themeTokens}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                accentTextColor="#ffffff"
                activeFile={activeFileId ? { path: activeFileId, name: activeFileId.split('/').pop() || '' } : null}
                onOpenFile={(filePath, fileName) => onOpenFile?.(filePath, fileName)}
                onJumpToLine={() => {}}
                onStartReview={onStartReview}
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
                installedExtensions={[]}
                onInstallExtension={async () => {}}
                onUninstallExtension={async () => {}}
                onToggleExtensionEnabled={async () => {}}
              />
            </div>
          )}

          {/* ========================================================= */}
          {/* TAB 3: GITHUB ISSUES                                      */}
          {/* ========================================================= */}
          {sidebarTab === 'issues' && (
            <div
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
                  borderBottom: `1px solid ${themeTokens.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 6,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <CircleDot size={13} color="#22c55e" />
                  <span style={{ fontSize: 11.5, fontWeight: 600, color: themeTokens.textPrimary, whiteSpace: 'nowrap' }}>
                    Issues
                  </span>
                  <span style={{ fontSize: 10.5, color: themeTokens.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    ({gitRepoName.split('/').pop() || 'aura-dev'})
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
                      color: themeTokens.textSecondary,
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
                      color: themeTokens.textSecondary,
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
                    title="Abrir Gerenciador de Issues (Modal)"
                    style={{
                      background: `${accentColor}18`,
                      border: `1px solid ${accentColor}44`,
                      color: accentColor,
                      padding: '2px 6px',
                      borderRadius: 4,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      fontSize: 10,
                      fontWeight: 600,
                      gap: 3,
                    }}
                  >
                    <Plus size={11} />
                    <span>Nova</span>
                  </button>
                </div>
              </div>

              {/* Search & Filter bar */}
              <div
                style={{
                  padding: '6px 10px',
                  borderBottom: `1px solid ${themeTokens.border}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  background: isEffectiveDark ? '#161616' : '#f8f8f8',
                  flexShrink: 0,
                }}
              >
                <div ref={issuesFilterRef} style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 6 }}>
                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: isEffectiveDark ? '#1f1f1f' : '#ffffff',
                    padding: '4px 8px',
                    borderRadius: 5,
                    border: `1px solid ${themeTokens.border}`,
                  }}
                >
                  <Search size={11} color={themeTokens.textSecondary} />
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
                      color: themeTokens.textPrimary,
                      fontFamily: 'inherit',
                    }}
                  />
                  {issuesSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setIssuesSearchQuery('')}
                      style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 1 }}
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
                    style={{
                      position: 'relative',
                      width: 26,
                      height: 26,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 5,
                      border: `1px solid ${themeTokens.border}`,
                      background: isIssuesFilterOpen ? `${accentColor}22` : (isEffectiveDark ? '#1f1f1f' : '#ffffff'),
                      color: activeIssueFilters > 0 || isIssuesFilterOpen ? accentColor : themeTokens.textSecondary,
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
                        border: `1px solid ${themeTokens.border}`,
                        background: isEffectiveDark ? '#1c1c1c' : '#ffffff',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.35)',
                      }}
                    >
                      <div style={{ padding: '2px 8px', fontSize: 9.5, fontWeight: 600, letterSpacing: 0.5, textTransform: 'uppercase', color: themeTokens.textMuted }}>Estado</div>
                        <button
                          type="button"
                          onClick={() => setIssuesFilter('open')}
                          style={{
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                            padding: '5px 8px', fontSize: 11, borderRadius: 4, border: 'none', cursor: 'pointer',
                            fontWeight: issuesFilter === 'open' ? 600 : 500,
                            background: issuesFilter === 'open' ? (isEffectiveDark ? '#2a2a2a' : '#e5e5e5') : 'transparent',
                            color: issuesFilter === 'open' ? '#22c55e' : themeTokens.textSecondary,
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
                            color: issuesFilter === 'closed' ? '#a855f7' : themeTokens.textSecondary,
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
                            color: issuesFilter === 'all' ? themeTokens.textPrimary : themeTokens.textSecondary,
                          }}
                        >
                          <span>Todas</span>
                          <span>{scopedIssues.length}</span>
                        </button>

                      <div style={{ height: 1, margin: '4px 0', background: themeTokens.border }} />
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
                          color: onlyMyIssues ? accentColor : themeTokens.textSecondary,
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
                      color: themeTokens.textMuted,
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: 8,
                    }}
                  >
                    <CircleDot size={24} strokeWidth={1.5} color={themeTokens.textMuted} />
                    <span>Nenhuma issue encontrada</span>
                    <button
                      type="button"
                      onClick={handleRefreshIssuesList}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: themeTokens.textSecondary,
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
                  filteredIssues.map((issue) => {
                    const isOpen = (issue.state || 'open').toLowerCase() === 'open' && !issue.closed_at;
                    const authorLogin = typeof issue.author === 'string'
                      ? issue.author
                      : (issue.author?.login || (typeof issue.assignee === 'string' ? issue.assignee : issue.assignee?.login) || (issue.assignees?.[0] ? (typeof issue.assignees[0] === 'string' ? issue.assignees[0] : issue.assignees[0]?.login) : '')) || 'walancy';
                    const authorAvatar = issue.authorAvatar
                      || (typeof issue.assignee === 'object' && issue.assignee?.avatarUrl)
                      || (issue.assignees?.[0] && typeof issue.assignees[0] === 'object' && issue.assignees[0]?.avatarUrl)
                      || (authorLogin ? `https://github.com/${authorLogin.replace('@', '').trim()}.png?size=40` : undefined);

                    return (
                      <div
                        key={issue.number}
                        style={{
                          padding: '5px 7px',
                          borderRadius: 4,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                          border: 'none',
                          boxShadow: 'none',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 4,
                          transition: 'background 0.15s ease',
                          cursor: 'pointer',
                        }}
                        onClick={() => (onOpenIssueDetails ? onOpenIssueDetails(issue.number) : onOpenIssuesModal?.())}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                        }}
                      >
                        {/* Top row: State icon, Issue #, Git Photo, and Quick Action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                            {isOpen ? (
                              <CircleDot size={11} color="#22c55e" style={{ flexShrink: 0 }} />
                            ) : (
                              <CheckCircle2 size={11} color="#a855f7" style={{ flexShrink: 0 }} />
                            )}
                            <span style={{ fontSize: 10.5, fontWeight: 500, color: accentColor, flexShrink: 0 }}>
                              #{issue.number}
                            </span>
                            {authorLogin && (
                              <IssueGitAvatar
                                login={authorLogin}
                                avatarUrl={authorAvatar}
                                size={14}
                                isEffectiveDark={isEffectiveDark}
                              />
                            )}
                          </div>

                          {/* Action buttons */}
                          <div
                            style={{ display: 'flex', alignItems: 'center', gap: 2, flexShrink: 0 }}
                            onClick={(e) => e.stopPropagation()}
                          >
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
                                color: themeTokens.textPrimary,
                                padding: '2px 5px',
                                borderRadius: 3,
                                cursor: 'pointer',
                                fontSize: 9,
                                fontWeight: 400,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = accentColor;
                                e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = themeTokens.textPrimary;
                                e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                              }}
                            >
                              <SquareTerminal size={10} />
                              <span>Enviar</span>
                            </button>

                            {/* Mencionar no terminal (mostrar como tag de issue) */}
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleMentionIssueInTerminal(issue)}
                              title="Mencionar no terminal (mostrar tag de issue)"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: themeTokens.textSecondary,
                                padding: 2.5,
                                borderRadius: 3,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'color 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                              onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
                            >
                              <AtSign size={11} />
                            </button>

                            {/* Create branch for issue in terminal */}
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleCheckoutIssueBranch(issue)}
                              title={`Criar e alternar para branch issue-${issue.number} no terminal`}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: themeTokens.textSecondary,
                                padding: 2.5,
                                borderRadius: 3,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'color 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                              onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
                            >
                              <GitBranch size={11} />
                            </button>

                            {/* Open in GitHub browser */}
                            <button
                              type="button"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={() => handleOpenIssueInBrowser(issue)}
                              title="Abrir issue no GitHub (Navegador)"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: themeTokens.textSecondary,
                                padding: 2.5,
                                borderRadius: 3,
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                transition: 'color 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                              onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
                            >
                              <ExternalLink size={11} />
                            </button>
                          </div>
                        </div>

                        {/* Issue Title (Compact with regular font) */}
                        <div
                          style={{
                            fontSize: 10.5,
                            fontWeight: 400,
                            color: themeTokens.textPrimary,
                            lineHeight: 1.25,
                            wordBreak: 'break-word',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                          }}
                        >
                          {issue.title}
                        </div>

                        {/* Labels & metadata */}
                        {((issue.labels && issue.labels.length > 0) || authorLogin) && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap', marginTop: 1 }}>
                            {(issue.labels || []).slice(0, 3).map((l: any, idx) => {
                              const name = typeof l === 'string' ? l : l.name;
                              const colorHex = typeof l === 'object' && l.color ? `#${l.color}` : '#3b82f6';
                              return (
                                <span
                                  key={idx}
                                  style={{
                                    fontSize: 8.5,
                                    fontWeight: 400,
                                    padding: '1px 4px',
                                    borderRadius: 3,
                                    background: `${colorHex}22`,
                                    color: colorHex,
                                    border: 'none',
                                  }}
                                >
                                  {name}
                                </span>
                              );
                            })}

                            {authorLogin && (
                              <div
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 3.5,
                                  marginLeft: 'auto',
                                  flexShrink: 0,
                                }}
                                title={`Autor Git: @${authorLogin}`}
                              >
                                <IssueGitAvatar
                                  login={authorLogin}
                                  avatarUrl={authorAvatar}
                                  size={13}
                                  isEffectiveDark={isEffectiveDark}
                                />
                                <span style={{ fontSize: 8.5, color: themeTokens.textMuted, fontWeight: 400 }}>
                                  por {authorLogin}
                                </span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          {/* Bottom Bar: Branch, GitHub Sync & Issues Quick Actions */}
          <div
            style={{
              padding: '6px 10px',
              borderTop: `1px solid ${themeTokens.border}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: 11,
              color: themeTokens.textMuted,
              background: isEffectiveDark ? '#121214' : '#f8f8f8',
              flexShrink: 0,
              gap: 6,
            }}
          >
            {/* Branch Pill (Click to open BranchModal) */}
            <div
              onClick={() => onOpenBranchModal?.()}
              title="Gerenciar Branches (Clique para abrir)"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '3px 6px',
                borderRadius: 4,
                cursor: onOpenBranchModal ? 'pointer' : 'default',
                transition: 'background 0.15s ease',
                minWidth: 0,
                flexShrink: 1,
              }}
              onMouseEnter={(e) => {
                if (onOpenBranchModal) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <GitBranch size={12} color={accentColor} style={{ flexShrink: 0 }} />
              <span
                style={{
                  fontWeight: 600,
                  color: themeTokens.textPrimary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: 110,
                  fontSize: 11,
                }}
              >
                {currentBranch || 'main'}
              </span>
            </div>

            {/* Quick Actions Right: Sync & Issues */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
              {/* Sync with GitHub */}
              <button
                type="button"
                onClick={() => onSyncGit?.()}
                title="Sincronizar com GitHub (Pull & Push)"
                disabled={isSyncingGit}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: isSyncingGit ? accentColor : themeTokens.textSecondary,
                  cursor: isSyncingGit ? 'not-allowed' : 'pointer',
                  padding: '3px 5px',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  fontSize: 10.5,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <RefreshCw
                  size={11}
                  className={isSyncingGit ? 'spin-animate' : ''}
                />
                <span>Sync</span>
              </button>

              {/* Issues badge */}
              <button
                type="button"
                onClick={() => {
                  if (sidebarTab === 'issues') {
                    onOpenIssuesModal?.();
                  } else {
                    setSidebarTab('issues');
                  }
                }}
                title="Ver Issues do GitHub"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: openIssuesCount > 0 ? '#22c55e' : themeTokens.textSecondary,
                  cursor: 'pointer',
                  padding: '3px 5px',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3.5,
                  fontSize: 10.5,
                  fontWeight: 500,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <CircleDot size={11} color={openIssuesCount > 0 ? '#22c55e' : themeTokens.textSecondary} />
                <span>{openIssuesCount}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* 2. SPLITTER RESIZER (DRAGGABLE)                                     */}
      {/* =================================================================== */}
      {!isExplorerCollapsed && (
        <div
          className={`resizer-col ${isDraggingExplorer ? 'dragging' : ''}`}
          onMouseDown={handleStartExplorerResize}
          onDoubleClick={() => setExplorerWidth(270)}
          title="Arraste para redimensionar (duplo clique restaura)"
          // área de captura maior (sem alterar o layout) para ser fácil de agarrar
          style={{ width: 11, marginLeft: -3, marginRight: -3 }}
        />
      )}

      {/* =================================================================== */}
      {/* 3. RIGHT PANE: TERMINAL COM ABAS (COBRINDO O RESTO DA TELA)         */}
      {/* =================================================================== */}
      <div
        style={{
          flex: '1 1 0',
          height: '100%',
          minWidth: 0,
          background: themeTokens.bgCard,
          borderRadius: 10,
          border: `1px solid ${themeTokens.border}`,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          position: 'relative',
        }}
      >
        {/* Terminal Header Tabs Bar */}
        <div
          style={{
            height: 38,
            padding: '0 8px',
            background: isEffectiveDark ? '#161616' : '#f2f2f2',
            borderBottom: `1px solid ${themeTokens.border}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            flexShrink: 0,
            overflow: 'visible',
            position: 'relative',
            zIndex: 40,
          }}
        >
          {/* Left: Collapse Sidebar Button + Tabs List */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1, overflow: 'visible' }}>
            {/* Toggle Explorer Button */}
            <button
              type="button"
              onClick={() => setIsExplorerCollapsed((prev) => !prev)}
              title={isExplorerCollapsed ? 'Expandir Navegador de Arquivos' : 'Recolher Navegador de Arquivos'}
              style={{
                background: 'transparent',
                border: 'none',
                color: themeTokens.textSecondary,
                padding: '4px 6px',
                borderRadius: 5,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                flexShrink: 0,
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
            >
              <PanelLeft size={15} />
            </button>

            <div style={{ height: 16, width: 1, background: themeTokens.border, margin: '0 2px' }} />

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
                flex: '1 1 auto',
                overflowX: 'auto',
                overflowY: 'hidden',
                scrollbarWidth: 'none',
              }}
            >
            {workspaces.map((ws) => {
              const isActive = ws.id === activeWorkspaceId;
              const isRenaming = renamingWorkspaceId === ws.id;

              const getWsBadge = () => {
                switch (ws.gridMode) {
                  case '2x2': return 'Grid 2x2';
                  case '3': return 'Grid 3x';
                  case '2x1': return 'Split 2x1';
                  case '1x2': return 'Split 1x2';
                  default: return null;
                }
              };

              const badge = getWsBadge();

              const getTabMinWidth = () => {
                if (isRenaming) return 120;
                switch (ws.gridMode) {
                  case '2x2': return 66;
                  case '3': return 54;
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
                  className={`workspace-tab ${isActive ? 'active' : ''} ${ws.gridMode !== '1x1' ? 'is-grid' : ''}`}
                  onClick={() => handleSelectWorkspace(ws.id)}
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
                      ? (isEffectiveDark ? hexToRgba(effectiveAiColor, 0.16) : hexToRgba(effectiveAiColor, 0.12))
                      : 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    cursor: 'pointer',
                    userSelect: 'none',
                    flex: '1 1 0px',
                    maxWidth: 155,
                    minWidth: getTabMinWidth(),
                    position: 'relative',
                    transition: 'background 0.15s ease, color 0.15s ease',
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
                            prev.map((w) => (w.id === ws.id ? { ...w, name: renameWorkspaceValue.trim() } : w))
                          );
                        }
                        setRenamingWorkspaceId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (renameWorkspaceValue.trim()) {
                            setWorkspaces((prev) =>
                              prev.map((w) => (w.id === ws.id ? { ...w, name: renameWorkspaceValue.trim() } : w))
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
                        background: isEffectiveDark ? '#141416' : '#ffffff',
                        border: 'none',
                        boxShadow: 'none',
                        color: themeTokens.textPrimary,
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
                          color: isActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          minWidth: 0,
                        }}
                      >
                        {ws.name}
                      </span>
                      {badge && (
                        <span
                          className="workspace-tab-badge"
                          style={{
                            fontSize: 9,
                            fontWeight: 400,
                            padding: '1px 4px',
                            borderRadius: 3,
                            background: isActive
                              ? hexToRgba(effectiveAiColor, 0.22)
                              : (isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                            color: isActive ? effectiveAiColor : themeTokens.textMuted,
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                          }}
                        >
                          {badge}
                        </span>
                      )}
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
                      color: themeTokens.textMuted,
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
                      e.currentTarget.style.color = themeTokens.textMuted;
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
                title="Criar nova área de trabalho (Única, Split, Grid ou IA)"
                style={{
                  height: 26,
                  padding: '0 8px',
                  borderRadius: 6,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  border: 'none',
                  color: themeTokens.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 500,
                  transition: 'all 0.12s ease',
                  flexShrink: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = themeTokens.textPrimary;
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.1)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = themeTokens.textSecondary;
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                }}
              >
                <Plus size={14} />
                <span>Nova Área</span>
              </button>

              {/* Presets Popup Dropdown */}
              {newTabMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 4px)',
                    left: 0,
                    width: 220,
                    background: isEffectiveDark ? '#1c1c1c' : '#ffffff',
                    border: `1px solid ${themeTokens.border}`,
                    borderRadius: 8,
                    padding: '4px 0',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, color: themeTokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Áreas de Trabalho & Layouts
                  </div>
                  <div
                    onClick={() => handleCreateWorkspace('1x1')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Square size={13} color={accentColor} />
                    <span>Área Simples (1 Terminal)</span>
                  </div>
                  <div
                    onClick={() => handleCreateWorkspace('1x2')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Columns2 size={13} color={accentColor} />
                    <span>Split 1x2 (Lado a Lado)</span>
                  </div>
                  <div
                    onClick={() => handleCreateWorkspace('2x2')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Grid2x2 size={13} color={accentColor} />
                    <span>Grid 2x2 (4 Terminais)</span>
                  </div>
                  <div
                    onClick={() => handleCreateWorkspace('2x1')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Rows2 size={13} color={accentColor} />
                    <span>Split 2x1 (Empilhados)</span>
                  </div>
                  <div
                    onClick={() => handleCreateWorkspace('3')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <LayoutGrid size={13} color={accentColor} />
                    <span>Grid 3x (3 Terminais)</span>
                  </div>

                  <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />

                  <div style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, color: themeTokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    CLIs de Inteligência Artificial
                  </div>
                  <div
                    onClick={() => handleCreateWorkspace('1x1', 'claude', 'Claude CLI', 'claude')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <ClaudeIcon size={14} />
                    <span>Claude CLI</span>
                  </div>
                  <div
                    onClick={() => handleCreateWorkspace('1x1', 'antigravity', 'Antigravity CLI', 'agy')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <AntigravityIcon size={14} />
                    <span>Antigravity CLI (agy)</span>
                  </div>
                  <div
                    onClick={() => handleCreateWorkspace('1x1', 'gemini', 'Gemini CLI', 'gemini')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <GeminiIcon size={14} />
                    <span>Gemini CLI</span>
                  </div>
                  <div
                    onClick={() => handleCreateWorkspace('1x1', 'codex', 'OpenAI Codex', 'codex')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <CodexIcon size={14} />
                    <span>Codex CLI</span>
                  </div>

                  <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />

                  <div style={{ padding: '4px 10px', fontSize: 10, fontWeight: 700, color: themeTokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                    Terminais Shell & REPL
                  </div>
                  <div
                    onClick={() => handleCreateWorkspace('1x1', 'bash', 'Bash Shell', 'bash')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <TerminalIcon size={14} color="#10b981" />
                    <span>Bash Shell</span>
                  </div>
                  <div
                    onClick={() => handleCreateWorkspace('1x1', 'node', 'Node.js REPL', 'node')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Play size={13} color="#22c55e" />
                    <span>Node.js REPL</span>
                  </div>
                  <div
                    onClick={() => handleCreateWorkspace('1x1', 'python', 'Python REPL', 'python3')}
                    style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, position: 'relative' }}>
            {/* Grid Layout Picker Dropdown */}
            <div ref={layoutMenuRef} style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLayoutMenuOpen((prev) => !prev);
                }}
                title="Configurar layout do terminal (Grid 2x2, Split, Único)"
                style={{
                  height: 26,
                  padding: '0 8px',
                  borderRadius: 6,
                  background: gridMode !== '1x1' ? hexToRgba(effectiveAiColor, 0.14) : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'),
                  border: 'none',
                  boxShadow: 'none',
                  color: gridMode !== '1x1' ? effectiveAiColor : themeTokens.textSecondary,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 400,
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (gridMode === '1x1') e.currentTarget.style.color = themeTokens.textPrimary;
                }}
                onMouseLeave={(e) => {
                  if (gridMode === '1x1') e.currentTarget.style.color = themeTokens.textSecondary;
                }}
              >
                {gridMode === '2x2' ? (
                  <Grid2x2 size={13} color={effectiveAiColor} />
                ) : gridMode === '3' ? (
                  <LayoutGrid size={13} color={effectiveAiColor} />
                ) : gridMode === '2x1' ? (
                  <Rows2 size={13} color={effectiveAiColor} />
                ) : gridMode === '1x2' ? (
                  <Columns2 size={13} color={effectiveAiColor} />
                ) : (
                  <Square size={13} />
                )}
                <span>{gridMode === '2x2' ? 'Grid 2x2' : gridMode === '1x2' ? 'Split 1x2' : gridMode === '2x1' ? 'Split 2x1' : gridMode === '3' ? 'Grid 3x' : '1x1'}</span>
                <ChevronDown size={11} />
              </button>

              {/* Layout Dropdown Menu */}
              {layoutMenuOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 5px)',
                    right: 0,
                    width: 230,
                    background: isEffectiveDark ? '#1c1c1c' : '#ffffff',
                    border: 'none',
                    borderRadius: 8,
                    padding: '4px 0',
                    boxShadow: 'none',
                    zIndex: 9999,
                    display: 'flex',
                    flexDirection: 'column',
                  }}
                >
                  <div style={{ padding: '6px 12px 4px', fontSize: 10, fontWeight: 400, color: themeTokens.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Layout de Terminais
                  </div>

                  {/* Visual Grid Mini-Selector */}
                  <div style={{ padding: '6px 12px 8px', borderBottom: `1px solid ${hexToRgba(themeTokens.border, 0.4)}` }}>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 4, width: 84, height: 56, margin: '0 auto' }}>
                      <div
                        onClick={() => applyGridMode('1x1')}
                        title="1x1: 1 Terminal"
                        style={{
                          borderRadius: 4,
                          background: gridMode === '1x1' ? hexToRgba(effectiveAiColor, 0.22) : (isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 400,
                          color: gridMode === '1x1' ? effectiveAiColor : themeTokens.textMuted,
                          transition: 'background 0.12s ease',
                        }}
                      >
                        Q1
                      </div>
                      <div
                        onClick={() => applyGridMode('1x2')}
                        title="1x2: 2 Terminais Lado a Lado"
                        style={{
                          borderRadius: 4,
                          background: gridMode === '1x2' || gridMode === '3' || gridMode === '2x2' ? hexToRgba(effectiveAiColor, 0.22) : (isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 400,
                          color: gridMode === '1x2' || gridMode === '3' || gridMode === '2x2' ? effectiveAiColor : themeTokens.textMuted,
                          transition: 'background 0.12s ease',
                        }}
                      >
                        Q2
                      </div>
                      <div
                        onClick={() => applyGridMode('2x1')}
                        title="2x1: 2 Terminais Empilhados"
                        style={{
                          borderRadius: 4,
                          background: gridMode === '2x1' || gridMode === '3' || gridMode === '2x2' ? hexToRgba(effectiveAiColor, 0.22) : (isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 400,
                          color: gridMode === '2x1' || gridMode === '3' || gridMode === '2x2' ? effectiveAiColor : themeTokens.textMuted,
                          transition: 'background 0.12s ease',
                        }}
                      >
                        Q3
                      </div>
                      <div
                        onClick={() => applyGridMode('2x2')}
                        title="2x2: Grid 4 Terminais"
                        style={{
                          borderRadius: 4,
                          background: gridMode === '2x2' ? hexToRgba(effectiveAiColor, 0.26) : (isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'),
                          border: 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          fontWeight: 400,
                          color: gridMode === '2x2' ? effectiveAiColor : themeTokens.textMuted,
                          transition: 'background 0.12s ease',
                        }}
                      >
                        Q4
                      </div>
                    </div>
                  </div>

                  {/* 1x1: Tela Única */}
                  <div
                    onClick={() => applyGridMode('1x1')}
                    style={{
                      padding: '7px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 400,
                      cursor: 'pointer',
                      color: gridMode === '1x1' ? effectiveAiColor : themeTokens.textPrimary,
                      background: gridMode === '1x1' ? hexToRgba(effectiveAiColor, 0.1) : 'transparent',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (gridMode !== '1x1') e.currentTarget.style.background = themeTokens.hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      if (gridMode !== '1x1') e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Square size={14} />
                    <span>1 Terminal (Tela Única)</span>
                  </div>

                  {/* 1x2: Lado a Lado */}
                  <div
                    onClick={() => applyGridMode('1x2')}
                    style={{
                      padding: '7px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 400,
                      cursor: 'pointer',
                      color: gridMode === '1x2' ? effectiveAiColor : themeTokens.textPrimary,
                      background: gridMode === '1x2' ? hexToRgba(effectiveAiColor, 0.1) : 'transparent',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (gridMode !== '1x2') e.currentTarget.style.background = themeTokens.hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      if (gridMode !== '1x2') e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Columns2 size={14} />
                    <span>2 Terminais (Lado a Lado)</span>
                  </div>

                  {/* 2x1: Empilhados */}
                  <div
                    onClick={() => applyGridMode('2x1')}
                    style={{
                      padding: '7px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 400,
                      cursor: 'pointer',
                      color: gridMode === '2x1' ? effectiveAiColor : themeTokens.textPrimary,
                      background: gridMode === '2x1' ? hexToRgba(effectiveAiColor, 0.1) : 'transparent',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (gridMode !== '2x1') e.currentTarget.style.background = themeTokens.hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      if (gridMode !== '2x1') e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Rows2 size={14} />
                    <span>2 Terminais (Empilhados)</span>
                  </div>

                  {/* 3: Triplo */}
                  <div
                    onClick={() => applyGridMode('3')}
                    style={{
                      padding: '7px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 400,
                      cursor: 'pointer',
                      color: gridMode === '3' ? effectiveAiColor : themeTokens.textPrimary,
                      background: gridMode === '3' ? hexToRgba(effectiveAiColor, 0.1) : 'transparent',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (gridMode !== '3') e.currentTarget.style.background = themeTokens.hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      if (gridMode !== '3') e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <LayoutGrid size={14} />
                    <span>3 Terminais (2 Topo, 1 Base)</span>
                  </div>

                  {/* 2x2: Grid 4 Terminais */}
                  <div
                    onClick={() => applyGridMode('2x2')}
                    style={{
                      padding: '7px 12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      fontSize: 12,
                      fontWeight: 400,
                      cursor: 'pointer',
                      color: gridMode === '2x2' ? effectiveAiColor : themeTokens.textPrimary,
                      background: gridMode === '2x2' ? hexToRgba(effectiveAiColor, 0.1) : 'transparent',
                      transition: 'background 0.12s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (gridMode !== '2x2') e.currentTarget.style.background = themeTokens.hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      if (gridMode !== '2x2') e.currentTarget.style.background = 'transparent';
                    }}
                  >
                    <Grid2x2 size={14} color={gridMode === '2x2' ? effectiveAiColor : undefined} />
                    <span>Grid 2x2 (4 Terminais)</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Toggle Split */}
            <button
              type="button"
              onClick={handleQuickToggleSplit}
              title={gridMode === '2x2' ? 'Voltar para 1 terminal' : gridMode === '1x2' ? 'Expandir para Grid 2x2' : 'Dividir terminal lado a lado'}
              style={{
                background: gridMode !== '1x1' ? hexToRgba(effectiveAiColor, 0.14) : 'transparent',
                border: 'none',
                boxShadow: 'none',
                color: gridMode !== '1x1' ? effectiveAiColor : themeTokens.textSecondary,
                padding: '4px 6px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                transition: 'background 0.15s ease, color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (gridMode === '1x1') e.currentTarget.style.color = themeTokens.textPrimary;
              }}
              onMouseLeave={(e) => {
                if (gridMode === '1x1') e.currentTarget.style.color = themeTokens.textSecondary;
              }}
            >
              <SplitSquareVertical size={14} />
            </button>

            {/* Clear Terminal */}
            <button
              type="button"
              onClick={handleClearTerminal}
              title="Limpar terminal ativo (clear)"
              style={{
                background: 'transparent',
                border: 'none',
                color: themeTokens.textSecondary,
                padding: '4px 6px',
                borderRadius: 4,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
            >
              <Eraser size={13} />
            </button>

            <div style={{ height: 16, width: 1, background: themeTokens.border, margin: '0 2px' }} />

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
                transition: 'all 0.15s ease',
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
                    color: themeTokens.textSecondary,
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
                    color: themeTokens.textSecondary,
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
        <div
          ref={gridContainerRef}
          style={{
            flex: '1 1 0',
            width: '100%',
            height: '100%',
            minHeight: 0,
            display: 'flex',
            overflow: 'hidden',
            position: 'relative',
            background: isEffectiveDark ? '#0c0c0e' : '#ffffff',
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
                    color: '#ffffff',
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
      {fileContextMenu && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            left: Math.min(fileContextMenu.x, window.innerWidth - 220),
            top: Math.min(fileContextMenu.y, window.innerHeight - 240),
            width: 210,
            background: isEffectiveDark ? '#1a1a1c' : '#ffffff',
            border: `1px solid ${themeTokens.border}`,
            borderRadius: 8,
            padding: '4px 0',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
            zIndex: 99999,
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <div
            style={{
              padding: '6px 12px',
              fontSize: 11,
              fontWeight: 600,
              color: themeTokens.textMuted,
              borderBottom: `1px solid ${themeTokens.border}`,
              marginBottom: 4,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {fileContextMenu.node.name}
          </div>

          {!fileContextMenu.node.isDirectory && (
            <div
              onClick={() => {
                onOpenFile?.(fileContextMenu.node.path, fileContextMenu.node.name);
                setFileContextMenu(null);
              }}
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
              onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <FileText size={14} color={accentColor} />
              <span>Abrir no Editor (IDE)</span>
            </div>
          )}

          {fileContextMenu.node.isDirectory ? (
            <div
              onClick={() => {
                writeToActiveTerminal(`cd "${fileContextMenu.node.path}"\r`);
                setFileContextMenu(null);
                if (onToast) onToast(`cd ${fileContextMenu.node.name}`);
              }}
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
              onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <CornerDownRight size={14} color="#10b981" />
              <span>cd para esta pasta no terminal</span>
            </div>
          ) : (
            <div
              onClick={() => {
                writeToActiveTerminal(`"${fileContextMenu.node.path}" `);
                setFileContextMenu(null);
              }}
              style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
              onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <ArrowRight size={14} color="#10b981" />
              <span>Inserir caminho no terminal</span>
            </div>
          )}

          <div
            onClick={() => {
              navigator.clipboard.writeText(fileContextMenu.node.path);
              setFileContextMenu(null);
              if (onToast) onToast('Caminho absoluto copiado!');
            }}
            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
            onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Copy size={13} color={themeTokens.textSecondary} />
            <span>Copiar Caminho Absoluto</span>
          </div>

          <div
            onClick={() => {
              const rel = fileContextMenu.node.path.replace(workspacePath, '').replace(/^\//, '');
              navigator.clipboard.writeText(rel);
              setFileContextMenu(null);
              if (onToast) onToast('Caminho relativo copiado!');
            }}
            style={{ padding: '6px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
            onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <Copy size={13} color={themeTokens.textSecondary} />
            <span>Copiar Caminho Relativo</span>
          </div>
        </div>
      )}

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
        onConfirm={handleConfirmCloseSingleWorkspace}
        onClose={() => setWorkspaceToClose(null)}
      />
    </div>
  );
};
