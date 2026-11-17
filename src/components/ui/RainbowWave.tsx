import React from 'react';
import { createPortal } from 'react-dom';

// Onda de cor: um degradê que atravessa a tela da esquerda para a direita. Com mix-blend-mode "hue" só os pixels coloridos
// (destaque do app) trocam de matiz conforme a posição; cinzas, texto e fundos neutros ficam como estão.
export const RainbowWave: React.FC<{ stops: string[]; speed: number }> = ({ stops, speed }) =>
  createPortal(
    <>
      <style>{'@keyframes dfRainbowWave { from { transform: translateX(0); } to { transform: translateX(-50%); } }'}</style>
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 2147483000, pointerEvents: 'none', overflow: 'hidden', mixBlendMode: 'hue' }}>
        <div
          style={{
            width: '200%',
            height: '100%',
            background: `linear-gradient(90deg, ${[...stops, stops[0]].join(', ')})`,
            backgroundSize: '50% 100%',
            backgroundRepeat: 'repeat-x',
            animation: `dfRainbowWave ${Math.max(4, speed)}s linear infinite`,
            willChange: 'transform',
          }}
        />
      </div>
    </>,
    document.body,
  );
