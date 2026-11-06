import React from 'react';
import { ArrowLeft, ArrowRight, Check, Compass, X } from 'lucide-react';
import type { TooltipRenderProps } from 'react-joyride';
import { getContrastTextColor, hexToRgba } from '../../utils/color';
import type { ThemeTokens } from '../../types/ide';

export interface ScreenTutorialThemeContextValue {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  screenLabel: string;
}

export const ScreenTutorialThemeContext = React.createContext<ScreenTutorialThemeContextValue | null>(null);

const BUTTON_HEIGHT = 30;

export const ScreenTutorialTooltip: React.FC<TooltipRenderProps> = ({
  continuous,
  index,
  isLastStep,
  size,
  step,
  backProps,
  closeProps,
  primaryProps,
  skipProps,
  tooltipProps,
  controls,
}) => {
  const ctx = React.useContext(ScreenTutorialThemeContext);

  const isDark = ctx?.isEffectiveDark ?? true;
  const accentColor = ctx?.accentColor || '#FF6A00';
  const accentTextColor = getContrastTextColor(accentColor);
  const screenLabel = ctx?.screenLabel || 'Guia';

  const cardBg = isDark ? '#161618' : '#ffffff';
  const textPrimary = ctx?.themeTokens.textPrimary || (isDark ? '#ffffff' : '#0f172a');
  const textSecondary = ctx?.themeTokens.textSecondary || (isDark ? '#9898a0' : '#475569');
  const textMuted = ctx?.themeTokens.textMuted || (isDark ? '#66666e' : '#64748b');
  const dividerBg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
  const subtleSurface = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  const subtleSurfaceHover = isDark ? 'rgba(255, 255, 255, 0.11)' : 'rgba(0, 0, 0, 0.09)';
  const ghostHoverBg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  const trackIdleBg = isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.12)';

  return (
    <div
      {...tooltipProps}
      className="auradev-tutorial-card"
      style={{
        width: 340,
        maxWidth: 'calc(100vw - 32px)',
        background: cardBg,
        borderRadius: 10,
        border: 'none',
        boxShadow: 'none',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 16,
        boxSizing: 'border-box',
        fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
        fontWeight: 400,
        color: textPrimary,
        userSelect: 'none',
      }}
    >
      {/* Top Meta Row: Context tag + Step counter + Close */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            padding: '3px 8px',
            borderRadius: 6,
            background: hexToRgba(accentColor, isDark ? 0.14 : 0.1),
            color: accentColor,
            fontSize: 11,
            fontWeight: 400,
            lineHeight: 1.2,
          }}
        >
          <Compass size={12} strokeWidth={1.7} />
          <span>{screenLabel}</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {size > 1 && (
            <span
              style={{
                fontSize: 11,
                fontWeight: 400,
                color: textMuted,
                lineHeight: 1,
              }}
            >
              {index + 1} de {size}
            </span>
          )}

          <button
            {...closeProps}
            type="button"
            title="Fechar tutorial (Esc)"
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: 'none',
              boxShadow: 'none',
              background: 'transparent',
              color: textMuted,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 0,
              transition: 'background 0.15s ease, color 0.15s ease, transform 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = ghostHoverBg;
              e.currentTarget.style.color = textPrimary;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = textMuted;
            }}
          >
            <X size={14} strokeWidth={1.7} />
          </button>
        </div>
      </div>

      {/* Animated Step Body */}
      <div
        key={`step-body-${index}`}
        className="auradev-tutorial-step-body"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {step.title && (
          <div
            style={{
              fontSize: 13.5,
              fontWeight: 400,
              color: textPrimary,
              lineHeight: 1.35,
              letterSpacing: '-0.01em',
            }}
          >
            {step.title}
          </div>
        )}

        <div
          style={{
            fontSize: 12,
            fontWeight: 400,
            color: textSecondary,
            lineHeight: 1.55,
          }}
        >
          {step.content}
        </div>
      </div>

      {/* Segmented Micro-Animated Progress Track */}
      {size > 1 && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
          }}
        >
          {Array.from({ length: size }).map((_, stepIdx) => {
            const isCurrent = stepIdx === index;
            const isPast = stepIdx < index;
            return (
              <button
                key={stepIdx}
                type="button"
                aria-label={`Ir para o passo ${stepIdx + 1}`}
                title={`Passo ${stepIdx + 1}`}
                onClick={() => controls.go(stepIdx)}
                style={{
                  height: 4,
                  width: isCurrent ? 20 : 6,
                  borderRadius: 999,
                  border: 'none',
                  boxShadow: 'none',
                  padding: 0,
                  cursor: 'pointer',
                  background: isCurrent
                    ? accentColor
                    : isPast
                    ? hexToRgba(accentColor, 0.45)
                    : trackIdleBg,
                  transition: 'width 0.18s cubic-bezier(0.16, 1, 0.3, 1), background 0.18s ease',
                }}
              />
            );
          })}
        </div>
      )}

      {/* Low-Opacity Divider */}
      <div
        style={{
          height: 1,
          width: '100%',
          background: dividerBg,
        }}
      />

      {/* Footer Actions — Uniform Vertical Button Height */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div>
          {!isLastStep && size > 1 && (
            <button
              {...skipProps}
              type="button"
              style={{
                height: BUTTON_HEIGHT,
                padding: '0 10px',
                borderRadius: 6,
                border: 'none',
                boxShadow: 'none',
                background: 'transparent',
                color: textMuted,
                fontSize: 11.5,
                fontWeight: 400,
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'background 0.15s ease, color 0.15s ease, transform 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = ghostHoverBg;
                e.currentTarget.style.color = textPrimary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
                e.currentTarget.style.color = textMuted;
              }}
            >
              Pular
            </button>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {index > 0 && (
            <button
              {...backProps}
              type="button"
              style={{
                height: BUTTON_HEIGHT,
                padding: '0 11px',
                borderRadius: 6,
                border: 'none',
                boxShadow: 'none',
                background: subtleSurface,
                color: textPrimary,
                fontSize: 11.5,
                fontWeight: 400,
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                transition: 'background 0.15s ease, transform 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = subtleSurfaceHover;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = subtleSurface;
              }}
            >
              <ArrowLeft size={12} strokeWidth={1.7} />
              <span>Anterior</span>
            </button>
          )}

          {continuous && (
            <button
              {...primaryProps}
              type="button"
              style={{
                height: BUTTON_HEIGHT,
                padding: '0 12px',
                borderRadius: 6,
                border: 'none',
                boxShadow: 'none',
                background: accentColor,
                color: accentTextColor,
                fontSize: 11.5,
                fontWeight: 400,
                fontFamily: 'inherit',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 5,
                transition: 'filter 0.15s ease, transform 0.12s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.filter = 'brightness(1.08)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.filter = 'none';
              }}
            >
              <span>{isLastStep ? 'Concluir' : 'Próximo'}</span>
              {isLastStep ? <Check size={12} strokeWidth={1.9} /> : <ArrowRight size={12} strokeWidth={1.7} />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
