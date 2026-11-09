import React, { useState } from 'react';
import { Bot, ClipboardCheck, Brain, ShieldCheck, Sparkles } from 'lucide-react';
import { AI_PROVIDERS } from '../../../constants/ai';
import { Panel, SmallButton, selectStyle } from '../../team/teamUi';
import { Field, Segmented, Toggle, WEEKDAYS, textareaStyle, type SectionProps } from '../settingsUi';
import { RepoFileEditor } from './RepoFileEditor';

const PERMISSION_DENY = ['Bash(rm -rf:*)', 'Bash(git push --force:*)', 'Bash(git push -f:*)', 'Bash(git reset --hard:*)', 'Bash(gh release delete:*)'];
const permissionJson = (allow: string[], deny: string[]) => JSON.stringify({ permissions: { allow, deny } }, null, 2) + '\n';
export const PERMISSION_PRESETS = [
  { label: 'Só leitura', content: permissionJson(['Read', 'Glob', 'Grep', 'Bash(git status)', 'Bash(git diff:*)', 'Bash(git log:*)'], ['Edit', 'Write', 'Bash(rm:*)', 'Bash(git push:*)']) },
  { label: 'Padrão', content: permissionJson(['Read', 'Glob', 'Grep', 'Bash(git status)', 'Bash(git diff:*)', 'Bash(git log:*)', 'Bash(bun run:*)', 'Bash(npm run:*)'], PERMISSION_DENY) },
  { label: 'Confiante', content: permissionJson(['Read', 'Edit', 'Write', 'Bash(bun:*)', 'Bash(npm:*)', 'Bash(git:*)'], PERMISSION_DENY) },
];

export const MEMORY_TEMPLATE = `# Memória do projeto

Decisões e armadilhas que a IA deve lembrar. Uma por linha, com o motivo.

- 
`;

export const gateBlock = (gate: string) =>
  `## Antes de entregar (Aura Dev)\nRode estes comandos e só diga que terminou com todos passando:\n${gate
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => `- \`${l}\``)
    .join('\n')}`;

export const memoryBlock = '## Memória do projeto (Aura Dev)\nAntes de começar, leia `.aura/memory.md` e siga o que está registrado lá.';

import { logSystemActivity } from '../../../utils/brainService';

const CLAUDE_TEMPLATE = (repo: string) => `# ${repo}

## Stack
-

## Convenções
- Commits e PRs em português do Brasil
-

## Como rodar
\`\`\`
\`\`\`

## Não fazer
-
`;

