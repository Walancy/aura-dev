import React from 'react';
import { RotateCcw, X, Check, Eye, PanelLeft, PanelRight, PanelBottom, Scan, Disc, Columns } from 'lucide-react';
import { hexToRgba } from '../../utils/color';
import type { ThemeTokens } from '../../types/ide';

export interface CustomizeLayoutPopupProps {
  themeTokens: ThemeTokens;
  accentColor: string;
  onClose: () => void;
  onReset: () => void;

  showActivityBar: boolean;
  setShowActivityBar: (value: boolean) => void;
  showExplorer: boolean;
  setShowExplorer: (value: boolean) => void;
  showAiPanel: boolean;
  setShowAiPanel: (value: boolean) => void;
  isTerminalCollapsed: boolean;
  setIsTerminalCollapsed: (value: boolean) => void;
  showStatusBar: boolean;
  setShowStatusBar: (value: boolean) => void;

  sidebarPosition: 'left' | 'right';
  setSidebarPosition: (value: 'left' | 'right') => void;

  panelAlignment: 'left' | 'right' | 'center' | 'justify';
  setPanelAlignment: (value: 'left' | 'right' | 'center' | 'justify') => void;

  quickInputPosition: 'top' | 'center';
  setQuickInputPosition: (value: 'top' | 'center') => void;

  onToggleFullscreen: () => void;
  onToggleZenMode: () => void;
  isZenMode: boolean;

  isCenteredLayout: boolean;
  setIsCenteredLayout: (value: boolean) => void;
}

