import React, { useState, useMemo } from 'react';
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
  Layers,
  AlertCircle,
  GitPullRequest,
  GitBranch,
  GitCommit,
  Tag,
  ExternalLink,
  Copy,
  FileText,
  Users,
  Building2,
} from 'lucide-react';
import { getContrastTextColor, hexToRgba } from '../utils/color';

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
}

export interface ProjectIssue {
  id: string;
  projectId: number;
  title: string;
  dateStr: string;
  startDay: number; // 0 (MON 20) to 6 (SUN 26)
  spanDays: number; // 1 to 3
  tag: string;
  tagColor: { bg: string; text: string };
  priority: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  priorityColor: string;
  status: 'A Fazer' | 'Em Progresso' | 'Concluído';
  assignees: { name: string; avatarBg: string; initial: string }[];
  progress: number;
  pullRequest?: {
    number: number;
    title: string;
    branch: string;
    status: 'open' | 'merged' | 'draft';
    reviewStatus: 'approved' | 'review_required' | 'changes_requested';
    ciStatus: 'success' | 'failure' | 'pending';
    url?: string;
  };
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

export const RELEASES_DATA: Record<string, ProjectRelease> = {
  'v2.4 - Produção': {
    version: 'v2.4 - Produção',
    tag: 'v2.4.0',
    releaseName: 'v2.4 - Core Performance & Modern Workspace',
    dateStr: '18 Nov 2026',
    author: 'Walancy',
    status: 'published',
    milestone: {
      title: 'Milestone 2.4 - Estabilidade & Polish',
      totalIssues: 24,
      closedIssues: 22,
      openIssues: 2,
      percent: 92,
      dueDate: '20 Nov 2026',
    },
    highlights: [
      '🚀 Redução de 45% no tempo de bundle com rolldown e vite',
      '✨ Novo design border-free ultra-limpo com contraste adaptativo',
      '⚡ Integração de PRs e CI/CD actions no scheduler de projetos',
      '🐛 Otimização de concorrência nos terminais integrados PTY',
    ],
    commitsCount: 38,
  },
  'v2.5 - Release Candidate': {
    version: 'v2.5 - Release Candidate',
    tag: 'v2.5.0-rc1',
    releaseName: 'v2.5 - Team Collaboration & Git Ops',
    dateStr: 'Previsão: 02 Dez 2026',
    author: 'Walancy',
    status: 'pre-release',
    milestone: {
      title: 'Milestone 2.5 - Git Ops & Branches',
      totalIssues: 30,
      closedIssues: 18,
      openIssues: 12,
      percent: 60,
      dueDate: '02 Dez 2026',
    },
    highlights: [
      '🌿 Criação rápida de branches locais vinculadas a issues',
      '📊 Gráficos de pulso de commits e deployments em tempo real',
      '👥 Filtro inteligente de colaboradores por avatar',
    ],
    commitsCount: 24,
  },
  'v3.0 - Beta': {
    version: 'v3.0 - Beta',
    tag: 'v3.0.0-beta.1',
    releaseName: 'v3.0 - Cloud Workspaces & Next-Gen Extensions',
    dateStr: 'Previsão: Jan 2027',
    author: 'Walancy',
    status: 'draft',
    milestone: {
      title: 'Milestone 3.0 - Cloud Architecture',
      totalIssues: 50,
      closedIssues: 15,
      openIssues: 35,
      percent: 30,
      dueDate: '15 Jan 2027',
    },
    highlights: [
      '☁️ Suporte a workspaces distribuídos e sincronização remota',
      '🧩 Sistema modular de extensões nativas aceleradas',
    ],
    commitsCount: 14,
  },
};

export const TEAM_MEMBERS = [
  { name: 'Walancy', initial: 'W', avatarBg: '#ea580c', role: 'Tech Lead' },
  { name: 'Gabriel Costa', initial: 'G', avatarBg: '#0284c7', role: 'Full Stack' },
  { name: 'Ana Souza', initial: 'A', avatarBg: '#16a34a', role: 'Frontend' },
  { name: 'Carlos Lima', initial: 'C', avatarBg: '#0891b2', role: 'Backend' },
  { name: 'Lucas Silva', initial: 'L', avatarBg: '#9333ea', role: 'DevOps' },
  { name: 'Mariana Melo', initial: 'M', avatarBg: '#059669', role: 'QA' },
];

export const REPO_PULSE = {
  lastCommit: {
    hash: '8f4c29a',
    message: 'fix(git): enhance branch checkout and PR link tracking',
    author: 'Walancy',
    relativeTime: 'há 12m',
    branch: 'main',
  },
  sparkline: [3, 7, 4, 9, 6, 12, 8],
  deploy: {
    env: 'Produção',
    version: 'v2.4',
    status: 'Ativo',
    updatedAt: 'há 28m',
  },
};

const INITIAL_PROJECT_ISSUES: ProjectIssue[] = [
  // Projeto 1 (Sprint 2)
  {
    id: 'DEV-101',
    projectId: 1,
    title: 'Plan project launch',
    dateStr: 'Nov 4, 2026 at 12:19 am',
    startDay: 0,
    spanDays: 2,
    tag: 'Research',
    tagColor: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
    priority: 'Média',
    priorityColor: '#f59e0b',
    status: 'Em Progresso',
    assignees: [
      { name: 'Walancy', avatarBg: '#ea580c', initial: 'W' },
      { name: 'Gabriel Costa', avatarBg: '#0284c7', initial: 'G' },
      { name: 'Ana Souza', avatarBg: '#16a34a', initial: 'A' },
    ],
    progress: 70,
    pullRequest: {
      number: 104,
      title: 'feat(core): project launch roadmap and specs',
      branch: 'feature/dev-101-project-launch',
      status: 'open',
      reviewStatus: 'approved',
      ciStatus: 'success',
    },
  },
  {
    id: 'DEV-102',
    projectId: 1,
    title: 'Setup database migration & schemas',
    dateStr: 'Nov 5, 2026 at 09:30 am',
    startDay: 1,
    spanDays: 3,
    tag: 'Backend',
    tagColor: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc' },
    priority: 'Alta',
    priorityColor: '#ef4444',
    status: 'Em Progresso',
    assignees: [
      { name: 'Walancy', avatarBg: '#ea580c', initial: 'W' },
      { name: 'Carlos Lima', avatarBg: '#0891b2', initial: 'C' },
    ],
    progress: 60,
    pullRequest: {
      number: 108,
      title: 'feat(db): schema migrations & postgres connection pool',
      branch: 'feature/dev-102-db-migrations',
      status: 'open',
      reviewStatus: 'review_required',
      ciStatus: 'pending',
    },
  },
  {
    id: 'DEV-103',
    projectId: 1,
    title: 'Plan project launch',
    dateStr: 'Nov 4, 2026 at 12:19 am',
    startDay: 4,
    spanDays: 2,
    tag: 'Research',
    tagColor: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
    priority: 'Média',
    priorityColor: '#f59e0b',
    status: 'A Fazer',
    assignees: [
      { name: 'Lucas Silva', avatarBg: '#9333ea', initial: 'L' },
      { name: 'Walancy', avatarBg: '#ea580c', initial: 'W' },
      { name: 'Mariana Melo', avatarBg: '#059669', initial: 'M' },
    ],
    progress: 25,
  },
  {
    id: 'DEV-104',
    projectId: 1,
    title: 'Plan project launch',
    dateStr: 'Nov 4, 2026 at 12:19 am',
    startDay: 3,
    spanDays: 3,
    tag: 'Research',
    tagColor: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
    priority: 'Média',
    priorityColor: '#f59e0b',
    status: 'Concluído',
    assignees: [
      { name: 'Walancy', avatarBg: '#ea580c', initial: 'W' },
      { name: 'Rodrigo Faro', avatarBg: '#e11d48', initial: 'R' },
      { name: 'Juliana Paes', avatarBg: '#2563eb', initial: 'J' },
    ],
    progress: 100,
    pullRequest: {
      number: 98,
      title: 'chore: research and launch validation metrics',
      branch: 'feature/dev-104-validation',
      status: 'merged',
      reviewStatus: 'approved',
      ciStatus: 'success',
    },
  },
  // Projeto 2
  {
    id: 'DEV-201',
    projectId: 2,
    title: 'Arquitetura de microsserviços',
    dateStr: 'Nov 6, 2026 at 10:00 am',
    startDay: 0,
    spanDays: 3,
    tag: 'DevOps',
    tagColor: { bg: 'rgba(234, 88, 12, 0.15)', text: '#fb923c' },
    priority: 'Alta',
    priorityColor: '#ef4444',
    status: 'Em Progresso',
    assignees: [
      { name: 'Walancy', avatarBg: '#ea580c', initial: 'W' },
      { name: 'Gabriel Costa', avatarBg: '#0284c7', initial: 'G' },
    ],
    progress: 55,
  },
  {
    id: 'DEV-202',
    projectId: 2,
    title: 'Configurar gateway e rate-limiting',
    dateStr: 'Nov 7, 2026 at 02:40 pm',
    startDay: 3,
    spanDays: 2,
    tag: 'Backend',
    tagColor: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc' },
    priority: 'Média',
    priorityColor: '#f59e0b',
    status: 'A Fazer',
    assignees: [
      { name: 'Carlos Lima', avatarBg: '#0891b2', initial: 'C' },
    ],
    progress: 20,
  },
  {
    id: 'DEV-203',
    projectId: 2,
    title: 'Testes de carga e estresse com k6',
    dateStr: 'Nov 8, 2026 at 04:15 pm',
    startDay: 4,
    spanDays: 3,
    tag: 'QA',
    tagColor: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' },
    priority: 'Baixa',
    priorityColor: '#22c55e',
    status: 'Concluído',
    assignees: [
      { name: 'Walancy', avatarBg: '#ea580c', initial: 'W' },
    ],
    progress: 100,
  },
  // Projeto 3
  {
    id: 'DEV-301',
    projectId: 3,
    title: 'Refatoração da interface Web & Mobile',
    dateStr: 'Nov 9, 2026 at 11:30 am',
    startDay: 1,
    spanDays: 3,
    tag: 'Design',
    tagColor: { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6' },
    priority: 'Alta',
    priorityColor: '#ef4444',
    status: 'Em Progresso',
    assignees: [
      { name: 'Ana Souza', avatarBg: '#16a34a', initial: 'A' },
      { name: 'Walancy', avatarBg: '#ea580c', initial: 'W' },
    ],
    progress: 85,
  },
  {
    id: 'DEV-302',
    projectId: 3,
    title: 'Implementação dos tokens do Design System',
    dateStr: 'Nov 10, 2026 at 03:00 pm',
    startDay: 4,
    spanDays: 2,
    tag: 'Frontend',
    tagColor: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
    priority: 'Média',
    priorityColor: '#f59e0b',
    status: 'Concluído',
    assignees: [
      { name: 'Walancy', avatarBg: '#ea580c', initial: 'W' },
    ],
    progress: 100,
  },
  // Projeto 4
  {
    id: 'DEV-401',
    projectId: 4,
    title: 'Release candidate v2.4 e homologação',
    dateStr: 'Nov 11, 2026 at 01:20 pm',
    startDay: 2,
    spanDays: 4,
    tag: 'Release',
    tagColor: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },
    priority: 'Urgente',
    priorityColor: '#ef4444',
    status: 'Em Progresso',
    assignees: [
      { name: 'Walancy', avatarBg: '#ea580c', initial: 'W' },
      { name: 'Gabriel Costa', avatarBg: '#0284c7', initial: 'G' },
      { name: 'Carlos Lima', avatarBg: '#0891b2', initial: 'C' },
    ],
    progress: 90,
  },
];

const TIMELINE_DAYS = [
  { key: 'MON', label: 'SEG', num: '20' },
  { key: 'TUE', label: 'TER', num: '21' },
  { key: 'WED', label: 'QUA', num: '22' },
  { key: 'THU', label: 'QUI', num: '23', isCurrent: true },
  { key: 'FRI', label: 'SEX', num: '24' },
  { key: 'SAT', label: 'SÁB', num: '25' },
  { key: 'SUN', label: 'DOM', num: '26' },
];

const ALL_PROJECTS: ProjectCardData[] = [
  {
    id: 1,
    badge: 1,
    title: 'Titulo do projeto',
    sprint: 'sprint 2',
    percentage: '70%',
    percentValue: 70,
    solidFlex: '1 1 0',
    dottedWidth: 52,
    faintWidth: 36,
    issuesDone: 43,
    issuesOpen: 62,
    issuesInProgress: 23,
    alertStatus: 'critico',
  },
  {
    id: 2,
    badge: 2,
    title: 'Titulo do projeto',
    sprint: 'sprint 2',
    percentage: '70%',
    percentValue: 70,
    solidFlex: '1 1 0',
    dottedWidth: 52,
    faintWidth: 36,
    issuesDone: 43,
    issuesOpen: 62,
    issuesInProgress: 23,
    alertStatus: 'alerta',
  },
  {
    id: 3,
    badge: 3,
    title: 'Titulo do projeto',
    sprint: 'sprint 3',
    percentage: '85%',
    percentValue: 85,
    solidFlex: '1 1 0',
    dottedWidth: 52,
    faintWidth: 36,
    issuesDone: 50,
    issuesOpen: 45,
    issuesInProgress: 20,
    alertStatus: 'critico',
  },
  {
    id: 4,
    badge: 4,
    title: 'Titulo do projeto',
    sprint: 'sprint 4',
    percentage: '90%',
    percentValue: 90,
    solidFlex: '1 1 0',
    dottedWidth: 52,
    faintWidth: 36,
    issuesDone: 56,
    issuesOpen: 40,
    issuesInProgress: 25,
    alertStatus: 'alerta',
  },
];

const SPRINT_FILTER_OPTIONS = [
  'Todas as Sprints',
  'sprint 2',
  'sprint 3',
  'sprint 4',
];

const STATUS_FILTER_OPTIONS = [
  'Todos os Projetos',
  'Em Andamento (<90%)',
  'Fase Final (≥90%)',
];

const VERSION_OPTIONS = [
  'v2.4 - Produção',
  'v2.5 - Release Candidate',
  'v3.0 - Beta',
];

export interface OrganizationOption {
  id: string;
  name: string;
  slug: string;
  avatarColor: string;
  avatarUrl?: string;
}

export const ORGANIZATION_OPTIONS: OrganizationOption[] = [
  { id: 'all', name: 'Todas as Organizações', slug: 'all', avatarColor: '#6366f1' },
  { id: 'walancy', name: 'Walancy', slug: '@walancy', avatarColor: '#ea580c', avatarUrl: 'https://github.com/walancy.png' },
  { id: 'ainaobra', name: 'Ainaobra', slug: '@ainaobra', avatarColor: '#0ea5e9' },
  { id: 'aura-dev', name: 'Aura Dev', slug: '@aura-dev', avatarColor: '#10b981' },
  { id: 'devflow', name: 'DevFlow Systems', slug: '@devflow', avatarColor: '#f59e0b' },
];

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
  const [selectedCardId, setSelectedCardId] = useState<number | null>(1);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSprint, setSelectedSprint] = useState('Todas as Sprints');
  const [selectedStatus, setSelectedStatus] = useState('Todos os Projetos');
  const [selectedVersion, setSelectedVersion] = useState('v2.4 - Produção');
  const [selectedOrg, setSelectedOrg] = useState('Todas as Organizações');

  const [sprintDropdownOpen, setSprintDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [versionDropdownOpen, setVersionDropdownOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);

  // Estados para as funcionalidades de GitHub
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [isReleaseNotesModalOpen, setIsReleaseNotesModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3200);
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
  const [issues, setIssues] = useState<ProjectIssue[]>(INITIAL_PROJECT_ISSUES);
  const [viewMode, setViewMode] = useState<'timeline' | 'kanban' | 'spreadsheet'>('timeline');
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('Todas');
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);
  const [sortMode, setSortMode] = useState<'default' | 'priority' | 'date'>('default');
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);

  // Campos do formulário de nova tarefa
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskTag, setNewTaskTag] = useState('Research');
  const [newTaskPriority, setNewTaskPriority] = useState<'Baixa' | 'Média' | 'Alta' | 'Urgente'>('Média');
  const [newTaskStatus, setNewTaskStatus] = useState<'A Fazer' | 'Em Progresso' | 'Concluído'>('Em Progresso');
  const [newTaskStartDay, setNewTaskStartDay] = useState(0);
  const [newTaskSpanDays, setNewTaskSpanDays] = useState(2);

  // Filtragem dinâmica de cards do shelf superior
  const filteredCards = ALL_PROJECTS.filter((card) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = card.title.toLowerCase().includes(q);
      const matchesSprint = card.sprint.toLowerCase().includes(q);
      const matchesBadge = card.badge.toString() === q;
      if (!matchesTitle && !matchesSprint && !matchesBadge) return false;
    }

    if (selectedSprint !== 'Todas as Sprints') {
      if (card.sprint.toLowerCase() !== selectedSprint.toLowerCase()) return false;
    }

    if (selectedStatus === 'Em Andamento (<90%)') {
      if (card.percentValue >= 90) return false;
    } else if (selectedStatus === 'Fase Final (≥90%)') {
      if (card.percentValue < 90) return false;
    }

    if (selectedOrg !== 'Todas as Organizações') {
      if (card.org && card.org !== selectedOrg) return false;
    }

    return true;
  });

  // Projeto atualmente selecionado
  const selectedProject = ALL_PROJECTS.find((p) => p.id === selectedCardId) || ALL_PROJECTS[0];

  // Issues filtradas para o projeto selecionado
  const projectIssues = useMemo(() => {
    let list = issues.filter((iss) => iss.projectId === selectedCardId);
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
      list = [...list].sort((a, b) => a.startDay - b.startDay);
    }
    return list;
  }, [issues, selectedCardId, taskSearchQuery, selectedAssignee, selectedPriorityFilter, sortMode]);

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) return;
    const tagColors: Record<string, { bg: string; text: string }> = {
      Research: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
      Backend: { bg: 'rgba(168, 85, 247, 0.15)', text: '#c084fc' },
      Frontend: { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
      Design: { bg: 'rgba(236, 72, 153, 0.15)', text: '#f472b6' },
      DevOps: { bg: 'rgba(234, 88, 12, 0.15)', text: '#fb923c' },
      QA: { bg: 'rgba(16, 185, 129, 0.15)', text: '#34d399' },
      Release: { bg: 'rgba(245, 158, 11, 0.15)', text: '#fbbf24' },
    };
    const priorityColors: Record<string, string> = {
      Baixa: '#22c55e',
      Média: '#f59e0b',
      Alta: '#ef4444',
      Urgente: '#dc2626',
    };

    const newIssue: ProjectIssue = {
      id: `DEV-${Math.floor(100 + Math.random() * 900)}`,
      projectId: selectedCardId || 1,
      title: newTaskTitle.trim(),
      dateStr: 'Nov 2026',
      startDay: newTaskStartDay,
      spanDays: newTaskSpanDays,
      tag: newTaskTag,
      tagColor: tagColors[newTaskTag] || { bg: 'rgba(59, 130, 246, 0.15)', text: '#60a5fa' },
      priority: newTaskPriority,
      priorityColor: priorityColors[newTaskPriority] || '#f59e0b',
      status: newTaskStatus,
      assignees: [{ name: 'Walancy', avatarBg: '#ea580c', initial: 'W' }],
      progress: newTaskStatus === 'Concluído' ? 100 : newTaskStatus === 'Em Progresso' ? 50 : 0,
    };

    setIssues((prev) => [...prev, newIssue]);
    setNewTaskTitle('');
    setIsAddTaskModalOpen(false);
  };

  const handleToggleIssueStatus = (issueId: string) => {
    setIssues((prev) =>
      prev.map((iss) => {
        if (iss.id === issueId) {
          const nextStatus: 'A Fazer' | 'Em Progresso' | 'Concluído' =
            iss.status === 'A Fazer'
              ? 'Em Progresso'
              : iss.status === 'Em Progresso'
              ? 'Concluído'
              : 'A Fazer';
          return {
            ...iss,
            status: nextStatus,
            progress: nextStatus === 'Concluído' ? 100 : nextStatus === 'Em Progresso' ? 50 : 0,
          };
        }
        return iss;
      })
    );
  };

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
                    {SPRINT_FILTER_OPTIONS.map((opt) => (
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
                    {selectedOrg !== 'Todas as Organizações' ? (
                      <div
                        style={{
                          width: 16,
                          height: 16,
                          borderRadius: '50%',
                          background: ORGANIZATION_OPTIONS.find((o) => o.name === selectedOrg)?.avatarColor || accentColor,
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
                        {ORGANIZATION_OPTIONS.find((o) => o.name === selectedOrg)?.avatarUrl ? (
                          <img
                            src={ORGANIZATION_OPTIONS.find((o) => o.name === selectedOrg)?.avatarUrl}
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
                      {ORGANIZATION_OPTIONS.map((org) => {
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
                    <div
                      style={{
                        flex: '1 1 0',
                        height: 4,
                        background: progressSolidBg,
                        borderRadius: 2,
                        border: 'none',
                      }}
                    />
                    <div
                      style={{
                        width: 'clamp(20px, 18%, 64px)',
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
                        flexShrink: 1,
                      }}
                    />
                    <div
                      style={{
                        width: 'clamp(14px, 12%, 44px)',
                        height: 4,
                        background: progressFaintBg,
                        borderRadius: 2,
                        border: 'none',
                        flexShrink: 1,
                      }}
                    />
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
              Nenhum projeto encontrado para os filtros selecionados.
            </div>
          )}
        </div>

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
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 5, flex: 1, minHeight: 0 }}>
              {/* Cabeçalho dos Dias (MON 20 a SUN 26) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  background: theme.viewCanvasBg,
                  borderRadius: 8,
                  border: 'none',
                  flexShrink: 0,
                }}
              >
                {TIMELINE_DAYS.map((d) => (
                  <div
                    key={d.key}
                    style={{
                      padding: '10px 14px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 7,
                      fontSize: 12,
                      fontWeight: '300',
                      color: d.isCurrent ? (isEffectiveDark ? '#ffffff' : accentColor) : theme.textSecondary,
                      border: 'none',
                      boxSizing: 'border-box',
                    }}
                  >
                    <span style={{ letterSpacing: '0.04em' }}>{d.key}</span>
                    <span style={{ fontWeight: '400', color: d.isCurrent ? (isEffectiveDark ? '#ffffff' : accentColor) : (isEffectiveDark ? '#aaaaaa' : '#475569') }}>
                      {d.num}
                    </span>
                  </div>
                ))}
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
                    gridTemplateColumns: 'repeat(7, 1fr)',
                    pointerEvents: 'none',
                  }}
                >
                  {TIMELINE_DAYS.map((d, colIdx) => (
                    <div
                      key={colIdx}
                      style={{
                        height: '100%',
                        borderRight: `1px solid ${theme.tableBorder}`,
                        background: d.isCurrent
                          ? `repeating-linear-gradient(0deg, ${hexToRgba(accentColor, isEffectiveDark ? 0.03 : 0.04)}, ${hexToRgba(accentColor, isEffectiveDark ? 0.03 : 0.04)} 2px, transparent 2px, transparent 5px)`
                          : 'transparent',
                        position: 'relative',
                      }}
                    >
                      {/* Linha vertical no dia ativo */}
                      {d.isCurrent && (
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
                  ))}
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
                      // Calcula a posição e largura com base no startDay (0 a 6) e spanDays (1 a 3)
                      const leftPercent = (issue.startDay / 7) * 100;
                      const widthPercent = Math.min((issue.spanDays / 7) * 100, 100 - leftPercent);

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
                                  background: issue.status === 'Concluído' ? '#10b981' : (isEffectiveDark ? '#444444' : '#cbd5e1'),
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
                                  {issue.dateStr}
                                </span>
                              </div>
                            </div>
                            <MoreVertical size={14} color={theme.textSecondary} style={{ flexShrink: 0, marginTop: 2 }} />
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
                                  }}
                                >
                                  {a.initial}
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
                      Nenhuma tarefa encontrada para este projeto ou filtro.
                    </div>
                  )}
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
                                  }}
                                >
                                  {a.initial}
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
                      <td style={{ padding: '10px 14px', fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>{iss.dateStr}</td>
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
                                justifyCenter: 'center',
                                marginLeft: i > 0 ? -5 : 0,
                                border: `1.5px solid ${theme.viewCanvasBg}`,
                              }}
                            >
                              {a.initial}
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
                        Nenhuma tarefa encontrada.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modal de Nova Tarefa */}
        {isAddTaskModalOpen && (
          <div
            onClick={() => setIsAddTaskModalOpen(false)}
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
                maxWidth: 460,
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
              {/* Título do Modal */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Plus size={16} color={accentColor} />
                  <span style={{ fontSize: 14, fontWeight: '400', color: theme.textPrimary }}>
                    Adicionar Tarefa ao {selectedProject.title}
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
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
                >
                  <X size={16} />
                </div>
              </div>

              {/* Título da Tarefa */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Título da Tarefa</label>
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

              {/* Linha com Estado Inicial e Dia na Timeline */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <label style={{ fontSize: 12, color: theme.textSecondary, fontWeight: '300' }}>Dia de Início (Linha do Tempo)</label>
                  <select
                    value={newTaskStartDay}
                    onChange={(e) => setNewTaskStartDay(Number(e.target.value))}
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
                    {TIMELINE_DAYS.map((d, i) => (
                      <option key={d.key} value={i}>
                        {d.label} {d.num}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Botões de Ação */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setIsAddTaskModalOpen(false)}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 16px',
                    color: theme.textSecondary,
                    fontSize: 12.5,
                    fontWeight: '300',
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={handleCreateTask}
                  style={{
                    background: accentColor,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 18px',
                    color: accentContrastText,
                    fontSize: 12.5,
                    fontWeight: '400',
                    cursor: 'pointer',
                    transition: 'opacity 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.88')}
                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                >
                  Criar Tarefa
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
