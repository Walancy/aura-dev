import React, { useState } from 'react';
import FloatingPopup from './FloatingPopup';
import { getUnsplashKey, setUnsplashKey } from './stockImage';

export default function UnsplashKeyPopup({ tokens, accentColor, onClose, onSaved }: { tokens: Record<string, any>; accentColor: string; onClose: () => void; onSaved: (hasKey: boolean) => void }) {
  const [key, setKey] = useState(getUnsplashKey());
  return (
    <FloatingPopup title="Imagens (Unsplash)" tokens={tokens} onClose={onClose} width={340} height={230}>
      <span style={{ fontSize: 11, color: tokens.textSecondary, lineHeight: 1.5 }}>
        A IA usa fotos do Unsplash em avatares, banners e cards. Informe a Access Key gratuita (unsplash.com/developers → New Application). Sem chave, usa fotos aleatórias do picsum.photos.
      </span>
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Access Key"
        style={{ background: tokens.bgApp, border: `1px solid ${tokens.border}`, borderRadius: 6, color: tokens.textPrimary, fontSize: 12, padding: '7px 10px', outline: 'none' }}
      />
      <button type="button" onClick={() => { setUnsplashKey(key); onSaved(!!key.trim()); onClose(); }} style={{ background: accentColor, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, padding: '7px 12px', cursor: 'pointer' }}>Salvar</button>
    </FloatingPopup>
  );
}
