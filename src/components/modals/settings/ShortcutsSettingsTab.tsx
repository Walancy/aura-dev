import React from 'react';
import { KbdBadge } from '../../icons/MiscIcons';
import type { ThemeTokens } from '../../../types/ide';

export interface ShortcutsSettingsTabProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
}

export const ShortcutsSettingsTab: React.FC<ShortcutsSettingsTabProps> = ({ themeTokens, isEffectiveDark }) => {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 500,
          color: themeTokens.textSecondary,
          textTransform: 'uppercase',
          letterSpacing: 0.5,
        }}
      >
        Atalhos de Teclado Principais
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {[
          { action: 'Quick Open (Abrir Arquivo)', keys: ['⌘', 'P'] },
          { action: 'Command Palette (Executar Comandos)', keys: ['⇧', '⌘', 'P'] },
          { action: 'Ir para Símbolo no Arquivo', keys: ['⇧', '⌘', 'O'] },
          { action: 'Abrir Configurações do Sistema', keys: ['⌘', ','] },
          { action: 'Alternar Barra Lateral (Explorer)', keys: ['⌘', 'B'] },
          { action: 'Explorer de Arquivos', keys: ['⇧', '⌘', 'E'] },
          { action: 'Buscar no Projeto', keys: ['⇧', '⌘', 'F'] },
          { action: 'Controle de Versão (Git)', keys: ['⇧', '⌘', 'G'] },
          { action: 'Executar e Depurar', keys: ['⇧', '⌘', 'D'] },
          { action: 'Alternar Painel Inferior (Terminal)', keys: ['⌘', 'J'] },
          { action: 'Alternar Painel Lateral de IA', keys: ['⇧', '⌘', 'A'] },
          { action: 'Histórico de Conversas com IA', keys: ['⇧', '⌘', 'H'] },
          { action: 'Modo Tela Cheia (Fullscreen)', keys: ['⌃', '⌘', 'F'] },
          { action: 'Modo Foco Limpo', keys: ['⌘', 'K', 'Z'] },
          { action: 'Salvar Arquivo Ativo', keys: ['⌘', 'S'] },
        ].map((s, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              height: 28,
              padding: '0 10px',
              borderRadius: 6,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.015)',
              border: 'none',
              boxShadow: 'none',
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = isEffectiveDark
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(0, 0, 0, 0.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = isEffectiveDark
                ? 'rgba(255, 255, 255, 0.02)'
                : 'rgba(0, 0, 0, 0.015)';
            }}
          >
            <span style={{ fontSize: 11.5, fontWeight: 400, color: themeTokens.textPrimary }}>{s.action}</span>
            <div style={{ display: 'flex', gap: 3 }}>
              {s.keys.map((k, kIdx) => (
                <KbdBadge key={kIdx}>{k}</KbdBadge>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
