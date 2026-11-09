import React, { useMemo, useState } from 'react';
import { Loader2, Sparkles, X } from 'lucide-react';
import { AuraDevIcon } from '../icons/AiProviderIcons';
import { AI_PROVIDERS } from '../../constants/ai';
import { callAi, type TeamAiProvider } from '../team/TeamAiPanel';
import { SmallButton } from '../team/teamUi';
import { Segmented, Toggle, textareaStyle } from '../settings/settingsUi';
import { MEMORY_TEMPLATE, PERMISSION_PRESETS, gateBlock, memoryBlock } from '../settings/sections/AiSection';
import { getProjectSettings, saveProjectSettings } from '../settings/projectSettingsStore';
import { getFieldTokens } from '../../utils/fieldTokens';
import { logSystemActivity } from '../../utils/brainService';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  projectName: string;
  repoFullName?: string; // chave das configurações (cai no caminho da pasta quando não há repo)
  aiProvider: TeamAiProvider;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  onToast: (msg: string) => void;
}

type Values = { about: string; uiRefs: string; rules: string; memory: string; useMemory: boolean; gate: string; permission: string };
const EMPTY: Values = { about: '', uiRefs: '', rules: '', memory: '', useMemory: true, gate: '', permission: 'none' };

const STEPS: Array<{ id: keyof Values; title: string; hint: string; placeholder: string; prompt: string; height: number }> = [
  { id: 'about', title: 'Sobre o projeto', hint: 'O que é, para quem e a stack. A IA lê isso antes de qualquer tarefa.', placeholder: 'Ex.: App Flutter com Supabase para gestão de obras. Stack: Dart, Riverpod, Supabase.', prompt: 'Analise os arquivos desta pasta e escreva uma descrição curta do projeto (o que é, para quem e a stack), em até 5 linhas.', height: 120 },
  { id: 'uiRefs', title: 'Referências de UI', hint: 'Sites e apps cujo visual a IA deve seguir. Um por linha, com uma nota se quiser.', placeholder: 'https://linear.app - densidade e atalhos\nhttps://vercel.com - tipografia e espaçamento', prompt: 'Sugira de 4 a 6 sites ou apps (com URL) que sirvam de referência de interface para este tipo de projeto, um por linha, no formato "URL - o que observar".', height: 120 },
  { id: 'rules', title: 'Regras do projeto', hint: 'Convenções e proibições que a IA deve respeitar. Uma por linha.', placeholder: 'Commits em português\nNão criar arquivos fora de src/\nSempre tipar as props', prompt: 'Com base nesta pasta (linguagem, estrutura, lint), sugira de 5 a 8 regras de código e convenções que uma IA deve seguir aqui, uma por linha, objetivas.', height: 140 },
  { id: 'memory', title: 'Memória do projeto', hint: 'Decisões e armadilhas que a IA deve lembrar. Vira o arquivo .aura/memory.md.', placeholder: 'Usamos Supabase RLS: nunca consultar sem filtro de tenant.', prompt: 'Com base nesta pasta e no histórico do git, liste de 3 a 6 decisões ou armadilhas que uma IA deve lembrar ao mexer neste projeto, uma por linha, cada uma com o motivo.', height: 140 },
  { id: 'gate', title: 'Antes de entregar', hint: 'Comandos que a IA roda e só entrega com todos passando. Um por linha.', placeholder: 'bun run build\nbun run lint', prompt: 'Com base nos scripts e arquivos de configuração desta pasta, liste apenas os comandos de verificação (build, lint, testes) que devem passar antes de entregar, um por linha, sem explicação.', height: 90 },
  { id: 'permission', title: 'Permissões da IA', hint: 'O que a IA pode fazer neste repositório sem pedir. Hoje o preset é aplicado só ao Claude Code (.claude/settings.json); as demais IAs seguem as regras escritas nas etapas anteriores.', placeholder: '', prompt: '', height: 0 },
];

const PERMISSION_OPTIONS = [{ id: 'none', label: 'Não configurar' }, ...PERMISSION_PRESETS.map((p) => ({ id: p.label, label: p.label }))];
const BLOCK = (k: string) => [`<!-- aura:${k}:start -->`, `<!-- aura:${k}:end -->`];

const upsert = (text: string, key: string, body: string) => {
  const [a, b] = BLOCK(key);
  const block = `${a}\n${body}\n${b}`;
  const i = text.indexOf(a);
  const j = text.indexOf(b);
  if (i >= 0 && j > i) return text.slice(0, i) + block + text.slice(j + b.length);
  return `${text.trimEnd()}${text.trim() ? '\n\n' : ''}${block}\n`;
};

