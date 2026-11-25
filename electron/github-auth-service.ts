import { app, safeStorage } from 'electron';
import { getAugmentedPath } from './env-utils';
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
      const envPath = getAugmentedPath();
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
      const envPath = getAugmentedPath();
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
            viewerSubscription
            locked
            isPinned
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
        viewerSubscription: issue.viewerSubscription || null,
        locked: Boolean(issue.locked),
        isPinned: Boolean(issue.isPinned),
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
      const envPath = getAugmentedPath();
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

  // O REST de issues não tem /subscription (dava 404): a inscrição da thread é feita pelo GraphQL (updateSubscription)
  public async setIssueSubscription(owner: string, repo: string, issueNumber: number, state: boolean | 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'IGNORED'): Promise<any> {
    const target = state === true ? 'SUBSCRIBED' : state === false ? 'UNSUBSCRIBED' : state;
    const found = await this.graphql(
      `query($owner: String!, $name: String!, $number: Int!) { repository(owner: $owner, name: $name) { issue(number: $number) { id } } }`,
      { owner, name: repo, number: issueNumber },
      'Erro ao buscar a issue',
    );
    const id = found?.repository?.issue?.id;
    if (!id) throw new Error(`Issue #${issueNumber} não encontrada em ${owner}/${repo}`);
    const res = await this.graphql(
      `mutation($id: ID!, $state: SubscriptionState!) { updateSubscription(input: { subscribableId: $id, state: $state }) { subscribable { viewerSubscription } } }`,
      { id, state: target },
      'Erro ao alterar notificações da issue',
    );
    const current = res?.updateSubscription?.subscribable?.viewerSubscription || target;
    return { subscription: current, subscribed: current === 'SUBSCRIBED' };
  }

  // A transferência não existe no REST (dava 404): usa a mutation transferIssue do GraphQL
  public async transferIssue(owner: string, repo: string, issueNumber: number, newOwner: string, newRepo: string): Promise<any> {
    const data = await this.graphql(
      `query($owner: String!, $name: String!, $number: Int!, $newOwner: String!, $newName: String!) {
        repository(owner: $owner, name: $name) { issue(number: $number) { id } }
        target: repository(owner: $newOwner, name: $newName) { id }
      }`,
      { owner, name: repo, number: issueNumber, newOwner, newName: newRepo },
      'Erro ao buscar a issue ou o repositório de destino',
    );
    const issueId = data?.repository?.issue?.id;
    const repositoryId = data?.target?.id;
    if (!issueId) throw new Error(`Issue #${issueNumber} não encontrada em ${owner}/${repo}`);
    if (!repositoryId) throw new Error(`Repositório ${newOwner}/${newRepo} não encontrado`);
    const res = await this.graphql(
      `mutation($issueId: ID!, $repositoryId: ID!) { transferIssue(input: { issueId: $issueId, repositoryId: $repositoryId }) { issue { number url } } }`,
      { issueId, repositoryId },
      'Erro ao transferir a issue',
    );
    const issue = res?.transferIssue?.issue;
    return { number: issue?.number, html_url: issue?.url };
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

  /** Commita direto; se a branch padrão é protegida (409/422 por regra), cria branch + PR. */
  private async writeFileOrPr(owner: string, repo: string, method: 'PUT' | 'DELETE', p: any, body: any): Promise<any> {
    const url = this.repoUrl(owner, repo, `/contents/${p.path.split('/').map(encodeURIComponent).join('/')}`);
    try {
      return await this.ghSend(method, url, body);
    } catch (e: any) {
      if (body.branch || !/respondeu (409|422)/.test(e.message) || !/pull request|rule violations|protected/i.test(e.message)) throw e;
      const info = await this.ghGetOrThrow(this.repoUrl(owner, repo, ''));
      const base = info.default_branch;
      const head = await this.ghGetOrThrow(this.repoUrl(owner, repo, `/git/ref/heads/${base}`));
      const branch = `aura/${p.path.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}-${Date.now().toString(36)}`;
      await this.ghSend('POST', this.repoUrl(owner, repo, '/git/refs'), { ref: `refs/heads/${branch}`, sha: head.object.sha });
      const res = await this.ghSend(method, url, { ...body, branch });
      const pr = await this.ghSend('POST', this.repoUrl(owner, repo, '/pulls'), {
        title: body.message,
        head: branch,
        base,
        body: 'Alteração feita pelo Aura Dev. A branch padrão exige pull request.',
      });
      return { ...(res || {}), pullRequest: { number: pr.number, url: pr.html_url } };
    }
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

  /** Envia um review no PR com o token do usuário logado (APPROVE | REQUEST_CHANGES | COMMENT). */
  public async submitPullReview(owner: string, repo: string, pullNumber: number, event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT', body?: string): Promise<void> {
    await this.ghSend('POST', `https://api.github.com/repos/${owner}/${repo}/pulls/${pullNumber}/reviews`, { event, ...(body ? { body } : {}) });
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
      case 'reviewRequests': {
        // PRs abertos de outras pessoas em que o usuário logado foi pedido como revisor (todos os repositórios).
        // A busca do GitHub demora a indexar um pedido novo; as notificações (reason review_requested) chegam quase na hora, então as duas fontes se somam.
        const toItem = (i: any) => ({
          number: i.number,
          title: i.title,
          url: i.html_url,
          repo: String(i.repository_url || '').replace('https://api.github.com/repos/', ''),
          author: i.user?.login,
          authorAvatar: i.user?.avatar_url,
          draft: Boolean(i.draft),
          updatedAt: i.updated_at,
        });
        const [searched, notified] = await Promise.all([
          this.ghGet('https://api.github.com/search/issues?q=is:pr+is:open+review-requested:@me+archived:false&sort=updated&per_page=30'),
          this.ghGet('https://api.github.com/notifications?participating=true&per_page=50'),
        ]);
        if (!searched.ok && !notified.ok) throw new Error(`GitHub API respondeu ${searched.status}${searched.message ? `: ${searched.message}` : ''}`);
        const out = new Map<string, any>();
        for (const i of searched.ok ? searched.data.items || [] : []) {
          const it = toItem(i);
          out.set(`${it.repo}#${it.number}`, it);
        }
        if (notified.ok && Array.isArray(notified.data)) {
          const extra = notified.data.filter((n: any) => n.reason === 'review_requested' && n.subject?.type === 'PullRequest' && n.subject?.url).slice(0, 15);
          await Promise.all(
            extra.map(async (n: any) => {
              const repoFull = String(n.repository?.full_name || '');
              const num = Number(String(n.subject.url).split('/').pop());
              if (!repoFull || !num || out.has(`${repoFull}#${num}`)) return;
              const pr = await this.ghGet(n.subject.url);
              if (!pr.ok || pr.data?.state !== 'open') return;
              out.set(`${repoFull}#${num}`, {
                number: num,
                title: pr.data.title,
                url: pr.data.html_url,
                repo: repoFull,
                author: pr.data.user?.login,
                authorAvatar: pr.data.user?.avatar_url,
                draft: Boolean(pr.data.draft),
                updatedAt: pr.data.updated_at,
              });
            }),
          );
        }
        return [...out.values()];
      }
      case 'listPulls': {
        // PRs do repositório para o seletor de "Development" (abertos primeiro)
        const data = await this.ghGetOrThrow(this.repoUrl(owner, repo, '/pulls?state=all&sort=updated&per_page=50'));
        return data.map((x: any) => ({ number: x.number, title: x.title, state: x.merged_at ? 'merged' : x.state, draft: Boolean(x.draft), author: x.user?.login, body: x.body || '' }));
      }
      case 'linkPullToIssue': {
        // o GitHub vincula PR a issue pela palavra de fechamento no corpo do PR
        const url = this.repoUrl(owner, repo, `/pulls/${p.number}`);
        const pr = await this.ghGetOrThrow(url);
        const body: string = pr.body || '';
        if (!new RegExp(`(close[sd]?|fix(e[sd])?|resolve[sd]?)\\s+#${p.issueNumber}\\b`, 'i').test(body)) {
          await this.ghSend('PATCH', url, { body: `${body}${body ? '\n\n' : ''}Closes #${p.issueNumber}` });
        }
        return { number: pr.number, title: pr.title };
      }
      case 'issueRelations': {
        const base = this.repoUrl(owner, repo, `/issues/${p.number}`);
        const pick = (i: any) => ({ number: i.number, title: i.title, state: i.state, id: i.id, repo: String(i.repository_url || '').replace('https://api.github.com/repos/', '') });
        const [parent, blockedBy, blocking] = await Promise.all([
          this.ghGet(`${base}/parent`).then((r) => (r.ok && r.data ? [pick(r.data)] : [])),
          this.ghGet(`${base}/dependencies/blocked_by`).then((r) => (r.ok && Array.isArray(r.data) ? r.data.map(pick) : [])),
          this.ghGet(`${base}/dependencies/blocking`).then((r) => (r.ok && Array.isArray(r.data) ? r.data.map(pick) : [])),
        ]);
        return { parent, blockedBy, blocking };
      }
      case 'addIssueRelation': {
        // kind: parent (target é o pai) | blockedBy | blocking | relates
        const me = await this.ghGetOrThrow(this.repoUrl(owner, repo, `/issues/${p.number}`));
        const target = await this.ghGetOrThrow(this.repoUrl(owner, repo, `/issues/${p.target}`));
        if (p.kind === 'parent') await this.ghSend('POST', this.repoUrl(owner, repo, `/issues/${p.target}/sub_issues`), { sub_issue_id: me.id });
        else if (p.kind === 'blockedBy') await this.ghSend('POST', this.repoUrl(owner, repo, `/issues/${p.number}/dependencies/blocked_by`), { issue_id: target.id });
        else if (p.kind === 'blocking') await this.ghSend('POST', this.repoUrl(owner, repo, `/issues/${p.target}/dependencies/blocked_by`), { issue_id: me.id });
        else await this.ghSend('POST', this.repoUrl(owner, repo, `/issues/${p.number}/comments`), { body: `Relacionada a #${p.target}` });
        return { ok: true };
      }
      case 'removeIssueRelation': {
        const me = await this.ghGetOrThrow(this.repoUrl(owner, repo, `/issues/${p.number}`));
        if (p.kind === 'parent') await this.ghSend('DELETE', this.repoUrl(owner, repo, `/issues/${p.targetNumber}/sub_issue`), { sub_issue_id: me.id });
        else if (p.kind === 'blockedBy') await this.ghSend('DELETE', this.repoUrl(owner, repo, `/issues/${p.number}/dependencies/blocked_by/${p.targetId}`));
        else await this.ghSend('DELETE', this.repoUrl(owner, repo, `/issues/${p.targetNumber}/dependencies/blocked_by/${me.id}`));
        return { ok: true };
      }
      case 'pullList': {
        // lista de PRs do repositório com o estado da review (GraphQL: uma chamada só)
        const query = `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){
          open: pullRequests(states:OPEN){ totalCount } closed: pullRequests(states:[CLOSED,MERGED]){ totalCount }
          pullRequests(first:60, orderBy:{field:UPDATED_AT,direction:DESC}){ nodes{
            number title state isDraft merged createdAt mergedAt closedAt updatedAt baseRefName headRefName reviewDecision mergeStateStatus mergeable additions deletions changedFiles
            commits(last:1){ nodes{ commit{ statusCheckRollup{ state } } } }
            author{ login avatarUrl } labels(first:6){ nodes{ name color } } assignees(first:5){ nodes{ login avatarUrl } }
            reviewRequests(first:10){ nodes{ requestedReviewer{ __typename ... on User{ login avatarUrl } ... on Team{ name } } } }
            comments{ totalCount } allCommits: commits{ totalCount }
          } } } viewer{ login } }`;
        const res = await this.authedFetch('https://api.github.com/graphql', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ query, variables: { owner, name: repo } }) });
        const data: any = await res.json();
        if (!res.ok || data.errors?.length) throw new Error(data.errors?.[0]?.message || `GitHub API respondeu ${res.status}`);
        const r = data.data.repository;
        return {
          me: data.data.viewer?.login,
          openCount: r.open.totalCount,
          closedCount: r.closed.totalCount,
          items: (r.pullRequests.nodes || []).map((n: any) => ({
            number: n.number,
            title: n.title,
            state: n.merged ? 'merged' : n.state === 'OPEN' ? (n.isDraft ? 'draft' : 'open') : 'closed',
            author: n.author?.login,
            authorAvatar: n.author?.avatarUrl,
            createdAt: n.createdAt,
            updatedAt: n.updatedAt,
            mergedAt: n.mergedAt,
            closedAt: n.closedAt,
            base: n.baseRefName,
            head: n.headRefName,
            reviewDecision: n.reviewDecision || null,
            labels: (n.labels?.nodes || []).map((l: any) => ({ name: l.name, color: l.color })),
            assignees: (n.assignees?.nodes || []).map((u: any) => ({ login: u.login, avatar: u.avatarUrl })),
            reviewers: (n.reviewRequests?.nodes || []).map((x: any) => x.requestedReviewer).filter(Boolean).map((u: any) => ({ login: u.login || u.name, avatar: u.avatarUrl })),
            comments: n.comments?.totalCount || 0,
            commits: n.allCommits?.totalCount || 0,
            mergeState: n.state === 'OPEN' ? n.mergeStateStatus : null,
            conflicting: n.mergeable === 'CONFLICTING',
            checks: n.commits?.nodes?.[0]?.commit?.statusCheckRollup?.state || null,
            additions: n.additions || 0,
            deletions: n.deletions || 0,
            files: n.changedFiles || 0,
          })),
        };
      }
      case 'getPullDetail': {
        const base = this.repoUrl(owner, repo, `/pulls/${p.number}`);
        const [pr, files, reviews, comments, reviewComments, commits] = await Promise.all([
          this.ghGetOrThrow(base),
          this.ghGetOrThrow(`${base}/files?per_page=100`),
          this.ghGetOrThrow(`${base}/reviews?per_page=100`),
          this.ghGetOrThrow(this.repoUrl(owner, repo, `/issues/${p.number}/comments?per_page=100`)),
          this.ghGetOrThrow(`${base}/comments?per_page=100`),
          this.ghGetOrThrow(`${base}/commits?per_page=100`),
        ]);
        const sha = pr.head?.sha;
        const [timelineRes, compareRes] = await Promise.all([
          this.ghGet(this.repoUrl(owner, repo, `/issues/${p.number}/timeline?per_page=100`)),
          pr.base?.ref && sha ? this.ghGet(this.repoUrl(owner, repo, `/compare/${encodeURIComponent(pr.base.ref)}...${sha}`)) : Promise.resolve({ ok: false, data: null } as any),
        ]);
        const checkRuns = sha ? await this.ghGet(this.repoUrl(owner, repo, `/commits/${sha}/check-runs?per_page=100`)) : { ok: false, data: null };
        const statuses = sha ? await this.ghGet(this.repoUrl(owner, repo, `/commits/${sha}/status`)) : { ok: false, data: null };
        // estado de merge e checks como o próprio GitHub calcula (GraphQL): revisão exigida, branch atrás/bloqueada, checks obrigatórios
        let gql: any = null;
        try {
          const d = await this.graphql(
            `query($owner:String!,$name:String!,$n:Int!){ repository(owner:$owner,name:$name){ viewerPermission pullRequest(number:$n){
              reviewDecision mergeStateStatus mergeable viewerCanMergeAsAdmin isInMergeQueue isDraft
              baseRef{ branchProtectionRule{ requiredApprovingReviewCount requiresCodeOwnerReviews dismissesStaleReviews requiredStatusCheckContexts isAdminEnforced } }
              commits(last:1){ nodes{ commit{ oid statusCheckRollup{ state contexts(first:100){ nodes{
                __typename
                ... on CheckRun{ databaseId name status conclusion detailsUrl title summary startedAt completedAt steps(first:60){ nodes{ name number conclusion } } annotations(first:5){ nodes{ message path annotationLevel location{ start{ line } } } } isRequired(pullRequestNumber:$n) checkSuite{ app{ name logoUrl } workflowRun{ event workflow{ name } } } }
                ... on StatusContext{ id context state description targetUrl isRequired(pullRequestNumber:$n) }
              } } } } } }
            } } }`,
            { owner, name: repo, n: p.number },
            'Erro ao ler o estado do merge',
          );
          gql = d?.repository?.pullRequest ? { ...d.repository.pullRequest, viewerPermission: d.repository.viewerPermission } : null;
        } catch {}
        const baseBranch = encodeURIComponent(pr.base?.ref || '');
        const [repoRes, rulesetRes, protRes] = await Promise.all([
          this.ghGet(this.repoUrl(owner, repo)),
          this.ghGet(this.repoUrl(owner, repo, `/rules/branches/${baseBranch}`)),
          this.ghGet(this.repoUrl(owner, repo, `/branches/${baseBranch}/protection`)),
        ]);
        // regras de aprovação: rulesets (legíveis por quem tem acesso) + proteção clássica de branch (só admin enxerga)
        const rules: any = { canWrite: Boolean(repoRes.data?.permissions?.push || repoRes.data?.permissions?.admin), isAdmin: Boolean(repoRes.data?.permissions?.admin), requiredApprovals: 0, requireCodeOwners: false, dismissStale: false, requireLastPush: false, requiredChecks: [] as string[], enforceAdmins: false, known: false };
        const checks = new Set<string>();
        if (rulesetRes.ok && Array.isArray(rulesetRes.data)) {
          for (const r of rulesetRes.data) {
            if (r.type === 'pull_request') {
              rules.known = true;
              rules.requiredApprovals = Math.max(rules.requiredApprovals, r.parameters?.required_approving_review_count || 0);
              rules.requireCodeOwners ||= Boolean(r.parameters?.require_code_owner_review);
              rules.dismissStale ||= Boolean(r.parameters?.dismiss_stale_reviews_on_push);
              rules.requireLastPush ||= Boolean(r.parameters?.require_last_push_approval);
            }
            if (r.type === 'required_status_checks') (r.parameters?.required_status_checks || []).forEach((x: any) => x.context && checks.add(x.context));
          }
        }
        if (protRes.ok && protRes.data) {
          const pp = protRes.data;
          rules.known = true;
          rules.requiredApprovals = Math.max(rules.requiredApprovals, pp.required_pull_request_reviews?.required_approving_review_count || 0);
          rules.requireCodeOwners ||= Boolean(pp.required_pull_request_reviews?.require_code_owner_reviews);
          rules.dismissStale ||= Boolean(pp.required_pull_request_reviews?.dismiss_stale_reviews);
          rules.requireLastPush ||= Boolean(pp.required_pull_request_reviews?.require_last_push_approval);
          rules.enforceAdmins = Boolean(pp.enforce_admins?.enabled);
          [...(pp.required_status_checks?.contexts || []), ...(pp.required_status_checks?.checks || []).map((x: any) => x.context)].forEach((x: string) => x && checks.add(x));
        }
        const rule = gql?.baseRef?.branchProtectionRule;
        if (rule) {
          rules.known = true;
          rules.requiredApprovals = Math.max(rules.requiredApprovals, rule.requiredApprovingReviewCount || 0);
          rules.requireCodeOwners ||= Boolean(rule.requiresCodeOwnerReviews);
          rules.dismissStale ||= Boolean(rule.dismissesStaleReviews);
          rules.enforceAdmins ||= Boolean(rule.isAdminEnforced);
          (rule.requiredStatusCheckContexts || []).forEach((x: string) => checks.add(x));
        }
        if (gql?.reviewDecision === 'REVIEW_REQUIRED' && rules.requiredApprovals === 0) rules.requiredApprovals = 1;
        if (gql?.viewerPermission) {
          rules.canWrite = ['WRITE', 'MAINTAIN', 'ADMIN'].includes(gql.viewerPermission);
          rules.isAdmin = gql.viewerPermission === 'ADMIN';
        }
        rules.requiredChecks = [...checks];
        const rollup = gql?.commits?.nodes?.[0]?.commit?.statusCheckRollup?.contexts?.nodes || [];
        const failureText = (n: any): string => {
          const failed = String(n.conclusion || '').toUpperCase();
          const bad = ['FAILURE', 'TIMED_OUT', 'CANCELLED', 'STARTUP_FAILURE', 'ACTION_REQUIRED'].includes(failed);
          const parts: string[] = [];
          if (n.title) parts.push(String(n.title));
          if (bad) {
            const step = (n.steps?.nodes || []).find((x: any) => ['FAILURE', 'TIMED_OUT'].includes(String(x.conclusion || '').toUpperCase()));
            if (step) parts.push(`Falhou no passo ${step.number}: ${step.name}`);
            for (const a of (n.annotations?.nodes || []).filter((x: any) => x.annotationLevel === 'FAILURE').slice(0, 3)) {
              parts.push(`${a.path && a.path !== '.github' ? `${a.path}${a.location?.start?.line ? `:${a.location.start.line}` : ''} — ` : ''}${String(a.message || '').split('\n')[0].slice(0, 240)}`);
            }
            if (parts.length === 0 && n.summary) parts.push(String(n.summary).split('\n').find((l: string) => l.trim()) || '');
          }
          return parts.filter(Boolean).join('\n');
        };
        const gqlChecks: any[] = rollup.map((n: any) =>
          n.__typename === 'CheckRun'
            ? { id: `r${n.databaseId}`, name: n.name, status: String(n.status || '').toLowerCase(), conclusion: n.conclusion ? String(n.conclusion).toLowerCase() : null, url: n.detailsUrl, app: n.checkSuite?.app?.name, appAvatar: n.checkSuite?.app?.logoUrl, description: failureText(n), required: Boolean(n.isRequired), workflow: n.checkSuite?.workflowRun?.workflow?.name, event: n.checkSuite?.workflowRun?.event, startedAt: n.startedAt, completedAt: n.completedAt }
            : { id: `s${n.id}`, name: n.context, status: ['PENDING', 'EXPECTED'].includes(n.state) ? 'in_progress' : 'completed', conclusion: n.state === 'SUCCESS' ? 'success' : ['PENDING', 'EXPECTED'].includes(n.state) ? null : 'failure', url: n.targetUrl, app: 'status', description: n.description || '', required: Boolean(n.isRequired) },
        );
        gqlChecks.forEach((k) => k.required && checks.add(k.name));
        rules.requiredChecks = [...checks];
        const meRes = await this.ghGet('https://api.github.com/user');
        const u = (x: any) => (x ? { login: x.login, avatar: x.avatar_url } : undefined);
        return {
          me: meRes.ok ? meRes.data?.login : undefined,
          rules,
          behindBy: compareRes.ok ? compareRes.data?.behind_by || 0 : 0,
          allowedMethods: {
            merge: repoRes.data?.allow_merge_commit !== false,
            squash: repoRes.data?.allow_squash_merge !== false,
            rebase: repoRes.data?.allow_rebase_merge !== false,
          },
          deleteBranchOnMerge: Boolean(repoRes.data?.delete_branch_on_merge),
          timeline: ((timelineRes.ok && Array.isArray(timelineRes.data) ? timelineRes.data : []) as any[])
            .filter((e) => ['labeled', 'unlabeled', 'assigned', 'unassigned', 'review_requested', 'review_request_removed', 'head_ref_force_pushed', 'head_ref_deleted', 'head_ref_restored', 'renamed', 'closed', 'reopened', 'ready_for_review', 'convert_to_draft', 'milestoned', 'demilestoned', 'locked', 'unlocked', 'merged', 'base_ref_changed'].includes(e.event))
            .map((e) => ({
              id: String(e.id ?? `${e.event}-${e.created_at}`),
              event: e.event,
              actor: e.actor?.login,
              avatar: e.actor?.avatar_url,
              at: e.created_at,
              label: e.label ? { name: e.label.name, color: e.label.color } : undefined,
              assignee: e.assignee?.login,
              reviewer: e.requested_reviewer?.login || e.review_requester?.login,
              milestone: e.milestone?.title,
              rename: e.rename ? { from: e.rename.from, to: e.rename.to } : undefined,
              sha: e.commit_id,
            })),
          pr: {
            number: pr.number, title: pr.title, body: pr.body || '', state: pr.state, merged: Boolean(pr.merged), draft: Boolean(pr.draft), url: pr.html_url,
            author: pr.user?.login, authorAvatar: pr.user?.avatar_url, base: pr.base?.ref, head: pr.head?.ref, commits: pr.commits, comments: pr.comments,
            reviewComments: pr.review_comments, additions: pr.additions, deletions: pr.deletions, changedFiles: pr.changed_files, createdAt: pr.created_at,
            mergedAt: pr.merged_at, closedAt: pr.closed_at, mergedBy: pr.merged_by?.login, mergeable: pr.mergeable, mergeableState: pr.mergeable_state,
            labels: (pr.labels || []).map((l: any) => ({ name: l.name, color: l.color })), assignees: (pr.assignees || []).map(u),
            requestedReviewers: (pr.requested_reviewers || []).map(u), milestone: pr.milestone?.title || null, milestoneNumber: pr.milestone?.number ?? null, headRepoDeleted: !pr.head?.repo, headSha: pr.head?.sha, baseSha: pr.base?.sha, headOwner: pr.head?.repo?.owner?.login, mergeCommitSha: pr.merge_commit_sha, locked: Boolean(pr.locked),
          },
          files: files.map((f: any) => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, patch: f.patch || '' })),
          reviews: reviews.filter((r: any) => r.state !== 'PENDING').map((r: any) => ({ id: r.id, user: r.user?.login, avatar: r.user?.avatar_url, state: r.state, body: r.body || '', submittedAt: r.submitted_at })),
          comments: comments.map((c: any) => ({ id: c.id, user: c.user?.login, avatar: c.user?.avatar_url, body: c.body || '', createdAt: c.created_at, url: c.html_url })),
          reviewComments: reviewComments.map((c: any) => ({ id: c.id, user: c.user?.login, avatar: c.user?.avatar_url, body: c.body || '', path: c.path, line: c.line || c.original_line, side: c.side, replyTo: c.in_reply_to_id, createdAt: c.created_at })),
          commitList: commits.map((c: any) => ({ sha: c.sha, message: c.commit?.message || '', author: c.author?.login || c.commit?.author?.name, avatar: c.author?.avatar_url, date: c.commit?.author?.date, url: c.html_url })),
          merge: gql
            ? { status: gql.mergeStateStatus, mergeable: gql.mergeable, reviewDecision: gql.reviewDecision || null, canMergeAsAdmin: Boolean(gql.viewerCanMergeAsAdmin), permission: gql.viewerPermission, inQueue: Boolean(gql.isInMergeQueue) }
            : null,
          checks: gqlChecks.length > 0 ? gqlChecks : [
            ...((checkRuns.ok ? checkRuns.data?.check_runs : []) || []).map((c: any) => ({ id: `r${c.id}`, name: c.name, status: c.status, conclusion: c.conclusion, url: c.html_url, app: c.app?.name, appAvatar: c.app?.owner?.avatar_url, description: c.output?.title || c.output?.summary?.slice(0, 160) || '' })),
            ...((statuses.ok ? statuses.data?.statuses : []) || []).map((c: any) => ({ id: `s${c.id}`, name: c.context, status: c.state === 'pending' ? 'in_progress' : 'completed', conclusion: c.state === 'success' ? 'success' : c.state === 'pending' ? null : 'failure', url: c.target_url, app: 'status', description: c.description || '' })),
          ],
        };
      }
      case 'workflowList': {
        const d = await this.ghGetOrThrow(this.repoUrl(owner, repo, '/actions/workflows?per_page=100'));
        return (d.workflows || []).map((w: any) => ({ id: w.id, name: w.name, path: w.path, state: w.state }));
      }
      case 'workflowRuns': {
        // execuções de um workflow (ou de todos) com os filtros do GitHub Actions
        const q = new URLSearchParams({ per_page: String(p.perPage || 30), page: String(p.page || 1) });
        for (const k of ['branch', 'event', 'status', 'actor'] as const) if (p[k]) q.set(k, String(p[k]));
        const path = p.workflowId ? `/actions/workflows/${p.workflowId}/runs` : '/actions/runs';
        const d = await this.ghGetOrThrow(this.repoUrl(owner, repo, `${path}?${q.toString()}`));
        return {
          total: d.total_count || 0,
          runs: (d.workflow_runs || []).map((r: any) => ({
            id: r.id,
            workflowId: r.workflow_id,
            name: r.name,
            title: r.display_title,
            runNumber: r.run_number,
            attempt: r.run_attempt,
            event: r.event,
            status: r.status,
            conclusion: r.conclusion,
            branch: r.head_branch,
            sha: r.head_sha,
            actor: r.triggering_actor?.login || r.actor?.login,
            actorAvatar: r.triggering_actor?.avatar_url || r.actor?.avatar_url,
            createdAt: r.created_at,
            startedAt: r.run_started_at || r.created_at,
            updatedAt: r.updated_at,
            url: r.html_url,
            prNumbers: (r.pull_requests || []).map((x: any) => x.number),
          })),
        };
      }
      case 'workflowRunDetail': {
        const [run, jobs] = await Promise.all([
          this.ghGetOrThrow(this.repoUrl(owner, repo, `/actions/runs/${p.runId}`)),
          this.ghGetOrThrow(this.repoUrl(owner, repo, `/actions/runs/${p.runId}/jobs?per_page=100`)),
        ]);
        return {
          run: {
            id: run.id,
            workflowId: run.workflow_id,
            name: run.name,
            title: run.display_title,
            runNumber: run.run_number,
            attempt: run.run_attempt,
            event: run.event,
            status: run.status,
            conclusion: run.conclusion,
            branch: run.head_branch,
            sha: run.head_sha,
            commit: String(run.head_commit?.message || '').split('\n')[0],
            actor: run.triggering_actor?.login || run.actor?.login,
            actorAvatar: run.triggering_actor?.avatar_url || run.actor?.avatar_url,
            createdAt: run.created_at,
            startedAt: run.run_started_at || run.created_at,
            updatedAt: run.updated_at,
            url: run.html_url,
            path: run.path,
          },
          jobs: (jobs.jobs || []).map((j: any) => ({
            id: j.id,
            name: j.name,
            status: j.status,
            conclusion: j.conclusion,
            startedAt: j.started_at,
            completedAt: j.completed_at,
            url: j.html_url,
            runner: j.runner_name,
            steps: (j.steps || []).map((st: any) => ({ number: st.number, name: st.name, status: st.status, conclusion: st.conclusion, startedAt: st.started_at, completedAt: st.completed_at })),
          })),
        };
      }
      case 'workflowRunAction': {
        const base = this.repoUrl(owner, repo, `/actions/runs/${p.runId}`);
        if (p.op === 'rerun') await this.ghSend('POST', `${base}/rerun`);
        else if (p.op === 'rerunFailed') await this.ghSend('POST', `${base}/rerun-failed-jobs`);
        else if (p.op === 'cancel') await this.ghSend('POST', `${base}/cancel`);
        else if (p.op === 'forceCancel') await this.ghSend('POST', `${base}/force-cancel`);
        else if (p.op === 'delete') await this.ghSend('DELETE', base);
        else throw new Error(`Operação desconhecida: ${p.op}`);
        return { ok: true };
      }
      case 'dispatchWorkflow':
        await this.ghSend('POST', this.repoUrl(owner, repo, `/actions/workflows/${p.workflowId}/dispatches`), { ref: p.ref, ...(p.inputs ? { inputs: p.inputs } : {}) });
        return { ok: true };
      case 'setWorkflowState':
        await this.ghSend('PUT', this.repoUrl(owner, repo, `/actions/workflows/${p.workflowId}/${p.enable ? 'enable' : 'disable'}`));
        return { ok: true };
      case 'workflowInputs': {
        // campos do workflow_dispatch lidos do próprio arquivo (nome, descrição, padrão, obrigatório, opções)
        const f = await this.ghGet(this.repoUrl(owner, repo, `/contents/${p.path}?ref=${encodeURIComponent(p.ref || '')}`));
        if (!f.ok) return { dispatchable: false, inputs: [] };
        const text = Buffer.from(String(f.data?.content || ''), 'base64').toString('utf8');
        const dispatchable = /^\s*workflow_dispatch\b/m.test(text);
        const inputs: any[] = [];
        const block = text.match(/workflow_dispatch:\s*\n\s+inputs:\s*\n([\s\S]*?)(?=^\S|^\s{0,3}\w[\w-]*:\s*(?:\n|$)(?!\s{5}))/m);
        if (dispatchable && block) {
          let cur: any = null;
          for (const line of block[1].split('\n')) {
            const k = line.match(/^\s{6}([\w-]+):\s*$/);
            if (k) {
              cur = { name: k[1], description: '', default: '', required: false, type: 'string', options: [] as string[] };
              inputs.push(cur);
              continue;
            }
            if (!cur) continue;
            const kv = line.match(/^\s{8}(description|default|required|type):\s*(.*)$/);
            if (kv) {
              const v = kv[2].trim().replace(/^['"]|['"]$/g, '');
              if (kv[1] === 'required') cur.required = v === 'true';
              else cur[kv[1]] = v;
              continue;
            }
            const opt = line.match(/^\s{10}-\s*(.+)$/);
            if (opt) cur.options.push(opt[1].trim().replace(/^['"]|['"]$/g, ''));
          }
        }
        return { dispatchable, inputs };
      }
      case 'checkRunDetail': {
        // passos do job do GitHub Actions e o log de cada um (linhas do log atribuídas ao passo pelo horário)
        const job = await this.ghGet(this.repoUrl(owner, repo, `/actions/jobs/${p.checkRunId}`));
        if (!job.ok) return { steps: [], note: 'Este check não é um job do GitHub Actions: abra os detalhes para ver o resultado.' };
        const steps: any[] = (job.data?.steps || []).map((st: any) => ({
          number: st.number,
          name: st.name,
          status: st.status,
          conclusion: st.conclusion,
          startedAt: st.started_at,
          completedAt: st.completed_at,
          log: [] as string[],
        }));
        let note = '';
        if (job.data?.status !== 'completed') return { steps, note: 'O log completo fica disponível quando o job termina.' };
        try {
          const res = await this.authedFetch(this.repoUrl(owner, repo, `/actions/jobs/${p.checkRunId}/logs`), { headers: { Accept: 'application/vnd.github+json' } });
          if (res.ok) {
            const text = await res.text();
            let cur = 0;
            for (const raw of text.split('\n')) {
              const m = raw.match(/^(\d{4}-\d{2}-\d{2}T[\d:.]+Z)\s?(.*)$/);
              if (!m) continue;
              const t = Date.parse(m[1]);
              // avança para o passo cujo intervalo contém o horário da linha
              while (cur < steps.length - 1 && steps[cur + 1].startedAt && t >= Date.parse(steps[cur + 1].startedAt)) cur++;
              const line = m[2].replace(/\x1b\[[0-9;]*m/g, '').replace(/^##\[group\]/, '▶ ').replace(/^##\[endgroup\]$/, '').replace(/^##\[error\]/, 'Erro: ');
              if (steps[cur] && line !== '' && steps[cur].log.length < 400) steps[cur].log.push(line);
            }
          } else {
            note = res.status === 410 ? 'O log desta execução expirou.' : 'Não foi possível baixar o log (verifique a permissão do token para Actions).';
          }
        } catch {
          note = 'Não foi possível baixar o log.';
        }
        return { steps, note };
      }
      case 'pullMeta': {
        // dados da coluna lateral que só o GraphQL entrega: issues que serão fechadas, projetos, inscrição e id do nó
        const d = await this.graphql(
          `query($owner:String!,$name:String!,$n:Int!){ repository(owner:$owner,name:$name){ pullRequest(number:$n){
            id isDraft locked viewerSubscription viewerCanUpdate viewerCanEnableAutoMerge viewerCanDisableAutoMerge
            autoMergeRequest{ enabledBy{ login } mergeMethod }
            closingIssuesReferences(first:20){ nodes{ number title state url repository{ nameWithOwner } linkedBranches(first:5){ nodes{ ref{ name } } } } }
            projectItems(first:20){ nodes{ id project{ id title url } } }
          } } }`,
          { owner, name: repo, n: p.number },
          'Erro ao carregar dados do pull request',
        );
        const pr = d?.repository?.pullRequest;
        return {
          nodeId: pr?.id,
          isDraft: Boolean(pr?.isDraft),
          locked: Boolean(pr?.locked),
          subscription: pr?.viewerSubscription || 'UNSUBSCRIBED',
          canUpdate: Boolean(pr?.viewerCanUpdate),
          canAutoMerge: Boolean(pr?.viewerCanEnableAutoMerge || pr?.viewerCanDisableAutoMerge),
          autoMerge: pr?.autoMergeRequest ? { by: pr.autoMergeRequest.enabledBy?.login, method: String(pr.autoMergeRequest.mergeMethod || '').toLowerCase() } : null,
          closing: (pr?.closingIssuesReferences?.nodes || []).map((i: any) => ({ number: i.number, title: i.title, state: i.state, url: i.url, repo: i.repository?.nameWithOwner, branches: (i.linkedBranches?.nodes || []).map((b: any) => b.ref?.name).filter(Boolean) })),
          projects: (pr?.projectItems?.nodes || []).map((i: any) => ({ itemId: i.id, id: i.project?.id, title: i.project?.title, url: i.project?.url })),
        };
      }
      case 'assignableUsers': {
        // todas as pessoas que podem ser escolhidas: atribuíveis do repositório, colaboradores, membros da organização
        // e quem aparece nos itens dos Projects vinculados ao repositório
        const map = new Map<string, { login: string; avatar?: string }>();
        const add = (u: any) => {
          const login = u?.login;
          if (login && !map.has(login)) map.set(login, { login, avatar: u.avatar_url || u.avatarUrl });
        };
        const pages = async (url: string) => {
          for (let page = 1; page <= 5; page++) {
            const r = await this.ghGet(`${url}${url.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
            if (!r.ok || !Array.isArray(r.data) || r.data.length === 0) break;
            r.data.forEach(add);
            if (r.data.length < 100) break;
          }
        };
        const repoInfo = await this.ghGet(this.repoUrl(owner, repo));
        const jobs: Array<Promise<any>> = [pages(this.repoUrl(owner, repo, '/assignees')), pages(this.repoUrl(owner, repo, '/collaborators?affiliation=all'))];
        if (repoInfo.data?.owner?.type === 'Organization') jobs.push(pages(`https://api.github.com/orgs/${owner}/members`));
        jobs.push(
          this.graphql(
            `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){ projectsV2(first:5){ nodes{ items(first:100){ nodes{ content{
              ... on Issue{ assignees(first:5){ nodes{ login avatarUrl } } } ... on PullRequest{ assignees(first:5){ nodes{ login avatarUrl } } } } } } } } } }`,
            { owner, name: repo },
            'Erro ao listar pessoas do Project',
          )
            .then((d: any) => (d?.repository?.projectsV2?.nodes || []).forEach((pj: any) => (pj?.items?.nodes || []).forEach((it: any) => (it?.content?.assignees?.nodes || []).forEach(add))))
            .catch(() => {}),
        );
        await Promise.allSettled(jobs);
        return [...map.values()].sort((x, y) => x.login.localeCompare(y.login));
      }
      case 'repoLabels': {
        const labels = await this.ghGetOrThrow(this.repoUrl(owner, repo, '/labels?per_page=100'));
        return labels.map((l: any) => ({ name: l.name, color: l.color, description: l.description || '' }));
      }
      case 'repoMilestones': {
        const ms = await this.ghGetOrThrow(this.repoUrl(owner, repo, '/milestones?state=open&per_page=100'));
        return ms.map((m: any) => ({ number: m.number, title: m.title, dueOn: m.due_on }));
      }
      case 'ownerProjects': {
        const d = await this.graphql(
          `query($owner:String!,$name:String!){ repository(owner:$owner,name:$name){
            projectsV2(first:30){ nodes{ id title closed } }
            owner{ ... on Organization{ projectsV2(first:30){ nodes{ id title closed } } } ... on User{ projectsV2(first:30){ nodes{ id title closed } } } }
          } }`,
          { owner, name: repo },
          'Erro ao listar Projects',
        );
        const seen = new Set<string>();
        return [...(d?.repository?.projectsV2?.nodes || []), ...(d?.repository?.owner?.projectsV2?.nodes || [])].filter((x: any) => x && !x.closed && !seen.has(x.id) && seen.add(x.id)).map((x: any) => ({ id: x.id, title: x.title }));
      }
      case 'setPullLabels':
        await this.ghSend('PUT', this.repoUrl(owner, repo, `/issues/${p.number}/labels`), { labels: p.labels });
        return { ok: true };
      case 'setPullAssignees':
        await this.ghSend('PATCH', this.repoUrl(owner, repo, `/issues/${p.number}`), { assignees: p.assignees });
        return { ok: true };
      case 'setPullMilestone':
        await this.ghSend('PATCH', this.repoUrl(owner, repo, `/issues/${p.number}`), { milestone: p.milestone ?? null });
        return { ok: true };
      case 'requestPullReviewers': {
        const url = this.repoUrl(owner, repo, `/pulls/${p.number}/requested_reviewers`);
        if (p.add?.length) await this.ghSend('POST', url, { reviewers: p.add });
        if (p.remove?.length) await this.ghSend('DELETE', url, { reviewers: p.remove });
        return { ok: true };
      }
      case 'setPullDraft':
        await this.graphql(
          p.draft
            ? `mutation($id:ID!){ convertPullRequestToDraft(input:{pullRequestId:$id}){ pullRequest{ id } } }`
            : `mutation($id:ID!){ markPullRequestReadyForReview(input:{pullRequestId:$id}){ pullRequest{ id } } }`,
          { id: p.nodeId },
          p.draft ? 'Erro ao converter para rascunho' : 'Erro ao marcar como pronto para review',
        );
        return { ok: true };
      case 'setPullSubscription':
        await this.graphql(`mutation($id:ID!,$st:SubscriptionState!){ updateSubscription(input:{subscribableId:$id,state:$st}){ subscribable{ id } } }`, { id: p.nodeId, st: p.state }, 'Erro ao alterar notificações');
        return { ok: true };
      case 'setPullLock':
        if (p.locked) await this.ghSend('PUT', this.repoUrl(owner, repo, `/issues/${p.number}/lock`), {});
        else await this.ghSend('DELETE', this.repoUrl(owner, repo, `/issues/${p.number}/lock`));
        return { ok: true };
      case 'addPullToProject':
        await this.graphql(`mutation($p:ID!,$c:ID!){ addProjectV2ItemById(input:{projectId:$p,contentId:$c}){ item{ id } } }`, { p: p.projectId, c: p.nodeId }, 'Erro ao adicionar ao Project');
        return { ok: true };
      case 'removePullFromProject':
        await this.graphql(`mutation($p:ID!,$i:ID!){ deleteProjectV2Item(input:{projectId:$p,itemId:$i}){ deletedItemId } }`, { p: p.projectId, i: p.itemId }, 'Erro ao remover do Project');
        return { ok: true };
      case 'unlinkIssueFromPull': {
        const url = this.repoUrl(owner, repo, `/pulls/${p.number}`);
        const pr = await this.ghGetOrThrow(url);
        const body: string = (pr.body || '').replace(new RegExp(`\\s*\\b(close[sd]?|fix(e[sd])?|resolve[sd]?)\\s+(?:[\\w.-]+/[\\w.-]+)?#${p.issueNumber}\\b`, 'ig'), '').trimEnd();
        await this.ghSend('PATCH', url, { body });
        return { ok: true };
      }
      case 'updatePullBranch':
        // atualiza a branch do PR com a base (merge ou rebase)
        await this.graphql(`mutation($id:ID!,$m:PullRequestBranchUpdateMethod!){ updatePullRequestBranch(input:{pullRequestId:$id,updateMethod:$m}){ pullRequest{ id } } }`, { id: p.nodeId, m: p.method === 'rebase' ? 'REBASE' : 'MERGE' }, 'Erro ao atualizar a branch');
        return { ok: true };
      case 'deletePullBranch':
        await this.ghSend('DELETE', this.repoUrl(owner, repo, `/git/refs/heads/${String(p.ref).split('/').map(encodeURIComponent).join('/')}`));
        return { ok: true };
      case 'restorePullBranch':
        await this.ghSend('POST', this.repoUrl(owner, repo, '/git/refs'), { ref: `refs/heads/${p.ref}`, sha: p.sha });
        return { ok: true };
      case 'revertPull': {
        const d = await this.graphql(`mutation($id:ID!){ revertPullRequest(input:{pullRequestId:$id}){ revertPullRequest{ number url } } }`, { id: p.nodeId }, 'Erro ao reverter o pull request');
        return d?.revertPullRequest?.revertPullRequest || null;
      }
      case 'setAutoMerge':
        if (p.enable) await this.graphql(`mutation($id:ID!,$m:PullRequestMergeMethod!){ enablePullRequestAutoMerge(input:{pullRequestId:$id,mergeMethod:$m}){ pullRequest{ id } } }`, { id: p.nodeId, m: String(p.method || 'merge').toUpperCase() }, 'Erro ao ativar o merge automático');
        else await this.graphql(`mutation($id:ID!){ disablePullRequestAutoMerge(input:{pullRequestId:$id}){ pullRequest{ id } } }`, { id: p.nodeId }, 'Erro ao desativar o merge automático');
        return { ok: true };
      case 'editPull': {
        const patch: any = {};
        if (typeof p.title === 'string') patch.title = p.title;
        if (typeof p.body === 'string') patch.body = p.body;
        if (typeof p.base === 'string') patch.base = p.base;
        await this.ghSend('PATCH', this.repoUrl(owner, repo, `/pulls/${p.number}`), patch);
        return { ok: true };
      }
      case 'editComment':
        await this.ghSend('PATCH', this.repoUrl(owner, repo, `/issues/comments/${p.id}`), { body: p.body });
        return { ok: true };
      case 'deleteComment':
        await this.ghSend('DELETE', this.repoUrl(owner, repo, `/issues/comments/${p.id}`));
        return { ok: true };
      case 'addReviewComment':
        // comentário numa linha do diff (lado novo = RIGHT, lado antigo = LEFT)
        await this.ghSend('POST', this.repoUrl(owner, repo, `/pulls/${p.number}/comments`), { body: p.body, commit_id: p.commitId, path: p.path, line: p.line, side: p.side === 'LEFT' ? 'LEFT' : 'RIGHT' });
        return { ok: true };
      case 'replyReviewComment':
        await this.ghSend('POST', this.repoUrl(owner, repo, `/pulls/${p.number}/comments/${p.commentId}/replies`), { body: p.body });
        return { ok: true };
      case 'addPullComment':
        await this.ghSend('POST', this.repoUrl(owner, repo, `/issues/${p.number}/comments`), { body: p.body });
        return { ok: true };
      case 'setPullState':
        await this.ghSend('PATCH', this.repoUrl(owner, repo, `/pulls/${p.number}`), { state: p.state });
        return { ok: true };
      case 'mergePull':
        return this.ghSend('PUT', this.repoUrl(owner, repo, `/pulls/${p.number}/merge`), { merge_method: p.method || 'merge', ...(p.title ? { commit_title: p.title } : {}), ...(p.message ? { commit_message: p.message } : {}) });
      case 'assignPull':
        await this.ghSend('POST', this.repoUrl(owner, repo, `/issues/${p.number}/assignees`), { assignees: p.assignees });
        return { ok: true };
      case 'getPullReview': {
        const base = this.repoUrl(owner, repo, `/pulls/${p.number}`);
        const [pr, files, reviews] = await Promise.all([this.ghGetOrThrow(base), this.ghGetOrThrow(`${base}/files?per_page=100`), this.ghGetOrThrow(`${base}/reviews?per_page=100`)]);
        return {
          pr: {
            number: pr.number,
            title: pr.title,
            body: pr.body || '',
            state: pr.state,
            merged: Boolean(pr.merged),
            draft: Boolean(pr.draft),
            url: pr.html_url,
            author: pr.user?.login,
            authorAvatar: pr.user?.avatar_url,
            base: pr.base?.ref,
            head: pr.head?.ref,
            commits: pr.commits,
            comments: pr.comments,
            reviewComments: pr.review_comments,
            additions: pr.additions,
            deletions: pr.deletions,
            createdAt: pr.created_at,
          },
          files: files.map((f: any) => ({ filename: f.filename, status: f.status, additions: f.additions, deletions: f.deletions, patch: f.patch || '' })),
          reviews: reviews
            .filter((r: any) => r.state !== 'PENDING')
            .map((r: any) => ({ id: r.id, user: r.user?.login, avatar: r.user?.avatar_url, state: r.state, body: r.body || '', submittedAt: r.submitted_at })),
        };
      }
      case 'submitReview':
        return this.submitPullReview(owner, repo, p.number, p.event, p.body);
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
        return this.writeFileOrPr(owner, repo, 'PUT', p, {
          message: p.message,
          content: Buffer.from(p.content, 'utf8').toString('base64'),
          ...(p.sha ? { sha: p.sha } : {}),
          ...(p.branch ? { branch: p.branch } : {}),
        });
      case 'deleteFile':
        return this.writeFileOrPr(owner, repo, 'DELETE', p, { message: p.message, sha: p.sha });
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
