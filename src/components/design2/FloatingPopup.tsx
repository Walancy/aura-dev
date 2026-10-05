import React, { useRef, useState } from 'react';

interface Props {
  title: string;
  tokens: Record<string, any>;
  onClose: () => void;
  width?: number;
  height?: number | string;
  /** posição inicial; padrão: canto direito superior */
  initial?: { x: number; y: number };
  children: React.ReactNode;
}

/** Popup que o usuário arrasta pelo canvas (sem fundo bloqueando). */
export default function FloatingPopup({ title, tokens, onClose, width = 340, height = 420, initial, children }: Props) {
  const [pos, setPos] = useState(() => initial || { x: Math.max(16, window.innerWidth - width - 60), y: 90 });
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  return (
    <div style={{ position: 'fixed', left: pos.x, top: pos.y, zIndex: 100000, width, height, background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: 12, boxShadow: '0 12px 40px rgba(0,0,0,0.45)', display: 'flex', flexDirection: 'column', color: tokens.textPrimary, fontFamily: "'Poppins', sans-serif" }}>
      <div
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest('input,button')) return;
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => drag.current && setPos({ x: Math.min(window.innerWidth - 80, Math.max(0, e.clientX - drag.current.dx)), y: Math.min(window.innerHeight - 40, Math.max(0, e.clientY - drag.current.dy)) })}
        onPointerUp={() => (drag.current = null)}
        style={{ cursor: 'grab', padding: '8px 12px 0', fontSize: 11, color: tokens.textSecondary, userSelect: 'none', display: 'flex', alignItems: 'center' }}
      >
        <span style={{ flex: 1 }}>{title} · arraste para mover</span>
        <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: tokens.textSecondary, cursor: 'pointer', fontSize: 16 }}>×</button>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, minHeight: 0 }}>{children}</div>
    </div>
  );
}
