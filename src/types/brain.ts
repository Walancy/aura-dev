export type BrainNodeType =
  | 'entry'
  | 'module'
  | 'component'
  | 'service'
  | 'config'
  | 'doc'
  | 'domain'
  | 'custom';

export interface BrainNode {
  id: string;
  label: string;
  path: string;
  type: BrainNodeType;
  description: string;
  tags: string[];
  size?: number;
  connectionsCount?: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  pinned?: boolean;
  isCustom?: boolean;
}

export interface BrainEdge {
  id: string;
  source: string;
  target: string;
  relation: string;
}

export interface ProjectBrainContext {
  id: string;
  projectName: string;
  workspacePath: string;
  summary: string;
  techStack: string[];
  architectureOverview: string;
  aiDirectives: string;
  modulesSummary: string;
  nodes: BrainNode[];
  edges: BrainEdge[];
  lastIndexedAt: number;
  version: number;
}

export type BrainCategoryFilter = 'all' | BrainNodeType;
