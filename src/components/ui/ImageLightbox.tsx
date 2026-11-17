import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';

/** Imagem em tela cheia: fecha com Esc, clique fora ou no X. */
export const ImageLightbox: React.FC<{ src: string | null; alt?: string; onClose: () => void }> = ({ src, alt, onClose }) => {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!src) { setShown(false); return; }
    const id = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(id); window.removeEventListener('keydown', onKey); };
  }, [src, onClose]);
  if (!src) return null;
  return createPortal(
    <div
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 200000, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box', opacity: shown ? 1 : 0, transition: 'opacity 0.18s ease', WebkitAppRegion: 'no-drag' as any }}
    >
      <button
        className="df-pressable"
        title="Fechar (Esc)"
        onClick={onClose}
        style={{ position: 'absolute', top: 14, right: 14, width: 30, height: 30, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <X size={16} />
      </button>
      <img
        src={src}
        alt={alt || ''}
        onMouseDown={(e) => e.stopPropagation()}
        style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8, transform: shown ? 'scale(1)' : 'scale(0.96)', transition: 'transform 0.18s ease' }}
      />
    </div>,
    document.body,
  );
};
