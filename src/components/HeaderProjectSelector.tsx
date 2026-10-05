import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ChevronDown, Search, X, FolderGit2, Check, FolderPlus, DownloadCloud, Building2, Play, HardDrive, Loader2, CheckCircle2, MessageCircleQuestion } from 'lucide-react';
import { ClaudeIcon, AntigravityIcon, GeminiIcon, CodexIcon, OllamaIcon } from './icons/AiProviderIcons';
import { getLanguageSvgUrl } from './FileIcon';
import {
  GLOBAL_PROJECTS_CACHE,
  buildUnifiedProjectCards,
  prefetchProjectsData,
  type ProjectCardData,
  type GithubRepoSummary,
} from './ProjectsSchedulerView';
import { logSystemActivity } from '../utils/brainService';

export interface HeaderProjectItem {
  id: string | number;
  name: string;
  fullName: string;
  htmlUrl?: string;
  isCloned: boolean;
  localDir?: string;
  owner?: string;
  ownerAvatarUrl?: string;
  language?: string;
  customIcon?: string;
}

export interface HeaderOrganizationItem {
  id: string;
  name: string;
  avatarUrl?: string;
}

export interface HeaderActiveProjectInfo {
  name: string;
  fullName: string;
  description?: string;
  owner?: string;
  localDir?: string;
  htmlUrl?: string;
  ownerAvatarUrl?: string;
  language?: string;
  customIcon?: string;
}

/** Estado da IA num projeto: gerando, aguardando resposta do usuário ou resposta pronta (ainda não vista). */
export type ProjectAiStatus = 'generating' | 'waiting' | 'done';

export interface ProjectRuntimeInfo {
  isRunning: boolean;
  runningProcessCount?: number;
  activeAiProvider?: string | null;
  isAiRunning?: boolean;
}

export interface ProjectHeaderIconProps {
  project: HeaderProjectItem | null;
  size?: number;
  accentColor: string;
  customIcons?: Record<string, string>;
  repos?: any[];
  orgs?: HeaderOrganizationItem[];
}

export const ProjectHeaderIcon: React.FC<ProjectHeaderIconProps> = ({
  project,
  size = 16,
  accentColor,
  customIcons = {},
  repos = [],
  orgs = [],
}) => {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [project?.id, project?.name, project?.fullName]);

  if (!project) {
    return <FolderGit2 size={size - 2.5} color={accentColor} style={{ flexShrink: 0 }} />;
  }

  // 1. Ícone personalizado do projeto salvo em devflow_custom_project_icons
  const custom =
    customIcons[project.fullName || ''] ||
    customIcons[project.name] ||
    customIcons[String(project.id)] ||
    project.customIcon;

  if (custom && !imgError) {
    return (
      <img
        src={custom}
        alt={project.name}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
          background: 'transparent',
          userSelect: 'none',
        }}
        draggable={false}
      />
    );
  }

  // 2. Avatar da organização ou proprietário do repositório (ex: logo da Estância Bahia)
  let avatarUrl = project.ownerAvatarUrl;
  if (!avatarUrl) {
    const matchRepo =
      repos.find(
        (r) =>
          (r.full_name && project.fullName && r.full_name.toLowerCase() === project.fullName.toLowerCase()) ||
          (r.name && project.name && r.name.toLowerCase() === project.name.toLowerCase())
      ) ||
      GLOBAL_PROJECTS_CACHE?.repos?.find(
        (r) =>
          (r.full_name && project.fullName && r.full_name.toLowerCase() === project.fullName.toLowerCase()) ||
          (r.name && project.name && r.name.toLowerCase() === project.name.toLowerCase())
      );

    avatarUrl = matchRepo?.owner?.avatar_url;

    if (!avatarUrl) {
      const ownerName = project.owner || matchRepo?.owner?.login || project.fullName?.split('/')[0];
      if (ownerName) {
        const matchOrg =
          orgs.find(
            (o) =>
              o.name?.toLowerCase() === ownerName.toLowerCase() ||
              o.id?.toLowerCase() === ownerName.toLowerCase()
          ) ||
          GLOBAL_PROJECTS_CACHE?.orgs?.find(
            (o) => o.login?.toLowerCase() === ownerName.toLowerCase()
          );
        avatarUrl = matchOrg?.avatarUrl;
        if (!avatarUrl && GLOBAL_PROJECTS_CACHE?.currentUser?.login?.toLowerCase() === ownerName.toLowerCase()) {
          avatarUrl = GLOBAL_PROJECTS_CACHE.currentUser.avatarUrl;
        }
      }
    }
  }

  if (avatarUrl && !imgError) {
    return (
      <img
        src={avatarUrl}
        alt={project.name}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
          background: 'transparent',
          userSelect: 'none',
        }}
        draggable={false}
      />
    );
  }

  // 3. Ícone oficial da linguagem / tecnologia (SVG)
  const lang =
    project.language ||
    repos.find((r) => r.name?.toLowerCase() === project.name?.toLowerCase())?.language ||
    GLOBAL_PROJECTS_CACHE?.repos?.find((r) => r.name?.toLowerCase() === project.name?.toLowerCase())?.language;
  const langSvg = getLanguageSvgUrl(lang);
  if (langSvg && !imgError) {
    return (
      <img
        src={langSvg}
        alt={lang || ''}
        onError={() => setImgError(true)}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          display: 'block',
          flexShrink: 0,
          background: 'transparent',
          userSelect: 'none',
        }}
        draggable={false}
      />
    );
  }

  // 4. Fallback padrão do sistema
  return <FolderGit2 size={size - 2.5} color={accentColor} style={{ flexShrink: 0 }} />;
};

