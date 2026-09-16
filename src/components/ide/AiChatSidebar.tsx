import React, { useState, useRef, useEffect } from 'react';
import {
  Sparkles,
  ArrowRight,
  ChevronDown,
  Terminal,
  Code,
  FileCheck,
  Zap,
  Wand2,
} from 'lucide-react';
import { ChatMessage } from '../../types';
import { api } from '../../services/api';

interface AiChatSidebarProps {
  projectCwd: string;
  activeFilePath?: string;
  activeFileContent?: string;
}

export const AiChatSidebar: React.FC<AiChatSidebarProps> = ({
  projectCwd,
  activeFilePath,
  activeFileContent,
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'msg-1',
      role: 'assistant',
      content:
        'Olá Walancy! Sou seu assistente de desenvolvimento integrado. Você pode usar tanto a interface aqui pelo chat quanto os CLIs interativos **Claude Code (`claude`)** e **Antigravity (`agy`)** diretamente no terminal abaixo.',
      timestamp: 'Agora',
      model: 'Claude & AGY Assistant',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedModel, setSelectedModel] = useState<'claude-headless' | 'agy-agent' | 'gemini-flash'>('claude-headless');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const models = [
    { id: 'claude-headless', label: 'Claude Code CLI (Oficial)', tag: 'CLI' },
    { id: 'agy-agent', label: 'Antigravity Agent (AGY)', tag: 'AGY' },
    { id: 'gemini-flash', label: 'Gemini 3.8 Flash (Rápido)', tag: 'API' },
  ];

  const currentModelLabel = models.find((m) => m.id === selectedModel)?.label || 'Claude Code';

  const handleSendMessage = async (customPrompt?: string) => {
    const promptToSend = customPrompt || inputPrompt;
    if (!promptToSend.trim() || isLoading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: promptToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputPrompt('');
    setIsLoading(true);

    try {
      let finalPrompt = promptToSend;
      if (activeFilePath && activeFileContent) {
        finalPrompt += `\n\n[Contexto do arquivo aberto: ${activeFilePath}]\n\`\`\`\n${activeFileContent.slice(0, 1500)}\n\`\`\``;
      }

      const res = await api.sendAiPrompt(finalPrompt, selectedModel, projectCwd);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.response || 'Comando processado com sucesso pelo agente.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: currentModelLabel,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Erro ao consultar modelo: ${err.message}. Você também pode abrir uma aba de terminal e rodar diretamente "claude" ou "agy".`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        width: '320px',
        minWidth: '280px',
        backgroundColor: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header matching screenshot "Ainaobra" */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Sparkles size={16} color="var(--accent-orange)" />
          <h2 style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
            Ainaobra AI
          </h2>
        </div>
        <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
          Powered by Claude Code & Antigravity CLI
        </p>
      </div>

      {/* Messages Scroll Area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          return (
            <div
              key={msg.id}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '92%',
                backgroundColor: isUser ? 'var(--accent-orange)' : 'var(--bg-card)',
                color: isUser ? '#ffffff' : 'var(--text-primary)',
                padding: '8px 12px',
                borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                border: isUser ? 'none' : '1px solid var(--border-color)',
                fontSize: '0.8rem',
                lineHeight: 1.4,
              }}
            >
              {!isUser && msg.model && (
                <div
                  style={{
                    fontSize: '0.65rem',
                    color: 'var(--accent-cyan)',
                    fontWeight: 600,
                    marginBottom: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  <Sparkles size={10} />
                  <span>{msg.model}</span>
                </div>
              )}
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                {msg.content}
              </div>
              <div
                style={{
                  fontSize: '0.62rem',
                  opacity: 0.6,
                  textAlign: 'right',
                  marginTop: '4px',
                }}
              >
                {msg.timestamp}
              </div>
            </div>
          );
        })}
        {isLoading && (
          <div
            style={{
              padding: '8px 12px',
              borderRadius: '8px',
              backgroundColor: 'var(--bg-card)',
              fontSize: '0.78rem',
              color: 'var(--accent-orange)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            <Sparkles size={14} className="animate-spin" />
            <span>Processando com {currentModelLabel}...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Quick Action Chips */}
      <div
        style={{
          padding: '6px 10px',
          display: 'flex',
          gap: '6px',
          overflowX: 'auto',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-main)',
        }}
      >
        <button
          onClick={() => handleSendMessage('Explique o que este arquivo faz')}
          className="btn-secondary"
          style={{ fontSize: '0.68rem', padding: '3px 8px', whiteSpace: 'nowrap' }}
        >
          <Code size={11} /> Explicar Código
        </button>
        <button
          onClick={() => handleSendMessage('Analise este código e sugira refatorações')}
          className="btn-secondary"
          style={{ fontSize: '0.68rem', padding: '3px 8px', whiteSpace: 'nowrap' }}
        >
          <Wand2 size={11} /> Refatorar
        </button>
        <button
          onClick={() => handleSendMessage('Gere testes unitários para as funções principais')}
          className="btn-secondary"
          style={{ fontSize: '0.68rem', padding: '3px 8px', whiteSpace: 'nowrap' }}
        >
          <FileCheck size={11} /> Gerar Testes
        </button>
      </div>

      {/* Input Box matching screenshot layout */}
      <div
        style={{
          padding: '10px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-main)',
            border: '1px solid var(--border-color)',
            borderRadius: '8px',
            padding: '4px 8px',
          }}
        >
          <input
            type="text"
            placeholder="Ask anything..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSendMessage();
            }}
            style={{
              flex: 1,
              backgroundColor: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#ffffff',
              fontSize: '0.82rem',
              padding: '6px',
            }}
          />
          <button
            onClick={() => handleSendMessage()}
            style={{
              width: '26px',
              height: '26px',
              borderRadius: '50%',
              backgroundColor: 'var(--accent-orange)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
            }}
            title="Enviar mensagem"
          >
            <ArrowRight size={13} />
          </button>
        </div>

        {/* Model Selector dropdown button */}
        <div style={{ position: 'relative' }}>
          <button
            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 8px',
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: '6px',
              fontSize: '0.74rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--accent-orange)', fontWeight: 700 }}>+</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 500 }}>{currentModelLabel}</span>
            </div>
            <ChevronDown size={12} />
          </button>

          {isDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: '110%',
                left: 0,
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-active)',
                borderRadius: '8px',
                padding: '4px',
                boxShadow: '0 -4px 16px rgba(0,0,0,0.5)',
                zIndex: 60,
              }}
            >
              {models.map((m) => (
                <div
                  key={m.id}
                  onClick={() => {
                    setSelectedModel(m.id as any);
                    setIsDropdownOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: '4px',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    backgroundColor: m.id === selectedModel ? 'rgba(255,102,0,0.15)' : 'transparent',
                    color: m.id === selectedModel ? '#ffffff' : 'var(--text-secondary)',
                  }}
                >
                  <span>{m.label}</span>
                  <span
                    style={{
                      fontSize: '0.62rem',
                      padding: '1px 5px',
                      borderRadius: '3px',
                      backgroundColor: 'var(--bg-main)',
                      color: 'var(--accent-orange)',
                    }}
                  >
                    {m.tag}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
