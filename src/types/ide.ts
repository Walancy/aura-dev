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
  author?: { login: string; name?: string };
  labels?: Array<{ name: string; color?: string; description?: string }>;
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
  type: 'explore' | 'edit' | 'run' | 'search';
  label: string;
  file?: string;
  additions?: number;
  deletions?: number;
  command?: string;
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
