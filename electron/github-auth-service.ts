import { app, safeStorage } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';

const GITHUB_CLIENT_ID = 'Ov23lioVknR6j6hlDhDU';
const DEVICE_CODE_URL = 'https://github.com/login/device/code';
const ACCESS_TOKEN_URL = 'https://github.com/login/oauth/access_token';
const SCOPES = 'repo read:org read:project';

export interface GithubDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface GithubUser {
  login: string;
  name: string | null;
  avatarUrl: string;
  htmlUrl: string;
}

class GithubAuthService {
  private cachedToken: string | null = null;
  private pollTimer: NodeJS.Timeout | null = null;

  private get tokenFilePath(): string {
    return path.join(app.getPath('userData'), 'github-auth.enc');
  }

  private readToken(): string | null {
    if (this.cachedToken) return this.cachedToken;
    try {
      if (!fs.existsSync(this.tokenFilePath)) return null;
      if (!safeStorage.isEncryptionAvailable()) return null;
      const encrypted = fs.readFileSync(this.tokenFilePath);
      const token = safeStorage.decryptString(encrypted);
      this.cachedToken = token;
      return token;
    } catch {
      return null;
    }
  }

  private writeToken(token: string): void {
    this.cachedToken = token;
    try {
      const encrypted = safeStorage.encryptString(token);
      fs.writeFileSync(this.tokenFilePath, encrypted);
    } catch (err) {
      console.error('[GithubAuth] Failed to persist token:', err);
    }
  }

  public isAuthenticated(): boolean {
    return !!this.readToken();
  }

  public getToken(): string | null {
    return this.readToken();
  }

  public logout(): void {
    this.stopPolling();
    this.cachedToken = null;
    try {
      if (fs.existsSync(this.tokenFilePath)) fs.unlinkSync(this.tokenFilePath);
    } catch {}
  }

  public stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  public async requestDeviceCode(): Promise<GithubDeviceCodeResponse> {
    const res = await fetch(DEVICE_CODE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, scope: SCOPES }),
    });
    const data: any = await res.json();
    if (!res.ok || data.error) {
      throw new Error(data.error_description || data.error || `GitHub respondeu ${res.status}`);
    }
    return data as GithubDeviceCodeResponse;
  }

  public pollForToken(
    deviceCode: string,
    intervalSeconds: number,
    expiresInSeconds: number,
    onSuccess: (user: GithubUser) => void,
    onError: (error: string) => void,
  ): void {
    this.stopPolling();
    const deadline = Date.now() + expiresInSeconds * 1000;
    let currentIntervalMs = Math.max(intervalSeconds, 5) * 1000;

    const poll = async () => {
      if (Date.now() > deadline) {
        this.stopPolling();
        onError('expired');
        return;
      }
      try {
        const res = await fetch(ACCESS_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            device_code: deviceCode,
            grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
          }),
        });
        const data: any = await res.json();

        if (data.access_token) {
          this.stopPolling();
          this.writeToken(data.access_token);
          try {
            const user = await this.fetchUser(data.access_token);
            onSuccess(user);
          } catch (err: any) {
            onError(err?.message || 'Falha ao buscar dados do usuário');
          }
          return;
        }

        if (data.error === 'authorization_pending') {
          return;
        }

        if (data.error === 'slow_down') {
          currentIntervalMs += 5000;
          this.stopPolling();
          this.pollTimer = setInterval(poll, currentIntervalMs);
          return;
        }

        this.stopPolling();
        onError(data.error === 'access_denied' ? 'access_denied' : data.error_description || data.error || 'Falha na autenticação');
      } catch (err: any) {
        this.stopPolling();
        onError(err?.message || 'Erro de rede ao autenticar');
      }
    };

    this.pollTimer = setInterval(poll, currentIntervalMs);
    poll();
  }

  public async fetchUser(token?: string): Promise<GithubUser> {
    const t = token || this.readToken();
    if (!t) throw new Error('not authenticated');
    const res = await fetch('https://api.github.com/user', {
      headers: { Authorization: `Bearer ${t}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    const data: any = await res.json();
    return {
      login: data.login,
      name: data.name ?? null,
      avatarUrl: data.avatar_url,
      htmlUrl: data.html_url,
    };
  }

  public async fetchRepos(): Promise<any[]> {
    const token = this.readToken();
    if (!token) throw new Error('not authenticated');
    const res = await fetch(
      'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member',
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
    );
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }

  public async fetchProjects(): Promise<any[]> {
    const token = this.readToken();
    if (!token) throw new Error('not authenticated');
    const query = `
      query {
        viewer {
          projectsV2(first: 50) {
            nodes {
              id
              title
              url
              number
              closed
              updatedAt
              shortDescription
            }
          }
        }
      }
    `;
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`GitHub GraphQL respondeu ${res.status}`);
    const data: any = await res.json();
    if (data.errors) throw new Error(data.errors[0]?.message || 'Erro no GraphQL do GitHub');
    return data.data?.viewer?.projectsV2?.nodes || [];
  }

  public async fetchOrgs(): Promise<Array<{ login: string; avatarUrl: string }>> {
    const token = this.readToken();
    if (!token) throw new Error('not authenticated');
    const res = await fetch('https://api.github.com/user/orgs?per_page=100', {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    const data: any[] = await res.json();
    return data.map((o) => ({ login: o.login, avatarUrl: o.avatar_url }));
  }

  public async fetchRepoIssues(owner: string, repo: string): Promise<any[]> {
    const token = this.readToken();
    if (!token) throw new Error('not authenticated');
    const res = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100&sort=created&direction=desc`,
      { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } },
    );
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    const data: any[] = await res.json();
    // The issues endpoint also returns pull requests; keep only real issues.
    return data.filter((item) => !item.pull_request);
  }

  public async fetchRepoPulls(owner: string, repo: string): Promise<any[]> {
    const token = this.readToken();
    if (!token) throw new Error('not authenticated');
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=50`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }

  public async fetchRepoMilestones(owner: string, repo: string): Promise<any[]> {
    const token = this.readToken();
    if (!token) throw new Error('not authenticated');
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/milestones?state=all&per_page=100`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }

  public async fetchRepoReleases(owner: string, repo: string): Promise<any[]> {
    const token = this.readToken();
    if (!token) throw new Error('not authenticated');
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=30`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }

  private async ensureLabelExists(owner: string, repo: string, token: string, name: string, color: string): Promise<void> {
    const checkRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' },
    });
    if (checkRes.ok) return;
    await fetch(`https://api.github.com/repos/${owner}/${repo}/labels`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ name, color }),
    }).catch(() => {});
  }

  public async createIssue(
    owner: string,
    repo: string,
    input: { title: string; body?: string; labels?: Array<{ name: string; color: string }>; assignees?: string[] },
  ): Promise<any> {
    const token = this.readToken();
    if (!token) throw new Error('not authenticated');
    for (const label of input.labels || []) {
      await this.ensureLabelExists(owner, repo, token, label.name, label.color);
    }
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
      body: JSON.stringify({
        title: input.title,
        body: input.body || '',
        labels: (input.labels || []).map((l) => l.name),
        assignees: input.assignees || [],
      }),
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }

  public async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    input: { state?: 'open' | 'closed'; labels?: string[] },
  ): Promise<any> {
    const token = this.readToken();
    if (!token) throw new Error('not authenticated');
    const res = await fetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }
}

export const githubAuthService = new GithubAuthService();
