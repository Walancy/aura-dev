import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, ChevronUp, Search, X, FolderGit2, DownloadCloud, Loader2, Check } from 'lucide-react';

export interface ProjectWorkspaceItem {
  id: string | number;
  name: string;
  fullName: string;
  htmlUrl?: string;
  isCloned: boolean;
  localDir?: string;
  sprint: string;
  issuesDone: number;
  issuesPending: number;
}

export interface ProjectWorkspaceSelectorProps {
  workspacePath: string;
  onSelectWorkspace: (dirPath: string, repoName?: string) => Promise<void> | void;
  themeTokens: {
    bgCard: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    hoverBg: string;
  };
  isEffectiveDark: boolean;
  accentColor: string;
  onToast: (msg: string) => void;
}

export const ProjectWorkspaceSelector: React.FC<ProjectWorkspaceSelectorProps> = ({
  workspacePath,
  onSelectWorkspace,
  themeTokens,
  isEffectiveDark,
  accentColor,
  onToast,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [localClonedRepos, setLocalClonedRepos] = useState<Array<{ dir: string; name: string; repoFullName?: string; remoteUrl?: string }>>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cloningRepoName, setCloningRepoName] = useState<string | null>(null);
  const [repoDetails, setRepoDetails] = useState<Record<string, { sprint: string; done: number; pending: number }>>({});

  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Close when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      setTimeout(() => searchInputRef.current?.focus(), 50);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Load repositories from GitHub and local filesystem
  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      try {
        // 1. Scan local cloned repos
        let localList: any[] = [];
        if (window.electronAPI?.git?.scanLocalProjects) {
          localList = await window.electronAPI.git.scanLocalProjects();
        } else if (window.electronAPI?.git?.listRepos && workspacePath) {
          localList = await window.electronAPI.git.listRepos(workspacePath);
        }

        if (!isCancelled) {
          setLocalClonedRepos(localList || []);
        }

        // 2. Fetch GitHub repos
        if (window.electronAPI?.github?.fetchRepos) {
          const res = await window.electronAPI.github.fetchRepos();
          if (!isCancelled && res?.success && res.repos) {
            setGithubRepos(res.repos);
          }
        }
      } catch (err) {
        console.warn('[ProjectWorkspaceSelector] Erro ao carregar projetos:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [workspacePath]);

  // Fetch issue & milestone info for active and top repos
  useEffect(() => {
    // Current workspace git info
    if (window.electronAPI?.git?.getWorkspaceGitInfo && workspacePath) {
      window.electronAPI.git.getWorkspaceGitInfo(workspacePath).then((info: any) => {
        if (info && info.repoName) {
          setRepoDetails((prev) => ({
            ...prev,
            [info.repoName]: {
              sprint: info.sprintTitle || 'Sprint 1',
              done: 0,
              pending: info.issuesCount || 0,
            },
            ...(info.repoFullName
              ? {
                  [info.repoFullName]: {
                    sprint: info.sprintTitle || 'Sprint 1',
                    done: 0,
                    pending: info.issuesCount || 0,
                  },
                }
              : {}),
          }));
        }
      });
    }

    // Try to pre-load from localStorage cache if available from ProjectsSchedulerView
    try {
      const savedCache = localStorage.getItem('devflow_repo_details_cache');
      if (savedCache) {
        const parsed = JSON.parse(savedCache);
        const mapped: Record<string, { sprint: string; done: number; pending: number }> = {};
        Object.entries(parsed).forEach(([repoFullName, data]: [string, any]) => {
          const issues = data.issues || [];
          const done = issues.filter((i: any) => i.status === 'Concluído' || i.state === 'closed').length;
          const pending = issues.filter((i: any) => i.status !== 'Concluído' && i.state !== 'closed').length;
          const activeMilestone = (data.milestones || []).find((m: any) => m.state === 'open');
          mapped[repoFullName] = {
            sprint: activeMilestone?.title || 'Sprint 1',
            done,
            pending: pending || data.open_issues_count || issues.length,
          };
        });
        setRepoDetails((prev) => ({ ...mapped, ...prev }));
      }
    } catch {}
  }, [workspacePath]);

  // Build unified project list
  const allProjects: ProjectWorkspaceItem[] = useMemo(() => {
    const list: ProjectWorkspaceItem[] = [];
    const seenNames = new Set<string>();

    // 1. First add GitHub repos
    githubRepos.forEach((ghRepo) => {
      seenNames.add(ghRepo.name.toLowerCase());
      seenNames.add(ghRepo.full_name.toLowerCase());

      // Check if cloned locally
      const localMatch = localClonedRepos.find((l) => {
        if (l.repoFullName && l.repoFullName.toLowerCase() === ghRepo.full_name.toLowerCase()) return true;
        if (l.name.toLowerCase() === ghRepo.name.toLowerCase()) return true;
        if (l.remoteUrl && ghRepo.html_url && l.remoteUrl.includes(ghRepo.name)) return true;
        return false;
      });

      // Check if current workspace matches
      const isCurrentWorkspace =
        workspacePath.toLowerCase().endsWith(`/${ghRepo.name.toLowerCase()}`) ||
        workspacePath.toLowerCase().endsWith(`/${ghRepo.name.toLowerCase()}/`) ||
        (localMatch && localMatch.dir.toLowerCase() === workspacePath.toLowerCase());

      const isCloned = Boolean(localMatch || isCurrentWorkspace);
      const localDir = isCurrentWorkspace ? workspacePath : localMatch?.dir;

      const stats = repoDetails[ghRepo.full_name] || repoDetails[ghRepo.name];

      list.push({
        id: ghRepo.id,
        name: ghRepo.name,
        fullName: ghRepo.full_name,
        htmlUrl: ghRepo.html_url,
        isCloned,
        localDir,
        sprint: stats?.sprint || ghRepo.language || 'Sprint 1',
        issuesDone: stats?.done || 0,
        issuesPending: stats ? stats.pending : ghRepo.open_issues_count || 0,
      });
    });

    // 2. Add local repos that might not be on the GitHub repo list
    localClonedRepos.forEach((locRepo, idx) => {
      if (seenNames.has(locRepo.name.toLowerCase())) return;
      if (locRepo.repoFullName && seenNames.has(locRepo.repoFullName.toLowerCase())) return;

      const isCurrent = locRepo.dir.toLowerCase() === workspacePath.toLowerCase();
      const stats = repoDetails[locRepo.name] || (locRepo.repoFullName ? repoDetails[locRepo.repoFullName] : null);

      list.push({
        id: `local-${idx}`,
        name: locRepo.name,
        fullName: locRepo.repoFullName || locRepo.name,
        htmlUrl: locRepo.remoteUrl,
        isCloned: true,
        localDir: locRepo.dir,
        sprint: stats?.sprint || 'Sprint 1',
        issuesDone: stats?.done || 0,
        issuesPending: stats?.pending || 0,
      });
    });

    // Fallback if empty: add current workspace as active
    if (list.length === 0 && workspacePath) {
      const folderName = workspacePath.split('/').filter(Boolean).pop() || 'Workspace';
      list.push({
        id: 'current',
        name: folderName,
        fullName: folderName,
        isCloned: true,
        localDir: workspacePath,
        sprint: 'Sprint 1',
        issuesDone: 0,
        issuesPending: 0,
      });
    }

    return list;
  }, [githubRepos, localClonedRepos, workspacePath, repoDetails]);

  // Current active project
  const activeProject: ProjectWorkspaceItem = useMemo(() => {
    const currentFolderName = workspacePath.split('/').filter(Boolean).pop()?.toLowerCase() || '';

    // Exact path match or folder name match
    const found = allProjects.find((p) => {
      if (p.localDir && p.localDir.toLowerCase() === workspacePath.toLowerCase()) return true;
      if (p.name.toLowerCase() === currentFolderName) return true;
      return false;
    });

    if (found) return found;

    return (
      allProjects[0] || {
        id: 'fallback',
        name: currentFolderName || 'Projeto',
        fullName: currentFolderName || 'Projeto',
        isCloned: true,
        localDir: workspacePath,
        sprint: 'Sprint 1',
        issuesDone: 0,
        issuesPending: 0,
      }
    );
  }, [allProjects, workspacePath]);

  // Filtered projects for the search dropdown
  const filteredProjects = useMemo(() => {
    if (!searchQuery.trim()) return allProjects;
    const q = searchQuery.toLowerCase().trim();
    return allProjects.filter(
      (p) => p.name.toLowerCase().includes(q) || p.fullName.toLowerCase().includes(q) || p.sprint.toLowerCase().includes(q)
    );
  }, [allProjects, searchQuery]);

  // Action: Select project
  const handleSelectProject = async (project: ProjectWorkspaceItem) => {
    if (project.isCloned && project.localDir) {
      // Already cloned: Switch workspace path and load files
      await onSelectWorkspace(project.localDir, project.name);
      setIsOpen(false);
      onToast(`Projeto ativo: ${project.name}`);
    } else {
      // Not cloned: Trigger clone workflow
      await handleCloneProject(project);
    }
  };

  // Action: Clone project
  const handleCloneProject = async (project: ProjectWorkspaceItem) => {
    const cloneUrl = project.htmlUrl ? `${project.htmlUrl}.git` : `https://github.com/${project.fullName}.git`;
    if (!cloneUrl) {
      onToast('URL de clone não disponível.');
      return;
    }

    try {
      // Ask user where to clone or pick folder
      let targetDir = '';
      if (window.electronAPI?.dialog?.openFolder) {
        const dialogRes = await window.electronAPI.dialog.openFolder();
        if (!dialogRes) return;
        targetDir = typeof dialogRes === 'string' ? dialogRes : (dialogRes as any)?.folderPath || (dialogRes as any)?.path;
      }

      // Default fallback folder
      if (!targetDir) {
        targetDir = '/Users/walancy/Documents/codes';
      }

      setCloningRepoName(project.name);
      onToast(`Clonando ${project.name}...`);

      const res = await window.electronAPI?.git?.clone?.(cloneUrl, targetDir);

      if (res?.success) {
        const finalRepoPath = res.repoPath || `${targetDir}/${project.name}`;
        onToast(`Repositório clonado com sucesso: ${project.name}`);

        // Update local list state
        setLocalClonedRepos((prev) => [
          ...prev,
          { dir: finalRepoPath, name: project.name, repoFullName: project.fullName, remoteUrl: cloneUrl },
        ]);

        // Automatically open the cloned repository
        await onSelectWorkspace(finalRepoPath, project.name);
        setIsOpen(false);
      } else {
        onToast(`Erro ao clonar: ${res?.error || 'Falha no comando git clone'}`);
      }
    } catch (err: any) {
      onToast(`Erro: ${err?.message || 'Falha ao clonar repositório'}`);
    } finally {
      setCloningRepoName(null);
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        position: 'relative',
        boxSizing: 'border-box',
        zIndex: 50,
      }}
    >
      {/* ===================================================================== */}
      {/* DIV FINA NO TOPO DO EXPLORER: CARD ÚNICO DO PROJETO ATIVO             */}
      {/* ===================================================================== */}
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          width: '100%',
          padding: '8px 10px',
          background: themeTokens.bgCard,
          borderRadius: 8,
          border: `1px solid ${isOpen ? accentColor : themeTokens.border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          boxSizing: 'border-box',
          opacity: activeProject.isCloned ? 1 : 0.55,
          transition: 'all 0.15s ease',
          boxShadow: isEffectiveDark ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = themeTokens.hoverBg;
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = themeTokens.bgCard;
        }}
        title={activeProject.isCloned ? 'Projeto atual (clonado)' : 'Projeto atual (não clonado)'}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1, marginRight: 8 }}>
          {/* Topo do Card: SOMENTE o nome do projeto */}
          <div
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: themeTokens.textPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
            }}
          >
            {activeProject.name}
          </div>

          {/* Em baixo do nome: em qual sprint está e a quantidade de issue feitas/pendentes */}
          <div
            style={{
              fontSize: 10,
              fontWeight: 400,
              color: themeTokens.textSecondary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.2,
            }}
          >
            {activeProject.sprint} • {activeProject.issuesDone} feitas / {activeProject.issuesPending} pendentes
          </div>
        </div>

        {/* Chevron para indicar expansão */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: themeTokens.textMuted,
            flexShrink: 0,
          }}
        >
          {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </div>

      {/* ===================================================================== */}
      {/* PAINEL EXPANDIDO COM CAMPO DE BUSCA NO TOPO E LISTA COM SCROLL        */}
      {/* ===================================================================== */}
      {isOpen && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 4px)',
            left: 0,
            right: 0,
            background: themeTokens.bgCard,
            borderRadius: 8,
            border: `1px solid ${themeTokens.border}`,
            boxShadow: isEffectiveDark ? '0 12px 28px rgba(0,0,0,0.65)' : '0 12px 28px rgba(0,0,0,0.12)',
            zIndex: 1000,
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            animation: 'fadeIn 0.12s ease-out',
            boxSizing: 'border-box',
          }}
        >
          {/* Campo de Busca no Topo */}
          <div
            style={{
              padding: '7px 8px',
              borderBottom: `1px solid ${themeTokens.border}`,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: isEffectiveDark ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0.02)',
            }}
          >
            <Search size={13} color={themeTokens.textMuted} style={{ flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar projeto..."
              style={{
                flex: 1,
                background: 'transparent',
                border: 'none',
                outline: 'none',
                fontSize: 11.5,
                fontWeight: 400,
                color: themeTokens.textPrimary,
                padding: 0,
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: themeTokens.textMuted,
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                }}
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Lista com Scroll dos Projetos */}
          <div
            style={{
              maxHeight: 280,
              overflowY: 'auto',
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 3,
            }}
          >
            {filteredProjects.length === 0 ? (
              <div
                style={{
                  padding: '20px 12px',
                  textAlign: 'center',
                  fontSize: 11,
                  fontWeight: 400,
                  color: themeTokens.textMuted,
                }}
              >
                {isLoading ? 'Carregando projetos...' : 'Nenhum projeto encontrado.'}
              </div>
            ) : (
              filteredProjects.map((project) => {
                const isActive = project.name.toLowerCase() === activeProject.name.toLowerCase();
                const isCloningThis = cloningRepoName === project.name;

                return (
                  <div
                    key={project.id}
                    onClick={() => {
                      if (!isCloningThis) handleSelectProject(project);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 6,
                      background: isActive ? (isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)') : 'transparent',
                      cursor: isCloningThis ? 'wait' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      opacity: project.isCloned ? 1 : 0.55,
                      transition: 'all 0.12s ease',
                      position: 'relative',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = themeTokens.hoverBg;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = isActive
                        ? isEffectiveDark
                          ? 'rgba(255,255,255,0.06)'
                          : 'rgba(0,0,0,0.04)'
                        : 'transparent';
                    }}
                    title={
                      project.isCloned
                        ? `${project.name} (Clonado no disco)`
                        : `${project.name} (Não clonado - clique para clonar)`
                    }
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1, marginRight: 8 }}>
                      {/* Topo do Card: SOMENTE o nome do projeto */}
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 400,
                          color: themeTokens.textPrimary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.2,
                        }}
                      >
                        {project.name}
                      </div>

                      {/* Em baixo do nome: em qual sprint está e a quantidade de issue feitas/pendentes */}
                      <div
                        style={{
                          fontSize: 10,
                          fontWeight: 400,
                          color: themeTokens.textSecondary,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          lineHeight: 1.2,
                        }}
                      >
                        {project.sprint} • {project.issuesDone} feitas / {project.issuesPending} pendentes
                      </div>
                    </div>

                    {/* Status lateral: Ativo / Clonar / Loading */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {isCloningThis ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: accentColor, fontSize: 10.5, fontWeight: 400 }}>
                          <Loader2 size={12} className="animate-spin" />
                          <span>Clonando...</span>
                        </div>
                      ) : isActive ? (
                        <span title="Projeto ativo">
                          <Check size={13} color={accentColor} />
                        </span>
                      ) : !project.isCloned ? (
                        <span title="Não clonado (clique para clonar)">
                          <DownloadCloud size={13} color={themeTokens.textMuted} />
                        </span>
                      ) : (
                        <span title="Clonado localmente">
                          <FolderGit2 size={13} color={themeTokens.textMuted} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
