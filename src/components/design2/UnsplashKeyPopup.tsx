import React, { useState } from 'react';
import FloatingPopup from './FloatingPopup';
import { getPexelsKey, getUnsplashKey, setPexelsKey, setUnsplashKey } from './stockImage';
import { getFieldTokens } from '../../utils/fieldTokens';

export default function UnsplashKeyPopup({ tokens, accentColor, onClose, onSaved }: { tokens: Record<string, any>; accentColor: string; onClose: () => void; onSaved: (hasKey: boolean) => void }) {
  const [key, setKey] = useState(getUnsplashKey());
  const [pexels, setPexels] = useState(getPexelsKey());
  const isDark = tokens.bgApp ? (tokens.bgApp.startsWith('#0') || tokens.bgApp.startsWith('#1') || tokens.bgApp.startsWith('#2')) : true;
  const ft = getFieldTokens(isDark);
  return (
    <FloatingPopup title="Imagens (Pexels e Unsplash)" tokens={tokens} onClose={onClose} width={340} height={360}>
      <span style={{ fontSize: 11, color: tokens.textSecondary, lineHeight: 1.5 }}>
        A IA usa fotos do Unsplash em avatares, banners e cards. Informe a Access Key gratuita (unsplash.com/developers → New Application). Sem chave, usa fotos aleatórias do picsum.photos.
      </span>
      <span style={{ fontSize: 11, color: tokens.textSecondary, lineHeight: 1.5 }}>
        Fotos de PESSOAS (avatares, retratos, equipe) vêm do Pexels: informe a chave gratuita (pexels.com/api). Sem ela, os avatares usam rostos do randomuser.me.
      </span>
      <input
        className="df-field"
        type="password"
        value={pexels}
        onChange={(e) => setPexels(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Chave do Pexels (pessoas)"
        style={{ background: tokens.fieldBg || ft.fieldBg, border: tokens.fieldBorder || ft.fieldBorder, boxShadow: 'none', borderRadius: 6, color: tokens.textPrimary, fontSize: 12, fontWeight: 400, padding: '7px 10px', outline: 'none' }}
      />
      <input
        className="df-field"
        type="password"
        value={key}
        onChange={(e) => setKey(e.target.value)}
        onKeyDown={(e) => e.stopPropagation()}
        placeholder="Access Key do Unsplash (outras fotos)"
        style={{ background: tokens.fieldBg || ft.fieldBg, border: tokens.fieldBorder || ft.fieldBorder, boxShadow: 'none', borderRadius: 6, color: tokens.textPrimary, fontSize: 12, fontWeight: 400, padding: '7px 10px', outline: 'none' }}
      />
      <button type="button" onClick={() => { setUnsplashKey(key); setPexelsKey(pexels); onSaved(!!key.trim() || !!pexels.trim()); onClose(); }} style={{ background: accentColor, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, padding: '7px 12px', cursor: 'pointer' }}>Salvar</button>
    </FloatingPopup>
  );
}
