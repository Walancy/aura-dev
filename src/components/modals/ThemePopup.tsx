import React from 'react';
import { GripHorizontal, Palette, RotateCcw, X, Moon, Sun, Monitor, Check } from 'lucide-react';
import { hexToRgba, getContrastTextColor } from '../../utils/color';
import { AI_BRAND_COLORS } from '../../constants/ai';
import { DevFlowColorPicker } from '../ui/DevFlowColorPicker';
import { MiniSwitch } from '../ui/MiniSwitch';
import type { ThemeTokens } from '../../types/ide';

export interface ThemePopupProps {
  themePopupPos: { x: number; y: number };
  isDraggingThemePopup: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClose: () => void;
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  setAccentColor: (color: string) => void;
  themeMode: 'dark' | 'light' | 'system';
  setThemeMode: (mode: 'dark' | 'light' | 'system') => void;
  useAiChatThemeColor: boolean;
  setUseAiChatThemeColor: (value: boolean) => void;
  selectedAiProvider: string;
}

export const ThemePopup: React.FC<ThemePopupProps> = ({
  themePopupPos,
  isDraggingThemePopup,
  onMouseDown,
  onClose,
  themeTokens,
  isEffectiveDark,
  accentColor,
  setAccentColor,
  themeMode,
  setThemeMode,
  useAiChatThemeColor,
  setUseAiChatThemeColor,
  selectedAiProvider,
}) => {
  return (
    <div
      style={{
        position: 'fixed',
        left: themePopupPos.x,
        top: themePopupPos.y,
        width: 320,
        background: themeTokens.bgCard,
        borderRadius: 10,
        border: `1px solid ${themeTokens.border}`,
        boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
        zIndex: 999999,
        display: 'flex',
        flexDirection: 'column',
        boxSizing: 'border-box',
        userSelect: isDraggingThemePopup ? 'none' : 'auto',
        fontFamily: 'Poppins, -apple-system, sans-serif',
        backdropFilter: 'blur(16px)',
        overflow: 'hidden',
      }}
    >
      {/* Draggable Header */}
      <div
        onMouseDown={onMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          borderBottom: 'none',
          background: themeTokens.bgCardSecondary,
          cursor: isDraggingThemePopup ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
        title="Arraste para reposicionar na tela"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <GripHorizontal size={14} color={themeTokens.textSecondary} style={{ opacity: 0.8 }} />
          <Palette size={14} color={accentColor} />
          <span style={{ fontSize: 12.5, fontWeight: 600, color: themeTokens.textPrimary }}>
            Tema & Aparência
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <button
            type="button"
            onClick={() => setAccentColor('#FF6A00')}
            title="Restaurar cor padrão (Laranja DevFlow)"
            style={{
              background: 'transparent',
              border: 'none',
              color: themeTokens.textSecondary,
              cursor: 'pointer',
              padding: 3,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
          >
            <RotateCcw size={13} />
          </button>
          <button
            type="button"
            onClick={onClose}
            title="Fechar (Esc)"
            style={{
              background: 'transparent',
              border: 'none',
              color: themeTokens.textSecondary,
              cursor: 'pointer',
              padding: 3,
              display: 'flex',
              alignItems: 'center',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ff5f56')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Content Body */}
      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 13, maxHeight: 'calc(88vh - 40px)', overflowY: 'auto' }}>
        {/* Section 1: Modo de Tema */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 }}>
            Modo de Exibição
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
            {[
              { id: 'dark', label: 'Dark', icon: <Moon size={13} /> },
              { id: 'light', label: 'Light', icon: <Sun size={13} /> },
              { id: 'system', label: 'Sistema', icon: <Monitor size={13} /> },
            ].map((m) => {
              const isSelected = themeMode === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setThemeMode(m.id as any)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '7px 8px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    fontSize: 11.5,
                    fontWeight: isSelected ? 600 : 400,
                    border: 'none',
                    background: isSelected ? hexToRgba(accentColor, 0.18) : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                    color: isSelected ? (isEffectiveDark ? '#ffffff' : accentColor) : themeTokens.textPrimary,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span style={{ color: isSelected ? accentColor : themeTokens.textSecondary }}>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Cor de Destaque (Presets) */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 }}>
            Cor de Destaque
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
            {[
              { name: 'Laranja', color: '#FF6A00' },
              { name: 'Azul', color: '#007ACC' },
              { name: 'Esmeralda', color: '#10B981' },
              { name: 'Roxo', color: '#8B5CF6' },
              { name: 'Vermelho', color: '#EF4444' },
              { name: 'Dourado', color: '#F59E0B' },
              { name: 'Ciano', color: '#06B6D4' },
              { name: 'Magenta', color: '#EC4899' },
            ].map((c) => {
              const isSelected = accentColor.toUpperCase() === c.color.toUpperCase();
              return (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => setAccentColor(c.color)}
                  title={c.name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 5,
                    padding: '5px 4px',
                    borderRadius: 6,
                    cursor: 'pointer',
                    border: 'none',
                    background: isSelected ? hexToRgba(c.color, 0.16) : (isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)'),
                    transition: 'all 0.15s ease',
                  }}
                >
                  <span
                    style={{
                      width: 13,
                      height: 13,
                      borderRadius: '50%',
                      background: c.color,
                      flexShrink: 0,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: isSelected ? `0 0 8px ${c.color}` : 'none',
                    }}
                  >
                    {isSelected && <Check size={8} color={getContrastTextColor(c.color)} strokeWidth={3} />}
                  </span>
                  <span style={{ fontSize: 10.5, color: themeTokens.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {c.name}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 3: Custom Stylized Color Picker */}
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 }}>
            Cor Personalizada
          </div>
          <DevFlowColorPicker
            color={accentColor}
            onChange={setAccentColor}
            isDark={isEffectiveDark}
          />
        </div>

        {/* Section 4: Sincronizar Cor do Chat com a IA */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 10px',
            borderRadius: 8,
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
            border: 'none',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 600, color: themeTokens.textPrimary }}>
                Cor da IA no Chat
              </span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: AI_BRAND_COLORS[selectedAiProvider] || accentColor,
                  boxShadow: `0 0 6px ${AI_BRAND_COLORS[selectedAiProvider] || accentColor}`,
                }}
                title={`Cor ativa da IA: ${AI_BRAND_COLORS[selectedAiProvider] || accentColor}`}
              />
            </div>
          </div>
          <MiniSwitch
            checked={useAiChatThemeColor}
            onChange={() => setUseAiChatThemeColor(!useAiChatThemeColor)}
            accentColor={AI_BRAND_COLORS[selectedAiProvider] || accentColor}
          />
        </div>

        {/* Subtle footer tip */}
        <div style={{ fontSize: 9.5, color: themeTokens.textSecondary, textAlign: 'center', opacity: 0.65 }}>
          Arraste pelo cabeçalho • Atualização em tempo real
        </div>
      </div>
    </div>
  );
};
