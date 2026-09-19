import React, { useState, useMemo, useEffect } from 'react';
import {
  Search,
  ChevronDown,
  Check,
  Table as TableIcon,
  GanttChart,
  Kanban as KanbanIcon,
  Filter,
  ArrowUpDown,
  Plus,
  MoreVertical,
  X,
  CheckCircle2,
  Clock,
  AlertCircle,
  GitPullRequest,
  GitBranch,
  Tag,
  Copy,
  ExternalLink,
  Pencil,
  Trash2,
  Building2,
  CircleDot,
  Zap,
  AlertTriangle,
  Milestone,
  ListChecks,
  BarChart2,
  Link2,
  Users,
  Settings,
  MessageSquare,
  Smile,
  AtSign,
  Layers,
  Inbox,
  UserCheck,
  CheckSquare,
  Square,
  Archive,
  Repeat,
  MoreHorizontal,
  Star,
  Lock,
  Globe,
  GitFork,
} from 'lucide-react';
import { getContrastTextColor, hexToRgba } from '../utils/color';
import { DatePickerField } from './ui/DatePickerField';

export interface ProjectsSchedulerViewProps {
  accentColor?: string;
  isEffectiveDark?: boolean;
  themeTokens?: {
    bgApp?: string;
    bgCard?: string;
    bgCardSecondary?: string;
    bgCardElevated?: string;
    textPrimary?: string;
    textSecondary?: string;
    textMuted?: string;
    border?: string;
    borderSubtle?: string;
    hoverBg?: string;
  };
}

interface ProjectCardData {
  id: number;
  badge: number;
  title: string;
  sprint: string;
  percentage: string;
  percentValue: number;
  solidFlex: string;
  dottedWidth: number;
  faintWidth: number;
  issuesDone: number;
  issuesOpen: number;
  issuesInProgress: number;
  alertStatus?: 'alerta' | 'critico' | null;
  org?: string;
  // Real GitHub repo backing this card
  fullName?: string;
  owner?: string;
  repoName?: string;
  htmlUrl?: string;
}

export interface ProjectIssue {
  id: string;
  projectId: number;
  title: string;
  description: string;
  dateStr: string;
  createdAtIso: string; // data real de criação, usada como posição de fallback na timeline
  durationDays: number; // dias em aberto (mínimo 1), largura de fallback na timeline
  startDateIso?: string; // YYYY-MM-DD, derivada da sprint (milestone) atribuída à issue
  dueDateIso?: string; // YYYY-MM-DD, derivada da sprint (milestone) atribuída à issue
  milestoneNumber?: number;
  milestoneTitle?: string;
  tag: string;
  tagColor: { bg: string; text: string };
  priority: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  priorityColor: string;
  status: 'A Fazer' | 'Em Progresso' | 'Concluído';
  assignees: { name: string; avatarBg: string; initial: string; avatarUrl?: string }[];
  progress: number;
  // Real GitHub issue backing this task
  githubNumber?: number;
  nodeId?: string;
  htmlUrl?: string;
  rawLabels?: string[];
  rawState?: 'open' | 'closed';
  author?: string;
  authorAvatarUrl?: string;
  commentsCount?: number;
  pullRequest?: {
    number: number;
    title: string;
    branch: string;
    status: 'open' | 'merged' | 'draft';
    reviewStatus?: 'approved' | 'review_required' | 'changes_requested';
    ciStatus?: 'success' | 'failure' | 'pending';
    url?: string;
  };
}

interface GithubRepoSummary {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  open_issues_count: number;
  language: string | null;
  owner: { login: string; avatar_url?: string };
  html_url: string;
  private?: boolean;
  default_branch?: string;
  homepage?: string | null;
  ssh_url?: string;
  clone_url?: string;
  stargazers_count?: number;
  forks_count?: number;
  topics?: string[];
  created_at?: string;
  updated_at?: string;
  pushed_at?: string;
}

// Sprint = um milestone real do GitHub. O GitHub não tem campo nativo de "início",
// então guardamos isso como um comentário HTML invisível na descrição do milestone.
export interface SprintOption {
  number: number;
  title: string;
  state: 'open' | 'closed';
  startDateIso?: string;
  dueDateIso?: string;
  openIssues: number;
  closedIssues: number;
}

export interface RepoCollaborator {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
  contributions?: number;
}

export interface ProjectRelease {
  version: string;
  tag: string;
  releaseName: string;
  dateStr: string;
  author: string;
  status: 'published' | 'pre-release' | 'draft';
  milestone: {
    title: string;
    totalIssues: number;
    closedIssues: number;
    openIssues: number;
    percent: number;
    dueDate: string;
  };
  highlights: string[];
  commitsCount: number;
}

export const RELEASES_DATA: Record<string, ProjectRelease> = {};


const STATUS_FILTER_OPTIONS = [
  'Todos os Projetos',
  'Em Andamento (<90%)',
  'Fase Final (≥90%)',
];


export interface OrganizationOption {
  id: string;
  name: string;
  slug: string;
  avatarColor: string;
  avatarUrl?: string;
}

const TAG_LABEL_STYLE: Record<string, { bg: string; text: string }> = {
  research: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
  backend: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc' },
  frontend: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
  design: { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6' },
  devops: { bg: 'rgba(234, 88, 12, 0.15)', text: '#fb923c' },
  qa: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' },
  release: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },
};

const TAG_LABEL_COLOR: Record<string, string> = {
  Research: '3b82f6',
  Backend: 'a855f7',
  Frontend: '3b82f6',
  Design: 'ec4899',
  DevOps: 'ea580c',
  QA: '10b981',
  Release: 'f59e0b',
};

const PRIORITY_LABELS: Record<'Baixa' | 'Média' | 'Alta' | 'Urgente', { name: string; color: string }> = {
  Baixa: { name: 'priority: baixa', color: '22c55e' },
  Média: { name: 'priority: média', color: 'f59e0b' },
  Alta: { name: 'priority: alta', color: 'ef4444' },
  Urgente: { name: 'priority: urgente', color: 'dc2626' },
};

const IN_PROGRESS_LABEL = { name: 'em-progresso', color: '0ea5e9' };

// GitHub Milestones não têm campo nativo de "data de início" (só due_on), então guardamos
// isso como um comentário HTML invisível na descrição do milestone (não aparece no GitHub.com).
const SPRINT_START_MARKER = /<!--\s*devflow:start=([\d-]+)\s*-->/;

function encodeSprintDescription(description: string, startDate: string): string {
  const parts = [description.trim(), `<!-- devflow:start=${startDate} -->`];
  return parts.join('\n\n').trim();
}

function parseSprintStart(rawDescription: string | null | undefined): string | undefined {
  const match = (rawDescription || '').match(SPRINT_START_MARKER);
  return match ? match[1] : undefined;
}

function toIsoDateOnly(iso: string): string {
  return iso.slice(0, 10);
}

const WEEKDAY_LABELS_PT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];

const PROJECT_SECTIONS = [
  { id: 'tarefas', label: 'Tarefas', icon: ListChecks },
  { id: 'issues', label: 'Issues', icon: CircleDot },
  { id: 'sprints', label: 'Sprints', icon: Zap },
  { id: 'riscos', label: 'Riscos', icon: AlertTriangle },
  { id: 'marcos', label: 'Marcos', icon: Milestone },
  { id: 'relatorio', label: 'Relatório', icon: BarChart2 },
  { id: 'links', label: 'Links', icon: Link2 },
  { id: 'time', label: 'Time', icon: Users },
  { id: 'configuracoes', label: 'Configurações', icon: Settings },
] as const;

type ProjectSectionId = (typeof PROJECT_SECTIONS)[number]['id'];

function formatShortDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
}

function formatIssueDateRange(issue: ProjectIssue): string {
  if (issue.startDateIso && issue.dueDateIso) {
    return `${formatShortDate(issue.startDateIso)} → ${formatShortDate(issue.dueDateIso)}`;
  }
  if (issue.startDateIso) return `Início: ${formatShortDate(issue.startDateIso)}`;
  if (issue.dueDateIso) return `Prazo: ${formatShortDate(issue.dueDateIso)}`;
  return issue.dateStr;
}

