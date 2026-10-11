import { useState } from 'react';
import FloatingPopup from './FloatingPopup';
import type { Shape } from './types';

interface Props {
  tokens: Record<string, any>;
  accentColor: string;
  components: Shape[];
  onInsert: (componentId: string) => void;
  onClose: () => void;
}

/** Assets (Shift+I): componentes do documento, com busca; clicar insere uma instância no centro da tela */
export default function AssetsPopup({ tokens: th, accentColor, components, onInsert, onClose }: Props) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const list = components.filter((c) => !term || `${c.name || ''} ${c.variantGroup || ''} ${c.variantName || ''}`.toLowerCase().includes(term));
  // agrupa variantes do mesmo grupo
  const groups = new Map<string, Shape[]>();
  list.forEach((c) => {
    const key = c.variantGroup || `__${c.id}`;
    groups.set(key, [...(groups.get(key) || []), c]);
  });
  return (
    <FloatingPopup title="Assets" tokens={th} onClose={onClose} width={300} height={420}>
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Escape') onClose(); }}
        placeholder="Buscar componente"
        style={{ background: th.bgApp, border: `1px solid ${th.border}`, borderRadius: 6, color: th.textPrimary, fontSize: 12, padding: '6px 8px', outline: 'none' }}
      />
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {components.length === 0 && <span style={{ fontSize: 11, color: th.textSecondary }}>Nenhum componente. Selecione um elemento e use "Criar componente" (Alt+Cmd+K).</span>}
        {[...groups.entries()].map(([key, items]) => (
          <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {!key.startsWith('__') && <span style={{ fontSize: 10, color: th.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>{key}</span>}
            {items.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => onInsert(c.id)}
                title="Inserir instância no centro da tela"
                style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'transparent', border: 'none', borderRadius: 6, padding: '5px 6px', color: th.textPrimary, fontSize: 12, cursor: 'pointer', textAlign: 'left' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = `${accentColor}22`)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ width: 8, height: 8, borderRadius: 2, background: accentColor, flexShrink: 0 }} />
                <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.variantName || c.name || 'Componente'}</span>
                <span style={{ fontSize: 10, color: th.textSecondary }}>{Math.round(c.width)}×{Math.round(c.height)}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </FloatingPopup>
  );
}
