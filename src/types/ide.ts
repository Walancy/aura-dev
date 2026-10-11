import type React from 'react';

// Shape of the `themeTokens` object computed once in App.tsx from `isEffectiveDark`
// and threaded down to every panel/modal that needs theme-aware colors.
export interface ThemeTokens {
  bgApp: string;
  bgCard: string;
  bgCardSecondary: string;
  bgCardElevated: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  border: string;
  borderSubtle: string;
  hoverBg: string;
}

export interface TerminalSessionItem {
  id: string;
  name: string;
  type: string;
  pid: number;
  command: string;
  initialCommand?: string;
  shellIntegration: string;
  isSplit?: boolean;
  splitWithId?: string;
  /** onde o terminal vive: 'cli' (tela CLI) ou 'ide' (padrão, painel da IDE); cada tela só mostra os seus */
  scope?: 'ide' | 'cli';
  /** projeto dono do terminal: todos os projetos mantêm seus terminais abertos; a tela mostra só os do projeto ativo */
  projectPath?: string;
}

export interface OpenFileItem {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isDirty?: boolean;
}

export interface ExplorerNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
  children?: ExplorerNode[];
}

export interface ReviewSession {
  files: ChangedFileItem[];
  currentIndex: number;
  originalContent: string;
  modifiedContent: string;
  isSideBySide: boolean;
}

export interface GitHubIssueItem {
  number: number;
  title: string;
  state: string;
  updatedAt: string;
  createdAt?: string;
  author?: string | { login: string; name?: string };
  authorAvatar?: string;
  assignees?: Array<{ login: string; avatarUrl?: string }> | string[];
  assignee?: { login: string; avatarUrl?: string } | null;
  labels?: Array<{ id?: number; name: string; color?: string; description?: string }>;
  milestone?: { title: string; number?: number; dueOn?: string } | null;
  milestoneTitle?: string;
  milestoneNumber?: number;
  iterationId?: string;
  iterationTitle?: string;
  projectV2Status?: string;
  projectV2ItemId?: string;
  body?: string;
  url?: string;
}

export interface GitBranchItem {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

// AI chat panel types
export interface ChangedFileItem {
  path: string;
  name: string;
  dir: string;
  additions: number;
  deletions: number;
}

export interface ExecutionStepItem {
  id?: string;
  type: 'explore' | 'edit' | 'run' | 'search' | 'analyze' | 'thought';
  label: string;
  file?: string;
  path?: string;
  additions?: number;
  deletions?: number;
  command?: string;
  lineRange?: string;
  duration?: string;
  children?: ExecutionStepItem[];
  isExpanded?: boolean;
}

export interface WalkthroughItem {
  title: string;
  summary: string;
}

export interface ChatMessageItem {
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
  attachedFiles?: Array<{ id: string; name: string; path: string; isDirectory?: boolean }>;
  attachedImages?: Array<{ id: string; name: string; dataUrl: string; size?: number }>;
  attachedTask?: {
    number: number;
    title: string;
    body?: string;
    state?: string;
    labels?: Array<{ name: string; color?: string }>;
    url?: string;
  };
  terminalCommands?: Array<{
    command: string;
    cwd?: string;
    duration?: string;
    stdout?: string;
    stderr?: string;
    exitCode?: number;
  }>;
  thoughtSnippet?: string;
  interactiveQuestion?: {
    question: string;
    options: string[];
    isMultiSelect?: boolean;
  };
}

export interface AttachedFileItem {
  id: string;
  path: string;
  name: string;
  isDirectory?: boolean;
}

export interface AttachedImageItem {
  id: string;
  name: string;
  dataUrl: string;
  type?: string;
  size?: number;
  path?: string;
}

// Unified shape combining in-memory and disk-saved chat sessions, used by the
// Chat History modal's Current/Running/Recent lists (see `allUnifiedSessions` in App.tsx).
export interface UnifiedConvoItem {
  id: string;
  title: string;
  provider: string;
  updatedAt: number;
  projectName?: string;
  workspacePath?: string;
  model?: string;
  isCurrent?: boolean;
  isRunning?: boolean;
}

export interface ChatSessionItem {
  id: string;
  title: string;
  provider: string;
  updatedAt: number;
  history: ChatMessageItem[];
  projectName?: string;
  workspacePath?: string;
  model?: string;
  status?: 'running' | 'idle' | 'completed';
}

// Quick Open / Command Palette item
export interface QuickOpenItemDef {
  id: string;
  title: string;
  suffix?: string;
  subtitle?: string;
  badges?: string[];
  badgeText?: string;
  badgeTextColor?: string;
  icon?: React.ReactNode;
  isDividerBefore?: boolean;
  onSelect: () => void;
}
