import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Check,
  Code2,
  Copy,
  ExternalLink,
  FileCode,
  FileText,
  FolderOpen,
  Info,
  Loader2,
  Plus,
  RotateCcw,
  Save,
  ScrollText,
  ShieldCheck,
  Sparkles,
  X,
  ChevronDown,
} from 'lucide-react';
import { renderAiIcon } from '../icons/AiProviderIcons';
import { logSystemActivity } from '../../utils/brainService';
import { getFieldTokens } from '../../utils/fieldTokens';
import { TutorialTriggerButton, useRegisterTutorialOverlay } from '../tutorial/TutorialTriggerButton';

export interface AiGlobalRuleProvider {
  id: string;
  name: string;
  fileName: string;
  relativeDir: string;
  defaultPath: string;
  description: string;
  template: string;
}

const GLOBAL_PROVIDERS: AiGlobalRuleProvider[] = [
  {
    id: 'antigravity',
    name: 'Antigravity',
    fileName: 'GEMINI.md',
    relativeDir: '.gemini',
    defaultPath: '~/.gemini/GEMINI.md',
    description: 'Instruções e diretrizes de comportamento do Antigravity CLI e IDE em ~/.gemini/GEMINI.md',
    template: `# Diretrizes Globais do Antigravity

## Regras de Comportamento
- Sempre siga as regras e padrões de arquitetura do projeto ativo.
- Mantenha conformidade estrita com tipagem TypeScript e linting.
- Não utilize conteúdo estático hardcoded em locais parametrizáveis.
- Priorize código limpo, modular e de fácil manutenção.

## Convenções de Código
- Escreva mensagens de commit descritivas e em português.
- Adicione tratamento adequado para erros e exceções.
- Mantenha divisão clara de responsabilidades entre componentes.
`,
  },
  {
    id: 'gemini',
    name: 'Gemini',
    fileName: 'GEMINI.md',
    relativeDir: '.gemini',
    defaultPath: '~/.gemini/GEMINI.md',
    description: 'Instruções de sistema e diretrizes do Gemini CLI em ~/.gemini/GEMINI.md',
    template: `# Diretrizes Globais do Gemini

## Regras de Comportamento
- Responda de forma direta e estruturada com foco em código limpo.
- Sempre verifique a segurança de tipos e integridade dos módulos.
- Não introduza dependências desnecessárias ou redundantes.
`,
  },
  {
    id: 'claude',
    name: 'Claude Code',
    fileName: 'CLAUDE.md',
    relativeDir: '.claude',
    defaultPath: '~/.claude/CLAUDE.md',
    description: 'Instruções globais lidas automaticamente pelo Claude Code em ~/.claude/CLAUDE.md',
    template: `# Regras Globais Claude Code

## Stack & Padrões
- Sempre consulte o repositório antes de realizar grandes modificações.
- Commits e PRs objetivos com escopo reduzido e rastreável.
- Não execute comandos perigosos sem validação do usuário.

## Diretrizes de Qualidade
- Verifique testes e integridade de tipos antes de concluir tarefas.
- Mantenha estilo e padrões consistentes com o código existente.
`,
  },
  {
    id: 'codex',
    name: 'Codex',
    fileName: 'AGENTS.md',
    relativeDir: '.codex',
    defaultPath: '~/.codex/AGENTS.md',
    description: 'Diretrizes e regras de sistema do Codex CLI em ~/.codex/AGENTS.md',
    template: `# Diretrizes Globais do Codex

## Comportamento do Agente
- Analise o contexto antes de sugerir ou implementar alterações.
- Evite mocks temporários em ambiente produtivo.
- Documente decisões técnicas não triviais em comentários concisos.
`,
  },
  {
    id: 'ollama',
    name: 'Ollama',
    fileName: 'rules.md',
    relativeDir: '.ollama',
    defaultPath: '~/.ollama/rules.md',
    description: 'Instruções globais e persona padrão do Ollama em ~/.ollama/rules.md',
    template: `# Regras Globais do Ollama

## Persona & Instruções Locais
- Atue como um assistente de engenharia de software sênior.
- Forneça explicações concisas com foco direto na solução prática.
- Priorize soluções seguras, eficientes e sem acoplamento indevido.
`,
  },
];

