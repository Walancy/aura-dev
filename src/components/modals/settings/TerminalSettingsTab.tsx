import React from 'react';
import { hexToRgba } from '../../../utils/color';
import { MiniSwitch } from '../../ui/MiniSwitch';
import type { ThemeTokens } from '../../../types/ide';
import { logSystemActivity } from '../../../utils/brainService';
import { TERMINAL_THEMES, TERMINAL_FONT_FAMILIES } from '../../NativeXTerm';
import { Check } from 'lucide-react';

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

  // Personalizações avançadas do terminal
  terminalFontFamily?: string;
  setTerminalFontFamily?: (value: string) => void;
  terminalLineHeight?: number;
  setTerminalLineHeight?: (value: number) => void;
  terminalThemePreset?: string;
  setTerminalThemePreset?: (value: string) => void;
  terminalCursorWidth?: number;
  setTerminalCursorWidth?: (value: number) => void;
  terminalScrollOnUserInput?: boolean;
  setTerminalScrollOnUserInput?: (value: boolean) => void;
  terminalDrawBoldTextInBrightColors?: boolean;
  setTerminalDrawBoldTextInBrightColors?: (value: boolean) => void;
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
  terminalFontFamily = 'JetBrains Mono',
  setTerminalFontFamily,
  terminalLineHeight = 1.15,
  setTerminalLineHeight,
  terminalThemePreset = 'default',
  setTerminalThemePreset,
  terminalCursorWidth = 2,
  setTerminalCursorWidth,
  terminalScrollOnUserInput = true,
  setTerminalScrollOnUserInput,
  terminalDrawBoldTextInBrightColors = true,
  setTerminalDrawBoldTextInBrightColors,
}) => {
  const currentTheme = TERMINAL_THEMES[terminalThemePreset] || TERMINAL_THEMES.default;

  const cursorPreviewChar =
    terminalCursorStyle === 'block' ? '█' : terminalCursorStyle === 'bar' ? '│' : '_';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', position: 'relative' }}>
      {/* 1. Preview Interativo do Terminal (Fixo no Scroll) */}
      <div
        style={{
          position: 'sticky',
          top: -20,
          marginTop: -20,
          marginLeft: -24,
          marginRight: -24,
          paddingTop: 20,
          paddingLeft: 24,
          paddingRight: 24,
          paddingBottom: 14,
          background: isEffectiveDark ? '#141416' : '#ffffff',
          zIndex: 20,
          borderBottom: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.05)' : '1px solid rgba(0, 0, 0, 0.05)',
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            padding: 12,
            gap: 12,
            borderRadius: 8,
            background: currentTheme.background,
            color: currentTheme.foreground,
            border: 'none',
            boxShadow: 'none',
            overflow: 'hidden',
            transition: 'all 0.15s ease',
          }}
        >
          {/* Topbar do preview */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#ef4444' }} />
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b' }} />
              <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#10b981' }} />
              <span style={{ fontSize: 10.5, color: currentTheme.brightBlack || '#64748b', marginLeft: 6, fontWeight: 400 }}>
                aura-dev — zsh ({currentTheme.name})
              </span>
            </div>
            <span
              style={{
                fontSize: 9.5,
                padding: '1px 6px',
                borderRadius: 4,
                background: 'rgba(255, 255, 255, 0.08)',
                color: currentTheme.foreground,
                fontWeight: 400,
              }}
            >
              Preview ao Vivo
            </span>
          </div>

          {/* Linhas de terminal simuladas */}
          <div
            style={{
              fontFamily: `"${terminalFontFamily}", "JetBrains Mono", Menlo, Monaco, monospace`,
              fontSize: terminalFontSize,
              lineHeight: terminalLineHeight,
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              userSelect: 'none',
            }}
          >
            <div>
              <span style={{ color: currentTheme.cyan || '#06b6d4' }}>~/aura-dev</span>{' '}
              <span style={{ color: currentTheme.green || '#10b981' }}>git:(main)</span>
            </div>
            <div>
              <span style={{ color: accentColor }}>❯</span>{' '}
              <span style={{ color: currentTheme.foreground }}>npm run dev</span>
            </div>
            <div style={{ color: currentTheme.brightBlack || '#64748b' }}>
              [vite] ready in 180ms. Local: <span style={{ color: currentTheme.blue || '#3b82f6', textDecoration: 'underline' }}>http://localhost:5173/</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <span style={{ color: accentColor }}>❯</span>{' '}
              <span style={{ color: currentTheme.foreground, marginLeft: 6 }}>aura-dev</span>
              <span
                style={{
                  color: accentColor,
                  fontWeight: terminalCursorStyle === 'block' ? 500 : 400,
                  animation: terminalCursorBlink ? 'pulse 1s step-end infinite' : 'none',
                }}
              >
                {cursorPreviewChar}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Tipografia e Fonte */}
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
          Família da Fonte
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
          {TERMINAL_FONT_FAMILIES.map((f) => {
            const isSelected = terminalFontFamily === f.id;
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => {
                  logSystemActivity('configuracoes_terminal', 'alterar_familia_fonte', f.label, { fontFamily: f.id });
                  setTerminalFontFamily?.(f.id);
                }}
                style={{
                  height: 28,
                  padding: '0 8px',
                  borderRadius: 6,
                  border: 'none',
                  boxShadow: 'none',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxSizing: 'border-box',
                  background: isSelected
                    ? hexToRgba(accentColor, 0.18)
                    : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                  color: isSelected ? (isEffectiveDark ? '#ffffff' : accentColor) : themeTokens.textPrimary,
                  fontSize: 11,
                  fontFamily: `"${f.id}", monospace`,
                  fontWeight: 400,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.07)'
                      : 'rgba(0, 0, 0, 0.07)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
                title={f.desc}
              >
                <span>{f.label}</span>
                {isSelected && <Check size={12} color={accentColor} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Tamanho da Fonte */}
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
          Tamanho da Fonte
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
          {[10, 11, 12, 13, 14, 16, 18].map((size) => {
            const isSelected = terminalFontSize === size;
            return (
              <button
                key={size}
                type="button"
                onClick={() => {
                  logSystemActivity('configuracoes_terminal', 'alterar_tamanho_fonte', `${size}px`, { fontSize: size });
                  setTerminalFontSize(size);
                }}
                style={{
                  height: 28,
                  padding: '0 6px',
                  borderRadius: 6,
                  border: 'none',
                  boxShadow: 'none',
                  boxSizing: 'border-box',
                  background: isSelected
                    ? hexToRgba(accentColor, 0.18)
                    : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                  color: isSelected ? (isEffectiveDark ? '#ffffff' : accentColor) : themeTokens.textPrimary,
                  fontSize: 11.5,
                  fontWeight: 400,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.07)'
                      : 'rgba(0, 0, 0, 0.07)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
              >
                {size}px
              </button>
            );
          })}
        </div>
      </div>

      {/* Altura da Linha */}
      {setTerminalLineHeight && (
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
            Altura da Linha (Line Height)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[
              { val: 1.0, label: '1.0 Compacto' },
              { val: 1.15, label: '1.15 Padrão' },
              { val: 1.3, label: '1.30 Confortável' },
              { val: 1.45, label: '1.45 Amplo' },
            ].map((lh) => {
              const isSelected = terminalLineHeight === lh.val;
              return (
                <button
                  key={lh.val}
                  type="button"
                  onClick={() => {
                    logSystemActivity('configuracoes_terminal', 'alterar_altura_linha', lh.label, { lineHeight: lh.val });
                    setTerminalLineHeight(lh.val);
                  }}
                  style={{
                    height: 28,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: 'none',
                    boxShadow: 'none',
                    boxSizing: 'border-box',
                    background: isSelected
                      ? hexToRgba(accentColor, 0.18)
                      : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                    color: isSelected ? (isEffectiveDark ? '#ffffff' : accentColor) : themeTokens.textPrimary,
                    fontSize: 11,
                    fontWeight: 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.07)'
                        : 'rgba(0, 0, 0, 0.07)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.04)'
                        : 'rgba(0, 0, 0, 0.04)';
                    }
                  }}
                >
                  {lh.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />

      {/* 3. Tema de Cores do Terminal */}
      {setTerminalThemePreset && (
        <>
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
              Tema de Cores do Terminal
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
              {Object.values(TERMINAL_THEMES).map((th) => {
                const isSelected = terminalThemePreset === th.id;
                return (
                  <div
                    key={th.id}
                    onClick={() => {
                      logSystemActivity('configuracoes_terminal', 'alterar_tema_terminal', th.name, { themeId: th.id });
                      setTerminalThemePreset(th.id);
                    }}
                    style={{
                      padding: 10,
                      gap: 10,
                      borderRadius: 6,
                      cursor: 'pointer',
                      border: 'none',
                      boxShadow: 'none',
                      background: isSelected
                        ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0')
                        : (isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)'),
                      display: 'flex',
                      flexDirection: 'column',
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
                        e.currentTarget.style.background = isEffectiveDark
                          ? 'rgba(255, 255, 255, 0.03)'
                          : 'rgba(0, 0, 0, 0.025)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 11.5, fontWeight: 400, color: themeTokens.textPrimary }}>
                        {th.name}
                      </span>
                      {isSelected && <Check size={12} color={accentColor} />}
                    </div>

                    {/* Paleta miniatura */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <div style={{ width: 14, height: 8, borderRadius: 2, background: th.background }} title="Fundo" />
                      <div style={{ width: 14, height: 8, borderRadius: 2, background: th.red || '#ef4444' }} />
                      <div style={{ width: 14, height: 8, borderRadius: 2, background: th.green || '#10b981' }} />
                      <div style={{ width: 14, height: 8, borderRadius: 2, background: th.yellow || '#f59e0b' }} />
                      <div style={{ width: 14, height: 8, borderRadius: 2, background: th.blue || '#3b82f6' }} />
                      <div style={{ width: 14, height: 8, borderRadius: 2, background: th.cyan || '#06b6d4' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />
        </>
      )}

      {/* 4. Estilo do Cursor */}
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
          Estilo do Cursor
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { id: 'block', label: 'Bloco', preview: '█' },
            { id: 'bar', label: 'Barra', preview: '│' },
            { id: 'underline', label: 'Sublinhado', preview: '_' },
          ].map((c) => {
            const isSelected = terminalCursorStyle === c.id;
            return (
              <div
                key={c.id}
                onClick={() => {
                  logSystemActivity('configuracoes_terminal', 'alterar_estilo_cursor', c.label, { cursorStyle: c.id });
                  setTerminalCursorStyle(c.id as 'block' | 'bar' | 'underline');
                }}
                style={{
                  padding: 10,
                  gap: 10,
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: 'none',
                  background: isSelected
                    ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0')
                    : (isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.025)'),
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
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
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.03)'
                      : 'rgba(0, 0, 0, 0.025)';
                  }
                }}
              >
                <div
                  style={{
                    fontFamily: `"${terminalFontFamily}", monospace`,
                    fontSize: 15,
                    lineHeight: 1,
                    color: isSelected ? accentColor : themeTokens.textPrimary,
                  }}
                >
                  aura-dev{c.preview}
                </div>
                <div style={{ fontSize: 11, fontWeight: 400, color: isSelected ? accentColor : themeTokens.textSecondary }}>
                  {c.label}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Espessura do Cursor (caso cursor estilo barra) */}
      {terminalCursorStyle === 'bar' && setTerminalCursorWidth && (
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
            Espessura do Cursor Barra
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[
              { val: 1, label: '1px Fino' },
              { val: 2, label: '2px Médio' },
              { val: 3, label: '3px Espesso' },
            ].map((cw) => {
              const isSelected = terminalCursorWidth === cw.val;
              return (
                <button
                  key={cw.val}
                  type="button"
                  onClick={() => {
                    logSystemActivity('configuracoes_terminal', 'alterar_espessura_cursor', cw.label, { width: cw.val });
                    setTerminalCursorWidth(cw.val);
                  }}
                  style={{
                    height: 28,
                    padding: '0 8px',
                    borderRadius: 6,
                    border: 'none',
                    boxShadow: 'none',
                    boxSizing: 'border-box',
                    background: isSelected
                      ? hexToRgba(accentColor, 0.18)
                      : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                    color: isSelected ? (isEffectiveDark ? '#ffffff' : accentColor) : themeTokens.textPrimary,
                    fontSize: 11,
                    fontWeight: 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {cw.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />

      {/* 5. Histórico de Rolagem */}
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
          Histórico de Rolagem (Buffer de Linhas)
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
          {[1000, 5000, 10000, 50000].map((n) => {
            const isSelected = terminalScrollback === n;
            return (
              <button
                key={n}
                type="button"
                onClick={() => {
                  logSystemActivity('configuracoes_terminal', 'alterar_scrollback', `${n} linhas`, { scrollback: n });
                  setTerminalScrollback(n);
                }}
                style={{
                  height: 28,
                  padding: '0 8px',
                  borderRadius: 6,
                  border: 'none',
                  boxShadow: 'none',
                  boxSizing: 'border-box',
                  background: isSelected
                    ? hexToRgba(accentColor, 0.18)
                    : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                  color: isSelected ? (isEffectiveDark ? '#ffffff' : accentColor) : themeTokens.textPrimary,
                  fontSize: 11.5,
                  fontWeight: 400,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.07)'
                      : 'rgba(0, 0, 0, 0.07)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.04)'
                      : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
              >
                {n >= 1000 ? `${n / 1000}k linhas` : `${n} linhas`}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)' }} />

      {/* 6. Comportamento e Produtividade */}
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
          Comportamento e Produtividade
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            {
              label: 'Cursor Piscante',
              desc: 'Faz o cursor do terminal piscar periodicamente.',
              checked: terminalCursorBlink,
              onChange: () => {
                const next = !terminalCursorBlink;
                logSystemActivity('configuracoes_terminal', 'toggle_cursor_blink', 'terminal', { ativo: next });
                setTerminalCursorBlink(next);
              },
            },
            {
              label: 'Copiar ao Selecionar Texto',
              desc: 'Copia automaticamente para a área de transferência ao selecionar texto com o mouse.',
              checked: terminalCopyOnSelect,
              onChange: () => {
                const next = !terminalCopyOnSelect;
                logSystemActivity('configuracoes_terminal', 'toggle_copy_on_select', 'terminal', { ativo: next });
                setTerminalCopyOnSelect(next);
              },
            },
            ...(setTerminalScrollOnUserInput
              ? [
                  {
                    label: 'Rolar até o Final ao Digitar',
                    desc: 'Rola o buffer automaticamente para a linha de comando atual ao teclar.',
                    checked: terminalScrollOnUserInput,
                    onChange: () => {
                      const next = !terminalScrollOnUserInput;
                      logSystemActivity('configuracoes_terminal', 'toggle_scroll_on_input', 'terminal', { ativo: next });
                      setTerminalScrollOnUserInput(next);
                    },
                  },
                ]
              : []),
            ...(setTerminalDrawBoldTextInBrightColors
              ? [
                  {
                    label: 'Cores Vivas em Negrito',
                    desc: 'Renderiza saídas e comandos em negrito utilizando a paleta ANSI brilhante.',
                    checked: terminalDrawBoldTextInBrightColors,
                    onChange: () => {
                      const next = !terminalDrawBoldTextInBrightColors;
                      logSystemActivity('configuracoes_terminal', 'toggle_bold_bright_colors', 'terminal', { ativo: next });
                      setTerminalDrawBoldTextInBrightColors(next);
                    },
                  },
                ]
              : []),
          ].map((row) => (
            <div
              key={row.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: 12,
                gap: 12,
                borderRadius: 8,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)',
                border: 'none',
                boxShadow: 'none',
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>{row.label}</span>
                <span style={{ fontSize: 10.5, color: themeTokens.textSecondary }}>{row.desc}</span>
              </div>
              <MiniSwitch checked={row.checked} onChange={row.onChange} accentColor={accentColor} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
