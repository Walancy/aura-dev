import React from 'react';
import { PanelLeft, PanelRight } from 'lucide-react';
import { MiniSwitch } from '../../ui/MiniSwitch';
import type { ThemeTokens } from '../../../types/ide';

export interface GeneralSettingsTabProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  sidebarPosition: 'left' | 'right';
  setSidebarPosition: (value: 'left' | 'right') => void;
  isCenteredLayout: boolean;
  setIsCenteredLayout: (value: boolean) => void;
  restoreLastWorkspace: boolean;
  setRestoreLastWorkspace: (value: boolean) => void;
  confirmBeforeClosingUnsaved: boolean;
  setConfirmBeforeClosingUnsaved: (value: boolean) => void;
  autoRefreshGitStatus: boolean;
  setAutoRefreshGitStatus: (value: boolean) => void;
}

export const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
  sidebarPosition,
  setSidebarPosition,
  isCenteredLayout,
  setIsCenteredLayout,
  restoreLastWorkspace,
  setRestoreLastWorkspace,
  confirmBeforeClosingUnsaved,
  setConfirmBeforeClosingUnsaved,
  autoRefreshGitStatus,
  setAutoRefreshGitStatus,
}) => {
  return (
    <>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Geral</div>
        <div style={{ fontSize: 12.5, color: themeTokens.textSecondary }}>
          Layout, comportamento de abertura e integração com o Git.
        </div>
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Posição da Barra Lateral</div>
        <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 10 }}>
          Define de que lado da janela o Explorer, Busca e demais painéis são exibidos.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, maxWidth: 420 }}>
          {[
            { id: 'left', label: 'Esquerda', desc: 'Padrão do VS Code', icon: <PanelLeft size={18} /> },
            { id: 'right', label: 'Direita', desc: 'Estilo Antigravity', icon: <PanelRight size={18} /> },
          ].map((s) => {
            const isSelected = sidebarPosition === s.id;
            return (
              <div
                key={s.id}
                onClick={() => setSidebarPosition(s.id as 'left' | 'right')}
                style={{
                  padding: '14px 12px',
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ color: isSelected ? accentColor : 'inherit' }}>{s.icon}</div>
                  <div
                    style={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      border: isSelected ? `4px solid ${accentColor}` : `2px solid ${themeTokens.textSecondary}`,
                      background: isSelected ? accentColor : 'transparent',
                    }}
                  />
                </div>
                <div style={{ fontSize: 13, fontWeight: 600, color: themeTokens.textPrimary }}>{s.label}</div>
                <div style={{ fontSize: 11, color: themeTokens.textSecondary }}>{s.desc}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Comportamento</div>
        {[
          {
            label: 'Layout Centralizado',
            desc: 'Restringe a largura do editor e o centraliza na janela, como no Zen Mode',
            checked: isCenteredLayout,
            onChange: () => setIsCenteredLayout(!isCenteredLayout),
          },
          {
            label: 'Restaurar Último Workspace ao Abrir',
            desc: 'Reabre automaticamente a última pasta de projeto utilizada',
            checked: restoreLastWorkspace,
            onChange: () => setRestoreLastWorkspace(!restoreLastWorkspace),
          },
          {
            label: 'Confirmar Antes de Fechar Abas Não Salvas',
            desc: 'Evita perda acidental de alterações ao fechar arquivos com edições pendentes',
            checked: confirmBeforeClosingUnsaved,
            onChange: () => setConfirmBeforeClosingUnsaved(!confirmBeforeClosingUnsaved),
          },
          {
            label: 'Atualizar Status do Git Automaticamente',
            desc: 'Consulta periodicamente alterações, branch e contagem de arquivos modificados',
            checked: autoRefreshGitStatus,
            onChange: () => setAutoRefreshGitStatus(!autoRefreshGitStatus),
          },
        ].map((row) => (
          <div
            key={row.label}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              padding: '9px 10px',
              borderRadius: 8,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: themeTokens.textPrimary }}>{row.label}</div>
              <div style={{ fontSize: 11.5, color: themeTokens.textSecondary }}>{row.desc}</div>
            </div>
            <MiniSwitch checked={row.checked} onChange={row.onChange} accentColor={accentColor} />
          </div>
        ))}
      </div>
    </>
  );
};
