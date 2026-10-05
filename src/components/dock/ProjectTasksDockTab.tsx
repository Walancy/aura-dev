import React, { useState, useMemo, useEffect } from 'react';
import {
  CircleDot,
  CheckCircle2,
  Sparkles,
  Search,
  RefreshCw,
  ExternalLink,
  Milestone as MilestoneIcon,
  Tag,
  User,
  ListTodo,
  Layers,
  AtSign,
  SquareTerminal,
} from 'lucide-react';
import type { GitHubIssueItem } from '../../types/ide';
import { issueBelongsToSprint } from '../ProjectsSchedulerView';
import { logSystemActivity } from '../../utils/brainService';

interface ProjectTasksDockTabProps {
  issues: GitHubIssueItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onDoWithAi: (issue: GitHubIssueItem) => void;
  onOpenIssueDetails?: (issueNumber: number) => void;
  currentUserLogin?: string;
  repoName?: string;
  sprints?: Array<{ title: string; number?: number; iterationId?: string; isProjectIteration?: boolean }>;
  themeTokens: any;
  isEffectiveDark: boolean;
  accentColor: string;
}

const UserAvatar: React.FC<{
  login: string;
  avatarUrl?: string;
  size?: number;
  isEffectiveDark: boolean;
}> = ({ login, avatarUrl, size = 18, isEffectiveDark }) => {
  const [hasError, setHasError] = useState(false);
  const cleanLogin = login.replace('@', '').trim();
  const src = avatarUrl || `https://github.com/${cleanLogin}.png?size=40`;

  if (hasError || !cleanLogin) {
    return (
      <div
        title={`@${cleanLogin}`}
        style={{
          width: size,
          height: size,
          borderRadius: '50%',
          background: isEffectiveDark ? '#27272a' : '#e4e4e7',
          color: isEffectiveDark ? '#a1a1aa' : '#52525b',
          fontSize: 9.5,
          fontWeight: 400,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          cursor: 'pointer',
        }}
      >
        {cleanLogin ? cleanLogin.charAt(0).toUpperCase() : '?'}
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={`@${cleanLogin}`}
      title={`@${cleanLogin}`}
      onError={() => setHasError(true)}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        objectFit: 'cover',
        border: 'none',
        flexShrink: 0,
        cursor: 'pointer',
        display: 'block',
      }}
    />
  );
};

