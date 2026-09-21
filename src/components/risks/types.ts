import type { ProjectIssue } from '../ProjectsSchedulerView';

export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical';

export type RiskCategory =
  | 'deadline'      // Prazos e estouro de sprints
  | 'blocker'       // Dependências e bloqueios
  | 'workload'      // Sobrecarga de membros / Bus factor
  | 'unassigned'    // Tarefas críticas sem responsável
  | 'stale'         // Tarefas estagnadas em progresso
  | 'quality'       // Bugs e débitos críticos
  | 'strategic';    // Riscos estratégicos / manuais

export interface RiskItem {
  id: string;
  title: string;
  description: string;
  severity: RiskSeverity;
  category: RiskCategory;
  impact: 'low' | 'medium' | 'high';
  probability: 'low' | 'medium' | 'high';
  scoreDeduction: number;
  issue?: ProjectIssue;
  collaboratorLogin?: string;
  collaboratorAvatar?: string;
  sprintTitle?: string;
  actionType?: 'view_issue' | 'reassign' | 'unblock' | 'reschedule';
  actionLabel?: string;
  suggestedAction?: string;
}

export type StrategicRiskCategory = 'Técnico' | 'Negócio' | 'Infraestrutura' | 'Pessoas' | 'Terceiros';
export type StrategicRiskStatus = 'Identificado' | 'Em Monitoramento' | 'Mitigado' | 'Ocorrido';

export interface StrategicRisk {
  id: string;
  title: string;
  category: StrategicRiskCategory;
  impact: 'low' | 'medium' | 'high';
  probability: 'low' | 'medium' | 'high';
  mitigationPlan: string;
  contingencyPlan: string;
  status: StrategicRiskStatus;
  createdAtIso: string;
  updatedAtIso: string;
}

export interface ProjectHealthMetrics {
  score: number; // 0 a 100
  level: 'excellent' | 'good' | 'warning' | 'critical';
  label: string;
  color: string;
  overdueCount: number;
  blockedCount: number;
  workloadBottlenecksCount: number;
  unassignedCriticalCount: number;
  staleCount: number;
  totalRisksCount: number;
  deductions: { reason: string; points: number }[];
}
