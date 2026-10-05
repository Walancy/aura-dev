import React, { useEffect, useState } from 'react';
import { GitBranch, GitMerge, Shield } from 'lucide-react';
import { Panel, Pill, SmallButton, inputStyle, selectStyle } from '../../team/teamUi';
import { Field, NumberInput, Notice, Toggle, ghSettings, ignoredMessage, patchRepoVerified, type SectionProps } from '../settingsUi';

interface ProtectionDraft {
  requirePr: boolean;
  approvals: number;
  dismissStale: boolean;
  codeOwners: boolean;
  requireChecks: boolean;
  strict: boolean;
  contexts: string;
  enforceAdmins: boolean;
  linearHistory: boolean;
  conversationResolution: boolean;
  allowForcePushes: boolean;
  allowDeletions: boolean;
}

const EMPTY: ProtectionDraft = {
  requirePr: true,
  approvals: 1,
  dismissStale: true,
  codeOwners: false,
  requireChecks: false,
  strict: false,
  contexts: '',
  enforceAdmins: false,
  linearHistory: false,
  conversationResolution: true,
  allowForcePushes: false,
  allowDeletions: false,
};

const fromApi = (p: any): ProtectionDraft => ({
  requirePr: Boolean(p.required_pull_request_reviews),
  approvals: p.required_pull_request_reviews?.required_approving_review_count ?? 1,
  dismissStale: Boolean(p.required_pull_request_reviews?.dismiss_stale_reviews),
  codeOwners: Boolean(p.required_pull_request_reviews?.require_code_owner_reviews),
  requireChecks: Boolean(p.required_status_checks),
  strict: Boolean(p.required_status_checks?.strict),
  contexts: (p.required_status_checks?.contexts || []).join(', '),
  enforceAdmins: Boolean(p.enforce_admins?.enabled),
  linearHistory: Boolean(p.required_linear_history?.enabled),
  conversationResolution: Boolean(p.required_conversation_resolution?.enabled),
  allowForcePushes: Boolean(p.allow_force_pushes?.enabled),
  allowDeletions: Boolean(p.allow_deletions?.enabled),
});

const toApi = (d: ProtectionDraft) => ({
  required_status_checks: d.requireChecks
    ? {
        strict: d.strict,
        contexts: d.contexts
          .split(',')
          .map((c) => c.trim())
          .filter(Boolean),
      }
    : null,
  enforce_admins: d.enforceAdmins,
  required_pull_request_reviews: d.requirePr
    ? { required_approving_review_count: d.approvals, dismiss_stale_reviews: d.dismissStale, require_code_owner_reviews: d.codeOwners }
    : null,
  restrictions: null,
  required_linear_history: d.linearHistory,
  allow_force_pushes: d.allowForcePushes,
  allow_deletions: d.allowDeletions,
  required_conversation_resolution: d.conversationResolution,
});

