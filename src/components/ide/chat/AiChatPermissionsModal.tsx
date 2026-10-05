import React, { useState, useEffect } from 'react';
import { Shield, X, Check, Lock, Globe, FileCode2, Terminal } from 'lucide-react';
import { logSystemActivity } from '../../../utils/brainService';

export interface AiChatPermissionsConfig {
  executionMode: 'always-proceed' | 'request-review' | 'strict' | 'proceed-in-sandbox';
  externalFilesAccess: 'allow' | 'ask' | 'deny';
  networkAccess: 'allow' | 'ask' | 'deny';
  allowlistCommands: string[];
  denylistCommands: string[];
}

export const DEFAULT_AI_PERMISSIONS: AiChatPermissionsConfig = {
  executionMode: 'request-review',
  externalFilesAccess: 'ask',
  networkAccess: 'allow',
  allowlistCommands: ['git status', 'git diff', 'ls', 'pwd', 'npm test'],
  denylistCommands: ['rm -rf /', 'mkfs', 'dd', ':(){ :|:& };:'],
};

interface AiChatPermissionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectName?: string;
  themeTokens: any;
  accentColor: string;
  isEffectiveDark: boolean;
}

export const AiChatPermissionsModal: React.FC<AiChatPermissionsModalProps> = ({
  isOpen,
  onClose,
  projectName = 'Projeto',
  themeTokens,
  accentColor,
  isEffectiveDark,
}) => {
  const [config, setConfig] = useState<AiChatPermissionsConfig>(() => {
    try {
      const saved = localStorage.getItem('ide_ai_permissions');
      if (saved) return { ...DEFAULT_AI_PERMISSIONS, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_AI_PERMISSIONS;
  });

  const [activeTab, setActiveTab] = useState<'mode' | 'files' | 'network' | 'commands'>('mode');

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSave = () => {
    try {
      localStorage.setItem('ide_ai_permissions', JSON.stringify(config));
      logSystemActivity('ide_ai_permissions', 'save_policies', projectName, {
        executionMode: config.executionMode,
        externalFilesAccess: config.externalFilesAccess,
        networkAccess: config.networkAccess,
      });
    } catch {}
    onClose();
  };

  const bgCard = isEffectiveDark ? '#1a1a1a' : '#ffffff';
  const bgOverlay = 'rgba(0, 0, 0, 0.6)';
  const divider = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: bgOverlay,
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 680,
          background: bgCard,
          borderRadius: 8,
          border: 'none',
          boxShadow: 'none',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 16,
          gap: 16,
          fontFamily: 'Poppins, sans-serif',
        }}
      >
        {/* Top Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <Shield size={16} color={accentColor} style={{ flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: themeTokens.textPrimary, whiteSpace: 'nowrap' }}>
              Políticas de Permissão e Segurança da IA
            </span>
          </div>
          <button
            onClick={onClose}
            type="button"
            style={{
              height: 26,
              width: 26,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              color: themeTokens.textSecondary,
              cursor: 'pointer',
              borderRadius: 4,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ height: 1, background: divider, width: '100%' }} />

        {/* Tabs Bar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'nowrap', overflowX: 'auto' }}>
          {[
            { id: 'mode', label: 'Modo de Execução', icon: Lock },
            { id: 'files', label: 'Arquivos Externos', icon: FileCode2 },
            { id: 'network', label: 'Rede e Internet', icon: Globe },
            { id: 'commands', label: 'Comandos', icon: Terminal },
          ].map((tab) => {
            const Icon = tab.icon;
            const isSelected = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                style={{
                  height: 26,
                  padding: '0 12px',
                  borderRadius: 4,
                  border: 'none',
                  boxShadow: 'none',
                  background: isSelected ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)') : 'transparent',
                  color: isSelected ? themeTokens.textPrimary : themeTokens.textSecondary,
                  fontSize: 11.5,
                  fontWeight: isSelected ? 500 : 400,
                  fontFamily: 'Poppins, sans-serif',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  transition: 'background 0.15s ease, color 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                <Icon size={12} color={isSelected ? accentColor : themeTokens.textSecondary} style={{ flexShrink: 0 }} />
                <span style={{ whiteSpace: 'nowrap' }}>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div style={{ minHeight: 200, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {activeTab === 'mode' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                {
                  id: 'always-proceed',
                  title: 'Execução Contínua (Always Proceed)',
                  desc: 'Executa ferramentas e alterações sem pedir aprovação intermediária.',
                },
                {
                  id: 'request-review',
                  title: 'Revisão Recomendada (Request Review)',
                  desc: 'Solicita confirmação humana para comandos de terminal e alterações críticas.',
                },
                {
                  id: 'strict',
                  title: 'Estrito (Strict Review)',
                  desc: 'Exige aprovação individual para qualquer comando ou edição de arquivo.',
                },
                {
                  id: 'proceed-in-sandbox',
                  title: 'Sandbox Isolado (Proceed in Sandbox)',
                  desc: 'Executa ferramentas em contêiner ou processo isolado com permissões restritas.',
                },
              ].map((item) => {
                const isSelected = config.executionMode === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setConfig({ ...config, executionMode: item.id as any })}
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      background: isSelected ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)') : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: 10,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 3,
                        background: isSelected ? accentColor : (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        marginTop: 2,
                      }}
                    >
                      {isSelected && <Check size={11} color="#ffffff" />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: themeTokens.textPrimary, whiteSpace: 'nowrap' }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: 11, color: themeTokens.textSecondary, lineHeight: '16px' }}>
                        {item.desc}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'files' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, color: themeTokens.textSecondary, lineHeight: '16px' }}>
                Política de leitura e escrita de arquivos localizados fora da raiz do workspace:
              </span>
              {[
                { id: 'allow', title: 'Permitir (Allow)', desc: 'Lê caminhos externos quando explicitamente solicitados.' },
                { id: 'ask', title: 'Perguntar (Ask)', desc: 'Exibe confirmação antes de ler ou escrever fora do projeto.' },
                { id: 'deny', title: 'Bloquear (Deny)', desc: 'Restringe estritamente a execução à pasta do projeto.' },
              ].map((item) => {
                const isSelected = config.externalFilesAccess === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setConfig({ ...config, externalFilesAccess: item.id as any })}
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      background: isSelected ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)') : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 3,
                        background: isSelected ? accentColor : (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && <Check size={11} color="#ffffff" />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: themeTokens.textPrimary, whiteSpace: 'nowrap' }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: 11, color: themeTokens.textSecondary, lineHeight: '16px' }}>{item.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'network' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, color: themeTokens.textSecondary, lineHeight: '16px' }}>
                Conexões de rede e chamadas de API externas:
              </span>
              {[
                { id: 'allow', title: 'Permitir Acesso à Internet', desc: 'Permite requisições HTTP para documentações e downloads.' },
                { id: 'ask', title: 'Perguntar Antes de Conectar', desc: 'Exibe autorização para chamadas de rede.' },
                { id: 'deny', title: 'Isolado da Rede (Air-gapped)', desc: 'Desabilita requisições externas não locais.' },
              ].map((item) => {
                const isSelected = config.networkAccess === item.id;
                return (
                  <div
                    key={item.id}
                    onClick={() => setConfig({ ...config, networkAccess: item.id as any })}
                    style={{
                      padding: 10,
                      borderRadius: 6,
                      background: isSelected ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)') : 'transparent',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      transition: 'background 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.background = 'transparent';
                      }
                    }}
                  >
                    <div
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 3,
                        background: isSelected ? accentColor : (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      {isSelected && <Check size={11} color="#ffffff" />}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <span style={{ fontSize: 12, fontWeight: 500, color: themeTokens.textPrimary, whiteSpace: 'nowrap' }}>
                        {item.title}
                      </span>
                      <span style={{ fontSize: 11, color: themeTokens.textSecondary, lineHeight: '16px' }}>{item.desc}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {activeTab === 'commands' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: themeTokens.textPrimary, whiteSpace: 'nowrap' }}>
                  Comandos Permitidos Sem Confirmação (Allowlist)
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary, lineHeight: '16px' }}>
                  Comandos que podem ser executados no terminal sem requerer aprovação individual:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {config.allowlistCommands.map((cmd) => (
                    <span
                      key={cmd}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                        color: themeTokens.textPrimary,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cmd}
                    </span>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <span style={{ fontSize: 12, fontWeight: 500, color: themeTokens.textPrimary, whiteSpace: 'nowrap' }}>
                  Comandos Restritos Bloqueados (Denylist)
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary, lineHeight: '16px' }}>
                  Comandos com risco de destruição de dados ou perigo de sistema bloqueados automaticamente:
                </span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                  {config.denylistCommands.map((cmd) => (
                    <span
                      key={cmd}
                      style={{
                        padding: '4px 8px',
                        borderRadius: 4,
                        background: isEffectiveDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)',
                        color: '#ef4444',
                        fontSize: 11,
                        fontFamily: 'monospace',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {cmd}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div style={{ height: 1, background: divider, width: '100%' }} />

        {/* Footer Actions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 8 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              height: 26,
              padding: '0 14px',
              borderRadius: 4,
              border: 'none',
              boxShadow: 'none',
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
              color: themeTokens.textSecondary,
              fontSize: 12,
              fontWeight: 400,
              fontFamily: 'Poppins, sans-serif',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'background 0.15s ease, color 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
              e.currentTarget.style.color = themeTokens.textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
              e.currentTarget.style.color = themeTokens.textSecondary;
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            style={{
              height: 26,
              padding: '0 16px',
              borderRadius: 4,
              border: 'none',
              boxShadow: 'none',
              background: accentColor,
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 500,
              fontFamily: 'Poppins, sans-serif',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'opacity 0.15s ease, filter 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
          >
            Salvar Políticas
          </button>
        </div>
      </div>
    </div>
  );
};
