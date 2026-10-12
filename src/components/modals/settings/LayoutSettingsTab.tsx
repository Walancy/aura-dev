import React from 'react';
import {
  PanelLeft,
  PanelRight,
  AlignJustify,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Eye,
  RotateCcw,
  Maximize2,
  Minimize2,
  Scan,
  SquareTerminal,
  Bot,
  FolderTree,
  LayoutTemplate,
} from 'lucide-react';
import { MiniSwitch } from '../../ui/MiniSwitch';
import type { ThemeTokens } from '../../../types/ide';
import { logSystemActivity } from '../../../utils/brainService';

export interface LayoutSettingsTabProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  showActivityBar?: boolean;
  setShowActivityBar?: (value: boolean) => void;
  showExplorer?: boolean;
  setShowExplorer?: (value: boolean) => void;
  showAiPanel?: boolean;
  setShowAiPanel?: (value: boolean) => void;
  isTerminalCollapsed?: boolean;
  setIsTerminalCollapsed?: (value: boolean) => void;
  showStatusBar?: boolean;
  setShowStatusBar?: (value: boolean) => void;
  sidebarPosition?: 'left' | 'right';
  setSidebarPosition?: (value: 'left' | 'right') => void;
  panelAlignment?: 'left' | 'right' | 'center' | 'justify';
  setPanelAlignment?: (value: 'left' | 'right' | 'center' | 'justify') => void;
  quickInputPosition?: 'top' | 'center';
  setQuickInputPosition?: (value: 'top' | 'center') => void;
  onToggleFullscreen?: () => void;
  onToggleZenMode?: () => void;
  isZenMode?: boolean;
  isCenteredLayout?: boolean;
  setIsCenteredLayout?: (value: boolean) => void;
  onResetLayout?: () => void;
}