// Dropdown anchored under the "Customize Layout" toolbar button (VS Code / Antigravity style).
// Rendered in-place inside a `position: relative` parent, so it keeps working as a
// `position: absolute` popup after extraction.
export const CustomizeLayoutPopup: React.FC<CustomizeLayoutPopupProps> = ({
  themeTokens,
  accentColor,
  onClose,
  onReset,
  showActivityBar,
  setShowActivityBar,
  showExplorer,
  setShowExplorer,
  showAiPanel,
  setShowAiPanel,
  isTerminalCollapsed,
  setIsTerminalCollapsed,
  showStatusBar,
  setShowStatusBar,
  sidebarPosition,
  setSidebarPosition,
  panelAlignment,
  setPanelAlignment,
  quickInputPosition,
  setQuickInputPosition,
  onToggleFullscreen,
  onToggleZenMode,
  isZenMode,
  isCenteredLayout,
  setIsCenteredLayout,
}) => {
  return (
    <div
      style={{
        position: 'absolute',
        top: 38,
        right: 0,
        width: 340,
        background: themeTokens.bgCardSecondary,
        borderRadius: 10,
        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
        border: '1px solid ' + themeTokens.border,
        display: 'flex',
        flexDirection: 'column',
        zIndex: 99999,
        overflow: 'hidden',
        fontFamily: 'Poppins, -apple-system, sans-serif',
        userSelect: 'none',
        maxHeight: '80vh',
        overflowY: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderBottom: '1px solid ' + themeTokens.border,
          background: themeTokens.bgCard,
        }}
      >
        <span style={{ fontSize: 12, fontWeight: 500, color: themeTokens.textPrimary }}>
          Customize Layout
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={onReset}
            title="Restaurar Layout Padrão"
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
            onClick={onClose}
            title="Fechar"
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
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Content Rows */}
      <div style={{ padding: '6px 4px', display: 'flex', flexDirection: 'column', gap: 1 }}>
        {/* --- Section 1: Visibility --- */}
        {/* Activity Bar */}
        <div
          onClick={() => setShowActivityBar(!showActivityBar)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                border: showActivityBar ? `1px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                background: showActivityBar ? accentColor : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {showActivityBar && <Check size={10} color="#ffffff" strokeWidth={3} />}
            </div>
            <span>Activity Bar</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: accentColor, fontSize: 10.5, fontWeight: 500 }}>
            <Eye size={12} />
            <span>Visibility</span>
          </div>
        </div>

        {/* Secondary Activity Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'default',
            fontSize: 11.5,
            color: themeTokens.textMuted,
            background: 'transparent',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${themeTokens.border}` }} />
            <span>Secondary Activity Bar</span>
          </div>
        </div>

        {/* Primary Side Bar */}
        <div
          onClick={() => setShowExplorer(!showExplorer)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                border: showExplorer ? `1px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                background: showExplorer ? accentColor : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {showExplorer && <Check size={10} color="#ffffff" strokeWidth={3} />}
            </div>
            <span>Primary Side Bar</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>⌘</span>
            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>B</span>
          </div>
        </div>

        {/* Secondary Side Bar */}
        <div
          onClick={() => setShowAiPanel(!showAiPanel)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                border: showAiPanel ? `1px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                background: showAiPanel ? accentColor : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {showAiPanel && <Check size={10} color="#ffffff" strokeWidth={3} />}
            </div>
            <span>Secondary Side Bar</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>⌘</span>
            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>⇧</span>
            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>A</span>
          </div>
        </div>

        {/* Panel */}
        <div
          onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                border: !isTerminalCollapsed ? `1px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                background: !isTerminalCollapsed ? accentColor : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {!isTerminalCollapsed && <Check size={10} color="#ffffff" strokeWidth={3} />}
            </div>
            <span>Panel</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>⌘</span>
            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>J</span>
          </div>
        </div>

        {/* Status Bar */}
        <div
          onClick={() => setShowStatusBar(!showStatusBar)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                width: 14,
                height: 14,
                borderRadius: 3,
                border: showStatusBar ? `1px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                background: showStatusBar ? accentColor : 'transparent',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {showStatusBar && <Check size={10} color="#ffffff" strokeWidth={3} />}
            </div>
            <span>Status Bar</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />

        {/* --- Section 2: Primary Side Bar Position --- */}
        {/* Left */}
        <div
          onClick={() => setSidebarPosition('left')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: sidebarPosition === 'left' ? hexToRgba(accentColor, 0.1) : 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = sidebarPosition === 'left' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = sidebarPosition === 'left' ? hexToRgba(accentColor, 0.1) : 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PanelLeft size={14} color={sidebarPosition === 'left' ? accentColor : themeTokens.textSecondary} />
            <span>Left {sidebarPosition === 'left' ? '✓' : ''}</span>
          </div>
          <span style={{ color: accentColor, fontSize: 10.5, fontWeight: 500 }}>
            Primary Side Bar Position
          </span>
        </div>

        {/* Right */}
        <div
          onClick={() => setSidebarPosition('right')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: sidebarPosition === 'right' ? hexToRgba(accentColor, 0.1) : 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = sidebarPosition === 'right' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = sidebarPosition === 'right' ? hexToRgba(accentColor, 0.1) : 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PanelRight size={14} color={sidebarPosition === 'right' ? accentColor : themeTokens.textSecondary} />
            <span>Right {sidebarPosition === 'right' ? '✓' : ''}</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />

        {/* --- Section 3: Panel Alignment --- */}
        {/* Left */}
        <div
          onClick={() => setPanelAlignment('left')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: panelAlignment === 'left' ? hexToRgba(accentColor, 0.1) : 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = panelAlignment === 'left' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = panelAlignment === 'left' ? hexToRgba(accentColor, 0.1) : 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PanelBottom size={14} color={panelAlignment === 'left' ? accentColor : themeTokens.textSecondary} />
            <span>Left {panelAlignment === 'left' ? '✓' : ''}</span>
          </div>
          <span style={{ color: accentColor, fontSize: 10.5, fontWeight: 500 }}>
            Panel Alignment
          </span>
        </div>

        {/* Right */}
        <div
          onClick={() => setPanelAlignment('right')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: panelAlignment === 'right' ? hexToRgba(accentColor, 0.1) : 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = panelAlignment === 'right' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = panelAlignment === 'right' ? hexToRgba(accentColor, 0.1) : 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PanelBottom size={14} color={panelAlignment === 'right' ? accentColor : themeTokens.textSecondary} />
            <span>Right {panelAlignment === 'right' ? '✓' : ''}</span>
          </div>
        </div>

        {/* Center */}
        <div
          onClick={() => setPanelAlignment('center')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: panelAlignment === 'center' ? hexToRgba(accentColor, 0.1) : 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = panelAlignment === 'center' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = panelAlignment === 'center' ? hexToRgba(accentColor, 0.1) : 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PanelBottom size={14} color={panelAlignment === 'center' ? accentColor : themeTokens.textSecondary} />
            <span>Center {panelAlignment === 'center' ? '✓' : ''}</span>
          </div>
        </div>

        {/* Justify */}
        <div
          onClick={() => setPanelAlignment('justify')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: panelAlignment === 'justify' ? hexToRgba(accentColor, 0.1) : 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = panelAlignment === 'justify' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = panelAlignment === 'justify' ? hexToRgba(accentColor, 0.1) : 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <PanelBottom size={14} color={panelAlignment === 'justify' ? accentColor : themeTokens.textSecondary} />
            <span>Justify {panelAlignment === 'justify' ? '✓' : ''}</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />

        {/* --- Section 4: Quick Input Position --- */}
        {/* Top */}
        <div
          onClick={() => setQuickInputPosition('top')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: quickInputPosition === 'top' ? hexToRgba(accentColor, 0.1) : 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = quickInputPosition === 'top' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = quickInputPosition === 'top' ? hexToRgba(accentColor, 0.1) : 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: themeTokens.textSecondary }}>↑</span>
            <span>Top {quickInputPosition === 'top' ? '✓' : ''}</span>
          </div>
          <span style={{ color: accentColor, fontSize: 10.5, fontWeight: 500 }}>
            Quick Input Position
          </span>
        </div>

        {/* Center */}
        <div
          onClick={() => setQuickInputPosition('center')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: quickInputPosition === 'center' ? hexToRgba(accentColor, 0.1) : 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = quickInputPosition === 'center' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = quickInputPosition === 'center' ? hexToRgba(accentColor, 0.1) : 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 13, color: themeTokens.textSecondary }}>⚬</span>
            <span>Center {quickInputPosition === 'center' ? '✓' : ''}</span>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />

        {/* --- Section 5: Modes --- */}
        {/* Full Screen */}
        <div
          onClick={onToggleFullscreen}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Scan size={14} color={themeTokens.textSecondary} />
            <span>Full Screen</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ color: accentColor, fontSize: 10.5, fontWeight: 500 }}>Modes ⌃</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>⌘</span>
              <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>F</span>
            </div>
          </div>
        </div>

        {/* Zen Mode */}
        <div
          onClick={onToggleZenMode}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: isZenMode ? hexToRgba(accentColor, 0.1) : 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = isZenMode ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = isZenMode ? hexToRgba(accentColor, 0.1) : 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Disc size={14} color={isZenMode ? accentColor : themeTokens.textSecondary} />
            <span>Zen Mode {isZenMode ? '✓' : ''}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>⌘</span>
            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>K</span>
            <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>Z</span>
          </div>
        </div>

        {/* Centered Layout */}
        <div
          onClick={() => setIsCenteredLayout(!isCenteredLayout)}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 8px',
            borderRadius: 5,
            cursor: 'pointer',
            fontSize: 11.5,
            color: themeTokens.textPrimary,
            background: isCenteredLayout ? hexToRgba(accentColor, 0.1) : 'transparent',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = isCenteredLayout ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
          onMouseLeave={(e) => (e.currentTarget.style.background = isCenteredLayout ? hexToRgba(accentColor, 0.1) : 'transparent')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Columns size={14} color={isCenteredLayout ? accentColor : themeTokens.textSecondary} />
            <span>Centered Layout {isCenteredLayout ? '✓' : ''}</span>
          </div>
        </div>
      </div>
    </div>
  );
};
