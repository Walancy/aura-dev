import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Sparkles, Loader2 } from 'lucide-react';
import type { WorkflowNode } from './OrchestrationCanvas';

export interface OrchestrationOmbroPanelProps {
  isOpen: boolean;
  onClose: () => void;
  nodes: WorkflowNode[];
  nodeSummaries: Record<string, { summary: string; timestamp: number }>;
  askOmbro: (question: string, context: string) => Promise<string>;
  accentColor: string;
  isEffectiveDark: boolean;
  bgCard: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
}

interface OmbroEntry {
  question: string;
  answer: string;
  isError?: boolean;
}

// "Ombro": painel assistente que observa o estado dos agentes e responde perguntas sobre eles.
export const OrchestrationOmbroPanel: React.FC<OrchestrationOmbroPanelProps> = ({
  isOpen,
  onClose,
  nodes,
  nodeSummaries,
  askOmbro,
  accentColor,
  isEffectiveDark,
  bgCard,
  border,
  textPrimary,
  textSecondary,
}) => {
  const [question, setQuestion] = useState('');
  const [entries, setEntries] = useState<OmbroEntry[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Auto-scroll to latest message
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [entries, isBusy, isOpen]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const relevantNodes = nodes.filter(
    (n) => n.type === 'model' || n.type === 'agent' || n.type === 'tool' || n.type === 'ide' || Boolean(nodeSummaries[n.id])
  );

  const handleAsk = async () => {
    const q = question.trim();
    if (!q || isBusy) return;
    setIsBusy(true);
    setQuestion('');
    try {
      const context = relevantNodes
        .map((n) => {
          const summary = nodeSummaries[n.id];
          const statusText = n.needsAttention ? 'aguardando atenção' : n.status;
          const summaryText = summary ? `Último resumo: "${summary.summary}"` : 'Sem execuções recentes.';
          return `- ${n.title} (${n.type}, status: ${statusText}). ${summaryText}`;
        })
        .join('\n');
      const answer = await askOmbro(q, context);
      setEntries((prev) => [...prev, { question: q, answer: answer || 'Nenhuma resposta retornada pela IA.' }]);
    } catch (err: any) {
      setEntries((prev) => [
        ...prev,
        {
          question: q,
          answer: `Erro na consulta: ${err?.message || String(err)}`,
          isError: true,
        },
      ]);
    } finally {
      setIsBusy(false);
    }
  };

  return (
    <div
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
      style={{
        position: 'fixed',
        top: 72,
        right: 20,
        bottom: 20,
        width: 320,
        background: bgCard,
        border: `1px solid ${border}`,
        borderRadius: 12,
        boxShadow: isEffectiveDark ? '0 16px 36px rgba(0, 0, 0, 0.7)' : '0 16px 36px rgba(0, 0, 0, 0.15)',
        zIndex: 970,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 12px',
          borderBottom: `1px solid ${border}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 600, color: textPrimary }}>
          <Sparkles size={14} color={accentColor} strokeWidth={1.5} />
          <span>Ombro</span>
        </div>
        <button
          onClick={onClose}
          aria-label="Fechar Ombro"
          style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 4, display: 'flex' }}
        >
          <X size={14} />
        </button>
      </div>

      <div style={{ padding: '8px 12px', borderBottom: `1px solid ${border}`, display: 'flex', flexDirection: 'column', gap: 6, maxHeight: '35%', overflowY: 'auto' }}>
        <div style={{ fontSize: 10, fontWeight: 600, color: textSecondary, textTransform: 'uppercase' }}>Agentes</div>
        {relevantNodes.length === 0 ? (
          <div style={{ fontSize: 11, color: textSecondary }}>Nenhum agente no canvas.</div>
        ) : (
          relevantNodes.map((n) => {
            const summary = nodeSummaries[n.id];
            return (
              <div key={n.id} style={{ fontSize: 11, color: textPrimary, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {n.needsAttention && (
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#ef4444', flexShrink: 0 }} />
                  )}
                  <strong>{n.title}</strong>
                </div>
                {summary && (
                  <span style={{ fontSize: 10, color: textSecondary, paddingLeft: 12, overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
                    {summary.summary}
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {entries.length === 0 && !isBusy && (
          <div style={{ fontSize: 11, color: textSecondary }}>
            Pergunte algo como "o Revisor ainda está rodando?" ou "resuma o que os agentes fizeram".
          </div>
        )}
        {entries.map((entry, i) => (
          <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: textPrimary }}>{entry.question}</div>
            <div
              style={{
                fontSize: 11,
                color: entry.isError ? '#ef4444' : textSecondary,
                whiteSpace: 'pre-wrap',
              }}
            >
              {entry.answer}
            </div>
          </div>
        ))}
        {isBusy && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: accentColor }}>
            <Loader2 size={12} className="animate-spin" style={{ animation: 'spin 1s linear infinite' }} />
            <span>Consultando assistente…</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: '8px 12px', borderTop: `1px solid ${border}`, display: 'flex', gap: 6 }}>
        <input
          ref={inputRef}
          type="text"
          value={question}
          disabled={isBusy}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAsk();
          }}
          placeholder={isBusy ? 'Aguardando resposta…' : 'Pergunte sobre os agentes…'}
          style={{
            flex: 1,
            padding: '6px 8px',
            borderRadius: 6,
            border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.14)' : '1px solid rgba(0, 0, 0, 0.14)',
            background: isEffectiveDark ? '#0f0f0f' : '#ffffff',
            color: textPrimary,
            fontSize: 11,
            outline: 'none',
            opacity: isBusy ? 0.6 : 1,
          }}
        />
        <button
          onClick={handleAsk}
          disabled={isBusy || !question.trim()}
          aria-label="Enviar pergunta"
          style={{
            padding: '6px 10px',
            borderRadius: 6,
            border: 'none',
            background: accentColor,
            color: '#ffffff',
            cursor: isBusy || !question.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            opacity: isBusy || !question.trim() ? 0.6 : 1,
          }}
        >
          <Send size={13} />
        </button>
      </div>
    </div>
  );
};
