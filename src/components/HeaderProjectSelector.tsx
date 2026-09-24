import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ChevronDown, Search, X, FolderGit2, Check, FolderPlus, DownloadCloud, Building2 } from 'lucide-react';

export interface HeaderProjectItem {
  id: string | number;
  name: string;
  fullName: string;
  htmlUrl?: string;
  isCloned: boolean;
  localDir?: string;
  owner?: string;
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
}

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

  const [organizations, setOrganizations] = useState<HeaderOrganizationItem[]>([
    { id: 'all', name: 'Todas' },
  ]);

  const [searchQuery, setSearchQuery] = useState('');
  const [githubRepos, setGithubRepos] = useState<any[]>([]);
  const [localClonedRepos, setLocalClonedRepos] = useState<
    Array<{ dir: string; name: string; repoFullName?: string; remoteUrl?: string }>
  >([]);
  const [isLoading, setIsLoading] = useState(false);

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

  // Auto focus search input when opening project dropdown
  useEffect(() => {
    if (isProjectOpen) {
      setTimeout(() => searchInputRef.current?.focus(), 60);
    }
  }, [isProjectOpen]);

  // Load repositories from local filesystem and GitHub
  useEffect(() => {
    let isCancelled = false;

    const loadData = async () => {
      setIsLoading(true);
      try {
        let localList: any[] = [];
        if (window.electronAPI?.git?.scanLocalProjects) {
          localList = await window.electronAPI.git.scanLocalProjects();
        } else if (window.electronAPI?.git?.listRepos && workspacePath) {
          localList = await window.electronAPI.git.listRepos(workspacePath);
        }

        if (!isCancelled) {
          setLocalClonedRepos(localList || []);
        }

        if (window.electronAPI?.github?.fetchRepos) {
          const res = await window.electronAPI.github.fetchRepos();
          if (!isCancelled && res?.success && res.repos) {
            setGithubRepos(res.repos);
          }
        }
      } catch (err) {
        console.warn('[HeaderProjectSelector] Erro ao carregar projetos:', err);
      } finally {
        if (!isCancelled) setIsLoading(false);
      }
    };

    loadData();
    return () => {
      isCancelled = true;
    };
  }, [workspacePath]);

  // Build unified project list
  const allProjects: HeaderProjectItem[] = useMemo(() => {
    const list: HeaderProjectItem[] = [];
    const seenNames = new Set<string>();

    // 1. Add GitHub repos
    githubRepos.forEach((ghRepo) => {
      seenNames.add(ghRepo.name.toLowerCase());
      seenNames.add(ghRepo.full_name?.toLowerCase() || '');

      const localMatch = localClonedRepos.find((l) => {
        if (l.repoFullName && l.repoFullName.toLowerCase() === ghRepo.full_name?.toLowerCase()) return true;
        if (l.name.toLowerCase() === ghRepo.name.toLowerCase()) return true;
        if (l.remoteUrl && ghRepo.html_url && l.remoteUrl.includes(ghRepo.name)) return true;
        return false;
      });

      const isCurrentWorkspace =
        workspacePath.toLowerCase().endsWith(`/${ghRepo.name.toLowerCase()}`) ||
        workspacePath.toLowerCase().endsWith(`/${ghRepo.name.toLowerCase()}/`) ||
        (localMatch && localMatch.dir.toLowerCase() === workspacePath.toLowerCase());

      const isCloned = Boolean(localMatch || isCurrentWorkspace);
      const localDir = isCurrentWorkspace ? workspacePath : localMatch?.dir;
      const owner = ghRepo.owner?.login || ghRepo.full_name?.split('/')[0] || '';

      list.push({
        id: ghRepo.id,
        name: ghRepo.name,
        fullName: ghRepo.full_name || ghRepo.name,
        htmlUrl: ghRepo.html_url,
        isCloned,
        localDir,
        owner,
      });
    });

    // 2. Add local repos not on GitHub list
    localClonedRepos.forEach((locRepo, idx) => {
      if (seenNames.has(locRepo.name.toLowerCase())) return;
      if (locRepo.repoFullName && seenNames.has(locRepo.repoFullName.toLowerCase())) return;

      const owner = locRepo.repoFullName?.split('/')[0] || '';

      list.push({
        id: `local-${idx}`,
        name: locRepo.name,
        fullName: locRepo.repoFullName || locRepo.name,
        htmlUrl: locRepo.remoteUrl,
        isCloned: true,
        localDir: locRepo.dir,
        owner,
      });
    });

    // 3. Fallback: if current workspace is not yet in list, add it
    if (workspacePath && !list.some((p) => p.localDir && p.localDir.toLowerCase() === workspacePath.toLowerCase())) {
      const folderName = workspacePath.split('/').filter(Boolean).pop() || 'Workspace';
      const displayName = folderName.toLowerCase() === 'devflow-desktop' ? 'Aura Dev' : folderName;
      list.unshift({
        id: 'active-workspace',
        name: displayName,
        fullName: folderName.toLowerCase() === 'devflow-desktop' ? 'Walancy/aura-dev' : displayName,
        isCloned: true,
        localDir: workspacePath,
        owner: folderName.toLowerCase() === 'devflow-desktop' ? 'Walancy' : 'Local',
      });
    }

    // 4. Sort: Locally cloned projects first, then alphabetical
    list.sort((a, b) => {
      const aIsActive = a.localDir && workspacePath && a.localDir.toLowerCase() === workspacePath.toLowerCase();
      const bIsActive = b.localDir && workspacePath && b.localDir.toLowerCase() === workspacePath.toLowerCase();
      if (aIsActive && !bIsActive) return -1;
      if (!aIsActive && bIsActive) return 1;

      if (a.isCloned && !b.isCloned) return -1;
      if (!a.isCloned && b.isCloned) return 1;

      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    });

    return list;
  }, [githubRepos, localClonedRepos, workspacePath]);

  // Load organizations from GitHub and local projects
  useEffect(() => {
    let isCancelled = false;

    const loadOrgs = async () => {
      try {
        const [userRes, orgsRes] = await Promise.all([
          window.electronAPI?.github?.getUser?.(),
          window.electronAPI?.github?.fetchOrgs?.(),
        ]);

        if (isCancelled) return;

        const list: HeaderOrganizationItem[] = [{ id: 'all', name: 'Todas' }];

        if (userRes?.success && userRes.user) {
          list.push({
            id: userRes.user.login,
            name: userRes.user.login,
            avatarUrl: userRes.user.avatarUrl,
          });
        }

        if (orgsRes?.success && Array.isArray(orgsRes.orgs)) {
          orgsRes.orgs.forEach((o: any) => {
            if (!list.some((existing) => existing.name.toLowerCase() === o.login?.toLowerCase())) {
              list.push({
                id: o.login,
                name: o.login,
                avatarUrl: o.avatarUrl,
              });
            }
          });
        }

        // Add any unique owners found in projects (e.g. Walancy, appmoove)
        allProjects.forEach((p) => {
          if (
            p.owner &&
            p.owner !== 'Local' &&
            !list.some((existing) => existing.name.toLowerCase() === p.owner?.toLowerCase())
          ) {
            list.push({
              id: p.owner,
              name: p.owner,
            });
          }
        });

        setOrganizations(list);
      } catch (err) {
        console.warn('[HeaderProjectSelector] Erro ao carregar organizações:', err);
      }
    };

    loadOrgs();
    return () => {
      isCancelled = true;
    };
  }, [allProjects]);

  // Current project name
  const currentProjectName = useMemo(() => {
    if (!workspacePath) return 'Selecionar Projeto';
    const match = allProjects.find(
      (p) =>
        (p.localDir && p.localDir.toLowerCase() === workspacePath.toLowerCase()) ||
        (p.name && workspacePath.toLowerCase().endsWith('/' + p.name.toLowerCase()))
    );
    if (match) return match.name;
    const folder = workspacePath.split('/').filter(Boolean).pop() || 'Projeto';
    if (folder.toLowerCase() === 'devflow-desktop') return 'Aura Dev';
    return folder;
  }, [workspacePath, allProjects]);

  const currentProject = useMemo(() => {
    if (!workspacePath) return null;
    const match = allProjects.find(
      (p) =>
        (p.localDir && p.localDir.toLowerCase() === workspacePath.toLowerCase()) ||
        (p.name && workspacePath.toLowerCase().endsWith('/' + p.name.toLowerCase()))
    );
    if (match) return match;
    const folder = workspacePath.split('/').filter(Boolean).pop() || 'Projeto';
    const isDevFlow = folder.toLowerCase() === 'devflow-desktop';
    return {
      id: 'active-workspace',
      name: isDevFlow ? 'Aura Dev' : folder,
      fullName: isDevFlow ? 'Walancy/aura-dev' : folder,
      owner: isDevFlow ? 'Walancy' : 'Local',
      localDir: workspacePath,
      isCloned: true,
    };
  }, [workspacePath, allProjects]);

  const currentProjectDescription = useMemo(() => {
    if (!currentProject) return undefined;
    const gh = githubRepos.find(
      (r) =>
        (r.full_name && currentProject.fullName && r.full_name.toLowerCase() === currentProject.fullName.toLowerCase()) ||
        (r.name && r.name.toLowerCase() === currentProject.name.toLowerCase())
    );
    return gh?.description || undefined;
  }, [currentProject, githubRepos]);

  useEffect(() => {
    if (currentProject) {
      const info: HeaderActiveProjectInfo = {
        name: currentProjectName,
        fullName: currentProject.fullName || currentProjectName,
        description: currentProjectDescription,
        owner: currentProject.owner,
        localDir: currentProject.localDir || workspacePath,
        htmlUrl: currentProject.htmlUrl,
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

  useEffect(() => {
    onProjectsListChange?.(allProjects);
  }, [allProjects, onProjectsListChange]);

  // Filtered project list by search query AND selected organization
  const filteredProjects = useMemo(() => {
    let list = allProjects;

    // Filter by Organization
    if (selectedOrg !== 'Todas') {
      const orgQ = selectedOrg.toLowerCase();
      list = list.filter(
        (p) =>
          p.owner?.toLowerCase() === orgQ ||
          p.fullName?.toLowerCase().startsWith(`${orgQ}/`)
      );
    }

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

    return list;
  }, [allProjects, searchQuery, selectedOrg]);

  // Handle project selection
  const handleSelect = async (project: HeaderProjectItem) => {
    if (project.isCloned && project.localDir) {
      setIsProjectOpen(false);
      await onSelectWorkspace(project.localDir, project.name);
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
          await onSelectWorkspace(finalPath, project.name);
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
            {selectedOrg === 'Todas' ? 'Organizações: Todas' : selectedOrg}
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
                org.name === 'Todas'
                  ? allProjects.length
                  : allProjects.filter(
                      (p) =>
                        p.owner?.toLowerCase() === org.name.toLowerCase() ||
                        p.fullName?.toLowerCase().startsWith(`${org.name.toLowerCase()}/`)
                    ).length;

              return (
                <div
                  key={org.id}
                  onClick={() => {
                    setSelectedOrg(org.name);
                    try {
                      localStorage.setItem('header_selected_org', org.name);
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
          <FolderGit2 size={13.5} color={accentColor} />
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
                maxHeight: 250,
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
                    : selectedOrg !== 'Todas'
                    ? `Nenhum projeto encontrado para "${selectedOrg}".`
                    : 'Nenhum projeto encontrado.'}
                </div>
              ) : (
                filteredProjects.map((project, idx) => {
                  const prevProject = idx > 0 ? filteredProjects[idx - 1] : null;
                  const isFirstCloned = project.isCloned && (!prevProject || !prevProject.isCloned);
                  const isFirstRemote = !project.isCloned && (!prevProject || prevProject.isCloned);
                  const isActive =
                    project.name.toLowerCase() === currentProjectName.toLowerCase() ||
                    (project.localDir &&
                      workspacePath &&
                      project.localDir.toLowerCase() === workspacePath.toLowerCase());

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
                          <FolderGit2
                            size={13}
                            color={isActive ? accentColor : themeTokens.textSecondary}
                            style={{ flexShrink: 0 }}
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
          </div>
        )}
      </div>
    </div>
  );
};
