import { Eye, EyeOff, Plus, X } from 'lucide-react';
import ScrubbableNumberInput from './ScrubbableNumberInput';
import { newLayoutGrid, type LayoutGrid } from './layoutGrid';

interface Props {
  grids: LayoutGrid[];
  onChange: (grids: LayoutGrid[]) => void;
  themeTokens: any;
  accentColor: string;
  isEffectiveDark: boolean;
  divider: string;
}

const KIND_LABEL: Record<LayoutGrid['kind'], string> = { columns: 'Colunas', rows: 'Linhas', grid: 'Grade' };

/** Seção "Layout grid" do painel de propriedades de um frame */
export default function LayoutGridSection({ grids, onChange, themeTokens: th, accentColor, isEffectiveDark, divider }: Props) {
  const patch = (id: string, p: Partial<LayoutGrid>) => onChange(grids.map((g) => (g.id === id ? { ...g, ...p } : g)));
  const num = (label: string, value: number, onVal: (v: number) => void) => (
    <ScrubbableNumberInput label={label} value={value} onChange={onVal} themeTokens={th} accentColor={accentColor} isEffectiveDark={isEffectiveDark} />
  );
  const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: th.textSecondary, cursor: 'pointer', padding: 4, borderRadius: 5, display: 'flex' };
  return (
    <div style={{ padding: '10px 12px', borderBottom: `1px solid ${divider}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: th.textPrimary }}>Layout grid</span>
        <button type="button" style={iconBtn} title="Adicionar grade de layout" onClick={() => onChange([...grids, newLayoutGrid(grids.length ? 'rows' : 'columns')])}>
          <Plus size={12} />
        </button>
      </div>
      {grids.map((g) => (
        <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: 6, opacity: g.visible ? 1 : 0.55 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <select
              value={g.kind}
              onChange={(e) => {
                const kind = e.target.value as LayoutGrid['kind'];
                const base = newLayoutGrid(kind);
                patch(g.id, { kind, count: g.count || base.count, size: kind === 'grid' ? base.size : g.size, color: g.color });
              }}
              style={{ flex: 1, background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 5, color: th.textPrimary, fontSize: 11, height: 26, padding: '0 6px' }}
            >
              {(Object.keys(KIND_LABEL) as LayoutGrid['kind'][]).map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </select>
            <input
              type="color"
              value={g.color}
              onChange={(e) => patch(g.id, { color: e.target.value })}
              title="Cor da grade"
              style={{ width: 26, height: 26, padding: 0, border: 'none', background: 'transparent', cursor: 'pointer' }}
            />
            <button type="button" style={iconBtn} title={g.visible ? 'Ocultar' : 'Mostrar'} onClick={() => patch(g.id, { visible: !g.visible })}>
              {g.visible ? <Eye size={13} /> : <EyeOff size={13} />}
            </button>
            <button type="button" style={iconBtn} title="Remover" onClick={() => onChange(grids.filter((x) => x.id !== g.id))}>
              <X size={13} />
            </button>
          </div>
          {g.kind === 'grid' ? (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {num('Tam', g.size, (v) => patch(g.id, { size: Math.max(1, v) }))}
              {num('Op %', Math.round(g.opacity * 100), (v) => patch(g.id, { opacity: Math.max(0, Math.min(1, v / 100)) }))}
            </div>
          ) : (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {num('Qtd', g.count, (v) => patch(g.id, { count: Math.max(1, Math.round(v)) }))}
                {num('Gut', g.gutter, (v) => patch(g.id, { gutter: Math.max(0, v) }))}
                {num('Marg', g.margin, (v) => patch(g.id, { margin: Math.max(0, v) }))}
                {num('Op %', Math.round(g.opacity * 100), (v) => patch(g.id, { opacity: Math.max(0, Math.min(1, v / 100)) }))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                <select
                  value={g.alignment}
                  onChange={(e) => patch(g.id, { alignment: e.target.value as LayoutGrid['alignment'] })}
                  style={{ background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)', border: 'none', borderRadius: 5, color: th.textPrimary, fontSize: 11, height: 26, padding: '0 6px' }}
                >
                  <option value="stretch">Esticar</option>
                  <option value="start">{g.kind === 'columns' ? 'Esquerda' : 'Topo'}</option>
                  <option value="center">Centro</option>
                  <option value="end">{g.kind === 'columns' ? 'Direita' : 'Base'}</option>
                </select>
                {g.alignment !== 'stretch' && num(g.kind === 'columns' ? 'Larg' : 'Alt', g.size, (v) => patch(g.id, { size: Math.max(1, v) }))}
              </div>
            </>
          )}
        </div>
      ))}
    </div>
  );
}
