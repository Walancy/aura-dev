import React from 'react';
import { KbdBadge } from '../../icons/MiscIcons';
import type { ThemeTokens } from '../../../types/ide';

export interface ShortcutsSettingsTabProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
}

export const ShortcutsSettingsTab: React.FC<ShortcutsSettingsTabProps> = ({ themeTokens, isEffectiveDark }) => {
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Atalhos de Teclado Principais</div>
      <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 14 }}>
        Guia de atalhos rápidos disponíveis na interface estilo Antigravity / VS Code.
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          { action: 'Quick Open (Abrir Arquivo)', keys: ['⌘', 'P'] },
          { action: 'Command Palette (Executar Comandos)', keys: ['⇧', '⌘', 'P'] },
          { action: 'Ir para Símbolo no Arquivo', keys: ['⇧', '⌘', 'O'] },
          { action: 'Abrir Configurações do Sistema', keys: ['⌘', ','] },
          { action: 'Alternar Barra Lateral (Explorer)', keys: ['⌘', 'B'] },
          { action: 'Explorer', keys: ['⇧', '⌘', 'E'] },
          { action: 'Buscar nos Arquivos', keys: ['⇧', '⌘', 'F'] },
          { action: 'Controle de Versão (Git)', keys: ['⇧', '⌘', 'G'] },
          { action: 'Executar e Depurar', keys: ['⇧', '⌘', 'D'] },
          { action: 'Gerenciador de Extensões', keys: ['⇧', '⌘', 'X'] },
          { action: 'Alternar Painel Inferior (Terminal)', keys: ['⌘', 'J'] },
          { action: 'Alternar Painel Lateral de IA', keys: ['⇧', '⌘', 'A'] },
          { action: 'Histórico de Conversas com IA', keys: ['⇧', '⌘', 'H'] },
          { action: 'Modo Tela Cheia (Fullscreen)', keys: ['⌃', '⌘', 'F'] },
          { action: 'Modo Zen (Foco Limpo)', keys: ['⌘', 'K', 'Z'] },
          { action: 'Salvar Arquivo Ativo', keys: ['⌘', 'S'] },
        ].map((s, idx) => (
          <div
            key={idx}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: 8,
              transition: 'background 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontSize: 12.5, color: themeTokens.textPrimary }}>{s.action}</span>
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
