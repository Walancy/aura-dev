import { execSync, exec } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

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

    // 2. Check immediate child folders (common in mono-repos or parent folders like /codes/Ainaobra)
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
            'gh issue list --json number,title,labels,milestone --limit 50',
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
      const res = await fetch(`https://api.github.com/repos/${repoFullName}/issues?state=open&per_page=100`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          return data.map((item: any) => ({
            number: item.number,
            title: item.title,
            author: item.user?.login || item.user?.name || 'walancy',
            updatedAt: item.updated_at,
            createdAt: item.created_at,
            labels: (item.labels || []).map((l: any) => ({
              id: l.id,
              name: l.name,
              color: l.color,
              description: l.description,
            })),
            milestone: item.milestone
              ? {
                  title: item.milestone.title,
                  dueOn: item.milestone.due_on,
                }
              : null,
            state: item.state,
            url: item.html_url,
          }));
        }
      }
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
}

export const gitService = new GitService();
