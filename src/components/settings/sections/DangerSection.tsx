import React, { useRef, useState } from 'react';
import { Archive, Download, Eraser, LayoutTemplate, Send, ShieldAlert, Trash2, Upload } from 'lucide-react';
import { Panel, SmallButton, inputStyle } from '../../team/teamUi';
import { exportProjectSettings, importProjectSettings } from '../projectSettingsStore';
import { Field, Notice, type SectionProps, ghSettings } from '../settingsUi';
import { logSystemActivity } from '../../../utils/brainService';

export const DangerSection: React.FC<SectionProps & { onRefreshRepoDetails?: () => void; onRepoGone?: () => void }> = ({
  ctx,
  repoFullName,
  owner,
  repo,
  repoInfo,
  isAdmin,
  reloadRepo,
  update,
  showToast,
  confirm,
  onRefreshRepoDetails,
  onRepoGone,
}) => {
  const { theme } = ctx;
  const fileRef = useRef<HTMLInputElement>(null);
  const [transferTo, setTransferTo] = useState('');
  const [typed, setTyped] = useState('');
  const nameOk = typed.trim() === repoFullName;

  const clearCache = () =>
    confirm({
      title: 'Limpar cache do repositório',
      message: 'Apagar os dados em cache deste projeto no Aura Dev?',
      itemDescription: 'Issues, sprints locais e estados de busca serão recarregados do GitHub. Configurações deste projeto são mantidas.',
      confirmLabel: 'Limpar cache',
      onConfirm: () => {
        const needle = repoFullName.toLowerCase();
        Object.keys(localStorage).forEach((k) => {
          const lk = k.toLowerCase();
          if (lk.startsWith('devflow_project_settings_v1:') || lk.startsWith('devflow_team_repo_v1:')) return;
          if (lk.includes(needle) || lk.includes(needle.replace(/[^a-z0-9_-]/g, '_'))) localStorage.removeItem(k);
        });
        logSystemActivity('configuracoes_projeto', 'limpar_cache', repoFullName, {});
        showToast('Cache do repositório limpo.');
        onRefreshRepoDetails?.();
      },
    });

  const resetLayout = () =>
    confirm({
      title: 'Redefinir layout',
      message: 'Restaurar as larguras padrão de colunas e painéis?',
      confirmLabel: 'Restaurar',
      onConfirm: () => {
        ['devflow_milestone_left_sidebar_width', 'devflow_milestone_right_panel_width', 'milestone_right_panel_ratios'].forEach((k) => localStorage.removeItem(k));
        logSystemActivity('configuracoes_projeto', 'redefinir_layout', repoFullName, {});
        showToast('Layout redefinido.');
      },
    });

  const exportJson = () => {
    const blob = new Blob([exportProjectSettings(repoFullName)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `devflow-config-${repoFullName.replace('/', '__')}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    logSystemActivity('configuracoes_projeto', 'exportar_configuracoes', repoFullName, {});
  };

  const importJson = async (file: File) => {
    try {
      const next = importProjectSettings(repoFullName, await file.text());
      update(() => next);
      logSystemActivity('configuracoes_projeto', 'importar_configuracoes', repoFullName, {});
      showToast('Configurações importadas (pasta local e comandos mantidos).');
    } catch (e: any) {
      showToast(`Arquivo inválido: ${e.message}`);
    }
  };

  const ghAction = async (action: string, payload: any, ok: string) => {
    try {
      await ghSettings(action, { owner, repo, ...payload });
      logSystemActivity('configuracoes_projeto', action, repoFullName, payload);
      showToast(ok);
      return true;
    } catch (e: any) {
      showToast(`Falhou: ${e.message}${action === 'deleteRepo' && /403|404/.test(e.message) ? ' — o token precisa do escopo delete_repo.' : ''}`);
      return false;
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Panel ctx={ctx} icon={<LayoutTemplate size={14} color={theme.textSecondary} />} title="Aura Dev (só nesta máquina)">
        <Field ctx={ctx} label="Exportar configurações" hint="Fluxo de trabalho, IA, alertas e notificações deste projeto em JSON — para replicar em outros repositórios.">
          <SmallButton ctx={ctx} onClick={exportJson}>
            <Download size={11} /> Exportar
          </SmallButton>
        </Field>
        <Field ctx={ctx} label="Importar configurações" hint="Substitui as configurações atuais (exceto pasta local e comandos).">
          <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={(e) => e.target.files?.[0] && importJson(e.target.files[0])} />
          <SmallButton ctx={ctx} onClick={() => fileRef.current?.click()}>
            <Upload size={11} /> Importar
          </SmallButton>
        </Field>
        <Field ctx={ctx} label="Limpar cache do repositório" hint="Recarrega issues e sprints do GitHub.">
          <SmallButton ctx={ctx} onClick={clearCache}>
            <Eraser size={11} /> Limpar
          </SmallButton>
        </Field>
        <Field ctx={ctx} label="Redefinir layout" hint="Larguras de colunas e painéis.">
          <SmallButton ctx={ctx} onClick={resetLayout}>
            Restaurar
          </SmallButton>
        </Field>
      </Panel>

      <Panel ctx={ctx} icon={<ShieldAlert size={14} color="#ef4444" />} title="GitHub — ações irreversíveis ou de alto impacto">
        {!isAdmin && <Notice ctx={ctx} tone="warning">Somente admins podem arquivar, transferir ou excluir o repositório.</Notice>}
        <Field ctx={ctx} label={repoInfo?.archived ? 'Desarquivar repositório' : 'Arquivar repositório'} hint={repoInfo?.archived ? 'Volta a aceitar push, issues e PRs.' : 'Fica somente leitura: sem push, issues ou PRs novos. Reversível.'}>
          <SmallButton
            ctx={ctx}
            danger={!repoInfo?.archived}
            disabled={!isAdmin || !repoInfo}
            onClick={() =>
              confirm({
                title: repoInfo?.archived ? 'Desarquivar repositório' : 'Arquivar repositório',
                message: `${repoInfo?.archived ? 'Desarquivar' : 'Arquivar'} ${repoFullName}?`,
                confirmLabel: repoInfo?.archived ? 'Desarquivar' : 'Arquivar',
                onConfirm: async () => {
                  if (await ghAction('updateRepo', { patch: { archived: !repoInfo?.archived } }, repoInfo?.archived ? 'Repositório desarquivado.' : 'Repositório arquivado.')) await reloadRepo();
                },
              })
            }
          >
            <Archive size={11} /> {repoInfo?.archived ? 'Desarquivar' : 'Arquivar'}
          </SmallButton>
        </Field>

        <Field ctx={ctx} label="Confirmação" hint={<>Para transferir ou excluir, digite <b>{repoFullName}</b>.</>} wide>
          <input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={repoFullName} disabled={!isAdmin} style={inputStyle(ctx)} />
        </Field>

        <Field ctx={ctx} label="Transferir repositório" hint="Move para outro usuário ou organização. Links antigos redirecionam.">
          <input value={transferTo} onChange={(e) => setTransferTo(e.target.value)} placeholder="novo dono" disabled={!isAdmin} style={{ ...inputStyle(ctx), width: 160 }} />
          <SmallButton
            ctx={ctx}
            danger
            disabled={!isAdmin || !nameOk || !transferTo.trim()}
            onClick={() =>
              confirm({
                title: 'Transferir repositório',
                message: `Transferir ${repoFullName} para ${transferTo.trim()}?`,
                itemDescription: 'Você pode perder o acesso, dependendo das permissões no destino.',
                confirmLabel: 'Transferir',
                onConfirm: async () => {
                  if (await ghAction('transferRepo', { newOwner: transferTo.trim() }, `Transferência para ${transferTo.trim()} iniciada.`)) onRepoGone?.();
                },
              })
            }
          >
            <Send size={11} /> Transferir
          </SmallButton>
        </Field>

        <Field ctx={ctx} label="Excluir repositório" hint="Apaga código, issues, PRs, wiki e releases. Não tem volta.">
          <SmallButton
            ctx={ctx}
            danger
            disabled={!isAdmin || !nameOk}
            onClick={() =>
              confirm({
                title: 'Excluir repositório',
                message: `Excluir ${repoFullName} permanentemente?`,
                itemDescription: 'Esta ação NÃO pode ser desfeita.',
                confirmLabel: 'Excluir para sempre',
                onConfirm: async () => {
                  if (await ghAction('deleteRepo', {}, `${repoFullName} excluído.`)) onRepoGone?.();
                },
              })
            }
          >
            <Trash2 size={11} /> Excluir
          </SmallButton>
        </Field>
      </Panel>
    </div>
  );
};
