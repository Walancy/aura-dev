import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  ChevronDown,
  Check,
  Table as TableIcon,
  GanttChart,
  Kanban as KanbanIcon,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Plus,
  MoreVertical,
  X,
  CheckCircle2,
  Clock,
  Activity,
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
  UserPlus,
  CheckSquare,
  Square,
  Minus,
  Archive,
  Repeat,
  MoreHorizontal,
  Star,
  Lock,
  Globe,
  GitFork,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  Calendar,
  CalendarDays,
  List,
  LayoutGrid,
  FolderGit2,
  FolderKanban,
  PanelLeftClose,
  PanelLeftOpen,
  ArrowLeft,
  ArrowRight,
  Maximize2,
  Minimize2,
  Heading,
  Bold,
  Italic,
  Quote,
  Code,
  ListOrdered,
  Paperclip,
  Sparkles,
  BookOpen,
  SquareTerminal,
  Pin,
  FolderDown,
  RefreshCw,
  FileText,
  Image as ImageIcon,
} from 'lucide-react';
import { getContrastTextColor, hexToRgba } from '../utils/color';
import { DatePickerField } from './ui/DatePickerField';
import { renderAiIcon } from './icons/AiProviderIcons';
import { AI_PROVIDERS } from '../constants/ai';
import { ConfirmDeleteModal } from './modals/ConfirmDeleteModal';
import { IssueDetailSidesheet } from './modals/IssueDetailSidesheet';
import { AssignMemberModal } from './modals/AssignMemberModal';
import { TeamWorkspaceView } from './team/TeamWorkspaceView';
import { getProjectSettings, resolveProjectStatus, formatSprintName, subscribeProjectSettings } from './settings/projectSettingsStore';
import { GithubProjectsKanbanBoard, type KanbanColumnDef } from './kanban/GithubProjectsKanbanBoard';
import { GithubProjectsRoadmapView } from './roadmap/GithubProjectsRoadmapView';
import { ProjectRisksDashboard } from './risks/ProjectRisksDashboard';
import { ProjectMilestonesView } from './milestones/ProjectMilestonesView';
import { ProjectReportsView } from './reports/ProjectReportsView';
import { ProjectLinksView } from './links/ProjectLinksView';
import { ProjectSettingsView } from './settings/ProjectSettingsView';
import { getLanguageSvgUrl } from './FileIcon';
import { ProjectIconModal } from './modals/ProjectIconModal';
import { logSystemActivity } from '../utils/brainService';
import { computeProjectHealthScore } from '../utils/gitProjects';
export { computeProjectHealthScore };

export interface ProjectsSchedulerViewProps {
  workspacePath?: string;
  repoName?: string;
  onSelectWorkspace?: (dirPath: string, repoName?: string) => Promise<void> | void;
  accentColor?: string;
  isEffectiveDark?: boolean;
  themeTokens?: {
    bgApp?: string;
    bgCard?: string;
    bgCardSecondary?: string;
    bgFloating?: string;
    borderSubtle?: string;
    borderMedium?: string;
    textPrimary?: string;
    textSecondary?: string;
    textMuted?: string;
    accentBg?: string;
    accentBorder?: string;
    accentContrastText?: string;
    actionHoverBg?: string;
    badgeBackground?: string;
    badgeBorder?: string;
    badgeText?: string;
    dropdownBg?: string;
    dropdownItemHover?: string;
    dropdownBorder?: string;
    cardBg?: string;
    cardHoverBg?: string;
    activeCardBorder?: string;
    progressBarBackground?: string;
    calendarCellBorder?: string;
    calendarHeaderBackground?: string;
    calendarWeekendBackground?: string;
    calendarTodayBorder?: string;
    calendarSelectionBorder?: string;
  };
  selectedAiProvider?: string;
  selectedModel?: string;
  onSelectAiProvider?: (providerId: string) => void;
  onSelectModel?: (modelItem: { id: string; label: string }, providerId?: string) => void;
  installedClis?: Record<string, boolean>;
  activeModels?: Record<string, { currentModel?: string; currentModelId?: string; models: Array<{ id: string; label: string; tag?: string; description?: string }> }>;
  onInstallAiCli?: (provider: any) => void;
}

export interface ProjectCardData {
  id: number | string;
  badge: number;
  title: string;
  name?: string;
  description?: string | null;
  language?: string | null;
  isPrivate?: boolean;
  updatedAtIso?: string | null;
  progressPercent?: number;
  sprint: string;
  percentage: string;
  percentValue: number;
  solidFlex: string;
  dottedWidth: number;
  faintWidth: number;
  issuesDone: number;
  issuesOpen: number;
  issuesInProgress: number;
  healthScore?: number;
  alertStatus?: 'alerta' | 'critico' | null;
  org?: string;
  // Real GitHub repo backing this card
  fullName?: string;
  owner?: string;
  repoName?: string;
  htmlUrl?: string;
  isCloned?: boolean;
  localDir?: string;
  ownerAvatarUrl?: string;
  defaultBranch?: string;
  currentSprint?: {
    number: number;
    title: string;
    dueDateIso?: string;
    daysBadge?: {
      text: string;
      color: string;
      bg: string;
      diffDays?: number;
    } | null;
  } | null;
}

export function calculateSprintDaysBadge(
  dueDateIso?: string,
  isEffectiveDark = true
): { text: string; color: string; bg: string; diffDays?: number } | null {
  if (!dueDateIso) {
    return {
      text: 'Em andamento',
      color: '#38bdf8',
      bg: isEffectiveDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.10)',
    };
  }
  try {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const parts = dueDateIso.slice(0, 10).split('-');
    if (parts.length < 3) return null;
    const due = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        text: 'Encerrada',
        color: '#ef4444',
        bg: isEffectiveDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.12)',
        diffDays,
      };
    }
    if (diffDays === 0) {
      return {
        text: 'Termina hoje',
        color: '#ef4444',
        bg: isEffectiveDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.12)',
        diffDays: 0,
      };
    }
    if (diffDays <= 3) {
      return {
        text: `Falta${diffDays === 1 ? '' : 'm'} ${diffDays}d`,
        color: '#ef4444',
        bg: isEffectiveDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.12)',
        diffDays,
      };
    }
    if (diffDays <= 5) {
      return {
        text: `Falta${diffDays === 1 ? '' : 'm'} ${diffDays}d`,
        color: '#eab308',
        bg: isEffectiveDark ? 'rgba(234, 179, 8, 0.18)' : 'rgba(234, 179, 8, 0.12)',
        diffDays,
      };
    }
    return {
      text: `Falta${diffDays === 1 ? '' : 'm'} ${diffDays}d`,
      color: '#38bdf8',
      bg: isEffectiveDark ? 'rgba(56, 189, 248, 0.15)' : 'rgba(56, 189, 248, 0.10)',
      diffDays,
    };
  } catch {
    return null;
  }
}

interface ProjectIconBadgeProps {
  card: ProjectCardData;
  customIcon?: string;
  badgeBg: string;
  badgeColor: string;
  size?: number;
}

const ProjectIconBadge: React.FC<ProjectIconBadgeProps> = ({
  card,
  customIcon,
  badgeBg,
  badgeColor,
  size = 24,
}) => {
  const [imgError, setImgError] = useState(false);
  const langSvg = useMemo(() => getLanguageSvgUrl(card.language), [card.language]);

  // 1. Ícone personalizado salvo pelo usuário (sem clonar repo)
  if (customIcon && !imgError) {
    return (
      <img
        src={customIcon}
        alt={card.title}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          background: 'transparent',
        }}
        draggable={false}
      />
    );
  }

  // 2. Avatar da organização ou proprietário do repositório (ex: logo da Estância Bahia)
  if (card.ownerAvatarUrl && !imgError) {
    return (
      <img
        src={card.ownerAvatarUrl}
        alt={card.owner || card.title}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          background: 'transparent',
        }}
        draggable={false}
      />
    );
  }

  // 3. Ícone oficial da tecnologia/linguagem (ex: TypeScript, Dart, HTML, etc.)
  if (langSvg) {
    return (
      <img
        src={langSvg}
        alt={card.language || ''}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          userSelect: 'none',
          background: 'transparent',
        }}
        draggable={false}
      />
    );
  }

  // 4. Fallback numérico padrão sem fundo
  return (
    <span
      style={{
        textAlign: 'center',
        color: badgeColor,
        fontSize: size <= 20 ? 9.5 : 11.5,
        fontWeight: '400',
        lineHeight: 1,
        transition: 'color 0.18s ease',
        background: 'transparent',
      }}
    >
      {card.badge}
    </span>
  );
};

export interface ProjectIssue {
  id: string;
  projectId: number | string;
  title: string;
  description: string;
  dateStr: string;
  createdAtIso: string; // data real de criação, usada como posição de fallback na timeline
  closedAtIso?: string; // data de fechamento no GitHub (usada nas métricas do time)
  durationDays: number; // dias em aberto (mínimo 1), largura de fallback na timeline
  startDateIso?: string; // YYYY-MM-DD, derivada da sprint (milestone) atribuída à issue
  dueDateIso?: string; // YYYY-MM-DD, derivada da sprint (milestone) atribuída à issue
  milestoneNumber?: number;
  milestoneTitle?: string;
  iterationId?: string; // ID da iteração (Sprint no GitHub Projects V2)
  iterationTitle?: string; // Título da iteração vinculada
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
  parentIssueNumber?: number; // Número da issue pai se esta for uma sub-issue
  subIssuesSummary?: {
    total: number;
    completed: number;
    percent_completed: number;
  };
  subIssueNumbers?: number[]; // Lista de números de sub-issues pertencentes a esta issue
  projectV2ItemId?: string;
  projectV2Status?: string;
  projectV2StatusOptionId?: string;
  projectV2Estimate?: number;
  kanbanColumnId?: string;
}

export interface GithubRepoSummary {
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
  iterationId?: string;
  isProjectIteration?: boolean;
  projectId?: string; // node id do Project V2 dono da iteração
  iterationFieldId?: string; // node id do campo de iteração ("Sprint") no Project V2
  // true apenas para sprints "descobertas" por texto (label/nome de milestone em outro formato),
  // sem number de milestone real nem iterationId — únicas para as quais é seguro comparar por título.
  isVirtual?: boolean;
  title: string;
  state: 'open' | 'closed';
  startDateIso?: string;
  dueDateIso?: string;
  durationLabel?: string;
  openIssues: number;
  closedIssues: number;
}

// Decide se uma issue pertence a uma sprint (Milestone real ou Iteration do Projects V2).
// Compara sempre por identidade (iterationId ou milestoneNumber), nunca por texto de título entre
// os dois sistemas — Milestones e Iterations são independentes no GitHub e podem ter nomes iguais
// ("Sprint 2") sem serem a mesma coisa; comparar por título fazia uma issue aparecer em ambas.
export function issueBelongsToSprint(
  issue: Pick<ProjectIssue, 'milestoneNumber' | 'iterationId' | 'iterationTitle' | 'milestoneTitle'> & { title?: string },
  sprint: Pick<SprintOption, 'number' | 'iterationId' | 'isProjectIteration' | 'isVirtual' | 'title'>
): boolean {
  // 1. Se ambos tiverem iterationId, bate direto por id
  if (sprint.iterationId && issue.iterationId && String(sprint.iterationId) === String(issue.iterationId)) {
    return true;
  }
  // 2. Se ambos tiverem milestone number válido
  if (sprint.number && sprint.number > 0 && issue.milestoneNumber != null && Number(issue.milestoneNumber) === Number(sprint.number)) {
    return true;
  }
  // 3. Comparação de títulos (normalizado com remoção de acentos e espaços extras)
  const cleanTitle = (s?: string) =>
    (s || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const spTitle = cleanTitle(sprint.title);
  const itTitle = cleanTitle(issue.iterationTitle);
  const msTitle = cleanTitle(issue.milestoneTitle);

  if (spTitle) {
    if (itTitle) {
      if (itTitle === spTitle || (itTitle.length >= 4 && (itTitle.includes(spTitle) || spTitle.includes(itTitle)))) {
        return true;
      }
    }

    if (msTitle) {
      if (msTitle === spTitle || (msTitle.length >= 4 && (msTitle.includes(spTitle) || spTitle.includes(msTitle)))) {
        return true;
      }
    }

    const getSprintNum = (s: string) => {
      const m = s.match(/sprint\s*([0-9]+(?:-[0-9]+)?)/i);
      return m ? m[1] : null;
    };
    const spNum = getSprintNum(spTitle);

    if (spNum) {
      if (itTitle && getSprintNum(itTitle) === spNum) return true;
      if (msTitle && getSprintNum(msTitle) === spNum) return true;
      if (issue.title && getSprintNum(cleanTitle(issue.title)) === spNum) return true;
      if (/^\d+$/.test(spNum) && issue.milestoneNumber != null && Number(issue.milestoneNumber) === parseInt(spNum, 10)) {
        return true;
      }
    }

    if (Array.isArray((issue as any).rawLabels) && spTitle) {
      const hasSprintLabel = (issue as any).rawLabels.some((l: string) => {
        const norm = cleanTitle(l).replace(/^(sprint|milestone|marco)[:\s-]*/i, '').trim();
        return norm && (norm === spTitle || (norm.length >= 4 && (norm.includes(spTitle) || spTitle.includes(norm))));
      });
      if (hasSprintLabel) return true;
    }
  }

  // 4. Fallback para iterationId exclusivo se nada mais bateu
  if (sprint.isProjectIteration || sprint.iterationId) {
    return Boolean(sprint.iterationId && issue.iterationId && String(sprint.iterationId) === String(issue.iterationId));
  }

  return false;
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

export function extractOwnerRepo(urlOrFullName?: string): { owner: string; repo: string } | null {
  if (!urlOrFullName) return null;
  const match = urlOrFullName.match(/[:/]([^/:]+)\/([^/:]+?)(?:\.git)?$/);
  if (match) {
    return { owner: match[1], repo: match[2] };
  }
  if (urlOrFullName.includes('/')) {
    const parts = urlOrFullName.split('/');
    if (parts.length >= 2 && parts[0] && parts[1]) {
      return { owner: parts[0], repo: parts[1] };
    }
  }
  return null;
}

export function buildUnifiedProjectCards(params: {
  repos?: GithubRepoSummary[];
  localClonedRepos?: Array<{ dir: string; name: string; repoFullName?: string; remoteUrl?: string }>;
  workspacePath?: string;
  repoDetailsCache?: Record<string, any>;
  orgs?: Array<{ login: string; avatarUrl: string }>;
  currentUser?: { login: string; avatarUrl: string } | null;
  customProjectIcons?: Record<string, string>;
  isEffectiveDark?: boolean;
}): ProjectCardData[] {
  const {
    repos = [],
    localClonedRepos = [],
    workspacePath,
    repoDetailsCache = {},
    orgs = [],
    currentUser,
    customProjectIcons = {},
    isEffectiveDark = true,
  } = params;

  const list: ProjectCardData[] = [];
  const seenNames = new Set<string>();

  const resolveCurrentSprint = (cachedObj: any) => {
    if (!cachedObj?.sprints || cachedObj.sprints.length === 0) return null;
    const openSprints = cachedObj.sprints.filter((s: any) => s.state === 'open');
    if (openSprints.length === 0) return null;

    const todayIso = new Date().toISOString().slice(0, 10);
    const running = openSprints.find(
      (s: any) => s.startDateIso && s.dueDateIso && todayIso >= s.startDateIso && todayIso <= s.dueDateIso
    );
    const withDue = openSprints
      .filter((s: any) => s.dueDateIso)
      .sort((a: any, b: any) => (a.dueDateIso > b.dueDateIso ? 1 : -1));
    const active = running || (withDue.length > 0 ? withDue[0] : openSprints[0]);
    if (!active) return null;

    const daysBadge = calculateSprintDaysBadge(active.dueDateIso, isEffectiveDark);
    return {
      number: active.number,
      title: active.title,
      dueDateIso: active.dueDateIso,
      daysBadge,
    };
  };

  // 1. Repositórios do GitHub autenticado
  repos.forEach((repo, idx) => {
    seenNames.add(repo.name.toLowerCase());
    if (repo.full_name) seenNames.add(repo.full_name.toLowerCase());

    // Priorização estrita para localMatch evitando cruzamento indevido entre projetos
    let localMatch = localClonedRepos.find((l) => {
      const matchFull = Boolean(l.repoFullName && repo.full_name && l.repoFullName.toLowerCase() === repo.full_name.toLowerCase());
      const matchName = l.name.toLowerCase() === repo.name.toLowerCase();
      return matchFull && matchName;
    });
    if (!localMatch) {
      // Só casa por nome quando o remoto do clone é desconhecido ou é este mesmo repositório:
      // repos homônimos de donos diferentes (appmoove/ainaobra x SelberSRFQ/ainaobra) não podem dividir a mesma pasta
      localMatch = localClonedRepos.find(
        (l) =>
          l.name.toLowerCase() === repo.name.toLowerCase() &&
          (!l.repoFullName || !repo.full_name || l.repoFullName.toLowerCase() === repo.full_name.toLowerCase())
      );
    }
    if (!localMatch) {
      localMatch = localClonedRepos.find((l) => {
        if (!l.repoFullName || !repo.full_name) return false;
        if (l.repoFullName.toLowerCase() !== repo.full_name.toLowerCase()) return false;
        const isOtherRepo = repos.some((other) => other.id !== repo.id && other.name.toLowerCase() === l.name.toLowerCase());
        return !isOtherRepo;
      });
    }

    // Se a pasta aberta é um clone com remoto conhecido, só o repositório desse remoto é o "atual"
    const workspaceClone = workspacePath
      ? localClonedRepos.find((l) => l.dir.toLowerCase() === workspacePath.toLowerCase())
      : undefined;
    const isCurrentWorkspace = workspaceClone?.repoFullName && repo.full_name
      ? workspaceClone.repoFullName.toLowerCase() === repo.full_name.toLowerCase()
      : Boolean(workspacePath && (
        workspacePath.toLowerCase().endsWith(`/${repo.name.toLowerCase()}`) ||
        workspacePath.toLowerCase().endsWith(`/${repo.name.toLowerCase()}/`)
      )) ||
      Boolean(localMatch && workspacePath && localMatch.dir.toLowerCase() === workspacePath.toLowerCase() && repo.name.toLowerCase() === localMatch.name.toLowerCase());

    const localDir = getProjectSettings(repo.full_name).local.path || (isCurrentWorkspace ? workspacePath : localMatch?.dir);
    const cached =
      repoDetailsCache[repo.full_name] ||
      (repo.owner?.login && repoDetailsCache[`${repo.owner.login}/${repo.name}`]) ||
      repoDetailsCache[repo.name] ||
      Object.entries(repoDetailsCache).find(
        ([k]) => k.toLowerCase() === repo.full_name?.toLowerCase() || k.toLowerCase().endsWith(`/${repo.name.toLowerCase()}`)
      )?.[1];
    const doneCount = cached ? cached.issues.filter((i: any) => i.status === 'Concluído').length : 0;
    const inProgressCount = cached ? cached.issues.filter((i: any) => i.status === 'Em Progresso').length : 0;
    const openCount = cached ? cached.issues.filter((i: any) => i.status === 'A Fazer').length : repo.open_issues_count;
    const total = (cached && cached.issues?.length > 0) ? cached.issues.length : (doneCount + inProgressCount + openCount);
    const percentValue = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    const currentSprint = resolveCurrentSprint(cached);
    const healthScore = computeProjectHealthScore(
      cached?.issues || [],
      doneCount,
      inProgressCount,
      total,
      percentValue
    );

    list.push({
      id: repo.id,
      badge: idx + 1,
      title: repo.name,
      name: repo.name,
      description: repo.description,
      language: repo.language,
      isPrivate: repo.private,
      updatedAtIso: repo.updated_at,
      progressPercent: percentValue,
      sprint: currentSprint?.title || '',
      percentage: `${percentValue}%`,
      percentValue,
      solidFlex: '1 1 0',
      dottedWidth: 52,
      faintWidth: 36,
      issuesDone: doneCount,
      issuesOpen: openCount,
      issuesInProgress: inProgressCount,
      healthScore,
      alertStatus: null,
      org: repo.owner?.login,
      fullName: repo.full_name,
      owner: repo.owner?.login,
      repoName: repo.name,
      htmlUrl: repo.html_url,
      isCloned: Boolean(localMatch || isCurrentWorkspace),
      localDir,
      ownerAvatarUrl: repo.owner?.avatar_url,
      defaultBranch: repo.default_branch || 'main',
      currentSprint,
    });
  });

  // 2. Repositórios locais clonados que não foram listados via GitHub
  localClonedRepos.forEach((locRepo) => {
    if (seenNames.has(locRepo.name.toLowerCase())) return;
    if (locRepo.repoFullName && seenNames.has(locRepo.repoFullName.toLowerCase())) return;
    seenNames.add(locRepo.name.toLowerCase());
    if (locRepo.repoFullName) seenNames.add(locRepo.repoFullName.toLowerCase());

    let owner = locRepo.repoFullName?.split('/')[0] || '';
    let repoName = locRepo.repoFullName?.split('/')[1] || locRepo.name;
    if (!owner && locRepo.remoteUrl) {
      const parsed = extractOwnerRepo(locRepo.remoteUrl);
      if (parsed) {
        owner = parsed.owner;
        repoName = parsed.repo;
      }
    }
    if (!owner && currentUser?.login) {
      owner = currentUser.login;
    }
    const fullName = (owner && repoName) ? `${owner}/${repoName}` : (locRepo.repoFullName || locRepo.name);
    const isCurrentWorkspace = Boolean(
      workspacePath &&
        (workspacePath.toLowerCase() === locRepo.dir.toLowerCase() ||
         workspacePath.toLowerCase().endsWith(`/${locRepo.name.toLowerCase()}`))
    );
    const cached =
      repoDetailsCache[fullName] ||
      (owner && repoName ? repoDetailsCache[`${owner}/${repoName}`] : undefined) ||
      repoDetailsCache[repoName] ||
      repoDetailsCache[locRepo.name] ||
      Object.entries(repoDetailsCache).find(
        ([k]) => k.toLowerCase() === fullName.toLowerCase() || k.toLowerCase().endsWith(`/${repoName.toLowerCase()}`)
      )?.[1];
    const doneCount = cached ? cached.issues.filter((i: any) => i.status === 'Concluído').length : 0;
    const inProgressCount = cached ? cached.issues.filter((i: any) => i.status === 'Em Progresso').length : 0;
    const openCount = cached ? cached.issues.filter((i: any) => i.status === 'A Fazer').length : 0;
    const total = (cached && cached.issues?.length > 0) ? cached.issues.length : (doneCount + inProgressCount + openCount);
    const percentValue = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    const currentSprint = resolveCurrentSprint(cached);
    const healthScore = computeProjectHealthScore(
      cached?.issues || [],
      doneCount,
      inProgressCount,
      total,
      percentValue
    );

    const locOwnerAvatar =
      (owner && orgs.find((o) => o.login.toLowerCase() === owner.toLowerCase())?.avatarUrl) ||
      (currentUser && owner?.toLowerCase() === currentUser.login.toLowerCase() ? currentUser.avatarUrl : undefined);

    list.push({
      id: `local-${locRepo.name}`,
      badge: list.length + 1,
      title: locRepo.name,
      name: locRepo.name,
      description: `Projeto local em ${locRepo.dir}`,
      language: undefined,
      isPrivate: false,
      updatedAtIso: undefined,
      progressPercent: percentValue,
      sprint: currentSprint?.title || 'Local',
      percentage: `${percentValue}%`,
      percentValue,
      solidFlex: '1 1 0',
      dottedWidth: 52,
      faintWidth: 36,
      issuesDone: doneCount,
      issuesOpen: openCount,
      issuesInProgress: inProgressCount,
      healthScore,
      alertStatus: null,
      org: owner || undefined,
      fullName,
      owner,
      repoName,
      htmlUrl: locRepo.remoteUrl,
      isCloned: true,
      localDir: locRepo.dir,
      ownerAvatarUrl: locOwnerAvatar,
      defaultBranch: 'main',
      currentSprint,
    });
  });

  // 3. Workspace ativa se não estiver presente na lista
  if (workspacePath && !list.some((p) => p.localDir && p.localDir.toLowerCase() === workspacePath.toLowerCase())) {
    const folderName = workspacePath.split('/').filter(Boolean).pop() || 'Workspace';
    const localMatch = localClonedRepos.find((l) => l.dir.toLowerCase() === workspacePath.toLowerCase());
    let owner = localMatch?.repoFullName?.split('/')[0] || '';
    let repoName = localMatch?.repoFullName?.split('/')[1] || folderName;
    if (!owner && localMatch?.remoteUrl) {
      const parsed = extractOwnerRepo(localMatch.remoteUrl);
      if (parsed) {
        owner = parsed.owner;
        repoName = parsed.repo;
      }
    }
    if (!owner && folderName.toLowerCase() === 'devflow-desktop') {
      owner = 'Walancy';
      repoName = 'aura-dev';
    }
    if (!owner && currentUser?.login) {
      owner = currentUser.login;
    }
    const fullName = (owner && repoName) ? `${owner}/${repoName}` : folderName;
    const displayName = folderName.toLowerCase() === 'devflow-desktop' ? 'Aura Dev' : repoName;
    const cached =
      repoDetailsCache[fullName] ||
      (owner && repoName ? repoDetailsCache[`${owner}/${repoName}`] : undefined) ||
      repoDetailsCache[repoName] ||
      repoDetailsCache[displayName] ||
      Object.entries(repoDetailsCache).find(
        ([k]) => k.toLowerCase() === fullName.toLowerCase() || k.toLowerCase().endsWith(`/${repoName.toLowerCase()}`)
      )?.[1];
    const doneCount = cached ? cached.issues.filter((i: any) => i.status === 'Concluído').length : 0;
    const inProgressCount = cached ? cached.issues.filter((i: any) => i.status === 'Em Progresso').length : 0;
    const openCount = cached ? cached.issues.filter((i: any) => i.status === 'A Fazer').length : 0;
    const total = (cached && cached.issues?.length > 0) ? cached.issues.length : (doneCount + inProgressCount + openCount);
    const percentValue = total > 0 ? Math.round((doneCount / total) * 100) : 0;
    const currentSprint = resolveCurrentSprint(cached);
    const healthScore = computeProjectHealthScore(
      cached?.issues || [],
      doneCount,
      inProgressCount,
      total,
      percentValue
    );

    const wsOwnerAvatar =
      (owner && orgs.find((o) => o.login.toLowerCase() === owner.toLowerCase())?.avatarUrl) ||
      (currentUser && owner?.toLowerCase() === currentUser.login.toLowerCase() ? currentUser.avatarUrl : undefined);

    list.unshift({
      id: 'active-workspace',
      badge: 1,
      title: displayName,
      name: displayName,
      description: `Workspace ativa em ${workspacePath}`,
      language: undefined,
      isPrivate: false,
      updatedAtIso: undefined,
      progressPercent: percentValue,
      sprint: currentSprint?.title || 'Local',
      percentage: `${percentValue}%`,
      percentValue,
      solidFlex: '1 1 0',
      dottedWidth: 52,
      faintWidth: 36,
      issuesDone: doneCount,
      issuesOpen: openCount,
      issuesInProgress: inProgressCount,
      healthScore,
      alertStatus: null,
      org: owner || undefined,
      fullName,
      owner,
      repoName,
      htmlUrl: localMatch?.remoteUrl,
      isCloned: true,
      localDir: workspacePath,
      ownerAvatarUrl: wsOwnerAvatar,
      defaultBranch: 'main',
      currentSprint,
    });
  }

  return list;
}

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

const isProgressLabel = (name: string): boolean => {
  if (!name) return false;
  const l = name.toLowerCase().trim();
  return (
    l === 'in progress' ||
    l === 'in-progress' ||
    l === 'in_progress' ||
    l === 'inprogress' ||
    l === 'em progresso' ||
    l === 'em-progresso' ||
    l === 'em_progresso' ||
    l === 'em andamento' ||
    l === 'em-andamento' ||
    l === 'em_andamento' ||
    l === 'doing' ||
    l === 'wip' ||
    l === 'development' ||
    l === 'dev' ||
    l === 'em desenvolvimento' ||
    l === 'test' ||
    l === 'testing' ||
    l === 'em teste' ||
    l === 'under review' ||
    l === 'in review' ||
    l.includes('in progress') ||
    l.includes('in-progress') ||
    l.includes('em progresso') ||
    l.includes('em-progresso') ||
    l.includes('em andamento') ||
    l.includes('em-andamento') ||
    l.includes('doing') ||
    l.startsWith('status: in') ||
    l.startsWith('status: in-progress') ||
    l.startsWith('status: em') ||
    l.startsWith('status/in') ||
    l.startsWith('status/em')
  );
};

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
      return `em ${new Date(iso).toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })}`;
    }
    if (diffDay >= 7) {
      const weeks = Math.max(1, Math.floor(diffDay / 7));
      return `há ${weeks}sem`;
    }
    if (diffDay > 0) return `há ${diffDay}d`;
    if (diffHr > 0) return `há ${diffHr}h`;
    if (diffMin > 0) return `há ${diffMin}min`;
    return 'agora mesmo';
  } catch {
    return 'recentemente';
  }
}

const SAMPLE_GITHUB_ISSUES: ProjectIssue[] = [
  {
    id: '#101',
    projectId: 1,
    githubNumber: 101,
    title: 'Setup do monorepo Turborepo, Vite e TypeScript',
    description: 'Configuração do ambiente de desenvolvimento, linting e scripts de build compartilhados.',
    dateStr: '02 Set 2026',
    createdAtIso: '2026-09-02T09:00:00Z',
    durationDays: 14,
    startDateIso: '2026-09-02',
    dueDateIso: '2026-09-04',
    milestoneNumber: 1,
    milestoneTitle: 'Sprint1 - Setup Inicial e Arquitetura',
    tag: 'infra',
    tagColor: { bg: 'rgba(168, 85, 247, 0.15)', text: '#a855f7' },
    priority: 'Alta',
    priorityColor: '#ef4444',
    status: 'Concluído',
    rawState: 'closed',
    author: 'walancy',
    commentsCount: 2,
    assignees: [{ name: 'walancy', initial: 'W', avatarBg: '#8b5cf6' }],
    progress: 100,
    rawLabels: ['infra', 'setup'],
  },
  {
    id: '#102',
    projectId: 1,
    githubNumber: 102,
    title: 'Modelagem de entidades e migrações base do PostgreSQL',
    description: 'Estruturação das tabelas de usuários, tenants, permissões e histórico de auditoria.',
    dateStr: '04 Set 2026',
    createdAtIso: '2026-09-04T11:30:00Z',
    durationDays: 12,
    startDateIso: '2026-09-04',
    dueDateIso: '2026-09-07',
    milestoneNumber: 1,
    milestoneTitle: 'Sprint1 - Setup Inicial e Arquitetura',
    tag: 'database',
    tagColor: { bg: 'rgba(14, 165, 233, 0.15)', text: '#0ea5e9' },
    priority: 'Urgente',
    priorityColor: '#dc2626',
    status: 'Concluído',
    rawState: 'closed',
    author: 'nelsonappmoove',
    commentsCount: 4,
    assignees: [{ name: 'nelsonappmoove', initial: 'N', avatarBg: '#10b981' }],
    progress: 100,
    rawLabels: ['database'],
  },
  {
    id: '#103',
    projectId: 1,
    githubNumber: 103,
    title: 'Pipeline de CI/CD com GitHub Actions e linters automatizados',
    description: 'Workflows de validação de PRs, verificação de tipos e compilação contínua.',
    dateStr: '07 Set 2026',
    createdAtIso: '2026-09-07T14:15:00Z',
    durationDays: 9,
    startDateIso: '2026-09-07',
    dueDateIso: '2026-09-09',
    milestoneNumber: 1,
    milestoneTitle: 'Sprint1 - Setup Inicial e Arquitetura',
    tag: 'devops',
    tagColor: { bg: 'rgba(234, 179, 8, 0.15)', text: '#eab308' },
    priority: 'Média',
    priorityColor: '#f59e0b',
    status: 'Concluído',
    rawState: 'closed',
    author: 'walancy',
    commentsCount: 1,
    assignees: [{ name: 'walancy', initial: 'W', avatarBg: '#8b5cf6' }],
    progress: 100,
    rawLabels: ['devops', 'ci'],
  },
  {
    id: '#104',
    projectId: 1,
    githubNumber: 104,
    title: 'Design System: Tokens de cores, dark mode e componentes base',
    description: 'Criação da paleta de cores CSS variáveis, tipografia e botões/inputs padronizados.',
    dateStr: '09 Set 2026',
    createdAtIso: '2026-09-09T10:00:00Z',
    durationDays: 7,
    startDateIso: '2026-09-09',
    dueDateIso: '2026-09-11',
    milestoneNumber: 1,
    milestoneTitle: 'Sprint1 - Setup Inicial e Arquitetura',
    tag: 'frontend',
    tagColor: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6' },
    priority: 'Alta',
    priorityColor: '#ef4444',
    status: 'Concluído',
    rawState: 'closed',
    author: 'walancy',
    commentsCount: 3,
    assignees: [{ name: 'walancy', initial: 'W', avatarBg: '#8b5cf6' }],
    progress: 100,
    rawLabels: ['frontend', 'UI/UX'],
  },
  {
    id: '#105',
    projectId: 1,
    githubNumber: 105,
    title: 'Implementação dos middlewares de autenticação JWT e RBAC',
    description: 'Proteção de endpoints, extração de claims do token e validação de permissões de perfil.',
    dateStr: '11 Set 2026',
    createdAtIso: '2026-09-11T16:20:00Z',
    durationDays: 5,
    startDateIso: '2026-09-11',
    dueDateIso: '2026-09-13',
    milestoneNumber: 1,
    milestoneTitle: 'Sprint1 - Setup Inicial e Arquitetura',
    tag: 'backend',
    tagColor: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981' },
    priority: 'Urgente',
    priorityColor: '#dc2626',
    status: 'Concluído',
    rawState: 'closed',
    author: 'nelsonappmoove',
    commentsCount: 5,
    assignees: [{ name: 'nelsonappmoove', initial: 'N', avatarBg: '#10b981' }],
    progress: 100,
    rawLabels: ['backend', 'security'],
  },
  {
    id: '#106',
    projectId: 1,
    githubNumber: 106,
    title: 'Testes de integração de serviços e ambiente de homologação',
    description: 'Execução de suite de testes de integração com banco de dados em container Docker.',
    dateStr: '13 Set 2026',
    createdAtIso: '2026-09-13T08:45:00Z',
    durationDays: 3,
    startDateIso: '2026-09-13',
    dueDateIso: '2026-09-15',
    milestoneNumber: 1,
    milestoneTitle: 'Sprint1 - Setup Inicial e Arquitetura',
    tag: 'qa',
    tagColor: { bg: 'rgba(236, 72, 153, 0.15)', text: '#ec4899' },
    priority: 'Média',
    priorityColor: '#f59e0b',
    status: 'Concluído',
    rawState: 'closed',
    author: 'walancy',
    commentsCount: 1,
    assignees: [{ name: 'walancy', initial: 'W', avatarBg: '#8b5cf6' }],
    progress: 100,
    rawLabels: ['qa', 'tests'],
  },
  {
    id: '#107',
    projectId: 1,
    githubNumber: 107,
    title: 'Documentação técnica da arquitetura e guia de contribuição',
    description: 'Documentação no README, diagramas C4 e convenções de commit/branch da equipe.',
    dateStr: '15 Set 2026',
    createdAtIso: '2026-09-15T17:00:00Z',
    durationDays: 1,
    startDateIso: '2026-09-15',
    dueDateIso: '2026-09-15',
    milestoneNumber: 1,
    milestoneTitle: 'Sprint1 - Setup Inicial e Arquitetura',
    tag: 'docs',
    tagColor: { bg: 'rgba(255, 255, 255, 0.08)', text: '#a3a3a3' },
    priority: 'Baixa',
    priorityColor: '#22c55e',
    status: 'Concluído',
    rawState: 'closed',
    author: 'nelsonappmoove',
    commentsCount: 0,
    assignees: [{ name: 'nelsonappmoove', initial: 'N', avatarBg: '#10b981' }],
    progress: 100,
    rawLabels: ['docs'],
  },
  {
    id: '#246',
    projectId: 1,
    githubNumber: 246,
    title: 'Constraint de FK duplicada em gruposParticipantes.grupo_id quebra embeds do PostgREST',
    description: 'Verificada duplicação de FK impedindo resolução de embeds do PostgREST.',
    dateStr: '05 Set 2026',
    createdAtIso: '2026-09-05T12:00:00Z',
    durationDays: 14,
    milestoneNumber: 2,
    milestoneTitle: 'Sprint2 - Cadastro e Perfis de Acesso',
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
    milestoneNumber: 2,
    milestoneTitle: 'Sprint2 - Cadastro e Perfis de Acesso',
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
    milestoneNumber: 2,
    milestoneTitle: 'Sprint2 - Cadastro e Perfis de Acesso',
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
  iterationId?: string;
  isProjectIteration?: boolean;
  isVirtual?: boolean;
  projectId?: string;
  iterationFieldId?: string;
  title: string;
  durationLabel: string;
  startDateIso: string;
  dueDateIso: string;
  dateRangeLabel: string;
  status: 'Current' | 'Planned' | 'Completed';
}

// Extrai iterações (Sprints) dos campos de Projects V2 do GitHub
function extractProjectIterations(projects: any[]): SprintOption[] {
  const result: SprintOption[] = [];
  const seenIds = new Set<string>();
  const seenTitles = new Set<string>();

  for (const proj of projects) {
    if (!proj) continue;
    const fields = proj.fields?.nodes || [];
    for (const f of fields) {
      if (f?.configuration?.iterations || f?.configuration?.completedIterations) {
        const activeIts = f.configuration.iterations || [];
        const completedIts = f.configuration.completedIterations || [];
        const allIts = [
          ...activeIts.map((it: any) => ({ ...it, state: 'open' as const })),
          ...completedIts.map((it: any) => ({ ...it, state: 'closed' as const })),
        ];

        allIts.forEach((it, idx) => {
          if (!it || seenIds.has(it.id) || seenTitles.has(it.title)) return;
          seenIds.add(it.id);
          seenTitles.add(it.title);

          const startIso = it.startDate ? it.startDate.slice(0, 10) : undefined;
          let dueIso: string | undefined = undefined;
          if (startIso && it.duration) {
            const d = new Date(`${startIso}T00:00:00`);
            if (!Number.isNaN(d.getTime())) {
              d.setDate(d.getDate() + (it.duration - 1));
              dueIso = d.toISOString().slice(0, 10);
            }
          }

          const numMatch = it.title.match(/(?:sprint|iteração|iteracao|sp)\s*#?(\d+)/i);
          const sprintNum = numMatch ? parseInt(numMatch[1], 10) : (1000 + idx);

          result.push({
            number: sprintNum,
            iterationId: it.id,
            isProjectIteration: true,
            projectId: proj.id,
            iterationFieldId: f.id,
            title: it.title,
            state: it.state,
            startDateIso: startIso,
            dueDateIso: dueIso,
            durationLabel: it.duration ? `${Math.round(it.duration / 7)} semanas` : 'Sprint',
            openIssues: 0,
            closedIssues: 0,
          });
        });
      }
    }
  }

  return result;
}

// Mapeia o número da issue para sua iteração/sprint correspondente no Project V2
function extractIssueIterationsMap(projectItems: any[], repoFullName: string): Map<number, { iterationId?: string; iterationTitle?: string }> {
  const map = new Map<number, { iterationId?: string; iterationTitle?: string }>();
  if (!projectItems || !Array.isArray(projectItems)) return map;

  for (const item of projectItems) {
    const content = item.content;
    if (!content || content.number == null) continue;
    const contentRepo = content.repository?.nameWithOwner;
    if (contentRepo && contentRepo.toLowerCase() !== repoFullName.toLowerCase()) continue;

    const fieldValues = item.fieldValues?.nodes || [];
    for (const fv of fieldValues) {
      if (fv && (fv.iterationId || fv.title)) {
        map.set(content.number, {
          iterationId: fv.iterationId,
          iterationTitle: fv.title,
        });
        break;
      }
    }
  }

  return map;
}

const GITHUB_PROJECT_COLOR_MAP: Record<string, string> = {
  GRAY: '#94a3b8',
  BLUE: '#38bdf8',
  GREEN: '#22c55e',
  YELLOW: '#f59e0b',
  ORANGE: '#f97316',
  RED: '#ef4444',
  PINK: '#ec4899',
  PURPLE: '#8957e5',
};

export interface ProjectV2ItemData {
  itemId: string;
  statusName?: string;
  statusOptionId?: string;
  estimate?: number;
  iterationId?: string;
  iterationTitle?: string;
}

function extractProjectV2ColumnsAndItems(project: any): {
  columns: KanbanColumnDef[];
  statusFieldId: string | null;
  projectId: string | null;
  itemsMap: Map<string, ProjectV2ItemData>;
} {
  const columns: KanbanColumnDef[] = [];
  let statusFieldId: string | null = null;
  const projectId: string | null = project?.id || null;
  const itemsMap = new Map<string, ProjectV2ItemData>();

  if (!project) return { columns, statusFieldId, projectId, itemsMap };

  // 1. Procurar o campo Status no Project V2 (nome configurável em Configurações → Fluxo de trabalho)
  const fields = project.fields?.nodes || [];
  const cfgRepo: string | undefined = project.repositories?.nodes?.[0]?.nameWithOwner;
  const projectStatusName = (getProjectSettings(cfgRepo).workflow.statusFieldName || 'status').toLowerCase();
  const statusField =
    fields.find((f: any) => f && Array.isArray(f.options) && f.name?.toLowerCase() === projectStatusName) ||
    fields.find(
      (f: any) =>
        f &&
        Array.isArray(f.options) &&
        (f.name?.toLowerCase() === 'status' || f.__typename === 'ProjectV2SingleSelectField')
    );

  if (statusField) {
    statusFieldId = statusField.id;
    const options = statusField.options || [];
    options.forEach((opt: any, idx: number) => {
      const colorKey = String(opt.color || '').toUpperCase();
      const dotColor = GITHUB_PROJECT_COLOR_MAP[colorKey] || (opt.color?.startsWith('#') ? opt.color : '#94a3b8');
      const isDone =
        resolveProjectStatus(cfgRepo, opt.name) === 'Concluído' ||
        opt.name.toLowerCase().includes('done') ||
        opt.name.toLowerCase().includes('conclu') ||
        opt.name.toLowerCase().includes('finaliz') ||
        opt.name.toLowerCase().includes('closed') ||
        idx === options.length - 1;

      columns.push({
        id: opt.id,
        optionId: opt.id,
        title: opt.name,
        subtitle: opt.description || undefined,
        dotColor,
        isDoneType: isDone,
      });
    });
  }

  // 2. Extrair itens do Project V2
  const items = project.items?.nodes || [];
  for (const item of items) {
    const content = item.content;
    if (!content || content.number == null) continue;
    const repoFullName = content.repository?.nameWithOwner;
    const itemData: ProjectV2ItemData = {
      itemId: item.id,
    };

    const wfCfg = getProjectSettings(repoFullName).workflow;
    const statusName = (wfCfg.statusFieldName || 'status').toLowerCase();
    const fieldValues = item.fieldValues?.nodes || [];
    for (const fv of fieldValues) {
      if (!fv) continue;
      const fieldName = fv.field?.name?.toLowerCase();
      // Single select: Status
      if (fv.optionId || (fv.name && fv.field)) {
        if (!fieldName || fieldName === statusName) {
          itemData.statusName = fv.name;
          itemData.statusOptionId = fv.optionId;
        }
      }
      // Number: Estimate / Story Points
      if (typeof fv.number === 'number' && (!wfCfg.estimateFieldName || fieldName === wfCfg.estimateFieldName.toLowerCase())) {
        itemData.estimate = fv.number;
      }
      // Iteration: Sprint
      if ((fv.iterationId || fv.title) && (!wfCfg.iterationFieldName || !fieldName || fieldName === wfCfg.iterationFieldName.toLowerCase())) {
        itemData.iterationId = fv.iterationId;
        itemData.iterationTitle = fv.title;
      }
    }

    // Só a chave com o repositório: um Project de org mistura issues de vários repos, e a chave
    // pelo número puro fazia a #3 de um repo herdar a sprint/status da #3 de outro.
    itemsMap.set(repoFullName ? `${repoFullName.toLowerCase()}#${content.number}` : String(content.number), itemData);
  }

  return { columns, statusFieldId, projectId, itemsMap };
}

function getStatusBarColor(status: ProjectIssue['status'], isEffectiveDark: boolean): string {
  if (status === 'Concluído') return '#10b981';
  if (status === 'Em Progresso') return '#f59e0b';
  return isEffectiveDark ? '#444444' : '#cbd5e1';
}

export function mapGithubIssueToProjectIssue(gh: any, projectId: number | string, pulls: any[]): ProjectIssue {
  const labelObjs: Array<{ name: string; color?: string }> = (gh.labels || [])
    .map((l: any) => (typeof l === 'string' ? { name: l } : { name: l?.name || '', color: l?.color }))
    .filter((l: any) => Boolean(l.name));
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
        url: matchedPull.html_url || matchedPull.url,
      }
    : undefined;

  const isClosed = String(gh.state || '').toLowerCase() === 'closed';
  const hasInProgress =
    lowerLabels.some((l) => isProgressLabel(l)) ||
    Boolean(matchedPull && !matchedPull.merged_at && matchedPull.status !== 'merged');
  const status: ProjectIssue['status'] = isClosed ? 'Concluído' : hasInProgress ? 'Em Progresso' : 'A Fazer';

  const tagLabelObj = labelObjs.find((l) => {
    const name = l.name.toLowerCase();
    return !name.startsWith('priority:') && !isProgressLabel(name);
  });
  const tagName = tagLabelObj?.name || 'Geral';
  const tagColor =
    TAG_LABEL_STYLE[tagName.toLowerCase()] ||
    (tagLabelObj?.color
      ? { bg: hexToRgba(`#${tagLabelObj.color}`, 0.15), text: `#${tagLabelObj.color}` }
      : { bg: 'rgba(148, 163, 184, 0.15)', text: '#94a3b8' });

  const rawCreatedAt = gh.created_at || gh.createdAt;
  const createdAt = rawCreatedAt ? new Date(rawCreatedAt) : new Date();
  const rawClosedAt = gh.closed_at || gh.closedAt;
  const closedAt = rawClosedAt ? new Date(rawClosedAt) : null;
  const endReference = closedAt || new Date();
  const daysOpen = Math.max(1, Math.round((endReference.getTime() - createdAt.getTime()) / 86400000));

  const assigneeList: any[] = Array.isArray(gh.assignees) && gh.assignees.length > 0
    ? gh.assignees
    : gh.assignee
    ? [gh.assignee]
    : [];
  const assignees = assigneeList.map((a: any) => {
    const login = typeof a === 'string' ? a : (a?.login || a?.name || 'user');
    const avatarUrl = a?.avatar_url || a?.avatarUrl || `https://github.com/${login}.png?size=40`;
    return {
      name: login,
      initial: (login || '?').charAt(0).toUpperCase(),
      avatarBg: '#6366f1',
      avatarUrl,
    };
  });

  const authorLogin =
    gh.user?.login ||
    (typeof gh.author === 'object' && gh.author !== null ? gh.author.login || gh.author.name : gh.author) ||
    'gh-user';
  const authorAvatarUrl =
    gh.user?.avatar_url ||
    gh.authorAvatar ||
    (authorLogin ? `https://github.com/${authorLogin}.png?size=40` : undefined);

  // Datas de início/término vêm da sprint (milestone) atribuída à issue, não da própria issue.
  const milestone = gh.milestone;
  const milestoneTitle =
    typeof milestone === 'string'
      ? milestone
      : milestone?.title || gh.milestone_title || gh.milestoneTitle;
  const milestoneNumber =
    typeof milestone === 'number'
      ? milestone
      : milestone?.number ?? (typeof gh.milestone_number === 'number' ? gh.milestone_number : undefined);
  const milestoneDue = milestone?.due_on || milestone?.dueOn;
  const startDateIso = milestone?.description ? parseSprintStart(milestone.description) : undefined;
  const dueDateIso = milestoneDue ? toIsoDateOnly(milestoneDue) : undefined;

  // Extrai parent issue se existir (via API ou texto "Parte de #XX")
  let parentIssueNumber: number | undefined = undefined;
  if (gh.parent_issue_url) {
    const m = String(gh.parent_issue_url).match(/\/issues\/(\d+)$/);
    if (m) parentIssueNumber = parseInt(m[1], 10);
  }
  if (!parentIssueNumber && gh.body) {
    const partOfMatch = String(gh.body).match(/(?:parte de|part of)\s+#(\d+)/i);
    if (partOfMatch) parentIssueNumber = parseInt(partOfMatch[1], 10);
  }

  // Extrai números de sub-issues referenciadas na descrição (ex: - [ ] #40 ou - [x] #41)
  const subIssueNumbers: number[] = [];
  if (gh.body) {
    const lines = String(gh.body).split('\n');
    lines.forEach((line) => {
      const match = line.match(/^\s*[-*]\s*\[([ xX])\]\s+(?:.*?)#(\d+)\b/);
      if (match) {
        subIssueNumbers.push(parseInt(match[2], 10));
      }
    });
  }

  const subIssuesSummary = gh.sub_issues_summary || (subIssueNumbers.length > 0 ? {
    total: subIssueNumbers.length,
    completed: 0,
    percent_completed: 0,
  } : undefined);

  return {
    id: `#${gh.number}`,
    projectId,
    githubNumber: gh.number,
    nodeId: gh.node_id,
    htmlUrl: gh.html_url || gh.url,
    rawLabels: labelNames,
    rawState: isClosed ? 'closed' : 'open',
    author: authorLogin,
    authorAvatarUrl,
    commentsCount: gh.comments || 0,
    title: gh.title,
    description: gh.body || '',
    dateStr: createdAt.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' }),
    createdAtIso: createdAt.toISOString(),
    closedAtIso: closedAt ? closedAt.toISOString() : undefined,
    durationDays: daysOpen,
    startDateIso,
    dueDateIso,
    milestoneNumber,
    milestoneTitle,
    tag: tagName,
    tagColor,
    priority,
    priorityColor,
    status,
    assignees,
    progress: status === 'Concluído' ? 100 : status === 'Em Progresso' ? 50 : 0,
    pullRequest,
    parentIssueNumber,
    subIssuesSummary,
    subIssueNumbers: subIssueNumbers.length > 0 ? subIssueNumbers : undefined,
  };
}

export interface ParsedSubIssueItem {
  id: string;
  issueNumber?: number;
  linkedIssue?: ProjectIssue;
  title: string;
  completed: boolean;
  lineIndex?: number;
}

// Extrai as sub-issues vinculadas a uma issue (sejam issues reais referenciadas ou itens de checklist)
export function extractSubIssuesForIssue(
  issue: ProjectIssue,
  allIssuesMap: Map<number, ProjectIssue>
): ParsedSubIssueItem[] {
  const result: ParsedSubIssueItem[] = [];
  const seenNumbers = new Set<number>();

  // 1. Extrai da descrição da issue (linhas no formato - [ ] ou - [x])
  if (issue.description) {
    const lines = String(issue.description).split('\n');
    lines.forEach((line, idx) => {
      const match = line.match(/^(\s*[-*]\s*\[([ xX])\]\s+)(.+)$/);
      if (match) {
        const completed = match[2].toLowerCase() === 'x';
        const rawText = match[3].trim();
        const numMatch = rawText.match(/#(\d+)\b/);
        const childNum = numMatch ? parseInt(numMatch[1], 10) : undefined;

        let linked: ProjectIssue | undefined = undefined;
        if (childNum) {
          linked = allIssuesMap.get(childNum);
          seenNumbers.add(childNum);
        }

        const cleanTitle = linked?.title || (numMatch ? rawText.replace(numMatch[0], '').trim() || rawText : rawText);

        result.push({
          id: linked ? linked.id : `${issue.id}-sub-${idx}`,
          issueNumber: childNum,
          linkedIssue: linked,
          title: cleanTitle,
          completed: linked ? (linked.status === 'Concluído' || linked.rawState === 'closed') : completed,
          lineIndex: idx,
        });
      }
    });
  }

  // 2. Se houver outras issues cujo parentIssueNumber aponta para esta issue
  if (issue.githubNumber) {
    allIssuesMap.forEach((otherIssue) => {
      if (
        otherIssue.parentIssueNumber === issue.githubNumber &&
        otherIssue.githubNumber &&
        !seenNumbers.has(otherIssue.githubNumber)
      ) {
        seenNumbers.add(otherIssue.githubNumber);
        result.push({
          id: otherIssue.id,
          issueNumber: otherIssue.githubNumber,
          linkedIssue: otherIssue,
          title: otherIssue.title,
          completed: otherIssue.status === 'Concluído' || otherIssue.rawState === 'closed',
        });
      }
    });
  }

  return result;
}

// Localiza o card correspondente ao projeto/repositório selecionado na header
function findMatchingCard(
  cards: ProjectCardData[],
  wsPath?: string,
  rName?: string
): ProjectCardData | null {
  if (!cards || cards.length === 0) return null;

  const cleanRepoName = rName ? rName.trim().toLowerCase() : '';
  const repoBaseName = cleanRepoName.includes('/') ? cleanRepoName.split('/').pop()! : cleanRepoName;
  const folderName = wsPath ? wsPath.split('/').filter(Boolean).pop()?.toLowerCase() : '';
  const isAuraDevFolder = folderName === 'devflow-desktop';

  // 1. Correspondência exata pelo fullName (ex: "walancy/cooperaagro-app" ou "walancy/aura-dev")
  if (cleanRepoName) {
    const fullMatch = cards.find(
      (c) => c.fullName && c.fullName.toLowerCase() === cleanRepoName
    );
    if (fullMatch) return fullMatch;
  }

  // 2. Correspondência exata por repoName / name / title usando o baseName
  if (repoBaseName) {
    const nameMatch = cards.find(
      (c) =>
        (c.repoName && c.repoName.toLowerCase() === repoBaseName) ||
        (c.name && c.name.toLowerCase() === repoBaseName) ||
        (c.title && c.title.toLowerCase() === repoBaseName)
    );
    if (nameMatch) return nameMatch;
  }

  // 3. Correspondência pelo nome da pasta do workspace (tratando mapeamento devflow-desktop -> aura-dev)
  if (folderName) {
    const folderMatch = cards.find(
      (c) =>
        (c.repoName && c.repoName.toLowerCase() === folderName) ||
        (c.name && c.name.toLowerCase() === folderName) ||
        (c.title && c.title.toLowerCase() === folderName) ||
        (isAuraDevFolder && (
          c.name?.toLowerCase() === 'aura-dev' ||
          c.title?.toLowerCase() === 'aura dev' ||
          (c.fullName && c.fullName.toLowerCase().includes('aura-dev'))
        ))
    );
    if (folderMatch) return folderMatch;
  }

  // 4. Correspondência se o workspacePath termina com o nome do repo do card ou pelo localDir
  if (wsPath) {
    const lowerWs = wsPath.toLowerCase();
    const pathMatch = cards.find(
      (c) =>
        (c.localDir && c.localDir.toLowerCase() === lowerWs) ||
        (c.name &&
          (lowerWs.endsWith(`/${c.name.toLowerCase()}`) ||
           lowerWs.endsWith(`/${c.name.toLowerCase()}/`)))
    );
    if (pathMatch) return pathMatch;
  }

  return null;
}

interface ProjectsViewErrorBoundaryProps {
  children: React.ReactNode;
  isEffectiveDark?: boolean;
}

interface ProjectsViewErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ProjectsViewErrorBoundary extends React.Component<
  ProjectsViewErrorBoundaryProps,
  ProjectsViewErrorBoundaryState
> {
  state: ProjectsViewErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[ProjectsSchedulerView] Erro capturado pelo ErrorBoundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isDark = this.props.isEffectiveDark ?? true;
      return (
        <div
          style={{
            flex: 1,
            width: '100%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            gap: 16,
            background: isDark ? '#101010' : '#f5f5f5',
            color: isDark ? '#ffffff' : '#111111',
            fontFamily: "'Poppins', sans-serif",
          }}
        >
          <div
            style={{
              padding: 12,
              borderRadius: 12,
              background: 'rgba(239, 68, 68, 0.12)',
              color: '#ef4444',
            }}
          >
            <AlertTriangle size={32} />
          </div>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600 }}>
            Ocorreu um erro ao carregar a tela de projetos
          </h3>
          <p style={{ margin: 0, fontSize: 12.5, color: isDark ? '#888' : '#64748b', maxWidth: 480, textAlign: 'center' }}>
            {this.state.error?.message || 'Erro inesperado na renderização.'}
          </p>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              border: 'none',
              background: '#ef4444',
              color: '#fff',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Tentar Novamente
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// =========================================================================
// CACHE GLOBAL EM MEMÓRIA & PERSISTÊNCIA EM DISCO (0ms de latência)
// Permite que a prateleira e todas as tarefas já estejam pré-carregadas
// =========================================================================
interface ProjectsGlobalCache {
  currentUser: { login: string; avatarUrl: string } | null;
  repos: GithubRepoSummary[];
  localClonedRepos: Array<{ dir: string; name: string; repoFullName?: string; remoteUrl?: string }>;
  orgs: Array<{ login: string; avatarUrl: string }>;
  repoDetailsCache: Record<
    string,
    { issues: ProjectIssue[]; sprints: SprintOption[]; collaborators: RepoCollaborator[]; isLoading: boolean; error: string | null; fetchedAt?: number }
  >;
  lastFetchedAt: number;
}

export const GLOBAL_PROJECTS_CACHE: ProjectsGlobalCache = {
  currentUser: null,
  repos: [],
  localClonedRepos: [],
  orgs: [],
  repoDetailsCache: {},
  lastFetchedAt: 0,
};

// Hidratação instantânea do cache via localStorage no carregamento do script
try {
  const savedCache = localStorage.getItem('devflow_projects_global_cache_v2');
  if (savedCache) {
    const parsed = JSON.parse(savedCache);
    if (Array.isArray(parsed.repos) && parsed.repos.length > 0) {
      GLOBAL_PROJECTS_CACHE.repos = parsed.repos;
    }
    if (Array.isArray(parsed.localClonedRepos) && parsed.localClonedRepos.length > 0) {
      GLOBAL_PROJECTS_CACHE.localClonedRepos = parsed.localClonedRepos;
    }
    if (Array.isArray(parsed.orgs) && parsed.orgs.length > 0) {
      GLOBAL_PROJECTS_CACHE.orgs = parsed.orgs;
    }
    if (parsed.currentUser) {
      GLOBAL_PROJECTS_CACHE.currentUser = parsed.currentUser;
    }
    if (parsed.repoDetailsCache && typeof parsed.repoDetailsCache === 'object') {
      const details = { ...parsed.repoDetailsCache };
      for (const k of Object.keys(details)) {
        if (details[k]) {
          details[k].isLoading = false;
        }
      }
      GLOBAL_PROJECTS_CACHE.repoDetailsCache = details;
    }
    if (parsed.lastFetchedAt) {
      GLOBAL_PROJECTS_CACHE.lastFetchedAt = parsed.lastFetchedAt;
    }
  }
} catch (e) {
  console.warn('Aviso ao carregar cache de projetos:', e);
}

let saveProjectsCacheTimeout: any = null;
function persistProjectsCache() {
  if (saveProjectsCacheTimeout) clearTimeout(saveProjectsCacheTimeout);
  saveProjectsCacheTimeout = setTimeout(() => {
    try {
      localStorage.setItem(
        'devflow_projects_global_cache_v2',
        JSON.stringify({
          currentUser: GLOBAL_PROJECTS_CACHE.currentUser,
          repos: GLOBAL_PROJECTS_CACHE.repos,
          localClonedRepos: GLOBAL_PROJECTS_CACHE.localClonedRepos,
          orgs: GLOBAL_PROJECTS_CACHE.orgs,
          repoDetailsCache: GLOBAL_PROJECTS_CACHE.repoDetailsCache,
          lastFetchedAt: GLOBAL_PROJECTS_CACHE.lastFetchedAt,
        })
      );
      window.dispatchEvent(new CustomEvent('devflow_projects_cache_updated'));
    } catch (err) {
      console.warn('Aviso ao persistir cache de projetos:', err);
    }
  }, 100);
}

const ProjectsSchedulerViewInner: React.FC<ProjectsSchedulerViewProps> = ({
  workspacePath,
  repoName,
  onSelectWorkspace,
  accentColor: propAccentColor,
  isEffectiveDark: propIsEffectiveDark,
  themeTokens,
  selectedAiProvider: propSelectedAiProvider,
  selectedModel: propSelectedModel,
  onSelectAiProvider,
  onSelectModel,
  installedClis,
  activeModels,
  onInstallAiCli,
}) => {
  const [localAiProvider, setLocalAiProvider] = useState<string>(
    () => propSelectedAiProvider || localStorage.getItem('ide_selected_ai_provider') || 'claude'
  );

  const [localAiModel, setLocalAiModel] = useState<string>(() => {
    if (propSelectedModel) return propSelectedModel;
    const initialProv = propSelectedAiProvider || localStorage.getItem('ide_selected_ai_provider') || 'claude';
    const savedModel = localStorage.getItem(`ide_selected_ai_model_${initialProv}`) || localStorage.getItem('ide_selected_ai_model');
    if (savedModel) return savedModel;
    const provObj = AI_PROVIDERS.find((p) => p.id === initialProv);
    return provObj?.models?.[0] || 'Default';
  });

  const [isAiSelectorOpen, setIsAiSelectorOpen] = useState(false);
  const [activeSubmenuProvider, setActiveSubmenuProvider] = useState<string | null>(null);

  useEffect(() => {
    if (propSelectedAiProvider && propSelectedAiProvider !== localAiProvider) {
      setLocalAiProvider(propSelectedAiProvider);
    }
  }, [propSelectedAiProvider]);

  useEffect(() => {
    if (propSelectedModel && propSelectedModel !== localAiModel) {
      setLocalAiModel(propSelectedModel);
    }
  }, [propSelectedModel]);

  const selectedAiProvider = localAiProvider;

  const handleSelectAiProvider = (providerId: string) => {
    setLocalAiProvider(providerId);
    setActiveSubmenuProvider(providerId);
    localStorage.setItem('ide_selected_ai_provider', providerId);
    onSelectAiProvider?.(providerId);

    const prov = AI_PROVIDERS.find((p) => p.id === providerId);
    const dynamicList = activeModels?.[providerId]?.models || [];
    const fallbackList = (prov?.models || []).map((mName) => ({ id: mName, label: mName }));
    const modelList = dynamicList.length > 0 ? dynamicList : fallbackList;
    const defModel = modelList[0]?.label || 'Default';
    const defModelId = modelList[0]?.id || defModel;

    setLocalAiModel(defModel);
    localStorage.setItem(`ide_selected_ai_model_${providerId}`, defModel);
    localStorage.setItem('ide_selected_ai_model', defModel);
    onSelectModel?.({ id: defModelId, label: defModel }, providerId);

    if (window.electronAPI?.ai?.setModel) {
      window.electronAPI.ai.setModel(providerId, defModelId).catch(() => {});
    }
    showToast(`IA alterada para ${prov?.name || providerId} (${defModel})`);
  };

  const handleSelectAiModel = (modelItem: { id: string; label: string }, providerId: string) => {
    setLocalAiProvider(providerId);
    setLocalAiModel(modelItem.label);
    localStorage.setItem('ide_selected_ai_provider', providerId);
    localStorage.setItem(`ide_selected_ai_model_${providerId}`, modelItem.label);
    localStorage.setItem('ide_selected_ai_model', modelItem.label);

    onSelectAiProvider?.(providerId);
    onSelectModel?.(modelItem, providerId);

    if (window.electronAPI?.ai?.setModel) {
      window.electronAPI.ai.setModel(providerId, modelItem.id).catch(() => {});
    }

    const prov = AI_PROVIDERS.find((p) => p.id === providerId);
    showToast(`Modelo: ${prov?.name || providerId} · ${modelItem.label}`);
    setIsAiSelectorOpen(false);
  };

  const accentColor = propAccentColor || localStorage.getItem('ide_accent_color') || '#FF6A00';
  const isEffectiveDark = propIsEffectiveDark !== undefined
    ? propIsEffectiveDark
    : (localStorage.getItem('ide_theme_mode') !== 'light');

  const accentContrastText = getContrastTextColor(accentColor);
  const isAccentContrastDark = accentContrastText === '#000000';

  const theme = {
    bgApp: themeTokens?.bgApp || (isEffectiveDark ? '#0a0a0a' : '#f5f5f5'),
    bgShelf: isEffectiveDark ? '#101010' : '#f5f5f5',
    shelfBorder: 'none',
    shelfShadow: 'none',
    cardBg: isEffectiveDark ? '#181818' : '#ffffff',
    cardHoverBg: isEffectiveDark ? '#222222' : '#f0f0f0',
    cardBorder: 'none',
    controlBg: isEffectiveDark ? '#1e1e1e' : '#f0f0f0',
    controlHoverBg: isEffectiveDark ? '#262626' : '#e5e5e5',
    controlBorder: 'none',
    controlShadow: 'none',
    dropdownBg: isEffectiveDark ? '#181818' : '#ffffff',
    dropdownShadow: 'none',
    dropdownBorder: 'none',
    dropdownItemHover: isEffectiveDark ? '#242424' : '#f0f0f0',
    textPrimary: themeTokens?.textPrimary || (isEffectiveDark ? '#ffffff' : '#111111'),
    textSecondary: themeTokens?.textSecondary || (isEffectiveDark ? '#888888' : '#777777'),
    textMuted: themeTokens?.textMuted || (isEffectiveDark ? '#555555' : '#999999'),
    viewContainerBg: isEffectiveDark ? '#101010' : '#f5f5f5',
    viewCanvasBg: isEffectiveDark ? '#141414' : '#f5f5f5',
    viewCardBg: isEffectiveDark ? '#181818' : '#ffffff',
    viewCardHoverBg: isEffectiveDark ? '#222222' : '#f0f0f0',
    viewCardBorder: 'none',
    viewCardShadow: 'none',
    tableHeaderBg: isEffectiveDark ? '#1e1e1e' : '#f0f0f0',
    tableBorder: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
    modalOverlay: isEffectiveDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)',
    modalBg: isEffectiveDark ? '#181818' : '#ffffff',
    modalBorder: 'none',
    modalShadow: 'none',
    modalInputBg: isEffectiveDark ? '#1e1e1e' : '#f0f0f0',
    modalInputBorder: 'none',
    avatarBorder: isEffectiveDark ? '#181818' : '#ffffff',
  };
  const [hoveredCardId, setHoveredCardId] = useState<number | string | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<number | string | null>(null);
  const [projectLayoutMode, setProjectLayoutMode] = useState<'grid' | 'list'>('grid');
  type TableSortField = 'index' | 'project' | 'language' | 'progress' | 'done' | 'inProgress' | 'open' | 'health' | 'updatedAt';
  const [tableSortField, setTableSortField] = useState<TableSortField | null>(null);
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('asc');

  const handleTableSort = useCallback((field: TableSortField) => {
    let nextDirection: 'asc' | 'desc' = 'asc';

    if (tableSortField === field) {
      // Inverte a direção: asc (de baixo pra cima) <-> desc (de cima pra baixo)
      nextDirection = tableSortDirection === 'asc' ? 'desc' : 'asc';
    } else {
      // Primeira ordenação no campo: inicia em 'asc' para texto/índice ou em 'desc' para métricas
      nextDirection = field === 'project' || field === 'language' || field === 'index' ? 'asc' : 'desc';
    }

    setTableSortField(field);
    setTableSortDirection(nextDirection);

    logSystemActivity('projects', 'sort_table_column', field, {
      field,
      direction: nextDirection,
    });
  }, [tableSortField, tableSortDirection]);

  const isGridMode = selectedCardId === null;
  // Quando um projeto estiver selecionado, deve mostrar a view em cards ('grid') e não em lista
  const effectiveProjectLayoutMode = isGridMode ? projectLayoutMode : 'grid';
  const [selectedSection, setSelectedSection] = useState<ProjectSectionId>('sprints');
  const [hoveredSectionId, setHoveredSectionId] = useState<ProjectSectionId | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSprint, setSelectedSprint] = useState('Todas as Linguagens');
  const [selectedStatus, setSelectedStatus] = useState('Todos os Projetos');
  const [selectedVersion, setSelectedVersion] = useState('v2.4 - Produção');
  const [selectedOrg, _setSelectedOrg] = useState<string>(() => {
    try {
      return localStorage.getItem('header_selected_org') || 'Todas';
    } catch {
      return 'Todas';
    }
  });

  const setSelectedOrg = useCallback((org: string | ((prev: string) => string)) => {
    _setSelectedOrg((prev) => {
      const next = typeof org === 'function' ? org(prev) : org;
      try {
        localStorage.setItem('header_selected_org', next);
        window.dispatchEvent(new CustomEvent('header_selected_org_changed', { detail: next }));
      } catch {}
      return next;
    });
  }, []);

  useEffect(() => {
    const handleOrgChanged = (e: any) => {
      const nextOrg = e?.detail || localStorage.getItem('header_selected_org');
      if (nextOrg && nextOrg !== selectedOrg) {
        _setSelectedOrg(nextOrg);
      }
    };
    window.addEventListener('header_selected_org_changed', handleOrgChanged);
    window.addEventListener('storage', handleOrgChanged);
    return () => {
      window.removeEventListener('header_selected_org_changed', handleOrgChanged);
      window.removeEventListener('storage', handleOrgChanged);
    };
  }, [selectedOrg]);

  // GitHub Projects da Organização
  interface GithubOrgProjectItem {
    id: string;
    number: number;
    title: string;
    url: string;
    shortDescription?: string;
    closed?: boolean;
    updatedAt?: string;
    isCustom?: boolean;
    org?: string;
    repositories?: { nodes: Array<{ id: string; name: string; nameWithOwner: string }> };
  }

  const [githubOrgProjects, setGithubOrgProjects] = useState<GithubOrgProjectItem[]>([]);
  const [selectedGithubProjectNumber, setSelectedGithubProjectNumber] = useState<number | null>(null);
  const [isLoadingGithubProjects, setIsLoadingGithubProjects] = useState(false);
  const [githubProjectDropdownOpen, setGithubProjectDropdownOpen] = useState(false);
  const [githubProjectSearch, setGithubProjectSearch] = useState('');
  const [githubProjectError, setGithubProjectError] = useState<string | null>(null);
  const [isAddCustomProjectModalOpen, setIsAddCustomProjectModalOpen] = useState(false);
  const [customProjectInputTitle, setCustomProjectInputTitle] = useState('');
  const [customProjectInputUrl, setCustomProjectInputUrl] = useState('');
  const [selectedGithubProjectRepos, setSelectedGithubProjectRepos] = useState<Set<string> | null>(null);
  const [isLoadingProjectItems, setIsLoadingProjectItems] = useState(false);
  const [projectV2Columns, setProjectV2Columns] = useState<KanbanColumnDef[] | null>(null);
  const [projectV2StatusFieldId, setProjectV2StatusFieldId] = useState<string | null>(null);
  const [projectV2Id, setProjectV2Id] = useState<string | null>(null);
  const [projectV2Iterations, setProjectV2Iterations] = useState<SprintOption[]>([]);
  const projectV2ItemsMapRef = useRef<Map<string, ProjectV2ItemData>>(new Map());

  const selectedGithubProject = useMemo(() => {
    if (selectedGithubProjectNumber == null) return null;
    return githubOrgProjects.find((p) => p.number === selectedGithubProjectNumber) || null;
  }, [selectedGithubProjectNumber, githubOrgProjects]);

  const filteredGithubOrgProjects = useMemo(() => {
    if (!githubProjectSearch.trim()) return githubOrgProjects;
    const q = githubProjectSearch.toLowerCase().trim();
    return githubOrgProjects.filter((p) => {
      const matchTitle = (p.title || '').toLowerCase().includes(q);
      const matchNumber = String(p.number || '').includes(q);
      const matchDesc = (p.shortDescription || '').toLowerCase().includes(q);
      return matchTitle || matchNumber || matchDesc;
    });
  }, [githubOrgProjects, githubProjectSearch]);

  const loadCustomProjects = useCallback((org: string): GithubOrgProjectItem[] => {
    try {
      const saved = localStorage.getItem(`devflow_custom_projects_${org}`);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }, []);

  const saveCustomProjects = useCallback((org: string, list: GithubOrgProjectItem[]) => {
    try {
      localStorage.setItem(`devflow_custom_projects_${org}`, JSON.stringify(list));
    } catch {}
  }, []);

  const fetchGithubProjectsForOrg = useCallback(async (org: string) => {
    setIsLoadingGithubProjects(true);
    setGithubProjectError(null);
    const customList = loadCustomProjects(org);
    try {
      if (window.electronAPI?.github?.fetchOrgProjects) {
        const res = await window.electronAPI.github.fetchOrgProjects(org);
        if (res.success && Array.isArray(res.projects)) {
          const apiProjects: GithubOrgProjectItem[] = res.projects;
          const merged = [...apiProjects];
          for (const c of customList) {
            if (!merged.some((p) => p.number === c.number || p.id === c.id)) {
              merged.push(c);
            }
          }
          setGithubOrgProjects(merged);
          return;
        }
        if (res.error) {
          if (res.error.includes('read:project') || res.error.includes('INSUFFICIENT_SCOPES')) {
            setGithubProjectError('O token precisa do escopo "read:project" para listar projects automaticamente.');
          } else {
            setGithubProjectError(res.error);
          }
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('read:project') || err?.message?.includes('INSUFFICIENT_SCOPES')) {
        setGithubProjectError('O token precisa do escopo "read:project" para listar projects automaticamente.');
      } else if (err?.message?.includes('No handler registered')) {
        setGithubProjectError('Reinicie o aplicativo para aplicar o manipulador de Projects.');
      } else {
        setGithubProjectError(err?.message || 'Erro ao carregar projects');
      }
    } finally {
      setIsLoadingGithubProjects(false);
    }
    setGithubOrgProjects(customList);
  }, [loadCustomProjects]);

  useEffect(() => {
    fetchGithubProjectsForOrg(selectedOrg);
    setSelectedGithubProjectNumber(null);
  }, [selectedOrg, fetchGithubProjectsForOrg]);

  // Carrega os repositórios vinculados ao Project selecionado e suas colunas/itens/sprints
  useEffect(() => {
    if (selectedGithubProjectNumber == null) {
      setSelectedGithubProjectRepos(null);
      setProjectV2Columns(null);
      setProjectV2StatusFieldId(null);
      setProjectV2Id(null);
      setProjectV2Iterations([]);
      projectV2ItemsMapRef.current.clear();
      return;
    }
    let isCancelled = false;
    const loadItems = async () => {
      setIsLoadingProjectItems(true);
      try {
        if (window.electronAPI?.github?.fetchProjectItems) {
          const selectedProjItem = githubOrgProjects.find((p) => p.number === selectedGithubProjectNumber);
          const effectiveOrg = (selectedOrg && selectedOrg !== 'Todas' && selectedOrg !== 'all')
            ? selectedOrg
            : (selectedProjItem?.org || undefined);
          const res = await window.electronAPI.github.fetchProjectItems(selectedGithubProjectNumber, effectiveOrg);
          if (!isCancelled && res.success && res.project) {
            const { columns, statusFieldId, projectId, itemsMap } = extractProjectV2ColumnsAndItems(res.project);
            if (columns.length > 0) {
              setProjectV2Columns(columns);
            } else {
              setProjectV2Columns(null);
            }
            setProjectV2StatusFieldId(statusFieldId);
            setProjectV2Id(projectId);
            projectV2ItemsMapRef.current = itemsMap;

            // Extrai as iterações (Sprints) reais do Project V2 do GitHub
            const projectIts = extractProjectIterations([res.project]);
            setProjectV2Iterations(projectIts);

            const repoSet = new Set<string>();
            for (const r of res.project.repositories?.nodes || []) {
              if (r.nameWithOwner) repoSet.add(r.nameWithOwner.toLowerCase());
            }
            for (const item of res.project.items?.nodes || []) {
              const repoNameWithOwner = item.content?.repository?.nameWithOwner;
              if (repoNameWithOwner) {
                repoSet.add(repoNameWithOwner.toLowerCase());
              }
            }
            if (repoSet.size > 0) {
              setSelectedGithubProjectRepos(repoSet);
            } else {
              setSelectedGithubProjectRepos(null);
            }

            // Atualiza imediatamente as issues em cache com os dados do Project V2 e vincula sprints
            setRepoDetailsCache((prev) => {
              let hasChanges = false;
              const nextCache = { ...prev };
              for (const key of Object.keys(nextCache)) {
                const entry = nextCache[key];
                if (!entry) continue;

                // Atualiza issues com iterationId e iterationTitle
                let newIssues = entry.issues;
                if (entry.issues?.length) {
                  newIssues = entry.issues.map((iss) => {
                    const itData = iss.githubNumber ? itemsMap.get(`${key.toLowerCase()}#${iss.githubNumber}`) : undefined;
                    if (itData) {
                      hasChanges = true;
                      return {
                        ...iss,
                        projectV2ItemId: itData.itemId,
                        projectV2Status: itData.statusName || iss.projectV2Status,
                        projectV2StatusOptionId: itData.statusOptionId || iss.projectV2StatusOptionId,
                        projectV2Estimate: itData.estimate ?? iss.projectV2Estimate,
                        iterationId: itData.iterationId || iss.iterationId,
                        iterationTitle: itData.iterationTitle || iss.iterationTitle,
                      };
                    }
                    return iss;
                  });
                }

                // Mescla as iterações do Project V2 nas sprints do repositório
                let newSprints = entry.sprints || [];
                if (projectIts.length > 0) {
                  const seen = new Set(newSprints.map((s) => s.iterationId || s.title.toLowerCase().trim()));
                  const additions = projectIts.filter((it) => !seen.has(it.iterationId) && !seen.has(it.title.toLowerCase().trim()));
                  if (additions.length > 0 || newSprints.length === 0) {
                    newSprints = [...projectIts, ...newSprints.filter((s) => !projectIts.some((it) => it.title.toLowerCase().trim() === s.title.toLowerCase().trim()))];
                    hasChanges = true;
                  }
                }

                if (hasChanges) {
                  nextCache[key] = {
                    ...entry,
                    issues: newIssues,
                    sprints: newSprints,
                  };
                }
              }
              return hasChanges ? nextCache : prev;
            });
          }
        }
      } catch {
        if (!isCancelled) {
          setSelectedGithubProjectRepos(null);
          setProjectV2Columns(null);
          setProjectV2Iterations([]);
        }
      } finally {
        if (!isCancelled) setIsLoadingProjectItems(false);
      }
    };
    loadItems();
    return () => { isCancelled = true; };
  }, [selectedGithubProjectNumber, selectedOrg, githubOrgProjects]);

  // Ref e função de rolagem horizontal da prateleira de cards de projetos
  const shelfCardsRef = useRef<HTMLDivElement>(null);
  const [isProjectsShelfCollapsed, setIsProjectsShelfCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('projects_shelf_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  // Durante a animação o conteúdo fica recortado; aberto, volta a overflow visível (dropdowns dos filtros).
  const [isProjectsShelfAnimating, setIsProjectsShelfAnimating] = useState(false);
  const toggleProjectsShelf = useCallback(() => {
    setIsProjectsShelfAnimating(true);
    setIsProjectsShelfCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('projects_shelf_collapsed', String(next));
      } catch {}
      return next;
    });
    window.setTimeout(() => setIsProjectsShelfAnimating(false), 380);
  }, []);
  const scrollShelf = (direction: 'left' | 'right') => {
    if (!shelfCardsRef.current) return;
    const amount = shelfCardsRef.current.clientWidth * 0.75;
    shelfCardsRef.current.scrollBy({
      left: direction === 'left' ? -amount : amount,
      behavior: 'smooth',
    });
  };

  // Menu de opções (...) do card de projeto
  const [activeProjectMenu, setActiveProjectMenu] = useState<{
    card: ProjectCardData;
    anchorRect: { top: number; bottom: number; left: number; right: number };
  } | null>(null);
  const [cloneLoadingRepoId, setCloneLoadingRepoId] = useState<number | string | null>(null);

  // Projetos fixados no topo (Pin)
  const [pinnedProjectFullNames, setPinnedProjectFullNames] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('devflow_pinned_projects');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const togglePinProject = useCallback((fullName: string) => {
    setPinnedProjectFullNames((prev) => {
      const next = prev.includes(fullName) ? prev.filter((n) => n !== fullName) : [fullName, ...prev];
      localStorage.setItem('devflow_pinned_projects', JSON.stringify(next));
      return next;
    });
  }, []);

  // Ícones personalizados dos projetos salvos pelo usuário (sem necessidade de clonar)
  const [customProjectIcons, setCustomProjectIcons] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('devflow_custom_project_icons');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const saveCustomProjectIcon = useCallback((projectKey: string, iconUrlOrData: string) => {
    setCustomProjectIcons((prev) => {
      const next = { ...prev, [projectKey]: iconUrlOrData };
      try {
        localStorage.setItem('devflow_custom_project_icons', JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('devflow_custom_project_icons_changed'));
      } catch {}
      logSystemActivity('projects', 'update_project_icon', projectKey, { hasIcon: true });
      return next;
    });
  }, []);

  const removeCustomProjectIcon = useCallback((projectKey: string) => {
    setCustomProjectIcons((prev) => {
      const next = { ...prev };
      delete next[projectKey];
      try {
        localStorage.setItem('devflow_custom_project_icons', JSON.stringify(next));
        window.dispatchEvent(new CustomEvent('devflow_custom_project_icons_changed'));
      } catch {}
      logSystemActivity('projects', 'remove_project_icon', projectKey);
      return next;
    });
  }, []);

  const [iconModalProject, setIconModalProject] = useState<ProjectCardData | null>(null);


  // Fechar o menu de opções do card ao clicar fora, teclar Escape ou rolar a página
  useEffect(() => {
    if (!activeProjectMenu) return;
    const handleOutsideClick = () => setActiveProjectMenu(null);
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActiveProjectMenu(null);
    };
    const handleScroll = () => setActiveProjectMenu(null);
    window.addEventListener('click', handleOutsideClick);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);
    return () => {
      window.removeEventListener('click', handleOutsideClick);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [activeProjectMenu]);

  // Modal de Resumo Executivo da Sprint com IA
  const [aiSprintSummaryModal, setAiSprintSummaryModal] = useState<{
    isOpen: boolean;
    projectName: string;
    summary: string;
    isLoading: boolean;
  } | null>(null);

  // Dados reais: usuário, repositórios do GitHub, repositórios clonados locais e organizações
  const [currentUser, setCurrentUser] = useState<{ login: string; avatarUrl: string } | null>(
    () => GLOBAL_PROJECTS_CACHE.currentUser
  );
  const [repos, setRepos] = useState<GithubRepoSummary[]>(() => GLOBAL_PROJECTS_CACHE.repos);
  const [localClonedRepos, setLocalClonedRepos] = useState<
    Array<{ dir: string; name: string; repoFullName?: string; remoteUrl?: string }>
  >(() => GLOBAL_PROJECTS_CACHE.localClonedRepos);
  const [orgs, setOrgs] = useState<Array<{ login: string; avatarUrl: string }>>(
    () => GLOBAL_PROJECTS_CACHE.orgs
  );

  // Inicializa isLoadingRepos como false se já temos projetos/repos em cache para exibição instantânea
  const hasCachedProjects = GLOBAL_PROJECTS_CACHE.repos.length > 0 || GLOBAL_PROJECTS_CACHE.localClonedRepos.length > 0;
  const [isLoadingRepos, setIsLoadingRepos] = useState(!hasCachedProjects);
  const [reposError, setReposError] = useState<string | null>(null);

  // Cache de issues/sprints/time por repositório (chave = "owner/repo"), inicializado com cache persistido
  const [repoDetailsCache, _setRepoDetailsCache] = useState<
    Record<
      string,
      { issues: ProjectIssue[]; sprints: SprintOption[]; collaborators: RepoCollaborator[]; isLoading: boolean; error: string | null; fetchedAt?: number }
    >
  >(() => GLOBAL_PROJECTS_CACHE.repoDetailsCache);

  const setRepoDetailsCache: React.Dispatch<
    React.SetStateAction<
      Record<
        string,
        { issues: ProjectIssue[]; sprints: SprintOption[]; collaborators: RepoCollaborator[]; isLoading: boolean; error: string | null; fetchedAt?: number }
      >
    >
  > = useCallback((action) => {
    _setRepoDetailsCache((prev) => {
      const next = typeof action === 'function' ? (action as any)(prev) : action;
      GLOBAL_PROJECTS_CACHE.repoDetailsCache = next;
      persistProjectsCache();
      return next;
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // Se já temos projetos no cache, NÃO bloqueia a UI nem exibe tela de carregamento.
      // Revalida silenciosamente em segundo plano (Stale-While-Revalidate).
      const hasCached = GLOBAL_PROJECTS_CACHE.repos.length > 0 || GLOBAL_PROJECTS_CACHE.localClonedRepos.length > 0;
      if (!hasCached) {
        setIsLoadingRepos(true);
      }
      setReposError(null);
      try {
        let localList: any[] = [];
        if (window.electronAPI?.git?.scanLocalProjects) {
          localList = await window.electronAPI.git.scanLocalProjects();
        } else if (window.electronAPI?.git?.listRepos && workspacePath) {
          localList = await window.electronAPI.git.listRepos(workspacePath);
        }
        if (!cancelled && localList) {
          setLocalClonedRepos(localList);
          GLOBAL_PROJECTS_CACHE.localClonedRepos = localList;
        }

        const [userRes, reposRes, orgsRes] = await Promise.all([
          window.electronAPI?.github?.getUser?.(),
          window.electronAPI?.github?.fetchRepos?.(),
          window.electronAPI?.github?.fetchOrgs?.(),
        ]);
        if (cancelled) return;
        if (userRes?.success && userRes.user) {
          setCurrentUser({ login: userRes.user.login, avatarUrl: userRes.user.avatarUrl });
          GLOBAL_PROJECTS_CACHE.currentUser = { login: userRes.user.login, avatarUrl: userRes.user.avatarUrl };
        }
        if (reposRes?.success && reposRes.repos) {
          setRepos(reposRes.repos);
          GLOBAL_PROJECTS_CACHE.repos = reposRes.repos;
        } else if (!hasCached) {
          setReposError(reposRes?.error || 'Não foi possível carregar seus repositórios do GitHub.');
        }
        if (orgsRes?.success && orgsRes.orgs) {
          setOrgs(orgsRes.orgs);
          GLOBAL_PROJECTS_CACHE.orgs = orgsRes.orgs;
        }
        GLOBAL_PROJECTS_CACHE.lastFetchedAt = Date.now();
        persistProjectsCache();
      } catch (err: any) {
        if (!cancelled && !hasCached) setReposError(err?.message || 'Erro ao carregar dados do GitHub.');
      } finally {
        if (!cancelled) setIsLoadingRepos(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [workspacePath]);

  // Cards da prateleira superior = unificação de repositórios do GitHub, projetos locais e workspace ativa
  const allCards: ProjectCardData[] = useMemo(() => {
    return buildUnifiedProjectCards({
      repos,
      localClonedRepos,
      workspacePath,
      repoDetailsCache,
      orgs,
      currentUser,
      customProjectIcons,
      isEffectiveDark,
    });
  }, [repos, localClonedRepos, workspacePath, repoDetailsCache, orgs, currentUser, customProjectIcons, isEffectiveDark]);

  // Opções do filtro de "linguagem" derivadas dos repositórios reais (substitui as sprints fictícias)
  const sprintFilterOptions = useMemo(() => {
    const langs = Array.from(new Set(allCards.map((r) => r.language).filter(Boolean))) as string[];
    return ['Todas as Linguagens', ...langs.sort()];
  }, [allCards]);

  const selectedProject = useMemo(() => {
    return allCards.find((p) => p.id === selectedCardId) || allCards[0];
  }, [allCards, selectedCardId]);

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
      if (!list.some((existing) => existing.name.toLowerCase() === o.login.toLowerCase())) {
        list.push({ id: o.login, name: o.login, slug: `@${o.login}`, avatarColor: '#0ea5e9', avatarUrl: o.avatarUrl });
      }
    });
    return list;
  }, [orgs, currentUser, accentColor]);

  const hasAutoSelectedRef = useRef(false);
  const lastSyncedHeaderProjectRef = useRef<string>('');

  // Seleciona automaticamente o repositório correspondente ao projeto ativo na header
  useEffect(() => {
    if (allCards.length === 0) return;

    const currentHeaderKey = `${workspacePath || ''}::${repoName || ''}`;
    const isFirstRun = !hasAutoSelectedRef.current;
    const headerProjectChanged = lastSyncedHeaderProjectRef.current !== currentHeaderKey;

    if (isFirstRun || headerProjectChanged) {
      const matchingCard = findMatchingCard(allCards, workspacePath, repoName);
      if (matchingCard) {
        hasAutoSelectedRef.current = true;
        lastSyncedHeaderProjectRef.current = currentHeaderKey;
        // Verifica se o matchingCard pertence à organização atualmente filtrada
        const orgQ = selectedOrg.toLowerCase();
        const cardOwner = (matchingCard.owner || matchingCard.org || '').toLowerCase();
        const cardFullName = (matchingCard.fullName || '').toLowerCase();
        const belongsToSelectedOrg =
          selectedOrg === 'Todas' ||
          selectedOrg === 'all' ||
          cardOwner === orgQ ||
          cardFullName.startsWith(`${orgQ}/`) ||
          ((matchingCard.org || '').toLowerCase() === orgQ);

        if (belongsToSelectedOrg) {
          setSelectedCardId(matchingCard.id);
        } else if (isFirstRun) {
          setSelectedCardId(matchingCard.id);
        }
      } else if (isFirstRun && allCards.length > 0) {
        setSelectedCardId(allCards[0].id);
      }
    }
  }, [allCards, workspacePath, repoName, selectedOrg]);

  // Scroll suave do card selecionado para o campo visual no shelf superior
  useEffect(() => {
    if (selectedCardId === null) return;
    const el = document.getElementById(`project-card-${selectedCardId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  }, [selectedCardId]);

  // Busca as issues (e PRs) reais do repositório selecionado, com cache por repositório
  const fetchRepoDetails = useCallback(async (fullName: string, force = false) => {
    let card = allCards.find((c) => c.fullName === fullName);
    if (!card) card = allCards.find((c) => c.name.toLowerCase() === fullName.toLowerCase() || c.repoName?.toLowerCase() === fullName.toLowerCase());

    let owner = card?.owner;
    let repoName = card?.repoName;
    if (!owner && fullName.includes('/')) {
      const parts = fullName.split('/');
      owner = parts[0];
      repoName = parts[1];
    }
    if (!owner && card?.htmlUrl) {
      const parsed = extractOwnerRepo(card.htmlUrl);
      if (parsed) {
        owner = parsed.owner;
        repoName = parsed.repo;
      }
    }
    if (!owner && currentUser?.login) {
      owner = currentUser.login;
      if (!repoName) repoName = card?.name || fullName;
    }
    if (!owner || !repoName) return;

    // IMPORTANTE: nunca usar a chave "sem dono" (ex: apenas "painel-interno") pra decidir se já
    // tem cache — dois repositórios diferentes (de owners diferentes, ou até o mesmo nome numa
    // org e num fork pessoal) podem compartilhar o mesmo nome curto, e usar essa chave ambígua
    // fazia o app achar que já tinha dados válidos (de OUTRO repo) e nunca buscar as issues reais
    // deste repositório.
    const existing = repoDetailsCache[fullName] || repoDetailsCache[`${owner}/${repoName}`];
    const hasCachedIssues = (existing?.issues?.length || 0) > 0;
    const CACHE_TTL_MS = 5 * 60 * 1000;
    const isFresh = !!existing?.fetchedAt && Date.now() - existing.fetchedAt < CACHE_TTL_MS;

    if (!force && hasCachedIssues && isFresh && !existing?.isLoading && existing?.error === null) {
      return;
    }

    setRepoDetailsCache((prev) => {
      const cur = prev[fullName] || prev[`${owner}/${repoName}`];
      const hasIssues = (cur?.issues?.length || 0) > 0;
      return {
        ...prev,
        [fullName]: {
          issues: cur?.issues || [],
          sprints: cur?.sprints || [],
          collaborators: cur?.collaborators || [],
          isLoading: !hasIssues,
          error: null,
          fetchedAt: cur?.fetchedAt,
        },
        [`${owner}/${repoName}`]: {
          issues: cur?.issues || [],
          sprints: cur?.sprints || [],
          collaborators: cur?.collaborators || [],
          isLoading: !hasIssues,
          error: null,
          fetchedAt: cur?.fetchedAt,
        },
      };
    });

    try {
      const [issuesRes, pullsRes, milestonesRes, collaboratorsRes, repoProjectsRes] = await Promise.allSettled([
        window.electronAPI?.github?.fetchRepoIssues?.(owner, repoName),
        window.electronAPI?.github?.fetchRepoPulls?.(owner, repoName),
        window.electronAPI?.github?.fetchRepoMilestones?.(owner, repoName),
        window.electronAPI?.github?.fetchRepoCollaborators?.(owner, repoName),
        window.electronAPI?.github?.fetchRepoProjects?.(owner, repoName),
      ]);

      const milestonesRaw = milestonesRes.status === 'fulfilled' && milestonesRes.value?.success ? milestonesRes.value.milestones || [] : [];
      const repoProjectsRaw = repoProjectsRes.status === 'fulfilled' && repoProjectsRes.value?.success ? repoProjectsRes.value.projects || [] : [];

      // 1. Projects da organização correspondentes a este repositório.
      const repoBaseName = repoName.toLowerCase();
      const matchedOrgProjects = (githubOrgProjects || []).filter((p) => {
        if (!p) return false;
        if (selectedGithubProjectNumber != null && p.number === selectedGithubProjectNumber) return true;

        const linkedRepos = p.repositories?.nodes;
        if (Array.isArray(linkedRepos)) {
          if (linkedRepos.some((r: any) => (r.nameWithOwner || '').toLowerCase() === fullName.toLowerCase())) return true;
        }

        // Vínculo descoberto pelos itens do Project
        if ((p as any).discoveredRepos && (p as any).discoveredRepos.has(fullName.toLowerCase())) return true;

        // Vínculo por prefixo de repositórios irmãos da mesma organização
        // Ex: se p.repositories tem "appmoove/estancia-bahia-painel-interno", outros repos
        // "appmoove/estancia-bahia-api" ou "appmoove/estancia-bahia-painel-web" são do mesmo Project #90
        if (Array.isArray(linkedRepos) && linkedRepos.length > 0) {
          const pOrg = ((p as any).org || '').toLowerCase();
          const targetOwner = owner.toLowerCase();
          if (!pOrg || pOrg === targetOwner) {
            const hasCommonPrefix = linkedRepos.some((r: any) => {
              const rName = ((r.nameWithOwner || r.name || '').split('/')[1] || r.name || '').toLowerCase();
              const prefixParts = rName.split('-');
              const prefixMatch = prefixParts.length > 1 ? prefixParts.slice(0, 2).join('-') : prefixParts[0];
              return prefixMatch.length >= 4 && repoBaseName.startsWith(prefixMatch);
            });
            if (hasCommonPrefix) return true;
          }
        }

        // Vínculo por slug do título do Project na mesma organização
        // Ex: Project "Estância Bahia" -> "estancia-bahia", vincula "estancia-bahia-api"
        if (p.title) {
          const slug = p.title.toLowerCase()
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
          if (slug.length >= 4 && (repoBaseName.startsWith(slug) || repoBaseName.includes(slug))) {
            const pOrg = ((p as any).org || '').toLowerCase();
            if (!pOrg || pOrg === owner.toLowerCase()) return true;
          }
        }

        return false;
      });

      let allRelevantProjects: any[] = [...repoProjectsRaw];
      for (const op of matchedOrgProjects) {
        if (!allRelevantProjects.some((p) => p.number === op.number || (p.id && op.id && p.id === op.id))) {
          allRelevantProjects.push(op);
        }
      }
      // Project vinculado manualmente nas Configurações tem prioridade sobre a detecção
      const linkedProject = getProjectSettings(fullName).workflow.linkedProject;
      if (linkedProject?.number) {
        const known = [...repoProjectsRaw, ...(githubOrgProjects || [])].find((p: any) => p?.number === linkedProject.number);
        allRelevantProjects = [known || { number: linkedProject.number, title: linkedProject.title }];
      }

      // 2. Extrai iterações/sprints dos projects encontrados
      let issueIterationsMap = new Map<number, { iterationId?: string; iterationTitle?: string }>();
      const projectIterationsList: SprintOption[] = [];

      for (const proj of allRelevantProjects) {
        const its = extractProjectIterations([proj]);
        for (const it of its) {
          if (!projectIterationsList.some((s) => s.iterationId === it.iterationId || s.title.toLowerCase() === it.title.toLowerCase())) {
            projectIterationsList.push(it);
          }
        }

        try {
          if (window.electronAPI?.github?.fetchProjectItems) {
            // Extrai a organização do Project a partir de proj.org ou da URL do project
            const urlOrgMatch = proj.url ? proj.url.match(/github\.com\/orgs\/([^/]+)\/projects/i) : null;
            const projOrg = proj.org || (urlOrgMatch ? urlOrgMatch[1] : undefined);
            const hasSelectedOrg = Boolean(selectedOrg && selectedOrg !== 'Todas' && selectedOrg !== 'all');

            const ownerCandidates = Array.from(
              new Set<string | undefined>([
                projOrg,
                hasSelectedOrg ? selectedOrg : undefined,
                owner,
                undefined,
              ].filter((o, i) => i === 3 || Boolean(o)))
            );

            let itemsRes: { success: boolean; project?: any; error?: string } | null = null;
            for (const candidate of ownerCandidates) {
              const res = await window.electronAPI.github.fetchProjectItems(proj.number, candidate);
              const linked = res?.project?.repositories?.nodes;
              const hasRepoItems = (res?.project?.items?.nodes || []).some(
                (it: any) => (it.content?.repository?.nameWithOwner || '').toLowerCase() === fullName.toLowerCase()
              );
              const linksRepo =
                !Array.isArray(linked) ||
                linked.length === 0 ||
                linked.some((r: any) => (r.nameWithOwner || '').toLowerCase() === fullName.toLowerCase()) ||
                hasRepoItems;

              if (res?.success && res.project && (proj.id ? res.project.id === proj.id : linksRepo || linkedProject?.number === proj.number)) {
                itemsRes = res;
                // Registra repositórios descobertos nos itens para repositórios irmãos
                if (Array.isArray(res.project.items?.nodes)) {
                  for (const it of res.project.items.nodes) {
                    const rName = it.content?.repository?.nameWithOwner;
                    if (rName) {
                      if (!proj.discoveredRepos) proj.discoveredRepos = new Set<string>();
                      proj.discoveredRepos.add(rName.toLowerCase());
                    }
                  }
                }
                break;
              }
            }
            if (itemsRes?.success && itemsRes.project) {
              const moreIts = extractProjectIterations([itemsRes.project]);
              for (const it of moreIts) {
                if (!projectIterationsList.some((s) => s.iterationId === it.iterationId || s.title.toLowerCase() === it.title.toLowerCase())) {
                  projectIterationsList.push(it);
                }
              }
              const map = extractIssueIterationsMap(itemsRes.project.items?.nodes || [], fullName);
              map.forEach((val, key) => issueIterationsMap.set(key, val));

              const v2Details = extractProjectV2ColumnsAndItems(itemsRes.project);
              if (v2Details.columns.length > 0) {
                setProjectV2Columns((curr) => curr || v2Details.columns);
                setProjectV2StatusFieldId((curr) => curr || v2Details.statusFieldId);
                setProjectV2Id((curr) => curr || v2Details.projectId);
              }
              v2Details.itemsMap.forEach((v, k) => {
                projectV2ItemsMapRef.current.set(k, v);
              });
            }
          }
        } catch (err) {
          console.warn('Erro ao carregar itens do project:', err);
        }
      }

      // 3. Sprints customizadas/locais salvas no localStorage para este projeto
      const localCustomSprints: SprintOption[] = (() => {
        try {
          const saved = localStorage.getItem(`devflow_custom_sprints_${fullName}`);
          return saved ? JSON.parse(saved) : [];
        } catch {
          return [];
        }
      })();

      // Mapeamento local de sprints por issue (compatível com a aba de Tarefas da IDE)
      const localSprintMap: Record<number, string> = (() => {
        try {
          const k1 = `devflow_issue_sprints_${repoName}`;
          const k2 = `devflow_issue_sprints_${fullName}`;
          const k3 = 'devflow_issue_sprints';
          const saved = localStorage.getItem(k1) || localStorage.getItem(k2) || localStorage.getItem(k3);
          return saved ? JSON.parse(saved) : {};
        } catch {
          return {};
        }
      })();

      // 4. Obtenção das issues: Estratégia multi-tier idêntica à IDE (App.tsx / ProjectTasksDockTab)
      // Nível 1: GitHub REST API oficial via IPC (fetchRepoIssues)
      let issuesData: any[] =
        issuesRes.status === 'fulfilled' && issuesRes.value?.success && Array.isArray(issuesRes.value.issues)
          ? issuesRes.value.issues
          : [];

      // Nível 2: Fallback Git IPC local (git.getIssues)
      if (issuesData.length === 0 && window.electronAPI?.git?.getIssues) {
        try {
          const targetDir =
            card?.localDir ||
            (workspacePath && workspacePath.toLowerCase().includes(repoName.toLowerCase()) ? workspacePath : undefined);
          if (targetDir) {
            const gitIssues = await window.electronAPI.git.getIssues(targetDir);
            if (Array.isArray(gitIssues) && gitIssues.length > 0) {
              issuesData = gitIssues;
            }
          }
        } catch (err) {
          console.warn('[fetchRepoDetails] git.getIssues fallback error:', err);
        }
      }

      // Nível 3: Fallback gh CLI via terminal local
      if (issuesData.length === 0 && window.electronAPI?.shell?.exec) {
        try {
          const targetDir = card?.localDir || workspacePath;
          if (targetDir) {
            const res = await window.electronAPI.shell.exec(
              'export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"; gh issue list --limit 100 --state all --json number,title,author,updatedAt,createdAt,closedAt,labels,state,milestone,assignees,body,url',
              targetDir
            );
            if (res.exitCode === 0 && res.stdout?.trim()) {
              const parsed = JSON.parse(res.stdout.trim());
              if (Array.isArray(parsed) && parsed.length > 0) {
                issuesData = parsed;
              }
            }
          }
        } catch (err) {
          console.warn('[fetchRepoDetails] gh issue list localDir fallback error:', err);
        }
      }

      // Nível 4: Fallback gh CLI com repositório explícito (--repo <fullName>)
      if (issuesData.length === 0 && window.electronAPI?.shell?.exec) {
        try {
          const repoTarget = (fullName && fullName.includes('/')) ? fullName : `${owner}/${repoName}`;
          const res = await window.electronAPI.shell.exec(
            `export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"; gh issue list --repo ${repoTarget} --limit 100 --state all --json number,title,author,updatedAt,createdAt,closedAt,labels,state,milestone,assignees,body,url`,
            workspacePath || '/tmp'
          );
          if (res.exitCode === 0 && res.stdout?.trim()) {
            const parsed = JSON.parse(res.stdout.trim());
            if (Array.isArray(parsed) && parsed.length > 0) {
              issuesData = parsed;
            }
          }
        } catch (err) {
          console.warn('[fetchRepoDetails] gh issue list --repo fallback error:', err);
        }
      }

      // 5. Fallback de Milestones via gh api se estiver vazio
      let resolvedMilestones: any[] = [...milestonesRaw];
      if (resolvedMilestones.length === 0 && window.electronAPI?.shell?.exec) {
        try {
          const repoTarget = (fullName && fullName.includes('/')) ? fullName : `${owner}/${repoName}`;
          const res = await window.electronAPI.shell.exec(
            `export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"; gh api "repos/${repoTarget}/milestones?state=all&per_page=100"`,
            workspacePath || '/tmp'
          );
          if (res.exitCode === 0 && res.stdout?.trim()) {
            const parsed = JSON.parse(res.stdout.trim());
            if (Array.isArray(parsed) && parsed.length > 0) {
              resolvedMilestones = parsed;
            }
          }
        } catch (err) {
          console.warn('[fetchRepoDetails] gh api milestones error:', err);
        }
      }

      const allProjectIterations = [...projectIterationsList];
      for (const it of projectV2Iterations) {
        if (!allProjectIterations.some((pi) => (pi.iterationId && it.iterationId && pi.iterationId === it.iterationId) || pi.title.toLowerCase().trim() === it.title.toLowerCase().trim())) {
          allProjectIterations.push(it);
        }
      }

      const sprints: SprintOption[] = [
        ...allProjectIterations,
        ...resolvedMilestones
          .filter((m: any) => !allProjectIterations.some((pi) => pi.title.toLowerCase().trim() === m.title.toLowerCase().trim()))
          .map((m: any) => ({
            number: m.number,
            title: m.title,
            state: m.state,
            startDateIso: parseSprintStart(m.description) || (m.created_at ? toIsoDateOnly(m.created_at) : undefined),
            dueDateIso: m.due_on ? toIsoDateOnly(m.due_on) : undefined,
            openIssues: m.open_issues ?? 0,
            closedIssues: m.closed_issues ?? 0,
          })),
        ...localCustomSprints.filter((ls) => !allProjectIterations.some((pi) => pi.title.toLowerCase().trim() === ls.title.toLowerCase().trim())),
      ];

      // Descobre sprints adicionais a partir de localSprintMap, labels das issues ou milestones
      const discoveredSprintTitles = new Set<string>();
      Object.values(localSprintMap).forEach((st) => {
        if (st && typeof st === 'string' && st.trim()) discoveredSprintTitles.add(st.trim());
      });
      issuesData.forEach((gh: any) => {
        const mTitle = typeof gh.milestone === 'string' ? gh.milestone : gh.milestone?.title;
        if (mTitle && typeof mTitle === 'string' && mTitle.trim()) {
          discoveredSprintTitles.add(mTitle.trim());
        }
        if (Array.isArray(gh.labels)) {
          gh.labels.forEach((l: any) => {
            const name = typeof l === 'string' ? l : l?.name;
            if (name && /sprint/i.test(name)) {
              discoveredSprintTitles.add(name.trim());
            }
          });
        }
      });
      discoveredSprintTitles.forEach((st) => {
        if (!sprints.some((sp) => sp.title.toLowerCase() === st.toLowerCase())) {
          sprints.push({
            number: -(sprints.length + 1000),
            isVirtual: true,
            title: st,
            state: 'open',
            openIssues: 0,
            closedIssues: 0,
          });
        }
      });

      // 6. Mapeamento das issues vinculando às iterações e Project V2
      const pulls = pullsRes.status === 'fulfilled' && pullsRes.value?.success ? pullsRes.value.pulls || [] : [];
      const cardId = card?.id || fullName;
      const mapped = issuesData.map((gh: any) => {
        const issue = mapGithubIssueToProjectIssue(gh, cardId, pulls);
        
        // Aplica sprint vinda do localSprintMap se ainda não tiver milestoneTitle
        if (!issue.milestoneTitle) {
          const spTitle =
            localSprintMap[gh.number] ||
            (Array.isArray(gh.labels)
              ? gh.labels
                  .map((l: any) => (typeof l === 'string' ? l : l?.name))
                  .find((n: string) => /sprint/i.test(n || ''))
              : undefined);
          if (spTitle) {
            issue.milestoneTitle = spTitle.trim();
          }
        }

        const itInfo = issueIterationsMap.get(gh.number);
        if (itInfo) {
          issue.iterationId = itInfo.iterationId;
          issue.iterationTitle = itInfo.iterationTitle;
        }

        const v2Data = projectV2ItemsMapRef.current.get(`${fullName.toLowerCase()}#${gh.number}`);
        if (v2Data) {
          issue.projectV2ItemId = v2Data.itemId;
          if (v2Data.statusName) {
            issue.projectV2Status = v2Data.statusName;
            // Mapeamento explícito das Configurações → fallback por nome da coluna
            const mapped = resolveProjectStatus(fullName, v2Data.statusName);
            if (mapped === 'Concluído') issue.status = 'Concluído';
            else if (mapped && String(gh.state || '').toLowerCase() !== 'closed') issue.status = mapped;
          }
          if (v2Data.statusOptionId) issue.projectV2StatusOptionId = v2Data.statusOptionId;
          if (v2Data.estimate != null) issue.projectV2Estimate = v2Data.estimate;
          if (v2Data.iterationId) issue.iterationId = v2Data.iterationId;
          if (v2Data.iterationTitle) issue.iterationTitle = v2Data.iterationTitle;
        }

        return issue;
      });

      // Atualiza contagem de issues em cada sprint descoberta
      sprints.forEach((sp) => {
        const sprintIssues = mapped.filter((i) => issueBelongsToSprint(i, sp));
        if (sprintIssues.length > 0) {
          sp.openIssues = sprintIssues.filter((i) => i.status !== 'Concluído').length;
          sp.closedIssues = sprintIssues.filter((i) => i.status === 'Concluído').length;
        }
      });

      const collaboratorsRaw = collaboratorsRes.status === 'fulfilled' && collaboratorsRes.value?.success ? collaboratorsRes.value.collaborators || [] : [];
      const collaborators: RepoCollaborator[] = collaboratorsRaw.map((c: any) => ({
        login: c.login,
        avatarUrl: c.avatar_url,
        htmlUrl: c.html_url,
        contributions: c.contributions,
      }));

      setRepoDetailsCache((prev) => {
        // Não grava mais na chave "sem dono" (bare repoName) — ela é ambígua entre repos de
        // owners diferentes com o mesmo nome curto e causava vazamento de issues de um repo pro outro.
        const next = {
          ...prev,
          [fullName]: { issues: mapped, sprints, collaborators, isLoading: false, error: null, fetchedAt: Date.now() },
          [`${owner}/${repoName}`]: { issues: mapped, sprints, collaborators, isLoading: false, error: null, fetchedAt: Date.now() },
        };
        GLOBAL_PROJECTS_CACHE.repoDetailsCache = next;
        persistProjectsCache();
        return next;
      });
    } catch (err: any) {
      setRepoDetailsCache((prev) => {
        const cur = prev[fullName] || prev[`${owner}/${repoName}`];
        return {
          ...prev,
          [fullName]: { issues: cur?.issues || [], sprints: cur?.sprints || [], collaborators: cur?.collaborators || [], isLoading: false, error: err?.message || 'Erro ao buscar dados do repositório.' },
          [`${owner}/${repoName}`]: { issues: cur?.issues || [], sprints: cur?.sprints || [], collaborators: cur?.collaborators || [], isLoading: false, error: err?.message || 'Erro ao buscar dados do repositório.' },
        };
      });
    }
  }, [allCards, repoDetailsCache, currentUser, githubOrgProjects, selectedGithubProjectNumber, selectedOrg]);

  const lastSyncedSelectedCardIdRef = useRef<number | string | null>(null);

  useEffect(() => {
    if (selectedCardId === null) {
      lastSyncedSelectedCardIdRef.current = null;
      return;
    }

    const targetProject = allCards.find((c) => c.id === selectedCardId) || selectedProject;
    if (!targetProject) return;
    const fullName = targetProject.fullName || (targetProject.owner && targetProject.repoName ? `${targetProject.owner}/${targetProject.repoName}` : '');
    if (!fullName) return;

    // Sempre que o usuário abre um card na tela de projetos, roda a sincronização com o GitHub
    if (lastSyncedSelectedCardIdRef.current !== selectedCardId) {
      lastSyncedSelectedCardIdRef.current = selectedCardId;
      logSystemActivity('projects', 'open_card_sync_github', targetProject.title || targetProject.name, {
        cardId: selectedCardId,
        fullName,
      });
      fetchRepoDetails(fullName, true);
    } else if (!repoDetailsCache[fullName] || repoDetailsCache[fullName].error) {
      fetchRepoDetails(fullName);
    }
  }, [selectedCardId, selectedProject?.fullName, allCards, repoDetailsCache, fetchRepoDetails]);

  // Ao trocar de card de projeto, reseta a sprint aberta para selecionar a sprint ativa do novo projeto
  useEffect(() => {
    setOpenedSprintId(null);
  }, [selectedCardId]);

  const [sprintDropdownOpen, setSprintDropdownOpen] = useState(false);
  const [statusDropdownOpen, setStatusDropdownOpen] = useState(false);
  const [versionDropdownOpen, setVersionDropdownOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [filterDropdownOpen, setFilterDropdownOpen] = useState(false);

  // Refs e reposicionamento dos dropdowns portados para document.body (imunes a stacking context e overflow)
  const sprintTriggerRef = useRef<HTMLDivElement>(null);
  const sprintDropdownRef = useRef<HTMLDivElement>(null);
  const orgTriggerRef = useRef<HTMLDivElement>(null);
  const orgDropdownRef = useRef<HTMLDivElement>(null);
  const projectTriggerRef = useRef<HTMLDivElement>(null);
  const projectDropdownRef = useRef<HTMLDivElement>(null);
  const statusTriggerRef = useRef<HTMLDivElement>(null);
  const statusDropdownRef = useRef<HTMLDivElement>(null);
  const filterTriggerRef = useRef<HTMLButtonElement>(null);
  const filterDropdownRef = useRef<HTMLDivElement>(null);
  const [, setDropdownRepositionTick] = useState(0);

  useEffect(() => {
    const anyOpen = sprintDropdownOpen || orgDropdownOpen || githubProjectDropdownOpen || statusDropdownOpen || filterDropdownOpen;
    if (!anyOpen) return;

    const handlePointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (sprintTriggerRef.current?.contains(target) || sprintDropdownRef.current?.contains(target)) return;
      if (orgTriggerRef.current?.contains(target) || orgDropdownRef.current?.contains(target)) return;
      if (projectTriggerRef.current?.contains(target) || projectDropdownRef.current?.contains(target)) return;
      if (statusTriggerRef.current?.contains(target) || statusDropdownRef.current?.contains(target)) return;
      if (filterTriggerRef.current?.contains(target) || filterDropdownRef.current?.contains(target)) return;

      setSprintDropdownOpen(false);
      setOrgDropdownOpen(false);
      setGithubProjectDropdownOpen(false);
      setStatusDropdownOpen(false);
      setFilterDropdownOpen(false);
    };

    const handleReposition = () => {
      setDropdownRepositionTick((t) => t + 1);
    };

    document.addEventListener('mousedown', handlePointerDown);
    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [sprintDropdownOpen, orgDropdownOpen, githubProjectDropdownOpen, statusDropdownOpen, filterDropdownOpen]);

  // Estados para as funcionalidades de GitHub
  const [selectedAssignee, setSelectedAssignee] = useState<string | null>(null);
  const [isReleaseNotesModalOpen, setIsReleaseNotesModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [openIssueMenuId, setOpenIssueMenuId] = useState<string | null>(null);
  const [autonomousRuns, setAutonomousRuns] = useState<Record<string, { runId?: string; phase?: string; status: 'running' | 'done' | 'review' | 'failed'; summary?: string }>>({});

  useEffect(() => {
    const unsubscribe = window.electronAPI?.ai?.onOrchestratorEvent?.((event: any) => {
      const issueId = event?.payload?.issueId || event?.issueId;
      if (!issueId) return;
      setAutonomousRuns((current) => {
        if (current[issueId]?.phase === 'cancelled' || current[issueId]?.status === 'failed') {
          return current;
        }
        return {
          ...current,
          [issueId]: { ...current[issueId], phase: event.phase || event.kind, status: 'running' },
        };
      });
    });
    return () => unsubscribe?.();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage((current) => (current === msg ? null : current));
    }, 3200);
  };

  // Sincronização com o GitHub sempre que o usuário abre um card de projeto
  const handleOpenProjectCard = useCallback(
    (card: ProjectCardData, toggle = true) => {
      setSelectedCardId((prev) => {
        const next = toggle ? (prev === card.id ? null : card.id) : card.id;
        if (next !== null) {
          const fullName = card.fullName || (card.owner && card.repoName ? `${card.owner}/${card.repoName}` : '');
          if (fullName) {
            logSystemActivity('projects', 'open_card_sync_github', card.title || card.name, {
              cardId: card.id,
              fullName,
            });
            fetchRepoDetails(fullName, true);
            showToast(`Sincronizando ${card.title || card.name} com o GitHub...`);
          }
        } else {
          logSystemActivity('projects', 'deselect_project_card', card.title || card.name, {
            cardId: card.id,
          });
        }
        return next;
      });
    },
    [fetchRepoDetails]
  );

  const handleSelectProjectById = useCallback(
    (cardId: number | string | null, forceSync = true) => {
      setSelectedCardId(cardId);
      if (cardId !== null && forceSync) {
        const target = allCards.find((c) => c.id === cardId);
        const fullName = target?.fullName || (target?.owner && target?.repoName ? `${target.owner}/${target.repoName}` : '');
        if (fullName) {
          logSystemActivity('projects', 'open_card_sync_github', target?.title || target?.name || 'Projeto', {
            cardId,
            fullName,
          });
          fetchRepoDetails(fullName, true);
          showToast(`Sincronizando ${target?.title || target?.name || 'projeto'} com o GitHub...`);
        }
      }
    },
    [allCards, fetchRepoDetails]
  );

  // Sincronização com o GitHub e registro no fluxo de logs ao abrir um card de tarefa/issue
  const handleOpenIssueCardDetail = useCallback(
    (issue: ProjectIssue) => {
      setActiveSidesheetIssue(issue);
      const projName = selectedProject?.title || selectedProject?.name || issue.repoName || 'repositório';
      logSystemActivity('projects', 'open_issue_card_sync', projName, {
        issueId: issue.id,
        githubNumber: issue.githubNumber,
        title: issue.title,
      });
      if (selectedProject?.fullName) {
        fetchRepoDetails(selectedProject.fullName, true);
      }
    },
    [selectedProject?.title, selectedProject?.name, selectedProject?.fullName, fetchRepoDetails]
  );

  const handleAutonomousRun = async (issue: ProjectIssue) => {
    const cwd = localStorage.getItem('ide_workspace_path');
    if (!cwd) {
      showToast('Abra um workspace antes de executar a tarefa autonomamente.');
      return;
    }
    const configuredProvider = localStorage.getItem('ide_ai_provider') || 'claude';
    const provider = configuredProvider === 'codex' ? 'codex' : configuredProvider === 'agy' || configuredProvider === 'antigravity' ? 'antigravity' : 'claude';
    const configuredProjectNumber = Number(localStorage.getItem('ide_github_project_number') || '');
    const runId = crypto.randomUUID();
    setAutonomousRuns((current) => ({ ...current, [issue.id]: { runId, status: 'running', phase: 'planning' } }));
    const result = await window.electronAPI?.ai?.autonomousRun?.({
      runId,
      provider,
      cwd,
      title: issue.title,
      description: `${issue.description || ''}\nGitHub: ${issue.htmlUrl || issue.id}`,
      taskId: issue.id,
      projectNumber: Number.isFinite(configuredProjectNumber) && configuredProjectNumber > 0 ? configuredProjectNumber : undefined,
    });
    if (!result) return;
    setAutonomousRuns((current) => {
      if (current[issue.id]?.phase === 'cancelled') {
        return current;
      }
      return {
        ...current,
        [issue.id]: {
          runId: result.runId,
          status: result.status,
          phase: result.status === 'done' ? 'completed' : 'review',
          summary: result.summary,
        },
      };
    });
    showToast(result.status === 'done' ? `Tarefa concluída: ${issue.title}` : `Tarefa enviada para revisão: ${issue.title}`);
  };

  const handleAutonomousCancel = async (issue: ProjectIssue) => {
    const runId = autonomousRuns[issue.id]?.runId;
    if (!runId) return;
    await window.electronAPI?.ai?.cancelAutonomous?.(runId);
    setAutonomousRuns((current) => ({ ...current, [issue.id]: { ...current[issue.id], status: 'review', phase: 'cancelled' } }));
    showToast('Execução autônoma cancelada.');
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
  const [viewMode, setViewMode] = useState<'timeline' | 'kanban' | 'spreadsheet' | 'gantt' | 'roadmap'>('timeline');

  // Zoom da Timeline: define quantos dias reais são exibidos, sempre incluindo hoje
  const [timelineZoom, setTimelineZoom] = useState<'week' | 'twoWeeks' | 'month'>('twoWeeks');

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

  // Visualização padrão configurada por projeto (Configurações → Geral)
  useEffect(() => {
    if (!selectedProject?.fullName) return;
    setViewMode(getProjectSettings(selectedProject.fullName).prefs.defaultView);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject?.fullName]);

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

  // Estados e utilitários para a visualização de Gráfico de Gantt
  const [ganttRangeDays, setGanttRangeDays] = useState<number>(45);
  const [ganttOffsetDays, setGanttOffsetDays] = useState<number>(-7);
  const [hoveredGanttTaskId, setHoveredGanttTaskId] = useState<string | null>(null);

  const ganttLeftRef = useRef<HTMLDivElement>(null);
  const ganttRightRef = useRef<HTMLDivElement>(null);
  const isGanttSyncingScroll = useRef(false);

  const handleGanttLeftScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isGanttSyncingScroll.current) return;
    isGanttSyncingScroll.current = true;
    if (ganttRightRef.current) {
      ganttRightRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    requestAnimationFrame(() => {
      isGanttSyncingScroll.current = false;
    });
  }, []);

  const handleGanttRightScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    if (isGanttSyncingScroll.current) return;
    isGanttSyncingScroll.current = true;
    if (ganttLeftRef.current) {
      ganttLeftRef.current.scrollTop = e.currentTarget.scrollTop;
    }
    requestAnimationFrame(() => {
      isGanttSyncingScroll.current = false;
    });
  }, []);

  const ganttDays = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    base.setDate(base.getDate() + ganttOffsetDays);
    const days: Date[] = [];
    for (let i = 0; i < ganttRangeDays; i++) {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      days.push(d);
    }
    return days;
  }, [ganttOffsetDays, ganttRangeDays]);

  const ganttMonths = useMemo(() => {
    if (ganttDays.length === 0) return [];
    const list: Array<{ label: string; count: number }> = [];
    let currentLabel = '';
    let currentCount = 0;

    ganttDays.forEach((d) => {
      const label = d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
      if (label !== currentLabel) {
        if (currentCount > 0) {
          list.push({ label: currentLabel, count: currentCount });
        }
        currentLabel = label;
        currentCount = 1;
      } else {
        currentCount++;
      }
    });

    if (currentCount > 0) {
      list.push({ label: currentLabel, count: currentCount });
    }

    return list;
  }, [ganttDays]);

  const getTaskGanttMetrics = (issue: ProjectIssue) => {
    const effectiveStart = issue.startDateIso ? new Date(`${issue.startDateIso}T00:00:00`) : new Date(issue.createdAtIso);
    effectiveStart.setHours(0, 0, 0, 0);

    let effectiveEnd: Date;
    if (issue.dueDateIso) {
      effectiveEnd = new Date(`${issue.dueDateIso}T00:00:00`);
      effectiveEnd.setHours(0, 0, 0, 0);
    } else {
      const days = Math.max(1, issue.durationDays || 1);
      effectiveEnd = new Date(effectiveStart);
      effectiveEnd.setDate(effectiveEnd.getDate() + (days - 1));
    }

    if (effectiveEnd.getTime() < effectiveStart.getTime()) {
      effectiveEnd = new Date(effectiveStart);
    }

    const diasCorridos = Math.max(1, Math.round((effectiveEnd.getTime() - effectiveStart.getTime()) / 86400000) + 1);

    return {
      startDate: effectiveStart,
      endDate: effectiveEnd,
      diasCorridos,
    };
  };

  const getGanttBarCoordinates = (
    issue: ProjectIssue,
    days: Date[],
    colWidth: number
  ) => {
    if (days.length === 0) return null;
    const { startDate, endDate, diasCorridos } = getTaskGanttMetrics(issue);
    const rangeStart = days[0];

    const startOffsetDays = (startDate.getTime() - rangeStart.getTime()) / 86400000;
    const endOffsetDays = (endDate.getTime() - rangeStart.getTime()) / 86400000;

    if (endOffsetDays < 0 || startOffsetDays >= days.length) {
      return {
        isVisible: false,
        isBefore: endOffsetDays < 0,
        isAfter: startOffsetDays >= days.length,
        left: 0,
        width: 0,
        diasCorridos,
        startDate,
        endDate,
      };
    }

    const clampedStart = Math.max(0, startOffsetDays);
    const clampedEnd = Math.min(days.length - 1, endOffsetDays);
    const visibleDays = Math.max(1, clampedEnd - clampedStart + 1);

    const left = clampedStart * colWidth;
    const width = Math.max(colWidth * 0.9, visibleDays * colWidth);

    return {
      isVisible: true,
      isBefore: startOffsetDays < 0,
      isAfter: endOffsetDays >= days.length,
      left,
      width,
      diasCorridos,
      startDate,
      endDate,
    };
  };
  const [taskSearchQuery, setTaskSearchQuery] = useState('');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('Todas');
  const [sortMode, setSortMode] = useState<'default' | 'priority' | 'date'>('default');
  const [isAddTaskModalOpen, setIsAddTaskModalOpen] = useState(false);

  // Estados do Modal de Criação de Issue (Fluxo idêntico ao GitHub: Escolha de Template -> Formulário)
  const [taskModalStep, setTaskModalStep] = useState<'choose_template' | 'fill_form'>('choose_template');
  const [selectedTemplate, setSelectedTemplate] = useState<'bug' | 'feature' | 'blank'>('bug');
  const [isModalMaximized, setIsModalMaximized] = useState(false);
  const [descriptionTab, setDescriptionTab] = useState<'write' | 'preview'>('write');
  const [isCreateMoreChecked, setIsCreateMoreChecked] = useState(false);
  const [isGeneratingAiDescription, setIsGeneratingAiDescription] = useState(false);
  const [selectedTaskLabels, setSelectedTaskLabels] = useState<string[]>(['tipo:fix']);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Campos do formulário de nova tarefa (fluxo inspirado no "Create new issue" do GitHub)
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDescription, setNewTaskDescription] = useState('');
  const [newTaskTag, setNewTaskTag] = useState('Research');
  const [newTaskPriority, setNewTaskPriority] = useState<'Baixa' | 'Média' | 'Alta' | 'Urgente'>('Média');
  const [newTaskStatus, setNewTaskStatus] = useState<'A Fazer' | 'Em Progresso' | 'Concluído'>('Em Progresso');
  const [newTaskMilestoneNumber, setNewTaskMilestoneNumber] = useState<number | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState(false);
  const [issuesViewMode, setIssuesViewMode] = useState<'list' | 'kanban' | 'roadmap'>('list');

  // Edição de tarefa existente (Sidesheet no estilo GitHub)
  const [editingIssue, setEditingIssue] = useState<ProjectIssue | null>(null);
  const [activeSidesheetIssue, setActiveSidesheetIssue] = useState<ProjectIssue | null>(null);
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
  const [newSprintDuration, setNewSprintDuration] = useState<number>(7);
  const [newSprintStartDate, setNewSprintStartDate] = useState(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  });
  const [isCreatingSprint, setIsCreatingSprint] = useState(false);

  // Estado do Modal de Confirmação de Exclusão (Regra: exclusões sempre requerem modal de confirmação)
  const [deleteConfirmState, setDeleteConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    itemDescription?: string;
    confirmLabel?: string;
    isDeleting?: boolean;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Filtragem dinâmica de cards do shelf superior (agora repositórios reais)
  const filteredCards = allCards.filter((card) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchesTitle = card.title.toLowerCase().includes(q);
      const matchesSprint = (card.sprint || card.language || '').toLowerCase().includes(q);
      const matchesBadge = card.badge.toString() === q;
      if (!matchesTitle && !matchesSprint && !matchesBadge) return false;
    }

    if (selectedSprint !== 'Todas as Linguagens') {
      const cardLang = card.language || card.sprint || '';
      if (cardLang.toLowerCase() !== selectedSprint.toLowerCase()) return false;
    }

    if (selectedStatus === 'Em Andamento (<90%)') {
      if (card.percentValue >= 90) return false;
    } else if (selectedStatus === 'Fase Final (≥90%)') {
      if (card.percentValue < 90) return false;
    }

    if (selectedOrg !== 'Todas' && selectedOrg !== 'all') {
      const orgQ = selectedOrg.toLowerCase();
      const cardOwner = (card.owner || card.org || '').toLowerCase();
      const cardFullName = (card.fullName || '').toLowerCase();
      const cardOrg = (card.org || '').toLowerCase();
      const belongsToOrg =
        cardOwner === orgQ ||
        cardFullName.startsWith(`${orgQ}/`) ||
        cardOrg === orgQ;

      if (!belongsToOrg) return false;
    }

    if (selectedGithubProjectNumber != null && selectedGithubProjectRepos && selectedGithubProjectRepos.size > 0) {
      const match = (card.fullName && selectedGithubProjectRepos.has(card.fullName.toLowerCase())) ||
                    (card.repoName && Array.from(selectedGithubProjectRepos).some((r) => r.endsWith(`/${card.repoName.toLowerCase()}`)));
      if (!match) return false;
    }

    return true;
  }).sort((a, b) => {
    const aPinned = a.fullName && pinnedProjectFullNames.includes(a.fullName);
    const bPinned = b.fullName && pinnedProjectFullNames.includes(b.fullName);
    if (aPinned && !bPinned) return -1;
    if (!aPinned && bPinned) return 1;
    return 0;
  });

  // Ordenação personalizada para a visualização em tabela ao clicar no cabeçalho das colunas
  const sortedTableCards = useMemo(() => {
    if (!tableSortField) return filteredCards;

    return [...filteredCards].sort((a, b) => {
      let comparison = 0;

      switch (tableSortField) {
        case 'index': {
          const aBadge = a.badge != null ? a.badge : filteredCards.findIndex((c) => c.id === a.id);
          const bBadge = b.badge != null ? b.badge : filteredCards.findIndex((c) => c.id === b.id);
          comparison = aBadge - bBadge;
          break;
        }
        case 'project': {
          const aTitle = (a.title || a.name || a.repoName || '').toLowerCase();
          const bTitle = (b.title || b.name || b.repoName || '').toLowerCase();
          comparison = aTitle.localeCompare(bTitle, 'pt-BR');
          break;
        }
        case 'language': {
          const aLang = (a.language || a.sprint || '').toLowerCase();
          const bLang = (b.language || b.sprint || '').toLowerCase();
          comparison = aLang.localeCompare(bLang, 'pt-BR');
          break;
        }
        case 'progress': {
          const aTotal = a.issuesDone + a.issuesInProgress + a.issuesOpen;
          const aPercent = aTotal > 0 ? Math.round((a.issuesDone / aTotal) * 100) : (a.percentValue ?? 0);
          const bTotal = b.issuesDone + b.issuesInProgress + b.issuesOpen;
          const bPercent = bTotal > 0 ? Math.round((b.issuesDone / bTotal) * 100) : (b.percentValue ?? 0);
          comparison = aPercent - bPercent;
          break;
        }
        case 'done': {
          comparison = (a.issuesDone || 0) - (b.issuesDone || 0);
          break;
        }
        case 'inProgress': {
          comparison = (a.issuesInProgress || 0) - (b.issuesInProgress || 0);
          break;
        }
        case 'open': {
          comparison = (a.issuesOpen || 0) - (b.issuesOpen || 0);
          break;
        }
        case 'health': {
          const getHealth = (card: ProjectCardData) => {
            const total = card.issuesDone + card.issuesInProgress + card.issuesOpen;
            const percent = total > 0 ? Math.round((card.issuesDone / total) * 100) : (card.percentValue ?? 0);
            const cached =
              repoDetailsCache[card.fullName || ''] ||
              (card.owner && card.repoName ? repoDetailsCache[`${card.owner}/${card.repoName}`] : undefined) ||
              repoDetailsCache[card.name || ''] ||
              repoDetailsCache[card.title || ''] ||
              Object.entries(repoDetailsCache).find(
                ([k]) => k.toLowerCase() === card.fullName?.toLowerCase() || (card.repoName && k.toLowerCase().endsWith(`/${card.repoName.toLowerCase()}`))
              )?.[1];
            const issues = cached?.issues || [];
            return computeProjectHealthScore(issues, card.issuesDone, card.issuesInProgress, total, percent);
          };
          comparison = getHealth(a) - getHealth(b);
          break;
        }
        case 'updatedAt': {
          const aTime = a.updatedAtIso ? new Date(a.updatedAtIso).getTime() : 0;
          const bTime = b.updatedAtIso ? new Date(b.updatedAtIso).getTime() : 0;
          comparison = aTime - bTime;
          break;
        }
      }

      return tableSortDirection === 'asc' ? comparison : -comparison;
    });
  }, [filteredCards, tableSortField, tableSortDirection, repoDetailsCache]);

  // Se o card selecionado atualmente não for nulo e não estiver visível nos cards filtrados (ex: mudou organização),
  // seleciona automaticamente o primeiro card da lista filtrada para carregar tarefas, issues e roadmap do projeto
  useEffect(() => {
    if (selectedCardId === null || filteredCards.length === 0) return;
    const isCurrentStillVisible = filteredCards.some((c) => c.id === selectedCardId);
    if (!isCurrentStillVisible) {
      setSelectedCardId(filteredCards[0].id);
    }
  }, [filteredCards, selectedCardId]);

  // Carrega em background os detalhes (sprints e issues) dos cards filtrados para exibir a sprint e dias restantes
  useEffect(() => {
    const toFetch = filteredCards
      .filter((c) => c.fullName && (!repoDetailsCache[c.fullName] || repoDetailsCache[c.fullName].error))
      .slice(0, 10);

    if (toFetch.length === 0) return;

    let cancelled = false;
    const timer = setTimeout(async () => {
      for (const card of toFetch) {
        if (cancelled) break;
        if (card.fullName) {
          await fetchRepoDetails(card.fullName);
        }
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [filteredCards, repoDetailsCache, fetchRepoDetails]);

  const selectedRepoDetail = useMemo(() => {
    if (!selectedProject) return undefined;
    if (selectedProject.fullName && repoDetailsCache[selectedProject.fullName]) {
      return repoDetailsCache[selectedProject.fullName];
    }
    const altKey = selectedProject.owner && selectedProject.repoName ? `${selectedProject.owner}/${selectedProject.repoName}` : undefined;
    if (altKey && repoDetailsCache[altKey]) {
      return repoDetailsCache[altKey];
    }
    const matchedKey = Object.keys(repoDetailsCache).find(
      (k) => k.toLowerCase() === selectedProject.name.toLowerCase() ||
             (selectedProject.repoName && k.toLowerCase().endsWith(`/${selectedProject.repoName.toLowerCase()}`))
    );
    return matchedKey ? repoDetailsCache[matchedKey] : undefined;
  }, [selectedProject, repoDetailsCache]);

  // Card correspondente ao projeto atualmente ativo na workspace/header
  const activeWorkspaceMatchingCard = useMemo(() => {
    return findMatchingCard(allCards, workspacePath, repoName);
  }, [allCards, workspacePath, repoName]);
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

  const handleAddCustomLink = (linkData?: { label: string; url: string; category?: any; description?: string; [key: string]: any }) => {
    if (!selectedProject?.fullName) return;
    const key = selectedProject.fullName;
    const label = linkData?.label ?? newLinkLabel.trim();
    const url = linkData?.url ?? newLinkUrl.trim();
    if (!label || !url) return;
    const entry = {
      id: `${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      label,
      url,
      ...(linkData || {}),
    };
    persistCustomLinks({ ...customLinks, [key]: [...(customLinks[key] || []), entry] });
    setNewLinkLabel('');
    setNewLinkUrl('');
  };

  const handleRemoveCustomLink = (id: string) => {
    if (!selectedProject?.fullName) return;
    const key = selectedProject.fullName;
    const link = (customLinks[key] || []).find((l) => l.id === id);
    const linkLabel = link?.label || 'este link';
    setDeleteConfirmState({
      isOpen: true,
      title: 'Remover Link',
      message: `Tem certeza que deseja remover o link "${linkLabel}"?`,
      itemDescription: 'O atalho será desvinculado deste projeto.',
      confirmLabel: 'Remover Link',
      onConfirm: () => {
        persistCustomLinks({ ...customLinks, [key]: (customLinks[key] || []).filter((l) => l.id !== id) });
        setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }));
        showToast('Link removido.');
      },
    });
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
    setTaskModalStep('choose_template');
    setSelectedTemplate('bug');
    setDescriptionTab('write');
    setIsGeneratingAiDescription(false);
    setSelectedTaskLabels(['tipo:fix']);
  };

  const openAddTaskModal = (initialTemplate?: 'bug' | 'feature' | 'blank') => {
    resetNewTaskForm();
    applyIssueTemplate(initialTemplate || 'blank');
    setIsAddTaskModalOpen(true);
  };

  const applyIssueTemplate = (template: 'bug' | 'feature' | 'blank') => {
    setSelectedTemplate(template);
    if (template === 'bug') {
      setNewTaskTitle('[bug] ');
      setNewTaskTag('QA');
      setNewTaskPriority('Alta');
      setSelectedTaskLabels(['tipo:fix']);
      setNewTaskDescription(`### Descrição do Defeito
Descreva o problema de forma clara e objetiva.

### Passos para Reproduzir
1. Acessar '...'
2. Clicar em '...'
3. Notar o comportamento incorreto

### Comportamento Esperado
O que deveria ter acontecido normalmente.

### Ambiente / Informações Adicionais
- Plataforma: Desktop (Electron) / Web
- Logs ou observações:
`);
    } else if (template === 'feature') {
      setNewTaskTitle('[feature] ');
      setNewTaskTag('Frontend');
      setNewTaskPriority('Média');
      setSelectedTaskLabels(['tipo:feature']);
      setNewTaskDescription(`### Objetivo da Tarefa
Descreva o propósito e valor de negócio desta funcionalidade.

### Critérios de Aceite
- [ ] Implementação da interface e fluxos de usuário
- [ ] Validação de dados e integração com API
- [ ] Testes funcionais e tratamento de erros

### Notas Técnicas
Arquitetura, componentes ou dependências envolvidas.
`);
    } else {
      setNewTaskTitle('');
      setNewTaskTag('Research');
      setNewTaskPriority('Média');
      setSelectedTaskLabels(['tipo:task']);
      setNewTaskDescription('');
    }
    setTaskModalStep('fill_form');
  };

  const insertMarkdown = (before: string, after: string = '') => {
    const el = textareaRef.current;
    if (!el) {
      setNewTaskDescription((prev) => prev + before + after);
      return;
    }
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = el.value;
    const selectedText = val.substring(start, end) || 'texto';
    const replacement = before + selectedText + after;
    const newVal = val.substring(0, start) + replacement + val.substring(end);
    setNewTaskDescription(newVal);
    setTimeout(() => {
      el.focus();
      el.setSelectionRange(start + before.length, start + before.length + selectedText.length);
    }, 10);
  };

  const handleGenerateAiDescription = async () => {
    const titleClean = newTaskTitle.replace(/^\[(bug|feature)\]\s*/i, '').trim();
    if (!titleClean) {
      showToast('Digite um título para a issue antes de gerar a descrição com IA.');
      return;
    }

    const projectAi = getProjectSettings(selectedProject?.fullName).ai;
    const activeProvider = AI_PROVIDERS.find((p) => p.id === (projectAi.providerId || localAiProvider)) || AI_PROVIDERS[0];
    const effectiveModel = projectAi.model || (projectAi.providerId && projectAi.providerId !== localAiProvider ? undefined : localAiModel);
    setIsGeneratingAiDescription(true);
    showToast(`Gerando descrição com ${activeProvider.name} (${effectiveModel || 'padrão'})...`);

    const prompt = `${projectAi.contextNotes.trim() ? `Contexto do projeto:\n${projectAi.contextNotes.trim()}\n\n` : ''}Gere uma descrição profissional e detalhada em Markdown para uma issue no GitHub.
Tipo: ${selectedTemplate === 'bug' ? 'Bug / Defeito' : selectedTemplate === 'feature' ? 'Feature / Tarefa de Sprint' : 'Tarefa'}
Título: "${newTaskTitle}"
Repositório: "${selectedProject?.fullName || selectedProject?.title || 'DevFlow'}"

Retorne EXCLUSIVAMENTE o conteúdo em Markdown no formato:
${selectedTemplate === 'bug' ? `
### Descrição do Defeito
(Explicação clara do problema e impacto no sistema)

### Passos para Reproduzir
1. (Passo detalhado)
2. (Passo detalhado)
3. (Observar o erro)

### Comportamento Esperado vs Observado
- **Esperado:** ...
- **Observado:** ...

### Critérios de Correção
- [ ] Investigação da causa raiz
- [ ] Correção aplicada e validada
- [ ] Teste de regressão adicionado
` : `
### Objetivo da Tarefa
(Visão geral e contexto da funcionalidade)

### Escopo & Requisitos
- (Requisitos técnicos e de negócio)

### Critérios de Aceite
- [ ] Interface e fluxos validados
- [ ] Integração com serviços backend
- [ ] Testes automatizados e sem regressões

### Notas Técnicas
(Módulos, endpoints ou componentes envolvidos)
`}
Não inclua saudações nem blocos explicativos adicionais fora da estrutura Markdown.`;

    try {
      let generated = '';
      if (window.electronAPI?.ai?.runCli && activeProvider.cliCommand) {
        try {
          const res = await window.electronAPI.ai.runCli({
            cliCmd: activeProvider.cliCommand,
            prompt,
            model: effectiveModel,
            cwd: (selectedProject as any)?.path,
          });
          const out = res?.stdout?.trim() || '';
          const isErrorOutput =
            res?.exitCode !== 0 ||
            out.includes("There's an issue with the selected model") ||
            out.includes('[claude-code:unrecognized_model]') ||
            out.startsWith('Error:');

          if (out && !isErrorOutput) {
            generated = out;
          }
        } catch (cliErr) {
          console.warn('CLI runCli fallback:', cliErr);
        }

        // Se falhou (ex: parâmetro de modelo incompatível), tenta novamente com o modelo padrão nativo do CLI
        if (!generated) {
          try {
            const retryRes = await window.electronAPI.ai.runCli({
              cliCmd: activeProvider.cliCommand,
              prompt,
              model: undefined,
              cwd: (selectedProject as any)?.path,
            });
            const retryOut = retryRes?.stdout?.trim() || '';
            const isRetryError =
              retryRes?.exitCode !== 0 ||
              retryOut.includes("There's an issue with the selected model") ||
              retryOut.includes('[claude-code:unrecognized_model]') ||
              retryOut.startsWith('Error:');

            if (retryOut && !isRetryError) {
              generated = retryOut;
            }
          } catch (retryErr) {
            console.warn('CLI retry fallback:', retryErr);
          }
        }
      }

      if (!generated && window.electronAPI?.ai?.prompt) {
        try {
          const pRes = await window.electronAPI.ai.prompt(prompt, activeProvider.id, (selectedProject as any)?.path);
          if (pRes?.response && pRes.response.trim()) {
            generated = pRes.response.trim();
          }
        } catch (promptErr) {
          console.warn('ai:prompt fallback:', promptErr);
        }
      }

      if (!generated) {
        if (selectedTemplate === 'bug') {
          generated = `### Descrição do Defeito\nIdentificada falha em "${titleClean}" que afeta a estabilidade ou comportamento esperado no módulo \`${selectedProject?.title || 'DevFlow'}\`.\n\n### Passos para Reproduzir\n1. Acessar o fluxo principal do projeto \`${selectedProject?.title || 'DevFlow'}\`\n2. Realizar a ação correspondente a "${titleClean}"\n3. Observar a interrupção ou retorno inadequado\n\n### Comportamento Esperado vs Observado\n- **Esperado:** Ação processada normalmente sem falhas ou exceções.\n- **Observado:** Divergência de comportamento ou mensagem de erro.\n\n### Critérios de Correção\n- [ ] Investigação da causa raiz\n- [ ] Aplicação de correção defensiva\n- [ ] Validação em ambiente de homologação`;
        } else {
          generated = `### Objetivo da Tarefa\nImplementar a funcionalidade "${titleClean}" agregando valor ao fluxo de trabalho e respeitando os padrões de arquitetura vigentes.\n\n### Escopo & Requisitos\n- Desenvolvimento dos componentes e serviços necessários para "${titleClean}".\n- Integração com a camada de dados e tratamento adequado de erros e estados vazios.\n- Alinhamento com design tokens e diretrizes de acessibilidade.\n\n### Critérios de Aceite\n- [ ] Fluxo principal funcional e testado ponta a ponta\n- [ ] Tratamento defensivo de exceções e feedbacks ao usuário\n- [ ] Branch de feature criada e pronta para revisão (PR)\n\n### Notas Técnicas\n- Repositório: \`${selectedProject?.fullName || selectedProject?.title || 'Principal'}\`\n- Fase: Desenvolvimento e Qualidade`;
        }
      }

      setNewTaskDescription(generated);
      showToast(`Descrição gerada com sucesso pela IA (${activeProvider.name} · ${effectiveModel || 'padrão'})!`);
    } catch (err: any) {
      showToast('Erro ao comunicar com a IA.');
    } finally {
      setIsGeneratingAiDescription(false);
    }
  };

  // =========================================================================
  // ESTADOS E FILTROS PARA A TELA DE ISSUES (PADRÃO GITHUB COM DESIGN NATIVO)
  // =========================================================================
  const [issuesSidebarTab, setIssuesSidebarTab] = useState<
    'all' | 'assigned' | 'created' | 'mentioned' | 'recent' | 'views' | 'projects' | 'milestones' | 'labels'
  >('all');
  const [issuesStateFilter, setIssuesStateFilter] = useState<'all' | 'open' | 'closed'>('all');
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
  const [sampleIssuesList, setSampleIssuesList] = useState<ProjectIssue[]>([]);

  // Issues combinadas: usa issues reais do repositório selecionado se existirem,
  // ou os dados realistas de exemplo do GitHub da captura de tela enviada pelo usuário
  const combinedGithubIssues = useMemo(() => {
    if (rawProjectIssues && rawProjectIssues.length > 0) {
      return rawProjectIssues;
    }
    return sampleIssuesList;
  }, [rawProjectIssues, sampleIssuesList]);

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

    // Filtro por Estado (all vs open vs closed)
    if (issuesStateFilter === 'open') {
      list = list.filter((i) => i.rawState !== 'closed' && i.status !== 'Concluído');
    } else if (issuesStateFilter === 'closed') {
      list = list.filter((i) => i.rawState === 'closed' || i.status === 'Concluído');
    }

    // Filtro por Tab da Sidebar
    const me = (currentUser?.login || '').toLowerCase();
    if (issuesSidebarTab === 'assigned') {
      list = me ? list.filter((i) => i.assignees.some((a) => a.name.toLowerCase().includes(me))) : list;
    } else if (issuesSidebarTab === 'created') {
      list = me ? list.filter((i) => (i.author || '').toLowerCase().includes(me)) : list;
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
  const [customSprintsList, setCustomSprintsList] = useState<GithubSprintItem[]>([]);
  const [hoveredSprintRowId, setHoveredSprintRowId] = useState<string | null>(null);

  // Detalhe de uma sprint aberta: lista de tarefas + visualização lista/calendário/issues
  const [openedSprintId, setOpenedSprintId] = useState<string | null>(null);
  const [sprintDetailViewMode, setSprintDetailViewMode] = useState<'list' | 'issues' | 'calendar' | 'roadmap' | 'kanban'>('issues');
  const [isEditingSprintDates, setIsEditingSprintDates] = useState(false);
  const [editSprintStartDate, setEditSprintStartDate] = useState('');
  const [editSprintDueDate, setEditSprintDueDate] = useState('');
  const [isSavingSprintDates, setIsSavingSprintDates] = useState(false);
  const [isAddExistingTaskOpen, setIsAddExistingTaskOpen] = useState(false);
  const [sprintCalendarMonthOffset, setSprintCalendarMonthOffset] = useState(0);

  // Calendário vertical e filtros de sprints
  const [verticalCalendarDate, setVerticalCalendarDate] = useState(() => new Date());
  const [selectedCalendarDayIso, setSelectedCalendarDayIso] = useState<string | null>(null);
  const [sprintSidebarFilter, setSprintSidebarFilter] = useState<'all' | 'active' | 'completed'>('all');

  // Estado de expansão das issues com sub-issues
  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(new Set());
  const toggleIssueExpanded = useCallback((issueId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  }, []);

  // Mapa de todas as issues do projeto para lookup rápido por githubNumber
  const allIssuesMap = useMemo(() => {
    const map = new Map<number, ProjectIssue>();
    (rawProjectIssues || []).forEach((i) => {
      if (i.githubNumber) map.set(i.githubNumber, i);
    });
    return map;
  }, [rawProjectIssues]);

  // Conjunto de IDs de issues que são filhas (sub-issues) de outra issue existente
  const childIssueIdSet = useMemo(() => {
    const set = new Set<string>();
    (rawProjectIssues || []).forEach((issue) => {
      const subs = extractSubIssuesForIssue(issue, allIssuesMap);
      subs.forEach((s) => {
        if (s.linkedIssue) set.add(s.linkedIssue.id);
      });
    });
    return set;
  }, [rawProjectIssues, allIssuesMap]);

  // Alternar checkbox de checklist de sub-issue dentro da descrição da issue pai
  const handleToggleChecklistSubIssue = useCallback(
    async (parentTask: ProjectIssue, lineIndex: number, currentlyCompleted: boolean) => {
      if (!parentTask.description) return;
      const lines = parentTask.description.split('\n');
      if (lineIndex < 0 || lineIndex >= lines.length) return;
      const targetLine = lines[lineIndex];
      const nextCheck = currentlyCompleted ? ' ' : 'x';
      lines[lineIndex] = targetLine.replace(/\[([ xX])\]/, `[${nextCheck}]`);
      const newDescription = lines.join('\n');

      setSampleIssuesList((prev) =>
        prev.map((i) => (i.id === parentTask.id ? { ...i, description: newDescription } : i))
      );

      const card = allCards.find((c) => c.id === parentTask.projectId);
      if (card?.owner && card?.repoName && parentTask.githubNumber) {
        try {
          await window.electronAPI?.github?.updateIssue?.(card.owner, card.repoName, parentTask.githubNumber, {
            body: newDescription,
          });
          const fullName = card.fullName || `${card.owner}/${card.repoName}`;
          setRepoDetailsCache((prev) => {
            if (!prev[fullName]) return prev;
            return {
              ...prev,
              [fullName]: {
                ...prev[fullName],
                issues: (prev[fullName].issues || []).map((i) =>
                  i.id === parentTask.id ? { ...i, description: newDescription } : i
                ),
              },
            };
          });
          showToast(currentlyCompleted ? 'Sub-issue reaberta.' : 'Sub-issue concluída!');
        } catch (err: any) {
          showToast(err?.message || 'Erro ao sincronizar sub-issue no GitHub.');
        }
      }
    },
    [allCards, showToast]
  );

  const combinedSprints = useMemo<GithubSprintItem[]>(() => {
    const list: GithubSprintItem[] = [];
    const sourceSprints: SprintOption[] = [];
    const seenIds = new Set<string>();
    const seenTitles = new Set<string>();

    // 1. Sprints/Iterações do Project V2 ativo (quando filtrado por Project ou vinculadas)
    if (projectV2Iterations && projectV2Iterations.length > 0) {
      for (const it of projectV2Iterations) {
        sourceSprints.push(it);
        if (it.iterationId) seenIds.add(it.iterationId);
        if (it.title) seenTitles.add(it.title.toLowerCase().trim());
      }
    }

    // 2. Sprints/Marcos do repositório selecionado (caso existam marcos locais não duplicados)
    if (sprintsForSelectedRepo && sprintsForSelectedRepo.length > 0) {
      for (const sp of sprintsForSelectedRepo) {
        const titleKey = (sp.title || '').toLowerCase().trim();
        if (sp.iterationId && seenIds.has(sp.iterationId)) continue;
        if (titleKey && seenTitles.has(titleKey)) continue;
        sourceSprints.push(sp);
        if (sp.iterationId) seenIds.add(sp.iterationId);
        if (titleKey) seenTitles.add(titleKey);
      }
    }

    if (sourceSprints.length > 0) {
      const todayIso = new Date().toISOString().slice(0, 10);
      sourceSprints.forEach((sp) => {
        const isClosed = sp.state === 'closed';
        const isPlanned = !isClosed && sp.startDateIso && sp.startDateIso > todayIso;
        const isCurrent = !isClosed && !isPlanned;
        const status: GithubSprintItem['status'] = isClosed ? 'Completed' : isCurrent ? 'Current' : 'Planned';
        const startFmt = sp.startDateIso ? formatShortDate(sp.startDateIso) : '';
        const dueFmt = sp.dueDateIso ? formatShortDate(sp.dueDateIso) : '';
        const dateRangeLabel =
          startFmt && dueFmt ? `${startFmt} - ${dueFmt}` : startFmt || dueFmt || 'Em andamento';
        list.push({
          id: sp.iterationId ? `iteration-${sp.iterationId}` : `sprint-${sp.number}`,
          number: sp.number,
          title: sp.title,
          durationLabel: sp.durationLabel || 'Sprint',
          startDateIso: sp.startDateIso || '',
          dueDateIso: sp.dueDateIso || '',
          dateRangeLabel,
          status,
          iterationId: sp.iterationId,
          isProjectIteration: sp.isProjectIteration,
          isVirtual: sp.isVirtual,
          projectId: sp.projectId,
          iterationFieldId: sp.iterationFieldId,
        });
      });
    }

    if (customSprintsList && customSprintsList.length > 0) {
      list.push(...customSprintsList);
    }

    // Se houver tarefas sem sprint associada OU se o repositório não tiver nenhum marco/sprint,
    // disponibilizamos a seção de tarefas do projeto para que nenhuma tarefa fique oculta
    const unassignedTasks = rawProjectIssues.filter(
      (i) => (i.milestoneNumber == null || i.milestoneNumber === 0) && !i.iterationId && !i.iterationTitle
    );
    if (unassignedTasks.length > 0 || list.length === 0) {
      const title = list.length === 0 ? 'Tarefas do Projeto' : 'Backlog Geral';
      const backlogItem: GithubSprintItem = {
        id: 'sprint-backlog',
        number: -1,
        title,
        durationLabel: 'Geral',
        startDateIso: '',
        dueDateIso: '',
        dateRangeLabel: `${unassignedTasks.length} tarefa${unassignedTasks.length === 1 ? '' : 's'}${list.length > 0 ? ' sem sprint' : ''}`,
        status: list.length === 0 ? 'Current' : 'Planned',
      };
      if (list.length === 0) {
        list.unshift(backlogItem);
      } else {
        list.push(backlogItem);
      }
    }

    return list;
  }, [projectV2Iterations, sprintsForSelectedRepo, customSprintsList, rawProjectIssues]);

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
    const sprint = combinedSprints.find((s) => s.id === sprintId);
    const sprintTitle = sprint?.title || 'esta sprint';
    setDeleteConfirmState({
      isOpen: true,
      title: 'Excluir Sprint',
      message: `Tem certeza que deseja excluir a sprint "${sprintTitle}"?`,
      itemDescription: 'Esta iteração será removida da lista de sprints.',
      confirmLabel: 'Excluir Sprint',
      onConfirm: () => {
        setCustomSprintsList((prev) => prev.filter((s) => s.id !== sprintId));
        if (sprint && sprint.id === openedSprintId) {
          const remaining = combinedSprints.filter((s) => s.id !== sprintId);
          if (remaining.length > 0) {
            setOpenedSprintId(remaining[0].id);
          } else {
            setOpenedSprintId(null);
          }
        }
        setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }));
        showToast('Iteração/Sprint removida.');
      },
    });
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
      if (isCreateMoreChecked) {
        setNewTaskTitle(selectedTemplate === 'bug' ? '[bug] ' : selectedTemplate === 'feature' ? '[feature] ' : '');
        setNewTaskDescription('');
      } else {
        setIsAddTaskModalOpen(false);
        resetNewTaskForm();
      }
    } catch (err: any) {
      showToast(err?.message || 'Erro ao criar a tarefa no GitHub.');
    } finally {
      setIsCreatingTask(false);
    }
  };

  const handleToggleIssueStatus = async (issueId: string) => {
    const card = selectedProject;
    const issue = rawProjectIssues.find((i) => i.id === issueId) || sampleIssuesList.find((i) => i.id === issueId);
    if (!issue) return;

    const nextStatus: 'A Fazer' | 'Em Progresso' | 'Concluído' =
      issue.status === 'A Fazer' ? 'Em Progresso' : issue.status === 'Em Progresso' ? 'Concluído' : 'A Fazer';
    const nextLabels = (issue.rawLabels || []).filter((l) => !isProgressLabel(l));
    if (nextStatus === 'Em Progresso') nextLabels.push(IN_PROGRESS_LABEL.name);
    const nextState: 'open' | 'closed' = nextStatus === 'Concluído' ? 'closed' : 'open';

    setSampleIssuesList((prev) =>
      prev.map((i) =>
        i.id === issueId
          ? {
              ...i,
              status: nextStatus,
              progress: nextStatus === 'Concluído' ? 100 : nextStatus === 'Em Progresso' ? 50 : 0,
              rawLabels: nextLabels,
              rawState: nextState,
            }
          : i
      )
    );

    if (card && card.owner && card.repoName && card.fullName && issue.githubNumber != null && rawProjectIssues.some((i) => i.id === issueId)) {
      const fullName = card.fullName;
      const owner = card.owner;
      const repoName = card.repoName;

      // Atualização otimista da UI no cache do repositório
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
        showToast(err?.message || 'Erro ao atualizar a tarefa.');
      }
    }
  };

  const handleMoveIssueToColumn = async (issueId: string, targetColumnId: string) => {
    const card = selectedProject;
    const issue = rawProjectIssues.find((i) => i.id === issueId) || sampleIssuesList.find((i) => i.id === issueId);
    if (!issue) return;

    const targetCol = (projectV2Columns || []).find((c) => c.id === targetColumnId || c.optionId === targetColumnId);

    let nextStatus: 'A Fazer' | 'Em Progresso' | 'Concluído' = 'A Fazer';
    let nextLabels = (issue.rawLabels || []).filter(
      (l) => !isProgressLabel(l) && !['backlog'].includes(l.toLowerCase())
    );
    let nextState: 'open' | 'closed' = 'open';

    if (targetCol) {
      if (targetCol.isDoneType) {
        nextStatus = 'Concluído';
        nextState = 'closed';
      } else {
        const titleLower = targetCol.title.toLowerCase();
        if (titleLower.includes('progress') || titleLower.includes('andamento') || titleLower.includes('desenvolvimento') || titleLower.includes('fazendo')) {
          nextStatus = 'Em Progresso';
          nextLabels.push(IN_PROGRESS_LABEL.name);
          nextState = 'open';
        } else if (titleLower.includes('test') || titleLower.includes('review') || titleLower.includes('revisão') || titleLower.includes('qa')) {
          nextStatus = 'Em Progresso';
          nextLabels.push('test');
          nextState = 'open';
        } else {
          nextStatus = 'A Fazer';
          nextState = 'open';
        }
      }
    } else {
      if (targetColumnId === 'done') {
        nextStatus = 'Concluído';
        nextState = 'closed';
      } else if (targetColumnId === 'in_progress') {
        nextStatus = 'Em Progresso';
        nextLabels.push(IN_PROGRESS_LABEL.name);
        nextState = 'open';
      } else if (targetColumnId === 'test') {
        nextStatus = 'Em Progresso';
        nextLabels.push('test');
        nextState = 'open';
      } else if (targetColumnId === 'backlog') {
        nextStatus = 'A Fazer';
        nextLabels.push('backlog');
        nextState = 'open';
      } else {
        // todo
        nextStatus = 'A Fazer';
        nextState = 'open';
      }
    }

    setSampleIssuesList((prev) =>
      prev.map((i) =>
        i.id === issueId
          ? {
              ...i,
              status: nextStatus,
              progress: nextStatus === 'Concluído' ? 100 : nextStatus === 'Em Progresso' ? 50 : 0,
              rawLabels: nextLabels,
              rawState: nextState,
              kanbanColumnId: targetColumnId,
              projectV2Status: targetCol?.title || i.projectV2Status,
              projectV2StatusOptionId: targetCol?.optionId || i.projectV2StatusOptionId,
            }
          : i
      )
    );

    if (card && card.owner && card.repoName && card.fullName && issue.githubNumber != null && rawProjectIssues.some((i) => i.id === issueId)) {
      const fullName = card.fullName;
      const owner = card.owner;
      const repoName = card.repoName;

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
                    rawState: nextState,
                    kanbanColumnId: targetColumnId,
                    projectV2Status: targetCol?.title || i.projectV2Status,
                    projectV2StatusOptionId: targetCol?.optionId || i.projectV2StatusOptionId,
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

      // Se a tarefa pertencer a um GitHub Projects V2 e a coluna tiver optionId, sincroniza via GraphQL
      const activeProjId = projectV2Id;
      const activeStatusFieldId = projectV2StatusFieldId;
      const projectItemId =
        issue.projectV2ItemId ||
        projectV2ItemsMapRef.current.get(`${card.fullName.toLowerCase()}#${issue.githubNumber}`)?.itemId;

      if (activeProjId && activeStatusFieldId && targetCol?.optionId && projectItemId) {
        try {
          if (window.electronAPI?.github?.updateProjectItemStatus) {
            await window.electronAPI.github.updateProjectItemStatus(
              activeProjId,
              projectItemId,
              activeStatusFieldId,
              targetCol.optionId
            );
          }
        } catch (v2Err) {
          console.error('Falha ao atualizar status no GitHub Projects V2:', v2Err);
        }
      }

      // Sincroniza estado e labels na issue do repositório
      try {
        await window.electronAPI?.github?.updateIssue?.(owner, repoName, issue.githubNumber, {
          state: nextState,
          labels: nextLabels,
        });
      } catch (err: any) {
        console.error('Falha ao atualizar issue no GitHub:', err);
      }
    }

    const columnLabels: Record<string, string> = {
      backlog: 'Backlog',
      todo: 'To-do',
      in_progress: 'In Progress',
      test: 'Test',
      done: 'Done',
    };
    showToast(`Tarefa movida para "${targetCol ? targetCol.title : (columnLabels[targetColumnId] || targetColumnId)}".`);
  };

  const handleAssignToMe = async (issueId: string) => {
    const card = selectedProject;
    const issue = rawProjectIssues.find((i) => i.id === issueId) || sampleIssuesList.find((i) => i.id === issueId);
    if (!issue) return;
    if (!currentUser?.login) {
      showToast('Faça login com o GitHub para atribuir esta tarefa a você.');
      return;
    }

    const meLogin = currentUser.login;
    const meAvatar = currentUser.avatarUrl;
    const meInitial = meLogin.charAt(0).toUpperCase();
    const newAssignee = { name: meLogin, initial: meInitial, avatarBg: accentColor, avatarUrl: meAvatar };

    // Atualização otimista
    setSampleIssuesList((prev) =>
      prev.map((i) => (i.id === issueId ? { ...i, assignees: [newAssignee] } : i))
    );

    if (card && card.owner && card.repoName && card.fullName) {
      const fullName = card.fullName;
      const owner = card.owner;
      const repoName = card.repoName;

      setRepoDetailsCache((prev) => {
        const list = prev[fullName]?.issues || [];
        return {
          ...prev,
          [fullName]: {
            ...prev[fullName],
            issues: list.map((i) => (i.id === issueId ? { ...i, assignees: [newAssignee] } : i)),
          },
        };
      });

      if (issue.githubNumber != null) {
        try {
          const res = await window.electronAPI?.github?.updateIssue?.(owner, repoName, issue.githubNumber, {
            assignees: [meLogin],
          });
          if (!res?.success) throw new Error(res?.error || 'Falha ao atribuir issue no GitHub.');
          showToast(`Tarefa #${issue.githubNumber} atribuída a @${meLogin}.`);
        } catch (err: any) {
          showToast(err?.message || 'Erro ao atribuir a tarefa no GitHub.');
        }
      } else {
        showToast(`Tarefa atribuída a @${meLogin}.`);
      }
    } else {
      showToast(`Tarefa atribuída a @${meLogin}.`);
    }
  };

  const handleAssignIssue = async (issueId: string, assigneeLogin: string, assigneeAvatar?: string) => {
    const card = selectedProject;
    const issue = rawProjectIssues.find((i) => i.id === issueId) || sampleIssuesList.find((i) => i.id === issueId);
    if (!issue) return;

    const isUnassigning = !assigneeLogin;
    const initial = assigneeLogin ? assigneeLogin.slice(0, 2).toUpperCase() : '';
    const newAssignees = isUnassigning
      ? []
      : [{ name: assigneeLogin, initial, avatarBg: accentColor, avatarUrl: assigneeAvatar }];

    // Atualização otimista
    setSampleIssuesList((prev) =>
      prev.map((i) => (i.id === issueId ? { ...i, assignees: newAssignees } : i))
    );

    if (card && card.owner && card.repoName && card.fullName) {
      const fullName = card.fullName;
      const owner = card.owner;
      const repoName = card.repoName;

      setRepoDetailsCache((prev) => {
        const list = prev[fullName]?.issues || [];
        return {
          ...prev,
          [fullName]: {
            ...prev[fullName],
            issues: list.map((i) => (i.id === issueId ? { ...i, assignees: newAssignees } : i)),
          },
        };
      });

      if (issue.githubNumber != null) {
        try {
          const res = await window.electronAPI?.github?.updateIssue?.(owner, repoName, issue.githubNumber, {
            assignees: isUnassigning ? [] : [assigneeLogin],
          });
          if (!res?.success) throw new Error(res?.error || 'Falha ao atribuir issue no GitHub.');
          showToast(isUnassigning ? `Responsável removido da tarefa #${issue.githubNumber}.` : `Tarefa #${issue.githubNumber} atribuída a @${assigneeLogin}.`);
        } catch (err: any) {
          showToast(err?.message || 'Erro ao atualizar responsável no GitHub.');
        }
      } else {
        showToast(isUnassigning ? 'Responsável removido.' : `Tarefa atribuída a @${assigneeLogin}.`);
      }
    } else {
      showToast(isUnassigning ? 'Responsável removido.' : `Tarefa atribuída a @${assigneeLogin}.`);
    }
  };

  const handleOpenEditIssue = (issue: ProjectIssue) => {
    handleOpenIssueCardDetail(issue);
    setEditingIssue(issue);
    setEditIssueTitle(issue.title);
    setEditIssueDescription(issue.description);
    setEditIssueTag(issue.tag);
    setEditIssuePriority(issue.priority);
    setEditIssueMilestoneNumber(issue.milestoneNumber ?? null);
  };

  const handleSidesheetUpdateIssue = async (
    updatedFields: Partial<ProjectIssue> & {
      rawLabels?: string[];
      state?: 'open' | 'closed';
      milestoneNumber?: number | null;
      assignees?: Array<{ name: string; avatarBg: string; initial: string; avatarUrl?: string }>;
    },
    targetIssue?: ProjectIssue
  ) => {
    const current = targetIssue || activeSidesheetIssue;
    if (!current) return;
    const card = allCards.find((c) => c.id === current.projectId) || selectedProject;
    if (!card || !card.owner || !card.repoName || !card.fullName || current.githubNumber == null) return;

    const fullName = card.fullName;
    const owner = card.owner;
    const repoName = card.repoName;
    const issueNumber = current.githubNumber;

    const newTitle = updatedFields.title ?? current.title;
    const newBody = updatedFields.description ?? current.description;
    const newMilestone = updatedFields.milestoneNumber !== undefined ? updatedFields.milestoneNumber : (current.milestoneNumber ?? null);
    const newState = updatedFields.state ?? (current.status === 'Concluído' ? 'closed' : 'open');
    const newAssignees = updatedFields.assignees ? updatedFields.assignees.map((a) => a.name) : undefined;
    const newLabels = updatedFields.rawLabels ?? current.rawLabels ?? (current.tag ? [current.tag] : []);

    try {
      const res = await window.electronAPI?.github?.updateIssue?.(owner, repoName, issueNumber, {
        title: newTitle,
        body: newBody,
        state: newState,
        milestone: newMilestone,
        assignees: newAssignees,
        labels: newLabels,
      });

      if (!res?.success || !res.issue) {
        throw new Error(res?.error || 'Falha ao atualizar issue no GitHub.');
      }

      // O REST de issues não conhece os campos do Projects V2: preserva sprint/iteration, status e
      // estimate do item — sem isso, qualquer edição no painel jogava a issue pro backlog.
      const fresh = mapGithubIssueToProjectIssue(res.issue, card.id, []);
      const mapped: ProjectIssue = {
        ...fresh,
        iterationId: current.iterationId,
        iterationTitle: current.iterationTitle,
        projectV2ItemId: current.projectV2ItemId,
        projectV2Status: current.projectV2Status,
        projectV2StatusOptionId: current.projectV2StatusOptionId,
        projectV2Estimate: current.projectV2Estimate,
        pullRequest: fresh.pullRequest || current.pullRequest,
      };
      patchIssueInRepoCache(card, current.id, () => mapped);

      if (activeSidesheetIssue?.id === current.id) {
        setActiveSidesheetIssue(mapped);
      }
      showToast('Issue atualizada no GitHub.');
    } catch (err: any) {
      showToast(err?.message || 'Erro ao atualizar a issue no GitHub.');
    }
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

  const handleDeleteIssue = (issue: ProjectIssue) => {
    const card = allCards.find((c) => c.id === issue.projectId) || selectedProject;
    const fullName = card?.fullName || (issue as any).repoFullName;
    if (!fullName) {
      showToast('Não foi possível identificar o repositório da tarefa.');
      return;
    }
    const [owner, repo] = fullName.split('/');
    const issueTitle = issue.title || 'esta tarefa';
    const issueId = issue.id ? `(${issue.id})` : '';

    setDeleteConfirmState({
      isOpen: true,
      title: 'Excluir Tarefa',
      message: `Tem certeza que deseja excluir permanentemente a tarefa "${issueTitle}" ${issueId} no GitHub?`,
      itemDescription: 'Esta ação não poderá ser desfeita e a issue será removida permanentemente do repositório.',
      confirmLabel: 'Excluir Tarefa',
      onConfirm: async () => {
        setDeleteConfirmState((prev) => ({ ...prev, isDeleting: true }));
        try {
          const res = await window.electronAPI?.github?.deleteIssue?.({
            nodeId: issue.nodeId,
            owner,
            repo,
            issueNumber: issue.githubNumber,
          });
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
          showToast(`Tarefa ${issue.id} excluída com sucesso.`);
          setActiveSidesheetIssue(null);
          setDeleteConfirmState((prev) => ({ ...prev, isOpen: false, isDeleting: false }));
        } catch (err: any) {
          setDeleteConfirmState((prev) => ({ ...prev, isDeleting: false }));
          showToast(err?.message || 'Erro ao excluir a issue no GitHub.');
        }
      },
    });
  };

  const handleBatchDeleteIssues = (tasks: ProjectIssue[]) => {
    if (tasks.length === 0) return;
    const count = tasks.length;
    setDeleteConfirmState({
      isOpen: true,
      title: 'Excluir Tarefas Selecionadas',
      message: `Tem certeza que deseja excluir permanentemente as ${count} tarefas selecionadas no GitHub?`,
      itemDescription: 'Esta ação não poderá ser desfeita e todas as tarefas selecionadas serão removidas do repositório.',
      confirmLabel: `Excluir ${count} Tarefa${count > 1 ? 's' : ''}`,
      onConfirm: async () => {
        setDeleteConfirmState((prev) => ({ ...prev, isDeleting: true }));
        let deletedCount = 0;
        for (const task of tasks) {
          const card = allCards.find((c) => c.id === task.projectId) || selectedProject;
          const fullName = card?.fullName || (task as any).repoFullName;
          if (fullName) {
            const [owner, repo] = fullName.split('/');
            try {
              const res = await window.electronAPI?.github?.deleteIssue?.({
                nodeId: task.nodeId,
                owner,
                repo,
                issueNumber: task.githubNumber,
              });
              if (res?.success) {
                setRepoDetailsCache((prev) => ({
                  ...prev,
                  [fullName]: {
                    ...(prev[fullName] || { sprints: [], collaborators: [], isLoading: false, error: null }),
                    issues: (prev[fullName]?.issues || []).filter((i) => i.id !== task.id),
                  },
                }));
                deletedCount++;
              }
            } catch {}
          }
        }
        setDeleteConfirmState((prev) => ({ ...prev, isOpen: false, isDeleting: false }));
        showToast(`${deletedCount} tarefa(s) excluída(s).`);
      },
    });
  };

  const handlePromptRemoveTaskFromSprint = (issue: ProjectIssue) => {
    const taskTitle = issue.title || 'esta tarefa';
    const issueNum = issue.githubNumber ? `#${issue.githubNumber}` : '';
    const sprintTitle = openedSprint?.title || 'sprint';

    setDeleteConfirmState({
      isOpen: true,
      title: 'Desvincular da Sprint',
      message: `Tem certeza que deseja desvincular ${issueNum} "${taskTitle}" da sprint "${sprintTitle}"?`,
      itemDescription: 'A tarefa não será excluída, mas retornará ao backlog / sem sprint.',
      confirmLabel: 'Desvincular da Sprint',
      isDeleting: false,
      onConfirm: async () => {
        setDeleteConfirmState((prev) => ({ ...prev, isDeleting: true }));
        try {
          await handleSetIssueSprint(issue, null);
          setDeleteConfirmState((prev) => ({ ...prev, isOpen: false, isDeleting: false }));
          showToast(`Tarefa desvinculada da sprint "${sprintTitle}".`);
        } catch {
          setDeleteConfirmState((prev) => ({ ...prev, isOpen: false, isDeleting: false }));
        }
      },
    });
  };

  const handlePromptBatchRemoveFromSprint = (tasks: ProjectIssue[]) => {
    if (tasks.length === 0) return;
    const count = tasks.length;
    const sprintTitle = openedSprint?.title || 'sprint';

    setDeleteConfirmState({
      isOpen: true,
      title: 'Desvincular Tarefas da Sprint',
      message: `Deseja desvincular as ${count} tarefas selecionadas da sprint "${sprintTitle}"?`,
      itemDescription: 'Todas as tarefas selecionadas voltarão ao backlog / sem sprint.',
      confirmLabel: `Desvincular ${count} Tarefa${count > 1 ? 's' : ''}`,
      isDeleting: false,
      onConfirm: async () => {
        setDeleteConfirmState((prev) => ({ ...prev, isDeleting: true }));
        let countRemoved = 0;
        for (const t of tasks) {
          try {
            await handleSetIssueSprint(t, null);
            countRemoved++;
          } catch {}
        }
        setDeleteConfirmState((prev) => ({ ...prev, isOpen: false, isDeleting: false }));
        showToast(`${countRemoved} tarefa(s) desvinculada(s) da sprint.`);
      },
    });
  };

  const openCreateSprintModal = (context: 'create' | 'edit') => {
    // Padrões das Configurações → Fluxo de trabalho: duração, dia de início e padrão de nome
    const sprintCfg = getProjectSettings(selectedProject?.fullName).sprint;
    const now = new Date();
    const t = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((sprintCfg.startWeekday - now.getDay() + 7) % 7));
    const startIso = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
    const end = new Date(t.getTime() + (sprintCfg.durationDays - 1) * 86400000);
    const endIso = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, '0')}-${String(end.getDate()).padStart(2, '0')}`;
    const nextNumber = sprintsForSelectedRepo.filter((sp) => /sprint/i.test(sp.title)).length + 1;
    setNewSprintTitle(formatSprintName(sprintCfg.namePattern, nextNumber, startIso, endIso));
    setNewSprintDuration(sprintCfg.durationDays);
    setNewSprintStartDate(startIso);
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
    let sprintNumber = Date.now();
    try {
      const res = await window.electronAPI?.github?.createMilestone?.(owner, repoName, {
        title,
        description,
        due_on: dueDate.toISOString(),
      });
      if (res?.success && res.milestone) {
        sprintNumber = res.milestone.number;
      }
    } catch {
      // Cria localmente se o GitHub falhar ou não tiver permissão
    }

    const sprint: SprintOption = {
      number: sprintNumber,
      title,
      state: 'open',
      startDateIso: newSprintStartDate,
      dueDateIso,
      openIssues: 0,
      closedIssues: 0,
    };

    // Salva localmente para persistência garantida
    try {
      const savedKey = `devflow_custom_sprints_${fullName}`;
      const existing: SprintOption[] = JSON.parse(localStorage.getItem(savedKey) || '[]');
      existing.push(sprint);
      localStorage.setItem(savedKey, JSON.stringify(existing));
    } catch {}

    setRepoDetailsCache((prev) => ({
      ...prev,
      [fullName]: {
        issues: prev[fullName]?.issues || [],
        sprints: [...(prev[fullName]?.sprints || []), sprint],
        collaborators: prev[fullName]?.collaborators || [],
        isLoading: false,
        error: null,
      },
      [`${owner}/${repoName}`]: {
        issues: prev[`${owner}/${repoName}`]?.issues || [],
        sprints: [...(prev[`${owner}/${repoName}`]?.sprints || []), sprint],
        collaborators: prev[`${owner}/${repoName}`]?.collaborators || [],
        isLoading: false,
        error: null,
      },
    }));

    if (sprintCreationContext === 'create') setNewTaskMilestoneNumber(sprint.number);
    if (sprintCreationContext === 'edit') setEditIssueMilestoneNumber(sprint.number);

    setOpenedSprintId(`sprint-${sprint.number}`);
    showToast(`Sprint "${sprint.title}" criada.`);
    setIsCreateSprintModalOpen(false);
    setSprintCreationContext(null);
    setIsCreatingSprint(false);
  };

  // Clonar Repositório Git Localmente
  const handleCloneRepository = async (card: ProjectCardData) => {
    const cloneUrl = card.htmlUrl ? `${card.htmlUrl}.git` : `https://github.com/${card.fullName}.git`;
    if (!cloneUrl) {
      showToast('URL de clone não disponível para este repositório.');
      return;
    }
    try {
      const folderRes = await window.electronAPI?.dialog?.openFolder?.();
      if (!folderRes) return;
      const targetDir = typeof folderRes === 'string' ? folderRes : (folderRes as any)?.path || (folderRes as any)?.folderPath;
      if (!targetDir) return;

      setCloneLoadingRepoId(card.id);
      showToast(`Clonando ${card.title} em ${targetDir}...`);
      const res = await window.electronAPI?.git?.clone?.(cloneUrl, targetDir);
      if (res?.success) {
        showToast(`🎉 Repositório clonado com sucesso em ${res.repoPath || targetDir}!`);
      } else {
        showToast(`Erro ao clonar: ${res?.error || 'Falha no comando git clone'}`);
      }
    } catch (err: any) {
      showToast(`Erro ao clonar: ${err?.message || 'Falha desconhecida'}`);
    } finally {
      setCloneLoadingRepoId(null);
    }
  };

  // Abrir no Terminal do DevFlow ou Terminal do Sistema com o diretório correto
  const handleOpenTerminalForProject = async (card: ProjectCardData) => {
    const targetDir = card.localDir || getProjectSettings(card.fullName).local.path || workspacePath;
    const termCommand = card.fullName ? `echo "📁 Projeto: ${card.title} (${card.fullName})"` : '';
    if (window.electronAPI?.shell?.openInSystemTerminal) {
      await window.electronAPI.shell.openInSystemTerminal(termCommand, targetDir || undefined);
      showToast(`Terminal aberto para ${card.title}${targetDir ? ` em ${targetDir}` : ''}.`);
    } else {
      showToast(`Terminal: ${card.title} pronto para uso.`);
    }
  };

  // Gerar Resumo Executivo da Sprint com IA
  const handleGenerateSprintSummary = async (card: ProjectCardData) => {
    const cached = card.fullName ? repoDetailsCache[card.fullName] : null;
    const issues = cached?.issues || [];
    const total = issues.length;
    const done = issues.filter((i) => i.status === 'Concluído').length;
    const inProg = issues.filter((i) => i.status === 'Em Progresso').length;
    const todo = issues.filter((i) => i.status === 'A Fazer').length;

    setAiSprintSummaryModal({
      isOpen: true,
      projectName: card.title,
      summary: '',
      isLoading: true,
    });

    try {
      const prompt = `Você é um Agile Coach e Scrum Master do DevFlow.
Gere um Resumo Executivo / Daily Briefing profissional e conciso para a equipe sobre o projeto "${card.title}".

Estatísticas Atuais:
- Total de Tarefas: ${total}
- Concluídas: ${done}
- Em Progresso: ${inProg}
- A Fazer: ${todo}
- Progresso Geral: ${card.percentValue}%

Tarefas em Destaque:
${issues.slice(0, 8).map((i) => `- [${i.status}] ${i.title} (Prioridade: ${i.priority})`).join('\n') || 'Nenhuma tarefa detalhada registrada no momento.'}

Formate com seções bem organizadas:
1. 📊 Status Geral & Ritmo da Sprint
2. 🚀 Entregas Recentes e Progresso
3. ⚠️ Pontos de Atenção / Bloqueios Potenciais
4. 🎯 Próximos Passos Imediatos`;

      let summary = '';
      if (window.electronAPI?.ai?.prompt) {
        const res = await window.electronAPI.ai.prompt(prompt, 'gemini-2.5-flash');
        summary = typeof res === 'string' ? res : (res as any)?.response || (res as any)?.text || '';
      }

      if (!summary) {
        summary = `### 📊 Resumo Executivo da Sprint: ${card.title}\n\n` +
          `- **Progresso**: ${card.percentValue}% concluído (${done}/${total} tarefas finalizadas).\n` +
          `- **Ativas**: ${inProg} tarefas em andamento neste momento.\n` +
          `- **Foco**: Priorizar entregas de alta prioridade para garantir o fechamento da sprint dentro do prazo previsto.`;
      }

      setAiSprintSummaryModal({
        isOpen: true,
        projectName: card.title,
        summary,
        isLoading: false,
      });
    } catch (err: any) {
      setAiSprintSummaryModal({
        isOpen: true,
        projectName: card.title,
        summary: 'Erro ao gerar resumo com IA: ' + err.message,
        isLoading: false,
      });
    }
  };

  const openedSprint = useMemo(
    () => combinedSprints.find((s) => s.id === openedSprintId) || null,
    [combinedSprints, openedSprintId]
  );

  const sprintDetailTasks = useMemo(() => {
    if (!openedSprint || openedSprint.number === -1 || (openedSprintId == null && combinedSprints.some((s) => s.number === -1))) {
      return combinedGithubIssues.filter(
        (i) => (!i.milestoneNumber || i.milestoneNumber === 0 || i.milestoneNumber === -1) && !i.iterationId && !i.iterationTitle
      );
    }
    return combinedGithubIssues.filter((i) => issueBelongsToSprint(i, openedSprint));
  }, [combinedGithubIssues, openedSprintId, openedSprint, combinedSprints]);

  const tasksAvailableToAddToSprint = useMemo(() => {
    if (!openedSprint || openedSprint.number === -1) {
      return [];
    }
    const currentDetailTaskIds = new Set(sprintDetailTasks.map((t) => t.id));
    return combinedGithubIssues.filter((i) => !currentDetailTaskIds.has(i.id));
  }, [combinedGithubIssues, openedSprintId, openedSprint, sprintDetailTasks]);

  // Visibilidade e dimensões da barra de sprints e contêiner central da sprint (estilo IDE)
  const [isSprintSidebarVisible, setIsSprintSidebarVisible] = useState<boolean>(() => {
    const saved = localStorage.getItem('sprint_sidebar_visible');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleSprintSidebar = useCallback(() => {
    setIsSprintSidebarVisible((prev) => {
      const next = !prev;
      localStorage.setItem('sprint_sidebar_visible', String(next));
      if (!next) {
        setSelectedCalendarDayIso(null);
      }
      return next;
    });
  }, []);

  const [sprintContentWidth, setSprintContentWidth] = useState<number>(() => {
    const saved = localStorage.getItem('sprint_content_width');
    const parsed = saved ? parseInt(saved, 10) : 1080;
    return Number.isFinite(parsed) && parsed >= 640 && parsed <= 2400 ? parsed : 1080;
  });
  const [isDraggingSprintContent, setIsDraggingSprintContent] = useState(false);

  const startResizeContentRight = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDraggingSprintContent(true);
      document.body.classList.add('resizing-col');

      const startX = e.clientX;
      const startW = sprintContentWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = (moveEvent.clientX - startX) * 2;
        const newW = Math.min(Math.max(startW + delta, 640), Math.max(window.innerWidth - 60, 800));
        setSprintContentWidth(newW);
        localStorage.setItem('sprint_content_width', String(newW));
      };

      const onMouseUp = () => {
        setIsDraggingSprintContent(false);
        document.body.classList.remove('resizing-col');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [sprintContentWidth]
  );

  const startResizeContentLeft = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDraggingSprintContent(true);
      document.body.classList.add('resizing-col');

      const startX = e.clientX;
      const startW = sprintContentWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = (startX - moveEvent.clientX) * 2;
        const newW = Math.min(Math.max(startW + delta, 640), Math.max(window.innerWidth - 60, 800));
        setSprintContentWidth(newW);
        localStorage.setItem('sprint_content_width', String(newW));
      };

      const onMouseUp = () => {
        setIsDraggingSprintContent(false);
        document.body.classList.remove('resizing-col');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [sprintContentWidth]
  );

  // Auto-seleciona a sprint atual/primeira quando estiver na aba de sprints e nenhuma estiver selecionada
  useEffect(() => {
    if (selectedSection === 'sprints' && combinedSprints.length > 0) {
      if (openedSprintId == null || !combinedSprints.some((s) => s.id === openedSprintId)) {
        const currentSprint =
          combinedSprints.find((s) => s.number !== -1 && s.status === 'Current') ||
          combinedSprints.find((s) => s.number !== -1) ||
          combinedSprints[0];
        if (currentSprint) {
          setOpenedSprintId(currentSprint.id);
          if (currentSprint.startDateIso) {
            const d = new Date(`${currentSprint.startDateIso}T00:00:00`);
            if (!Number.isNaN(d.getTime())) {
              setVerticalCalendarDate(new Date(d.getFullYear(), d.getMonth(), 1));
            }
          }
        }
      }
    }
  }, [selectedSection, combinedSprints, openedSprintId]);

  const handleOpenSprintDetail = (sprintId: string) => {
    setOpenedSprintId(sprintId);
    setSelectedCalendarDayIso(null);
    setSprintDetailViewMode('issues');
    setIsEditingSprintDates(false);
    setIsAddExistingTaskOpen(false);
    setSprintCalendarMonthOffset(0);
    const sp = combinedSprints.find((s) => s.id === sprintId);
    if (sp?.startDateIso) {
      const d = new Date(`${sp.startDateIso}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        setVerticalCalendarDate(new Date(d.getFullYear(), d.getMonth(), 1));
      }
    }
  };

  const handleCloseSprintDetail = () => {
    setOpenedSprintId(null);
    setSelectedCalendarDayIso(null);
    setIsEditingSprintDates(false);
    setIsAddExistingTaskOpen(false);
  };

  const handleStartEditSprintDates = () => {
    if (!openedSprint) return;
    const today = new Date().toISOString().slice(0, 10);
    let start = openedSprint.startDateIso;
    let due = openedSprint.dueDateIso;
    if (!start && due) {
      const d = new Date(`${due}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        d.setDate(d.getDate() - 13);
        start = d.toISOString().slice(0, 10);
      }
    }
    if (!due && start) {
      const d = new Date(`${start}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        d.setDate(d.getDate() + 13);
        due = d.toISOString().slice(0, 10);
      }
    }
    if (!start && !due) {
      start = today;
      const d = new Date();
      d.setDate(d.getDate() + 13);
      due = d.toISOString().slice(0, 10);
    }
    setEditSprintStartDate(start || today);
    setEditSprintDueDate(due || today);
    setIsEditingSprintDates(true);
  };

  const handleSaveSprintDates = async () => {
    const card = selectedProject;
    if (!card || !openedSprint || isSavingSprintDates) return;
    if (!editSprintStartDate || !editSprintDueDate) {
      showToast('Informe as datas de início e fim da sprint.');
      return;
    }
    let finalStart = editSprintStartDate;
    let finalDue = editSprintDueDate;
    if (finalStart > finalDue) {
      [finalStart, finalDue] = [finalDue, finalStart];
      setEditSprintStartDate(finalStart);
      setEditSprintDueDate(finalDue);
    }

    const fullName = card.fullName || `${card.owner || ''}/${card.repoName || ''}` || 'local-project';
    const owner = card.owner;
    const repoName = card.repoName;
    const sprintNumber = openedSprint.number;
    // Iterations do Projects V2 têm datas definidas na configuração do campo no GitHub; o "number"
    // delas é derivado do título e não corresponde a nenhum milestone — nunca enviar pra API de milestones.
    const isRealMilestone = !openedSprint.isProjectIteration && !openedSprint.iterationId && !openedSprint.isVirtual;

    setIsSavingSprintDates(true);
    try {
      if (owner && repoName && isRealMilestone && sprintNumber > 0 && window.electronAPI?.github?.updateMilestone) {
        try {
          const description = encodeSprintDescription('Sprint atualizada.', finalStart);
          await window.electronAPI.github.updateMilestone(owner, repoName, sprintNumber, {
            description,
            due_on: new Date(`${finalDue}T12:00:00`).toISOString(),
          });
        } catch (ghErr) {
          console.warn('Não foi possível sincronizar com o GitHub, salvando localmente:', ghErr);
        }
      }

      try {
        const storageKey = `devflow_custom_sprints_${fullName}`;
        const saved = localStorage.getItem(storageKey);
        const list: SprintOption[] = saved ? JSON.parse(saved) : [];
        const existingIdx = list.findIndex((s) => s.number === sprintNumber);
        if (existingIdx >= 0) {
          list[existingIdx] = {
            ...list[existingIdx],
            startDateIso: finalStart,
            dueDateIso: finalDue,
          };
        } else {
          list.push({
            number: sprintNumber,
            title: openedSprint?.title || `Sprint ${sprintNumber}`,
            startDateIso: finalStart,
            dueDateIso: finalDue,
            state: 'open',
            openIssues: 0,
            closedIssues: 0,
          });
        }
        localStorage.setItem(storageKey, JSON.stringify(list));
      } catch (storageErr) {
        console.warn('Erro ao salvar sprint no localStorage:', storageErr);
      }

      setRepoDetailsCache((prev) => {
        const cur = prev[fullName] || {
          issues: [],
          sprints: [],
          collaborators: [],
          isLoading: false,
          error: null,
        };
        const updatedSprints = (cur.sprints || []).map((s) =>
          s.number === sprintNumber ? { ...s, startDateIso: finalStart, dueDateIso: finalDue } : s
        );
        if (!updatedSprints.some((s) => s.number === sprintNumber)) {
          updatedSprints.push({
            number: sprintNumber,
            title: openedSprint?.title || `Sprint ${sprintNumber}`,
            startDateIso: finalStart,
            dueDateIso: finalDue,
            state: 'open',
            openIssues: 0,
            closedIssues: 0,
          });
        }
        return {
          ...prev,
          [fullName]: {
            ...cur,
            sprints: updatedSprints,
          },
        };
      });

      setCustomSprintsList((prev) =>
        prev.map((s) =>
          s.number === sprintNumber ? { ...s, startDateIso: finalStart, dueDateIso: finalDue } : s
        )
      );

      showToast('Datas da sprint atualizadas com sucesso.');
      setIsEditingSprintDates(false);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao atualizar as datas da sprint.');
    } finally {
      setIsSavingSprintDates(false);
    }
  };

  // Handler para atualizar datas de um marco
  const handleUpdateMilestoneDates = async (milestoneNumber: number, startIso: string, dueIso: string) => {
    const card = selectedProject;
    if (!card || !card.owner || !card.repoName) return;
    const { owner, repoName, fullName } = card;

    if (window.electronAPI?.github?.updateMilestone && milestoneNumber > 0) {
      try {
        await window.electronAPI.github.updateMilestone(owner, repoName, milestoneNumber, {
          due_on: dueIso ? new Date(`${dueIso}T12:00:00`).toISOString() : undefined,
        });
      } catch (err) {
        console.warn('Erro ao atualizar marco no GitHub:', err);
      }
    }

    setRepoDetailsCache((prev) => {
      const cur = prev[fullName] || { issues: [], sprints: [], collaborators: [], isLoading: false, error: null };
      return {
        ...prev,
        [fullName]: {
          ...cur,
          sprints: (cur.sprints || []).map((s) =>
            s.number === milestoneNumber ? { ...s, startDateIso: startIso, dueDateIso: dueIso } : s
          ),
        },
      };
    });
  };

  // Alternar estado do marco (Aberto / Concluído)
  const handleToggleMilestoneState = async (milestoneNumber: number, newState: 'open' | 'closed') => {
    const card = selectedProject;
    if (!card || !card.owner || !card.repoName) return;
    const { owner, repoName, fullName } = card;

    if (window.electronAPI?.github?.updateMilestone && milestoneNumber > 0) {
      try {
        await window.electronAPI.github.updateMilestone(owner, repoName, milestoneNumber, {
          state: newState,
        });
      } catch (err) {
        console.warn('Erro ao alternar estado do marco no GitHub:', err);
      }
    }

    // Ao fechar: move as issues abertas para a próxima sprint, se configurado
    if (newState === 'closed' && milestoneNumber > 0 && getProjectSettings(fullName).sprint.carryOver === 'next') {
      const closing = sprintsForSelectedRepo.find((sp) => sp.number === milestoneNumber);
      const next = sprintsForSelectedRepo
        .filter((sp) => sp.state === 'open' && sp.number > 0 && sp.number !== milestoneNumber && !sp.isProjectIteration && !sp.isVirtual)
        .filter((sp) => !closing?.dueDateIso || !sp.dueDateIso || sp.dueDateIso >= closing.dueDateIso)
        .sort((a, b) => (a.dueDateIso || '9999').localeCompare(b.dueDateIso || '9999'))[0];
      const pending = rawProjectIssues.filter((i) => i.milestoneNumber === milestoneNumber && i.status !== 'Concluído' && i.githubNumber);
      if (next && pending.length > 0) {
        let moved = 0;
        for (const iss of pending) {
          try {
            const r = await window.electronAPI?.github?.updateIssue?.(owner, repoName, iss.githubNumber!, { milestone: next.number });
            if (r?.success) moved++;
          } catch {}
        }
        if (moved > 0) {
          showToast(`${moved} issue(s) não concluída(s) movidas para "${next.title}".`);
          fetchRepoDetails(fullName, true);
        }
      } else if (pending.length > 0) {
        showToast(`${pending.length} issue(s) abertas ficaram na sprint fechada — não há próxima sprint aberta.`);
      }
    }

    setRepoDetailsCache((prev) => {
      const cur = prev[fullName] || { issues: [], sprints: [], collaborators: [], isLoading: false, error: null };
      return {
        ...prev,
        [fullName]: {
          ...cur,
          sprints: (cur.sprints || []).map((s) =>
            s.number === milestoneNumber ? { ...s, state: newState } : s
          ),
        },
      };
    });
  };

  // Excluir marco
  const handleDeleteMilestone = async (milestoneNumber: number) => {
    const card = selectedProject;
    if (!card || !card.owner || !card.repoName) return;
    const { owner, repoName, fullName } = card;

    let deletedNatively = false;
    if (window.electronAPI?.github?.deleteMilestone && milestoneNumber > 0) {
      try {
        const res = await window.electronAPI.github.deleteMilestone(owner, repoName, milestoneNumber);
        if (res?.success) deletedNatively = true;
      } catch (err) {
        console.warn('Erro ao deletar marco via IPC:', err);
      }
    }

    if (!deletedNatively && window.electronAPI?.shell?.exec && milestoneNumber > 0) {
      try {
        await window.electronAPI.shell.exec(
          `export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"; gh api --method DELETE "repos/${owner}/${repoName}/milestones/${milestoneNumber}"`,
          workspacePath || '/tmp'
        );
      } catch (err) {
        console.warn('Erro ao deletar marco via gh CLI fallback:', err);
      }
    }

    setRepoDetailsCache((prev) => {
      const cur = prev[fullName] || { issues: [], sprints: [], collaborators: [], isLoading: false, error: null };
      return {
        ...prev,
        [fullName]: {
          ...cur,
          sprints: (cur.sprints || []).filter((s) => s.number !== milestoneNumber),
        },
      };
    });
  };

  // Vincular ou desvincular issue do marco
  const handleAssignIssueToMilestone = async (issueNumber: number, milestoneNumber: number | null) => {
    const card = selectedProject;
    if (!card || !card.owner || !card.repoName) return;
    const { owner, repoName, fullName } = card;

    if (window.electronAPI?.github?.updateIssue) {
      try {
        await window.electronAPI.github.updateIssue(owner, repoName, issueNumber, {
          milestone: milestoneNumber,
        });
      } catch (err) {
        console.warn('Erro ao vincular issue ao marco no GitHub:', err);
      }
    }

    setRepoDetailsCache((prev) => {
      const cur = prev[fullName] || { issues: [], sprints: [], collaborators: [], isLoading: false, error: null };
      return {
        ...prev,
        [fullName]: {
          ...cur,
          issues: (cur.issues || []).map((i) =>
            (i.githubNumber || (i as any).number) === issueNumber
              ? { ...i, milestoneNumber: milestoneNumber ?? undefined }
              : i
          ),
        },
      };
    });
  };

  const patchIssueInRepoCache = (card: ProjectCardData, issueId: string, patch: (i: ProjectIssue) => ProjectIssue) => {
    const keys = Array.from(new Set([card.fullName, card.owner && card.repoName ? `${card.owner}/${card.repoName}` : null].filter(Boolean) as string[]));
    setRepoDetailsCache((prev) => {
      const next = { ...prev };
      keys.forEach((k) => {
        const cur = prev[k];
        if (!cur) return;
        next[k] = { ...cur, issues: cur.issues.map((i) => (i.id === issueId ? patch(i) : i)) };
      });
      return next;
    });
  };

  // Garante que a issue é um item do Project V2 informado e devolve o id do item naquele Project.
  // O projectV2ItemId em cache não serve: quando a issue está em mais de um Project, ele é de um só.
  const resolveProjectItemId = async (card: ProjectCardData, issue: ProjectIssue, projectId: string): Promise<string> => {
    const gh = window.electronAPI?.github;
    if (!gh?.fetchIssueDetails || !gh.addIssueToProject) throw new Error('API do GitHub indisponível.');
    const res = await gh.fetchIssueDetails(card.owner!, card.repoName!, issue.githubNumber!);
    if (!res?.success || !res.details) throw new Error(res?.error || 'Falha ao consultar a issue no GitHub.');
    const existing = res.details.projectItems.find((pi) => pi.project.id === projectId);
    if (existing) return existing.itemId;
    const added = await gh.addIssueToProject(projectId, issue.nodeId || res.details.issue.id);
    if (!added?.success || !added.itemId) throw new Error(added?.error || 'Falha ao adicionar a issue ao Project.');
    return added.itemId;
  };

  const handleSetIssueSprint = async (issue: ProjectIssue, sprintId: string | null) => {
    const targetSprint = sprintId != null ? combinedSprints.find((s) => s.id === sprintId) || null : null;
    const isBacklog = !targetSprint || targetSprint.number === -1;
    const isIterationTarget = !isBacklog && Boolean(targetSprint!.iterationId);
    const isMilestoneTarget = !isBacklog && !isIterationTarget && !targetSprint!.isVirtual && !targetSprint!.isProjectIteration && targetSprint!.number > 0;
    const doneMsg = isBacklog ? 'Tarefa movida para o backlog.' : 'Tarefa adicionada à sprint.';

    const card = allCards.find((c) => c.id === issue.projectId);
    if (!card || !card.owner || !card.repoName || !card.fullName || issue.githubNumber == null) {
      setSampleIssuesList((prev) =>
        prev.map((i) =>
          i.id === issue.id
            ? {
                ...i,
                milestoneNumber: isMilestoneTarget ? targetSprint!.number : isBacklog ? undefined : i.milestoneNumber,
                iterationId: isIterationTarget ? targetSprint!.iterationId : isBacklog ? undefined : i.iterationId,
                iterationTitle: isIterationTarget ? targetSprint!.title : isBacklog ? undefined : i.iterationTitle,
              }
            : i
        )
      );
      showToast(doneMsg);
      return;
    }
    const gh = window.electronAPI?.github;

    try {
      if (isIterationTarget) {
        const sp = targetSprint!;
        if (!sp.projectId || !sp.iterationFieldId || !gh?.updateProjectItemField) {
          throw new Error('Não foi possível identificar o campo de Sprint do Project no GitHub.');
        }
        const itemId = await resolveProjectItemId(card, issue, sp.projectId);
        const res = await gh.updateProjectItemField(sp.projectId, itemId, sp.iterationFieldId, { iterationId: sp.iterationId });
        if (!res?.success) throw new Error(res?.error || 'Falha ao atualizar a sprint no GitHub.');
        patchIssueInRepoCache(card, issue.id, (i) => ({ ...i, iterationId: sp.iterationId, iterationTitle: sp.title, projectV2ItemId: itemId }));
      } else if (isMilestoneTarget) {
        const res = await gh?.updateIssue?.(card.owner, card.repoName, issue.githubNumber, { milestone: targetSprint!.number });
        if (!res?.success || !res.issue) throw new Error(res?.error || 'Falha ao atualizar a tarefa no GitHub.');
        const mapped = mapGithubIssueToProjectIssue(res.issue, card.id, []);
        patchIssueInRepoCache(card, issue.id, (i) => ({ ...i, milestoneNumber: mapped.milestoneNumber, milestoneTitle: mapped.milestoneTitle, startDateIso: mapped.startDateIso, dueDateIso: mapped.dueDateIso }));
      } else if (isBacklog) {
        // Remove a issue da sprint em que ela realmente está, em cada sistema (iteration e/ou milestone).
        if (issue.iterationId) {
          const currentIteration = combinedSprints.find((s) => s.iterationId === issue.iterationId);
          if (currentIteration?.projectId && currentIteration.iterationFieldId && gh?.clearProjectItemField) {
            const itemId = await resolveProjectItemId(card, issue, currentIteration.projectId);
            const res = await gh.clearProjectItemField(currentIteration.projectId, itemId, currentIteration.iterationFieldId);
            if (!res?.success) throw new Error(res?.error || 'Falha ao remover a sprint no GitHub.');
          }
        }
        if (issue.milestoneNumber != null && issue.milestoneNumber > 0) {
          const res = await gh?.updateIssue?.(card.owner, card.repoName, issue.githubNumber, { milestone: null });
          if (!res?.success) throw new Error(res?.error || 'Falha ao remover o milestone no GitHub.');
        }
        patchIssueInRepoCache(card, issue.id, (i) => ({ ...i, milestoneNumber: undefined, milestoneTitle: undefined, iterationId: undefined, iterationTitle: undefined }));
      } else {
        // Sprint "virtual" (sem milestone nem iteration reais no GitHub): só existe localmente.
        patchIssueInRepoCache(card, issue.id, (i) => ({ ...i, milestoneTitle: targetSprint!.title }));
      }
      showToast(doneMsg);
    } catch (err: any) {
      showToast(err?.message || 'Erro ao atualizar a tarefa no GitHub.');
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
        padding: isGridMode
          ? 'clamp(28px, 3.5vh, 44px) clamp(16px, 2vw, 28px) 32px clamp(16px, 2vw, 28px)'
          : 5,
        background: theme.bgApp,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'center',
        overflowX: 'hidden',
        overflowY: isGridMode ? 'auto' : 'hidden',
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
        if (githubProjectDropdownOpen) setGithubProjectDropdownOpen(false);
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
          justifyContent: 'flex-start',
          gap: isGridMode ? 16 : 5,
          boxSizing: 'border-box',
          margin: isGridMode ? '0 auto' : '0 auto',
          flex: 1,
          minHeight: 0,
          height: '100%',
          overflow: isGridMode ? undefined : 'hidden',
        }}
      >
        {/* Cabeçalho de Controles e Filtros */}
        <div
          style={{
            position: 'relative',
            zIndex: 100,
            width: isGridMode ? 'calc(100% - 48px)' : '100%',
            maxWidth: isGridMode ? 1860 : '100%',
            alignSelf: isGridMode ? 'center' : 'stretch',
            flexShrink: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: isGridMode ? 10 : 6,
            padding: isGridMode ? '0 4px' : '0 clamp(11px, calc(2vw - 5px), 23px)',
            border: 'none',
            boxSizing: 'border-box',
            transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
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
            {/* Título "Projetos" com contador */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
              }}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleProjectsShelf();
                }}
                title={isProjectsShelfCollapsed ? 'Exibir filtros e projetos' : 'Ocultar filtros e projetos'}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  width: 26,
                  height: 26,
                  marginRight: -4,
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: theme.textSecondary,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <ChevronDown
                  size={18}
                  style={{
                    transform: isProjectsShelfCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)',
                    transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
                  }}
                />
              </button>
              <span
                style={{
                  fontSize: 26,
                  fontWeight: 500,
                  color: theme.textPrimary,
                  letterSpacing: '-0.02em',
                  lineHeight: 1.1,
                }}
              >
                Projetos
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: theme.textSecondary,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  padding: '2px 8px',
                  borderRadius: 10,
                }}
                title={`Total: ${filteredCards.length} projeto(s)`}
              >
                {filteredCards.length}
              </span>
            </div>
          </div>

          <div
            style={{
              position: 'relative',
              zIndex: (sprintDropdownOpen || orgDropdownOpen || githubProjectDropdownOpen || statusDropdownOpen) ? 1000 : 50,
              display: 'grid',
              gridTemplateRows: isProjectsShelfCollapsed ? '0fr' : '1fr',
              opacity: isProjectsShelfCollapsed ? 0 : 1,
              transform: isProjectsShelfCollapsed ? 'translateY(-6px)' : undefined,
              marginTop: isProjectsShelfCollapsed ? (isGridMode ? -10 : -6) : 0,
              transition: 'grid-template-rows 0.35s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.25s ease, transform 0.35s cubic-bezier(0.16, 1, 0.3, 1), margin-top 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
              pointerEvents: isProjectsShelfCollapsed ? 'none' : 'auto',
            }}
          >
          <div style={{ minHeight: 0, overflow: (!sprintDropdownOpen && !orgDropdownOpen && !githubProjectDropdownOpen && !statusDropdownOpen && (isProjectsShelfCollapsed || isProjectsShelfAnimating)) ? 'hidden' : 'visible' }}>
          {/* Linha 2: [Dropdown de Sprint + Campo de Busca + Filtro por Assignees] à esquerda e [Versão + Status] à direita no canto direito */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', gap: 16, border: 'none', flexWrap: 'wrap' }}>
            {/* Lado Esquerdo: Dropdown de Sprint + Campo de Busca + Filtro de Assignees */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, border: 'none', flexWrap: 'wrap' }}>
              {/* Dropdown de Sprint */}
              <div style={{ position: 'relative' }}>
                <div
                  ref={sprintTriggerRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSprintDropdownOpen((prev) => !prev);
                    setStatusDropdownOpen(false);
                    setVersionDropdownOpen(false);
                    setOrgDropdownOpen(false);
                    setGithubProjectDropdownOpen(false);
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

                {/* Menu de Sprint via Portal */}
                {sprintDropdownOpen && sprintTriggerRef.current && createPortal(
                  <div
                    ref={sprintDropdownRef}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'fixed',
                      top: sprintTriggerRef.current.getBoundingClientRect().bottom + 6,
                      left: Math.max(8, Math.min(sprintTriggerRef.current.getBoundingClientRect().left, window.innerWidth - 180)),
                      background: theme.dropdownBg,
                      borderRadius: 8,
                      padding: 5,
                      zIndex: 999999,
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
                  </div>,
                  document.body
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

            {/* Grupo da Direita: Organização + Project + Status (no canto direito) */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                border: 'none',
                position: 'relative',
                zIndex: (orgDropdownOpen || githubProjectDropdownOpen || statusDropdownOpen) ? 1000 : 1,
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
                    ref={orgTriggerRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setOrgDropdownOpen((prev) => !prev);
                      setGithubProjectDropdownOpen(false);
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

                  {/* Menu de Organização via Portal */}
                  {orgDropdownOpen && orgTriggerRef.current && createPortal(
                    <div
                      ref={orgDropdownRef}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'fixed',
                        top: orgTriggerRef.current.getBoundingClientRect().bottom + 6,
                        left: Math.max(8, Math.min(orgTriggerRef.current.getBoundingClientRect().right - 220, window.innerWidth - 228)),
                        background: theme.dropdownBg,
                        borderRadius: 10,
                        padding: 6,
                        zIndex: 999999,
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
                    </div>,
                    document.body
                  )}
                </div>

              {/* Seletor de GitHub Project da Organização */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative', zIndex: githubProjectDropdownOpen ? 1001 : 1 }}>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 400,
                    color: theme.textSecondary,
                    letterSpacing: '-0.01em',
                  }}
                >
                  Project
                </span>

                {selectedGithubProject && (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: hexToRgba(accentColor, isEffectiveDark ? 0.15 : 0.1),
                      color: accentColor,
                      fontSize: 11,
                      fontWeight: 500,
                    }}
                  >
                    <span>Filtrando</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedGithubProjectNumber(null);
                      }}
                      title="Remover filtro de Project"
                      style={{
                        background: 'none',
                        border: 'none',
                        color: accentColor,
                        cursor: 'pointer',
                        fontSize: 13,
                        lineHeight: 1,
                        padding: '0 2px',
                      }}
                    >
                      ×
                    </button>
                  </div>
                )}

                <div
                  ref={projectTriggerRef}
                  onClick={(e) => {
                    e.stopPropagation();
                    setGithubProjectDropdownOpen((prev) => !prev);
                    setOrgDropdownOpen(false);
                    setSprintDropdownOpen(false);
                    setStatusDropdownOpen(false);
                    setVersionDropdownOpen(false);
                  }}
                  title={selectedGithubProject ? `Project: ${selectedGithubProject.title}` : 'Selecionar GitHub Project da organização'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    background: theme.controlBg,
                    borderRadius: 8,
                    padding: '6px 12px',
                    cursor: 'pointer',
                    border: selectedGithubProjectNumber != null ? `1px solid ${accentColor}` : theme.controlBorder,
                    transition: 'background 0.15s ease, border-color 0.15s ease',
                    userSelect: 'none',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = theme.controlHoverBg;
                    if (selectedGithubProjectNumber == null) {
                      e.currentTarget.style.borderColor = accentColor;
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = theme.controlBg;
                    if (selectedGithubProjectNumber == null) {
                      e.currentTarget.style.borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
                    }
                  }}
                >
                  <FolderKanban size={13.5} color={selectedGithubProjectNumber != null ? accentColor : theme.textSecondary} />
                  <span
                    style={{
                      fontSize: 12.5,
                      fontWeight: selectedGithubProjectNumber != null ? 500 : 400,
                      color: selectedGithubProjectNumber != null ? accentColor : theme.textPrimary,
                      maxWidth: 160,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {selectedGithubProject ? selectedGithubProject.title : 'Todos os Projects'}
                  </span>
                  {isLoadingGithubProjects || isLoadingProjectItems ? (
                    <RefreshCw size={11} className="animate-spin" color={theme.textSecondary} />
                  ) : (
                    <ChevronDown size={13} color={theme.textSecondary} />
                  )}
                </div>

                {/* Botão rápido para abrir o Project selecionado no GitHub */}
                {selectedGithubProject?.url && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (window.electronAPI?.shell?.openExternal) {
                        window.electronAPI.shell.openExternal(selectedGithubProject.url);
                      }
                    }}
                    title="Abrir Project no GitHub"
                    style={{
                      background: theme.controlBg,
                      border: theme.controlBorder,
                      borderRadius: 7,
                      padding: '6px 8px',
                      color: theme.textSecondary,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color = accentColor;
                      e.currentTarget.style.borderColor = accentColor;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = theme.textSecondary;
                      e.currentTarget.style.borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
                    }}
                  >
                    <ExternalLink size={12} />
                  </button>
                )}

                {/* Menu Dropdown de Projects via Portal */}
                {githubProjectDropdownOpen && projectTriggerRef.current && createPortal(
                  <div
                    ref={projectDropdownRef}
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      position: 'fixed',
                      top: projectTriggerRef.current.getBoundingClientRect().bottom + 6,
                      left: Math.max(8, Math.min(projectTriggerRef.current.getBoundingClientRect().left, window.innerWidth - 328)),
                      zIndex: 999999,
                      background: isEffectiveDark ? '#161616' : '#ffffff',
                      border: `1px solid ${isEffectiveDark ? '#2e2e2e' : '#e2e8f0'}`,
                      borderRadius: 10,
                      boxShadow: isEffectiveDark ? '0 12px 32px rgba(0,0,0,0.6)' : '0 12px 32px rgba(0,0,0,0.12)',
                      padding: '6px',
                      minWidth: 260,
                      maxWidth: 320,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    {/* Cabeçalho com título e botão de reload */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 8px 6px',
                        borderBottom: `1px solid ${hexToRgba(theme.textSecondary, isEffectiveDark ? 0.12 : 0.08)}`,
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        <FolderKanban size={12} color={accentColor} />
                        <span>Projects (GitHub)</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          fetchGithubProjectsForOrg(selectedOrg);
                        }}
                        title="Recarregar Projects da organização"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          cursor: 'pointer',
                          padding: 2,
                          color: theme.textSecondary,
                          display: 'flex',
                          alignItems: 'center',
                        }}
                      >
                        <RefreshCw size={11} className={isLoadingGithubProjects ? 'animate-spin' : ''} />
                      </button>
                    </div>

                    {/* Campo de Busca de Projects */}
                    <div style={{ padding: '4px 4px 2px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9',
                          borderRadius: 6,
                          padding: '5px 8px',
                          border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                        }}
                      >
                        <Search size={12} color={theme.textSecondary} style={{ flexShrink: 0 }} />
                        <input
                          type="text"
                          value={githubProjectSearch}
                          onChange={(e) => setGithubProjectSearch(e.target.value)}
                          placeholder="Buscar project..."
                          style={{
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            fontSize: 11.5,
                            color: theme.textPrimary,
                            width: '100%',
                          }}
                          onClick={(e) => e.stopPropagation()}
                        />
                        {githubProjectSearch && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setGithubProjectSearch('');
                            }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: theme.textSecondary,
                              cursor: 'pointer',
                              padding: 0,
                              display: 'flex',
                              alignItems: 'center',
                            }}
                          >
                            <X size={11} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Opção "Todos os Projects" */}
                    <div
                      onClick={() => {
                        setSelectedGithubProjectNumber(null);
                        setGithubProjectDropdownOpen(false);
                      }}
                      style={{
                        padding: '7px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: selectedGithubProjectNumber == null ? hexToRgba(accentColor, isEffectiveDark ? 0.18 : 0.1) : 'transparent',
                        color: selectedGithubProjectNumber == null ? accentColor : theme.textPrimary,
                        fontSize: 12,
                        fontWeight: selectedGithubProjectNumber == null ? 600 : 400,
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (selectedGithubProjectNumber != null) e.currentTarget.style.background = theme.dropdownItemHover;
                      }}
                      onMouseLeave={(e) => {
                        if (selectedGithubProjectNumber != null) e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Layers size={13} color={selectedGithubProjectNumber == null ? accentColor : theme.textSecondary} />
                        <span>Todos os Projects</span>
                      </div>
                      {selectedGithubProjectNumber == null && <Check size={13} color={accentColor} />}
                    </div>

                    {/* Divisor */}
                    <div style={{ height: 1, background: hexToRgba(theme.textSecondary, isEffectiveDark ? 0.12 : 0.08), margin: '2px 0' }} />

                    {/* Lista de Projects */}
                    <div style={{ maxHeight: 220, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }} className="no-scrollbar">
                      {isLoadingGithubProjects && githubOrgProjects.length === 0 && (
                        <div style={{ padding: '12px 8px', textAlign: 'center', fontSize: 11, color: theme.textSecondary }}>
                          Carregando projects...
                        </div>
                      )}

                      {!isLoadingGithubProjects && filteredGithubOrgProjects.length === 0 && (
                        <div style={{ padding: '12px 8px', textAlign: 'center', fontSize: 11, color: theme.textSecondary }}>
                          {githubProjectSearch.trim()
                            ? `Nenhum project encontrado para "${githubProjectSearch}".`
                            : 'Nenhum project encontrado na organização.'}
                        </div>
                      )}

                      {filteredGithubOrgProjects.map((p) => {
                        const isSelected = selectedGithubProjectNumber === p.number;
                        return (
                          <div
                            key={p.id}
                            onClick={() => {
                              setSelectedGithubProjectNumber(p.number);
                              setGithubProjectDropdownOpen(false);
                            }}
                            style={{
                              padding: '6px 8px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              background: isSelected ? hexToRgba(accentColor, isEffectiveDark ? 0.18 : 0.1) : 'transparent',
                              transition: 'background 0.12s ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.background = theme.dropdownItemHover;
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                              <FolderKanban size={13} color={isSelected ? accentColor : theme.textSecondary} style={{ flexShrink: 0 }} />
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: isSelected ? accentColor : theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {p.title}
                                </div>
                                <div style={{ fontSize: 10, color: theme.textSecondary }}>
                                  #{p.number} {p.isCustom ? '• manual' : ''}
                                </div>
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              {p.url && (
                                <button
                                  type="button"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    if (window.electronAPI?.shell?.openExternal) {
                                      window.electronAPI.shell.openExternal(p.url);
                                    }
                                  }}
                                  title="Abrir no GitHub"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 2,
                                    color: theme.textSecondary,
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                  onMouseEnter={(ev) => (ev.currentTarget.style.color = accentColor)}
                                  onMouseLeave={(ev) => (ev.currentTarget.style.color = theme.textSecondary)}
                                >
                                  <ExternalLink size={11} />
                                </button>
                              )}
                              {p.isCustom && (
                                <button
                                  type="button"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setDeleteConfirmState({
                                      isOpen: true,
                                      title: 'Remover Project',
                                      message: 'Tem certeza que deseja remover este Project da lista?',
                                      itemDescription: p.title,
                                      confirmLabel: 'Remover Project',
                                      isDeleting: false,
                                      onConfirm: () => {
                                        const updated = githubOrgProjects.filter((item) => item.id !== p.id);
                                        setGithubOrgProjects(updated);
                                        saveCustomProjects(selectedOrg, updated.filter((item) => item.isCustom));
                                        if (selectedGithubProjectNumber === p.number) {
                                          setSelectedGithubProjectNumber(null);
                                        }
                                        setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }));
                                      },
                                    });
                                  }}
                                  title="Remover Project manual"
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    padding: 2,
                                    color: theme.textSecondary,
                                    display: 'flex',
                                    alignItems: 'center',
                                  }}
                                  onMouseEnter={(ev) => (ev.currentTarget.style.color = '#ef4444')}
                                  onMouseLeave={(ev) => (ev.currentTarget.style.color = theme.textSecondary)}
                                >
                                  <Trash2 size={11} />
                                </button>
                              )}
                              {isSelected && <Check size={13} color={accentColor} />}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Aviso de escopo read:project se houver */}
                    {githubProjectError && (
                      <div
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          background: hexToRgba('#f59e0b', isEffectiveDark ? 0.15 : 0.08),
                          border: `1px solid ${hexToRgba('#f59e0b', 0.25)}`,
                          fontSize: 10.5,
                          color: isEffectiveDark ? '#fbbf24' : '#d97706',
                          lineHeight: 1.35,
                          marginTop: 4,
                        }}
                      >
                        {githubProjectError}
                      </div>
                    )}

                    {/* Divisor */}
                    <div style={{ height: 1, background: hexToRgba(theme.textSecondary, isEffectiveDark ? 0.12 : 0.08), margin: '2px 0' }} />

                    {/* Botão para Adicionar Project Manualmente */}
                    <div
                      onClick={() => {
                        setGithubProjectDropdownOpen(false);
                        setIsAddCustomProjectModalOpen(true);
                        setCustomProjectInputTitle('');
                        setCustomProjectInputUrl('');
                      }}
                      style={{
                        padding: '6px 8px',
                        borderRadius: 6,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 7,
                        color: accentColor,
                        fontSize: 11.5,
                        fontWeight: 500,
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <Plus size={13} color={accentColor} />
                      <span>Adicionar Project por URL ou Número</span>
                    </div>
                  </div>,
                  document.body
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
                    ref={statusTriggerRef}
                    onClick={(e) => {
                      e.stopPropagation();
                      setStatusDropdownOpen((prev) => !prev);
                      setSprintDropdownOpen(false);
                      setVersionDropdownOpen(false);
                      setOrgDropdownOpen(false);
                      setGithubProjectDropdownOpen(false);
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

                  {/* Menu de Status via Portal */}
                  {statusDropdownOpen && statusTriggerRef.current && createPortal(
                    <div
                      ref={statusDropdownRef}
                      onClick={(e) => e.stopPropagation()}
                      style={{
                        position: 'fixed',
                        top: statusTriggerRef.current.getBoundingClientRect().bottom + 6,
                        left: Math.max(8, Math.min(statusTriggerRef.current.getBoundingClientRect().right - 190, window.innerWidth - 198)),
                        background: theme.dropdownBg,
                        borderRadius: 8,
                        padding: 5,
                        zIndex: 999999,
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
                    </div>,
                    document.body
                  )}
                </div>

                {/* Seletor de Modo de Visualização: Grade / Lista (oculto quando um projeto estiver selecionado) */}
                {isGridMode && (
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: isEffectiveDark ? '#1a1a1a' : '#f1f5f9',
                      borderRadius: 8,
                      padding: 3,
                      gap: 2,
                      border: theme.controlBorder,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setProjectLayoutMode('grid')}
                      title="Visualização em Grade"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 9px',
                        borderRadius: 6,
                        background: projectLayoutMode === 'grid' ? (isEffectiveDark ? '#262626' : '#ffffff') : 'transparent',
                        color: projectLayoutMode === 'grid' ? theme.textPrimary : theme.textSecondary,
                        fontSize: 12,
                        fontWeight: projectLayoutMode === 'grid' ? 500 : 400,
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: projectLayoutMode === 'grid' ? (isEffectiveDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 2px rgba(0,0,0,0.06)') : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <LayoutGrid size={13} color={projectLayoutMode === 'grid' ? accentColor : 'currentColor'} />
                      <span>Grade</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setProjectLayoutMode('list')}
                      title="Visualização em Lista"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        padding: '4px 9px',
                        borderRadius: 6,
                        background: projectLayoutMode === 'list' ? (isEffectiveDark ? '#262626' : '#ffffff') : 'transparent',
                        color: projectLayoutMode === 'list' ? theme.textPrimary : theme.textSecondary,
                        fontSize: 12,
                        fontWeight: projectLayoutMode === 'list' ? 500 : 400,
                        border: 'none',
                        cursor: 'pointer',
                        boxShadow: projectLayoutMode === 'list' ? (isEffectiveDark ? '0 1px 3px rgba(0,0,0,0.4)' : '0 1px 2px rgba(0,0,0,0.06)') : 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <List size={13} color={projectLayoutMode === 'list' ? accentColor : 'currentColor'} />
                      <span>Lista</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          </div>
          </div>

      {/* Div dos cards / lista posicionada logo abaixo dos controles */}
      <div
        ref={shelfCardsRef}
        onWheel={(e) => {
          if (!isGridMode && effectiveProjectLayoutMode === 'grid' && e.currentTarget.scrollWidth > e.currentTarget.clientWidth) {
            if (e.deltaY !== 0 && e.deltaX === 0) {
              e.currentTarget.scrollLeft += e.deltaY;
            }
          }
        }}
        style={{
          position: 'relative',
          zIndex: 1,
          width: isGridMode ? 'calc(100% - 48px)' : 'calc(100% - 2 * clamp(11px, calc(2vw - 5px), 23px))',
          maxWidth: isGridMode ? 1860 : '100%',
          margin: isProjectsShelfCollapsed
            ? (isGridMode ? '-16px auto 0' : '-5px auto 0')
            : '0 auto',
          alignSelf: 'center',
          height: isProjectsShelfCollapsed ? 0 : isGridMode ? 'auto' : 190,
          minHeight: isProjectsShelfCollapsed ? 0 : isGridMode ? 'auto' : 190,
          maxHeight: isProjectsShelfCollapsed ? 0 : isGridMode ? 'calc(100vh - 220px)' : 190,
          opacity: isProjectsShelfCollapsed ? 0 : 1,
          transform: isProjectsShelfCollapsed ? 'translateY(-8px)' : 'translateY(0)',
          pointerEvents: isProjectsShelfCollapsed ? 'none' : undefined,
          flexShrink: 0,
          padding: isProjectsShelfCollapsed ? 0 : effectiveProjectLayoutMode === 'list' ? 0 : 5,
          background: theme.bgShelf,
          borderRadius: 10,
          border: 'none',
          boxShadow: 'none',
          justifyContent: isGridMode ? undefined : 'flex-start',
          alignItems: 'stretch',
          alignContent: isGridMode ? 'start' : undefined,
          gap: effectiveProjectLayoutMode === 'list' ? 0 : 5,
          display: effectiveProjectLayoutMode === 'list' ? 'flex' : (isGridMode ? 'grid' : 'flex'),
          flexDirection: effectiveProjectLayoutMode === 'list' ? 'column' : undefined,
          gridTemplateColumns: isGridMode && effectiveProjectLayoutMode === 'grid' ? 'repeat(4, minmax(0, 1fr))' : undefined,
          gridAutoRows: isGridMode && effectiveProjectLayoutMode === 'grid' ? '180px' : undefined,
          flexWrap: isGridMode || effectiveProjectLayoutMode === 'list' ? undefined : 'nowrap',
          overflowX: isGridMode && effectiveProjectLayoutMode === 'grid' ? 'hidden' : 'auto',
          overflowY: 'auto',
          boxSizing: 'border-box',
          animation: isGridMode ? 'projectGridFadeIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)' : undefined,
          transition: 'all 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        className="no-scrollbar"
      >
        {effectiveProjectLayoutMode === 'list' ? (
          <div style={{ width: '100%', height: '100%', overflowX: 'auto', overflowY: 'auto' }} className="no-scrollbar">
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 780 }}>
              <thead>
                <tr style={{ background: theme.tableHeaderBg, borderBottom: `1px solid ${theme.tableBorder}`, position: 'sticky', top: 0, zIndex: 2 }}>
                  {[
                    { id: 'index' as TableSortField, label: '#', width: 44, align: 'center' },
                    { id: 'project' as TableSortField, label: 'Projeto', align: 'left' },
                    { id: 'language' as TableSortField, label: 'Linguagem', width: 130, align: 'left' },
                    { id: 'progress' as TableSortField, label: 'Progresso', width: 180, align: 'left' },
                    { id: 'done' as TableSortField, label: 'Concluídas', width: 90, align: 'center' },
                    { id: 'inProgress' as TableSortField, label: 'Em Andamento', width: 105, align: 'center' },
                    { id: 'open' as TableSortField, label: 'Abertas', width: 90, align: 'center' },
                    { id: 'health' as TableSortField, label: 'Saúde', width: 80, align: 'center' },
                    { id: 'updatedAt' as TableSortField, label: 'Atualizado', width: 120, align: 'right' },
                  ].map((col) => {
                    const isSorted = tableSortField === col.id;
                    const isAsc = isSorted && tableSortDirection === 'asc';

                    return (
                      <th
                        key={col.id}
                        onClick={() => handleTableSort(col.id)}
                        style={{
                          padding: '9px 12px',
                          fontSize: 11.5,
                          color: isSorted ? accentColor : theme.textSecondary,
                          fontWeight: 400,
                          width: col.width,
                          textAlign: col.align as any,
                          cursor: 'pointer',
                          userSelect: 'none',
                          transition: 'color 0.15s ease',
                        }}
                        title={`Clique para ordenar por ${col.label}`}
                      >
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            justifyContent:
                              col.align === 'center'
                                ? 'center'
                                : col.align === 'right'
                                ? 'flex-end'
                                : 'flex-start',
                            width: '100%',
                          }}
                        >
                          <span>{col.label}</span>
                          {isSorted ? (
                            isAsc ? (
                              <ArrowUp size={11} color={accentColor} style={{ flexShrink: 0 }} />
                            ) : (
                              <ArrowDown size={11} color={accentColor} style={{ flexShrink: 0 }} />
                            )
                          ) : (
                            <ArrowUpDown size={10} style={{ opacity: 0.25, flexShrink: 0 }} />
                          )}
                        </div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {sortedTableCards.length > 0 ? (
                  sortedTableCards.map((card, idx) => {
                    const isSelected = selectedCardId === card.id;
                    const isHovered = hoveredCardId === card.id;
                    const rowBg = isSelected
                      ? hexToRgba(accentColor, isEffectiveDark ? 0.22 : 0.15)
                      : isHovered
                      ? (isEffectiveDark ? '#1a1a1a' : '#f8fafc')
                      : 'transparent';

                    const totalTasksForBar = card.issuesDone + card.issuesInProgress + card.issuesOpen;
                    const doneGrow = card.issuesDone;
                    const inProgressGrow = card.issuesInProgress;
                    const openGrow = totalTasksForBar > 0 ? card.issuesOpen : 1;
                    const effectivePercent = totalTasksForBar > 0
                      ? Math.round((card.issuesDone / totalTasksForBar) * 100)
                      : (card.percentValue ?? 0);
                    const cardCached =
                      repoDetailsCache[card.fullName || ''] ||
                      (card.owner && card.repoName ? repoDetailsCache[`${card.owner}/${card.repoName}`] : undefined) ||
                      repoDetailsCache[card.name || ''] ||
                      repoDetailsCache[card.title || ''] ||
                      Object.entries(repoDetailsCache).find(
                        ([k]) => k.toLowerCase() === card.fullName?.toLowerCase() || (card.repoName && k.toLowerCase().endsWith(`/${card.repoName.toLowerCase()}`))
                      )?.[1];
                    const cardIssues = cardCached?.issues || [];
                    const cardHealth = computeProjectHealthScore(cardIssues, card.issuesDone, card.issuesInProgress, totalTasksForBar, effectivePercent);

                    const isCardActiveWorkspace = activeWorkspaceMatchingCard?.id === card.id;

                    const badgeBg = isSelected
                      ? accentColor
                      : (isHovered
                          ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                          : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'));

                    const badgeColor = isSelected
                      ? (isAccentContrastDark ? '#000000' : '#ffffff')
                      : theme.textPrimary;

                    return (
                      <tr
                        key={card.id}
                        id={`project-card-${card.id}`}
                        onClick={() => handleOpenProjectCard(card)}
                        onMouseEnter={() => setHoveredCardId(card.id)}
                        onMouseLeave={() => setHoveredCardId(null)}
                        style={{
                          background: rowBg,
                          borderBottom: `1px solid ${theme.tableBorder}`,
                          cursor: 'pointer',
                          transition: 'background 0.12s ease',
                        }}
                      >
                        <td style={{ padding: '9px 12px', textAlign: 'center' }}>
                          <div
                            style={{
                              width: 24,
                              height: 24,
                              borderRadius: '50%',
                              background: isSelected
                                ? accentColor
                                : (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
                              color: isSelected ? accentContrastText : theme.textPrimary,
                              fontSize: 11,
                              fontWeight: 400,
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {card.badge || idx + 1}
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                              {card.fullName && pinnedProjectFullNames.includes(card.fullName) && (
                                <Pin size={11} color={accentColor} style={{ transform: 'rotate(45deg)', flexShrink: 0 }} />
                              )}
                              <div
                                style={{
                                  width: 22,
                                  height: 22,
                                  borderRadius: 5,
                                  overflow: 'hidden',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  flexShrink: 0,
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                                  position: 'relative',
                                  border: 'none',
                                  boxShadow: 'none',
                                }}
                              >
                                {card.alertStatus && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: -1,
                                      left: -1,
                                      width: 5,
                                      height: 5,
                                      borderRadius: '50%',
                                      background: card.alertStatus === 'critico' ? '#ef4444' : '#f59e0b',
                                      border: 'none',
                                      boxShadow: 'none',
                                      zIndex: 3,
                                    }}
                                    title={card.alertStatus === 'critico' ? 'Status: Crítico' : 'Status: Alerta'}
                                  />
                                )}
                                <ProjectIconBadge
                                  card={card}
                                  customIcon={
                                    customProjectIcons[card.fullName || ''] ||
                                    customProjectIcons[card.title] ||
                                    customProjectIcons[String(card.id)]
                                  }
                                  badgeBg={badgeBg}
                                  badgeColor={badgeColor}
                                  size={18}
                                />
                              </div>
                              <span
                                style={{
                                  fontSize: 13,
                                  fontWeight: 400,
                                  color: isSelected ? accentColor : theme.textPrimary,
                                }}
                              >
                                {card.title || card.name || card.repoName || 'Sem título'}
                              </span>
                              {isCardActiveWorkspace && (
                                <span
                                  title="Projeto atualmente ativo no editor / header"
                                  style={{
                                    fontSize: 9.5,
                                    fontWeight: 400,
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.04em',
                                    padding: '1.5px 5px',
                                    borderRadius: 4,
                                    background: hexToRgba(accentColor, 0.16),
                                    color: accentColor,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 3,
                                    flexShrink: 0,
                                  }}
                                >
                                  <span style={{ width: 4.5, height: 4.5, borderRadius: '50%', background: accentColor }} />
                                  Ativo
                                </span>
                              )}
                              {card.isPrivate && (
                                <Lock size={12} color={theme.textSecondary} style={{ opacity: 0.7 }} />
                              )}
                            </div>
                            {card.description && (
                              <span
                                style={{
                                  fontSize: 11,
                                  color: theme.textSecondary,
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  whiteSpace: 'nowrap',
                                  maxWidth: 360,
                                  paddingLeft: 29,
                                }}
                                title={card.description}
                              >
                                {card.description}
                              </span>
                            )}
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <span
                            style={{
                              fontSize: 11.5,
                              color: theme.textSecondary,
                              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                              padding: '2px 8px',
                              borderRadius: 12,
                              display: 'inline-block',
                            }}
                          >
                            {card.language || card.sprint || '—'}
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <div
                              style={{
                                flex: 1,
                                height: 5,
                                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                                borderRadius: 3,
                                overflow: 'hidden',
                                display: 'flex',
                              }}
                            >
                              {totalTasksForBar > 0 ? (
                                <>
                                  <div style={{ flex: doneGrow, background: accentColor, height: '100%' }} />
                                  <div style={{ flex: inProgressGrow, background: isSelected ? accentColor : '#38bdf8', height: '100%' }} />
                                  <div style={{ flex: openGrow, background: 'transparent', height: '100%' }} />
                                </>
                              ) : (
                                <div style={{ flex: 1, background: 'transparent' }} />
                              )}
                            </div>
                            <span
                              style={{
                                fontSize: 11,
                                color: theme.textSecondary,
                                minWidth: 28,
                                textAlign: 'right',
                                fontWeight: 400,
                              }}
                            >
                              {card.percentValue ?? card.progressPercent ?? 0}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center', fontSize: 12.5, fontWeight: '400', color: theme.textPrimary }}>
                          {card.issuesDone}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center', fontSize: 12.5, fontWeight: '400', color: theme.textPrimary }}>
                          {card.issuesInProgress}
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'center', fontSize: 12.5, fontWeight: '400', color: theme.textPrimary }}>
                          {card.issuesOpen}
                        </td>
                        <td
                          style={{ padding: '9px 12px', textAlign: 'center', fontSize: 12.5, fontWeight: '400', color: theme.textPrimary, cursor: 'pointer' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectProjectById(card.id, true);
                            setSelectedSection('relatorio');
                            logSystemActivity('projects', 'open_project_reports_from_health_kpi', card.title || card.name, {
                              cardId: card.id,
                              healthScore: cardHealth,
                            });
                            showToast(`Abrindo relatório de ${card.title || card.name}...`);
                          }}
                          title={`Saúde: ${cardHealth}% (${cardHealth >= 80 ? 'Excelente' : cardHealth >= 60 ? 'Estável' : 'Alerta'}) — Clique para abrir o Relatório`}
                        >
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: cardHealth < 60
                                ? (isEffectiveDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.14)')
                                : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'),
                              color: cardHealth < 60
                                ? (isEffectiveDark ? '#fca5a5' : '#b91c1c')
                                : theme.textPrimary,
                              transition: 'background 0.15s ease',
                            }}
                          >
                            {cardHealth}%
                          </span>
                        </td>
                        <td style={{ padding: '9px 12px', textAlign: 'right', fontSize: 11.5, color: theme.textSecondary }}>
                          {card.updatedAtIso ? new Date(card.updatedAtIso).toLocaleDateString('pt-BR') : '—'}
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={9} style={{ padding: '32px 16px', textAlign: 'center', color: theme.textSecondary, fontSize: 12.5 }}>
                      Nenhum projeto encontrado.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          filteredCards.length > 0 ? (
          filteredCards.map((card) => {
            const isSelected = selectedCardId === card.id;
            const isHovered = hoveredCardId === card.id;

            // Background do card: cinza ao invés de laranja para o projeto selecionado
            const cardBg = isSelected
              ? (isHovered
                  ? (isEffectiveDark ? '#282828' : '#e2e8f0')
                  : (isEffectiveDark ? '#202020' : '#eceff4'))
              : (isHovered
                  ? theme.cardHoverBg
                  : theme.cardBg);

            // Bolinha do número: laranja no card selecionado
            const badgeBg = isSelected
              ? accentColor
              : (isHovered
                  ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                  : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'));

            const badgeColor = isSelected
              ? (isAccentContrastDark ? '#000000' : '#ffffff')
              : theme.textPrimary;

            const secondaryTextColor = isHovered ? theme.textPrimary : theme.textSecondary;

            const effectiveSprint =
              card.currentSprint ||
              (isSelected && combinedSprints && combinedSprints.length > 0
                ? (() => {
                    const active = combinedSprints.find((s) => s.number !== -1 && s.status !== 'Completed');
                    if (!active) return null;
                    return {
                      number: active.number,
                      title: active.title,
                      dueDateIso: active.dueDateIso,
                      daysBadge: calculateSprintDaysBadge(active.dueDateIso, isEffectiveDark),
                    };
                  })()
                : null);

            // Barra de progresso: concluídas e em progresso na cor destaque quando o card estiver selecionado
            const progressSolidBg = isSelected
              ? accentColor
              : isHovered
              ? (isEffectiveDark ? '#eaeaea' : '#525252')
              : (isEffectiveDark ? '#D9D9D9' : '#a3a3a3');

            const inProgressPattern = isSelected
              ? `radial-gradient(circle, ${accentColor} 1px, transparent 1px)`
              : isEffectiveDark
              ? 'radial-gradient(circle, #ffffff 1px, transparent 1px)'
              : 'radial-gradient(circle, #111111 1px, transparent 1px)';

            const progressFaintBg = isHovered
              ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.14)')
              : (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)');

            // Proporção real: concluídas (sólida) / em andamento (pontilhada) / abertas (opacidade baixa)
            const totalTasksForBar = card.issuesDone + card.issuesInProgress + card.issuesOpen;
            const doneGrow = card.issuesDone;
            const inProgressGrow = card.issuesInProgress;
            const openGrow = totalTasksForBar > 0 ? card.issuesOpen : 1;
            const effectivePercent = totalTasksForBar > 0
              ? Math.round((card.issuesDone / totalTasksForBar) * 100)
              : (card.percentValue ?? 0);
            const cardCached =
              repoDetailsCache[card.fullName || ''] ||
              (card.owner && card.repoName ? repoDetailsCache[`${card.owner}/${card.repoName}`] : undefined) ||
              repoDetailsCache[card.name || ''] ||
              repoDetailsCache[card.title || ''] ||
              Object.entries(repoDetailsCache).find(
                ([k]) => k.toLowerCase() === card.fullName?.toLowerCase() || (card.repoName && k.toLowerCase().endsWith(`/${card.repoName.toLowerCase()}`))
              )?.[1];
            const cardIssues = cardCached?.issues || [];
            const cardHealth = computeProjectHealthScore(cardIssues, card.issuesDone, card.issuesInProgress, totalTasksForBar, effectivePercent);

            return (
              <div
                key={card.id}
                id={`project-card-${card.id}`}
                onClick={() => handleOpenProjectCard(card)}
                onMouseEnter={() => setHoveredCardId(card.id)}
                onMouseLeave={() => setHoveredCardId(null)}
                style={{
                  flex: isGridMode ? 'none' : '0 0 calc((100% - 15px) / 4)',
                  width: isGridMode ? '100%' : 'calc((100% - 15px) / 4)',
                  minWidth: isGridMode ? 0 : 240,
                  height: 180,
                  minHeight: 180,
                  flexShrink: 0,
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
                  transform: isHovered ? 'translateY(-3px)' : 'translateY(0)',
                  boxShadow: 'none',
                  transition: 'all 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
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
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: 'clamp(6px, 0.8vw, 10px)',
                      display: 'inline-flex',
                      minWidth: 0,
                      width: '100%',
                      border: 'none',
                    }}
                  >
                    <div
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 'clamp(6px, 0.8vw, 10px)',
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      {/* Badge com pontinho de alerta/crítico no canto superior esquerdo */}
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          background: 'transparent',
                          border: 'none',
                          boxShadow: 'none',
                          display: 'inline-flex',
                          justifyContent: 'center',
                          alignItems: 'center',
                          flexShrink: 0,
                          position: 'relative',
                        }}
                      >
                        {/* Pontinho vermelho (crítico) ou amarelo (alerta) no canto superior esquerdo da bolinha */}
                        {card.alertStatus && (
                          <div
                            style={{
                              position: 'absolute',
                              top: -1,
                              left: -1,
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: card.alertStatus === 'critico' ? '#ef4444' : '#f59e0b',
                              border: 'none',
                              boxShadow: 'none',
                              zIndex: 3,
                            }}
                            title={card.alertStatus === 'critico' ? 'Status: Crítico' : 'Status: Alerta'}
                          />
                        )}
                        <ProjectIconBadge
                          card={card}
                          customIcon={
                            customProjectIcons[card.fullName || ''] ||
                            customProjectIcons[card.title] ||
                            customProjectIcons[String(card.id)]
                          }
                          badgeBg={badgeBg}
                          badgeColor={badgeColor}
                        />
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
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', minWidth: 0 }}>
                          <span
                            style={{
                              color: isSelected ? accentColor : theme.textPrimary,
                              fontSize: 'clamp(12px, 0.95vw, 16px)',
                              fontWeight: isSelected ? '500' : '300',
                              lineHeight: 1.2,
                              letterSpacing: '-0.01em',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              flex: 1,
                              minWidth: 0,
                            }}
                          >
                            {card.title}
                          </span>
                          {activeWorkspaceMatchingCard?.id === card.id && (
                            <span
                              title="Projeto atualmente ativo no editor / header"
                              style={{
                                fontSize: 9,
                                fontWeight: 600,
                                textTransform: 'uppercase',
                                letterSpacing: '0.04em',
                                padding: '1px 5px',
                                borderRadius: 4,
                                background: hexToRgba(accentColor, 0.16),
                                color: accentColor,
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                flexShrink: 0,
                              }}
                            >
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: accentColor }} />
                              Ativo
                            </span>
                          )}
                        </div>
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
                          {card.language || (effectiveSprint ? effectiveSprint.title : '')}
                        </span>
                      </div>
                    </div>

                    {/* Direita: Pin Indicator & Botão de Opções (...) */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 2,
                        flexShrink: 0,
                        position: 'relative',
                      }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      {card.fullName && pinnedProjectFullNames.includes(card.fullName) && (
                        <div
                          title="Projeto fixado no topo"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: accentColor,
                            padding: '2px',
                          }}
                        >
                          <Pin size={12} style={{ transform: 'rotate(45deg)' }} />
                        </div>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (activeProjectMenu?.card.id === card.id) {
                            setActiveProjectMenu(null);
                          } else {
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActiveProjectMenu({
                              card,
                              anchorRect: {
                                top: rect.top,
                                bottom: rect.bottom,
                                left: rect.left,
                                right: rect.right,
                              },
                            });
                          }
                        }}
                        title="Opções do Repositório"
                        style={{
                          background: activeProjectMenu?.card.id === card.id ? hexToRgba(accentColor, 0.16) : 'transparent',
                          border: 'none',
                          color:
                            activeProjectMenu?.card.id === card.id
                              ? accentColor
                              : isHovered
                              ? theme.textPrimary
                              : hexToRgba(theme.textSecondary, 0.6),
                          cursor: 'pointer',
                          padding: '3px 5px',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = accentColor;
                          e.currentTarget.style.background = hexToRgba(accentColor, 0.12);
                        }}
                        onMouseLeave={(e) => {
                          if (activeProjectMenu?.card.id !== card.id) {
                            e.currentTarget.style.color = isHovered
                              ? theme.textPrimary
                              : hexToRgba(theme.textSecondary, 0.6);
                            e.currentTarget.style.background = 'transparent';
                          }
                        }}
                      >
                        <MoreHorizontal size={15} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Progress Section */}
                <div
                  style={{
                    alignSelf: 'stretch',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'stretch',
                    gap: 5,
                    display: 'flex',
                    border: 'none',
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      minWidth: 0,
                    }}
                  >
                    {/* Sprint atual e dias restantes (se não tiver sprint não mostra nada) */}
                    {effectiveSprint ? (
                      <div
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: 5,
                          minWidth: 0,
                          overflow: 'hidden',
                        }}
                      >
                        <span
                          style={{
                            fontSize: 'clamp(10px, 0.8vw, 11.5px)',
                            fontWeight: 500,
                            color: isSelected ? accentColor : theme.textPrimary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: 'clamp(100px, 16vw, 260px)',
                          }}
                          title={`Sprint Atual: ${effectiveSprint.title}`}
                        >
                          {effectiveSprint.title}
                        </span>

                        {effectiveSprint.daysBadge && (
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 600,
                              padding: '1px 5px',
                              borderRadius: 4,
                              color: effectiveSprint.daysBadge.color,
                              background: effectiveSprint.daysBadge.bg,
                              whiteSpace: 'nowrap',
                              lineHeight: 1.15,
                              letterSpacing: '0.01em',
                              flexShrink: 0,
                            }}
                            title={
                              effectiveSprint.dueDateIso
                                ? `Término da Sprint: ${effectiveSprint.dueDateIso}`
                                : undefined
                            }
                          >
                            {effectiveSprint.daysBadge.text}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div />
                    )}

                    <span
                      style={{
                        textAlign: 'right',
                        color: isSelected ? accentColor : isHovered ? theme.textPrimary : theme.textSecondary,
                        fontSize: 12,
                        fontWeight: isSelected ? '500' : '300',
                        lineHeight: 1,
                        transition: 'color 0.18s ease',
                        flexShrink: 0,
                      }}
                    >
                      {card.percentage}
                    </span>
                  </div>
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
                          transition: 'flex-grow 0.25s ease, background 0.18s ease',
                        }}
                        title={`${card.issuesDone} concluída(s)`}
                      />
                    )}
                    {inProgressGrow > 0 && (
                      <div
                        style={{
                          flex: `${inProgressGrow} 1 0`,
                          height: 4,
                          backgroundImage: inProgressPattern,
                          backgroundSize: '4px 4px',
                          backgroundRepeat: 'repeat-x',
                          backgroundPosition: 'center',
                          border: 'none',
                          transition: 'flex-grow 0.25s ease, background-image 0.18s ease',
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

                {/* Bottom Metrics Row: Grid de 4 cardzinhos com fundo cinza individual, centralizados e com dimensões harmônicas */}
                <div
                  style={{
                    alignSelf: 'stretch',
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: 5,
                    padding: 0,
                    background: 'transparent',
                    borderRadius: 0,
                    minWidth: 0,
                    width: '100%',
                    border: 'none',
                    boxShadow: 'none',
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Concluídas */}
                  <div
                    style={{
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                      borderRadius: 6,
                      padding: '6px 4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                      minWidth: 0,
                      overflow: 'hidden',
                      border: 'none',
                      boxShadow: 'none',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                    }}
                    title={`Concluídas: ${card.issuesDone}`}
                  >
                    <span
                      style={{
                        color: secondaryTextColor,
                        fontSize: 10,
                        fontWeight: 400,
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'center',
                      }}
                    >
                      Concluídas
                    </span>
                    <span
                      style={{
                        color: theme.textPrimary,
                        fontSize: 13.5,
                        fontWeight: 400,
                        lineHeight: 1.1,
                        textAlign: 'center',
                      }}
                    >
                      {card.issuesDone}
                    </span>
                  </div>

                  {/* Progresso */}
                  <div
                    style={{
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                      borderRadius: 6,
                      padding: '6px 4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                      minWidth: 0,
                      overflow: 'hidden',
                      border: 'none',
                      boxShadow: 'none',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                    }}
                    title={`Em andamento: ${card.issuesInProgress}`}
                  >
                    <span
                      style={{
                        color: secondaryTextColor,
                        fontSize: 10,
                        fontWeight: 400,
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'center',
                      }}
                    >
                      Progresso
                    </span>
                    <span
                      style={{
                        color: theme.textPrimary,
                        fontSize: 13.5,
                        fontWeight: 400,
                        lineHeight: 1.1,
                        textAlign: 'center',
                      }}
                    >
                      {card.issuesInProgress}
                    </span>
                  </div>

                  {/* Abertas */}
                  <div
                    style={{
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                      borderRadius: 6,
                      padding: '6px 4px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 3,
                      minWidth: 0,
                      overflow: 'hidden',
                      border: 'none',
                      boxShadow: 'none',
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                    }}
                    title={`Abertas: ${card.issuesOpen}`}
                  >
                    <span
                      style={{
                        color: secondaryTextColor,
                        fontSize: 10,
                        fontWeight: 400,
                        lineHeight: 1,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        textAlign: 'center',
                      }}
                    >
                      Abertas
                    </span>
                    <span
                      style={{
                        color: theme.textPrimary,
                        fontSize: 13.5,
                        fontWeight: 400,
                        lineHeight: 1.1,
                        textAlign: 'center',
                      }}
                    >
                      {card.issuesOpen}
                    </span>
                  </div>

                  {/* Saúde */}
                  {(() => {
                    const isHealthAlert = cardHealth < 60;
                    const healthBg = isHealthAlert
                      ? (isEffectiveDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.14)')
                      : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)');
                    const healthHoverBg = isHealthAlert
                      ? (isEffectiveDark ? 'rgba(239, 68, 68, 0.32)' : 'rgba(239, 68, 68, 0.22)')
                      : (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)');
                    const healthLabelColor = isHealthAlert
                      ? (isEffectiveDark ? '#fca5a5' : '#b91c1c')
                      : secondaryTextColor;
                    const healthValueColor = isHealthAlert
                      ? (isEffectiveDark ? '#ffffff' : '#991b1b')
                      : theme.textPrimary;
                    const healthStatusText = cardHealth >= 80 ? 'Excelente' : cardHealth >= 60 ? 'Estável' : 'Alerta';
                    const healthStatusColor = cardHealth >= 80 ? '#22c55e' : cardHealth >= 60 ? '#f59e0b' : '#ef4444';

                    return (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectProjectById(card.id, true);
                          setSelectedSection('relatorio');
                          logSystemActivity('projects', 'open_project_reports_from_health_kpi', card.title || card.name, {
                            cardId: card.id,
                            healthScore: cardHealth,
                          });
                          showToast(`Abrindo relatório de ${card.title || card.name}...`);
                        }}
                        style={{
                          background: healthBg,
                          borderRadius: 6,
                          padding: '6px 4px',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 3,
                          minWidth: 0,
                          overflow: 'hidden',
                          border: 'none',
                          boxShadow: 'none',
                          cursor: 'pointer',
                          transition: 'background 0.15s ease, transform 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = healthHoverBg;
                          e.currentTarget.style.transform = 'scale(1.02)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = healthBg;
                          e.currentTarget.style.transform = 'scale(1)';
                        }}
                        title={`Saúde: ${cardHealth}% (${healthStatusText}) — Clique para abrir o Relatório`}
                      >
                        <span
                          style={{
                            color: healthLabelColor,
                            fontSize: 10,
                            fontWeight: 400,
                            lineHeight: 1,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            textAlign: 'center',
                          }}
                        >
                          Saúde
                        </span>
                        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 4, maxWidth: '100%', minWidth: 0 }}>
                          <span
                            style={{
                              color: healthValueColor,
                              fontSize: 13.5,
                              fontWeight: 400,
                              lineHeight: 1.1,
                              textAlign: 'center',
                            }}
                          >
                            {cardHealth}%
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 400,
                              color: healthStatusColor,
                              whiteSpace: 'nowrap',
                              lineHeight: 1,
                            }}
                          >
                            {healthStatusText}
                          </span>
                        </div>
                      </div>
                    );
                  })()}
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
          )
        )}
        </div>

        {/* ========================================================================= */}
        {/* NAVEGAÇÃO DE SEÇÕES DO PROJETO (Issues, Sprints, Riscos, Marcos, etc.)     */}
        {/* ========================================================================= */}
        {!isGridMode && (
          <div
            style={{
              position: 'relative',
              zIndex: 1,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              animation: 'projectDetailsSlideIn 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
          <div
            style={{
              width: 'calc(100% - 2 * clamp(11px, calc(2vw - 5px), 23px))',
              alignSelf: 'center',
              padding: 5,
              background: theme.bgShelf,
              borderRadius: 10,
              border: 'none',
              boxShadow: 'none',
              display: 'flex',
              alignItems: 'stretch',
              gap: 5,
              boxSizing: 'border-box',
              overflowX: 'auto',
              flexShrink: 0,
            }}
            className="no-scrollbar"
          >
          {PROJECT_SECTIONS.map((section, index) => {
            const isSelected = selectedSection === section.id;
            const isHovered = hoveredSectionId === section.id;
            const Icon = section.icon;
            const opacity = isSelected ? 1 : isHovered ? 0.8 : 0.5;
            const iconColor = isSelected ? accentColor : theme.textPrimary;
            const labelColor = isSelected ? (isEffectiveDark ? '#ffffff' : '#111111') : theme.textPrimary;
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
              flex: 1,
              minHeight: 0,
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
                  <span>Todas as Issues</span>
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
                  {combinedGithubIssues.length}
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
                <span>Atribuídas a mim</span>
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
                <span>Criadas por mim</span>
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
                <span>Mencionado</span>
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
                <span>Atividade recente</span>
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
                gap: 5,
                boxSizing: 'border-box',
              }}
            >
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

                    {/* Aba Todas */}
                    <div
                      onClick={() => setIssuesStateFilter('all')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        cursor: 'pointer',
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: issuesStateFilter === 'all' ? (isEffectiveDark ? '#262626' : '#e2e8f0') : 'transparent',
                        transition: 'background 0.12s ease',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: issuesStateFilter === 'all' ? 600 : 400,
                          color: issuesStateFilter === 'all' ? theme.textPrimary : theme.textSecondary,
                        }}
                      >
                        Todas
                      </span>
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 600,
                          padding: '0 5px',
                          borderRadius: 8,
                          background: isEffectiveDark ? '#1a1a1a' : '#cbd5e1',
                          color: issuesStateFilter === 'all' ? theme.textPrimary : theme.textSecondary,
                        }}
                      >
                        {openIssuesCount + closedIssuesCount}
                      </span>
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
                        Aberto
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
                        Fechado
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
                        <span>{selectedAuthorFilter === 'all' ? 'Autor' : selectedAuthorFilter}</span>
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
                        <span>{selectedLabelFilter === 'all' ? 'Etiquetas' : selectedLabelFilter}</span>
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
                            <span>Todas as etiquetas</span>
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
                        <span>Projetos</span>
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
                        <span>Marcos</span>
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
                        <span>{selectedAssigneeFilter === 'all' ? 'Responsáveis' : selectedAssigneeFilter}</span>
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
                            ? 'Mais recentes'
                            : issuesSortMode === 'oldest'
                            ? 'Mais antigas'
                            : 'Mais comentadas'}
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
                              { id: 'newest', label: 'Mais recentes' },
                              { id: 'oldest', label: 'Mais antigas' },
                              { id: 'comments', label: 'Mais comentadas' },
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
                      onClick={() => openAddTaskModal()}
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

                    {/* Alternador de Visualização: Lista / Quadro (Kanban) */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        background: theme.controlBg,
                        borderRadius: 6,
                        padding: 2,
                        gap: 2,
                        border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => setIssuesViewMode('list')}
                        title="Visualização em Lista"
                        style={{
                          background: issuesViewMode === 'list' ? (isEffectiveDark ? '#262626' : '#ffffff') : 'transparent',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          color: issuesViewMode === 'list' ? theme.textPrimary : theme.textSecondary,
                          fontSize: 11.5,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: issuesViewMode === 'list' ? 600 : 400,
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <List size={13} />
                        <span>Lista</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIssuesViewMode('kanban')}
                        title="Visualização em Quadro Kanban"
                        style={{
                          background: issuesViewMode === 'kanban' ? (isEffectiveDark ? '#262626' : '#ffffff') : 'transparent',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          color: issuesViewMode === 'kanban' ? theme.textPrimary : theme.textSecondary,
                          fontSize: 11.5,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: issuesViewMode === 'kanban' ? 600 : 400,
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <LayoutGrid size={13} />
                        <span>Quadro</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIssuesViewMode('roadmap')}
                        title="Visualização em Roadmap"
                        style={{
                          background: issuesViewMode === 'roadmap' ? (isEffectiveDark ? '#262626' : '#ffffff') : 'transparent',
                          border: 'none',
                          borderRadius: 4,
                          padding: '4px 8px',
                          color: issuesViewMode === 'roadmap' ? theme.textPrimary : theme.textSecondary,
                          fontSize: 11.5,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          fontWeight: issuesViewMode === 'roadmap' ? 600 : 400,
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <Calendar size={13} />
                        <span>Roadmap</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de Linhas de Issues OU Quadro Kanban OU Roadmap */}
                {issuesViewMode === 'kanban' ? (
                  <div style={{ flex: 1, minHeight: 460, display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
                    <GithubProjectsKanbanBoard
                      issues={filteredGithubIssues}
                      columns={projectV2Columns || undefined}
                      repoName={selectedRepoRaw?.full_name || selectedProject?.repoName || selectedProject?.title || 'repositório'}
                      theme={theme}
                      isEffectiveDark={isEffectiveDark}
                      accentColor={accentColor}
                      accentContrastText={accentContrastText}
                      onOpenIssueDetail={handleOpenIssueCardDetail}
                      onMoveIssue={handleMoveIssueToColumn}
                      onAddNewIssue={() => openAddTaskModal()}
                      showToast={showToast}
                    />
                  </div>
                ) : issuesViewMode === 'roadmap' ? (
                  <div style={{ flex: 1, minHeight: 460, display: 'flex', flexDirection: 'column', padding: '4px 0' }}>
                    <GithubProjectsRoadmapView
                      issues={filteredGithubIssues}
                      repoName={selectedRepoRaw?.full_name || selectedProject?.repoName || selectedProject?.title || 'repositório'}
                      theme={theme}
                      isEffectiveDark={isEffectiveDark}
                      accentColor={accentColor}
                      accentContrastText={accentContrastText}
                      onOpenIssueDetail={handleOpenIssueCardDetail}
                      onUpdateIssueDates={(issueId, startDateIso, dueDateIso) => {
                        const card = selectedProject;
                        if (card) {
                          patchIssueInRepoCache(card, issueId, (i) => ({ ...i, startDateIso, dueDateIso, dateStr: startDateIso }));
                        }
                      }}
                      onAddNewIssue={() => openAddTaskModal()}
                      showToast={showToast}
                    />
                  </div>
                ) : (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    flex: 1,
                  }}
                  className="no-scrollbar"
                >
                  {(() => {
                    const parentChildIdsInList = new Set<string>();
                    const parentChildNumbersInList = new Set<number>();
                    filteredGithubIssues.forEach((parent) => {
                      const subs = extractSubIssuesForIssue(parent, allIssuesMap);
                      subs.forEach((s) => {
                        if (s.linkedIssue?.id && s.linkedIssue.id !== parent.id) {
                          parentChildIdsInList.add(s.linkedIssue.id);
                        }
                        if (s.issueNumber && s.issueNumber !== parent.githubNumber) {
                          parentChildNumbersInList.add(s.issueNumber);
                        }
                      });
                      if (parent.subIssueNumbers && parent.subIssueNumbers.length > 0) {
                        parent.subIssueNumbers.forEach((num) => {
                          if (num !== parent.githubNumber) {
                            parentChildNumbersInList.add(num);
                          }
                        });
                      }
                    });

                    const rawTopLevelGithubIssues = filteredGithubIssues.filter((issue) => {
                      const hasParentInList =
                        parentChildIdsInList.has(issue.id) ||
                        (issue.githubNumber != null && parentChildNumbersInList.has(issue.githubNumber));
                      return !hasParentInList;
                    });
                    const topLevelGithubIssues = rawTopLevelGithubIssues.length > 0 ? rawTopLevelGithubIssues : filteredGithubIssues;

                    if (topLevelGithubIssues.length === 0) {
                      return (
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
                      );
                    }

                    return topLevelGithubIssues.map((issue, index) => {
                      const isHovered = hoveredIssueId === issue.id;
                      const isChecked = selectedIssueCheckboxes.has(issue.id);
                      const isClosed = issue.rawState === 'closed' || issue.status === 'Concluído';
                      const issueNumber = issue.githubNumber || issue.id.replace('#', '');
                      const comments = issue.commentsCount || 0;
                      const labels = issue.rawLabels || (issue.tag ? [issue.tag] : []);

                      const subIssues = extractSubIssuesForIssue(issue, allIssuesMap);
                      const hasSubIssues = subIssues.length > 0;
                      const isExpanded = expandedIssueIds.has(issue.id);
                      const completedSubsCount = subIssues.filter((s) => s.completed).length;

                      return (
                        <React.Fragment key={issue.id}>
                          <div
                            onMouseEnter={() => setHoveredIssueId(issue.id)}
                            onMouseLeave={() => setHoveredIssueId(null)}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 10,
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
                            {/* Botão de Dropdown Chevron para Sub-issues */}
                            {hasSubIssues ? (
                              <button
                                type="button"
                                onClick={(e) => toggleIssueExpanded(issue.id, e)}
                                title={isExpanded ? 'Recolher sub-issues' : `Expandir ${subIssues.length} sub-issues`}
                                style={{
                                  marginTop: 2,
                                  background: 'transparent',
                                  border: 'none',
                                  padding: '2px 3px',
                                  cursor: 'pointer',
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  color: isExpanded ? accentColor : theme.textSecondary,
                                  borderRadius: 4,
                                  flexShrink: 0,
                                  transition: 'transform 0.15s ease, color 0.12s ease',
                                  transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                                onMouseLeave={(e) => (e.currentTarget.style.color = isExpanded ? accentColor : theme.textSecondary)}
                              >
                                <ChevronRight size={14} />
                              </button>
                            ) : (
                              <div style={{ width: 18, flexShrink: 0 }} />
                            )}

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

                                {/* Badge de Sub-issues se houver */}
                                {hasSubIssues && (
                                  <button
                                    type="button"
                                    onClick={(e) => toggleIssueExpanded(issue.id, e)}
                                    title={`${completedSubsCount} de ${subIssues.length} sub-issues concluídas. Clique para ${isExpanded ? 'recolher' : 'expandir'}.`}
                                    style={{
                                      background: isEffectiveDark ? 'rgba(56, 189, 248, 0.14)' : 'rgba(2, 132, 199, 0.1)',
                                      color: isEffectiveDark ? '#38bdf8' : '#0284c7',
                                      fontSize: 11,
                                      fontWeight: 500,
                                      borderRadius: 12,
                                      padding: '1px 8px',
                                      border: 'none',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      cursor: 'pointer',
                                      whiteSpace: 'nowrap',
                                      transition: 'opacity 0.12s ease',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                                    onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                                  >
                                    <Layers size={11} />
                                    <span>
                                      {completedSubsCount}/{subIssues.length} sub-issues
                                    </span>
                                  </button>
                                )}

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
                                <span>aberta {formatGithubTimeAgo(issue.createdAtIso)}</span>
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

                          {/* Container de Sub-issues Expandidas */}
                          {hasSubIssues && isExpanded && (
                            <div
                              style={{
                                background: isEffectiveDark ? 'rgba(0, 0, 0, 0.16)' : 'rgba(0, 0, 0, 0.02)',
                                borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'}`,
                                paddingLeft: 46,
                                paddingRight: 16,
                                paddingTop: 4,
                                paddingBottom: 6,
                              }}
                            >
                              <div
                                style={{
                                  borderLeft: `2px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`,
                                  paddingLeft: 12,
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 2,
                                }}
                              >
                                {subIssues.map((sub, sIdx) => {
                                  const subLinked = sub.linkedIssue;
                                  const isSubClosed = sub.completed;
                                  const subTaskNum = sub.issueNumber || (subLinked ? subLinked.githubNumber : undefined);

                                  return (
                                    <div
                                      key={sub.id || sIdx}
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '6px 8px',
                                        borderRadius: 6,
                                        gap: 10,
                                        transition: 'background 0.12s ease',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)')}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                    >
                                      {/* Lado Esquerdo da Sub-issue */}
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                        <CornerDownRight size={13} color={theme.textSecondary} style={{ flexShrink: 0, opacity: 0.6 }} />

                                        <button
                                          type="button"
                                          onClick={() => {
                                            if (subLinked) {
                                              handleToggleIssueStatus(subLinked.id);
                                            } else if (sub.lineIndex != null) {
                                              handleToggleChecklistSubIssue(issue, sub.lineIndex, sub.completed);
                                            }
                                          }}
                                          title={isSubClosed ? 'Sub-issue concluída (clique para reabrir)' : 'Sub-issue aberta (clique para concluir)'}
                                          style={{
                                            background: 'transparent',
                                            border: 'none',
                                            padding: 0,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            flexShrink: 0,
                                          }}
                                        >
                                          {isSubClosed ? (
                                            <CheckCircle2 size={15} color="#8957e5" />
                                          ) : (
                                            <CircleDot size={15} color="#22c55e" />
                                          )}
                                        </button>

                                        <span
                                          onClick={() => {
                                            if (subLinked) {
                                              handleOpenEditIssue(subLinked);
                                            } else {
                                              handleOpenEditIssue(issue);
                                            }
                                          }}
                                          style={{
                                            fontSize: 12.5,
                                            fontWeight: 500,
                                            color: isSubClosed ? theme.textSecondary : theme.textPrimary,
                                            textDecoration: isSubClosed ? 'line-through' : 'none',
                                            cursor: 'pointer',
                                            overflow: 'hidden',
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                          }}
                                          onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                                          onMouseLeave={(e) => (e.currentTarget.style.color = isSubClosed ? theme.textSecondary : theme.textPrimary)}
                                        >
                                          {subTaskNum && <strong style={{ color: theme.textSecondary, marginRight: 6 }}>#{subTaskNum}</strong>}
                                          {sub.title}
                                        </span>

                                        {subLinked?.tag && (
                                          <span
                                            style={{
                                              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                                              color: theme.textSecondary,
                                              fontSize: 10.5,
                                              fontWeight: 500,
                                              borderRadius: 10,
                                              padding: '1px 6px',
                                              whiteSpace: 'nowrap',
                                            }}
                                          >
                                            {subLinked.tag}
                                          </span>
                                        )}
                                      </div>

                                      {/* Lado Direito da Sub-issue: Avatares */}
                                      {subLinked && subLinked.assignees && subLinked.assignees.length > 0 && (
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                          {subLinked.assignees.map((assignee, aIdx) => (
                                            <div
                                              key={assignee.name || aIdx}
                                              title={assignee.name}
                                              style={{
                                                width: 18,
                                                height: 18,
                                                borderRadius: '50%',
                                                overflow: 'hidden',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                background: assignee.avatarBg || accentColor,
                                                color: '#fff',
                                                fontSize: 9,
                                                fontWeight: 600,
                                              }}
                                            >
                                              {assignee.avatarUrl ? (
                                                <img src={assignee.avatarUrl} alt={assignee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                              ) : (
                                                <span>{assignee.initial || assignee.name?.slice(0, 1).toUpperCase()}</span>
                                              )}
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </React.Fragment>
                      );
                    });
                  })()}
                </div>
                )}
              </div>
            </div>
          </div>
        ) : selectedSection === 'sprints' ? (
          /* ========================================================================= */
          /* TELA DA ABA SPRINTS: CALENDÁRIO VERTICAL + LISTA SPRINTS + TAREFAS        */
          /* ========================================================================= */
          <div
            style={{
              width: '100%',
              maxWidth: !isSprintSidebarVisible && sprintContentWidth ? `${sprintContentWidth}px` : '100%',
              margin: '0 auto',
              alignSelf: 'center',
              background: theme.bgShelf,
              borderRadius: 10,
              border: 'none',
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              padding: 5,
              boxSizing: 'border-box',
              flex: 1,
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative',
              transition: isDraggingSprintContent ? 'none' : 'max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
            }}
          >
            {/* Resizers bilaterais na div do fundo para redimensionar tudo junto estilo IDE */}
            {!isSprintSidebarVisible && (
              <>
                {/* Resizer Esquerdo */}
                <div
                  className={`resizer-col ${isDraggingSprintContent ? 'dragging' : ''}`}
                  onMouseDown={startResizeContentLeft}
                  onDoubleClick={() => {
                    setSprintContentWidth(1080);
                    localStorage.setItem('sprint_content_width', '1080');
                  }}
                  title="Arraste para redimensionar (Duplo clique para restaurar 1080px)"
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    left: -9,
                    width: 14,
                    cursor: 'col-resize',
                    zIndex: 35,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 3,
                      height: 36,
                      borderRadius: 3,
                      background: isDraggingSprintContent ? accentColor : 'transparent',
                      transition: 'all 0.15s ease',
                    }}
                  />
                </div>

                {/* Resizer Direito */}
                <div
                  className={`resizer-col ${isDraggingSprintContent ? 'dragging' : ''}`}
                  onMouseDown={startResizeContentRight}
                  onDoubleClick={() => {
                    setSprintContentWidth(1080);
                    localStorage.setItem('sprint_content_width', '1080');
                  }}
                  title="Arraste para redimensionar (Duplo clique para restaurar 1080px)"
                  style={{
                    position: 'absolute',
                    top: 0,
                    bottom: 0,
                    right: -9,
                    width: 14,
                    cursor: 'col-resize',
                    zIndex: 35,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <div
                    style={{
                      width: 3,
                      height: 36,
                      borderRadius: 3,
                      background: isDraggingSprintContent ? accentColor : 'transparent',
                      transition: 'all 0.15s ease',
                    }}
                  />
                </div>
              </>
            )}

              <SprintDetailPanel
                allCards={allCards}
                selectedProject={selectedProject}
                onSelectProject={(cardId) => handleSelectProjectById(cardId)}
                isSprintSidebarVisible={isSprintSidebarVisible}
                toggleSprintSidebar={toggleSprintSidebar}
                currentUser={currentUser}
                theme={theme}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                accentContrastText={accentContrastText}
                combinedSprints={combinedSprints}
                openedSprint={openedSprint}
                onSelectSprint={handleOpenSprintDetail}
                onDeleteSprint={handleDeleteSprint}
                onCreateSprint={() => openCreateSprintModal('create')}
                sprintSidebarFilter={sprintSidebarFilter}
                setSprintSidebarFilter={setSprintSidebarFilter}
                verticalCalendarDate={verticalCalendarDate}
                setVerticalCalendarDate={setVerticalCalendarDate}
                selectedCalendarDayIso={selectedCalendarDayIso}
                setSelectedCalendarDayIso={setSelectedCalendarDayIso}
                sprintDetailViewMode={sprintDetailViewMode}
                setSprintDetailViewMode={setSprintDetailViewMode}
                isEditingSprintDates={isEditingSprintDates}
                editSprintStartDate={editSprintStartDate}
                editSprintDueDate={editSprintDueDate}
                setEditSprintStartDate={setEditSprintStartDate}
                setEditSprintDueDate={setEditSprintDueDate}
                isSavingSprintDates={isSavingSprintDates}
                onStartEditSprintDates={handleStartEditSprintDates}
                onCancelEditSprintDates={() => setIsEditingSprintDates(false)}
                onSaveSprintDates={handleSaveSprintDates}
                sprintDetailTasks={sprintDetailTasks}
                allProjectIssues={combinedGithubIssues}
                tasksAvailableToAddToSprint={tasksAvailableToAddToSprint}
                isAddExistingTaskOpen={isAddExistingTaskOpen}
                setIsAddExistingTaskOpen={setIsAddExistingTaskOpen}
                onAddExistingTask={(issue) => {
                  if (openedSprintId != null) handleSetIssueSprint(issue, openedSprintId);
                  setIsAddExistingTaskOpen(false);
                }}
                onRemoveTaskFromSprint={handlePromptRemoveTaskFromSprint}
                onBatchRemoveTasksFromSprint={handlePromptBatchRemoveFromSprint}
                onToggleTaskStatus={handleToggleIssueStatus}
                onAssignToMe={handleAssignToMe}
                collaborators={collaboratorsForSelectedRepo}
                onEditTask={handleOpenEditIssue}
                onDeleteTask={handleDeleteIssue}
                onBatchDeleteTasks={handleBatchDeleteIssues}
                onReassignTask={handleAssignIssue}
                onCreateNewTask={() => {
                  openAddTaskModal();
                  setNewTaskMilestoneNumber(
                    openedSprint && !openedSprint.isProjectIteration && !openedSprint.isVirtual && openedSprint.number > 0
                      ? openedSprint.number
                      : null
                  );
                }}
                sprintCalendarMonthOffset={sprintCalendarMonthOffset}
                setSprintCalendarMonthOffset={setSprintCalendarMonthOffset}
                onMoveIssue={handleMoveIssueToColumn}
                projectV2Columns={projectV2Columns}
                showToast={showToast}
              />
            </div>
        ) : selectedSection === 'riscos' ? (
          <ProjectRisksDashboard
            issues={rawProjectIssues}
            sprints={combinedSprints}
            collaborators={collaboratorsForSelectedRepo}
            repoName={selectedRepoRaw?.full_name || selectedProject?.repoName || selectedProject?.title || 'repositório'}
            theme={theme}
            isEffectiveDark={isEffectiveDark}
            accentColor={accentColor}
            accentContrastText={accentContrastText}
            onOpenIssueDetail={handleOpenIssueCardDetail}
            onReassignTask={(issue) => handleOpenEditIssue(issue)}
            showToast={showToast}
          />
        ) : selectedSection === 'marcos' ? (
          /* ========================================================================= */
          /* TELA DE MARCOS: Gestão de releases, DoD, equipe e roadmap de milestones   */
          /* ========================================================================= */
          <ProjectMilestonesView
            milestones={(() => {
              const list = [...sprintsForSelectedRepo];
              (customSprintsList || []).forEach((cs) => {
                if (!list.some((s) => s.number === cs.number || s.title.toLowerCase() === cs.title.toLowerCase())) {
                  list.push({
                    number: cs.number,
                    title: cs.title,
                    state: cs.status === 'Completed' ? 'closed' : 'open',
                    startDateIso: cs.startDateIso,
                    dueDateIso: cs.dueDateIso,
                    openIssues: 0,
                    closedIssues: 0,
                  });
                }
              });
              return list;
            })()}
            issues={rawProjectIssues}
            collaborators={collaboratorsForSelectedRepo}
            selectedProject={selectedProject}
            repoName={selectedRepoRaw?.full_name || selectedProject?.repoName || selectedProject?.title || 'repositório'}
            theme={theme}
            isEffectiveDark={isEffectiveDark}
            accentColor={accentColor}
            accentContrastText={accentContrastText}
            onOpenCreateMilestone={() => openCreateSprintModal('create')}
            onDeleteMilestone={handleDeleteMilestone}
            onOpenIssueDetail={handleOpenIssueCardDetail}
            onCreateTaskInMilestone={(mNum) => {
              openAddTaskModal();
              setNewTaskMilestoneNumber(mNum);
            }}
            onUpdateMilestoneDates={handleUpdateMilestoneDates}
            onToggleMilestoneState={handleToggleMilestoneState}
            onAssignIssueToMilestone={handleAssignIssueToMilestone}
            showToast={showToast}
          />
        ) : selectedSection === 'relatorio' ? (
          /* ========================================================================= */
          /* TELA DE RELATÓRIO: DASHBOARD EXECUTIVO & ANALYTICS MODULAR COM IA         */
          /* ========================================================================= */
          <ProjectReportsView
            selectedProject={selectedProject}
            repoName={selectedRepoRaw?.full_name || selectedProject?.repoName || selectedProject?.title || 'repositório'}
            issues={rawProjectIssues}
            sprints={(() => {
              const list = [...sprintsForSelectedRepo];
              (customSprintsList || []).forEach((cs) => {
                if (!list.some((s) => s.number === cs.number || s.title.toLowerCase() === cs.title.toLowerCase())) {
                  list.push({
                    number: cs.number,
                    title: cs.title,
                    state: cs.status === 'Completed' ? 'closed' : 'open',
                    startDateIso: cs.startDateIso,
                    dueDateIso: cs.dueDateIso,
                    openIssues: 0,
                    closedIssues: 0,
                  });
                }
              });
              return list;
            })()}
            collaborators={collaboratorsForSelectedRepo}
            theme={theme}
            isEffectiveDark={isEffectiveDark}
            accentColor={accentColor}
            accentContrastText={accentContrastText}
            onOpenIssueDetail={handleOpenIssueCardDetail}
            showToast={showToast}
          />
        ) : selectedSection === 'links' ? (
          <ProjectLinksView
            selectedProject={selectedProject}
            selectedRepoRaw={selectedRepoRaw}
            repoFullName={selectedProject?.fullName}
            customLinks={(customLinks[selectedProject?.fullName || ''] || []) as any}
            onAddCustomLink={handleAddCustomLink}
            onRemoveCustomLink={handleRemoveCustomLink}
            theme={theme}
            isEffectiveDark={isEffectiveDark}
            accentColor={accentColor}
            accentContrastText={accentContrastText}
            showToast={showToast}
          />
        ) : selectedSection === 'time' ? (
          /* ========================================================================= */
          /* TELA DE TIME: VISÃO, MEMBROS, TIMES, ACESSO E INSIGHTS                    */
          /* ========================================================================= */
          <div
            style={{
              width: '100%',
              background: theme.bgShelf,
              borderRadius: 10,
              border: 'none',
              boxShadow: 'none',
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              padding: 5,
              boxSizing: 'border-box',
              flex: 1,
              minHeight: 0,
              height: '100%',
              overflow: 'hidden',
            }}
          >
            <TeamWorkspaceView
              projectName={selectedProject?.title}
              repoFullName={selectedProject?.fullName}
              issues={rawProjectIssues}
              sprints={sprintsForSelectedRepo}
              sprintMatcher={issueBelongsToSprint}
              currentUserLogin={currentUser?.login}
              orgRepoNames={repos
                .filter((r) => r.owner?.login?.toLowerCase() === (selectedProject?.fullName || '').split('/')[0]?.toLowerCase())
                .map((r) => r.full_name)}
              aiProvider={(() => {
                const projectAi = getProjectSettings(selectedProject?.fullName).ai;
                const prov = AI_PROVIDERS.find((p) => p.id === (projectAi.providerId || localAiProvider)) || AI_PROVIDERS[0];
                const model = projectAi.model || (projectAi.providerId && projectAi.providerId !== localAiProvider ? undefined : localAiModel);
                return { id: prov.id, name: prov.name, cliCommand: prov.cliCommand, model, cwd: selectedProject?.localDir || workspacePath, contextNotes: projectAi.contextNotes };
              })()}
              theme={theme}
              accentColor={accentColor}
              accentContrastText={accentContrastText}
              isEffectiveDark={isEffectiveDark}
              showToast={showToast}
              onIssuesChanged={() => {
                if (selectedProject?.fullName) fetchRepoDetails(selectedProject.fullName, true);
              }}
              requestConfirm={(req) =>
                setDeleteConfirmState({
                  isOpen: true,
                  title: req.title,
                  message: req.message,
                  itemDescription: req.itemDescription,
                  confirmLabel: req.confirmLabel,
                  isDeleting: false,
                  onConfirm: async () => {
                    setDeleteConfirmState((prev) => ({ ...prev, isDeleting: true }));
                    try {
                      await req.onConfirm();
                    } finally {
                      setDeleteConfirmState((prev) => ({ ...prev, isOpen: false, isDeleting: false }));
                    }
                  },
                })
              }
            />
          </div>
        ) : selectedSection === 'configuracoes' ? (
          <ProjectSettingsView
            selectedProject={selectedProject}
            selectedRepoRaw={selectedRepoRaw}
            repoFullName={selectedProject?.fullName}
            workspacePath={workspacePath}
            onRefreshRepoDetails={() => selectedProject?.fullName && fetchRepoDetails(selectedProject.fullName, true)}
            onDataConfigChanged={() => selectedProject?.fullName && fetchRepoDetails(selectedProject.fullName, true)}
            onRepoGone={() => {
              const gone = selectedProject?.fullName;
              setSelectedCardId(null);
              setRepos((prev) => prev.filter((r) => r.full_name !== gone));
            }}
            customLinks={(customLinks[selectedProject?.fullName || ''] || []) as any}
            onSaveCustomLinks={(links) => selectedProject?.fullName && persistCustomLinks({ ...customLinks, [selectedProject.fullName]: links as any })}
            theme={theme}
            isEffectiveDark={isEffectiveDark}
            accentColor={accentColor}
            accentContrastText={accentContrastText}
            showToast={showToast}
          />
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
            flex: 1,
            minHeight: 0,
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

              {/* Botão Gantt */}
              <button
                type="button"
                onClick={() => setViewMode('gantt')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: viewMode === 'gantt' ? (isEffectiveDark ? '#242424' : '#e2e8f0') : 'transparent',
                  color: viewMode === 'gantt' ? theme.textPrimary : theme.textSecondary,
                  fontSize: 12,
                  fontWeight: '300',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (viewMode !== 'gantt') e.currentTarget.style.color = theme.textPrimary;
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'gantt') e.currentTarget.style.color = theme.textSecondary;
                }}
              >
                <BarChart2 size={13.5} />
                <span>Gantt</span>
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

              {/* Botão Roadmap (GitHub Projects Roadmap) */}
              <button
                type="button"
                onClick={() => setViewMode('roadmap')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 12px',
                  borderRadius: 6,
                  background: viewMode === 'roadmap' ? (isEffectiveDark ? '#242424' : '#e2e8f0') : 'transparent',
                  color: viewMode === 'roadmap' ? theme.textPrimary : theme.textSecondary,
                  fontSize: 12,
                  fontWeight: '300',
                  cursor: 'pointer',
                  border: 'none',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (viewMode !== 'roadmap') e.currentTarget.style.color = theme.textPrimary;
                }}
                onMouseLeave={(e) => {
                  if (viewMode !== 'roadmap') e.currentTarget.style.color = theme.textSecondary;
                }}
              >
                <Calendar size={13} />
                <span>Roadmap</span>
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
                boxSizing: 'border-box',
                width: 190,
                border: 'none',
                boxShadow: 'none',
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
                ref={filterTriggerRef}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setFilterDropdownOpen((prev) => !prev);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 32,
                  boxSizing: 'border-box',
                  background: theme.controlBg,
                  border: 'none',
                  outline: 'none',
                  boxShadow: 'none',
                  borderRadius: 8,
                  padding: '0 12px',
                  color: selectedPriorityFilter !== 'Todas' ? accentColor : theme.textPrimary,
                  fontSize: 12,
                  fontWeight: 400,
                  fontFamily: 'inherit',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.controlHoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = theme.controlBg)}
              >
                <Filter size={13} color={selectedPriorityFilter !== 'Todas' ? accentColor : theme.textSecondary} />
                <span>{selectedPriorityFilter === 'Todas' ? 'Filtro' : selectedPriorityFilter}</span>
              </button>

              {/* Dropdown de Filtro via Portal */}
              {filterDropdownOpen && filterTriggerRef.current && createPortal(
                <div
                  ref={filterDropdownRef}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    position: 'fixed',
                    top: filterTriggerRef.current.getBoundingClientRect().bottom + 6,
                    left: Math.max(8, Math.min(filterTriggerRef.current.getBoundingClientRect().right - 150, window.innerWidth - 160)),
                    background: theme.dropdownBg,
                    borderRadius: 8,
                    padding: 5,
                    zIndex: 999999,
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
                        fontWeight: 400,
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
                </div>,
                document.body
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
                height: 32,
                boxSizing: 'border-box',
                background: theme.controlBg,
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                borderRadius: 8,
                padding: '0 12px',
                color: sortMode !== 'default' ? accentColor : theme.textPrimary,
                fontSize: 12,
                fontWeight: 400,
                fontFamily: 'inherit',
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
              onClick={() => openAddTaskModal()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 32,
                boxSizing: 'border-box',
                background: accentColor,
                border: 'none',
                outline: 'none',
                boxShadow: 'none',
                borderRadius: 8,
                padding: '0 14px',
                color: accentContrastText,
                fontSize: 12,
                fontWeight: 500,
                fontFamily: 'inherit',
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
                              color: isCurrent ? (isEffectiveDark ? '#ffffff' : accentColor) : (isEffectiveDark ? '#aaaaaa' : '#525252'),
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

                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                              {autonomousRuns[issue.id]?.status === 'running' ? (
                                <button
                                  type="button"
                                  onClick={(event) => { event.stopPropagation(); void handleAutonomousCancel(issue); }}
                                  title={`Cancelar (${autonomousRuns[issue.id]?.phase || 'executando'})`}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    border: 'none',
                                    borderRadius: 4,
                                    padding: '3px 6px',
                                    color: '#f59e0b',
                                    background: 'rgba(245, 158, 11, 0.12)',
                                    fontSize: 10,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Clock size={11} /> {autonomousRuns[issue.id]?.phase || 'rodando'}
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={(event) => { event.stopPropagation(); void handleAutonomousRun(issue); }}
                                  title="Executar tarefa autonomamente"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 4,
                                    border: 'none',
                                    borderRadius: 4,
                                    padding: '3px 6px',
                                    color: accentColor,
                                    background: hexToRgba(accentColor, 0.12),
                                    fontSize: 10,
                                    cursor: 'pointer',
                                  }}
                                >
                                  <Zap size={11} /> {autonomousRuns[issue.id]?.status === 'done' ? 'reexecutar' : 'executar'}
                                </button>
                              )}
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
          {/* VIEW: GANTT CHART (GRÁFICO DE GANTT COM DIAS CORRIDOS)     */}
          {/* ========================================================= */}
          {viewMode === 'gantt' && (
            <div style={{ display: 'flex', flexDirection: 'column', width: '100%', gap: 8, flex: 1, minHeight: 0 }}>
              {/* Barra Superior de Controles do Gantt */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 4px',
                  flexWrap: 'wrap',
                  gap: 8,
                }}
              >
                {/* Informação do Período */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12.5, color: theme.textPrimary, fontWeight: 500, textTransform: 'capitalize' }}>
                    {ganttDays[0]?.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric' })} – {ganttDays[ganttDays.length - 1]?.toLocaleDateString('pt-BR', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                  <span style={{ fontSize: 11.5, color: theme.textSecondary }}>
                    · {projectIssues.length} {projectIssues.length === 1 ? 'tarefa' : 'tarefas'}
                  </span>
                </div>

                {/* Navegação e Zoom do Gantt */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  {/* Botões de Navegação no Tempo */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: theme.controlBg,
                      borderRadius: 8,
                      padding: 2,
                      gap: 2,
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => setGanttOffsetDays((prev) => prev - 14)}
                      title="Retroceder 14 dias"
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'transparent',
                        border: 'none',
                        color: theme.textSecondary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setGanttOffsetDays(-7)}
                      title="Ir para hoje"
                      style={{
                        padding: '4px 10px',
                        borderRadius: 6,
                        background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                        border: 'none',
                        color: theme.textPrimary,
                        fontSize: 11.5,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      onClick={() => setGanttOffsetDays((prev) => prev + 14)}
                      title="Avançar 14 dias"
                      style={{
                        padding: '4px 8px',
                        borderRadius: 6,
                        background: 'transparent',
                        border: 'none',
                        color: theme.textSecondary,
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>

                  {/* Seletor de Intervalo / Zoom */}
                  <div
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: theme.controlBg,
                      borderRadius: 8,
                      padding: 2,
                      gap: 2,
                    }}
                  >
                    {[
                      { days: 30, label: '30d' },
                      { days: 45, label: '45d' },
                      { days: 60, label: '60d' },
                      { days: 90, label: '90d' },
                    ].map((opt) => (
                      <button
                        key={opt.days}
                        type="button"
                        onClick={() => setGanttRangeDays(opt.days)}
                        style={{
                          padding: '4px 9px',
                          borderRadius: 6,
                          background: ganttRangeDays === opt.days ? (isEffectiveDark ? '#262626' : '#e2e8f0') : 'transparent',
                          color: ganttRangeDays === opt.days ? theme.textPrimary : theme.textSecondary,
                          fontSize: 11,
                          fontWeight: ganttRangeDays === opt.days ? 500 : 400,
                          cursor: 'pointer',
                          border: 'none',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* ===================================================================== */}
              {/* SEPARAÇÃO EM 2 DIVS: DIV 1 (TAREFAS/DIAS) + DIV 2 (GRÁFICO DE GANTT)  */}
              {/* ===================================================================== */}
              <div
                style={{
                  width: '100%',
                  flex: 1,
                  minHeight: 380,
                  display: 'flex',
                  gap: 10,
                  overflow: 'hidden',
                }}
              >
                {/* ------------------------------------------------------------- */}
                {/* DIV 1: LISTA DE TAREFAS E DIAS CORRIDOS (CARD ESQUERDO)        */}
                {/* ------------------------------------------------------------- */}
                <div
                  ref={ganttLeftRef}
                  onScroll={handleGanttLeftScroll}
                  style={{
                    width: 270,
                    minWidth: 270,
                    maxWidth: 270,
                    flexShrink: 0,
                    background: isEffectiveDark ? '#141414' : '#f8fafc',
                    borderRadius: 8,
                    border: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                  }}
                  className="no-scrollbar"
                >
                  {/* Cabeçalho Fixo da Div 1 */}
                  <div
                    style={{
                      position: 'sticky',
                      top: 0,
                      zIndex: 10,
                      height: 56,
                      background: isEffectiveDark ? '#181818' : '#f1f5f9',
                      borderBottom: isEffectiveDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
                      display: 'flex',
                      alignItems: 'center',
                      boxSizing: 'border-box',
                    }}
                  >
                    {/* Coluna 1: Tarefas */}
                    <div style={{ flex: 1, minWidth: 0, padding: '0 12px' }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          color: theme.textSecondary,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          opacity: 0.75,
                        }}
                      >
                        TAREFAS ({projectIssues.length})
                      </span>
                    </div>

                    {/* Divisória Vertical sutil */}
                    <div style={{ width: 1, height: 20, background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)' }} />

                    {/* Coluna 2: Dias Corridos */}
                    <div style={{ width: 68, padding: '0 8px', textAlign: 'center' }}>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: 600,
                          color: theme.textSecondary,
                          letterSpacing: '0.05em',
                          textTransform: 'uppercase',
                          opacity: 0.75,
                        }}
                      >
                        DIAS
                      </span>
                    </div>
                  </div>

                  {/* Linhas das Tarefas na Div 1 */}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    {projectIssues.length === 0 ? (
                      <div style={{ padding: '36px 16px', textAlign: 'center', color: theme.textSecondary, fontSize: 12 }}>
                        {isLoadingProjectIssues
                          ? 'Carregando tarefas do projeto...'
                          : projectIssuesError || 'Nenhuma tarefa encontrada.'}
                      </div>
                    ) : (
                      projectIssues.map((issue) => {
                        const { startDate, endDate, diasCorridos } = getTaskGanttMetrics(issue);
                        const isHovered = hoveredGanttTaskId === issue.id;
                        const isDone = issue.status === 'Concluído';
                        const isInProgress = issue.status === 'Em Progresso';
                        const statusDotColor = isDone ? '#22c55e' : isInProgress ? accentColor : '#3b82f6';
                        const assignee = issue.assignees?.[0];

                        return (
                          <div
                            key={issue.id}
                            onClick={() => handleOpenEditIssue(issue)}
                            onMouseEnter={() => setHoveredGanttTaskId(issue.id)}
                            onMouseLeave={() => setHoveredGanttTaskId(null)}
                            style={{
                              height: 40,
                              display: 'flex',
                              alignItems: 'center',
                              background: isHovered ? (isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)') : 'transparent',
                              cursor: 'pointer',
                              transition: 'background 0.12s ease',
                              boxSizing: 'border-box',
                              borderBottom: isEffectiveDark ? '1px solid rgba(255,255,255,0.025)' : '1px solid rgba(0,0,0,0.025)',
                            }}
                            title={`Clique para ver detalhes de "${issue.title}"`}
                          >
                            {/* Coluna 1: Dot + ID + Título */}
                            <div style={{ flex: 1, minWidth: 0, padding: '0 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
                              {/* Dot de Status */}
                              <div
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: '50%',
                                  background: statusDotColor,
                                  flexShrink: 0,
                                  boxShadow: 'none',
                                }}
                                title={`Status: ${issue.status}`}
                              />

                              {/* Número da Issue */}
                              <span
                                style={{
                                  fontSize: 11,
                                  fontFamily: 'monospace',
                                  color: theme.textSecondary,
                                  flexShrink: 0,
                                  opacity: 0.55,
                                }}
                              >
                                #{String(issue.githubNumber || issue.id).replace('#', '')}
                              </span>

                              {/* Título da Tarefa */}
                              <span
                                style={{
                                  fontSize: 12,
                                  fontWeight: 400,
                                  color: isHovered ? accentColor : theme.textPrimary,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  transition: 'color 0.12s ease',
                                }}
                                title={issue.title}
                              >
                                {issue.title}
                              </span>
                            </div>

                            {/* Divisória Vertical sutil entre Tarefas e Dias */}
                            <div style={{ width: 1, height: 16, background: isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)' }} />

                            {/* Coluna 2: Avatar + Dias minimalista */}
                            <div style={{ width: 68, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, flexShrink: 0 }}>
                              {assignee && (
                                <div
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: '50%',
                                    background: assignee.avatarBg || accentColor,
                                    color: '#fff',
                                    fontSize: 8.5,
                                    fontWeight: 600,
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    overflow: 'hidden',
                                    flexShrink: 0,
                                  }}
                                  title={`Responsável: @${assignee.name}`}
                                >
                                  {assignee.avatarUrl ? (
                                    <img src={assignee.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                  ) : (
                                    assignee.initial || assignee.name.charAt(0).toUpperCase()
                                  )}
                                </div>
                              )}

                              {/* Indicador Minimalista de Dias */}
                              <span
                                style={{
                                  fontSize: 11,
                                  fontWeight: 500,
                                  color: isHovered ? accentColor : theme.textSecondary,
                                  opacity: 0.8,
                                  fontVariantNumeric: 'tabular-nums',
                                }}
                                title={`Período: ${startDate.toLocaleDateString('pt-BR')} → ${endDate.toLocaleDateString('pt-BR')} (${diasCorridos} ${diasCorridos === 1 ? 'dia corrido' : 'dias corridos'})`}
                              >
                                {diasCorridos}d
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* ------------------------------------------------------------- */}
                {/* DIV 2: O GRÁFICO DE GANTT (CARD DIREITO / LINHA DO TEMPO)     */}
                {/* ------------------------------------------------------------- */}
                <div
                  ref={ganttRightRef}
                  onScroll={handleGanttRightScroll}
                  style={{
                    flex: 1,
                    minWidth: 0,
                    background: isEffectiveDark ? '#141414' : '#f8fafc',
                    borderRadius: 8,
                    border: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    overflowX: 'auto',
                    overflowY: 'auto',
                    position: 'relative',
                  }}
                  className="no-scrollbar"
                >
                  <div
                    style={{
                      minWidth: ganttDays.length * 40,
                      display: 'flex',
                      flexDirection: 'column',
                      position: 'relative',
                    }}
                  >
                    {/* Cabeçalho das Datas no Topo (Sticky Top) */}
                    <div
                      style={{
                        position: 'sticky',
                        top: 0,
                        zIndex: 10,
                        height: 56,
                        background: isEffectiveDark ? '#181818' : '#f1f5f9',
                        display: 'flex',
                        flexDirection: 'column',
                        border: 'none',
                        borderBottom: isEffectiveDark ? '1px solid rgba(255,255,255,0.05)' : '1px solid rgba(0,0,0,0.05)',
                      }}
                    >
                      {/* Linha 1: Meses Agrupados */}
                      <div style={{ display: 'flex', height: 26, borderBottom: isEffectiveDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)' }}>
                        {ganttMonths.map((m, mIdx) => (
                          <div
                            key={mIdx}
                            style={{
                              width: m.count * 40,
                              minWidth: m.count * 40,
                              padding: '0 10px',
                              display: 'flex',
                              alignItems: 'center',
                              fontSize: 11,
                              fontWeight: 600,
                              color: theme.textSecondary,
                              textTransform: 'capitalize',
                              borderRight: isEffectiveDark ? '1px solid rgba(255,255,255,0.04)' : '1px solid rgba(0,0,0,0.04)',
                            }}
                          >
                            <span>{m.label}</span>
                          </div>
                        ))}
                      </div>

                      {/* Linha 2: Dias Individuais */}
                      <div style={{ display: 'flex', height: 30 }}>
                        {ganttDays.map((d) => {
                          const isToday = d.getTime() === todayStart.getTime();
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          return (
                            <div
                              key={d.toISOString()}
                              style={{
                                width: 40,
                                minWidth: 40,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontSize: 10,
                                color: isToday ? accentColor : isWeekend ? (isEffectiveDark ? '#666' : '#94a3b8') : theme.textSecondary,
                                fontWeight: isToday ? 600 : 400,
                                background: isToday ? (isEffectiveDark ? 'rgba(255, 102, 0, 0.12)' : 'rgba(255, 102, 0, 0.08)') : 'transparent',
                              }}
                              title={d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}
                            >
                              <span style={{ fontSize: 8.5, letterSpacing: '0.02em', opacity: 0.8 }}>
                                {WEEKDAY_LABELS_PT[d.getDay()]}
                              </span>
                              <span style={{ fontSize: 11 }}>{d.getDate()}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Grid de Linhas Verticais e Barras de Gantt */}
                    <div style={{ position: 'relative', flex: 1 }}>
                      {/* Colunas verticais de fundo */}
                      <div
                        style={{
                          position: 'absolute',
                          top: 0,
                          bottom: 0,
                          left: 0,
                          right: 0,
                          display: 'flex',
                          pointerEvents: 'none',
                        }}
                      >
                        {ganttDays.map((d) => {
                          const isToday = d.getTime() === todayStart.getTime();
                          const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                          return (
                            <div
                              key={d.toISOString()}
                              style={{
                                width: 40,
                                minWidth: 40,
                                height: '100%',
                                background: isToday
                                  ? (isEffectiveDark ? 'rgba(255, 102, 0, 0.04)' : 'rgba(255, 102, 0, 0.03)')
                                  : isWeekend
                                  ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.012)')
                                  : 'transparent',
                                borderRight: isEffectiveDark ? '1px solid rgba(255,255,255,0.025)' : '1px solid rgba(0,0,0,0.025)',
                                position: 'relative',
                              }}
                            >
                              {/* Linha vertical marcando HOJE */}
                              {isToday && (
                                <div
                                  style={{
                                    position: 'absolute',
                                    top: 0,
                                    bottom: 0,
                                    left: '50%',
                                    width: 2,
                                    background: accentColor,
                                    boxShadow: `0 0 8px ${accentColor}`,
                                    zIndex: 1,
                                  }}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Linhas das Barras (1 linha por tarefa, perfeitamente alinhadas com a div 1 da esquerda) */}
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {projectIssues.map((issue) => {
                          const coords = getGanttBarCoordinates(issue, ganttDays, 40);
                          const isHovered = hoveredGanttTaskId === issue.id;
                          const isDone = issue.status === 'Concluído';
                          const isInProgress = issue.status === 'Em Progresso';

                          // Gradientes e sombras das barras no padrão DevFlow
                          const barBg = isDone
                            ? 'linear-gradient(135deg, #15803d 0%, #22c55e 100%)'
                            : isInProgress
                            ? `linear-gradient(135deg, ${accentColor} 0%, #ea580c 100%)`
                            : 'linear-gradient(135deg, #2563eb 0%, #3b82f6 100%)';

                          const barShadow = isDone
                            ? '0 2px 8px rgba(34, 197, 94, 0.3)'
                            : isInProgress
                            ? `0 2px 10px ${hexToRgba(accentColor, 0.4)}`
                            : '0 2px 8px rgba(59, 130, 246, 0.3)';

                          return (
                            <div
                              key={issue.id}
                              onMouseEnter={() => setHoveredGanttTaskId(issue.id)}
                              onMouseLeave={() => setHoveredGanttTaskId(null)}
                              style={{
                                height: 40,
                                position: 'relative',
                                background: isHovered ? (isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)') : 'transparent',
                                transition: 'background 0.12s ease',
                                borderBottom: isEffectiveDark ? '1px solid rgba(255,255,255,0.025)' : '1px solid rgba(0,0,0,0.025)',
                              }}
                            >
                              {coords && coords.isVisible && (
                                <div
                                  onClick={() => handleOpenEditIssue(issue)}
                                  style={{
                                    position: 'absolute',
                                    left: coords.left,
                                    width: coords.width,
                                    top: 7,
                                    height: 26,
                                    borderRadius: 6,
                                    background: barBg,
                                    boxShadow: isHovered ? `${barShadow}, 0 0 12px ${accentColor}` : barShadow,
                                    display: 'flex',
                                    alignItems: 'center',
                                    padding: '0 10px',
                                    cursor: 'pointer',
                                    zIndex: 2,
                                    transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                                    transform: isHovered ? 'scaleY(1.04)' : 'scaleY(1)',
                                    overflow: 'hidden',
                                    color: '#ffffff',
                                  }}
                                  title={`Tarefa #${issue.githubNumber || issue.id}: ${issue.title}\nStatus: ${issue.status}\nPeríodo: ${coords.startDate.toLocaleDateString('pt-BR')} → ${coords.endDate.toLocaleDateString('pt-BR')} (${coords.diasCorridos} dias corridos)`}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', minWidth: 0 }}>
                                    {isDone ? (
                                      <CheckCircle2 size={13} color="#ffffff" />
                                    ) : (
                                      <CircleDot size={13} color="#ffffff" />
                                    )}
                                    <span
                                      style={{
                                        fontSize: 11.5,
                                        fontWeight: 500,
                                        whiteSpace: 'nowrap',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        flex: 1,
                                      }}
                                    >
                                      {issue.title}
                                    </span>
                                    <span
                                      style={{
                                        fontSize: 10.5,
                                        fontWeight: 600,
                                        background: 'rgba(0,0,0,0.22)',
                                        padding: '1px 5px',
                                        borderRadius: 4,
                                        whiteSpace: 'nowrap',
                                        flexShrink: 0,
                                      }}
                                    >
                                      {coords.diasCorridos}d
                                    </span>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW: ROADMAP (ESTILO GITHUB PROJECTS ROADMAP)            */}
          {/* ========================================================= */}
          {viewMode === 'roadmap' && (
            <div style={{ flex: 1, minHeight: 460, display: 'flex', flexDirection: 'column' }}>
              <GithubProjectsRoadmapView
                issues={projectIssues}
                repoName={selectedRepoRaw?.full_name || selectedProject?.repoName || selectedProject?.title || 'repositório'}
                theme={theme}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                accentContrastText={accentContrastText}
                onOpenIssueDetail={handleOpenIssueCardDetail}
                onUpdateIssueDates={(issueId, startDateIso, dueDateIso) => {
                  const card = selectedProject;
                  if (card) {
                    patchIssueInRepoCache(card, issueId, (i) => ({ ...i, startDateIso, dueDateIso, dateStr: startDateIso }));
                  }
                }}
                onAddNewIssue={() => openAddTaskModal()}
                showToast={showToast}
              />
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW 2: KANBAN (QUADRO ÁGIL NO PADRÃO GITHUB PROJECTS)     */}
          {/* ========================================================= */}
          {viewMode === 'kanban' && (
            <div style={{ flex: 1, minHeight: 460, display: 'flex', flexDirection: 'column' }}>
              <GithubProjectsKanbanBoard
                issues={projectIssues}
                columns={projectV2Columns || undefined}
                repoName={selectedRepoRaw?.full_name || selectedProject?.repoName || selectedProject?.title || 'repositório'}
                theme={theme}
                isEffectiveDark={isEffectiveDark}
                accentColor={accentColor}
                accentContrastText={accentContrastText}
                onOpenIssueDetail={handleOpenIssueCardDetail}
                onMoveIssue={handleMoveIssueToColumn}
                onAddNewIssue={() => openAddTaskModal()}
                showToast={showToast}
              />
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
                            {iss.pullRequest.ciStatus === 'success' && <span title="CI: Passou" style={{ display: 'inline-flex' }}><CheckCircle2 size={11} color="#10b981" /></span>}
                            {iss.pullRequest.ciStatus === 'failure' && <span title="CI: Falhou" style={{ display: 'inline-flex' }}><AlertCircle size={11} color="#ef4444" /></span>}
                            {iss.pullRequest.ciStatus === 'pending' && <span title="CI: Em execução" style={{ display: 'inline-flex' }}><Clock size={11} color="#f59e0b" /></span>}
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
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <span
                          onClick={() => handleToggleIssueStatus(iss.id)}
                          style={{
                            fontSize: 11,
                            fontWeight: '300',
                            padding: '2px 7px',
                            borderRadius: 4,
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            whiteSpace: 'nowrap',
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
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', alignItems: 'center' }}>
                          {iss.assignees.length === 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAssignToMe(iss.id);
                              }}
                              title="Atribuir a mim"
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '2px 7px',
                                borderRadius: 4,
                                border: `1px dashed ${hexToRgba(theme.textSecondary, 0.3)}`,
                                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                                color: theme.textSecondary,
                                fontSize: 10.5,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                whiteSpace: 'nowrap',
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = accentColor;
                                e.currentTarget.style.borderColor = accentColor;
                                e.currentTarget.style.background = hexToRgba(accentColor, 0.1);
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = theme.textSecondary;
                                e.currentTarget.style.borderColor = hexToRgba(theme.textSecondary, 0.3);
                                e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                              }}
                            >
                              <UserCheck size={11} />
                              <span>Assign to me</span>
                            </button>
                          ) : (
                            iss.assignees.map((a, i) => (
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
                          ))
                        )}
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
        </div>
        )}

        {/* Modal de Nova Tarefa (Fluxo idêntico ao GitHub: Escolha de Template -> Formulário com IA) */}
        {isAddTaskModalOpen && (
          <div
            onClick={() => !isCreatingTask && setIsAddTaskModalOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.72)',
              backdropFilter: 'blur(5px)',
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
                maxWidth: isModalMaximized ? 880 : taskModalStep === 'choose_template' ? 560 : 660,
                maxHeight: '90vh',
                background: theme.modalBg,
                borderRadius: 12,
                border: theme.modalBorder,
                boxShadow: theme.modalShadow,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                transition: 'max-width 0.2s ease',
              }}
            >
              {/* ========================================================================= */}
              {/* ETAPA 1: ESCOLHA DE TEMPLATE (SEM BORDAS, NO PADRÃO DO SISTEMA)           */}
              {/* ========================================================================= */}
              {taskModalStep === 'choose_template' ? (
                <>
                  {/* Cabeçalho do Modal */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '18px 20px 10px',
                      borderBottom: 'none',
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14.5,
                        fontWeight: 600,
                        color: theme.textPrimary,
                      }}
                    >
                      Nova tarefa
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setIsModalMaximized((prev) => !prev)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: theme.textSecondary,
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title={isModalMaximized ? 'Restaurar tamanho' : 'Maximizar'}
                      >
                        {isModalMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddTaskModalOpen(false)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: theme.textSecondary,
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Fechar (Esc)"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Lista de Opções (Sem bordas, cards suaves com hover) */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '6px 10px 12px' }}>
                    {/* Opção 1: Bug */}
                    <div
                      onClick={() => applyIssueTemplate('bug')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: theme.textPrimary }}>
                          Bug
                        </span>
                        <span style={{ fontSize: 12, color: theme.textSecondary }}>
                          Reporte de defeito em funcionalidade existente
                        </span>
                      </div>
                      <ArrowRight size={15} color={theme.textSecondary} />
                    </div>

                    {/* Opção 2: Tarefa / Feature */}
                    <div
                      onClick={() => applyIssueTemplate('feature')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: theme.textPrimary }}>
                          Tarefa / Feature
                        </span>
                        <span style={{ fontSize: 12, color: theme.textSecondary }}>
                          Task de sprint seguindo o processo de desenvolvimento AppMoove (Fase 9/10)
                        </span>
                      </div>
                      <ArrowRight size={15} color={theme.textSecondary} />
                    </div>

                    {/* Opção 3: Tarefa em branco */}
                    <div
                      onClick={() => applyIssueTemplate('blank')}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '12px 14px',
                        borderRadius: 6,
                        border: 'none',
                        cursor: 'pointer',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: theme.textPrimary }}>
                          Tarefa em branco
                        </span>
                        <span style={{ fontSize: 12, color: theme.textSecondary }}>
                          Criar uma nova tarefa limpa a partir do zero
                        </span>
                      </div>
                      <ArrowRight size={15} color={theme.textSecondary} />
                    </div>
                  </div>
                </>
              ) : (
                /* ========================================================================= */
                /* ETAPA 2: FORMULÁRIO DE ISSUE (SEM BORDAS, NO PADRÃO DO SISTEMA)           */
                /* ========================================================================= */
                <>
                  {/* Cabeçalho do Formulário */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '16px 20px 10px',
                      borderBottom: 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                      <button
                        type="button"
                        onClick={() => setTaskModalStep('choose_template')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: theme.textSecondary,
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Voltar aos templates"
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <span
                        style={{
                          fontSize: 14,
                          fontWeight: 600,
                          color: theme.textPrimary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        Nova tarefa em {selectedProject?.fullName || selectedProject?.title || 'repositório'}:{' '}
                        {selectedTemplate === 'bug' ? 'Bug' : selectedTemplate === 'feature' ? 'Tarefa / Feature' : 'Tarefa em branco'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setIsModalMaximized((prev) => !prev)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: theme.textSecondary,
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title={isModalMaximized ? 'Restaurar tamanho' : 'Maximizar'}
                      >
                        {isModalMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsAddTaskModalOpen(false)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: theme.textSecondary,
                          cursor: 'pointer',
                          padding: 4,
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        title="Fechar (Esc)"
                      >
                        <X size={15} />
                      </button>
                    </div>
                  </div>

                  {/* Seletor rápido de template */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '0 20px 10px',
                      borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                    }}
                  >
                    <span style={{ fontSize: 11.5, color: theme.textSecondary, fontWeight: 500, marginRight: 2 }}>Template:</span>
                    {(['blank', 'bug', 'feature'] as const).map((tKey) => {
                      const isSel = selectedTemplate === tKey;
                      const label = tKey === 'blank' ? 'Tarefa em branco' : tKey === 'bug' ? 'Bug' : 'Tarefa / Feature';
                      return (
                        <button
                          key={tKey}
                          type="button"
                          onClick={() => applyIssueTemplate(tKey)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: 6,
                            border: 'none',
                            background: isSel ? accentColor : (isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)'),
                            color: isSel ? accentContrastText : theme.textPrimary,
                            fontSize: 12,
                            fontWeight: isSel ? 600 : 400,
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {label}
                        </button>
                      );
                    })}
                  </div>

                  {/* Corpo do Formulário */}
                  <div
                    style={{
                      padding: '16px 20px',
                      overflowY: 'auto',
                      maxHeight: '75vh',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 14,
                    }}
                    className="no-scrollbar"
                  >
                    {/* Título * */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, background: 'transparent' }}>
                      <label style={{ fontSize: 12, fontWeight: '300', color: theme.textSecondary, background: 'transparent' }}>
                        Título <span style={{ color: '#ef4444' }}>*</span>
                      </label>
                      <input
                        type="text"
                        value={newTaskTitle}
                        onChange={(e) => setNewTaskTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                            e.preventDefault();
                            if (!isCreatingTask && newTaskTitle.trim()) handleCreateTask();
                          }
                        }}
                        placeholder="Título da tarefa..."
                        style={{
                          width: '100%',
                          background: theme.modalInputBg,
                          border: theme.modalInputBorder,
                          borderRadius: 6,
                          padding: '8px 12px',
                          fontSize: 13,
                          fontWeight: '300',
                          color: theme.textPrimary,
                          outline: 'none',
                          boxSizing: 'border-box',
                          fontFamily: 'inherit',
                        }}
                      />
                    </div>

                    {/* Descrição */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 12, fontWeight: '300', color: theme.textSecondary }}>
                        Descrição
                      </label>

                      <div
                        style={{
                          border: 'none',
                          borderRadius: 6,
                          background: theme.modalInputBg,
                          overflow: 'visible',
                          display: 'flex',
                          flexDirection: 'column',
                        }}
                      >
                        {/* Barra Superior de Abas e Ferramentas Markdown */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                            borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'}`,
                            gap: 6,
                            borderTopLeftRadius: 6,
                            borderTopRightRadius: 6,
                          }}
                        >
                          {/* Abas: Escrever | Pré-visualizar */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <button
                              type="button"
                              onClick={() => setDescriptionTab('write')}
                              style={{
                                background: descriptionTab === 'write' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#ffffff') : 'transparent',
                                border: 'none',
                                borderRadius: 4,
                                padding: '3px 8px',
                                fontSize: 11.5,
                                fontWeight: descriptionTab === 'write' ? 500 : 400,
                                color: descriptionTab === 'write' ? theme.textPrimary : theme.textSecondary,
                                cursor: 'pointer',
                              }}
                            >
                              Escrever
                            </button>
                            <button
                              type="button"
                              onClick={() => setDescriptionTab('preview')}
                              style={{
                                background: descriptionTab === 'preview' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#ffffff') : 'transparent',
                                border: 'none',
                                borderRadius: 4,
                                padding: '3px 8px',
                                fontSize: 11.5,
                                fontWeight: descriptionTab === 'preview' ? 500 : 400,
                                color: descriptionTab === 'preview' ? theme.textPrimary : theme.textSecondary,
                                cursor: 'pointer',
                              }}
                            >
                              Pré-visualizar
                            </button>
                          </div>

                          {/* Barra de Ferramentas de Markdown */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                            <button
                              type="button"
                              onClick={() => insertMarkdown('### ')}
                              style={{ background: 'transparent', border: 'none', color: theme.textSecondary, padding: '3px 5px', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                              title="Cabeçalho (H)"
                            >
                              <Heading size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertMarkdown('**', '**')}
                              style={{ background: 'transparent', border: 'none', color: theme.textSecondary, padding: '3px 5px', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                              title="Negrito (B)"
                            >
                              <Bold size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertMarkdown('*', '*')}
                              style={{ background: 'transparent', border: 'none', color: theme.textSecondary, padding: '3px 5px', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                              title="Itálico (I)"
                            >
                              <Italic size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertMarkdown('> ')}
                              style={{ background: 'transparent', border: 'none', color: theme.textSecondary, padding: '3px 5px', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                              title="Citação"
                            >
                              <Quote size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertMarkdown('`', '`')}
                              style={{ background: 'transparent', border: 'none', color: theme.textSecondary, padding: '3px 5px', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                              title="Código (<>)"
                            >
                              <Code size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertMarkdown('[', '](https://)')}
                              style={{ background: 'transparent', border: 'none', color: theme.textSecondary, padding: '3px 5px', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                              title="Link"
                            >
                              <Link2 size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertMarkdown('- ')}
                              style={{ background: 'transparent', border: 'none', color: theme.textSecondary, padding: '3px 5px', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                              title="Lista não ordenada"
                            >
                              <List size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertMarkdown('1. ')}
                              style={{ background: 'transparent', border: 'none', color: theme.textSecondary, padding: '3px 5px', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                              title="Lista numerada"
                            >
                              <ListOrdered size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertMarkdown('- [ ] ')}
                              style={{ background: 'transparent', border: 'none', color: theme.textSecondary, padding: '3px 5px', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                              title="Checklist de tarefas"
                            >
                              <ListChecks size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => insertMarkdown('@')}
                              style={{ background: 'transparent', border: 'none', color: theme.textSecondary, padding: '3px 5px', cursor: 'pointer', borderRadius: 4, display: 'flex', alignItems: 'center' }}
                              title="Mencionar (@)"
                            >
                              <AtSign size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Conteúdo: Textarea (Write) ou Pré-visualização (Preview) */}
                        {descriptionTab === 'write' ? (
                          <textarea
                            ref={textareaRef}
                            value={newTaskDescription}
                            onChange={(e) => setNewTaskDescription(e.target.value)}
                            onKeyDown={(e) => {
                              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                                e.preventDefault();
                                if (!isCreatingTask && newTaskTitle.trim()) handleCreateTask();
                              }
                            }}
                            placeholder="Digite a descrição da tarefa..."
                            rows={8}
                            style={{
                              width: '100%',
                              minHeight: 180,
                              background: 'transparent',
                              border: 'none',
                              padding: '10px 12px',
                              fontSize: 12.5,
                              color: theme.textPrimary,
                              outline: 'none',
                              resize: 'vertical',
                              fontFamily: 'inherit',
                              lineHeight: 1.55,
                              boxSizing: 'border-box',
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              minHeight: 180,
                              maxHeight: 360,
                              overflowY: 'auto',
                              padding: '10px 12px',
                              boxSizing: 'border-box',
                            }}
                          >
                            {!newTaskDescription.trim() ? (
                              <div style={{ color: theme.textSecondary, fontStyle: 'italic', fontSize: 12.5 }}>
                                Nada para pré-visualizar ainda.
                              </div>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, lineHeight: 1.55, color: theme.textPrimary }}>
                                {newTaskDescription.split('\n').map((line, idx) => {
                                  if (line.startsWith('### ')) {
                                    return <div key={idx} style={{ fontSize: 13.5, fontWeight: 600, marginTop: 8, color: theme.textPrimary }}>{line.slice(4)}</div>;
                                  }
                                  if (line.startsWith('## ')) {
                                    return <div key={idx} style={{ fontSize: 14.5, fontWeight: 600, marginTop: 10, color: theme.textPrimary }}>{line.slice(3)}</div>;
                                  }
                                  if (line.startsWith('# ')) {
                                    return <div key={idx} style={{ fontSize: 16, fontWeight: 700, marginTop: 12, color: theme.textPrimary }}>{line.slice(2)}</div>;
                                  }
                                  if (line.startsWith('- [ ] ') || line.startsWith('- [x] ')) {
                                    const checked = line.startsWith('- [x] ');
                                    return (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 7, marginLeft: 4 }}>
                                        {checked ? (
                                          <CheckSquare size={13} color={accentColor} />
                                        ) : (
                                          <Square size={13} color={theme.textSecondary} />
                                        )}
                                        <span>{line.slice(6)}</span>
                                      </div>
                                    );
                                  }
                                  if (line.startsWith('- ') || line.startsWith('* ')) {
                                    return (
                                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 6 }}>
                                        <span style={{ width: 4, height: 4, borderRadius: '50%', background: theme.textSecondary }} />
                                        <span>{line.slice(2)}</span>
                                      </div>
                                    );
                                  }
                                  if (line.startsWith('> ')) {
                                    return (
                                      <div key={idx} style={{ borderLeft: `3px solid ${accentColor}`, paddingLeft: 8, color: theme.textSecondary, fontStyle: 'italic' }}>
                                        {line.slice(2)}
                                      </div>
                                    );
                                  }
                                  if (line.trim() === '') {
                                    return <div key={idx} style={{ height: 4 }} />;
                                  }
                                  return <div key={idx}>{line}</div>;
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Barra Inferior Interna do Editor: Anexo + Opção com IA */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            borderTop: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'}`,
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.01)',
                            gap: 8,
                            borderBottomLeftRadius: 6,
                            borderBottomRightRadius: 6,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: theme.textSecondary }}>
                            <Paperclip size={12} />
                            <span>Anexar arquivos</span>
                          </div>

                          {/* Seletor de IA e Modelo + Botão de Geração */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                            {/* Pill Seletor de IA e Modelo */}
                            <div
                              onClick={() => {
                                setIsAiSelectorOpen((prev) => !prev);
                                setActiveSubmenuProvider(localAiProvider);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                background: isAiSelectorOpen
                                  ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                                  : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'),
                                border: 'none',
                                borderRadius: 6,
                                padding: '4px 8px',
                                cursor: 'pointer',
                                fontSize: 11.5,
                                color: theme.textPrimary,
                                transition: 'all 0.15s ease',
                                userSelect: 'none',
                              }}
                              onMouseEnter={(e) => {
                                if (!isAiSelectorOpen) {
                                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.07)';
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isAiSelectorOpen) {
                                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
                                }
                              }}
                              title="Clique para trocar a IA e o modelo"
                            >
                              <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                {renderAiIcon(localAiProvider, 14)}
                              </div>
                              <span style={{ fontWeight: 600, color: theme.textPrimary, fontSize: 12 }}>
                                {AI_PROVIDERS.find((p) => p.id === localAiProvider)?.name || 'IA'}
                              </span>
                              <span style={{ color: theme.textSecondary, opacity: 0.6, fontSize: 11 }}>•</span>
                              <span style={{ color: theme.textSecondary, fontSize: 11.5, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {localAiModel}
                              </span>
                              <ChevronDown
                                size={12}
                                color={theme.textSecondary}
                                style={{
                                  transform: isAiSelectorOpen ? 'rotate(180deg)' : 'none',
                                  transition: 'transform 0.15s ease',
                                }}
                              />
                            </div>

                            {/* Dropdown Menu de IA e Modelos (Padrão do sistema, sem bordas) */}
                            {isAiSelectorOpen && (
                              <>
                                <div
                                  style={{ position: 'fixed', inset: 0, zIndex: 99998 }}
                                  onClick={() => setIsAiSelectorOpen(false)}
                                />
                                <div
                                  style={{
                                    position: 'absolute',
                                    bottom: 'calc(100% + 6px)',
                                    right: 0,
                                    background: theme.dropdownBg,
                                    border: 'none',
                                    borderRadius: 10,
                                    boxShadow: theme.dropdownShadow,
                                    padding: '6px',
                                    zIndex: 99999,
                                    minWidth: 210,
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: 2,
                                    animation: 'fadeIn 0.12s ease-out',
                                  }}
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <div style={{ padding: '4px 8px 6px', fontSize: 10.5, fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                    Selecionar IA & Modelo
                                  </div>

                                  {AI_PROVIDERS.map((p, pIdx) => {
                                    const isInstalled = (installedClis && installedClis[p.id] !== undefined) ? installedClis[p.id] : true;
                                    const isSelected = localAiProvider === p.id;
                                    const isSubmenuOpen = activeSubmenuProvider === p.id;
                                    const dynamicList = activeModels?.[p.id]?.models || [];
                                    const fallbackList = (p.models || []).map((mName) => ({ id: mName, label: mName }));
                                    const modelList = dynamicList.length > 0 ? dynamicList : fallbackList;

                                    return (
                                      <div
                                        key={p.id}
                                        style={{ position: 'relative' }}
                                        onMouseEnter={() => {
                                          if (isInstalled) setActiveSubmenuProvider(p.id);
                                        }}
                                      >
                                        <div
                                          onClick={() => {
                                            if (!isInstalled) {
                                              if (onInstallAiCli) onInstallAiCli(p);
                                              else showToast(`Instalação do ${p.name}: ${p.installGuide || p.installUrl}`);
                                              return;
                                            }
                                            handleSelectAiProvider(p.id);
                                          }}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '7px 10px',
                                            borderRadius: 6,
                                            cursor: 'pointer',
                                            background: isSubmenuOpen || isSelected ? theme.dropdownItemHover : 'transparent',
                                            transition: 'background 0.1s ease',
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div style={{ display: 'flex', alignItems: 'center' }}>
                                              {renderAiIcon(p.id, 14)}
                                            </div>
                                            <span style={{ fontSize: 12.5, fontWeight: isSelected ? 600 : 400, color: isSelected ? accentColor : theme.textPrimary }}>
                                              {p.name}
                                            </span>
                                          </div>

                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {!isInstalled && (
                                              <span
                                                style={{
                                                  fontSize: 10,
                                                  padding: '1px 6px',
                                                  borderRadius: 4,
                                                  background: isEffectiveDark ? 'rgba(239, 68, 68, 0.15)' : '#fee2e2',
                                                  color: '#ef4444',
                                                  fontWeight: 500,
                                                }}
                                              >
                                                Instalar
                                              </span>
                                            )}
                                            {isInstalled && modelList.length > 0 && (
                                              <ChevronRight size={13} color={theme.textSecondary} />
                                            )}
                                          </div>
                                        </div>

                                        {/* Submenu de Modelos para esta IA */}
                                        {isSubmenuOpen && isInstalled && modelList.length > 0 && (
                                          <div
                                            style={{
                                              position: 'absolute',
                                              right: 'calc(100% + 4px)',
                                              ...(pIdx <= 1 ? { top: 0 } : { bottom: 0 }),
                                              background: theme.dropdownBg,
                                              border: 'none',
                                              borderRadius: 10,
                                              boxShadow: theme.dropdownShadow,
                                              padding: '6px',
                                              zIndex: 100000,
                                              minWidth: 175,
                                              maxWidth: 240,
                                              maxHeight: 220,
                                              overflowY: 'auto',
                                              display: 'flex',
                                              flexDirection: 'column',
                                              gap: 2,
                                            }}
                                            className="no-scrollbar"
                                            onClick={(e) => e.stopPropagation()}
                                          >
                                            {/* Ponte invisível que conecta o submenu de modelos ao botão da IA */}
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
                                            <div style={{ padding: '3px 8px 5px', fontSize: 10, fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                              Modelos {p.name}
                                            </div>
                                            {modelList.map((m) => {
                                              const isCurrentModel = isSelected && (localAiModel === m.id || localAiModel === m.label);
                                              return (
                                                <div
                                                  key={m.id}
                                                  onClick={() => handleSelectAiModel(m, p.id)}
                                                  style={{
                                                    padding: '6px 10px',
                                                    borderRadius: 6,
                                                    cursor: 'pointer',
                                                    background: isCurrentModel ? hexToRgba(accentColor, 0.15) : 'transparent',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: 8,
                                                    transition: 'background 0.12s ease',
                                                  }}
                                                  onMouseEnter={(e) => {
                                                    if (!isCurrentModel) e.currentTarget.style.background = theme.dropdownItemHover;
                                                  }}
                                                  onMouseLeave={(e) => {
                                                    if (!isCurrentModel) e.currentTarget.style.background = 'transparent';
                                                  }}
                                                >
                                                  {isCurrentModel ? (
                                                    <Check size={12} color={accentColor} style={{ flexShrink: 0 }} />
                                                  ) : (
                                                    <div style={{ width: 12, flexShrink: 0 }} />
                                                  )}
                                                  <span
                                                    style={{
                                                      fontSize: 12,
                                                      fontWeight: isCurrentModel ? 600 : 400,
                                                      color: isCurrentModel ? accentColor : theme.textPrimary,
                                                      whiteSpace: 'nowrap',
                                                      overflow: 'hidden',
                                                      textOverflow: 'ellipsis',
                                                    }}
                                                  >
                                                    {m.label}
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              </>
                            )}

                            {/* Botão de Criação de Descrição com IA */}
                            {getProjectSettings(selectedProject?.fullName).ai.automations.issueDescription && (
                            <button
                              type="button"
                              onClick={handleGenerateAiDescription}
                              disabled={isGeneratingAiDescription}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: hexToRgba(accentColor, 0.14),
                                border: 'none',
                                borderRadius: 6,
                                padding: '4px 10px',
                                color: accentColor,
                                fontSize: 11.5,
                                fontWeight: 500,
                                cursor: isGeneratingAiDescription ? 'default' : 'pointer',
                                opacity: isGeneratingAiDescription ? 0.7 : 1,
                                transition: 'all 0.15s ease',
                              }}
                              title={`Gerar descrição detalhada com ${AI_PROVIDERS.find((p) => p.id === localAiProvider)?.name || 'IA'} (${localAiModel})`}
                            >
                              <span>
                                {isGeneratingAiDescription
                                  ? 'Gerando...'
                                  : 'Gerar com IA'}
                              </span>
                            </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Chips e Nota de Diretrizes do Repositório */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span
                          style={{
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                            borderRadius: 12,
                            padding: '3px 10px',
                            fontSize: 11,
                            color: theme.textPrimary,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 6,
                            fontWeight: 500,
                            border: 'none',
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: selectedTemplate === 'bug' ? '#ef4444' : accentColor,
                            }}
                          />
                          Label ● {selectedTemplate === 'bug' ? 'tipo:fix' : selectedTemplate === 'feature' ? 'tipo:feature' : 'tipo:task'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: theme.textSecondary }}>
                        <BookOpen size={12} />
                        <span>
                          Siga as{' '}
                          <span
                            onClick={() => showToast('Diretrizes de contribuição abertas.')}
                            style={{ color: accentColor, textDecoration: 'underline', cursor: 'pointer' }}
                          >
                            diretrizes de contribuição
                          </span>{' '}
                          deste repositório.
                        </span>
                      </div>
                    </div>

                    {/* Linha de Metadados: Sprint, Prioridade, Status */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                        gap: 12,
                        marginTop: 4,
                        padding: '10px 12px',
                        borderRadius: 6,
                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                        border: 'none',
                      }}
                    >
                      {/* Sprint */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: 11.5, color: theme.textSecondary, fontWeight: '300' }}>Sprint (Milestone)</label>
                        <select
                          value={newTaskMilestoneNumber ?? ''}
                          onChange={(e) => setNewTaskMilestoneNumber(e.target.value ? Number(e.target.value) : null)}
                          style={{
                            background: theme.modalInputBg,
                            border: 'none',
                            borderRadius: 6,
                            padding: '7px 10px',
                            color: theme.textPrimary,
                            fontSize: 12,
                            fontWeight: '300',
                            fontFamily: 'inherit',
                            outline: 'none',
                          }}
                        >
                          <option value="">Sem sprint</option>
                          {sprintsForSelectedRepo.filter((s) => s.state === 'open' && !s.isProjectIteration && !s.isVirtual).map((s) => (
                            <option key={s.number} value={s.number}>
                              {s.title}
                              {s.dueDateIso ? ` (até ${formatShortDate(s.dueDateIso)})` : ''}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Prioridade */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: 11.5, color: theme.textSecondary, fontWeight: '300' }}>Prioridade</label>
                        <select
                          value={newTaskPriority}
                          onChange={(e) => setNewTaskPriority(e.target.value as any)}
                          style={{
                            background: theme.modalInputBg,
                            border: 'none',
                            borderRadius: 6,
                            padding: '7px 10px',
                            color: theme.textPrimary,
                            fontSize: 12,
                            fontWeight: '300',
                            fontFamily: 'inherit',
                            outline: 'none',
                          }}
                        >
                          <option value="Baixa">Baixa</option>
                          <option value="Média">Média</option>
                          <option value="Alta">Alta</option>
                          <option value="Urgente">Urgente</option>
                        </select>
                      </div>

                      {/* Status */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                        <label style={{ fontSize: 11.5, color: theme.textSecondary, fontWeight: '300' }}>Status Inicial</label>
                        <select
                          value={newTaskStatus}
                          onChange={(e) => setNewTaskStatus(e.target.value as any)}
                          style={{
                            background: theme.modalInputBg,
                            border: 'none',
                            borderRadius: 6,
                            padding: '7px 10px',
                            color: theme.textPrimary,
                            fontSize: 12,
                            fontWeight: '300',
                            fontFamily: 'inherit',
                            outline: 'none',
                          }}
                        >
                          <option value="A Fazer">A Fazer</option>
                          <option value="Em Progresso">Em Progresso</option>
                          <option value="Concluído">Concluído</option>
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Rodapé do Formulário (Criar outra em seguida, Cancelar, Criar Tarefa) */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px 20px',
                      borderTop: 'none',
                    }}
                  >
                    {/* Checkbox: Criar outra em seguida */}
                    <div
                      onClick={() => setIsCreateMoreChecked(!isCreateMoreChecked)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        fontSize: 12.5,
                        color: isCreateMoreChecked ? theme.textPrimary : theme.textSecondary,
                        cursor: 'pointer',
                        userSelect: 'none',
                        transition: 'color 0.15s ease',
                      }}
                    >
                      {isCreateMoreChecked ? (
                        <CheckSquare size={16} color={accentColor} />
                      ) : (
                        <Square size={16} color={theme.textSecondary} />
                      )}
                      <span>Criar outra em seguida</span>
                    </div>

                    {/* Botões de Ação no padrão do sistema */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
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
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        {isCreatingTask ? 'Criando...' : 'Criar Tarefa'}
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Sidesheet de Detalhes da Issue (no padrão GitHub) */}
        <IssueDetailSidesheet
          isOpen={Boolean(activeSidesheetIssue)}
          issue={activeSidesheetIssue}
          allProjectIssues={rawProjectIssues}
          repoFullName={
            allCards.find((c) => c.id === activeSidesheetIssue?.projectId)?.fullName ||
            selectedProject?.fullName
          }
          isRepoPrivate={
            allCards.find((c) => c.id === activeSidesheetIssue?.projectId)?.isPrivate ??
            selectedProject?.isPrivate
          }
          collaborators={collaboratorsForSelectedRepo}
          availableSprints={sprintsForSelectedRepo}
          theme={theme}
          isEffectiveDark={isEffectiveDark}
          accentColor={accentColor}
          accentContrastText={accentContrastText}
          currentUser={currentUser}
          onClose={() => {
            setActiveSidesheetIssue(null);
            setEditingIssue(null);
          }}
          onUpdateIssue={handleSidesheetUpdateIssue}
          onIssuePatched={(iss, patch) => {
            const card = allCards.find((c) => c.id === iss.projectId) || selectedProject;
            if (card) patchIssueInRepoCache(card, iss.id, (i) => ({ ...i, ...patch }));
          }}
          onDeleteIssue={handleDeleteIssue}
          onCreateBranchForIssue={(issue) => {
            const slug = (issue.title || 'issue')
              .toLowerCase()
              .replace(/[^a-z0-9]+/g, '-')
              .replace(/^-+|-+$/g, '')
              .slice(0, 30);
            const branchName = `issue-${issue.githubNumber || issue.id}-${slug}`;
            navigator.clipboard?.writeText?.(`git checkout -b ${branchName}`);
            showToast(`Comando copiado: git checkout -b ${branchName}`);
          }}
          onAskAiAboutIssue={(issue) => {
            const contextPrompt = `Contexto da Issue #${issue.githubNumber || issue.id}: "${issue.title}"\nDescrição: ${issue.description || 'Sem descrição'}\nStatus: ${issue.status}, Prioridade: ${issue.priority}`;
            navigator.clipboard?.writeText?.(contextPrompt);
            showToast('Contexto da issue copiado para o assistente de IA.');
          }}
          showToast={showToast}
        />

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
                  {Array.from(new Set([7, 15, getProjectSettings(selectedProject?.fullName).sprint.durationDays])).sort((a, b) => a - b).map((d) => (
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

        {/* Modal para Adicionar GitHub Project da Organização */}
        {isAddCustomProjectModalOpen && (
          <div
            onClick={() => setIsAddCustomProjectModalOpen(false)}
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(4px)',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 16,
            }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                width: '100%',
                maxWidth: 440,
                background: theme.cardBg,
                border: theme.cardBorder,
                borderRadius: 14,
                boxShadow: theme.dropdownShadow,
                padding: '22px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <FolderKanban size={18} color={accentColor} />
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: theme.textPrimary }}>
                      Adicionar GitHub Project
                    </h3>
                    <p style={{ margin: '2px 0 0', fontSize: 12, color: theme.textSecondary }}>
                      {selectedOrg !== 'Todas' ? `Organização: ${selectedOrg}` : 'GitHub Projects'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsAddCustomProjectModalOpen(false)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: theme.textSecondary,
                    cursor: 'pointer',
                    fontSize: 18,
                    padding: 4,
                  }}
                >
                  ×
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: theme.textSecondary, marginBottom: 5 }}>
                    Título / Nome do Project (opcional)
                  </label>
                  <input
                    type="text"
                    value={customProjectInputTitle}
                    onChange={(e) => setCustomProjectInputTitle(e.target.value)}
                    placeholder="ex: Sprint Board Mobile"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: theme.controlBorder,
                      background: theme.controlBg,
                      color: theme.textPrimary,
                      fontSize: 13,
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 500, color: theme.textSecondary, marginBottom: 5 }}>
                    URL ou Número do Project *
                  </label>
                  <input
                    type="text"
                    value={customProjectInputUrl}
                    onChange={(e) => setCustomProjectInputUrl(e.target.value)}
                    placeholder="ex: https://github.com/orgs/appmoove/projects/1 ou 1"
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: 8,
                      border: theme.controlBorder,
                      background: theme.controlBg,
                      color: theme.textPrimary,
                      fontSize: 13,
                      boxSizing: 'border-box',
                      outline: 'none',
                    }}
                  />
                  <span style={{ fontSize: 11, color: theme.textSecondary, marginTop: 4, display: 'block' }}>
                    Cole o link do board no GitHub ou digite o número do project.
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
                <button
                  type="button"
                  onClick={() => setIsAddCustomProjectModalOpen(false)}
                  style={{
                    padding: '7px 14px',
                    borderRadius: 8,
                    border: theme.controlBorder,
                    background: 'transparent',
                    color: theme.textPrimary,
                    fontSize: 13,
                    cursor: 'pointer',
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  disabled={!customProjectInputUrl.trim()}
                  onClick={() => {
                    const raw = customProjectInputUrl.trim();
                    let projectNum = 1;
                    const match = raw.match(/projects\/(\d+)/);
                    if (match) {
                      projectNum = parseInt(match[1], 10);
                    } else {
                      const num = parseInt(raw, 10);
                      if (!isNaN(num) && num > 0) projectNum = num;
                    }
                    const title = customProjectInputTitle.trim() || `Project #${projectNum}`;
                    const url = raw.startsWith('http') ? raw : `https://github.com/orgs/${selectedOrg !== 'Todas' ? selectedOrg : 'appmoove'}/projects/${projectNum}`;
                    const newProj: GithubOrgProjectItem = {
                      id: `custom_${Date.now()}`,
                      number: projectNum,
                      title,
                      url,
                      isCustom: true,
                      updatedAt: new Date().toISOString(),
                    };
                    const updated = [...githubOrgProjects, newProj];
                    setGithubOrgProjects(updated);
                    saveCustomProjects(selectedOrg, updated.filter((p) => p.isCustom));
                    setSelectedGithubProjectNumber(projectNum);
                    setIsAddCustomProjectModalOpen(false);
                  }}
                  style={{
                    padding: '7px 16px',
                    borderRadius: 8,
                    border: 'none',
                    background: accentColor,
                    color: '#ffffff',
                    fontSize: 13,
                    fontWeight: 500,
                    cursor: customProjectInputUrl.trim() ? 'pointer' : 'not-allowed',
                    opacity: customProjectInputUrl.trim() ? 1 : 0.5,
                  }}
                >
                  Salvar Project
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Confirmação de Exclusão (Padrão DevFlow para Deletar Recursos) */}
        <ConfirmDeleteModal
          isOpen={deleteConfirmState.isOpen}
          title={deleteConfirmState.title}
          message={deleteConfirmState.message}
          itemDescription={deleteConfirmState.itemDescription}
          confirmLabel={deleteConfirmState.confirmLabel}
          isDeleting={deleteConfirmState.isDeleting}
          themeTokens={theme}
          accentColor={accentColor}
          onClose={() => setDeleteConfirmState((prev) => ({ ...prev, isOpen: false }))}
          onConfirm={deleteConfirmState.onConfirm}
        />

        {/* Modal de Resumo Executivo da Sprint com IA */}
        {aiSprintSummaryModal?.isOpen && (
          <div
            onClick={() => setAiSprintSummaryModal(null)}
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
                maxHeight: '80vh',
                background: theme.modalBg,
                borderRadius: 12,
                border: theme.modalBorder,
                padding: 24,
                display: 'flex',
                flexDirection: 'column',
                gap: 16,
                boxShadow: theme.modalShadow,
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Sparkles size={18} color={accentColor} />
                  <span style={{ fontSize: 14.5, fontWeight: 600, color: theme.textPrimary }}>
                    Resumo da Sprint com IA • {aiSprintSummaryModal.projectName}
                  </span>
                </div>
                <div
                  onClick={() => setAiSprintSummaryModal(null)}
                  style={{ width: 26, height: 26, borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: theme.textSecondary }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
                >
                  <X size={16} />
                </div>
              </div>

              <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>
                {aiSprintSummaryModal.isLoading ? (
                  <div style={{ padding: '40px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: theme.textSecondary }}>
                    <div className="animate-spin" style={{ width: 28, height: 28, border: `3px solid ${accentColor}`, borderTopColor: 'transparent', borderRadius: '50%' }} />
                    <span style={{ fontSize: 13 }}>Analisando métricas e tarefas com IA...</span>
                  </div>
                ) : (
                  <div
                    style={{
                      background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
                      border: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                      borderRadius: 8,
                      padding: 16,
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: theme.textPrimary,
                      whiteSpace: 'pre-wrap',
                      fontFamily: "'Poppins', -apple-system, sans-serif",
                    }}
                  >
                    {aiSprintSummaryModal.summary}
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 4 }}>
                {!aiSprintSummaryModal.isLoading && aiSprintSummaryModal.summary && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(aiSprintSummaryModal.summary);
                      showToast('Resumo copiado para a área de transferência!');
                    }}
                    style={{
                      background: 'transparent',
                      border: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)'}`,
                      borderRadius: 6,
                      padding: '8px 16px',
                      color: theme.textPrimary,
                      fontSize: 12.5,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <Copy size={13} />
                    <span>Copiar Resumo</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setAiSprintSummaryModal(null)}
                  style={{
                    background: accentColor,
                    border: 'none',
                    borderRadius: 6,
                    padding: '8px 18px',
                    color: accentContrastText,
                    fontSize: 12.5,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dropdown Menu Flutuante de Opções do Projeto (Fixed Position - Nunca corta) */}
        {activeProjectMenu && createPortal(
          <>
            {/* Backdrop invisível para fechar ao clicar fora */}
            <div
              style={{
                position: 'fixed',
                inset: 0,
                zIndex: 999998,
                background: 'transparent',
              }}
              onClick={() => setActiveProjectMenu(null)}
            />

            {/* Menu Dropdown Flutuante */}
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                top:
                  activeProjectMenu.anchorRect.bottom + 340 > window.innerHeight - 16
                    ? Math.max(16, activeProjectMenu.anchorRect.top - 340)
                    : activeProjectMenu.anchorRect.bottom + 6,
                left: Math.min(
                  Math.max(12, activeProjectMenu.anchorRect.right - 230),
                  window.innerWidth - 242
                ),
                zIndex: 999999,
                width: 230,
                background: theme.dropdownBg,
                borderRadius: 8,
                border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                boxShadow: theme.dropdownShadow,
                padding: '4px',
                display: 'flex',
                flexDirection: 'column',
                gap: 1,
                backdropFilter: 'blur(16px)',
                fontFamily: "'Poppins', -apple-system, sans-serif",
                animation: 'fadeIn 0.12s ease-out',
              }}
            >
              {/* Header com nome do projeto */}
              <div
                style={{
                  padding: '5px 8px',
                  fontSize: 11,
                  fontWeight: 600,
                  color: theme.textPrimary,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}`,
                  marginBottom: 2,
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: 170,
                  }}
                  title={activeProjectMenu.card.title}
                >
                  {activeProjectMenu.card.title}
                </span>
                {activeProjectMenu.card.fullName &&
                  pinnedProjectFullNames.includes(activeProjectMenu.card.fullName) && (
                    <Pin size={11} color={accentColor} style={{ transform: 'rotate(45deg)' }} />
                  )}
              </div>

              {/* DEFINIR COMO PROJETO ATIVO NO EDITOR / HEADER */}
              {onSelectWorkspace && activeWorkspaceMatchingCard?.id !== activeProjectMenu.card.id && (
                <div
                  onClick={async () => {
                    const card = activeProjectMenu.card;
                    setActiveProjectMenu(null);
                    let targetDir = card.repoName ? `/Users/walancy/Documents/codes/${card.repoName}` : '';
                    if (card.repoName === 'aura-dev' || card.name === 'aura-dev') {
                      targetDir = '/Users/walancy/Documents/codes/devflow-desktop';
                    }
                    await onSelectWorkspace(targetDir || card.name, card.repoName || card.name);
                    showToast(`Projeto ativo alterado para ${card.title}.`);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 8px',
                    borderRadius: 6,
                    fontSize: 12,
                    color: accentColor,
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <FolderGit2 size={13.5} color={accentColor} />
                  <span>Definir como Projeto Ativo</span>
                </div>
              )}

              {/* SEÇÃO 1: IA & SPRINT */}
              <div
                onClick={() => {
                  handleGenerateSprintSummary(activeProjectMenu.card);
                  setActiveProjectMenu(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Sparkles size={13.5} color={accentColor} />
                <span>Resumo da Sprint (IA)</span>
              </div>

              {/* DIVISOR */}
              <div
                style={{
                  height: 1,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                  margin: '3px 4px',
                }}
              />

              {/* SEÇÃO 2: GITHUB & ARQUIVOS */}
              <div
                onClick={() => {
                  const url =
                    activeProjectMenu.card.htmlUrl ||
                    (activeProjectMenu.card.fullName ? `https://github.com/${activeProjectMenu.card.fullName}` : '');
                  if (url && window.electronAPI?.shell?.openExternal) {
                    window.electronAPI.shell.openExternal(url);
                  }
                  setActiveProjectMenu(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Globe size={13.5} color={theme.textSecondary} />
                <span style={{ flex: 1 }}>Abrir no GitHub</span>
                <ExternalLink size={11} color={theme.textMuted} />
              </div>

              <div
                onClick={() => {
                  handleCloneRepository(activeProjectMenu.card);
                  setActiveProjectMenu(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <FolderDown size={13.5} color={theme.textSecondary} />
                <span>
                  {cloneLoadingRepoId === activeProjectMenu.card.id
                    ? 'Clonando repositório...'
                    : 'Clonar Repositório'}
                </span>
              </div>

              <div
                onClick={() => {
                  handleOpenTerminalForProject(activeProjectMenu.card);
                  setActiveProjectMenu(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <SquareTerminal size={13.5} color={theme.textSecondary} />
                <span>Abrir no Terminal</span>
              </div>

              {/* DIVISOR */}
              <div
                style={{
                  height: 1,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                  margin: '3px 4px',
                }}
              />

              {/* SEÇÃO 3: AÇÕES RÁPIDAS */}
              <div
                onClick={() => {
                  openAddTaskModal();
                  setActiveProjectMenu(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Plus size={13.5} color={accentColor} />
                <span>Nova Tarefa neste Projeto</span>
              </div>

              <div
                onClick={() => {
                  const cloneUrl = activeProjectMenu.card.htmlUrl
                    ? `${activeProjectMenu.card.htmlUrl}.git`
                    : `https://github.com/${activeProjectMenu.card.fullName}.git`;
                  navigator.clipboard.writeText(cloneUrl);
                  showToast('URL de clone copiada!');
                  setActiveProjectMenu(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Copy size={13.5} color={theme.textSecondary} />
                <span>Copiar URL de Clone</span>
              </div>

              {/* DIVISOR */}
              <div
                style={{
                  height: 1,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                  margin: '3px 4px',
                }}
              />

              {/* SEÇÃO 4: GESTÃO & FIXAÇÃO */}
              <div
                onClick={() => {
                  if (activeProjectMenu.card.fullName) {
                    togglePinProject(activeProjectMenu.card.fullName);
                  }
                  setActiveProjectMenu(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Pin
                    size={13.5}
                    color={
                      activeProjectMenu.card.fullName &&
                      pinnedProjectFullNames.includes(activeProjectMenu.card.fullName)
                        ? accentColor
                        : theme.textSecondary
                    }
                  />
                  <span>
                    {activeProjectMenu.card.fullName &&
                    pinnedProjectFullNames.includes(activeProjectMenu.card.fullName)
                      ? 'Desafixar do Topo'
                      : 'Fixar no Topo'}
                  </span>
                </div>
              </div>

              <div
                onClick={() => {
                  if (activeProjectMenu.card.fullName) {
                    fetchRepoDetails(activeProjectMenu.card.fullName, true);
                    showToast(`Dados de ${activeProjectMenu.card.title} sincronizados.`);
                  }
                  setActiveProjectMenu(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <RefreshCw size={13.5} color={theme.textSecondary} />
                <span>Sincronizar com GitHub</span>
              </div>

              <div
                onClick={() => {
                  setIconModalProject(activeProjectMenu.card);
                  setActiveProjectMenu(null);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 8px',
                  borderRadius: 6,
                  fontSize: 12,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  transition: 'background 0.12s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <ImageIcon size={13.5} color={theme.textSecondary} />
                <span>Alterar Ícone do Projeto</span>
              </div>
            </div>
          </>,
          document.body
        )}

        {/* Modal de Personalização do Ícone do Projeto (Sem clonar) */}
        {iconModalProject && (
          <ProjectIconModal
            isOpen={Boolean(iconModalProject)}
            project={iconModalProject}
            currentCustomIcon={
              customProjectIcons[iconModalProject.fullName || ''] ||
              customProjectIcons[iconModalProject.title] ||
              customProjectIcons[String(iconModalProject.id)]
            }
            themeTokens={themeTokens}
            accentColor={accentColor}
            isEffectiveDark={isEffectiveDark}
            onSave={(iconUrlOrData) => {
              const projectKey = iconModalProject.fullName || iconModalProject.title || String(iconModalProject.id);
              saveCustomProjectIcon(projectKey, iconUrlOrData);
              showToast(`Ícone de "${iconModalProject.title}" salvo com sucesso!`);
            }}
            onRemove={() => {
              const projectKey = iconModalProject.fullName || iconModalProject.title || String(iconModalProject.id);
              removeCustomProjectIcon(projectKey);
              showToast(`Ícone de "${iconModalProject.title}" restaurado para o padrão.`);
            }}
            onClose={() => setIconModalProject(null)}
          />
        )}

        {/* Toast Notificação de Feedback Rápido */}
        {toastMessage && (
          <div
            style={{
              position: 'fixed',
              bottom: 30,
              left: '50%',
              transform: 'translateX(-50%)',
              background: isEffectiveDark ? '#1e1e1e' : '#111111',
              color: '#ffffff',
              padding: '10px 18px',
              borderRadius: 8,
              boxShadow: 'none',
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

// =========================================================================
// DETALHE DE SPRINT: lista compacta de sprints + tarefas da sprint aberta
// (lista ou calendário), edição de datas e adição/remoção de tarefas.
// =========================================================================
function SprintDetailPanel(props: {
  allCards?: ProjectCardData[];
  selectedProject?: ProjectCardData;
  onSelectProject?: (projectId: number | string) => void;
  currentUser?: { login: string; avatarUrl: string } | null;
  theme: any;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  combinedSprints: GithubSprintItem[];
  openedSprint: GithubSprintItem | null;
  onSelectSprint: (sprintId: string) => void;
  onDeleteSprint?: (sprintId: string) => void;
  onCreateSprint?: () => void;
  sprintSidebarFilter: 'all' | 'active' | 'completed';
  setSprintSidebarFilter: (f: 'all' | 'active' | 'completed') => void;
  verticalCalendarDate: Date;
  setVerticalCalendarDate: (d: Date | ((prev: Date) => Date)) => void;
  selectedCalendarDayIso: string | null;
  setSelectedCalendarDayIso: (iso: string | null | ((prev: string | null) => string | null)) => void;
  sprintDetailViewMode: 'list' | 'issues' | 'calendar' | 'roadmap' | 'kanban';
  setSprintDetailViewMode: (mode: 'list' | 'issues' | 'calendar' | 'roadmap' | 'kanban') => void;
  isEditingSprintDates: boolean;
  editSprintStartDate: string;
  editSprintDueDate: string;
  setEditSprintStartDate: (v: string) => void;
  setEditSprintDueDate: (v: string) => void;
  isSavingSprintDates: boolean;
  onStartEditSprintDates: () => void;
  onCancelEditSprintDates: () => void;
  onSaveSprintDates: () => void;
  sprintDetailTasks: ProjectIssue[];
  allProjectIssues?: ProjectIssue[];
  tasksAvailableToAddToSprint: ProjectIssue[];
  isAddExistingTaskOpen: boolean;
  setIsAddExistingTaskOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  onAddExistingTask: (issue: ProjectIssue) => void;
  onRemoveTaskFromSprint: (issue: ProjectIssue) => void;
  onBatchRemoveTasksFromSprint?: (tasks: ProjectIssue[]) => void;
  onToggleTaskStatus: (issueId: string) => void;
  onAssignToMe?: (issueId: string) => void;
  collaborators?: RepoCollaborator[];
  onEditTask?: (issue: ProjectIssue) => void;
  onDeleteTask?: (issue: ProjectIssue) => void;
  onBatchDeleteTasks?: (tasks: ProjectIssue[]) => void;
  onReassignTask?: (issueId: string, assigneeLogin: string, assigneeAvatar?: string) => void;
  onMoveIssue?: (issueId: string, targetColumnId: string) => Promise<void> | void;
  onCreateNewTask: () => void;
  sprintCalendarMonthOffset: number;
  setSprintCalendarMonthOffset: (v: number | ((prev: number) => number)) => void;
  showToast?: (msg: string) => void;
  isSprintSidebarVisible: boolean;
  toggleSprintSidebar: () => void;
  projectV2Columns?: any[] | null;
}) {
  const {
    allCards = [],
    selectedProject,
    onSelectProject,
    currentUser,
    theme,
    isEffectiveDark,
    accentColor,
    accentContrastText,
    combinedSprints,
    openedSprint,
    onSelectSprint,
    projectV2Columns,
    onDeleteSprint,
    onCreateSprint,
    sprintSidebarFilter,
    setSprintSidebarFilter,
    verticalCalendarDate,
    setVerticalCalendarDate,
    selectedCalendarDayIso,
    setSelectedCalendarDayIso,
    sprintDetailViewMode,
    setSprintDetailViewMode,
    isEditingSprintDates,
    editSprintStartDate,
    editSprintDueDate,
    setEditSprintStartDate,
    setEditSprintDueDate,
    isSavingSprintDates,
    onStartEditSprintDates,
    onCancelEditSprintDates,
    onSaveSprintDates,
    sprintDetailTasks,
    allProjectIssues = [],
    tasksAvailableToAddToSprint,
    isAddExistingTaskOpen,
    setIsAddExistingTaskOpen,
    onAddExistingTask,
    onRemoveTaskFromSprint,
    onBatchRemoveTasksFromSprint,
    onToggleTaskStatus,
    onAssignToMe,
    collaborators = [],
    onEditTask,
    onDeleteTask,
    onBatchDeleteTasks,
    onReassignTask,
    onMoveIssue,
    onCreateNewTask,
    sprintCalendarMonthOffset,
    setSprintCalendarMonthOffset,
    showToast = (msg: string) => console.log(msg),
    isSprintSidebarVisible,
    toggleSprintSidebar,
  } = props;

  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const [projectPickerSearch, setProjectPickerSearch] = useState('');

  const filteredPickerProjects = useMemo(() => {
    if (!allCards || allCards.length === 0) return [];
    if (!projectPickerSearch.trim()) return allCards;
    const q = projectPickerSearch.toLowerCase();
    return allCards.filter(
      (c) =>
        c.title.toLowerCase().includes(q) ||
        (c.language && c.language.toLowerCase().includes(q)) ||
        (c.owner && c.owner.toLowerCase().includes(q)) ||
        (c.repoName && c.repoName.toLowerCase().includes(q))
    );
  }, [allCards, projectPickerSearch]);

  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);
  const [taskMenuOpenId, setTaskMenuOpenId] = useState<string | null>(null);
  const [reassignSubmenuOpen, setReassignSubmenuOpen] = useState(false);
  const [assignModalTask, setAssignModalTask] = useState<ProjectIssue | null>(null);
  const reassignTimerRef = useRef<any>(null);

  const handleReassignSubmenuEnter = () => {
    if (reassignTimerRef.current) {
      clearTimeout(reassignTimerRef.current);
      reassignTimerRef.current = null;
    }
    setReassignSubmenuOpen(true);
  };

  const handleReassignSubmenuLeave = () => {
    if (reassignTimerRef.current) clearTimeout(reassignTimerRef.current);
    reassignTimerRef.current = setTimeout(() => {
      setReassignSubmenuOpen(false);
    }, 280);
  };

  // Estados para o modo "Issues" (estilo GitHub Issues)
  const [selectedIssueIds, setSelectedIssueIds] = useState<string[]>([]);
  const [issueStateFilter, setIssueStateFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [issueActiveDropdown, setIssueActiveDropdown] = useState<string | null>(null);
  const [batchActiveDropdown, setBatchActiveDropdown] = useState<'assign' | null>(null);
  const [issueAuthorFilter, setIssueAuthorFilter] = useState<string | null>(null);
  const [issueLabelFilter, setIssueLabelFilter] = useState<string | null>(null);
  const [issueAssigneeFilter, setIssueAssigneeFilter] = useState<string | null>(null);
  const [issueSortFilter, setIssueSortFilter] = useState<'recent' | 'oldest' | 'title'>('recent');

  // Estado de expansão das issues com sub-issues
  const [expandedIssueIds, setExpandedIssueIds] = useState<Set<string>>(new Set());
  const toggleIssueExpanded = useCallback((issueId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedIssueIds((prev) => {
      const next = new Set(prev);
      if (next.has(issueId)) next.delete(issueId);
      else next.add(issueId);
      return next;
    });
  }, []);

  // Mapa de todas as issues do projeto para lookup rápido por githubNumber
  const allIssuesMap = useMemo(() => {
    const map = new Map<number, ProjectIssue>();
    (allProjectIssues || []).forEach((i) => {
      if (i.githubNumber) map.set(i.githubNumber, i);
    });
    return map;
  }, [allProjectIssues]);

  // Filtro de tarefas da sprint (dropdown inspirado no GitHub)
  type SprintTaskFilter = 'all' | 'assigned' | 'created' | 'mentioned' | 'recent';
  const [sprintTaskFilter, setSprintTaskFilter] = useState<SprintTaskFilter>('all');
  const [isSprintTaskFilterOpen, setIsSprintTaskFilterOpen] = useState(false);

  const me = (currentUser?.login || '').toLowerCase();

  // Tarefas filtradas conforme seleção do dropdown
  const displayedTasks = useMemo(() => {
    let list = sprintDetailTasks;
    if (sprintTaskFilter === 'assigned') {
      list = list.filter((t) =>
        t.assignees?.some((a) => (a.name || '').toLowerCase().includes(me) || (a.name || '').toLowerCase() === me)
      );
    } else if (sprintTaskFilter === 'created') {
      list = list.filter((t) =>
        (t.author || '').toLowerCase().includes(me) || (t.author || '').toLowerCase() === me
      );
    } else if (sprintTaskFilter === 'mentioned') {
      list = list.filter((t) =>
        (t.commentsCount || 0) > 0 || (t.description || '').toLowerCase().includes(`@${me}`)
      );
    } else if (sprintTaskFilter === 'recent') {
      list = [...list].sort((a, b) => {
        const da = new Date(a.createdAtIso || a.dateStr).getTime() || 0;
        const db = new Date(b.createdAtIso || b.dateStr).getTime() || 0;
        return db - da;
      });
    }

    if (selectedCalendarDayIso && isSprintSidebarVisible) {
      list = list.filter((t) => {
        const raw = t.createdAtIso || t.dateStr || (t as any).updatedAtIso;
        if (!raw) return false;
        return raw.slice(0, 10) === selectedCalendarDayIso;
      });
    }

    return list;
  }, [sprintDetailTasks, sprintTaskFilter, me, selectedCalendarDayIso, isSprintSidebarVisible]);

  const sprintFilterOptions: {
    key: SprintTaskFilter;
    label: string;
    icon: React.ComponentType<{ size?: number; color?: string; style?: React.CSSProperties }>;
    iconActiveColor?: string;
    count?: number;
  }[] = [
    {
      key: 'all',
      label: 'Todas as Issues',
      icon: CircleDot,
      iconActiveColor: '#f97316',
      count: sprintDetailTasks.length,
    },
    {
      key: 'assigned',
      label: 'Atribuídas a mim',
      icon: UserCheck,
      count: sprintDetailTasks.filter((t) =>
        t.assignees?.some((a) => (a.name || '').toLowerCase().includes(me) || (a.name || '').toLowerCase() === me)
      ).length,
    },
    {
      key: 'created',
      label: 'Criadas por mim',
      icon: Smile,
      count: sprintDetailTasks.filter((t) =>
        (t.author || '').toLowerCase().includes(me) || (t.author || '').toLowerCase() === me
      ).length,
    },
    {
      key: 'mentioned',
      label: 'Mencionado',
      icon: AtSign,
      count: sprintDetailTasks.filter((t) =>
        (t.commentsCount || 0) > 0 || (t.description || '').toLowerCase().includes(`@${me}`)
      ).length,
    },
    {
      key: 'recent',
      label: 'Atividade recente',
      icon: Clock,
    },
  ];

  const activeFilterOption = sprintFilterOptions.find((opt) => opt.key === sprintTaskFilter) || sprintFilterOptions[0];
  const ActiveFilterIcon = activeFilterOption.icon;


  // Alternar checkbox de checklist de sub-issue dentro da descrição da issue pai
  const handleToggleChecklistSubIssue = useCallback(
    async (parentTask: ProjectIssue, lineIndex: number, currentlyCompleted: boolean) => {
      if (!parentTask.description) return;
      const lines = parentTask.description.split('\n');
      if (lineIndex < 0 || lineIndex >= lines.length) return;
      const targetLine = lines[lineIndex];
      const nextCheck = currentlyCompleted ? ' ' : 'x';
      lines[lineIndex] = targetLine.replace(/\[([ xX])\]/, `[${nextCheck}]`);
      const newDescription = lines.join('\n');

      const card = allCards.find((c) => c.id === parentTask.projectId);
      if (card?.owner && card?.repoName && parentTask.githubNumber) {
        try {
          await window.electronAPI?.github?.updateIssue?.(card.owner, card.repoName, parentTask.githubNumber, {
            body: newDescription,
          });
          parentTask.description = newDescription;
          showToast(currentlyCompleted ? 'Sub-issue reaberta.' : 'Sub-issue concluída!');
        } catch (err: any) {
          showToast(err?.message || 'Erro ao sincronizar sub-issue no GitHub.');
        }
      }
    },
    [allCards, showToast]
  );

  // Helper para renderizar checkbox customizado padronizado
  const renderCustomCheckbox = (
    checked: boolean,
    indeterminate?: boolean,
    onChange?: () => void,
    title?: string
  ) => {
    const isCheckedOrIndeterminate = checked || indeterminate;
    return (
      <div
        role="checkbox"
        aria-checked={indeterminate ? 'mixed' : checked}
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          onChange?.();
        }}
        style={{
          width: 15,
          height: 15,
          borderRadius: 4,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          flexShrink: 0,
          transition: 'all 0.12s ease',
          border: isCheckedOrIndeterminate
            ? `1.5px solid ${accentColor}`
            : `1.5px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)'}`,
          background: isCheckedOrIndeterminate
            ? accentColor
            : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)'),
          boxSizing: 'border-box',
          userSelect: 'none',
        }}
        onMouseEnter={(e) => {
          if (!isCheckedOrIndeterminate) {
            e.currentTarget.style.borderColor = accentColor;
            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.06)';
          }
        }}
        onMouseLeave={(e) => {
          if (!isCheckedOrIndeterminate) {
            e.currentTarget.style.borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)';
            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.02)';
          }
        }}
      >
        {checked && <Check size={11} strokeWidth={3} color={accentContrastText} />}
        {indeterminate && !checked && <Minus size={11} strokeWidth={3} color={accentContrastText} />}
      </div>
    );
  };

  // Funções para Ações em Lote (Batch Actions)
  const handleBatchToggleStatus = (target: 'close' | 'reopen') => {
    let count = 0;
    selectedIssueIds.forEach((id) => {
      const task = displayedTasks.find((t) => t.id === id);
      if (!task) return;
      if (target === 'close' && task.status !== 'Concluído') {
        onToggleTaskStatus(id);
        count++;
      } else if (target === 'reopen' && task.status === 'Concluído') {
        onToggleTaskStatus(id);
        count++;
      }
    });
    showToast(target === 'close' ? `${count} issue(s) fechada(s)` : `${count} issue(s) reaberta(s)`);
  };

  const handleBatchAssign = (assigneeLogin: string, assigneeAvatar?: string) => {
    selectedIssueIds.forEach((id) => {
      onReassignTask?.(id, assigneeLogin, assigneeAvatar);
    });
    showToast(`${selectedIssueIds.length} issue(s) atribuída(s) para @${assigneeLogin}`);
    setBatchActiveDropdown(null);
  };

  const handleBatchAssignToMe = () => {
    selectedIssueIds.forEach((id) => {
      if (onAssignToMe) onAssignToMe(id);
      else if (currentUser?.login && onReassignTask) {
        onReassignTask(id, currentUser.login, currentUser.avatarUrl);
      }
    });
    showToast(`${selectedIssueIds.length} issue(s) atribuída(s) a você`);
    setBatchActiveDropdown(null);
  };

  const handleBatchRemoveFromSprint = () => {
    const tasksToRemove = selectedIssueIds
      .map((id) => displayedTasks.find((t) => t.id === id))
      .filter((t): t is ProjectIssue => !!t);
    if (tasksToRemove.length === 0) return;
    if (onBatchRemoveTasksFromSprint) {
      onBatchRemoveTasksFromSprint(tasksToRemove);
    } else {
      tasksToRemove.forEach((t) => onRemoveTaskFromSprint?.(t));
    }
    setSelectedIssueIds([]);
  };

  const handleBatchDelete = () => {
    const tasksToDelete = selectedIssueIds
      .map((id) => displayedTasks.find((t) => t.id === id))
      .filter((t): t is ProjectIssue => !!t);
    if (tasksToDelete.length === 0) return;
    if (onBatchDeleteTasks) {
      onBatchDeleteTasks(tasksToDelete);
      setSelectedIssueIds([]);
    } else {
      tasksToDelete.forEach((task) => onDeleteTask?.(task));
      setSelectedIssueIds([]);
    }
  };

  const openIssuesCount = useMemo(
    () => displayedTasks.filter((t) => t.status !== 'Concluído').length,
    [displayedTasks]
  );
  const closedIssuesCount = useMemo(
    () => displayedTasks.filter((t) => t.status === 'Concluído').length,
    [displayedTasks]
  );

  const distinctAuthors = useMemo(() => {
    const set = new Set<string>();
    sprintDetailTasks.forEach((t) => {
      if (t.author) set.add(t.author);
    });
    if ((currentUser as any)?.login) set.add((currentUser as any).login);
    return Array.from(set);
  }, [sprintDetailTasks, currentUser]);

  const distinctLabels = useMemo(() => {
    const set = new Set<string>();
    sprintDetailTasks.forEach((t) => {
      if (t.tag) set.add(t.tag);
      if (t.status) set.add(t.status.toLowerCase().replace(/\s+/g, '-'));
      if (t.priority) set.add(`priority: ${t.priority.toLowerCase()}`);
      if (t.rawLabels) t.rawLabels.forEach((l) => set.add(l));
    });
    return Array.from(set);
  }, [sprintDetailTasks]);

  const renderTaskActionMenu = (task: ProjectIssue, taskIdx: number, totalTasks: number) => {
    return (
      <div style={{ position: 'relative' }}>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setTaskMenuOpenId(taskMenuOpenId === task.id ? null : task.id);
            setReassignSubmenuOpen(false);
          }}
          title="Mais opções"
          style={{
            background: taskMenuOpenId === task.id
              ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
              : 'transparent',
            border: 'none',
            color: taskMenuOpenId === task.id ? theme.textPrimary : theme.textSecondary,
            cursor: 'pointer',
            padding: '3px 4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
            transition: 'all 0.12s ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = theme.textPrimary;
            e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
          }}
          onMouseLeave={(e) => {
            if (taskMenuOpenId !== task.id) {
              e.currentTarget.style.color = theme.textSecondary;
              e.currentTarget.style.background = 'transparent';
            }
          }}
        >
          <MoreHorizontal size={14} />
        </button>

        {taskMenuOpenId === task.id && (
          <>
            <div
              style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
              onClick={(e) => {
                e.stopPropagation();
                setTaskMenuOpenId(null);
                setReassignSubmenuOpen(false);
              }}
            />
            <div
              style={{
                position: 'absolute',
                top: taskIdx >= totalTasks - 2 && totalTasks > 2
                  ? 'auto'
                  : 'calc(100% + 4px)',
                bottom: taskIdx >= totalTasks - 2 && totalTasks > 2
                  ? 'calc(100% + 4px)'
                  : 'auto',
                right: 0,
                zIndex: 9999,
                minWidth: 195,
                background: theme.dropdownBg,
                border: 'none',
                borderRadius: 10,
                boxShadow: theme.dropdownShadow,
                padding: '5px',
                display: 'flex',
                flexDirection: 'column',
                animation: 'fadeIn 0.12s ease-out',
                textAlign: 'left',
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Editar tarefa */}
              <button
                type="button"
                onClick={() => {
                  setTaskMenuOpenId(null);
                  setReassignSubmenuOpen(false);
                  onEditTask?.(task);
                }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  padding: '7px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                  color: theme.textPrimary,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Pencil size={13} color={theme.textSecondary} />
                <span>Editar tarefa</span>
              </button>

              {/* Reatribuir a outro membro do projeto */}
              <div
                style={{ position: 'relative' }}
                onMouseEnter={handleReassignSubmenuEnter}
                onMouseLeave={handleReassignSubmenuLeave}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (reassignTimerRef.current) {
                      clearTimeout(reassignTimerRef.current);
                      reassignTimerRef.current = null;
                    }
                    setReassignSubmenuOpen((v) => !v);
                  }}
                  style={{
                    width: '100%',
                    background: reassignSubmenuOpen
                      ? theme.dropdownItemHover
                      : 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    padding: '7px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 12.5,
                    color: theme.textPrimary,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background 0.1s',
                  }}
                >
                  <Users size={13} color={theme.textSecondary} />
                  <span style={{ flex: 1 }}>Reatribuir membro</span>
                  <ChevronRight size={13} color={theme.textSecondary} />
                </button>

                {/* Submenu com lista de membros */}
                {reassignSubmenuOpen && (
                  <div
                    onMouseEnter={handleReassignSubmenuEnter}
                    onMouseLeave={handleReassignSubmenuLeave}
                    style={{
                      position: 'absolute',
                      top: taskIdx >= totalTasks - 2 && totalTasks > 2
                        ? 'auto'
                        : 0,
                      bottom: taskIdx >= totalTasks - 2 && totalTasks > 2
                        ? 0
                        : 'auto',
                      right: '100%',
                      marginRight: 6,
                      minWidth: 190,
                      maxWidth: 240,
                      maxHeight: 240,
                      overflowY: 'auto',
                      background: theme.dropdownBg,
                      border: 'none',
                      borderRadius: 10,
                      boxShadow: theme.dropdownShadow,
                      padding: '5px',
                      zIndex: 10000,
                    }}
                    className="no-scrollbar"
                  >
                    {/* Ponte invisível que conecta o submenu ao botão pai impedindo fechamento ao mover o cursor */}
                    <div
                      style={{
                        position: 'absolute',
                        top: -12,
                        bottom: -12,
                        right: -16,
                        width: 24,
                        background: 'transparent',
                        pointerEvents: 'auto',
                      }}
                    />
                    <div style={{ padding: '4px 10px 6px', fontSize: 10.5, fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      Membros do Projeto
                    </div>
                    {collaborators.length === 0 ? (
                      <div style={{ padding: '8px 12px', fontSize: 11.5, color: theme.textSecondary }}>
                        Nenhum membro encontrado
                      </div>
                    ) : (
                      collaborators.map((c) => {
                        const isCurrentlyAssigned = task.assignees.some((a) => a.name?.toLowerCase() === c.login.toLowerCase());
                        return (
                          <button
                            key={c.login}
                            type="button"
                            onClick={() => {
                              setTaskMenuOpenId(null);
                              setReassignSubmenuOpen(false);
                              onReassignTask?.(task.id, c.login, c.avatarUrl);
                            }}
                            style={{
                              width: '100%',
                              background: isCurrentlyAssigned
                                ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc')
                                : 'transparent',
                              border: 'none',
                              borderRadius: 6,
                              padding: '6px 10px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              fontSize: 12,
                              color: theme.textPrimary,
                              cursor: 'pointer',
                              textAlign: 'left',
                              transition: 'background 0.1s',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = isCurrentlyAssigned
                                ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : '#f8fafc')
                                : 'transparent';
                            }}
                          >
                            {c.avatarUrl ? (
                              <img src={c.avatarUrl} alt={c.login} style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover' }} />
                            ) : (
                              <div style={{ width: 18, height: 18, borderRadius: '50%', background: accentColor, color: '#fff', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {c.login.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {c.login}
                            </span>
                            {isCurrentlyAssigned && <Check size={12} color={accentColor} />}
                          </button>
                        );
                      })
                    )}
                    {task.assignees.length > 0 && (
                      <>
                        <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)', margin: '4px 4px 2px' }} />
                        <button
                          type="button"
                          onClick={() => {
                            setTaskMenuOpenId(null);
                            setReassignSubmenuOpen(false);
                            onReassignTask?.(task.id, '', '');
                          }}
                          style={{
                            width: '100%',
                            background: 'transparent',
                            border: 'none',
                            borderRadius: 6,
                            padding: '6px 10px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            fontSize: 11.5,
                            color: theme.textSecondary,
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#ef4444';
                            e.currentTarget.style.background = isEffectiveDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = theme.textSecondary;
                            e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <X size={12} />
                          <span>Remover responsável</span>
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)', margin: '4px 6px' }} />

              {/* Remover da sprint */}
              <button
                type="button"
                onClick={() => {
                  setTaskMenuOpenId(null);
                  setReassignSubmenuOpen(false);
                  onRemoveTaskFromSprint(task);
                }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  padding: '7px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                  color: theme.textSecondary,
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = theme.dropdownItemHover;
                  e.currentTarget.style.color = theme.textPrimary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = theme.textSecondary;
                }}
              >
                <X size={13} />
                <span>Remover da sprint</span>
              </button>

              {/* Excluir tarefa */}
              <button
                type="button"
                onClick={() => {
                  setTaskMenuOpenId(null);
                  setReassignSubmenuOpen(false);
                  onDeleteTask?.(task);
                }}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  padding: '7px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 12.5,
                  color: '#ef4444',
                  cursor: 'pointer',
                  textAlign: 'left',
                  transition: 'background 0.1s',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(239, 68, 68, 0.1)' : '#fee2e2')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <Trash2 size={13} color="#ef4444" />
                <span>Excluir tarefa</span>
              </button>
            </div>
          </>
        )}
      </div>
    );
  };

  const [sprintSidebarWidth, setSprintSidebarWidth] = useState<number>(() => {
    const saved = localStorage.getItem('sprint_sidebar_width');
    const parsed = saved ? parseInt(saved, 10) : 240;
    return Number.isFinite(parsed) && parsed >= 160 && parsed <= 600 ? parsed : 240;
  });
  const [isDraggingSprintSidebar, setIsDraggingSprintSidebar] = useState(false);

  const startResizeSprintSidebar = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsDraggingSprintSidebar(true);
      document.body.classList.add('resizing-col');

      const startX = e.clientX;
      const startW = sprintSidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const delta = moveEvent.clientX - startX;
        const newW = Math.min(Math.max(startW + delta, 160), 600);
        setSprintSidebarWidth(newW);
        localStorage.setItem('sprint_sidebar_width', String(newW));
      };

      const onMouseUp = () => {
        setIsDraggingSprintSidebar(false);
        document.body.classList.remove('resizing-col');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [sprintSidebarWidth]
  );

  // Dias da sprint atual (mostra somente os dias que têm sprint, com fallback inteligente)
  const sprintDays = useMemo(() => {
    let startIso = openedSprint?.startDateIso;
    let dueIso = openedSprint?.dueDateIso;

    if (!startIso && !dueIso) return [];

    // Se tiver apenas a data final, recua 13 dias para formar um período típico de 14 dias
    if (!startIso && dueIso) {
      const d = new Date(`${dueIso}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        d.setDate(d.getDate() - 13);
        startIso = d.toISOString().slice(0, 10);
      }
    }
    // Se tiver apenas a data inicial, avança 13 dias
    if (startIso && !dueIso) {
      const d = new Date(`${startIso}T00:00:00`);
      if (!Number.isNaN(d.getTime())) {
        d.setDate(d.getDate() + 13);
        dueIso = d.toISOString().slice(0, 10);
      }
    }

    if (!startIso || !dueIso) return [];

    let start = new Date(`${startIso}T00:00:00`);
    let end = new Date(`${dueIso}T00:00:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return [];
    if (start > end) {
      const tmp = start;
      start = end;
      end = tmp;
    }

    const maxDays = 60;
    const days: { day: number; wd: string; iso: string; monthName: string; monthIndex: number; year: number }[] = [];
    const cur = new Date(start);
    const weekdayAbbrPt = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
    const monthAbbrPt = ['JAN', 'FEV', 'MAR', 'ABR', 'MAI', 'JUN', 'JUL', 'AGO', 'SET', 'OUT', 'NOV', 'DEZ'];

    let count = 0;
    while (cur <= end && count < maxDays) {
      const day = cur.getDate();
      const wd = weekdayAbbrPt[cur.getDay()];
      const mIdx = cur.getMonth();
      const yr = cur.getFullYear();
      const iso = `${yr}-${String(mIdx + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      days.push({
        day,
        wd,
        iso,
        monthName: monthAbbrPt[mIdx],
        monthIndex: mIdx,
        year: yr,
      });
      cur.setDate(cur.getDate() + 1);
      count++;
    }
    return days;
  }, [openedSprint?.startDateIso, openedSprint?.dueDateIso]);

  const verticalCalListRef = React.useRef<HTMLDivElement>(null);

  // Mapeamento de contagem de tarefas por data ISO
  const tasksCountByDate = useMemo(() => {
    const map = new Map<string, number>();
    sprintDetailTasks.forEach((task) => {
      const raw = task.createdAtIso || task.dateStr;
      if (!raw) return;
      const iso = raw.slice(0, 10);
      map.set(iso, (map.get(iso) || 0) + 1);
    });
    return map;
  }, [sprintDetailTasks]);

  // Auto-scroll para hoje ou início da sprint quando a sprint mudar
  React.useEffect(() => {
    if (verticalCalListRef.current) {
      const target = verticalCalListRef.current.querySelector('[data-cal-focus="true"]');
      if (target) {
        target.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [openedSprint?.number, sprintDays.length]);

  // Sprints filtradas para a Coluna 2
  const filteredSprints = useMemo(() => {
    if (sprintSidebarFilter === 'active') return combinedSprints.filter((s) => s.status !== 'Completed');
    if (sprintSidebarFilter === 'completed') return combinedSprints.filter((s) => s.status === 'Completed');
    return combinedSprints;
  }, [combinedSprints, sprintSidebarFilter]);

  // Badge do status da sprint aberta
  const statusBadge = openedSprint
    ? openedSprint.status === 'Current'
      ? { label: 'Atual', bg: 'rgba(56, 139, 253, 0.15)', border: 'none', color: '#58a6ff' }
      : openedSprint.status === 'Completed'
      ? { label: 'Concluída', bg: 'rgba(34, 197, 94, 0.15)', border: 'none', color: '#22c55e' }
      : { label: 'Planejada', bg: 'rgba(148, 163, 184, 0.12)', border: 'none', color: '#94a3b8' }
    : null;

  // 3 KPIs essenciais e minimalistas da sprint
  const sprintKpis = useMemo(() => {
    const total = sprintDetailTasks.length;
    const done = sprintDetailTasks.filter((t) => t.status === 'Concluído').length;
    const inProgress = sprintDetailTasks.filter((t) => t.status === 'Em Progresso').length;
    const open = sprintDetailTasks.filter((t) => t.status === 'A Fazer').length;
    const percent = total > 0 ? Math.round((done / total) * 100) : 0;

    let daysLeftText = '—';
    let daysLeftSub = 'sem prazo';
    if (openedSprint?.dueDateIso) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const parts = openedSprint.dueDateIso.split('-');
      const due =
        parts.length === 3
          ? new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10))
          : new Date(openedSprint.dueDateIso);
      due.setHours(0, 0, 0, 0);
      const diffDays = Math.round((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        daysLeftText = `${Math.abs(diffDays)}d`;
        daysLeftSub = 'atrasado';
      } else if (diffDays === 0) {
        daysLeftText = 'Hoje';
        daysLeftSub = 'último dia';
      } else {
        daysLeftText = `${diffDays}d`;
        daysLeftSub = 'restantes';
      }
    }

    return {
      total,
      done,
      inProgress,
      open,
      percent,
      daysLeftText,
      daysLeftSub,
    };
  }, [sprintDetailTasks, openedSprint?.dueDateIso]);

  // Grade do calendário mensal para o modo "Calendário"
  const baseMonthDate = openedSprint?.startDateIso ? new Date(`${openedSprint.startDateIso}T00:00:00`) : new Date();
  const calendarMonthDate = new Date(baseMonthDate.getFullYear(), baseMonthDate.getMonth() + sprintCalendarMonthOffset, 1);
  const calendarYear = calendarMonthDate.getFullYear();
  const calendarMonth = calendarMonthDate.getMonth();
  const firstWeekday = new Date(calendarYear, calendarMonth, 1).getDay();
  const daysInMonth = new Date(calendarYear, calendarMonth + 1, 0).getDate();
  const calendarCells: (number | null)[] = [
    ...Array(firstWeekday).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (calendarCells.length % 7 !== 0) calendarCells.push(null);

  const tasksByDay = new Map<number, ProjectIssue[]>();
  displayedTasks.forEach((task) => {
    const raw = task.createdAtIso || task.dateStr;
    if (!raw) return;
    const d = new Date(raw);
    if (Number.isNaN(d.getTime()) || d.getFullYear() !== calendarYear || d.getMonth() !== calendarMonth) return;
    const day = d.getDate();
    const list = tasksByDay.get(day) || [];
    list.push(task);
    tasksByDay.set(day, list);
  });

  return (
    <div style={{ display: 'flex', gap: 5, flex: 1, minHeight: 0, width: '100%', height: '100%' }}>
      {/* ========================================================================= */}
      {/* BARRA LATERAL RETRÁTIL (COM ANIMAÇÃO SUAVE IN/OUT)                        */}
      {/* ========================================================================= */}
      <div
        style={{
          position: 'relative',
          display: 'flex',
          height: '100%',
          width: isSprintSidebarVisible ? sprintSidebarWidth + 48 + 5 : 0,
          minWidth: isSprintSidebarVisible ? sprintSidebarWidth + 48 + 5 : 0,
          maxWidth: isSprintSidebarVisible ? sprintSidebarWidth + 48 + 5 : 0,
          opacity: isSprintSidebarVisible ? 1 : 0,
          transform: isSprintSidebarVisible ? 'translateX(0)' : 'translateX(-24px)',
          overflow: isSprintSidebarVisible ? 'visible' : 'hidden',
          transition: isDraggingSprintSidebar
            ? 'none'
            : 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), max-width 0.3s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.22s ease, transform 0.28s cubic-bezier(0.4, 0, 0.2, 1)',
          pointerEvents: isSprintSidebarVisible ? 'auto' : 'none',
          flexShrink: 0,
          gap: 5,
        }}
      >
        {/* ========================================================================= */}
        {/* COLUNA 1: CALENDÁRIO VERTICAL MINIMALISTA (Apenas dias da sprint)         */}
        {/* ========================================================================= */}
      <div
        style={{
          width: 48,
          flexShrink: 0,
          background: isEffectiveDark ? '#161616' : '#f5f5f5',
          borderRadius: 8,
          border: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '4px 3px',
        }}
      >
        <div
          ref={verticalCalListRef}
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            padding: '2px 2px',
          }}
          className="no-scrollbar"
        >
          {sprintDays.length === 0 ? (
            <div
              onClick={onStartEditSprintDates}
              role="button"
              tabIndex={0}
              title="Clique para definir as datas da sprint"
              style={{
                fontSize: 10,
                color: theme.textSecondary,
                textAlign: 'center',
                padding: '14px 2px',
                cursor: 'pointer',
                borderRadius: 6,
                border: 'none',
                background: isEffectiveDark ? '#1e1e1e' : '#ffffff',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
                margin: '4px 2px',
                transition: 'background 0.15s, border-color 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = isEffectiveDark ? '#262626' : '#f0f0f0';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = isEffectiveDark ? '#1e1e1e' : '#ffffff';
              }}
            >
              <Calendar size={13} style={{ color: theme.textSecondary }} />
              <span style={{ fontSize: 9.5 }}>Sem datas</span>
              <span style={{ fontSize: 8.5, color: theme.textPrimary, textDecoration: 'underline' }}>
                Definir
              </span>
            </div>
          ) : (
            sprintDays.map((item, idx) => {
              const showMonthHeader = idx === 0 || item.monthName !== sprintDays[idx - 1].monthName;
              const isToday = item.iso === todayIso;
              const isPast = item.iso < todayIso;
              const isSelected = selectedCalendarDayIso === item.iso;
              const dayTasksCount = tasksCountByDate.get(item.iso) || 0;
              const isFocus = isSelected || isToday;

              return (
                <React.Fragment key={item.iso}>
                  {showMonthHeader && (
                    <div
                      style={{
                        fontSize: 10.5,
                        fontWeight: 700,
                        color: theme.textSecondary,
                        letterSpacing: '0.06em',
                        textAlign: 'left',
                        padding: idx === 0 ? '2px 6px 4px' : '8px 6px 4px',
                        textTransform: 'uppercase',
                        opacity: 0.8,
                      }}
                    >
                      {item.monthName}
                    </div>
                  )}
                  <div
                    data-cal-focus={isFocus ? 'true' : undefined}
                    onClick={() => setSelectedCalendarDayIso((prev) => (prev === item.iso ? null : item.iso))}
                    title={`${item.day} de ${item.monthName} (${item.wd})${isToday ? ' · Hoje' : ''}${isPast ? ' · Passado' : ''}${dayTasksCount > 0 ? ` · ${dayTasksCount} tarefa(s)` : ''}`}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '4px 2px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isSelected
                        ? (isEffectiveDark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.1)')
                        : isToday
                        ? (isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
                        : (isEffectiveDark ? '#1e1e1e' : '#ffffff'),
                      border: 'none',
                      color: isSelected || isToday
                        ? theme.textPrimary
                        : isPast
                        ? hexToRgba(theme.textPrimary, 0.5)
                        : theme.textPrimary,
                      transition: 'all 0.15s ease',
                      marginBottom: 3,
                      position: 'relative',
                      boxShadow: 'none',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = isEffectiveDark ? '#262626' : '#f0f0f0';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = isToday
                          ? (isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')
                          : (isEffectiveDark ? '#1e1e1e' : '#ffffff');
                      }
                    }}
                  >
                    <span style={{ fontSize: 11.5, fontWeight: isToday || isSelected ? 700 : 600, lineHeight: 1 }}>{item.day}</span>
                    <span style={{ fontSize: 9, opacity: isToday || isSelected ? 0.9 : 0.65, textTransform: 'lowercase', marginTop: 2 }}>{item.wd}</span>
                    {dayTasksCount > 0 && (
                      <span
                        style={{
                          position: 'absolute',
                          top: 2,
                          right: 3,
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: theme.textSecondary,
                        }}
                      />
                    )}
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* COLUNA 2: LISTA DE SPRINTS (Barra lateral compacta de sprints)            */}
      {/* ========================================================================= */}
      <div
        style={{
          width: sprintSidebarWidth,
          minWidth: 160,
          maxWidth: 600,
          flexShrink: 0,
          background: theme.viewCanvasBg,
          borderRadius: 8,
          padding: 8,
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          overflow: 'hidden',
          border: 'none',
        }}
      >
        {/* Cabeçalho da Lista de Sprints com botão Nova Sprint */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '2px 4px 6px',
            borderBottom: `1px solid ${hexToRgba(theme.textSecondary, isEffectiveDark ? 0.07 : 0.05)}`,
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: theme.textPrimary }}>Sprints</span>
              <span
                style={{
                  fontSize: 10.5,
                  background: hexToRgba(theme.textSecondary, 0.15),
                  color: theme.textSecondary,
                  padding: '1px 6px',
                  borderRadius: 10,
                  fontWeight: 600,
                }}
              >
                {combinedSprints.length}
              </span>
            </div>
            {selectedProject && (
              <div
                onClick={() => setProjectPickerOpen((prev) => !prev)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3,
                  cursor: 'pointer',
                  maxWidth: 160,
                }}
                title="Clique para alternar o projeto da sprint"
              >
                <span
                  style={{
                    fontSize: 10.5,
                    color: accentColor,
                    fontWeight: 600,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {selectedProject.title}
                </span>
                <ChevronDown size={11} color={accentColor} />
              </div>
            )}
          </div>

          {onCreateSprint && (
            <button
              type="button"
              onClick={onCreateSprint}
              title="Nova sprint"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: accentColor,
                border: 'none',
                borderRadius: 6,
                padding: '4px 10px',
                color: accentContrastText,
                fontSize: 12,
                fontWeight: 500,
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
              <span>Nova</span>
            </button>
          )}
        </div>

        {/* Tabs de Filtro: Todas / Ativas / Concluídas */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: isEffectiveDark ? '#191919' : '#e2e8f0',
            borderRadius: 6,
            padding: 2,
            gap: 2,
          }}
        >
          {(['all', 'active', 'completed'] as const).map((tabKey) => {
            const isActive = sprintSidebarFilter === tabKey;
            const label = tabKey === 'all' ? 'Todas' : tabKey === 'active' ? 'Ativas' : 'Concluídas';
            return (
              <button
                key={tabKey}
                type="button"
                onClick={() => setSprintSidebarFilter(tabKey)}
                style={{
                  flex: 1,
                  padding: '3px 0',
                  fontSize: 10.5,
                  fontWeight: isActive ? 600 : 400,
                  borderRadius: 4,
                  border: 'none',
                  background: isActive ? (isEffectiveDark ? '#262626' : '#ffffff') : 'transparent',
                  color: isActive ? theme.textPrimary : theme.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        {/* Lista de Sprints */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
          className="no-scrollbar"
        >
          {filteredSprints.length === 0 ? (
            <div style={{ padding: '24px 8px', textAlign: 'center', color: theme.textSecondary, fontSize: 11.5 }}>
              Nenhuma sprint encontrada{selectedProject?.title ? ` para ${selectedProject.title}` : ''}.
            </div>
          ) : (
            filteredSprints.map((sp) => {
              const isSelected = openedSprint ? sp.id === openedSprint.id : false;
              const dotColor = sp.status === 'Current' ? '#58a6ff' : sp.status === 'Completed' ? '#22c55e' : '#94a3b8';

              // Obter tarefas reais desta sprint
              const sprintIssues = (allProjectIssues || []).filter((i) => {
                if (sp.number === -1) {
                  return (!i.milestoneNumber || i.milestoneNumber === 0 || i.milestoneNumber === -1) && !i.iterationId && !i.iterationTitle;
                }
                return issueBelongsToSprint(i, sp);
              });
              const effectiveTasks = (openedSprint && sp.id === openedSprint.id && sprintDetailTasks.length > 0)
                ? sprintDetailTasks
                : sprintIssues;
              const closedCount = effectiveTasks.filter((t) => t.status === 'Concluído').length;
              const openCount = effectiveTasks.filter((t) => t.status !== 'Concluído').length;
              const totalCount = effectiveTasks.length;
              const progressPercent = totalCount > 0 ? Math.round((closedCount / totalCount) * 100) : 0;

              // Calcular quantos dias faltam para acabar a sprint
              const getDaysBadge = () => {
                if (sp.status === 'Completed') {
                  return {
                    text: 'Concluída',
                    color: '#22c55e',
                    bg: isEffectiveDark ? 'rgba(34, 197, 94, 0.16)' : 'rgba(34, 197, 94, 0.12)',
                  };
                }
                if (!sp.dueDateIso) {
                  const statusLabel = sp.status === 'Current' ? 'Atual' : 'Planejada';
                  return {
                    text: statusLabel,
                    color: dotColor,
                    bg: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                  };
                }
                try {
                  const now = new Date();
                  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                  const parts = sp.dueDateIso.slice(0, 10).split('-');
                  if (parts.length < 3) return null;
                  const due = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
                  const diffTime = due.getTime() - today.getTime();
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

                  if (diffDays < 0) {
                    return {
                      text: 'Encerrada',
                      color: '#ef4444',
                      bg: isEffectiveDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.12)',
                    };
                  }
                  if (diffDays === 0) {
                    return {
                      text: 'Termina hoje',
                      color: '#ef4444',
                      bg: isEffectiveDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.12)',
                    };
                  }
                  // Chegado em 3 dias deve ficar vermelho
                  if (diffDays <= 3) {
                    return {
                      text: `Falta${diffDays === 1 ? '' : 'm'} ${diffDays}d`,
                      color: '#ef4444',
                      bg: isEffectiveDark ? 'rgba(239, 68, 68, 0.18)' : 'rgba(239, 68, 68, 0.12)',
                    };
                  }
                  // Chegado em 5 dias deve ficar amarelo
                  if (diffDays <= 5) {
                    return {
                      text: `Falta${diffDays === 1 ? '' : 'm'} ${diffDays}d`,
                      color: '#eab308',
                      bg: isEffectiveDark ? 'rgba(234, 179, 8, 0.18)' : 'rgba(234, 179, 8, 0.12)',
                    };
                  }
                  return {
                    text: `Falta${diffDays === 1 ? '' : 'm'} ${diffDays}d`,
                    color: theme.textSecondary,
                    bg: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                  };
                } catch {
                  return null;
                }
              };

              const daysBadge = getDaysBadge();

              return (
                <div
                  key={sp.id}
                  onClick={() => onSelectSprint(sp.id)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: isSelected
                      ? (isEffectiveDark ? '#262626' : '#e5e5e5')
                      : isEffectiveDark ? '#1e1e1e' : '#ffffff',
                    border: 'none',
                    boxShadow: 'none',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = isEffectiveDark ? '#232323' : '#f5f5f5';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = isEffectiveDark ? '#1e1e1e' : '#ffffff';
                    }
                  }}
                >
                  {/* Linha 1: Status Dot + Título + Lixeira */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? 600 : 500,
                          color: theme.textPrimary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={sp.title}
                      >
                        {sp.title}
                      </span>
                    </div>

                    {sp.number !== -1 && onDeleteSprint && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onDeleteSprint(sp.id);
                        }}
                        title="Remover sprint"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: theme.textSecondary,
                          cursor: 'pointer',
                          padding: 2,
                          display: 'flex',
                          borderRadius: 3,
                          opacity: 0.5,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = '#ef4444';
                          e.currentTarget.style.opacity = '1';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = theme.textSecondary;
                          e.currentTarget.style.opacity = '0.5';
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Linha 2: Datas da Sprint + Badge de Dias Restantes (Amarelo em 5d, Vermelho em 3d) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5, paddingLeft: 12 }}>
                    <span style={{ color: theme.textSecondary }}>{sp.dateRangeLabel}</span>
                    {daysBadge && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: daysBadge.color,
                          background: daysBadge.bg,
                          padding: '1.5px 6px',
                          borderRadius: 10,
                          lineHeight: 1.2,
                          display: 'inline-flex',
                          alignItems: 'center',
                        }}
                      >
                        {daysBadge.text}
                      </span>
                    )}
                  </div>

                  {/* Linha 3: Tarefas Abertas e Fechadas + Porcentagem de Conclusão */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 10.5,
                      paddingLeft: 12,
                      color: theme.textSecondary,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                      <span>
                        <strong style={{ color: theme.textPrimary, fontWeight: 500 }}>{openCount}</strong> aberta{openCount === 1 ? '' : 's'}
                      </span>
                      <span>•</span>
                      <span>
                        <strong style={{ color: theme.textPrimary, fontWeight: 500 }}>{closedCount}</strong> fechada{closedCount === 1 ? '' : 's'}
                      </span>
                    </div>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontWeight: isSelected ? 600 : 500,
                        color: isSelected ? theme.textPrimary : theme.textSecondary,
                      }}
                    >
                      {progressPercent}%
                    </span>
                  </div>

                  {/* Linha de progresso colada na parte de baixo do card */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${progressPercent}%`,
                        background: isSelected ? accentColor : (isEffectiveDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.2)'),
                        transition: 'width 0.25s ease, background 0.15s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Resizer entre Coluna 2 (Sprints) e Coluna 3 (Detalhes da Sprint) - estilo IDE */}
      <div
        className={`resizer-col ${isDraggingSprintSidebar ? 'dragging' : ''}`}
        onMouseDown={startResizeSprintSidebar}
        onDoubleClick={() => {
          setSprintSidebarWidth(240);
          localStorage.setItem('sprint_sidebar_width', '240');
        }}
        title="Arraste para ajustar a largura da lista de sprints (Duplo clique para restaurar 240px)"
        style={{
          position: 'absolute',
          top: 0,
          bottom: 0,
          right: -5,
          width: 5,
          cursor: 'col-resize',
          zIndex: 20,
          background: 'transparent',
        }}
      />
      </div>

      {/* ========================================================================= */}
      {/* COLUNA 3: ÁREA PRINCIPAL: TAREFAS DA SPRINT SELECIONADA                   */}
      {/* ========================================================================= */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          background: 'transparent',
          borderRadius: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          overflowY: 'auto',
          overflowX: 'hidden',
          border: 'none',
          gap: 5,
          width: '100%',
          height: '100%',
        }}
      >
        {!openedSprint ? (
          <div
            style={{
              flex: 1,
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              gap: 12,
              color: theme.textSecondary,
              position: 'relative',
            }}
          >
            {!isSprintSidebarVisible && (
              <button
                type="button"
                onClick={toggleSprintSidebar}
                title="Exibir lista e calendário de sprints"
                style={{
                  position: 'absolute',
                  top: 12,
                  left: 12,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  color: accentColor,
                  boxShadow: 'none',
                  transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: 'scale(1)',
                  padding: 0,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'scale(1.15)';
                  e.currentTarget.style.opacity = '0.85';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'scale(1)';
                  e.currentTarget.style.opacity = '1';
                }}
              >
                <PanelLeftOpen size={18} />
              </button>
            )}
            <Repeat size={32} style={{ opacity: 0.4 }} />
            <span style={{ fontSize: 14, fontWeight: 500 }}>Nenhuma sprint selecionada</span>
            {onCreateSprint && (
              <button
                type="button"
                onClick={onCreateSprint}
                style={{
                  background: accentColor,
                  color: accentContrastText,
                  border: 'none',
                  borderRadius: 6,
                  padding: '7px 14px',
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Plus size={14} />
                <span>Criar primeira sprint</span>
              </button>
            )}
          </div>
        ) : (
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              flex: 1,
              minHeight: 0,
              position: 'relative',
            }}
          >
            {/* Cabeçalho da Sprint Ativa (direto no fundo, fora da div de tarefas) */}
            <div
              style={{
                padding: '12px 14px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 14,
                flexWrap: 'wrap',
                flexShrink: 0,
                borderBottom: `1px solid ${hexToRgba(theme.textSecondary, isEffectiveDark ? 0.08 : 0.06)}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                {/* Botão com ícone à esquerda da sprint: apenas o ícone colorido, sem fundo e sem brilho */}
                <button
                  type="button"
                  onClick={toggleSprintSidebar}
                  title={isSprintSidebarVisible ? 'Ocultar lista e calendário de sprints' : 'Exibir lista e calendário de sprints'}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    color: accentColor,
                    boxShadow: 'none',
                    transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), opacity 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                    transform: 'scale(1)',
                    flexShrink: 0,
                    padding: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.15)';
                    e.currentTarget.style.opacity = '0.85';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.opacity = '1';
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transition: 'transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                      transform: isSprintSidebarVisible ? 'rotate(0deg)' : 'rotate(180deg)',
                    }}
                  >
                    {isSprintSidebarVisible ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
                  </div>
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {statusBadge && (
                      <span
                        style={{
                          background: statusBadge.bg,
                          border: statusBadge.border,
                          color: statusBadge.color,
                          borderRadius: 12,
                          padding: '2px 10px',
                          fontSize: 11,
                          fontWeight: 600,
                        }}
                      >
                        {statusBadge.label}
                      </span>
                    )}
                    <span style={{ fontSize: 18, fontWeight: 400, color: theme.textPrimary }}>{openedSprint.title}</span>
                  </div>

                {!isEditingSprintDates ? (
                  <div
                    onClick={onStartEditSprintDates}
                    role="button"
                    tabIndex={0}
                    title="Clique para editar as datas da sprint"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '2px 0',
                      borderRadius: 4,
                      cursor: 'pointer',
                      border: 'none',
                      background: 'transparent',
                      transition: 'opacity 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.75';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                  >
                    <Calendar size={13} style={{ color: accentColor }} />
                    <span style={{ fontSize: 12, fontWeight: 400, color: theme.textSecondary }}>
                      {openedSprint.dateRangeLabel && openedSprint.dateRangeLabel !== 'Sem datas'
                        ? openedSprint.dateRangeLabel
                        : 'Definir datas da sprint'}
                    </span>
                    <Pencil size={11} style={{ color: theme.textSecondary, opacity: 0.6, marginLeft: 2 }} />
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: theme.textSecondary }}>De:</span>
                      <input
                        type="date"
                        value={editSprintStartDate}
                        onChange={(e) => setEditSprintStartDate(e.target.value)}
                        style={{
                          background: isEffectiveDark ? '#222' : '#f1f5f9',
                          border: `1px solid ${isEffectiveDark ? '#444' : '#cbd5e1'}`,
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: 12,
                          color: theme.textPrimary,
                          colorScheme: isEffectiveDark ? 'dark' : 'light',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 11, color: theme.textSecondary }}>Até:</span>
                      <input
                        type="date"
                        value={editSprintDueDate}
                        onChange={(e) => setEditSprintDueDate(e.target.value)}
                        style={{
                          background: isEffectiveDark ? '#222' : '#f1f5f9',
                          border: `1px solid ${isEffectiveDark ? '#444' : '#cbd5e1'}`,
                          borderRadius: 6,
                          padding: '4px 8px',
                          fontSize: 12,
                          color: theme.textPrimary,
                          colorScheme: isEffectiveDark ? 'dark' : 'light',
                          outline: 'none',
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={onSaveSprintDates}
                      disabled={isSavingSprintDates}
                      style={{
                        background: accentColor,
                        color: accentContrastText,
                        border: 'none',
                        borderRadius: 6,
                        padding: '5px 12px',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isSavingSprintDates ? 'default' : 'pointer',
                        opacity: isSavingSprintDates ? 0.6 : 1,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                      }}
                    >
                      <Check size={13} />
                      <span>{isSavingSprintDates ? 'Salvando...' : 'Salvar'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={onCancelEditSprintDates}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: theme.textSecondary,
                        fontSize: 12,
                        cursor: 'pointer',
                        padding: '5px 8px',
                      }}
                    >
                      Cancelar
                    </button>
                  </div>
                )}
                </div>
              </div>

              {/* 3 KPIs essenciais e minimalistas */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginLeft: 'auto' }}>
                {/* KPI 1: Progresso */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: theme.textSecondary,
                    }}
                  >
                    Progresso
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: theme.textPrimary }}>
                      {sprintKpis.percent}%
                    </span>
                    <span style={{ fontSize: 11, color: theme.textSecondary }}>
                      ({sprintKpis.done}/{sprintKpis.total})
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    width: 1,
                    height: 20,
                    background: hexToRgba(theme.textSecondary, isEffectiveDark ? 0.18 : 0.14),
                  }}
                />

                {/* KPI 2: Em Andamento */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: theme.textSecondary,
                    }}
                  >
                    Em Andamento
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#58a6ff' }}>
                      {sprintKpis.inProgress}
                    </span>
                    <span style={{ fontSize: 11, color: theme.textSecondary }}>
                      · {sprintKpis.open} a fazer
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    width: 1,
                    height: 20,
                    background: hexToRgba(theme.textSecondary, isEffectiveDark ? 0.18 : 0.14),
                  }}
                />

                {/* KPI 3: Prazo */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      letterSpacing: '0.06em',
                      color: theme.textSecondary,
                    }}
                  >
                    Prazo
                  </span>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 600,
                        color: sprintKpis.daysLeftSub === 'atrasado' ? '#f85149' : theme.textPrimary,
                      }}
                    >
                      {sprintKpis.daysLeftText}
                    </span>
                    <span style={{ fontSize: 11, color: theme.textSecondary }}>
                      {sprintKpis.daysLeftSub}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Sub-cabeçalho de Ações: Toggle Lista/Calendário + Adicionar tarefa (fora da div de tarefas) */}
            <div
              style={{
                padding: '4px 0px 6px 0px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
                flexWrap: 'wrap',
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  background: isEffectiveDark ? '#1a1a1a' : '#e2e8f0',
                  borderRadius: 8,
                  padding: 3,
                  gap: 2,
                }}
              >
                <button
                  type="button"
                  onClick={() => setSprintDetailViewMode('issues')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: sprintDetailViewMode === 'issues' ? (isEffectiveDark ? '#242424' : '#ffffff') : 'transparent',
                    color: sprintDetailViewMode === 'issues' ? theme.textPrimary : theme.textSecondary,
                    fontSize: 11.5,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <CircleDot size={12} />
                  <span>Issues</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSprintDetailViewMode('list')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: sprintDetailViewMode === 'list' ? (isEffectiveDark ? '#242424' : '#ffffff') : 'transparent',
                    color: sprintDetailViewMode === 'list' ? theme.textPrimary : theme.textSecondary,
                    fontSize: 11.5,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <List size={12} />
                  <span>Tabela</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSprintDetailViewMode('calendar')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: sprintDetailViewMode === 'calendar' ? (isEffectiveDark ? '#242424' : '#ffffff') : 'transparent',
                    color: sprintDetailViewMode === 'calendar' ? theme.textPrimary : theme.textSecondary,
                    fontSize: 11.5,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <CalendarDays size={12} />
                  <span>Calendário</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSprintDetailViewMode('roadmap')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: sprintDetailViewMode === 'roadmap' ? (isEffectiveDark ? '#242424' : '#ffffff') : 'transparent',
                    color: sprintDetailViewMode === 'roadmap' ? theme.textPrimary : theme.textSecondary,
                    fontSize: 11.5,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <Calendar size={12} />
                  <span>Roadmap</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSprintDetailViewMode('kanban')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                    padding: '5px 10px',
                    borderRadius: 6,
                    background: sprintDetailViewMode === 'kanban' ? (isEffectiveDark ? '#242424' : '#ffffff') : 'transparent',
                    color: sprintDetailViewMode === 'kanban' ? theme.textPrimary : theme.textSecondary,
                    fontSize: 11.5,
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <KanbanIcon size={12} />
                  <span>Quadro</span>
                </button>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, position: 'relative' }}>
                {/* Dropdown de Filtro de Issues (Todas as Issues, Atribuídas a mim, Criadas por mim, Mencionado, Atividade recente) */}
                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setIsSprintTaskFilterOpen((prev) => !prev)}
                    style={{
                      background: isEffectiveDark ? '#242424' : '#e2e8f0',
                      color: theme.textPrimary,
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                    title="Filtrar tarefas da sprint"
                  >
                    <ActiveFilterIcon
                      size={13}
                      color={sprintTaskFilter === 'all' ? (isEffectiveDark ? '#f97316' : '#ea580c') : accentColor}
                    />
                    <span>{activeFilterOption.label}</span>
                    {sprintTaskFilter === 'all' && (
                      <span
                        style={{
                          fontSize: 10.5,
                          padding: '1px 5.5px',
                          borderRadius: 10,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1',
                          color: theme.textSecondary,
                          fontWeight: 500,
                        }}
                      >
                        {sprintDetailTasks.length}
                      </span>
                    )}
                    <ChevronDown size={11} style={{ opacity: 0.7 }} />
                  </button>

                  {isSprintTaskFilterOpen && (
                    <>
                      <div
                        onClick={() => setIsSprintTaskFilterOpen(false)}
                        style={{ position: 'fixed', inset: 0, zIndex: 30 }}
                      />
                      <div
                        style={{
                          position: 'absolute',
                          top: '100%',
                          left: 0,
                          marginTop: 4,
                          background: theme.dropdownBg,
                          borderRadius: 10,
                          boxShadow: theme.dropdownShadow || '0 8px 24px rgba(0,0,0,0.45)',
                          border: 'none',
                          zIndex: 40,
                          minWidth: 200,
                          padding: '5px',
                        }}
                        className="no-scrollbar"
                      >
                        {sprintFilterOptions.map((opt) => {
                          const isSelected = sprintTaskFilter === opt.key;
                          const ItemIcon = opt.icon;
                          return (
                            <div
                              key={opt.key}
                              onClick={() => {
                                setSprintTaskFilter(opt.key);
                                setIsSprintTaskFilterOpen(false);
                              }}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                padding: '7.5px 10px',
                                borderRadius: 6,
                                fontSize: 12.5,
                                cursor: 'pointer',
                                background: isSelected
                                  ? (isEffectiveDark ? '#262626' : '#e5e5e5')
                                  : 'transparent',
                                color: isSelected ? theme.textPrimary : theme.textSecondary,
                                transition: 'background 0.12s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.background = isEffectiveDark
                                    ? 'rgba(255,255,255,0.05)'
                                    : 'rgba(0,0,0,0.04)';
                                  e.currentTarget.style.color = theme.textPrimary;
                                }
                              }}
                              onMouseLeave={(e) => {
                                if (!isSelected) {
                                  e.currentTarget.style.background = 'transparent';
                                  e.currentTarget.style.color = theme.textSecondary;
                                }
                              }}
                            >
                              <ItemIcon
                                size={14}
                                color={
                                  isSelected
                                    ? opt.iconActiveColor || accentColor
                                    : theme.textSecondary
                                }
                              />
                              <span style={{ flex: 1, whiteSpace: 'nowrap' }}>{opt.label}</span>
                              {opt.count !== undefined && (
                                <span
                                  style={{
                                    fontSize: 10.5,
                                    padding: '1px 6px',
                                    borderRadius: 10,
                                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1',
                                    color: isSelected ? theme.textPrimary : theme.textSecondary,
                                    fontWeight: 500,
                                  }}
                                >
                                  {opt.count}
                                </span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>

                <div style={{ position: 'relative' }}>
                  <button
                    type="button"
                    onClick={() => setIsAddExistingTaskOpen((prev) => !prev)}
                    style={{
                      background: isEffectiveDark ? '#242424' : '#e2e8f0',
                      color: theme.textPrimary,
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 12px',
                      fontSize: 12,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                    }}
                  >
                    <span>Adicionar tarefa existente</span>
                    <ChevronDown size={11} />
                  </button>
                  {isAddExistingTaskOpen && (
                    <>
                      <div onClick={() => setIsAddExistingTaskOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 30 }} />
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
                          minWidth: 240,
                          maxHeight: 260,
                          overflowY: 'auto',
                          padding: '4px 0',
                        }}
                        className="no-scrollbar"
                      >
                        {tasksAvailableToAddToSprint.length === 0 ? (
                          <div style={{ padding: '10px 12px', fontSize: 12, color: theme.textSecondary }}>
                            Nenhuma tarefa disponível.
                          </div>
                        ) : (
                          tasksAvailableToAddToSprint.map((task) => (
                            <div
                              key={task.id}
                              onClick={() => onAddExistingTask(task)}
                              style={{
                                padding: '7px 12px',
                                fontSize: 12,
                                color: theme.textPrimary,
                                cursor: 'pointer',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              title={task.title}
                            >
                              {task.title}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>

                <button
                  type="button"
                  onClick={onCreateNewTask}
                  style={{
                    background: accentColor,
                    color: accentContrastText,
                    border: 'none',
                    borderRadius: 6,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 5,
                  }}
                >
                  <Plus size={13} />
                  <span>Nova tarefa</span>
                </button>
              </div>
            </div>

            {/* Div de Issues / Tarefas: Contêiner no Padrão da Aba de Tarefas */}
            <div
              style={{
                flex: 1,
                minHeight: 0,
                background: theme.viewCanvasBg,
                borderRadius: 8,
                border: 'none',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                position: 'relative',
              }}
            >
              {sprintDetailViewMode === 'issues' ? (
                /* ========================================================================= */
                /* MODO ISSUE (PADRÃO GITHUB ISSUES, CONFORME DESIGN SOLICITADO)             */
                /* ========================================================================= */
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
                  {/* BARRA SUPERIOR DO MODO ISSUE */}
                  {(() => {
                    let filteredList = [...displayedTasks];
                    if (issueStateFilter === 'open') filteredList = filteredList.filter((t) => t.status !== 'Concluído');
                    else if (issueStateFilter === 'closed') filteredList = filteredList.filter((t) => t.status === 'Concluído');
                    if (issueAuthorFilter) filteredList = filteredList.filter((t) => (t.author || '').toLowerCase() === issueAuthorFilter.toLowerCase());
                    if (issueLabelFilter) {
                      const target = issueLabelFilter.toLowerCase();
                      filteredList = filteredList.filter((t) => {
                        const tag = (t.tag || '').toLowerCase();
                        const stat = (t.status || '').toLowerCase().replace(/\s+/g, '-');
                        const pri = `priority: ${(t.priority || '').toLowerCase()}`;
                        const hasRaw = t.rawLabels?.some((l) => l.toLowerCase() === target);
                        return tag === target || stat === target || pri === target || hasRaw;
                      });
                    }
                    if (issueAssigneeFilter) {
                      const target = issueAssigneeFilter.toLowerCase();
                      filteredList = filteredList.filter((t) => t.assignees?.some((a) => (a.name || '').toLowerCase() === target));
                    }
                    const parentChildIdsInFiltered = new Set<string>();
                    const parentChildNumbersInFiltered = new Set<number>();
                    filteredList.forEach((parent) => {
                      const subs = extractSubIssuesForIssue(parent, allIssuesMap);
                      subs.forEach((s) => {
                        if (s.linkedIssue?.id && s.linkedIssue.id !== parent.id) {
                          parentChildIdsInFiltered.add(s.linkedIssue.id);
                        }
                        if (s.issueNumber && s.issueNumber !== parent.githubNumber) {
                          parentChildNumbersInFiltered.add(s.issueNumber);
                        }
                      });
                      if (parent.subIssueNumbers && parent.subIssueNumbers.length > 0) {
                        parent.subIssueNumbers.forEach((num) => {
                          if (num !== parent.githubNumber) {
                            parentChildNumbersInFiltered.add(num);
                          }
                        });
                      }
                    });

                    const rawTopLevelFilteredList = filteredList.filter((task) => {
                      const hasParentInList =
                        parentChildIdsInFiltered.has(task.id) ||
                        (task.githubNumber != null && parentChildNumbersInFiltered.has(task.githubNumber));
                      return !hasParentInList;
                    });
                    const topLevelFilteredList = rawTopLevelFilteredList.length > 0 ? rawTopLevelFilteredList : filteredList;
                    const isAllSelected = topLevelFilteredList.length > 0 && topLevelFilteredList.every((t) => selectedIssueIds.includes(t.id));
                    const isSomeSelected = selectedIssueIds.length > 0 && !isAllSelected;
                    const selectedTasks = displayedTasks.filter((t) => selectedIssueIds.includes(t.id));
                    const hasOpenSelected = selectedTasks.some((t) => t.status !== 'Concluído');
                    const hasClosedSelected = selectedTasks.some((t) => t.status === 'Concluído');
                    const hasSelection = selectedIssueIds.length > 0;

                    return (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '10px 16px',
                          background: isEffectiveDark ? '#161616' : '#f8fafc',
                          borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                          gap: 12,
                          flexWrap: 'wrap',
                          userSelect: 'none',
                        }}
                      >
                        {/* Lado Esquerdo: Checkbox mestre + Estado ou Contador de Selecionadas */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                          {renderCustomCheckbox(
                            isAllSelected,
                            isSomeSelected,
                            () => {
                              if (isAllSelected) setSelectedIssueIds([]);
                              else setSelectedIssueIds(topLevelFilteredList.map((t) => t.id));
                            },
                            isAllSelected ? 'Desmarcar todas' : 'Selecionar todas as issues visíveis'
                          )}

                          {hasSelection ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontSize: 12.5, fontWeight: 600, color: theme.textPrimary }}>
                                {selectedIssueIds.length} {selectedIssueIds.length === 1 ? 'selecionada' : 'selecionadas'}
                              </span>
                              <button
                                type="button"
                                onClick={() => setSelectedIssueIds([])}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: accentColor,
                                  fontSize: 12,
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  padding: '2px 4px',
                                  textDecoration: 'underline',
                                }}
                              >
                                Desmarcar todas
                              </button>
                            </div>
                          ) : (
                            <>
                              {/* Todas */}
                              <button
                                type="button"
                                onClick={() => setIssueStateFilter('all')}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  background: issueStateFilter === 'all'
                                    ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                                    : 'transparent',
                                  border: 'none',
                                  borderRadius: 20,
                                  padding: '3px 10px',
                                  color: issueStateFilter === 'all' ? theme.textPrimary : theme.textSecondary,
                                  fontSize: 12.5,
                                  fontWeight: issueStateFilter === 'all' ? 600 : 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.12s ease',
                                }}
                              >
                                <span>Todas</span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                                    borderRadius: 10,
                                    padding: '0 6px',
                                  }}
                                >
                                  {openIssuesCount + closedIssuesCount}
                                </span>
                              </button>

                              {/* Aberto */}
                              <button
                                type="button"
                                onClick={() => setIssueStateFilter(issueStateFilter === 'open' ? 'all' : 'open')}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  background: issueStateFilter === 'open'
                                    ? (isEffectiveDark ? 'rgba(34, 197, 94, 0.15)' : '#dcfce7')
                                    : 'transparent',
                                  border: 'none',
                                  borderRadius: 20,
                                  padding: '3px 10px',
                                  color: issueStateFilter === 'open' ? '#22c55e' : theme.textPrimary,
                                  fontSize: 12.5,
                                  fontWeight: issueStateFilter === 'open' ? 600 : 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.12s ease',
                                }}
                              >
                                <CircleDot size={14} color="#22c55e" />
                                <span>Aberto</span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                                    borderRadius: 10,
                                    padding: '0 6px',
                                  }}
                                >
                                  {openIssuesCount}
                                </span>
                              </button>

                              {/* Fechado */}
                              <button
                                type="button"
                                onClick={() => setIssueStateFilter(issueStateFilter === 'closed' ? 'all' : 'closed')}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  background: issueStateFilter === 'closed'
                                    ? (isEffectiveDark ? 'rgba(168, 85, 247, 0.15)' : '#f3e8ff')
                                    : 'transparent',
                                  border: 'none',
                                  borderRadius: 20,
                                  padding: '3px 10px',
                                  color: issueStateFilter === 'closed' ? '#a855f7' : theme.textSecondary,
                                  fontSize: 12.5,
                                  fontWeight: issueStateFilter === 'closed' ? 600 : 500,
                                  cursor: 'pointer',
                                  transition: 'all 0.12s ease',
                                }}
                              >
                                <Check size={14} color={issueStateFilter === 'closed' ? '#a855f7' : theme.textSecondary} />
                                <span>Fechado</span>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 600,
                                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)',
                                    borderRadius: 10,
                                    padding: '0 6px',
                                  }}
                                >
                                  {closedIssuesCount}
                                </span>
                              </button>

                              {selectedCalendarDayIso && isSprintSidebarVisible && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedCalendarDayIso(null)}
                                  title="Clique para remover o filtro por dia do calendário"
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    padding: '3px 8px',
                                    borderRadius: 20,
                                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                                    border: 'none',
                                    color: accentColor,
                                    fontSize: 11,
                                    cursor: 'pointer',
                                    fontWeight: 400,
                                    transition: 'opacity 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                                  onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                                >
                                  <Calendar size={11} />
                                  <span>Dia: {selectedCalendarDayIso}</span>
                                  <X size={10} />
                                </button>
                              )}
                            </>
                          )}
                        </div>

                        {/* Lado Direito: Ações em Lote (quando selecionadas) OU Filtros (Autor, Etiquetas, etc.) + Botão Nova Issue */}
                        {hasSelection ? (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                            {/* Ação em lote: Fechar issues */}
                            {hasOpenSelected && (
                              <button
                                type="button"
                                onClick={() => handleBatchToggleStatus('close')}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '5px 10px',
                                  color: theme.textPrimary,
                                  fontSize: 12,
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  transition: 'background 0.12s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')}
                                title="Marcar issues selecionadas como concluídas"
                              >
                                <CheckCircle2 size={13} color="#a855f7" />
                                <span>Fechar</span>
                              </button>
                            )}

                            {/* Ação em lote: Reabrir issues */}
                            {hasClosedSelected && (
                              <button
                                type="button"
                                onClick={() => handleBatchToggleStatus('reopen')}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '5px 10px',
                                  color: theme.textPrimary,
                                  fontSize: 12,
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  transition: 'background 0.12s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')}
                                title="Reabrir issues selecionadas"
                              >
                                <CircleDot size={13} color="#22c55e" />
                                <span>Reabrir</span>
                              </button>
                            )}

                            {/* Ação em lote: Atribuir responsável */}
                            <div style={{ position: 'relative' }}>
                              <button
                                type="button"
                                onClick={() => setBatchActiveDropdown(batchActiveDropdown === 'assign' ? null : 'assign')}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  background: batchActiveDropdown === 'assign'
                                    ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                                    : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'),
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '5px 10px',
                                  color: theme.textPrimary,
                                  fontSize: 12,
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  transition: 'background 0.12s ease',
                                }}
                                title="Atribuir responsável às issues selecionadas"
                              >
                                <Users size={13} color={theme.textSecondary} />
                                <span>Atribuir</span>
                                <ChevronDown size={11} />
                              </button>

                              {batchActiveDropdown === 'assign' && (
                                <>
                                  <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setBatchActiveDropdown(null)} />
                                  <div
                                    style={{
                                      position: 'absolute',
                                      top: 'calc(100% + 4px)',
                                      right: 0,
                                      background: theme.dropdownBg,
                                      borderRadius: 8,
                                      boxShadow: theme.dropdownShadow,
                                      padding: '4px',
                                      zIndex: 9999,
                                      minWidth: 190,
                                      maxHeight: 240,
                                      overflowY: 'auto',
                                    }}
                                    className="no-scrollbar"
                                  >
                                    <div style={{ padding: '4px 8px', fontSize: 10.5, fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                                      Atribuir a
                                    </div>
                                    <div
                                      onClick={handleBatchAssignToMe}
                                      style={{
                                        padding: '6px 8px',
                                        borderRadius: 4,
                                        cursor: 'pointer',
                                        fontSize: 12,
                                        color: theme.textPrimary,
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: 7,
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                    >
                                      <UserCheck size={13} color={accentColor} />
                                      <span>Atribuir a mim</span>
                                    </div>
                                    {collaborators.length > 0 && (
                                      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)', margin: '3px 0' }} />
                                    )}
                                    {collaborators.map((c) => (
                                      <div
                                        key={c.login}
                                        onClick={() => handleBatchAssign(c.login, c.avatarUrl)}
                                        style={{
                                          padding: '6px 8px',
                                          borderRadius: 4,
                                          cursor: 'pointer',
                                          fontSize: 12,
                                          color: theme.textPrimary,
                                          display: 'flex',
                                          alignItems: 'center',
                                          gap: 7,
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                      >
                                        {c.avatarUrl ? (
                                          <img src={c.avatarUrl} alt={c.login} style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }} />
                                        ) : (
                                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: accentColor, color: '#fff', fontSize: 9, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            {c.login.slice(0, 2).toUpperCase()}
                                          </div>
                                        )}
                                        <span>{c.login}</span>
                                      </div>
                                    ))}
                                  </div>
                                </>
                              )}
                            </div>

                            {/* Ação em lote: Desvincular da sprint (se sprint aberta) */}
                            {openedSprint && onRemoveTaskFromSprint && (
                              <button
                                type="button"
                                onClick={handleBatchRemoveFromSprint}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '5px 10px',
                                  color: theme.textPrimary,
                                  fontSize: 12,
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  transition: 'background 0.12s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)')}
                                title="Desvincular issues selecionadas desta sprint"
                              >
                                <Archive size={13} color={theme.textSecondary} />
                                <span>Desvincular da sprint</span>
                              </button>
                            )}

                            {/* Ação em lote: Excluir */}
                            {onDeleteTask && (
                              <button
                                type="button"
                                onClick={handleBatchDelete}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  background: isEffectiveDark ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2',
                                  border: 'none',
                                  borderRadius: 6,
                                  padding: '5px 10px',
                                  color: '#ef4444',
                                  fontSize: 12,
                                  fontWeight: 500,
                                  cursor: 'pointer',
                                  transition: 'background 0.12s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(239, 68, 68, 0.2)' : '#fecaca')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(239, 68, 68, 0.12)' : '#fee2e2')}
                                title="Excluir issues selecionadas"
                              >
                                <Trash2 size={13} color="#ef4444" />
                                <span>Excluir</span>
                              </button>
                            )}
                          </div>
                        ) : (
                          /* Lado Direito: Filtros (Autor, Etiquetas, Projetos, Marcos, Responsáveis, Sort) */
                          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      {/* Filtro: Autor */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setIssueActiveDropdown(issueActiveDropdown === 'author' ? null : 'author')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: issueAuthorFilter ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0') : 'transparent',
                            border: 'none',
                            color: issueAuthorFilter ? theme.textPrimary : theme.textSecondary,
                            fontSize: 12,
                            cursor: 'pointer',
                            padding: '3px 6px',
                            borderRadius: 4,
                          }}
                        >
                          <span>{issueAuthorFilter ? `Autor: ${issueAuthorFilter}` : 'Autor'}</span>
                          <ChevronDown size={11} />
                        </button>

                        {issueActiveDropdown === 'author' && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setIssueActiveDropdown(null)} />
                            <div
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 4px)',
                                right: 0,
                                background: theme.dropdownBg,
                                border: 'none',
                                borderRadius: 8,
                                boxShadow: theme.dropdownShadow,
                                padding: '4px',
                                zIndex: 9999,
                                minWidth: 160,
                                maxHeight: 220,
                                overflowY: 'auto',
                              }}
                              className="no-scrollbar"
                            >
                              <div style={{ padding: '4px 8px', fontSize: 10.5, fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase' }}>
                                Filtrar por autor
                              </div>
                              <div
                                onClick={() => { setIssueAuthorFilter(null); setIssueActiveDropdown(null); }}
                                style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: !issueAuthorFilter ? accentColor : theme.textPrimary }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                Todos os autores
                              </div>
                              {distinctAuthors.map((author) => (
                                <div
                                  key={author}
                                  onClick={() => { setIssueAuthorFilter(author); setIssueActiveDropdown(null); }}
                                  style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: issueAuthorFilter === author ? accentColor : theme.textPrimary }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                  {author}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Filtro: Etiquetas */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setIssueActiveDropdown(issueActiveDropdown === 'label' ? null : 'label')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: issueLabelFilter ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0') : 'transparent',
                            border: 'none',
                            color: issueLabelFilter ? theme.textPrimary : theme.textSecondary,
                            fontSize: 12,
                            cursor: 'pointer',
                            padding: '3px 6px',
                            borderRadius: 4,
                          }}
                        >
                          <span>{issueLabelFilter ? `Etiqueta: ${issueLabelFilter}` : 'Etiquetas'}</span>
                          <ChevronDown size={11} />
                        </button>

                        {issueActiveDropdown === 'label' && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setIssueActiveDropdown(null)} />
                            <div
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 4px)',
                                right: 0,
                                background: theme.dropdownBg,
                                border: 'none',
                                borderRadius: 8,
                                boxShadow: theme.dropdownShadow,
                                padding: '4px',
                                zIndex: 9999,
                                minWidth: 175,
                                maxHeight: 220,
                                overflowY: 'auto',
                              }}
                              className="no-scrollbar"
                            >
                              <div style={{ padding: '4px 8px', fontSize: 10.5, fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase' }}>
                                Filtrar por etiqueta
                              </div>
                              <div
                                onClick={() => { setIssueLabelFilter(null); setIssueActiveDropdown(null); }}
                                style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: !issueLabelFilter ? accentColor : theme.textPrimary }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                Todas as etiquetas
                              </div>
                              {distinctLabels.map((label) => (
                                <div
                                  key={label}
                                  onClick={() => { setIssueLabelFilter(label); setIssueActiveDropdown(null); }}
                                  style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: issueLabelFilter === label ? accentColor : theme.textPrimary }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                  {label}
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Projetos */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setProjectPickerOpen((prev) => !prev)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            background: projectPickerOpen
                              ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')
                              : 'transparent',
                            border: 'none',
                            color: theme.textPrimary,
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer',
                            padding: '3px 7px',
                            borderRadius: 4,
                            transition: 'all 0.12s ease',
                          }}
                        >
                          <FolderGit2 size={13} color={accentColor} />
                          <span style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {selectedProject?.title || selectedProject?.name || 'Projetos'}
                          </span>
                          <ChevronDown size={11} color={theme.textSecondary} />
                        </button>

                        {projectPickerOpen && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setProjectPickerOpen(false)} />
                            <div
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 4px)',
                                left: 0,
                                background: theme.dropdownBg,
                                border: `1px solid ${hexToRgba(theme.textSecondary, isEffectiveDark ? 0.2 : 0.15)}`,
                                borderRadius: 8,
                                boxShadow: theme.dropdownShadow,
                                padding: '6px',
                                zIndex: 9999,
                                width: 280,
                                maxHeight: 320,
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 4,
                              }}
                            >
                              {/* Campo de busca de projetos */}
                              <div
                                style={{
                                  padding: '4px 7px',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  background: isEffectiveDark ? '#1a1a1a' : '#f1f5f9',
                                  borderRadius: 5,
                                }}
                              >
                                <Search size={12} color={theme.textSecondary} />
                                <input
                                  type="text"
                                  placeholder="Filtrar projetos..."
                                  value={projectPickerSearch}
                                  onChange={(e) => setProjectPickerSearch(e.target.value)}
                                  autoFocus
                                  style={{
                                    border: 'none',
                                    outline: 'none',
                                    background: 'transparent',
                                    fontSize: 11.5,
                                    color: theme.textPrimary,
                                    width: '100%',
                                  }}
                                />
                                {projectPickerSearch && (
                                  <X
                                    size={12}
                                    color={theme.textSecondary}
                                    style={{ cursor: 'pointer' }}
                                    onClick={() => setProjectPickerSearch('')}
                                  />
                                )}
                              </div>

                              <div style={{ maxHeight: 240, overflowY: 'auto' }} className="no-scrollbar">
                                {filteredPickerProjects.length === 0 ? (
                                  <div style={{ padding: '12px 8px', textAlign: 'center', color: theme.textSecondary, fontSize: 11 }}>
                                    Nenhum projeto encontrado.
                                  </div>
                                ) : (
                                  filteredPickerProjects.map((card) => {
                                    const isCurrent = selectedProject?.id === card.id;
                                    return (
                                      <div
                                        key={card.id}
                                        onClick={() => {
                                          onSelectProject?.(card.id);
                                          setProjectPickerOpen(false);
                                        }}
                                        style={{
                                          padding: '6px 8px',
                                          borderRadius: 5,
                                          cursor: 'pointer',
                                          fontSize: 12,
                                          color: isCurrent ? accentColor : theme.textPrimary,
                                          fontWeight: isCurrent ? 600 : 400,
                                          background: isCurrent
                                            ? hexToRgba(accentColor, isEffectiveDark ? 0.18 : 0.12)
                                            : 'transparent',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          gap: 8,
                                        }}
                                        onMouseEnter={(e) => {
                                          if (!isCurrent) e.currentTarget.style.background = theme.dropdownItemHover;
                                        }}
                                        onMouseLeave={(e) => {
                                          if (!isCurrent) e.currentTarget.style.background = 'transparent';
                                        }}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                                          <div
                                            style={{
                                              width: 18,
                                              height: 18,
                                              borderRadius: '50%',
                                              background: isCurrent
                                                ? accentColor
                                                : (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
                                              color: isCurrent ? accentContrastText : theme.textSecondary,
                                              fontSize: 9.5,
                                              display: 'flex',
                                              alignItems: 'center',
                                              justifyContent: 'center',
                                              flexShrink: 0,
                                            }}
                                          >
                                            {card.badge}
                                          </div>
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                            {card.title}
                                          </span>
                                        </div>
                                        {card.language && (
                                          <span style={{ fontSize: 10, color: theme.textSecondary, flexShrink: 0 }}>
                                            {card.language}
                                          </span>
                                        )}
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                            </div>
                          </>
                        )}
                      </div>

                      {/* Marcos */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'transparent',
                            border: 'none',
                            color: theme.textSecondary,
                            fontSize: 12,
                            cursor: 'pointer',
                            padding: '3px 6px',
                            borderRadius: 4,
                          }}
                        >
                          <span>Marcos</span>
                          <ChevronDown size={11} />
                        </button>
                      </div>

                      {/* Responsáveis */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setIssueActiveDropdown(issueActiveDropdown === 'assignee' ? null : 'assignee')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: issueAssigneeFilter ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0') : 'transparent',
                            border: 'none',
                            color: issueAssigneeFilter ? theme.textPrimary : theme.textSecondary,
                            fontSize: 12,
                            cursor: 'pointer',
                            padding: '3px 6px',
                            borderRadius: 4,
                          }}
                        >
                          <span>{issueAssigneeFilter ? `Responsável: ${issueAssigneeFilter}` : 'Responsáveis'}</span>
                          <ChevronDown size={11} />
                        </button>

                        {issueActiveDropdown === 'assignee' && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setIssueActiveDropdown(null)} />
                            <div
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 4px)',
                                right: 0,
                                background: theme.dropdownBg,
                                border: 'none',
                                borderRadius: 8,
                                boxShadow: theme.dropdownShadow,
                                padding: '4px',
                                zIndex: 9999,
                                minWidth: 175,
                                maxHeight: 220,
                                overflowY: 'auto',
                              }}
                              className="no-scrollbar"
                            >
                              <div style={{ padding: '4px 8px', fontSize: 10.5, fontWeight: 600, color: theme.textSecondary, textTransform: 'uppercase' }}>
                                Filtrar por responsável
                              </div>
                              <div
                                onClick={() => { setIssueAssigneeFilter(null); setIssueActiveDropdown(null); }}
                                style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: !issueAssigneeFilter ? accentColor : theme.textPrimary }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                Todos os responsáveis
                              </div>
                              {collaborators.map((c) => (
                                <div
                                  key={c.login}
                                  onClick={() => { setIssueAssigneeFilter(c.login); setIssueActiveDropdown(null); }}
                                  style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: issueAssigneeFilter === c.login ? accentColor : theme.textPrimary, display: 'flex', alignItems: 'center', gap: 6 }}
                                  onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                >
                                  {c.avatarUrl && <img src={c.avatarUrl} alt="" style={{ width: 14, height: 14, borderRadius: '50%' }} />}
                                  <span>{c.login}</span>
                                </div>
                              ))}
                            </div>
                          </>
                        )}
                      </div>

                      {/* Ordenação: Mais recentes */}
                      <div style={{ position: 'relative' }}>
                        <button
                          type="button"
                          onClick={() => setIssueActiveDropdown(issueActiveDropdown === 'sort' ? null : 'sort')}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            background: 'transparent',
                            border: 'none',
                            color: theme.textSecondary,
                            fontSize: 12,
                            cursor: 'pointer',
                            padding: '3px 6px',
                            borderRadius: 4,
                          }}
                        >
                          <ArrowUpDown size={11} />
                          <span>{issueSortFilter === 'oldest' ? 'Mais antigas' : issueSortFilter === 'title' ? 'Título' : 'Mais recentes'}</span>
                          <ChevronDown size={11} />
                        </button>

                        {issueActiveDropdown === 'sort' && (
                          <>
                            <div style={{ position: 'fixed', inset: 0, zIndex: 9998 }} onClick={() => setIssueActiveDropdown(null)} />
                            <div
                              style={{
                                position: 'absolute',
                                top: 'calc(100% + 4px)',
                                right: 0,
                                background: theme.dropdownBg,
                                border: 'none',
                                borderRadius: 8,
                                boxShadow: theme.dropdownShadow,
                                padding: '4px',
                                zIndex: 9999,
                                minWidth: 150,
                              }}
                            >
                              <div
                                onClick={() => { setIssueSortFilter('recent'); setIssueActiveDropdown(null); }}
                                style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: issueSortFilter === 'recent' ? accentColor : theme.textPrimary }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                Mais recentes
                              </div>
                              <div
                                onClick={() => { setIssueSortFilter('oldest'); setIssueActiveDropdown(null); }}
                                style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: issueSortFilter === 'oldest' ? accentColor : theme.textPrimary }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                Mais antigas
                              </div>
                              <div
                                onClick={() => { setIssueSortFilter('title'); setIssueActiveDropdown(null); }}
                                style={{ padding: '6px 8px', borderRadius: 4, cursor: 'pointer', fontSize: 12, color: issueSortFilter === 'title' ? accentColor : theme.textPrimary }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = theme.dropdownItemHover)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              >
                                Título (A-Z)
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                        )}
                  </div>
                    );
                  })()}

                  {/* LISTAGEM DE ISSUES */}
                  {(() => {
                    let list = [...displayedTasks];
                    if (issueStateFilter === 'open') list = list.filter((t) => t.status !== 'Concluído');
                    else if (issueStateFilter === 'closed') list = list.filter((t) => t.status === 'Concluído');
                    if (issueAuthorFilter) list = list.filter((t) => (t.author || '').toLowerCase() === issueAuthorFilter.toLowerCase());
                    if (issueLabelFilter) {
                      const target = issueLabelFilter.toLowerCase();
                      list = list.filter((t) => {
                        const tag = (t.tag || '').toLowerCase();
                        const stat = (t.status || '').toLowerCase().replace(/\s+/g, '-');
                        const pri = `priority: ${(t.priority || '').toLowerCase()}`;
                        const hasRaw = t.rawLabels?.some((l) => l.toLowerCase() === target);
                        return tag === target || stat === target || pri === target || hasRaw;
                      });
                    }
                    if (issueAssigneeFilter) {
                      const target = issueAssigneeFilter.toLowerCase();
                      list = list.filter((t) => t.assignees?.some((a) => (a.name || '').toLowerCase() === target));
                    }
                    if (issueSortFilter === 'oldest') {
                      list.sort((a, b) => {
                        const da = new Date(a.createdAtIso || a.dateStr).getTime() || 0;
                        const db = new Date(b.createdAtIso || b.dateStr).getTime() || 0;
                        return da - db;
                      });
                    } else if (issueSortFilter === 'title') {
                      list.sort((a, b) => a.title.localeCompare(b.title));
                    } else {
                      list.sort((a, b) => {
                        const da = new Date(a.createdAtIso || a.dateStr).getTime() || 0;
                        const db = new Date(b.createdAtIso || b.dateStr).getTime() || 0;
                        return db - da;
                      });
                    }

                    // Apenas oculta do primeiro nível se a issue pai estiver de fato presente nesta lista
                    const parentChildIdsInList = new Set<string>();
                    const parentChildNumbersInList = new Set<number>();
                    list.forEach((parent) => {
                      const subs = extractSubIssuesForIssue(parent, allIssuesMap);
                      subs.forEach((s) => {
                        if (s.linkedIssue?.id && s.linkedIssue.id !== parent.id) {
                          parentChildIdsInList.add(s.linkedIssue.id);
                        }
                        if (s.issueNumber && s.issueNumber !== parent.githubNumber) {
                          parentChildNumbersInList.add(s.issueNumber);
                        }
                      });
                      if (parent.subIssueNumbers && parent.subIssueNumbers.length > 0) {
                        parent.subIssueNumbers.forEach((num) => {
                          if (num !== parent.githubNumber) {
                            parentChildNumbersInList.add(num);
                          }
                        });
                      }
                    });

                    const rawTopLevelList = list.filter((task) => {
                      const hasParentInList =
                        parentChildIdsInList.has(task.id) ||
                        (task.githubNumber != null && parentChildNumbersInList.has(task.githubNumber));
                      return !hasParentInList;
                    });
                    const topLevelList = rawTopLevelList.length > 0 ? rawTopLevelList : list;

                    if (topLevelList.length === 0) {
                      const hasActiveFilters =
                        issueStateFilter !== 'all' ||
                        Boolean(issueAuthorFilter) ||
                        Boolean(issueLabelFilter) ||
                        Boolean(issueAssigneeFilter) ||
                        sprintTaskFilter !== 'all' ||
                        Boolean(selectedCalendarDayIso && isSprintSidebarVisible);

                      return (
                        <div
                          style={{
                            padding: 24,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: 24,
                            color: theme.textSecondary,
                            fontSize: 12.5,
                            fontWeight: 400,
                          }}
                        >
                          <span>Nenhuma issue encontrada com os filtros selecionados.</span>
                          {hasActiveFilters && (
                            <button
                              type="button"
                              onClick={() => {
                                setIssueStateFilter('all');
                                setIssueAuthorFilter(null);
                                setIssueLabelFilter(null);
                                setIssueAssigneeFilter(null);
                                setSprintTaskFilter('all');
                                setSelectedCalendarDayIso(null);
                              }}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: 6,
                                height: 32,
                                padding: '0 12px',
                                background: accentColor,
                                color: '#ffffff',
                                border: 'none',
                                borderRadius: 6,
                                fontSize: 12,
                                fontWeight: 400,
                                cursor: 'pointer',
                                transition: 'opacity 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                            >
                              Limpar todos os filtros
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div style={{ width: '100%', overflowY: 'auto', flex: 1, minHeight: 0 }} className="no-scrollbar">
                        {topLevelList.map((task, taskIdx) => {
                          const isSelected = selectedIssueIds.includes(task.id);
                          const isClosed = task.status === 'Concluído';
                          const taskNum = task.githubNumber || task.id.replace(/\D/g, '') || (taskIdx + 1);
                          const authorName = task.author || (currentUser as any)?.login || 'Desconhecido';
                          const timeAgo = formatGithubTimeAgo(task.createdAtIso || task.dateStr);

                          const subIssues = extractSubIssuesForIssue(task, allIssuesMap);
                          const hasSubIssues = subIssues.length > 0;
                          const isExpanded = expandedIssueIds.has(task.id);
                          const completedSubsCount = subIssues.filter((s) => s.completed).length;

                          return (
                            <React.Fragment key={task.id}>
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '11px 16px',
                                  borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'}`,
                                  background: isSelected
                                    ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)')
                                    : 'transparent',
                                  transition: 'background 0.12s ease',
                                  gap: 12,
                                  position: taskMenuOpenId === task.id ? 'relative' : undefined,
                                  zIndex: taskMenuOpenId === task.id ? 20 : undefined,
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.background = isEffectiveDark ? '#1a1a1a' : '#f8fafc';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.background = 'transparent';
                                  }
                                }}
                              >
                                {/* Lado Esquerdo: Expansor Chevron + Checkbox + Ícone de Status + Título + Badges + Subtítulo */}
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, minWidth: 0, flex: 1 }}>
                                  {/* Botão de Dropdown Chevron para Sub-issues */}
                                  {hasSubIssues ? (
                                    <button
                                      type="button"
                                      onClick={(e) => toggleIssueExpanded(task.id, e)}
                                      title={isExpanded ? 'Recolher sub-issues' : `Expandir ${subIssues.length} sub-issues`}
                                      style={{
                                        marginTop: 2,
                                        background: 'transparent',
                                        border: 'none',
                                        padding: '2px 3px',
                                        cursor: 'pointer',
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        color: isExpanded ? accentColor : theme.textSecondary,
                                        borderRadius: 4,
                                        flexShrink: 0,
                                        transition: 'transform 0.15s ease, color 0.12s ease',
                                        transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
                                      }}
                                      onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                                      onMouseLeave={(e) => (e.currentTarget.style.color = isExpanded ? accentColor : theme.textSecondary)}
                                    >
                                      <ChevronRight size={14} />
                                    </button>
                                  ) : (
                                    <div style={{ width: 18, flexShrink: 0 }} />
                                  )}

                                  <div style={{ marginTop: 3, display: 'flex', alignItems: 'center' }}>
                                    {renderCustomCheckbox(
                                      isSelected,
                                      false,
                                      () => {
                                        setSelectedIssueIds((prev) =>
                                          prev.includes(task.id) ? prev.filter((i) => i !== task.id) : [...prev, task.id]
                                        );
                                      },
                                      isSelected ? 'Desmarcar issue' : 'Selecionar issue'
                                    )}
                                  </div>

                                  {/* Ícone de Status (CircleDot verde ou CheckCircle roxo) */}
                                  <div
                                    onClick={() => onToggleTaskStatus(task.id)}
                                    title={isClosed ? 'Concluída (Clique para reabrir)' : 'Aberta (Clique para concluir)'}
                                    style={{ cursor: 'pointer', marginTop: 2, display: 'flex', alignItems: 'center' }}
                                  >
                                    {isClosed ? (
                                      <CheckCircle2 size={16} color="#a855f7" />
                                    ) : (
                                      <CircleDot size={16} color="#22c55e" />
                                    )}
                                  </div>

                                  {/* Conteúdo: Linha 1 (Título + Badges), Linha 2 (Metadados) */}
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0, flex: 1 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <span
                                        onClick={() => onEditTask?.(task)}
                                        style={{
                                          fontWeight: 600,
                                          fontSize: 13.5,
                                          color: theme.textPrimary,
                                          cursor: 'pointer',
                                          textDecoration: isClosed ? 'line-through' : 'none',
                                          opacity: isClosed ? 0.75 : 1,
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                                      >
                                        {task.title}
                                      </span>

                                      {/* Badge de Status */}
                                      <span
                                        style={{
                                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                                          color: theme.textSecondary,
                                          fontSize: 11,
                                          fontWeight: 500,
                                          borderRadius: 12,
                                          padding: '1px 8px',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        {task.status.toLowerCase().replace(/\s+/g, '-')}
                                      </span>

                                      {/* Badge de Sub-issues se houver */}
                                      {hasSubIssues && (
                                        <button
                                          type="button"
                                          onClick={(e) => toggleIssueExpanded(task.id, e)}
                                          title={`${completedSubsCount} de ${subIssues.length} sub-issues concluídas. Clique para ${isExpanded ? 'recolher' : 'expandir'}.`}
                                          style={{
                                            background: isEffectiveDark ? 'rgba(56, 189, 248, 0.14)' : 'rgba(2, 132, 199, 0.1)',
                                            color: isEffectiveDark ? '#38bdf8' : '#0284c7',
                                            fontSize: 11,
                                            fontWeight: 500,
                                            borderRadius: 12,
                                            padding: '1px 8px',
                                            border: 'none',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            cursor: 'pointer',
                                            whiteSpace: 'nowrap',
                                            transition: 'opacity 0.12s ease',
                                          }}
                                          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                                          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                                        >
                                          <Layers size={11} />
                                          <span>
                                            {completedSubsCount}/{subIssues.length} sub-issues
                                          </span>
                                        </button>
                                      )}

                                      {/* Badge de Tag/Categoria */}
                                      {task.tag && (
                                        <span
                                          style={{
                                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                                            color: theme.textSecondary,
                                            fontSize: 11,
                                            fontWeight: 500,
                                            borderRadius: 12,
                                            padding: '1px 8px',
                                            whiteSpace: 'nowrap',
                                          }}
                                        >
                                          {task.tag}
                                        </span>
                                      )}

                                      {/* Badge de Prioridade */}
                                      <span
                                        style={{
                                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                                          color: theme.textSecondary,
                                          fontSize: 11,
                                          fontWeight: 500,
                                          borderRadius: 12,
                                          padding: '1px 8px',
                                          whiteSpace: 'nowrap',
                                        }}
                                      >
                                        priority: {task.priority.toLowerCase()}
                                      </span>
                                    </div>

                                    {/* Subtítulo: #num · Autor aberta há Xh */}
                                    <div style={{ fontSize: 11.5, color: theme.textSecondary }}>
                                      #{taskNum} · {authorName} aberta {timeAgo}
                                    </div>
                                  </div>
                                </div>

                                {/* Lado Direito: Avatares de Responsáveis + Menu ... */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                  {/* Responsáveis */}
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                    {task.assignees.map((assignee, aIdx) => (
                                      <div
                                        key={assignee.name || aIdx}
                                        title={assignee.name}
                                        style={{
                                          width: 20,
                                          height: 20,
                                          borderRadius: '50%',
                                          overflow: 'hidden',
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'center',
                                          background: assignee.avatarBg || accentColor,
                                          color: '#fff',
                                          fontSize: 10,
                                          fontWeight: 600,
                                        }}
                                      >
                                        {assignee.avatarUrl ? (
                                          <img src={assignee.avatarUrl} alt={assignee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                        ) : (
                                          <span>{assignee.initial || assignee.name?.slice(0, 1).toUpperCase()}</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>

                                  {/* Menu de Ações (...) */}
                                  {renderTaskActionMenu(task, taskIdx, topLevelList.length)}
                                </div>
                              </div>

                              {/* ÁREA EXPANDIDA DAS SUB-ISSUES */}
                              {hasSubIssues && isExpanded && (
                                <div
                                  style={{
                                    background: isEffectiveDark ? 'rgba(0, 0, 0, 0.16)' : 'rgba(0, 0, 0, 0.02)',
                                    borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'}`,
                                    paddingLeft: 46,
                                    paddingRight: 16,
                                    paddingTop: 4,
                                    paddingBottom: 6,
                                  }}
                                >
                                  <div
                                    style={{
                                      borderLeft: `2px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.12)'}`,
                                      paddingLeft: 12,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 2,
                                    }}
                                  >
                                    {subIssues.map((sub, sIdx) => {
                                      const subLinked = sub.linkedIssue;
                                      const isSubClosed = sub.completed;
                                      const subTaskNum = sub.issueNumber || (subLinked ? subLinked.githubNumber : undefined);

                                      return (
                                        <div
                                          key={sub.id || sIdx}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                            padding: '6px 8px',
                                            borderRadius: 6,
                                            gap: 10,
                                            transition: 'background 0.12s ease',
                                          }}
                                          onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)')}
                                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                        >
                                          {/* Lado Esquerdo da Sub-issue: Ícone conector + Status + Título + Badges */}
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                                            <CornerDownRight size={13} color={theme.textSecondary} style={{ flexShrink: 0, opacity: 0.6 }} />

                                            {/* Botão de alternar status da sub-issue */}
                                            <button
                                              type="button"
                                              onClick={() => {
                                                if (subLinked) {
                                                  onToggleTaskStatus(subLinked.id);
                                                } else if (sub.lineIndex != null) {
                                                  handleToggleChecklistSubIssue(task, sub.lineIndex, sub.completed);
                                                }
                                              }}
                                              title={isSubClosed ? 'Sub-issue concluída (clique para reabrir)' : 'Sub-issue aberta (clique para concluir)'}
                                              style={{
                                                background: 'transparent',
                                                border: 'none',
                                                padding: 0,
                                                cursor: 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                flexShrink: 0,
                                              }}
                                            >
                                              {isSubClosed ? (
                                                <CheckCircle2 size={15} color="#8957e5" />
                                              ) : (
                                                <CircleDot size={15} color="#22c55e" />
                                              )}
                                            </button>

                                            {/* Título da sub-issue */}
                                            <span
                                              onClick={() => {
                                                if (subLinked) {
                                                  onEditTask?.(subLinked);
                                                } else {
                                                  onEditTask?.(task);
                                                }
                                              }}
                                              style={{
                                                fontSize: 12.5,
                                                fontWeight: 500,
                                                color: isSubClosed ? theme.textSecondary : theme.textPrimary,
                                                textDecoration: isSubClosed ? 'line-through' : 'none',
                                                cursor: 'pointer',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                              }}
                                              onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                                              onMouseLeave={(e) => (e.currentTarget.style.color = isSubClosed ? theme.textSecondary : theme.textPrimary)}
                                            >
                                              {subTaskNum && <strong style={{ color: theme.textSecondary, marginRight: 6 }}>#{subTaskNum}</strong>}
                                              {sub.title}
                                            </span>

                                            {/* Badges da sub-issue */}
                                            {subLinked?.tag && (
                                              <span
                                                style={{
                                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                                                  color: theme.textSecondary,
                                                  fontSize: 10.5,
                                                  fontWeight: 500,
                                                  borderRadius: 10,
                                                  padding: '1px 6px',
                                                  whiteSpace: 'nowrap',
                                                }}
                                              >
                                                {subLinked.tag}
                                              </span>
                                            )}

                                            {subLinked?.priority && (
                                              <span
                                                style={{
                                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0',
                                                  color: theme.textSecondary,
                                                  fontSize: 10.5,
                                                  fontWeight: 500,
                                                  borderRadius: 10,
                                                  padding: '1px 6px',
                                                  whiteSpace: 'nowrap',
                                                }}
                                              >
                                                {subLinked.priority.toLowerCase()}
                                              </span>
                                            )}
                                          </div>

                                          {/* Lado Direito da Sub-issue: Avatares de responsáveis */}
                                          {subLinked && subLinked.assignees && subLinked.assignees.length > 0 && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                                              {subLinked.assignees.map((assignee, aIdx) => (
                                                <div
                                                  key={assignee.name || aIdx}
                                                  title={assignee.name}
                                                  style={{
                                                    width: 18,
                                                    height: 18,
                                                    borderRadius: '50%',
                                                    overflow: 'hidden',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    background: assignee.avatarBg || accentColor,
                                                    color: '#fff',
                                                    fontSize: 9,
                                                    fontWeight: 600,
                                                  }}
                                                >
                                                  {assignee.avatarUrl ? (
                                                    <img src={assignee.avatarUrl} alt={assignee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                  ) : (
                                                    <span>{assignee.initial || assignee.name?.slice(0, 1).toUpperCase()}</span>
                                                  )}
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
              ) : sprintDetailViewMode === 'list' ? (
                displayedTasks.length === 0 ? (
                  <div style={{ padding: '40px 20px', textAlign: 'center', color: theme.textSecondary, fontSize: 12.5 }}>
                    Nenhuma tarefa nesta sprint ainda. Adicione ou crie uma tarefa acima.
                  </div>
                ) : (
                  <div style={{ width: '100%', overflow: 'auto', flex: 1, minHeight: 0 }} className="no-scrollbar">
                    <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: 840 }}>
                      <thead>
                        <tr style={{ background: theme.tableHeaderBg, borderBottom: `1px solid ${theme.tableBorder}`, position: 'sticky', top: 0, zIndex: 2 }}>
                          <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '400', width: 65, whiteSpace: 'nowrap' }}>ID</th>
                          <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '400' }}>Tarefa</th>
                          <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '400', width: 130, whiteSpace: 'nowrap' }}>Status</th>
                          <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '400', width: 100, whiteSpace: 'nowrap' }}>Prioridade</th>
                          <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '400', width: 95, whiteSpace: 'nowrap' }}>Categoria</th>
                          <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '400', width: 115, whiteSpace: 'nowrap' }}>Data</th>
                          <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '400', width: 95, whiteSpace: 'nowrap' }}>Responsáveis</th>
                          <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '400', width: 120, whiteSpace: 'nowrap' }}>Progresso</th>
                          <th style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, fontWeight: '400', width: 68 }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {displayedTasks.map((task, taskIdx) => {
                          return (
                            <tr
                              key={task.id}
                              style={{
                                borderBottom: `1px solid ${theme.tableBorder}`,
                                transition: 'background 0.12s ease',
                                position: taskMenuOpenId === task.id ? 'relative' : undefined,
                                zIndex: taskMenuOpenId === task.id ? 20 : undefined,
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? '#1c1c1c' : '#f1f5f9')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                            >
                              <td
                                onClick={() => onEditTask?.(task)}
                                style={{ padding: '10px 14px', fontSize: 12, color: theme.textSecondary, fontFamily: 'monospace', whiteSpace: 'nowrap', cursor: 'pointer' }}
                                title="Abrir detalhes da tarefa"
                              >
                                {task.id}
                              </td>
                              <td
                                onClick={() => onEditTask?.(task)}
                                style={{ padding: '10px 14px', fontSize: 12.5, color: theme.textPrimary, fontWeight: '400', cursor: 'pointer' }}
                                title="Abrir detalhes da tarefa"
                              >
                                <span
                                  style={{
                                    textDecoration: task.status === 'Concluído' ? 'line-through' : 'none',
                                    opacity: task.status === 'Concluído' ? 0.6 : 1,
                                    wordBreak: 'break-word',
                                    lineHeight: 1.4,
                                    display: 'block',
                                  }}
                                >
                                  {task.title}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                <span
                                  onClick={() => onToggleTaskStatus(task.id)}
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    cursor: 'pointer',
                                    background:
                                      task.status === 'Concluído'
                                        ? 'rgba(16, 185, 129, 0.12)'
                                        : task.status === 'Em Progresso'
                                        ? hexToRgba(accentColor, 0.12)
                                        : 'rgba(59, 130, 246, 0.12)',
                                    color:
                                      task.status === 'Concluído'
                                        ? '#10b981'
                                        : task.status === 'Em Progresso'
                                        ? accentColor
                                        : '#3b82f6',
                                  }}
                                >
                                  {task.status}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    fontWeight: 500,
                                    color: task.priorityColor,
                                    background: hexToRgba(task.priorityColor, 0.1),
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                  }}
                                >
                                  {task.priority}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                <span
                                  style={{
                                    fontSize: 11,
                                    background: task.tagColor.bg,
                                    color: task.tagColor.text,
                                    padding: '2px 8px',
                                    borderRadius: 4,
                                    fontWeight: 500,
                                  }}
                                >
                                  {task.tag}
                                </span>
                              </td>
                              <td style={{ padding: '10px 14px', fontSize: 11.5, color: theme.textSecondary, whiteSpace: 'nowrap' }}>
                                {formatIssueDateRange(task)}
                              </td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                  {task.assignees.length === 0 ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAssignModalTask(task);
                                      }}
                                      style={{
                                        display: 'inline-flex',
                                        alignItems: 'center',
                                        gap: 5,
                                        padding: '2.5px 8px',
                                        borderRadius: 5,
                                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                                        border: `1px dashed ${isEffectiveDark ? 'rgba(255, 255, 255, 0.18)' : '#cbd5e1'}`,
                                        color: theme.textSecondary,
                                        fontSize: 11,
                                        fontWeight: 400,
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = accentColor;
                                        e.currentTarget.style.color = accentColor;
                                        e.currentTarget.style.background = hexToRgba(accentColor, 0.08);
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.18)' : '#cbd5e1';
                                        e.currentTarget.style.color = theme.textSecondary;
                                        e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc';
                                      }}
                                      title="Atribuir responsável à tarefa"
                                    >
                                      <UserPlus size={12} />
                                      <span>Atribuir</span>
                                    </button>
                                  ) : (
                                    <div
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setAssignModalTask(task);
                                      }}
                                      style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}
                                      title="Clique para gerenciar responsáveis"
                                    >
                                      {task.assignees.map((assignee, aIdx) => (
                                        <div
                                          key={assignee.name || aIdx}
                                          title={`Responsável: ${assignee.name} (clique para alterar)`}
                                          style={{
                                            width: 20,
                                            height: 20,
                                            borderRadius: '50%',
                                            overflow: 'hidden',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            background: assignee.avatarBg || accentColor,
                                            color: '#fff',
                                            fontSize: 10,
                                            fontWeight: 600,
                                            transition: 'transform 0.12s ease',
                                          }}
                                          onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.15)')}
                                          onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                                        >
                                          {assignee.avatarUrl ? (
                                            <img src={assignee.avatarUrl} alt={assignee.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                          ) : (
                                            <span>{assignee.initial || assignee.name?.slice(0, 1).toUpperCase()}</span>
                                          )}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <div
                                    style={{
                                      width: 60,
                                      height: 5,
                                      borderRadius: 3,
                                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                                      overflow: 'hidden',
                                    }}
                                  >
                                    <div
                                      style={{
                                        width: `${task.progress}%`,
                                        height: '100%',
                                        background: task.status === 'Concluído' ? '#10b981' : accentColor,
                                        borderRadius: 3,
                                      }}
                                    />
                                  </div>
                                  <span style={{ fontSize: 10, color: theme.textSecondary, width: 28, textAlign: 'right' }}>
                                    {task.progress}%
                                  </span>
                                </div>
                              </td>
                              <td style={{ padding: '10px 14px', textAlign: 'right', position: 'relative' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
                                  {/* Botão ... de mais opções reutilizável */}
                                  {renderTaskActionMenu(task, taskIdx, displayedTasks.length)}

                                  {/* Botão rápido de remover da sprint */}
                                  <button
                                    type="button"
                                    onClick={() => onRemoveTaskFromSprint(task)}
                                    title="Remover da sprint"
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: theme.textSecondary,
                                      cursor: 'pointer',
                                      padding: 3,
                                      display: 'flex',
                                      alignItems: 'center',
                                      opacity: 0.5,
                                      borderRadius: 3,
                                    }}
                                    onMouseEnter={(e) => {
                                      e.currentTarget.style.color = '#ef4444';
                                      e.currentTarget.style.opacity = '1';
                                    }}
                                    onMouseLeave={(e) => {
                                      e.currentTarget.style.color = theme.textSecondary;
                                      e.currentTarget.style.opacity = '0.5';
                                    }}
                                  >
                                    <X size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              ) : sprintDetailViewMode === 'calendar' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 14px', overflowY: 'auto', flex: 1, minHeight: 0 }} className="no-scrollbar">
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 4px' }}>
                    <span style={{ fontSize: 12.5, color: theme.textSecondary, textTransform: 'capitalize' }}>
                      {calendarMonthDate.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button
                        type="button"
                        onClick={() => setSprintCalendarMonthOffset((prev) => prev - 1)}
                        style={{ background: 'transparent', border: 'none', color: theme.textSecondary, cursor: 'pointer', display: 'flex' }}
                      >
                        <ChevronLeft size={15} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSprintCalendarMonthOffset((prev) => prev + 1)}
                        style={{ background: 'transparent', border: 'none', color: theme.textSecondary, cursor: 'pointer', display: 'flex' }}
                      >
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                    {WEEKDAY_LABELS_PT.map((wd) => (
                      <div key={wd} style={{ textAlign: 'center', fontSize: 10.5, fontWeight: 500, color: theme.textSecondary, padding: '2px 0' }}>
                        {wd}
                      </div>
                    ))}
                    {calendarCells.map((day, idx) => {
                      if (day == null) return <div key={idx} />;
                      const cellIso = `${calendarYear}-${String(calendarMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                      const isToday = cellIso === todayIso;
                      const inSprintRange =
                        openedSprint?.startDateIso && openedSprint?.dueDateIso
                          ? cellIso >= openedSprint.startDateIso && cellIso <= openedSprint.dueDateIso
                          : false;
                      const dayTasks = tasksByDay.get(day) || [];
                      return (
                        <div
                          key={idx}
                          style={{
                            height: 84,
                            borderRadius: 6,
                            padding: '5px 6px',
                            background: inSprintRange
                              ? hexToRgba(accentColor, isEffectiveDark ? 0.10 : 0.07)
                              : isEffectiveDark
                              ? 'rgba(255, 255, 255, 0.02)'
                              : 'rgba(0, 0, 0, 0.02)',
                            border: 'none',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 3,
                            overflow: 'hidden',
                            boxSizing: 'border-box',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 1px' }}>
                            <span
                              style={{
                                fontSize: 10.5,
                                color: isToday ? accentColor : theme.textSecondary,
                                fontWeight: isToday ? 700 : 500,
                              }}
                            >
                              {day}
                            </span>
                            {inSprintRange && (
                              <span style={{ width: 4, height: 4, borderRadius: '50%', background: accentColor, opacity: 0.6 }} />
                            )}
                          </div>

                          {dayTasks.slice(0, 2).map((task) => (
                            <div
                              key={task.id}
                              onClick={() => onToggleTaskStatus(task.id)}
                              style={{
                                background: theme.viewCardBg,
                                borderRadius: 4,
                                padding: '3px 5px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 5,
                                boxSizing: 'border-box',
                                boxShadow: theme.viewCardShadow,
                                cursor: 'pointer',
                                overflow: 'hidden',
                                transition: 'background 0.12s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)')}
                              onMouseLeave={(e) => (e.currentTarget.style.background = theme.viewCardBg)}
                              title={`${task.title} (${task.status}) - clique para alternar`}
                            >
                              <div
                                style={{
                                  width: 2.5,
                                  height: 12,
                                  borderRadius: 2,
                                  background: getStatusBarColor(task.status, isEffectiveDark),
                                  flexShrink: 0,
                                }}
                              />
                              <span
                                style={{
                                  color: theme.textPrimary,
                                  fontSize: 10,
                                  fontWeight: 400,
                                  lineHeight: 1.2,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  flex: 1,
                                  minWidth: 0,
                                  textDecoration: task.status === 'Concluído' ? 'line-through' : 'none',
                                  opacity: task.status === 'Concluído' ? 0.6 : 1,
                                }}
                              >
                                {task.title}
                              </span>
                            </div>
                          ))}

                          {dayTasks.length > 2 && (
                            <span
                              style={{
                                fontSize: 9.5,
                                color: theme.textSecondary,
                                paddingLeft: 3,
                                opacity: 0.75,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                cursor: 'default',
                              }}
                              title={dayTasks.slice(2).map((t) => t.title).join('\n')}
                            >
                              +{dayTasks.length - 2} mais...
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div style={{ fontSize: 10.5, color: theme.textSecondary, padding: '0 4px' }}>
                    Tarefas posicionadas pela data de criação · dias destacados fazem parte do período da sprint.
                  </div>
                </div>
              ) : sprintDetailViewMode === 'roadmap' ? (
                <div style={{ flex: 1, minHeight: 460, display: 'flex', flexDirection: 'column', padding: '6px 8px' }}>
                  <GithubProjectsRoadmapView
                    issues={displayedTasks}
                    repoName={openedSprint ? openedSprint.title : 'Sprint'}
                    theme={theme}
                    isEffectiveDark={isEffectiveDark}
                    accentColor={accentColor}
                    accentContrastText={accentContrastText}
                    onOpenIssueDetail={(issue) => onEditTask?.(issue)}
                    onUpdateIssueDates={(issueId, startDateIso, dueDateIso) => {
                      const t = displayedTasks.find((item) => item.id === issueId);
                      if (t && onEditTask) {
                        onEditTask({ ...t, startDateIso, dueDateIso, dateStr: startDateIso });
                      }
                    }}
                    onAddNewIssue={onCreateNewTask}
                    showToast={showToast}
                  />
                </div>
              ) : sprintDetailViewMode === 'kanban' ? (
                <div style={{ flex: 1, minHeight: 460, display: 'flex', flexDirection: 'column', padding: '6px 8px' }}>
                  <GithubProjectsKanbanBoard
                    issues={displayedTasks}
                    columns={projectV2Columns || undefined}
                    repoName={openedSprint ? openedSprint.title : 'Sprint'}
                    theme={theme}
                    isEffectiveDark={isEffectiveDark}
                    accentColor={accentColor}
                    accentContrastText={accentContrastText}
                    onOpenIssueDetail={(issue) => onEditTask?.(issue)}
                    onMoveIssue={onMoveIssue || (async () => {})}
                    onAddNewIssue={onCreateNewTask}
                    showToast={showToast}
                  />
                </div>
              ) : null}
            </div>
          </div>
        )}
      </div>

      {/* Modal de Atribuir Responsável */}
      <AssignMemberModal
        isOpen={Boolean(assignModalTask)}
        task={assignModalTask}
        collaborators={collaborators}
        currentUser={currentUser}
        accentColor={accentColor}
        accentContrastText={accentContrastText}
        theme={theme}
        isEffectiveDark={isEffectiveDark}
        onClose={() => setAssignModalTask(null)}
        onAssign={(issueId, assigneeLogin, assigneeAvatar) => {
          onReassignTask?.(issueId, assigneeLogin, assigneeAvatar);
          setAssignModalTask((prev) => {
            if (!prev || prev.id !== issueId) return prev;
            return {
              ...prev,
              assignees: assigneeLogin
                ? [
                    {
                      name: assigneeLogin,
                      initial: assigneeLogin.slice(0, 2).toUpperCase(),
                      avatarBg: accentColor,
                      avatarUrl: assigneeAvatar,
                    },
                  ]
                : [],
            };
          });
        }}
        showToast={showToast}
      />
    </div>
  );
};

export const ProjectsSchedulerView: React.FC<ProjectsSchedulerViewProps> = (props) => {
  return (
    <ProjectsViewErrorBoundary isEffectiveDark={props.isEffectiveDark}>
      <ProjectsSchedulerViewInner {...props} />
    </ProjectsViewErrorBoundary>
  );
};

/**
 * Pré-carrega projetos locais e repositórios do GitHub em segundo plano
 * para que, quando o usuário abrir a tela de projetos, ela já esteja instantaneamente pronta.
 */
export async function prefetchProjectsData(workspacePath?: string) {
  try {
    const hasCached =
      (GLOBAL_PROJECTS_CACHE.repos.length > 0 || GLOBAL_PROJECTS_CACHE.localClonedRepos.length > 0) &&
      GLOBAL_PROJECTS_CACHE.orgs.length > 0;
    if (hasCached && Date.now() - GLOBAL_PROJECTS_CACHE.lastFetchedAt < 120000) {
      return;
    }

    let localList: any[] = [];
    if (window.electronAPI?.git?.scanLocalProjects) {
      localList = await window.electronAPI.git.scanLocalProjects();
    } else if (window.electronAPI?.git?.listRepos && workspacePath) {
      localList = await window.electronAPI.git.listRepos(workspacePath);
    }
    if (localList && localList.length > 0) {
      GLOBAL_PROJECTS_CACHE.localClonedRepos = localList;
    }

    const [userRes, reposRes, orgsRes] = await Promise.all([
      window.electronAPI?.github?.getUser?.(),
      window.electronAPI?.github?.fetchRepos?.(),
      window.electronAPI?.github?.fetchOrgs?.(),
    ]);

    if (userRes?.success && userRes.user) {
      GLOBAL_PROJECTS_CACHE.currentUser = { login: userRes.user.login, avatarUrl: userRes.user.avatarUrl };
    }
    if (reposRes?.success && reposRes.repos) {
      GLOBAL_PROJECTS_CACHE.repos = reposRes.repos;
    }
    if (orgsRes?.success && orgsRes.orgs && orgsRes.orgs.length > 0) {
      GLOBAL_PROJECTS_CACHE.orgs = orgsRes.orgs;
    }

    if ((!GLOBAL_PROJECTS_CACHE.orgs || GLOBAL_PROJECTS_CACHE.orgs.length === 0) && window.electronAPI?.shell?.exec) {
      try {
        const ghOrgsRes = await window.electronAPI.shell.exec(
          'export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; gh api user/orgs',
          workspacePath || process.cwd()
        );
        if (ghOrgsRes && ghOrgsRes.exitCode === 0 && ghOrgsRes.stdout.trim()) {
          const parsed = JSON.parse(ghOrgsRes.stdout);
          if (Array.isArray(parsed) && parsed.length > 0) {
            GLOBAL_PROJECTS_CACHE.orgs = parsed.map((o: any) => ({ login: o.login, avatarUrl: o.avatar_url }));
          }
        }
      } catch {}
    }

    if (!GLOBAL_PROJECTS_CACHE.currentUser && window.electronAPI?.shell?.exec) {
      try {
        const ghUserRes = await window.electronAPI.shell.exec(
          'export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; gh api user',
          workspacePath || process.cwd()
        );
        if (ghUserRes && ghUserRes.exitCode === 0 && ghUserRes.stdout.trim()) {
          const parsed = JSON.parse(ghUserRes.stdout);
          if (parsed?.login) {
            GLOBAL_PROJECTS_CACHE.currentUser = { login: parsed.login, avatarUrl: parsed.avatar_url };
          }
        }
      } catch {}
    }

    GLOBAL_PROJECTS_CACHE.lastFetchedAt = Date.now();
    persistProjectsCache();
  } catch (err) {
    console.warn('[prefetchProjectsData] erro silencioso:', err);
  }
}

