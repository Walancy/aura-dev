import React from 'react';
import { ShieldAlert, CircleDot } from 'lucide-react';
import type { RiskItem, StrategicRisk } from './types';

interface RiskMatrixViewProps {
  risks: RiskItem[];
  strategicRisks: StrategicRisk[];
  onOpenIssue?: (issue: any) => void;
  onEditStrategicRisk?: (risk: StrategicRisk) => void;
  theme: any;
  isEffectiveDark: boolean;
  accentColor: string;
}

type ImpactLevel = 'high' | 'medium' | 'low';
type ProbLevel = 'low' | 'medium' | 'high';

interface CellItem {
  id: string;
  title: string;
  type: 'issue' | 'strategic';
  severity: 'low' | 'medium' | 'high' | 'critical';
  categoryLabel: string;
  data: RiskItem | StrategicRisk;
}

const IMPACT_ROWS: { key: ImpactLevel; label: string; desc: string }[] = [
  { key: 'high', label: 'Alto', desc: 'Impacto severo no cronograma' },
  { key: 'medium', label: 'Médio', desc: 'Atrasos moderados' },
  { key: 'low', label: 'Baixo', desc: 'Impacto pontual' },
];

const PROB_COLS: { key: ProbLevel; label: string }[] = [
  { key: 'low', label: 'Baixa' },
  { key: 'medium', label: 'Média' },
  { key: 'high', label: 'Alta' },
];

function getCellRiskLevel(impact: ImpactLevel, prob: ProbLevel): {
  label: string;
  bg: string;
  text: string;
} {
  if (impact === 'high' && prob === 'high') {
    return { label: 'Extremo', bg: 'rgba(239, 68, 68, 0.14)', text: '#ef4444' };
  }
  if ((impact === 'high' && prob === 'medium') || (impact === 'medium' && prob === 'high')) {
    return { label: 'Alto', bg: 'rgba(249, 115, 22, 0.14)', text: '#f97316' };
  }
  if (
    (impact === 'high' && prob === 'low') ||
    (impact === 'medium' && prob === 'medium') ||
    (impact === 'low' && prob === 'high')
  ) {
    return { label: 'Médio', bg: 'rgba(234, 179, 8, 0.14)', text: '#eab308' };
  }
  return { label: 'Baixo', bg: 'rgba(34, 197, 94, 0.14)', text: '#22c55e' };
}

