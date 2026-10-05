import React, { useEffect, useMemo, useState } from 'react';
import FloatingPopup from './FloatingPopup';
import { loadIcons, searchIcons, type IconCatalog } from './icons';

interface Props {
  tokens: Record<string, any>;
  accentColor: string;
  onClose: () => void;
  onPick: (name: string, path: string) => void;
}

export default function IconPickerModal({ tokens, accentColor, onClose, onPick }: Props) {
  const [catalog, setCatalog] = useState<IconCatalog | null>(null);
  const [query, setQuery] = useState('');
  useEffect(() => { loadIcons().then(setCatalog); }, []);
  const names = useMemo(() => (catalog ? searchIcons(catalog, query) : []), [catalog, query]);

  return (
    <FloatingPopup title="Ícones" tokens={tokens} onClose={onClose}>
      <input
        autoFocus
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}
        placeholder="Buscar: viagem, casa, seta, home…"
        style={{ background: tokens.bgApp, border: `1px solid ${tokens.border}`, borderRadius: 6, color: tokens.textPrimary, fontSize: 12, padding: '7px 10px', outline: 'none' }}
      />
      <div style={{ flex: 1, overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(44px, 1fr))', gap: 4, alignContent: 'start' }}>
        {!catalog && <span style={{ fontSize: 11, color: tokens.textSecondary }}>Carregando…</span>}
        {catalog && names.length === 0 && <span style={{ fontSize: 11, color: tokens.textSecondary }}>Nenhum ícone encontrado</span>}
        {catalog && names.map((n) => (
          <button
            key={n}
            type="button"
            title={n}
            onClick={() => onPick(n, catalog[n])}
            style={{ aspectRatio: '1', background: 'transparent', border: '1px solid transparent', borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', color: tokens.textPrimary }}
            onMouseEnter={(e) => { e.currentTarget.style.background = tokens.hoverBg; e.currentTarget.style.borderColor = accentColor; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.borderColor = 'transparent'; }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d={catalog[n]} /></svg>
          </button>
        ))}
      </div>
      <span style={{ fontSize: 10, color: tokens.textMuted }}>Material Icons · clique para inserir</span>
    </FloatingPopup>
  );
}
