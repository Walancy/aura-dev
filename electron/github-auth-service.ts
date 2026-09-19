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

interface StoredTokenData {
  accessToken: string;
  refreshToken?: string;
  accessTokenExpiresAt?: number;
  refreshTokenExpiresAt?: number;
}

class GithubAuthService {
  private cachedTokenData: StoredTokenData | null = null;
  private pollTimer: NodeJS.Timeout | null = null;

  private get tokenFilePath(): string {
    return path.join(app.getPath('userData'), 'github-auth.enc');
  }

  private readTokenData(): StoredTokenData | null {
    if (this.cachedTokenData) return this.cachedTokenData;
    try {
      if (!fs.existsSync(this.tokenFilePath)) return null;
      if (!safeStorage.isEncryptionAvailable()) return null;
      const encrypted = fs.readFileSync(this.tokenFilePath);
      const decrypted = safeStorage.decryptString(encrypted);
      let data: StoredTokenData;
      try {
        const parsed = JSON.parse(decrypted);
        data = parsed && parsed.accessToken ? parsed : { accessToken: decrypted };
      } catch {
        // Backward compatibility: older versions stored the raw access token string.
        data = { accessToken: decrypted };
      }
      this.cachedTokenData = data;
      return data;
    } catch {
      return null;
    }
  }

  private writeTokenData(data: StoredTokenData): void {
    this.cachedTokenData = data;
    try {
      const encrypted = safeStorage.encryptString(JSON.stringify(data));
      fs.writeFileSync(this.tokenFilePath, encrypted);
    } catch (err) {
      console.error('[GithubAuth] Failed to persist token:', err);
    }
  }

  public isAuthenticated(): boolean {
    return !!this.readTokenData()?.accessToken;
  }

  /** Best-effort synchronous accessor for other services (e.g. git-service.ts). May be stale if expired. */
  public getToken(): string | null {
    return this.readTokenData()?.accessToken || null;
  }

  public logout(): void {
    this.stopPolling();
    this.cachedTokenData = null;
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

  private storeAccessTokenResponse(data: any, fallbackRefreshToken?: string): StoredTokenData {
    const now = Date.now();
    const tokenData: StoredTokenData = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || fallbackRefreshToken,
      accessTokenExpiresAt: data.expires_in ? now + data.expires_in * 1000 : undefined,
      refreshTokenExpiresAt: data.refresh_token_expires_in ? now + data.refresh_token_expires_in * 1000 : undefined,
    };
    this.writeTokenData(tokenData);
    return tokenData;
  }