export const RiskMatrixView: React.FC<RiskMatrixViewProps> = ({
  risks,
  strategicRisks,
  onOpenIssue,
  onEditStrategicRisk,
  theme,
  isEffectiveDark,
}) => {
  const textPrimary = isEffectiveDark ? '#ffffff' : '#111111';
  const textSecondary = isEffectiveDark ? '#888888' : '#777777';
  const cardBg = isEffectiveDark ? '#141414' : '#ffffff';
  const cardHoverBg = isEffectiveDark ? '#242424' : '#f0f0f0';
  const headerBg = isEffectiveDark ? '#1c1c1c' : '#fafafa';

  // Organizar itens por célula [impact][prob]
  const itemsByCell: Record<string, CellItem[]> = {};

  risks.forEach((r) => {
    const key = `${r.impact}-${r.probability}`;
    if (!itemsByCell[key]) itemsByCell[key] = [];
    itemsByCell[key].push({
      id: r.id,
      title: r.title,
      type: 'issue',
      severity: r.severity,
      categoryLabel: r.category === 'deadline' ? 'Prazo' : r.category === 'blocker' ? 'Bloqueio' : 'Alocação',
      data: r,
    });
  });

  strategicRisks.forEach((sr) => {
    const key = `${sr.impact}-${sr.probability}`;
    if (!itemsByCell[key]) itemsByCell[key] = [];
    itemsByCell[key].push({
      id: sr.id,
      title: sr.title,
      type: 'strategic',
      severity: sr.impact === 'high' ? 'high' : sr.impact === 'medium' ? 'medium' : 'low',
      categoryLabel: sr.category,
      data: sr,
    });
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {/* Guia de Legenda sem bordas */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 12px',
          borderRadius: 8,
          background: cardBg,
          border: 'none',
          boxShadow: 'none',
          flexWrap: 'wrap',
          gap: 10,
        }}
      >
        <div style={{ fontSize: 11, fontWeight: 400, color: textSecondary, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Matriz de Riscos
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: '#22c55e' }} />
            <span style={{ color: textSecondary, fontWeight: 400 }}>Baixo</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: '#eab308' }} />
            <span style={{ color: textSecondary, fontWeight: 400 }}>Médio</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: '#f97316' }} />
            <span style={{ color: textSecondary, fontWeight: 400 }}>Alto</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11 }}>
            <span style={{ width: 7, height: 7, borderRadius: 2, background: '#ef4444' }} />
            <span style={{ color: textSecondary, fontWeight: 400 }}>Extremo</span>
          </div>
        </div>
      </div>

      {/* Grid da Matriz */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '80px repeat(3, 1fr)',
          gap: 6,
          boxSizing: 'border-box',
        }}
      >
        {/* Canto Vazio */}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 6px 4px' }}>
          <span style={{ fontSize: 9.5, fontWeight: 400, color: textSecondary, textTransform: 'uppercase' }}>
            Impacto
          </span>
        </div>

        {/* Cabeçalhos das Colunas */}
        {PROB_COLS.map((col) => (
          <div
            key={col.key}
            style={{
              textAlign: 'center',
              padding: '6px 0',
              borderRadius: 6,
              background: headerBg,
              fontSize: 11,
              fontWeight: 400,
              color: textPrimary,
              border: 'none',
            }}
          >
            {col.label}
          </div>
        ))}

        {/* Linhas da Matriz */}
        {IMPACT_ROWS.map((row) => (
          <React.Fragment key={row.key}>
            {/* Rótulo da Linha */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '6px',
                borderRadius: 6,
                background: headerBg,
                border: 'none',
                textAlign: 'center',
              }}
            >
              <span style={{ fontSize: 12, fontWeight: 400, color: textPrimary }}>{row.label}</span>
              <span style={{ fontSize: 9, color: textSecondary, marginTop: 2, lineHeight: 1.1, fontWeight: 400 }}>{row.desc}</span>
            </div>

            {/* Células sem bordas */}
            {PROB_COLS.map((col) => {
              const cellLevel = getCellRiskLevel(row.key, col.key);
              const cellItems = itemsByCell[`${row.key}-${col.key}`] || [];

              return (
                <div
                  key={`${row.key}-${col.key}`}
                  style={{
                    minHeight: 110,
                    borderRadius: 8,
                    background: cellLevel.bg,
                    border: 'none',
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    position: 'relative',
                  }}
                >
                  {/* Badge do Nível */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 400,
                        color: cellLevel.text,
                        textTransform: 'uppercase',
                        letterSpacing: 0.4,
                      }}
                    >
                      {cellLevel.label}
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 400,
                        color: cellLevel.text,
                        background: isEffectiveDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.6)',
                        padding: '1px 5px',
                        borderRadius: 8,
                      }}
                    >
                      {cellItems.length}
                    </span>
                  </div>

                  {/* Cards dos Itens */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      maxHeight: 160,
                      overflowY: 'auto',
                    }}
                  >
                    {cellItems.length === 0 ? (
                      <div
                        style={{
                          fontSize: 10.5,
                          color: textSecondary,
                          fontStyle: 'italic',
                          opacity: 0.5,
                          textAlign: 'center',
                          marginTop: 16,
                        }}
                      >
                        Nenhum risco
                      </div>
                    ) : (
                      cellItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => {
                            if (item.type === 'issue') {
                              const issue = (item.data as RiskItem).issue;
                              if (issue && onOpenIssue) onOpenIssue(issue);
                            } else {
                              if (onEditStrategicRisk) onEditStrategicRisk(item.data as StrategicRisk);
                            }
                          }}
                          style={{
                            background: cardBg,
                            borderRadius: 5,
                            padding: '5px 7px',
                            border: 'none',
                            boxShadow: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            transition: 'background 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = cardHoverBg)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = cardBg)}
                          title={item.title}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            {item.type === 'issue' ? (
                              <CircleDot size={11} color={cellLevel.text} style={{ flexShrink: 0 }} />
                            ) : (
                              <ShieldAlert size={11} color={cellLevel.text} style={{ flexShrink: 0 }} />
                            )}
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 400,
                                color: textPrimary,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                flex: 1,
                              }}
                            >
                              {item.title}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span
                              style={{
                                fontSize: 9,
                                color: textSecondary,
                                background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                                padding: '1px 4px',
                                borderRadius: 3,
                              }}
                            >
                              {item.categoryLabel}
                            </span>
                            {item.type === 'issue' && (item.data as RiskItem).issue && (
                              <span style={{ fontSize: 9, color: textSecondary, fontFamily: 'monospace' }}>
                                #{(item.data as RiskItem).issue?.id}
                              </span>
                            )}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
