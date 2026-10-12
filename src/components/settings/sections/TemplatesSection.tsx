import React, { useEffect, useState } from 'react';
import { FilePlus2, FileStack, Wand2 } from 'lucide-react';
import { EmptyState, Panel, SmallButton, inputStyle } from '../../team/teamUi';
import { Notice, ghSettings, type SectionProps } from '../settingsUi';
import { RepoFileEditor } from './RepoFileEditor';
import { logSystemActivity } from '../../../utils/brainService';

const DIR = '.github/ISSUE_TEMPLATE';

export const DEFAULT_ISSUE_TEMPLATES: Record<string, string> = {
  'bug.md': `---
name: Bug / Defeito
about: Algo não está funcionando como deveria
title: "[BUG] "
labels: bug
assignees: ''
---

### Descrição do defeito
<!-- O que aconteceu e qual o impacto -->

### Passos para reproduzir
1.
2.
3.

### Comportamento esperado vs observado
- **Esperado:**
- **Observado:**

### Ambiente
- Versão / build:
- Dispositivo / navegador:

### Critérios de correção
- [ ] Causa raiz identificada
- [ ] Correção validada
- [ ] Teste de regressão
`,
  'feature.md': `---
name: Feature
about: Nova funcionalidade ou melhoria
title: ""
labels: ''
assignees: ''
---

### Contexto
<!-- Qual problema resolve e para quem -->

### Proposta
<!-- O que deve ser feito -->

### Critérios de aceite
- [ ]
- [ ]

### Fora do escopo
-
`,
  'tarefa.md': `---
name: Tarefa
about: Trabalho técnico, refatoração ou manutenção
title: ""
labels: ''
assignees: ''
---

### O que fazer
-

### Checklist
- [ ]
- [ ]
`,
};

const PR_TEMPLATE = `## O que muda
<!-- Resumo em 1-3 linhas -->

## Issue relacionada
Closes #

## Como testar
1.

## Checklist
- [ ] Testes passando
- [ ] Sem segredos no código
- [ ] Screenshots (se mudou UI)
`;

export const TemplatesSection: React.FC<SectionProps> = ({ ctx, owner, repo, isAdmin, repoInfo, showToast, confirm }) => {
  const { theme, accentColor } = ctx;
  const [files, setFiles] = useState<Array<{ name: string; path: string; sha: string }> | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);
  const canEdit = isAdmin || Boolean(repoInfo?.permissions?.push);

  const load = () =>
    ghSettings<any[]>('listDir', { owner, repo, path: DIR })
      .then((list) => {
        const f = list.filter((x) => x.type === 'file');
        setFiles(f);
        setSelected((cur) => cur || f.find((x) => x.name !== 'config.yml')?.path || null);
      })
      .catch(() => setFiles([]));
  useEffect(() => {
    setSelected(null);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [owner, repo]);

  const createDefaults = async () => {
    setBusy(true);
    let ok = 0;
    for (const [name, content] of Object.entries(DEFAULT_ISSUE_TEMPLATES)) {
      if (files?.some((f) => f.name === name)) continue;
      try {
        await ghSettings('putFile', { owner, repo, path: `${DIR}/${name}`, content, message: `chore: adiciona template de issue ${name} via Aura Dev` });
        ok++;
      } catch (e: any) {
        showToast(`Falhou em ${name}: ${e.message}`);
      }
    }
    if (ok) {
      logSystemActivity('configuracoes_projeto', 'criar_templates_padrao', `${owner}/${repo}`, { count: ok });
      showToast(`${ok} template(s) criados.`);
    }
    setBusy(false);
    load();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Panel
        ctx={ctx}
        icon={<FileStack size={14} color={accentColor} />}
        title="Templates de issue"
        right={
          canEdit ? (
            <SmallButton ctx={ctx} disabled={busy} onClick={createDefaults}>
              <Wand2 size={11} /> Criar padrão (bug, feature, tarefa)
            </SmallButton>
          ) : undefined
        }
      >
        <div style={{ fontSize: 11.5, color: theme.textSecondary }}>
          Arquivos em <code>{DIR}</code>. Aparecem no "New issue" do GitHub e cada salvamento vira um commit na branch padrão.
        </div>
        {!canEdit && <Notice ctx={ctx} tone="warning">Você precisa de permissão de escrita para editar os templates.</Notice>}
        {files === null ? (
          <span style={{ fontSize: 11.5, color: theme.textMuted }}>Carregando…</span>
        ) : files.length === 0 ? (
          <EmptyState ctx={ctx} text="Nenhum template ainda. Crie os padrões ou um novo abaixo." />
        ) : (
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {files.map((f) => (
              <SmallButton key={f.path} ctx={ctx} primary={selected === f.path} onClick={() => setSelected(f.path)}>
                {f.name}
              </SmallButton>
            ))}
          </div>
        )}
        {canEdit && (
          <div style={{ display: 'flex', gap: 6 }}>
            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="novo-template.md" style={{ ...inputStyle(ctx), width: 220 }} />
            <SmallButton
              ctx={ctx}
              disabled={!newName.trim()}
              onClick={() => {
                const name = newName.trim().replace(/\s+/g, '-').replace(/(\.md)?$/, '.md');
                setSelected(`${DIR}/${name}`);
                setNewName('');
              }}
            >
              <FilePlus2 size={11} /> Novo
            </SmallButton>
          </div>
        )}
      </Panel>

      {selected && (
        <RepoFileEditor
          key={selected}
          ctx={ctx}
          owner={owner}
          repo={repo}
          path={selected}
          template={DEFAULT_ISSUE_TEMPLATES['feature.md']}
          canEdit={canEdit}
          showToast={showToast}
          minHeight={260}
          onSaved={load}
          onDelete={(sha) =>
            confirm({
              title: 'Excluir template',
              message: `Excluir ${selected}?`,
              confirmLabel: 'Excluir',
              onConfirm: async () => {
                try {
                  await ghSettings('deleteFile', { owner, repo, path: selected, sha, message: `chore: remove ${selected} via Aura Dev` });
                  logSystemActivity('configuracoes_projeto', 'excluir_template', `${owner}/${repo}`, { path: selected });
                  showToast('Template excluído.');
                  setSelected(null);
                  load();
                } catch (e: any) {
                  showToast(`Falhou: ${e.message}`);
                }
              },
            })
          }
        />
      )}

      <RepoFileEditor
        ctx={ctx}
        owner={owner}
        repo={repo}
        path=".github/pull_request_template.md"
        title="Template de pull request"
        hint="Preenche automaticamente a descrição de todo PR novo."
        template={PR_TEMPLATE}
        canEdit={canEdit}
        showToast={showToast}
      />

      <RepoFileEditor
        ctx={ctx}
        owner={owner}
        repo={repo}
        path=".github/CODEOWNERS"
        title="CODEOWNERS"
        hint={<>Quem é dono de cada área. Usado na aba Time e, se ativado em Branches, para exigir review do dono. Ex.: <code>/lib/features/pagamento/ @{owner}/mobile</code></>}
        template={`# Dono padrão de tudo\n* @${owner}\n\n# Exemplos\n# /lib/ @${owner}/mobile\n# /supabase/ @${owner}/backend\n`}
        canEdit={canEdit}
        showToast={showToast}
        minHeight={120}
      />
    </div>
  );
};
