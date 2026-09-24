import { app, safeStorage } from 'electron';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { execSync } from 'node:child_process';

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

  private getCliToken(): string | null {
    try {
      const token = execSync('gh auth token', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000,
      }).trim();
      return token || null;
    } catch {
      return null;
    }
  }

  private readTokenData(): StoredTokenData | null {
    if (this.cachedTokenData) return this.cachedTokenData;
    try {
      if (fs.existsSync(this.tokenFilePath) && safeStorage.isEncryptionAvailable()) {
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
        if (data?.accessToken) {
          this.cachedTokenData = data;
          return data;
        }
      }
    } catch {}

    // Fallback para GitHub CLI (gh auth token) se estiver disponível na máquina
    const cliToken = this.getCliToken();
    if (cliToken) {
      const data: StoredTokenData = { accessToken: cliToken };
      this.cachedTokenData = data;
      return data;
    }

    return null;
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
    if (!data.accessTokenExpiresAt && !data.refreshToken) {
      return data.accessToken;
    }
    const SAFETY_MARGIN_MS = 60_000;
    const looksExpired = data.accessTokenExpiresAt != null && data.accessTokenExpiresAt - SAFETY_MARGIN_MS < Date.now();
    if (!looksExpired) return data.accessToken;
    if (data.refreshToken) {
      const refreshed = await this.refreshAccessToken(data.refreshToken);
      if (refreshed) return refreshed.accessToken;
    }
    const cliToken = this.getCliToken();
    if (cliToken) {
      this.cachedTokenData = { accessToken: cliToken };
      return cliToken;
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
    return {
      device_code: data.device_code,
      user_code: data.user_code,
      verification_uri: data.verification_uri,
      expires_in: data.expires_in,
      interval: data.interval,
    };
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
            const user = await this.fetchUser();
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
    const repos: any[] = [];

    // 1. Repositórios do usuário (pessoal + onde é colaborador ou membro de organização) com paginação
    try {
      let page = 1;
      while (page <= 3) {
        const res = await this.authedFetch(
          `https://api.github.com/user/repos?sort=updated&per_page=100&page=${page}&affiliation=owner,collaborator,organization_member`,
          { headers: { Accept: 'application/vnd.github+json' } },
        );
        if (!res.ok) break;
        const pageData: any[] = await res.json();
        if (!Array.isArray(pageData) || pageData.length === 0) break;
        repos.push(...pageData);
        if (pageData.length < 100) break;
        page++;
      }
    } catch (err) {
      console.warn('[GithubAuth] error fetching user repos:', err);
    }

    // 2. Repositórios de todas as organizações das quais o usuário faz parte
    try {
      const orgs = await this.fetchOrgs();
      for (const org of orgs) {
        try {
          const orgRes = await this.authedFetch(
            `https://api.github.com/orgs/${org.login}/repos?sort=updated&per_page=100`,
            { headers: { Accept: 'application/vnd.github+json' } },
          );
          if (orgRes.ok) {
            const orgRepos: any[] = await orgRes.json();
            if (Array.isArray(orgRepos)) {
              repos.push(...orgRepos);
            }
          }
        } catch (orgErr) {
          console.warn(`[GithubAuth] error fetching repos for org ${org.login}:`, orgErr);
        }
      }
    } catch (orgsErr) {
      console.warn('[GithubAuth] error fetching orgs for repos:', orgsErr);
    }

    // 3. Deduplicar por id ou full_name
    const map = new Map<string, any>();
    for (const r of repos) {
      if (!r) continue;
      const key = (r.full_name || r.name || String(r.id)).toLowerCase();
      if (!map.has(key)) {
        map.set(key, r);
      }
    }
    return Array.from(map.values());
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

  public async fetchOrgProjects(org: string): Promise<any[]> {
    if (!org || org === 'Todas' || org === 'all') {
      try {
        return await this.fetchProjects();
      } catch {
        return [];
      }
    }

    const queryOrg = `
      query($org: String!) {
        organization(login: $org) {
          projectsV2(first: 50) {
            nodes {
              id
              title
              url
              number
              closed
              updatedAt
              shortDescription
              repositories(first: 50) {
                nodes {
                  id
                  name
                  nameWithOwner
                }
              }
              fields(first: 30) {
                nodes {
                  ... on ProjectV2IterationField {
                    id
                    name
                    configuration {
                      duration
                      iterations {
                        id
                        title
                        startDate
                        duration
                      }
                      completedIterations {
                        id
                        title
                        startDate
                        duration
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;

    try {
      const res = await this.authedFetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: queryOrg, variables: { org } }),
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data.data?.organization?.projectsV2?.nodes) {
          return data.data.organization.projectsV2.nodes;
        }
        if (data.errors) {
          const isScopeError = data.errors.some((e: any) => e.message?.includes('read:project') || e.type === 'INSUFFICIENT_SCOPES');
          if (isScopeError) {
            throw new Error('O token do GitHub precisa do escopo "read:project" para listar os Projects da organização.');
          }
        }
      }
    } catch (err: any) {
      if (err?.message?.includes('read:project')) throw err;
    }

    // Se falhar como org, tenta como usuário (user projects)
    const queryUser = `
      query($login: String!) {
        user(login: $login) {
          projectsV2(first: 50) {
            nodes {
              id
              title
              url
              number
              closed
              updatedAt
              shortDescription
              repositories(first: 50) {
                nodes {
                  id
                  name
                  nameWithOwner
                }
              }
              fields(first: 30) {
                nodes {
                  ... on ProjectV2IterationField {
                    id
                    name
                    configuration {
                      duration
                      iterations {
                        id
                        title
                        startDate
                        duration
                      }
                      completedIterations {
                        id
                        title
                        startDate
                        duration
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const resUser = await this.authedFetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: queryUser, variables: { login: org } }),
    });
    if (!resUser.ok) return [];
    const dataUser: any = await resUser.json();
    if (dataUser.errors) {
      const isScopeError = dataUser.errors.some((e: any) => e.message?.includes('read:project') || e.type === 'INSUFFICIENT_SCOPES');
      if (isScopeError) {
        throw new Error('O token do GitHub precisa do escopo "read:project" para listar os Projects.');
      }
      return [];
    }
    return dataUser.data?.user?.projectsV2?.nodes || [];
  }

  public async fetchRepoProjects(owner: string, repo: string): Promise<any[]> {
    const query = `
      query($owner: String!, $name: String!) {
        repository(owner: $owner, name: $name) {
          projectsV2(first: 20) {
            nodes {
              id
              number
              title
              url
              closed
              updatedAt
              fields(first: 50) {
                nodes {
                  ... on ProjectV2FieldCommon { id name }
                  ... on ProjectV2IterationField {
                    id
                    name
                    configuration {
                      duration
                      iterations {
                        id
                        title
                        startDate
                        duration
                      }
                      completedIterations {
                        id
                        title
                        startDate
                        duration
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    `;
    try {
      const res = await this.authedFetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, variables: { owner, name: repo } }),
      });
      if (!res.ok) return [];
      const data: any = await res.json();
      return data.data?.repository?.projectsV2?.nodes || [];
    } catch {
      return [];
    }
  }

  public async fetchProjectItems(projectNumber: number, org?: string): Promise<any> {
    const isOrg = org && org !== 'Todas' && org !== 'all';
    const query = isOrg
      ? `
      query($org: String!, $number: Int!) {
        organization(login: $org) {
          projectV2(number: $number) {
            id
            title
            repositories(first: 50) {
              nodes {
                id
                name
                nameWithOwner
              }
            }
            fields(first: 100) {
              nodes {
                ... on ProjectV2FieldCommon { id name }
                ... on ProjectV2SingleSelectField { id name options { id name color description } }
                ... on ProjectV2IterationField {
                  id
                  name
                  configuration {
                    duration
                    iterations {
                      id
                      title
                      startDate
                      duration
                    }
                    completedIterations {
                      id
                      title
                      startDate
                      duration
                    }
                  }
                }
              }
            }
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue { id number title body state url repository { nameWithOwner } }
                  ... on PullRequest { id number title body state url repository { nameWithOwner } }
                }
                fieldValues(first: 30) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue { name optionId field { ... on ProjectV2FieldCommon { id name } } }
                    ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { id name } } }
                    ... on ProjectV2ItemFieldIterationValue {
                      iterationId
                      title
                      startDate
                      duration
                      field { ... on ProjectV2FieldCommon { id name } }
                    }
                    ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { id name } } }
                  }
                }
              }
            }
          }
        }
      }
    `
      : `
      query($number: Int!) {
        viewer {
          projectV2(number: $number) {
            id
            title
            repositories(first: 50) {
              nodes {
                id
                name
                nameWithOwner
              }
            }
            fields(first: 100) {
              nodes {
                ... on ProjectV2FieldCommon { id name }
                ... on ProjectV2SingleSelectField { id name options { id name color description } }
                ... on ProjectV2IterationField {
                  id
                  name
                  configuration {
                    duration
                    iterations {
                      id
                      title
                      startDate
                      duration
                    }
                    completedIterations {
                      id
                      title
                      startDate
                      duration
                    }
                  }
                }
              }
            }
            items(first: 100) {
              nodes {
                id
                content {
                  ... on Issue { id number title body state url repository { nameWithOwner } }
                  ... on PullRequest { id number title body state url repository { nameWithOwner } }
                }
                fieldValues(first: 30) {
                  nodes {
                    ... on ProjectV2ItemFieldSingleSelectValue { name optionId field { ... on ProjectV2FieldCommon { id name } } }
                    ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { id name } } }
                    ... on ProjectV2ItemFieldIterationValue {
                      iterationId
                      title
                      startDate
                      duration
                      field { ... on ProjectV2FieldCommon { id name } }
                    }
                    ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { id name } } }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const res = await this.authedFetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables: isOrg ? { org, number: projectNumber } : { number: projectNumber } }),
    });
    if (!res.ok) throw new Error(`GitHub GraphQL respondeu ${res.status}`);
    const data: any = await res.json();
    if (data.errors) throw new Error(data.errors[0]?.message || 'Erro ao buscar itens do Project');
    return isOrg ? data.data?.organization?.projectV2 || null : data.data?.viewer?.projectV2 || null;
  }

  public async updateProjectItemStatus(projectId: string, itemId: string, fieldId: string, optionId: string): Promise<any> {
    const mutation = `
      mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
        updateProjectV2ItemFieldValue(input: {
          projectId: $projectId,
          itemId: $itemId,
          fieldId: $fieldId,
          value: { singleSelectOptionId: $optionId }
        }) { projectV2Item { id } }
      }
    `;
    const res = await this.authedFetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation, variables: { projectId, itemId, fieldId, optionId } }),
    });
    if (!res.ok) throw new Error(`GitHub GraphQL respondeu ${res.status}`);
    const data: any = await res.json();
    if (data.errors) throw new Error(data.errors[0]?.message || 'Erro ao atualizar status do Project');
    return data.data?.updateProjectV2ItemFieldValue?.projectV2Item || null;
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

  public async fetchRepoCollaborators(owner: string, repo: string): Promise<any[]> {
    const res = await this.authedFetch(`https://api.github.com/repos/${owner}/${repo}/collaborators?per_page=100`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (res.ok) return res.json();
    // Sem permissão de admin para listar colaboradores (comum em repos de terceiros) — cai para contribuidores.
    const fallback = await this.authedFetch(`https://api.github.com/repos/${owner}/${repo}/contributors?per_page=100`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!fallback.ok) throw new Error(`GitHub API respondeu ${fallback.status}`);
    return fallback.json();
  }

  public async fetchIssueComments(owner: string, repo: string, issueNumber: number): Promise<any[]> {
    const res = await this.authedFetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments?per_page=100`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }

  public async addIssueComment(owner: string, repo: string, issueNumber: number, body: string): Promise<any> {
    const res = await this.authedFetch(
      `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
        body: JSON.stringify({ body }),
      },
    );
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

  public async updateMilestone(
    owner: string,
    repo: string,
    milestoneNumber: number,
    input: { title?: string; description?: string; due_on?: string; state?: 'open' | 'closed' },
  ): Promise<any> {
    const res = await this.authedFetch(`https://api.github.com/repos/${owner}/${repo}/milestones/${milestoneNumber}`, {
      method: 'PATCH',
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