const lines = (t: string) => t.split('\n').map((l) => l.trim()).filter(Boolean);
const bullets = (t: string) => lines(t).map((l) => `- ${l.replace(/^[-*]\s+/, '')}`).join('\n');

// Assistente exibido ao clonar ou abrir um projeto novo: coleta o que a IA precisa saber e grava nos arquivos do repositório
export const ProjectOnboardingModal: React.FC<Props> = ({ isOpen, onClose, projectPath, projectName, repoFullName, aiProvider, isEffectiveDark, accentColor, accentContrastText, onToast }) => {
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Values>(EMPTY);
  const [suggesting, setSuggesting] = useState(false);
  const [saving, setSaving] = useState(false);

  const ft = getFieldTokens(isEffectiveDark);
  const theme = useMemo(
    () => ({
      controlBg: ft.fieldBg,
      controlHoverBg: ft.fieldBgHover,
      textPrimary: isEffectiveDark ? '#ffffff' : '#111111',
      textSecondary: isEffectiveDark ? '#888888' : '#777777',
      textMuted: isEffectiveDark ? '#555555' : '#999999',
    }),
    [isEffectiveDark, ft],
  );
  const ctx = { theme, accentColor, accentContrastText, isEffectiveDark };
  const key = repoFullName || projectPath;

  if (!isOpen) return null;
  const cur = STEPS[step];
  const last = step === STEPS.length - 1;

  const finish = async () => {
    setSaving(true);
    try {
      const fs = window.electronAPI?.fs;
      if (!fs) throw new Error('Sistema de arquivos indisponível.');
      const read = async (rel: string) => {
        const r = await fs.readFile(`${projectPath}/${rel}`).catch(() => null);
        return r && !r.error ? r.content || '' : '';
      };
      const write = async (rel: string, content: string) => {
        const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
        if (dir) await fs.createItem(`${projectPath}/${dir}`, true).catch(() => {});
        await fs.writeFile(`${projectPath}/${rel}`, content);
      };

      const sections = [
        v.about.trim() && `## Sobre o projeto\n${v.about.trim()}`,
        v.uiRefs.trim() && `## Referências de UI\nSiga o visual e as interações destas referências:\n${bullets(v.uiRefs)}`,
        v.rules.trim() && `## Regras do projeto\n${bullets(v.rules)}`,
        v.gate.trim() && gateBlock(v.gate),
        v.memory.trim() && v.useMemory && memoryBlock,
      ].filter(Boolean) as string[];

      // mesmo conteúdo para todas as IAs: Claude Code, Codex e outros agentes (AGENTS.md) e Gemini CLI
      if (sections.length) for (const f of ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']) await write(f, upsert(await read(f), 'onboarding', sections.join('\n\n')));
      if (v.memory.trim()) {
        const prev = await read('.aura/memory.md');
        await write('.aura/memory.md', `${(prev || MEMORY_TEMPLATE.replace(/\n- \n$/, '\n')).trimEnd()}\n${bullets(v.memory)}\n`);
      }
      const preset = PERMISSION_PRESETS.find((p) => p.label === v.permission);
      if (preset && !(await read('.claude/settings.json')).trim()) await write('.claude/settings.json', preset.content);

      const s = getProjectSettings(key);
      saveProjectSettings(key, { ...s, ai: { ...s.ai, contextNotes: s.ai.contextNotes || v.about.trim(), gate: v.gate.trim() || s.ai.gate, useMemory: v.memory.trim() ? v.useMemory : s.ai.useMemory } });
      logSystemActivity('onboarding_projeto', 'concluir', projectName, { arquivos: sections.length, permissao: v.permission });
      onToast(sections.length ? 'IA do projeto configurada.' : 'Nada para salvar.');
      onClose();
    } catch (e: any) {
      onToast(`Falhou: ${e?.message || e}`);
    } finally {
      setSaving(false);
    }
  };

  const suggest = async () => {
    setSuggesting(true);
    try {
      const prov = AI_PROVIDERS.find((p) => p.id === aiProvider.id) || AI_PROVIDERS[0];
      const known = STEPS.filter((s) => s.prompt && s.id !== cur.id && String(v[s.id]).trim()).map((s) => `${s.title}:\n${v[s.id]}`).join('\n\n');
      const prompt = `Projeto "${projectName}" (pasta atual).${known ? `\n\nJá informado:\n${known}` : ''}\n\n${cur.prompt}\nResponda em português do Brasil, apenas com o texto final, sem markdown, sem cercas de código e sem introdução.`;
      const out = await callAi({ id: prov.id, name: prov.name, cliCommand: prov.cliCommand, model: aiProvider.model, cwd: projectPath }, prompt);
      setV((p) => ({ ...p, [cur.id]: out.replace(/^```\w*\n?|```$/g, '').trim() }));
      logSystemActivity('onboarding_projeto', 'sugerir_com_ia', projectName, { etapa: cur.id });
    } catch (e: any) {
      onToast(`IA não respondeu: ${e?.message || e}`);
    } finally {
      setSuggesting(false);
    }
  };

  const skipAll = () => {
    logSystemActivity('onboarding_projeto', 'pular_tudo', projectName, { etapa: cur.id });
    onClose();
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: isEffectiveDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onMouseDown={(e) => e.target === e.currentTarget && skipAll()}
    >
      <div style={{ width: '100%', maxWidth: 620, maxHeight: 'calc(100vh - 32px)', background: isEffectiveDark ? '#161618' : '#ffffff', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, flexShrink: 0 }}>
          <AuraDevIcon size={16} />
          <span style={{ flex: 1, fontSize: 13, color: theme.textPrimary }}>
            Preparar a IA <span style={{ color: theme.textMuted, fontSize: 11.5 }}>{projectName}</span>
          </span>
          <span style={{ fontSize: 11, color: theme.textMuted }}>
            {step + 1} de {STEPS.length}
          </span>
          <button
            type="button"
            onClick={skipAll}
            title="Fechar"
            style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 6, background: 'transparent', color: theme.textSecondary, cursor: 'pointer', transition: 'background 0.15s ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = theme.controlHoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '0 16px', flexShrink: 0 }}>
          {STEPS.map((s, i) => (
            <div key={s.id} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? accentColor : theme.controlBg, transition: 'background 0.2s ease' }} />
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: 16, overflowY: 'auto' }}>
          <div>
            <div style={{ fontSize: 14, color: theme.textPrimary }}>{cur.title}</div>
            <div style={{ fontSize: 11.5, color: theme.textSecondary, marginTop: 4, lineHeight: 1.5 }}>{cur.hint}</div>
          </div>

          {cur.id === 'permission' ? (
            <Segmented ctx={ctx} value={v.permission} options={PERMISSION_OPTIONS} onChange={(x) => setV((p) => ({ ...p, permission: x }))} />
          ) : (
            <textarea
              key={cur.id}
              value={String(v[cur.id])}
              onChange={(e) => setV((p) => ({ ...p, [cur.id]: e.target.value }))}
              placeholder={cur.placeholder}
              spellCheck={false}
              disabled={suggesting}
              style={{ ...textareaStyle(ctx, cur.height), fontFamily: 'inherit', opacity: suggesting ? 0.6 : 1, transition: 'opacity 0.15s ease' }}
            />
          )}

          {cur.id === 'memory' && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 11.5, color: theme.textSecondary }}>
              <Toggle ctx={ctx} checked={v.useMemory} onChange={(x) => setV((p) => ({ ...p, useMemory: x }))} />
              Pedir à IA que leia a memória antes de começar
            </div>
          )}

          {cur.prompt && (
            <div>
              <SmallButton ctx={ctx} disabled={suggesting} onClick={suggest} title="A IA analisa a pasta do projeto e preenche esta etapa">
                {suggesting ? <Loader2 size={11} className="spin" /> : <Sparkles size={11} />} {suggesting ? 'Pensando…' : 'Sugerir com IA'}
              </SmallButton>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 16, flexShrink: 0 }}>
          <SmallButton ctx={ctx} onClick={skipAll}>
            Pular tudo
          </SmallButton>
          <div style={{ flex: 1 }} />
          {step > 0 && (
            <SmallButton ctx={ctx} onClick={() => setStep(step - 1)}>
              Voltar
            </SmallButton>
          )}
          {!last && (
            <SmallButton ctx={ctx} onClick={() => { setV((p) => ({ ...p, [cur.id]: EMPTY[cur.id] })); setStep(step + 1); }} title="Deixa esta etapa em branco">
              Pular etapa
            </SmallButton>
          )}
          <SmallButton ctx={ctx} primary disabled={saving || suggesting} onClick={last ? finish : () => setStep(step + 1)}>
            {saving ? 'Salvando…' : last ? 'Concluir' : 'Próximo'}
          </SmallButton>
        </div>
      </div>
    </div>
  );
};