interface RuleSnippet {
  id: string;
  title: string;
  description: string;
  snippet: string;
}

const PRESET_SNIPPETS: RuleSnippet[] = [
  {
    id: 'quality',
    title: 'Qualidade & TypeScript',
    description: 'Sem any, tipagem estrita e validação de props',
    snippet: `\n- Utilize tipagem estrita no TypeScript, evitando o uso de any.
- Garanta que todos os métodos assíncronos possuam blocos try/catch apropriados.
- Realize build e validação de linter antes de considerar tarefas concluídas.\n`,
  },
  {
    id: 'security',
    title: 'Segurança & Sem Hardcode',
    description: 'Evitar senhas, tokens e textos estáticos soltos',
    snippet: `\n- Nunca insira senhas, chaves de API ou segredos no código-fonte.
- Evite valores e identificadores hardcoded; utilize variáveis de ambiente ou constantes.
- Valide rigorosamente entradas de usuário e requisições externas.\n`,
  },
  {
    id: 'commits',
    title: 'Commits & Git',
    description: 'Padrão Conventional Commits em português',
    snippet: `\n- Utilize o padrão Conventional Commits (ex: feat, fix, refactor, docs).
- Descreva mensagens de commit em português de forma clara e objetiva.
- Nunca commite arquivos temporários, logs ou pastas de build.\n`,
  },
  {
    id: 'uiux',
    title: 'Padrão UI/UX',
    description: 'Sem sombras, sem emojis, bordas suaves e micro-animações',
    snippet: `\n- Mantenha superfícies planas sem sombras ou bordas excessivas.
- Utilize fontes de peso regular e linhas divisórias com baixa opacidade.
- Aplique micro-animações suaves para estados de hover e transições interativas.
- Nunca utilize emojis na interface do usuário.\n`,
  },
];

interface Props {
  isOpen: boolean;
  onClose: () => void;
  selectedAiProvider: string;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  onOpenFileInEditor: (filePath: string, fileName?: string) => void;
  onToast: (msg: string) => void;
  onFileSaved?: (filePath: string, content: string) => void;
}

