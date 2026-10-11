import { useMemo } from 'react';
import FloatingPopup from './FloatingPopup';
import { auditDesign, type AuditIssue } from './audit';
import type { DesignStyle, DesignVariable, Shape } from './types';

interface Props {
  tokens: Record<string, any>;
  accentColor: string;
  shapes: Shape[];
  styles: DesignStyle[];
  variables: DesignVariable[];
  modeId: string;
  names: Record<string, string>;
  onSelect: (shapeId: string) => void;
  onFix: (issues: AuditIssue[]) => void;
  onClose: () => void;
}

const COLOR = { error: '#f24822', warning: '#f5a623', info: '#4f9dff' } as const;
const KIND: Record<AuditIssue['kind'], string> = { contrast: 'Contraste', 'small-text': 'Texto pequeno', touch: 'Alvo de toque', 'drift-color': 'Cor fora do sistema', 'drift-font': 'Tipografia' };

/** Revisão do design: contraste, texto pequeno, alvos de toque e desvio do sistema; clique seleciona, "Corrigir" aplica */
export default function AuditPopup({ tokens: th, accentColor, shapes, styles, variables, modeId, names, onSelect, onFix, onClose }: Props) {
  const issues = useMemo(() => auditDesign(shapes, styles, variables, modeId), [shapes, styles, variables, modeId]);
  const fixable = issues.filter((i) => i.fix);
  return (
    <FloatingPopup title={`Revisão · ${issues.length} ${issues.length === 1 ? 'ponto' : 'pontos'}`} tokens={th} onClose={onClose} width={380} height={460}>
      {issues.length === 0 && <span style={{ fontSize: 12, color: th.textSecondary }}>Nada a corrigir nesta página.</span>}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4 }}>
        {issues.map((i) => (
          <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, background: th.bgApp }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLOR[i.severity], flexShrink: 0 }} />
            <button type="button" onClick={() => onSelect(i.shapeId)} title="Selecionar o elemento" style={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 'none', color: th.textPrimary, cursor: 'pointer', padding: 0 }}>
              <div style={{ fontSize: 11.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{names[i.shapeId] || 'Elemento'} · {KIND[i.kind]}</div>
              <div style={{ fontSize: 10.5, color: th.textSecondary }}>{i.message}</div>
            </button>
            {i.fix && (
              <button type="button" onClick={() => onFix([i])} title={i.fix.label} style={{ background: accentColor, border: 'none', borderRadius: 5, color: '#fff', fontSize: 10.5, padding: '3px 8px', cursor: 'pointer', flexShrink: 0 }}>
                Corrigir
              </button>
            )}
          </div>
        ))}
      </div>
      {fixable.length > 1 && (
        <button type="button" onClick={() => onFix(fixable)} style={{ background: accentColor, border: 'none', borderRadius: 6, color: '#fff', fontSize: 12, padding: '7px 12px', cursor: 'pointer' }}>
          Corrigir tudo ({fixable.length})
        </button>
      )}
    </FloatingPopup>
  );
}