export const LayoutSettingsTab: React.FC<LayoutSettingsTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
  showActivityBar = true,
  setShowActivityBar,
  showExplorer = true,
  setShowExplorer,
  showAiPanel = false,
  setShowAiPanel,
  isTerminalCollapsed = true,
  setIsTerminalCollapsed,
  showStatusBar = true,
  setShowStatusBar,
  sidebarPosition = 'left',
  setSidebarPosition,
  panelAlignment = 'justify',
  setPanelAlignment,
  quickInputPosition = 'top',
  setQuickInputPosition,
  onToggleFullscreen,
  onToggleZenMode,
  isZenMode = false,
  isCenteredLayout = false,
  setIsCenteredLayout,
  onResetLayout,
}) => {
  const cardBg = isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)';
  const divider = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      {/* Visibilidade dos Painéis */}
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
          Visibilidade dos Painéis & Barras
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {setShowActivityBar && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 8,
                background: cardBg,
                border: 'none',
                boxShadow: 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                  Barra de Atividades
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                  Exibe a barra vertical de navegação e atalhos na lateral da janela.
                </span>
              </div>
              <MiniSwitch
                checked={showActivityBar}
                onChange={() => {
                  const next = !showActivityBar;
                  setShowActivityBar(next);
                  logSystemActivity('configuracoes_layout', 'toggle_activity_bar', 'layout', { visivel: next });
                }}
                accentColor={accentColor}
              />
            </div>
          )}

          {setShowExplorer && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 8,
                background: cardBg,
                border: 'none',
                boxShadow: 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                  Explorador de Arquivos
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                  Mantém a árvore de diretórios e arquivos visível no painel lateral.
                </span>
              </div>
              <MiniSwitch
                checked={showExplorer}
                onChange={() => {
                  const next = !showExplorer;
                  setShowExplorer(next);
                  logSystemActivity('configuracoes_layout', 'toggle_explorer', 'layout', { visivel: next });
                }}
                accentColor={accentColor}
              />
            </div>
          )}

          {setShowAiPanel && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 8,
                background: cardBg,
                border: 'none',
                boxShadow: 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                  Painel de IA & Agentes
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                  Abre o painel interativo de chat e assistência com IA na interface.
                </span>
              </div>
              <MiniSwitch
                checked={showAiPanel}
                onChange={() => {
                  const next = !showAiPanel;
                  setShowAiPanel(next);
                  logSystemActivity('configuracoes_layout', 'toggle_ai_panel', 'layout', { visivel: next });
                }}
                accentColor={accentColor}
              />
            </div>
          )}

          {setIsTerminalCollapsed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 8,
                background: cardBg,
                border: 'none',
                boxShadow: 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                  Terminal Integrado
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                  Mantém o terminal e o painel de ferramentas aberto na área inferior.
                </span>
              </div>
              <MiniSwitch
                checked={!isTerminalCollapsed}
                onChange={() => {
                  const next = !isTerminalCollapsed;
                  setIsTerminalCollapsed(!next);
                  logSystemActivity('configuracoes_layout', 'toggle_terminal', 'layout', { aberto: next });
                }}
                accentColor={accentColor}
              />
            </div>
          )}

          {setShowStatusBar && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 8,
                background: cardBg,
                border: 'none',
                boxShadow: 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                  Barra de Status Inferior
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                  Exibe informações sobre branch git, codificação, erros e status de build.
                </span>
              </div>
              <MiniSwitch
                checked={showStatusBar}
                onChange={() => {
                  const next = !showStatusBar;
                  setShowStatusBar(next);
                  logSystemActivity('configuracoes_layout', 'toggle_status_bar', 'layout', { visivel: next });
                }}
                accentColor={accentColor}
              />
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: divider }} />

      {/* Posicionamento & Alinhamento */}
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
          Posição da Barra Lateral
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
          {[
            { id: 'left', label: 'Esquerda', desc: 'Padrão do Explorer', icon: <PanelLeft size={14} /> },
            { id: 'right', label: 'Direita', desc: 'Estilo Antigravity', icon: <PanelRight size={14} /> },
          ].map((s) => {
            const isSelected = sidebarPosition === s.id;
            return (
              <div
                key={s.id}
                onClick={() => {
                  if (setSidebarPosition) {
                    logSystemActivity('configuracoes_layout', 'alterar_posicao_sidebar', s.id);
                    setSidebarPosition(s.id as 'left' | 'right');
                  }
                }}
                style={{
                  padding: 10,
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: 'none',
                  background: isSelected
                    ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0')
                    : cardBg,
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
                    e.currentTarget.style.background = cardBg;
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ color: isSelected ? accentColor : themeTokens.textSecondary }}>{s.icon}</div>
                  <div
                    style={{
                      width: 7,
                      height: 7,
                      borderRadius: '50%',
                      background: isSelected ? accentColor : 'transparent',
                    }}
                  />
                </div>
                <div style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>{s.label}</div>
                <div style={{ fontSize: 10.5, color: themeTokens.textSecondary, lineHeight: 1.35 }}>{s.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      {setPanelAlignment && (
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
            Alinhamento dos Painéis
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
            {[
              { id: 'left', label: 'Esquerda', icon: <AlignLeft size={13} /> },
              { id: 'center', label: 'Centro', icon: <AlignCenter size={13} /> },
              { id: 'right', label: 'Direita', icon: <AlignRight size={13} /> },
              { id: 'justify', label: 'Justificado', icon: <AlignJustify size={13} /> },
            ].map((p) => {
              const isSelected = panelAlignment === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    logSystemActivity('configuracoes_layout', 'alterar_alinhamento_painel', p.id);
                    setPanelAlignment(p.id as any);
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
                      ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0')
                      : cardBg,
                    color: isSelected ? accentColor : themeTokens.textPrimary,
                    fontSize: 11.5,
                    fontWeight: 400,
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
                      e.currentTarget.style.background = cardBg;
                    }
                  }}
                >
                  {p.icon}
                  <span>{p.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ height: 1, background: divider }} />

      {/* Modos de Foco & Exibição */}
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
          Modos de Foco & Exibição
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {onToggleZenMode && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 8,
                background: cardBg,
                border: 'none',
                boxShadow: 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                  Modo Zen (Foco Limpo)
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                  Oculta todas as barras e painéis para uma experiência de foco e imersão total.
                </span>
              </div>
              <MiniSwitch
                checked={isZenMode}
                onChange={() => {
                  onToggleZenMode();
                  logSystemActivity('configuracoes_layout', 'toggle_zen_mode', 'layout', { ativo: !isZenMode });
                }}
                accentColor={accentColor}
              />
            </div>
          )}

          {setIsCenteredLayout && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                borderRadius: 8,
                background: cardBg,
                border: 'none',
                boxShadow: 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                  Layout Centralizado do Editor
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                  Centraliza o código no editor em monitores ultrawide ou telas de alta resolução.
                </span>
              </div>
              <MiniSwitch
                checked={isCenteredLayout}
                onChange={() => {
                  const next = !isCenteredLayout;
                  setIsCenteredLayout(next);
                  logSystemActivity('configuracoes_layout', 'toggle_centered_layout', 'layout', { ativo: next });
                }}
                accentColor={accentColor}
              />
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 1, background: divider }} />

      {/* Ações de Layout */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, paddingTop: 4 }}>
        {onToggleFullscreen && (
          <button
            type="button"
            onClick={() => {
              logSystemActivity('configuracoes_layout', 'toggle_fullscreen', 'sistema');
              onToggleFullscreen();
            }}
            style={{
              height: 28,
              padding: '0 12px',
              borderRadius: 6,
              border: 'none',
              boxShadow: 'none',
              cursor: 'pointer',
              background: cardBg,
              color: themeTokens.textPrimary,
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              fontWeight: 400,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isEffectiveDark
                ? 'rgba(255, 255, 255, 0.08)'
                : 'rgba(0, 0, 0, 0.06)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = cardBg;
            }}
          >
            <Maximize2 size={13} />
            <span>Alternar Tela Cheia</span>
          </button>
        )}

        {onResetLayout && (
          <button
            type="button"
            onClick={() => {
              logSystemActivity('configuracoes_layout', 'reset_layout', 'sistema');
              onResetLayout();
            }}
            style={{
              height: 28,
              padding: '0 12px',
              borderRadius: 6,
              border: 'none',
              boxShadow: 'none',
              cursor: 'pointer',
              background: 'transparent',
              color: '#ef4444',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 11.5,
              fontWeight: 400,
              marginLeft: 'auto',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isEffectiveDark
                ? 'rgba(239, 68, 68, 0.12)'
                : 'rgba(239, 68, 68, 0.08)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <RotateCcw size={13} />
            <span>Redefinir Layout Padrão</span>
          </button>
        )}
      </div>
    </div>
  );
};
