import { useState } from 'react';
import FloatingPopup from './FloatingPopup';
import { renameMany } from './renameBulk';

interface Props {
  tokens: Record<string, any>;
  accentColor: string;
  items: Array<{ id: string; name: string }>;
  onApply: (names: Map<string, string>) => void;
  onClose: () => void;
}

/** Renomear camadas em massa (Cmd/Ctrl+R) com pré-visualização */
export default function RenamePopup({ tokens: th, accentColor, items, onApply, onClose }: Props) {
  const [pattern, setPattern] = useState('{nome}');
  const [find, setFind] = useState('');
  const [replace, setReplace] = useState('');
  const [useRegex, setUseRegex] = useState(false);
  const [start, setStart] = useState(1);
  const [pad, setPad] = useState(1);
  const names = renameMany(items.map((i) => i.name), { pattern, find, replace, useRegex, start, pad });
  const input: React.CSSProperties = { background: th.bgApp, border: `1px solid ${th.border}`, borderRadius: 6, color: th.textPrimary, fontSize: 12, padding: '6px 8px', outline: 'none', minWidth: 0 };
  const label: React.CSSProperties = { fontSize: 10.5, color: th.textSecondary };
  const stop = (e: React.KeyboardEvent) => e.stopPropagation();
  return (
    <FloatingPopup title={`Renomear ${items.length} camadas`} tokens={th} onClose={onClose} width={360} height={440}>
      <span style={label}>Padrão · {'{n}'} = sequência, {'{nome}'} = nome atual</span>
      <input value={pattern} onChange={(e) => setPattern(e.target.value)} onKeyDown={stop} style={input} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        <input value={find} onChange={(e) => setFind(e.target.value)} onKeyDown={stop} placeholder="Localizar" style={input} />
        <input value={replace} onChange={(e) => setReplace(e.target.value)} onKeyDown={stop} placeholder="Substituir por" style={input} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 4 }}>
          <input type="checkbox" checked={useRegex} onChange={(e) => setUseRegex(e.target.checked)} /> Regex
        </label>
        <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 4 }}>
          Início <input type="number" value={start} onChange={(e) => setStart(Number(e.target.value) || 0)} onKeyDown={stop} style={{ ...input, width: 54 }} />
        </label>
        <label style={{ ...label, display: 'flex', alignItems: 'center', gap: 4 }}>
          Dígitos <input type="number" min={1} max={6} value={pad} onChange={(e) => setPad(Math.max(1, Number(e.target.value) || 1))} onKeyDown={stop} style={{ ...input, width: 46 }} />
        </label>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: `1px solid ${th.border}`, borderRadius: 6, padding: 6, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.map((it, i) => (
          <div key={it.id} style={{ fontSize: 11, display: 'flex', gap: 6, alignItems: 'baseline', whiteSpace: 'nowrap', overflow: 'hidden' }}>
            <span style={{ color: th.textSecondary, textDecoration: names[i] !== it.name ? 'line-through' : 'none', opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis' }}>{it.name || '(sem nome)'}</span>
            {names[i] !== it.name && <span style={{ color: th.textPrimary }}>→ {names[i]}</span>}
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={() => { onApply(new Map(items.map((it, i) => [it.id, names[i]] as const))); onClose(); }}
        style={{ background: accentColor, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, padding: '7px 12px', cursor: 'pointer' }}
      >
        Renomear
      </button>
    </FloatingPopup>
  );
}
