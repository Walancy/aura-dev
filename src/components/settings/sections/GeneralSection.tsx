import React, { useEffect, useState } from 'react';
import { Copy, ExternalLink, Globe, Info, Lock, Sliders, Star, GitFork } from 'lucide-react';
import { Panel, Pill, SmallButton, inputStyle, openUrl, selectStyle } from '../../team/teamUi';
import { Field, Notice, Segmented, Toggle, ghSettings, ignoredMessage, patchRepoVerified, type SectionProps } from '../settingsUi';

export const GeneralSection: React.FC<SectionProps & { branches: string[] }> = ({ ctx, owner, repo, repoInfo, isAdmin, reloadRepo, settings, update, showToast, confirm, branches }) => {
  const { theme, accentColor } = ctx;
  const [draft, setDraft] = useState({ description: '', homepage: '', topics: '', defaultBranch: '' });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!repoInfo) return;
    setDraft({
      description: repoInfo.description || '',
      homepage: repoInfo.homepage || '',
      topics: (repoInfo.topics || []).join(', '),
      defaultBranch: repoInfo.default_branch || '',
    });
  }, [repoInfo]);

  const dirty =
    repoInfo &&
    (draft.description !== (repoInfo.description || '') ||
      draft.homepage !== (repoInfo.homepage || '') ||
      draft.topics !== (repoInfo.topics || []).join(', ') ||
      draft.defaultBranch !== (repoInfo.default_branch || ''));

  const save = async () => {
    if (!repoInfo) return;
    setSaving(true);
    try {
      const patch: any = {};
      if (draft.description !== (repoInfo.description || '')) patch.description = draft.description;
      if (draft.homepage !== (repoInfo.homepage || '')) patch.homepage = draft.homepage;
      if (draft.defaultBranch && draft.defaultBranch !== repoInfo.default_branch) patch.default_branch = draft.defaultBranch;
      if (Object.keys(patch).length) await ghSettings('updateRepo', { owner, repo, patch });
      const topics = draft.topics
        .split(/[,\s]+/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);
      if (topics.join(',') !== (repoInfo.topics || []).join(',')) await ghSettings('setTopics', { owner, repo, names: topics });
      showToast('Repositório atualizado no GitHub.');
      await reloadRepo();
    } catch (e: any) {
      showToast(`Falhou: ${e.message}`);
    } finally {
      setSaving(false);
    }
  };

  const patchRepo = async (patch: any, ok: string) => {
    try {
      const { ignored } = await patchRepoVerified(owner, repo, patch);
      showToast(ignored.length ? ignoredMessage(ignored) : ok);
      await reloadRepo();
    } catch (e: any) {
      showToast(`Falhou: ${e.message}`);
    }
  };

  const stat = (icon: React.ReactNode, label: string, value: React.ReactNode) => (
    <div style={{ background: theme.controlBg, borderRadius: 8, padding: '8px 10px', minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10.5, color: theme.textMuted }}>
        {icon}
        {label}
      </div>
      <div style={{ fontSize: 12.5, color: theme.textPrimary, fontWeight: 500, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Panel
        ctx={ctx}
        icon={<Info size={14} color={accentColor} />}
        title="Repositório"
        right={
          repoInfo && (
            <div style={{ display: 'flex', gap: 4 }}>
              <SmallButton ctx={ctx} onClick={() => { navigator.clipboard?.writeText(repoInfo.clone_url); showToast('URL de clone copiada.'); }}>
                <Copy size={11} /> HTTPS
              </SmallButton>
              <SmallButton ctx={ctx} onClick={() => { navigator.clipboard?.writeText(repoInfo.ssh_url); showToast('URL SSH copiada.'); }}>
                <Copy size={11} /> SSH
              </SmallButton>
              <SmallButton ctx={ctx} onClick={() => openUrl(repoInfo.html_url)}>
                <ExternalLink size={11} /> GitHub
              </SmallButton>
            </div>
          )
        }
      >
        {repoInfo ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 5 }}>
            {stat(repoInfo.private ? <Lock size={11} /> : <Globe size={11} />, 'Visibilidade', repoInfo.visibility || (repoInfo.private ? 'private' : 'public'))}
            {stat(<Star size={11} />, 'Estrelas / forks', `${repoInfo.stargazers_count} / ${repoInfo.forks_count}`)}
            {stat(<Info size={11} />, 'Linguagem', repoInfo.language || '—')}
            {stat(<Info size={11} />, 'Tamanho', `${(repoInfo.size / 1024).toFixed(1)} MB`)}
            {stat(<Info size={11} />, 'Último push', repoInfo.pushed_at ? new Date(repoInfo.pushed_at).toLocaleString('pt-BR') : '—')}
            {stat(<GitFork size={11} />, 'Issues abertas', repoInfo.open_issues_count)}
          </div>
        ) : (
          <span style={{ fontSize: 12, color: theme.textMuted }}>Carregando dados do GitHub…</span>
        )}
      </Panel>

      <Panel ctx={ctx} icon={<Sliders size={14} color={accentColor} />} title="Detalhes" right={dirty ? <SmallButton ctx={ctx} primary onClick={save} disabled={saving}>{saving ? 'Salvando…' : 'Salvar no GitHub'}</SmallButton> : undefined}>
        {!isAdmin && <Notice ctx={ctx} tone="warning">Você não é admin deste repositório — as alterações no GitHub ficam desabilitadas.</Notice>}
        <Field ctx={ctx} label="Descrição" wide>
          <input disabled={!isAdmin} value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} style={inputStyle(ctx)} placeholder="Uma frase sobre o projeto" />
        </Field>
        <Field ctx={ctx} label="Homepage" wide>
          <input disabled={!isAdmin} value={draft.homepage} onChange={(e) => setDraft({ ...draft, homepage: e.target.value })} style={inputStyle(ctx)} placeholder="https://" />
        </Field>
        <Field ctx={ctx} label="Topics" hint="Separe por vírgula. Minúsculas, sem espaços." wide>
          <input disabled={!isAdmin} value={draft.topics} onChange={(e) => setDraft({ ...draft, topics: e.target.value })} style={inputStyle(ctx)} placeholder="flutter, supabase, app" />
        </Field>
        <Field ctx={ctx} label="Branch padrão" hint="Base para novos PRs e para o clone.">
          <select disabled={!isAdmin} value={draft.defaultBranch} onChange={(e) => setDraft({ ...draft, defaultBranch: e.target.value })} style={selectStyle(ctx)}>
            {(branches.length ? branches : [draft.defaultBranch]).map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
        </Field>
        <Field ctx={ctx} label="Visibilidade" hint="Tornar público expõe todo o código e histórico.">
          <Segmented
            ctx={ctx}
            disabled={!isAdmin || !repoInfo}
            value={repoInfo?.private ? 'private' : 'public'}
            options={[
              { id: 'private', label: 'Privado' },
              { id: 'public', label: 'Público' },
            ]}
            onChange={(v) => {
              if (!repoInfo || (v === 'private') === repoInfo.private) return;
              confirm({
                title: v === 'public' ? 'Tornar repositório público' : 'Tornar repositório privado',
                message: v === 'public' ? `Todo o código e histórico de ${owner}/${repo} ficarão visíveis para qualquer pessoa.` : `Apenas colaboradores terão acesso a ${owner}/${repo}. Estrelas e watchers públicos serão perdidos.`,
                confirmLabel: 'Alterar visibilidade',
                onConfirm: () => patchRepo({ private: v === 'private' }, `Repositório agora é ${v === 'private' ? 'privado' : 'público'}.`),
              });
            }}
          />
        </Field>
      </Panel>

      <Panel ctx={ctx} title="Funcionalidades do GitHub">
        {(
          [
            ['has_issues', 'Issues', 'Base de Tarefas, Issues e Sprints no DevFlow.'],
            ['has_projects', 'Projects', 'Necessário para o quadro Kanban com Project V2.'],
            ['has_wiki', 'Wiki', 'Documentação do repositório no GitHub.'],
            ['has_discussions', 'Discussions', 'Fórum de perguntas e anúncios.'],
          ] as const
        ).map(([key, label, hint]) => (
          <Field key={key} ctx={ctx} label={label} hint={hint}>
            <Toggle
              ctx={ctx}
              disabled={!isAdmin || !repoInfo}
              checked={Boolean(repoInfo?.[key])}
              onChange={(v) => {
                if (key === 'has_issues' && !v)
                  confirm({ title: 'Desativar Issues', message: 'As issues deixam de aparecer no GitHub e no DevFlow (os dados não são apagados).', confirmLabel: 'Desativar', onConfirm: () => patchRepo({ [key]: v }, `${label} desativado.`) });
                else patchRepo({ [key]: v }, `${label} ${v ? 'ativado' : 'desativado'}.`);
              }}
            />
          </Field>
        ))}
      </Panel>

      <Panel ctx={ctx} title="Preferências do DevFlow">
        <Field ctx={ctx} label="Visualização padrão" hint="Como as tarefas abrem ao entrar no projeto.">
          <Segmented
            ctx={ctx}
            value={settings.prefs.defaultView}
            options={[
              { id: 'kanban', label: 'Kanban' },
              { id: 'timeline', label: 'Timeline' },
              { id: 'spreadsheet', label: 'Tabela' },
            ]}
            onChange={(v) => update((s) => ({ ...s, prefs: { ...s.prefs, defaultView: v as any } }))}
          />
        </Field>
        <Field ctx={ctx} label="Sugestões de IA na Daily" hint="Mostra tarefas sugeridas com base nos commits recentes.">
          <Toggle ctx={ctx} checked={settings.prefs.dailyAi} onChange={(v) => update((s) => ({ ...s, prefs: { ...s.prefs, dailyAi: v } }))} />
        </Field>
        {repoInfo?.archived && <Pill color="#f59e0b">Este repositório está arquivado (somente leitura)</Pill>}
      </Panel>
    </div>
  );
};
