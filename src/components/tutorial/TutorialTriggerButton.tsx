import React, { useEffect, useState } from 'react';
import { Compass } from 'lucide-react';
import { logSystemActivity } from '../../utils/brainService';
import { hexToRgba } from '../../utils/color';
import {
  pushTutorialOverlay,
  removeTutorialOverlay,
  requestTutorialStart,
  SCREEN_TUTORIAL_LABELS,
  type OverlayTutorialId,
  type TutorialContextId,
} from './tutorialStore';

export function useRegisterTutorialOverlay(
  overlayId: OverlayTutorialId,
  isOpen: boolean = true
): void {
  useEffect(() => {
    if (!isOpen) {
      removeTutorialOverlay(overlayId);
      return;
    }
    pushTutorialOverlay(overlayId);
    return () => {
      removeTutorialOverlay(overlayId);
    };
  }, [overlayId, isOpen]);
}

export interface TutorialTriggerButtonProps {
  contextId: TutorialContextId;
  isDark?: boolean;
  isEffectiveDark?: boolean;
  accentColor?: string;
  textColor?: string;
  textPrimary?: string;
  mutedColor?: string;
  textSecondary?: string;
  label?: string;
  compact?: boolean;
  height?: number;
  contextName?: string;
  onBeforeStart?: () => void;
}

export const TutorialTriggerButton: React.FC<TutorialTriggerButtonProps> = ({
  contextId,
  isDark,
  isEffectiveDark,
  accentColor = '#FF6A00',
  textColor,
  textPrimary,
  mutedColor,
  textSecondary,
  label = 'Tutorial',
  compact = false,
  height,
  contextName,
  onBeforeStart,
}) => {
  const [hovered, setHovered] = useState(false);
  const [pressed, setPressed] = useState(false);

  const effectiveDark = isEffectiveDark ?? isDark ?? true;
  const resolvedHeight = height ?? (compact ? 24 : 28);
  const resolvedTextColor = textColor || textPrimary || (effectiveDark ? '#f4f4f6' : '#0f172a');
  const resolvedMutedColor = mutedColor || textSecondary || (effectiveDark ? '#9898a0' : '#64748b');

  const idleBg = compact
    ? 'transparent'
    : effectiveDark
    ? 'rgba(255, 255, 255, 0.05)'
    : 'rgba(0, 0, 0, 0.04)';
  const hoverBg = hexToRgba(accentColor, effectiveDark ? 0.14 : 0.1);

  const flowLabel = SCREEN_TUTORIAL_LABELS[contextId];

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    logSystemActivity('tutorial', 'acionar_botao_fluxo', contextName || flowLabel, {
      fluxo: contextId,
    });
    onBeforeStart?.();
    requestTutorialStart(contextId);
  };

  return (
    <button
      type="button"
      onMouseDown={(e) => {
        e.stopPropagation();
        setPressed(true);
      }}
      onMouseUp={() => setPressed(false)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => {
        setHovered(false);
        setPressed(false);
      }}
      onClick={handleClick}
      title={`Ver tutorial · ${flowLabel}`}
      aria-label={`Ver tutorial de ${flowLabel}`}
      style={{
        height: resolvedHeight,
        width: compact ? resolvedHeight : undefined,
        padding: compact ? 0 : '0 10px',
        borderRadius: 6,
        border: 'none',
        boxShadow: 'none',
        background: hovered ? hoverBg : idleBg,
        color: hovered ? accentColor : compact ? resolvedMutedColor : resolvedTextColor,
        fontSize: 11.5,
        fontWeight: 400,
        fontFamily: 'inherit',
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        flexShrink: 0,
        outline: 'none',
        transform: pressed ? 'scale(0.97)' : 'scale(1)',
        transition: 'background 0.15s ease, color 0.15s ease, transform 0.12s ease',
      }}
    >
      <Compass
        size={compact ? 13 : 12.5}
        strokeWidth={1.7}
        style={{
          color: accentColor,
          opacity: hovered ? 1 : 0.9,
          flexShrink: 0,
          transition: 'transform 0.18s ease, opacity 0.15s ease',
          transform: hovered ? 'rotate(18deg)' : 'rotate(0deg)',
        }}
      />
      {!compact && <span style={{ whiteSpace: 'nowrap', lineHeight: 1 }}>{label}</span>}
    </button>
  );
};
