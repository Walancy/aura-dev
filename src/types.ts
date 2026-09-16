export interface Project {
  id: string;
  name: string;
  path: string;
  description: string;
  gitBranch?: string;
  gitStatus?: string;
  lastActive: string;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  status: 'backlog' | 'todo' | 'in_progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  assignee: string;
  tags: string[];
  sprint: string;
}

export interface FileNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
  children?: FileNode[];
}

export interface EditorTab {
  id: string;
  path: string;
  name: string;
  content: string;
  isDirty: boolean;
  language: string;
}

export interface TerminalTab {
  id: string;
  title: string;
  type: 'zsh' | 'claude' | 'agy' | 'custom';
}

export interface OpenPort {
  port: number;
  protocol: string;
  command: string;
  pid: string;
  user: string;
  url: string;
  status: 'online' | 'unreachable';
  serviceName?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  model?: string;
}
