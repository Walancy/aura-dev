import React, { useState, useMemo, useEffect } from 'react';
import {
  AlertTriangle,
  Clock,
  Link2,
  Users,
  Shield,
  ShieldCheck,
  CheckCircle2,
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
import { logSystemActivity } from '../../utils/brainService';

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
      const num = issue.githubNumber || (issue as any).number || (issue.id.startsWith('issue-') ? issue.id.slice(6, 12) : issue.id);
      return `#${num} ${clean}`;
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

  const canvasBg = isEffectiveDark ? '#0e0e0e' : '#f5f5f5';
  const cardBg = isEffectiveDark ? '#1a1a1a' : '#ffffff';
  const cardSecondary = isEffectiveDark ? '#222222' : '#f4f5f7';
  const cardHoverBg = isEffectiveDark ? '#282828' : '#eceff1';
  const textPrimary = isEffectiveDark ? '#ffffff' : '#111111';
  const textSecondary = isEffectiveDark ? '#9ca3af' : '#4b5563';
  const textMuted = isEffectiveDark ? '#6b7280' : '#9ca3af';
  const borderSubtle = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';

  // Métricas adicionais para os 2 novos cards da coluna lateral
  const sideCardStats = useMemo(() => {
    const totalIssues = issues.length;
    const closedIssues = issues.filter((i) => i.status === 'Concluído' || i.rawState === 'closed').length;
    const inProgressIssues = issues.filter((i) => i.status === 'Em Progresso').length;
    const todoIssues = Math.max(0, totalIssues - closedIssues - inProgressIssues);
    const openIssues = totalIssues - closedIssues;
    const urgentCount = issues.filter(
      (i) => (i.priority === 'Urgente' || i.priority === 'Alta') && i.status !== 'Concluído' && i.rawState !== 'closed'
    ).length;
    const unassignedCount = issues.filter(
      (i) => (!i.assignees || i.assignees.length === 0) && i.status !== 'Concluído' && i.rawState !== 'closed'
    ).length;
    const assignedCount = Math.max(0, openIssues - unassignedCount);
    const completionRate = totalIssues > 0 ? Math.round((closedIssues / totalIssues) * 100) : 0;
    const assignmentRate = openIssues > 0 ? Math.round((assignedCount / openIssues) * 100) : 100;

    const devWorkloadMap = new Map<string, { name: string; avatarUrl?: string; activeCount: number }>();
    issues.forEach((i) => {
      if (i.status !== 'Concluído' && i.rawState !== 'closed' && i.assignees && i.assignees.length > 0) {
        i.assignees.forEach((ass) => {
          const name = ass.name || ass.login;
          if (name) {
            const cur = devWorkloadMap.get(name) || { name, avatarUrl: ass.avatarUrl, activeCount: 0 };
            cur.activeCount += 1;
            if (ass.avatarUrl && !cur.avatarUrl) cur.avatarUrl = ass.avatarUrl;
            devWorkloadMap.set(name, cur);
          }
        });
      }
    });
    const topDevs = Array.from(devWorkloadMap.values()).sort((a, b) => b.activeCount - a.activeCount).slice(0, 3);

    return {
      totalIssues,
      closedIssues,
      openIssues,
      inProgressIssues,
      todoIssues,
      urgentCount,
      unassignedCount,
      completionRate,
      assignmentRate,
      activeCollaboratorsCount: devWorkloadMap.size,
      topDevs,
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
            gap: 8,
            alignSelf: 'stretch',
            height: '100%',
            maxHeight: '100%',
            overflowY: 'auto',
            flexShrink: 0,
            boxSizing: 'border-box',
            paddingRight: 2,
          }}
          className="no-scrollbar"
        >
          {/* 1. HERO CARD: SAÚDE DO PROJETO (REORGANIZADO & COMPACTO) */}
          <div
            style={{
              width: '100%',
              background: accentColor,
              borderRadius: 8,
              border: 'none',
              padding: '11px 13px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              height: 'fit-content',
              minHeight: 'fit-content',
              maxHeight: 'none',
              alignSelf: 'start',
              flexShrink: 0,
              flexGrow: 0,
              boxShadow: 'none',
              gap: 8,
              color: '#ffffff',
              boxSizing: 'border-box',
            }}
          >
            {/* Topo do Hero: Título + Badge de Status */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span
                style={{
                  fontSize: 10.5,
                  fontWeight: 500,
                  textTransform: 'uppercase',
                  letterSpacing: 0.5,
                  color: 'rgba(255, 255, 255, 0.9)',
                }}
              >
                Saúde do Projeto
              </span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 500,
                  padding: '2px 7px',
                  borderRadius: 10,
                  background: 'rgba(0, 0, 0, 0.22)',
                  color: '#ffffff',
                }}
              >
                {metrics.label}
              </span>
            </div>

            {/* Linha Central Integrada: Score à esquerda + Grid 2x2 compacto à direita */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              {/* Score e total de pendências */}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div
                  style={{
                    fontSize: 32,
                    fontWeight: 400,
                    lineHeight: 1,
                    color: '#ffffff',
                    letterSpacing: -0.8,
                  }}
                >
                  {metrics.score}%
                </div>
                <div style={{ fontSize: 10, color: 'rgba(255, 255, 255, 0.85)', marginTop: 3 }}>
                  {metrics.totalRisksCount} pendências
                </div>
              </div>

              {/* Grid 2x2 compacto de métricas monitoradas */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, 1fr)',
                  gap: '3px 8px',
                  background: 'rgba(0, 0, 0, 0.15)',
                  padding: '5px 8px',
                  borderRadius: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 9.5 }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.75)' }}>Atrasos</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{metrics.overdueCount}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 9.5 }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.75)' }}>Bloqueios</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{metrics.blockedCount}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 9.5 }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.75)' }}>Gargalos</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{metrics.workloadBottlenecksCount}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 9.5 }}>
                  <span style={{ color: 'rgba(255, 255, 255, 0.75)' }}>Estagnadas</span>
                  <span style={{ fontWeight: 600, color: '#ffffff' }}>{metrics.staleCount}</span>
                </div>
              </div>
            </div>

            {/* Deduções Ativas (Compactas em linha horizontal) */}
            {metrics.deductions.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  fontSize: 9.5,
                  color: 'rgba(255, 255, 255, 0.9)',
                  overflowX: 'auto',
                  paddingTop: 4,
                  borderTop: '1px solid rgba(255, 255, 255, 0.15)',
                }}
              >
                <span style={{ color: 'rgba(255, 255, 255, 0.7)', fontSize: 9, flexShrink: 0 }}>
                  Deduções:
                </span>
                {metrics.deductions.slice(0, 2).map((d, i) => (
                  <span
                    key={i}
                    style={{
                      background: 'rgba(0, 0, 0, 0.18)',
                      padding: '1px 5px',
                      borderRadius: 4,
                      whiteSpace: 'nowrap',
                      flexShrink: 0,
                    }}
                  >
                    {d.reason} (-{d.points}%)
                  </span>
                ))}
                {metrics.deductions.length > 2 && (
                  <span style={{ fontSize: 8.5, opacity: 0.8, flexShrink: 0 }}>
                    +{metrics.deductions.length - 2}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* 2. CARD DE DADOS: DEMANDAS (NOVA UI) */}
          <div
            style={{
              width: '100%',
              background: cardBg,
              borderRadius: 8,
              border: 'none',
              boxShadow: 'none',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              gap: 10,
              flex: 1,
              minHeight: 0,
              boxSizing: 'border-box',
              color: textPrimary,
              fontWeight: 400,
            }}
          >
            {/* Header: Titulo + Badge Sprint + Contador Total */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: textPrimary, letterSpacing: -0.2 }}>
                  Demandas
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    color: textSecondary,
                    background: cardSecondary,
                    padding: '2px 7px',
                    borderRadius: 4,
                    border: 'none',
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 400,
                  }}
                >
                  Sprint Ativo
                </span>
              </div>
              <span style={{ fontSize: 10, color: textMuted, fontWeight: 400 }}>
                {sideCardStats.totalIssues} no total
              </span>
            </div>

            {/* Grid 3 colunas de status: A Fazer / Em Curso / Concluidas */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
              <div
                style={{
                  background: cardSecondary,
                  borderRadius: 6,
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  border: 'none',
                  boxShadow: 'none',
                }}
              >
                <span style={{ fontSize: 9.5, color: textSecondary, fontWeight: 400 }}>A Fazer</span>
                <div style={{ fontSize: 17, fontWeight: 400, color: textPrimary, lineHeight: 1 }}>
                  {sideCardStats.todoIssues}
                </div>
                <span style={{ fontSize: 9, color: textMuted, fontWeight: 400 }}>
                  {sideCardStats.totalIssues > 0 ? Math.round((sideCardStats.todoIssues / sideCardStats.totalIssues) * 100) : 0}%
                </span>
              </div>

              <div
                style={{
                  background: cardSecondary,
                  borderRadius: 6,
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  border: 'none',
                  boxShadow: 'none',
                }}
              >
                <span style={{ fontSize: 9.5, color: accentColor, fontWeight: 400 }}>Em Curso</span>
                <div style={{ fontSize: 17, fontWeight: 400, color: accentColor, lineHeight: 1 }}>
                  {sideCardStats.inProgressIssues}
                </div>
                <span style={{ fontSize: 9, color: textMuted, fontWeight: 400 }}>
                  {sideCardStats.totalIssues > 0 ? Math.round((sideCardStats.inProgressIssues / sideCardStats.totalIssues) * 100) : 0}%
                </span>
              </div>

              <div
                style={{
                  background: cardSecondary,
                  borderRadius: 6,
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  border: 'none',
                  boxShadow: 'none',
                }}
              >
                <span style={{ fontSize: 9.5, color: '#22c55e', fontWeight: 400 }}>Concluídas</span>
                <div style={{ fontSize: 17, fontWeight: 400, color: '#22c55e', lineHeight: 1 }}>
                  {sideCardStats.closedIssues}
                </div>
                <span style={{ fontSize: 9, color: textMuted, fontWeight: 400 }}>
                  {sideCardStats.completionRate}%
                </span>
              </div>
            </div>

            {/* Barra Segmentada de Distribuicao */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              <div
                style={{
                  width: '100%',
                  height: 6,
                  borderRadius: 3,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                  display: 'flex',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: `${sideCardStats.totalIssues > 0 ? (sideCardStats.closedIssues / sideCardStats.totalIssues) * 100 : 0}%`,
                    background: '#22c55e',
                    height: '100%',
                    transition: 'width 0.3s ease',
                  }}
                  title={`Concluidas: ${sideCardStats.closedIssues}`}
                />
                <div
                  style={{
                    width: `${sideCardStats.totalIssues > 0 ? (sideCardStats.inProgressIssues / sideCardStats.totalIssues) * 100 : 0}%`,
                    background: accentColor,
                    height: '100%',
                    transition: 'width 0.3s ease',
                  }}
                  title={`Em Curso: ${sideCardStats.inProgressIssues}`}
                />
                <div
                  style={{
                    width: `${sideCardStats.totalIssues > 0 ? (sideCardStats.todoIssues / sideCardStats.totalIssues) * 100 : 100}%`,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.12)',
                    height: '100%',
                    transition: 'width 0.3s ease',
                  }}
                  title={`A Fazer: ${sideCardStats.todoIssues}`}
                />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 9.5 }}>
                <span style={{ color: textSecondary, fontWeight: 400 }}>Progresso do fluxo</span>
                <span style={{ color: textPrimary, fontWeight: 400 }}>{sideCardStats.completionRate}% entregue</span>
              </div>
            </div>

            {/* Indicadores de Atencao Operacional */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: cardSecondary,
                  borderRadius: 6,
                  padding: '6px 8px',
                  border: 'none',
                  boxShadow: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertTriangle size={12} color={sideCardStats.urgentCount > 0 ? '#ef4444' : textSecondary} />
                  <span style={{ fontSize: 9.5, color: textPrimary, fontWeight: 400 }}>Prioridade Alta / Urgente</span>
                </div>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 400,
                    color: sideCardStats.urgentCount > 0 ? '#ef4444' : textSecondary,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                    padding: '1px 6px',
                    borderRadius: 4,
                  }}
                >
                  {sideCardStats.urgentCount}
                </span>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: cardSecondary,
                  borderRadius: 6,
                  padding: '6px 8px',
                  border: 'none',
                  boxShadow: 'none',
                  transition: 'all 0.15s ease',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <Clock size={12} color={(metrics.overdueCount + metrics.staleCount) > 0 ? '#eab308' : textSecondary} />
                  <span style={{ fontSize: 9.5, color: textPrimary, fontWeight: 400 }}>Atrasadas ou Estagnadas</span>
                </div>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 400,
                    color: (metrics.overdueCount + metrics.staleCount) > 0 ? '#eab308' : textSecondary,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                    padding: '1px 6px',
                    borderRadius: 4,
                  }}
                >
                  {metrics.overdueCount + metrics.staleCount}
                </span>
              </div>
            </div>
          </div>

          {/* 3. CARD DE DADOS: ENTREGAS & EQUIPE (NOVA UI) */}
          <div
            style={{
              width: '100%',
              background: cardBg,
              borderRadius: 8,
              border: 'none',
              boxShadow: 'none',
              padding: 10,
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
              flex: 1.15,
              minHeight: 0,
              boxSizing: 'border-box',
              color: textPrimary,
              fontWeight: 400,
              overflow: 'hidden',
            }}
          >
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: textPrimary, letterSpacing: -0.2 }}>
                  Entregas & Equipe
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    color: textSecondary,
                    background: cardSecondary,
                    padding: '2px 7px',
                    borderRadius: 4,
                    border: 'none',
                    height: 20,
                    display: 'flex',
                    alignItems: 'center',
                    fontWeight: 400,
                  }}
                >
                  Ciclo Atual
                </span>
              </div>
              <span style={{ fontSize: 10, color: textMuted, fontWeight: 400 }}>
                {sideCardStats.activeCollaboratorsCount} ativos
              </span>
            </div>

            {/* KPIs de Atribuicao e Entrega (Compactos) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 6, flexShrink: 0 }}>
              <div
                style={{
                  background: cardSecondary,
                  borderRadius: 6,
                  padding: '6px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  border: 'none',
                  boxShadow: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 9.5, color: textSecondary, fontWeight: 400 }}>Atribuição</span>
                  <Users size={11} color={accentColor} />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 400, color: textPrimary, lineHeight: 1 }}>
                    {sideCardStats.assignmentRate}%
                  </span>
                  <span
                    style={{
                      fontSize: 8.5,
                      color: sideCardStats.unassignedCount > 0 ? '#ef4444' : textMuted,
                      fontWeight: 400,
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {sideCardStats.unassignedCount > 0 ? `${sideCardStats.unassignedCount} sem dono` : 'Todas atribuídas'}
                  </span>
                </div>
              </div>

              <div
                style={{
                  background: cardSecondary,
                  borderRadius: 6,
                  padding: '6px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  border: 'none',
                  boxShadow: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 9.5, color: textSecondary, fontWeight: 400 }}>Conclusão</span>
                  <CheckCircle2 size={11} color="#22c55e" />
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 4 }}>
                  <span style={{ fontSize: 14, fontWeight: 400, color: textPrimary, lineHeight: 1 }}>
                    {sideCardStats.completionRate}%
                  </span>
                  <span style={{ fontSize: 8.5, color: textMuted, fontWeight: 400, whiteSpace: 'nowrap' }}>
                    {sideCardStats.closedIssues} de {sideCardStats.totalIssues} feitas
                  </span>
                </div>
              </div>
            </div>

            {/* Secao de Carga de Trabalho dos Colaboradores com Scroll */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                <span style={{ fontSize: 9.5, color: textSecondary, fontWeight: 400 }}>Carga por Membro</span>
                <span style={{ fontSize: 9, color: textMuted, fontWeight: 400 }}>Tarefas ativas</span>
              </div>

              {sideCardStats.topDevs.length > 0 ? (
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    paddingRight: 2,
                    scrollbarWidth: 'thin',
                    scrollbarColor: isEffectiveDark ? 'rgba(255, 255, 255, 0.15) transparent' : 'rgba(0, 0, 0, 0.15) transparent',
                  }}
                  className="no-scrollbar"
                >
                  {sideCardStats.topDevs.map((dev, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        background: cardSecondary,
                        borderRadius: 5,
                        padding: '4px 7px',
                        border: 'none',
                        boxShadow: 'none',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        {dev.avatarUrl ? (
                          <img
                            src={dev.avatarUrl}
                            alt={dev.name}
                            style={{ width: 18, height: 18, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: accentColor,
                              color: accentContrastText,
                              fontSize: 8.5,
                              fontWeight: 400,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            {dev.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                        <span
                          style={{
                            fontSize: 10,
                            color: textPrimary,
                            fontWeight: 400,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            maxWidth: 130,
                          }}
                        >
                          {dev.name}
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
                        <span
                          style={{
                            fontSize: 9,
                            color: textSecondary,
                            fontWeight: 400,
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                            padding: '1px 5px',
                            borderRadius: 3,
                          }}
                        >
                          {dev.activeCount}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div
                  style={{
                    background: cardSecondary,
                    borderRadius: 5,
                    padding: 8,
                    textAlign: 'center',
                    fontSize: 9.5,
                    color: textMuted,
                    fontWeight: 400,
                  }}
                >
                  Nenhuma demanda atribuída no momento
                </div>
              )}
            </div>

            {/* Card de Saude Operacional Integrado (Substitui o botao azul estridente) */}
            <div
              style={{
                background: cardSecondary,
                borderRadius: 6,
                border: 'none',
                boxShadow: 'none',
                padding: '6px 8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 8,
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                {metrics.overdueCount > 0 ? (
                  <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                ) : (
                  <ShieldCheck size={14} color="#22c55e" style={{ flexShrink: 0 }} />
                )}
                <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <span
                    style={{
                      fontSize: 10.5,
                      fontWeight: 400,
                      color: textPrimary,
                      letterSpacing: -0.2,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {metrics.overdueCount > 0
                      ? 'Atenção aos Prazos'
                      : metrics.staleCount > 0
                      ? 'Demandas Estagnadas'
                      : 'Fluxo em Ritmo Saudável'}
                  </span>
                  <span
                    style={{
                      fontSize: 9,
                      color: textSecondary,
                      fontWeight: 400,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {metrics.overdueCount > 0
                      ? `${metrics.overdueCount} itens atrasados`
                      : metrics.staleCount > 0
                      ? `${metrics.staleCount} tarefas estagnadas`
                      : 'Nenhum gargalo detectado'}
                  </span>
                </div>
              </div>

              <span
                style={{
                  fontSize: 9,
                  fontWeight: 400,
                  color: metrics.overdueCount > 0 ? '#ef4444' : '#22c55e',
                  background: metrics.overdueCount > 0 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(34, 197, 94, 0.12)',
                  padding: '2px 6px',
                  borderRadius: 4,
                  flexShrink: 0,
                }}
              >
                {metrics.overdueCount > 0 ? 'Atenção' : 'Estável'}
              </span>
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
            border: 'none',
            boxShadow: 'none',
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
              background: isEffectiveDark ? '#111111' : theme.viewCanvasBg,
              borderRadius: 8,
              padding: 12,
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
                background: isEffectiveDark ? '#1c1c1c' : '#eaecef',
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
                  background: viewMode === 'alerts' ? (isEffectiveDark ? '#2b2b2b' : '#ffffff') : 'transparent',
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
                  background: viewMode === 'matrix' ? (isEffectiveDark ? '#2b2b2b' : '#ffffff') : 'transparent',
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
                  background: viewMode === 'strategic' ? (isEffectiveDark ? '#2b2b2b' : '#ffffff') : 'transparent',
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

          {/* Grid de Filtros Rápidos (5 Cards com Contraste Acentuado) */}
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
                    logSystemActivity('riscos', 'filtrar_riscos', item.label);
                  }}
                  style={{
                    background: isActive ? (isEffectiveDark ? '#2e2e2e' : '#e4e4e7') : (isEffectiveDark ? '#1a1a1a' : '#ffffff'),
                    borderRadius: 8,
                    border: 'none',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    minHeight: 56,
                    boxShadow: 'none',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) e.currentTarget.style.background = isEffectiveDark ? '#242424' : '#f4f4f5';
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) e.currentTarget.style.background = isEffectiveDark ? '#1a1a1a' : '#ffffff';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: 11, color: isActive ? textPrimary : textSecondary, fontWeight: 400 }}>{item.label}</span>
                    <Icon size={13} color={item.color} />
                  </div>
                  <div style={{ fontSize: 17, fontWeight: 400, color: item.color }}>
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
                  background: isEffectiveDark ? '#181818' : '#ffffff',
                  borderRadius: 8,
                  border: 'none',
                  padding: '36px 20px',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  color: textSecondary,
                  fontSize: 12,
                  fontWeight: 400,
                  boxShadow: 'none',
                }}
              >
                <ShieldCheck size={22} color={accentColor} />
                <span style={{ color: textPrimary, fontSize: 13, fontWeight: 400 }}>
                  Nenhuma pendência neste filtro
                </span>
                <span style={{ color: textSecondary, fontSize: 11 }}>
                  Todas as condições de risco monitoradas estão saudáveis.
                </span>
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
                {strategicRisks.map((risk) => {
                  const getImpactBadge = (impact?: string) => {
                    switch (impact) {
                      case 'high':
                        return {
                          label: 'Impacto: Alto',
                          bg: isEffectiveDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                          color: isEffectiveDark ? '#f87171' : '#dc2626',
                        };
                      case 'medium':
                        return {
                          label: 'Impacto: Médio',
                          bg: isEffectiveDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                          color: isEffectiveDark ? '#fbbf24' : '#d97706',
                        };
                      case 'low':
                      default:
                        return {
                          label: 'Impacto: Baixo',
                          bg: isEffectiveDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)',
                          color: isEffectiveDark ? '#4ade80' : '#16a34a',
                        };
                    }
                  };

                  const getProbabilityBadge = (prob?: string) => {
                    switch (prob) {
                      case 'high':
                        return {
                          label: 'Probabilidade: Alta',
                          bg: isEffectiveDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                          color: isEffectiveDark ? '#f87171' : '#dc2626',
                        };
                      case 'medium':
                        return {
                          label: 'Probabilidade: Média',
                          bg: isEffectiveDark ? 'rgba(245, 158, 11, 0.15)' : 'rgba(245, 158, 11, 0.1)',
                          color: isEffectiveDark ? '#fbbf24' : '#d97706',
                        };
                      case 'low':
                      default:
                        return {
                          label: 'Probabilidade: Baixa',
                          bg: isEffectiveDark ? 'rgba(34, 197, 94, 0.15)' : 'rgba(34, 197, 94, 0.1)',
                          color: isEffectiveDark ? '#4ade80' : '#16a34a',
                        };
                    }
                  };

                  const impactBadge = getImpactBadge(risk.impact);
                  const probBadge = getProbabilityBadge(risk.probability);

                  return (
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
                      {/* Top Header: Title + Action Buttons */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: textPrimary, lineHeight: 1.35 }}>
                          {risk.title}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
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

                      {/* Tags Row: Placed below the Title */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 400,
                            padding: '1.5px 6px',
                            borderRadius: 4,
                            background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                            color: textPrimary,
                          }}
                        >
                          {risk.category}
                        </span>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 500,
                            padding: '1.5px 6px',
                            borderRadius: 4,
                            background: impactBadge.bg,
                            color: impactBadge.color,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {impactBadge.label}
                        </span>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 500,
                            padding: '1.5px 6px',
                            borderRadius: 4,
                            background: probBadge.bg,
                            color: probBadge.color,
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {probBadge.label}
                        </span>
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
                );
              })}
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
