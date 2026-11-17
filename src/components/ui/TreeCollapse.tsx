import React, { useEffect, useState } from 'react';
import { hexToRgba } from '../../utils/color';

// Filhos de uma pasta do explorador: expande/contrai suavemente e desenha a linha-guia na cor de destaque (mais fraca a cada nível)
const DURATION = 200;

export const TreeCollapse: React.FC<{ open: boolean; depth: number; accentColor: string; children: React.ReactNode } & Pick<React.HTMLAttributes<HTMLDivElement>, 'onDragOver' | 'onDrop'>> = ({ open, depth, accentColor, children, onDragOver, onDrop }) => {
  const [mounted, setMounted] = useState(open);
  const [shown, setShown] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
      return () => cancelAnimationFrame(raf);
    }
    setShown(false);
    const t = window.setTimeout(() => setMounted(false), DURATION);
    return () => window.clearTimeout(t);
  }, [open]);

  if (!mounted) return null;
  const alpha = Math.max(0.14, 0.55 - depth * 0.13);
  return (
    <div
      onDragOver={onDragOver}
      onDrop={onDrop}
      style={{
        display: 'grid',
        gridTemplateRows: shown ? '1fr' : '0fr',
        opacity: shown ? 1 : 0,
        transition: `grid-template-rows ${DURATION}ms var(--ease-out), opacity ${DURATION}ms var(--ease-out)`,
        width: '100%',
      }}
    >
      <div style={{ overflow: 'hidden', minHeight: 0 }}>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <div style={{ position: 'absolute', left: depth * 12 + 10, top: 0, bottom: 0, width: 1, background: hexToRgba(accentColor, alpha), pointerEvents: 'none' }} />
          {children}
        </div>
      </div>
    </div>
  );
};
