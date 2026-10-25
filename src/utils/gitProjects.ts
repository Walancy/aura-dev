import { logSystemActivity } from './brainService';

/**
 * Git Projects Discovery and Clone Utility
 * Unifies GitHub repositories with locally cloned repositories,
 * matching the behavior of HeaderProjectSelector and ProjectsSchedulerView.
 */

export interface GitProjectItem {
  id: string | number;
  name: string;
  fullName: string;
  htmlUrl?: string;
  cloneUrl?: string;
  isCloned: boolean;
  localDir?: string;
  owner?: string;
  branch?: string;
  description?: string;
  title?: string;
  devUrl?: string;
}

/**
 * Loads all Git projects from GitHub API and local filesystem scan.
 */
export async function fetchAllGitProjects(workspacePath?: string): Promise<GitProjectItem[]> {
  const list: GitProjectItem[] = [];
  const seenNames = new Set<string>();

  let localClonedRepos: Array<{ dir: string; name: string; repoFullName?: string; remoteUrl?: string }> = [];
  try {
    if (window.electronAPI?.git?.scanLocalProjects) {
      localClonedRepos = (await window.electronAPI.git.scanLocalProjects()) || [];
    } else if (window.electronAPI?.git?.listRepos && workspacePath) {
      localClonedRepos = (await window.electronAPI.git.listRepos(workspacePath)) || [];
    }
  } catch (err) {
    console.warn('[fetchAllGitProjects] Erro ao escanear projetos locais:', err);
  }

  let githubRepos: any[] = [];
  try {
    if (window.electronAPI?.github?.fetchRepos) {
      const res = await window.electronAPI.github.fetchRepos();
      if (res?.success && Array.isArray(res.repos)) {
        githubRepos = res.repos;
      }
    }
  } catch (err) {
    console.warn('[fetchAllGitProjects] Erro ao buscar repos do GitHub:', err);
  }

  // 1. Add GitHub repos with local clone matching
  githubRepos.forEach((ghRepo) => {
    seenNames.add(ghRepo.name.toLowerCase());
    seenNames.add(ghRepo.full_name?.toLowerCase() || '');

    const localMatch = localClonedRepos.find((l) => {
      if (l.repoFullName && l.repoFullName.toLowerCase() === ghRepo.full_name?.toLowerCase()) return true;
      if (l.name.toLowerCase() === ghRepo.name.toLowerCase()) return true;
      if (l.remoteUrl) {
        const parsedRepoName = l.remoteUrl.trim().replace(/\.git$/i, '').replace(/\/+$/, '').split(/[/:]/).filter(Boolean).pop() || '';
        if (parsedRepoName.toLowerCase() === ghRepo.name.toLowerCase()) return true;
      }
      return false;
    });

    const isCurrentWorkspace = Boolean(
      workspacePath && (
        workspacePath.toLowerCase().endsWith(`/${ghRepo.name.toLowerCase()}`) ||
        workspacePath.toLowerCase().endsWith(`/${ghRepo.name.toLowerCase()}/`) ||
        (localMatch && localMatch.dir.toLowerCase() === workspacePath.toLowerCase())
      )
    );

    const isCloned = Boolean(localMatch || isCurrentWorkspace);
    const localDir = isCurrentWorkspace ? workspacePath : localMatch?.dir;
    const owner = ghRepo.owner?.login || ghRepo.full_name?.split('/')[0] || '';
    const cloneUrl = ghRepo.clone_url || (ghRepo.html_url ? `${ghRepo.html_url}.git` : `https://github.com/${ghRepo.full_name}.git`);

    list.push({
      id: ghRepo.id,
      name: ghRepo.name,
      fullName: ghRepo.full_name || ghRepo.name,
      htmlUrl: ghRepo.html_url,
      cloneUrl,
      isCloned,
      localDir,
      owner,
      branch: ghRepo.default_branch || 'main',
      description: ghRepo.description || undefined,
    });
  });

  // 2. Add local repos not on GitHub list
  localClonedRepos.forEach((locRepo, idx) => {
    if (seenNames.has(locRepo.name.toLowerCase())) return;
    if (locRepo.repoFullName && seenNames.has(locRepo.repoFullName.toLowerCase())) return;

    const owner = locRepo.repoFullName?.split('/')[0] || 'Local';

    list.push({
      id: `local-${idx}`,
      name: locRepo.name,
      fullName: locRepo.repoFullName || locRepo.name,
      htmlUrl: locRepo.remoteUrl,
      cloneUrl: locRepo.remoteUrl,
      isCloned: true,
      localDir: locRepo.dir,
      owner,
      branch: 'main',
    });
  });

  // 3. Fallback: if current workspace is not yet in list, add it
  if (workspacePath && !list.some((p) => p.localDir && p.localDir.toLowerCase() === workspacePath.toLowerCase())) {
    const folderName = workspacePath.split(/[/\\]/).filter(Boolean).pop() || 'Workspace';
    const displayName = folderName.toLowerCase() === 'devflow-desktop' ? 'Aura Dev' : folderName;
    list.unshift({
      id: 'active-workspace',
      name: displayName,
      fullName: folderName.toLowerCase() === 'devflow-desktop' ? 'Walancy/aura-dev' : displayName,
      isCloned: true,
      localDir: workspacePath,
      owner: folderName.toLowerCase() === 'devflow-desktop' ? 'Walancy' : 'Local',
      branch: 'main',
    });
  }

  // 4. Fallback: check projects.getProjects store if available
  if (list.length === 0 && window.electronAPI?.projects?.getProjects) {
    try {
      const res = await window.electronAPI.projects.getProjects();
      if (res?.projects && Array.isArray(res.projects)) {
        res.projects.forEach((p: any, idx: number) => {
          const pPath = p.path || p.dir || '';
          const pName = p.name || p.title || 'Projeto';
          list.push({
            id: `store-${idx}`,
            name: pName,
            fullName: pName,
            isCloned: Boolean(pPath),
            localDir: pPath,
            branch: p.branch || 'main',
          });
        });
      }
    } catch {}
  }

  // 5. Deduplicate
  const seenKeys = new Set<string>();
  const dedupedList = list.filter((p) => {
    const key = p.localDir ? p.localDir.toLowerCase().replace(/\/+$/, '') : p.fullName.toLowerCase();
    if (seenKeys.has(key)) return false;
    seenKeys.add(key);
    return true;
  });

  // 6. Sort: Cloned projects first, then alphabetical
  dedupedList.sort((a, b) => {
    const aIsActive = Boolean(a.localDir && workspacePath && a.localDir.toLowerCase() === workspacePath.toLowerCase());
    const bIsActive = Boolean(b.localDir && workspacePath && b.localDir.toLowerCase() === workspacePath.toLowerCase());
    if (aIsActive && !bIsActive) return -1;
    if (!aIsActive && bIsActive) return 1;

    if (a.isCloned && !b.isCloned) return -1;
    if (!a.isCloned && b.isCloned) return 1;

    return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
  });

  return dedupedList;
}