export const ProjectTasksDockTab: React.FC<ProjectTasksDockTabProps> = ({
  issues = [],
  isLoading,
  onRefresh,
  onDoWithAi,
  onOpenIssueDetails,
  currentUserLogin,
  repoName,
  sprints = [],
  themeTokens,
  isEffectiveDark,
  accentColor,
}) => {
  const [filterMode, setFilterMode] = useState<'mine' | 'all'>('mine');
  const [stateFilter, setStateFilter] = useState<'all' | 'open' | 'closed'>('all');
  const [selectedSprint, setSelectedSprint] = useState<string>('ALL'); // 'ALL' | 'NO_SPRINT' | sprint title
  const [searchQuery, setSearchQuery] = useState('');

  const handleStateFilterChange = (nextFilter: 'all' | 'open' | 'closed') => {
    setStateFilter(nextFilter);
    try {
      logSystemActivity('tarefas', 'filter_state', repoName || 'default', { state: nextFilter });
    } catch {}
  };

  // Local persistent mapping for sprints assigned to issues (scoped to project)
  const storageKey = repoName ? `devflow_issue_sprints_${repoName}` : 'devflow_issue_sprints';
  const [localSprintMap, setLocalSprintMap] = useState<Record<number, string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  useEffect(() => {
    const handleStorageChange = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          setLocalSprintMap(JSON.parse(saved));
        } else {
          setLocalSprintMap({});
        }
      } catch {}
    };
    handleStorageChange();
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('devflow_issue_sprints_updated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('devflow_issue_sprints_updated', handleStorageChange);
    };
  }, [storageKey]);

  const effectiveCurrentUserLogin = useMemo(() => {
    if (currentUserLogin) return currentUserLogin;
    try {
      const raw = localStorage.getItem('devflow_projects_cache_v2');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.currentUser?.login) return parsed.currentUser.login;
      }
    } catch {}
    return '';
  }, [currentUserLogin]);

  const normalizedUser = effectiveCurrentUserLogin.toLowerCase().replace('@', '');

  // Helper to extract assignee logins
  const getAssigneeLogins = (issue: GitHubIssueItem): string[] => {
    const list: string[] = [];
    if (Array.isArray(issue.assignees) && issue.assignees.length > 0) {
      issue.assignees.forEach((a) => {
        const login = typeof a === 'string' ? a : a?.login;
        if (login) list.push(login);
      });
    } else if (issue.assignee) {
      const login = typeof issue.assignee === 'object' ? issue.assignee.login : String(issue.assignee);
      if (login) list.push(login);
    }
    return list;
  };

  // Helper to extract assignees with avatar
  const getAssignees = (issue: GitHubIssueItem): Array<{ login: string; avatarUrl?: string }> => {
    const list: Array<{ login: string; avatarUrl?: string }> = [];
    if (Array.isArray(issue.assignees) && issue.assignees.length > 0) {
      issue.assignees.forEach((a) => {
        if (typeof a === 'string') {
          list.push({ login: a, avatarUrl: `https://github.com/${a}.png?size=40` });
        } else if (a && typeof a === 'object' && a.login) {
          list.push({
            login: a.login,
            avatarUrl: a.avatarUrl || `https://github.com/${a.login}.png?size=40`,
          });
        }
      });
    } else if (issue.assignee) {
      if (typeof issue.assignee === 'object' && issue.assignee.login) {
        list.push({
          login: issue.assignee.login,
          avatarUrl: issue.assignee.avatarUrl || `https://github.com/${issue.assignee.login}.png?size=40`,
        });
      } else if (typeof issue.assignee === 'string') {
        list.push({ login: issue.assignee, avatarUrl: `https://github.com/${issue.assignee}.png?size=40` });
      }
    }
    return list;
  };

  // Helper to test if an issue is linked to current user
  const isLinkedToUser = (issue: GitHubIssueItem): boolean => {
    const assignees = getAssigneeLogins(issue);

    // 1. If issue has assignees, it must strictly be assigned to current user
    if (assignees.length > 0) {
      return assignees.some((login) => login.toLowerCase() === normalizedUser);
    }

    // 2. If NO assignees exist on the issue (unassigned):
    // Fallback to author only if author is current user
    const authorLogin =
      typeof issue.author === 'object' && issue.author !== null
        ? issue.author.login
        : String(issue.author || '');

    return authorLogin.toLowerCase() === normalizedUser;
  };

  // Helper to extract issue's sprint title (Project V2 iteration, Milestone, prefix or label)
  const getIssueSprint = (issue: GitHubIssueItem): string => {
    // 1. From localStorage override (scoped to current project)
    if (localSprintMap[issue.number]) {
      return localSprintMap[issue.number];
    }

    // 2. From GitHub Projects V2 iteration title
    if (issue.iterationTitle && typeof issue.iterationTitle === 'string' && issue.iterationTitle.trim()) {
      return issue.iterationTitle.trim();
    }

    // 3. From issue.milestoneTitle or issue.milestone.title
    const msTitle = issue.milestoneTitle || issue.milestone?.title;
    if (msTitle && typeof msTitle === 'string' && msTitle.trim()) {
      return msTitle.trim();
    }

    // 4. From labels matching /sprint/i
    if (Array.isArray(issue.labels)) {
      const sprintLabel: any = issue.labels.find((l: any) => {
        const n = typeof l === 'string' ? l : l?.name;
        return typeof n === 'string' && /sprint/i.test(n);
      });
      if (sprintLabel) {
        return typeof sprintLabel === 'string' ? sprintLabel.trim() : String(sprintLabel?.name || '').trim();
      }
    }

    // 5. From issue title prefix (e.g. "Sprint13 — ...", "Sprint 2: ...", "Sprint9-10 ...")
    if (issue.title && typeof issue.title === 'string') {
      const titleMatch = issue.title.match(/^sprint\s*([0-9]+(?:-[0-9]+)?)/i);
      if (titleMatch) {
        return `Sprint ${titleMatch[1]}`;
      }
    }

    return '';
  };

  // Extrai número ou range da sprint (ex: "Sprint 13" -> "13", "Sprint 9-10" -> "9-10", "Sprint 2 - Cadastro" -> "2")
  const extractSprintNum = (s: string): string | null => {
    const m = s.match(/sprint\s*([0-9]+(?:-[0-9]+)?)/i);
    return m ? m[1] : null;
  };

  // Decide se uma issue pertence a uma sprint usando a mesma regra da tela de projetos
  const checkIssueBelongsToSprint = (issue: GitHubIssueItem, targetSprintTitle: string): boolean => {
    if (!targetSprintTitle || targetSprintTitle === 'ALL') return true;
    const issueSprint = getIssueSprint(issue);
    if (targetSprintTitle === 'NO_SPRINT') {
      return !issueSprint;
    }
    if (!issueSprint) return false;

    // 1. Busca o objeto da sprint alvo na prop `sprints` para obter metadados reais (iterationId, number, etc.)
    const targetSprintObj = (sprints || []).find(
      (s) => s.title && s.title.toLowerCase().trim() === targetSprintTitle.toLowerCase().trim()
    );

    const spNumStr = extractSprintNum(targetSprintTitle);
    const spNum = spNumStr && /^\d+$/.test(spNumStr) ? parseInt(spNumStr, 10) : undefined;

    const sprintDescriptor = {
      title: targetSprintTitle,
      number: targetSprintObj?.number ?? spNum ?? 0,
      isVirtual: true,
      iterationId: targetSprintObj?.iterationId,
      isProjectIteration: targetSprintObj?.isProjectIteration,
    };

    // 2. Se ambos tiverem iterationId, bate direto por ID único de iteração Project V2
    if (sprintDescriptor.iterationId && issue.iterationId) {
      return sprintDescriptor.iterationId === issue.iterationId;
    }

    // 3. Usa a função canônica issueBelongsToSprint da tela de projetos
    if (issueBelongsToSprint(issue as any, sprintDescriptor as any)) {
      return true;
    }

    // 4. Comparação direta com o sprint resolvido da issue (issueSprint)
    const tNorm = targetSprintTitle.toLowerCase().trim();
    const iNorm = issueSprint.toLowerCase().trim();
    if (tNorm === iNorm) return true;

    // 5. Comparação precisa por número de sprint extraído (evita falsos positivos como "Sprint 1" dar match em "Sprint 13")
    const issNumStr = extractSprintNum(iNorm);
    if (spNumStr && issNumStr) {
      return spNumStr === issNumStr;
    }

    // 6. Comparação por título sem caracteres especiais
    const cleanT = tNorm.replace(/[^a-z0-9]/g, '');
    const cleanI = iNorm.replace(/[^a-z0-9]/g, '');
    if (cleanT && cleanI && cleanT === cleanI) return true;

    return false;
  };

  // Extrai número da sprint para ordenação decrescente (ex: "Sprint 13" -> 13)
  const getSprintSortNumber = (title: string): number => {
    const m = title.match(/sprint\s*(\d+)/i);
    return m ? parseInt(m[1], 10) : 0;
  };

  // Constrói lista de sprints do projeto de forma idêntica à tela de projetos
  const sprintOptions = useMemo(() => {
    const map = new Map<string, { title: string; count: number; sortKey: number }>();
    let noSprintCount = 0;

    // 1. Sprints fornecidas pelo repositório / Projects V2
    sprints.forEach((sp) => {
      if (sp.title && sp.title.trim()) {
        const title = sp.title.trim();
        const key = title.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { title, count: 0, sortKey: getSprintSortNumber(title) });
        }
      }
    });

    // 2. Sprints descobertas diretamente nas issues (iterações, marcos, títulos e labels)
    issues.forEach((i) => {
      const sp = getIssueSprint(i);
      if (sp) {
        const key = sp.toLowerCase();
        if (!map.has(key)) {
          map.set(key, { title: sp, count: 0, sortKey: getSprintSortNumber(sp) });
        }
      }
    });

    // 3. Contagem de issues por sprint usando a lógica unificada
    const list = Array.from(map.values());
    list.forEach((item) => {
      item.count = issues.filter((i) => checkIssueBelongsToSprint(i, item.title)).length;
    });

    // 4. Contagem de tarefas sem sprint
    noSprintCount = issues.filter((i) => !getIssueSprint(i)).length;

    // 5. Ordenação: sprints mais recentes no topo (ex: Sprint 13, Sprint 12, ... Sprint 1)
    list.sort((a, b) => {
      if (a.sortKey !== b.sortKey) {
        return b.sortKey - a.sortKey;
      }
      return a.title.localeCompare(b.title);
    });

    return { list, noSprintCount };
  }, [issues, sprints, localSprintMap]);

  // Reset selectedSprint if project has no sprints
  useEffect(() => {
    if (sprintOptions.list.length === 0 && selectedSprint !== 'ALL') {
      setSelectedSprint('ALL');
    }
  }, [sprintOptions.list.length, selectedSprint]);

  // Base issues for current user & sprint filters (for accurate pill count in the current context)
  const contextIssues = useMemo(() => {
    let list = issues;

    // Filter by user assignment
    if (filterMode === 'mine') {
      list = list.filter(isLinkedToUser);
    }

    // Filter by selected sprint via checkIssueBelongsToSprint
    if (selectedSprint === 'NO_SPRINT') {
      list = list.filter((i) => !getIssueSprint(i));
    } else if (selectedSprint !== 'ALL') {
      list = list.filter((i) => checkIssueBelongsToSprint(i, selectedSprint));
    }

    return list;
  }, [issues, filterMode, selectedSprint, normalizedUser, localSprintMap, sprints]);

  const openCount = useMemo(() => {
    return contextIssues.filter((i) => (i.state || 'open').toLowerCase() === 'open').length;
  }, [contextIssues]);

  const closedCount = useMemo(() => {
    return contextIssues.filter((i) => (i.state || 'open').toLowerCase() === 'closed').length;
  }, [contextIssues]);

  // Filtered issues including state filter (all / open / closed) and search query
  const filteredIssues = useMemo(() => {
    let list = contextIssues;

    // Filter by state
    if (stateFilter === 'open') {
      list = list.filter((i) => (i.state || 'open').toLowerCase() === 'open');
    } else if (stateFilter === 'closed') {
      list = list.filter((i) => (i.state || 'open').toLowerCase() === 'closed');
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((i) => {
        const matchesNum = `#${i.number}`.includes(q) || String(i.number) === q;
        const matchesTitle = i.title.toLowerCase().includes(q);
        const matchesLabels = (i.labels || []).some((l) => l.name.toLowerCase().includes(q));
        const matchesSprint = getIssueSprint(i).toLowerCase().includes(q);
        return matchesNum || matchesTitle || matchesLabels || matchesSprint;
      });
    }

    return list;
  }, [contextIssues, stateFilter, searchQuery, localSprintMap]);

  const myIssuesCount = useMemo(() => {
    return issues.filter(isLinkedToUser).length;
  }, [issues, normalizedUser]);

  const textPrimary = themeTokens?.textPrimary || (isEffectiveDark ? '#f4f4f5' : '#0f172a');
  const textSecondary = themeTokens?.textSecondary || (isEffectiveDark ? '#8b949e' : '#64748b');
  const itemBg = isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)';
  const itemHoverBg = isEffectiveDark ? 'rgba(255, 255, 255, 0.055)' : 'rgba(0, 0, 0, 0.045)';
  const itemBorder = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';

  return (
    <div
      style={{
        flex: '1 1 0',
        alignSelf: 'stretch',
        background: themeTokens?.bgCard || (isEffectiveDark ? '#141414' : '#ffffff'),
        borderRadius: 10,
        border: 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontSize: 12,
        fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Header Toolbar - Minimalista, sem bordas ou sombras com divisorias de baixa opacidade */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid ' + (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'),
          gap: 10,
          flexWrap: 'wrap',
        }}
      >
        {/* Left: Minimalist Tabs (Usuário & Estado Abertas/Fechadas) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {/* Grupo de Filtro por Usuário */}
          <div
            style={{
              display: 'inline-flex',
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
              borderRadius: 6,
              padding: 2,
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setFilterMode('mine')}
              style={{
                background: filterMode === 'mine' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.09)' : '#ffffff') : 'transparent',
                color: filterMode === 'mine' ? textPrimary : textSecondary,
                border: 'none',
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 11.5,
                fontWeight: 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.12s ease',
              }}
            >
              <User size={12} color={filterMode === 'mine' ? accentColor : textSecondary} />
              <span>Minhas Tarefas</span>
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 8,
                  background: filterMode === 'mine' ? (isEffectiveDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)') : 'transparent',
                  color: filterMode === 'mine' ? textPrimary : textSecondary,
                  fontWeight: 400,
                }}
              >
                {myIssuesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('all')}
              style={{
                background: filterMode === 'all' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.09)' : '#ffffff') : 'transparent',
                color: filterMode === 'all' ? textPrimary : textSecondary,
                border: 'none',
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 11.5,
                fontWeight: 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.12s ease',
              }}
            >
              <ListTodo size={12} color={filterMode === 'all' ? accentColor : textSecondary} />
              <span>Todas</span>
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 8,
                  background: filterMode === 'all' ? (isEffectiveDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)') : 'transparent',
                  color: filterMode === 'all' ? textPrimary : textSecondary,
                  fontWeight: 400,
                }}
              >
                {issues.length}
              </span>
            </button>
          </div>

          {/* Divisória de baixa opacidade */}
          <div
            style={{
              width: 1,
              height: 14,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
              margin: '0 2px',
            }}
          />

          {/* Grupo de Filtro por Estado: Todas | Abertas | Fechadas */}
          <div
            style={{
              display: 'inline-flex',
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
              borderRadius: 6,
              padding: 2,
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => handleStateFilterChange('all')}
              style={{
                background: stateFilter === 'all' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.09)' : '#ffffff') : 'transparent',
                color: stateFilter === 'all' ? textPrimary : textSecondary,
                border: 'none',
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 11.5,
                fontWeight: 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.12s ease',
              }}
            >
              <span>Todas</span>
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 8,
                  background: stateFilter === 'all' ? (isEffectiveDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.07)') : 'transparent',
                  color: stateFilter === 'all' ? textPrimary : textSecondary,
                  fontWeight: 400,
                }}
              >
                {contextIssues.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleStateFilterChange('open')}
              style={{
                background: stateFilter === 'open' ? 'rgba(34, 197, 94, 0.15)' : 'transparent',
                color: stateFilter === 'open' ? '#22c55e' : textSecondary,
                border: 'none',
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 11.5,
                fontWeight: 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.12s ease',
              }}
            >
              <CircleDot size={12} color={stateFilter === 'open' ? '#22c55e' : textSecondary} />
              <span>Abertas</span>
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 8,
                  background: stateFilter === 'open' ? 'rgba(34, 197, 94, 0.2)' : 'transparent',
                  color: stateFilter === 'open' ? '#22c55e' : textSecondary,
                  fontWeight: 400,
                }}
              >
                {openCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleStateFilterChange('closed')}
              style={{
                background: stateFilter === 'closed' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
                color: stateFilter === 'closed' ? '#a855f7' : textSecondary,
                border: 'none',
                borderRadius: 5,
                padding: '3px 8px',
                fontSize: 11.5,
                fontWeight: 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.12s ease',
              }}
            >
              <CheckCircle2 size={12} color={stateFilter === 'closed' ? '#a855f7' : textSecondary} />
              <span>Fechadas</span>
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 8,
                  background: stateFilter === 'closed' ? 'rgba(168, 85, 247, 0.2)' : 'transparent',
                  color: stateFilter === 'closed' ? '#a855f7' : textSecondary,
                  fontWeight: 400,
                }}
              >
                {closedCount}
              </span>
            </button>
          </div>
        </div>

        {/* Right: Search & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
              border: 'none',
              borderRadius: 6,
              padding: '4px 8px',
              width: 170,
            }}
          >
            <Search size={12} color={textSecondary} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar tarefas..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: textPrimary,
                fontSize: 11.5,
                width: '100%',
                fontFamily: 'inherit',
                fontWeight: 400,
              }}
            />
          </div>

          <button
            type="button"
            onClick={onRefresh}
            title="Recarregar issues do GitHub"
            style={{
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
              border: 'none',
              borderRadius: 6,
              padding: '6px',
              color: textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = accentColor;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = textSecondary;
            }}
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Main Body: Sprints Left Panel + Tasks List */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {/* Left: Sprint Selector Panel - Only rendered if project actually has sprints */}
        {sprintOptions.list.length > 0 && (
          <div
            style={{
              width: 185,
              flexShrink: 0,
              borderRight: '1px solid ' + (themeTokens?.border || (isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')),
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.015)',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '8px 6px',
              gap: 2,
            }}
          >
          {/* Section Header */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 8px 6px',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.06em',
              color: textSecondary,
              textTransform: 'uppercase',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <MilestoneIcon size={11} color={textSecondary} />
              <span>Sprints</span>
            </div>
          </div>

          {/* Option: Todas as Sprints */}
          <button
            type="button"
            onClick={() => setSelectedSprint('ALL')}
            title="Mostrar tarefas de todas as sprints"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              borderRadius: 6,
              border: 'none',
              cursor: 'pointer',
              fontSize: 11.5,
              fontWeight: selectedSprint === 'ALL' ? 600 : 400,
              background:
                selectedSprint === 'ALL'
                  ? isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.08)'
                    : 'rgba(0, 0, 0, 0.06)'
                  : 'transparent',
              color: selectedSprint === 'ALL' ? accentColor : textSecondary,
              transition: 'all 0.12s ease',
              textAlign: 'left',
              gap: 6,
            }}
            onMouseEnter={(e) => {
              if (selectedSprint !== 'ALL') {
                e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                e.currentTarget.style.color = textPrimary;
              }
            }}
            onMouseLeave={(e) => {
              if (selectedSprint !== 'ALL') {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = textSecondary;
              }
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
              <Layers size={12} color={selectedSprint === 'ALL' ? accentColor : textSecondary} style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Todas as tarefas
              </span>
            </div>
            <span
              style={{
                fontSize: 10,
                padding: '1px 5px',
                borderRadius: 8,
                background:
                  selectedSprint === 'ALL'
                    ? isEffectiveDark
                      ? 'rgba(255,255,255,0.12)'
                      : 'rgba(0,0,0,0.07)'
                    : 'transparent',
                color: selectedSprint === 'ALL' ? textPrimary : textSecondary,
                flexShrink: 0,
              }}
            >
              {issues.length}
            </span>
          </button>

          {/* Sprints List */}
          {sprintOptions.list.map((sp) => {
            const isSelected = selectedSprint.toLowerCase() === sp.title.toLowerCase();
            return (
              <button
                key={sp.title}
                type="button"
                onClick={() => setSelectedSprint(sp.title)}
                title={sp.title}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '6px 8px',
                  borderRadius: 6,
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: isSelected ? 600 : 400,
                  background:
                    isSelected
                      ? isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.06)'
                      : 'transparent',
                  color: isSelected ? accentColor : textSecondary,
                  transition: 'all 0.12s ease',
                  textAlign: 'left',
                  gap: 6,
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                    e.currentTarget.style.color = textPrimary;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                    e.currentTarget.style.color = textSecondary;
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <MilestoneIcon size={12} color={isSelected ? accentColor : textSecondary} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {sp.title}
                  </span>
                </div>
                {sp.count > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      padding: '1px 5px',
                      borderRadius: 8,
                      background:
                        isSelected
                          ? isEffectiveDark
                            ? 'rgba(255,255,255,0.12)'
                            : 'rgba(0,0,0,0.07)'
                          : 'transparent',
                      color: isSelected ? textPrimary : textSecondary,
                      flexShrink: 0,
                    }}
                  >
                    {sp.count}
                  </span>
                )}
              </button>
            );
          })}

          {/* Option: Sem Sprint (Backlog) */}
          {sprintOptions.noSprintCount > 0 && (
            <button
              type="button"
              onClick={() => setSelectedSprint('NO_SPRINT')}
              title="Tarefas sem sprint atribuída (Backlog)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: 6,
                border: 'none',
                cursor: 'pointer',
                fontSize: 11.5,
                fontWeight: selectedSprint === 'NO_SPRINT' ? 600 : 400,
                background:
                  selectedSprint === 'NO_SPRINT'
                    ? isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.06)'
                    : 'transparent',
                color: selectedSprint === 'NO_SPRINT' ? accentColor : textSecondary,
                transition: 'all 0.12s ease',
                textAlign: 'left',
                gap: 6,
                marginTop: 2,
              }}
              onMouseEnter={(e) => {
                if (selectedSprint !== 'NO_SPRINT') {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                  e.currentTarget.style.color = textPrimary;
                }
              }}
              onMouseLeave={(e) => {
                if (selectedSprint !== 'NO_SPRINT') {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = textSecondary;
                }
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                <CircleDot size={12} color={selectedSprint === 'NO_SPRINT' ? accentColor : textSecondary} style={{ flexShrink: 0, opacity: 0.6 }} />
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  Sem sprint
                </span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 8,
                  background:
                    selectedSprint === 'NO_SPRINT'
                      ? isEffectiveDark
                        ? 'rgba(255,255,255,0.12)'
                        : 'rgba(0,0,0,0.07)'
                      : 'transparent',
                  color: selectedSprint === 'NO_SPRINT' ? textPrimary : textSecondary,
                  flexShrink: 0,
                }}
              >
                {sprintOptions.noSprintCount}
              </span>
            </button>
          )}
        </div>
        )}

        {/* Right: Task List Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: 10,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {isLoading && issues.length === 0 ? (
            <div
              style={{
                padding: '36px 20px',
                textAlign: 'center',
                color: textSecondary,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <RefreshCw size={16} className="animate-spin" color={accentColor} />
              <span style={{ fontSize: 11.5 }}>Sincronizando tarefas com o GitHub...</span>
            </div>
          ) : filteredIssues.length === 0 ? (
            <div
              style={{
                padding: '32px 20px',
                textAlign: 'center',
                color: textSecondary,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <ListTodo size={22} color={textSecondary} style={{ opacity: 0.5 }} />
              <div style={{ fontSize: 12.5, fontWeight: 400, color: textPrimary }}>
                {stateFilter === 'closed'
                  ? 'Nenhuma tarefa fechada encontrada'
                  : stateFilter === 'open'
                  ? 'Nenhuma tarefa aberta encontrada'
                  : filterMode === 'mine'
                  ? 'Nenhuma tarefa atribuída a você nesta sprint'
                  : 'Nenhuma tarefa encontrada nesta sprint'}
              </div>
              <div style={{ fontSize: 11, maxWidth: 340, lineHeight: 1.4 }}>
                {selectedSprint !== 'ALL' ? (
                  <span>
                    Não há tarefas correspondentes em <strong>{selectedSprint === 'NO_SPRINT' ? 'Sem sprint' : selectedSprint}</strong>.{' '}
                    <span
                      onClick={() => setSelectedSprint('ALL')}
                      style={{ color: accentColor, cursor: 'pointer', textDecoration: 'underline' }}
                    >
                      Ver todas as tarefas
                    </span>
                  </span>
                ) : filterMode === 'mine' ? (
                  `Não há issues vinculadas a @${normalizedUser}. Alterne para "Todas" para visualizar todas as tarefas.`
                ) : (
                  'Não há issues correspondentes aos filtros selecionados.'
                )}
              </div>
            </div>
          ) : (
            filteredIssues.map((issue) => {
              const isOpen = (issue.state || 'open').toLowerCase() === 'open';
              const issueColor = isOpen ? '#3fb950' : '#8957e5';
              const authorLogin =
                typeof issue.author === 'object' && issue.author !== null
                  ? issue.author.login
                  : String(issue.author || '');

              const issueSprint = getIssueSprint(issue);
              const shortSprint = issueSprint ? issueSprint.split(' - ')[0] || issueSprint : '';

              return (
                <div
                  key={issue.number}
                  onClick={() => onOpenIssueDetails?.(issue.number)}
                  style={{
                    background: itemBg,
                    borderRadius: 6,
                    border: 'none',
                    padding: '7px 10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 10,
                    cursor: 'pointer',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = itemHoverBg;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = itemBg;
                  }}
                >
                  {/* Left Side: Icon, Number, Title, Status & Meta */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
                    <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }} title={isOpen ? 'Issue Aberta' : 'Issue Concluída'}>
                      {isOpen ? (
                        <CircleDot size={13} color={issueColor} />
                      ) : (
                        <CheckCircle2 size={13} color={issueColor} />
                      )}
                    </div>

                    <span
                      style={{
                        color: textSecondary,
                        fontSize: 11.5,
                        fontWeight: 600,
                        fontFamily: 'JetBrains Mono, monospace',
                        flexShrink: 0,
                      }}
                    >
                      #{issue.number}
                    </span>

                    <span
                      title="Clique para abrir detalhes da issue"
                      style={{
                        color: textPrimary,
                        fontSize: 12,
                        fontWeight: 500,
                        cursor: 'pointer',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                        flex: 1,
                        minWidth: 0,
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = textPrimary)}
                    >
                      {issue.title}
                    </span>

                    {/* Sprint Badge & Labels */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                      {shortSprint && (
                        <span
                          title={`Sprint: ${issueSprint}`}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 3,
                            fontSize: 9.5,
                            fontWeight: 500,
                            padding: '2px 6px',
                            borderRadius: 3,
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                            color: accentColor,
                            border: 'none',
                            maxWidth: 110,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <MilestoneIcon size={9} color={accentColor} />
                          <span>{shortSprint}</span>
                        </span>
                      )}

                      {Array.isArray(issue.labels) &&
                        issue.labels.slice(0, 2).map((lbl, lIdx) => {
                          const bgHex = lbl.color ? `#${lbl.color.replace('#', '')}` : '#888888';
                          return (
                            <span
                              key={lbl.id || lbl.name || lIdx}
                              style={{
                                fontSize: 9.5,
                                fontWeight: 400,
                                padding: '2px 6px',
                                borderRadius: 3,
                                background: `${bgHex}18`,
                                color: isEffectiveDark ? '#e4e4e7' : '#334155',
                                border: 'none',
                                maxWidth: 100,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {lbl.name}
                            </span>
                          );
                        })}

                      {/* Assignee / Author GitHub Avatar with hover tooltip */}
                      {(() => {
                        const assignees = getAssignees(issue);

                        if (assignees.length > 0) {
                          return (
                            <div
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: 3,
                                flexShrink: 0,
                              }}
                            >
                              {assignees.map((a, aIdx) => (
                                <UserAvatar
                                  key={a.login || aIdx}
                                  login={a.login}
                                  avatarUrl={a.avatarUrl}
                                  size={18}
                                  isEffectiveDark={isEffectiveDark}
                                />
                              ))}
                            </div>
                          );
                        }

                        if (authorLogin) {
                          return (
                            <UserAvatar
                              login={authorLogin}
                              avatarUrl={issue.authorAvatar}
                              size={18}
                              isEffectiveDark={isEffectiveDark}
                            />
                          );
                        }

                        return null;
                      })()}
                    </div>
                  </div>

                  {/* Right Side: Minimalist "Fazer com IA" & Link */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDoWithAi(issue);
                      }}
                      title="Enviar tarefa para o chat de IA"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: accentColor || '#FF6A00',
                        border: 'none',
                        borderRadius: 5,
                        padding: '4px 10px',
                        color: '#ffffff',
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.filter = 'brightness(1.1)';
                        e.currentTarget.style.transform = 'translateY(-0.5px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.filter = 'none';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <span>Fazer com IA</span>
                    </button>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.dispatchEvent(
                          new CustomEvent('devflow:mention-issue-terminal', { detail: { issue } })
                        );
                        logSystemActivity('tarefas', 'mention_issue_terminal', repoName || 'default', {
                          issueNumber: issue.number,
                          title: issue.title,
                        });
                      }}
                      title="Mencionar no terminal (mostrar tag de issue)"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px',
                        color: textSecondary,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = accentColor || '#FF6A00';
                        e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = textSecondary;
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <AtSign size={13} />
                    </button>

                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={(e) => {
                        e.stopPropagation();
                        window.dispatchEvent(
                          new CustomEvent('devflow:send-issue-terminal', { detail: { issue } })
                        );
                        logSystemActivity('tarefas', 'send_issue_terminal', repoName || 'default', {
                          issueNumber: issue.number,
                          title: issue.title,
                        });
                      }}
                      title="Enviar para o terminal ativo"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: 4,
                        padding: '4px',
                        color: textSecondary,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = accentColor || '#FF6A00';
                        e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = textSecondary;
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <SquareTerminal size={13} />
                    </button>

                    {issue.url && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          window.electronAPI?.shell?.openExternal?.(issue.url!);
                        }}
                        title="Abrir no GitHub"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          padding: '4px',
                          color: textSecondary,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          borderRadius: 4,
                          transition: 'color 0.15s ease',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
                      >
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
