import { useMemo, useState } from 'react';
import { cssOf, specsOf, type Spec } from './devSpecs';
import type { DesignStyle, DesignVariable, Shape } from './types';

interface Props {
  tokens: Record<string, any>;
  accentColor: string;
  shape: Shape | null;
  shapes: Shape[];
  styles: DesignStyle[];
  variables: DesignVariable[];
  modeId: string;
  onShowCode: (shape: Shape) => void;
  onStatus: (shape: Shape, status: Shape['devStatus']) => void;
  onToast?: (msg: string) => void;
}

type DevStatus = 'draft' | 'ready' | 'done';
const STATUS_LABEL: Record<DevStatus, string> = { draft: 'Rascunho', ready: 'Pronto para dev', done: 'Implementado' };
const STATUS_COLOR: Record<DevStatus, string> = { draft: '#8a8a8a', ready: '#2ecc71', done: '#4f9dff' };

/** Modo Dev: especificações do elemento selecionado (medidas, cores, tipografia, espaçamentos, efeitos) com copiar */
export default function DevPanel({ tokens: th, accentColor, shape, shapes, styles, variables, modeId, onShowCode, onStatus, onToast }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const specs = useMemo(() => (shape ? specsOf(shape, shapes, styles, variables, modeId) : []), [shape, shapes, styles, variables, modeId]);
  const css = useMemo(() => cssOf(specs), [specs]);
  const copy = (text: string, key: string) => {
    try { navigator.clipboard.writeText(text); } catch {}
    setCopied(key);
    setTimeout(() => setCopied((c) => (c === key ? null : c)), 1200);
    onToast?.('Copiado');
  };
  if (!shape) return <div style={{ padding: 24, fontSize: 12, color: th.textSecondary, textAlign: 'center' }}>Selecione um elemento para inspecionar</div>;
  const sections = Array.from(new Set(specs.map((s) => s.section)));
  const row = (s: Spec, i: number) => (
    <div key={`${s.label}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 11.5 }}>
      <span style={{ color: th.textSecondary, width: 96, flexShrink: 0 }}>{s.label}</span>
      {s.swatch && <span style={{ width: 12, height: 12, borderRadius: 3, background: s.swatch, border: '1px solid rgba(255,255,255,0.2)', flexShrink: 0 }} />}
      <span style={{ flex: 1, minWidth: 0, color: th.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.value}>{s.value}</span>
      {s.token && <span style={{ fontSize: 10, color: accentColor, background: `${accentColor}22`, borderRadius: 4, padding: '1px 6px' }} title="Token de design">{s.token}</span>}
      {(s.copy || s.value) && (
        <button type="button" onClick={() => copy(s.copy || s.value, `${s.label}-${i}`)} title="Copiar" style={{ background: 'transparent', border: 'none', color: copied === `${s.label}-${i}` ? '#2ecc71' : th.textSecondary, cursor: 'pointer', fontSize: 11, padding: 2 }}>
          {copied === `${s.label}-${i}` ? '✓' : '⧉'}
        </button>
      )}
    </div>
  );
  return (
    <div style={{ height: '100%', overflowY: 'auto', fontFamily: "'Poppins', sans-serif", color: th.textPrimary }}>
      <div style={{ padding: '12px 14px', borderBottom: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shape.name || shape.type}</div>
          <div style={{ fontSize: 10.5, color: th.textSecondary }}>{shape.type}</div>
        </div>
        <button type="button" onClick={() => onShowCode(shape)} style={{ background: accentColor, border: 'none', borderRadius: 6, color: '#fff', fontSize: 11, padding: '5px 10px', cursor: 'pointer' }}>Ver código</button>
      </div>
      <div style={{ padding: '10px 14px', borderBottom: `1px solid ${th.border}`, display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLOR[shape.devStatus || 'draft'] }} />
        <select
          value={shape.devStatus || 'draft'}
          onChange={(e) => onStatus(shape, e.target.value === 'draft' ? undefined : (e.target.value as Shape['devStatus']))}
          title="Status de entrega para desenvolvimento"
          style={{ flex: 1, background: th.bgApp, border: `1px solid ${th.border}`, borderRadius: 6, color: th.textPrimary, fontSize: 11, height: 26, padding: '0 6px' }}
        >
          {(Object.keys(STATUS_LABEL) as Array<keyof typeof STATUS_LABEL>).map((k) => <option key={k} value={k}>{STATUS_LABEL[k]}</option>)}
        </select>
      </div>
      {sections.map((sec) => (
        <div key={sec} style={{ padding: '10px 14px', borderBottom: `1px solid ${th.border}` }}>
          <div style={{ fontSize: 10.5, fontWeight: 600, color: th.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 4 }}>{sec}</div>
          {specs.map((s, i) => (s.section === sec ? row(s, i) : null))}
        </div>
      ))}
      {css && (
        <div style={{ padding: '10px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontSize: 10.5, fontWeight: 600, color: th.textSecondary, textTransform: 'uppercase', letterSpacing: 0.4, flex: 1 }}>CSS</span>
            <button type="button" onClick={() => copy(css, 'css')} style={{ background: 'transparent', border: `1px solid ${th.border}`, borderRadius: 5, color: th.textPrimary, fontSize: 10.5, padding: '2px 8px', cursor: 'pointer' }}>{copied === 'css' ? 'Copiado ✓' : 'Copiar'}</button>
          </div>
          <pre style={{ margin: 0, padding: 8, borderRadius: 6, background: th.bgApp, fontSize: 11, lineHeight: 1.5, whiteSpace: 'pre-wrap', fontFamily: "'JetBrains Mono', Menlo, monospace", color: th.textPrimary }}>{css}</pre>
        </div>
      )}
    </div>
  );
}
