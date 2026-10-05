import React, { useEffect, useRef } from 'react';
import { X, ExternalLink, CheckCircle2, Bell } from 'lucide-react';
import { ClaudeIcon, AntigravityIcon, GeminiIcon, CodexIcon, OllamaIcon } from '../icons/AiProviderIcons';

export interface ProjectAiNotificationItem {
  id: string;
  projectPath: string;
  projectName: string;
  provider: string; // 'claude' | 'agy' | 'antigravity' | 'gemini' | 'codex' | 'ollama' | string
  summary: string;
  timestamp: number;
  /** 'question' = a IA parou esperando resposta do usuário; padrão: terminou de gerar */
  kind?: 'done' | 'question';
  /** Onde a IA estava trabalhando: chat da IDE ou terminal da tela CLI */
  source?: 'ide' | 'cli' | 'design';
}

interface ProjectAiNotificationToastProps {
  notifications: ProjectAiNotificationItem[];
  onDismiss: (id: string) => void;
  onNavigateToProject: (projectPath: string, repoName?: string, source?: 'ide' | 'cli' | 'design') => void;
  accentColor?: string;
  isEffectiveDark?: boolean;
}

// Pleasant soft audio chime using Web Audio API (no external asset needed)
function playNotificationChime() {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gainNode = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';

    // Tone 1: 587.33 Hz (D5) -> Tone 2: 880 Hz (A5)
    osc1.frequency.setValueAtTime(587.33, now);
    osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12);

    osc2.frequency.setValueAtTime(880, now);
    osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.16);

    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.12, now + 0.04);
    gainNode.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    gainNode.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now + 0.08);
    osc1.stop(now + 0.45);
    osc2.stop(now + 0.45);
  } catch {}
}

export const ProjectAiNotificationToast: React.FC<ProjectAiNotificationToastProps> = ({
  notifications,
  onDismiss,
  onNavigateToProject,
  accentColor = '#FF6A00',
  isEffectiveDark = true,
}) => {
  const lastChimeTimeRef = useRef<number>(0);

  // Play chime whenever a new notification arrives (with 1s cooldown)
  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[notifications.length - 1];
      if (Date.now() - lastChimeTimeRef.current > 1500) {
        lastChimeTimeRef.current = Date.now();
        playNotificationChime();
      }
    }
  }, [notifications]);

  if (notifications.length === 0) return null;

  const renderAiIcon = (provider: string, size = 18) => {
    const prov = (provider || '').toLowerCase();
    if (prov.includes('claude')) return <ClaudeIcon size={size} />;
    if (prov.includes('agy') || prov.includes('antigravity')) return <AntigravityIcon size={size} />;
    if (prov.includes('gemini')) return <GeminiIcon size={size} />;
    if (prov.includes('codex') || prov.includes('openai')) return <CodexIcon size={size} />;
    if (prov.includes('ollama')) return <OllamaIcon size={size} />;
    return <CheckCircle2 size={size} color="#22c55e" />;
  };

  const formatProviderName = (provider: string) => {
    const prov = (provider || '').toLowerCase();
    if (prov.includes('claude')) return 'Claude Code';
    if (prov.includes('agy') || prov.includes('antigravity')) return 'Antigravity (AGY)';
    if (prov.includes('gemini')) return 'Gemini';
    if (prov.includes('codex') || prov.includes('openai')) return 'Codex';
    if (prov.includes('ollama')) return 'Ollama';
    return 'Agente IA';
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 50,
        right: 18,
        zIndex: 99999,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        maxWidth: 380,
        width: 'calc(100vw - 36px)',
        pointerEvents: 'none',
      }}
    >
      {notifications.map((item) => (
        <div
          key={item.id}
          style={{
            pointerEvents: 'auto',
            background: isEffectiveDark ? 'rgba(26, 26, 28, 0.96)' : 'rgba(255, 255, 255, 0.98)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: 'none',
            borderRadius: 8,
            boxShadow: 'none',
            padding: 12,
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
            animation: 'slideInRight 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
            fontFamily: 'Poppins, -apple-system, sans-serif',
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
              <div
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 6,
                  background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                {renderAiIcon(item.provider, 16)}
              </div>
              <div style={{ minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 12,
                    fontWeight: 600,
                    color: isEffectiveDark ? '#ffffff' : '#111827',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <span>{item.projectName}</span>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 500,
                      padding: '1px 5px',
                      borderRadius: 4,
                      background: `${accentColor}18`,
                      color: accentColor,
                    }}
                  >
                    {formatProviderName(item.provider)}
                  </span>
                </div>
              </div>
            </div>

            {/* Dismiss Button */}
            <button
              type="button"
              onClick={() => onDismiss(item.id)}
              style={{
                background: 'transparent',
                border: 'none',
                color: isEffectiveDark ? '#9ca3af' : '#6b7280',
                cursor: 'pointer',
                padding: 3,
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = isEffectiveDark ? '#9ca3af' : '#6b7280')}
              title="Fechar notificação"
            >
              <X size={14} />
            </button>
          </div>

          {/* Body Text */}
          <div
            style={{
              fontSize: 11.5,
              color: isEffectiveDark ? '#d1d5db' : '#374151',
              lineHeight: 1.45,
              maxHeight: 52,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
            }}
          >
            {item.summary || (item.kind === 'question' ? 'A IA está esperando uma resposta sua.' : 'A tarefa foi concluída com sucesso em segundo plano.')}
          </div>

          {/* Action Footer */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingTop: 8,
              borderTop: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
            }}
          >
            <span style={{ fontSize: 10, color: isEffectiveDark ? '#6b7280' : '#9ca3af' }}>
              {item.kind === 'question' ? 'Aguardando sua resposta' : 'Concluído em background'}
            </span>

            <button
              type="button"
              onClick={() => {
                onNavigateToProject(item.projectPath, item.projectName, item.source);
                onDismiss(item.id);
              }}
              style={{
                height: 26,
                background: accentColor,
                border: 'none',
                boxShadow: 'none',
                color: '#ffffff',
                borderRadius: 4,
                padding: '0 10px',
                fontSize: 11,
                fontWeight: 500,
                fontFamily: 'Poppins, sans-serif',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <span>Ir para o projeto</span>
              <ExternalLink size={11} />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