export const BranchesSection: React.FC<SectionProps & { branches: Array<{ name: string; protected: boolean }>; reloadBranches: () => void }> = ({
  ctx,
  owner,
  repo,
  repoInfo,
  isAdmin,
  reloadRepo,
  showToast,
  confirm,
  branches,
  reloadBranches,
}) => {
  const { theme, accentColor } = ctx;
  const [branch, setBranch] = useState<string>(repoInfo?.default_branch || '');
  const [draft, setDraft] = useState<ProtectionDraft | null>(null);
  const [isProtected, setIsProtected] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [checkSuggestions, setCheckSuggestions] = useState<string[]>([]);

  useEffect(() => {
    if (!branch && repoInfo?.default_branch) setBranch(repoInfo.default_branch);
  }, [repoInfo, branch]);

  useEffect(() => {
    if (!branch) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    ghSettings('getBranchProtection', { owner, repo, branch })
      .then((p) => {
        if (cancelled) return;
        setIsProtected(Boolean(p));
        setDraft(p ? fromApi(p) : { ...EMPTY });
      })
      .catch((e) => !cancelled && (setError(e.message), setDraft({ ...EMPTY })))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [owner, repo, branch]);

  useEffect(() => {
    ghSettings<any[]>('listWorkflowRuns', { owner, repo, perPage: 30 })
      .then((runs) => setCheckSuggestions(Array.from(new Set(runs.map((r) => r.name).filter(Boolean)))))
      .catch(() => {});
  }, [owner, repo]);

  const mergeToggle = async (key: string, value: boolean, label: string) => {
    if (!value && key.startsWith('allow_') && key.endsWith('merge') && ['allow_squash_merge', 'allow_merge_commit', 'allow_rebase_merge'].filter((k) => k !== key && repoInfo?.[k]).length === 0) {
      showToast('Pelo menos um método de merge precisa ficar ativo.');
      return;
    }
    try {
      const { ignored } = await patchRepoVerified(owner, repo, { [key]: value });
      showToast(ignored.length ? ignoredMessage(ignored) : `${label} ${value ? 'ativado' : 'desativado'}.`);
      await reloadRepo();
    } catch (e: any) {
      showToast(`Falhou: ${e.message}`);
    }
  };

  const saveProtection = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      await ghSettings('setBranchProtection', { owner, repo, branch, body: toApi(draft) });
      setIsProtected(true);
      showToast(`Proteção de "${branch}" salva.`);
      reloadBranches();
    } catch (e: any) {
      showToast(`Falhou: ${e.message}${/403|upgrade|plan/i.test(e.message) ? ' — repositórios privados precisam de plano pago para proteção de branch.' : ''}`);
    } finally {
      setSaving(false);
    }
  };

  const set = (patch: Partial<ProtectionDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const dis = !isAdmin || loading;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Panel ctx={ctx} icon={<GitMerge size={14} color={accentColor} />} title="Regras de merge">
        {!isAdmin && <Notice ctx={ctx} tone="warning">Somente admins podem alterar as regras de merge e proteção.</Notice>}
        {(
          [
            ['allow_squash_merge', 'Squash merge', 'Junta todos os commits do PR em um só.'],
            ['allow_merge_commit', 'Merge commit', 'Mantém todos os commits e cria um commit de merge.'],
            ['allow_rebase_merge', 'Rebase merge', 'Reaplica os commits do PR sobre a base.'],
            ['delete_branch_on_merge', 'Apagar branch após o merge', 'Remove a branch do PR automaticamente.'],
            ['allow_auto_merge', 'Auto-merge', 'Permite marcar PRs para mergear sozinhos quando os requisitos forem cumpridos.'],
            ['allow_update_branch', 'Sugerir atualizar a branch', 'Mostra o botão "Update branch" quando a base avança.'],
          ] as const
        ).map(([key, label, hint]) => (
          <Field key={key} ctx={ctx} label={label} hint={hint}>
            <Toggle ctx={ctx} disabled={!isAdmin || !repoInfo} checked={Boolean(repoInfo?.[key])} onChange={(v) => mergeToggle(key, v, label)} />
          </Field>
        ))}
      </Panel>

      <Panel
        ctx={ctx}
        icon={<Shield size={14} color={accentColor} />}
        title="Proteção de branch"
        right={
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <GitBranch size={12} color={theme.textSecondary} />
            <select value={branch} onChange={(e) => setBranch(e.target.value)} style={selectStyle(ctx)}>
              {branches.map((b) => (
                <option key={b.name} value={b.name}>
                  {b.name}
                  {b.protected ? ' 🔒' : ''}
                </option>
              ))}
            </select>
            {isProtected ? <Pill color="#22c55e">protegida</Pill> : <Pill color={theme.textSecondary}>sem proteção</Pill>}
          </div>
        }
      >
        {error && <Notice ctx={ctx} tone="warning">{error}</Notice>}
        {draft && (
          <>
            <Field ctx={ctx} label="Exigir pull request antes do merge" hint="Bloqueia push direto nesta branch.">
              <Toggle ctx={ctx} disabled={dis} checked={draft.requirePr} onChange={(v) => set({ requirePr: v })} />
            </Field>
            {draft.requirePr && (
              <>
                <Field ctx={ctx} label="Aprovações necessárias">
                  <NumberInput ctx={ctx} value={draft.approvals} min={0} max={6} onChange={(v) => set({ approvals: v })} />
                </Field>
                <Field ctx={ctx} label="Descartar aprovações antigas" hint="Novos commits invalidam aprovações anteriores.">
                  <Toggle ctx={ctx} disabled={dis} checked={draft.dismissStale} onChange={(v) => set({ dismissStale: v })} />
                </Field>
                <Field ctx={ctx} label="Exigir review do CODEOWNERS" hint="Donos da área alterada precisam aprovar (veja Time → Times).">
                  <Toggle ctx={ctx} disabled={dis} checked={draft.codeOwners} onChange={(v) => set({ codeOwners: v })} />
                </Field>
              </>
            )}
            <Field ctx={ctx} label="Exigir status checks" hint="O CI precisa passar antes do merge.">
              <Toggle ctx={ctx} disabled={dis} checked={draft.requireChecks} onChange={(v) => set({ requireChecks: v })} />
            </Field>
            {draft.requireChecks && (
              <>
                <Field ctx={ctx} label="Checks obrigatórios" hint="Nomes dos jobs, separados por vírgula." wide>
                  <input disabled={dis} value={draft.contexts} onChange={(e) => set({ contexts: e.target.value })} style={inputStyle(ctx)} placeholder="build, test" />
                  {checkSuggestions.length > 0 && (
                    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {checkSuggestions.map((c) => (
                        <Pill key={c} color={accentColor} onClick={() => set({ contexts: Array.from(new Set([...draft.contexts.split(',').map((x) => x.trim()).filter(Boolean), c])).join(', ') })}>
                          + {c}
                        </Pill>
                      ))}
                    </div>
                  )}
                </Field>
                <Field ctx={ctx} label="Branch atualizada com a base" hint="Exige rebase/merge da base antes de mergear.">
                  <Toggle ctx={ctx} disabled={dis} checked={draft.strict} onChange={(v) => set({ strict: v })} />
                </Field>
              </>
            )}
            <Field ctx={ctx} label="Exigir conversas resolvidas">
              <Toggle ctx={ctx} disabled={dis} checked={draft.conversationResolution} onChange={(v) => set({ conversationResolution: v })} />
            </Field>
            <Field ctx={ctx} label="Histórico linear" hint="Proíbe merge commits nesta branch.">
              <Toggle ctx={ctx} disabled={dis} checked={draft.linearHistory} onChange={(v) => set({ linearHistory: v })} />
            </Field>
            <Field ctx={ctx} label="Aplicar também aos admins">
              <Toggle ctx={ctx} disabled={dis} checked={draft.enforceAdmins} onChange={(v) => set({ enforceAdmins: v })} />
            </Field>
            <Field ctx={ctx} label="Permitir force push">
              <Toggle ctx={ctx} disabled={dis} checked={draft.allowForcePushes} onChange={(v) => set({ allowForcePushes: v })} />
            </Field>
            <Field ctx={ctx} label="Permitir apagar a branch">
              <Toggle ctx={ctx} disabled={dis} checked={draft.allowDeletions} onChange={(v) => set({ allowDeletions: v })} />
            </Field>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, paddingTop: 6 }}>
              {isProtected && (
                <SmallButton
                  ctx={ctx}
                  danger
                  disabled={dis}
                  onClick={() =>
                    confirm({
                      title: 'Remover proteção',
                      message: `Remover todas as regras de proteção da branch "${branch}"?`,
                      itemDescription: 'Qualquer pessoa com escrita poderá dar push direto.',
                      confirmLabel: 'Remover proteção',
                      onConfirm: async () => {
                        try {
                          await ghSettings('removeBranchProtection', { owner, repo, branch });
                          setIsProtected(false);
                          setDraft({ ...EMPTY });
                          showToast('Proteção removida.');
                          reloadBranches();
                        } catch (e: any) {
                          showToast(`Falhou: ${e.message}`);
                        }
                      },
                    })
                  }
                >
                  Remover proteção
                </SmallButton>
              )}
              <SmallButton ctx={ctx} primary disabled={dis || saving} onClick={saveProtection}>
                {saving ? 'Salvando…' : isProtected ? 'Salvar regras' : 'Proteger branch'}
              </SmallButton>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
};
