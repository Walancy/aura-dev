import React, { useState } from 'react';
import { X, ChevronDown } from 'lucide-react';
import { EffectItem, EffectType } from './types';
import { DesignTokens } from './tokens';
import ScrubbableNumberInput from './ScrubbableNumberInput';

// =============================================================================
// ICONS OFICIAIS DO FIGMA PARA EFFECTS
// =============================================================================

export const FigmaBlurIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor">
    <circle cx="3.5" cy="3.5" r="1.2" />
    <circle cx="8" cy="3.5" r="1.2" />
    <circle cx="12.5" cy="3.5" r="1.2" />
    <circle cx="3.5" cy="8" r="1.2" />
    <circle cx="8" cy="8" r="1.2" />
    <circle cx="12.5" cy="8" r="1.2" />
    <circle cx="3.5" cy="12.5" r="1.2" />
    <circle cx="8" cy="12.5" r="1.2" />
    <circle cx="12.5" cy="12.5" r="1.2" />
  </svg>
);

export const FigmaInnerShadowIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.3" />
    <path d="M3 5.5C3 4.1 4.1 3 5.5 3H10.5C11.9 3 13 4.1 13 5.5V6H3V5.5Z" fill="currentColor" fillOpacity="0.5" />
  </svg>
);

export const FigmaDropShadowIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="4" y="4" width="10" height="10" rx="2.5" fill="currentColor" fillOpacity="0.3" />
    <rect x="2" y="2" width="10" height="10" rx="2.5" stroke="currentColor" strokeWidth="1.3" fill="transparent" />
  </svg>
);

export const FigmaSpreadIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3">
    <circle cx="8" cy="8" r="2.5" />
    <line x1="8" y1="1.5" x2="8" y2="3.5" strokeLinecap="round" />
    <line x1="8" y1="12.5" x2="8" y2="14.5" strokeLinecap="round" />
    <line x1="1.5" y1="8" x2="3.5" y2="8" strokeLinecap="round" />
    <line x1="12.5" y1="8" x2="14.5" y2="8" strokeLinecap="round" />
    <line x1="3.4" y1="3.4" x2="4.8" y2="4.8" strokeLinecap="round" />
    <line x1="11.2" y1="11.2" x2="12.6" y2="12.6" strokeLinecap="round" />
    <line x1="3.4" y1="12.6" x2="4.8" y2="11.2" strokeLinecap="round" />
    <line x1="11.2" y1="4.8" x2="12.6" y2="3.4" strokeLinecap="round" />
  </svg>
);

export const FigmaNoiseIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="12" height="12" rx="3" stroke="currentColor" strokeWidth="1.3" />
    <circle cx="5" cy="5" r="0.8" fill="currentColor" />
    <circle cx="8.5" cy="5.5" r="0.8" fill="currentColor" />
    <circle cx="11" cy="6" r="0.8" fill="currentColor" />
    <circle cx="6" cy="8.5" r="0.8" fill="currentColor" />
    <circle cx="10" cy="9" r="0.8" fill="currentColor" />
    <circle cx="4.5" cy="11.5" r="0.8" fill="currentColor" />
    <circle cx="8" cy="11" r="0.8" fill="currentColor" />
    <circle cx="11.5" cy="11.5" r="0.8" fill="currentColor" />
  </svg>
);

export const FigmaDensityIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2">
    <circle cx="5" cy="5" r="1.5" />
    <circle cx="11" cy="5" r="1.5" />
    <circle cx="8" cy="8" r="1.2" fill="currentColor" />
    <circle cx="5" cy="11" r="1.5" />
    <circle cx="11" cy="11" r="1.5" />
  </svg>
);

export const FigmaDropletIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M8 2.5C8 2.5 3.5 8 3.5 11C3.5 13.5 5.5 15 8 15C10.5 15 12.5 13.5 12.5 11C12.5 8 8 2.5 8 2.5Z" />
  </svg>
);

