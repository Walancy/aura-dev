import React from 'react';
import { hexToRgba } from '../../../utils/color';
import type { ThemeTokens } from '../../../types/ide';

export interface ExtensionsSettingsTabProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  installedClis: Record<string, boolean>;
}

export const ExtensionsSettingsTab: React.FC<ExtensionsSettingsTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
  installedClis,
}) => {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Extensões & Status do Sistema</div>
      <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 14 }}>
        Recursos nativos integrados ao DevFlow Desktop.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { name: 'VS Code Material & Symbols Icon Theme', desc: 'Ícones oficiais para mais de 100 formatos de arquivos e pastas', status: 'Ativo' },
          { name: 'Claude Code Agent CLI', desc: 'Assistente e motor de execução CLI oficial Claude', status: installedClis.claude ? 'Instalado & Pronto' : 'Não instalado' },
          { name: 'Google Antigravity Agent (AGY)', desc: 'Motor de agentes inteligentes e sub-agentes Antigravity', status: installedClis.antigravity ? 'Instalado & Pronto' : 'Não instalado' },
          { name: 'Native PTY Terminal Service', desc: 'Sessões de terminal interativo com zsh / bash integrado', status: 'Ativo' },
          { name: 'Monaco Editor Engine', desc: 'Motor de código de alta performance da Microsoft com LSP', status: 'Ativo' },
        ].map((ext, idx) => (
          <div
            key={idx}
            style={{
              padding: '10px 14px',
              borderRadius: 8,
              background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: themeTokens.textPrimary }}>{ext.name}</div>
              <div style={{ fontSize: 11.5, color: themeTokens.textSecondary }}>{ext.desc}</div>
            </div>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: 4,
                fontSize: 11,
                fontWeight: 600,
                background: ext.status.includes('Ativo') || ext.status.includes('Pronto') ? hexToRgba(accentColor, 0.15) : (isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                color: ext.status.includes('Ativo') || ext.status.includes('Pronto') ? accentColor : themeTokens.textSecondary,
              }}
            >
              {ext.status}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};
