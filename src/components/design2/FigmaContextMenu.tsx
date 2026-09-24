import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import type { Shape, Page } from './types';

export interface FigmaContextMenuProps {
  isOpen: boolean;
  x: number;
  y: number;
  targetShape: Shape | null;
  shapes: Shape[];
  pages: Page[];
  clipboardShape: Shape | null;
  copiedProperties: Partial<Shape> | null;
  themeTokens?: any;
  accentColor?: string;
  isEffectiveDark?: boolean;
  onClose: () => void;
  onCopy: (shape: Shape) => void;
  onPaste: (coords?: { x: number; y: number }) => void;
  onPasteToReplace: (targetShape: Shape) => void;
  onCopyAs: (format: 'svg' | 'png' | 'css') => void;
  onCopyProperties: (shape: Shape) => void;
  onPasteProperties: (shape: Shape) => void;
  onBringToFront: (shape: Shape) => void;
  onSendToBack: (shape: Shape) => void;
  onGroupSelection: (shape: Shape) => void;
  onFrameSelection: (shape: Shape) => void;
  onFlatten: (shape: Shape) => void;
  onOutlineStroke: (shape: Shape) => void;
  onToggleMask: (shape: Shape) => void;
  onAddAutoLayout: (shape: Shape) => void;
  onCreateComponent: (shape: Shape) => void;
  onToggleVisibility: (shape: Shape) => void;
  onToggleLock: (shape: Shape) => void;
  onFlipHorizontal: (shape: Shape) => void;
  onFlipVertical: (shape: Shape) => void;
  onMoveToPage: (shape: Shape, pageId: string) => void;
  onSelectAll: () => void;
  onSelectChildren?: (shape: Shape) => void;
  onSelectParent?: (shape: Shape) => void;
  onRequestDelete: (shape: Shape) => void;
}