  private async refreshAccessToken(refreshToken: string): Promise<StoredTokenData | null> {
    try {
      const res = await fetch(ACCESS_TOKEN_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          client_id: GITHUB_CLIENT_ID,
          grant_type: 'refresh_token',
          refresh_token: refreshToken,
        }),
      });
      const data: any = await res.json();
      if (!res.ok || data.error || !data.access_token) {
        console.error('[GithubAuth] refresh failed:', data.error || res.status);
        return null;
      }
      return this.storeAccessTokenResponse(data, refreshToken);
    } catch (err) {
      console.error('[GithubAuth] refresh error:', err);
      return null;
    }
  }

  /** Resolves a usable access token, proactively refreshing it if it looks expired. */
  private async getValidAccessToken(): Promise<string> {
    const data = this.readTokenData();
    if (!data?.accessToken) throw new Error('not authenticated');
    const SAFETY_MARGIN_MS = 60_000;
    const looksExpired = data.accessTokenExpiresAt != null && data.accessTokenExpiresAt - SAFETY_MARGIN_MS < Date.now();
    if (!looksExpired) return data.accessToken;
    if (data.refreshToken) {
      const refreshed = await this.refreshAccessToken(data.refreshToken);
      if (refreshed) return refreshed.accessToken;
    }
    this.logout();
    throw new Error('reauth_required');
  }

  /** Authenticated fetch wrapper: proactively refreshes near-expired tokens and retries once on a 401. */
  private async authedFetch(url: string, init: RequestInit = {}): Promise<Response> {
    const token = await this.getValidAccessToken();
    const withAuth = (t: string): RequestInit => ({
      ...init,
      headers: { ...(init.headers as Record<string, string> | undefined), Authorization: `Bearer ${t}` },
    });

    let res = await fetch(url, withAuth(token));
    if (res.status === 401) {
      const data = this.readTokenData();
      if (data?.refreshToken) {
        const refreshed = await this.refreshAccessToken(data.refreshToken);
        if (refreshed) {
          res = await fetch(url, withAuth(refreshed.accessToken));
        } else {
          this.logout();
        }
      } else {
        this.logout();
      }
    }
    return res;
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
          this.storeAccessTokenResponse(data);
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
    const res = token
      ? await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } })
      : await this.authedFetch('https://api.github.com/user', { headers: { Accept: 'application/vnd.github+json' } });
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
    const res = await this.authedFetch(
      'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member',
      { headers: { Accept: 'application/vnd.github+json' } },
    );
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }

  public async fetchProjects(): Promise<any[]> {
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
    const res = await this.authedFetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query }),
    });
    if (!res.ok) throw new Error(`GitHub GraphQL respondeu ${res.status}`);
    const data: any = await res.json();
    if (data.errors) throw new Error(data.errors[0]?.message || 'Erro no GraphQL do GitHub');
    return data.data?.viewer?.projectsV2?.nodes || [];
  }

  public async fetchOrgs(): Promise<Array<{ login: string; avatarUrl: string }>> {
    const res = await this.authedFetch('https://api.github.com/user/orgs?per_page=100', {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    const data: any[] = await res.json();
    return data.map((o) => ({ login: o.login, avatarUrl: o.avatar_url }));
  }

  public async fetchRepoIssues(owner: string, repo: string): Promise<any[]> {
    const res = await this.authedFetch(
      `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100&sort=created&direction=desc`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    const data: any[] = await res.json();
    // The issues endpoint also returns pull requests; keep only real issues.
    return data.filter((item) => !item.pull_request);
  }

  public async fetchRepoPulls(owner: string, repo: string): Promise<any[]> {
    const res = await this.authedFetch(`https://api.github.com/repos/${owner}/${repo}/pulls?state=all&per_page=50`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }

  public async fetchRepoMilestones(owner: string, repo: string): Promise<any[]> {
    const res = await this.authedFetch(`https://api.github.com/repos/${owner}/${repo}/milestones?state=all&per_page=100`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }

  public async fetchRepoReleases(owner: string, repo: string): Promise<any[]> {
    const res = await this.authedFetch(`https://api.github.com/repos/${owner}/${repo}/releases?per_page=30`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }

  public async createMilestone(
    owner: string,
    repo: string,
    input: { title: string; description?: string; due_on?: string },
  ): Promise<any> {
    const res = await this.authedFetch(`https://api.github.com/repos/${owner}/${repo}/milestones`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
      body: JSON.stringify(input),
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }

  private async ensureLabelExists(owner: string, repo: string, name: string, color: string): Promise<void> {
    const checkRes = await this.authedFetch(`https://api.github.com/repos/${owner}/${repo}/labels/${encodeURIComponent(name)}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (checkRes.ok) return;
    await this.authedFetch(`https://api.github.com/repos/${owner}/${repo}/labels`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ name, color }),
    }).catch(() => {});
  }

  public async createIssue(
    owner: string,
    repo: string,
    input: { title: string; body?: string; labels?: Array<{ name: string; color: string }>; assignees?: string[]; milestone?: number },
  ): Promise<any> {
    for (const label of input.labels || []) {
      await this.ensureLabelExists(owner, repo, label.name, label.color);
    }
    const res = await this.authedFetch(`https://api.github.com/repos/${owner}/${repo}/issues`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
      body: JSON.stringify({
        title: input.title,
        body: input.body || '',
        labels: (input.labels || []).map((l) => l.name),
        assignees: input.assignees || [],
        ...(input.milestone != null ? { milestone: input.milestone } : {}),
      }),
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }

  public async updateIssue(
    owner: string,
    repo: string,
    issueNumber: number,
    input: {
      title?: string;
      body?: string;
      state?: 'open' | 'closed';
      labels?: string[];
      ensureLabels?: Array<{ name: string; color: string }>;
      milestone?: number | null;
    },
  ): Promise<any> {
    for (const label of input.ensureLabels || []) {
      await this.ensureLabelExists(owner, repo, label.name, label.color);
    }
    const { ensureLabels, ...patchBody } = input;
    const res = await this.authedFetch(`https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
      body: JSON.stringify(patchBody),
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }

  public async deleteIssue(nodeId: string): Promise<void> {
    const mutation = `
      mutation($id: ID!) {
        deleteIssue(input: { issueId: $id }) {
          clientMutationId
        }
      }
    `;
    const res = await this.authedFetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation, variables: { id: nodeId } }),
    });
    if (!res.ok) throw new Error(`GitHub GraphQL respondeu ${res.status}`);
    const data: any = await res.json();
    if (data.errors) throw new Error(data.errors[0]?.message || 'Erro ao excluir a issue no GitHub');
  }
}

export const githubAuthService = new GithubAuthService();
