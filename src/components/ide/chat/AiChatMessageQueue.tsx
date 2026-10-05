import React from 'react';
import { Layers, X } from 'lucide-react';

export interface QueuedMessageItem {
  id: string;
  prompt: string;
  timestamp: number;
}

interface AiChatMessageQueueProps {
  queue: QueuedMessageItem[];
  onRemoveFromQueue: (id: string) => void;
  accentColor: string;
  themeTokens: any;
  isEffectiveDark: boolean;
}

export const AiChatMessageQueue: React.FC<AiChatMessageQueueProps> = ({
  queue: rawQueue,
  onRemoveFromQueue,
  accentColor,
  themeTokens,
  isEffectiveDark,
}) => {
  const queue = Array.isArray(rawQueue) ? rawQueue : [];
  if (queue.length === 0) return null;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        padding: 8,
        borderRadius: 6,
        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
        border: 'none',
        boxShadow: 'none',
        width: '100%',
        boxSizing: 'border-box',
        transition: 'all 0.15s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Layers size={12} color={accentColor} />
          <span style={{ fontSize: 11, fontWeight: 500, color: themeTokens.textPrimary }}>
            Fila de Mensagens ({queue.length})
          </span>
        </div>
        <span style={{ fontSize: 10, color: themeTokens.textSecondary }}>
          Execução sequencial automática
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        {queue.map((item, idx) => (
          <div
            key={item.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '4px 6px',
              borderRadius: 4,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
              gap: 6,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
              <span style={{ fontSize: 10, color: accentColor, fontWeight: 500 }}>
                #{idx + 1}
              </span>
              <span
                style={{
                  fontSize: 11,
                  color: themeTokens.textPrimary,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {item.prompt}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onRemoveFromQueue(item.id)}
              title="Remover da fila"
              style={{
                height: 18,
                width: 18,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 'none',
                color: themeTokens.textSecondary,
                cursor: 'pointer',
                borderRadius: 3,
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
            >
              <X size={11} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