export default function FigmaContextMenu({
  isOpen,
  x,
  y,
  targetShape,
  shapes,
  pages,
  clipboardShape,
  copiedProperties,
  themeTokens,
  accentColor = '#f97316',
  isEffectiveDark = true,
  onClose,
  onCopy,
  onPaste,
  onPasteToReplace,
  onCopyAs,
  onCopyProperties,
  onPasteProperties,
  onBringToFront,
  onSendToBack,
  onGroupSelection,
  onFrameSelection,
  onFlatten,
  onOutlineStroke,
  onToggleMask,
  onAddAutoLayout,
  onCreateComponent,
  onToggleVisibility,
  onToggleLock,
  onFlipHorizontal,
  onFlipVertical,
  onMoveToPage,
  onSelectAll,
  onSelectChildren,
  onSelectParent,
  onRequestDelete,
}: FigmaContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [activeSubmenu, setActiveSubmenu] = useState<string | null>(null);

  // Close on outside click or Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('mousedown', handleDown);
    window.addEventListener('keydown', handleKey);
    return () => {
      window.removeEventListener('mousedown', handleDown);
      window.removeEventListener('keydown', handleKey);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Viewport bounds calculation to keep menu on screen
  const menuWidth = 230;
  const menuHeight = 520;
  const posX = Math.max(10, Math.min(x, window.innerWidth - menuWidth - 20));
  const posY = Math.max(10, Math.min(y, window.innerHeight - menuHeight - 20));

  const bgMenu = isEffectiveDark ? '#1a1a1a' : '#ffffff';
  const textPrimary = isEffectiveDark ? '#f1f1f1' : '#1e293b';
  const textMuted = isEffectiveDark ? '#7a7a7a' : '#94a3b8';
  const hoverBg = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
  const dividerBg = isEffectiveDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)';

  const renderItem = (
    label: string,
    shortcut?: string,
    action?: () => void,
    disabled = false,
    submenuId?: string,
    submenuContent?: React.ReactNode
  ) => {
    const isSubmenuOpen = activeSubmenu === submenuId;

    return (
      <div
        key={label}
        style={{ position: 'relative' }}
        onMouseEnter={() => {
          if (submenuId) setActiveSubmenu(submenuId);
          else setActiveSubmenu(null);
        }}
      >
        <div
          onClick={() => {
            if (disabled) return;
            if (action) {
              action();
              onClose();
            }
          }}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '5px 12px',
            borderRadius: 5,
            fontSize: 12,
            fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
            color: disabled ? textMuted : textPrimary,
            cursor: disabled ? 'default' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            userSelect: 'none',
            transition: 'background 0.1s ease',
            height: 27,
            boxSizing: 'border-box',
          }}
          onMouseEnter={(e) => {
            if (!disabled) e.currentTarget.style.background = hoverBg;
          }}
          onMouseLeave={(e) => {
            if (!disabled) e.currentTarget.style.background = 'transparent';
          }}
        >
          <span style={{ fontWeight: 400 }}>{label}</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {shortcut && (
              <span
                style={{
                  fontSize: 11,
                  color: textMuted,
                  letterSpacing: 0.5,
                  fontFamily: "'Poppins', monospace, sans-serif",
                }}
              >
                {shortcut}
              </span>
            )}
            {submenuId && <ChevronRight size={13} color={textMuted} />}
          </div>
        </div>

        {/* Submenu Flyout */}
        {submenuId && isSubmenuOpen && (
          <div
            style={{
              position: 'absolute',
              left: 'calc(100% - 2px)',
              top: -4,
              background: bgMenu,
              border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              borderRadius: 8,
              boxShadow: isEffectiveDark
                ? '0 10px 30px rgba(0, 0, 0, 0.7), 0 0 0 1px rgba(255, 255, 255, 0.05)'
                : '0 10px 25px rgba(0, 0, 0, 0.15)',
              padding: '4px',
              minWidth: 160,
              zIndex: 200,
            }}
          >
            {submenuContent}
          </div>
        )}
      </div>
    );
  };

  const renderDivider = (key: string) => (
    <div key={key} style={{ height: 1, background: dividerBg, margin: '4px 6px' }} />
  );

  return (
    <div
      ref={menuRef}
      style={{
        position: 'fixed',
        left: posX,
        top: posY,
        background: bgMenu,
        border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
        borderRadius: 9,
        boxShadow: isEffectiveDark
          ? '0 12px 36px rgba(0, 0, 0, 0.75), 0 2px 10px rgba(0, 0, 0, 0.5)'
          : '0 12px 30px rgba(0, 0, 0, 0.18)',
        padding: '5px 4px',
        width: menuWidth,
        zIndex: 1000,
        userSelect: 'none',
      }}
    >
      {/* =================================================================== */}
      {/* SEÇÃO 1: CLIPBOARD & MOTION                                         */}
      {/* =================================================================== */}
      {renderItem('Copy', '⌘C', () => targetShape && onCopy(targetShape), !targetShape)}
      {renderItem('Paste here', undefined, () => onPaste({ x, y }))}
      {renderItem(
        'Paste to replace',
        '⇧⌘R',
        () => targetShape && onPasteToReplace(targetShape),
        !targetShape || !clipboardShape
      )}

      {/* Copy/Paste as > */}
      {renderItem(
        'Copy/Paste as',
        undefined,
        undefined,
        !targetShape,
        'copy-paste-as',
        <>
          {renderItem('Copy as SVG', undefined, () => onCopyAs('svg'), !targetShape)}
          {renderItem('Copy as PNG', undefined, () => onCopyAs('png'), !targetShape)}
          {renderItem('Copy as CSS', undefined, () => onCopyAs('css'), !targetShape)}
          {renderDivider('div-copy-props')}
          {renderItem(
            'Copy properties',
            '⌥⌘C',
            () => targetShape && onCopyProperties(targetShape),
            !targetShape
          )}
          {renderItem(
            'Paste properties',
            '⌥⌘V',
            () => targetShape && onPasteProperties(targetShape),
            !targetShape || !copiedProperties
          )}
        </>
      )}

      {renderItem('Send to Figma Make', undefined, () => {})}
      {renderItem('Find similar designs', undefined, () => {})}

      {/* Add motion > */}
      {renderItem(
        'Add motion',
        undefined,
        undefined,
        !targetShape,
        'add-motion',
        <>
          {renderItem('Smart animate', undefined, () => {})}
          {renderItem('Dissolve', undefined, () => {})}
          {renderItem('Instant', undefined, () => {})}
          {renderItem('Push', undefined, () => {})}
          {renderItem('Slide in', undefined, () => {})}
        </>
      )}

      {renderDivider('div-1')}

      {/* =================================================================== */}
      {/* SEÇÃO 2: LAYER & ORDER                                              */}
      {/* =================================================================== */}
      {/* Select layer > */}
      {renderItem(
        'Select layer',
        undefined,
        undefined,
        false,
        'select-layer',
        <>
          {renderItem('Select all', '⌘A', onSelectAll)}
          {targetShape && targetShape.parentId && renderItem('Select parent', undefined, () => onSelectParent?.(targetShape))}
          {targetShape && targetShape.type === 'group' && renderItem('Select children', undefined, () => onSelectChildren?.(targetShape))}
        </>
      )}

      {/* Move to page > */}
      {renderItem(
        'Move to page',
        undefined,
        undefined,
        !targetShape || pages.length <= 1,
        'move-to-page',
        <>
          {pages.map((p) => (
            <div
              key={p.id}
              onClick={() => {
                if (targetShape) {
                  onMoveToPage(targetShape, p.id);
                  onClose();
                }
              }}
              style={{
                padding: '5px 12px',
                fontSize: 12,
                borderRadius: 5,
                color: textPrimary,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              {p.name}
            </div>
          ))}
        </>
      )}

      {renderItem('Bring to front', ']', () => targetShape && onBringToFront(targetShape), !targetShape)}
      {renderItem('Send to back', '[', () => targetShape && onSendToBack(targetShape), !targetShape)}

      {renderDivider('div-2')}

      {/* =================================================================== */}
      {/* SEÇÃO 3: GRUPO, FRAME & FORMAS                                      */}
      {/* =================================================================== */}
      {renderItem('Group selection', '⌘G', () => targetShape && onGroupSelection(targetShape), !targetShape)}
      {renderItem('Frame selection', '⌥⌘G', () => targetShape && onFrameSelection(targetShape), !targetShape)}
      {renderItem('Flatten', '⌥⇧F', () => targetShape && onFlatten(targetShape), !targetShape)}
      {renderItem('Outline stroke', '⌥⌘O', () => targetShape && onOutlineStroke(targetShape), !targetShape)}
      {renderItem(
        targetShape?.isMask ? 'Remove mask' : 'Use as mask',
        '^⌘M',
        () => targetShape && onToggleMask(targetShape),
        !targetShape
      )}

      {renderDivider('div-3')}

      {/* =================================================================== */}
      {/* SEÇÃO 4: AUTO LAYOUT & COMPONENTES                                  */}
      {/* =================================================================== */}
      {renderItem(
        targetShape?.hasAutoLayout ? 'Remove auto layout' : 'Add auto layout',
        '⇧A',
        () => targetShape && onAddAutoLayout(targetShape),
        !targetShape
      )}
      {renderItem(
        targetShape?.isComponent ? 'Detach component' : 'Create component',
        '⌥⌘K',
        () => targetShape && onCreateComponent(targetShape),
        !targetShape
      )}

      {/* Plugins > */}
      {renderItem(
        'Plugins',
        undefined,
        undefined,
        false,
        'plugins',
        <>
          {renderItem('Gerador de Paleta IA', undefined, () => {})}
          {renderItem('Auto Ícones & Vetores', undefined, () => {})}
          {renderDivider('div-plugins')}
          {renderItem('Gerenciar plugins...', undefined, () => {})}
        </>
      )}

      {/* Widgets > */}
      {renderItem(
        'Widgets',
        undefined,
        undefined,
        false,
        'widgets',
        <>
          {renderItem('Post-it & Anotações', undefined, () => {})}
          {renderItem('Checklist de Sprint', undefined, () => {})}
          {renderDivider('div-widgets')}
          {renderItem('Explorar widgets...', undefined, () => {})}
        </>
      )}

      {renderDivider('div-4')}

      {/* =================================================================== */}
      {/* SEÇÃO 5: VISIBILIDADE & BLOQUEIO                                    */}
      {/* =================================================================== */}
      {renderItem(
        targetShape?.visible === false ? 'Show' : 'Show/Hide',
        '⇧⌘H',
        () => targetShape && onToggleVisibility(targetShape),
        !targetShape
      )}
      {renderItem(
        targetShape?.locked ? 'Unlock' : 'Lock/Unlock',
        '⇧⌘L',
        () => targetShape && onToggleLock(targetShape),
        !targetShape
      )}

      {renderDivider('div-5')}

      {/* =================================================================== */}
      {/* SEÇÃO 6: TRANSFORMAÇÕES                                             */}
      {/* =================================================================== */}
      {renderItem('Flip horizontal', '⇧H', () => targetShape && onFlipHorizontal(targetShape), !targetShape)}
      {renderItem('Flip vertical', '⇧V', () => targetShape && onFlipVertical(targetShape), !targetShape)}

      {/* =================================================================== */}
      {/* SEÇÃO 7: EXCLUIR (COM CONFIRM DELETE MODAL)                         */}
      {/* =================================================================== */}
      {targetShape && (
        <>
          {renderDivider('div-del')}
          <div
            onClick={() => {
              onRequestDelete(targetShape);
              onClose();
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '5px 12px',
              borderRadius: 5,
              fontSize: 12,
              fontFamily: "'Poppins', -apple-system, BlinkMacSystemFont, sans-serif",
              color: '#ef4444',
              cursor: 'pointer',
              userSelect: 'none',
              transition: 'background 0.1s ease',
              height: 27,
              boxSizing: 'border-box',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.08)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <span style={{ fontWeight: 500 }}>Excluir</span>
            <span style={{ fontSize: 11, color: '#ef4444', opacity: 0.8 }}>⌫</span>
          </div>
        </>
      )}
    </div>
  );
}
