import React, { useMemo, useState } from 'react';
import { ChevronRight, Plus, Save, Search, X } from 'lucide-react';
import { extractDocumentSymbols } from '../../utils/editor';
import { hexToRgba } from '../../utils/color';
import { getFieldTokens } from '../../utils/fieldTokens';

interface Props {
  file: { path: string; name: string; content?: string; language?: string; isDirty?: boolean } | null;
  themeTokens: { bgCard: string; textPrimary: string; textSecondary: string; hoverBg: string };
  isEffectiveDark: boolean;
  accentColor: string;
  onJumpToLine: (line: number) => void;
  onToast?: (msg: string) => void;
  /** CLI com estilo visual: cards sem fundo sólido, destaque na cor do estilo e tipografia do estilo */
  skinned?: boolean;
}

type Entry = { id: string; time: string; label: string; desc: string; type: 'edit' | 'save' | 'open' };

// Cards recolhíveis "Outline" (símbolos do arquivo) e "Timeline" (histórico local) do explorador, no mesmo visual da IDE
export const OutlineTimelineCards: React.FC<Props> = ({ file, themeTokens, isEffectiveDark, accentColor: accentProp, onJumpToLine, onToast, skinned }) => {
  const accentColor = skinned ? 'var(--sk)' : accentProp;
  const mix = (c: string, pct: number) => `color-mix(in srgb, ${c} ${pct}%, transparent)`;
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [timelineOpen, setTimelineOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const [snapshots, setSnapshots] = useState<Record<string, Entry[]>>({});
  const ft = getFieldTokens(isEffectiveDark);

  const symbols = useMemo(() => (file?.content ? extractDocumentSymbols(file.content, file.language) : []), [file?.content, file?.language]);
  const shown = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return q ? symbols.filter((s) => s.name.toLowerCase().includes(q) || s.kind.toLowerCase().includes(q)) : symbols;
  }, [symbols, filter]);

  const entries = useMemo<Entry[]>(() => {
    if (!file) return [];
    return [
      ...(snapshots[file.path] || []),
      { id: 'current', time: 'Agora', label: file.isDirty ? 'Edição não salva' : 'Edição atual', desc: `${file.name} em edição ativa`, type: 'edit' },
      { id: 'opened', time: 'Hoje', label: 'Arquivo carregado', desc: `Carregado do workspace: ${file.name}`, type: 'open' },
    ];
  }, [file?.path, file?.name, file?.isDirty, snapshots]);

  const takeSnapshot = () => {
    if (!file) return;
    const entry: Entry = { id: String(Date.now()), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), label: 'Snapshot Local', desc: `${file.content ? file.content.split('\n').length : 0} linhas salvas`, type: 'save' };
    setSnapshots((prev) => ({ ...prev, [file.path]: [entry, ...(prev[file.path] || [])] }));
    onToast?.(`Snapshot criado para ${file.name}`);
  };

  const countBadge = (n: number) => (
    <span style={{ fontSize: 10, fontWeight: 500, color: themeTokens.textSecondary, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)', padding: '1px 6px', borderRadius: 10, fontFamily: 'monospace' }}>{n}</span>
  );

  const card = (title: string, open: boolean, toggle: () => void, count: number | null, body: React.ReactNode) => (
    <div style={{ width: '100%', padding: '8px 10px', background: skinned ? 'transparent' : themeTokens.bgCard, borderRadius: skinned ? 'var(--sk-r, 0px)' : 10, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0, boxSizing: 'border-box' }}>
      <div onClick={toggle} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', whiteSpace: 'nowrap', cursor: 'pointer', userSelect: 'none', padding: '2px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform 0.15s ease', display: 'flex', color: themeTokens.textSecondary }}>
            <ChevronRight size={13} />
          </div>
          <div style={{ color: themeTokens.textPrimary, fontSize: 12, fontWeight: 500, letterSpacing: skinned ? 'var(--sk-ls, 0)' : undefined, textTransform: skinned ? ('var(--sk-tt, none)' as any) : undefined }}>{title}</div>
        </div>
        {count !== null && count > 0 && countBadge(count)}
      </div>
      {open && body}
    </div>
  );

  return (
    <div className={skinned ? 'skin-bar' : undefined} style={{ display: 'flex', flexDirection: 'column', gap: 5, flexShrink: 0 }}>
      {card(
        'Outline',
        outlineOpen,
        () => setOutlineOpen((v) => !v),
        file ? symbols.length : null,
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          {symbols.length > 3 && (
            <div className="df-search-box" style={{ display: 'flex', alignItems: 'center', background: ft.fieldBg, borderRadius: 6, padding: '4px 8px', gap: 6, boxSizing: 'border-box' }}>
              <Search size={11} color={themeTokens.textSecondary} />
              <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar símbolos..." style={{ background: 'transparent', border: 'none', outline: 'none', color: themeTokens.textPrimary, fontSize: 11, width: '100%', fontFamily: 'inherit' }} />
              {filter && <X size={11} color={themeTokens.textSecondary} style={{ cursor: 'pointer' }} onClick={() => setFilter('')} />}
            </div>
          )}
          <div className="no-scrollbar" style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 1 }}>
            {shown.length > 0 ? (
              shown.map((sym, idx) => (
                <div
                  key={`${sym.name}-${sym.line}-${idx}`}
                  onClick={() => onJumpToLine(sym.line)}
                  title={`Ir para linha ${sym.line}: ${sym.name} (${sym.kind})`}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 6px', borderRadius: 5, cursor: 'pointer', transition: 'background 0.1s ease' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden' }}>
                    <span style={{ width: 16, height: 16, borderRadius: 3, background: hexToRgba(sym.color, 0.15), color: sym.color, fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontFamily: 'monospace' }}>{sym.badge}</span>
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: 'JetBrains Mono, monospace', fontSize: 11, color: themeTokens.textPrimary }}>{sym.name}</span>
                  </div>
                  <span style={{ fontSize: 10, color: themeTokens.textSecondary, fontFamily: 'monospace', flexShrink: 0 }}>:{sym.line}</span>
                </div>
              ))
            ) : (
              <div style={{ padding: '8px 4px', fontSize: 11, color: themeTokens.textSecondary, textAlign: 'center' }}>{file ? 'Nenhum símbolo detectado' : 'Nenhum arquivo ativo'}</div>
            )}
          </div>
        </div>,
      )}

      {card(
        'Timeline',
        timelineOpen,
        () => setTimelineOpen((v) => !v),
        file ? entries.length : null,
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 2px' }}>
            <span style={{ fontSize: 10.5, color: themeTokens.textSecondary }}>Histórico local</span>
            <button
              type="button"
              onClick={takeSnapshot}
              disabled={!file}
              title="Criar snapshot manual deste arquivo"
              style={{ background: 'transparent', border: 'none', color: accentColor, fontSize: 10.5, fontWeight: 500, cursor: file ? 'pointer' : 'default', opacity: file ? 1 : 0.4, display: 'flex', alignItems: 'center', gap: 3, padding: '2px 4px', borderRadius: 4 }}
              onMouseEnter={(e) => file && (e.currentTarget.style.background = mix(accentColor, 10))}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <Plus size={11} />
              <span>Snapshot</span>
            </button>
          </div>
          <div className="no-scrollbar" style={{ maxHeight: 180, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {file ? (
              entries.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onToast?.(`${item.label} (${item.time})`)}
                  style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '5px 6px', borderRadius: 6, cursor: 'pointer', transition: 'background 0.1s ease' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                >
                  <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {item.type === 'edit' ? <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} /> : item.type === 'save' ? <Save size={12} color={accentColor} /> : <div style={{ width: 8, height: 8, borderRadius: '50%', background: themeTokens.textSecondary }} />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}>
                      <span style={{ fontSize: 11.5, color: themeTokens.textPrimary }}>{item.label}</span>
                      <span style={{ fontSize: 10, color: themeTokens.textSecondary, flexShrink: 0 }}>{item.time}</span>
                    </div>
                    <span style={{ fontSize: 10.5, color: themeTokens.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.desc}</span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ padding: '8px 4px', fontSize: 11, color: themeTokens.textSecondary, textAlign: 'center' }}>Nenhum arquivo ativo</div>
            )}
          </div>
        </div>,
      )}
    </div>
  );
};
