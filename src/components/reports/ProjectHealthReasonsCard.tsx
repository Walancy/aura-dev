import React, { useEffect, useMemo } from 'react';
import { Activity, CheckCircle2, AlertTriangle, AlertCircle, ArrowUpRight } from 'lucide-react';
import { logSystemActivity } from '../../utils/brainService';

export interface ProjectHealthReasonsCardProps {
  healthScore: number;
  total: number;
  done: number;
  inProgress: number;
  todo: number;
  completionPercent: number;
  bugCount: number;
  bugRate: number;
  isEffectiveDark: boolean;
  c: {
    card: string;
    cardSecondary: string;
    cardHover: string;
    divider: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    success: string;
    successBg: string;
    warning: string;
    warningBg: string;
    danger: string;
    dangerBg: string;
  };
  projectName?: string;
}

export const ProjectHealthReasonsCard: React.FC<ProjectHealthReasonsCardProps> = ({
  healthScore,
  total,
  done,
  inProgress,
  todo,
  completionPercent,
  bugCount,
  bugRate,
  isEffectiveDark,
  c,
  projectName,
}) => {
  // Log da visualização da composição de saúde
  useEffect(() => {
    logSystemActivity('reports', 'view_project_health_reasons', projectName || 'Projeto', {
      healthScore,
      total,
      done,
      inProgress,
      bugCount,
      bugRate,
    });
  }, [projectName, healthScore, total, done, inProgress, bugCount, bugRate]);

  // Cálculo decomposto dos três pilares da saúde do projeto
  const breakdown = useMemo(() => {
    const isAlert = healthScore < 60;
    const isStable = healthScore >= 60 && healthScore < 80;
    const isExcellent = healthScore >= 80;

    const statusLabel = isExcellent ? 'Excelente' : isStable ? 'Estável' : 'Alerta';
    const statusColor = isExcellent ? c.success : isStable ? c.warning : c.danger;
    const statusBadgeBg = isAlert
      ? (isEffectiveDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.14)')
      : isStable
      ? (isEffectiveDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.14)')
      : (isEffectiveDark ? 'rgba(16, 185, 129, 0.22)' : 'rgba(16, 185, 129, 0.14)');
    const statusBadgeText = isAlert
      ? (isEffectiveDark ? '#ffffff' : '#991b1b')
      : isStable
      ? (isEffectiveDark ? '#ffffff' : '#92400e')
      : (isEffectiveDark ? '#ffffff' : '#065f46');

    // 1. Pilar Conclusão de Tarefas (Peso 40%)
    const completionPts = Math.round(completionPercent * 0.4);
    let completionReason = '';
    let completionStatus: 'success' | 'warning' | 'danger' = 'success';
    if (total === 0) {
      completionReason = 'Nenhuma tarefa cadastrada no projeto para avaliar entregas.';
      completionStatus = 'warning';
    } else if (completionPercent === 0) {
      completionReason = `Nenhuma tarefa finalizada no escopo (0 de ${total} tarefas entregues). É o principal fator de redução da pontuação.`;
      completionStatus = 'danger';
    } else if (completionPercent < 50) {
      completionReason = `Ritmo de entrega parcial com ${done} de ${total} tarefas finalizadas (${completionPercent}%).`;
      completionStatus = 'warning';
    } else {
      completionReason = `Vazão consistente com ${done} de ${total} tarefas concluídas (${completionPercent}%).`;
      completionStatus = 'success';
    }

    // 2. Pilar Estabilidade & Defeitos (Peso 35%)
    const bugScoreVal = Math.max(0, 100 - bugRate * 2.2);
    const bugPts = Math.round(bugScoreVal * 0.35);
    let bugReason = '';
    let bugStatus: 'success' | 'warning' | 'danger' = 'success';
    if (bugCount === 0) {
      bugReason = 'Zero bugs ou incidentes reportados. Estabilidade máxima preservada sem dívida técnica crítica.';
      bugStatus = 'success';
    } else if (bugRate <= 15) {
      bugReason = `Retrabalho sob controle com ${bugCount} bug${bugCount > 1 ? 's' : ''} (${bugRate}% do total).`;
      bugStatus = 'warning';
    } else {
      bugReason = `Incidência elevada de defeitos (${bugCount} bugs representando ${bugRate}% do total). Impacta a confiabilidade.`;
      bugStatus = 'danger';
    }

    // 3. Pilar Fluxo Ativo & WIP (Peso 25%)
    const balanceScoreVal =
      total > 0 ? Math.min(100, Math.round(((done + inProgress * 0.7) / total) * 100)) : 100;
    const balancePts = Math.round(balanceScoreVal * 0.25);
    let balanceReason = '';
    let balanceStatus: 'success' | 'warning' | 'danger' = 'success';
    if (total === 0) {
      balanceReason = 'Sem itens para verificação de andamento ativo.';
      balanceStatus = 'warning';
    } else if (inProgress === 0 && done === 0) {
      balanceReason = `Fluxo parado ou aguardando início (${todo} tarefa${todo > 1 ? 's' : ''} pendente${todo > 1 ? 's' : ''} sem atividade em andamento).`;
      balanceStatus = 'danger';
    } else if (inProgress > 0) {
      balanceReason = `Trabalho em desenvolvimento ativo com ${inProgress} tarefa${inProgress > 1 ? 's' : ''} em progresso.`;
      balanceStatus = 'success';
    } else {
      balanceReason = `Entregas concluídas sem sobrecarga de tarefas pendentes ou bloqueadas.`;
      balanceStatus = 'success';
    }

    // Diagnóstico executivo sintético
    let executiveDiagnosis = '';
    if (isAlert) {
      if (completionPercent === 0 && bugCount === 0) {
        executiveDiagnosis = `A saúde está em Alerta (${healthScore}%) pela ausência de entregas finalizadas (0% concluído) e nenhuma tarefa em progresso ativo. A qualidade técnica permanece estável sem defeitos.`;
      } else if (bugRate > 20) {
        executiveDiagnosis = `A saúde está em Alerta (${healthScore}%) devido ao alto índice de retrabalho com ${bugCount} defeito${bugCount > 1 ? 's' : ''} (${bugRate}%), além do ritmo de conclusão reduzido.`;
      } else {
        executiveDiagnosis = `A saúde está em Alerta (${healthScore}%) refletindo baixa vazão de entrega e retenção de fluxo no ciclo atual.`;
      }
    } else if (isStable) {
      executiveDiagnosis = `A saúde está Estável (${healthScore}%) com entregas equilibradas e taxa de defeitos gerenciada. Recomenda-se avançar tarefas em progresso para alcançar excelência.`;
    } else {
      executiveDiagnosis = `A saúde está Excelente (${healthScore}%), impulsionada pela alta taxa de conclusão das tarefas, ausência de bloqueios críticos e fluxo contínuo de trabalho.`;
    }

    return {
      statusLabel,
      statusColor,
      statusBadgeBg,
      statusBadgeText,
      executiveDiagnosis,
      pillars: [
        {
          id: 'completion',
          title: 'Conclusão de Tarefas',
          weightLabel: 'Peso 40%',
          points: completionPts,
          maxPoints: 40,
          valueDisplay: `${completionPercent}%`,
          progressPercent: completionPercent,
          status: completionStatus,
          reason: completionReason,
        },
        {
          id: 'quality',
          title: 'Estabilidade & Qualidade',
          weightLabel: 'Peso 35%',
          points: bugPts,
          maxPoints: 35,
          valueDisplay: bugCount === 0 ? '0 bugs' : `${bugCount} (${bugRate}%)`,
          progressPercent: bugScoreVal,
          status: bugStatus,
          reason: bugReason,
        },
        {
          id: 'flow',
          title: 'Fluxo Ativo & WIP',
          weightLabel: 'Peso 25%',
          points: balancePts,
          maxPoints: 25,
          valueDisplay: `${inProgress} em progresso`,
          progressPercent: balanceScoreVal,
          status: balanceStatus,
          reason: balanceReason,
        },
      ],
    };
  }, [
    healthScore,
    total,
    done,
    inProgress,
    todo,
    completionPercent,
    bugCount,
    bugRate,
    isEffectiveDark,
    c,
  ]);

  return (
    <div
      style={{
        background: c.card,
        borderRadius: 8,
        padding: 10,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        border: 'none',
        boxShadow: 'none',
      }}
    >
      {/* Cabeçalho do Card */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 10,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
          <Activity size={13} color={breakdown.statusColor} />
          <span
            style={{
              fontSize: 12,
              fontWeight: 400,
              color: c.textPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            Motivos da Saúde do Projeto
          </span>
        </div>

        {/* Badge da Saúde Geral */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 5,
            background: breakdown.statusBadgeBg,
            borderRadius: 4,
            padding: '2px 7px',
            border: 'none',
            boxShadow: 'none',
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 400,
              color: breakdown.statusBadgeText,
              lineHeight: 1.2,
            }}
          >
            {healthScore}%
          </span>
          <span
            style={{
              fontSize: 9.5,
              fontWeight: 400,
              color: breakdown.statusColor,
              lineHeight: 1.2,
            }}
          >
            {breakdown.statusLabel}
          </span>
        </div>
      </div>

      {/* Diagnóstico Executivo Geral */}
      <div
        style={{
          fontSize: 10.5,
          fontWeight: 400,
          color: c.textSecondary,
          lineHeight: 1.45,
          borderBottom: `1px solid ${c.divider}`,
          paddingBottom: 8,
        }}
      >
        {breakdown.executiveDiagnosis}
      </div>

      {/* Lista Decomposta dos Três Pilares */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {breakdown.pillars.map((pillar) => {
          const pillarColor =
            pillar.status === 'success'
              ? c.success
              : pillar.status === 'warning'
              ? c.warning
              : c.danger;

          const IconComponent =
            pillar.status === 'success'
              ? CheckCircle2
              : pillar.status === 'warning'
              ? AlertTriangle
              : AlertCircle;

          return (
            <div
              key={pillar.id}
              style={{
                background: c.cardSecondary,
                borderRadius: 6,
                padding: 8,
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                border: 'none',
                boxShadow: 'none',
                transition: 'background 0.15s ease',
              }}
            >
              {/* Linha Superior do Pilar */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <IconComponent size={12} color={pillarColor} />
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 400,
                      color: c.textPrimary,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {pillar.title}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      fontWeight: 400,
                      color: c.textMuted,
                      background: isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 0, 0, 0.04)',
                      borderRadius: 3,
                      padding: '1px 4px',
                      flexShrink: 0,
                    }}
                  >
                    {pillar.weightLabel}
                  </span>
                </div>

                {/* Itens da Direita: Métrica + Score/Pontos */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 400,
                      color: c.textPrimary,
                      background: isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(0, 0, 0, 0.05)',
                      padding: '2px 6px',
                      borderRadius: 4,
                      lineHeight: 1.2,
                      display: 'inline-flex',
                      alignItems: 'center',
                      border: 'none',
                      boxShadow: 'none',
                      transition: 'background 0.15s ease, color 0.15s ease',
                    }}
                  >
                    {pillar.valueDisplay}
                  </span>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 400,
                      color: pillarColor,
                      background:
                        pillar.status === 'success'
                          ? (isEffectiveDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)')
                          : pillar.status === 'warning'
                          ? (isEffectiveDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.12)')
                          : (isEffectiveDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.12)'),
                      padding: '2px 6px',
                      borderRadius: 4,
                      lineHeight: 1.2,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 2,
                      border: 'none',
                      boxShadow: 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span style={{ fontWeight: 400 }}>{pillar.points}</span>
                    <span style={{ opacity: 0.65, fontSize: 8.5 }}>/{pillar.maxPoints} pts</span>
                  </span>
                </div>
              </div>

              {/* Barra de Progresso do Pilar */}
              <div
                style={{
                  height: 3.5,
                  borderRadius: 2,
                  background: isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.06)'
                    : 'rgba(0, 0, 0, 0.06)',
                  overflow: 'hidden',
                  border: 'none',
                  boxShadow: 'none',
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${Math.min(100, Math.max(0, pillar.progressPercent))}%`,
                    background: pillarColor,
                    borderRadius: 2,
                    transition: 'width 0.3s ease',
                  }}
                />
              </div>

              {/* Justificativa Detalhada */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 400,
                  color: c.textSecondary,
                  lineHeight: 1.4,
                }}
              >
                {pillar.reason}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
