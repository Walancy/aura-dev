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

      // 5. GitHub Issues & Sprint / Milestone info via `gh` CLI
      let issuesCount = 0;
      let sprintTitle = 'Sprint';
      let sprintRemaining = '7 days';

      try {
        const ghIssuesRaw = execSync(
          'gh issue list --json number,title,labels,milestone --limit 50',
          {
            cwd: gitDir,
            encoding: 'utf8',
            timeout: 8000,
          }
        );
        const issues = JSON.parse(ghIssuesRaw);
        if (Array.isArray(issues)) {
          issuesCount = issues.length;

          // Check milestones and sprint labels
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
              } else {
                sprintTitle = sprintLabel.name.toUpperCase();
              }
              break;
            }
          }
        }
      } catch (ghErr: any) {
        // If gh fails or repository has no issues, provide graceful defaults
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
}

export const gitService = new GitService();
