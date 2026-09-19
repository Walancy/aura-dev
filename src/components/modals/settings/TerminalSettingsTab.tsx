import React from 'react';
import { hexToRgba } from '../../../utils/color';
import { MiniSwitch } from '../../ui/MiniSwitch';
import type { ThemeTokens } from '../../../types/ide';

export interface TerminalSettingsTabProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  terminalFontSize: number;
  setTerminalFontSize: (value: number) => void;
  terminalCursorStyle: 'block' | 'bar' | 'underline';
  setTerminalCursorStyle: (value: 'block' | 'bar' | 'underline') => void;
  terminalScrollback: number;
  setTerminalScrollback: (value: number) => void;
  terminalCursorBlink: boolean;
  setTerminalCursorBlink: (value: boolean) => void;
  terminalCopyOnSelect: boolean;
  setTerminalCopyOnSelect: (value: boolean) => void;
}

export const TerminalSettingsTab: React.FC<TerminalSettingsTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
  terminalFontSize,
  setTerminalFontSize,
  terminalCursorStyle,
  setTerminalCursorStyle,
  terminalScrollback,
  setTerminalScrollback,
  terminalCursorBlink,
  setTerminalCursorBlink,
  terminalCopyOnSelect,
  setTerminalCopyOnSelect,
}) => {
  return (
    <>
      <div>
        <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 4 }}>Terminal</div>
        <div style={{ fontSize: 12.5, color: themeTokens.textSecondary }}>
          Fonte, cursor e comportamento dos terminais nativos integrados.
        </div>
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Tamanho da Fonte</div>
        <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 10 }}>
          Ajusta a escala tipográfica de todas as sessões de terminal (xterm.js).
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[10, 11, 12, 13, 14, 16].map((size) => (
            <button
              key={size}
              type="button"
              onClick={() => setTerminalFontSize(size)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: terminalFontSize === size ? `1.5px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                background: terminalFontSize === size ? hexToRgba(accentColor, 0.15) : 'transparent',
                color: terminalFontSize === size ? accentColor : themeTokens.textPrimary,
                fontSize: 12,
                fontWeight: terminalFontSize === size ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {size}px
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Estilo do Cursor</div>
        <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 10 }}>
          Formato do cursor de texto exibido dentro do terminal.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, maxWidth: 480 }}>
          {[
            { id: 'block', label: 'Block', preview: '█' },
            { id: 'bar', label: 'Bar', preview: '│' },
            { id: 'underline', label: 'Underline', preview: '_' },
          ].map((c) => {
            const isSelected = terminalCursorStyle === c.id;
            return (
              <div
                key={c.id}
                onClick={() => setTerminalCursorStyle(c.id as 'block' | 'bar' | 'underline')}
                style={{
                  padding: '12px',
                  borderRadius: 8,
                  cursor: 'pointer',
                  border: isSelected ? `1.5px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                  background: isSelected ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)') : 'transparent',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 6,
                  transition: 'all 0.15s ease',
                }}
              >
                <div
                  style={{
                    fontFamily: 'JetBrains Mono, Menlo, monospace',
                    fontSize: 18,
                    lineHeight: 1,
                    color: isSelected ? accentColor : themeTokens.textPrimary,
                  }}
                >
                  devflow{c.preview}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: isSelected ? 600 : 400, color: isSelected ? accentColor : themeTokens.textSecondary }}>
                  {c.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div>
        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Histórico de Rolagem (Scrollback)</div>
        <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 10 }}>
          Número de linhas mantidas em memória para rolar para cima no terminal.
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[1000, 5000, 10000, 50000].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setTerminalScrollback(n)}
              style={{
                padding: '6px 14px',
                borderRadius: 6,
                border: terminalScrollback === n ? `1.5px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                background: terminalScrollback === n ? hexToRgba(accentColor, 0.15) : 'transparent',
                color: terminalScrollback === n ? accentColor : themeTokens.textPrimary,
                fontSize: 12,
                fontWeight: terminalScrollback === n ? 600 : 400,
                cursor: 'pointer',
              }}
            >
              {n.toLocaleString('pt-BR')}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {[
          {
            label: 'Cursor Piscante (Cursor Blink)',
            desc: 'Faz o cursor do terminal piscar periodicamente',
            checked: terminalCursorBlink,
            onChange: () => setTerminalCursorBlink(!terminalCursorBlink),
          },
          {
            label: 'Copiar ao Selecionar Texto',
            desc: 'Copia automaticamente para a área de transferência ao selecionar texto no terminal',
            checked: terminalCopyOnSelect,
            onChange: () => setTerminalCopyOnSelect(!terminalCopyOnSelect),
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
