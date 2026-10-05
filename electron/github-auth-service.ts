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
      const envPath = `/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/.local/bin:${process.env.PATH || ''}`;
      const token = execSync('gh auth token', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 3000,
        env: { ...process.env, PATH: envPath },
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
  /** Token atual (ou null) para chamadas autenticadas feitas por outros serviços, ex.: catálogo de skills */
  public async peekAccessToken(): Promise<string | null> {
    try {
      return await this.getValidAccessToken();
    } catch {
      return null;
    }
  }

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
    try {
      const res = token
        ? await fetch('https://api.github.com/user', { headers: { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json' } })
        : await this.authedFetch('https://api.github.com/user', { headers: { Accept: 'application/vnd.github+json' } });
      if (res.ok) {
        const data: any = await res.json();
        return {
          login: data.login,
          name: data.name ?? null,
          avatarUrl: data.avatar_url,
          htmlUrl: data.html_url,
        };
      }
    } catch (e: any) {
      console.warn('[fetchUser] authedFetch falhou, tentando fallback via gh CLI:', e?.message || e);
    }

    try {
      const envPath = `/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/.local/bin:${process.env.PATH || ''}`;
      const out = execSync('gh api user', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000,
        env: { ...process.env, PATH: envPath },
      });
      const data = JSON.parse(out);
      if (data && data.login) {
        return {
          login: data.login,
          name: data.name ?? null,
          avatarUrl: data.avatar_url,
          htmlUrl: data.html_url,
        };
      }
    } catch {}

    throw new Error('Falha ao obter dados do usuário');
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
    const projectFields = `
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
    `;

    // 1. Tenta query unificada trazendo viewer e suas organizações
    const query = `
      query {
        viewer {
          login
          projectsV2(first: 50) {
            nodes {
              ${projectFields}
            }
          }
          organizations(first: 20) {
            nodes {
              login
              projectsV2(first: 50) {
                nodes {
                  ${projectFields}
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
        body: JSON.stringify({ query }),
      });
      if (res.ok) {
        const data: any = await res.json();
        if (data.data?.viewer) {
          const list: any[] = [];
          const seen = new Set<string>();

          for (const p of data.data.viewer.projectsV2?.nodes || []) {
            if (p && !seen.has(p.id)) {
              seen.add(p.id);
              list.push({ ...p, org: data.data.viewer.login });
            }
          }

          for (const orgNode of data.data.viewer.organizations?.nodes || []) {
            const orgLogin = orgNode.login;
            for (const p of orgNode.projectsV2?.nodes || []) {
              if (p && !seen.has(p.id)) {
                seen.add(p.id);
                list.push({ ...p, org: orgLogin });
              }
            }
          }

          return list;
        }
      }
    } catch (err) {
      console.warn('[fetchProjects] Falha na busca unificada de projects:', err);
    }

    // Fallback simples se a busca unificada de organizações falhar
    try {
      const fallbackQuery = `
        query {
          viewer {
            projectsV2(first: 50) {
              nodes {
                ${projectFields}
              }
            }
          }
        }
      `;
      const res = await this.authedFetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: fallbackQuery }),
      });
      if (res.ok) {
        const data: any = await res.json();
        return data.data?.viewer?.projectsV2?.nodes || [];
      }
    } catch {}

    return [];
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
          return data.data.organization.projectsV2.nodes.map((p: any) => ({ ...p, org }));
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
    try {
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
      if (resUser.ok) {
        const dataUser: any = await resUser.json();
        if (dataUser.data?.user?.projectsV2?.nodes && dataUser.data.user.projectsV2.nodes.length > 0) {
          return dataUser.data.user.projectsV2.nodes.map((p: any) => ({ ...p, org }));
        }
      }
    } catch {}

    // Fallback unificado: busca projects via viewer.organizations (onde o usuário autenticado é membro)
    try {
      const allProjects = await this.fetchProjects();
      const orgProjects = allProjects.filter((p: any) => (p.org || '').toLowerCase() === org.toLowerCase());
      if (orgProjects.length > 0) {
        return orgProjects;
      }
    } catch {}

    return [];
  }

  public async fetchRepoProjects(owner: string, repo: string): Promise<any[]> {
    const iterationFieldFragment = `
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
    `;

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
                  ${iterationFieldFragment}
                }
              }
            }
          }
          issues(first: 15, states: [OPEN]) {
            nodes {
              projectItems(first: 5) {
                nodes {
                  project {
                    ... on ProjectV2 {
                      id
                      number
                      title
                      url
                      closed
                      updatedAt
                      fields(first: 50) {
                        nodes {
                          ${iterationFieldFragment}
                        }
                      }
                    }
                  }
                }
              }
            }
          }
          pullRequests(first: 10, states: [OPEN]) {
            nodes {
              projectItems(first: 5) {
                nodes {
                  project {
                    ... on ProjectV2 {
                      id
                      number
                      title
                      url
                      closed
                      updatedAt
                      fields(first: 50) {
                        nodes {
                          ${iterationFieldFragment}
                        }
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
      const directProjects = data.data?.repository?.projectsV2?.nodes || [];
      const discoveredProjects: any[] = [];

      for (const iss of data.data?.repository?.issues?.nodes || []) {
        for (const item of iss.projectItems?.nodes || []) {
          if (item.project) discoveredProjects.push(item.project);
        }
      }
      for (const pr of data.data?.repository?.pullRequests?.nodes || []) {
        for (const item of pr.projectItems?.nodes || []) {
          if (item.project) discoveredProjects.push(item.project);
        }
      }

      const seen = new Set<string>();
      const combined: any[] = [];
      for (const p of [...directProjects, ...discoveredProjects]) {
        if (!p) continue;
        const key = p.id || String(p.number);
        if (!seen.has(key)) {
          seen.add(key);
          combined.push(p);
        }
      }
      return combined;
    } catch {
      return [];
    }
  }

  public async fetchProjectItems(projectNumber: number, org?: string): Promise<any> {
    const isOrg = Boolean(org && org !== 'Todas' && org !== 'all');
    const projectBody = `
      id
      title
      url
      repositories(first: 50) { nodes { id name nameWithOwner } }
      fields(first: 100) {
        nodes {
          ... on ProjectV2FieldCommon { id name }
          ... on ProjectV2SingleSelectField { id name options { id name color description } }
          ... on ProjectV2IterationField {
            id
            name
            configuration {
              duration
              iterations { id title startDate duration }
              completedIterations { id title startDate duration }
            }
          }
        }
      }
      items(first: 100, after: $after) {
        pageInfo { hasNextPage endCursor }
        nodes {
          id
          content {
            ... on Issue { id number title body state url repository { nameWithOwner } }
            ... on PullRequest { id number title body state url repository { nameWithOwner } }
          }
          fieldValues(first: 50) {
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
    `;

    const fetchPagesForQuery = async (queryStr: string, vars: Record<string, any>, extractProject: (data: any) => any) => {
      let proj: any = null;
      const allItems: any[] = [];
      let after: string | null = null;
      for (let page = 0; page < 20; page++) {
        const data = await this.graphql(
          queryStr,
          { ...vars, after },
          'Erro ao buscar itens do Project',
        );
        const current = extractProject(data);
        if (!current) break;
        if (!proj) proj = current;
        allItems.push(...(current.items?.nodes || []));
        const pageInfo = current.items?.pageInfo;
        if (!pageInfo?.hasNextPage || !pageInfo.endCursor) break;
        after = pageInfo.endCursor;
      }
      if (!proj) return null;
      return { ...proj, items: { nodes: allItems } };
    };

    // 1. Se foi informada organização específica, tenta ela primeiro
    if (isOrg && org) {
      try {
        const orgQuery = `query($org: String!, $number: Int!, $after: String) { organization(login: $org) { projectV2(number: $number) { ${projectBody} } } }`;
        const result = await fetchPagesForQuery(orgQuery, { org, number: projectNumber }, (d) => d?.organization?.projectV2);
        if (result) return result;
      } catch {}

      try {
        const userQuery = `query($org: String!, $number: Int!, $after: String) { user(login: $org) { projectV2(number: $number) { ${projectBody} } } }`;
        const result = await fetchPagesForQuery(userQuery, { org, number: projectNumber }, (d) => d?.user?.projectV2);
        if (result) return result;
      } catch {}
    }

    // 2. Tenta pelo viewer (conta autenticada do usuário)
    try {
      const viewerQuery = `query($number: Int!, $after: String) { viewer { projectV2(number: $number) { ${projectBody} } } }`;
      const result = await fetchPagesForQuery(viewerQuery, { number: projectNumber }, (d) => d?.viewer?.projectV2);
      if (result) return result;
    } catch {}

    // 3. Se ainda não encontrou e org não estava definida (ou era 'Todas'), varre as organizações do usuário
    try {
      const userOrgs = await this.fetchOrgs();
      for (const o of userOrgs) {
        if (!o.login || o.login === org) continue;
        try {
          const candidateQuery = `query($org: String!, $number: Int!, $after: String) { organization(login: $org) { projectV2(number: $number) { ${projectBody} } } }`;
          const result = await fetchPagesForQuery(candidateQuery, { org: o.login, number: projectNumber }, (d) => d?.organization?.projectV2);
          if (result) return result;
        } catch {}
      }
    } catch {}

    return null;
  }

  private async graphql(query: string, variables: Record<string, any>, errorLabel: string): Promise<any> {
    const res = await this.authedFetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, variables }),
    });
    if (!res.ok) throw new Error(`GitHub GraphQL respondeu ${res.status}`);
    const data: any = await res.json();
    if (data.errors?.length) throw new Error(data.errors[0]?.message || errorLabel);
    return data.data;
  }

  // Busca completa e "fresca" de uma issue, com todos os campos que o painel de detalhes exibe:
  // metadados da issue, milestones do repo, Projects V2 em que ela está (com definição dos campos e
  // valores atuais: Status, Size, Estimate, Sprint/Iteration, etc.) e tipos de issue da org.
  public async fetchIssueDetails(owner: string, repo: string, number: number): Promise<any> {
    const mainQuery = `
      query($owner: String!, $name: String!, $number: Int!) {
        repository(owner: $owner, name: $name) {
          id
          milestones(first: 100, states: [OPEN, CLOSED], orderBy: { field: DUE_DATE, direction: ASC }) {
            nodes { number title state dueOn }
          }
          projectsV2(first: 30) { nodes { id number title closed } }
          issue(number: $number) {
            id
            number
            title
            body
            state
            stateReason
            url
            createdAt
            updatedAt
            author { login avatarUrl }
            assignees(first: 20) { nodes { login avatarUrl } }
            labels(first: 50) { nodes { name color } }
            milestone { number title dueOn }
            participants(first: 30) { nodes { login avatarUrl } }
            projectItems(first: 20) {
              nodes {
                id
                project {
                  id
                  number
                  title
                  url
                  fields(first: 50) {
                    nodes {
                      __typename
                      ... on ProjectV2FieldCommon { id name dataType }
                      ... on ProjectV2SingleSelectField { options { id name color } }
                      ... on ProjectV2IterationField {
                        configuration {
                          iterations { id title startDate duration }
                          completedIterations { id title startDate duration }
                        }
                      }
                    }
                  }
                }
                fieldValues(first: 50) {
                  nodes {
                    __typename
                    ... on ProjectV2ItemFieldSingleSelectValue { optionId name field { ... on ProjectV2FieldCommon { id } } }
                    ... on ProjectV2ItemFieldNumberValue { number field { ... on ProjectV2FieldCommon { id } } }
                    ... on ProjectV2ItemFieldTextValue { text field { ... on ProjectV2FieldCommon { id } } }
                    ... on ProjectV2ItemFieldDateValue { date field { ... on ProjectV2FieldCommon { id } } }
                    ... on ProjectV2ItemFieldIterationValue { iterationId title startDate duration field { ... on ProjectV2FieldCommon { id } } }
                  }
                }
              }
            }
          }
        }
      }
    `;
    const data = await this.graphql(mainQuery, { owner, name: repo, number }, 'Erro ao buscar detalhes da issue');
    const repository = data?.repository;
    const issue = repository?.issue;
    if (!issue) throw new Error(`Issue #${number} não encontrada em ${owner}/${repo}`);

    // Issue Types e resumo de sub-issues ficam numa query separada: são recursos mais novos e, se a
    // org/servidor não os suportar, a query principal não pode falhar por causa deles.
    let issueType: any = null;
    let issueTypes: any[] = [];
    let subIssuesSummary: any = null;
    try {
      const extra = await this.graphql(
        `query($owner: String!, $name: String!, $number: Int!) {
          repository(owner: $owner, name: $name) {
            issueTypes(first: 25) { nodes { id name color description } }
            issue(number: $number) {
              issueType { id name color }
              subIssuesSummary { total completed percentCompleted }
            }
          }
        }`,
        { owner, name: repo, number },
        'Erro ao buscar tipos de issue',
      );
      issueTypes = extra?.repository?.issueTypes?.nodes || [];
      issueType = extra?.repository?.issue?.issueType || null;
      subIssuesSummary = extra?.repository?.issue?.subIssuesSummary || null;
    } catch {
      // recurso indisponível: segue sem tipos
    }

    const projectItems = (issue.projectItems?.nodes || []).filter(Boolean).map((item: any) => {
      const fields = (item.project?.fields?.nodes || [])
        .filter((f: any) => f && f.id)
        .map((f: any) => ({
          id: f.id,
          name: f.name,
          dataType: f.dataType,
          options: f.options || undefined,
          iterations: f.configuration
            ? [
                ...(f.configuration.iterations || []).map((it: any) => ({ ...it, completed: false })),
                ...(f.configuration.completedIterations || []).map((it: any) => ({ ...it, completed: true })),
              ]
            : undefined,
        }));
      const values: Record<string, any> = {};
      for (const fv of item.fieldValues?.nodes || []) {
        const fieldId = fv?.field?.id;
        if (!fieldId) continue;
        const { field, __typename, ...rest } = fv;
        values[fieldId] = rest;
      }
      return {
        itemId: item.id,
        project: { id: item.project?.id, number: item.project?.number, title: item.project?.title, url: item.project?.url },
        fields,
        values,
      };
    });

    return {
      repositoryId: repository.id,
      issue: {
        id: issue.id,
        number: issue.number,
        title: issue.title,
        body: issue.body,
        state: issue.state,
        stateReason: issue.stateReason,
        url: issue.url,
        createdAt: issue.createdAt,
        updatedAt: issue.updatedAt,
        author: issue.author,
        assignees: issue.assignees?.nodes || [],
        labels: issue.labels?.nodes || [],
        milestone: issue.milestone,
        participants: issue.participants?.nodes || [],
        issueType,
        subIssuesSummary,
      },
      issueTypes,
      milestones: repository.milestones?.nodes || [],
      repoProjects: (repository.projectsV2?.nodes || []).filter((p: any) => p && !p.closed),
      projectItems,
    };
  }

  // value: { singleSelectOptionId } | { iterationId } | { number } | { text } | { date }
  public async updateProjectItemField(projectId: string, itemId: string, fieldId: string, value: Record<string, any>): Promise<any> {
    const data = await this.graphql(
      `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!, $value: ProjectV2FieldValue!) {
        updateProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: $value }) {
          projectV2Item { id }
        }
      }`,
      { projectId, itemId, fieldId, value },
      'Erro ao atualizar campo do Project',
    );
    return data?.updateProjectV2ItemFieldValue?.projectV2Item || null;
  }

  public async clearProjectItemField(projectId: string, itemId: string, fieldId: string): Promise<any> {
    const data = await this.graphql(
      `mutation($projectId: ID!, $itemId: ID!, $fieldId: ID!) {
        clearProjectV2ItemFieldValue(input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId }) {
          projectV2Item { id }
        }
      }`,
      { projectId, itemId, fieldId },
      'Erro ao limpar campo do Project',
    );
    return data?.clearProjectV2ItemFieldValue?.projectV2Item || null;
  }

  public async addIssueToProject(projectId: string, contentId: string): Promise<string | null> {
    const data = await this.graphql(
      `mutation($projectId: ID!, $contentId: ID!) {
        addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) { item { id } }
      }`,
      { projectId, contentId },
      'Erro ao adicionar issue ao Project',
    );
    return data?.addProjectV2ItemById?.item?.id || null;
  }

  public async removeProjectItem(projectId: string, itemId: string): Promise<void> {
    await this.graphql(
      `mutation($projectId: ID!, $itemId: ID!) {
        deleteProjectV2Item(input: { projectId: $projectId, itemId: $itemId }) { deletedItemId }
      }`,
      { projectId, itemId },
      'Erro ao remover issue do Project',
    );
  }

  public async setIssueType(issueId: string, issueTypeId: string | null): Promise<any> {
    const data = await this.graphql(
      `mutation($issueId: ID!, $issueTypeId: ID) {
        updateIssueIssueType(input: { issueId: $issueId, issueTypeId: $issueTypeId }) {
          issue { id issueType { id name color } }
        }
      }`,
      { issueId, issueTypeId },
      'Erro ao atualizar tipo da issue',
    );
    return data?.updateIssueIssueType?.issue?.issueType || null;
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
    try {
      const res = await this.authedFetch('https://api.github.com/user/orgs?per_page=100', {
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (res.ok) {
        const data: any[] = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          return data.map((o) => ({ login: o.login, avatarUrl: o.avatar_url }));
        }
      }
    } catch (e: any) {
      console.warn('[fetchOrgs] authedFetch falhou, tentando fallback via gh CLI:', e?.message || e);
    }

    try {
      const envPath = `/opt/homebrew/bin:/usr/local/bin:${process.env.HOME}/.local/bin:${process.env.PATH || ''}`;
      const out = execSync('gh api user/orgs', {
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'ignore'],
        timeout: 5000,
        env: { ...process.env, PATH: envPath },
      });
      const data = JSON.parse(out);
      if (Array.isArray(data) && data.length > 0) {
        return data.map((o: any) => ({ login: o.login, avatarUrl: o.avatar_url }));
      }
    } catch (e: any) {
      console.warn('[fetchOrgs] fallback gh api user/orgs erro:', e?.message || e);
    }

    return [];
  }

  public async fetchRepoIssues(owner: string, repo: string): Promise<any[]> {
    const allIssues: any[] = [];
    for (let page = 1; page <= 3; page++) {
      const res = await this.authedFetch(
        `https://api.github.com/repos/${owner}/${repo}/issues?state=all&per_page=100&page=${page}&sort=updated&direction=desc`,
        { headers: { Accept: 'application/vnd.github+json' } },
      );
      if (!res.ok) {
        if (page === 1) throw new Error(`GitHub API respondeu ${res.status}`);
        break;
      }
      const data: any[] = await res.json();
      if (!Array.isArray(data) || data.length === 0) break;
      // The issues endpoint also returns pull requests; keep only real issues.
      allIssues.push(...data.filter((item) => !item.pull_request));
      if (data.length < 100) break;
    }
    return allIssues;
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

  public async updateIssueComment(owner: string, repo: string, commentId: number, body: string): Promise<any> {
    const res = await this.authedFetch(`https://api.github.com/repos/${owner}/${repo}/issues/comments/${commentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ body }),
    });
    if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
    return res.json();
  }

  public async deleteIssueComment(owner: string, repo: string, commentId: number): Promise<void> {
    const res = await this.authedFetch(`https://api.github.com/repos/${owner}/${repo}/issues/comments/${commentId}`, {
      method: 'DELETE',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok && res.status !== 404) throw new Error(`GitHub API respondeu ${res.status}`);
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

  async deleteMilestone(
    owner: string,
    repo: string,
    milestoneNumber: number,
  ): Promise<boolean> {
    const res = await this.authedFetch(`https://api.github.com/repos/${owner}/${repo}/milestones/${milestoneNumber}`, {
      method: 'DELETE',
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok && res.status !== 404) throw new Error(`GitHub API respondeu ${res.status}`);
    return true;
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
      assignees?: string[];
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

  public async deleteIssue(input: string | { nodeId?: string; owner?: string; repo?: string; issueNumber?: number }): Promise<void> {
    let resolvedId = typeof input === 'string' ? input : input.nodeId;
    if (!resolvedId && typeof input === 'object' && input.owner && input.repo && input.issueNumber) {
      try {
        const query = `
          query($owner: String!, $repo: String!, $num: Int!) {
            repository(owner: $owner, name: $repo) {
              issue(number: $num) {
                id
              }
            }
          }
        `;
        const qRes = await this.authedFetch('https://api.github.com/graphql', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, variables: { owner: input.owner, repo: input.repo, num: input.issueNumber } }),
        });
        if (qRes.ok) {
          const qData: any = await qRes.json();
          resolvedId = qData?.data?.repository?.issue?.id;
        }
      } catch {}
    }

    if (resolvedId) {
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
        body: JSON.stringify({ query: mutation, variables: { id: resolvedId } }),
      });
      if (res.ok) {
        const data: any = await res.json();
        if (!data.errors || data.errors.length === 0) {
          return;
        }
      }
    }

    // Se GraphQL delete falhar ou não houver permissão de delete no repo, encerra a issue via REST
    if (typeof input === 'object' && input.owner && input.repo && input.issueNumber) {
      await this.updateIssue(input.owner, input.repo, input.issueNumber, { state: 'closed' });
      return;
    }
    throw new Error('Não foi possível excluir a issue no GitHub.');
  }

  public async lockIssue(owner: string, repo: string, issueNumber: number, locked: boolean): Promise<any> {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/lock`;
    if (locked) {
      const res = await this.authedFetch(url, {
        method: 'PUT',
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok && res.status !== 204) throw new Error(`GitHub API lock respondeu ${res.status}`);
      return { locked: true };
    } else {
      const res = await this.authedFetch(url, {
        method: 'DELETE',
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok && res.status !== 204) throw new Error(`GitHub API unlock respondeu ${res.status}`);
      return { locked: false };
    }
  }

  public async pinIssue(issueId: string, pinned: boolean): Promise<any> {
    const mutation = pinned
      ? `mutation($id: ID!) { pinIssue(input: { issueId: $id }) { issue { id } } }`
      : `mutation($id: ID!) { unpinIssue(input: { issueId: $id }) { issue { id } } }`;
    const res = await this.authedFetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: mutation, variables: { id: issueId } }),
    });
    if (!res.ok) throw new Error(`GitHub GraphQL respondeu ${res.status}`);
    const data: any = await res.json();
    if (data.errors && data.errors.length > 0) {
      throw new Error(data.errors[0]?.message || 'Erro ao alterar fixação da issue.');
    }
    return { pinned };
  }

  public async setIssueSubscription(owner: string, repo: string, issueNumber: number, subscribed: boolean): Promise<any> {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/subscription`;
    if (subscribed) {
      const res = await this.authedFetch(url, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
        body: JSON.stringify({ subscribed: true }),
      });
      if (!res.ok) throw new Error(`GitHub API respondeu ${res.status}`);
      return res.json();
    } else {
      const res = await this.authedFetch(url, {
        method: 'DELETE',
        headers: { Accept: 'application/vnd.github+json' },
      });
      if (!res.ok && res.status !== 204) throw new Error(`GitHub API respondeu ${res.status}`);
      return { subscribed: false };
    }
  }

  public async transferIssue(owner: string, repo: string, issueNumber: number, newOwner: string, newRepo: string): Promise<any> {
    const url = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/transfer`;
    const res = await this.authedFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
      body: JSON.stringify({ new_owner: newOwner, new_repo: newRepo }),
    });
    if (!res.ok) {
      let errMsg = `GitHub API respondeu ${res.status}`;
      try {
        const errJson = await res.json();
        if (errJson?.message) errMsg = errJson.message;
      } catch {}
      throw new Error(errMsg);
    }
    return res.json();
  }

  // ---------------------------------------------------------------------------
  // Time: visão consolidada de pessoas, times, PRs e commits de um repositório
  // ---------------------------------------------------------------------------

  private async ghGet(url: string): Promise<{ ok: boolean; status: number; data: any; message?: string }> {
    const res = await this.authedFetch(url, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) {
      let message = '';
      try {
        message = ((await res.json()) as any)?.message || '';
      } catch {}
      return { ok: false, status: res.status, data: null, message };
    }
    return { ok: true, status: res.status, data: await res.json() };
  }

  private async ghSend(method: 'PUT' | 'POST' | 'DELETE' | 'PATCH', url: string, body?: any): Promise<any> {
    const res = await this.authedFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', Accept: 'application/vnd.github+json' },
      ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    });
    if (!res.ok) {
      let detail = '';
      try {
        detail = ((await res.json()) as any)?.message || '';
      } catch {}
      throw new Error(`GitHub API respondeu ${res.status}${detail ? `: ${detail}` : ''}`);
    }
    if (res.status === 204) return null;
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  public async fetchTeamInsights(owner: string, repo: string): Promise<any> {
    const base = `https://api.github.com/repos/${owner}/${repo}`;
    const errors: string[] = [];
    const since = new Date(Date.now() - 90 * 86400000).toISOString();

    const [ownerInfo, allCollab, directCollab, outsideCollab, repoTeams, invitations, openPulls, closedPulls, commits1, commits2] =
      await Promise.all([
        this.ghGet(`https://api.github.com/users/${owner}`),
        this.ghGet(`${base}/collaborators?affiliation=all&per_page=100`),
        this.ghGet(`${base}/collaborators?affiliation=direct&per_page=100`),
        this.ghGet(`${base}/collaborators?affiliation=outside&per_page=100`),
        this.ghGet(`${base}/teams?per_page=100`),
        this.ghGet(`${base}/invitations?per_page=100`),
        this.ghGet(`${base}/pulls?state=open&per_page=100`),
        this.ghGet(`${base}/pulls?state=closed&per_page=100&sort=updated&direction=desc`),
        this.ghGet(`${base}/commits?since=${since}&per_page=100&page=1`),
        this.ghGet(`${base}/commits?since=${since}&per_page=100&page=2`),
      ]);

    const isOrg = ownerInfo.ok && ownerInfo.data?.type === 'Organization';
    const canAdmin = allCollab.ok;

    let collaborators: any[] = [];
    if (allCollab.ok) {
      const directSet = new Set((directCollab.data || []).map((c: any) => String(c.login).toLowerCase()));
      const outsideSet = new Set((outsideCollab.data || []).map((c: any) => String(c.login).toLowerCase()));
      collaborators = (allCollab.data || []).map((c: any) => {
        const key = String(c.login).toLowerCase();
        return {
          login: c.login,
          avatarUrl: c.avatar_url,
          htmlUrl: c.html_url,
          roleName: c.role_name || (c.permissions?.admin ? 'admin' : c.permissions?.maintain ? 'maintain' : c.permissions?.push ? 'write' : c.permissions?.triage ? 'triage' : 'read'),
          // Em repositório pessoal a API marca todo convidado como "outside" — só faz sentido em organização
          affiliation: isOrg && outsideSet.has(key) ? 'outside' : directSet.has(key) || !isOrg ? 'direct' : 'organization',
        };
      });
    } else {
      errors.push('Sem permissão de admin: colaboradores vêm da lista de contribuidores.');
      const contrib = await this.ghGet(`${base}/contributors?per_page=100`);
      collaborators = (contrib.data || [])
        .filter((c: any) => c.type !== 'Bot')
        .map((c: any) => ({
          login: c.login,
          avatarUrl: c.avatar_url,
          htmlUrl: c.html_url,
          roleName: 'write',
          affiliation: 'direct',
          contributions: c.contributions,
        }));
    }

    // Times com acesso ao repo + membros e repos de cada um
    let teams: any[] = [];
    if (repoTeams.ok && Array.isArray(repoTeams.data)) {
      teams = await Promise.all(
        repoTeams.data.map(async (t: any) => {
          const [members, repos] = await Promise.all([
            this.ghGet(`https://api.github.com/orgs/${owner}/teams/${t.slug}/members?per_page=100`),
            this.ghGet(`https://api.github.com/orgs/${owner}/teams/${t.slug}/repos?per_page=100`),
          ]);
          return {
            id: t.id,
            slug: t.slug,
            name: t.name,
            description: t.description || '',
            htmlUrl: t.html_url,
            permission: t.role_name || t.permission,
            members: (members.data || []).map((m: any) => ({ login: m.login, avatarUrl: m.avatar_url })),
            repos: (repos.data || []).map((r: any) => ({
              fullName: r.full_name,
              permission: r.role_name || (r.permissions?.admin ? 'admin' : r.permissions?.maintain ? 'maintain' : r.permissions?.push ? 'write' : r.permissions?.triage ? 'triage' : 'read'),
            })),
          };
        }),
      );
    } else if (isOrg) {
      errors.push('Não foi possível listar os times com acesso a este repositório.');
    }

    // Reviews dos PRs abertos (limitado para não estourar o rate limit)
    const openList: any[] = Array.isArray(openPulls.data) ? openPulls.data : [];
    const reviewsByPr = new Map<number, any[]>();
    await Promise.all(
      openList.slice(0, 25).map(async (pr: any) => {
        const r = await this.ghGet(`${base}/pulls/${pr.number}/reviews?per_page=100`);
        reviewsByPr.set(pr.number, r.data || []);
      }),
    );

    const mapPull = (pr: any) => ({
      number: pr.number,
      title: pr.title,
      url: pr.html_url,
      author: pr.user?.login,
      authorAvatarUrl: pr.user?.avatar_url,
      createdAt: pr.created_at,
      updatedAt: pr.updated_at,
      closedAt: pr.closed_at,
      mergedAt: pr.merged_at,
      draft: Boolean(pr.draft),
      requestedReviewers: (pr.requested_reviewers || []).map((u: any) => u.login),
      requestedTeams: (pr.requested_teams || []).map((t: any) => t.slug),
      reviews: (reviewsByPr.get(pr.number) || []).map((rv: any) => ({
        login: rv.user?.login,
        state: rv.state,
        submittedAt: rv.submitted_at,
      })),
    });

    const commits = [...(commits1.data || []), ...(commits2.data || [])].map((c: any) => ({
      sha: c.sha,
      author: c.author?.login || null,
      authorName: c.commit?.author?.name || '',
      date: c.commit?.author?.date || c.commit?.committer?.date,
      message: String(c.commit?.message || '').split('\n')[0],
    }));

    let codeowners: string | null = null;
    for (const path of ['.github/CODEOWNERS', 'CODEOWNERS', 'docs/CODEOWNERS']) {
      const res = await this.authedFetch(`${base}/contents/${path}`, { headers: { Accept: 'application/vnd.github.raw+json' } });
      if (res.ok) {
        codeowners = await res.text();
        break;
      }
    }

    return {
      isOrg,
      canAdmin,
      collaborators,
      teams,
      invitations: (invitations.data || []).map((i: any) => ({
        id: i.id,
        login: i.invitee?.login || i.email || 'convite',
        avatarUrl: i.invitee?.avatar_url,
        permission: i.permissions,
        createdAt: i.created_at,
        inviter: i.inviter?.login,
        expired: Boolean(i.expired),
      })),
      openPulls: openList.map(mapPull),
      closedPulls: (Array.isArray(closedPulls.data) ? closedPulls.data : []).map(mapPull),
      commits,
      codeowners,
      errors,
    };
  }

  public async fetchOrgTeams(org: string): Promise<any[]> {
    const r = await this.ghGet(`https://api.github.com/orgs/${org}/teams?per_page=100`);
    if (!r.ok) throw new Error(`GitHub API respondeu ${r.status}`);
    return (r.data || []).map((t: any) => ({ id: t.id, slug: t.slug, name: t.name, description: t.description || '' }));
  }

  public async fetchCollaboratorPermissions(owner: string, repo: string): Promise<Array<{ login: string; roleName: string }>> {
    const r = await this.ghGet(`https://api.github.com/repos/${owner}/${repo}/collaborators?affiliation=all&per_page=100`);
    if (!r.ok) throw new Error(`GitHub API respondeu ${r.status}`);
    return (r.data || []).map((c: any) => ({ login: c.login, roleName: c.role_name || 'read' }));
  }

  // A API REST usa pull/push para read/write
  private toApiPermission(role: string): string {
    return role === 'read' ? 'pull' : role === 'write' ? 'push' : role;
  }

  public async setCollaboratorPermission(owner: string, repo: string, username: string, role: string): Promise<{ invited: boolean }> {
    const data = await this.ghSend('PUT', `https://api.github.com/repos/${owner}/${repo}/collaborators/${username}`, {
      permission: this.toApiPermission(role),
    });
    return { invited: Boolean(data) };
  }

  public async removeCollaborator(owner: string, repo: string, username: string): Promise<void> {
    await this.ghSend('DELETE', `https://api.github.com/repos/${owner}/${repo}/collaborators/${username}`);
  }

  public async cancelInvitation(owner: string, repo: string, invitationId: number): Promise<void> {
    await this.ghSend('DELETE', `https://api.github.com/repos/${owner}/${repo}/invitations/${invitationId}`);
  }

  public async setTeamRepoPermission(org: string, teamSlug: string, owner: string, repo: string, role: string): Promise<void> {
    await this.ghSend('PUT', `https://api.github.com/orgs/${org}/teams/${teamSlug}/repos/${owner}/${repo}`, {
      permission: this.toApiPermission(role),
    });
  }

  public async removeTeamRepo(org: string, teamSlug: string, owner: string, repo: string): Promise<void> {
    await this.ghSend('DELETE', `https://api.github.com/orgs/${org}/teams/${teamSlug}/repos/${owner}/${repo}`);
  }

  public async createTeam(org: string, name: string, description?: string): Promise<any> {
    return this.ghSend('POST', `https://api.github.com/orgs/${org}/teams`, { name, description: description || '', privacy: 'closed' });
  }

  public async requestReviewers(owner: string, repo: string, pullNumber: number, reviewers: string[]): Promise<void> {
    await this.ghSend('POST', `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/requested_reviewers`, { reviewers });
  }

  public async addAssignees(owner: string, repo: string, issueNumber: number, assignees: string[]): Promise<void> {
    await this.ghSend('POST', `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/assignees`, { assignees });
  }

  // ---------------------------------------------------------------------------
  // Configurações do repositório
  // ---------------------------------------------------------------------------

  private repoUrl(owner: string, repo: string, path = '') {
    return `https://api.github.com/repos/${owner}/${repo}${path}`;
  }

  private async ghGetOrThrow(url: string): Promise<any> {
    const r = await this.ghGet(url);
    if (!r.ok) throw new Error(`GitHub API respondeu ${r.status}${r.message ? `: ${r.message}` : ''}`);
    return r.data;
  }

  public async settingsAction(action: string, p: any): Promise<any> {
    const { owner, repo } = p || {};
    const enc = (v: string) => encodeURIComponent(v);
    const encPath = (v: string) => v.split('/').map(enc).join('/');
    switch (action) {
      case 'getRepo':
        return this.ghGetOrThrow(this.repoUrl(owner, repo));
      case 'updateRepo':
        return this.ghSend('PATCH', this.repoUrl(owner, repo), p.patch);
      case 'setTopics':
        return this.ghSend('PUT', this.repoUrl(owner, repo, '/topics'), { names: p.names });
      case 'listBranches':
        return (await this.ghGetOrThrow(this.repoUrl(owner, repo, '/branches?per_page=100'))).map((b: any) => ({ name: b.name, protected: b.protected }));
      case 'getBranchProtection': {
        const r = await this.ghGet(this.repoUrl(owner, repo, `/branches/${enc(p.branch)}/protection`));
        if (r.status === 404) return null;
        if (r.status === 403 && /upgrade|pro|plan/i.test(r.message || ''))
          throw new Error('Proteção de branch indisponível: repositórios privados exigem GitHub Pro, Team ou Enterprise (ou torne o repositório público).');
        if (!r.ok) throw new Error(`GitHub API respondeu ${r.status}${r.message ? `: ${r.message}` : ''}`);
        return r.data;
      }
      case 'setBranchProtection':
        return this.ghSend('PUT', this.repoUrl(owner, repo, `/branches/${enc(p.branch)}/protection`), p.body);
      case 'removeBranchProtection':
        return this.ghSend('DELETE', this.repoUrl(owner, repo, `/branches/${enc(p.branch)}/protection`));
      case 'listLabels': {
        const all: any[] = [];
        for (let page = 1; page <= 5; page++) {
          const data = await this.ghGetOrThrow(this.repoUrl(owner, repo, `/labels?per_page=100&page=${page}`));
          all.push(...data);
          if (data.length < 100) break;
        }
        return all.map((l: any) => ({ name: l.name, color: l.color, description: l.description || '' }));
      }
      case 'createLabel':
        return this.ghSend('POST', this.repoUrl(owner, repo, '/labels'), { name: p.name, color: p.color, description: p.description || '' });
      case 'updateLabel':
        return this.ghSend('PATCH', this.repoUrl(owner, repo, `/labels/${enc(p.name)}`), p.patch);
      case 'deleteLabel':
        return this.ghSend('DELETE', this.repoUrl(owner, repo, `/labels/${enc(p.name)}`));
      case 'getFile': {
        const r = await this.ghGet(this.repoUrl(owner, repo, `/contents/${encPath(p.path)}${p.ref ? `?ref=${enc(p.ref)}` : ''}`));
        if (r.status === 404) return null;
        if (!r.ok) throw new Error(`GitHub API respondeu ${r.status}`);
        if (Array.isArray(r.data)) return null;
        return { path: r.data.path, sha: r.data.sha, content: Buffer.from(r.data.content || '', 'base64').toString('utf8') };
      }
      case 'listDir': {
        const r = await this.ghGet(this.repoUrl(owner, repo, `/contents/${encPath(p.path)}`));
        if (r.status === 404) return [];
        if (!r.ok) throw new Error(`GitHub API respondeu ${r.status}`);
        return (Array.isArray(r.data) ? r.data : []).map((f: any) => ({ name: f.name, path: f.path, sha: f.sha, type: f.type }));
      }
      case 'putFile':
        return this.ghSend('PUT', this.repoUrl(owner, repo, `/contents/${encPath(p.path)}`), {
          message: p.message,
          content: Buffer.from(p.content, 'utf8').toString('base64'),
          ...(p.sha ? { sha: p.sha } : {}),
          ...(p.branch ? { branch: p.branch } : {}),
        });
      case 'deleteFile':
        return this.ghSend('DELETE', this.repoUrl(owner, repo, `/contents/${encPath(p.path)}`), { message: p.message, sha: p.sha });
      case 'listWorkflowRuns': {
        const data = await this.ghGetOrThrow(this.repoUrl(owner, repo, `/actions/runs?per_page=${p.perPage || 15}`));
        return (data.workflow_runs || []).map((r: any) => ({
          id: r.id,
          name: r.name,
          branch: r.head_branch,
          event: r.event,
          status: r.status,
          conclusion: r.conclusion,
          url: r.html_url,
          createdAt: r.created_at,
          actor: r.actor?.login,
          title: r.display_title,
        }));
      }
      case 'rerunWorkflow':
        return this.ghSend('POST', this.repoUrl(owner, repo, `/actions/runs/${p.runId}/rerun`));
      case 'listSecrets': {
        const data = await this.ghGetOrThrow(this.repoUrl(owner, repo, '/actions/secrets?per_page=100'));
        return (data.secrets || []).map((s: any) => ({ name: s.name, updatedAt: s.updated_at }));
      }
      case 'listHooks':
        return (await this.ghGetOrThrow(this.repoUrl(owner, repo, '/hooks?per_page=100'))).map((h: any) => ({
          id: h.id,
          active: h.active,
          events: h.events,
          url: h.config?.url,
          lastResponse: h.last_response,
          updatedAt: h.updated_at,
        }));
      case 'pingHook':
        return this.ghSend('POST', this.repoUrl(owner, repo, `/hooks/${p.hookId}/pings`));
      case 'transferRepo':
        return this.ghSend('POST', this.repoUrl(owner, repo, '/transfer'), { new_owner: p.newOwner, ...(p.newName ? { new_name: p.newName } : {}) });
      case 'deleteRepo':
        return this.ghSend('DELETE', this.repoUrl(owner, repo));
      case 'listOwnerProjects':
        return (await this.fetchOrgProjects(owner)).map((pr: any) => ({ id: pr.id, number: pr.number, title: pr.title, closed: pr.closed, url: pr.url }));
      case 'fetchProjectFields': {
        const body = `id title url fields(first: 100) { nodes {
          __typename
          ... on ProjectV2Field { id name dataType }
          ... on ProjectV2SingleSelectField { id name dataType options { id name color } }
          ... on ProjectV2IterationField { id name dataType }
        } }`;
        const tries: Array<[string, Record<string, any>, (d: any) => any]> = [
          [`query($o: String!, $n: Int!) { organization(login: $o) { projectV2(number: $n) { ${body} } } }`, { o: owner, n: p.number }, (d) => d?.organization?.projectV2],
          [`query($o: String!, $n: Int!) { user(login: $o) { projectV2(number: $n) { ${body} } } }`, { o: owner, n: p.number }, (d) => d?.user?.projectV2],
          [`query($n: Int!) { viewer { projectV2(number: $n) { ${body} } } }`, { n: p.number }, (d) => d?.viewer?.projectV2],
        ];
        for (const [q, v, pick] of tries) {
          try {
            const data = await this.graphql(q, v, 'Erro ao buscar campos do Project');
            const proj = pick(data);
            if (proj) return proj;
          } catch {}
        }
        throw new Error('Project não encontrado ou sem permissão (escopo read:project).');
      }
      default:
        throw new Error(`Ação desconhecida: ${action}`);
    }
  }
}

export const githubAuthService = new GithubAuthService();
