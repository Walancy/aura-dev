import React, { useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';

// Cores de popup neutras (sem tom azulado) e com contraste claro contra os cards
export const popupColors = (isDark: boolean) => ({
  bg: isDark ? '#2a2a2a' : '#ffffff',
  field: isDark ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.05)',
  hover: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
  text: isDark ? '#f2f2f2' : '#171717',
  sub: isDark ? '#a3a3a3' : '#737373',
  line: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)',
});

interface Props {
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  width?: number;
  align?: 'left' | 'right';
  maxHeight?: number;
  isDark: boolean;
  children: React.ReactNode;
}

// Popup ancorado a um elemento, renderizado no body: não é cortado por overflow de cards nem fica atrás de outros componentes.
// Abre para baixo e vira para cima quando falta espaço; sempre fica dentro da janela.
export const PopupPortal: React.FC<Props> = ({ anchor, open, onClose, width = 260, align = 'left', maxHeight = 340, isDark, children }) => {
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number; maxH: number } | null>(null);
  const colors = popupColors(isDark);

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPos(null);
      return;
    }
    const place = () => {
      const r = anchor.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const w = Math.min(width, vw - 16);
      const left = Math.max(8, Math.min(align === 'right' ? r.right - w : r.left, vw - w - 8));
      const below = vh - r.bottom - 12;
      const above = r.top - 12;
      if (below >= Math.min(maxHeight, 240) || below >= above) setPos({ left, top: r.bottom + 6, maxH: Math.max(140, Math.min(maxHeight, below - 6)) });
      else setPos({ left, bottom: vh - r.top + 6, maxH: Math.max(140, Math.min(maxHeight, above - 6)) });
    };
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [open, anchor, width, align, maxHeight]);

  if (!open || !anchor || !pos) return null;
  return createPortal(
    <>
      <div style={{ position: 'fixed', inset: 0, zIndex: 100000 }} onMouseDown={onClose} />
      <div
        className="df-dropdown-menu"
        style={{ position: 'fixed', left: pos.left, top: pos.top, bottom: pos.bottom, width: Math.min(width, window.innerWidth - 16), maxHeight: pos.maxH, zIndex: 100001, background: colors.bg, color: colors.text, borderRadius: 10, padding: 6, display: 'flex', flexDirection: 'column', gap: 4, overflow: 'hidden', boxSizing: 'border-box' }}
        onMouseDown={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body,
  );
};
