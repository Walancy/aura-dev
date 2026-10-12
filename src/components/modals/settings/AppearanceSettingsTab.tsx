import React, { useState } from 'react';
import { Moon, Sun, Monitor, Check, RotateCcw, Plus, Trash2, ChevronDown } from 'lucide-react';
import { hexToRgba, getContrastTextColor } from '../../../utils/color';
import { AI_BRAND_COLORS } from '../../../constants/ai';
import { DevFlowColorPicker } from '../../ui/DevFlowColorPicker';
import { DevFlowSelect } from '../../ui/DevFlowSelect';
import { MiniSwitch } from '../../ui/MiniSwitch';
import type { ThemeTokens } from '../../../types/ide';
import { logSystemActivity } from '../../../utils/brainService';

const COLOR_PRESETS = [
  { name: 'Laranja Aura Dev', color: '#FF6A00' },
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
];

const RAINBOW_PRESETS = [
  {
    id: 'default',
    label: 'Aura Dev Rainbow',
    description: 'Espectro clássico',
    stops: ['#EF4444', '#EAB308', '#10B981', '#3B82F6', '#A855F7'],
  },
  {
    id: 'sunset',
    label: 'Sunset Glow',
    description: 'Coral e violeta',
    stops: ['#FF6A00', '#F97316', '#EC4899', '#8B5CF6'],
  },
  {
    id: 'cyberpunk',
    label: 'Cyberpunk Neon',
    description: 'Ciano e fúcsia',
    stops: ['#06B6D4', '#A855F7', '#D946EF', '#F43F5E'],
  },
  {
    id: 'ocean',
    label: 'Ocean Breeze',
    description: 'Tons de azul profundo',
    stops: ['#06B6D4', '#38BDF8', '#3B82F6', '#6366F1'],
  },
  {
    id: 'aurora',
    label: 'Aurora Boreal',
    description: 'Verde esmeralda e ciano',
    stops: ['#84CC16', '#10B981', '#14B8A6', '#06B6D4'],
  },
];

const RAINBOW_SPEED_OPTIONS = [
  { value: 3, label: '3s - Muito Rápida' },
  { value: 6, label: '6s - Rápida' },
  { value: 10, label: '10s - Padrão Aura Dev' },
  { value: 15, label: '15s - Suave' },
  { value: 25, label: '25s - Lenta' },
];

export interface AppearanceSettingsTabProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  setAccentColor: (color: string) => void;
  themeMode: 'dark' | 'light' | 'system';
  setThemeMode: (mode: 'dark' | 'light' | 'system') => void;
  selectedAiProvider: string;
  useAiChatThemeColor: boolean;
  setUseAiChatThemeColor: (value: boolean) => void;
  useAiSystemAccent?: boolean;
  setUseAiSystemAccent?: (value: boolean) => void;
  rainbow?: { on: boolean; stops: string[]; speed: number };
  setRainbow?: (value: { on: boolean; stops: string[]; speed: number }) => void;
}