export const AiGlobalRulesModal: React.FC<Props> = ({
  isOpen,
  onClose,
  selectedAiProvider,
  isEffectiveDark,
  accentColor,
  accentContrastText,
  onOpenFileInEditor,
  onToast,
  onFileSaved,
}) => {
  useRegisterTutorialOverlay('modal_ai_rules', isOpen);
  const [activeProviderId, setActiveProviderId] = useState<string>(selectedAiProvider || 'antigravity');
  const [homeDir, setHomeDir] = useState<string>('');
  // rascunho de todas as IAs ao mesmo tempo: trocar de IA não perde edição e "Salvar" grava todas
  const [files, setFiles] = useState<Record<string, { content: string; original: string; exists: boolean }>>({});
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [showPresets, setShowPresets] = useState<boolean>(false);

  // Sync active tab with selected provider when opened
  useEffect(() => {
    if (isOpen) {
      const match = GLOBAL_PROVIDERS.find((p) => p.id === selectedAiProvider);
      setActiveProviderId(match ? match.id : 'antigravity');
    }
  }, [isOpen, selectedAiProvider]);

  // Resolve user home directory
  useEffect(() => {
    let isMounted = true;
    const fetchHome = async () => {
      let resolved = '';
      if (window.electronAPI?.fs?.getHomeDir) {
        try {
          resolved = await window.electronAPI.fs.getHomeDir();
        } catch {}
      }
      if (!resolved && window.electronAPI?.shell?.exec) {
        try {
          const res = await window.electronAPI.shell.exec('echo $HOME');
          if (res.exitCode === 0 && res.stdout.trim()) {
            resolved = res.stdout.trim();
          }
        } catch {}
      }
      if (!resolved) {
        resolved = '/Users/walancy';
      }
      if (isMounted) {
        setHomeDir(resolved);
      }
    };

    if (isOpen) {
      fetchHome();
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen]);

  const activeProvider = useMemo(() => {
    return GLOBAL_PROVIDERS.find((p) => p.id === activeProviderId) || GLOBAL_PROVIDERS[0];
  }, [activeProviderId]);

  // Compute full file path
  const fullFilePath = useMemo(() => {
    if (!homeDir) return activeProvider.defaultPath;
    return `${homeDir}/${activeProvider.relativeDir}/${activeProvider.fileName}`;
  }, [homeDir, activeProvider]);

  const pathOf = useCallback((p: AiGlobalRuleProvider) => `${homeDir}/${p.relativeDir}/${p.fileName}`, [homeDir]);

  // Carrega o arquivo de regras de todas as IAs (Antigravity e Gemini compartilham o mesmo arquivo)
  const loadAll = useCallback(async () => {
    if (!isOpen || !homeDir) return;
    setIsLoading(true);
    const byPath = new Map<string, { content: string; original: string; exists: boolean }>();
    for (const p of GLOBAL_PROVIDERS) {
      const path = pathOf(p);
      if (byPath.has(path)) continue;
      let res: any = null;
      try {
        res = await window.electronAPI?.fs?.readFile(path);
      } catch {}
      const ok = res && res.content !== null && res.content !== undefined && !res.error;
      byPath.set(path, ok ? { content: res.content, original: res.content, exists: true } : { content: p.template, original: '', exists: false });
    }
    const next: Record<string, { content: string; original: string; exists: boolean }> = {};
    GLOBAL_PROVIDERS.forEach((p) => (next[p.id] = byPath.get(pathOf(p))!));
    setFiles(next);
    setIsLoading(false);
  }, [isOpen, homeDir, pathOf]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const cur = files[activeProviderId];
  const fileContent = cur?.content ?? '';
  const originalContent = cur?.original ?? '';
  const fileExists = cur?.exists ?? false;

  // editar uma IA atualiza também as que usam o mesmo arquivo
  const setProviderContent = (providerId: string, text: string) =>
    setFiles((prev) => {
      const target = GLOBAL_PROVIDERS.find((p) => p.id === providerId);
      if (!target) return prev;
      const path = pathOf(target);
      const next = { ...prev };
      GLOBAL_PROVIDERS.forEach((p) => {
        if (pathOf(p) === path && next[p.id]) next[p.id] = { ...next[p.id], content: text };
      });
      return next;
    });
  const setFileContent = (text: string) => setProviderContent(activeProviderId, text);

  // Provedores com alteração a gravar (um por arquivo; arquivo novo só entra se foi editado ou é o da IA aberta)
  const pending = useMemo(() => {
    const seen = new Set<string>();
    return GLOBAL_PROVIDERS.filter((p) => {
      const f = files[p.id];
      const path = pathOf(p);
      if (!f || seen.has(path)) return false;
      const changed = f.content !== f.original;
      const untouchedTemplate = !f.exists && f.content === p.template && p.id !== activeProviderId;
      if (!changed || untouchedTemplate) return false;
      seen.add(path);
      return true;
    });
  }, [files, pathOf, activeProviderId]);

  // Replica as regras da IA aberta para todas as outras (só no rascunho; grava ao clicar em Salvar)
  const handleReplicate = () => {
    const source = fileContent;
    const others = GLOBAL_PROVIDERS.filter((p) => pathOf(p) !== fullFilePath);
    others.forEach((p) => setProviderContent(p.id, source));
    onToast(`Regras de ${activeProvider.name} replicadas para ${others.map((p) => p.name).join(', ')}. Clique em Salvar para gravar.`);
    logSystemActivity('ai_rules', 'replicate_global_rules', activeProvider.name, { destinos: others.map((p) => p.id) });
  };

  // Salva as regras de todas as IAs
  const handleSave = async () => {
    if (isSaving) return;
    if (!window.electronAPI?.fs?.writeFile) {
      onToast('API de arquivos não disponível');
      return;
    }
    if (pending.length === 0) {
      onToast('Nenhuma regra modificada para salvar');
      return;
    }
    setIsSaving(true);
    const saved: string[] = [];
    try {
      for (const p of pending) {
        const path = pathOf(p);
        const content = files[p.id].content;
        await window.electronAPI.fs.writeFile(path, content);
        saved.push(p.name);
        setFiles((prev) => {
          const next = { ...prev };
          GLOBAL_PROVIDERS.forEach((q) => {
            if (pathOf(q) === path) next[q.id] = { content, original: content, exists: true };
          });
          return next;
        });
        onFileSaved?.(path, content);
        logSystemActivity('ai_rules', 'save_global_rules', p.name, { path, size: content.length });
      }
      onToast(saved.length === 1 ? `Regras de ${saved[0]} salvas com sucesso` : `Regras salvas: ${saved.join(', ')}`);
    } catch (err: any) {
      onToast(`Erro ao salvar regras${saved.length ? ` (salvos antes do erro: ${saved.join(', ')})` : ''}: ${err?.message || 'Falha de gravação'}`);
    } finally {
      setIsSaving(false);
    }
  };

  // Open in IDE Editor
  const handleOpenInEditor = () => {
    if (!fullFilePath) return;
    onOpenFileInEditor(fullFilePath, activeProvider.fileName);
    onClose();
  };

  // Insert a snippet at cursor / end
  const handleInsertSnippet = (snippet: string) => {
    setFileContent(`${fileContent.trimEnd()}\n${snippet}`);
    setShowPresets(false);
    onToast('Diretriz inserida nas regras');
  };

  const isDirty = fileContent !== originalContent;
  const otherPending = pending.filter((p) => pathOf(p) !== fullFilePath).length;

  const isMouseDownOnBackdrop = useRef(false);
  const ft = getFieldTokens(isEffectiveDark);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: isEffectiveDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
      onMouseDown={(e) => {
        isMouseDownOnBackdrop.current = e.target === e.currentTarget;
      }}
      onMouseUp={(e) => {
        if (isMouseDownOnBackdrop.current && e.target === e.currentTarget) {
          onClose();
        }
        isMouseDownOnBackdrop.current = false;
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 1120,
          height: 'min(800px, calc(100vh - 32px))',
          background: isEffectiveDark ? '#161618' : '#ffffff',
          borderRadius: 12,
          border: 'none',
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.15s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Functional Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '10px 16px',
            gap: 12,
            borderBottom: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
            background: isEffectiveDark ? '#19191b' : '#f8fafc',
            flexShrink: 0,
          }}
        >
          {/* Abas das IAs (à esquerda): o ponto marca a IA com alteração ainda não salva */}
          <div data-tour="ai-rules-provider-selector" style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0, overflowX: 'auto' }}>
            {GLOBAL_PROVIDERS.map((provider) => {
              const isSelected = provider.id === activeProviderId;
              const f = files[provider.id];
              const changed = Boolean(f && f.content !== f.original);
              return (
                <button
                  key={provider.id}
                  type="button"
                  className="df-pressable"
                  onClick={() => {
                    logSystemActivity('regras_globais', 'selecionar_provedor', provider.name, { provider: provider.id });
                    setActiveProviderId(provider.id);
                  }}
                  title={`${provider.name} · ${provider.fileName}`}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 7,
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 6,
                    border: 'none',
                    boxShadow: 'none',
                    flexShrink: 0,
                    background: isSelected ? ft.fieldBg : 'transparent',
                    color: isSelected ? (isEffectiveDark ? '#ffffff' : '#18181b') : isEffectiveDark ? '#a1a1aa' : '#71717a',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 400,
                    transition: 'background-color 150ms ease, color 150ms ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {renderAiIcon(provider.id, 15)}
                  <span>{provider.name}</span>
                  {changed && <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />}
                </button>
              );
            })}
          </div>

          {/* Action Buttons on the Right */}
          <div data-tour="ai-rules-actions" style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            <TutorialTriggerButton
              contextId="modal_ai_rules"
              isDark={isEffectiveDark}
              accentColor={accentColor}
              textColor={isEffectiveDark ? '#f4f4f5' : '#0f172a'}
              mutedColor={isEffectiveDark ? '#a1a1aa' : '#71717a'}
              height={28}
              contextName="Regras Globais de IA"
            />
            {/* Replicar as regras desta IA para todas as outras */}
            <button
              type="button"
              onClick={handleReplicate}
              className="df-pressable"
              style={{ height: 28, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '0 10px', borderRadius: 6, border: 'none', boxShadow: 'none', background: ft.fieldBg, color: isEffectiveDark ? '#d4d4d8' : '#3f3f46', cursor: 'pointer', fontSize: 11.5, fontWeight: 400, transition: 'background-color 150ms ease, color 150ms ease' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = ft.fieldBgHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = ft.fieldBg)}
              title={`Copia as regras de ${activeProvider.name} para todas as outras IAs (grava ao clicar em Salvar)`}
            >
              <Copy size={13} />
              <span>Replicar para todas as IAs</span>
            </button>
            {/* Diretrizes Button (Icon only, no color, with tooltip) */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setShowPresets((v) => !v)}
                style={{
                  width: 28,
                  height: 28,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: 'none',
                  background: 'transparent',
                  color: showPresets ? accentColor : isEffectiveDark ? '#a1a1aa' : '#71717a',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = isEffectiveDark ? '#ffffff' : '#000000';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = showPresets ? accentColor : isEffectiveDark ? '#a1a1aa' : '#71717a';
                }}
                title="Diretrizes"
              >
                <Sparkles size={15} />
              </button>

              {showPresets && (
                <>
                  <div
                    style={{ position: 'fixed', inset: 0, zIndex: 100000 }}
                    onClick={() => setShowPresets(false)}
                  />
                  <div
                    style={{
                      position: 'absolute',
                      top: 'calc(100% + 4px)',
                      right: 0,
                      zIndex: 100001,
                      minWidth: 260,
                      background: ft.dropdownMenuBg,
                      borderRadius: 8,
                      border: ft.dropdownBorder,
                      boxShadow: 'none',
                      padding: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div
                      style={{
                        padding: '4px 8px',
                        fontSize: 10,
                        fontWeight: 400,
                        color: isEffectiveDark ? '#71717a' : '#a1a1aa',
                        textTransform: 'uppercase',
                        letterSpacing: '0.04em',
                      }}
                    >
                      Inserir Bloco de Regras
                    </div>
                    {PRESET_SNIPPETS.map((snip) => (
                      <div
                        key={snip.id}
                        onClick={() => handleInsertSnippet(snip.snippet)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                          transition: 'background 0.12s ease',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = isEffectiveDark
                            ? 'rgba(255, 255, 255, 0.06)'
                            : 'rgba(0, 0, 0, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div
                          style={{
                            fontSize: 12,
                            fontWeight: 400,
                            color: isEffectiveDark ? '#f4f4f5' : '#18181b',
                          }}
                        >
                          {snip.title}
                        </div>
                        <div
                          style={{
                            fontSize: 10.5,
                            color: isEffectiveDark ? '#a1a1aa' : '#71717a',
                          }}
                        >
                          {snip.description}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Abrir no Editor Button (Icon only, no color, with tooltip) */}
            <button
              type="button"
              onClick={handleOpenInEditor}
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                cursor: 'pointer',
                border: 'none',
                boxShadow: 'none',
                background: 'transparent',
                color: isEffectiveDark ? '#a1a1aa' : '#71717a',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = isEffectiveDark ? '#ffffff' : '#000000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isEffectiveDark ? '#a1a1aa' : '#71717a';
              }}
              title="Abrir no Editor"
            >
              <ExternalLink size={15} />
            </button>

            {/* Save Button (Always "Salvar", height 28px) */}
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              style={{
                height: 28,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 12px',
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 500,
                cursor: isSaving ? 'not-allowed' : 'pointer',
                border: 'none',
                boxShadow: 'none',
                background: accentColor,
                color: accentContrastText,
                transition: 'all 0.15s ease',
                opacity: isSaving ? 0.7 : 1,
              }}
            >
              {isSaving ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <Save size={12} />
              )}
              <span>{isSaving ? 'Salvando...' : 'Salvar'}</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 6,
                cursor: 'pointer',
                border: 'none',
                boxShadow: 'none',
                background: 'transparent',
                color: isEffectiveDark ? '#a1a1aa' : '#71717a',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = isEffectiveDark ? '#ffffff' : '#000000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = isEffectiveDark ? '#a1a1aa' : '#71717a';
              }}
              title="Fechar (Esc)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Sub-bar with path & status */}
        <div
          data-tour="ai-rules-path-bar"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            fontSize: 11,
            color: isEffectiveDark ? '#a1a1aa' : '#71717a',
            borderBottom: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(0, 0, 0, 0.04)',
            background: isEffectiveDark ? '#141416' : '#f1f5f9',
            fontFamily: 'monospace',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <FileCode size={13} color={accentColor} style={{ flexShrink: 0 }} />
            <span
              style={{
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                maxWidth: 550,
              }}
              title={fullFilePath}
            >
              {fullFilePath}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            {fileExists ? (
              <span style={{ color: '#22c55e', fontSize: 10.5 }}>Arquivo existente</span>
            ) : (
              <span style={{ color: '#f59e0b', fontSize: 10.5 }}>Será criado ao salvar</span>
            )}
            <span style={{ opacity: 0.5 }}>•</span>
            <span style={{ fontSize: 10.5 }}>{fileContent.length} caracteres</span>
            {isDirty && (
              <>
                <span style={{ opacity: 0.5 }}>•</span>
                <span style={{ color: '#ef4444', fontSize: 10.5 }}>Modificado</span>
              </>
            )}
            {otherPending > 0 && (
              <>
                <span style={{ opacity: 0.5 }}>•</span>
                <span style={{ color: '#f59e0b', fontSize: 10.5 }}>+{otherPending} {otherPending === 1 ? 'outra IA modificada' : 'outras IAs modificadas'}</span>
              </>
            )}
          </div>
        </div>

        {/* Editor Area */}
        <div
          data-tour="ai-rules-editor"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            background: isEffectiveDark ? '#121214' : '#fafafa',
            overflow: 'hidden',
          }}
        >
          {isLoading ? (
            <div
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                color: isEffectiveDark ? '#a1a1aa' : '#71717a',
                fontSize: 12,
              }}
            >
              <Loader2 size={16} className="animate-spin" color={accentColor} />
              <span>Carregando arquivo de regras...</span>
            </div>
          ) : (
            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              placeholder={`Escreva aqui as diretrizes e regras globais para o ${activeProvider.name}...`}
              spellCheck={false}
              style={{
                width: '100%',
                height: '100%',
                padding: '16px',
                background: 'transparent',
                color: isEffectiveDark ? '#f4f4f5' : '#18181b',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                fontSize: 12.5,
                lineHeight: 1.6,
                border: 'none',
                boxShadow: 'none',
                outline: 'none',
                resize: 'none',
              }}
            />
          )}
        </div>

        {/* Footer info bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '8px 12px',
            fontSize: 10.5,
            color: isEffectiveDark ? '#71717a' : '#94a3b8',
            borderTop: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.04)' : '1px solid rgba(0, 0, 0, 0.04)',
            background: isEffectiveDark ? '#141416' : '#f1f5f9',
            flexShrink: 0,
          }}
        >
          <span>{activeProvider.description}</span>
          <span>Dica: Salve com o botão ou abra na aba do editor para edição avançada</span>
        </div>
      </div>
    </div>
  );
};
