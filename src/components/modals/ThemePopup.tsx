import React from 'react';
import { GripHorizontal, Palette, RotateCcw, X, Moon, Sun, Monitor, Check } from 'lucide-react';
import { hexToRgba, getContrastTextColor } from '../../utils/color';
import { AI_BRAND_COLORS } from '../../constants/ai';
import { DevFlowColorPicker } from '../ui/DevFlowColorPicker';
import { MiniSwitch } from '../ui/MiniSwitch';
import { TutorialTriggerButton, useRegisterTutorialOverlay } from '../tutorial/TutorialTriggerButton';
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
  rainbow: { on: boolean; stops: string[]; speed: number; mode: 'loop' | 'wave' };
  setRainbow: (value: { on: boolean; stops: string[]; speed: number; mode: 'loop' | 'wave' }) => void;
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
  useRegisterTutorialOverlay('popup_theme', true);
  const [selStop, setSelStop] = React.useState(0);
  const stopIdx = Math.min(selStop, rainbow.stops.length - 1);
  const setStop = (i: number, c: string) => setRainbow({ ...rainbow, stops: rainbow.stops.map((x, k) => (k === i ? c : x)) });
  const barGradient = `linear-gradient(90deg, ${[...rainbow.stops, rainbow.stops[0]].join(', ')})`;
  return (
    <div
      className="df-popover"
      style={{
        position: 'fixed',
        left: themePopupPos.x,
        top: themePopupPos.y,
        width: 380,
        maxWidth: 'calc(100vw - 32px)',
        background: themeTokens.bgCard,
        borderRadius: 10,
        border: 'none',
        boxShadow: 'none',
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
        data-tour="theme-popup-header"
        data-no-motion="true"
        onMouseDown={onMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 12px',
          border: 'none',
          borderBottom: 'none',
          boxShadow: 'none',
          background: themeTokens.bgCardSecondary,
          cursor: isDraggingThemePopup ? 'grabbing' : 'grab',
          userSelect: 'none',
        }}
        title="Arraste para reposicionar na tela"
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <GripHorizontal size={14} color={themeTokens.textSecondary} style={{ opacity: 0.8 }} />
          <Palette size={14} color={accentColor} />
          <span style={{ fontSize: 12.5, fontWeight: 400, color: themeTokens.textPrimary }}>
            Tema & Aparência
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          <TutorialTriggerButton
            contextId="popup_theme"
            isDark={isEffectiveDark}
            accentColor={accentColor}
            textColor={themeTokens.textPrimary}
            mutedColor={themeTokens.textSecondary}
            compact
            height={24}
            contextName="Aparência e Tema"
          />
          <button
            type="button"
            className="df-pressable"
            onClick={() => setAccentColor('#FF6A00')}
            title="Restaurar cor padrão (Laranja DevFlow)"
            style={{
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
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
            className="df-pressable"
            onClick={onClose}
            title="Fechar (Esc)"
            style={{
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
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
        <div data-tour="theme-mode-selector">
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
                  className="df-pressable"
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
                    fontWeight: 400,
                    border: 'none',
                    boxShadow: 'none',
                    background: isSelected ? hexToRgba(accentColor, 0.18) : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                    color: isSelected ? (isEffectiveDark ? '#ffffff' : accentColor) : themeTokens.textPrimary,
                    transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease, opacity 150ms ease',
                  }}
                >
                  <span style={{ color: isSelected ? accentColor : themeTokens.textSecondary, display: 'flex' }}>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Section 2: Cor de Destaque (Presets - Apenas Bolinhas Coloridas) */}
        <div data-tour="theme-accent-section" style={{ display: 'flex', flexDirection: 'column', gap: 13 }}>
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
                    border: 'none',
                    boxShadow: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transform: isSelected ? 'scale(1.12)' : 'scale(1)',
                    transition: 'transform 150ms var(--ease-out), opacity 150ms ease',
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
                      className="df-check-pop"
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
        <div className="df-row-interactive" style={{ padding: '9px 10px', borderRadius: 8, border: 'none', boxShadow: 'none', background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc', display: 'flex', flexDirection: 'column', gap: 9 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, fontWeight: 400, color: themeTokens.textPrimary }}>Rainbow (efeito RGB)</span>
            <MiniSwitch checked={rainbow.on} onChange={() => setRainbow({ ...rainbow, on: !rainbow.on })} accentColor={accentColor} />
          </div>
          {rainbow.on && <div className="df-subtle-enter" style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {([['loop', 'Atual'], ['wave', 'Onda']] as const).map(([m, label]) => (
                <button
                  key={m}
                  type="button"
                  className="df-pressable"
                  onClick={() => setRainbow({ ...rainbow, mode: m })}
                  title={m === 'loop' ? 'O destaque do app inteiro troca de cor ao mesmo tempo, em ciclo' : 'Uma onda de cor atravessa a tela da esquerda para a direita (também afeta outras cores vivas, como status e sintaxe)'}
                  style={{ flex: 1, height: 26, borderRadius: 6, border: 'none', boxShadow: 'none', cursor: 'pointer', fontSize: 11, fontWeight: 400, background: rainbow.mode === m ? hexToRgba(accentColor, 0.18) : isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)', color: rainbow.mode === m ? accentColor : themeTokens.textSecondary, transition: 'background-color 150ms ease, color 150ms ease' }}
                >{label}</button>
              ))}
            </div>
            <div style={{ height: 12, borderRadius: 6, background: barGradient }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {rainbow.stops.map((c, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setSelStop(i)}
                  title={`Ponto ${i + 1}`}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', padding: 0, border: 'none', boxShadow: 'none', transform: i === stopIdx ? 'scale(1.16)' : 'scale(1)', transition: 'transform 150ms var(--ease-out), opacity 150ms ease' }}
                />
              ))}
              <button
                type="button"
                className="df-pressable"
                onClick={() => { setRainbow({ ...rainbow, stops: [...rainbow.stops, rainbow.stops[stopIdx]] }); setSelStop(rainbow.stops.length); }}
                title="Adicionar ponto de cor"
                style={{ width: 22, height: 22, borderRadius: '50%', border: 'none', boxShadow: 'none', background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)', color: themeTokens.textSecondary, cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}
              >+</button>
              {rainbow.stops.length > 2 && (
                <button
                  type="button"
                  className="df-pressable"
                  onClick={() => { setRainbow({ ...rainbow, stops: rainbow.stops.filter((_, k) => k !== stopIdx) }); setSelStop(0); }}
                  title="Remover ponto selecionado"
                  style={{ marginLeft: 'auto', fontSize: 10.5, fontWeight: 400, background: 'transparent', border: 'none', boxShadow: 'none', color: themeTokens.textSecondary, cursor: 'pointer' }}
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
        </div>

        {/* Section 4: Sincronizar Cor do Chat com a IA */}
        <div data-tour="theme-ai-sync" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div
          className="df-row-interactive"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 10px',
            borderRadius: 8,
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
            border: 'none',
            boxShadow: 'none',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 400, color: themeTokens.textPrimary }}>
                Cor da IA no Chat
              </span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: AI_BRAND_COLORS[selectedAiProvider] || accentColor,
                  boxShadow: 'none',
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
          className="df-row-interactive"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '9px 10px',
            borderRadius: 8,
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
            border: 'none',
            boxShadow: 'none',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 400, color: themeTokens.textPrimary }}>Cor da IA como destaque</span>
            <span
              style={{ width: 8, height: 8, borderRadius: '50%', background: AI_BRAND_COLORS[selectedAiProvider] || accentColor, boxShadow: 'none' }}
              title="A cor de destaque do sistema acompanha a IA selecionada no cabeçalho"
            />
          </div>
          <MiniSwitch
            checked={useAiSystemAccent}
            onChange={() => setUseAiSystemAccent(!useAiSystemAccent)}
            accentColor={AI_BRAND_COLORS[selectedAiProvider] || accentColor}
          />
        </div>
        </div>

        {/* Subtle footer tip */}
        <div style={{ fontSize: 9.5, color: themeTokens.textSecondary, textAlign: 'center', opacity: 0.65 }}>
          Arraste pelo cabeçalho • Atualização em tempo real
        </div>
      </div>
    </div>
  );
};
