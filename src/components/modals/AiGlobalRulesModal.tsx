import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  Code2,
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
} from 'lucide-react';
import { logSystemActivity } from '../../utils/brainService';

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
  const [activeProviderId, setActiveProviderId] = useState<string>(selectedAiProvider || 'antigravity');
  const [homeDir, setHomeDir] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [fileExists, setFileExists] = useState<boolean>(false);
  const [resolvedPath, setResolvedPath] = useState<string>('');
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

  // Load file content whenever active provider or homeDir changes
  const loadRules = useCallback(async () => {
    if (!fullFilePath || !isOpen) return;
    setIsLoading(true);

    try {
      if (window.electronAPI?.fs?.readFile) {
        const res = await window.electronAPI.fs.readFile(fullFilePath);
        if (res && res.content !== null && res.content !== undefined && !res.error) {
          setFileContent(res.content);
          setOriginalContent(res.content);
          setFileExists(true);
          setResolvedPath(fullFilePath);
          setIsLoading(false);
          return;
        }
      }

      // If file does not exist, use default template
      setFileContent(activeProvider.template);
      setOriginalContent('');
      setFileExists(false);
      setResolvedPath(fullFilePath);
    } catch {
      setFileContent(activeProvider.template);
      setOriginalContent('');
      setFileExists(false);
      setResolvedPath(fullFilePath);
    } finally {
      setIsLoading(false);
    }
  }, [fullFilePath, isOpen, activeProvider]);

  useEffect(() => {
    if (isOpen && homeDir) {
      loadRules();
    }
  }, [isOpen, homeDir, activeProviderId, loadRules]);

  // Save rules to file
  const handleSave = async () => {
    if (!fullFilePath || isSaving) return;
    setIsSaving(true);

    try {
      if (window.electronAPI?.fs?.writeFile) {
        await window.electronAPI.fs.writeFile(fullFilePath, fileContent);
        setOriginalContent(fileContent);
        setFileExists(true);
        onToast(`Regras de ${activeProvider.name} salvas com sucesso`);
        onFileSaved?.(fullFilePath, fileContent);
        logSystemActivity('ai_rules', 'save_global_rules', activeProvider.name, {
          path: fullFilePath,
          size: fileContent.length,
        });
      } else {
        onToast('API de arquivos não disponível');
      }
    } catch (err: any) {
      onToast(`Erro ao salvar regras: ${err?.message || 'Falha de gravação'}`);
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
    setFileContent((prev) => {
      const cleanPrev = prev.trimEnd();
      return `${cleanPrev}\n${snippet}`;
    });
    setShowPresets(false);
    onToast('Diretriz inserida nas regras');
  };

  const isDirty = fileContent !== originalContent;

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
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 880,
          height: 'min(780px, 90vh)',
          background: isEffectiveDark ? '#161618' : '#ffffff',
          borderRadius: 10,
          border: 'none',
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          transition: 'all 0.15s ease',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Functional Bar (Tabs on the Left, Actions on the Right - No ViewHeader) */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            gap: 12,
            borderBottom: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.06)' : '1px solid rgba(0, 0, 0, 0.06)',
            background: isEffectiveDark ? '#19191b' : '#f8fafc',
            flexShrink: 0,
          }}
        >
          {/* Tabs on the Left */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              overflowX: 'auto',
              minWidth: 0,
              flex: 1,
            }}
            className="no-scrollbar"
          >
            {GLOBAL_PROVIDERS.map((p) => {
              const isActive = p.id === activeProviderId;
              const isHeaderSelected = p.id === selectedAiProvider;

              return (
                <button
                  key={p.id}
                  onClick={() => setActiveProviderId(p.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 400,
                    cursor: 'pointer',
                    border: 'none',
                    boxShadow: 'none',
                    background: isActive
                      ? isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(0, 0, 0, 0.08)'
                      : 'transparent',
                    color: isActive
                      ? isEffectiveDark
                        ? '#ffffff'
                        : '#09090b'
                      : isEffectiveDark
                      ? '#a1a1aa'
                      : '#64748b',
                    transition: 'all 0.15s ease',
                    whiteSpace: 'nowrap',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 0, 0, 0.04)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <ScrollText size={13} color={isActive ? accentColor : 'currentColor'} />
                  <span>{p.name}</span>
                  {isHeaderSelected && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 400,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.07)',
                        color: accentColor,
                      }}
                      title="IA atualmente selecionada na barra superior"
                    >
                      Header
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Action Buttons on the Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            {/* Quick Presets Dropdown Trigger */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setShowPresets((v) => !v)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  padding: '6px 10px',
                  borderRadius: 6,
                  fontSize: 11.5,
                  fontWeight: 400,
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: 'none',
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                  color: isEffectiveDark ? '#d4d4d8' : '#3f3f46',
                  transition: 'all 0.15s ease',
                }}
                title="Inserir diretrizes prontas"
              >
                <Sparkles size={12} color={accentColor} />
                <span>Diretrizes</span>
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
                      background: isEffectiveDark ? '#1f1f22' : '#ffffff',
                      borderRadius: 8,
                      border: 'none',
                      boxShadow: 'none',
                      padding: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
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

            {/* Open in IDE Editor */}
            <button
              onClick={handleOpenInEditor}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 11px',
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 400,
                cursor: 'pointer',
                border: 'none',
                boxShadow: 'none',
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                color: isEffectiveDark ? '#f4f4f5' : '#18181b',
                transition: 'all 0.15s ease',
              }}
              title="Abrir arquivo completo em aba no editor"
            >
              <ExternalLink size={12} />
              <span>Abrir no Editor</span>
            </button>

            {/* Save Button */}
            <button
              onClick={handleSave}
              disabled={isSaving}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 6,
                fontSize: 11.5,
                fontWeight: 400,
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
              <span>{isDirty ? 'Salvar *' : 'Salvo'}</span>
            </button>

            {/* Close Button */}
            <button
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
                e.currentTarget.style.background = isEffectiveDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(0, 0, 0, 0.06)';
                e.currentTarget.style.color = isEffectiveDark ? '#ffffff' : '#000000';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
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
          </div>
        </div>

        {/* Editor Area */}
        <div
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
