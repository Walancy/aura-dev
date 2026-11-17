import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { popupColors } from './PopupPortal';

/** Tooltips próprios para o atributo `title` (o nativo não aparece em modais/sheets por cima do app). Enquanto montado, mostra o title de qualquer elemento sob o mouse. */
export const TitleTooltips: React.FC<{ isDark: boolean }> = ({ isDark }) => {
  const [tip, setTip] = useState<{ text: string; rect: DOMRect } | null>(null);
  const colors = popupColors(isDark);
  const boxRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);

  // depois de medir o tooltip, empurra para dentro da janela se passou da borda
  useLayoutEffect(() => {
    if (!tip || !boxRef.current) return;
    const r = boxRef.current.getBoundingClientRect();
    const m = 8;
    const left = r.left - shift;
    const right = r.right - shift;
    setShift(left < m ? m - left : right > window.innerWidth - m ? window.innerWidth - m - right : 0);
  }, [tip]);

  useEffect(() => {
    let current: HTMLElement | null = null;
    const hide = () => {
      if (current) {
        const t = current.getAttribute('data-tip');
        if (t && !current.getAttribute('title')) current.setAttribute('title', t);
        current.removeAttribute('data-tip');
      }
      current = null;
      setTip(null);
    };
    const over = (e: MouseEvent) => {
      const el = (e.target as HTMLElement | null)?.closest?.('[title],[data-tip]') as HTMLElement | null;
      if (el === current) return;
      hide();
      if (!el) return;
      const text = el.getAttribute('title') || el.getAttribute('data-tip');
      if (!text) return;
      // tira o title para o tooltip nativo não aparecer junto
      el.setAttribute('data-tip', text);
      el.removeAttribute('title');
      current = el;
      setTip({ text, rect: el.getBoundingClientRect() });
    };
    document.addEventListener('mouseover', over);
    document.addEventListener('mousedown', hide);
    return () => {
      document.removeEventListener('mouseover', over);
      document.removeEventListener('mousedown', hide);
      hide();
    };
  }, []);

  if (!tip) return null;
  const below = tip.rect.top < 48;
  const left = tip.rect.left + tip.rect.width / 2;
  return createPortal(
    <div
      ref={boxRef}
      className="df-opacity-enter"
      style={{
        position: 'fixed',
        left,
        top: below ? tip.rect.bottom + 6 : tip.rect.top - 6,
        transform: `translate(calc(-50% + ${shift}px), ${below ? '0' : '-100%'})`,
        width: 'max-content',
        maxWidth: 'min(420px, calc(100vw - 16px))',
        padding: '5px 8px',
        borderRadius: 5,
        background: colors.bg,
        color: colors.text,
        fontSize: 11.5,
        lineHeight: 1.4,
        fontFamily: 'Poppins, sans-serif',
        zIndex: 2000000,
        pointerEvents: 'none',
      }}
    >
      {tip.text}
    </div>,
    document.body,
  );
};
