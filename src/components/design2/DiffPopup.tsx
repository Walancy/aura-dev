import FloatingPopup from './FloatingPopup';
import type { ShapesDiff } from './diffShapes';

interface Props {
  tokens: Record<string, any>;
  accentColor: string;
  label: string;
  diff: ShapesDiff;
  existingIds: Set<string>;
  onSelect: (id: string) => void;
  onClose: () => void;
}

/** Comparação de uma versão salva com o design atual */
export default function DiffPopup({ tokens: th, accentColor, label, diff, existingIds, onSelect, onClose }: Props) {
  const total = diff.added.length + diff.removed.length + diff.changed.length;
  const item = (key: string, color: string, text: string, sub?: string, id?: string) => (
    <button key={key} type="button" onClick={() => id && existingIds.has(id) && onSelect(id)} disabled={!id || !existingIds.has(id)} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', textAlign: 'left', background: th.bgApp, border: 'none', borderRadius: 6, padding: '6px 8px', color: th.textPrimary, cursor: id && existingIds.has(id) ? 'pointer' : 'default' }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 4, flexShrink: 0 }} />
      <span style={{ minWidth: 0 }}>
        <span style={{ fontSize: 11.5 }}>{text}</span>
        {sub && <span style={{ display: 'block', fontSize: 10.5, color: th.textSecondary, whiteSpace: 'pre-wrap' }}>{sub}</span>}
      </span>
    </button>
  );
  return (
    <FloatingPopup title={`Comparar: ${label} → atual`} tokens={th} onClose={onClose} width={400} height={460}>
      <span style={{ fontSize: 11, color: th.textSecondary }}>
        {total === 0 ? 'Nenhuma diferença.' : `${diff.added.length} novos · ${diff.removed.length} removidos · ${diff.changed.length} alterados`}
      </span>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {diff.added.map((s) => item(`a-${s.id}`, '#2ecc71', `Novo: ${s.name || s.type}`, undefined, s.id))}
        {diff.removed.map((s) => item(`r-${s.id}`, '#f24822', `Removido: ${s.name || s.type}`))}
        {diff.changed.map((c) => item(`c-${c.id}`, accentColor, `Alterado: ${c.name}`, c.fields.map((f) => `${f.key}: ${f.from} → ${f.to}`).join('\n'), c.id))}
      </div>
    </FloatingPopup>
  );
}
