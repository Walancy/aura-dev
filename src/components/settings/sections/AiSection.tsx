import React, { useState } from 'react';
import { Bot, ShieldCheck, Sparkles } from 'lucide-react';
import { AI_PROVIDERS } from '../../../constants/ai';
import { Panel, SmallButton, selectStyle } from '../../team/teamUi';
import { Field, Segmented, Toggle, WEEKDAYS, textareaStyle, type SectionProps } from '../settingsUi';
import { RepoFileEditor } from './RepoFileEditor';

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
  const [contextFile, setContextFile] = useState<'CLAUDE.md' | 'AGENTS.md'>('CLAUDE.md');
  const provider = AI_PROVIDERS.find((p) => p.id === ai.providerId);
  const setAi = (patch: Partial<typeof ai>) => update((s) => ({ ...s, ai: { ...s.ai, ...patch } }));
  const setAuto = (patch: Partial<typeof ai.automations>) => setAi({ automations: { ...ai.automations, ...patch } });
  const canEdit = isAdmin || Boolean(repoInfo?.permissions?.push);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <Panel ctx={ctx} icon={<Bot size={14} color={accentColor} />} title="IA deste projeto">
        <Field ctx={ctx} label="Provedor" hint="Usado na aba Time e na geração de descrição de issues deste projeto.">
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
        <Field ctx={ctx} label="Contexto fixo" hint="Enviado no início de todo prompt do DevFlow para este projeto (não altera o repositório)." wide>
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
        <Field ctx={ctx} label="Resumo semanal automático" hint="Gera o resumo do time ao abrir a aba Time no dia escolhido (se o último tiver mais de 6 dias).">
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
        <Field ctx={ctx} label="Sugestões de responsável" hint="Lista quem deveria pegar cada issue sem dono (aba Time → Insights).">
          <Toggle ctx={ctx} checked={ai.automations.assigneeSuggestions} onChange={(v) => setAuto({ assigneeSuggestions: v })} />
        </Field>
      </Panel>

      <Panel ctx={ctx} icon={<ShieldCheck size={14} color={accentColor} />} title="Limites">
        <Field ctx={ctx} label="O que a IA pode fazer" hint="Em “só sugerir”, os botões que atribuem issues direto a partir das sugestões ficam ocultos.">
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

      <RepoFileEditor
        key={contextFile}
        ctx={ctx}
        owner={owner}
        repo={repo}
        path={contextFile}
        title={`Instruções para agentes (${contextFile})`}
        hint={contextFile === 'CLAUDE.md' ? 'Lido automaticamente pelo Claude Code em todo terminal/agente aberto neste repositório.' : 'Lido pelo Codex e outros agentes compatíveis.'}
        template={CLAUDE_TEMPLATE(repo)}
        canEdit={canEdit}
        showToast={showToast}
        minHeight={220}
        right={
          <div style={{ display: 'flex', gap: 2, marginRight: 4 }}>
            {(['CLAUDE.md', 'AGENTS.md'] as const).map((f) => (
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
