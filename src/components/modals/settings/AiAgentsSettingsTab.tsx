import React from 'react';
import { Check, Zap, ListChecks, Bot, MessageSquare, AlertTriangle } from 'lucide-react';
import { AI_PROVIDERS, AI_MODES } from '../../../constants/ai';
import type { AiMode } from '../../../constants/ai';
import { ClaudeIcon, AntigravityIcon, CodexIcon, GeminiIcon, OllamaIcon } from '../../icons/AiProviderIcons';
import { MiniSwitch } from '../../ui/MiniSwitch';
import type { ThemeTokens } from '../../../types/ide';

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
}) => {
  return (
    <>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>IA & Agentes</div>
        <div style={{ fontSize: 12.5, color: themeTokens.textSecondary }}>
          Provedor e modo padrão usados ao abrir o painel de IA, e regras de segurança para execução de agentes.
        </div>
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Provedor de IA Padrão</div>
        <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 10 }}>
          CLI utilizada por padrão ao iniciar uma nova conversa no painel de IA.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 10 }}>
          {AI_PROVIDERS.map((p) => {
            const isSelected = selectedAiProvider === p.id;
            const iconMap: Record<string, React.ReactNode> = {
              claude: <ClaudeIcon size={16} />,
              antigravity: <AntigravityIcon size={16} />,
              codex: <CodexIcon size={16} />,
              gemini: <GeminiIcon size={16} />,
              ollama: <OllamaIcon size={16} />,
            };
            return (
              <div
                key={p.id}
                onClick={() => setSelectedAiProvider(p.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: isSelected ? `1.5px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                  background: isSelected ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)') : 'transparent',
                  transition: 'all 0.15s ease',
                }}
              >
                {iconMap[p.id]}
                <span style={{ fontSize: 12.5, fontWeight: isSelected ? 600 : 400, color: isSelected ? accentColor : themeTokens.textPrimary }}>
                  {p.name}
                </span>
                {isSelected && <Check size={12} color={accentColor} style={{ marginLeft: 'auto' }} />}
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Modo Padrão do Agente</div>
        <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 10 }}>
          Comportamento aplicado a novas conversas: execução autônoma, planejamento, agente interativo ou apenas respostas.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          {AI_MODES.map((m) => {
            const isSelected = aiMode === m.id;
            const iconMap: Record<string, React.ReactNode> = {
              Zap: <Zap size={16} />,
              ListChecks: <ListChecks size={16} />,
              Bot: <Bot size={16} />,
              MessageSquare: <MessageSquare size={16} />,
            };
            return (
              <div
                key={m.id}
                onClick={() => setAiMode(m.id)}
                style={{
                  padding: '12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: isSelected ? `1.5px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                  background: isSelected ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)') : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ color: isSelected ? accentColor : 'inherit' }}>{iconMap[m.iconName]}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: themeTokens.textPrimary }}>{m.name}</div>
                <div style={{ fontSize: 11, color: themeTokens.textSecondary }}>{m.description}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Segurança</div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '9px 10px',
            borderRadius: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: themeTokens.textPrimary }}>Auto-aprovar Comandos do Agente</div>
            <div style={{ fontSize: 11.5, color: themeTokens.textSecondary, maxWidth: 460 }}>
              Executa comandos sugeridos pela IA sem pedir confirmação manual antes de cada ação.
            </div>
            {aiAutoApprove && (
              <div style={{ fontSize: 11, color: '#f59e0b', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                <AlertTriangle size={11} />
                Cuidado: comandos podem alterar ou apagar arquivos sem revisão prévia.
              </div>
            )}
          </div>
          <MiniSwitch checked={aiAutoApprove} onChange={() => setAiAutoApprove(!aiAutoApprove)} accentColor={accentColor} />
        </div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 12,
            padding: '9px 10px',
            borderRadius: 8,
          }}
        >
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: themeTokens.textPrimary }}>Confirmar Antes de Excluir Arquivos</div>
            <div style={{ fontSize: 11.5, color: themeTokens.textSecondary }}>
              Pede confirmação sempre que um agente tentar deletar arquivos do projeto.
            </div>
          </div>
          <MiniSwitch checked={aiConfirmBeforeDelete} onChange={() => setAiConfirmBeforeDelete(!aiConfirmBeforeDelete)} accentColor={accentColor} />
        </div>
      </div>
    </>
  );
};
