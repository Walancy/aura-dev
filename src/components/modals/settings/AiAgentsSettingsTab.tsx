import React from 'react';
import { Check, Zap, ListChecks, Bot, MessageSquare, AlertTriangle, Pin } from 'lucide-react';
import { AI_PROVIDERS, AI_MODES } from '../../../constants/ai';
import type { AiMode } from '../../../constants/ai';
import { ClaudeIcon, AntigravityIcon, CodexIcon, GeminiIcon, OllamaIcon } from '../../icons/AiProviderIcons';
import { MiniSwitch } from '../../ui/MiniSwitch';
import type { ThemeTokens } from '../../../types/ide';
import { logSystemActivity } from '../../../utils/brainService';

const hexToRgba = (hex: string, alpha: number) => {
  if (!hex || !hex.startsWith('#')) return `rgba(59, 130, 246, ${alpha})`;
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16) || 0;
  const g = parseInt(clean.substring(2, 4), 16) || 0;
  const b = parseInt(clean.substring(4, 6), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export interface AiAgentsSettingsTabProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  selectedAiProvider: string;
  setSelectedAiProvider: (id: string) => void;
  aiMode: AiMode;
  setAiMode: (id: AiMode) => void;
  aiAutoApprove: boolean;
  setAiAutoApprove: (value: boolean) => void;
  aiConfirmBeforeDelete: boolean;
  setAiConfirmBeforeDelete: (value: boolean) => void;
  onOpenAiGlobalRules?: () => void;
  onOpenSkills?: () => void;
  activeSkillsCount?: number;

  // Additional system settings
  pinnedAis?: string[];
  setPinnedAis?: (pinned: string[]) => void;
  useAiSystemAccent?: boolean;
  setUseAiSystemAccent?: (value: boolean) => void;
  useAiChatThemeColor?: boolean;
  setUseAiChatThemeColor?: (value: boolean) => void;
  devForce?: boolean;
  setDevForce?: (value: boolean) => void;
  aiAutoUpdate?: boolean;
  setAiAutoUpdate?: (value: boolean) => void;
}

