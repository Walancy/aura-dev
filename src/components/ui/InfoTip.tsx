import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';
import { popupColors } from './PopupPortal';

// Ícone "i" com tooltip próprio (o title nativo não aparece dentro de menus/popups do app). Renderiza no body, ao lado do ícone.
export const InfoTip: React.FC<{ text: string; isDark: boolean; size?: number; width?: number }> = ({ text, isDark, size = 12, width = 250 }) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const colors = popupColors(isDark);
  const left = rect ? Math.min(rect.right + 8, window.innerWidth - width - 8) : 0;
  return (
    <>
      <span
        onMouseEnter={(e) => setRect(e.currentTarget.getBoundingClientRect())}
        onMouseLeave={() => setRect(null)}
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'inline-flex', cursor: 'help' }}
      >
        <Info size={size} color={colors.sub} style={{ opacity: rect ? 1 : 0.7, transition: 'opacity 120ms ease' }} />
      </span>
      {rect &&
        createPortal(
          <div
            className="df-opacity-enter"
            style={{
              position: 'fixed',
              left,
              top: Math.max(8, Math.min(rect.top - 4, window.innerHeight - 220)),
              width,
              zIndex: 2000000,
              padding: '8px 10px',
              borderRadius: 8,
              background: colors.bg,
              color: colors.text,
              fontSize: 11.5,
              lineHeight: 1.5,
              whiteSpace: 'pre-line',
              pointerEvents: 'none',
            }}
          >
            {text}
          </div>,
          document.body,
        )}
    </>
  );
};
