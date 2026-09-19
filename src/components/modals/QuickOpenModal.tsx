import React from 'react';
import { hexToRgba } from '../../utils/color';
import { KbdBadge } from '../icons/MiscIcons';
import type { ThemeTokens, QuickOpenItemDef } from '../../types/ide';

export interface QuickOpenModalProps {
  onClose: () => void;
  quickInputPosition: 'top' | 'center';
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  containerRef: React.RefObject<HTMLDivElement | null>;
  inputRef: React.RefObject<HTMLInputElement | null>;
  quickOpenQuery: string;
  setQuickOpenQuery: (value: string) => void;
  setQuickOpenSelectedIndex: (value: number) => void;
  quickOpenSelectedIndex: number;
  onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  visibleQuickOpenItems: QuickOpenItemDef[];
}

// Command palette / "Go to File" modal (VS Code ⌘P style).
export const QuickOpenModal: React.FC<QuickOpenModalProps> = ({
  onClose,
  quickInputPosition,
  themeTokens,
  isEffectiveDark,
  accentColor,
  containerRef,
  inputRef,
  quickOpenQuery,
  setQuickOpenQuery,
  setQuickOpenSelectedIndex,
  quickOpenSelectedIndex,
  onKeyDown,
  visibleQuickOpenItems,
}) => {
  return (
    <>
      {/* Click-outside transparent/dim backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          zIndex: 999998,
          backdropFilter: 'blur(3px)',
          animation: 'fadeIn 0.12s ease-out',
        }}
      />

      {/* Quick Open Floating Box */}
      <div
        ref={containerRef}
        style={{
          position: 'fixed',
          top: quickInputPosition === 'top' ? 46 : '12%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 620,
          maxWidth: 'calc(100vw - 32px)',
          background: themeTokens.bgCard,
          border: `1px solid ${themeTokens.border}`,
          borderRadius: 10,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          boxSizing: 'border-box',
          animation: 'fadeIn 0.12s ease-out',
          fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
      >
        {/* Top Input Bar */}
        <div style={{ padding: '12px 14px 8px 14px', background: themeTokens.bgCard }}>
          <input
            ref={inputRef}
            type="text"
            value={quickOpenQuery}
            onChange={(e) => {
              setQuickOpenQuery(e.target.value);
              setQuickOpenSelectedIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search files by name (append : to go to line or @ to go to symbol)"
            style={{
              width: '100%',
              boxSizing: 'border-box',
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
              border: `1.5px solid ${accentColor}`,
              borderRadius: 8,
              padding: '8px 12px',
              color: themeTokens.textPrimary,
              fontSize: 13,
              fontFamily: 'Poppins, sans-serif',
              outline: 'none',
              boxShadow: `0 0 0 1px ${hexToRgba(accentColor, 0.25)}`,
            }}
          />
        </div>

        {/* Items List */}
        <div
          style={{
            maxHeight: 380,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            padding: '4px 6px 10px 6px',
          }}
        >
          {visibleQuickOpenItems.length === 0 ? (
            <div style={{ padding: '24px 16px', color: themeTokens.textSecondary, fontSize: 12.5, textAlign: 'center' }}>
              Nenhum arquivo ou comando correspondente encontrado
            </div>
          ) : (
            visibleQuickOpenItems.map((item, idx) => {
              const isSelected = idx === quickOpenSelectedIndex;
              return (
                <React.Fragment key={item.id}>
                  {item.isDividerBefore && (
                    <div
                      style={{
                        height: 1,
                        background: themeTokens.border,
                        margin: '4px 6px',
                      }}
                    />
                  )}
                  <div
                    onClick={() => item.onSelect()}
                    onMouseEnter={() => setQuickOpenSelectedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '4px 8px',
                      borderRadius: 6,
                      cursor: 'pointer',
                      background: isSelected ? hexToRgba(accentColor, 0.18) : 'transparent',
                      color: isSelected ? accentColor : themeTokens.textPrimary,
                      fontSize: 13,
                      minHeight: 26,
                      transition: 'background 0.08s ease',
                    }}
                  >
                    {/* Left side: Icon + Title + Suffix + Subtitle */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                      {item.icon && <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{item.icon}</div>}
                      <span
                        style={{
                          fontWeight: isSelected ? 500 : 400,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          color: isSelected ? accentColor : themeTokens.textPrimary,
                        }}
                      >
                        {item.title}
                      </span>
                      {item.suffix && (
                        <span style={{ color: themeTokens.textSecondary, fontSize: 12, marginLeft: 2 }}>{item.suffix}</span>
                      )}
                      {item.subtitle && (
                        <span style={{ color: themeTokens.textSecondary, fontSize: 11.5, marginLeft: 6, whiteSpace: 'nowrap' }}>
                          {item.subtitle}
                        </span>
                      )}
                    </div>

                    {/* Right side: Badges or Category label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 12 }}>
                      {item.badgeText && (
                        <span style={{ color: item.badgeTextColor || accentColor, fontSize: 12, fontFamily: 'sans-serif' }}>
                          {item.badgeText}
                        </span>
                      )}
                      {item.badges && item.badges.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                          {item.badges.map((b, bIdx) => (
                            <KbdBadge key={bIdx}>{b}</KbdBadge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </React.Fragment>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
