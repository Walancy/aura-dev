import React, { useState } from 'react';
import { Info, HelpCircle, AlertTriangle, AlertCircle, Lightbulb, Check, ArrowRight } from 'lucide-react';

export interface InteractiveQuestionData {
  question: string;
  options: string[];
  isMultiSelect?: boolean;
}

export interface InteractiveQuestionCardProps {
  data: InteractiveQuestionData;
  onAnswer: (selected: string[], writeIn?: string) => void;
  onSkip?: () => void;
  accentColor: string;
  themeTokens: any;
  isEffectiveDark: boolean;
}

export const InteractiveQuestionCard: React.FC<InteractiveQuestionCardProps> = ({
  data,
  onAnswer,
  onSkip,
  accentColor,
  themeTokens,
  isEffectiveDark,
}) => {
  const [selectedOptions, setSelectedOptions] = useState<string[]>([]);
  const [writeIn, setWriteIn] = useState('');
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const toggleOption = (opt: string) => {
    if (hasSubmitted) return;
    if (data.isMultiSelect) {
      setSelectedOptions((prev) =>
        prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]
      );
    } else {
      setSelectedOptions([opt]);
    }
  };

  const handleSubmit = () => {
    if (hasSubmitted) return;
    setHasSubmitted(true);
    onAnswer(selectedOptions, writeIn.trim() || undefined);
  };

  const handleSkip = () => {
    if (hasSubmitted) return;
    setHasSubmitted(true);
    if (onSkip) {
      onSkip();
    } else {
      onAnswer([], undefined);
    }
  };

  const bgSurface = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
  const divider = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 12,
        gap: 12,
        borderRadius: 8,
        background: bgSurface,
        border: 'none',
        boxShadow: 'none',
        marginTop: 6,
        marginBottom: 6,
        width: '100%',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <HelpCircle size={15} color={accentColor} />
        <span style={{ fontSize: 12.5, fontWeight: 500, color: themeTokens.textPrimary }}>
          {data.question}
        </span>
      </div>

      <div style={{ height: 1, background: divider, width: '100%' }} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {(data?.options || []).map((opt) => {
          const isSelected = selectedOptions.includes(opt);
          return (
            <div
              key={opt}
              onClick={() => toggleOption(opt)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 6,
                background: isSelected
                  ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')
                  : 'transparent',
                cursor: hasSubmitted ? 'default' : 'pointer',
                transition: 'background 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSelected && !hasSubmitted) {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)';
                }
              }}
              onMouseLeave={(e) => {
                if (!isSelected && !hasSubmitted) {
                  e.currentTarget.style.background = 'transparent';
                }
              }}
            >
              <div
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: data.isMultiSelect ? 3 : 7,
                  background: isSelected ? accentColor : (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'),
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  transition: 'background 0.15s ease',
                }}
              >
                {isSelected && <Check size={10} color="#ffffff" />}
              </div>
              <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                {opt}
              </span>
            </div>
          );
        })}
      </div>

      {!hasSubmitted && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            placeholder="Outra observação ou resposta..."
            value={writeIn}
            onChange={(e) => setWriteIn(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleSubmit();
              }
            }}
            style={{
              height: 26,
              padding: '0 8px',
              borderRadius: 4,
              border: 'none',
              background: isEffectiveDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(255, 255, 255, 0.8)',
              color: themeTokens.textPrimary,
              fontSize: 11.5,
              outline: 'none',
              width: '100%',
              boxSizing: 'border-box',
            }}
          />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
            {onSkip && (
              <button
                type="button"
                onClick={handleSkip}
                style={{
                  height: 26,
                  padding: '0 10px',
                  borderRadius: 4,
                  border: 'none',
                  background: 'transparent',
                  color: themeTokens.textSecondary,
                  fontSize: 11.5,
                  fontWeight: 400,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
              >
                Pular
              </button>
            )}
            <button
              type="button"
              disabled={selectedOptions.length === 0 && !writeIn.trim()}
              onClick={handleSubmit}
              style={{
                height: 26,
                padding: '0 12px',
                borderRadius: 4,
                border: 'none',
                background: selectedOptions.length > 0 || writeIn.trim() ? accentColor : (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'),
                color: selectedOptions.length > 0 || writeIn.trim() ? '#ffffff' : themeTokens.textSecondary,
                fontSize: 11.5,
                fontWeight: 500,
                cursor: selectedOptions.length > 0 || writeIn.trim() ? 'pointer' : 'default',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <span>Confirmar</span>
              <ArrowRight size={11} />
            </button>
          </div>
        </div>
      )}

      {hasSubmitted && (
        <div style={{ fontSize: 11, color: themeTokens.textSecondary, opacity: 0.8 }}>
          Resposta enviada: {selectedOptions.join(', ')} {writeIn ? `("${writeIn}")` : ''}
        </div>
      )}
    </div>
  );
};

export interface AlertCalloutProps {
  type: 'note' | 'tip' | 'important' | 'warning' | 'caution';
  content: string;
  isEffectiveDark: boolean;
  themeTokens: any;
}

export const AlertCallout: React.FC<AlertCalloutProps> = ({
  type,
  content,
  isEffectiveDark,
  themeTokens,
}) => {
  const configs = {
    note: { label: 'Nota', color: '#38bdf8', icon: Info },
    tip: { label: 'Dica', color: '#4ade80', icon: Lightbulb },
    important: { label: 'Importante', color: '#a855f7', icon: AlertCircle },
    warning: { label: 'Aviso', color: '#f59e0b', icon: AlertTriangle },
    caution: { label: 'Cuidado', color: '#ef4444', icon: AlertTriangle },
  };

  const current = configs[type] || configs.note;
  const Icon = current.icon;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: 10,
        gap: 6,
        borderRadius: 6,
        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
        borderLeft: `2px solid ${current.color}`,
        borderTop: 'none',
        borderRight: 'none',
        borderBottom: 'none',
        boxShadow: 'none',
        marginTop: 6,
        marginBottom: 6,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Icon size={13} color={current.color} />
        <span style={{ fontSize: 11.5, fontWeight: 500, color: current.color }}>
          {current.label}
        </span>
      </div>
      <div style={{ fontSize: 12, color: themeTokens.textPrimary, lineHeight: '18px', fontWeight: 400 }}>
        {content}
      </div>
    </div>
  );
};
