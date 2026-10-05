import React, { useEffect, useMemo, useState } from 'react';
import { buildExportSvg, collectSubtree } from './exportDesign';
import type { Shape } from './types';

interface PrototypePlayerProps {
  shapes: Shape[];
  startFrameId: string;
  accentColor: string;
  onClose: () => void;
}

/** Modo apresentação: mostra um frame e navega entre frames pelos elementos com `prototypeLink`. */
export default function PrototypePlayer({ shapes, startFrameId, accentColor, onClose }: PrototypePlayerProps) {
  const [stack, setStack] = useState<string[]>([startFrameId]);
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight });
  const currentId = stack[stack.length - 1];
  const frame = shapes.find((s) => s.id === currentId);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if ((e.key === 'ArrowLeft' || e.key === 'Backspace') && stack.length > 1) setStack((st) => st.slice(0, -1));
    };
    const onResize = () => setSize({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [onClose, stack.length]);

  const rendered = useMemo(() => (frame ? buildExportSvg(shapes, frame, 1) : null), [shapes, frame]);
  if (!frame || !rendered) return null;
  const { svg, bounds } = rendered;
  const k = Math.min((size.w - 80) / bounds.width, (size.h - 100) / bounds.height, 3);

  const hotspots = collectSubtree(shapes, frame).filter((s) => s.prototypeLink?.targetId && s.visible !== false);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 200000, background: 'rgba(8,8,8,0.96)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ position: 'absolute', top: 14, left: 18, right: 18, display: 'flex', alignItems: 'center', gap: 10, color: '#d4d4d4', fontFamily: "'Poppins', sans-serif", fontSize: 12 }}>
        <span style={{ fontWeight: 600 }}>{frame.name || 'Frame'}</span>
        <span style={{ opacity: 0.6 }}>Clique nos elementos com link • ← volta • Esc sai</span>
        <span style={{ flex: 1 }} />
        {stack.length > 1 && (
          <button type="button" onClick={() => setStack((st) => st.slice(0, -1))} style={{ background: 'transparent', border: '1px solid #444', borderRadius: 6, color: '#ddd', padding: '4px 10px', cursor: 'pointer' }}>Voltar</button>
        )}
        <button type="button" onClick={onClose} style={{ background: accentColor, border: 'none', borderRadius: 6, color: '#fff', padding: '4px 12px', cursor: 'pointer' }}>Sair</button>
      </div>
      <div style={{ position: 'relative', width: bounds.width * k, height: bounds.height * k, boxShadow: '0 20px 60px rgba(0,0,0,0.6)', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', left: 0, top: 0, width: bounds.width, height: bounds.height, transform: `scale(${k})`, transformOrigin: '0 0' }}>
          <div dangerouslySetInnerHTML={{ __html: svg }} />
          {hotspots.map((s) => (
            <div
              key={s.id}
              title={`Ir para: ${shapes.find((x) => x.id === s.prototypeLink!.targetId)?.name || 'frame'}`}
              onClick={() => shapes.some((x) => x.id === s.prototypeLink!.targetId) && setStack((st) => [...st, s.prototypeLink!.targetId])}
              style={{ position: 'absolute', left: s.x - bounds.x, top: s.y - bounds.y, width: s.width, height: s.height, cursor: 'pointer', borderRadius: s.cornerRadius || 0, outline: `${2 / k}px solid ${accentColor}55` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