/**
 * Clones a Git project into a target directory.
 */
export async function cloneGitRepository(
  project: { name: string; fullName?: string; htmlUrl?: string; cloneUrl?: string },
  preferredTargetDir?: string
): Promise<{ success: boolean; repoPath?: string; error?: string }> {
  const cloneUrl =
    project.cloneUrl ||
    (project.htmlUrl ? `${project.htmlUrl}.git` : `https://github.com/${project.fullName || project.name}.git`);
  if (!cloneUrl) {
    return { success: false, error: 'URL de clone indisponível para este repositório.' };
  }

  let targetDir = preferredTargetDir;
  if (!targetDir) {
    if (window.electronAPI?.dialog?.openFolder) {
      const folderRes = await window.electronAPI.dialog.openFolder();
      if (!folderRes) {
        return { success: false, error: 'Operação cancelada pelo usuário' };
      }
      targetDir = typeof folderRes === 'string' ? folderRes : (folderRes as any)?.path || (folderRes as any)?.folderPath;
    }
  }

  if (!targetDir) {
    return { success: false, error: 'Escolha a pasta onde o repositório será clonado.' };
  }

  if (!window.electronAPI?.git?.clone) {
    return { success: false, error: 'API do Git não disponível na aplicação Electron.' };
  }

  logSystemActivity('git', 'Iniciando clone de repositório', project.name, {
    fullName: project.fullName,
    cloneUrl,
    targetDir,
  });

  const res = await window.electronAPI.git.clone(cloneUrl, targetDir);

  if (res?.success) {
    logSystemActivity('git', 'Repositório clonado com sucesso', project.name, {
      repoPath: res.repoPath,
    });
  } else {
    logSystemActivity('git', 'Falha ao clonar repositório', project.name, {
      error: res?.error,
    });
  }

  return res;
}

/**
 * Shared Project Health Score calculation.
 * Ensures strict consistency between Project Cards, Scheduler Views and Executive Reports.
 * Weights:
 * - 40% Completion Rate (percentual de conclusão de tarefas)
 * - 35% Bug/Defect Stability Score (100 - bugRate * 2.2)
 * - 25% Balance Score (tarefas concluídas + em progresso balanceadas em relação ao total)
 * Bounded between 20% and 100%.
 */
export function computeProjectHealthScore(
  issues: any[] = [],
  doneCount?: number,
  inProgressCount?: number,
  totalCount?: number,
  percentValue?: number
): number {
  const total = totalCount != null && totalCount > 0 ? totalCount : issues.length;
  const done = doneCount != null && doneCount >= 0 ? doneCount : issues.filter((i) => i.status === 'Concluído').length;
  const inProgress = inProgressCount != null && inProgressCount >= 0 ? inProgressCount : issues.filter((i) => i.status === 'Em Progresso').length;
  const completionPercent = total > 0 ? (percentValue != null && percentValue >= 0 ? percentValue : Math.round((done / total) * 100)) : (percentValue || 0);

  let bugCount = 0;
  issues.forEach((i: any) => {
    const isBug =
      /bug|fix|corre|erro|falha/i.test(i.tag || '') ||
      (i.rawLabels && Array.isArray(i.rawLabels) && i.rawLabels.some((l: string) => /bug|fix/i.test(l)));
    if (isBug) bugCount++;
  });

  const bugRate = total > 0 ? Math.round((bugCount / total) * 100) : 0;
  const bugScore = Math.max(0, 100 - bugRate * 2.2);
  const balanceScore = total > 0 ? Math.min(100, Math.round(((done + inProgress * 0.7) / total) * 100)) : 100;
  const healthScore = Math.round(completionPercent * 0.4 + bugScore * 0.35 + balanceScore * 0.25);
  return Math.min(100, Math.max(20, healthScore || 85));
}
