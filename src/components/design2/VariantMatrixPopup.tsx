import { useState } from 'react';
import FloatingPopup from './FloatingPopup';
import type { VariantAxis } from './variantMatrix';

interface Props {
  tokens: Record<string, any>;
  accentColor: string;
  componentName: string;
  hasGroup: boolean;
  onCreate: (axes: VariantAxis[]) => void;
  onArrange: () => void;
  onClose: () => void;
}

const toAxis = (name: string, csv: string): VariantAxis => ({ name, values: csv.split(',').map((v) => v.trim()).filter(Boolean) });

/** Cria as variantes de um componente por eixos (ex.: Tamanho × Estado) e organiza a matriz */
export default function VariantMatrixPopup({ tokens: th, accentColor, componentName, hasGroup, onCreate, onArrange, onClose }: Props) {
  const [n1, setN1] = useState('Tamanho');
  const [v1, setV1] = useState('Pequeno, Médio, Grande');
  const [n2, setN2] = useState('Estado');
  const [v2, setV2] = useState('Normal, Hover');
  const input: React.CSSProperties = { background: th.bgApp, border: `1px solid ${th.border}`, borderRadius: 6, color: th.textPrimary, fontSize: 12, padding: '6px 8px', outline: 'none', minWidth: 0 };
  const stop = (e: React.KeyboardEvent) => e.stopPropagation();
  const btn: React.CSSProperties = { border: 'none', borderRadius: 6, fontSize: 12, padding: '7px 12px', cursor: 'pointer' };
  const axes = [toAxis(n1, v1), toAxis(n2, v2)].filter((a) => a.name.trim() && a.values.length);
  const total = axes.reduce((t, a) => t * a.values.length, 1);
  return (
    <FloatingPopup title={`Variantes de "${componentName}"`} tokens={th} onClose={onClose} width={360} height={330}>
      <span style={{ fontSize: 10.5, color: th.textSecondary }}>Cada combinação dos eixos vira uma variante (cópia do componente, com os filhos).</span>
      <div style={{ display: 'grid', gridTemplateColumns: '110px 1fr', gap: 6 }}>
        <input value={n1} onChange={(e) => setN1(e.target.value)} onKeyDown={stop} placeholder="Eixo 1 (colunas)" style={input} />
        <input value={v1} onChange={(e) => setV1(e.target.value)} onKeyDown={stop} placeholder="Valores separados por vírgula" style={input} />
        <input value={n2} onChange={(e) => setN2(e.target.value)} onKeyDown={stop} placeholder="Eixo 2 (linhas)" style={input} />
        <input value={v2} onChange={(e) => setV2(e.target.value)} onKeyDown={stop} placeholder="Valores (opcional)" style={input} />
      </div>
      <span style={{ fontSize: 11, color: th.textSecondary }}>{axes.length ? `${total} variantes` : 'Informe ao menos um eixo'}</span>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" disabled={!axes.length} onClick={() => { onCreate(axes); onClose(); }} style={{ ...btn, background: accentColor, color: '#fff', opacity: axes.length ? 1 : 0.5 }}>Criar variantes</button>
        <button type="button" disabled={!hasGroup} onClick={() => { onArrange(); onClose(); }} title={hasGroup ? 'Reorganiza as variantes já existentes do grupo' : 'O componente não está em um grupo de variantes'} style={{ ...btn, background: th.bgApp, color: th.textPrimary, opacity: hasGroup ? 1 : 0.5 }}>Só organizar</button>
      </div>
    </FloatingPopup>
  );
}