export interface HeaderProjectSelectorProps {
  workspacePath: string;
  onSelectWorkspace: (dirPath: string, repoName?: string) => Promise<void> | void;
  themeTokens: {
    bgCard: string;
    bgCardSecondary?: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textMuted?: string;
    hoverBg: string;
  };
  isEffectiveDark: boolean;
  accentColor: string;
  onToast?: (msg: string) => void;
  onActiveProjectChange?: (project: HeaderActiveProjectInfo | null) => void;
  onProjectsListChange?: (projects: HeaderProjectItem[]) => void;
  projectRuntimes?: Record<string, ProjectRuntimeInfo>;
  /** Status da IA por caminho de projeto (IDE + CLI) */
  projectAiStatus?: Record<string, ProjectAiStatus>;
}

export const HeaderProjectSelector: React.FC<HeaderProjectSelectorProps> = ({
  workspacePath,
  onSelectWorkspace,
  themeTokens,
  isEffectiveDark,
  accentColor,
  onToast,
  onActiveProjectChange,
  onProjectsListChange,
  projectRuntimes,
  projectAiStatus,
}) => {
  // Dropdown visibility states
  const [isOrgOpen, setIsOrgOpen] = useState(false);
  const [isProjectOpen, setIsProjectOpen] = useState(false);

  // Selected organization filter
  const [selectedOrg, setSelectedOrg] = useState<string>(() => {
    try {
      return localStorage.getItem('header_selected_org') || 'Todas';
    } catch {
      return 'Todas';
    }
  });

  const [searchQuery, setSearchQuery] = useState('');
  // Altura máxima da lista do popup (redimensionável pela alça inferior)
  const [listMaxHeight, setListMaxHeight] = useState<number>(() => {
    try { return Math.max(120, Number(localStorage.getItem('header_projects_list_height')) || 250); } catch { return 250; }
  });
  const handleStartListResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startY = e.clientY;
    const startH = listMaxHeight;
    let latest = startH;
    const onMove = (ev: MouseEvent) => {
      latest = Math.max(120, Math.min(window.innerHeight - 220, startH + ev.clientY - startY));
      setListMaxHeight(latest);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      try { localStorage.setItem('header_projects_list_height', String(latest)); } catch {}
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };
  // Último acesso por projeto (caminho local): o popup lista os mais recentes primeiro
  const [recentAccess, setRecentAccess] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem('header_recent_projects') || '{}'); } catch { return {}; }
  });
  useEffect(() => {
    if (!workspacePath) return;
    setRecentAccess((prev) => {
      const next = { ...prev, [workspacePath.toLowerCase()]: Date.now() };
      try { localStorage.setItem('header_recent_projects', JSON.stringify(next)); } catch {}
      return next;
    });
  }, [workspacePath]);
  const [onlyLocal, setOnlyLocal] = useState<boolean>(() => {
    try { return localStorage.getItem('header_projects_only_local') === '1'; } catch { return false; }
  });
  const [repos, setRepos] = useState<GithubRepoSummary[]>(() => GLOBAL_PROJECTS_CACHE.repos);
  const [localClonedRepos, setLocalClonedRepos] = useState<
    Array<{ dir: string; name: string; repoFullName?: string; remoteUrl?: string }>
  >(() => GLOBAL_PROJECTS_CACHE.localClonedRepos);
  const [orgs, setOrgs] = useState<Array<{ login: string; avatarUrl: string }>>(
    () => GLOBAL_PROJECTS_CACHE.orgs
  );
  const [currentUser, setCurrentUser] = useState<{ login: string; avatarUrl: string } | null>(
    () => GLOBAL_PROJECTS_CACHE.currentUser
  );
  const [isLoading, setIsLoading] = useState(false);
  const [customProjectIcons, setCustomProjectIcons] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('devflow_custom_project_icons');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Escuta alterações de ícones customizados feitas na tela de projetos ou modais
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'devflow_custom_project_icons') {
        try {
          setCustomProjectIcons(e.newValue ? JSON.parse(e.newValue) : {});
        } catch {}
      }
    };
    const handleCustomChange = () => {
      try {
        const saved = localStorage.getItem('devflow_custom_project_icons');
        setCustomProjectIcons(saved ? JSON.parse(saved) : {});
      } catch {}
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('devflow_custom_project_icons_changed', handleCustomChange);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('devflow_custom_project_icons_changed', handleCustomChange);
    };
  }, []);

  const containerRef = useRef<HTMLDivElement>(null);
  const orgRef = useRef<HTMLDivElement>(null);
  const projectRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click or escape
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (orgRef.current && !orgRef.current.contains(target)) {
        setIsOrgOpen(false);
      }
      if (projectRef.current && !projectRef.current.contains(target)) {
        setIsProjectOpen(false);
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOrgOpen(false);
        setIsProjectOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Sincronização de organização entre o cabeçalho e outras telas (ex: tela de Projetos)
  useEffect(() => {
    const handleOrgChanged = (e: any) => {
      const nextOrg = e?.detail || localStorage.getItem('header_selected_org');
      if (nextOrg && nextOrg !== selectedOrg) {
        setSelectedOrg(nextOrg);
      }
    };
    window.addEventListener('header_selected_org_changed', handleOrgChanged);
    window.addEventListener('storage', handleOrgChanged);
    return () => {
      window.removeEventListener('header_selected_org_changed', handleOrgChanged);
      window.removeEventListener('storage', handleOrgChanged);
    };
  }, [selectedOrg]);

  // Auto focus search input when opening project dropdown
  useEffect(() => {
    if (isProjectOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
  }, [isProjectOpen]);

  // Carrega e sincroniza repositórios usando o mesmo método e cache da tela de projetos
  useEffect(() => {
    let isCancelled = false;

    const syncProjectsData = async () => {
      setIsLoading(true);
      try {
        await prefetchProjectsData(workspacePath);
        if (GLOBAL_PROJECTS_CACHE.orgs.length === 0 && window.electronAPI?.shell?.exec) {
          try {
            const orgsRes = await window.electronAPI.shell.exec(
              'export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; gh api user/orgs',
              workspacePath || process.cwd()
            );
            if (orgsRes && orgsRes.exitCode === 0 && orgsRes.stdout.trim()) {
              const parsed = JSON.parse(orgsRes.stdout);
              if (Array.isArray(parsed) && parsed.length > 0) {
                const mapped = parsed.map((o: any) => ({ login: o.login, avatarUrl: o.avatar_url }));
                GLOBAL_PROJECTS_CACHE.orgs = mapped;
              }
            }
          } catch {}
        }
        if (!GLOBAL_PROJECTS_CACHE.currentUser && window.electronAPI?.shell?.exec) {
          try {
            const uRes = await window.electronAPI.shell.exec(
              'export PATH="$HOME/.local/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"; gh api user',
              workspacePath || process.cwd()
            );
            if (uRes && uRes.exitCode === 0 && uRes.stdout.trim()) {
              const u = JSON.parse(uRes.stdout);
              if (u && u.login) {
                GLOBAL_PROJECTS_CACHE.currentUser = { login: u.login, avatarUrl: u.avatar_url };
              }
            }
          } catch {}
        }
        if (!isCancelled) {
          setRepos([...GLOBAL_PROJECTS_CACHE.repos]);
          setLocalClonedRepos([...GLOBAL_PROJECTS_CACHE.localClonedRepos]);
          setOrgs([...GLOBAL_PROJECTS_CACHE.orgs]);
          setCurrentUser(GLOBAL_PROJECTS_CACHE.currentUser);
        }
      } catch (err) {
        console.warn('[HeaderProjectSelector] Erro ao sincronizar projetos:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    syncProjectsData();

    const handleCacheUpdated = () => {
      setRepos([...GLOBAL_PROJECTS_CACHE.repos]);
      setLocalClonedRepos([...GLOBAL_PROJECTS_CACHE.localClonedRepos]);
      setOrgs([...GLOBAL_PROJECTS_CACHE.orgs]);
      setCurrentUser(GLOBAL_PROJECTS_CACHE.currentUser);
    };

    window.addEventListener('devflow_projects_cache_updated', handleCacheUpdated);
    window.addEventListener('storage', handleCacheUpdated);

    return () => {
      isCancelled = true;
      window.removeEventListener('devflow_projects_cache_updated', handleCacheUpdated);
      window.removeEventListener('storage', handleCacheUpdated);
    };
  }, [workspacePath]);

  // Cards da prateleira unificada gerados pelo mesmo método da tela de projetos
  const allCards: ProjectCardData[] = useMemo(() => {
    return buildUnifiedProjectCards({
      repos,
      localClonedRepos,
      workspacePath,
      repoDetailsCache: GLOBAL_PROJECTS_CACHE.repoDetailsCache,
      orgs,
      currentUser,
      customProjectIcons,
      isEffectiveDark,
    });
  }, [repos, localClonedRepos, workspacePath, orgs, currentUser, customProjectIcons, isEffectiveDark]);

  // Lista unificada de projetos para o seletor da header
  const allProjects: HeaderProjectItem[] = useMemo(() => {
    return allCards.map((card) => ({
      id: card.id,
      name: card.title || card.name || 'Projeto',
      fullName: card.fullName || card.title || 'Projeto',
      htmlUrl: card.htmlUrl,
      isCloned: Boolean(card.isCloned),
      localDir: card.localDir,
      owner: card.owner || card.org,
      ownerAvatarUrl: card.ownerAvatarUrl,
      language: card.language || undefined,
      customIcon:
        customProjectIcons[card.fullName || ''] ||
        customProjectIcons[card.title] ||
        customProjectIcons[String(card.id)],
    }));
  }, [allCards, customProjectIcons]);

  // Organizações reais do usuário: Todas + Conta Pessoal + Organizações do GitHub
  const organizations: HeaderOrganizationItem[] = useMemo(() => {
    // Só organizações (a conta pessoal/usuários não entram no filtro)
    const list: HeaderOrganizationItem[] = [{ id: 'all', name: 'Todas' }];

    orgs.forEach((o) => {
      if (!list.some((existing) => existing.name.toLowerCase() === o.login?.toLowerCase())) {
        list.push({
          id: o.login,
          name: o.login,
          avatarUrl: o.avatarUrl,
        });
      }
    });

    return list;
  }, [orgs]);

  // Se o filtro salvo era um usuário (ou uma org que não existe mais), volta para Todas
  useEffect(() => {
    if (orgs.length === 0 || selectedOrg === 'Todas' || selectedOrg === 'all') return;
    if (!orgs.some((o) => o.login?.toLowerCase() === selectedOrg.toLowerCase())) {
      setSelectedOrg('Todas');
      try { localStorage.setItem('header_selected_org', 'Todas'); } catch {}
    }
  }, [orgs, selectedOrg]);

  // Current project name
  const currentProjectName = useMemo(() => {
    if (!workspacePath) return 'Selecionar Projeto';
    const folder = workspacePath.split('/').filter(Boolean).pop() || '';
    // 1) Match exato por nome da pasta E diretório
    let match = allProjects.find(
      (p) =>
        p.localDir &&
        p.localDir.toLowerCase() === workspacePath.toLowerCase() &&
        p.name.toLowerCase() === folder.toLowerCase()
    );
    // 2) Match exato pelo nome da pasta
    if (!match && folder) {
      match = allProjects.find((p) => p.name.toLowerCase() === folder.toLowerCase());
    }
    // 3) Match por localDir
    if (!match) {
      match = allProjects.find(
        (p) => p.localDir && p.localDir.toLowerCase() === workspacePath.toLowerCase()
      );
    }
    if (match) return match.name;
    if (folder.toLowerCase() === 'devflow-desktop') return 'Aura Dev';
    return folder || 'Projeto';
  }, [workspacePath, allProjects]);

  const currentProject = useMemo(() => {
    if (!workspacePath) return null;
    const folder = workspacePath.split('/').filter(Boolean).pop() || '';
    // 1) Match exato por nome da pasta E diretório
    let match = allProjects.find(
      (p) =>
        p.localDir &&
        p.localDir.toLowerCase() === workspacePath.toLowerCase() &&
        p.name.toLowerCase() === folder.toLowerCase()
    );
    // 2) Match exato pelo nome da pasta
    if (!match && folder) {
      match = allProjects.find((p) => p.name.toLowerCase() === folder.toLowerCase());
    }
    // 3) Match por localDir
    if (!match) {
      match = allProjects.find(
        (p) => p.localDir && p.localDir.toLowerCase() === workspacePath.toLowerCase()
      );
    }
    if (match) return match;
    const isDevFlow = folder.toLowerCase() === 'devflow-desktop';

    const matchRepo = repos.find(
      (g) =>
        g.name.toLowerCase() === folder.toLowerCase() ||
        (workspacePath && workspacePath.toLowerCase().endsWith('/' + g.name.toLowerCase()))
    );

    const ownerName = isDevFlow ? 'Walancy' : (matchRepo?.owner?.login || 'Local');
    const ownerAvatar =
      matchRepo?.owner?.avatar_url ||
      organizations.find((o) => o.name?.toLowerCase() === ownerName.toLowerCase() || o.id?.toLowerCase() === ownerName.toLowerCase())?.avatarUrl ||
      orgs.find((o) => o.login.toLowerCase() === ownerName.toLowerCase())?.avatarUrl ||
      (currentUser?.login?.toLowerCase() === ownerName.toLowerCase() ? currentUser.avatarUrl : undefined);

    return {
      id: 'active-workspace',
      name: isDevFlow ? 'Aura Dev' : folder,
      fullName: isDevFlow ? 'Walancy/aura-dev' : (matchRepo?.full_name || folder),
      owner: ownerName,
      localDir: workspacePath,
      isCloned: true,
      ownerAvatarUrl: ownerAvatar,
      language: matchRepo?.language,
      customIcon:
        customProjectIcons['active-workspace'] ||
        customProjectIcons[folder] ||
        customProjectIcons[isDevFlow ? 'Walancy/aura-dev' : folder],
    };
  }, [workspacePath, allProjects, repos, organizations, orgs, currentUser, customProjectIcons]);

  const currentProjectDescription = useMemo(() => {
    if (!currentProject) return undefined;
    const gh = repos.find(
      (r) =>
        (r.full_name && currentProject.fullName && r.full_name.toLowerCase() === currentProject.fullName.toLowerCase()) ||
        (r.name && r.name.toLowerCase() === currentProject.name.toLowerCase())
    );
    return gh?.description || undefined;
  }, [currentProject, repos]);

  useEffect(() => {
    if (currentProject) {
      const info: HeaderActiveProjectInfo = {
        name: currentProjectName,
        fullName: currentProject.fullName || currentProjectName,
        description: currentProjectDescription,
        owner: currentProject.owner,
        localDir: currentProject.localDir || workspacePath,
        htmlUrl: currentProject.htmlUrl,
        ownerAvatarUrl: currentProject.ownerAvatarUrl,
        language: currentProject.language,
        customIcon: currentProject.customIcon,
      };
      try {
        localStorage.setItem('header_active_project_name', currentProjectName);
        localStorage.setItem('header_active_project_fullname', currentProject.fullName || '');
        if (currentProjectDescription) {
          localStorage.setItem('header_active_project_desc', currentProjectDescription);
        }
      } catch {}
      onActiveProjectChange?.(info);
    }
  }, [currentProject, currentProjectName, currentProjectDescription, workspacePath, onActiveProjectChange]);

  const getProjectRuntime = useCallback(
    (projectOrPath: string | HeaderProjectItem): ProjectRuntimeInfo | null => {
      if (!projectRuntimes) return null;
      if (typeof projectOrPath === 'string') {
        const clean = projectOrPath.toLowerCase();
        for (const [key, val] of Object.entries(projectRuntimes)) {
          if (
            key.toLowerCase() === clean ||
            key.toLowerCase().endsWith('/' + clean) ||
            clean.endsWith('/' + key.toLowerCase())
          ) {
            return val;
          }
        }
        return null;
      }
      const p = projectOrPath;
      // Só a pasta exata do projeto conta: casar por nome fazia repos homônimos (appmoove/ainaobra x SelberSRFQ/ainaobra)
      // herdarem as sessões e o estado da IA um do outro
      if (!p.localDir) return null;
      for (const [key, val] of Object.entries(projectRuntimes)) {
        if (key.toLowerCase() === p.localDir.toLowerCase()) return val;
      }
      return null;
    },
    [projectRuntimes]
  );

  const getProjectAiStatus = useCallback(
    (projectOrPath: string | HeaderProjectItem): ProjectAiStatus | null => {
      if (!projectAiStatus) return null;
      const keys = Object.keys(projectAiStatus);
      const match = (key: string) => {
        const k = key.toLowerCase();
        if (typeof projectOrPath === 'string') return k === projectOrPath.toLowerCase();
        const dir = projectOrPath.localDir?.toLowerCase();
        return Boolean(dir && k === dir);
      };
      const found = keys.find(match);
      return found ? projectAiStatus[found] : null;
    },
    [projectAiStatus]
  );

  const renderAiStatusBadge = (status: ProjectAiStatus | null, size = 13) => {
    if (!status) return null;
    const cfg =
      status === 'generating'
        ? { title: 'IA gerando…', color: accentColor, icon: <Loader2 size={size} className="spin-animate" /> }
        : status === 'waiting'
        ? { title: 'IA aguardando sua resposta', color: '#f59e0b', icon: <MessageCircleQuestion size={size} /> }
        : { title: 'IA terminou de gerar', color: '#22c55e', icon: <CheckCircle2 size={size} /> };
    return (
      <span title={cfg.title} style={{ display: 'flex', alignItems: 'center', color: cfg.color, flexShrink: 0 }}>
        {cfg.icon}
      </span>
    );
  };

  // Um único indicador por projeto: estado da IA (gerando/aguardando/pronta) ou, sem IA ativa, "processos rodando"
  const renderProjectIndicator = (status: ProjectAiStatus | null, runtime: ProjectRuntimeInfo | null, size = 13) => {
    if (status) return renderAiStatusBadge(status, size);
    if (!runtime?.isRunning) return null;
    return (
      <span
        title={`Projeto em execução: ${runtime.runningProcessCount || 1} processo(s) rodando (terminal ou servidor)`}
        style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 6px rgba(34, 197, 94, 0.7)', flexShrink: 0 }}
      />
    );
  };

  const activeProjectRuntime = useMemo(() => {
    return workspacePath ? getProjectRuntime(workspacePath) : null;
  }, [workspacePath, getProjectRuntime]);

  const renderAiIcon = (provider: string, size = 13.5) => {
    const prov = (provider || '').toLowerCase();
    if (prov.includes('claude')) return <ClaudeIcon size={size} />;
    if (prov.includes('agy') || prov.includes('antigravity')) return <AntigravityIcon size={size} />;
    if (prov.includes('gemini')) return <GeminiIcon size={size} />;
    if (prov.includes('codex') || prov.includes('openai')) return <CodexIcon size={size} />;
    if (prov.includes('ollama')) return <OllamaIcon size={size} />;
    return null;
  };

  useEffect(() => {
    onProjectsListChange?.(allProjects);
  }, [allProjects, onProjectsListChange]);

  // Filtered project list by search query AND selected organization
  const filteredProjects = useMemo(() => {
    let list = allProjects;

    // Filter by Organization
    if (selectedOrg !== 'Todas' && selectedOrg !== 'all') {
      const orgQ = selectedOrg.toLowerCase();
      list = list.filter(
        (p) =>
          p.owner?.toLowerCase() === orgQ ||
          p.fullName?.toLowerCase().startsWith(`${orgQ}/`) ||
          ((p as any).org && (p as any).org.toLowerCase() === orgQ)
      );
    }

    // Somente repositórios locais (já clonados)
    if (onlyLocal) list = list.filter((p) => p.isCloned);

    // Filter by Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          p.fullName.toLowerCase().includes(q) ||
          (p.owner && p.owner.toLowerCase().includes(q))
      );
    }

    // Locais primeiro (as seções do popup dependem disso) e, dentro de cada grupo, o acesso mais recente primeiro.
    // sort é estável: projetos nunca acessados mantêm a ordem original.
    const accessOf = (p: HeaderProjectItem) => (p.localDir ? recentAccess[p.localDir.toLowerCase()] || 0 : 0);
    return [...list].sort((a, b) => Number(Boolean(b.isCloned)) - Number(Boolean(a.isCloned)) || accessOf(b) - accessOf(a));
  }, [allProjects, searchQuery, selectedOrg, onlyLocal, recentAccess]);

  // Handle project selection
  const handleSelect = async (project: HeaderProjectItem) => {
    logSystemActivity('header', 'switch_project', project.name, {
      fullName: project.fullName,
      localDir: project.localDir,
      isCloned: project.isCloned,
    });

    const info: HeaderActiveProjectInfo = {
      name: project.name,
      fullName: project.fullName || project.name,
      owner: project.owner,
      localDir: project.localDir || workspacePath,
      htmlUrl: project.htmlUrl,
      ownerAvatarUrl: project.ownerAvatarUrl,
      language: project.language,
      customIcon: project.customIcon,
    };
    onActiveProjectChange?.(info);

    const effectiveDir = project.localDir;
    if (effectiveDir) {
      setIsProjectOpen(false);
      await onSelectWorkspace(effectiveDir, project.fullName || project.name);
    } else {
      const cloneUrl = project.htmlUrl ? `${project.htmlUrl}.git` : `https://github.com/${project.fullName}.git`;
      try {
        let targetDir = '/Users/walancy/Documents/codes';
        if (window.electronAPI?.dialog?.openFolder) {
          const dialogRes = await window.electronAPI.dialog.openFolder();
          if (dialogRes) {
            targetDir =
              typeof dialogRes === 'string'
                ? dialogRes
                : (dialogRes as any)?.folderPath || (dialogRes as any)?.path;
          }
        }
        onToast?.(`Clonando ${project.name}...`);
        const res = await window.electronAPI?.git?.clone?.(cloneUrl, targetDir);
        if (res?.success) {
          const finalPath = res.repoPath || `${targetDir}/${project.name}`;
          setIsProjectOpen(false);
          await onSelectWorkspace(finalPath, project.fullName || project.name);
        } else {
          onToast?.(`Erro ao clonar: ${res?.error || 'falha no git clone'}`);
        }
      } catch (err: any) {
        onToast?.(`Erro: ${err?.message || 'não foi possível clonar o repositório'}`);
      }
    }
  };

  // Open arbitrary local folder dialog
  const handleOpenOtherFolder = async () => {
    setIsProjectOpen(false);
    if (window.electronAPI?.dialog?.openFolder) {
      const res = await window.electronAPI.dialog.openFolder();
      if (res && res.folderPath) {
        await onSelectWorkspace(res.folderPath, res.name);
      }
    } else {
      const folder = prompt('Digite o caminho absoluto da pasta:', workspacePath);
      if (folder && folder.trim()) {
        await onSelectWorkspace(folder.trim());
      }
    }
  };

  const selectedOrgObj = organizations.find((o) => o.name === selectedOrg);

  return (
    <div
      ref={containerRef}
      style={{
        padding: 5,
        background: themeTokens.bgCard,
        borderRadius: 10,
        border: '1px solid ' + themeTokens.border,
        justifyContent: 'flex-start',
        alignItems: 'center',
        gap: 5,
        display: 'flex',
        flexShrink: 0,
        marginLeft: 8,
        position: 'relative',
        WebkitAppRegion: 'no-drag' as any,
      }}
    >
      {/* 1. SELETOR DE ORGANIZAÇÃO (À ESQUERDA) */}
      <div style={{ position: 'relative' }} ref={orgRef}>
        <div
          onClick={() => {
            setIsOrgOpen((prev) => !prev);
            setIsProjectOpen(false);
          }}
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 5,
            paddingBottom: 5,
            background: isOrgOpen ? (isEffectiveDark ? '#2E2E2E' : '#e4e7eb') : 'transparent',
            borderRadius: 5,
            border: 'none',
            justifyContent: 'center',
            alignItems: 'center',
            display: 'flex',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            gap: 6,
            transition: 'all 0.15s ease',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => {
            if (!isOrgOpen) e.currentTarget.style.background = themeTokens.hoverBg;
          }}
          onMouseLeave={(e) => {
            if (!isOrgOpen) e.currentTarget.style.background = 'transparent';
          }}
          title="Filtrar projetos por organização"
        >
          {selectedOrg !== 'Todas' && selectedOrgObj?.avatarUrl ? (
            <img
              src={selectedOrgObj.avatarUrl}
              alt=""
              style={{ width: 14, height: 14, borderRadius: '50%', objectFit: 'cover' }}
            />
          ) : (
            <Building2 size={13.5} color={themeTokens.textSecondary} />
          )}
          <span
            style={{
              color: isOrgOpen ? themeTokens.textPrimary : themeTokens.textSecondary,
              fontSize: 12,
              fontFamily: 'Poppins, sans-serif',
              fontWeight: isOrgOpen ? '500' : '400',
              whiteSpace: 'nowrap',
              maxWidth: 130,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {selectedOrg}
          </span>
          <ChevronDown
            size={12}
            color={themeTokens.textSecondary}
            style={{
              transform: isOrgOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </div>

        {/* Popover Dropdown de Organizações */}
        {isOrgOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              minWidth: 210,
              background: isEffectiveDark ? '#141414' : themeTokens.bgCard,
              borderRadius: 10,
              border: `1px solid ${themeTokens.border}`,
              boxShadow: isEffectiveDark ? '0 16px 38px rgba(0,0,0,0.85)' : '0 14px 32px rgba(0,0,0,0.15)',
              zIndex: 10000,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              padding: 4,
              gap: 2,
            }}
          >
            <div
              style={{
                padding: '6px 8px',
                fontSize: 10,
                fontWeight: 600,
                color: themeTokens.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: '0.04em',
              }}
            >
              Filtrar por Organização
            </div>
            {organizations.map((org) => {
              const isSelected = selectedOrg === org.name;
              const countForOrg =
                org.name === 'Todas' || org.name === 'all'
                  ? allProjects.length
                  : allProjects.filter((p) => {
                      const orgQ = org.name.toLowerCase();
                      return (
                        p.owner?.toLowerCase() === orgQ ||
                        p.fullName?.toLowerCase().startsWith(`${orgQ}/`) ||
                        ((p as any).org && (p as any).org.toLowerCase() === orgQ)
                      );
                    }).length;

              return (
                <div
                  key={org.id}
                  onClick={() => {
                    setSelectedOrg(org.name);
                    try {
                      localStorage.setItem('header_selected_org', org.name);
                      window.dispatchEvent(new CustomEvent('header_selected_org_changed', { detail: org.name }));
                    } catch {}
                    setIsOrgOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 10px',
                    borderRadius: 6,
                    background: isSelected ? `${accentColor}18` : 'transparent',
                    color: isSelected ? accentColor : themeTokens.textPrimary,
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = themeTokens.hoverBg;
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    {org.avatarUrl ? (
                      <img
                        src={org.avatarUrl}
                        alt=""
                        style={{ width: 16, height: 16, borderRadius: '50%', objectFit: 'cover' }}
                      />
                    ) : (
                      <Building2 size={13.5} color={isSelected ? accentColor : themeTokens.textSecondary} />
                    )}
                    <span
                      style={{
                        maxWidth: 130,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {org.name}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 10.5, color: themeTokens.textSecondary }}>{countForOrg}</span>
                    {isSelected && <Check size={13} color={accentColor} />}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. SELETOR DE PROJETO (À DIREITA) */}
      <div style={{ position: 'relative' }} ref={projectRef}>
        <div
          onClick={() => {
            setIsProjectOpen((prev) => !prev);
            setIsOrgOpen(false);
          }}
          style={{
            paddingLeft: 12,
            paddingRight: 12,
            paddingTop: 5,
            paddingBottom: 5,
            background: isProjectOpen ? (isEffectiveDark ? '#2E2E2E' : '#e4e7eb') : 'transparent',
            borderRadius: 5,
            border: 'none',
            justifyContent: 'center',
            alignItems: 'center',
            display: 'flex',
            cursor: 'pointer',
            whiteSpace: 'nowrap',
            flexShrink: 0,
            gap: 6,
            transition: 'all 0.15s ease',
            userSelect: 'none',
          }}
          onMouseEnter={(e) => {
            if (!isProjectOpen) e.currentTarget.style.background = themeTokens.hoverBg;
          }}
          onMouseLeave={(e) => {
            if (!isProjectOpen) e.currentTarget.style.background = 'transparent';
          }}
          title="Alternar projeto ativo"
        >
          <ProjectHeaderIcon
            project={currentProject}
            size={16}
            accentColor={accentColor}
            customIcons={customProjectIcons}
            repos={repos}
            orgs={organizations}
          />
          <span
            style={{
              color: isProjectOpen ? themeTokens.textPrimary : themeTokens.textPrimary,
              fontSize: 12,
              fontFamily: 'Poppins, sans-serif',
              fontWeight: '500',
              maxWidth: 150,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {currentProjectName}
          </span>

          {/* IA do projeto atual + UM único indicador: estado da IA ou, se não houver, processo rodando */}
          {(activeProjectRuntime?.activeAiProvider || activeProjectRuntime?.isRunning || (workspacePath && getProjectAiStatus(workspacePath))) && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 2 }}>
              {activeProjectRuntime?.activeAiProvider && (
                <span title={`IA do projeto: ${activeProjectRuntime.activeAiProvider}`} style={{ display: 'flex' }}>
                  {renderAiIcon(activeProjectRuntime.activeAiProvider, 13)}
                </span>
              )}
              {renderProjectIndicator(workspacePath ? getProjectAiStatus(workspacePath) : null, activeProjectRuntime, 12)}
            </div>
          )}

          <ChevronDown
            size={12}
            color={themeTokens.textSecondary}
            style={{
              transform: isProjectOpen ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.15s ease',
            }}
          />
        </div>

        {/* Popover Dropdown de Seleção de Projetos */}
        {isProjectOpen && (
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              width: 320,
              background: isEffectiveDark ? '#141414' : themeTokens.bgCard,
              borderRadius: 10,
              border: `1px solid ${themeTokens.border}`,
              boxShadow: isEffectiveDark ? '0 16px 38px rgba(0,0,0,0.85)' : '0 14px 32px rgba(0,0,0,0.15)',
              zIndex: 10000,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {/* Header de Busca */}
            <div
              style={{
                padding: '8px 10px',
                borderBottom: `1px solid ${themeTokens.border}`,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: isEffectiveDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <Search size={13} color={themeTokens.textSecondary} style={{ flexShrink: 0 }} />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={selectedOrg === 'Todas' ? 'Buscar projeto...' : `Buscar em ${selectedOrg}...`}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 12,
                  color: themeTokens.textPrimary,
                  fontFamily: 'Poppins, sans-serif',
                  padding: 0,
                }}
              />
              <button
                type="button"
                onClick={() => {
                  const next = !onlyLocal;
                  setOnlyLocal(next);
                  try { localStorage.setItem('header_projects_only_local', next ? '1' : '0'); } catch {}
                }}
                title={onlyLocal ? 'Mostrando somente repositórios locais (clique para ver todos)' : 'Mostrar somente repositórios locais'}
                style={{
                  background: onlyLocal ? `${accentColor}22` : 'transparent',
                  border: 'none',
                  borderRadius: 5,
                  color: onlyLocal ? accentColor : themeTokens.textSecondary,
                  cursor: 'pointer',
                  padding: 4,
                  display: 'flex',
                  flexShrink: 0,
                }}
              >
                <HardDrive size={13} />
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: themeTokens.textSecondary,
                    cursor: 'pointer',
                    padding: 2,
                    display: 'flex',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            {/* Chip/Aviso de Filtro por Organização Ativo */}
            {selectedOrg !== 'Todas' && (
              <div
                style={{
                  padding: '4px 10px',
                  borderBottom: `1px solid ${themeTokens.border}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: isEffectiveDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.01)',
                  fontSize: 10.5,
                  color: themeTokens.textSecondary,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <Building2 size={11} color={accentColor} />
                  <span>
                    Filtrando por: <strong style={{ color: themeTokens.textPrimary }}>{selectedOrg}</strong>
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedOrg('Todas');
                    try {
                      localStorage.setItem('header_selected_org', 'Todas');
                      window.dispatchEvent(new CustomEvent('header_selected_org_changed', { detail: 'Todas' }));
                    } catch {}
                  }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: accentColor,
                    fontSize: 10,
                    cursor: 'pointer',
                    padding: 0,
                    fontWeight: 500,
                  }}
                >
                  Limpar
                </button>
              </div>
            )}

            {/* Lista de Projetos com Scroll */}
            <div
              style={{
                maxHeight: listMaxHeight,
                overflowY: 'auto',
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
              }}
            >
              {filteredProjects.length === 0 ? (
                <div
                  style={{
                    padding: '20px 10px',
                    textAlign: 'center',
                    fontSize: 11.5,
                    color: themeTokens.textSecondary,
                  }}
                >
                  {isLoading
                    ? 'Carregando projetos...'
                    : onlyLocal
                    ? 'Nenhum repositório local encontrado.'
                    : selectedOrg !== 'Todas'
                    ? `Nenhum projeto encontrado para "${selectedOrg}".`
                    : 'Nenhum projeto encontrado.'}
                </div>
              ) : (
                filteredProjects.map((project, idx) => {
                  const prevProject = idx > 0 ? filteredProjects[idx - 1] : null;
                  const isFirstCloned = project.isCloned && (!prevProject || !prevProject.isCloned);
                  const isFirstRemote = !project.isCloned && (!prevProject || prevProject.isCloned);
                  const isActive = currentProject
                    ? (Boolean(project.fullName && currentProject.fullName && project.fullName.toLowerCase() === currentProject.fullName.toLowerCase()) ||
                       Boolean(project.id === currentProject.id) ||
                       // nome igual só vale quando falta fullName (repos homônimos de donos diferentes não são o mesmo projeto)
                       Boolean(!(project.fullName && currentProject.fullName) && project.name.toLowerCase() === currentProject.name.toLowerCase() && Boolean(project.isCloned) === Boolean(currentProject.isCloned)))
                    : project.name.toLowerCase() === currentProjectName.toLowerCase();

                  return (
                    <React.Fragment key={project.id}>
                      {!searchQuery && isFirstCloned && (
                        <div
                          style={{
                            padding: '4px 8px 2px 8px',
                            fontSize: 10,
                            fontWeight: 600,
                            color: '#22c55e',
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                          <span>Projetos Locais</span>
                        </div>
                      )}
                      {!searchQuery && isFirstRemote && (
                        <div
                          style={{
                            padding: '8px 8px 2px 8px',
                            marginTop: 4,
                            borderTop: `1px solid ${themeTokens.border}`,
                            fontSize: 10,
                            fontWeight: 600,
                            color: themeTokens.textSecondary,
                            textTransform: 'uppercase',
                            letterSpacing: '0.04em',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span
                            style={{
                              width: 6,
                              height: 6,
                              borderRadius: '50%',
                              background: themeTokens.textSecondary,
                            }}
                          />
                          <span>Repositórios GitHub</span>
                        </div>
                      )}
                      <div
                        onClick={() => handleSelect(project)}
                        style={{
                          padding: '7px 10px',
                          borderRadius: 6,
                          background: isActive ? `${accentColor}18` : 'transparent',
                          border: isActive ? `1px solid ${accentColor}44` : '1px solid transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          transition: 'all 0.12s ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) e.currentTarget.style.background = themeTokens.hoverBg;
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 7,
                            minWidth: 0,
                            flex: 1,
                            marginRight: 8,
                          }}
                        >
                          <ProjectHeaderIcon
                            project={project}
                            size={15}
                            accentColor={isActive ? accentColor : themeTokens.textSecondary}
                            customIcons={customProjectIcons}
                            repos={repos}
                            orgs={organizations}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: 12,
                                fontWeight: isActive ? 600 : 400,
                                color: themeTokens.textPrimary,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {project.name}
                            </div>
                            {project.owner && project.owner !== project.name && (
                              <div
                                style={{
                                  fontSize: 10,
                                  color: themeTokens.textSecondary,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {project.owner}
                              </div>
                            )}
                          </div>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          {(() => {
                            const pRuntime = getProjectRuntime(project);
                            const pAiStatus = getProjectAiStatus(project);
                            return (
                              <>
                                {pRuntime?.activeAiProvider && (
                                  <div
                                    title={`IA ativa: ${pRuntime.activeAiProvider}${pRuntime.isAiRunning ? ' (executando agora)' : ''}`}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                                      border: '1px solid transparent',
                                    }}
                                  >
                                    {renderAiIcon(pRuntime.activeAiProvider, 13)}
                                  </div>
                                )}

                                {renderProjectIndicator(pAiStatus, pRuntime, 14)}
                              </>
                            );
                          })()}
                          {!project.isCloned ? (
                            <span
                              style={{
                                fontSize: 9.5,
                                color: accentColor,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                                padding: '2px 6px',
                                borderRadius: 4,
                                background: `${accentColor}14`,
                              }}
                              title="Clique para clonar"
                            >
                              <DownloadCloud size={11} />
                              <span>Clonar</span>
                            </span>
                          ) : isActive ? (
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                color: accentColor,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                              }}
                            >
                              <Check size={12} strokeWidth={2.5} />
                              <span>Ativo</span>
                            </span>
                          ) : (
                            <span
                              style={{
                                fontSize: 9.5,
                                color: '#22c55e',
                                background: 'rgba(34, 197, 94, 0.12)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontWeight: 500,
                              }}
                            >
                              Local
                            </span>
                          )}
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })
              )}
            </div>

            {/* Rodapé: Abrir outra pasta do computador */}
            <div
              style={{
                padding: '6px 8px',
                borderTop: `1px solid ${themeTokens.border}`,
                background: isEffectiveDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              }}
            >
              <button
                type="button"
                onClick={handleOpenOtherFolder}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  background: 'transparent',
                  border: `1px dashed ${themeTokens.border}`,
                  borderRadius: 6,
                  color: themeTokens.textSecondary,
                  fontSize: 11,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = themeTokens.textPrimary;
                  e.currentTarget.style.borderColor = accentColor;
                  e.currentTarget.style.background = themeTokens.hoverBg;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = themeTokens.textSecondary;
                  e.currentTarget.style.borderColor = themeTokens.border;
                  e.currentTarget.style.background = 'transparent';
                }}
              >
                <FolderPlus size={13} />
                <span>Abrir outra pasta...</span>
              </button>
            </div>

            {/* Alça para redimensionar a altura (duplo clique restaura) */}
            <div
              onMouseDown={handleStartListResize}
              onDoubleClick={() => {
                setListMaxHeight(250);
                try { localStorage.setItem('header_projects_list_height', '250'); } catch {}
              }}
              title="Arraste para redimensionar a altura (duplo clique restaura)"
              onMouseEnter={(e) => { (e.currentTarget.firstElementChild as HTMLElement).style.background = isEffectiveDark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)'; }}
              onMouseLeave={(e) => { (e.currentTarget.firstElementChild as HTMLElement).style.background = isEffectiveDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)'; }}
              style={{ height: 10, cursor: 'row-resize', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            >
              <div
                style={{
                  width: 32,
                  height: 3,
                  borderRadius: 2,
                  background: isEffectiveDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
                  transition: 'background 0.15s ease',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
