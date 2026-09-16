import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  ChevronDown,
  Code,
  FileCheck,
  Wand2,
  Sparkles,
} from 'lucide-react';
import { ChatMessage } from '../../types';
import { api } from '../../services/api';

interface AiChatSidebarProps {
  projectCwd: string;
  activeFilePath?: string;
  activeFileContent?: string;
}

export interface AiModelOption {
  id: 'claude-headless' | 'agy-agent' | 'gemini-flash' | 'ollama-local' | 'openai-codex';
  label: string;
  shortName: string;
  tag: string;
  icon: string;
  accentColor: string;
}

const AI_MODELS: AiModelOption[] = [
  {
    id: 'claude-headless',
    label: 'Claude Code CLI (Oficial)',
    shortName: 'Claude Code',
    tag: 'CLI',
    icon: '/logos/claude-color.svg',
    accentColor: '#f97316',
  },
  {
    id: 'agy-agent',
    label: 'Antigravity Agent (AGY)',
    shortName: 'Antigravity AGY',
    tag: 'AGY',
    icon: '/logos/google-antigravity-icon.svg',
    accentColor: '#00d2ff',
  },
  {
    id: 'openai-codex',
    label: 'OpenAI Codex (GPT-5 / 4o)',
    shortName: 'OpenAI Codex',
    tag: 'API',
    icon: '/logos/codex-color.svg',
    accentColor: '#10a37f',
  },
  {
    id: 'gemini-flash',
    label: 'Gemini 3.8 Flash (Google)',
    shortName: 'Gemini Flash',
    tag: 'API',
    icon: '/logos/gemini-icon-seeklogo.svg',
    accentColor: '#4285f4',
  },
  {
    id: 'ollama-local',
    label: 'Ollama (Modelos Locais)',
    shortName: 'Ollama',
    tag: 'LOCAL',
    icon: '/logos/ollama-icon.svg',
    accentColor: '#10b981',
  },
];

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
        'Olá Walancy! Sou seu assistente de desenvolvimento integrado. Você pode usar tanto a interface de IA aqui quanto os CLIs interativos **Claude Code (`claude`)**, **Antigravity (`agy`)** e **Ollama** diretamente nos terminais.',
      timestamp: 'Agora',
      model: 'DevFlow AI Assistant',
      modelId: 'agy-agent',
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState('');
  const [selectedModelId, setSelectedModelId] = useState<AiModelOption['id']>('claude-headless');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const activeModel = AI_MODELS.find((m) => m.id === selectedModelId) || AI_MODELS[0];

  const getModelForMessage = (msg: ChatMessage) => {
    if (msg.modelId) {
      const found = AI_MODELS.find((m) => m.id === msg.modelId);
      if (found) return found;
    }
    if (msg.model) {
      const lower = msg.model.toLowerCase();
      const found = AI_MODELS.find(
        (m) =>
          lower.includes(m.shortName.toLowerCase()) ||
          lower.includes(m.id.split('-')[0])
      );
      if (found) return found;
    }
    return activeModel;
  };

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

      const res = await api.sendAiPrompt(finalPrompt, selectedModelId, projectCwd);

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: res.response || 'Comando processado com sucesso pelo agente.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        model: activeModel.label,
        modelId: activeModel.id,
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `Erro ao consultar modelo: ${err.message}. Você também pode abrir uma aba de terminal e rodar diretamente "claude", "agy" ou "ollama".`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        modelId: activeModel.id,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        width: '330px',
        minWidth: '290px',
        backgroundColor: 'var(--bg-surface)',
        borderLeft: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
      }}
    >
      {/* Header matching screenshot "Ainaobra" with AI logos */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '6px',
          backgroundColor: '#0c0d12',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              padding: '3px 6px',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <img
              src="/logos/claude-color.svg"
              alt="Claude"
              style={{ width: '15px', height: '15px', objectFit: 'contain' }}
            />
            <img
              src="/logos/google-antigravity-icon.svg"
              alt="Antigravity"
              style={{ width: '15px', height: '15px', objectFit: 'contain', borderRadius: '3px' }}
            />
            <img
              src="/logos/codex-color.svg"
              alt="Codex"
              style={{ width: '14px', height: '14px', objectFit: 'contain' }}
            />
            <img
              src="/logos/gemini-icon-seeklogo.svg"
              alt="Gemini"
              style={{ width: '14px', height: '14px', objectFit: 'contain' }}
            />
            <img
              src="/logos/ollama-icon.svg"
              alt="Ollama"
              style={{ width: '14px', height: '14px', objectFit: 'contain' }}
            />
          </div>
          <h2 style={{ fontSize: '0.98rem', fontWeight: 700, letterSpacing: '-0.02em', color: '#fff' }}>
            Ainaobra AI
          </h2>
        </div>
        <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'center' }}>
          Claude Code • Antigravity • Codex • Gemini • Ollama
        </p>
      </div>

      {/* Messages Scroll Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const msgModel = !isUser ? getModelForMessage(msg) : null;

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
                lineHeight: 1.45,
                boxShadow: isUser
                  ? '0 2px 8px rgba(255, 102, 0, 0.25)'
                  : '0 2px 8px rgba(0, 0, 0, 0.3)',
              }}
            >
              {!isUser && msgModel && (
                <div
                  style={{
                    fontSize: '0.67rem',
                    color: msgModel.accentColor,
                    fontWeight: 600,
                    marginBottom: '5px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <img
                    src={msgModel.icon}
                    alt={msgModel.shortName}
                    style={{
                      width: '13px',
                      height: '13px',
                      objectFit: 'contain',
                      borderRadius: '2px',
                    }}
                  />
                  <span>{msg.model || msgModel.label}</span>
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
              color: activeModel.accentColor,
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: `1px solid ${activeModel.accentColor}33`,
            }}
          >
            <img
              src={activeModel.icon}
              alt=""
              style={{
                width: '15px',
                height: '15px',
                objectFit: 'contain',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <span>Processando com {activeModel.shortName}...</span>
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
            placeholder={`Pergunte algo ao ${activeModel.shortName}...`}
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
              backgroundColor: activeModel.accentColor || 'var(--accent-orange)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              color: '#fff',
              transition: 'background-color 0.2s ease',
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
              padding: '6px 10px',
              backgroundColor: 'var(--bg-card)',
              border: `1px solid ${isDropdownOpen ? activeModel.accentColor : 'var(--border-color)'}`,
              borderRadius: '6px',
              fontSize: '0.75rem',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'border-color 0.2s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <img
                src={activeModel.icon}
                alt=""
                style={{
                  width: '15px',
                  height: '15px',
                  objectFit: 'contain',
                  borderRadius: '2px',
                }}
              />
              <span style={{ color: '#ffffff', fontWeight: 600 }}>{activeModel.label}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                style={{
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '3px',
                  backgroundColor: 'var(--bg-main)',
                  color: activeModel.accentColor,
                }}
              >
                {activeModel.tag}
              </span>
              <ChevronDown
                size={13}
                style={{
                  transform: isDropdownOpen ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease',
                }}
              />
            </div>
          </button>

          {isDropdownOpen && (
            <div
              style={{
                position: 'absolute',
                bottom: '115%',
                left: 0,
                width: '100%',
                backgroundColor: 'var(--bg-card)',
                border: '1px solid var(--border-active)',
                borderRadius: '8px',
                padding: '5px',
                boxShadow: '0 -6px 20px rgba(0,0,0,0.6)',
                zIndex: 60,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
              }}
            >
              {AI_MODELS.map((m) => {
                const isSelected = m.id === selectedModelId;
                return (
                  <div
                    key={m.id}
                    onClick={() => {
                      setSelectedModelId(m.id);
                      setIsDropdownOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '7px 9px',
                      borderRadius: '5px',
                      fontSize: '0.74rem',
                      cursor: 'pointer',
                      backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                      color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                      transition: 'background-color 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img
                        src={m.icon}
                        alt=""
                        style={{
                          width: '16px',
                          height: '16px',
                          objectFit: 'contain',
                          borderRadius: '2px',
                        }}
                      />
                      <span style={{ fontWeight: isSelected ? 600 : 400 }}>{m.label}</span>
                    </div>
                    <span
                      style={{
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '3px',
                        backgroundColor: 'var(--bg-main)',
                        color: m.accentColor,
                      }}
                    >
                      {m.tag}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
