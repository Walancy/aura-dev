import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Search } from 'lucide-react';
import { ensureFontPreviews, ensureGoogleFont, FONT_OPTIONS } from './fonts';

interface Props {
  value: string;
  onChange: (family: string) => void;
  tokens: Record<string, any>;
  accentColor: string;
}

/** Seletor de fonte com busca; cada nome aparece na própria fonte (como no Figma). Aceita também um nome livre do Google Fonts. */
export default function FontPicker({ value, onChange, tokens: th, accentColor }: Props) {
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (open) ensureFontPreviews();
  }, [open]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return FONT_OPTIONS.filter((f) => !s || f.name.toLowerCase().includes(s));
  }, [q]);
  const exact = FONT_OPTIONS.some((f) => f.name.toLowerCase() === q.trim().toLowerCase());
  const pick = (name: string) => {
    ensureGoogleFont(name);
    onChange(name);
    setOpen(false);
    setQ('');
  };
  const groups = ['Sans', 'Serifa', 'Mono', 'Display'] as const;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: th.bgApp, border: `1px solid ${th.border}`, borderRadius: 6, color: th.textPrimary, fontSize: 13, height: 30, padding: '0 10px', cursor: 'pointer', fontFamily: `'${value}', 'Poppins', sans-serif`, boxSizing: 'border-box' }}
        title="Escolher a fonte"
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{value}</span>
        <ChevronDown size={13} color={th.textSecondary} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease', flexShrink: 0 }} />
      </button>
      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => { setOpen(false); setQ(''); }} />
          <div style={{ position: 'absolute', left: 0, right: 0, top: '100%', marginTop: 4, background: th.bgCardElevated || th.bgApp, border: `1px solid ${th.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', flexDirection: 'column', maxHeight: 320 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', borderBottom: `1px solid ${th.border}` }}>
              <Search size={13} color={th.textMuted} />
              <input
                autoFocus
                value={q}
                onChange={(e) => setQ(e.target.value)}
                onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && q.trim()) pick(list[0]?.name || q.trim()); if (e.key === 'Escape') setOpen(false); }}
                placeholder="Buscar fonte…"
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: th.textPrimary, fontSize: 12, fontFamily: "'Poppins', sans-serif" }}
              />
            </div>
            <div style={{ overflowY: 'auto', padding: '4px 0' }}>
              {groups.map((g) => {
                const items = list.filter((f) => f.group === g);
                if (!items.length) return null;
                return (
                  <div key={g}>
                    <div style={{ padding: '6px 12px 2px', fontSize: 9.5, fontWeight: 600, color: th.textMuted, textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: "'Poppins', sans-serif" }}>{g}</div>
                    {items.map((f) => (
                      <div
                        key={f.name}
                        onClick={() => pick(f.name)}
                        style={{ padding: '6px 12px', fontSize: 14, color: f.name === value ? accentColor : th.textPrimary, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8, fontFamily: `'${f.name}', 'Poppins', sans-serif` }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = th.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span style={{ width: 12, flexShrink: 0 }}>{f.name === value ? <Check size={12} color={accentColor} /> : null}</span>
                        <span>{f.name}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
              {q.trim() && !exact && (
                <div
                  onClick={() => pick(q.trim())}
                  style={{ padding: '8px 12px', fontSize: 11.5, color: th.textSecondary, cursor: 'pointer', borderTop: list.length ? `1px solid ${th.border}` : 'none', fontFamily: "'Poppins', sans-serif" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = th.hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  Usar “{q.trim()}” (Google Fonts)
                </div>
              )}
              {!list.length && !q.trim() && <div style={{ padding: 12, fontSize: 11, color: th.textMuted }}>Nenhuma fonte.</div>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