function formatGithubTimeAgo(iso: string): string {
  try {
    const now = new Date().getTime();
    const past = new Date(iso).getTime();
    const diffMs = Math.max(0, now - past);
    const diffSec = Math.floor(diffMs / 1000);
    const diffMin = Math.floor(diffSec / 60);
    const diffHr = Math.floor(diffMin / 60);
    const diffDay = Math.floor(diffHr / 24);

    if (diffDay >= 30) {
      return `on ${new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
    }
    if (diffDay >= 7) {
      const weeks = Math.max(1, Math.floor(diffDay / 7));
      return `${weeks}w ago`;
    }
    if (diffDay > 0) return `${diffDay}d ago`;
    if (diffHr > 0) return `${diffHr}h ago`;
    if (diffMin > 0) return `${diffMin}m ago`;
    return 'just now';
  } catch {
    return 'recently';
  }
}

const SAMPLE_GITHUB_ISSUES: ProjectIssue[] = [
  {
    id: '#246',
    projectId: 1,
    githubNumber: 246,
    title: 'Constraint de FK duplicada em gruposParticipantes.grupo_id quebra embeds do PostgREST',
    description: 'Verificada duplicação de FK impedindo resolução de embeds do PostgREST.',
    dateStr: '05 Set 2026',
    createdAtIso: '2026-09-05T12:00:00Z',
    durationDays: 14,
    tag: 'backend',
    tagColor: { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8' },
    priority: 'Alta',
    priorityColor: '#ef4444',
    status: 'A Fazer',
    rawState: 'open',
    author: 'nelsonappmoove',
    commentsCount: 1,
    assignees: [],
    progress: 0,
    rawLabels: ['backend'],
  },
  {
    id: '#245',
    projectId: 1,
    githubNumber: 245,
    title: 'Excluir missão/grupo não cascateia soft delete para os filhos, gerando registros órfãos',
    description: 'Ao executar soft delete em missões ou grupos, as entidades filhas continuam ativas.',
    dateStr: '05 Set 2026',
    createdAtIso: '2026-09-05T10:30:00Z',
    durationDays: 14,
    tag: 'backend',
    tagColor: { bg: 'rgba(56, 189, 248, 0.15)', text: '#38bdf8' },
    priority: 'Alta',
    priorityColor: '#ef4444',
    status: 'A Fazer',
    rawState: 'open',
    author: 'nelsonappmoove',
    commentsCount: 0,
    assignees: [],
    progress: 0,
    rawLabels: ['backend'],
  },
  {
    id: '#244',
    projectId: 1,
    githubNumber: 244,
    title: 'Otimização de consumo de Egress e Storage no Supabase',
    description: 'Análise de métricas de rede e redução de tráfego de saída.',
    dateStr: '19 Ago 2026',
    createdAtIso: '2026-08-19T14:15:00Z',
    durationDays: 31,
    tag: 'infra',
    tagColor: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' },
    priority: 'Média',
    priorityColor: '#f59e0b',
    status: 'Em Progresso',
    rawState: 'open',
    author: 'nelsonappmoove',
    commentsCount: 0,
    assignees: [
      { name: 'nelsonappmoove', initial: 'N', avatarBg: '#10b981', avatarUrl: 'https://github.com/identicons/nelsonappmoove.png' },
    ],
    progress: 50,
    rawLabels: ['infra'],
  },
  {
    id: '#243',
    projectId: 1,
    githubNumber: 243,
    title: 'Auditar as 36 falhas de teste restantes: 3 são bugs já corrigidos com teste desatualizado, o resto exige decisão de produto',
    description: 'Levantamento da suite de testes de integração e testes e2e.',
    dateStr: '18 Ago 2026',
    createdAtIso: '2026-08-18T09:00:00Z',
    durationDays: 32,
    tag: 'bug',
    tagColor: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    priority: 'Urgente',
    priorityColor: '#dc2626',
    status: 'A Fazer',
    rawState: 'open',
    author: 'nelsonappmoove',
    commentsCount: 0,
    assignees: [
      { name: 'nelsonappmoove', initial: 'N', avatarBg: '#10b981', avatarUrl: 'https://github.com/identicons/nelsonappmoove.png' },
    ],
    progress: 0,
    rawLabels: ['bug', 'PAINEL'],
  },
  {
    id: '#242',
    projectId: 1,
    githubNumber: 242,
    title: 'Edição de hotel cruza campos: thumbnail recebe URL de site, website recebe link do Maps e description recebe o subtítulo',
    description: 'Formulário de edição de hotéis trocando campos no payload.',
    dateStr: '18 Ago 2026',
    createdAtIso: '2026-08-18T11:20:00Z',
    durationDays: 32,
    tag: 'bug',
    tagColor: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    priority: 'Alta',
    priorityColor: '#ef4444',
    status: 'A Fazer',
    rawState: 'open',
    author: 'nelsonappmoove',
    commentsCount: 0,
    assignees: [
      { name: 'nelsonappmoove', initial: 'N', avatarBg: '#10b981', avatarUrl: 'https://github.com/identicons/nelsonappmoove.png' },
    ],
    progress: 0,
    rawLabels: ['bug', 'PAINEL'],
  },
  {
    id: '#241',
    projectId: 1,
    githubNumber: 241,
    title: 'Colunas cidade/estado deslocadas em 17 eventos: rua cai em cidade e cidade cai em estado',
    description: 'Parser de geocoding com split incorreto em endereços contendo vírgulas duplas.',
    dateStr: '18 Ago 2026',
    createdAtIso: '2026-08-18T13:45:00Z',
    durationDays: 32,
    tag: 'bug',
    tagColor: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    priority: 'Média',
    priorityColor: '#f59e0b',
    status: 'A Fazer',
    rawState: 'open',
    author: 'nelsonappmoove',
    commentsCount: 0,
    assignees: [
      { name: 'nelsonappmoove', initial: 'N', avatarBg: '#10b981', avatarUrl: 'https://github.com/identicons/nelsonappmoove.png' },
    ],
    progress: 0,
    rawLabels: ['bug', 'PAINEL'],
  },
  {
    id: '#240',
    projectId: 1,
    githubNumber: 240,
    title: 'ReturnForm não grava geo: eventos de retorno ao hotel ficam sem endereco, cidade, estado, coordenada e place_id',
    description: 'Payload de retorno ao hotel não inclui coordenadas calculadas.',
    dateStr: '18 Ago 2026',
    createdAtIso: '2026-08-18T15:10:00Z',
    durationDays: 32,
    tag: 'bug',
    tagColor: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    priority: 'Alta',
    priorityColor: '#ef4444',
    status: 'A Fazer',
    rawState: 'open',
    author: 'nelsonappmoove',
    commentsCount: 0,
    assignees: [
      { name: 'nelsonappmoove', initial: 'N', avatarBg: '#10b981', avatarUrl: 'https://github.com/identicons/nelsonappmoove.png' },
    ],
    progress: 0,
    rawLabels: ['bug', 'PAINEL'],
  },
  {
    id: '#239',
    projectId: 1,
    githubNumber: 239,
    title: 'Backfill de latitude/longitude nos eventos sem coordenada, só onde o geocoding é preciso',
    description: 'Job de enriquecimento de dados geográficos em lote.',
    dateStr: '18 Ago 2026',
    createdAtIso: '2026-08-18T16:30:00Z',
    durationDays: 32,
    tag: 'bug',
    tagColor: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444' },
    priority: 'Média',
    priorityColor: '#f59e0b',
    status: 'A Fazer',
    rawState: 'open',
    author: 'nelsonappmoove',
    commentsCount: 0,
    assignees: [
      { name: 'nelsonappmoove', initial: 'N', avatarBg: '#10b981', avatarUrl: 'https://github.com/identicons/nelsonappmoove.png' },
    ],
    progress: 0,
    rawLabels: ['bug', 'PAINEL'],
  },
  {
    id: '#238',
    projectId: 1,
    githubNumber: 238,
    title: 'Ajuste no design das divs de projetos e tarefas para remover bordas e unificar containers',
    description: 'Refatoração da interface para seguir a identidade visual minimalista sem bordas.',
    dateStr: '17 Ago 2026',
    createdAtIso: '2026-08-17T18:00:00Z',
    durationDays: 33,
    tag: 'UI/UX',
    tagColor: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308' },
    priority: 'Baixa',
    priorityColor: '#22c55e',
    status: 'Concluído',
    rawState: 'closed',
    author: 'walancy',
    commentsCount: 3,
    assignees: [
      { name: 'walancy', initial: 'W', avatarBg: '#8b5cf6' },
    ],
    progress: 100,
    rawLabels: ['frontend', 'UI/UX'],
  },
];

export interface GithubSprintItem {
  id: string;
  number: number;
  title: string;
  durationLabel: string;
  startDateIso: string;
  dueDateIso: string;
  dateRangeLabel: string;
  status: 'Current' | 'Planned' | 'Completed';
}

const SAMPLE_GITHUB_SPRINTS: GithubSprintItem[] = [
  {
    id: 'sprint-2',
    number: 2,
    title: 'Sprint2 - Cadastro e Perfis de Acesso',
    durationLabel: '2 weeks',
    startDateIso: '2026-09-16',
    dueDateIso: '2026-09-29',
    dateRangeLabel: 'Sep 16 - Sep 29',
    status: 'Current',
  },
  {
    id: 'sprint-3',
    number: 3,
    title: 'Sprint3 - Catálogo de Lotes, Motor de Frete e Entrada da Streaming Multicanal',
    durationLabel: '2 weeks',
    startDateIso: '2026-09-30',
    dueDateIso: '2026-10-13',
    dateRangeLabel: 'Sep 30 - Oct 13',
    status: 'Planned',
  },
  {
    id: 'sprint-4',
    number: 4,
    title: 'Sprint4 - Habilitação, Crédito e Player de Streaming',
    durationLabel: '2 weeks',
    startDateIso: '2026-10-14',
    dueDateIso: '2026-10-27',
    dateRangeLabel: 'Oct 14 - Oct 27',
    status: 'Planned',
  },
  {
    id: 'sprint-5',
    number: 5,
    title: 'Sprint5 - Leilão Ao Vivo — Motor de Lances',
    durationLabel: '2 weeks',
    startDateIso: '2026-10-28',
    dueDateIso: '2026-11-10',
    dateRangeLabel: 'Oct 28 - Nov 10',
    status: 'Planned',
  },
  {
    id: 'sprint-6',
    number: 6,
    title: 'Sprint6 - Integração Smart TV Samsung',
    durationLabel: '2 weeks',
    startDateIso: '2026-11-11',
    dueDateIso: '2026-11-24',
    dateRangeLabel: 'Nov 11 - Nov 24',
    status: 'Planned',
  },
  {
    id: 'sprint-7',
    number: 7,
    title: 'Sprint7 - Integração Smart TV LG',
    durationLabel: '2 weeks',
    startDateIso: '2026-11-25',
    dueDateIso: '2026-12-08',
    dateRangeLabel: 'Nov 25 - Dec 08',
    status: 'Planned',
  },
  {
    id: 'sprint-8',
    number: 8,
    title: 'Sprint8 - Testes de Carga do Leilão ao Vivo',
    durationLabel: '2 weeks',
    startDateIso: '2026-12-09',
    dueDateIso: '2026-12-22',
    dateRangeLabel: 'Dec 09 - Dec 22',
    status: 'Planned',
  },
  {
    id: 'sprint-9',
    number: 9,
    title: 'Sprint9 - Otimizações de Latência e Cache Redis',
    durationLabel: '2 weeks',
    startDateIso: '2026-12-23',
    dueDateIso: '2027-01-05',
    dateRangeLabel: 'Dec 23 - Jan 05',
    status: 'Planned',
  },
  {
    id: 'sprint-10',
    number: 10,
    title: 'Sprint10 - App Mobile Flutter e Notificações Push',
    durationLabel: '2 weeks',
    startDateIso: '2027-01-06',
    dueDateIso: '2027-01-19',
    dateRangeLabel: 'Jan 06 - Jan 19',
    status: 'Planned',
  },
  {
    id: 'sprint-11',
    number: 11,
    title: 'Sprint11 - Compliance LGPD e Auditoria de Segurança',
    durationLabel: '2 weeks',
    startDateIso: '2027-01-20',
    dueDateIso: '2027-02-02',
    dateRangeLabel: 'Jan 20 - Feb 02',
    status: 'Planned',
  },
  {
    id: 'sprint-12',
    number: 12,
    title: 'Sprint12 - Lançamento Oficial e Go-Live',
    durationLabel: '2 weeks',
    startDateIso: '2027-02-03',
    dueDateIso: '2027-02-16',
    dateRangeLabel: 'Feb 03 - Feb 16',
    status: 'Planned',
  },
  {
    id: 'sprint-1',
    number: 1,
    title: 'Sprint1 - Setup Inicial e Arquitetura',
    durationLabel: '2 weeks',
    startDateIso: '2026-09-02',
    dueDateIso: '2026-09-15',
    dateRangeLabel: 'Sep 02 - Sep 15',
    status: 'Completed',
  },
];

function getStatusBarColor(status: ProjectIssue['status'], isEffectiveDark: boolean): string {
  if (status === 'Concluído') return '#10b981';
  if (status === 'Em Progresso') return '#f59e0b';
  return isEffectiveDark ? '#444444' : '#cbd5e1';
}

function mapGithubIssueToProjectIssue(gh: any, projectId: number, pulls: any[]): ProjectIssue {
  const labelObjs: Array<{ name: string; color?: string }> = (gh.labels || []).map((l: any) =>
    typeof l === 'string' ? { name: l } : { name: l.name, color: l.color }
  );
  const labelNames = labelObjs.map((l) => l.name);
  const lowerLabels = labelNames.map((l) => l.toLowerCase());

  const priorityLabel = lowerLabels.find((l) => l.startsWith('priority:'));
  const priority: ProjectIssue['priority'] = priorityLabel?.includes('urgente')
    ? 'Urgente'
    : priorityLabel?.includes('alta')
    ? 'Alta'
    : priorityLabel?.includes('baixa')
    ? 'Baixa'
    : 'Média';
  const priorityColor =
    priority === 'Urgente' ? '#dc2626' : priority === 'Alta' ? '#ef4444' : priority === 'Baixa' ? '#22c55e' : '#f59e0b';

  const hasInProgress = lowerLabels.includes('em-progresso');
  const status: ProjectIssue['status'] = gh.state === 'closed' ? 'Concluído' : hasInProgress ? 'Em Progresso' : 'A Fazer';

  const tagLabelObj = labelObjs.find((l) => {
    const name = l.name.toLowerCase();
    return !name.startsWith('priority:') && name !== 'em-progresso';
  });
  const tagName = tagLabelObj?.name || 'Geral';
  const tagColor =
    TAG_LABEL_STYLE[tagName.toLowerCase()] ||
    (tagLabelObj?.color
      ? { bg: hexToRgba(`#${tagLabelObj.color}`, 0.15), text: `#${tagLabelObj.color}` }
      : { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' });

  const createdAt = gh.created_at ? new Date(gh.created_at) : new Date();
  const closedAt = gh.closed_at ? new Date(gh.closed_at) : null;
  const endReference = closedAt || new Date();
  const daysOpen = Math.max(1, Math.round((endReference.getTime() - createdAt.getTime()) / 86400000));

  const assigneeList: any[] = gh.assignees && gh.assignees.length > 0 ? gh.assignees : gh.assignee ? [gh.assignee] : [];
  const assignees = assigneeList.map((a: any) => ({
    name: a.login,
    initial: (a.login || '?').charAt(0).toUpperCase(),
    avatarBg: '#6366f1',
    avatarUrl: a.avatar_url,
  }));

  // Best-effort link to a pull request that mentions "#<issue number>" in its title or body.
  const matchedPull = (pulls || []).find((pr: any) => {
    const text = `${pr.title || ''} ${pr.body || ''}`.toLowerCase();
    return text.includes(`#${gh.number}`);
  });
  const pullRequest = matchedPull
    ? {
        number: matchedPull.number,
        title: matchedPull.title,
        branch: matchedPull.head?.ref || '',
        status: (matchedPull.merged_at ? 'merged' : matchedPull.draft ? 'draft' : 'open') as 'open' | 'merged' | 'draft',
        reviewStatus: (matchedPull.merged_at ? 'approved' : 'review_required') as 'approved' | 'review_required',
        url: matchedPull.html_url,
      }
    : undefined;

  // Datas de início/término vêm da sprint (milestone) atribuída à issue, não da própria issue.
  const milestone = gh.milestone;
  const startDateIso = milestone ? parseSprintStart(milestone.description) : undefined;
  const dueDateIso = milestone?.due_on ? toIsoDateOnly(milestone.due_on) : undefined;

  return {
    id: `#${gh.number}`,
    projectId,
    githubNumber: gh.number,
    nodeId: gh.node_id,
    htmlUrl: gh.html_url,
    rawLabels: labelNames,
    rawState: (gh.state === 'closed' ? 'closed' : 'open') as 'open' | 'closed',
    author: gh.user?.login || 'gh-user',
    authorAvatarUrl: gh.user?.avatar_url,
    commentsCount: gh.comments || 0,
    title: gh.title,
    description: gh.body || '',
    dateStr: createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
    createdAtIso: createdAt.toISOString(),
    durationDays: daysOpen,
    startDateIso,
    dueDateIso,
    milestoneNumber: milestone?.number,
    milestoneTitle: milestone?.title,
    tag: tagName,
    tagColor,
    priority,
    priorityColor,
    status,
    assignees,
    progress: status === 'Concluído' ? 100 : status === 'Em Progresso' ? 50 : 0,
    pullRequest,
  };
}

export const ProjectsSchedulerView: React.FC<ProjectsSchedulerViewProps> = ({
  accentColor: propAccentColor,
  isEffectiveDark: propIsEffectiveDark,
  themeTokens,
}) => {
  const accentColor = propAccentColor || localStorage.getItem('ide_accent_color') || '#FF6A00';
  const isEffectiveDark = propIsEffectiveDark !== undefined
    ? propIsEffectiveDark
    : (localStorage.getItem('ide_theme_mode') !== 'light');

  const accentContrastText = getContrastTextColor(accentColor);
  const isAccentContrastDark = accentContrastText === '#000000';

  const theme = {
    bgApp: themeTokens?.bgApp || (isEffectiveDark ? '#000000' : '#eaedf1'),
    bgShelf: isEffectiveDark ? '#101010' : '#ffffff',
    shelfBorder: 'none',
    shelfShadow: isEffectiveDark ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.05)',
    cardBg: isEffectiveDark ? '#181818' : '#f1f5f9',
    cardHoverBg: isEffectiveDark ? '#242424' : '#e2e8f0',
    cardBorder: 'none',
    controlBg: isEffectiveDark ? '#181818' : '#ffffff',
    controlHoverBg: isEffectiveDark ? '#242424' : '#f8fafc',
    controlBorder: 'none',
    dropdownBg: isEffectiveDark ? '#181818' : '#ffffff',
    dropdownShadow: isEffectiveDark ? '0 10px 25px rgba(0, 0, 0, 0.6)' : '0 10px 25px rgba(0, 0, 0, 0.1)',
    dropdownBorder: 'none',
    dropdownItemHover: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
    textPrimary: themeTokens?.textPrimary || (isEffectiveDark ? '#ffffff' : '#0f172a'),
    textSecondary: themeTokens?.textSecondary || (isEffectiveDark ? '#888888' : '#64748b'),
    textMuted: themeTokens?.textMuted || (isEffectiveDark ? '#555555' : '#94a3b8'),
    viewContainerBg: isEffectiveDark ? '#101010' : '#ffffff',
    viewCanvasBg: isEffectiveDark ? '#141414' : '#f8fafc',
    viewCardBg: isEffectiveDark ? '#181818' : '#ffffff',
    viewCardHoverBg: isEffectiveDark ? '#242424' : '#f1f5f9',
    viewCardBorder: 'none',
    viewCardShadow: isEffectiveDark ? 'none' : '0 1px 2px rgba(0, 0, 0, 0.04)',
    tableHeaderBg: isEffectiveDark ? '#181818' : '#f8fafc',
    tableBorder: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.06)',
    modalOverlay: isEffectiveDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)',
    modalBg: isEffectiveDark ? '#161616' : '#ffffff',
    modalBorder: 'none',
    modalShadow: isEffectiveDark ? '0 20px 50px rgba(0, 0, 0, 0.9)' : '0 20px 50px rgba(0, 0, 0, 0.15)',
    modalInputBg: isEffectiveDark ? '#1f1f1f' : '#f8fafc',
    modalInputBorder: 'none',
    avatarBorder: isEffectiveDark ? '#181818' : '#ffffff',
  };
  const [hoveredCardId, setHoveredCardId] = useState<number | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [selectedSection, setSelectedSection] = useState<ProjectSectionId>('sprints');
  const [hoveredSectionId, setHoveredSectionId] = useState<ProjectSectionId | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSprint, setSelectedSprint] = useState('Todas as Linguagens');
  const [selectedStatus, setSelectedStatus] = useState('Todos os Projetos');
  const [selectedVersion, setSelectedVersion] = useState('v2.4 - Produção');
  const [selectedOrg, setSelectedOrg] = useState('Todas');

  // Dados reais do GitHub (usuário, repositórios e organizações)
  const [currentUser, setCurrentUser] = useState<{ login: string; avatarUrl: string } | null>(null);
  const [repos, setRepos] = useState<GithubRepoSummary[]>([]);
  const [orgs, setOrgs] = useState<Array<{ login: string; avatarUrl: string }>>([]);
  const [isLoadingRepos, setIsLoadingRepos] = useState(true);
  const [reposError, setReposError] = useState<string | null>(null);

  // Cache de issues/sprints/time por repositório (chave = "owner/repo"), carregado sob demanda ao selecionar um card
  const [repoDetailsCache, setRepoDetailsCache] = useState<
    Record<
      string,
      { issues: ProjectIssue[]; sprints: SprintOption[]; collaborators: RepoCollaborator[]; isLoading: boolean; error: string | null }
    >
  >({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setIsLoadingRepos(true);
      setReposError(null);
      try {
        const [userRes, reposRes, orgsRes] = await Promise.all([
          window.electronAPI?.github?.getUser?.(),
          window.electronAPI?.github?.fetchRepos?.(),
          window.electronAPI?.github?.fetchOrgs?.(),
        ]);
        if (cancelled) return;
        if (userRes?.success && userRes.user) {
          setCurrentUser({ login: userRes.user.login, avatarUrl: userRes.user.avatarUrl });
        }
        if (reposRes?.success && reposRes.repos) {
          setRepos(reposRes.repos);
        } else {
          setReposError(reposRes?.error || 'Não foi possível carregar seus repositórios do GitHub.');
        }
        if (orgsRes?.success && orgsRes.orgs) {
          setOrgs(orgsRes.orgs);
        }
      } catch (err: any) {
        if (!cancelled) setReposError(err?.message || 'Erro ao carregar dados do GitHub.');
      } finally {
        if (!cancelled) setIsLoadingRepos(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Cards da prateleira superior = repositórios reais do GitHub
  const allCards: ProjectCardData[] = useMemo(() => {
    return repos.map((repo, idx) => {
      const cached = repoDetailsCache[repo.full_name];
      const doneCount = cached ? cached.issues.filter((i) => i.status === 'Concluído').length : 0;
      const inProgressCount = cached ? cached.issues.filter((i) => i.status === 'Em Progresso').length : 0;
      const openCount = cached ? cached.issues.filter((i) => i.status === 'A Fazer').length : repo.open_issues_count;
      const total = cached ? cached.issues.length : 0;
      const percentValue = total > 0 ? Math.round((doneCount / total) * 100) : 0;
      return {
        id: repo.id,
        badge: idx + 1,
        title: repo.name,
        sprint: repo.language || '—',
        percentage: `${percentValue}%`,
        percentValue,
        solidFlex: '1 1 0',
        dottedWidth: 52,
        faintWidth: 36,
        issuesDone: doneCount,
        issuesOpen: openCount,
        issuesInProgress: inProgressCount,
        alertStatus: null,
        org: repo.owner?.login,
        fullName: repo.full_name,
        owner: repo.owner?.login,
        repoName: repo.name,
        htmlUrl: repo.html_url,
      };
    });
  }, [repos, repoDetailsCache]);

  // Opções do filtro de "linguagem" derivadas dos repositórios reais (substitui as sprints fictícias)
  const sprintFilterOptions = useMemo(() => {
    const langs = Array.from(new Set(repos.map((r) => r.language).filter(Boolean))) as string[];
    return ['Todas as Linguagens', ...langs.sort()];
  }, [repos]);

  // Organizações reais do usuário + conta pessoal
  const organizationOptions: OrganizationOption[] = useMemo(() => {
    const list: OrganizationOption[] = [{ id: 'all', name: 'Todas', slug: 'all', avatarColor: '#6366f1' }];
    if (currentUser) {
      list.push({
        id: currentUser.login,
        name: currentUser.login,
        slug: `@${currentUser.login}`,
        avatarColor: accentColor,
        avatarUrl: currentUser.avatarUrl,
      });
    }
    orgs.forEach((o) => {
      list.push({ id: o.login, name: o.login, slug: `@${o.login}`, avatarColor: '#0ea5e9', avatarUrl: o.avatarUrl });
    });
    return list;
  }, [orgs, currentUser, accentColor]);

  // Seleciona automaticamente o primeiro repositório assim que a lista carrega
  useEffect(() => {
    if (selectedCardId === null && allCards.length > 0) {
      setSelectedCardId(allCards[0].id);
    }
  }, [allCards, selectedCardId]);

  // Busca as issues (e PRs) reais do repositório selecionado, com cache por repositório
  useEffect(() => {
    const card = allCards.find((c) => c.id === selectedCardId);
    if (!card || !card.owner || !card.repoName || !card.fullName) return;
    const existing = repoDetailsCache[card.fullName];
    if (existing) return; // já carregado (ou carregando)

    const fullName = card.fullName;
    const owner = card.owner;
    const repoName = card.repoName;
    setRepoDetailsCache((prev) => ({
      ...prev,
      [fullName]: { issues: [], sprints: [], collaborators: [], isLoading: true, error: null },
    }));

    (async () => {
      try {
        const [issuesRes, pullsRes, milestonesRes, collaboratorsRes] = await Promise.all([
          window.electronAPI?.github?.fetchRepoIssues?.(owner, repoName),
          window.electronAPI?.github?.fetchRepoPulls?.(owner, repoName),
          window.electronAPI?.github?.fetchRepoMilestones?.(owner, repoName),
          window.electronAPI?.github?.fetchRepoCollaborators?.(owner, repoName),
        ]);
        if (!issuesRes?.success) throw new Error(issuesRes?.error || 'Falha ao buscar issues do repositório.');
        const pulls = pullsRes?.success ? pullsRes.pulls || [] : [];
        const mapped = (issuesRes.issues || []).map((gh: any) => mapGithubIssueToProjectIssue(gh, card.id, pulls));
        const sprints: SprintOption[] = milestonesRes?.success
          ? (milestonesRes.milestones || []).map((m: any) => ({
              number: m.number,
              title: m.title,
              state: m.state,
              startDateIso: parseSprintStart(m.description),
              dueDateIso: m.due_on ? toIsoDateOnly(m.due_on) : undefined,
              openIssues: m.open_issues ?? 0,
              closedIssues: m.closed_issues ?? 0,
            }))
          : [];
        const collaborators: RepoCollaborator[] = collaboratorsRes?.success
          ? (collaboratorsRes.collaborators || []).map((c: any) => ({
              login: c.login,
              avatarUrl: c.avatar_url,
              htmlUrl: c.html_url,
              contributions: c.contributions,
            }))
          : [];
        setRepoDetailsCache((prev) => ({
          ...prev,
          [fullName]: { issues: mapped, sprints, collaborators, isLoading: false, error: null },
        }));
      } catch (err: any) {
        setRepoDetailsCache((prev) => ({
          ...prev,
          [fullName]: { issues: [], sprints: [], collaborators: [], isLoading: false, error: err?.message || 'Erro ao buscar dados do repositório.' },
        }));
      }
    })();
  }, [selectedCardId, allCards, repoDetailsCache]);

  const [sprintDropdownOpen, setSprintDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [versionDropdownOpen, setVersionDropdownOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

  // Estados para as funcionalidades de GitHub
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [isReleaseNotesModalOpen, setIsReleaseNotesModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [openIssueMenuId, setOpenIssueMenuId] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3200);
  };

  const handleOpenIssueInGithub = (issue: ProjectIssue) => {
    if (!issue.htmlUrl) {
      showToast('Link da issue indispon\u00edvel.');
      return;
    }
    window.electronAPI?.shell?.openExternal?.(issue.htmlUrl);
  };

  const handleCopyIssueLink = (issue: ProjectIssue) => {
    if (!issue.htmlUrl) return;
    navigator.clipboard?.writeText(issue.htmlUrl);
    showToast('Link da issue copiado.');
  };

  const handleCreateOrCopyBranch = (issue: ProjectIssue) => {
    const slug = issue.title
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
    const branchName = `feature/${issue.id.toLowerCase()}-${slug}`;
    const cmd = `git checkout -b ${branchName}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(cmd);
    }
    showToast(`Branch copiada: ${cmd}`);
  };

  // Estados para a visualização de Issues/Tarefas do Projeto Selecionado
  const [viewMode, setViewMode] = useState<'timeline' | 'kanban' | 'spreadsheet'>('timeline');

  // Zoom da Timeline: define quantos dias reais são exibidos, sempre incluindo hoje
  const [timelineZoom, setTimelineZoom] = useState<'week' | 'twoWeeks' | 'month'>('month');

  const timelineDays = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (timelineZoom === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1);
      const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
      const days: Date[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(new Date(d));
      }
      return days;
    }

    const count = timelineZoom === 'week' ? 7 : 14;
    const dayOfWeek = today.getDay(); // 0 = domingo .. 6 = sábado
    const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setDate(today.getDate() + diffToMonday);
    const days: Date[] = [];
    for (let i = 0; i < count; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push(d);
    }
    return days;
  }, [timelineZoom]);

  const timelineColWidth = timelineZoom === 'month' ? 68 : 130;

  const todayStart = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  // Posiciona uma issue na timeline com base na data real de criação, recortando nas bordas do intervalo visível
  const getIssueTimelinePosition = (
    issue: ProjectIssue,
    days: Date[]
  ): { leftPercent: number; widthPercent: number } | null => {
    if (days.length === 0) return null;
    // Prioriza as datas definidas manualmente pelo usuário; cai para created_at/duração real como fallback.
    const effectiveStart = issue.startDateIso ? new Date(`${issue.startDateIso}T00:00:00`) : new Date(issue.createdAtIso);
    effectiveStart.setHours(0, 0, 0, 0);
    const rangeStart = days[0];
    const totalDays = days.length;

    let startIdx = Math.round((effectiveStart.getTime() - rangeStart.getTime()) / 86400000);
    let span: number;
    if (issue.dueDateIso) {
      const dueDate = new Date(`${issue.dueDateIso}T00:00:00`);
      dueDate.setHours(0, 0, 0, 0);
      span = Math.max(1, Math.round((dueDate.getTime() - effectiveStart.getTime()) / 86400000) + 1);
    } else {
      span = Math.max(1, issue.durationDays);
    }

    if (startIdx + span <= 0) return null; // termina antes do intervalo visível
    if (startIdx >= totalDays) return null; // começa depois do intervalo visível

    if (startIdx < 0) {
      span += startIdx;
      startIdx = 0;
    }
    span = Math.max(1, Math.min(span, totalDays - startIdx));

    return {
      leftPercent: (startIdx / totalDays) * 100,
      widthPercent: (span / totalDays) * 100,
    };
  };
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('Todas');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [sortMode, setSortMode] = useState<'default' | 'priority' | 'date'>('default');
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);

  // Campos do formulário de nova tarefa (fluxo inspirado no "Create new issue" do GitHub)
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskTag, setNewTaskTag] = useState('Research');
  const [newTaskPriority, setNewTaskPriority] = useState<'Baixa' | 'Média' | 'Alta' | 'Urgente'>('Média');
  const [newTaskStatus, setNewTaskStatus] = useState<'A Fazer' | 'Em Progresso' | 'Concluído'>('Em Progresso');
  const [newTaskMilestoneNumber, setNewTaskMilestoneNumber] = useState<number | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);

  // Edição de tarefa existente
  const [editingIssue, setEditingIssue] = useState<ProjectIssue | null>(null);
  const [editIssueTitle, setEditIssueTitle] = useState('');
  const [editIssueDescription, setEditIssueDescription] = useState('');
  const [editIssueTag, setEditIssueTag] = useState('Research');
  const [editIssuePriority, setEditIssuePriority] = useState<'Baixa' | 'Média' | 'Alta' | 'Urgente'>('Média');
  const [editIssueMilestoneNumber, setEditIssueMilestoneNumber] = useState<number | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  // Criação de nova sprint (milestone real do GitHub)
  const [isCreateSprintModalOpen, setIsCreateSprintModalOpen] = useState(false);
  const [sprintCreationContext, setSprintCreationContext] = useState<'create' | 'edit' | null>(null);
  const [newSprintTitle, setNewSprintTitle] = useState('');
  const [newSprintDuration, setNewSprintDuration] = useState<7 | 15>(7);
  const [newSprintStartDate, setNewSprintStartDate] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  });
  const [isCreatingSprint, setIsCreatingSprint] = useState(false);

  // Filtragem dinâmica de cards do shelf superior (agora repositórios reais)
  const filteredCards = allCards.filter((card) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = card.title.toLowerCase().includes(q);
      const matchesSprint = card.sprint.toLowerCase().includes(q);
      const matchesBadge = card.badge.toString() === q;
      if (!matchesTitle && !matchesSprint && !matchesBadge) return false;
    }

    if (selectedSprint !== 'Todas as Linguagens') {
      if (card.sprint.toLowerCase() !== selectedSprint.toLowerCase()) return false;
    }

    if (selectedStatus === 'Em Andamento (<90%)') {
      if (card.percentValue >= 90) return false;
    } else if (selectedStatus === 'Fase Final (≥90%)') {
      if (card.percentValue < 90) return false;
    }

    if (selectedOrg !== 'Todas') {
      if (card.org && card.org !== selectedOrg) return false;
    }

    return true;
  });

  // Projeto (repositório) atualmente selecionado
  const selectedProject = allCards.find((p) => p.id === selectedCardId) || allCards[0];
  const selectedRepoDetail = selectedProject?.fullName ? repoDetailsCache[selectedProject.fullName] : undefined;
  const isLoadingProjectIssues = !!selectedRepoDetail?.isLoading;
  const projectIssuesError = selectedRepoDetail?.error || null;
  const rawProjectIssues = selectedRepoDetail?.issues || [];
  const sprintsForSelectedRepo = selectedRepoDetail?.sprints || [];
  const collaboratorsForSelectedRepo = selectedRepoDetail?.collaborators || [];
  const selectedRepoRaw = repos.find((r) => r.full_name === selectedProject?.fullName);

  // Riscos = issues abertas com prioridade Alta ou Urgente (não existe conceito nativo de "risco" no GitHub)
  const riskIssues = useMemo(
    () => rawProjectIssues.filter((i) => i.status !== 'Concluído' && (i.priority === 'Alta' || i.priority === 'Urgente')),
    [rawProjectIssues]
  );

  // Links customizados por repositório, persistidos localmente (GitHub não tem um conceito de "links do projeto")
  const [customLinks, setCustomLinks] = useState<Record<string, Array<{ id: string; label: string; url: string }>>>(() => {
    try {
      const saved = localStorage.getItem('ide_project_custom_links');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [newLinkLabel, setNewLinkLabel] = useState('');
  const [newLinkUrl, setNewLinkUrl] = useState('');

  const persistCustomLinks = (next: Record<string, Array<{ id: string; label: string; url: string }>>) => {
    setCustomLinks(next);
    try {
      localStorage.setItem('ide_project_custom_links', JSON.stringify(next));
    } catch {}
  };

  const handleAddCustomLink = () => {
    if (!newLinkLabel.trim() || !newLinkUrl.trim() || !selectedProject?.fullName) return;
    const key = selectedProject.fullName;
    const entry = { id: `${Date.now()}`, label: newLinkLabel.trim(), url: newLinkUrl.trim() };
    persistCustomLinks({ ...customLinks, [key]: [...(customLinks[key] || []), entry] });
    setNewLinkLabel('');
    setNewLinkUrl('');
  };

  const handleRemoveCustomLink = (id: string) => {
    if (!selectedProject?.fullName) return;
    const key = selectedProject.fullName;
    persistCustomLinks({ ...customLinks, [key]: (customLinks[key] || []).filter((l) => l.id !== id) });
  };

  // Issues filtradas para o projeto selecionado
  const projectIssues = useMemo(() => {
    let list = rawProjectIssues;
    if (taskSearchQuery.trim()) {
      const q = taskSearchQuery.toLowerCase();
      list = list.filter(
        (iss) =>
          iss.title.toLowerCase().includes(q) ||
          iss.tag.toLowerCase().includes(q) ||
          iss.id.toLowerCase().includes(q)
      );
    }
    if (selectedAssignee) {
      list = list.filter((iss) => iss.assignees.some((a) => a.name === selectedAssignee));
    }
    if (selectedPriorityFilter !== 'Todas') {
      list = list.filter((iss) => iss.priority === selectedPriorityFilter);
    }
    if (sortMode === 'priority') {
      const weight: Record<string, number> = { Urgente: 4, Alta: 3, Média: 2, Baixa: 1 };
      list = [...list].sort((a, b) => (weight[b.priority] || 0) - (weight[a.priority] || 0));
    } else if (sortMode === 'date') {
      list = [...list].sort((a, b) => new Date(a.createdAtIso).getTime() - new Date(b.createdAtIso).getTime());
    }
    return list;
  }, [rawProjectIssues, taskSearchQuery, selectedAssignee, selectedPriorityFilter, sortMode]);

  const resetNewTaskForm = () => {
    setNewTaskTitle('');
    setNewTaskDescription('');
    setNewTaskTag('Research');
    setNewTaskPriority('Média');
    setNewTaskStatus('Em Progresso');
    setNewTaskMilestoneNumber(null);
  };

  // =========================================================================
  // ESTADOS E FILTROS PARA A TELA DE ISSUES (PADRÃO GITHUB COM DESIGN NATIVO)
  // =========================================================================
  const [issuesSidebarTab, setIssuesSidebarTab] = useState<
    'all' | 'assigned' | 'created' | 'mentioned' | 'recent' | 'views' | 'projects' | 'milestones' | 'labels'
  >('all');
  const [issuesStateFilter, setIssuesStateFilter] = useState<'open' | 'closed'>('open');
  const [issuesSearchQuery, setIssuesSearchQuery] = useState('');
  const [selectedIssueCheckboxes, setSelectedIssueCheckboxes] = useState<Set<string>>(new Set());
  const [activeIssuesDropdown, setActiveIssuesDropdown] = useState<
    'author' | 'label' | 'milestones' | 'assignee' | 'sort' | null
  >(null);
  const [selectedAuthorFilter, setSelectedAuthorFilter] = useState<string>('all');
  const [selectedLabelFilter, setSelectedLabelFilter] = useState<string>('all');
  const [selectedAssigneeFilter, setSelectedAssigneeFilter] = useState<string>('all');
  const [issuesSortMode, setIssuesSortMode] = useState<'newest' | 'oldest' | 'comments'>('newest');
  const [hoveredIssueId, setHoveredIssueId] = useState<string | null>(null);

  // Issues combinadas: usa issues reais do repositório selecionado se existirem,
  // ou os dados realistas de exemplo do GitHub da captura de tela enviada pelo usuário
  const combinedGithubIssues = useMemo(() => {
    if (rawProjectIssues && rawProjectIssues.length > 0) {
      return rawProjectIssues;
    }
    return SAMPLE_GITHUB_ISSUES;
  }, [rawProjectIssues]);

  const openIssuesCount = useMemo(() => {
    return combinedGithubIssues.filter((i) => i.rawState !== 'closed' && i.status !== 'Concluído').length;
  }, [combinedGithubIssues]);

  const closedIssuesCount = useMemo(() => {
    return combinedGithubIssues.filter((i) => i.rawState === 'closed' || i.status === 'Concluído').length;
  }, [combinedGithubIssues]);

  const uniqueAuthors = useMemo(() => {
    const authors = new Set<string>();
    combinedGithubIssues.forEach((i) => {
      if (i.author) authors.add(i.author);
    });
    return Array.from(authors);
  }, [combinedGithubIssues]);

  const uniqueLabels = useMemo(() => {
    const labels = new Set<string>();
    combinedGithubIssues.forEach((i) => {
      if (i.rawLabels) i.rawLabels.forEach((l) => labels.add(l));
      if (i.tag) labels.add(i.tag);
    });
    return Array.from(labels);
  }, [combinedGithubIssues]);

  const uniqueAssignees = useMemo(() => {
    const map = new Map<string, { name: string; avatarUrl?: string }>();
    combinedGithubIssues.forEach((i) => {
      i.assignees.forEach((a) => {
        if (!map.has(a.name)) map.set(a.name, { name: a.name, avatarUrl: a.avatarUrl });
      });
    });
    return Array.from(map.values());
  }, [combinedGithubIssues]);

  const filteredGithubIssues = useMemo(() => {
    let list = combinedGithubIssues;

    // Filtro por Estado (open vs closed)
    if (issuesStateFilter === 'open') {
      list = list.filter((i) => i.rawState !== 'closed' && i.status !== 'Concluído');
    } else {
      list = list.filter((i) => i.rawState === 'closed' || i.status === 'Concluído');
    }

    // Filtro por Tab da Sidebar
    if (issuesSidebarTab === 'assigned') {
      const me = currentUser?.login?.toLowerCase() || 'nelsonappmoove';
      list = list.filter((i) => i.assignees.some((a) => a.name.toLowerCase().includes(me)));
    } else if (issuesSidebarTab === 'created') {
      const me = currentUser?.login?.toLowerCase() || 'nelsonappmoove';
      list = list.filter((i) => (i.author || '').toLowerCase().includes(me));
    } else if (issuesSidebarTab === 'mentioned') {
      list = list.filter((i) => (i.commentsCount || 0) > 0);
    }

    // Filtro por Query de Busca
    if (issuesSearchQuery.trim()) {
      const q = issuesSearchQuery.toLowerCase();
      list = list.filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          i.description.toLowerCase().includes(q) ||
          (i.author || '').toLowerCase().includes(q) ||
          (i.rawLabels || []).some((l) => l.toLowerCase().includes(q)) ||
          String(i.githubNumber || '').includes(q) ||
          i.id.toLowerCase().includes(q)
      );
    }

    // Filtro por Autor selecionado no dropdown
    if (selectedAuthorFilter !== 'all') {
      list = list.filter((i) => (i.author || '').toLowerCase() === selectedAuthorFilter.toLowerCase());
    }

    // Filtro por Label selecionada no dropdown
    if (selectedLabelFilter !== 'all') {
      list = list.filter(
        (i) =>
          (i.rawLabels || []).some((l) => l.toLowerCase() === selectedLabelFilter.toLowerCase()) ||
          i.tag.toLowerCase() === selectedLabelFilter.toLowerCase()
      );
    }

    // Filtro por Assignee selecionado no dropdown
    if (selectedAssigneeFilter !== 'all') {
      list = list.filter((i) =>
        i.assignees.some((a) => a.name.toLowerCase() === selectedAssigneeFilter.toLowerCase())
      );
    }

    // Ordenação
    const sorted = [...list];
    if (issuesSortMode === 'newest') {
      sorted.sort((a, b) => new Date(b.createdAtIso).getTime() - new Date(a.createdAtIso).getTime());
    } else if (issuesSortMode === 'oldest') {
      sorted.sort((a, b) => new Date(a.createdAtIso).getTime() - new Date(b.createdAtIso).getTime());
    } else if (issuesSortMode === 'comments') {
      sorted.sort((a, b) => (b.commentsCount || 0) - (a.commentsCount || 0));
    }

    return sorted;
  }, [
    combinedGithubIssues,
    issuesStateFilter,
    issuesSidebarTab,
    issuesSearchQuery,
    selectedAuthorFilter,
    selectedLabelFilter,
    selectedAssigneeFilter,
    issuesSortMode,
    currentUser,
  ]);

  const handleToggleSelectAllIssues = () => {
    if (selectedIssueCheckboxes.size === filteredGithubIssues.length && filteredGithubIssues.length > 0) {
      setSelectedIssueCheckboxes(new Set());
    } else {
      setSelectedIssueCheckboxes(new Set(filteredGithubIssues.map((i) => i.id)));
    }
  };

  const handleToggleIssueCheckbox = (issueId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIssueCheckboxes((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) {
        next.delete(issueId);
      } else {
        next.add(issueId);
      }
      return next;
    });
  };

  // =========================================================================
  // ESTADOS E DADOS PARA A TELA DE SPRINTS (PADRÃO GITHUB ITERATIONS SETTINGS)
  // =========================================================================
  const [sprintFieldName, setSprintFieldName] = useState('Sprint');
  const [sprintsTab, setSprintsTab] = useState<'active' | 'completed'>('active');
  const [sprintMoreOptionsOpen, setSprintMoreOptionsOpen] = useState(false);
  const [customSprintsList, setCustomSprintsList] = useState<GithubSprintItem[]>(SAMPLE_GITHUB_SPRINTS);
  const [hoveredSprintRowId, setHoveredSprintRowId] = useState<string | null>(null);

  const combinedSprints = useMemo<GithubSprintItem[]>(() => {
    if (sprintsForSelectedRepo && sprintsForSelectedRepo.length > 0) {
      const todayIso = new Date().toISOString().slice(0, 10);
      return sprintsForSelectedRepo.map((sp) => {
        const isClosed = sp.state === 'closed';
        const isCurrent =
          !isClosed &&
          sp.startDateIso &&
          sp.dueDateIso &&
          todayIso >= sp.startDateIso &&
          todayIso <= sp.dueDateIso;
        const status: GithubSprintItem['status'] = isClosed ? 'Completed' : isCurrent ? 'Current' : 'Planned';
        const startFmt = sp.startDateIso ? formatShortDate(sp.startDateIso) : '';
        const dueFmt = sp.dueDateIso ? formatShortDate(sp.dueDateIso) : '';
        const dateRangeLabel =
          startFmt && dueFmt ? `${startFmt} - ${dueFmt}` : startFmt || dueFmt || 'Sem data definida';
        return {
          id: `sprint-${sp.number}`,
          number: sp.number,
          title: sp.title,
          durationLabel: '2 weeks',
          startDateIso: sp.startDateIso || '',
          dueDateIso: sp.dueDateIso || '',
          dateRangeLabel,
          status,
        };
      });
    }
    return customSprintsList;
  }, [sprintsForSelectedRepo, customSprintsList]);

  const activeSprintsCount = useMemo(() => {
    return combinedSprints.filter((s) => s.status !== 'Completed').length;
  }, [combinedSprints]);

  const completedSprintsCount = useMemo(() => {
    return combinedSprints.filter((s) => s.status === 'Completed').length;
  }, [combinedSprints]);

  const displayedSprints = useMemo(() => {
    if (sprintsTab === 'active') {
      return combinedSprints.filter((s) => s.status !== 'Completed');
    }
    return combinedSprints.filter((s) => s.status === 'Completed');
  }, [combinedSprints, sprintsTab]);

  const handleDeleteSprint = (sprintId: string) => {
    setCustomSprintsList((prev) => prev.filter((s) => s.id !== sprintId));
    showToast('Iteração/Sprint removida.');
  };

  const handleCreateTask = async () => {
    if (!newTaskTitle.trim() || isCreatingTask) return;
    const card = selectedProject;
    if (!card || !card.owner || !card.repoName || !card.fullName) {
      showToast('Selecione um repositório antes de criar uma tarefa.');
      return;
    }
    const fullName = card.fullName;
    const owner = card.owner;
    const repoName = card.repoName;
    const title = newTaskTitle.trim();
    const status = newTaskStatus;
    const labels = [
      { name: newTaskTag, color: TAG_LABEL_COLOR[newTaskTag] || '3b82f6' },
      PRIORITY_LABELS[newTaskPriority],
      ...(status === 'Em Progresso' ? [IN_PROGRESS_LABEL] : []),
    ];

    setIsCreatingTask(true);
    try {
      const res = await window.electronAPI?.github?.createIssue?.(owner, repoName, {
        title,
        body: newTaskDescription.trim(),
        labels,
        assignees: currentUser ? [currentUser.login] : [],
        milestone: newTaskMilestoneNumber ?? undefined,
      });
      if (!res?.success || !res.issue) throw new Error(res?.error || 'Falha ao criar issue no GitHub.');

      let ghIssue = res.issue;
      if (status === 'Concluído') {
        const closeRes = await window.electronAPI?.github?.updateIssue?.(owner, repoName, ghIssue.number, { state: 'closed' });
        if (closeRes?.success && closeRes.issue) ghIssue = closeRes.issue;
      }

      const mapped = mapGithubIssueToProjectIssue(ghIssue, card.id, []);
      setRepoDetailsCache((prev) => ({
        ...prev,
        [fullName]: {
          issues: [mapped, ...(prev[fullName]?.issues || [])],
          sprints: prev[fullName]?.sprints || [],
          collaborators: prev[fullName]?.collaborators || [],
          isLoading: false,
          error: null,
        },
      }));
      showToast(`Issue #${ghIssue.number} criada no GitHub.`);
      setIsAddTaskModalOpen(false);
      resetNewTaskForm();
    } catch (err: any) {
      showToast(err?.message || 'Erro ao criar a tarefa no GitHub.');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleToggleIssueStatus = async (issueId: string) => {
    const card = selectedProject;
    const issue = rawProjectIssues.find((i) => i.id === issueId);
    if (!card || !card.owner || !card.repoName || !card.fullName || !issue || issue.githubNumber == null) return;

    const fullName = card.fullName;
    const owner = card.owner;
    const repoName = card.repoName;
    const nextStatus: 'A Fazer' | 'Em Progresso' | 'Concluído' =
      issue.status === 'A Fazer' ? 'Em Progresso' : issue.status === 'Em Progresso' ? 'Concluído' : 'A Fazer';
    const nextLabels = (issue.rawLabels || []).filter((l) => l.toLowerCase() !== 'em-progresso');
    if (nextStatus === 'Em Progresso') nextLabels.push(IN_PROGRESS_LABEL.name);
    const nextState: 'open' | 'closed' = nextStatus === 'Concluído' ? 'closed' : 'open';

    // Atualização otimista da UI
    setRepoDetailsCache((prev) => {
      const list = prev[fullName]?.issues || [];
      return {
        ...prev,
        [fullName]: {
          issues: list.map((i) =>
            i.id === issueId
              ? {
                  ...i,
                  status: nextStatus,
                  progress: nextStatus === 'Concluído' ? 100 : nextStatus === 'Em Progresso' ? 50 : 0,
                  rawLabels: nextLabels,
                }
              : i
          ),
          sprints: prev[fullName]?.sprints || [],
          collaborators: prev[fullName]?.collaborators || [],
          isLoading: false,
          error: null,
        },
      };
    });

    try {
      const res = await window.electronAPI?.github?.updateIssue?.(owner, repoName, issue.githubNumber, {
        state: nextState,
        labels: nextLabels,
      });
      if (!res?.success) throw new Error(res?.error || 'Falha ao atualizar a issue no GitHub.');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao atualizar status no GitHub.');
    }
  };

  const handleOpenEditIssue = (issue: ProjectIssue) => {
    setEditingIssue(issue);
    setEditIssueTitle(issue.title);
    setEditIssueDescription(issue.description);
    setEditIssueTag(issue.tag);
    setEditIssuePriority(issue.priority);
    setEditIssueMilestoneNumber(issue.milestoneNumber ?? null);
  };

  const handleSaveEditIssue = async () => {
    if (!editingIssue || !editIssueTitle.trim() || isSavingEdit) return;
    const card = allCards.find((c) => c.id === editingIssue.projectId);
    if (!card || !card.owner || !card.repoName || !card.fullName || editingIssue.githubNumber == null) return;

    const fullName = card.fullName;
    const owner = card.owner;
    const repoName = card.repoName;
    const issueNumber = editingIssue.githubNumber;
    const title = editIssueTitle.trim();
    const body = editIssueDescription.trim();

    // Substitui a label de tag/prioridade antigas pelas novas, preservando as demais (ex.: em-progresso)
    const preservedLabels = (editingIssue.rawLabels || []).filter((l) => {
      const lower = l.toLowerCase();
      return lower !== editingIssue.tag.toLowerCase() && !lower.startsWith('priority:');
    });
    const nextLabels = [...preservedLabels, editIssueTag, PRIORITY_LABELS[editIssuePriority].name];
    const ensureLabels = [
      { name: editIssueTag, color: TAG_LABEL_COLOR[editIssueTag] || '3b82f6' },
      PRIORITY_LABELS[editIssuePriority],
    ];

    setIsSavingEdit(true);
    try {
      const res = await window.electronAPI?.github?.updateIssue?.(owner, repoName, issueNumber, {
        title,
        body,
        labels: nextLabels,
        ensureLabels,
        milestone: editIssueMilestoneNumber,
      });
      if (!res?.success || !res.issue) throw new Error(res?.error || 'Falha ao salvar alterações no GitHub.');

      const mapped = mapGithubIssueToProjectIssue(res.issue, card.id, []);
      setRepoDetailsCache((prev) => ({
        ...prev,
        [fullName]: {
          issues: (prev[fullName]?.issues || []).map((i) => (i.id === editingIssue.id ? mapped : i)),
          sprints: prev[fullName]?.sprints || [],
          collaborators: prev[fullName]?.collaborators || [],
          isLoading: false,
          error: null,
        },
      }));
      showToast('Tarefa atualizada.');
      setEditingIssue(null);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao salvar a tarefa no GitHub.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeleteIssue = async (issue: ProjectIssue) => {
    const card = allCards.find((c) => c.id === issue.projectId);
    if (!card || !card.fullName || !issue.nodeId) {
      showToast('Não foi possível excluir: dados da issue incompletos.');
      return;
    }
    const confirmed = window.confirm(`Excluir a issue "${issue.title}" (${issue.id}) permanentemente no GitHub? Esta ação não pode ser desfeita.`);
    if (!confirmed) return;

    const fullName = card.fullName;
    try {
      const res = await window.electronAPI?.github?.deleteIssue?.(issue.nodeId);
      if (!res?.success) throw new Error(res?.error || 'Falha ao excluir a issue no GitHub.');
      setRepoDetailsCache((prev) => ({
        ...prev,
        [fullName]: {
          issues: (prev[fullName]?.issues || []).filter((i) => i.id !== issue.id),
          sprints: prev[fullName]?.sprints || [],
          collaborators: prev[fullName]?.collaborators || [],
          isLoading: false,
          error: null,
        },
      }));
      showToast(`Issue ${issue.id} excluída.`);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao excluir a issue no GitHub.');
    }
  };

  const openCreateSprintModal = (context: 'create' | 'edit') => {
    const t = new Date();
    setNewSprintTitle('');
    setNewSprintDuration(7);
    setNewSprintStartDate(`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`);
    setSprintCreationContext(context);
    setIsCreateSprintModalOpen(true);
  };

  const handleCreateSprint = async () => {
    if (isCreatingSprint) return;
    const card = selectedProject;
    if (!card || !card.owner || !card.repoName || !card.fullName) {
      showToast('Selecione um repositório antes de criar uma sprint.');
      return;
    }
    const fullName = card.fullName;
    const owner = card.owner;
    const repoName = card.repoName;

    const startDate = new Date(`${newSprintStartDate}T00:00:00`);
    const dueDate = new Date(startDate);
    dueDate.setDate(dueDate.getDate() + newSprintDuration - 1);
    const dueDateIso = `${dueDate.getFullYear()}-${String(dueDate.getMonth() + 1).padStart(2, '0')}-${String(dueDate.getDate()).padStart(2, '0')}`;
    const title =
      newSprintTitle.trim() ||
      `Sprint ${formatShortDate(newSprintStartDate)} - ${formatShortDate(dueDateIso)}`;
    const description = encodeSprintDescription(`Sprint de ${newSprintDuration} dias.`, newSprintStartDate);

    setIsCreatingSprint(true);
    try {
      const res = await window.electronAPI?.github?.createMilestone?.(owner, repoName, {
        title,
        description,
        due_on: dueDate.toISOString(),
      });
      if (!res?.success || !res.milestone) throw new Error(res?.error || 'Falha ao criar sprint no GitHub.');

      const sprint: SprintOption = {
        number: res.milestone.number,
        title: res.milestone.title,
        state: 'open',
        startDateIso: newSprintStartDate,
        dueDateIso,
        openIssues: 0,
        closedIssues: 0,
      };
      setRepoDetailsCache((prev) => ({
        ...prev,
        [fullName]: {
          issues: prev[fullName]?.issues || [],
          sprints: [...(prev[fullName]?.sprints || []), sprint],
          collaborators: prev[fullName]?.collaborators || [],
          isLoading: false,
          error: null,
        },
      }));

      if (sprintCreationContext === 'create') setNewTaskMilestoneNumber(sprint.number);
      if (sprintCreationContext === 'edit') setEditIssueMilestoneNumber(sprint.number);

      showToast(`Sprint "${sprint.title}" criada.`);
      setIsCreateSprintModalOpen(false);
      setSprintCreationContext(null);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao criar a sprint no GitHub.');
    } finally {
      setIsCreatingSprint(false);
    }
  };

  const nextStatusLabel = (issue: ProjectIssue) =>
    issue.status === 'A Fazer' ? 'Marcar como Em Progresso' : issue.status === 'Em Progresso' ? 'Marcar como Concluída' : 'Reabrir tarefa';

  const renderIssueOptionsButton = (issue: ProjectIssue, iconSize: number) => (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div
        onClick={(e) => {
          e.stopPropagation();
          setOpenIssueMenuId((prev) => (prev === issue.id ? null : issue.id));
        }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 2, borderRadius: 4, cursor: 'pointer' }}
        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
      >
        <MoreVertical size={iconSize} color={theme.textSecondary} />
      </div>
      {openIssueMenuId === issue.id && (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            right: 0,
            background: theme.dropdownBg,
            borderRadius: 8,
            padding: 5,
            zIndex: 2000,
            minWidth: 200,
            boxShadow: theme.dropdownShadow,
            display: 'flex',
            flexDirection: 'column',
            gap: 1,
            border: theme.dropdownBorder,
          }}
        >
          {[
            {
              label: nextStatusLabel(issue),
              icon: <CheckCircle2 size={13} />,
              onClick: () => handleToggleIssueStatus(issue.id),
              disabled: false,
            },
            {
              label: 'Copiar comando da branch',
              icon: <GitBranch size={13} />,
              onClick: () => handleCreateOrCopyBranch(issue),
              disabled: false,
            },
            {
              label: 'Copiar link da issue',
              icon: <Copy size={13} />,
              onClick: () => handleCopyIssueLink(issue),
              disabled: !issue.htmlUrl,
            },
            {
              label: 'Abrir no GitHub',
              icon: <ExternalLink size={13} />,
              onClick: () => handleOpenIssueInGithub(issue),
              disabled: !issue.htmlUrl,
            },
            {
              label: 'Editar tarefa',
              icon: <Pencil size={13} />,
              onClick: () => handleOpenEditIssue(issue),
              disabled: false,
              separatorBefore: true,
            },
            {
              label: 'Excluir tarefa',
              icon: <Trash2 size={13} />,
              onClick: () => handleDeleteIssue(issue),
              disabled: !issue.nodeId,
              danger: true,
            },
          ].map((item) => (
            <React.Fragment key={item.label}>
              {item.separatorBefore && (
                <div style={{ height: 1, background: theme.tableBorder, margin: '3px 2px' }} />
              )}
              <div
                onClick={() => {
                  if (item.disabled) return;
                  item.onClick();
                  setOpenIssueMenuId(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 9px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: item.disabled ? theme.textMuted : item.danger ? '#ef4444' : theme.textPrimary,
                  cursor: item.disabled ? 'default' : 'pointer',
                  opacity: item.disabled ? 0.5 : 1,
                  whiteSpace: 'nowrap',
                }}
                onMouseEnter={(e) => {
                  if (!item.disabled) e.currentTarget.style.background = item.danger ? 'rgba(239, 68, 68, 0.1)' : theme.dropdownItemHover;
                }}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                {item.icon}
                <span>{item.label}</span>
              </div>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div
      style={{
        alignSelf: 'stretch',
        flex: '1 1 0',
        width: '100%',
        height: '100%',
        padding: 'clamp(28px, 3.5vh, 44px) clamp(16px, 2vw, 28px) 32px clamp(16px, 2vw, 28px)',
        background: theme.bgApp,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        overflowX: 'hidden',
        overflowY: 'auto',
        boxSizing: 'border-box',
        border: 'none',
        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
      className="no-scrollbar"
      onClick={() => {
        if (sprintDropdownOpen) setSprintDropdownOpen(false);
        if (statusDropdownOpen) setStatusDropdownOpen(false);
        if (versionDropdownOpen) setVersionDropdownOpen(false);
        if (orgDropdownOpen) setOrgDropdownOpen(false);
        if (filterDropdownOpen) setFilterDropdownOpen(false);
        if (openIssueMenuId) setOpenIssueMenuId(null);
      }}
    >
      {/* Bloco Unificado: Controles diretamente em cima da div dos cards */}
      <div
        style={{
          width: '100%',
          maxWidth: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          gap: 16,
          boxSizing: 'border-box',
          margin: '0 auto',
          flex: 1,
          minHeight: 0,
        }}
      >
        {/* Cabeçalho de Controles e Filtros */}
        <div
          style={{
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: '0 4px',
            border: 'none',
            boxSizing: 'border-box',
          }}
        >
          {/* Linha 1: Título "Projetos" */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              border: 'none',
            }}
          >
            {/* Título "Projetos" */}
            <div
              style={{
                fontSize: 26,
                fontWeight: 500,
                color: theme.textPrimary,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
                border: 'none',
              }}
            >
              Projetos
            </div>
          </div>

          {/* Linha 2: [Dropdown de Sprint + Campo de Busca + Filtro por Assignees] à esquerda e [Versão + Status] à direita no canto direito */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 16, border: 'none', flexWrap: 'wrap' }}>
            {/* Lado Esquerdo: Dropdown de Sprint + Campo de Busca + Filtro de Assignees */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, border: 'none', flexWrap: 'wrap' }}>
              {/* Dropdown de Sprint */}
              <div style={{ position: 'relative' }}>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    setSprintDropdownOpen((prev) => !prev);
                    setStatusDropdownOpen(false);
                    setVersionDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '4px 2px',
                    cursor: 'pointer',
                    color: theme.textSecondary,
                    fontSize: 13,
                    fontWeight: 400,
                    border: 'none',
                    transition: 'color 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
                >
                  <span>{selectedSprint}</span>
                  <ChevronDown size={14} color={theme.textSecondary} />
                </div>

                {/* Menu de Sprint */}
                {sprintDropdownOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 6px)',
                      left: 0,
                      background: theme.dropdownBg,
                      borderRadius: 8,
                      padding: 5,
                      zIndex: 1000,
                      minWidth: 170,
                      boxShadow: theme.dropdownShadow,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                      border: theme.dropdownBorder,
                    }}
                  >
                    {sprintFilterOptions.map((opt) => (
                      <div
                        key={opt}
                        onClick={() => {
                          setSelectedSprint(opt);
                          setSprintDropdownOpen(false);
                        }}
                        style={{
                          padding: '6px 10px',
                          borderRadius: 6,
                          fontSize: 12,
                          color: theme.textPrimary,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          background: selectedSprint === opt ? theme.dropdownItemHover : 'transparent',
                          border: 'none',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background =
                            selectedSprint === opt ? theme.dropdownItemHover : 'transparent')
                        }
                      >
                        <span>{opt}</span>
                        {selectedSprint === opt && <Check size={13} color={accentColor} />}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Campo de Busca posicionado à direita do seletor de sprint, aumentado horizontalmente */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  background: theme.controlBg,
                  borderRadius: 9,
                  padding: '0 12px',
                  height: 32,
                  width: 'clamp(280px, 24vw, 420px)',
                  border: theme.controlBorder,
                  transition: 'background 0.15s ease',
                }}
              >
                <Search size={13} color={theme.textSecondary} />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar projeto ou sprint..."
                  style={{
                    border: 'none',
                    outline: 'none',
                    background: 'transparent',
                    color: theme.textPrimary,
                    fontSize: 12.5,
                    fontFamily: 'inherit',
                    width: '100%',
                  }}
                />
              </div>
            </div>

            {/* Grupo da Direita: Versão + Status (no canto direito) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                border: 'none',
              }}
            >
                {/* Seletor de Organização */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 400,
                      color: theme.textSecondary,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Organização
                  </span>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setOrgDropdownOpen((prev) => !prev);
                      setSprintDropdownOpen(false);
                      setStatusDropdownOpen(false);
                      setVersionDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: theme.controlBg,
                      borderRadius: 8,
                      padding: '6px 12px',
                      cursor: 'pointer',
                      border: theme.controlBorder,
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = theme.controlHoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = theme.controlBg)}
                  >
                    {/* Tiny Org avatar / icon */}
                    {selectedOrg !== 'Todas' ? (
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: organizationOptions.find((o) => o.name === selectedOrg)?.avatarColor || accentColor,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 9,
                          color: '#ffffff',
                          fontWeight: 500,
                          flexShrink: 0,
                          overflow: 'hidden',
                        }}
                      >
                        {organizationOptions.find((o) => o.name === selectedOrg)?.avatarUrl ? (
                          <img
                            src={organizationOptions.find((o) => o.name === selectedOrg)?.avatarUrl}
                            alt=""
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                          />
                        ) : (
                          selectedOrg.charAt(0)
                        )}
                      </div>
                    ) : (
                      <Building2 size={13.5} color={theme.textSecondary} />
                    )}
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 400,
                        color: theme.textPrimary,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {selectedOrg}
                    </span>
                    <ChevronDown size={14} color={theme.textSecondary} />
                  </div>

                  {/* Menu de Organização */}
                  {orgDropdownOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        right: 0,
                        background: theme.dropdownBg,
                        borderRadius: 10,
                        padding: 6,
                        zIndex: 1000,
                        minWidth: 220,
                        boxShadow: theme.dropdownShadow,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        border: theme.dropdownBorder,
                      }}
                    >
                      {organizationOptions.map((org) => {
                        const isSelected = selectedOrg === org.name;
                        return (
                          <div
                            key={org.id}
                            onClick={() => {
                              setSelectedOrg(org.name);
                              setOrgDropdownOpen(false);
                            }}
                            style={{
                              padding: '8px 10px',
                              borderRadius: 7,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 10,
                              background: isSelected ? theme.dropdownItemHover : 'transparent',
                              border: 'none',
                              transition: 'background 0.12s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                            onMouseLeave={(e) =>
                              (e.currentTarget.style.background =
                                isSelected ? theme.dropdownItemHover : 'transparent')
                            }
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 9, minWidth: 0 }}>
                              <div
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: '50%',
                                  background: org.avatarColor,
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  fontSize: 10,
                                  color: '#ffffff',
                                  fontWeight: 500,
                                  flexShrink: 0,
                                  overflow: 'hidden',
                                }}
                              >
                                {org.avatarUrl ? (
                                  <img src={org.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : org.id === 'all' ? (
                                  <Building2 size={11} color="#ffffff" />
                                ) : (
                                  org.name.charAt(0)
                                )}
                              </div>
                              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                <span
                                  style={{
                                    fontSize: 12,
                                    fontWeight: isSelected ? 500 : 400,
                                    color: theme.textPrimary,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {org.name}
                                </span>
                                {org.slug !== 'all' && (
                                  <span style={{ fontSize: 10.5, color: theme.textMuted }}>{org.slug}</span>
                                )}
                              </div>
                            </div>
                            {isSelected && <Check size={13} color={accentColor} />}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Seletor de Status (substituindo "Routing" da foto) */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                  <span
                    style={{
                      fontSize: 13,
                      fontWeight: 400,
                      color: theme.textSecondary,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    Status
                  </span>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setStatusDropdownOpen((prev) => !prev);
                      setSprintDropdownOpen(false);
                      setVersionDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 8,
                      background: theme.controlBg,
                      borderRadius: 8,
                      padding: '6px 12px',
                      cursor: 'pointer',
                      border: theme.controlBorder,
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = theme.controlHoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = theme.controlBg)}
                  >
                    <span
                      style={{
                        fontSize: 12.5,
                        fontWeight: 400,
                        color: theme.textPrimary,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {selectedStatus}
                    </span>
                    <ChevronDown size={14} color={theme.textSecondary} />
                  </div>

                  {/* Menu de Status */}
                  {statusDropdownOpen && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'absolute',
                        top: 'calc(100% + 6px)',
                        right: 0,
                        background: theme.dropdownBg,
                        borderRadius: 8,
                        padding: 5,
                        zIndex: 1000,
                        minWidth: 190,
                        boxShadow: theme.dropdownShadow,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        border: theme.dropdownBorder,
                      }}
                    >
                      {STATUS_FILTER_OPTIONS.map((opt) => (
                        <div
                          key={opt}
                          onClick={() => {
                            setSelectedStatus(opt);
                            setStatusDropdownOpen(false);
                          }}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 6,
                            fontSize: 12,
                            color: theme.textPrimary,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            background: selectedStatus === opt ? theme.dropdownItemHover : 'transparent',
                            border: 'none',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background =
                              selectedStatus === opt ? theme.dropdownItemHover : 'transparent')
                          }
                        >
                          <span>{opt}</span>
                          {selectedStatus === opt && <Check size={13} color={accentColor} />}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

      {/* Div dos cards posicionada logo abaixo dos controles */}
      <div
        onWheel={(e) => {
          if (e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
            if (e.deltaY !== 0 && e.deltaX === 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }
        }}
        style={{
          width: '100%',
          padding: 5,
          background: theme.bgShelf,
          borderRadius: 10,
          border: theme.shelfBorder,
          boxShadow: theme.shelfShadow,
          justifyContent: 'flex-start',
          alignItems: 'stretch',
          gap: 5,
          display: 'flex',
          flexWrap: 'nowrap',
          overflowX: 'auto',
          overflowY: 'hidden',
          boxSizing: 'border-box',
        }}
        className="no-scrollbar"
      >
        {filteredCards.length > 0 ? (
          filteredCards.map((card) => {
            const isSelected = selectedCardId === card.id;
            const isHovered = hoveredCardId === card.id;

            // Background: accentColor if selected, slightly lighter if hovered, neutral otherwise
            const cardBg = isSelected
              ? accentColor
              : isHovered
              ? theme.cardHoverBg
              : theme.cardBg;

            const badgeBg = isSelected
              ? (isAccentContrastDark ? 'rgba(0, 0, 0, 0.14)' : '#ffffff')
              : (isHovered
                  ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                  : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'));

            const badgeColor = isSelected
              ? (isAccentContrastDark ? '#000000' : accentColor)
              : theme.textPrimary;

            const secondaryTextColor = isSelected
              ? (isAccentContrastDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(255, 255, 255, 0.85)')
              : (isHovered ? theme.textPrimary : theme.textSecondary);

            const progressSolidBg = isSelected
              ? accentContrastText
              : (isHovered
                  ? (isEffectiveDark ? '#eaeaea' : '#475569')
                  : (isEffectiveDark ? '#D9D9D9' : '#94a3b8'));

            const progressFaintBg = isSelected
              ? (isAccentContrastDark ? 'rgba(0, 0, 0, 0.25)' : 'rgba(255, 255, 255, 0.3)')
              : (isHovered
                  ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.14)')
                  : (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'));

            // Proporção real: concluídas (sólida) / em andamento (pontilhada) / abertas (opacidade baixa)
            const totalTasksForBar = card.issuesDone + card.issuesInProgress + card.issuesOpen;
            const doneGrow = card.issuesDone;
            const inProgressGrow = card.issuesInProgress;
            const openGrow = totalTasksForBar > 0 ? card.issuesOpen : 1;

            return (
              <div
                key={card.id}
                onClick={() => setSelectedCardId(card.id)}
                onMouseEnter={() => setHoveredCardId(card.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                style={{
                  flex: '0 0 calc((100% - 15px) / 4)',
                  width: 'calc((100% - 15px) / 4)',
                  minWidth: 'clamp(240px, calc((100% - 15px) / 4), calc((100% - 15px) / 4))',
                  height: 180,
                  padding: '18px clamp(8px, 1.2vw, 20px)',
                  background: cardBg,
                  borderRadius: 8,
                  border: 'none',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  display: 'flex',
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                  boxShadow: 'none',
                  transition: 'background 0.18s ease, transform 0.18s ease',
                }}
              >
                {/* Header: Badge & Titles */}
                <div
                  style={{
                    alignSelf: 'stretch',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 6,
                    display: 'flex',
                    minWidth: 0,
                    border: 'none',
                  }}
                >
                  <div
                    style={{
                      justifyContent: 'flex-start',
                      alignItems: 'center',
                      gap: 'clamp(6px, 0.8vw, 10px)',
                      display: 'inline-flex',
                      minWidth: 0,
                      width: '100%',
                      border: 'none',
                    }}
                  >
                    {/* Badge com pontinho de alerta/crítico no canto superior esquerdo */}
                    <div
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: '50%',
                        background: badgeBg,
                        border: 'none',
                        display: 'inline-flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        flexShrink: 0,
                        position: 'relative',
                        transition: 'background 0.18s ease',
                      }}
                    >
                      {/* Pontinho vermelho (crítico) ou amarelo (alerta) no canto superior esquerdo da bolinha */}
                      {card.alertStatus && (
                        <div
                          style={{
                            position: 'absolute',
                            top: -1,
                            left: -1,
                            width: 7,
                            height: 7,
                            borderRadius: '50%',
                            background: card.alertStatus === 'critico' ? '#ef4444' : '#f59e0b',
                            border: isSelected
                              ? (isAccentContrastDark ? '1.5px solid rgba(0, 0, 0, 0.3)' : '1.5px solid rgba(255, 255, 255, 0.7)')
                              : isHovered
                              ? `1.5px solid ${theme.cardHoverBg}`
                              : `1.5px solid ${theme.cardBg}`,
                            boxShadow:
                              card.alertStatus === 'critico'
                                ? '0 0 6px rgba(239, 68, 68, 0.85)'
                                : '0 0 6px rgba(245, 158, 11, 0.85)',
                            zIndex: 3,
                          }}
                          title={card.alertStatus === 'critico' ? 'Status: Crítico' : 'Status: Alerta'}
                        />
                      )}
                      <span
                        style={{
                          textAlign: 'center',
                          color: badgeColor,
                          fontSize: 11.5,
                          fontWeight: '300',
                          lineHeight: 1,
                          transition: 'color 0.18s ease',
                        }}
                      >
                        {card.badge}
                      </span>
                    </div>

                    {/* Title & Sprint */}
                    <div
                      style={{
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        alignItems: 'flex-start',
                        gap: 2,
                        display: 'inline-flex',
                        overflow: 'hidden',
                        minWidth: 0,
                        flex: 1,
                        border: 'none',
                      }}
                    >
                      <span
                        style={{
                          color: isSelected ? accentContrastText : theme.textPrimary,
                          fontSize: 'clamp(12px, 0.95vw, 16px)',
                          fontWeight: '300',
                          lineHeight: 1.2,
                          letterSpacing: '-0.01em',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          width: '100%',
                        }}
                      >
                        {card.title}
                      </span>
                      <span
                        style={{
                          color: secondaryTextColor,
                          fontSize: 'clamp(10px, 0.8vw, 12px)',
                          fontWeight: '300',
                          lineHeight: 1.2,
                          whiteSpace: 'nowrap',
                          transition: 'color 0.18s ease',
                        }}
                      >
                        {card.sprint}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Progress Section */}
                <div
                  style={{
                    alignSelf: 'stretch',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-end',
                    gap: 5,
                    display: 'flex',
                    border: 'none',
                  }}
                >
                  <span
                    style={{
                      textAlign: 'right',
                      color: isSelected ? accentContrastText : isHovered ? theme.textPrimary : theme.textSecondary,
                      fontSize: 12,
                      fontWeight: '300',
                      lineHeight: 1,
                      transition: 'color 0.18s ease',
                    }}
                  >
                    {card.percentage}
                  </span>
                  <div
                    style={{
                      alignSelf: 'stretch',
                      justifyContent: 'center',
                      alignItems: 'center',
                      gap: 4,
                      display: 'inline-flex',
                      height: 4,
                      border: 'none',
                    }}
                  >
                    {doneGrow > 0 && (
                      <div
                        style={{
                          flex: `${doneGrow} 1 0`,
                          height: 4,
                          background: progressSolidBg,
                          borderRadius: 2,
                          border: 'none',
                          transition: 'flex-grow 0.25s ease',
                        }}
                        title={`${card.issuesDone} concluída(s)`}
                      />
                    )}
                    {inProgressGrow > 0 && (
                      <div
                        style={{
                          flex: `${inProgressGrow} 1 0`,
                          height: 4,
                          backgroundImage: isSelected
                            ? (isAccentContrastDark
                                ? 'radial-gradient(circle, #000000 1px, transparent 1px)'
                                : 'radial-gradient(circle, #ffffff 1px, transparent 1px)')
                            : (isEffectiveDark
                                ? 'radial-gradient(circle, #ffffff 1px, transparent 1px)'
                                : 'radial-gradient(circle, #0f172a 1px, transparent 1px)'),
                          backgroundSize: '4px 4px',
                          backgroundRepeat: 'repeat-x',
                          backgroundPosition: 'center',
                          border: 'none',
                          transition: 'flex-grow 0.25s ease',
                        }}
                        title={`${card.issuesInProgress} em andamento`}
                      />
                    )}
                    {openGrow > 0 && (
                      <div
                        style={{
                          flex: `${openGrow} 1 0`,
                          height: 4,
                          background: progressFaintBg,
                          borderRadius: 2,
                          border: 'none',
                          transition: 'flex-grow 0.25s ease',
                        }}
                        title={`${card.issuesOpen} aberta(s)`}
                      />
                    )}
                  </div>
                </div>

                {/* Bottom Metrics Row */}
                <div
                  style={{
                    alignSelf: 'stretch',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    display: 'flex',
                    gap: 'clamp(2px, 0.5vw, 8px)',
                    minWidth: 0,
                    border: 'none',
                  }}
                >
                  {/* Tarefas concluídas */}
                  <div
                    style={{
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      alignItems: 'flex-start',
                      gap: 2,
                      display: 'inline-flex',
                      minWidth: 0,
                      border: 'none',
                    }}
                  >
                    <span
                      style={{
                        color: secondaryTextColor,
                        fontSize: 'clamp(8px, 0.65vw, 11px)',
                        fontWeight: '300',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        transition: 'color 0.18s ease',
                      }}
                    >
                      Tarefas concluídas
                    </span>
                    <span
                      style={{
                        color: isSelected ? accentContrastText : theme.textPrimary,
                        fontSize: 'clamp(16px, 1.4vw, 24px)',
                        fontWeight: '300',
                        lineHeight: 1.1,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {card.issuesDone}
                    </span>
                  </div>

                  {/* Em progresso (no meio) */}
                  <div
                    style={{
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      alignItems: 'flex-start',
                      gap: 2,
                      display: 'inline-flex',
                      minWidth: 0,
                      border: 'none',
                    }}
                  >
                    <span
                      style={{
                        color: secondaryTextColor,
                        fontSize: 'clamp(8px, 0.65vw, 11px)',
                        fontWeight: '300',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        transition: 'color 0.18s ease',
                      }}
                    >
                      Em progresso
                    </span>
                    <span
                      style={{
                        color: isSelected ? accentContrastText : theme.textPrimary,
                        fontSize: 'clamp(16px, 1.4vw, 24px)',
                        fontWeight: '300',
                        lineHeight: 1.1,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {card.issuesInProgress}
                    </span>
                  </div>

                  {/* Tarefas abertas */}
                  <div
                    style={{
                      flexDirection: 'column',
                      justifyContent: 'flex-start',
                      alignItems: 'flex-start',
                      gap: 2,
                      display: 'inline-flex',
                      minWidth: 0,
                      border: 'none',
                    }}
                  >
                    <span
                      style={{
                        color: secondaryTextColor,
                        fontSize: 'clamp(8px, 0.65vw, 11px)',
                        fontWeight: '300',
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        transition: 'color 0.18s ease',
                      }}
                    >
                      Tarefas abertas
                    </span>
                    <span
                      style={{
                        color: isSelected ? accentContrastText : theme.textPrimary,
                        fontSize: 'clamp(16px, 1.4vw, 24px)',
                        fontWeight: '300',
                        lineHeight: 1.1,
                        letterSpacing: '-0.02em',
                      }}
                    >
                      {card.issuesOpen}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
            <div
              style={{
                padding: '30px 20px',
                color: theme.textSecondary,
                fontSize: 13,
                textAlign: 'center',
                width: '100%',
              }}
            >
              {isLoadingRepos
                ? 'Carregando seus repositórios do GitHub...'
                : reposError
                ? reposError
                : repos.length === 0
                ? 'Nenhum repositório encontrado na sua conta do GitHub.'
                : 'Nenhum projeto encontrado para os filtros selecionados.'}
            </div>
          )}
        </div>

        {/* ========================================================================= */}
        {/* NAVEGAÇÃO DE SEÇÕES DO PROJETO (Issues, Sprints, Riscos, Marcos, etc.)     */}
        {/* ========================================================================= */}
        <div
          style={{
            width: '100%',
            padding: 5,
            background: theme.bgShelf,
            borderRadius: 10,
            border: theme.shelfBorder,
            boxShadow: theme.shelfShadow,
            display: 'flex',
            alignItems: 'stretch',
            gap: 5,
            boxSizing: 'border-box',
            overflowX: 'auto',
          }}
          className="no-scrollbar"
        >
          {PROJECT_SECTIONS.map((section, index) => {
            const isSelected = selectedSection === section.id;
            const isHovered = hoveredSectionId === section.id;
            const Icon = section.icon;
            const opacity = isSelected ? 1 : isHovered ? 0.8 : 0.5;
            const iconColor = isSelected ? accentColor : theme.textPrimary;
            const labelColor = isSelected ? (isEffectiveDark ? '#ffffff' : '#0f172a') : theme.textPrimary;
            return (
              <div
                key={section.id}
                onClick={() => setSelectedSection(section.id)}
                onMouseEnter={() => setHoveredSectionId(section.id)}
                onMouseLeave={() => setHoveredSectionId(null)}
                title={section.label}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 3,
                  flex: '1 1 0',
                  minWidth: 0,
                  height: 42,
                  borderLeft: index > 0 ? `1px solid ${hexToRgba(theme.textSecondary, 0.15)}` : 'none',
                  opacity,
                  cursor: 'pointer',
                  transition: 'opacity 0.15s ease',
                }}
              >
                <Icon size={16} color={iconColor} />
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: isSelected ? 500 : 400,
                    color: labelColor,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}
                >
                  {section.label}
                </span>
              </div>
            );
          })}
        </div>

        {selectedSection === 'issues' ? (
          /* ========================================================================= */
          /* TELA DA ABA ISSUES: PADRÃO GITHUB COM O DESIGN DAS DIVS DE PROJETOS/TAREFAS */
          /* ========================================================================= */
          <div
            style={{
              width: '100%',
              background: theme.bgShelf,
              borderRadius: 10,
              border: theme.shelfBorder,
              boxShadow: theme.shelfShadow,
              display: 'flex',
              flexDirection: 'row',
              alignItems: 'stretch',
              gap: 5,
              padding: 5,
              boxSizing: 'border-box',
              marginTop: 4,
              flex: 1,
              minHeight: 360,
            }}
          >
            {/* ----------------------------------------------------------------- */}
            {/* BARRA LATERAL ESQUERDA (SIDEBAR GITHUB ISSUES)                     */}
            {/* ----------------------------------------------------------------- */}
            <div
              style={{
                width: 'clamp(150px, 20%, 210px)',
                minWidth: 150,
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
              {/* Item: Issues */}
              <div
                onClick={() => setIssuesSidebarTab('all')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background: issuesSidebarTab === 'all' ? (isEffectiveDark ? '#242424' : '#e2e8f0') : 'transparent',
                  color: issuesSidebarTab === 'all' ? theme.textPrimary : theme.textSecondary,
                  fontWeight: issuesSidebarTab === 'all' ? 500 : 400,
                  fontSize: 12.5,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (issuesSidebarTab !== 'all') e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  if (issuesSidebarTab !== 'all') e.currentTarget.style.background = 'transparent';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <CircleDot size={14} color={issuesSidebarTab === 'all' ? accentColor : theme.textSecondary} />
                  <span>Issues</span>
                </div>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 500,
                    padding: '1px 6px',
                    borderRadius: 10,
                    background: isEffectiveDark ? '#1a1a1a' : '#cbd5e1',
                    color: theme.textSecondary,
                  }}
                >
                  {openIssuesCount}
                </span>
              </div>

              {/* Item: Assigned to me */}
              <div
                onClick={() => setIssuesSidebarTab('assigned')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '7px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  gap: 8,
                  background: issuesSidebarTab === 'assigned' ? (isEffectiveDark ? '#242424' : '#e2e8f0') : 'transparent',
                  color: issuesSidebarTab === 'assigned' ? theme.textPrimary : theme.textSecondary,
                  fontWeight: issuesSidebarTab === 'assigned' ? 500 : 400,
                  fontSize: 12.5,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (issuesSidebarTab !== 'assigned') e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  if (issuesSidebarTab !== 'assigned') e.currentTarget.style.background = 'transparent';
                }}
              >
                <UserCheck size={14} color={issuesSidebarTab === 'assigned' ? accentColor : theme.textSecondary} />
                <span>Assigned to me</span>
              </div>

              {/* Item: Created by me */}
              <div
                onClick={() => setIssuesSidebarTab('created')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '7px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  gap: 8,
                  background: issuesSidebarTab === 'created' ? (isEffectiveDark ? '#242424' : '#e2e8f0') : 'transparent',
                  color: issuesSidebarTab === 'created' ? theme.textPrimary : theme.textSecondary,
                  fontWeight: issuesSidebarTab === 'created' ? 500 : 400,
                  fontSize: 12.5,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (issuesSidebarTab !== 'created') e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  if (issuesSidebarTab !== 'created') e.currentTarget.style.background = 'transparent';
                }}
              >
                <Smile size={14} color={issuesSidebarTab === 'created' ? accentColor : theme.textSecondary} />
                <span>Created by me</span>
              </div>

              {/* Item: Mentioned */}
              <div
                onClick={() => setIssuesSidebarTab('mentioned')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '7px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  gap: 8,
                  background: issuesSidebarTab === 'mentioned' ? (isEffectiveDark ? '#242424' : '#e2e8f0') : 'transparent',
                  color: issuesSidebarTab === 'mentioned' ? theme.textPrimary : theme.textSecondary,
                  fontWeight: issuesSidebarTab === 'mentioned' ? 500 : 400,
                  fontSize: 12.5,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (issuesSidebarTab !== 'mentioned') e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  if (issuesSidebarTab !== 'mentioned') e.currentTarget.style.background = 'transparent';
                }}
              >
                <AtSign size={14} color={issuesSidebarTab === 'mentioned' ? accentColor : theme.textSecondary} />
                <span>Mentioned</span>
              </div>

              {/* Item: Recent activity */}
              <div
                onClick={() => {
                  setIssuesSidebarTab('recent');
                  setIssuesSortMode('newest');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '7px 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  gap: 8,
                  background: issuesSidebarTab === 'recent' ? (isEffectiveDark ? '#242424' : '#e2e8f0') : 'transparent',
                  color: issuesSidebarTab === 'recent' ? theme.textPrimary : theme.textSecondary,
                  fontWeight: issuesSidebarTab === 'recent' ? 500 : 400,
                  fontSize: 12.5,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (issuesSidebarTab !== 'recent') e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  if (issuesSidebarTab !== 'recent') e.currentTarget.style.background = 'transparent';
                }}
              >
                <Clock size={14} color={issuesSidebarTab === 'recent' ? accentColor : theme.textSecondary} />
                <span>Recent activity</span>
              </div>
            </div>

            {/* ----------------------------------------------------------------- */}
            {/* ÁREA PRINCIPAL: HEADER, BUSCA GITHUB E TABELA DE ISSUES            */}
            {/* ----------------------------------------------------------------- */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                boxSizing: 'border-box',
              }}
            >
              {/* Cabeçalho superior: Título */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px 4px',
                  width: '100%',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <h2
                    style={{
                      fontSize: 17,
                      fontWeight: 600,
                      color: theme.textPrimary,
                      margin: 0,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    All issues
                  </h2>
                  {selectedProject?.title && (
                    <span
                      style={{
                        fontSize: 11,
                        color: theme.textSecondary,
                        background: theme.controlBg,
                        padding: '2px 8px',
                        borderRadius: 6,
                      }}
                    >
                      {selectedProject.title}
                    </span>
                  )}
                </div>
              </div>


              {/* Tabela de Issues (Contêiner no Design de Tarefas) */}
              <div
                style={{
                  background: theme.viewCanvasBg,
                  borderRadius: 8,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  minHeight: 280,
                  position: 'relative',
                }}
              >
                {/* Backdrop para fechar dropdowns abertos */}
                {activeIssuesDropdown && (
                  <div
                    onClick={() => setActiveIssuesDropdown(null)}
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 30,
                    }}
                  />
                )}

                {/* Cabeçalho da Tabela (Barra de Ações do GitHub) */}
                <div
                  style={{
                    background: theme.controlBg,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 8,
                    userSelect: 'none',
                  }}
                >
                  {/* Lado Esquerdo: Checkbox mestre + Abas Open / Closed */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div
                      onClick={handleToggleSelectAllIssues}
                      style={{ cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                      title="Selecionar todas as issues visíveis"
                    >
                      {selectedIssueCheckboxes.size > 0 &&
                      selectedIssueCheckboxes.size === filteredGithubIssues.length ? (
                        <CheckSquare size={15} color={accentColor} />
                      ) : (
                        <Square size={15} color={theme.textSecondary} />
                      )}
                    </div>

                    {/* Aba Open */}
                    <div
                      onClick={() => setIssuesStateFilter('open')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: 6,
                        background: issuesStateFilter === 'open' ? (isEffectiveDark ? '#262626' : '#e2e8f0') : 'transparent',
                        transition: 'background 0.12s ease',
                      }}
                    >
                      <CircleDot size={14} color="#22c55e" />
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: issuesStateFilter === 'open' ? 600 : 400,
                          color: issuesStateFilter === 'open' ? theme.textPrimary : theme.textSecondary,
                        }}
                      >
                        Open
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '0 5px',
                          borderRadius: 8,
                          background: isEffectiveDark ? '#1a1a1a' : '#cbd5e1',
                          color: issuesStateFilter === 'open' ? theme.textPrimary : theme.textSecondary,
                        }}
                      >
                        {openIssuesCount}
                      </span>
                    </div>

                    {/* Aba Closed */}
                    <div
                      onClick={() => setIssuesStateFilter('closed')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        padding: '4px 6px',
                        borderRadius: 6,
                        background: issuesStateFilter === 'closed' ? (isEffectiveDark ? '#262626' : '#e2e8f0') : 'transparent',
                        transition: 'background 0.12s ease',
                      }}
                    >
                      <CheckCircle2
                        size={14}
                        color={issuesStateFilter === 'closed' ? '#8250df' : theme.textSecondary}
                      />
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: issuesStateFilter === 'closed' ? 600 : 400,
                          color: issuesStateFilter === 'closed' ? theme.textPrimary : theme.textSecondary,
                        }}
                      >
                        Closed
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '0 5px',
                          borderRadius: 8,
                          background: isEffectiveDark ? '#1a1a1a' : '#cbd5e1',
                          color: issuesStateFilter === 'closed' ? theme.textPrimary : theme.textSecondary,
                        }}
                      >
                        {closedIssuesCount}
                      </span>
                    </div>

                    {selectedIssueCheckboxes.size > 0 && (
                      <span style={{ fontSize: 11.5, color: accentColor, fontWeight: 500 }}>
                        {selectedIssueCheckboxes.size} selecionada(s)
                      </span>
                    )}
                  </div>

                  {/* Lado Direito: Filtros Dropdown (Author, Labels, Projects, Milestones, Assignees, Sort) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, position: 'relative' }}>
                    {/* Dropdown Author */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveIssuesDropdown(activeIssuesDropdown === 'author' ? null : 'author')
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'transparent',
                          border: 'none',
                          color: selectedAuthorFilter !== 'all' ? accentColor : theme.textSecondary,
                          fontSize: 12,
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: 6,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color =
                            selectedAuthorFilter !== 'all' ? accentColor : theme.textSecondary)
                        }
                      >
                        <span>{selectedAuthorFilter === 'all' ? 'Author' : selectedAuthorFilter}</span>
                        <ChevronDown size={11} />
                      </button>

                      {activeIssuesDropdown === 'author' && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: 4,
                            background: theme.dropdownBg,
                            borderRadius: 8,
                            boxShadow: theme.dropdownShadow,
                            zIndex: 40,
                            minWidth: 160,
                            padding: '4px 0',
                          }}
                        >
                          <div
                            onClick={() => {
                              setSelectedAuthorFilter('all');
                              setActiveIssuesDropdown(null);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 12px',
                              fontSize: 12,
                              color: selectedAuthorFilter === 'all' ? accentColor : theme.textPrimary,
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span>Todos os autores</span>
                            {selectedAuthorFilter === 'all' && <Check size={12} color={accentColor} />}
                          </div>
                          {uniqueAuthors.map((author) => (
                            <div
                              key={author}
                              onClick={() => {
                                setSelectedAuthorFilter(author);
                                setActiveIssuesDropdown(null);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 12px',
                                fontSize: 12,
                                color: selectedAuthorFilter === author ? accentColor : theme.textPrimary,
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <span>{author}</span>
                              {selectedAuthorFilter === author && <Check size={12} color={accentColor} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Dropdown Labels */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveIssuesDropdown(activeIssuesDropdown === 'label' ? null : 'label')
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'transparent',
                          border: 'none',
                          color: selectedLabelFilter !== 'all' ? accentColor : theme.textSecondary,
                          fontSize: 12,
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: 6,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color =
                            selectedLabelFilter !== 'all' ? accentColor : theme.textSecondary)
                        }
                      >
                        <span>{selectedLabelFilter === 'all' ? 'Labels' : selectedLabelFilter}</span>
                        <ChevronDown size={11} />
                      </button>

                      {activeIssuesDropdown === 'label' && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: 4,
                            background: theme.dropdownBg,
                            borderRadius: 8,
                            boxShadow: theme.dropdownShadow,
                            zIndex: 40,
                            minWidth: 160,
                            padding: '4px 0',
                          }}
                        >
                          <div
                            onClick={() => {
                              setSelectedLabelFilter('all');
                              setActiveIssuesDropdown(null);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 12px',
                              fontSize: 12,
                              color: selectedLabelFilter === 'all' ? accentColor : theme.textPrimary,
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span>Todas as labels</span>
                            {selectedLabelFilter === 'all' && <Check size={12} color={accentColor} />}
                          </div>
                          {uniqueLabels.map((lbl) => (
                            <div
                              key={lbl}
                              onClick={() => {
                                setSelectedLabelFilter(lbl);
                                setActiveIssuesDropdown(null);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 12px',
                                fontSize: 12,
                                color: selectedLabelFilter === lbl ? accentColor : theme.textPrimary,
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <span>{lbl}</span>
                              {selectedLabelFilter === lbl && <Check size={12} color={accentColor} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Dropdown Projects */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedSection('tarefas')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'transparent',
                          border: 'none',
                          color: theme.textSecondary,
                          fontSize: 12,
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: 6,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
                      >
                        <span>Projects</span>
                        <ChevronDown size={11} />
                      </button>
                    </div>

                    {/* Dropdown Milestones */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setSelectedSection('marcos')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'transparent',
                          border: 'none',
                          color: theme.textSecondary,
                          fontSize: 12,
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: 6,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
                      >
                        <span>Milestones</span>
                        <ChevronDown size={11} />
                      </button>
                    </div>

                    {/* Dropdown Assignees */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveIssuesDropdown(activeIssuesDropdown === 'assignee' ? null : 'assignee')
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'transparent',
                          border: 'none',
                          color: selectedAssigneeFilter !== 'all' ? accentColor : theme.textSecondary,
                          fontSize: 12,
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: 6,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color =
                            selectedAssigneeFilter !== 'all' ? accentColor : theme.textSecondary)
                        }
                      >
                        <span>{selectedAssigneeFilter === 'all' ? 'Assignees' : selectedAssigneeFilter}</span>
                        <ChevronDown size={11} />
                      </button>

                      {activeIssuesDropdown === 'assignee' && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: 4,
                            background: theme.dropdownBg,
                            borderRadius: 8,
                            boxShadow: theme.dropdownShadow,
                            zIndex: 40,
                            minWidth: 160,
                            padding: '4px 0',
                          }}
                        >
                          <div
                            onClick={() => {
                              setSelectedAssigneeFilter('all');
                              setActiveIssuesDropdown(null);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '6px 12px',
                              fontSize: 12,
                              color: selectedAssigneeFilter === 'all' ? accentColor : theme.textPrimary,
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <span>Todos</span>
                            {selectedAssigneeFilter === 'all' && <Check size={12} color={accentColor} />}
                          </div>
                          {uniqueAssignees.map((assignee) => (
                            <div
                              key={assignee.name}
                              onClick={() => {
                                setSelectedAssigneeFilter(assignee.name);
                                setActiveIssuesDropdown(null);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 12px',
                                fontSize: 12,
                                color: selectedAssigneeFilter === assignee.name ? accentColor : theme.textPrimary,
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <span>{assignee.name}</span>
                              {selectedAssigneeFilter === assignee.name && <Check size={12} color={accentColor} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Dropdown Sort */}
                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() =>
                          setActiveIssuesDropdown(activeIssuesDropdown === 'sort' ? null : 'sort')
                        }
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          background: 'transparent',
                          border: 'none',
                          color: issuesSortMode !== 'newest' ? accentColor : theme.textSecondary,
                          fontSize: 12,
                          cursor: 'pointer',
                          padding: '4px 6px',
                          borderRadius: 6,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.color =
                            issuesSortMode !== 'newest' ? accentColor : theme.textSecondary)
                        }
                      >
                        <ArrowUpDown size={11} />
                        <span>
                          {issuesSortMode === 'newest'
                            ? 'Newest'
                            : issuesSortMode === 'oldest'
                            ? 'Oldest'
                            : 'Most commented'}
                        </span>
                        <ChevronDown size={11} />
                      </button>

                      {activeIssuesDropdown === 'sort' && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: 4,
                            background: theme.dropdownBg,
                            borderRadius: 8,
                            boxShadow: theme.dropdownShadow,
                            zIndex: 40,
                            minWidth: 160,
                            padding: '4px 0',
                          }}
                        >
                          {(
                            [
                              { id: 'newest', label: 'Newest' },
                              { id: 'oldest', label: 'Oldest' },
                              { id: 'comments', label: 'Most commented' },
                            ] as const
                          ).map((opt) => (
                            <div
                              key={opt.id}
                              onClick={() => {
                                setIssuesSortMode(opt.id);
                                setActiveIssuesDropdown(null);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '6px 12px',
                                fontSize: 12,
                                color: issuesSortMode === opt.id ? accentColor : theme.textPrimary,
                                cursor: 'pointer',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <span>{opt.label}</span>
                              {issuesSortMode === opt.id && <Check size={12} color={accentColor} />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Botão Nova Issue */}
                    <button
                      type="button"
                      onClick={() => setIsAddTaskModalOpen(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        background: accentColor,
                        border: 'none',
                        borderRadius: 6,
                        padding: '5px 12px',
                        color: accentContrastText,
                        fontSize: 12,
                        fontWeight: '400',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.88';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                      }}
                    >
                      <Plus size={13} color={accentContrastText} />
                      <span>Nova Issue</span>
                    </button>
                  </div>
                </div>

                {/* Lista de Linhas de Issues */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    flex: 1,
                  }}
                  className="no-scrollbar"
                >
                  {filteredGithubIssues.length === 0 ? (
                    <div
                      style={{
                        padding: '48px 24px',
                        textAlign: 'center',
                        color: theme.textSecondary,
                        fontSize: 13,
                      }}
                    >
                      Nenhuma issue encontrada com os filtros selecionados.
                    </div>
                  ) : (
                    filteredGithubIssues.map((issue, index) => {
                      const isHovered = hoveredIssueId === issue.id;
                      const isChecked = selectedIssueCheckboxes.has(issue.id);
                      const isClosed = issue.rawState === 'closed' || issue.status === 'Concluído';
                      const issueNumber = issue.githubNumber || issue.id.replace('#', '');
                      const comments = issue.commentsCount || 0;
                      const labels = issue.rawLabels || (issue.tag ? [issue.tag] : []);

                      return (
                        <div
                          key={issue.id}
                          onMouseEnter={() => setHoveredIssueId(issue.id)}
                          onMouseLeave={() => setHoveredIssueId(null)}
                          style={{
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 12,
                            padding: '11px 14px',
                            borderTop:
                              index > 0
                                ? `1px solid ${hexToRgba(theme.textSecondary, 0.08)}`
                                : 'none',
                            background: isHovered
                              ? isEffectiveDark
                                ? '#1a1a1a'
                                : '#f1f5f9'
                              : 'transparent',
                            transition: 'background 0.12s ease',
                          }}
                        >
                          {/* Checkbox individual */}
                          <div
                            onClick={(e) => handleToggleIssueCheckbox(issue.id, e)}
                            style={{
                              cursor: 'pointer',
                              marginTop: 2,
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            {isChecked ? (
                              <CheckSquare size={15} color={accentColor} />
                            ) : (
                              <Square size={15} color={theme.textSecondary} />
                            )}
                          </div>

                          {/* Ícone de status (CircleDot verde se aberta, CheckCircle2 roxo se fechada) */}
                          <div style={{ marginTop: 2, flexShrink: 0 }}>
                            {isClosed ? (
                              <CheckCircle2 size={16} color="#8250df" />
                            ) : (
                              <CircleDot size={16} color="#22c55e" />
                            )}
                          </div>

                          {/* Conteúdo Central: Título + Badges + Subtítulo */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            {/* Linha 1: Título da Issue + Labels inline + Contador de comentários */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                flexWrap: 'wrap',
                                gap: 6,
                              }}
                            >
                              <span
                                onClick={() => handleOpenEditIssue(issue)}
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: 500,
                                  color: theme.textPrimary,
                                  cursor: 'pointer',
                                  transition: 'color 0.12s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = accentColor;
                                  e.currentTarget.style.textDecoration = 'underline';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = theme.textPrimary;
                                  e.currentTarget.style.textDecoration = 'none';
                                }}
                              >
                                {issue.title}
                              </span>

                              {/* Badges de Labels no estilo GitHub */}
                              {labels.map((lbl) => {
                                const isBug = lbl.toLowerCase() === 'bug';
                                const isPainel = lbl.toLowerCase() === 'painel';
                                const isBackend = lbl.toLowerCase() === 'backend';
                                const isInfra = lbl.toLowerCase() === 'infra';

                                const bg = isBug
                                  ? 'rgba(248, 81, 73, 0.18)'
                                  : isPainel
                                  ? 'rgba(56, 139, 253, 0.18)'
                                  : isBackend
                                  ? 'rgba(56, 189, 248, 0.18)'
                                  : isInfra
                                  ? 'rgba(168, 85, 247, 0.18)'
                                  : 'rgba(148, 163, 184, 0.15)';

                                const color = isBug
                                  ? '#f85149'
                                  : isPainel
                                  ? '#58a6ff'
                                  : isBackend
                                  ? '#38bdf8'
                                  : isInfra
                                  ? '#c084fc'
                                  : theme.textSecondary;

                                return (
                                  <span
                                    key={lbl}
                                    style={{
                                      fontSize: 10.5,
                                      fontWeight: 500,
                                      padding: '1.5px 7px',
                                      borderRadius: 10,
                                      background: bg,
                                      color,
                                      userSelect: 'none',
                                      lineHeight: 1.3,
                                    }}
                                  >
                                    {lbl}
                                  </span>
                                );
                              })}

                              {/* Contador de Comentários */}
                              {comments > 0 && (
                                <div
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3.5,
                                    fontSize: 11,
                                    color: theme.textSecondary,
                                    marginLeft: 4,
                                  }}
                                  title={`${comments} comentário(s)`}
                                >
                                  <MessageSquare size={12} color={theme.textSecondary} />
                                  <span>{comments}</span>
                                </div>
                              )}
                            </div>

                            {/* Linha 2: Subtítulo no padrão GitHub (#246 · autor opened 2w ago) */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                fontSize: 11.5,
                                color: theme.textSecondary,
                                marginTop: 3,
                                flexWrap: 'wrap',
                              }}
                            >
                              <span>#{issueNumber}</span>
                              <span>·</span>
                              <span style={{ color: theme.textPrimary, fontWeight: 400 }}>
                                {issue.author || 'nelsonappmoove'}
                              </span>
                              <span>opened {formatGithubTimeAgo(issue.createdAtIso)}</span>
                              {issue.milestoneTitle && (
                                <>
                                  <span>·</span>
                                  <Milestone size={11} color={theme.textSecondary} />
                                  <span>{issue.milestoneTitle}</span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Lado Direito: Avatar do Assignee e Ações */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                            {issue.assignees && issue.assignees.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center' }}>
                                {issue.assignees.map((a, aIdx) => (
                                  <div
                                    key={aIdx}
                                    title={`Atribuído a ${a.name}`}
                                    style={{
                                      width: 20,
                                      height: 20,
                                      borderRadius: '50%',
                                      overflow: 'hidden',
                                      background: a.avatarBg || '#10b981',
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      fontSize: 10,
                                      fontWeight: 600,
                                      color: '#ffffff',
                                      border: `1.5px solid ${theme.viewCanvasBg}`,
                                    }}
                                  >
                                    {a.avatarUrl ? (
                                      <img
                                        src={a.avatarUrl}
                                        alt={a.name}
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                        onError={(e) => {
                                          (e.currentTarget as HTMLElement).style.display = 'none';
                                        }}
                                      />
                                    ) : (
                                      a.initial || a.name.charAt(0).toUpperCase()
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Botão de Opções Rápidas (Editar, etc.) */}
                            <button
                              type="button"
                              onClick={() => handleOpenEditIssue(issue)}
                              title="Editar tarefa"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: theme.textSecondary,
                                cursor: 'pointer',
                                padding: 3,
                                borderRadius: 4,
                                display: 'flex',
                                alignItems: 'center',
                                opacity: isHovered ? 1 : 0.3,
                                transition: 'all 0.12s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                              onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
                            >
                              <MoreVertical size={14} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : selectedSection === 'sprints' ? (
          /* ========================================================================= */
          /* TELA DA ABA SPRINTS: PADRÃO GITHUB FIELD SETTINGS COM DESIGN NATIVO       */
          /* ========================================================================= */
          <div
            style={{
              width: '100%',
              background: theme.bgShelf,
              borderRadius: 10,
              border: theme.shelfBorder,
              boxShadow: theme.shelfShadow,
              display: 'flex',
              flexDirection: 'column',
              padding: 5,
              boxSizing: 'border-box',
              marginTop: 4,
              flex: 1,
              minHeight: 360,
            }}
          >
            <div
              style={{
                width: '100%',
                background: theme.viewCanvasBg,
                borderRadius: 8,
                padding: 5,
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                flex: 1,
              }}
            >
              {/* Header: Título + Botão Delete field */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 18,
                  width: '100%',
                }}
              >
                <h2
                  style={{
                    fontSize: 18,
                    fontWeight: 600,
                    color: theme.textPrimary,
                    margin: 0,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Sprint field settings
                </h2>

                <button
                  type="button"
                  onClick={() => showToast('Campo padrão de sprints protegido.')}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 14px',
                    color: '#ef4444',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.2)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)')}
                >
                  Delete field
                </button>
              </div>

              {/* Formulário: Field name & Field type */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                {/* Field name */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary }}>
                    Field name
                  </label>
                  <input
                    type="text"
                    value={sprintFieldName}
                    onChange={(e) => setSprintFieldName(e.target.value)}
                    style={{
                      width: '100%',
                      maxWidth: 260,
                      background: theme.controlBg,
                      border: 'none',
                      borderRadius: 6,
                      padding: '7px 12px',
                      fontSize: 13,
                      color: theme.textPrimary,
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Field type */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 500, color: theme.textSecondary }}>
                    Field type
                  </label>
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: theme.controlBg,
                      borderRadius: 6,
                      padding: '6px 12px',
                      color: theme.textSecondary,
                      fontSize: 12,
                      width: 'fit-content',
                    }}
                  >
                    <Repeat size={13} color={theme.textSecondary} />
                    <span>Iteration</span>
                  </div>
                </div>
              </div>

              {/* Tabela de Iterações / Sprints */}
              <div
                style={{
                  background: theme.controlBg,
                  borderRadius: 8,
                  overflow: 'hidden',
                  display: 'flex',
                  flexDirection: 'column',
                  width: '100%',
                  position: 'relative',
                }}
              >
                {/* Backdrop para dropdown More options */}
                {sprintMoreOptionsOpen && (
                  <div
                    onClick={() => setSprintMoreOptionsOpen(false)}
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      right: 0,
                      bottom: 0,
                      zIndex: 30,
                    }}
                  />
                )}

                {/* Barra Superior da Tabela: Tabs Active / Completed + Ações */}
                <div
                  style={{
                    background: isEffectiveDark ? '#1a1a1a' : '#f1f5f9',
                    padding: '10px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: 10,
                  }}
                >
                  {/* Tabs: Active / Completed */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    {/* Tab Active */}
                    <div
                      onClick={() => setSprintsTab('active')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        color: sprintsTab === 'active' ? theme.textPrimary : theme.textSecondary,
                        fontWeight: sprintsTab === 'active' ? 600 : 400,
                        fontSize: 12.5,
                        transition: 'color 0.12s ease',
                      }}
                    >
                      <Clock
                        size={14}
                        color={sprintsTab === 'active' ? theme.textPrimary : theme.textSecondary}
                      />
                      <span>{activeSprintsCount} Active</span>
                    </div>

                    {/* Tab Completed */}
                    <div
                      onClick={() => setSprintsTab('completed')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        color: sprintsTab === 'completed' ? theme.textPrimary : theme.textSecondary,
                        fontWeight: sprintsTab === 'completed' ? 600 : 400,
                        fontSize: 12.5,
                        transition: 'color 0.12s ease',
                      }}
                    >
                      <Archive
                        size={14}
                        color={sprintsTab === 'completed' ? theme.textPrimary : theme.textSecondary}
                      />
                      <span>{completedSprintsCount} Completed</span>
                    </div>
                  </div>

                  {/* Lado Direito: Botões Add iteration e More options */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                    <button
                      type="button"
                      onClick={() => {
                        setSprintCreationContext('create');
                        setIsCreateSprintModalOpen(true);
                      }}
                      style={{
                        background: isEffectiveDark ? '#242424' : '#e2e8f0',
                        color: theme.textPrimary,
                        border: 'none',
                        borderRadius: 6,
                        padding: '5px 12px',
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = isEffectiveDark ? '#2c2c2c' : '#cbd5e1')
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = isEffectiveDark ? '#242424' : '#e2e8f0')
                      }
                    >
                      <Plus size={13} />
                      <span>Add iteration</span>
                    </button>

                    <div style={{ position: 'relative' }}>
                      <button
                        type="button"
                        onClick={() => setSprintMoreOptionsOpen((prev) => !prev)}
                        style={{
                          background: isEffectiveDark ? '#242424' : '#e2e8f0',
                          color: theme.textPrimary,
                          border: 'none',
                          borderRadius: 6,
                          padding: '5px 10px',
                          fontSize: 12,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = isEffectiveDark ? '#2c2c2c' : '#cbd5e1')
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = isEffectiveDark ? '#242424' : '#e2e8f0')
                        }
                      >
                        <span>More options</span>
                        <ChevronDown size={11} />
                      </button>

                      {sprintMoreOptionsOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: 4,
                            background: theme.dropdownBg,
                            borderRadius: 8,
                            boxShadow: theme.dropdownShadow,
                            zIndex: 40,
                            minWidth: 220,
                            padding: '4px 0',
                          }}
                        >
                          <div
                            onClick={() => {
                              setSprintMoreOptionsOpen(false);
                              showToast('Duração padrão configurada para 2 semanas.');
                            }}
                            style={{
                              padding: '7px 12px',
                              fontSize: 12,
                              color: theme.textPrimary,
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            Duração padrão (2 semanas)
                          </div>
                          <div
                            onClick={() => {
                              setSprintMoreOptionsOpen(false);
                              showToast('Datas recalculadas automaticamente.');
                            }}
                            style={{
                              padding: '7px 12px',
                              fontSize: 12,
                              color: theme.textPrimary,
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            Recalcular datas automaticamente
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Lista de Linhas de Iterações/Sprints */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    maxHeight: 520,
                    overflowY: 'auto',
                  }}
                  className="no-scrollbar"
                >
                  {displayedSprints.length === 0 ? (
                    <div
                      style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: theme.textSecondary,
                        fontSize: 13,
                      }}
                    >
                      {sprintsTab === 'active'
                        ? 'Nenhuma iteração ativa encontrada.'
                        : 'Nenhuma iteração concluída.'}
                    </div>
                  ) : (
                    displayedSprints.map((sprint, index) => {
                      const isHovered = hoveredSprintRowId === sprint.id;
                      const isCurrent = sprint.status === 'Current';
                      const isCompleted = sprint.status === 'Completed';

                      return (
                        <div
                          key={sprint.id}
                          onMouseEnter={() => setHoveredSprintRowId(sprint.id)}
                          onMouseLeave={() => setHoveredSprintRowId(null)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '13px 16px',
                            borderTop: index > 0 ? `1px solid ${hexToRgba(theme.textSecondary, 0.08)}` : 'none',
                            background: isHovered
                              ? isEffectiveDark
                                ? '#181818'
                                : '#f8fafc'
                              : 'transparent',
                            transition: 'background 0.12s ease',
                          }}
                        >
                          {/* Lado Esquerdo: Badge Status + Título + Duração/Datas */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0, flex: 1 }}>
                            {/* Badge Status (Current / Planned / Completed) */}
                            <div style={{ flexShrink: 0 }}>
                              {isCurrent ? (
                                <span
                                  style={{
                                    background: 'rgba(56, 139, 253, 0.15)',
                                    border: '1px solid rgba(56, 139, 253, 0.45)',
                                    color: '#58a6ff',
                                    borderRadius: 12,
                                    padding: '2px 10px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    letterSpacing: '0.01em',
                                  }}
                                >
                                  Current
                                </span>
                              ) : isCompleted ? (
                                <span
                                  style={{
                                    background: 'rgba(34, 197, 94, 0.15)',
                                    border: '1px solid rgba(34, 197, 94, 0.4)',
                                    color: '#22c55e',
                                    borderRadius: 12,
                                    padding: '2px 10px',
                                    fontSize: 11,
                                    fontWeight: 600,
                                    letterSpacing: '0.01em',
                                  }}
                                >
                                  Completed
                                </span>
                              ) : (
                                <span
                                  style={{
                                    background: 'rgba(148, 163, 184, 0.12)',
                                    border: '1px solid rgba(148, 163, 184, 0.25)',
                                    color: '#94a3b8',
                                    borderRadius: 12,
                                    padding: '2px 10px',
                                    fontSize: 11,
                                    fontWeight: 500,
                                    letterSpacing: '0.01em',
                                  }}
                                >
                                  Planned
                                </span>
                              )}
                            </div>

                            {/* Informações da Sprint: Título e Datas */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                              <span
                                style={{
                                  fontSize: 13.5,
                                  fontWeight: 600,
                                  color: theme.textPrimary,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {sprint.title}
                              </span>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12 }}>
                                <span style={{ fontWeight: 500, color: theme.textPrimary }}>
                                  {sprint.durationLabel}
                                </span>
                                <span style={{ color: theme.textSecondary }}>{sprint.dateRangeLabel}</span>
                              </div>
                            </div>
                          </div>

                          {/* Lado Direito: Ações (Lixeira + Três pontos) */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
                            <button
                              type="button"
                              onClick={() => handleDeleteSprint(sprint.id)}
                              title="Excluir iteração"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: theme.textSecondary,
                                cursor: 'pointer',
                                padding: 4,
                                borderRadius: 4,
                                display: 'flex',
                                alignItems: 'center',
                                opacity: isHovered ? 0.85 : 0.4,
                                transition: 'all 0.12s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = '#ef4444';
                                e.currentTarget.style.opacity = '1';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = theme.textSecondary;
                                e.currentTarget.style.opacity = isHovered ? '0.85' : '0.4';
                              }}
                            >
                              <Trash2 size={14} />
                            </button>

                            <button
                              type="button"
                              onClick={() => {
                                setNewSprintTitle(sprint.title);
                                setSprintCreationContext('edit');
                                setIsCreateSprintModalOpen(true);
                              }}
                              title="Opções da iteração"
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: theme.textSecondary,
                                cursor: 'pointer',
                                padding: 4,
                                borderRadius: 4,
                                display: 'flex',
                                alignItems: 'center',
                                opacity: isHovered ? 0.85 : 0.4,
                                transition: 'all 0.12s ease',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = theme.textPrimary;
                                e.currentTarget.style.opacity = '1';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = theme.textSecondary;
                                e.currentTarget.style.opacity = isHovered ? '0.85' : '0.4';
                              }}
                            >
                              <MoreHorizontal size={15} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : selectedSection === 'riscos' ? (
          /* ========================================================================= */
          /* TELA DE RISCOS: issues abertas com prioridade Alta/Urgente                */
          /* ========================================================================= */
          <div
            style={{
              width: '100%',
              background: theme.bgShelf,
              borderRadius: 10,
              border: theme.shelfBorder,
              boxShadow: theme.shelfShadow,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              padding: 5,
              boxSizing: 'border-box',
              marginTop: 4,
              flex: 1,
              minHeight: 360,
            }}
          >
            <div
              style={{
                background: theme.viewCanvasBg,
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                flex: 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <AlertTriangle size={17} color="#ef4444" />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: theme.textPrimary }}>Riscos do Projeto</div>
                  <div style={{ fontSize: 11.5, color: theme.textSecondary }}>
                    Issues abertas com prioridade Alta ou Urgente em {selectedProject?.title || 'repositório'}
                  </div>
                </div>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: 12,
                    fontWeight: 600,
                    padding: '3px 10px',
                    borderRadius: 12,
                    background: riskIssues.length > 0 ? 'rgba(239, 68, 68, 0.15)' : theme.controlBg,
                    color: riskIssues.length > 0 ? '#ef4444' : theme.textSecondary,
                  }}
                >
                  {riskIssues.length}
                </span>
              </div>

              {isLoadingProjectIssues ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: theme.textSecondary, fontSize: 13 }}>
                  Carregando issues do repositório...
                </div>
              ) : riskIssues.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: theme.textSecondary, fontSize: 13 }}>
                  Nenhum risco identificado. Issues com prioridade Alta ou Urgente aparecem aqui automaticamente.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {riskIssues.map((issue) => (
                    <div
                      key={issue.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: theme.viewCardBg,
                      }}
                    >
                      <span style={{ width: 6, height: 6, borderRadius: '50%', background: issue.priorityColor, flexShrink: 0 }} />
                      <span style={{ fontSize: 11, color: theme.textSecondary, fontFamily: 'monospace', flexShrink: 0 }}>{issue.id}</span>
                      <span
                        style={{
                          fontSize: 13,
                          color: theme.textPrimary,
                          fontWeight: 400,
                          flex: 1,
                          minWidth: 0,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {issue.title}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: 4,
                          background: hexToRgba(issue.priorityColor, 0.15),
                          color: issue.priorityColor,
                          flexShrink: 0,
                        }}
                      >
                        {issue.priority}
                      </span>
                      <span style={{ fontSize: 11, color: theme.textSecondary, flexShrink: 0, minWidth: 90 }}>{issue.status}</span>
                      <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {issue.assignees.slice(0, 3).map((a, i) => (
                          <div
                            key={i}
                            title={a.name}
                            style={{
                              width: 20,
                              height: 20,
                              borderRadius: '50%',
                              background: a.avatarBg,
                              color: '#ffffff',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 9.5,
                              marginLeft: i > 0 ? -5 : 0,
                              border: `1.5px solid ${theme.viewCardBg}`,
                              overflow: 'hidden',
                            }}
                          >
                            {a.avatarUrl ? <img src={a.avatarUrl} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : a.initial}
                          </div>
                        ))}
                      </div>
                      {issue.htmlUrl && (
                        <ExternalLink
                          size={13}
                          color={theme.textSecondary}
                          style={{ cursor: 'pointer', flexShrink: 0 }}
                          onClick={() => window.electronAPI?.shell?.openExternal?.(issue.htmlUrl!)}
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : selectedSection === 'marcos' ? (
          /* ========================================================================= */
          /* TELA DE MARCOS: roadmap de todos os milestones (sprints) do repositório    */
          /* ========================================================================= */
          <div
            style={{
              width: '100%',
              background: theme.bgShelf,
              borderRadius: 10,
              border: theme.shelfBorder,
              boxShadow: theme.shelfShadow,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              padding: 5,
              boxSizing: 'border-box',
              marginTop: 4,
              flex: 1,
              minHeight: 360,
            }}
          >
            <div
              style={{
                background: theme.viewCanvasBg,
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                flex: 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Milestone size={17} color={accentColor} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: theme.textPrimary }}>Marcos do Projeto</div>
                  <div style={{ fontSize: 11.5, color: theme.textSecondary }}>Roadmap dos milestones de {selectedProject?.title || 'repositório'}</div>
                </div>
                <button
                  type="button"
                  onClick={() => openCreateSprintModal('create')}
                  style={{
                    marginLeft: 'auto',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    background: accentColor,
                    border: 'none',
                    borderRadius: 8,
                    padding: '6px 14px',
                    color: accentContrastText,
                    fontSize: 12,
                    cursor: 'pointer',
                  }}
                >
                  <Plus size={13.5} color={accentContrastText} />
                  <span>Novo Marco</span>
                </button>
              </div>

              {sprintsForSelectedRepo.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: theme.textSecondary, fontSize: 13 }}>
                  Nenhum marco criado ainda para este repositório.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {[...sprintsForSelectedRepo]
                    .sort((a, b) => (a.dueDateIso || '9999').localeCompare(b.dueDateIso || '9999'))
                    .map((sprint) => {
                      const total = sprint.openIssues + sprint.closedIssues;
                      const percent = total > 0 ? Math.round((sprint.closedIssues / total) * 100) : 0;
                      return (
                        <div
                          key={sprint.number}
                          style={{
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            padding: '12px 14px',
                            borderRadius: 8,
                            background: theme.viewCardBg,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ fontSize: 13, fontWeight: 500, color: theme.textPrimary, flex: 1, minWidth: 0 }}>{sprint.title}</span>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 600,
                                padding: '2px 8px',
                                borderRadius: 4,
                                background: sprint.state === 'closed' ? 'rgba(16, 185, 129, 0.15)' : hexToRgba(accentColor, 0.15),
                                color: sprint.state === 'closed' ? '#10b981' : accentColor,
                              }}
                            >
                              {sprint.state === 'closed' ? 'Concluído' : 'Aberto'}
                            </span>
                            {sprint.dueDateIso && (
                              <span style={{ fontSize: 11, color: theme.textSecondary }}>até {formatShortDate(sprint.dueDateIso)}</span>
                            )}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div style={{ flex: 1, height: 5, borderRadius: 3, background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                              <div style={{ width: `${percent}%`, height: '100%', background: percent === 100 ? '#10b981' : accentColor, borderRadius: 3 }} />
                            </div>
                            <span style={{ fontSize: 11, color: theme.textSecondary, minWidth: 70, textAlign: 'right' }}>
                              {sprint.closedIssues}/{total} issues
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>
        ) : selectedSection === 'relatorio' ? (
          /* ========================================================================= */
          /* TELA DE RELATÓRIO: dashboard agregando os dados reais já carregados       */
          /* ========================================================================= */
          <div
            style={{
              width: '100%',
              background: theme.bgShelf,
              borderRadius: 10,
              border: theme.shelfBorder,
              boxShadow: theme.shelfShadow,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              padding: 5,
              boxSizing: 'border-box',
              marginTop: 4,
              flex: 1,
              minHeight: 360,
            }}
          >
            <div
              style={{
                background: theme.viewCanvasBg,
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                flex: 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <BarChart2 size={17} color={accentColor} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: theme.textPrimary }}>Relatório do Projeto</div>
                  <div style={{ fontSize: 11.5, color: theme.textSecondary }}>{selectedProject?.title || 'repositório'}</div>
                </div>
              </div>

              {(() => {
                const total = rawProjectIssues.length;
                const done = rawProjectIssues.filter((i) => i.status === 'Concluído').length;
                const inProgress = rawProjectIssues.filter((i) => i.status === 'Em Progresso').length;
                const todo = rawProjectIssues.filter((i) => i.status === 'A Fazer').length;
                const priorityCounts: Record<string, number> = { Baixa: 0, Média: 0, Alta: 0, Urgente: 0 };
                rawProjectIssues.forEach((i) => { priorityCounts[i.priority] = (priorityCounts[i.priority] || 0) + 1; });
                const assigneeCounts = new Map<string, { count: number; avatarUrl?: string }>();
                rawProjectIssues.forEach((i) => {
                  i.assignees.forEach((a) => {
                    const entry = assigneeCounts.get(a.name) || { count: 0, avatarUrl: a.avatarUrl };
                    entry.count += 1;
                    assigneeCounts.set(a.name, entry);
                  });
                });
                const topAssignees = Array.from(assigneeCounts.entries())
                  .sort((a, b) => b[1].count - a[1].count)
                  .slice(0, 5);

                return (
                  <>
                    {/* Cards de resumo */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                      {[
                        { label: 'Total de Issues', value: total, color: theme.textPrimary },
                        { label: 'Concluídas', value: done, color: '#10b981' },
                        { label: 'Em Progresso', value: inProgress, color: '#f59e0b' },
                        { label: 'Abertas', value: todo, color: '#3b82f6' },
                        { label: 'Sprints Ativas', value: activeSprintsCount, color: accentColor },
                      ].map((stat) => (
                        <div key={stat.label} style={{ background: theme.viewCardBg, borderRadius: 8, padding: '12px 14px' }}>
                          <div style={{ fontSize: 22, fontWeight: 600, color: stat.color }}>{stat.value}</div>
                          <div style={{ fontSize: 11, color: theme.textSecondary, marginTop: 2 }}>{stat.label}</div>
                        </div>
                      ))}
                    </div>

                    {/* Distribuição por prioridade */}
                    <div>
                      <div style={{ fontSize: 12.5, fontWeight: 500, color: theme.textPrimary, marginBottom: 8 }}>Distribuição por Prioridade</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {(['Urgente', 'Alta', 'Média', 'Baixa'] as const).map((p) => {
                          const count = priorityCounts[p] || 0;
                          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                          const color = p === 'Urgente' ? '#dc2626' : p === 'Alta' ? '#ef4444' : p === 'Média' ? '#f59e0b' : '#22c55e';
                          return (
                            <div key={p} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 11, color: theme.textSecondary, width: 60 }}>{p}</span>
                              <div style={{ flex: 1, height: 6, borderRadius: 3, background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', overflow: 'hidden' }}>
                                <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 3 }} />
                              </div>
                              <span style={{ fontSize: 11, color: theme.textSecondary, width: 30, textAlign: 'right' }}>{count}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Top responsáveis */}
                    {topAssignees.length > 0 && (
                      <div>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: theme.textPrimary, marginBottom: 8 }}>Responsáveis com Mais Issues</div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {topAssignees.map(([name, info]) => (
                            <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <div style={{ width: 22, height: 22, borderRadius: '50%', overflow: 'hidden', background: accentColor, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 10 }}>
                                {info.avatarUrl ? <img src={info.avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : name.charAt(0).toUpperCase()}
                              </div>
                              <span style={{ fontSize: 12, color: theme.textPrimary, flex: 1 }}>{name}</span>
                              <span style={{ fontSize: 11, color: theme.textSecondary }}>{info.count} issue(s)</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        ) : selectedSection === 'links' ? (
          /* ========================================================================= */
          /* TELA DE LINKS: URLs reais do repositório + links customizados locais       */
          /* ========================================================================= */
          <div
            style={{
              width: '100%',
              background: theme.bgShelf,
              borderRadius: 10,
              border: theme.shelfBorder,
              boxShadow: theme.shelfShadow,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              padding: 5,
              boxSizing: 'border-box',
              marginTop: 4,
              flex: 1,
              minHeight: 360,
            }}
          >
            <div
              style={{
                background: theme.viewCanvasBg,
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 18,
                flex: 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Link2 size={17} color={accentColor} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: theme.textPrimary }}>Links do Projeto</div>
                  <div style={{ fontSize: 11.5, color: theme.textSecondary }}>{selectedProject?.title || 'repositório'}</div>
                </div>
              </div>

              {/* Links reais do repositório */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {[
                  { label: 'Repositório no GitHub', url: selectedProject?.htmlUrl },
                  { label: 'Clone (HTTPS)', url: selectedRepoRaw?.clone_url },
                  { label: 'Clone (SSH)', url: selectedRepoRaw?.ssh_url },
                  { label: 'Homepage', url: selectedRepoRaw?.homepage || undefined },
                ]
                  .filter((l) => l.url)
                  .map((l) => (
                    <div
                      key={l.label}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 12px',
                        borderRadius: 8,
                        background: theme.viewCardBg,
                      }}
                    >
                      <span style={{ fontSize: 12.5, color: theme.textPrimary, fontWeight: 500, minWidth: 150 }}>{l.label}</span>
                      <span style={{ fontSize: 11.5, color: theme.textSecondary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {l.url}
                      </span>
                      <Copy
                        size={13}
                        color={theme.textSecondary}
                        style={{ cursor: 'pointer', flexShrink: 0 }}
                        title="Copiar link"
                        onClick={() => {
                          navigator.clipboard?.writeText(l.url!);
                          showToast('Link copiado.');
                        }}
                      />
                      <ExternalLink
                        size={13}
                        color={theme.textSecondary}
                        style={{ cursor: 'pointer', flexShrink: 0 }}
                        title="Abrir"
                        onClick={() => window.electronAPI?.shell?.openExternal?.(l.url!)}
                      />
                    </div>
                  ))}
              </div>

              {/* Links customizados */}
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 500, color: theme.textPrimary, marginBottom: 8 }}>Links Personalizados</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                  {(customLinks[selectedProject?.fullName || ''] || []).map((link) => (
                    <div
                      key={link.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '9px 12px',
                        borderRadius: 8,
                        background: theme.viewCardBg,
                      }}
                    >
                      <span style={{ fontSize: 12.5, color: theme.textPrimary, fontWeight: 500, minWidth: 150 }}>{link.label}</span>
                      <span style={{ fontSize: 11.5, color: theme.textSecondary, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {link.url}
                      </span>
                      <ExternalLink
                        size={13}
                        color={theme.textSecondary}
                        style={{ cursor: 'pointer', flexShrink: 0 }}
                        onClick={() => window.electronAPI?.shell?.openExternal?.(link.url)}
                      />
                      <Trash2
                        size={13}
                        color="#ef4444"
                        style={{ cursor: 'pointer', flexShrink: 0 }}
                        onClick={() => handleRemoveCustomLink(link.id)}
                      />
                    </div>
                  ))}
                  {(customLinks[selectedProject?.fullName || ''] || []).length === 0 && (
                    <div style={{ fontSize: 12, color: theme.textSecondary, padding: '6px 2px' }}>Nenhum link personalizado ainda.</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <input
                    type="text"
                    value={newLinkLabel}
                    onChange={(e) => setNewLinkLabel(e.target.value)}
                    placeholder="Nome (ex: Figma, Documentação)"
                    style={{ background: theme.controlBg, border: 'none', borderRadius: 6, padding: '7px 10px', color: theme.textPrimary, fontSize: 12, outline: 'none', flex: '1 1 160px' }}
                  />
                  <input
                    type="text"
                    value={newLinkUrl}
                    onChange={(e) => setNewLinkUrl(e.target.value)}
                    placeholder="https://..."
                    style={{ background: theme.controlBg, border: 'none', borderRadius: 6, padding: '7px 10px', color: theme.textPrimary, fontSize: 12, outline: 'none', flex: '2 1 220px' }}
                  />
                  <button
                    type="button"
                    onClick={handleAddCustomLink}
                    disabled={!newLinkLabel.trim() || !newLinkUrl.trim()}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: accentColor,
                      border: 'none',
                      borderRadius: 6,
                      padding: '7px 14px',
                      color: accentContrastText,
                      fontSize: 12,
                      cursor: !newLinkLabel.trim() || !newLinkUrl.trim() ? 'default' : 'pointer',
                      opacity: !newLinkLabel.trim() || !newLinkUrl.trim() ? 0.5 : 1,
                    }}
                  >
                    <Plus size={13} color={accentContrastText} />
                    <span>Adicionar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        ) : selectedSection === 'time' ? (
          /* ========================================================================= */
          /* TELA DE TIME: colaboradores reais do repositório                          */
          /* ========================================================================= */
          <div
            style={{
              width: '100%',
              background: theme.bgShelf,
              borderRadius: 10,
              border: theme.shelfBorder,
              boxShadow: theme.shelfShadow,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              padding: 5,
              boxSizing: 'border-box',
              marginTop: 4,
              flex: 1,
              minHeight: 360,
            }}
          >
            <div
              style={{
                background: theme.viewCanvasBg,
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                flex: 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Users size={17} color={accentColor} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: theme.textPrimary }}>Time do Projeto</div>
                  <div style={{ fontSize: 11.5, color: theme.textSecondary }}>Colaboradores de {selectedProject?.title || 'repositório'}</div>
                </div>
              </div>

              {isLoadingProjectIssues && collaboratorsForSelectedRepo.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: theme.textSecondary, fontSize: 13 }}>Carregando time...</div>
              ) : collaboratorsForSelectedRepo.length === 0 ? (
                <div style={{ padding: '40px 0', textAlign: 'center', color: theme.textSecondary, fontSize: 13 }}>
                  Nenhum colaborador encontrado para este repositório.
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {collaboratorsForSelectedRepo.map((c) => (
                    <div
                      key={c.login}
                      onClick={() => window.electronAPI?.shell?.openExternal?.(c.htmlUrl)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        padding: '10px 12px',
                        borderRadius: 8,
                        background: theme.viewCardBg,
                        cursor: 'pointer',
                      }}
                    >
                      <div style={{ width: 32, height: 32, borderRadius: '50%', overflow: 'hidden', flexShrink: 0, background: accentColor }}>
                        {c.avatarUrl && <img src={c.avatarUrl} alt={c.login} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 500, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.login}
                        </div>
                        {typeof c.contributions === 'number' && (
                          <div style={{ fontSize: 10.5, color: theme.textSecondary }}>{c.contributions} contribuições</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : selectedSection === 'configuracoes' ? (
          /* ========================================================================= */
          /* TELA DE CONFIGURAÇÕES: metadados reais do repositório selecionado         */
          /* ========================================================================= */
          <div
            style={{
              width: '100%',
              background: theme.bgShelf,
              borderRadius: 10,
              border: theme.shelfBorder,
              boxShadow: theme.shelfShadow,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              padding: 5,
              boxSizing: 'border-box',
              marginTop: 4,
              flex: 1,
              minHeight: 360,
            }}
          >
            <div
              style={{
                background: theme.viewCanvasBg,
                borderRadius: 8,
                padding: 16,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                flex: 1,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <Settings size={17} color={accentColor} />
                <div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: theme.textPrimary }}>Configurações do Repositório</div>
                  <div style={{ fontSize: 11.5, color: theme.textSecondary }}>{selectedRepoRaw?.full_name || selectedProject?.title}</div>
                </div>
                {selectedProject?.htmlUrl && (
                  <button
                    type="button"
                    onClick={() => window.electronAPI?.shell?.openExternal?.(`${selectedProject.htmlUrl}/settings`)}
                    style={{
                      marginLeft: 'auto',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: theme.controlBg,
                      border: 'none',
                      borderRadius: 8,
                      padding: '6px 14px',
                      color: theme.textPrimary,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    <ExternalLink size={13} />
                    <span>Editar no GitHub</span>
                  </button>
                )}
              </div>

              {selectedRepoRaw?.description && (
                <div style={{ fontSize: 12.5, color: theme.textSecondary, lineHeight: 1.5 }}>{selectedRepoRaw.description}</div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 10 }}>
                <div style={{ background: theme.viewCardBg, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  {selectedRepoRaw?.private ? <Lock size={14} color={theme.textSecondary} /> : <Globe size={14} color={theme.textSecondary} />}
                  <span style={{ fontSize: 12, color: theme.textPrimary }}>{selectedRepoRaw?.private ? 'Privado' : 'Público'}</span>
                </div>
                <div style={{ background: theme.viewCardBg, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GitBranch size={14} color={theme.textSecondary} />
                  <span style={{ fontSize: 12, color: theme.textPrimary }}>{selectedRepoRaw?.default_branch || 'main'}</span>
                </div>
                <div style={{ background: theme.viewCardBg, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Star size={14} color={theme.textSecondary} />
                  <span style={{ fontSize: 12, color: theme.textPrimary }}>{selectedRepoRaw?.stargazers_count ?? 0} stars</span>
                </div>
                <div style={{ background: theme.viewCardBg, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <GitFork size={14} color={theme.textSecondary} />
                  <span style={{ fontSize: 12, color: theme.textPrimary }}>{selectedRepoRaw?.forks_count ?? 0} forks</span>
                </div>
                {selectedRepoRaw?.language && (
                  <div style={{ background: theme.viewCardBg, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag size={14} color={theme.textSecondary} />
                    <span style={{ fontSize: 12, color: theme.textPrimary }}>{selectedRepoRaw.language}</span>
                  </div>
                )}
                {selectedRepoRaw?.updated_at && (
                  <div style={{ background: theme.viewCardBg, borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Clock size={14} color={theme.textSecondary} />
                    <span style={{ fontSize: 12, color: theme.textPrimary }}>
                      Atualizado {new Date(selectedRepoRaw.updated_at).toLocaleDateString('pt-BR')}
                    </span>
                  </div>
                )}
              </div>

              {selectedRepoRaw?.topics && selectedRepoRaw.topics.length > 0 && (
                <div>
                  <div style={{ fontSize: 12.5, fontWeight: 500, color: theme.textPrimary, marginBottom: 8 }}>Topics</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {selectedRepoRaw.topics.map((topic) => (
                      <span
                        key={topic}
                        style={{ fontSize: 11, padding: '3px 9px', borderRadius: 12, background: hexToRgba(accentColor, 0.15), color: accentColor }}
                      >
                        {topic}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : (
        <>
        {/* ========================================================================= */}
        {/* CONTAINER UNIFICADO: Controles + Visualizador (Timeline, Kanban, Planilha) */}
        {/* ========================================================================= */}
        <div
          style={{
            width: '100%',
            background: theme.bgShelf,
            borderRadius: 10,
            border: theme.shelfBorder,
            boxShadow: theme.shelfShadow,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            padding: 5,
            boxSizing: 'border-box',
            overflow: 'hidden',
            marginTop: 4,
            flex: 1,
            minHeight: 360,
          }}
        >
          {/* Barra Superior de Controles: Seletor de visualização + Ações (direto no card, sem div interna) */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              width: '100%',
              padding: '4px 4px',
              background: 'transparent',
              border: 'none',
              flexWrap: 'wrap',
              gap: 12,
              boxSizing: 'border-box',
            }}
          >
          {/* Lado Esquerdo: Switcher em Pílula (Spreadsheet, Timeline, Kanban) + Info do Projeto */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                background: theme.controlBg,
                borderRadius: 8,
                padding: 3,
                border: theme.controlBorder,
                gap: 2,
              }}
            >
              {/* Botão Spreadsheet */}
              <button
                type="button"
                onClick={() => setViewMode('spreadsheet')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: viewMode === 'spreadsheet' ? (isEffectiveDark ? '#242424' : '#e2e8f0') : 'transparent',
                  color: viewMode === 'spreadsheet' ? theme.textPrimary : theme.textSecondary,
                  fontSize: 12,
                  fontWeight: '300',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (viewMode !== 'spreadsheet') e.currentTarget.style.color = theme.textPrimary;
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'spreadsheet') e.currentTarget.style.color = theme.textSecondary;
                }}
              >
                <TableIcon size={13} />
                <span>Spreadsheet</span>
              </button>

              {/* Botão Timeline */}
              <button
                type="button"
                onClick={() => setViewMode('timeline')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: viewMode === 'timeline' ? (isEffectiveDark ? '#242424' : '#e2e8f0') : 'transparent',
                  color: viewMode === 'timeline' ? theme.textPrimary : theme.textSecondary,
                  fontSize: 12,
                  fontWeight: '300',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (viewMode !== 'timeline') e.currentTarget.style.color = theme.textPrimary;
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'timeline') e.currentTarget.style.color = theme.textSecondary;
                }}
              >
                <GanttChart size={13.5} />
                <span>Timeline</span>
              </button>

              {/* Botão Kanban */}
              <button
                type="button"
                onClick={() => setViewMode('kanban')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: viewMode === 'kanban' ? (isEffectiveDark ? '#242424' : '#e2e8f0') : 'transparent',
                  color: viewMode === 'kanban' ? theme.textPrimary : theme.textSecondary,
                  fontSize: 12,
                  fontWeight: '300',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (viewMode !== 'kanban') e.currentTarget.style.color = theme.textPrimary;
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'kanban') e.currentTarget.style.color = theme.textSecondary;
                }}
              >
                <KanbanIcon size={13} />
                <span>Kanban</span>
              </button>
            </div>
          </div>

          {/* Lado Direito: Busca, Filtro, Ordenação e Adicionar Tarefa */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            {/* Campo de Busca de Tarefas */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: theme.controlBg,
                borderRadius: 8,
                padding: '0 12px',
                height: 32,
                width: 190,
                border: theme.controlBorder,
              }}
            >
              <Search size={13} color={theme.textSecondary} />
              <input
                type="text"
                value={taskSearchQuery}
                onChange={(e) => setTaskSearchQuery(e.target.value)}
                placeholder="Buscar tarefas..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: theme.textPrimary,
                  fontSize: 12,
                  fontWeight: '300',
                  width: '100%',
                  fontFamily: 'inherit',
                }}
              />
              {taskSearchQuery && (
                <X
                  size={13}
                  color={theme.textSecondary}
                  style={{ cursor: 'pointer' }}
                  onClick={() => setTaskSearchQuery('')}
                />
              )}
            </div>

            {/* Botão de Filtro com Dropdown */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterDropdownOpen((prev) => !prev);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  background: theme.controlBg,
                  border: theme.controlBorder,
                  borderRadius: 8,
                  padding: '6px 12px',
                  color: selectedPriorityFilter !== 'Todas' ? accentColor : theme.textPrimary,
                  fontSize: 12,
                  fontWeight: '300',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.controlHoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = theme.controlBg)}
              >
                <Filter size={13} color={selectedPriorityFilter !== 'Todas' ? accentColor : theme.textSecondary} />
                <span>{selectedPriorityFilter === 'Todas' ? 'Filtro' : selectedPriorityFilter}</span>
              </button>

              {/* Dropdown de Filtro */}
              {filterDropdownOpen && (
                <div
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 6px)',
                    right: 0,
                    background: theme.dropdownBg,
                    borderRadius: 8,
                    padding: 5,
                    zIndex: 1000,
                    minWidth: 150,
                    boxShadow: theme.dropdownShadow,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 2,
                    border: theme.dropdownBorder,
                  }}
                >
                  {['Todas', 'Urgente', 'Alta', 'Média', 'Baixa'].map((prio) => (
                    <div
                      key={prio}
                      onClick={() => {
                        setSelectedPriorityFilter(prio);
                        setFilterDropdownOpen(false);
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: '300',
                        color: theme.textPrimary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: selectedPriorityFilter === prio ? theme.dropdownItemHover : 'transparent',
                        border: 'none',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background =
                          selectedPriorityFilter === prio ? theme.dropdownItemHover : 'transparent')
                      }
                    >
                      <span>{prio === 'Todas' ? 'Todas Prioridades' : prio}</span>
                      {selectedPriorityFilter === prio && <Check size={12} color={accentColor} />}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Botão de Ordenação */}
            <button
              type="button"
              onClick={() => {
                setSortMode((prev) => (prev === 'default' ? 'priority' : prev === 'priority' ? 'date' : 'default'));
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: theme.controlBg,
                border: theme.controlBorder,
                borderRadius: 8,
                padding: '6px 12px',
                color: sortMode !== 'default' ? accentColor : theme.textPrimary,
                fontSize: 12,
                fontWeight: '300',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = theme.controlHoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = theme.controlBg)}
              title={`Ordenar: ${sortMode === 'default' ? 'Padrão' : sortMode === 'priority' ? 'Por Prioridade' : 'Por Data'}`}
            >
              <ArrowUpDown size={13} color={sortMode !== 'default' ? accentColor : theme.textSecondary} />
              <span>{sortMode === 'default' ? 'Ordenar' : sortMode === 'priority' ? 'Prioridade' : 'Data'}</span>
            </button>

            {/* Botão + Adicionar Tarefa */}
            <button
              type="button"
              onClick={() => setIsAddTaskModalOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: accentColor,
                border: 'none',
                borderRadius: 8,
                padding: '6px 14px',
                color: accentContrastText,
                fontSize: 12,
                fontWeight: '400',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.opacity = '0.88';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.opacity = '1';
              }}
            >
              <Plus size={13.5} color={accentContrastText} />
              <span>Nova Tarefa</span>
            </button>
          </div>
        </div>

          {/* ========================================================= */}
          {/* VIEW 1: TIMELINE (LINHA DO TEMPO)                         */}
          {/* ========================================================= */}
          {viewMode === 'timeline' && (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 8, flex: 1, minHeight: 0 }}>
              {/* Cabeçalho: mês/ano atual + seletor de zoom */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                <span style={{ fontSize: 12.5, color: theme.textSecondary, fontWeight: '400', textTransform: 'capitalize' }}>
                  {timelineDays[0]?.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                </span>
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    background: theme.controlBg,
                    borderRadius: 8,
                    padding: 3,
                    border: theme.controlBorder,
                    gap: 2,
                  }}
                >
                  {([
                    { id: 'week', label: 'Semana' },
                    { id: 'twoWeeks', label: 'Quinzena' },
                    { id: 'month', label: 'Mês' },
                  ] as const).map((z) => (
                    <button
                      key={z.id}
                      type="button"
                      onClick={() => setTimelineZoom(z.id)}
                      style={{
                        padding: '5px 11px',
                        borderRadius: 6,
                        background: timelineZoom === z.id ? (isEffectiveDark ? '#242424' : '#e2e8f0') : 'transparent',
                        color: timelineZoom === z.id ? theme.textPrimary : theme.textSecondary,
                        fontSize: 11.5,
                        fontWeight: '300',
                        cursor: 'pointer',
                        border: 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {z.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ width: '100%', overflowX: 'auto', flex: 1, minHeight: 0 }} className="no-scrollbar">
                <div style={{ minWidth: timelineDays.length * timelineColWidth, display: 'flex', flexDirection: 'column', gap: 5, height: '100%' }}>
                  {/* Cabeçalho dos Dias */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: `repeat(${timelineDays.length}, 1fr)`,
                      background: theme.viewCanvasBg,
                      borderRadius: 8,
                      border: 'none',
                      flexShrink: 0,
                    }}
                  >
                    {timelineDays.map((d) => {
                      const isCurrent = d.getTime() === todayStart.getTime();
                      return (
                        <div
                          key={d.toISOString()}
                          style={{
                            padding: timelineZoom === 'month' ? '8px 6px' : '10px 14px',
                            display: 'flex',
                            flexDirection: timelineZoom === 'month' ? 'column' : 'row',
                            alignItems: timelineZoom === 'month' ? 'center' : 'center',
                            gap: timelineZoom === 'month' ? 2 : 7,
                            fontSize: 12,
                            fontWeight: '300',
                            color: isCurrent ? (isEffectiveDark ? '#ffffff' : accentColor) : theme.textSecondary,
                            border: 'none',
                            boxSizing: 'border-box',
                          }}
                        >
                          <span style={{ letterSpacing: '0.04em', fontSize: timelineZoom === 'month' ? 10 : 12 }}>
                            {WEEKDAY_LABELS_PT[d.getDay()]}
                          </span>
                          <span
                            style={{
                              fontWeight: '400',
                              color: isCurrent ? (isEffectiveDark ? '#ffffff' : accentColor) : (isEffectiveDark ? '#aaaaaa' : '#475569'),
                            }}
                          >
                            {d.getDate()}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Grid Canvas com as colunas dos dias e cards posicionados */}
                  <div
                    style={{
                      position: 'relative',
                      background: theme.viewCanvasBg,
                      borderRadius: 8,
                      border: 'none',
                      overflow: 'hidden',
                      width: '100%',
                      flex: 1,
                      minHeight: 280,
                    }}
                  >
                    {/* Colunas verticais de fundo preenchendo a altura exata dos cards */}
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: 0,
                        right: 0,
                        display: 'grid',
                        gridTemplateColumns: `repeat(${timelineDays.length}, 1fr)`,
                        pointerEvents: 'none',
                      }}
                    >
                      {timelineDays.map((d, colIdx) => {
                        const isCurrent = d.getTime() === todayStart.getTime();
                        return (
                          <div
                            key={colIdx}
                            style={{
                              height: '100%',
                              borderRight: `1px solid ${theme.tableBorder}`,
                              background: isCurrent
                                ? `repeating-linear-gradient(0deg, ${hexToRgba(accentColor, isEffectiveDark ? 0.03 : 0.04)}, ${hexToRgba(accentColor, isEffectiveDark ? 0.03 : 0.04)} 2px, transparent 2px, transparent 5px)`
                                : 'transparent',
                              position: 'relative',
                            }}
                          >
                            {/* Linha vertical no dia ativo */}
                            {isCurrent && (
                              <div
                                style={{
                                  position: 'absolute',
                                  top: 0,
                                  bottom: 0,
                                  left: '50%',
                                  width: 2,
                                  background: accentColor,
                                  boxShadow: `0 0 10px ${hexToRgba(accentColor, 0.6)}`,
                                  zIndex: 2,
                                }}
                              />
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Camada contendo os cards de tarefas dispostos na linha do tempo (fluxo normal, sem espaço livre residual) */}
                    <div
                      style={{
                        position: 'relative',
                        padding: '16px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 12,
                        zIndex: 5,
                      }}
                    >
                  {projectIssues.length > 0 ? (
                    projectIssues.map((issue) => {
                      const pos = getIssueTimelinePosition(issue, timelineDays);
                      if (!pos) return null;
                      const { leftPercent, widthPercent } = pos;

                      if (timelineZoom === 'month') {
                        return (
                          <div
                            key={issue.id}
                            style={{
                              marginLeft: `${leftPercent}%`,
                              width: `calc(${widthPercent}% - 8px)`,
                              minWidth: 90,
                              background: theme.viewCardBg,
                              borderRadius: 6,
                              border: theme.viewCardBorder,
                              padding: '7px 8px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                              boxSizing: 'border-box',
                              boxShadow: theme.viewCardShadow,
                              transition: 'background 0.18s ease, transform 0.18s ease',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => {
                              e.currentTarget.style.background = theme.viewCardHoverBg;
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = theme.viewCardBg;
                              e.currentTarget.style.transform = 'translateY(0)';
                            }}
                            onClick={() => handleToggleIssueStatus(issue.id)}
                            title={issue.title}
                          >
                            <div
                              style={{
                                width: 3,
                                height: 16,
                                borderRadius: 2,
                                background: getStatusBarColor(issue.status, isEffectiveDark),
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                color: theme.textPrimary,
                                fontSize: 12,
                                fontWeight: '300',
                                lineHeight: 1.2,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flex: 1,
                                minWidth: 0,
                              }}
                            >
                              {issue.title}
                            </span>
                            {renderIssueOptionsButton(issue, 13)}
                          </div>
                        );
                      }

                      return (
                        <div
                          key={issue.id}
                          style={{
                            marginLeft: `${leftPercent}%`,
                            width: `calc(${widthPercent}% - 14px)`,
                            minWidth: 240,
                            maxWidth: 380,
                            background: theme.viewCardBg,
                            borderRadius: 8,
                            border: theme.viewCardBorder,
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 10,
                            boxSizing: 'border-box',
                            boxShadow: theme.viewCardShadow,
                            transition: 'background 0.18s ease, transform 0.18s ease',
                            cursor: 'pointer',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = theme.viewCardHoverBg;
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = theme.viewCardBg;
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                          onClick={() => handleToggleIssueStatus(issue.id)}
                          title="Clique para alternar o status da tarefa"
                        >
                          {/* Cabeçalho do Card */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              justifyContent: 'space-between',
                              gap: 10,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, flex: 1, minWidth: 0 }}>
                              <div
                                style={{
                                  width: 3.5,
                                  height: 28,
                                  borderRadius: 2,
                                  background: getStatusBarColor(issue.status, isEffectiveDark),
                                  flexShrink: 0,
                                  marginTop: 2,
                                }}
                              />
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                                <span
                                  style={{
                                    color: theme.textPrimary,
                                    fontSize: 13,
                                    fontWeight: '300',
                                    lineHeight: 1.25,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {issue.title}
                                </span>
                                <span style={{ color: theme.textSecondary, fontSize: 11, fontWeight: '300', lineHeight: 1 }}>
                                  {formatIssueDateRange(issue)}
                                </span>
                              </div>
                            </div>
                            {renderIssueOptionsButton(issue, 14)}
                          </div>

                          {/* Rodapé do Card */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              marginTop: 2,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              <span
                                style={{
                                  background: issue.tagColor.bg,
                                  color: issue.tagColor.text,
                                  fontSize: 10.5,
                                  fontWeight: '300',
                                  borderRadius: 4,
                                  padding: '2px 7px',
                                  lineHeight: 1.2,
                                  border: 'none',
                                }}
                              >
                                {issue.tag}
                              </span>
                              <span
                                style={{
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                                  color: issue.priorityColor,
                                  fontSize: 10.5,
                                  fontWeight: '300',
                                  borderRadius: 4,
                                  padding: '2px 7px',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  lineHeight: 1.2,
                                  border: 'none',
                                }}
                              >
                                <span style={{ width: 5, height: 5, borderRadius: '50%', background: issue.priorityColor }} />
                                {issue.priority}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                              {issue.assignees.map((a, i) => (
                                <div
                                  key={i}
                                  title={a.name}
                                  style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    background: a.avatarBg,
                                    color: '#ffffff',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontSize: 9.5,
                                    fontWeight: '400',
                                    marginLeft: i > 0 ? -5 : 0,
                                    border: `1.5px solid ${theme.viewCardBg}`,
                                    userSelect: 'none',
                                    overflow: 'hidden',
                                  }}
                                >
                                  {a.avatarUrl ? (
                                    <img src={a.avatarUrl} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    a.initial
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div
                      style={{
                        padding: '40px 20px',
                        textAlign: 'center',
                        color: theme.textSecondary,
                        fontSize: 13,
                        fontWeight: '300',
                        margin: 'auto',
                      }}
                    >
                      {isLoadingProjectIssues
                        ? 'Carregando issues do repositório...'
                        : projectIssuesError || 'Nenhuma tarefa encontrada para este projeto ou filtro.'}
                    </div>
                  )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW 2: KANBAN (QUADRO ÁGIL POR ESTADO)                   */}
          {/* ========================================================= */}
          {viewMode === 'kanban' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 5,
                padding: 0,
                background: 'transparent',
                flex: 1,
                minHeight: 380,
              }}
            >
              {(['A Fazer', 'Em Progresso', 'Concluído'] as const).map((columnStatus) => {
                const colIssues = projectIssues.filter((iss) => iss.status === columnStatus);
                const colAccent =
                  columnStatus === 'Concluído'
                    ? '#10b981'
                    : columnStatus === 'Em Progresso'
                    ? accentColor
                    : '#3b82f6';

                return (
                  <div
                    key={columnStatus}
                    style={{
                      background: theme.viewCanvasBg,
                      borderRadius: 8,
                      border: 'none',
                      padding: '12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      minHeight: 320,
                    }}
                  >
                    {/* Cabeçalho da Coluna */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '2px 4px 8px 4px',
                        border: 'none',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: colAccent }} />
                        <span style={{ color: theme.textPrimary, fontSize: 12.5, fontWeight: '300' }}>{columnStatus}</span>
                      </div>
                      <span
                        style={{
                          background: isEffectiveDark ? '#1f1f1f' : '#e2e8f0',
                          color: theme.textSecondary,
                          fontSize: 11,
                          fontWeight: '300',
                          borderRadius: 10,
                          padding: '1px 7px',
                        }}
                      >
                        {colIssues.length}
                      </span>
                    </div>

                    {/* Cards da Coluna - Identicos aos cards de projeto */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {colIssues.map((iss) => (
                        <div
                          key={iss.id}
                          onClick={() => handleToggleIssueStatus(iss.id)}
                          style={{
                            background: theme.viewCardBg,
                            borderRadius: 8,
                            border: theme.viewCardBorder,
                            padding: '12px 14px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 8,
                            cursor: 'pointer',
                            boxShadow: theme.viewCardShadow,
                            transition: 'background 0.18s ease, transform 0.18s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.background = theme.viewCardHoverBg;
                            e.currentTarget.style.transform = 'translateY(-1px)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = theme.viewCardBg;
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                          title="Clique para avançar o estado da tarefa"
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '300', fontFamily: 'monospace' }}>
                                {iss.id}
                              </span>
                              {/* Botão de Copiar / Criar Branch */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleCreateOrCopyBranch(iss);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                  fontSize: 10,
                                  color: theme.textSecondary,
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  cursor: 'pointer',
                                  transition: 'color 0.15s ease, background 0.15s ease',
                                }}
                                onMouseEnter={(e) => {
                                  e.currentTarget.style.color = theme.textPrimary;
                                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.color = theme.textSecondary;
                                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                                }}
                                title="Copiar comando git checkout -b da branch"
                              >
                                <GitBranch size={10.5} />
                                <span>branch</span>
                              </div>
                            </div>
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: '300',
                                color: iss.priorityColor,
                                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                                padding: '1px 6px',
                                borderRadius: 4,
                                border: 'none',
                              }}
                            >
                              {iss.priority}
                            </span>
                          </div>
                          <span style={{ color: theme.textPrimary, fontSize: 13, fontWeight: '300', lineHeight: 1.3 }}>
                            {iss.title}
                          </span>

                          {/* Pull Request Badge (se houver) */}
                          {iss.pullRequest && (
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                showToast(`PR #${iss.pullRequest?.number}: ${iss.pullRequest?.title}`);
                              }}
                              style={{
                                alignSelf: 'flex-start',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 5,
                                fontSize: 10.5,
                                fontWeight: 400,
                                color: iss.pullRequest.status === 'merged'
                                  ? '#a855f7'
                                  : iss.pullRequest.reviewStatus === 'approved'
                                  ? '#10b981'
                                  : iss.pullRequest.reviewStatus === 'changes_requested'
                                  ? '#ef4444'
                                  : '#3b82f6',
                                background: iss.pullRequest.status === 'merged'
                                  ? 'rgba(168, 85, 247, 0.12)'
                                  : iss.pullRequest.reviewStatus === 'approved'
                                  ? 'rgba(16, 185, 129, 0.12)'
                                  : iss.pullRequest.reviewStatus === 'changes_requested'
                                  ? 'rgba(239, 68, 68, 0.12)'
                                  : 'rgba(59, 130, 246, 0.12)',
                                padding: '2px 7px',
                                borderRadius: 5,
                                cursor: 'pointer',
                              }}
                              title={`PR #${iss.pullRequest.number}: ${iss.pullRequest.title}`}
                            >
                              <GitPullRequest size={11} />
                              <span>#{iss.pullRequest.number}</span>
                              <span style={{ fontSize: 10, opacity: 0.85 }}>
                                {iss.pullRequest.status === 'merged' ? 'Merged' : iss.pullRequest.reviewStatus === 'approved' ? 'Aprovado' : iss.pullRequest.reviewStatus === 'changes_requested' ? 'Mudanças Solicitadas' : 'Review Pendente'}
                              </span>
                              {iss.pullRequest.ciStatus === 'success' && <CheckCircle2 size={11} color="#10b981" title="CI/CD: Passou" />}
                              {iss.pullRequest.ciStatus === 'failure' && <AlertCircle size={11} color="#ef4444" title="CI/CD: Falhou" />}
                              {iss.pullRequest.ciStatus === 'pending' && <Clock size={11} color="#f59e0b" title="CI/CD: Em execução" />}
                            </div>
                          )}
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                            <span
                              style={{
                                background: iss.tagColor.bg,
                                color: iss.tagColor.text,
                                fontSize: 10.5,
                                fontWeight: '300',
                                padding: '2px 7px',
                                borderRadius: 4,
                                border: 'none',
                              }}
                            >
                              {iss.tag}
                            </span>
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {iss.assignees.map((a, i) => (
                                <div
                                  key={i}
                                  title={a.name}
                                  style={{
                                    width: 20,
                                    height: 20,
                                    borderRadius: '50%',
                                    background: a.avatarBg,
                                    color: '#ffffff',
                                    fontSize: 9.5,
                                    fontWeight: '400',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginLeft: i > 0 ? -5 : 0,
                                    border: `1.5px solid ${theme.viewCardBg}`,
                                    overflow: 'hidden',
                                  }}
                                >
                                  {a.avatarUrl ? (
                                    <img src={a.avatarUrl} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    a.initial
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      ))}
                      {colIssues.length === 0 && (
                        <div style={{ padding: '24px 0', textAlign: 'center', color: theme.textSecondary, fontSize: 12, fontWeight: '300' }}>
                          Nenhuma tarefa nesta etapa.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW 3: SPREADSHEET (TABELA DETALHADA COM MÉTRICAS)        */}
          {/* ========================================================= */}
          {viewMode === 'spreadsheet' && (
            <div style={{ width: '100%', overflowX: 'auto', background: theme.viewCanvasBg, borderRadius: 8, border: 'none', flex: 1, minHeight: 380 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 920 }}>
                <thead>
                  <tr style={{ background: theme.tableHeaderBg, border: 'none' }}>
                    <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '300' }}>ID</th>
                    <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '300' }}>Tarefa</th>
                    <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '300' }}>Pull Request</th>
                    <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '300' }}>Branch</th>
                    <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '300' }}>Status</th>
                    <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '300' }}>Prioridade</th>
                    <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '300' }}>Categoria</th>
                    <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '300' }}>Data</th>
                    <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '300' }}>Responsáveis</th>
                    <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '300' }}>Progresso</th>
                  </tr>
                </thead>
                <tbody>
                  {projectIssues.map((iss) => (
                    <tr
                      key={iss.id}
                      style={{
                        borderBottom: `1px solid ${theme.tableBorder}`,
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? '#1c1c1c' : '#f1f5f9')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <td style={{ padding: '10px 14px', fontSize: 12, color: theme.textSecondary, fontWeight: '300', fontFamily: 'monospace' }}>
                        {iss.id}
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 13, color: theme.textPrimary, fontWeight: '300' }}>
                        {iss.title}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        {iss.pullRequest ? (
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              showToast(`PR #${iss.pullRequest?.number}: ${iss.pullRequest?.title}`);
                            }}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 5,
                              fontSize: 11,
                              color: iss.pullRequest.status === 'merged'
                                ? '#a855f7'
                                : iss.pullRequest.reviewStatus === 'approved'
                                ? '#10b981'
                                : iss.pullRequest.reviewStatus === 'changes_requested'
                                ? '#ef4444'
                                : '#3b82f6',
                              background: iss.pullRequest.status === 'merged'
                                ? 'rgba(168, 85, 247, 0.12)'
                                : iss.pullRequest.reviewStatus === 'approved'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : iss.pullRequest.reviewStatus === 'changes_requested'
                                ? 'rgba(239, 68, 68, 0.12)'
                                : 'rgba(59, 130, 246, 0.12)',
                              padding: '2px 7px',
                              borderRadius: 4,
                              cursor: 'pointer',
                            }}
                            title={`PR #${iss.pullRequest.number}: ${iss.pullRequest.title}`}
                          >
                            <GitPullRequest size={11.5} />
                            <span>#{iss.pullRequest.number}</span>
                            {iss.pullRequest.ciStatus === 'success' && <CheckCircle2 size={11} color="#10b981" title="CI: Passou" />}
                            {iss.pullRequest.ciStatus === 'failure' && <AlertCircle size={11} color="#ef4444" title="CI: Falhou" />}
                            {iss.pullRequest.ciStatus === 'pending' && <Clock size={11} color="#f59e0b" title="CI: Em execução" />}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: theme.textMuted }}>—</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div
                          onClick={() => handleCreateOrCopyBranch(iss)}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                            fontSize: 11,
                            color: theme.textSecondary,
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                            padding: '3px 8px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            fontFamily: 'monospace',
                            transition: 'color 0.15s ease, background 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = theme.textPrimary;
                            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = theme.textSecondary;
                            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                          }}
                          title="Copiar comando git checkout -b da branch"
                        >
                          <GitBranch size={11.5} />
                          <span>{iss.pullRequest ? iss.pullRequest.branch.split('/')[1] || iss.pullRequest.branch : `feature/${iss.id.toLowerCase()}`}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          onClick={() => handleToggleIssueStatus(iss.id)}
                          style={{
                            fontSize: 11,
                            fontWeight: '300',
                            padding: '2px 7px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            background:
                              iss.status === 'Concluído'
                                ? 'rgba(16, 185, 129, 0.12)'
                                : iss.status === 'Em Progresso'
                                ? hexToRgba(accentColor, 0.12)
                                : 'rgba(59, 130, 246, 0.12)',
                            color:
                              iss.status === 'Concluído'
                                ? '#34d399'
                                : iss.status === 'Em Progresso'
                                ? accentColor
                                : '#60a5fa',
                          }}
                          title="Clique para alternar status"
                        >
                          {iss.status}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: iss.priorityColor }} />
                          <span style={{ fontSize: 12, color: theme.textPrimary, fontWeight: '300' }}>{iss.priority}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px' }}>
                        <span
                          style={{
                            fontSize: 10.5,
                            fontWeight: '300',
                            padding: '2px 7px',
                            borderRadius: 4,
                            background: iss.tagColor.bg,
                            color: iss.tagColor.text,
                          }}
                        >
                          {iss.tag}
                        </span>
                      </td>
                      <td style={{ padding: '10px 14px', fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>{formatIssueDateRange(iss)}</td>
                      <td style={{ padding: '10px 14px' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {iss.assignees.map((a, i) => (
                            <div
                              key={i}
                              title={a.name}
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: '50%',
                                background: a.avatarBg,
                                color: '#ffffff',
                                fontSize: 9.5,
                                fontWeight: '400',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                marginLeft: i > 0 ? -5 : 0,
                                border: `1.5px solid ${theme.viewCanvasBg}`,
                                overflow: 'hidden',
                              }}
                            >
                              {a.avatarUrl ? (
                                <img src={a.avatarUrl} alt={a.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              ) : (
                                a.initial
                              )}
                            </div>
                          ))}
                        </div>
                      </td>
                      <td style={{ padding: '10px 14px', width: 140 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 2,
                              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${iss.progress}%`,
                                height: '100%',
                                background: iss.progress === 100 ? '#10b981' : accentColor,
                                borderRadius: 2,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 11, color: theme.textSecondary, fontWeight: '300', width: 32, textAlign: 'right' }}>
                            {iss.progress}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {projectIssues.length === 0 && (
                    <tr>
                      <td colSpan={10} style={{ padding: '36px', textAlign: 'center', color: theme.textSecondary, fontSize: 13, fontWeight: '300' }}>
                        {isLoadingProjectIssues ? 'Carregando issues do repositório...' : projectIssuesError || 'Nenhuma tarefa encontrada.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        </>
        )}

        {/* Modal de Nova Tarefa (fluxo inspirado no "Create new issue" do GitHub) */}
        {isAddTaskModalOpen && (
          <div
            onClick={() => !isCreatingTask && setIsAddTaskModalOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: theme.modalOverlay,
              backdropFilter: 'blur(6px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 560,
                maxHeight: '85vh',
                overflowY: 'auto',
                background: theme.modalBg,
                borderRadius: 10,
                border: theme.modalBorder,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                boxShadow: theme.modalShadow,
              }}
              className="no-scrollbar"
            >
              {/* Título do Modal */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Plus size={16} color={accentColor} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: '400',
                      color: theme.textPrimary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Nova issue em {selectedProject?.fullName || selectedProject?.title || 'repositório'}
                  </span>
                </div>
                <div
                  onClick={() => setIsAddTaskModalOpen(false)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: theme.textSecondary,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
                >
                  <X size={16} />
                </div>
              </div>

              {/* Título da Tarefa */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Título</label>
                <input
                  type="text"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  placeholder="Ex: Refatorar API de autenticação"
                  style={{
                    background: theme.modalInputBg,
                    border: theme.modalInputBorder,
                    borderRadius: 6,
                    padding: '8px 12px',
                    color: theme.textPrimary,
                    fontSize: 13,
                    fontWeight: '300',
                    outline: 'none',
                  }}
                />
              </div>

              {/* Descrição */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Descrição</label>
                <textarea
                  value={newTaskDescription}
                  onChange={(e) => setNewTaskDescription(e.target.value)}
                  placeholder="Digite a descrição da tarefa..."
                  rows={5}
                  style={{
                    background: theme.modalInputBg,
                    border: theme.modalInputBorder,
                    borderRadius: 6,
                    padding: '10px 12px',
                    color: theme.textPrimary,
                    fontSize: 12.5,
                    fontWeight: '300',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                  }}
                />
              </div>

              {/* Linha com Tag e Prioridade */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Categoria / Tag</label>
                  <select
                    value={newTaskTag}
                    onChange={(e) => setNewTaskTag(e.target.value)}
                    style={{
                      background: theme.modalInputBg,
                      border: theme.modalInputBorder,
                      borderRadius: 6,
                      padding: '8px 10px',
                      color: theme.textPrimary,
                      fontSize: 12.5,
                      fontWeight: '300',
                      outline: 'none',
                    }}
                  >
                    <option value="Research">Research</option>
                    <option value="Backend">Backend</option>
                    <option value="Frontend">Frontend</option>
                    <option value="Design">Design</option>
                    <option value="DevOps">DevOps</option>
                    <option value="QA">QA</option>
                    <option value="Release">Release</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Prioridade</label>
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value as any)}
                    style={{
                      background: theme.modalInputBg,
                      border: theme.modalInputBorder,
                      borderRadius: 6,
                      padding: '8px 10px',
                      color: theme.textPrimary,
                      fontSize: 12.5,
                      fontWeight: '300',
                      outline: 'none',
                    }}
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
              </div>

              {/* Sprint */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Sprint</label>
                  <button
                    type="button"
                    onClick={() => openCreateSprintModal('create')}
                    style={{ background: 'none', border: 'none', color: accentColor, fontSize: 11, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Plus size={11} /> Nova Sprint
                  </button>
                </div>
                <select
                  value={newTaskMilestoneNumber ?? ''}
                  onChange={(e) => setNewTaskMilestoneNumber(e.target.value ? Number(e.target.value) : null)}
                  style={{
                    background: theme.modalInputBg,
                    border: theme.modalInputBorder,
                    borderRadius: 6,
                    padding: '8px 10px',
                    color: theme.textPrimary,
                    fontSize: 12.5,
                    fontWeight: '300',
                    outline: 'none',
                  }}
                >
                  <option value="">Sem sprint</option>
                  {sprintsForSelectedRepo.filter((s) => s.state === 'open').map((s) => (
                    <option key={s.number} value={s.number}>
                      {s.title}
                      {s.dueDateIso ? ` (até ${formatShortDate(s.dueDateIso)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              {/* Status Inicial */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Status</label>
                <select
                  value={newTaskStatus}
                  onChange={(e) => setNewTaskStatus(e.target.value as any)}
                  style={{
                    background: theme.modalInputBg,
                    border: theme.modalInputBorder,
                    borderRadius: 6,
                    padding: '8px 10px',
                    color: theme.textPrimary,
                    fontSize: 12.5,
                    fontWeight: '300',
                    outline: 'none',
                  }}
                >
                  <option value="A Fazer">A Fazer</option>
                  <option value="Em Progresso">Em Progresso</option>
                  <option value="Concluído">Concluído</option>
                </select>
              </div>

              {/* Botões de Ação */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setIsAddTaskModalOpen(false)}
                  disabled={isCreatingTask}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    color: theme.textSecondary,
                    fontSize: 12.5,
                    fontWeight: '300',
                    cursor: isCreatingTask ? 'default' : 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateTask}
                  disabled={isCreatingTask || !newTaskTitle.trim()}
                  style={{
                    background: accentColor,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 18px',
                    color: accentContrastText,
                    fontSize: 12.5,
                    fontWeight: '400',
                    cursor: isCreatingTask || !newTaskTitle.trim() ? 'default' : 'pointer',
                    opacity: isCreatingTask || !newTaskTitle.trim() ? 0.6 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isCreatingTask && newTaskTitle.trim()) e.currentTarget.style.opacity = '0.88';
                  }}
                  onMouseLeave={(e) => {
                    if (!isCreatingTask && newTaskTitle.trim()) e.currentTarget.style.opacity = '1';
                  }}
                >
                  {isCreatingTask ? 'Criando...' : 'Criar Tarefa'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Editar Tarefa */}
        {editingIssue && (
          <div
            onClick={() => !isSavingEdit && setEditingIssue(null)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: theme.modalOverlay,
              backdropFilter: 'blur(6px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 560,
                maxHeight: '85vh',
                overflowY: 'auto',
                background: theme.modalBg,
                borderRadius: 10,
                border: theme.modalBorder,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                boxShadow: theme.modalShadow,
              }}
              className="no-scrollbar"
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                  <Pencil size={15} color={accentColor} style={{ flexShrink: 0 }} />
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: '400',
                      color: theme.textPrimary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    Editar {editingIssue.id}
                  </span>
                </div>
                <div
                  onClick={() => setEditingIssue(null)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: 4,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: theme.textSecondary,
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
                >
                  <X size={16} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Título</label>
                <input
                  type="text"
                  value={editIssueTitle}
                  onChange={(e) => setEditIssueTitle(e.target.value)}
                  style={{
                    background: theme.modalInputBg,
                    border: theme.modalInputBorder,
                    borderRadius: 6,
                    padding: '8px 12px',
                    color: theme.textPrimary,
                    fontSize: 13,
                    fontWeight: '300',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Descrição</label>
                <textarea
                  value={editIssueDescription}
                  onChange={(e) => setEditIssueDescription(e.target.value)}
                  placeholder="Digite a descrição da tarefa..."
                  rows={5}
                  style={{
                    background: theme.modalInputBg,
                    border: theme.modalInputBorder,
                    borderRadius: 6,
                    padding: '10px 12px',
                    color: theme.textPrimary,
                    fontSize: 12.5,
                    fontWeight: '300',
                    outline: 'none',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    lineHeight: 1.5,
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Categoria / Tag</label>
                  <select
                    value={editIssueTag}
                    onChange={(e) => setEditIssueTag(e.target.value)}
                    style={{
                      background: theme.modalInputBg,
                      border: theme.modalInputBorder,
                      borderRadius: 6,
                      padding: '8px 10px',
                      color: theme.textPrimary,
                      fontSize: 12.5,
                      fontWeight: '300',
                      outline: 'none',
                    }}
                  >
                    <option value="Research">Research</option>
                    <option value="Backend">Backend</option>
                    <option value="Frontend">Frontend</option>
                    <option value="Design">Design</option>
                    <option value="DevOps">DevOps</option>
                    <option value="QA">QA</option>
                    <option value="Release">Release</option>
                    {!(editIssueTag in TAG_LABEL_COLOR) && <option value={editIssueTag}>{editIssueTag}</option>}
                  </select>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Prioridade</label>
                  <select
                    value={editIssuePriority}
                    onChange={(e) => setEditIssuePriority(e.target.value as any)}
                    style={{
                      background: theme.modalInputBg,
                      border: theme.modalInputBorder,
                      borderRadius: 6,
                      padding: '8px 10px',
                      color: theme.textPrimary,
                      fontSize: 12.5,
                      fontWeight: '300',
                      outline: 'none',
                    }}
                  >
                    <option value="Baixa">Baixa</option>
                    <option value="Média">Média</option>
                    <option value="Alta">Alta</option>
                    <option value="Urgente">Urgente</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Sprint</label>
                  <button
                    type="button"
                    onClick={() => openCreateSprintModal('edit')}
                    style={{ background: 'none', border: 'none', color: accentColor, fontSize: 11, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                  >
                    <Plus size={11} /> Nova Sprint
                  </button>
                </div>
                <select
                  value={editIssueMilestoneNumber ?? ''}
                  onChange={(e) => setEditIssueMilestoneNumber(e.target.value ? Number(e.target.value) : null)}
                  style={{
                    background: theme.modalInputBg,
                    border: theme.modalInputBorder,
                    borderRadius: 6,
                    padding: '8px 10px',
                    color: theme.textPrimary,
                    fontSize: 12.5,
                    fontWeight: '300',
                    outline: 'none',
                  }}
                >
                  <option value="">Sem sprint</option>
                  {sprintsForSelectedRepo.filter((s) => s.state === 'open').map((s) => (
                    <option key={s.number} value={s.number}>
                      {s.title}
                      {s.dueDateIso ? ` (até ${formatShortDate(s.dueDateIso)})` : ''}
                    </option>
                  ))}
                  {editIssueMilestoneNumber != null && !sprintsForSelectedRepo.some((s) => s.number === editIssueMilestoneNumber) && (
                    <option value={editIssueMilestoneNumber}>{editingIssue?.milestoneTitle || 'Sprint atual'}</option>
                  )}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setEditingIssue(null)}
                  disabled={isSavingEdit}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    color: theme.textSecondary,
                    fontSize: 12.5,
                    fontWeight: '300',
                    cursor: isSavingEdit ? 'default' : 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleSaveEditIssue}
                  disabled={isSavingEdit || !editIssueTitle.trim()}
                  style={{
                    background: accentColor,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 18px',
                    color: accentContrastText,
                    fontSize: 12.5,
                    fontWeight: '400',
                    cursor: isSavingEdit || !editIssueTitle.trim() ? 'default' : 'pointer',
                    opacity: isSavingEdit || !editIssueTitle.trim() ? 0.6 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  {isSavingEdit ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Criar Sprint (milestone real do GitHub) */}
        {isCreateSprintModalOpen && (
          <div
            onClick={() => !isCreatingSprint && setIsCreateSprintModalOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: theme.modalOverlay,
              backdropFilter: 'blur(6px)',
              zIndex: 100001,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 420,
                background: theme.modalBg,
                borderRadius: 10,
                border: theme.modalBorder,
                padding: 22,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                boxShadow: theme.modalShadow,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={16} color={accentColor} />
                  <span style={{ fontSize: 14, fontWeight: '400', color: theme.textPrimary }}>Nova Sprint</span>
                </div>
                <div
                  onClick={() => setIsCreateSprintModalOpen(false)}
                  style={{ width: 24, height: 24, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: theme.textSecondary }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
                >
                  <X size={16} />
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Título (opcional)</label>
                <input
                  type="text"
                  value={newSprintTitle}
                  onChange={(e) => setNewSprintTitle(e.target.value)}
                  placeholder={`Sprint ${formatShortDate(newSprintStartDate)} - ...`}
                  style={{
                    background: theme.modalInputBg,
                    border: theme.modalInputBorder,
                    borderRadius: 6,
                    padding: '8px 12px',
                    color: theme.textPrimary,
                    fontSize: 13,
                    fontWeight: '300',
                    outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Duração</label>
                <div style={{ display: 'inline-flex', background: theme.controlBg, borderRadius: 8, padding: 3, gap: 2, alignSelf: 'flex-start' }}>
                  {([7, 15] as const).map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setNewSprintDuration(d)}
                      style={{
                        padding: '6px 16px',
                        borderRadius: 6,
                        background: newSprintDuration === d ? accentColor : 'transparent',
                        color: newSprintDuration === d ? accentContrastText : theme.textSecondary,
                        fontSize: 12.5,
                        fontWeight: newSprintDuration === d ? 500 : 300,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {d} dias
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Data de início</label>
                <DatePickerField
                  value={newSprintStartDate}
                  onChange={(v) => v && setNewSprintStartDate(v)}
                  accentColor={accentColor}
                  isEffectiveDark={isEffectiveDark}
                  inputBg={theme.modalInputBg}
                  inputBorder={theme.modalInputBorder}
                  textPrimary={theme.textPrimary}
                  textSecondary={theme.textSecondary}
                  dropdownBg={theme.dropdownBg}
                  dropdownShadow={theme.dropdownShadow}
                  dropdownBorder={theme.dropdownBorder}
                  dropdownItemHover={theme.dropdownItemHover}
                  showTodayShortcut
                />
                <span style={{ fontSize: 11, color: theme.textSecondary }}>
                  Termina em {formatShortDate((() => {
                    const d = new Date(`${newSprintStartDate}T00:00:00`);
                    d.setDate(d.getDate() + newSprintDuration - 1);
                    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
                  })())}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setIsCreateSprintModalOpen(false)}
                  disabled={isCreatingSprint}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    color: theme.textSecondary,
                    fontSize: 12.5,
                    fontWeight: '300',
                    cursor: isCreatingSprint ? 'default' : 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateSprint}
                  disabled={isCreatingSprint}
                  style={{
                    background: accentColor,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 18px',
                    color: accentContrastText,
                    fontSize: 12.5,
                    fontWeight: '400',
                    cursor: isCreatingSprint ? 'default' : 'pointer',
                    opacity: isCreatingSprint ? 0.6 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  {isCreatingSprint ? 'Criando...' : 'Criar Sprint'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Release Notes */}
        {isReleaseNotesModalOpen && (
          <div
            onClick={() => setIsReleaseNotesModalOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: theme.modalOverlay,
              backdropFilter: 'blur(6px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 540,
                background: theme.modalBg,
                borderRadius: 12,
                border: theme.modalBorder,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                boxShadow: theme.modalShadow,
              }}
            >
              {/* Header do Modal */}
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag size={16} color={accentColor} />
                    <span style={{ fontSize: 18, fontWeight: 500, color: theme.textPrimary }}>
                      {RELEASES_DATA[selectedVersion]?.releaseName || selectedVersion}
                    </span>
                  </div>
                  <span style={{ fontSize: 12, color: theme.textSecondary }}>
                    Tag: <code>{RELEASES_DATA[selectedVersion]?.tag || 'v2.4.0'}</code> • Publicado em {RELEASES_DATA[selectedVersion]?.dateStr} por {RELEASES_DATA[selectedVersion]?.author}
                  </span>
                </div>
                <div
                  onClick={() => setIsReleaseNotesModalOpen(false)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: theme.textSecondary,
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
                >
                  <X size={16} />
                </div>
              </div>

              {/* Milestone Box */}
              {RELEASES_DATA[selectedVersion]?.milestone && (
                <div
                  style={{
                    background: isEffectiveDark ? '#1b1b1b' : '#f8fafc',
                    borderRadius: 8,
                    padding: 12,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 500, color: theme.textPrimary }}>
                      {RELEASES_DATA[selectedVersion].milestone.title}
                    </span>
                    <span style={{ fontSize: 11, color: accentColor, fontWeight: 500 }}>
                      {RELEASES_DATA[selectedVersion].milestone.percent}% Concluído
                    </span>
                  </div>
                  <div
                    style={{
                      width: '100%',
                      height: 5,
                      borderRadius: 3,
                      background: isEffectiveDark ? '#2a2a2a' : '#e2e8f0',
                      overflow: 'hidden',
                    }}
                  >
                    <div
                      style={{
                        width: `${RELEASES_DATA[selectedVersion].milestone.percent}%`,
                        height: '100%',
                        background: accentColor,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: theme.textMuted }}>
                    <span>{RELEASES_DATA[selectedVersion].milestone.closedIssues} fechadas • {RELEASES_DATA[selectedVersion].milestone.openIssues} abertas</span>
                    <span>Prazo: {RELEASES_DATA[selectedVersion].milestone.dueDate}</span>
                  </div>
                </div>
              )}

              {/* Destaques / Changelog */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <span style={{ fontSize: 12.5, fontWeight: 500, color: theme.textPrimary }}>
                  Principais Mudanças & Melhorias:
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {RELEASES_DATA[selectedVersion]?.highlights.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        fontSize: 12.5,
                        color: theme.textSecondary,
                        lineHeight: 1.4,
                        paddingLeft: 4,
                      }}
                    >
                      {h}
                    </div>
                  ))}
                </div>
              </div>

              {/* Botões do Rodapé */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsReleaseNotesModalOpen(false)}
                  style={{
                    background: accentColor,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 18px',
                    color: accentContrastText,
                    fontSize: 12.5,
                    fontWeight: '400',
                    cursor: 'pointer',
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notificação de Feedback Rápido */}
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              bottom: 30,
              left: '50%',
              transform: 'translateX(-50%)',
              background: isEffectiveDark ? '#1e1e1e' : '#0f172a',
              color: '#ffffff',
              padding: '10px 18px',
              borderRadius: 8,
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              zIndex: 999999,
              fontSize: 12.5,
              fontWeight: 400,
              border: 'none',
              animation: 'fadeIn 0.15s ease-out',
            }}
          >
            <CheckCircle2 size={16} color={accentColor} />
            <span>{toastMessage}</span>
          </div>
        )}
      </div>
    </div>
  );
};
