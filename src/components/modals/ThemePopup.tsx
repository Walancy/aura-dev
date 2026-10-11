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
  /** usa a cor da IA selecionada no cabeçalho como cor de destaque do sistema inteiro */
  useAiSystemAccent: boolean;
  setUseAiSystemAccent: (value: boolean) => void;
  selectedAiProvider: string;
  /** destaque rainbow: troca a cor de destaque em loop entre os pontos de cor */
  rainbow: { on: boolean; stops: string[]; speed: number };
  setRainbow: (value: { on: boolean; stops: string[]; speed: number }) => void;
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
  useAiSystemAccent,
  setUseAiSystemAccent,
  selectedAiProvider,
  rainbow,
  setRainbow,
}) => {
  const [selStop, setSelStop] = React.useState(0);
  const stopIdx = Math.min(selStop, rainbow.stops.length - 1);
  const setStop = (i: number, c: string) => setRainbow({ ...rainbow, stops: rainbow.stops.map((x, k) => (k === i ? c : x)) });
  const barGradient = `linear-gradient(90deg, ${[...rainbow.stops, rainbow.stops[0]].join(', ')})`;
  return (
    <div
      style={{
        position: 'fixed',
        left: themePopupPos.x,
        top: themePopupPos.y,
        width: 380,
        maxWidth: 'calc(100vw - 32px)',
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

        {/* Section 2: Cor de Destaque (Presets - Apenas Bolinhas Coloridas) */}
        {!rainbow.on && <div style={useAiSystemAccent ? { opacity: 0.35, pointerEvents: 'none' } : undefined}>
          <div style={{ fontSize: 10, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>
            Cor de Destaque
          </div>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(10, 1fr)',
              gap: 8,
              justifyItems: 'center',
              alignItems: 'center',
            }}
          >
            {[
              { name: 'Laranja DevFlow', color: '#FF6A00' },
              { name: 'Âmbar Solar', color: '#FF8A00' },
              { name: 'Coral', color: '#F97316' },
              { name: 'Dourado', color: '#F59E0B' },
              { name: 'Amarelo Ouro', color: '#EAB308' },
              { name: 'Verde Lima', color: '#84CC16' },
              { name: 'Esmeralda', color: '#10B981' },
              { name: 'Menta / Teal', color: '#14B8A6' },
              { name: 'Ciano', color: '#06B6D4' },
              { name: 'Azul Céu', color: '#38BDF8' },
              { name: 'Azul Real', color: '#3B82F6' },
              { name: 'Azul Dev', color: '#007ACC' },
              { name: 'Índigo', color: '#6366F1' },
              { name: 'Violeta', color: '#8B5CF6' },
              { name: 'Roxo Elétrico', color: '#A855F7' },
              { name: 'Fúcsia', color: '#D946EF' },
              { name: 'Magenta', color: '#EC4899' },
              { name: 'Rosa Vibrante', color: '#F43F5E' },
              { name: 'Vermelho Ruby', color: '#EF4444' },
              { name: 'Grafite Prateado', color: '#94A3B8' },
            ].map((c) => {
              const isSelected = accentColor.toUpperCase() === c.color.toUpperCase();
              return (
                <button
                  key={c.color}
                  type="button"
                  onClick={() => setAccentColor(c.color)}
                  title={c.name}
                  style={{
                    width: 27,
                    height: 27,
                    borderRadius: '50%',
                    backgroundColor: c.color,
                    cursor: 'pointer',
                    border: isSelected
                      ? '2px solid #ffffff'
                      : (isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.12)'),
                    boxShadow: isSelected
                      ? `0 0 0 2px ${c.color}, 0 0 10px ${hexToRgba(c.color, 0.6)}`
                      : '0 2px 4px rgba(0, 0, 0, 0.15)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transform: isSelected ? 'scale(1.12)' : 'scale(1)',
                    transition: 'transform 0.15s cubic-bezier(0.4, 0, 0.2, 1), box-shadow 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.transform = 'scale(1.15)';
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) (e.currentTarget as HTMLElement).style.transform = 'scale(1)';
                  }}
                >
                  {isSelected && (
                    <Check
                      size={13}
                      color={getContrastTextColor(c.color)}
                      strokeWidth={3}
                    />
                  )}
                </button>
              );
            })}
          </div>
        </div>}

        {/* Section 3: Custom Stylized Color Picker */}
        {!rainbow.on && <div style={useAiSystemAccent ? { opacity: 0.35, pointerEvents: 'none' } : undefined}>
          <div style={{ fontSize: 10, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 }}>
            Cor Personalizada
          </div>
          <DevFlowColorPicker
            color={accentColor}
            onChange={setAccentColor}
            isDark={isEffectiveDark}
          />
        </div>}

        {/* Rainbow: destaque que troca de cor em loop */}
        <div style={{ padding: '9px 10px', borderRadius: 8, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: themeTokens.textPrimary }}>Rainbow (efeito RGB)</span>
            <MiniSwitch checked={rainbow.on} onChange={() => setRainbow({ ...rainbow, on: !rainbow.on })} accentColor={accentColor} />
          </div>
          {rainbow.on && <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ height: 12, borderRadius: 6, background: barGradient }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {rainbow.stops.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelStop(i)}
                  title={`Ponto ${i + 1}`}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0, border: i === stopIdx ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.2)', boxShadow: i === stopIdx ? `0 0 0 2px ${c}` : 'none' }}
                />
              ))}
              <button
                type="button"
                onClick={() => { setRainbow({ ...rainbow, stops: [...rainbow.stops, rainbow.stops[stopIdx]] }); setSelStop(rainbow.stops.length); }}
                title="Adicionar ponto de cor"
                style={{ width: 22, height: 22, borderRadius: '50%', border: `1px dashed ${themeTokens.textSecondary}`, background: 'transparent', color: themeTokens.textSecondary, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
              >+</button>
              {rainbow.stops.length > 2 && (
                <button
                  type="button"
                  onClick={() => { setRainbow({ ...rainbow, stops: rainbow.stops.filter((_, k) => k !== stopIdx) }); setSelStop(0); }}
                  title="Remover ponto selecionado"
                  style={{ marginLeft: 'auto', fontSize: 10.5, background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer' }}
                >Remover ponto</button>
              )}
            </div>
            <DevFlowColorPicker color={rainbow.stops[stopIdx]} onChange={(c) => setStop(stopIdx, c)} isDark={isEffectiveDark} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: themeTokens.textSecondary, flexShrink: 0 }}>Velocidade</span>
              <input
                type="range"
                min={1}
                max={30}
                step={1}
                value={31 - rainbow.speed}
                onChange={(e) => setRainbow({ ...rainbow, speed: 31 - Number(e.target.value) })}
                style={{ flex: 1, accentColor }}
              />
              <span style={{ fontSize: 10.5, color: themeTokens.textSecondary, width: 34, textAlign: 'right' }}>{rainbow.speed}s</span>
            </div>
          </div>}
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

        {/* Cor da IA selecionada como destaque de todo o sistema */}
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: themeTokens.textPrimary }}>Cor da IA como destaque</span>
            <span
              style={{ width: 8, height: 8, borderRadius: '50%', background: AI_BRAND_COLORS[selectedAiProvider] || accentColor, boxShadow: `0 0 6px ${AI_BRAND_COLORS[selectedAiProvider] || accentColor}` }}
              title="A cor de destaque do sistema acompanha a IA selecionada no cabeçalho"
            />
          </div>
          <MiniSwitch
            checked={useAiSystemAccent}
            onChange={() => setUseAiSystemAccent(!useAiSystemAccent)}
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
