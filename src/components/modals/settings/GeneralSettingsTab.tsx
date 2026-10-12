import React from 'react';
import { MiniSwitch } from '../../ui/MiniSwitch';
import type { ThemeTokens } from '../../../types/ide';
import { logSystemActivity } from '../../../utils/brainService';

export interface GeneralSettingsTabProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  isCenteredLayout?: boolean;
  setIsCenteredLayout?: (value: boolean) => void;
  restoreLastWorkspace: boolean;
  setRestoreLastWorkspace: (value: boolean) => void;
  confirmBeforeClosingUnsaved: boolean;
  setConfirmBeforeClosingUnsaved: (value: boolean) => void;
  autoRefreshGitStatus: boolean;
  setAutoRefreshGitStatus: (value: boolean) => void;
  showActivityBar?: boolean;
  setShowActivityBar?: (value: boolean) => void;
  showStatusBar?: boolean;
  setShowStatusBar?: (value: boolean) => void;
}

export const GeneralSettingsTab: React.FC<GeneralSettingsTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
  restoreLastWorkspace,
  setRestoreLastWorkspace,
  confirmBeforeClosingUnsaved,
  setConfirmBeforeClosingUnsaved,
  autoRefreshGitStatus,
  setAutoRefreshGitStatus,
  isCenteredLayout = false,
  setIsCenteredLayout,
  showActivityBar = true,
  setShowActivityBar,
  showStatusBar = true,
  setShowStatusBar,
}) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', boxSizing: 'border-box' }}>
      {/* Comportamento e Visibilidade */}
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
          Comportamento e Visibilidade
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
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)',
                border: 'none',
                boxShadow: 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                  Barra Lateral de Atividades
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                  Navegação rápida (Explorer, Busca, Git, IA e Extensões).
                </span>
              </div>
              <MiniSwitch
                checked={showActivityBar}
                onChange={() => {
                  const next = !showActivityBar;
                  setShowActivityBar(next);
                  logSystemActivity('configuracoes_geral', 'toggle_activity_bar', 'interface', { visivel: next });
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
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)',
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
                  Informações de branch, codificação e status do sistema.
                </span>
              </div>
              <MiniSwitch
                checked={showStatusBar}
                onChange={() => {
                  const next = !showStatusBar;
                  setShowStatusBar(next);
                  logSystemActivity('configuracoes_geral', 'toggle_status_bar', 'interface', { visivel: next });
                }}
                accentColor={accentColor}
              />
            </div>
          )}

          {[
            {
              label: 'Layout Centralizado',
              desc: 'Restringe a largura do editor e o centraliza na janela.',
              checked: isCenteredLayout,
              onChange: () => {
                logSystemActivity('configuracoes_geral', 'toggle_centered_layout', 'editor', { ativo: !isCenteredLayout });
                setIsCenteredLayout(!isCenteredLayout);
              },
            },
            {
              label: 'Restaurar Workspace ao Abrir',
              desc: 'Reabre automaticamente a última pasta de projeto utilizada.',
              checked: restoreLastWorkspace,
              onChange: () => {
                logSystemActivity('configuracoes_geral', 'toggle_restore_workspace', 'workspace', { ativo: !restoreLastWorkspace });
                setRestoreLastWorkspace(!restoreLastWorkspace);
              },
            },
            {
              label: 'Confirmar Fechamento de Abas Não Salvas',
              desc: 'Evita perda de alterações ao fechar arquivos pendentes.',
              checked: confirmBeforeClosingUnsaved,
              onChange: () => {
                logSystemActivity('configuracoes_geral', 'toggle_confirm_unsaved', 'editor', { ativo: !confirmBeforeClosingUnsaved });
                setConfirmBeforeClosingUnsaved(!confirmBeforeClosingUnsaved);
              },
            },
            {
              label: 'Atualizar Status do Git Automaticamente',
              desc: 'Consulta periodicamente alterações de branch e arquivos.',
              checked: autoRefreshGitStatus,
              onChange: () => {
                logSystemActivity('configuracoes_geral', 'toggle_auto_git', 'git', { ativo: !autoRefreshGitStatus });
                setAutoRefreshGitStatus(!autoRefreshGitStatus);
              },
            },
          ].map((row) => (
            <div
              key={row.label}
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
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>{row.label}</span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>{row.desc}</span>
              </div>
              <MiniSwitch checked={row.checked} onChange={row.onChange} accentColor={accentColor} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