export const AiSection: React.FC<SectionProps> = ({ ctx, owner, repo, repoInfo, isAdmin, settings, update, showToast }) => {
  const { theme, accentColor } = ctx;
  const ai = settings.ai;
  const [contextFile, setContextFile] = useState<'CLAUDE.md' | 'AGENTS.md' | 'GEMINI.md'>('CLAUDE.md');
  const provider = AI_PROVIDERS.find((p) => p.id === ai.providerId);
  const setAi = (patch: Partial<typeof ai>) => {
    logSystemActivity('configuracoes_projeto', 'atualizar_ia', `${owner}/${repo}`, patch);
    update((s) => ({ ...s, ai: { ...s.ai, ...patch } }));
  };
  const setAuto = (patch: Partial<typeof ai.automations>) => setAi({ automations: { ...ai.automations, ...patch } });
  const canEdit = isAdmin || Boolean(repoInfo?.permissions?.push);
  const localCommands = settings.local.commands;
  const blocks = [ai.gate.trim() ? gateBlock(ai.gate) : '', ai.useMemory ? memoryBlock : ''].filter(Boolean).join('\n\n');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Panel ctx={ctx} icon={<Bot size={14} color={accentColor} />} title="IA deste projeto">
        <Field ctx={ctx} label="Provedor" hint="Aba Time e descrição de issues.">
          <select value={ai.providerId || ''} onChange={(e) => setAi({ providerId: e.target.value || undefined, model: undefined })} style={selectStyle(ctx)}>
            <option value="">Padrão do app</option>
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
        {provider && provider.models.length > 0 && (
          <Field ctx={ctx} label="Modelo">
            <select value={ai.model || ''} onChange={(e) => setAi({ model: e.target.value || undefined })} style={selectStyle(ctx)}>
              <option value="">Padrão do provedor</option>
              {provider.models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field ctx={ctx} label="Contexto fixo" hint="Enviado no início de todo prompt do Aura Dev para este projeto (não altera o repositório)." wide>
          <textarea
            value={ai.contextNotes}
            onChange={(e) => setAi({ contextNotes: e.target.value })}
            placeholder={'Ex.: App Flutter com Supabase. Escreva em pt-BR. Issues seguem o template de bug/feature. Clientes: …'}
            style={{ ...textareaStyle(ctx, 90), fontFamily: 'inherit' }}
          />
        </Field>
      </Panel>

      <Panel ctx={ctx} icon={<Sparkles size={14} color={accentColor} />} title="Automações">
        <Field ctx={ctx} label="Gerar descrição de issue com IA" hint="Mostra o botão de IA ao criar tarefas.">
          <Toggle ctx={ctx} checked={ai.automations.issueDescription} onChange={(v) => setAuto({ issueDescription: v })} />
        </Field>
        <Field ctx={ctx} label="Resumo semanal automático" hint="Gera o resumo ao abrir a aba Time no dia escolhido.">
          {ai.automations.weeklySummary && (
            <select value={ai.automations.weeklySummaryWeekday} onChange={(e) => setAuto({ weeklySummaryWeekday: Number(e.target.value) })} style={selectStyle(ctx)}>
              {WEEKDAYS.map((d, i) => (
                <option key={d} value={i}>
                  {d}
                </option>
              ))}
            </select>
          )}
          <Toggle ctx={ctx} checked={ai.automations.weeklySummary} onChange={(v) => setAuto({ weeklySummary: v })} />
        </Field>
        <Field ctx={ctx} label="Sugestões de responsável" hint="Lista quem deveria pegar cada issue sem dono (Time → Insights).">
          <Toggle ctx={ctx} checked={ai.automations.assigneeSuggestions} onChange={(v) => setAuto({ assigneeSuggestions: v })} />
        </Field>
      </Panel>

      <Panel ctx={ctx} icon={<ShieldCheck size={14} color={accentColor} />} title="Limites">
        <Field ctx={ctx} label="O que a IA pode fazer" hint="Em “só sugerir”, os botões de atribuição direta ficam ocultos.">
          <Segmented
            ctx={ctx}
            value={ai.permission}
            options={[
              { id: 'suggest', label: 'Só sugerir' },
              { id: 'act', label: 'Sugerir e aplicar' },
            ]}
            onChange={(v) => setAi({ permission: v as any })}
          />
        </Field>
      </Panel>

      <Panel
        ctx={ctx}
        icon={<ClipboardCheck size={14} color={accentColor} />}
        title="Antes de entregar"
        right={
          <SmallButton
            ctx={ctx}
            disabled={!localCommands.build && !localCommands.test}
            title="Copia os comandos de build e teste do Ambiente local"
            onClick={() => setAi({ gate: [localCommands.build, localCommands.test].filter(Boolean).join('\n') })}
          >
            Usar Ambiente local
          </SmallButton>
        }
      >
        <Field ctx={ctx} label="Comandos de verificação" hint="Um por linha. Entram no bloco do Aura nas instruções abaixo (botão “Atualizar bloco do Aura”) e a IA só entrega com todos passando." wide>
          <textarea value={ai.gate} onChange={(e) => setAi({ gate: e.target.value })} placeholder={'bun run build\nbun run lint'} spellCheck={false} style={textareaStyle(ctx, 70)} />
        </Field>
      </Panel>

      <Panel ctx={ctx} icon={<Brain size={14} color={accentColor} />} title="Memória do projeto">
        <Field ctx={ctx} label="Pedir à IA que consulte a memória" hint="Acrescenta ao bloco do Aura a instrução de ler .aura/memory.md antes de começar.">
          <Toggle ctx={ctx} checked={ai.useMemory} onChange={(v) => setAi({ useMemory: v })} />
        </Field>
      </Panel>

      <RepoFileEditor
        ctx={ctx}
        owner={owner}
        repo={repo}
        path=".aura/memory.md"
        title="Memória (.aura/memory.md)"
        hint="Decisões, armadilhas e preferências do projeto. Versionado no repositório."
        template={MEMORY_TEMPLATE}
        canEdit={canEdit}
        showToast={showToast}
        minHeight={140}
      />

      <RepoFileEditor
        ctx={ctx}
        owner={owner}
        repo={repo}
        path=".claude/settings.json"
        title="Permissões do Claude Code (.claude/settings.json)"
        hint="Comandos liberados e proibidos para o Claude Code neste repositório. Escolha um preset e salve; vale só para o Claude Code."
        presets={PERMISSION_PRESETS}
        canEdit={canEdit}
        showToast={showToast}
        minHeight={150}
      />

      <RepoFileEditor
        key={contextFile}
        ctx={ctx}
        owner={owner}
        repo={repo}
        path={contextFile}
        title={`Instruções para agentes (${contextFile})`}
        hint={contextFile === 'CLAUDE.md' ? 'Lido automaticamente pelo Claude Code em todo terminal/agente aberto neste repositório.' : contextFile === 'AGENTS.md' ? 'Lido pelo Codex e outros agentes compatíveis.' : 'Lido pelo Gemini CLI neste repositório.'}
        template={CLAUDE_TEMPLATE(repo)}
        canEdit={canEdit}
        showToast={showToast}
        minHeight={220}
        block={blocks ? { key: 'aura', content: blocks } : undefined}
        right={
          <div style={{ display: 'flex', gap: 2, marginRight: 4 }}>
            {(['CLAUDE.md', 'AGENTS.md', 'GEMINI.md'] as const).map((f) => (
              <SmallButton key={f} ctx={ctx} primary={contextFile === f} onClick={() => setContextFile(f)}>
                {f}
              </SmallButton>
            ))}
          </div>
        }
      />
      <div style={{ fontSize: 10.5, color: theme.textMuted, padding: '0 4px' }}>As configurações de IA ficam salvas só nesta máquina; os arquivos .md são commitados no repositório.</div>
    </div>
  );
};