export const AiAgentsSettingsTab: React.FC<AiAgentsSettingsTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
  selectedAiProvider,
  setSelectedAiProvider,
  aiMode,
  setAiMode,
  aiAutoApprove,
  setAiAutoApprove,
  aiConfirmBeforeDelete,
  setAiConfirmBeforeDelete,
  onOpenAiGlobalRules,
  onOpenSkills,
  activeSkillsCount = 0,
  pinnedAis = [],
  setPinnedAis,
  useAiSystemAccent = false,
  setUseAiSystemAccent,
  useAiChatThemeColor = true,
  setUseAiChatThemeColor,
  devForce = false,
  setDevForce,
  aiAutoUpdate = false,
  setAiAutoUpdate,
}) => {
  const iconMap: Record<string, React.ReactNode> = {
    claude: <ClaudeIcon size={14} />,
    antigravity: <AntigravityIcon size={14} />,
    codex: <CodexIcon size={14} />,
    gemini: <GeminiIcon size={14} />,
    ollama: <OllamaIcon size={14} />,
  };

  const handleTogglePin = (id: string) => {
    if (!setPinnedAis) return;
    const isPinned = pinnedAis.includes(id);
    const next = isPinned ? pinnedAis.filter((x) => x !== id) : [...pinnedAis, id];
    setPinnedAis(next);
    try {
      localStorage.setItem('header_pinned_ais', JSON.stringify(next));
    } catch {}
    logSystemActivity('configuracoes_ia', 'toggle_pin_ia', id, { fixada: !isPinned });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      {/* Regras Globais & Skills Quick Actions */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 8 }}>
        {onOpenAiGlobalRules && (
          <div
            onClick={onOpenAiGlobalRules}
            style={{
              padding: 12,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)',
              borderRadius: 8,
              border: 'none',
              boxShadow: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isEffectiveDark
                ? 'rgba(255, 255, 255, 0.06)'
                : 'rgba(0, 0, 0, 0.045)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isEffectiveDark
                ? 'rgba(255, 255, 255, 0.035)'
                : 'rgba(0, 0, 0, 0.025)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: accentColor, display: 'flex' }}>
                  <ListChecks size={14} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>Regras Globais</span>
              </div>
            </div>
            <div style={{ fontSize: 10.5, color: themeTokens.textSecondary, lineHeight: 1.4 }}>
              Diretrizes e restrições globais de conduta para todos os agentes.
            </div>
          </div>
        )}

        {onOpenSkills && (
          <div
            onClick={onOpenSkills}
            style={{
              padding: 12,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)',
              borderRadius: 8,
              border: 'none',
              boxShadow: 'none',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isEffectiveDark
                ? 'rgba(255, 255, 255, 0.06)'
                : 'rgba(0, 0, 0, 0.045)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isEffectiveDark
                ? 'rgba(255, 255, 255, 0.035)'
                : 'rgba(0, 0, 0, 0.025)';
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: accentColor, display: 'flex' }}>
                  <Zap size={14} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>Skills da IA</span>
              </div>
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 4,
                  background: activeSkillsCount > 0 ? hexToRgba(accentColor, 0.14) : 'rgba(255,255,255,0.06)',
                  color: activeSkillsCount > 0 ? accentColor : themeTokens.textSecondary,
                  fontWeight: 400,
                }}
              >
                {activeSkillsCount} ativas
              </span>
            </div>
            <div style={{ fontSize: 10.5, color: themeTokens.textSecondary, lineHeight: 1.4 }}>
              Gerencie, instale e ative novas skills para o ecossistema.
            </div>
          </div>
        )}
      </div>

      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />

      {/* Provedor de IA Padrão */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 500,
            color: themeTokens.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Provedor de IA Padrão
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          {AI_PROVIDERS.map((p) => {
            const isSelected = selectedAiProvider === p.id;
            return (
              <div
                key={p.id}
                onClick={() => {
                  logSystemActivity('configuracoes_ia', 'alterar_provedor_padrao', p.name, { provider: p.id });
                  setSelectedAiProvider(p.id);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: 'none',
                  background: isSelected
                    ? hexToRgba(accentColor, 0.18)
                    : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                  color: isSelected ? (isEffectiveDark ? '#ffffff' : accentColor) : themeTokens.textPrimary,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.07)'
                      : 'rgba(0, 0, 0, 0.07)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
              >
                {iconMap[p.id]}
                <span style={{ fontSize: 11.5, fontWeight: 400 }}>{p.name}</span>
                {isSelected && <Check size={12} color={accentColor} style={{ marginLeft: 'auto' }} />}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />

      {/* Modo Padrão do Agente */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 500,
            color: themeTokens.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Modo Padrão do Agente
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8 }}>
          {AI_MODES.map((m) => {
            const isSelected = aiMode === m.id;
            const modeIcons: Record<string, React.ReactNode> = {
              Zap: <Zap size={13} />,
              ListChecks: <ListChecks size={13} />,
              Bot: <Bot size={13} />,
              MessageSquare: <MessageSquare size={13} />,
            };
            return (
              <div
                key={m.id}
                onClick={() => {
                  logSystemActivity('configuracoes_ia', 'alterar_modo_agente', m.name, { mode: m.id });
                  setAiMode(m.id);
                }}
                style={{
                  padding: 10,
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: 'none',
                  background: isSelected
                    ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0')
                    : (isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)'),
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.03)'
                      : 'rgba(0, 0, 0, 0.025)';
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ color: isSelected ? accentColor : themeTokens.textSecondary }}>{modeIcons[m.iconName]}</div>
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: isSelected ? accentColor : 'transparent',
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>{m.name}</div>
                <div style={{ fontSize: 10.5, color: themeTokens.textSecondary, lineHeight: 1.35 }}>{m.description}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />

      {/* IAs Fixadas no Cabeçalho */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 500,
            color: themeTokens.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          IAs Fixadas no Cabeçalho
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
          {AI_PROVIDERS.map((p) => {
            const isPinned = pinnedAis.includes(p.id);
            const isCurrent = selectedAiProvider === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleTogglePin(p.id)}
                style={{
                  width: '100%',
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: 'none',
                  boxShadow: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  fontSize: 11.5,
                  fontWeight: 400,
                  boxSizing: 'border-box',
                  background: isPinned || isCurrent
                    ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0')
                    : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                  color: isPinned || isCurrent ? themeTokens.textPrimary : themeTokens.textSecondary,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isPinned && !isCurrent) {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.07)'
                      : 'rgba(0, 0, 0, 0.07)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isPinned && !isCurrent) {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
                title={isCurrent ? 'Provedor ativo' : isPinned ? 'Desafixar do cabeçalho' : 'Fixar no cabeçalho'}
              >
                {iconMap[p.id]}
                <span style={{ fontSize: 11.5, fontWeight: 400 }}>{p.name}</span>
                <Pin
                  size={11}
                  color={isPinned || isCurrent ? accentColor : themeTokens.textSecondary}
                  fill={isPinned || isCurrent ? accentColor : 'none'}
                  style={{ marginLeft: 'auto' }}
                />
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />

      {/* Personalização Visual da IA */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 500,
            color: themeTokens.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Personalização Visual da IA
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {setUseAiSystemAccent && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 8,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)',
                border: 'none',
                boxShadow: 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                  Sincronizar Destaque do Sistema com IA Ativa
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                  A interface assume a cor oficial do provedor selecionado.
                </span>
              </div>
              <MiniSwitch
                checked={useAiSystemAccent}
                onChange={() => {
                  const next = !useAiSystemAccent;
                  setUseAiSystemAccent(next);
                  try {
                    localStorage.setItem('ide_use_ai_system_accent', String(next));
                  } catch {}
                  logSystemActivity('configuracoes_ia', 'toggle_system_accent', 'sistema', { ativo: next });
                }}
                accentColor={accentColor}
              />
            </div>
          )}

          {setUseAiChatThemeColor && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 8,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)',
                border: 'none',
                boxShadow: 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                  Cor do Provedor no Painel de Chat
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                  Aplica a cor de marca da IA nos balões de mensagem do chat.
                </span>
              </div>
              <MiniSwitch
                checked={useAiChatThemeColor}
                onChange={() => {
                  const next = !useAiChatThemeColor;
                  setUseAiChatThemeColor(next);
                  try {
                    localStorage.setItem('ide_use_ai_chat_color', String(next));
                  } catch {}
                  logSystemActivity('configuracoes_ia', 'toggle_chat_color', 'chat', { ativo: next });
                }}
                accentColor={accentColor}
              />
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />

      {/* Segurança & Execução */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 500,
            color: themeTokens.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Segurança & Execução
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              borderRadius: 8,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)',
              border: 'none',
              boxShadow: 'none',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                Auto-aprovar Comandos do Agente
              </span>
              <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                Executa comandos sugeridos sem pedir confirmação manual antes de cada ação.
              </span>
              {aiAutoApprove && (
                <div style={{ fontSize: 10.5, color: '#f59e0b', marginTop: 2, display: 'flex', alignItems: 'center', gap: 4 }}>
                  <AlertTriangle size={11} />
                  Ações de terminal e escrita podem alterar arquivos automaticamente.
                </div>
              )}
            </div>
            <MiniSwitch
              checked={aiAutoApprove}
              onChange={() => {
                logSystemActivity('configuracoes_ia', 'toggle_auto_approve', 'segurança', { ativo: !aiAutoApprove });
                setAiAutoApprove(!aiAutoApprove);
              }}
              accentColor={accentColor}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              borderRadius: 8,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)',
              border: 'none',
              boxShadow: 'none',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                Confirmar Antes de Excluir Arquivos
              </span>
              <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                Exibe um modal de confirmação estilizado antes da exclusão de qualquer arquivo.
              </span>
            </div>
            <MiniSwitch
              checked={aiConfirmBeforeDelete}
              onChange={() => {
                logSystemActivity('configuracoes_ia', 'toggle_confirm_delete', 'segurança', { ativo: !aiConfirmBeforeDelete });
                setAiConfirmBeforeDelete(!aiConfirmBeforeDelete);
              }}
              accentColor={accentColor}
            />
          </div>

          {setDevForce && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 8,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)',
                border: 'none',
                boxShadow: 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                  Modo Forçado de Execução (--force)
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                  Ignora verificações intermediárias de dependências ao executar scripts.
                </span>
              </div>
              <MiniSwitch
                checked={devForce}
                onChange={() => {
                  const next = !devForce;
                  setDevForce(next);
                  try {
                    localStorage.setItem('dev_run_force', String(next));
                  } catch {}
                  logSystemActivity('configuracoes_ia', 'toggle_dev_force', 'execucao', { ativo: next });
                }}
                accentColor={accentColor}
              />
            </div>
          )}
        </div>
      </div>

      {/* Atualização Automática de IAs */}
      {setAiAutoUpdate && (
        <>
          <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                color: themeTokens.textSecondary,
                textTransform: 'uppercase',
                letterSpacing: 0.5,
              }}
            >
              Atualizações do Sistema de IA
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 8,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)',
                border: 'none',
                boxShadow: 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                  Atualização Automática de IAs (Auto-update)
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                  Atualiza os CLIs das IAs automaticamente em segundo plano ao detectar novas versões e notifica com o link do patch notes.
                </span>
              </div>
              <MiniSwitch
                checked={!!aiAutoUpdate}
                onChange={() => {
                  const next = !aiAutoUpdate;
                  setAiAutoUpdate(next);
                  try {
                    localStorage.setItem('ai_auto_update', String(next));
                  } catch {}
                  logSystemActivity('configuracoes_ia', 'toggle_auto_update', 'sistema', { ativo: next });
                }}
                accentColor={accentColor}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
};
