import React, { useEffect, useState } from 'react';
import { Copy, Minus, Square, X } from 'lucide-react';

/** Minimizar, maximizar/restaurar e fechar da janela sem moldura (Windows): ficam na ponta direita da header, ao lado da foto do usuário. */
export const WindowControls: React.FC<{ isDark: boolean; textColor: string; hoverBg: string }> = ({ textColor, hoverBg }) => {
  const [hovered, setHovered] = useState<'min' | 'max' | 'close' | null>(null);
  const [maximized, setMaximized] = useState(false);
  const api = window.electronAPI?.windowState;

  useEffect(() => {
    api?.isMaximized?.().then(setMaximized).catch(() => {});
    return api?.onMaximizedChange?.(setMaximized);
  }, [api]);

  const btn = (id: 'min' | 'max' | 'close', title: string, icon: React.ReactNode, onClick?: () => void) => {
    const isClose = id === 'close';
    const on = hovered === id;
    return (
      <div
        title={title}
        onClick={onClick}
        onMouseEnter={() => setHovered(id)}
        onMouseLeave={() => setHovered(null)}
        style={{
          width: 28,
          height: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 6,
          cursor: 'pointer',
          color: on && isClose ? '#ffffff' : textColor,
          background: on ? (isClose ? '#e5484d' : hoverBg) : 'transparent',
          transition: 'background 150ms var(--ease-out), color 150ms var(--ease-out)',
        }}
      >
        {icon}
      </div>
    );
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, WebkitAppRegion: 'no-drag' as any }}>
      {btn('min', 'Minimizar', <Minus size={16} />, () => api?.minimize?.())}
      {btn('max', maximized ? 'Restaurar' : 'Maximizar', maximized ? <Copy size={13} /> : <Square size={13} />, () => api?.maximize?.())}
      {btn('close', 'Fechar', <X size={16} />, () => api?.close?.())}
    </div>
  );
};

/** Minimizar/fechar no canto superior direito das telas que cobrem a header inteira (login, erro). Só aparece no Windows. */
export const FloatingWindowControls: React.FC = () => {
  if (window.electronAPI?.platform !== 'win32') return null;
  return (
    <div style={{ position: 'fixed', top: 10, right: 12, zIndex: 2147483647 }}>
      <WindowControls isDark textColor="#a0a0a0" hoverBg="rgba(255, 255, 255, 0.1)" />
    </div>
  );
};