export const FigmaOpacityIcon = ({ size = 13 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" fill="none">
    <rect x="2" y="2" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.3" />
    <line x1="8" y1="3" x2="8" y2="13" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
    <line x1="3" y1="8" x2="13" y2="8" stroke="currentColor" strokeWidth="1" strokeDasharray="1.5 1.5" />
  </svg>
);

export function getEffectIcon(type: EffectType, size = 13) {
  switch (type) {
    case 'inner-shadow':
      return <FigmaInnerShadowIcon size={size} />;
    case 'drop-shadow':
      return <FigmaDropShadowIcon size={size} />;
    case 'layer-blur':
    case 'background-blur':
      return <FigmaBlurIcon size={size} />;
    case 'noise':
      return <FigmaNoiseIcon size={size} />;
    default:
      return <FigmaDropShadowIcon size={size} />;
  }
}

export function getEffectLabel(type: EffectType): string {
  switch (type) {
    case 'drop-shadow':
      return 'Drop shadow';
    case 'inner-shadow':
      return 'Inner shadow';
    case 'layer-blur':
      return 'Layer blur';
    case 'background-blur':
      return 'Background blur';
    case 'noise':
      return 'Noise';
    default:
      return type;
  }
}

const CHECKERBOARD_DATA_URL =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"><rect width="4" height="4" fill="%23fff"/><rect x="4" width="4" height="4" fill="%23ccc"/><rect y="4" width="4" height="4" fill="%23ccc"/><rect x="4" y="4" width="4" height="4" fill="%23fff"/></svg>';

export function getFigmaSwatchBackground(color: string, opacity: number): string {
  if (opacity >= 1) return color;
  return `linear-gradient(90deg, ${color} 0%, ${color} 50%, transparent 50%, transparent 100%), linear-gradient(to right, transparent 50%, rgba(0,0,0,0.01) 50%), url("${CHECKERBOARD_DATA_URL}")`;
}

// =============================================================================
// COMPONENTE: FIGMA EFFECT SETTINGS MODAL
// =============================================================================

export interface FigmaEffectSettingsModalProps {
  effect: EffectItem;
  themeTokens: DesignTokens;
  accentColor: string;
  isEffectiveDark: boolean;
  onUpdate: (patch: Partial<EffectItem>) => void;
  onClose: () => void;
  anchorTop?: number;
}

export const FigmaEffectSettingsModal: React.FC<FigmaEffectSettingsModalProps> = ({
  effect,
  themeTokens,
  accentColor,
  isEffectiveDark,
  onUpdate,
  onClose,
  anchorTop = 500,
}) => {
  const [isBlendMenuOpen, setIsBlendMenuOpen] = useState(false);

  const bgElevated = isEffectiveDark ? '#222222' : '#ffffff';
  const bgSecondary = isEffectiveDark ? '#2c2c2c' : '#f0f0f0';
  const bgCard = isEffectiveDark ? '#1a1a1a' : '#f8f8f8';
  const textPrimary = themeTokens.textPrimary;
  const textSecondary = themeTokens.textSecondary;
  const divider = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
  const inputBorder = 'transparent';

  const inputStyle: React.CSSProperties = {
    background: bgSecondary,
    border: '1px solid transparent',
    borderRadius: 5,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    boxSizing: 'border-box',
    width: '100%',
  };

  const fieldInputStyle: React.CSSProperties = {
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: textPrimary,
    fontSize: 11,
    fontFamily: "'Poppins', sans-serif",
    width: '100%',
    marginLeft: 4,
  };

  const isShadow = effect.type === 'drop-shadow' || effect.type === 'inner-shadow';
  const isBlur = effect.type === 'layer-blur' || effect.type === 'background-blur';
  const isNoise = effect.type === 'noise';

  const blurMode = effect.blurMode || 'uniform';
  const noiseMode = effect.noiseMode || 'mono';

  // Componente de input de cor Figma (swatch + hex + opacity)
  const renderColorInput = (
    colorVal: string,
    opacityVal: number,
    onColorChange: (hex: string) => void,
    onOpacityChange: (op: number) => void
  ) => {
    const hexClean = colorVal.replace('#', '').toUpperCase();
    const opPercent = Math.round(opacityVal * 100);

    return (
      <div
        style={{
          ...inputStyle,
          padding: '0 6px',
        }}
      >
        <label
          style={{
            width: 14,
            height: 14,
            borderRadius: 3,
            border: '1px solid rgba(255,255,255,0.18)',
            background: getFigmaSwatchBackground(colorVal, opacityVal),
            cursor: 'pointer',
            flexShrink: 0,
            position: 'relative',
            overflow: 'hidden',
          }}
          title="Selecionar cor"
        >
          <input
            type="color"
            value={colorVal.startsWith('#') && colorVal.length === 7 ? colorVal : '#000000'}
            onChange={(e) => onColorChange(e.target.value.toUpperCase())}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: '100%',
              opacity: 0,
              cursor: 'pointer',
            }}
          />
        </label>

        <input
          type="text"
          value={hexClean}
          maxLength={6}
          onChange={(e) => {
            const val = e.target.value.replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
            if (val.length === 6) onColorChange(`#${val}`);
          }}
          style={{
            ...fieldInputStyle,
            width: 60,
            fontFamily: 'monospace',
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
            marginLeft: 6,
          }}
        />

        <div style={{ width: 1, height: 12, background: divider, margin: '0 4px', flexShrink: 0 }} />

        <ScrubbableNumberInput
          value={opPercent}
          min={0}
          max={100}
          suffix="%"
          onChange={(val) => onOpacityChange(val / 100)}
          themeTokens={themeTokens}
          accentColor={accentColor}
          isEffectiveDark={isEffectiveDark}
          style={{ width: 44, height: 20, background: 'transparent', padding: '0 2px', border: 'none' }}
          inputStyle={{ textAlign: 'right' }}
        />
      </div>
    );
  };

  return (
    <div
      data-testid="figma-effect-settings-modal"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: Math.max(80, Math.min(anchorTop - 40, window.innerHeight - 380)),
        right: 16,
        width: 250,
        background: bgElevated,
        border: `1px solid ${divider}`,
        borderRadius: 8,
        boxShadow: '0 12px 36px rgba(0,0,0,0.5)',
        padding: 12,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        fontFamily: "'Poppins', sans-serif",
        color: textPrimary,
      }}
    >
      {/* =================================================================== */}
      {/* 1. CABEÇALHO: Ícone + Seletor de Tipo + Droplet + Fechar           */}
      {/* =================================================================== */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative' }}>
          <span style={{ color: textPrimary, display: 'flex', alignItems: 'center' }}>
            {getEffectIcon(effect.type, 14)}
          </span>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <select
              value={effect.type}
              onChange={(e) => onUpdate({ type: e.target.value as EffectType })}
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: textPrimary,
                fontSize: 12,
                fontWeight: 600,
                fontFamily: "'Poppins', sans-serif",
                cursor: 'pointer',
                appearance: 'none',
                WebkitAppearance: 'none',
                paddingRight: 16,
              }}
            >
              <option value="drop-shadow" style={{ background: bgCard, color: textPrimary }}>Drop shadow</option>
              <option value="inner-shadow" style={{ background: bgCard, color: textPrimary }}>Inner shadow</option>
              <option value="layer-blur" style={{ background: bgCard, color: textPrimary }}>Layer blur</option>
              <option value="background-blur" style={{ background: bgCard, color: textPrimary }}>Background blur</option>
              <option value="noise" style={{ background: bgCard, color: textPrimary }}>Noise</option>
            </select>
            <ChevronDown size={11} color={textSecondary} style={{ position: 'absolute', right: 0, pointerEvents: 'none' }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Droplet (Blend Mode) para Shadow e Noise */}
          {(isShadow || isNoise) && (
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsBlendMenuOpen((prev) => !prev)}
                style={{
                  background: isBlendMenuOpen ? `${accentColor}26` : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  padding: '3px 4px',
                  display: 'flex',
                  alignItems: 'center',
                  color: isBlendMenuOpen ? accentColor : textSecondary,
                }}
                title="Modo de mesclagem (Blend mode)"
              >
                <FigmaDropletIcon size={13} />
              </button>

              {isBlendMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '100%',
                    right: 0,
                    marginTop: 4,
                    background: bgCard,
                    border: `1px solid ${divider}`,
                    borderRadius: 6,
                    padding: '4px 0',
                    zIndex: 200,
                    boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                    minWidth: 110,
                  }}
                >
                  {['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten'].map((mode) => (
                    <div
                      key={mode}
                      onClick={() => {
                        onUpdate({ blendMode: mode });
                        setIsBlendMenuOpen(false);
                      }}
                      style={{
                        padding: '5px 10px',
                        fontSize: 11,
                        textTransform: 'capitalize',
                        cursor: 'pointer',
                        color: (effect.blendMode || 'normal') === mode ? accentColor : textPrimary,
                        background: (effect.blendMode || 'normal') === mode ? `${accentColor}18` : 'transparent',
                      }}
                    >
                      {mode}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Botão Fechar */}
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              borderRadius: 4,
              cursor: 'pointer',
              padding: '3px 4px',
              display: 'flex',
              alignItems: 'center',
              color: textSecondary,
            }}
            title="Fechar"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. SUB-ABAS (BLUR OU NOISE)                                        */}
      {/* =================================================================== */}
      {isBlur && (
        <div
          style={{
            display: 'flex',
            background: bgCard,
            padding: 2,
            borderRadius: 6,
            border: `1px solid ${divider}`,
          }}
        >
          {(['uniform', 'progressive'] as const).map((tab) => {
            const isActive = blurMode === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onUpdate({ blurMode: tab })}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? textPrimary : textSecondary,
                  background: isActive ? bgSecondary : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  textTransform: 'capitalize',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>
      )}

      {isNoise && (
        <div
          style={{
            display: 'flex',
            background: bgCard,
            padding: 2,
            borderRadius: 6,
            border: `1px solid ${divider}`,
          }}
        >
          {(['mono', 'duo', 'multi'] as const).map((tab) => {
            const isActive = noiseMode === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => onUpdate({ noiseMode: tab })}
                style={{
                  flex: 1,
                  padding: '4px 0',
                  fontSize: 11,
                  fontWeight: isActive ? 600 : 400,
                  color: isActive ? textPrimary : textSecondary,
                  background: isActive ? bgSecondary : 'transparent',
                  border: 'none',
                  borderRadius: 4,
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  textTransform: 'capitalize',
                  boxShadow: isActive ? '0 1px 3px rgba(0,0,0,0.2)' : 'none',
                }}
              >
                {tab}
              </button>
            );
          })}
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. CONTEÚDO ESPECÍFICO DE ACORDO COM O TIPO                         */}
      {/* =================================================================== */}

      {/* --- A. DROP SHADOW / INNER SHADOW (SCREENSHOT 3) --- */}
      {isShadow && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Position (X e Y empilhados na direita) */}
          <div style={{ display: 'grid', gridTemplateColumns: '65px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Position</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <ScrubbableNumberInput
                label="X"
                value={effect.x}
                onChange={(x) => onUpdate({ x })}
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ height: 26, borderRadius: 5, background: bgSecondary, border: `1px solid ${inputBorder}` }}
              />
              <ScrubbableNumberInput
                label="Y"
                value={effect.y}
                onChange={(y) => onUpdate({ y })}
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ height: 26, borderRadius: 5, background: bgSecondary, border: `1px solid ${inputBorder}` }}
              />
            </div>
          </div>

          {/* Blur */}
          <div style={{ display: 'grid', gridTemplateColumns: '65px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Blur</span>
            <ScrubbableNumberInput
              label={<FigmaBlurIcon size={12} />}
              min={0}
              value={effect.blur}
              onChange={(blur) => onUpdate({ blur: Math.max(0, blur) })}
              themeTokens={themeTokens}
              accentColor={accentColor}
              isEffectiveDark={isEffectiveDark}
              style={{ height: 26, borderRadius: 5, background: bgSecondary, border: `1px solid ${inputBorder}` }}
            />
          </div>

          {/* Spread */}
          <div style={{ display: 'grid', gridTemplateColumns: '65px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Spread</span>
            <ScrubbableNumberInput
              label={<FigmaSpreadIcon size={12} />}
              value={effect.spread}
              onChange={(spread) => onUpdate({ spread })}
              themeTokens={themeTokens}
              accentColor={accentColor}
              isEffectiveDark={isEffectiveDark}
              style={{ height: 26, borderRadius: 5, background: bgSecondary, border: `1px solid ${inputBorder}` }}
            />
          </div>

          {/* Color */}
          <div style={{ display: 'grid', gridTemplateColumns: '65px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Color</span>
            {renderColorInput(
              effect.color || '#000000',
              effect.opacity ?? 0.25,
              (hex) => onUpdate({ color: hex }),
              (op) => onUpdate({ opacity: op })
            )}
          </div>
        </div>
      )}

      {/* --- B. LAYER BLUR / BACKGROUND BLUR (SCREENSHOT 4) --- */}
      {isBlur && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {blurMode === 'uniform' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '65px 1fr', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: textSecondary }}>Blur</span>
              <ScrubbableNumberInput
                label={<FigmaBlurIcon size={12} />}
                min={0}
                value={effect.blur}
                onChange={(blur) => onUpdate({ blur: Math.max(0, blur) })}
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ height: 26, borderRadius: 5, background: bgSecondary, border: `1px solid ${inputBorder}` }}
              />
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '65px 1fr', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: textSecondary }}>Start</span>
                <ScrubbableNumberInput
                  label={<FigmaBlurIcon size={12} />}
                  min={0}
                  value={effect.blurStart ?? 0}
                  onChange={(blurStart) => onUpdate({ blurStart: Math.max(0, blurStart) })}
                  themeTokens={themeTokens}
                  accentColor={accentColor}
                  isEffectiveDark={isEffectiveDark}
                  style={{ height: 26, borderRadius: 5, background: bgSecondary, border: `1px solid ${inputBorder}` }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '65px 1fr', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: textSecondary }}>End</span>
                <ScrubbableNumberInput
                  label={<FigmaBlurIcon size={12} />}
                  min={0}
                  value={effect.blurEnd ?? effect.blur}
                  onChange={(blurEnd) => onUpdate({ blurEnd: Math.max(0, blurEnd) })}
                  themeTokens={themeTokens}
                  accentColor={accentColor}
                  isEffectiveDark={isEffectiveDark}
                  style={{ height: 26, borderRadius: 5, background: bgSecondary, border: `1px solid ${inputBorder}` }}
                />
              </div>
            </>
          )}
        </div>
      )}

      {/* --- C. NOISE (SCREENSHOT 5) --- */}
      {isNoise && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Noise size (X e Y empilhados) */}
          <div style={{ display: 'grid', gridTemplateColumns: '65px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Noise size</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <ScrubbableNumberInput
                label="X"
                min={1}
                value={effect.noiseSizeX ?? 4}
                onChange={(noiseSizeX) => onUpdate({ noiseSizeX: Math.max(1, noiseSizeX) })}
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ height: 26, borderRadius: 5, background: bgSecondary, border: `1px solid ${inputBorder}` }}
              />
              <ScrubbableNumberInput
                label="Y"
                min={1}
                value={effect.noiseSizeY ?? 4}
                onChange={(noiseSizeY) => onUpdate({ noiseSizeY: Math.max(1, noiseSizeY) })}
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ height: 26, borderRadius: 5, background: bgSecondary, border: `1px solid ${inputBorder}` }}
              />
            </div>
          </div>

          {/* Density */}
          <div style={{ display: 'grid', gridTemplateColumns: '65px 1fr', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Density</span>
            <ScrubbableNumberInput
              label={<FigmaDensityIcon size={12} />}
              min={0}
              max={100}
              suffix="%"
              value={effect.density ?? 100}
              onChange={(density) => onUpdate({ density: Math.min(100, Math.max(0, density)) })}
              themeTokens={themeTokens}
              accentColor={accentColor}
              isEffectiveDark={isEffectiveDark}
              style={{ height: 26, borderRadius: 5, background: bgSecondary, border: `1px solid ${inputBorder}` }}
            />
          </div>

          {/* Opções específicas do modo de Noise */}
          {noiseMode === 'mono' && (
            <div style={{ display: 'grid', gridTemplateColumns: '65px 1fr', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: textSecondary }}>Color</span>
              {renderColorInput(
                effect.color || '#000000',
                effect.opacity ?? 0.25,
                (hex) => onUpdate({ color: hex }),
                (op) => onUpdate({ opacity: op })
              )}
            </div>
          )}

          {noiseMode === 'duo' && (
            <div style={{ display: 'grid', gridTemplateColumns: '65px 1fr', alignItems: 'flex-start', gap: 8 }}>
              <span style={{ fontSize: 11, color: textSecondary, marginTop: 6 }}>Colors</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {renderColorInput(
                  effect.color || '#000000',
                  effect.opacity ?? 0.25,
                  (hex) => onUpdate({ color: hex }),
                  (op) => onUpdate({ opacity: op })
                )}
                {renderColorInput(
                  effect.color2 || '#FFFFFF',
                  effect.opacity2 ?? 0.25,
                  (hex) => onUpdate({ color2: hex }),
                  (op) => onUpdate({ opacity2: op })
                )}
              </div>
            </div>
          )}

          {noiseMode === 'multi' && (
            <div style={{ display: 'grid', gridTemplateColumns: '65px 1fr', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 11, color: textSecondary }}>Opacity</span>
              <ScrubbableNumberInput
                label={<FigmaOpacityIcon size={12} />}
                min={0}
                max={100}
                suffix="%"
                value={Math.round((effect.opacity ?? 0.15) * 100)}
                onChange={(num) => onUpdate({ opacity: Math.min(100, Math.max(0, num)) / 100 })}
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ height: 26, borderRadius: 5, background: bgSecondary, border: `1px solid ${inputBorder}` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FigmaEffectSettingsModal;
