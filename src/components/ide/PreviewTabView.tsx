import React, { useState, useEffect } from 'react';
import { RefreshCw, Monitor, ExternalLink } from 'lucide-react';

interface Props {
  url: string;
  onUrlChange: (url: string) => void;
  themeTokens: any;
  isEffectiveDark: boolean;
  accentColor: string;
}

// Web preview exibido como aba na área central do editor.
export const PreviewTabView: React.FC<Props> = ({ url, onUrlChange, themeTokens, isEffectiveDark, accentColor }) => {
  const [input, setInput] = useState(url);
  const [mobile, setMobile] = useState(false);
  const [key, setKey] = useState(0);
  useEffect(() => setInput(url), [url]);
  const btn: React.CSSProperties = { background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 4, display: 'flex' };
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', background: isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)', borderRadius: 6, marginBottom: 8 }}>
        <button style={btn} title="Recarregar página" onClick={() => setKey((k) => k + 1)}><RefreshCw size={13} /></button>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            const v = input.trim();
            onUrlChange(/^https?:\/\//.test(v) ? v : 'http://' + v);
          }}
          placeholder="http://localhost:5173"
          style={{ flex: 1, background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', border: 'none', borderRadius: 4, padding: '5px 8px', color: themeTokens.textPrimary, fontSize: 11, fontFamily: 'monospace', outline: 'none' }}
        />
        <button style={{ ...btn, color: mobile ? accentColor : themeTokens.textSecondary }} title={mobile ? 'Mudar para Responsivo' : 'Mudar para Mobile (375px)'} onClick={() => setMobile(!mobile)}><Monitor size={13} /></button>
        <button style={btn} title="Abrir no navegador do sistema" onClick={() => window.electronAPI?.shell?.openExternal(url)}><ExternalLink size={13} /></button>
      </div>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center', background: '#ffffff', borderRadius: 6, overflow: 'hidden' }}>
        <iframe
          key={key}
          src={url}
          title="Web Preview"
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
          style={{ width: mobile ? 375 : '100%', height: '100%', border: 'none', boxShadow: mobile ? '0 0 20px rgba(0,0,0,0.3)' : 'none' }}
        />
      </div>
    </div>
  );
};
