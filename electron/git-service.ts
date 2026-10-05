import { execSync, exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { githubAuthService } from './github-auth-service';

export interface WorkspaceGitInfo {
  isGit: boolean;
  branch: string;
  repoName: string;
  repoFullName: string;
  repoUrl: string;
  statusCount: number;
  authorBlame: string;
  issuesCount: number;
  sprintTitle: string;
  sprintRemaining: string;
  activeFileBlame?: string;
  error?: string;
}

export class GitService {
  private cache: Map<string, { data: WorkspaceGitInfo; timestamp: number }> = new Map();
  private readonly CACHE_TTL_MS = 15000; // 15 seconds cache to stay responsive
  private cachedGhToken: { token: string; timestamp: number } | null = null;

  /**
   * Retrieves GitHub personal access token or CLI auth token.
   */
  public getGitHubToken(): string | null {
    const loggedInToken = githubAuthService.getToken();
    if (loggedInToken) {
      return loggedInToken;
    }
    if (this.cachedGhToken && Date.now() - this.cachedGhToken.timestamp < 3600000) {
      return this.cachedGhToken.token;
    }
    const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (envToken) {
      this.cachedGhToken = { token: envToken, timestamp: Date.now() };
      return envToken;
    }
    try {
      const userHome = process.env.HOME || '';
      const customPaths = [
        path.join(userHome, '.local/bin'),
        '/opt/homebrew/bin',
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
      ];
      const envPath = `${customPaths.join(':')}:${process.env.PATH || ''}`;
      const token = execSync('gh auth token', {
        encoding: 'utf8',
        timeout: 3000,
        env: { ...process.env, PATH: envPath },
      }).trim();
      if (token && token.startsWith('gh')) {
        this.cachedGhToken = { token, timestamp: Date.now() };
        return token;
      }
    } catch {}
    return null;
  }

  /**
   * Resolves the actual git root directory from a given path.
   * Checks the directory itself, immediate subdirectories (e.g. workspace with sub-repos), or parents.
   */
  public resolveGitDir(targetPath: string): string | null {
    if (!targetPath || !fs.existsSync(targetPath)) return null;

    // 1. Direct check
    if (fs.existsSync(path.join(targetPath, '.git'))) {
      return targetPath;
    }

    // 2. Check immediate child folders (common in mono-repos or parent folders like /codes/aura-dev)
    try {
      const entries = fs.readdirSync(targetPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== '.git' && entry.name !== 'node_modules') {
          const subPath = path.join(targetPath, entry.name);
          if (fs.existsSync(path.join(subPath, '.git'))) {
            return subPath;
          }
        }
      }
    } catch {}

    // 3. Check parents up to 4 levels
    let current = targetPath;
    for (let i = 0; i < 4; i++) {
      const parent = path.dirname(current);
      if (!parent || parent === current) break;
      if (fs.existsSync(path.join(parent, '.git'))) {
        return parent;
      }
      current = parent;
    }

    return null;
  }

  /**
   * Lists every Git repository directly relevant to a workspace: the workspace
   * itself (if it is a repo) plus any immediate child folders that are repos
   * (common for a parent folder holding several sibling repos). Falls back to
   * climbing up to the nearest parent repo when nothing is found below.
   */
  public listWorkspaceRepos(workspacePath: string): Array<{ dir: string; name: string }> {
    if (!workspacePath || !fs.existsSync(workspacePath)) return [];

    const repos: Array<{ dir: string; name: string }> = [];

    if (fs.existsSync(path.join(workspacePath, '.git'))) {
      repos.push({ dir: workspacePath, name: path.basename(workspacePath) });
    }

    try {
      const entries = fs.readdirSync(workspacePath, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === '.git' || entry.name === 'node_modules') continue;
        const subPath = path.join(workspacePath, entry.name);
        if (fs.existsSync(path.join(subPath, '.git'))) {
          repos.push({ dir: subPath, name: entry.name });
        }
      }
    } catch {}

    if (repos.length === 0) {
      const resolved = this.resolveGitDir(workspacePath);
      if (resolved) {
        repos.push({ dir: resolved, name: path.basename(resolved) });
      }
    }

    return repos;
  }

  /**
   * Scans a base folder (or common code directories) up to depth 2,
   * discovering all local git repositories and resolving their remote URLs.
   */
  private cachedLocalProjects: {
    data: Array<{ dir: string; name: string; repoFullName?: string; remoteUrl?: string }>;
    timestamp: number;
    baseDir?: string;
  } | null = null;

  /**
   * Scans a base folder (or common code directories) up to depth 2,
   * discovering all local git repositories and resolving their remote URLs.
   */
  public scanLocalProjects(baseDir?: string): Array<{
    dir: string;
    name: string;
    repoFullName?: string;
    remoteUrl?: string;
  }> {
    // Retorna cache de 45 segundos para resposta instantânea
    if (
      this.cachedLocalProjects &&
      this.cachedLocalProjects.baseDir === baseDir &&
      Date.now() - this.cachedLocalProjects.timestamp < 45000
    ) {
      return this.cachedLocalProjects.data;
    }

    const candidates: string[] = [];
    if (baseDir && fs.existsSync(baseDir)) {
      candidates.push(baseDir);
    }
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    if (homeDir) {
      const docsCodes = path.join(homeDir, 'Documents', 'codes');
      if (fs.existsSync(docsCodes) && !candidates.includes(docsCodes)) {
        candidates.push(docsCodes);
      }
      const devDir = path.join(homeDir, 'Development');
      if (fs.existsSync(devDir) && !candidates.includes(devDir)) {
        candidates.push(devDir);
      }
    }

    const discovered: Array<{
      dir: string;
      name: string;
      repoFullName?: string;
      remoteUrl?: string;
    }> = [];
    const visitedDirs = new Set<string>();

    const checkDir = (dirPath: string) => {
      if (visitedDirs.has(dirPath)) return;
      visitedDirs.add(dirPath);

      const gitPath = path.join(dirPath, '.git');
      if (fs.existsSync(gitPath)) {
        let remoteUrl = '';
        let repoFullName = '';
        const folderName = path.basename(dirPath).toLowerCase();
        try {
          // Otimização de performance: lê .git/config diretamente sem spawn de processo
          const gitConfigPath = path.join(gitPath, 'config');
          if (fs.existsSync(gitConfigPath)) {
            const configText = fs.readFileSync(gitConfigPath, 'utf8');
            const remoteRegex = /\[remote\s+"([^"]+)"\][^\[]*?url\s*=\s*(.+)/g;
            const remotes: Array<{ name: string; url: string; repoFullName?: string }> = [];
            let rMatch: RegExpExecArray | null;
            while ((rMatch = remoteRegex.exec(configText)) !== null) {
              const rName = rMatch[1];
              const rUrl = rMatch[2].trim();
              const m = rUrl.match(/[:/]([^/:]+\/[^/:]+?)(?:\.git)?$/);
              remotes.push({ name: rName, url: rUrl, repoFullName: m ? m[1] : undefined });
            }

            // 1. Se algum remote possui o mesmo nome de repositório que a pasta local, prioriza ele
            const exactFolderMatch = remotes.find((r) => {
              if (r.repoFullName) {
                const repoOnly = r.repoFullName.split('/').pop()?.toLowerCase();
                if (repoOnly === folderName) return true;
              }
              return r.name.toLowerCase() === folderName;
            });

            if (exactFolderMatch) {
              remoteUrl = exactFolderMatch.url;
              repoFullName = exactFolderMatch.repoFullName || '';
            } else {
              // 2. Se não houver match direto com o nome da pasta, usa origin
              const originRemote = remotes.find((r) => r.name === 'origin');
              if (originRemote) {
                remoteUrl = originRemote.url;
                repoFullName = originRemote.repoFullName || '';
              } else if (remotes.length > 0) {
                // 3. Fallback para o primeiro remote encontrado
                remoteUrl = remotes[0].url;
                repoFullName = remotes[0].repoFullName || '';
              }
            }
          }

          // Fallback seguro caso não tenha conseguido extrair do arquivo
          if (!remoteUrl) {
            remoteUrl = execSync('git config --get remote.origin.url', {
              cwd: dirPath,
              encoding: 'utf8',
              timeout: 1000,
            }).trim();
          }

          if (remoteUrl && !repoFullName) {
            const match = remoteUrl.match(/[:/]([^/:]+\/[^/:]+?)(?:\.git)?$/);
            if (match) repoFullName = match[1];
          }
        } catch {}

        discovered.push({
          dir: dirPath,
          name: path.basename(dirPath),
          repoFullName: repoFullName || undefined,
          remoteUrl: remoteUrl || undefined,
        });
      }
    };

    for (const root of candidates) {
      checkDir(root);
      try {
        const firstLevel = fs.readdirSync(root, { withFileTypes: true });
        for (const f1 of firstLevel) {
          if (!f1.isDirectory() || f1.name.startsWith('.') || f1.name === 'node_modules') continue;
          const p1 = path.join(root, f1.name);
          checkDir(p1);

          try {
            const secondLevel = fs.readdirSync(p1, { withFileTypes: true });
            for (const f2 of secondLevel) {
              if (!f2.isDirectory() || f2.name.startsWith('.') || f2.name === 'node_modules') continue;
              const p2 = path.join(p1, f2.name);
              checkDir(p2);
            }
          } catch {}
        }
      } catch {}
    }

    this.cachedLocalProjects = {
      data: discovered,
      timestamp: Date.now(),
      baseDir,
    };

    return discovered;
  }

  /**
   * Fetches Git & GitHub information for a workspace and active file.
   */
  public async getWorkspaceGitInfo(
    workspacePath: string,
    activeFilePath?: string,
    forceRefresh = false
  ): Promise<WorkspaceGitInfo> {
    const gitDir = this.resolveGitDir(workspacePath);
    if (!gitDir) {
      return {
        isGit: false,
        branch: 'main',
        repoName: path.basename(workspacePath || 'workspace'),
        repoFullName: path.basename(workspacePath || 'workspace'),
        repoUrl: '',
        statusCount: 0,
        authorBlame: 'Walancy (just now)',
        issuesCount: 0,
        sprintTitle: 'Sprint 1',
        sprintRemaining: '7 days',
      };
    }

    const cacheKey = `${gitDir}:${activeFilePath || ''}`;
    const cached = this.cache.get(cacheKey);
    const now = Date.now();
    if (!forceRefresh && cached && now - cached.timestamp < this.CACHE_TTL_MS) {
      return cached.data;
    }

    try {
      // 1. Git Branch
      let branch = 'main';
      try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: gitDir,
          encoding: 'utf8',
          timeout: 3000,
        }).trim();
      } catch {}

      // 2. Remote URL & Repo Name
      let remoteUrl = '';
      try {
        remoteUrl = execSync('git config --get remote.origin.url', {
          cwd: gitDir,
          encoding: 'utf8',
          timeout: 3000,
        }).trim();
      } catch {}

      let repoName = path.basename(gitDir);
      let repoFullName = repoName;
      let webRepoUrl = '';
      if (remoteUrl) {
        const match = remoteUrl.match(/[:/]([^/:]+\/[^/:]+?)(?:\.git)?$/);
        if (match) {
          repoFullName = match[1];
          repoName = match[1].split('/')[1] || match[1];
          webRepoUrl = `https://github.com/${match[1]}`;
        }
      }

      // 3. Status count (modified / untracked files)
      let statusCount = 0;
      try {
        const st = execSync('git status --porcelain', {
          cwd: gitDir,
          encoding: 'utf8',
          timeout: 3000,
        }).trim();
        statusCount = st ? st.split('\n').filter(Boolean).length : 0;
      } catch {}

      // 4. Git Author Blame
      let authorBlame = '';
      if (activeFilePath && fs.existsSync(activeFilePath)) {
        try {
          authorBlame = execSync(`git log -1 --format="%an (%cr)" -- "${activeFilePath}"`, {
            cwd: gitDir,
            encoding: 'utf8',
            timeout: 3000,
          }).trim();
        } catch {}
      }
      if (!authorBlame) {
        try {
          authorBlame = execSync('git log -1 --format="%an (%cr)"', {
            cwd: gitDir,
            encoding: 'utf8',
            timeout: 3000,
          }).trim();
        } catch {
          authorBlame = 'Walancy (recently)';
        }
      }

      // 5. GitHub Issues & Sprint / Milestone info directly via Official GitHub API
      let issuesCount = 0;
      let sprintTitle = 'Sprint';
      let sprintRemaining = '7 days';

      if (repoFullName && repoFullName.includes('/')) {
        const token = this.getGitHubToken();
        const headers: Record<string, string> = {
          'User-Agent': 'DevFlow-Desktop',
          'Accept': 'application/vnd.github.v3+json',
        };
        if (token) {
          headers['Authorization'] = `Bearer ${token}`;
        }

        try {
          const [repoRes, issuesRes, milestonesRes] = await Promise.all([
            fetch(`https://api.github.com/repos/${repoFullName}`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
            fetch(`https://api.github.com/repos/${repoFullName}/issues?state=open&per_page=50`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
            fetch(`https://api.github.com/repos/${repoFullName}/milestones?state=open`, { headers }).then((r) => (r.ok ? r.json() : null)).catch(() => null),
          ]);

          if (repoRes && typeof repoRes.open_issues_count === 'number') {
            issuesCount = repoRes.open_issues_count;
          } else if (Array.isArray(issuesRes)) {
            issuesCount = issuesRes.length;
          }

          // 1. Check open milestones
          if (Array.isArray(milestonesRes) && milestonesRes.length > 0) {
            const m = milestonesRes[0];
            sprintTitle = m.title;
            if (m.due_on) {
              const diffDays = Math.ceil((new Date(m.due_on).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
              sprintRemaining = diffDays > 1 ? `${diffDays} days` : diffDays === 1 ? '1 day' : diffDays === 0 ? 'hoje' : 'ended';
            }
          }

          // 2. Check sprint labels from issues
          if (Array.isArray(issuesRes)) {
            for (const issue of issuesRes) {
              const sprintLabel = (issue.labels || []).find((l: any) =>
                l.name && l.name.toLowerCase().includes('sprint')
              );
              if (sprintLabel) {
                if (sprintLabel.description && sprintLabel.description.toLowerCase().includes('sprint')) {
                  sprintTitle = sprintLabel.description.split('(')[0].trim();
                  const dateMatch = sprintLabel.description.match(/(?:a|até|-)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
                  if (dateMatch && (!sprintRemaining || sprintRemaining === '7 days')) {
                    const [_, d, m, y] = dateMatch;
                    const endDate = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59);
                    const diffDays = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    if (diffDays > 1) sprintRemaining = `${diffDays} days`;
                    else if (diffDays === 1) sprintRemaining = '1 day';
                    else if (diffDays === 0) sprintRemaining = 'hoje';
                    else sprintRemaining = `${Math.abs(diffDays)}d atras`;
                  }
                } else {
                  sprintTitle = sprintLabel.name.toUpperCase();
                }
                break;
              }
            }
          }
        } catch (apiErr) {
          console.warn('[GitService] GitHub API call error, falling back to gh CLI:', apiErr);
        }
      }

      // Graceful fallback to `gh` CLI if API didn't return count or is offline
      if (issuesCount === 0 && (!sprintTitle || sprintTitle === 'Sprint')) {
        try {
          const ghIssuesRaw = execSync(
            'gh issue list --state all --json number,title,labels,milestone --limit 100',
            {
              cwd: gitDir,
              encoding: 'utf8',
              timeout: 5000,
            }
          );
          const issues = JSON.parse(ghIssuesRaw);
          if (Array.isArray(issues)) {
            issuesCount = issues.length;
            for (const issue of issues) {
              if (issue.milestone && issue.milestone.title) {
                sprintTitle = issue.milestone.title;
                if (issue.milestone.dueOn) {
                  const diffDays = Math.ceil(
                    (new Date(issue.milestone.dueOn).getTime() - Date.now()) /
                      (1000 * 60 * 60 * 24)
                  );
                  sprintRemaining = diffDays > 0 ? `${diffDays} days` : 'ended';
                }
                break;
              }

              const sprintLabel = (issue.labels || []).find((l: any) =>
                l.name && l.name.toLowerCase().includes('sprint')
              );
              if (sprintLabel) {
                if (sprintLabel.description && sprintLabel.description.toLowerCase().includes('sprint')) {
                  sprintTitle = sprintLabel.description.split('(')[0].trim();
                  const dateMatch = sprintLabel.description.match(/(?:a|até|-)\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
                  if (dateMatch) {
                    const [_, d, m, y] = dateMatch;
                    const endDate = new Date(Number(y), Number(m) - 1, Number(d), 23, 59, 59);
                    const diffDays = Math.ceil((endDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    sprintRemaining = diffDays > 0 ? `${diffDays} days` : `${Math.abs(diffDays)}d atras`;
                  }
                } else {
                  sprintTitle = sprintLabel.name.toUpperCase();
                }
                break;
              }
            }
          }
        } catch {}
      }

      const result: WorkspaceGitInfo = {
        isGit: true,
        branch: branch || 'main',
        repoName,
        repoFullName,
        repoUrl: webRepoUrl,
        statusCount,
        authorBlame,
        issuesCount,
        sprintTitle: sprintTitle || 'Sprint',
        sprintRemaining: sprintRemaining || '7 days',
      };

      this.cache.set(cacheKey, { data: result, timestamp: now });
      return result;
    } catch (err: any) {
      return {
        isGit: false,
        branch: 'main',
        repoName: path.basename(workspacePath || 'workspace'),
        repoFullName: path.basename(workspacePath || 'workspace'),
        repoUrl: '',
        statusCount: 0,
        authorBlame: 'Walancy (just now)',
        issuesCount: 0,
        sprintTitle: 'Sprint 1',
        sprintRemaining: '7 days',
        error: err.message,
      };
    }
  }

  /**
   * Fetches full issue list directly via GitHub REST API.
   */
  public async fetchGitHubIssues(repoFullName: string): Promise<any[]> {
    if (!repoFullName || !repoFullName.includes('/')) return [];
    const token = this.getGitHubToken();
    const headers: Record<string, string> = {
      'User-Agent': 'DevFlow-Desktop',
      'Accept': 'application/vnd.github.v3+json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const allIssues: any[] = [];
      for (let page = 1; page <= 3; page++) {
        const res = await fetch(
          `https://api.github.com/repos/${repoFullName}/issues?state=all&per_page=100&page=${page}&sort=updated&direction=desc`,
          { headers }
        );
        if (!res.ok) break;
        const data = await res.json();
        if (!Array.isArray(data) || data.length === 0) break;

        const mapped = data
          .filter((item: any) => !item.pull_request)
          .map((item: any) => ({
            number: item.number,
            title: item.title,
            author: item.user?.login || item.user?.name || 'walancy',
            authorAvatar: item.user?.avatar_url,
            assignees: (item.assignees || []).map((a: any) => ({ login: a.login, avatarUrl: a.avatar_url })),
            assignee: item.assignee ? { login: item.assignee.login, avatarUrl: item.assignee.avatar_url } : null,
            body: item.body || '',
            updatedAt: item.updated_at,
            createdAt: item.created_at,
            closedAt: item.closed_at,
            closed_at: item.closed_at,
            labels: (item.labels || []).map((l: any) => ({
              id: l.id,
              name: l.name,
              color: l.color,
              description: l.description,
            })),
            milestone: item.milestone
              ? {
                  number: item.milestone.number,
                  title: item.milestone.title,
                  dueOn: item.milestone.due_on,
                  state: item.milestone.state,
                }
              : null,
            state: item.state,
            url: item.html_url,
          }));

        allIssues.push(...mapped);
        if (data.length < 100) break;
      }
      return allIssues;
    } catch (err) {
      console.warn('[GitService] GitHub API issues fetch error:', err);
    }
    return [];
  }

  /**
   * Creates a new issue directly via GitHub REST API.
   */
  public async createGitHubIssue(
    repoFullName: string,
    title: string,
    body?: string
  ): Promise<{ success: boolean; issue?: any; error?: string }> {
    if (!repoFullName || !repoFullName.includes('/')) {
      return { success: false, error: 'Repositório remoto GitHub não encontrado' };
    }
    const token = this.getGitHubToken();
    const headers: Record<string, string> = {
      'User-Agent': 'DevFlow-Desktop',
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    try {
      const res = await fetch(`https://api.github.com/repos/${repoFullName}/issues`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          title,
          body: body || 'Criada via DevFlow IDE',
        }),
      });
      if (res.ok) {
        const issue = await res.json();
        return { success: true, issue };
      } else {
        const errData = await res.json().catch(() => ({}));
        return { success: false, error: errData.message || `HTTP ${res.status}` };
      }
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  }

  public async cloneRepo(
    repoUrl: string,
    targetParentDir: string
  ): Promise<{ success: boolean; repoPath?: string; error?: string }> {
    if (!repoUrl) {
      return { success: false, error: 'URL do repositório é obrigatória' };
    }
    if (!targetParentDir || !fs.existsSync(targetParentDir)) {
      return { success: false, error: 'Diretório de destino inválido ou inexistente' };
    }

    const cleanUrl = repoUrl.trim();
    const parts = cleanUrl.split('/');
    let folderName = parts[parts.length - 1] || 'repository';
    if (folderName.endsWith('.git')) {
      folderName = folderName.slice(0, -4);
    }
    const repoPath = path.join(targetParentDir, folderName);

    if (fs.existsSync(repoPath)) {
      return { success: true, repoPath, error: 'Repositório já existe na pasta de destino' };
    }

    return new Promise((resolve) => {
      exec(
        `git clone "${cleanUrl}"`,
        {
          cwd: targetParentDir,
          timeout: 180000,
          env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
        },
        (error, _stdout, stderr) => {
          if (error) {
            resolve({ success: false, error: stderr || error.message });
          } else {
            resolve({ success: true, repoPath });
          }
        }
      );
    });
  }

  public getRecentCommitsSummary(
    options:
      | {
          days?: number;
          since?: string;
          until?: string;
          targetDates?: string[];
          repoPath?: string;
          author?: string;
        }
      | number = 4
  ): Array<{
    projectName: string;
    repoPath: string;
    commits: Array<{
      hash: string;
      message: string;
      body?: string;
      author: string;
      date: string;
      relativeDate: string;
      isToday: boolean;
      isYesterday: boolean;
      isFriday?: boolean;
    }>;
  }> {
    const opts = typeof options === 'number' ? { days: options } : options || {};
    const days = opts.days || 4;

    let targetProjects: Array<{ name: string; dir: string }> = [];

    if (opts.repoPath && fs.existsSync(opts.repoPath)) {
      if (fs.existsSync(path.join(opts.repoPath, '.git'))) {
        targetProjects.push({ name: path.basename(opts.repoPath), dir: opts.repoPath });
      }
      // Check immediate subdirectories for git repos (e.g. monorepo or project folder)
      try {
        const subEntries = fs.readdirSync(opts.repoPath, { withFileTypes: true });
        for (const se of subEntries) {
          if (se.isDirectory() && se.name !== 'node_modules' && !se.name.startsWith('.')) {
            const subDir = path.join(opts.repoPath, se.name);
            if (fs.existsSync(path.join(subDir, '.git'))) {
              targetProjects.push({ name: se.name, dir: subDir });
            }
          }
        }
      } catch {}
    }

    if (targetProjects.length === 0) {
      targetProjects = this.scanLocalProjects();
    }

    const result: Array<{
      projectName: string;
      repoPath: string;
      commits: Array<{
        hash: string;
        message: string;
        body?: string;
        author: string;
        date: string;
        relativeDate: string;
        isToday: boolean;
        isYesterday: boolean;
        isFriday?: boolean;
      }>;
    }> = [];

    const now = new Date();
    const todayStr = now.toISOString().slice(0, 10);
    const yesterdayDate = new Date(now);
    yesterdayDate.setDate(now.getDate() - 1);
    const yesterdayStr = yesterdayDate.toISOString().slice(0, 10);

    // Compute Friday date
    const fridayDate = new Date(now);
    const currentDay = now.getDay();
    const diffToFriday = currentDay === 1 ? 3 : (currentDay + 2) % 7;
    fridayDate.setDate(now.getDate() - diffToFriday);
    const fridayStr = fridayDate.toISOString().slice(0, 10);

    const targetDatesSet = opts.targetDates && opts.targetDates.length > 0 ? new Set(opts.targetDates) : null;

    for (const proj of targetProjects) {
      if (!proj.dir || !fs.existsSync(proj.dir)) continue;
      try {
        let filterArgs = '';
        if (opts.since && opts.until) {
          filterArgs = `--since="${opts.since}" --until="${opts.until}"`;
        } else if (opts.since) {
          filterArgs = `--since="${opts.since}"`;
        } else if (opts.targetDates && opts.targetDates.length > 0) {
          const sortedDates = [...opts.targetDates].sort();
          filterArgs = `--since="${sortedDates[0]} 00:00:00" --until="${sortedDates[sortedDates.length - 1]} 23:59:59"`;
        } else {
          filterArgs = `--since="${days} days ago"`;
        }

        const cmd = `git log --all ${filterArgs} --format="COMMIT_START%x1f%h%x1f%s%x1f%b%x1f%an%x1f%ai%x1f%crCOMMIT_END" -n 40`;
        const output = execSync(cmd, { cwd: proj.dir, encoding: 'utf8', timeout: 3000 }).trim();
        if (!output) continue;

        const chunks = output.split('COMMIT_END').filter((c) => c.includes('COMMIT_START'));
        const commits = chunks
          .map((chunk) => {
            const clean = chunk.replace(/[\s\S]*COMMIT_START\x1f/, '');
            const [hash, message, body, author, date, relativeDate] = clean.split('\x1f');
            const commitIso = (date || '').slice(0, 10);
            return {
              hash: (hash || '').trim(),
              message: (message || '').trim(),
              body: (body || '').trim() || undefined,
              author: (author || '').trim(),
              date: (date || '').trim(),
              relativeDate: (relativeDate || '').trim(),
              isToday: commitIso === todayStr,
              isYesterday: commitIso === yesterdayStr,
              isFriday: commitIso === fridayStr,
            };
          })
          .filter((c) => {
            if (!c.hash || !c.message) return false;
            if (targetDatesSet) {
              const cIso = c.date.slice(0, 10);
              return targetDatesSet.has(cIso);
            }
            return true;
          });

        if (commits.length > 0) {
          result.push({
            projectName: proj.name,
            repoPath: proj.dir,
            commits,
          });
        }
      } catch {}
    }

    return result;
  }

  public listWorktrees(repoPath: string): Array<{ path: string; branch: string; isMain: boolean }> {
    try {
      const gitDir = this.resolveGitDir(repoPath);
      if (!gitDir) return [];
      const output = execSync('git worktree list --porcelain', { cwd: gitDir, encoding: 'utf8' });
      const entries: Array<{ path: string; branch: string; isMain: boolean }> = [];
      let current: { path?: string; branch?: string } = {};
      for (const line of output.split('\n')) {
        if (line.startsWith('worktree ')) {
          if (current.path) entries.push({ path: current.path, branch: current.branch || '', isMain: entries.length === 0 });
          current = { path: line.slice('worktree '.length) };
        } else if (line.startsWith('branch ')) {
          current.branch = line.slice('branch '.length).replace('refs/heads/', '');
        }
      }
      if (current.path) entries.push({ path: current.path, branch: current.branch || '', isMain: entries.length === 0 });
      return entries;
    } catch {
      return [];
    }
  }

  public async createWorktree(
    repoPath: string,
    branchName: string,
    targetDir: string
  ): Promise<{ success: boolean; worktreePath?: string; error?: string }> {
    const gitDir = this.resolveGitDir(repoPath);
    if (!gitDir) return { success: false, error: 'Não é um repositório git' };
    if (fs.existsSync(targetDir)) {
      return { success: false, error: 'O diretório de destino já existe' };
    }
    const safeBranch = branchName.trim().replace(/[^a-zA-Z0-9._/-]/g, '-');
    if (!safeBranch) return { success: false, error: 'Nome de branch inválido' };

    return new Promise((resolve) => {
      exec(`git worktree add "${targetDir}" -b "${safeBranch}"`, { cwd: gitDir, timeout: 60000 }, (error, _stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: stderr || error.message });
        } else {
          resolve({ success: true, worktreePath: targetDir });
        }
      });
    });
  }

  public async removeWorktree(repoPath: string, worktreePath: string): Promise<{ success: boolean; error?: string }> {
    const gitDir = this.resolveGitDir(repoPath);
    if (!gitDir) return { success: false, error: 'Não é um repositório git' };
    return new Promise((resolve) => {
      exec(`git worktree remove "${worktreePath}" --force`, { cwd: gitDir, timeout: 30000 }, (error, _stdout, stderr) => {
        if (error) {
          resolve({ success: false, error: stderr || error.message });
        } else {
          resolve({ success: true });
        }
      });
    });
  }

  public async landWorktree(
    repoPath: string,
    branchName: string,
    baseBranch: string
  ): Promise<{ success: boolean; error?: string }> {
    const gitDir = this.resolveGitDir(repoPath);
    if (!gitDir) return { success: false, error: 'Não é um repositório git' };
    const safeBranch = branchName.trim().replace(/[^a-zA-Z0-9._/-]/g, '-');
    const safeBase = baseBranch.trim().replace(/[^a-zA-Z0-9._/-]/g, '-');
    return new Promise((resolve) => {
      exec(
        `git checkout "${safeBase}" && git merge --no-edit "${safeBranch}"`,
        { cwd: gitDir, timeout: 60000 },
        (error, _stdout, stderr) => {
          if (error) {
            resolve({ success: false, error: stderr || error.message });
          } else {
            resolve({ success: true });
          }
        }
      );
    });
  }
}

export const gitService = new GitService();
