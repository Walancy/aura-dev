import { useCallback, useEffect, useRef, useState } from 'react';
import {
  loadPeopleData,
  loadRepoTeamData,
  savePeopleData,
  saveRepoTeamData,
  type AccessHistoryEntry,
  type PersonLocalData,
  type RepoRole,
  type RepoTeamLocalData,
  type TeamInsightsRaw,
} from './teamTypes';

// Cache em memória entre trocas de aba/projeto (o fetch faz ~15 chamadas à API)
const INSIGHTS_CACHE = new Map<string, { raw: TeamInsightsRaw; fetchedAt: number }>();
const MATRIX_CACHE = new Map<string, Record<string, Record<string, string>>>();
const STALE_MS = 5 * 60 * 1000;

interface Options {
  repoFullName?: string;
  currentUserLogin?: string;
  showToast: (msg: string) => void;
  onIssuesChanged?: () => void;
}

export function useTeamWorkspace({ repoFullName, currentUserLogin, showToast, onIssuesChanged }: Options) {
  const [owner, repo] = (repoFullName || '').split('/');
  const cached = repoFullName ? INSIGHTS_CACHE.get(repoFullName) : undefined;
  const [raw, setRaw] = useState<TeamInsightsRaw | null>(cached?.raw || null);
  const [fetchedAt, setFetchedAt] = useState<number | null>(cached?.fetchedAt || null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orgTeams, setOrgTeams] = useState<Array<{ slug: string; name: string; description: string }>>([]);
  const [people, setPeople] = useState<Record<string, PersonLocalData>>(() => loadPeopleData());
  const [repoData, setRepoData] = useState<RepoTeamLocalData>(() => (repoFullName ? loadRepoTeamData(repoFullName) : { onboarding: {}, history: [] }));
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const reqId = useRef(0);

  const refresh = useCallback(
    async (force = false) => {
      if (!owner || !repo || !repoFullName) return;
      const hit = INSIGHTS_CACHE.get(repoFullName);
      if (!force && hit && Date.now() - hit.fetchedAt < STALE_MS) {
        setRaw(hit.raw);
        setFetchedAt(hit.fetchedAt);
        return;
      }
      const id = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        const res = await window.electronAPI?.github?.fetchTeamInsights?.(owner, repo);
        if (id !== reqId.current) return;
        if (res?.success && res.insights) {
          const now = Date.now();
          INSIGHTS_CACHE.set(repoFullName, { raw: res.insights, fetchedAt: now });
          setRaw(res.insights);
          setFetchedAt(now);
          if (res.insights.isOrg) {
            const t = await window.electronAPI?.github?.fetchOrgTeams?.(owner);
            if (t?.success && t.teams) setOrgTeams(t.teams);
          }
        } else {
          setError(res?.error || 'Não foi possível carregar os dados do time.');
        }
      } catch (e: any) {
        if (id === reqId.current) setError(e?.message || 'Erro ao carregar dados do time.');
      } finally {
        if (id === reqId.current) setLoading(false);
      }
    },
    [owner, repo, repoFullName],
  );

  useEffect(() => {
    if (!repoFullName) return;
    const hit = INSIGHTS_CACHE.get(repoFullName);
    setRaw(hit?.raw || null);
    setFetchedAt(hit?.fetchedAt || null);
    setRepoData(loadRepoTeamData(repoFullName));
    refresh(false);
  }, [repoFullName, refresh]);

  const setPerson = useCallback((login: string, patch: Partial<PersonLocalData>) => {
    setPeople((prev) => {
      const key = login.toLowerCase();
      const next = { ...prev, [key]: { ...prev[key], ...patch } };
      savePeopleData(next);
      return next;
    });
  }, []);

  const updateRepoData = useCallback(
    (fn: (prev: RepoTeamLocalData) => RepoTeamLocalData) => {
      if (!repoFullName) return;
      setRepoData((prev) => {
        const next = fn(prev);
        saveRepoTeamData(repoFullName, next);
        return next;
      });
    },
    [repoFullName],
  );

  const log = useCallback(
    (action: AccessHistoryEntry['action'], target: string, detail?: string) =>
      updateRepoData((prev) => ({
        ...prev,
        history: [
          { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, at: new Date().toISOString(), actor: currentUserLogin || 'você', action, target, detail },
          ...prev.history,
        ],
      })),
    [updateRepoData, currentUserLogin],
  );

  // Executa uma ação no GitHub com feedback, histórico e refresh
  const run = useCallback(
    async (
      key: string,
      call: () => Promise<{ success: boolean; error?: string; [k: string]: any } | undefined>,
      opts: { ok: string; history?: [AccessHistoryEntry['action'], string, string?]; refreshInsights?: boolean; refreshIssues?: boolean },
    ) => {
      setPendingAction(key);
      try {
        const res = await call();
        if (!res?.success) {
          showToast(`Falhou: ${res?.error || 'API indisponível'}`);
          return false;
        }
        showToast(opts.ok);
        if (opts.history) log(...opts.history);
        if (opts.refreshInsights !== false) refresh(true);
        if (opts.refreshIssues) onIssuesChanged?.();
        return true;
      } catch (e: any) {
        showToast(`Falhou: ${e?.message || e}`);
        return false;
      } finally {
        setPendingAction(null);
      }
    },
    [showToast, log, refresh, onIssuesChanged],
  );

  const gh = window.electronAPI?.github;

  const actions = {
    changeRole: (login: string, role: RepoRole) =>
      run(`role-${login}`, () => gh?.setCollaboratorPermission?.(owner, repo, login, role) as any, {
        ok: `Permissão de @${login} alterada para ${role}.`,
        history: ['role', login, `→ ${role}`],
      }),
    addPerson: (login: string, role: RepoRole) =>
      run(`add-${login}`, () => gh?.setCollaboratorPermission?.(owner, repo, login, role) as any, {
        ok: `Convite enviado para @${login} (${role}).`,
        history: ['add', login, role],
      }),
    removePerson: (login: string) =>
      run(`rm-${login}`, () => gh?.removeCollaborator?.(owner, repo, login) as any, {
        ok: `Acesso de @${login} removido.`,
        history: ['remove', login],
      }),
    cancelInvite: (id: number, login: string) =>
      run(`inv-${id}`, () => gh?.cancelInvitation?.(owner, repo, id) as any, {
        ok: `Convite de @${login} cancelado.`,
        history: ['invite-cancel', login],
      }),
    addTeam: (slug: string, role: RepoRole) =>
      run(`team-add-${slug}`, () => gh?.setTeamRepoPermission?.(owner, slug, owner, repo, role) as any, {
        ok: `Time ${slug} adicionado com ${role}.`,
        history: ['team-add', slug, role],
      }),
    changeTeamRole: (slug: string, role: RepoRole) =>
      run(`team-role-${slug}`, () => gh?.setTeamRepoPermission?.(owner, slug, owner, repo, role) as any, {
        ok: `Permissão do time ${slug} alterada para ${role}.`,
        history: ['team-role', slug, `→ ${role}`],
      }),
    removeTeam: (slug: string) =>
      run(`team-rm-${slug}`, () => gh?.removeTeamRepo?.(owner, slug, owner, repo) as any, {
        ok: `Time ${slug} removido do repositório.`,
        history: ['team-remove', slug],
      }),
    createTeam: async (name: string, description: string) => {
      setPendingAction('team-create');
      try {
        const res = await gh?.createTeam?.(owner, name, description);
        if (!res?.success || !res.team?.slug) {
          showToast(`Falhou: ${res?.error || 'API indisponível'}`);
          return false;
        }
        log('team-create', res.team.slug, name);
        // Já concede acesso ao repositório atual
        await gh?.setTeamRepoPermission?.(owner, res.team.slug, owner, repo, 'write');
        showToast(`Time "${name}" criado e adicionado ao repositório com write.`);
        refresh(true);
        return true;
      } finally {
        setPendingAction(null);
      }
    },
    requestReview: (pullNumber: number, login: string) =>
      run(`review-${pullNumber}-${login}`, () => gh?.requestReviewers?.(owner, repo, pullNumber, [login]) as any, {
        ok: `Review do PR #${pullNumber} solicitado a @${login}.`,
        history: ['review-request', login, `PR #${pullNumber}`],
      }),
    approveReview: (pullNumber: number, author: string) =>
      run(`approve-${pullNumber}`, () => gh?.submitPullReview?.(owner, repo, pullNumber, 'APPROVE') as any, {
        ok: `PR #${pullNumber} aprovado.`,
        history: ['review-approve', author, `PR #${pullNumber}`],
      }),
    assignIssue: (issueNumber: number, login: string) =>
      run(`assign-${issueNumber}`, () => gh?.addAssignees?.(owner, repo, issueNumber, [login]) as any, {
        ok: `Issue #${issueNumber} atribuída a @${login}.`,
        history: ['assign', login, `issue #${issueNumber}`],
        refreshInsights: false,
        refreshIssues: true,
      }),
    mention: (issueNumber: number, login: string, message: string) =>
      run(`mention-${issueNumber}`, () => gh?.addIssueComment?.(owner, repo, issueNumber, `@${login} ${message}`.trim()) as any, {
        ok: `@${login} mencionado na issue #${issueNumber}.`,
        refreshInsights: false,
      }),
  };

  // Matriz pessoa × repositório: carregada sob demanda
  const [matrix, setMatrix] = useState<Record<string, Record<string, string>> | null>(null);
  const [matrixLoading, setMatrixLoading] = useState(false);
  const loadMatrix = useCallback(
    async (repoNames: string[], force = false) => {
      const key = repoNames.slice().sort().join('|');
      if (!force && MATRIX_CACHE.has(key)) {
        setMatrix(MATRIX_CACHE.get(key)!);
        return;
      }
      setMatrixLoading(true);
      const result: Record<string, Record<string, string>> = {};
      await Promise.all(
        repoNames.map(async (full) => {
          const [o, r] = full.split('/');
          const res = await window.electronAPI?.github?.fetchCollaboratorPermissions?.(o, r);
          if (!res?.success) {
            result[full] = { __error: res?.error || 'sem acesso' };
            return;
          }
          const row: Record<string, string> = {};
          (res.collaborators || []).forEach((c) => (row[c.login.toLowerCase()] = c.roleName));
          result[full] = row;
        }),
      );
      MATRIX_CACHE.set(key, result);
      setMatrix(result);
      setMatrixLoading(false);
    },
    [],
  );

  return {
    owner,
    repo,
    currentUserLogin,
    raw,
    loading,
    error,
    fetchedAt,
    refresh,
    orgTeams,
    people,
    setPerson,
    repoData,
    updateRepoData,
    pendingAction,
    actions,
    matrix,
    matrixLoading,
    loadMatrix,
  };
}

export type TeamWorkspaceState = ReturnType<typeof useTeamWorkspace>;
