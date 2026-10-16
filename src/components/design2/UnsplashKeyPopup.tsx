import React, { useState } from 'react';
import FloatingPopup from './FloatingPopup';
import { getPexelsKey, getUnsplashKey, setPexelsKey, setUnsplashKey } from './stockImage';

export default function UnsplashKeyPopup({ tokens, accentColor, onClose, onSaved }: { tokens: Record<string, any>; accentColor: string; onClose: () => void; onSaved: (hasKey: boolean) => void }) {
  const [key, setKey] = useState(getUnsplashKey());
  const [pexels, setPexels] = useState(getPexelsKey());
  return (
    <FloatingPopup title="Imagens (Pexels e Unsplash)" tokens={tokens} onClose={onClose} width={340} height={360}>
      <span style={{ fontSize: 11, color: tokens.textSecondary, lineHeight: 1.5 }}>
        A IA usa fotos do Unsplash em avatares, banners e cards. Informe a Access Key gratuita (unsplash.com/developers → New Application). Sem chave, usa fotos aleatórias do picsum.photos.
      </span>
      <span style={{ fontSize: 11, color: tokens.textSecondary, lineHeight: 1.5 }}>
        Fotos de PESSOAS (avatares, retratos, equipe) vêm do Pexels: informe a chave gratuita (pexels.com/api). Sem ela, os avatares usam rostos do randomuser.me.
      </span>
      <input
        type="password"
        value={pexels}
        onChange={(e) => setPexels(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Chave do Pexels (pessoas)"
        style={{ background: tokens.bgApp, border: `1px solid ${tokens.border}`, borderRadius: 6, color: tokens.textPrimary, fontSize: 12, padding: '7px 10px', outline: 'none' }}
      />
      <input
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Access Key do Unsplash (outras fotos)"
        style={{ background: tokens.bgApp, border: `1px solid ${tokens.border}`, borderRadius: 6, color: tokens.textPrimary, fontSize: 12, padding: '7px 10px', outline: 'none' }}
      />
      <button type="button" onClick={() => { setUnsplashKey(key); setPexelsKey(pexels); onSaved(!!key.trim() || !!pexels.trim()); onClose(); }} style={{ background: accentColor, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, padding: '7px 12px', cursor: 'pointer' }}>Salvar</button>
    </FloatingPopup>
  );
}
