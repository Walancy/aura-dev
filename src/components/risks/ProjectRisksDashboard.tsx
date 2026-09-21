import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  Clock,
  Link2,
  Users,
  Shield,
  Plus,
  Edit2,
  Trash2,
  ArrowRight,
  UserX,
  ChevronDown,
  ExternalLink,
} from 'lucide-react';
import type { ProjectIssue } from '../ProjectsSchedulerView';
import type { RiskItem, StrategicRisk, ProjectHealthMetrics } from './types';
import { StrategicRiskModal } from './StrategicRiskModal';
import { RiskMatrixView } from './RiskMatrixView';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';

interface ProjectRisksDashboardProps {
  issues: ProjectIssue[];
  sprints?: any[];
  collaborators?: any[];
  repoName: string;
  theme: any;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  onOpenIssueDetail?: (issue: ProjectIssue) => void;
  onReassignTask?: (issue: ProjectIssue) => void;
  showToast?: (msg: string) => void;
}

type RiskViewMode = 'alerts' | 'matrix' | 'strategic';
type FilterCategory = 'all' | 'critical' | 'deadline' | 'blocker' | 'workload' | 'strategic';

export const ProjectRisksDashboard: React.FC<ProjectRisksDashboardProps> = ({
  issues = [],
  collaborators = [],
  repoName = 'repositório',
  theme,
  isEffectiveDark,
  accentColor,
  accentContrastText,
  onOpenIssueDetail,
  onReassignTask,
  showToast = (msg: string) => console.log(msg),
}) => {
  const [viewMode, setViewMode] = useState<RiskViewMode>('alerts');
  const [activeFilter, setActiveFilter] = useState<FilterCategory>('all');
  const [strategicRisks, setStrategicRisks] = useState<StrategicRisk[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStrategicRisk, setEditingStrategicRisk] = useState<StrategicRisk | null>(null);
  const [deletingRisk, setDeletingRisk] = useState<StrategicRisk | null>(null);

  const storageKey = `devflow_strategic_risks_${repoName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        setStrategicRisks(JSON.parse(saved));
      } else {
        const initialSample: StrategicRisk[] = [
          {
            id: 'strat-1',
            title: 'Homologação API Pagamentos',
            category: 'Terceiros',
            impact: 'high',
            probability: 'medium',
            mitigationPlan: 'Acompanhamento semanal com gateway e sandbox.',
            contingencyPlan: 'Fallback para checkout manual PIX.',
            status: 'Em Monitoramento',
            createdAtIso: new Date().toISOString(),
            updatedAtIso: new Date().toISOString(),
          },
        ];
        setStrategicRisks(initialSample);
        localStorage.setItem(storageKey, JSON.stringify(initialSample));
      }
    } catch (e) {
      console.error('Erro ao carregar riscos estratégicos:', e);
    }
  }, [storageKey]);

  const saveStrategicRisks = (newList: StrategicRisk[]) => {
    setStrategicRisks(newList);
    try {
      localStorage.setItem(storageKey, JSON.stringify(newList));
    } catch (e) {
      console.error('Erro ao salvar riscos estratégicos:', e);
    }
  };

  const handleCreateOrUpdateRisk = (
    data: Omit<StrategicRisk, 'id' | 'createdAtIso' | 'updatedAtIso'>,
    editingId?: string
  ) => {
    const now = new Date().toISOString();
    if (editingId) {
      const updated = strategicRisks.map((r) =>
        r.id === editingId ? { ...r, ...data, updatedAtIso: now } : r
      );
      saveStrategicRisks(updated);
      showToast('Risco atualizado.');
    } else {
      const newRisk: StrategicRisk = {
        ...data,
        id: `strat-${Date.now()}`,
        createdAtIso: now,
        updatedAtIso: now,
      };
      saveStrategicRisks([newRisk, ...strategicRisks]);
      showToast('Risco cadastrado.');
    }
    setEditingStrategicRisk(null);
  };

  const handleConfirmDeleteRisk = () => {
    if (!deletingRisk) return;
    const filtered = strategicRisks.filter((r) => r.id !== deletingRisk.id);
    saveStrategicRisks(filtered);
    setDeletingRisk(null);
    showToast('Risco excluído.');
  };

  // Motor de Detecção
  const { autoRisks, metrics } = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const risksList: RiskItem[] = [];
    const deductions: { reason: string; points: number }[] = [];

    let overdueCount = 0;
    let blockedCount = 0;
    let workloadBottlenecksCount = 0;
    let unassignedCriticalCount = 0;
    let staleCount = 0;

    const formatTitle = (issue: ProjectIssue) => {
      const clean = (issue.title || '').replace(/^#+\s*/, '').trim();
      return `#${issue.id} ${clean}`;
    };

    // 1. Prazos
    issues.forEach((issue) => {
      const isDone = issue.status === 'Concluído' || issue.rawState === 'closed';
      if (!isDone && issue.dueDateIso && issue.dueDateIso < today) {
        overdueCount++;
        risksList.push({
          id: `risk-overdue-${issue.id}`,
          title: formatTitle(issue),
          description: `Vencida em ${issue.dueDateIso}. Status: ${issue.status}.`,
          severity: issue.priority === 'Urgente' ? 'critical' : 'high',
          category: 'deadline',
          impact: issue.priority === 'Urgente' ? 'high' : 'medium',
          probability: 'high',
          scoreDeduction: 10,
          issue,
          actionType: 'view_issue',
          actionLabel: 'Abrir',
          suggestedAction: 'Repactuar prazo ou priorizar.',
        });
      }
    });

    if (overdueCount > 0) {
      deductions.push({
        reason: `${overdueCount} ${overdueCount === 1 ? 'prazo estourado' : 'prazos estourados'}`,
        points: Math.min(30, overdueCount * 10),
      });
    }

    // 2. Bloqueios
    issues.forEach((issue) => {
      const isDone = issue.status === 'Concluído' || issue.rawState === 'closed';
      const hasBlocker =
        (issue.description && /blocked\s+by|bloquead[oa]\s+por/i.test(issue.description)) ||
        (issue.rawLabels && issue.rawLabels.some((l) => /bloquead[oa]|blocked/i.test(l)));

      if (!isDone && hasBlocker) {
        blockedCount++;
        risksList.push({
          id: `risk-blocker-${issue.id}`,
          title: formatTitle(issue),
          description: 'Aguardando liberação de dependência.',
          severity: 'high',
          category: 'blocker',
          impact: 'high',
          probability: 'high',
          scoreDeduction: 8,
          issue,
          actionType: 'view_issue',
          actionLabel: 'Abrir',
          suggestedAction: 'Acompanhar resolução da pendência.',
        });
      }
    });

    if (blockedCount > 0) {
      deductions.push({
        reason: `${blockedCount} ${blockedCount === 1 ? 'bloqueio ativo' : 'bloqueios ativos'}`,
        points: Math.min(24, blockedCount * 8),
      });
    }

    // 3. Tarefas Urgentes sem responsável
    issues.forEach((issue) => {
      const isDone = issue.status === 'Concluído' || issue.rawState === 'closed';
      const isHighPriority = issue.priority === 'Urgente' || issue.priority === 'Alta';
      const isUnassigned = !issue.assignees || issue.assignees.length === 0;

      if (!isDone && isHighPriority && isUnassigned) {
        unassignedCriticalCount++;
        risksList.push({
          id: `risk-unassigned-${issue.id}`,
          title: formatTitle(issue),
          description: `Prioridade ${issue.priority} sem responsável.`,
          severity: issue.priority === 'Urgente' ? 'critical' : 'high',
          category: 'unassigned',
          impact: 'high',
          probability: 'medium',
          scoreDeduction: 8,
          issue,
          actionType: 'reassign',
          actionLabel: 'Atribuir',
          suggestedAction: 'Alocar responsável.',
        });
      }
    });

    if (unassignedCriticalCount > 0) {
      deductions.push({
        reason: `${unassignedCriticalCount} ${unassignedCriticalCount === 1 ? 'urgente sem responsável' : 'urgentes sem responsável'}`,
        points: Math.min(24, unassignedCriticalCount * 8),
      });
    }

    // 4. Sobrecarga
    const inProgressByUser: Record<string, ProjectIssue[]> = {};
    issues.forEach((issue) => {
      if (issue.status === 'Em Progresso') {
        const login = issue.assignees && issue.assignees[0]?.name;
        if (login) {
          if (!inProgressByUser[login]) inProgressByUser[login] = [];
          inProgressByUser[login].push(issue);
        }
      }
    });

    Object.entries(inProgressByUser).forEach(([login, userIssues]) => {
      if (userIssues.length >= 4) {
        workloadBottlenecksCount++;
        risksList.push({
          id: `risk-workload-${login}`,
          title: `@${login}: ${userIssues.length} em andamento`,
          description: 'Carga concentrada com risco de atraso.',
          severity: userIssues.length >= 6 ? 'critical' : 'medium',
          category: 'workload',
          impact: 'high',
          probability: 'high',
          scoreDeduction: 7,
          collaboratorLogin: login,
          actionType: 'reassign',
          actionLabel: 'Reatribuir',
          suggestedAction: 'Redistribuir demandas.',
        });
      }
    });

    if (workloadBottlenecksCount > 0) {
      deductions.push({
        reason: `${workloadBottlenecksCount} ${workloadBottlenecksCount === 1 ? 'membro sobrecarregado' : 'membros sobrecarregados'}`,
        points: Math.min(20, workloadBottlenecksCount * 7),
      });
    }

    // 5. Estagnadas
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    issues.forEach((issue) => {
      if (issue.status === 'Em Progresso' && issue.createdAtIso && issue.createdAtIso < fourteenDaysAgo) {
        staleCount++;
        risksList.push({
          id: `risk-stale-${issue.id}`,
          title: formatTitle(issue),
          description: 'Em andamento há mais de 14 dias.',
          severity: 'low',
          category: 'stale',
          impact: 'medium',
          probability: 'low',
          scoreDeduction: 4,
          issue,
          actionType: 'view_issue',
          actionLabel: 'Abrir',
          suggestedAction: 'Revisar status com responsável.',
        });
      }
    });

    if (staleCount > 0) {
      deductions.push({
        reason: `${staleCount} ${staleCount === 1 ? 'tarefa estagnada' : 'tarefas estagnadas'}`,
        points: Math.min(16, staleCount * 4),
      });
    }

    const totalDeduction = deductions.reduce((acc, d) => acc + d.points, 0);
    const score = Math.max(15, Math.min(100, 100 - totalDeduction));

    let level: 'excellent' | 'good' | 'warning' | 'critical' = 'excellent';
    let label = 'Risco Mínimo';
    let color = '#22c55e';

    if (score < 50) {
      level = 'critical';
      label = 'Crítico';
      color = '#ef4444';
    } else if (score < 70) {
      level = 'warning';
      label = 'Risco Alto';
      color = '#f97316';
    } else if (score < 90) {
      level = 'good';
      label = 'Risco Moderado';
      color = '#eab308';
    }

    const calculatedMetrics: ProjectHealthMetrics = {
      score,
      level,
      label,
      color,
      overdueCount,
      blockedCount,
      workloadBottlenecksCount,
      unassignedCriticalCount,
      staleCount,
      totalRisksCount: risksList.length,
      deductions,
    };

    return { autoRisks: risksList, metrics: calculatedMetrics };
  }, [issues]);

  const filteredAlerts = useMemo(() => {
    if (activeFilter === 'all') return autoRisks;
    if (activeFilter === 'critical') return autoRisks.filter((r) => r.severity === 'critical');
    if (activeFilter === 'deadline') return autoRisks.filter((r) => r.category === 'deadline');
    if (activeFilter === 'blocker') return autoRisks.filter((r) => r.category === 'blocker');
    if (activeFilter === 'workload') return autoRisks.filter((r) => r.category === 'workload' || r.category === 'unassigned');
    return autoRisks;
  }, [autoRisks, activeFilter]);

  const criticalCount = useMemo(() => autoRisks.filter((r) => r.severity === 'critical').length, [autoRisks]);
  const deadlineCount = useMemo(() => autoRisks.filter((r) => r.category === 'deadline').length, [autoRisks]);
  const blockerCount = useMemo(() => autoRisks.filter((r) => r.category === 'blocker').length, [autoRisks]);
  const workloadCount = useMemo(
    () => autoRisks.filter((r) => r.category === 'workload' || r.category === 'unassigned').length,
    [autoRisks]
  );

  const canvasBg = theme.viewCanvasBg || (isEffectiveDark ? '#141414' : '#f8fafc');
  const cardBg = theme.viewCardBg || (isEffectiveDark ? '#181818' : '#ffffff');
  const cardHoverBg = theme.viewCardHoverBg || (isEffectiveDark ? '#242424' : '#f1f5f9');
  const textPrimary = theme.textPrimary || (isEffectiveDark ? '#ffffff' : '#0f172a');
  const textSecondary = theme.textSecondary || (isEffectiveDark ? '#888888' : '#64748b');

  // Métricas adicionais para os 2 novos cards da coluna lateral
  const sideCardStats = useMemo(() => {
    const totalIssues = issues.length;
    const closedIssues = issues.filter((i) => i.status === 'Concluído' || i.rawState === 'closed').length;
    const openIssues = totalIssues - closedIssues;
    const inProgressIssues = issues.filter((i) => i.status === 'Em Progresso').length;
    const urgentCount = issues.filter(
      (i) => (i.priority === 'Urgente' || i.priority === 'Alta') && i.status !== 'Concluído' && i.rawState !== 'closed'
    ).length;
    const unassignedCount = issues.filter(
      (i) => (!i.assignees || i.assignees.length === 0) && i.status !== 'Concluído' && i.rawState !== 'closed'
    ).length;
    const assignedCount = Math.max(0, openIssues - unassignedCount);
    const completionRate = totalIssues > 0 ? Math.round((closedIssues / totalIssues) * 100) : 0;
    const assignmentRate = openIssues > 0 ? Math.round((assignedCount / openIssues) * 100) : 100;

    const activeCollaborators = new Set<string>();
    issues.forEach((i) => {
      if (i.status !== 'Concluído' && i.rawState !== 'closed' && i.assignees && i.assignees[0]?.name) {
        activeCollaborators.add(i.assignees[0].name);
      }
    });

    return {
      totalIssues,
      closedIssues,
      openIssues,
      inProgressIssues,
      urgentCount,
      unassignedCount,
      completionRate,
      assignmentRate,
      activeCollaboratorsCount: activeCollaborators.size,
    };
  }, [issues]);

  return (
    <>
      <div
        style={{
          width: '100%',
          display: 'flex',
          flexDirection: 'row',
          gap: 5,
          alignItems: 'start',
          boxSizing: 'border-box',
          fontWeight: 400,
          flex: 1,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* COLUNA ESQUERDA: CARD DE SAÚDE + 2 CARDS ADICIONAIS COM DADOS */}
        <div
          style={{
            width: 'clamp(280px, 28%, 340px)',
            minWidth: 280,
            maxWidth: 340,
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            alignSelf: 'start',
            flexShrink: 0,
            flexGrow: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* 1. HERO CARD: SAÚDE DO PROJETO */}
          <div
            style={{
              width: '100%',
              background: accentColor,
              borderRadius: 8,
              border: 'none',
              padding: '18px 20px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              height: 'fit-content',
              minHeight: 'fit-content',
              maxHeight: 'none',
              alignSelf: 'start',
              flexShrink: 0,
              flexGrow: 0,
              boxShadow: '0 4px 14px rgba(0,0,0,0.12)',
              gap: 14,
              color: '#ffffff',
              boxSizing: 'border-box',
            }}
          >
            {/* Topo do Hero */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: 10.5,
                    fontWeight: 400,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: 'rgba(255, 255, 255, 0.85)',
                  }}
                >
                  Saúde do Projeto
                </span>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 400,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: 'rgba(0, 0, 0, 0.22)',
                    color: '#ffffff',
                  }}
                >
                  {metrics.label}
                </span>
              </div>

              {/* Número em Fonte Regular */}
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 8 }}>
                <span
                  style={{
                    fontSize: 44,
                    fontWeight: 400,
                    lineHeight: 1,
                    color: '#ffffff',
                    letterSpacing: -1,
                  }}
                >
                  {metrics.score}%
                </span>
                <span style={{ fontSize: 12, color: 'rgba(255, 255, 255, 0.85)', fontWeight: 400 }}>
                  {metrics.totalRisksCount} pendências
                </span>
              </div>
            </div>

            {/* Grid Interno 2x2 com Métricas Monitoradas */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: 8,
                padding: '10px 0',
                borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                borderBottom: '1px solid rgba(255, 255, 255, 0.2)',
              }}
            >
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255, 255, 255, 0.8)', fontWeight: 400 }}>Atrasos</div>
                <div style={{ fontSize: 15, fontWeight: 400, color: '#ffffff', marginTop: 2 }}>
                  {metrics.overdueCount}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255, 255, 255, 0.8)', fontWeight: 400 }}>Bloqueios</div>
                <div style={{ fontSize: 15, fontWeight: 400, color: '#ffffff', marginTop: 2 }}>
                  {metrics.blockedCount}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255, 255, 255, 0.8)', fontWeight: 400 }}>Gargalos</div>
                <div style={{ fontSize: 15, fontWeight: 400, color: '#ffffff', marginTop: 2 }}>
                  {metrics.workloadBottlenecksCount}
                </div>
              </div>
              <div>
                <div style={{ fontSize: 10.5, color: 'rgba(255, 255, 255, 0.8)', fontWeight: 400 }}>Estagnadas</div>
                <div style={{ fontSize: 15, fontWeight: 400, color: '#ffffff', marginTop: 2 }}>
                  {metrics.staleCount}
                </div>
              </div>
            </div>

            {/* Deduções Ativas */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontSize: 10.5, fontWeight: 400, color: 'rgba(255, 255, 255, 0.85)', textTransform: 'uppercase', letterSpacing: 0.3 }}>
                Deduções do Score
              </span>
              {metrics.deductions.length === 0 ? (
                <span style={{ fontSize: 11.5, color: '#ffffff', fontWeight: 400 }}>Tudo em dia</span>
              ) : (
                metrics.deductions.map((d, i) => (
                  <div
                    key={i}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 11,
                      color: 'rgba(255, 255, 255, 0.9)',
                      fontWeight: 400,
                    }}
                  >
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {d.reason}
                    </span>
                    <span style={{ background: 'rgba(0, 0, 0, 0.22)', padding: '1px 6px', borderRadius: 4, color: '#ffffff', fontWeight: 400, flexShrink: 0, marginLeft: 8 }}>
                      -{d.points}%
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 2. CARD DE DADOS: DEMANDAS & CONTAS (ESTILO BANK ACCOUNTS QUICKBOOKS) */}
          <div
            style={{
              width: '100%',
              background: isEffectiveDark ? '#141416' : theme.bgShelf,
              borderRadius: 10,
              border: theme.shelfBorder,
              boxShadow: theme.shelfShadow,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              boxSizing: 'border-box',
              color: textPrimary,
              fontWeight: 400,
            }}
          >
            {/* Header: Título + Botões de ação quadrados finos */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13.5, fontWeight: 400, color: textPrimary, letterSpacing: -0.2 }}>
                Demandas
              </span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: textSecondary,
                    cursor: 'pointer',
                  }}
                  title="Editar fluxo"
                >
                  <Edit2 size={11} />
                </div>
                <div
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: textSecondary,
                    cursor: 'pointer',
                  }}
                  title="Visualizar repositório"
                >
                  <ExternalLink size={11} />
                </div>
              </div>
            </div>

            {/* Seção 1: Item Principal (Sprint Ativo) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11.5, color: textPrimary, fontWeight: 400 }}>
                  Sprint Ativo
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    cursor: 'pointer',
                  }}
                >
                  Atualizado hoje <ChevronDown size={11} />
                </span>
              </div>

              {/* Número Gigante + Medidor Circular Radial com Tag Neon */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 46 }}>
                <div>
                  <div style={{ fontSize: 34, fontWeight: 300, lineHeight: 1, color: textPrimary, letterSpacing: -1 }}>
                    {sideCardStats.openIssues}
                  </div>
                  <div style={{ fontSize: 11, color: textSecondary, marginTop: 4, fontWeight: 400 }}>
                    Tarefas a revisar
                  </div>
                </div>

                {/* Medidor Circular Radial com Tag de Destaque */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <div style={{ position: 'relative', width: 42, height: 42, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="42" height="42" viewBox="0 0 42 42">
                      <circle
                        cx="21"
                        cy="21"
                        r="16"
                        fill="none"
                        stroke={isEffectiveDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(0, 0, 0, 0.08)'}
                        strokeWidth="3.2"
                      />
                      <circle
                        cx="21"
                        cy="21"
                        r="16"
                        fill="none"
                        stroke="#d4f933"
                        strokeWidth="3.2"
                        strokeDasharray={100.5}
                        strokeDashoffset={100.5 - (100.5 * Math.min(100, Math.max(0, sideCardStats.completionRate))) / 100}
                        strokeLinecap="round"
                        transform="rotate(-90 21 21)"
                      />
                    </svg>
                    <span style={{ position: 'absolute', fontSize: 9.5, fontWeight: 400, color: textPrimary }}>
                      {sideCardStats.completionRate}%
                    </span>
                  </div>

                  <span
                    style={{
                      background: '#d4f933',
                      color: '#000000',
                      fontSize: 9.5,
                      fontWeight: 500,
                      padding: '2px 5px',
                      borderRadius: 2,
                      letterSpacing: -0.2,
                    }}
                  >
                    {sideCardStats.completionRate >= 50 ? `+${sideCardStats.completionRate}%` : `-${100 - sideCardStats.completionRate}%`}
                  </span>
                </div>
              </div>

              {/* Sub-colunas 1 e 2 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  paddingTop: 8,
                  borderTop: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 17, fontWeight: 300, color: textPrimary, letterSpacing: -0.4 }}>
                    {sideCardStats.inProgressIssues}
                  </div>
                  <div style={{ fontSize: 10.5, color: textSecondary, marginTop: 2, fontWeight: 400 }}>
                    Em andamento
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 300, color: textPrimary, letterSpacing: -0.4 }}>
                    {sideCardStats.closedIssues}
                  </div>
                  <div style={{ fontSize: 10.5, color: textSecondary, marginTop: 2, fontWeight: 400 }}>
                    Concluídas
                  </div>
                </div>
              </div>
            </div>

            {/* Seção 2: Segundo Fluxo (Prioridade & Gargalos) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
                paddingTop: 12,
                borderTop: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 11.5, color: textPrimary, fontWeight: 400 }}>
                  Atenção Operacional
                </span>
                <span
                  style={{
                    fontSize: 10,
                    color: textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    cursor: 'pointer',
                  }}
                >
                  Monitorando <ChevronDown size={11} />
                </span>
              </div>

              {/* Número Gigante + Status Pill com Indicador de Gravidade */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', minHeight: 46 }}>
                <div>
                  <div style={{ fontSize: 34, fontWeight: 300, lineHeight: 1, color: textPrimary, letterSpacing: -1 }}>
                    {sideCardStats.urgentCount}
                  </div>
                  <div style={{ fontSize: 11, color: textSecondary, marginTop: 4, fontWeight: 400 }}>
                    Alta prioridade
                  </div>
                </div>

                {/* Badge de Alerta + Barrinhas de Severidade */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 5 }}>
                  <span
                    style={{
                      background: sideCardStats.unassignedCount > 0 ? '#f97316' : '#d4f933',
                      color: sideCardStats.unassignedCount > 0 ? '#ffffff' : '#000000',
                      fontSize: 9.5,
                      fontWeight: 500,
                      padding: '2px 6px',
                      borderRadius: 2,
                      letterSpacing: -0.2,
                    }}
                  >
                    {sideCardStats.unassignedCount > 0 ? `${sideCardStats.unassignedCount} s/ dono` : 'Estável'}
                  </span>

                  {/* Micro-barras de severidade operacional */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 3, width: 54, height: 4 }}>
                    <div
                      style={{
                        flex: 1,
                        height: '100%',
                        borderRadius: 1,
                        background: sideCardStats.urgentCount > 0 ? '#ef4444' : (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'),
                      }}
                      title="Prioridade urgente"
                    />
                    <div
                      style={{
                        flex: 1,
                        height: '100%',
                        borderRadius: 1,
                        background: metrics.staleCount > 0 ? '#eab308' : (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'),
                      }}
                      title="Estagnadas"
                    />
                    <div
                      style={{
                        flex: 1,
                        height: '100%',
                        borderRadius: 1,
                        background: sideCardStats.unassignedCount > 0 ? '#f97316' : '#d4f933',
                      }}
                      title="Sem responsável"
                    />
                  </div>
                </div>
              </div>

              {/* Sub-colunas 3 e 4 */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 12,
                  paddingTop: 8,
                  borderTop: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)'}`,
                }}
              >
                <div>
                  <div style={{ fontSize: 17, fontWeight: 300, color: textPrimary, letterSpacing: -0.4 }}>
                    {metrics.staleCount}
                  </div>
                  <div style={{ fontSize: 10.5, color: textSecondary, marginTop: 2, fontWeight: 400 }}>
                    Estagnadas (&gt;14d)
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 17, fontWeight: 300, color: textPrimary, letterSpacing: -0.4 }}>
                    {metrics.overdueCount}
                  </div>
                  <div style={{ fontSize: 10.5, color: textSecondary, marginTop: 2, fontWeight: 400 }}>
                    Prazos estourados
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 3. CARD DE DADOS: ENTREGAS & RITMO (ESTILO SALES STEPPED CHART + TIMELINE RULER + TIP BANNER) */}
          <div
            style={{
              width: '100%',
              background: isEffectiveDark ? '#141416' : theme.bgShelf,
              borderRadius: 10,
              border: theme.shelfBorder,
              boxShadow: theme.shelfShadow,
              padding: '16px 18px',
              display: 'flex',
              flexDirection: 'column',
              gap: 14,
              boxSizing: 'border-box',
              color: textPrimary,
              fontWeight: 400,
            }}
          >
            {/* Header: Título + Pill Dropdown ("Este ciclo ▾") */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13.5, fontWeight: 400, color: textPrimary, letterSpacing: -0.2 }}>
                Entregas & Equipe
              </span>
              <div
                style={{
                  fontSize: 10,
                  color: textSecondary,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)',
                  border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
                  padding: '3px 8px',
                  borderRadius: 4,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 3,
                  cursor: 'pointer',
                }}
              >
                Este ciclo <ChevronDown size={11} />
              </div>
            </div>

            {/* Métrica Principal + Gráfico Stepped Columns em Degraus */}
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
              <div>
                <div style={{ fontSize: 11, color: textSecondary, marginBottom: 4, fontWeight: 400 }}>
                  Taxa de cobertura
                </div>
                <div style={{ fontSize: 36, fontWeight: 300, lineHeight: 1, color: textPrimary, letterSpacing: -1 }}>
                  {sideCardStats.assignmentRate}%
                </div>
                <div style={{ fontSize: 10.5, color: textSecondary, marginTop: 4, fontWeight: 400 }}>
                  {sideCardStats.activeCollaboratorsCount}{' '}
                  {sideCardStats.activeCollaboratorsCount === 1 ? 'membro ativo' : 'membros ativos'}
                </div>
              </div>

              {/* Degraus em Escadinha (Stepped Columns) */}
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 58, paddingBottom: 2 }}>
                {/* Coluna 1 (baixa, sólida amarela/lime) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 8.5, color: textSecondary, fontWeight: 400 }}>
                    {sideCardStats.activeCollaboratorsCount} dev
                  </span>
                  <div
                    style={{
                      width: 24,
                      height: 18,
                      background: '#d4f933',
                      borderRadius: '2px 2px 0 0',
                    }}
                  />
                </div>

                {/* Coluna 2 (média, hachurada com linhas verticais finas) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 8.5, color: textSecondary, fontWeight: 400 }}>
                    {sideCardStats.inProgressIssues} ativas
                  </span>
                  <div
                    style={{
                      width: 28,
                      height: 34,
                      background: `repeating-linear-gradient(90deg, ${isEffectiveDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.2)'} 0px, ${isEffectiveDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.2)'} 1px, transparent 1px, transparent 3px)`,
                      borderTop: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'}`,
                      borderRadius: '2px 2px 0 0',
                    }}
                  />
                </div>

                {/* Coluna 3 (alta, hachurada com linhas verticais finas) */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                  <span style={{ fontSize: 8.5, color: textSecondary, fontWeight: 400 }}>
                    {sideCardStats.openIssues} total
                  </span>
                  <div
                    style={{
                      width: 28,
                      height: 50,
                      background: `repeating-linear-gradient(90deg, ${isEffectiveDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.2)'} 0px, ${isEffectiveDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.2)'} 1px, transparent 1px, transparent 3px)`,
                      borderTop: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.4)'}`,
                      borderRadius: '2px 2px 0 0',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Régua de Tracinhos / Timeline (Estilo Unpaid 365 Days / Last 30 days) */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                paddingTop: 10,
                borderTop: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}`,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10.5 }}>
                <span style={{ color: textSecondary }}>Ciclo de entrega</span>
                <span style={{ color: textPrimary, fontWeight: 300, fontSize: 13, letterSpacing: -0.3 }}>
                  {sideCardStats.completionRate}%
                </span>
              </div>

              {/* Régua com tracinhos e ponto neon indicador */}
              <div style={{ position: 'relative', width: '100%', height: 16 }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    height: 10,
                    opacity: isEffectiveDark ? 0.35 : 0.45,
                  }}
                >
                  {Array.from({ length: 28 }).map((_, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: 1,
                        height: idx % 4 === 0 ? 8 : 4,
                        background: idx % 4 === 0 ? textPrimary : textSecondary,
                      }}
                    />
                  ))}
                </div>
                {/* Marcador flutuante na régua com ponto amarelo neon */}
                <div
                  style={{
                    position: 'absolute',
                    top: 2,
                    left: `${Math.min(92, Math.max(8, sideCardStats.completionRate))}%`,
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#d4f933',
                    boxShadow: '0 0 6px #d4f933',
                    transform: 'translateX(-50%)',
                  }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 10, color: textSecondary }}>
                <span>{metrics.overdueCount > 0 ? `${metrics.overdueCount} atrasos` : '0 atrasos'}</span>
                <span>Meta: 100% concluído</span>
              </div>
            </div>

            {/* Destaque / Banner estilo "Break free from the desk" */}
            <div
              style={{
                background: '#d4f933',
                color: '#000000',
                borderRadius: 6,
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 10,
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, letterSpacing: -0.2 }}>
                  {metrics.overdueCount > 0
                    ? 'Atenção aos prazos'
                    : metrics.staleCount > 0
                    ? 'Demandas estagnadas'
                    : 'Fluxo em ritmo saudável'}
                </div>
                <div style={{ fontSize: 9.5, opacity: 0.8, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {metrics.overdueCount > 0
                    ? `${metrics.overdueCount} itens precisam de replanejamento urgente.`
                    : metrics.staleCount > 0
                    ? `${metrics.staleCount} tarefas sem movimentação há 14 dias.`
                    : 'Nenhum gargalo detectado na equipe.'}
                </div>
              </div>
              <div
                style={{
                  width: 22,
                  height: 22,
                  borderRadius: 4,
                  border: '1px solid rgba(0, 0, 0, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  cursor: 'pointer',
                }}
              >
                <ArrowRight size={12} color="#000000" />
              </div>
            </div>
          </div>
        </div>

        {/* LADO DIREITO: DIV PRINCIPAL COM CONTROLES + LISTA DE ALERTAS / MATRIZ */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: theme.bgShelf,
            borderRadius: 10,
            border: theme.shelfBorder,
            boxShadow: theme.shelfShadow,
            padding: 5,
            boxSizing: 'border-box',
            display: 'flex',
            flexDirection: 'column',
            minHeight: 0,
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              flex: 1,
              background: theme.viewCanvasBg,
              borderRadius: 8,
              padding: 14,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              minHeight: 0,
              overflowY: 'auto',
              boxSizing: 'border-box',
            }}
            className="no-scrollbar"
          >
          {/* Barra Superior: Segmented Control & Botão Ação */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: isEffectiveDark ? '#1a1a1a' : '#eaecef',
                borderRadius: 6,
                padding: 2,
                gap: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('alerts')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 5,
                  fontSize: 11.5,
                  fontWeight: 400,
                  background: viewMode === 'alerts' ? (isEffectiveDark ? '#262626' : '#ffffff') : 'transparent',
                  color: viewMode === 'alerts' ? textPrimary : textSecondary,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Alertas ({autoRisks.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('matrix')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 5,
                  fontSize: 11.5,
                  fontWeight: 400,
                  background: viewMode === 'matrix' ? (isEffectiveDark ? '#262626' : '#ffffff') : 'transparent',
                  color: viewMode === 'matrix' ? textPrimary : textSecondary,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Matriz
              </button>
              <button
                type="button"
                onClick={() => setViewMode('strategic')}
                style={{
                  padding: '5px 12px',
                  borderRadius: 5,
                  fontSize: 11.5,
                  fontWeight: 400,
                  background: viewMode === 'strategic' ? (isEffectiveDark ? '#262626' : '#ffffff') : 'transparent',
                  color: viewMode === 'strategic' ? textPrimary : textSecondary,
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                Estratégia ({strategicRisks.length})
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                setEditingStrategicRisk(null);
                setIsModalOpen(true);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '6px 12px',
                borderRadius: 6,
                background: accentColor,
                color: accentContrastText,
                fontSize: 11.5,
                fontWeight: 400,
                border: 'none',
                cursor: 'pointer',
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <Plus size={13} />
              <span>Novo Risco</span>
            </button>
          </div>

          {/* Grid de Filtros Rápidos (5 Cards) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: 8,
            }}
          >
            {[
              { key: 'all' as const, label: 'Total', count: autoRisks.length, color: textPrimary, icon: Shield },
              { key: 'critical' as const, label: 'Críticos', count: criticalCount, color: '#ef4444', icon: AlertTriangle },
              { key: 'deadline' as const, label: 'Prazos', count: deadlineCount, color: '#f97316', icon: Clock },
              { key: 'blocker' as const, label: 'Bloqueios', count: blockerCount, color: '#eab308', icon: Link2 },
              { key: 'workload' as const, label: 'Alocação', count: workloadCount, color: accentColor, icon: Users },
            ].map((item) => {
              const isActive = activeFilter === item.key && viewMode === 'alerts';
              const Icon = item.icon;

              return (
                <div
                  key={item.key}
                  onClick={() => {
                    setViewMode('alerts');
                    setActiveFilter(item.key);
                  }}
                  style={{
                    background: isActive ? (isEffectiveDark ? '#262626' : '#e2e8f0') : cardBg,
                    borderRadius: 8,
                    border: 'none',
                    padding: '8px 10px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 52,
                    boxShadow: isEffectiveDark ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = cardHoverBg;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = cardBg;
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 10.5, color: textSecondary, fontWeight: 400 }}>{item.label}</span>
                    <Icon size={12} color={item.color} />
                  </div>
                  <div style={{ fontSize: 16, fontWeight: 400, color: item.color }}>
                    {item.count}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Área Central: Cards em Grid Responsivo Sem Linha Colorida */}
          {viewMode === 'alerts' ? (
            filteredAlerts.length === 0 ? (
              <div
                style={{
                  background: cardBg,
                  borderRadius: 8,
                  border: 'none',
                  padding: '32px 20px',
                  textAlign: 'center',
                  color: textSecondary,
                  fontSize: 12,
                  fontWeight: 400,
                }}
              >
                Nenhuma pendência neste filtro.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: 8,
                }}
              >
                {filteredAlerts.map((risk) => {
                  const severityColor =
                    risk.severity === 'critical'
                      ? '#ef4444'
                      : risk.severity === 'high'
                      ? '#f97316'
                      : '#eab308';

                  return (
                    <div
                      key={risk.id}
                      style={{
                        background: cardBg,
                        borderRadius: 8,
                        border: 'none',
                        borderLeft: 'none',
                        padding: '12px 14px',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        gap: 8,
                        boxShadow: isEffectiveDark ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
                        transition: 'background 0.15s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = cardHoverBg)}
                      onMouseLeave={(e) => (e.currentTarget.style.background = cardBg)}
                    >
                      {/* Topo do Card Sem Linha Lateral */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                          <span style={{ fontSize: 9.5, color: textSecondary, textTransform: 'uppercase', fontWeight: 400 }}>
                            {risk.category === 'deadline'
                              ? 'Prazo'
                              : risk.category === 'blocker'
                              ? 'Bloqueio'
                              : risk.category === 'workload'
                              ? 'Alocação'
                              : 'Alerta'}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 400,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: `${severityColor}20`,
                              color: severityColor,
                              textTransform: 'uppercase',
                            }}
                          >
                            {risk.severity}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: 400,
                            color: textPrimary,
                            lineHeight: 1.25,
                          }}
                        >
                          {risk.title}
                        </span>

                        <span style={{ fontSize: 11, color: textSecondary, lineHeight: 1.3, fontWeight: 400 }}>
                          {risk.description}
                        </span>
                      </div>

                      {/* Rodapé com Ações */}
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                          paddingTop: 6,
                          borderTop: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
                        }}
                      >
                        <span style={{ fontSize: 10.5, color: textSecondary, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 400 }}>
                          {risk.suggestedAction}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                          {risk.issue && onOpenIssueDetail && (
                            <button
                              type="button"
                              onClick={() => onOpenIssueDetail(risk.issue!)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 8px',
                                borderRadius: 5,
                                background: isEffectiveDark ? '#242424' : '#f1f5f9',
                                border: 'none',
                                color: textPrimary,
                                fontSize: 11,
                                fontWeight: 400,
                                cursor: 'pointer',
                              }}
                            >
                              <span>Abrir</span>
                              <ArrowRight size={11} />
                            </button>
                          )}
                          {risk.actionType === 'reassign' && risk.issue && onReassignTask && (
                            <button
                              type="button"
                              onClick={() => onReassignTask(risk.issue!)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4,
                                padding: '4px 8px',
                                borderRadius: 5,
                                background: isEffectiveDark ? 'rgba(255, 106, 0, 0.15)' : 'rgba(255, 106, 0, 0.1)',
                                border: 'none',
                                color: accentColor,
                                fontSize: 11,
                                fontWeight: 400,
                                cursor: 'pointer',
                              }}
                            >
                              <UserX size={11} />
                              <span>Reatribuir</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          ) : viewMode === 'matrix' ? (
            <RiskMatrixView
              risks={autoRisks}
              strategicRisks={strategicRisks}
              onOpenIssue={onOpenIssueDetail}
              onEditStrategicRisk={(r) => {
                setEditingStrategicRisk(r);
                setIsModalOpen(true);
              }}
              theme={theme}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
            />
          ) : (
            /* VISÃO ESTRATÉGICA EM GRID */
            strategicRisks.length === 0 ? (
              <div
                style={{
                  background: cardBg,
                  borderRadius: 8,
                  border: 'none',
                  padding: '32px 20px',
                  textAlign: 'center',
                  color: textSecondary,
                  fontSize: 12,
                  fontWeight: 400,
                }}
              >
                Nenhum risco estratégico cadastrado.
              </div>
            ) : (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
                  gap: 8,
                }}
              >
                {strategicRisks.map((risk) => (
                  <div
                    key={risk.id}
                    style={{
                      background: cardBg,
                      borderRadius: 8,
                      border: 'none',
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      boxShadow: isEffectiveDark ? 'none' : '0 1px 2px rgba(0,0,0,0.03)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 400, color: textPrimary }}>{risk.title}</span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 400,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                            color: textPrimary,
                          }}
                        >
                          {risk.category}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                        <button
                          type="button"
                          onClick={() => {
                            setEditingStrategicRisk(risk);
                            setIsModalOpen(true);
                          }}
                          style={{
                            background: isEffectiveDark ? '#242424' : '#f1f5f9',
                            border: 'none',
                            color: textSecondary,
                            cursor: 'pointer',
                            padding: 4,
                            borderRadius: 4,
                            display: 'flex',
                          }}
                        >
                          <Edit2 size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingRisk(risk)}
                          style={{
                            background: isEffectiveDark ? 'rgba(239, 68, 68, 0.12)' : 'rgba(239, 68, 68, 0.1)',
                            border: 'none',
                            color: '#ef4444',
                            cursor: 'pointer',
                            padding: 4,
                            borderRadius: 4,
                            display: 'flex',
                          }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      {risk.mitigationPlan && (
                        <div
                          style={{
                            padding: '6px 8px',
                            borderRadius: 5,
                            background: isEffectiveDark ? '#141414' : '#f8fafc',
                            fontSize: 10.5,
                          }}
                        >
                          <div style={{ fontWeight: 400, color: textPrimary, marginBottom: 2 }}>Mitigação:</div>
                          <div style={{ color: textSecondary, lineHeight: 1.3, fontWeight: 400 }}>{risk.mitigationPlan}</div>
                        </div>
                      )}
                      {risk.contingencyPlan && (
                        <div
                          style={{
                            padding: '6px 8px',
                            borderRadius: 5,
                            background: isEffectiveDark ? '#141414' : '#f8fafc',
                            fontSize: 10.5,
                          }}
                        >
                          <div style={{ fontWeight: 400, color: textPrimary, marginBottom: 2 }}>Contingência:</div>
                          <div style={{ color: textSecondary, lineHeight: 1.3, fontWeight: 400 }}>{risk.contingencyPlan}</div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          )}
            </div>
          </div>
        </div>

      {/* Modal de Risco Estratégico */}
      <StrategicRiskModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingStrategicRisk(null);
        }}
        onSave={handleCreateOrUpdateRisk}
        editingRisk={editingStrategicRisk}
        theme={theme}
        isEffectiveDark={isEffectiveDark}
        accentColor={accentColor}
        accentContrastText={accentContrastText}
      />

      {/* Modal de Exclusão (Regra AGENTS.md) */}
      <ConfirmDeleteModal
        isOpen={Boolean(deletingRisk)}
        title="Excluir Risco Estratégico"
        message={`Deseja excluir o risco "${deletingRisk?.title}"?`}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={handleConfirmDeleteRisk}
        onClose={() => setDeletingRisk(null)}
        accentColor={accentColor}
      />
    </>
  );
};