export const AppearanceSettingsTab: React.FC<AppearanceSettingsTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
  setAccentColor,
  themeMode,
  setThemeMode,
  selectedAiProvider,
  useAiChatThemeColor,
  setUseAiChatThemeColor,
  useAiSystemAccent = false,
  setUseAiSystemAccent,
  rainbow,
  setRainbow,
}) => {
  const [selStop, setSelStop] = useState(0);

  const activeRainbow = rainbow || {
    on: false,
    stops: ['#EF4444', '#EAB308', '#10B981', '#3B82F6', '#A855F7'],
    speed: 10,
  };

  const stopIdx = Math.min(selStop, activeRainbow.stops.length - 1);

  const setStop = (i: number, c: string) => {
    if (setRainbow) {
      setRainbow({
        ...activeRainbow,
        stops: activeRainbow.stops.map((x, k) => (k === i ? c : x)),
      });
    }
  };

  const barGradient = `linear-gradient(90deg, ${[...activeRainbow.stops, activeRainbow.stops[0]].join(', ')})`;
  const aiColor = AI_BRAND_COLORS[selectedAiProvider] || accentColor;
  const isDimmed = activeRainbow.on || useAiSystemAccent;

  const cardStyle: React.CSSProperties = {
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    borderRadius: 8,
    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)',
    border: 'none',
    boxShadow: 'none',
    boxSizing: 'border-box',
  };

  const titleStyle: React.CSSProperties = {
    fontSize: 10.5,
    fontWeight: 500,
    color: themeTokens.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  };

  const fieldRowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    minHeight: 28,
  };

  const fieldLabelStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  };

  const currentPreset = COLOR_PRESETS.find(
    (c) => c.color.toUpperCase() === accentColor.toUpperCase()
  );

  const presetSelectOptions = COLOR_PRESETS.map((c) => ({
    value: c.color,
    label: `${c.name} (${c.color})`,
    icon: (
      <span
        style={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: c.color,
          display: 'inline-block',
        }}
      />
    ),
  }));

  // Detect current rainbow preset
  const matchedRainbowPreset = RAINBOW_PRESETS.find(
    (p) => JSON.stringify(p.stops) === JSON.stringify(activeRainbow.stops)
  )?.id || 'custom';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 14,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      {/* 1. Modo de Exibição */}
      <div style={cardStyle}>
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Modo de Exibição
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Escolha entre tema escuro, claro ou sincronizado com o sistema.
            </span>
          </div>

          <div style={{ width: 190, flexShrink: 0 }}>
            <DevFlowSelect
              value={themeMode}
              onChange={(val) => {
                const label = val === 'dark' ? 'Dark' : val === 'light' ? 'Light' : 'Sistema';
                logSystemActivity('configuracoes_aparencia', 'alterar_tema', label, { mode: val });
                setThemeMode(val as any);
              }}
              options={[
                { value: 'dark', label: 'Tema Escuro (Dark)', icon: <Moon size={12} /> },
                { value: 'light', label: 'Tema Claro (Light)', icon: <Sun size={12} /> },
                { value: 'system', label: 'Sistema (Automático)', icon: <Monitor size={12} /> },
              ]}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              themeTokens={themeTokens}
            />
          </div>
        </div>

        {/* Botões Rápidos */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
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
                onClick={() => {
                  logSystemActivity('configuracoes_aparencia', 'alterar_tema', m.label, { mode: m.id });
                  setThemeMode(m.id as any);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 400,
                  border: 'none',
                  boxShadow: 'none',
                  background: isSelected
                    ? hexToRgba(accentColor, 0.18)
                    : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                  color: isSelected ? (isEffectiveDark ? '#ffffff' : accentColor) : themeTokens.textPrimary,
                  transition: 'all 0.15s ease',
                  boxSizing: 'border-box',
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
                <span
                  style={{
                    color: isSelected ? accentColor : themeTokens.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                  }}
                >
                  {m.icon}
                </span>
                <span>{m.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Cor de Destaque */}
      <div
        style={{
          ...cardStyle,
          opacity: isDimmed ? 0.35 : 1,
          pointerEvents: isDimmed ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={titleStyle}>Cor de Destaque</div>

          <button
            type="button"
            onClick={() => {
              logSystemActivity(
                'configuracoes_aparencia',
                'reset_cor_padrao',
                'Laranja Aura Dev',
                { color: '#FF6A00' }
              );
              setAccentColor('#FF6A00');
            }}
            title="Restaurar cor padrão (#FF6A00)"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              height: 28,
              padding: '0 8px',
              borderRadius: 6,
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              color: themeTokens.textSecondary,
              cursor: 'pointer',
              fontSize: 11,
              fontWeight: 400,
              transition: 'all 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
          >
            <RotateCcw size={11} />
            <span>Padrão (#FF6A00)</span>
          </button>
        </div>

        {/* Dropdown de Cores Predefinidas */}
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Paleta Predefinida
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Selecione rapidamente uma cor curada do sistema.
            </span>
          </div>

          <div style={{ width: 220, flexShrink: 0 }}>
            <DevFlowSelect
              value={currentPreset ? currentPreset.color : accentColor}
              onChange={(val) => {
                const item = COLOR_PRESETS.find((c) => c.color === val);
                logSystemActivity('configuracoes_aparencia', 'alterar_accent_color', item?.name || String(val), {
                  color: val,
                });
                setAccentColor(String(val));
              }}
              options={presetSelectOptions}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              themeTokens={themeTokens}
            />
          </div>
        </div>

        {/* Grade Compacta de Amostras de Cor (Sem esticar) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(10, 26px)',
            gap: 8,
            justifyContent: 'flex-start',
            alignItems: 'center',
            marginTop: 2,
          }}
        >
          {COLOR_PRESETS.map((c) => {
            const isSelected = accentColor.toUpperCase() === c.color.toUpperCase();
            return (
              <button
                key={c.color}
                type="button"
                onClick={() => {
                  logSystemActivity('configuracoes_aparencia', 'alterar_accent_color', c.name, {
                    color: c.color,
                  });
                  setAccentColor(c.color);
                }}
                title={`${c.name} (${c.color})`}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: '50%',
                  backgroundColor: c.color,
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                  transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                  transition: 'transform 0.15s ease',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) e.currentTarget.style.transform = 'scale(1.18)';
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) e.currentTarget.style.transform = 'scale(1)';
                }}
              >
                {isSelected && (
                  <Check
                    size={13}
                    color={getContrastTextColor(c.color)}
                    strokeWidth={2.5}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. Cor Personalizada (Colapsável para melhor organização) */}
      <div
        style={{
          ...cardStyle,
          opacity: isDimmed ? 0.35 : 1,
          pointerEvents: isDimmed ? 'none' : 'auto',
          transition: 'opacity 0.2s ease',
        }}
      >
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Personalizar Cor Livre
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Defina qualquer tonalidade HEX ou RGB personalizada.
            </span>
          </div>

          <div
            style={{
              height: 28,
              padding: '0 10px',
              gap: 6,
              borderRadius: 6,
              border: 'none',
              boxShadow: 'none',
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              color: themeTokens.textPrimary,
              display: 'flex',
              alignItems: 'center',
              fontSize: 11.5,
              fontWeight: 400,
              boxSizing: 'border-box',
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: '50%',
                background: accentColor,
                display: 'inline-block',
                marginRight: 2,
              }}
            />
            <span style={{ fontFamily: "'JetBrains Mono', monospace" }}>{accentColor.toUpperCase()}</span>
          </div>
        </div>

        <DevFlowColorPicker
          color={accentColor}
          onChange={(newColor) => {
            logSystemActivity('configuracoes_aparencia', 'custom_color_picker', newColor);
            setAccentColor(newColor);
          }}
          isDark={isEffectiveDark}
        />
      </div>

      {/* 4. Rainbow (Efeito RGB Dinâmico) */}
      <div style={cardStyle}>
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
              Rainbow (Efeito RGB Dinâmico)
            </span>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Transição contínua e animada de cores nos acentos do sistema.
            </span>
          </div>

          <MiniSwitch
            checked={activeRainbow.on}
            onChange={() => {
              const next = !activeRainbow.on;
              logSystemActivity(
                'configuracoes_aparencia',
                'toggle_rainbow',
                next ? 'ativado' : 'desativado',
                { ativo: next }
              );
              if (setRainbow) {
                setRainbow({ ...activeRainbow, on: next });
              }
            }}
            accentColor={accentColor}
          />
        </div>

        {activeRainbow.on && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {/* Barra de Pré-visualização do Gradiente */}
            <div style={{ height: 10, borderRadius: 5, background: barGradient }} />

            {/* Dropdown de Estilos Predefinidos de Rainbow */}
            <div style={fieldRowStyle}>
              <div style={fieldLabelStyle}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                  Predefinição de Gradiente
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                  Conjunto harmonioso de pontos de cor.
                </span>
              </div>

              <div style={{ width: 190, flexShrink: 0 }}>
                <DevFlowSelect
                  value={matchedRainbowPreset}
                  onChange={(val) => {
                    const preset = RAINBOW_PRESETS.find((p) => p.id === val);
                    if (preset && setRainbow) {
                      logSystemActivity(
                        'configuracoes_aparencia',
                        'selecionar_preset_rainbow',
                        preset.label,
                        { presetId: preset.id }
                      );
                      setRainbow({
                        ...activeRainbow,
                        stops: [...preset.stops],
                      });
                      setSelStop(0);
                    }
                  }}
                  options={[
                    ...RAINBOW_PRESETS.map((p) => ({
                      value: p.id,
                      label: p.label,
                      description: p.description,
                    })),
                    ...(matchedRainbowPreset === 'custom'
                      ? [{ value: 'custom', label: 'Personalizado' }]
                      : []),
                  ]}
                  isEffectiveDark={isEffectiveDark}
                  accentColor={accentColor}
                  themeTokens={themeTokens}
                />
              </div>
            </div>

            {/* Dropdown de Velocidade */}
            <div style={fieldRowStyle}>
              <div style={fieldLabelStyle}>
                <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                  Velocidade da Transição
                </span>
                <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                  Tempo de ciclo completo da animação espectral.
                </span>
              </div>

              <div style={{ width: 190, flexShrink: 0 }}>
                <DevFlowSelect
                  value={activeRainbow.speed}
                  onChange={(val) => {
                    const sp = Number(val);
                    logSystemActivity(
                      'configuracoes_aparencia',
                      'alterar_velocidade_rainbow',
                      `${sp}s`,
                      { speed: sp }
                    );
                    if (setRainbow) {
                      setRainbow({ ...activeRainbow, speed: sp });
                    }
                  }}
                  options={RAINBOW_SPEED_OPTIONS}
                  isEffectiveDark={isEffectiveDark}
                  accentColor={accentColor}
                  themeTokens={themeTokens}
                />
              </div>
            </div>

            {/* Pontos de Cor do Rainbow */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              {activeRainbow.stops.map((c, i) => {
                const isSelected = i === stopIdx;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelStop(i)}
                    title={`Ponto ${i + 1}`}
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      background: c,
                      cursor: 'pointer',
                      padding: 0,
                      border: 'none',
                      boxShadow: 'none',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      transform: isSelected ? 'scale(1.15)' : 'scale(1)',
                      transition: 'transform 0.15s ease',
                      boxSizing: 'border-box',
                    }}
                  >
                    {isSelected && (
                      <Check size={12} color={getContrastTextColor(c)} strokeWidth={2.5} />
                    )}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => {
                  const newStops = [...activeRainbow.stops, activeRainbow.stops[stopIdx]];
                  logSystemActivity(
                    'configuracoes_aparencia',
                    'adicionar_stop_rainbow',
                    'novo ponto',
                    { total: newStops.length }
                  );
                  if (setRainbow) {
                    setRainbow({ ...activeRainbow, stops: newStops });
                  }
                  setSelStop(activeRainbow.stops.length);
                }}
                title="Adicionar ponto de cor"
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 6,
                  border: 'none',
                  boxShadow: 'none',
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                  color: themeTokens.textSecondary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'all 0.15s ease',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = themeTokens.textPrimary;
                  e.currentTarget.style.background = isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.09)'
                    : 'rgba(0, 0, 0, 0.08)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = themeTokens.textSecondary;
                  e.currentTarget.style.background = isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.06)'
                    : 'rgba(0, 0, 0, 0.05)';
                }}
              >
                <Plus size={14} />
              </button>

              {activeRainbow.stops.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    const newStops = activeRainbow.stops.filter((_, k) => k !== stopIdx);
                    logSystemActivity(
                      'configuracoes_aparencia',
                      'remover_stop_rainbow',
                      'remover ponto',
                      { index: stopIdx }
                    );
                    if (setRainbow) {
                      setRainbow({ ...activeRainbow, stops: newStops });
                    }
                    setSelStop(0);
                  }}
                  title="Remover ponto selecionado"
                  style={{
                    marginLeft: 'auto',
                    height: 28,
                    padding: '0 8px',
                    borderRadius: 6,
                    fontSize: 11,
                    fontWeight: 400,
                    background: 'transparent',
                    border: 'none',
                    boxShadow: 'none',
                    color: themeTokens.textSecondary,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'color 0.15s ease',
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
                >
                  <Trash2 size={12} />
                  <span>Remover ponto</span>
                </button>
              )}
            </div>

            <DevFlowColorPicker
              color={activeRainbow.stops[stopIdx] || '#FF6A00'}
              onChange={(c) => {
                setStop(stopIdx, c);
                logSystemActivity('configuracoes_aparencia', 'alterar_stop_rainbow', c, {
                  index: stopIdx,
                });
              }}
              isDark={isEffectiveDark}
            />
          </div>
        )}
      </div>

      {/* 5. Cor da IA no Chat */}
      <div style={cardStyle}>
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                Cor da IA no Chat
              </span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: aiColor,
                }}
                title={`Cor ativa da IA: ${aiColor}`}
              />
            </div>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              Aplica dinamicamente a cor da IA selecionada ao degradê e balões do chat.
            </span>
          </div>

          <MiniSwitch
            checked={useAiChatThemeColor}
            onChange={() => {
              const next = !useAiChatThemeColor;
              logSystemActivity(
                'configuracoes_aparencia',
                'toggle_ai_chat_color',
                next ? 'ativado' : 'desativado',
                { ativo: next }
              );
              setUseAiChatThemeColor(next);
            }}
            accentColor={aiColor}
          />
        </div>
      </div>

      {/* 6. Cor da IA como Destaque Global */}
      <div style={cardStyle}>
        <div style={fieldRowStyle}>
          <div style={fieldLabelStyle}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                Cor da IA como Destaque Global
              </span>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: aiColor,
                }}
                title="A cor de destaque do sistema acompanha a IA selecionada no cabeçalho"
              />
            </div>
            <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
              A cor de destaque do sistema acompanha o provedor de IA selecionado no cabeçalho.
            </span>
          </div>

          <MiniSwitch
            checked={useAiSystemAccent}
            onChange={() => {
              const next = !useAiSystemAccent;
              logSystemActivity(
                'configuracoes_aparencia',
                'toggle_ai_system_accent',
                next ? 'ativado' : 'desativado',
                { ativo: next }
              );
              if (setUseAiSystemAccent) {
                setUseAiSystemAccent(next);
              }
            }}
            accentColor={aiColor}
          />
        </div>
      </div>
    </div>
  );
};
