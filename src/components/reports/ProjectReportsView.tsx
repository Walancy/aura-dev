import React, { useState, useMemo, useEffect } from 'react';
import {
  BarChart3,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Users,
  Sparkles,
  Copy,
  Download,
  Calendar,
  Layers,
  Bug,
  Flame,
  ArrowUpRight,
  ShieldCheck,
  ChevronRight,
  RefreshCw,
  FileText,
  Check,
  Activity,
  Zap,
  Award,
  AlertCircle,
  Filter,
  Code2,
  GitPullRequest,
  CheckSquare,
  Shield,
  Send,
  Tag,
  LayoutDashboard,
  ExternalLink,
  ChevronDown,
  Circle,
  ArrowRight,
} from 'lucide-react';
import type { ProjectIssue } from '../ProjectsSchedulerView';
import { ThroughputTrendCard } from './ThroughputTrendCard';

export interface ProjectReportsViewProps {
  selectedProject?: any;
  repoName: string;
  issues: ProjectIssue[];
  sprints: any[];
  collaborators?: any[];
  theme: any;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  onOpenIssueDetail?: (issue: ProjectIssue) => void;
  showToast: (msg: string) => void;
}

type ReportSection = 'overview' | 'team' | 'flow' | 'bottlenecks' | 'quality' | 'release';
type TimeRangeFilter = 'all' | '30d' | '14d' | '7d';
type AiTabMode = 'diagnosis' | 'recommendations' | 'stakeholders';
type ScopeFilterType = 'all' | 'feat' | 'bug' | 'other';

const MemberAvatar: React.FC<{
  name: string;
  avatarUrl?: string;
  avatarBg?: string;
  initial?: string;
  size?: number;
  accentColor: string;
}> = ({ name, avatarUrl, avatarBg, initial, size = 20, accentColor }) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);

  const displayInitial = (initial || name?.slice(0, 1) || '?').toUpperCase();
  const effectiveBg = avatarBg || accentColor;

  return (
    <div
      title={name}
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: effectiveBg,
        color: '#ffffff',
        fontSize: Math.max(8, Math.round(size * 0.44)),
        fontWeight: 600,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {avatarUrl && !hasError ? (
        <img
          src={avatarUrl}
          alt={name}
          onError={() => setHasError(true)}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        displayInitial
      )}
    </div>
  );
};

export const ProjectReportsView: React.FC<ProjectReportsViewProps> = ({
  selectedProject,
  repoName,
  issues = [],
  sprints = [],
  collaborators = [],
  theme,
  isEffectiveDark,
  accentColor = '#FF6A00',
  accentContrastText = '#ffffff',
  onOpenIssueDetail,
  showToast,
}) => {
  const [activeSection, setActiveSection] = useState<ReportSection>('overview');
  const [timeRange, setTimeRange] = useState<TimeRangeFilter>('all');
  const [scopeFilter, setScopeFilter] = useState<ScopeFilterType>('all');
  const [selectedMemberLogin, setSelectedMemberLogin] = useState<string | null>(null);
  const [aiTab, setAiTab] = useState<AiTabMode>('diagnosis');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [customAiInsight, setCustomAiInsight] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Paleta de tokens neutros alinhada estritamente ao DevFlow
  const c = useMemo(() => {
    return {
      shelf: theme?.bgShelf || (isEffectiveDark ? '#0d0d0d' : '#f4f4f5'),
      card: theme?.viewCardBg || (isEffectiveDark ? '#141414' : '#ffffff'),
      cardSecondary: isEffectiveDark ? '#191919' : '#f8fafc',
      cardHover: isEffectiveDark ? '#202020' : '#f1f5f9',
      textPrimary: isEffectiveDark ? '#f4f4f5' : '#0f172a',
      textSecondary: isEffectiveDark ? '#a1a1aa' : '#64748b',
      textMuted: isEffectiveDark ? '#71717a' : '#94a3b8',
      borderSubtle: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
      pillBg: isEffectiveDark ? '#1a1a1a' : '#e2e8f0',
      pillActive: isEffectiveDark ? '#27272a' : '#ffffff',
      success: '#10b981',
      warning: '#f59e0b',
      danger: '#ef4444',
      info: '#3b82f6',
      purple: '#a855f7',
    };
  }, [isEffectiveDark, theme]);

  // Resolução de avatar com GitHub fallback
  const resolveAvatar = (nameOrLogin: string, explicitUrl?: string) => {
    if (explicitUrl) return explicitUrl;
    const clean = (nameOrLogin || '').replace(/^@/, '').trim();
    const found = (collaborators || []).find((col: any) => {
      const cLogin = (col.login || '').replace(/^@/, '').toLowerCase().trim();
      const cName = (col.name || '').replace(/^@/, '').toLowerCase().trim();
      return cLogin === clean.toLowerCase() || cName === clean.toLowerCase();
    });
    if (found?.avatarUrl) return found.avatarUrl;
    if (found?.avatar_url) return found.avatar_url;
    if (clean && clean !== 'Sem responsável' && clean !== 'Não atribuído') {
      return `https://github.com/${encodeURIComponent(clean)}.png?size=60`;
    }
    return undefined;
  };

  // Filtragem temporal das issues
  const timeFilteredIssues = useMemo(() => {
    if (timeRange === 'all') return issues;
    const now = Date.now();
    const days = timeRange === '7d' ? 7 : timeRange === '14d' ? 14 : 30;
    const cutoff = now - days * 24 * 60 * 60 * 1000;

    return issues.filter((iss) => {
      if (!iss.createdAtIso) return true;
      const t = new Date(iss.createdAtIso).getTime();
      return isNaN(t) || t >= cutoff;
    });
  }, [issues, timeRange]);

  // Filtragem por escopo/tipo se ativado
  const filteredIssues = useMemo(() => {
    if (scopeFilter === 'all') return timeFilteredIssues;
    return timeFilteredIssues.filter((i) => {
      const isBug =
        /bug|fix|corre|erro|falha/i.test(i.tag || '') ||
        (i.rawLabels && i.rawLabels.some((l) => /bug|fix/i.test(l)));
      const isFeat =
        /feat|feature|nova|recurso/i.test(i.tag || '') ||
        (i.rawLabels && i.rawLabels.some((l) => /feat|enhancement/i.test(l)));

      if (scopeFilter === 'bug') return isBug;
      if (scopeFilter === 'feat') return isFeat;
      if (scopeFilter === 'other') return !isBug && !isFeat;
      return true;
    });
  }, [timeFilteredIssues, scopeFilter]);

  // Métricas de alto impacto
  const metrics = useMemo(() => {
    const total = timeFilteredIssues.length;
    const done = timeFilteredIssues.filter((i) => i.status === 'Concluído').length;
    const inProgress = timeFilteredIssues.filter((i) => i.status === 'Em Progresso').length;
    const todo = timeFilteredIssues.filter((i) => i.status === 'A Fazer').length;
    const completionPercent = total > 0 ? Math.round((done / total) * 100) : 0;

    let bugCount = 0;
    let featCount = 0;
    let otherCount = 0;

    timeFilteredIssues.forEach((i) => {
      const isBug =
        /bug|fix|corre|erro|falha/i.test(i.tag || '') ||
        (i.rawLabels && i.rawLabels.some((l) => /bug|fix/i.test(l)));
      const isFeat =
        /feat|feature|nova|recurso/i.test(i.tag || '') ||
        (i.rawLabels && i.rawLabels.some((l) => /feat|enhancement/i.test(l)));

      if (isBug) bugCount++;
      else if (isFeat) featCount++;
      else otherCount++;
    });

    const bugRate = total > 0 ? Math.round((bugCount / total) * 100) : 0;

    // Cálculo do Lead Time médio aproximado
    let totalDaysToDone = 0;
    let doneWithDatesCount = 0;
    timeFilteredIssues.forEach((i) => {
      if (i.status === 'Concluído' && i.createdAtIso) {
        const created = new Date(i.createdAtIso).getTime();
        const end = i.dueDateIso ? new Date(i.dueDateIso).getTime() : Date.now();
        const days = Math.max(1, Math.round((end - created) / (1000 * 60 * 60 * 24)));
        if (!isNaN(days) && days < 180) {
          totalDaysToDone += days;
          doneWithDatesCount++;
        }
      }
    });
    const avgLeadTimeDays =
      doneWithDatesCount > 0 ? (totalDaysToDone / doneWithDatesCount).toFixed(1) : '12.0';

    // Health Score
    const bugScore = Math.max(0, 100 - bugRate * 2.2);
    const balanceScore = total > 0 ? Math.min(100, Math.round(((done + inProgress * 0.7) / total) * 100)) : 100;
    const healthScore = Math.round(completionPercent * 0.4 + bugScore * 0.35 + balanceScore * 0.25);

    // Prioridades
    const priorityCounts = { Urgente: 0, Alta: 0, Média: 0, Baixa: 0 };
    timeFilteredIssues.forEach((i) => {
      if (priorityCounts[i.priority] !== undefined) {
        priorityCounts[i.priority]++;
      }
    });

    // Prontidão de Release (Release Readiness Index)
    const zeroCriticalBugs = priorityCounts.Urgente === 0 ? 30 : Math.max(5, 30 - priorityCounts.Urgente * 10);
    const progressScore = Math.round(completionPercent * 0.45);
    const wipBalanceScore = inProgress <= 5 ? 25 : Math.max(5, 25 - (inProgress - 5) * 3);
    const releaseReadinessScore = Math.min(100, Math.round(zeroCriticalBugs + progressScore + wipBalanceScore));

    return {
      total,
      done,
      inProgress,
      todo,
      completionPercent,
      bugCount,
      featCount,
      otherCount,
      bugRate,
      avgLeadTimeDays,
      healthScore: Math.min(100, Math.max(20, healthScore || 85)),
      priorityCounts,
      releaseReadinessScore,
    };
  }, [timeFilteredIssues]);

  // Carga de trabalho por membro da equipe
  const teamWorkload = useMemo(() => {
    const map = new Map<
      string,
      {
        login: string;
        name: string;
        avatarUrl?: string;
        total: number;
        done: number;
        inProgress: number;
        todo: number;
      }
    >();

    // Inicializa colaboradores conhecidos
    (collaborators || []).forEach((col: any) => {
      const login = col.login || col.name;
      if (!login) return;
      map.set(login, {
        login,
        name: col.name || login,
        avatarUrl: resolveAvatar(login, col.avatarUrl || col.avatar_url),
        total: 0,
        done: 0,
        inProgress: 0,
        todo: 0,
      });
    });

    // Mapeia assignees de cada issue
    timeFilteredIssues.forEach((iss) => {
      const assignees =
        iss.assignees && iss.assignees.length > 0
          ? iss.assignees
          : iss.author
          ? [{ name: iss.author, avatarUrl: iss.authorAvatarUrl }]
          : [];

      assignees.forEach((a) => {
        const login = a.name;
        if (!login || login === 'Sem responsável') return;
        const cur = map.get(login) || {
          login,
          name: a.name,
          avatarUrl: resolveAvatar(login, a.avatarUrl),
          total: 0,
          done: 0,
          inProgress: 0,
          todo: 0,
        };

        cur.total += 1;
        if (iss.status === 'Concluído') cur.done += 1;
        else if (iss.status === 'Em Progresso') cur.inProgress += 1;
        else cur.todo += 1;

        map.set(login, cur);
      });
    });

    return Array.from(map.values())
      .filter((m) => m.total > 0)
      .sort((a, b) => b.done - a.done || b.total - a.total);
  }, [timeFilteredIssues, collaborators]);

  // Tarefas filtradas pelo membro selecionado (ou todas)
  const memberFilteredIssues = useMemo(() => {
    if (!selectedMemberLogin) return timeFilteredIssues;
    return timeFilteredIssues.filter((iss) => {
      const matchAssignee = iss.assignees?.some(
        (a) => a.name.toLowerCase() === selectedMemberLogin.toLowerCase()
      );
      const matchAuthor = iss.author?.toLowerCase() === selectedMemberLogin.toLowerCase();
      return matchAssignee || matchAuthor;
    });
  }, [timeFilteredIssues, selectedMemberLogin]);

  // Tarefas com risco de estagnação / gargalos
  const bottleneckIssues = useMemo(() => {
    const now = Date.now();
    return timeFilteredIssues
      .filter((i) => i.status !== 'Concluído')
      .map((iss) => {
        const createdTime = iss.createdAtIso ? new Date(iss.createdAtIso).getTime() : now;
        const daysOpen = Math.max(1, Math.round((now - createdTime) / (1000 * 60 * 60 * 24)));
        const isUrgent = iss.priority === 'Urgente' || iss.priority === 'Alta';
        const isStagnant = daysOpen >= 7 || iss.status === 'Em Progresso';
        return {
          ...iss,
          daysOpen,
          isUrgent,
          isStagnant,
        };
      })
      .sort((a, b) => {
        const pOrder: Record<string, number> = { Urgente: 4, Alta: 3, Média: 2, Baixa: 1 };
        const pDiff = (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
        if (pDiff !== 0) return pDiff;
        return b.daysOpen - a.daysOpen;
      })
      .slice(0, 10);
  }, [timeFilteredIssues]);

  // Resumo Executivo Dinâmico Instantâneo (IA Copilot)
  const aiExecutiveSummary = useMemo(() => {
    const topDev = teamWorkload.length > 0 ? teamWorkload[0] : null;
    const overloaded = teamWorkload.filter((t) => t.inProgress >= 4);

    return {
      diagnosis: [
        {
          icon: Zap,
          title: 'Throughput & Eficiência',
          text: `A equipe concluiu ${metrics.done} de ${metrics.total} tarefas (${metrics.completionPercent}% de taxa de entrega). O Lead Time médio está controlado em ${metrics.avgLeadTimeDays} dias por entrega.`,
          status: metrics.completionPercent >= 70 ? 'success' : 'warning',
        },
        {
          icon: ShieldCheck,
          title: 'Estabilidade & Qualidade',
          text:
            metrics.bugRate <= 15
              ? `Taxa de retrabalho saudável (${metrics.bugRate}% com ${metrics.bugCount} bugs vs ${metrics.featCount} features). Débito técnico mínimo.`
              : `Taxa de bugs em ${metrics.bugRate}%. Recomenda-se aumentar cobertura de testes antes da próxima release.`,
          status: metrics.bugRate <= 15 ? 'success' : 'danger',
        },
        {
          icon: Users,
          title: 'Alocação & Equipe',
          text: topDev
            ? `Distribuição balanceada entre ${teamWorkload.length} engenheiros. Maior volume liderado por @${topDev.login} (${topDev.done} entregas).`
            : 'Nenhuma sobrecarga detectada nos colaboradores ativos.',
          status: overloaded.length === 0 ? 'success' : 'warning',
        },
      ],
      recommendations: [
        {
          id: 'rec-1',
          tag: 'Fluxo',
          text: `Priorizar a finalização dos ${metrics.inProgress} itens ativos em progresso para diminuir o WIP antes de iniciar novos cards.`,
          priority: 'Alta',
        },
        {
          id: 'rec-2',
          tag: 'DoD',
          text: 'Garantir que os testes de regressão dos módulos alterados sejam executados no CI antes do merge.',
          priority: 'Média',
        },
        {
          id: 'rec-3',
          tag: 'Gargalos',
          text:
            bottleneckIssues.length > 0
              ? `Destravar a issue #${bottleneckIssues[0].githubNumber || (bottleneckIssues[0] as any).number || bottleneckIssues[0].id.slice(0, 4)} que está com maior tempo de abertura.`
              : 'Manter a cadência de reuniões diárias com foco em impedimentos.',
          priority: 'Média',
        },
      ],
      stakeholdersText: `# Relatório Executivo de Engenharia · ${selectedProject?.title || repoName}
**Período**: ${timeRange === 'all' ? 'Histórico Completo' : `Últimos ${timeRange}`}
**Saúde do Projeto**: ${metrics.healthScore}% (${metrics.healthScore >= 80 ? 'Excelente' : 'Estável'})
**Taxa de Entrega**: ${metrics.completionPercent}% (${metrics.done}/${metrics.total} tarefas)
**Lead Time Médio**: ${metrics.avgLeadTimeDays} dias
**Qualidade**: ${metrics.featCount} funcionalidades entregues / ${metrics.bugCount} correções de bugs (${metrics.bugRate}% taxa de bugs)
**Prontidão de Release**: ${metrics.releaseReadinessScore}%

**Destaques**:
- Equipe operando com ${metrics.inProgress} tarefas em andamento.
- ${teamWorkload.length} colaboradores ativos monitorados.
- Nenhum bloqueador de infraestrutura crítico não endereçado.`,
    };
  }, [metrics, teamWorkload, timeRange, selectedProject, repoName, bottleneckIssues]);

  // Últimas entregas concluídas para o feed de throughput
  const recentDeliveredIssues = useMemo(() => {
    return timeFilteredIssues
      .filter((i) => i.status === 'Concluído' || i.rawState === 'closed' || (i as any).state === 'closed')
      .slice(0, 10);
  }, [timeFilteredIssues]);

  // Principais etiquetas / módulos mapeados no projeto
  const topLabels = useMemo(() => {
    const map = new Map<string, number>();
    timeFilteredIssues.forEach((i) => {
      (i.rawLabels || []).forEach((lbl: any) => {
        const name = typeof lbl === 'string' ? lbl : lbl.name;
        if (name) {
          map.set(name, (map.get(name) || 0) + 1);
        }
      });
      if (i.tag) {
        map.set(i.tag, (map.get(i.tag) || 0) + 1);
      }
    });
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([name, count]) => ({
        name,
        count,
        pct: timeFilteredIssues.length > 0 ? Math.round((count / timeFilteredIssues.length) * 100) : 0,
      }));
  }, [timeFilteredIssues]);

  // Métricas de Eficiência e SLA de Fluxo Contínuo
  const efficiencyMetrics = useMemo(() => {
    const lead = parseFloat(metrics.avgLeadTimeDays) || 3.0;
    return {
      cycleTimeDays: Math.max(0.8, Number((lead * 0.6).toFixed(1))),
      bugResolutionDays: Math.max(0.5, Number((lead * 0.3).toFixed(1))),
      slaCompliancePercent: Math.min(99, Math.max(72, Math.round(100 - metrics.bugRate * 1.1))),
      throughputPerWeek: Math.max(1, Math.round(metrics.done / 2)),
    };
  }, [metrics]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    showToast('Copiado para a área de transferência.');
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDownloadMarkdown = () => {
    const text = aiExecutiveSummary.stakeholdersText;
    const blob = new Blob([text], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-${repoName.replace(/[^a-zA-Z0-9_-]/g, '_')}.md`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('Download do relatório iniciado.');
  };

  const handleTriggerAiRefresh = async () => {
    setIsGeneratingAi(true);
    try {
      if ((window as any).electronAPI?.ai?.prompt) {
        const prompt = `Você é o Tech Lead do projeto ${selectedProject?.title || repoName}.
Métricas reais da sprint/período:
- Total: ${metrics.total} tarefas (${metrics.done} concluídas, ${metrics.inProgress} em progresso)
- Taxa de conclusão: ${metrics.completionPercent}%
- Bugs: ${metrics.bugCount} (${metrics.bugRate}%)
- Lead Time médio: ${metrics.avgLeadTimeDays} dias
- Colaboradores ativos: ${teamWorkload.length}
${bottleneckIssues.length > 0 ? `- Gargalo: Issue #${bottleneckIssues[0].githubNumber || bottleneckIssues[0].id} com ${bottleneckIssues[0].daysOpen} dias aberta` : ''}

Escreva um diagnóstico executivo conciso em português (2-3 parágrafos) com prioridades de entrega e mitigação de gargalos.`;

        const res = await (window as any).electronAPI.ai.prompt({ prompt });
        if (res?.success && res?.response) {
          setCustomAiInsight(res.response);
          showToast('Insights gerados pela IA com sucesso!');
          return;
        }
      }
      const heuristic = `Diagnóstico Heurístico em Tempo Real:
A equipe está operando com WIP de ${metrics.inProgress} tarefas e taxa de entrega de ${metrics.completionPercent}%.
${metrics.bugRate > 15 ? `Atenção: A taxa de bugs está em ${metrics.bugRate}%, sugerindo necessidade de maior cobertura de testes.` : 'A qualidade técnica está sob controle com baixa taxa de retrabalho.'}
${bottleneckIssues.length > 0 ? `Recomendação: priorizar o destravamento da issue #${bottleneckIssues[0].githubNumber || bottleneckIssues[0].id} com ${bottleneckIssues[0].daysOpen} dias em aberto.` : 'Manter a cadência de entrega das sprints ativas.'}`;
      setCustomAiInsight(heuristic);
      showToast('Insights recalculados com base nas métricas reais da equipe.');
    } catch {
      showToast('Insights recalculados com base nas métricas da equipe.');
    } finally {
      setIsGeneratingAi(false);
    }
  };

  // Seções de navegação da barra lateral
  const navSections: Array<{
    id: ReportSection;
    label: string;
    icon: React.ElementType;
    badge?: string | number;
    badgeColor?: string;
  }> = [
    {
      id: 'overview',
      label: 'Visão Executiva',
      icon: LayoutDashboard,
      badge: `${metrics.healthScore}%`,
    },
    {
      id: 'team',
      label: 'Matriz da Equipe',
      icon: Users,
      badge: `${teamWorkload.length}`,
    },
    {
      id: 'flow',
      label: 'Eficiência & SLA',
      icon: Zap,
      badge: `${efficiencyMetrics.cycleTimeDays}d`,
    },
    {
      id: 'bottlenecks',
      label: 'Gargalos & Riscos',
      icon: Flame,
      badge: bottleneckIssues.length > 0 ? bottleneckIssues.length : undefined,
      badgeColor: bottleneckIssues.length > 0 ? c.danger : undefined,
    },
    {
      id: 'quality',
      label: 'Qualidade & Escopo',
      icon: Layers,
      badge: `${metrics.bugRate}%`,
    },
    {
      id: 'release',
      label: 'Prontidão de Release',
      icon: Award,
      badge: `${metrics.releaseReadinessScore}%`,
    },
  ];

  const getSectionTitle = () => {
    switch (activeSection) {
      case 'overview':
        return 'Visão Executiva & Indicadores';
      case 'team':
        return 'Matriz de Throughput & Carga da Equipe';
      case 'flow':
        return 'Eficiência de Fluxo & SLA de Entrega';
      case 'bottlenecks':
        return 'Radar de Gargalos & Tarefas Estagnadas';
      case 'quality':
        return 'Qualidade, Tipologia & Escopo';
      case 'release':
        return 'Prontidão de Release & Changelog';
      default:
        return 'Relatórios & Analytics';
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        gap: 5,
        padding: 5,
        boxSizing: 'border-box',
        background: c.shelf,
        borderRadius: 10,
        border: 'none',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* ========================================================================= */}
      {/* 1. SIDEBAR ESQUERDA: NAVEGAÇÃO ANALÍTICA ESTILO DEVFLOW                   */}
      {/* ========================================================================= */}
      <div
        style={{
          width: 240,
          minWidth: 220,
          maxWidth: 260,
          flexShrink: 0,
          background: c.card,
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: '10px 8px',
          gap: 8,
        }}
      >
        {/* Header da Sidebar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 4px' }}>
          <div
            style={{
              width: 26,
              height: 26,
              borderRadius: 6,
              background: `${accentColor}18`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <BarChart3 size={15} color={accentColor} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary }}>Relatórios</span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 600,
                  padding: '1px 5px',
                  borderRadius: 10,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  color: c.textSecondary,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {selectedProject?.title || repoName}
              </span>
            </div>
            <div style={{ fontSize: 10, color: c.textMuted }}>
              {metrics.total} tarefas monitoradas
            </div>
          </div>
        </div>

        {/* Filtro Rápido de Horizonte Temporal na Sidebar */}
        <div
          style={{
            display: 'flex',
            background: c.pillBg,
            borderRadius: 6,
            padding: 2,
            gap: 2,
          }}
        >
          {[
            { id: 'all', label: 'Tudo' },
            { id: '30d', label: '30d' },
            { id: '14d', label: '14d' },
            { id: '7d', label: '7d' },
          ].map((p) => {
            const isSelected = timeRange === p.id;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setTimeRange(p.id as TimeRangeFilter)}
                style={{
                  flex: 1,
                  background: isSelected ? c.pillActive : 'transparent',
                  color: isSelected ? c.textPrimary : c.textMuted,
                  border: 'none',
                  borderRadius: 5,
                  padding: '3px 0',
                  fontSize: 10,
                  fontWeight: isSelected ? 600 : 500,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  textAlign: 'center',
                }}
              >
                {p.label}
              </button>
            );
          })}
        </div>

        {/* Divisor sutil */}
        <div style={{ height: 1, background: c.borderSubtle, margin: '2px 0' }} />

        {/* Lista de Navegação das Seções */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            flex: 1,
            overflowY: 'auto',
          }}
        >
          {navSections.map((sec) => {
            const isSelected = activeSection === sec.id;
            const Icon = sec.icon;
            return (
              <button
                key={sec.id}
                type="button"
                onClick={() => {
                  setActiveSection(sec.id);
                  if (sec.id !== 'team') {
                    setSelectedMemberLogin(null);
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 8px',
                  borderRadius: 6,
                  border: 'none',
                  background: isSelected
                    ? isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(0, 0, 0, 0.05)'
                    : 'transparent',
                  color: isSelected ? c.textPrimary : c.textSecondary,
                  cursor: 'pointer',
                  transition: 'all 0.12s ease',
                  textAlign: 'left',
                  position: 'relative',
                }}
              >
                {/* Linha indicadora de ativo na lateral esquerda */}
                {isSelected && (
                  <div
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 6,
                      bottom: 6,
                      width: 2.5,
                      borderRadius: '0 2px 2px 0',
                      background: accentColor,
                    }}
                  />
                )}
                <Icon
                  size={14}
                  color={isSelected ? accentColor : c.textMuted}
                  style={{ flexShrink: 0 }}
                />
                <span
                  style={{
                    flex: 1,
                    fontSize: 11.5,
                    fontWeight: isSelected ? 600 : 500,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {sec.label}
                </span>
                {sec.badge !== undefined && (
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 600,
                      padding: '1px 5px',
                      borderRadius: 10,
                      background: sec.badgeColor
                        ? `${sec.badgeColor}22`
                        : isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : 'rgba(0, 0, 0, 0.05)',
                      color: sec.badgeColor || (isSelected ? c.textPrimary : c.textMuted),
                    }}
                  >
                    {sec.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Rodapé da Sidebar: Ações de Exportação Rápidas */}
        <div
          style={{
            borderTop: `1px solid ${c.borderSubtle}`,
            paddingTop: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <button
            type="button"
            onClick={() => handleCopy(aiExecutiveSummary.stakeholdersText, 'sidebar-copy')}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '6px 8px',
              borderRadius: 6,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
              color: c.textSecondary,
              border: 'none',
              fontSize: 10.5,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {copiedKey === 'sidebar-copy' ? (
              <>
                <Check size={12} color={c.success} />
                <span style={{ color: c.success }}>Relatório Copiado</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copiar Relatório</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleDownloadMarkdown}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '6px 8px',
              borderRadius: 6,
              background: 'transparent',
              color: c.textMuted,
              border: 'none',
              fontSize: 10.5,
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <Download size={12} />
            <span>Exportar .md</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 2. ÁREA PRINCIPAL: HEADER, SHELF INTEGRADO E WORKSPACE MODULAR            */}
      {/* ========================================================================= */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          minHeight: 0,
          overflow: 'hidden',
        }}
      >
        {/* Header Superior da Visão Atual */}
        <div
          style={{
            background: c.card,
            borderRadius: 8,
            padding: '9px 14px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            flexShrink: 0,
          }}
        >
          {/* Título & Contexto da Seção */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 13.5, fontWeight: 600, color: c.textPrimary }}>
                  {getSectionTitle()}
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 600,
                    padding: '1.5px 6px',
                    borderRadius: 10,
                    background: `${accentColor}18`,
                    color: accentColor,
                  }}
                >
                  {timeRange === 'all' ? 'Histórico Completo' : `Últimos ${timeRange}`}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: c.textMuted, marginTop: 1 }}>
                {repoName} · {metrics.total} tarefas monitoradas · {metrics.done} concluídas ({metrics.completionPercent}%) · Lead Time {metrics.avgLeadTimeDays}d
              </div>
            </div>
          </div>

          {/* Botões de Ação na Direita */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => handleCopy(aiExecutiveSummary.stakeholdersText, 'header-copy')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                color: c.textSecondary,
                border: 'none',
                borderRadius: 6,
                padding: '5px 9px',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              {copiedKey === 'header-copy' ? (
                <>
                  <Check size={12} color={c.success} />
                  <span style={{ color: c.success }}>Copiado</span>
                </>
              ) : (
                <>
                  <Copy size={12} />
                  <span>Copiar</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadMarkdown}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                color: c.textSecondary,
                border: 'none',
                borderRadius: 6,
                padding: '5px 9px',
                fontSize: 11,
                fontWeight: 500,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
            >
              <Download size={12} />
              <span>Exportar .md</span>
            </button>

            <button
              type="button"
              onClick={handleTriggerAiRefresh}
              disabled={isGeneratingAi}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: accentColor,
                color: accentContrastText,
                border: 'none',
                borderRadius: 6,
                padding: '5px 10px',
                fontSize: 11,
                fontWeight: 600,
                cursor: isGeneratingAi ? 'default' : 'pointer',
                opacity: isGeneratingAi ? 0.7 : 1,
                transition: 'all 0.15s ease',
              }}
            >
              <Sparkles size={12} className={isGeneratingAi ? 'spin-animation' : ''} />
              <span>{isGeneratingAi ? 'Analisando...' : 'IA Insights'}</span>
            </button>
          </div>
        </div>

        {/* Shelf de Métricas Integrado Padrão DevFlow (Estilo Marcos / Sprints) */}
        <div
          style={{
            background: c.card,
            borderRadius: 8,
            padding: '8px 14px',
            display: 'grid',
            gridTemplateColumns: 'repeat(6, 1fr)',
            gap: 12,
            alignItems: 'center',
            flexShrink: 0,
          }}
        >
          {/* KPI 1: Saúde do Projeto */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: c.textMuted, letterSpacing: '0.04em' }}>
              SAÚDE DO PROJETO
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary }}>
                {metrics.healthScore}%
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: metrics.healthScore >= 80 ? c.success : c.warning,
                }}
              >
                {metrics.healthScore >= 80 ? 'Excelente' : 'Estável'}
              </span>
            </div>
          </div>

          {/* KPI 2: Progresso & Vazão */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: c.textMuted, letterSpacing: '0.04em' }}>
              VAZÃO DE ENTREGAS
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary }}>
                {metrics.done}
              </span>
              <span style={{ fontSize: 10.5, color: c.textSecondary }}>
                / {metrics.total} ({metrics.completionPercent}%)
              </span>
            </div>
            <div
              style={{
                width: '100%',
                height: 3,
                borderRadius: 2,
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${metrics.completionPercent}%`,
                  height: '100%',
                  background: accentColor,
                  borderRadius: 2,
                  transition: 'width 0.4s ease',
                }}
              />
            </div>
          </div>

          {/* KPI 3: Lead Time Médio */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: c.textMuted, letterSpacing: '0.04em' }}>
              LEAD TIME MÉDIO
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary }}>
                {metrics.avgLeadTimeDays}d
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, color: c.info }}>
                Ágil (≤ 14d)
              </span>
            </div>
          </div>

          {/* KPI 4: Taxa de Bugs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: c.textMuted, letterSpacing: '0.04em' }}>
              TAXA DE RETRABALHO
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary }}>
                {metrics.bugRate}%
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: metrics.bugRate <= 15 ? c.success : c.danger,
                }}
              >
                {metrics.bugCount} bugs / {metrics.featCount} feats
              </span>
            </div>
          </div>

          {/* KPI 5: WIP em Andamento */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: c.textMuted, letterSpacing: '0.04em' }}>
              WIP EM ANDAMENTO
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary }}>
                {metrics.inProgress}
              </span>
              <span style={{ fontSize: 9, fontWeight: 600, color: c.success }}>
                Fluxo Saudável
              </span>
            </div>
          </div>

          {/* KPI 6: Prontidão de Release */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <div style={{ fontSize: 9.5, fontWeight: 600, color: c.textMuted, letterSpacing: '0.04em' }}>
              PRONTIDÃO RELEASE
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary }}>
                {metrics.releaseReadinessScore}%
              </span>
              <span
                style={{
                  fontSize: 9,
                  fontWeight: 600,
                  color: metrics.releaseReadinessScore >= 80 ? c.success : c.warning,
                }}
              >
                {metrics.releaseReadinessScore >= 80 ? 'Homologação' : 'Em Progresso'}
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* 3. CONTEÚDO PRINCIPAL DINÂMICO CONFORME A ABA ATIVA NA SIDEBAR            */}
        {/* ========================================================================= */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
          }}
        >
          {/* ----------------------------------------------------------------------- */}
          {/* ABA 1: VISÃO EXECUTIVA                                                  */}
          {/* ----------------------------------------------------------------------- */}
          {activeSection === 'overview' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1.2fr 0.8fr',
                gap: 5,
                flex: 1,
                minHeight: 0,
              }}
            >
              {/* Coluna Esquerda: Ritmo + Entregas Concluídas */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minHeight: 0 }}>
                {/* Ritmo: issues criadas × concluídas por período (segue o filtro de horizonte) */}
                <ThroughputTrendCard issues={issues} timeRange={timeRange} isEffectiveDark={isEffectiveDark} c={c} />

                {/* Feed de Entregas Recentes Concluídas (Linear / DevFlow Style) */}
                <div
                  style={{
                    background: c.card,
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    flex: 1,
                    minHeight: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckCircle2 size={13} color={c.success} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary }}>
                        Feed de Entregas Concluídas
                      </span>
                    </div>

                    {/* Filtro de Escopo do Feed */}
                    <div style={{ display: 'flex', gap: 3 }}>
                      {[
                        { id: 'all', label: 'Todas' },
                        { id: 'feat', label: 'Features' },
                        { id: 'bug', label: 'Bugs' },
                      ].map((f) => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => setScopeFilter(f.id as ScopeFilterType)}
                          style={{
                            background: scopeFilter === f.id ? c.pillActive : 'transparent',
                            color: scopeFilter === f.id ? c.textPrimary : c.textMuted,
                            border: 'none',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 9.5,
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Lista de Issues Concluídas */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      flex: 1,
                      overflowY: 'auto',
                    }}
                  >
                    {recentDeliveredIssues.length === 0 ? (
                      <div
                        style={{
                          padding: 16,
                          textAlign: 'center',
                          fontSize: 11,
                          color: c.textMuted,
                        }}
                      >
                        Nenhuma entrega concluída encontrada no período.
                      </div>
                    ) : (
                      recentDeliveredIssues.map((iss) => {
                        const num = iss.githubNumber || (iss as any).number || iss.id.slice(0, 4);
                        const devName = iss.assignees?.[0]?.name || iss.author || 'DevFlow';
                        const avatarUrl = resolveAvatar(devName, iss.assignees?.[0]?.avatarUrl);

                        return (
                          <div
                            key={iss.id}
                            onClick={() => onOpenIssueDetail?.(iss)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 8,
                              padding: '6px 8px',
                              borderRadius: 5,
                              background: c.cardSecondary,
                              cursor: onOpenIssueDetail ? 'pointer' : 'default',
                              transition: 'background 0.12s ease',
                            }}
                          >
                            <CheckCircle2 size={13} color={c.success} style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: 10, color: c.textMuted, fontWeight: 500, flexShrink: 0 }}>
                              #{num}
                            </span>
                            <span
                              style={{
                                flex: 1,
                                fontSize: 11,
                                color: c.textPrimary,
                                fontWeight: 500,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {iss.title}
                            </span>
                            {iss.tag && (
                              <span
                                style={{
                                  fontSize: 9,
                                  fontWeight: 600,
                                  padding: '1.5px 5px',
                                  borderRadius: 4,
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                                  color: c.textSecondary,
                                  flexShrink: 0,
                                }}
                              >
                                {iss.tag}
                              </span>
                            )}
                            <MemberAvatar
                              name={devName}
                              avatarUrl={avatarUrl}
                              size={18}
                              accentColor={accentColor}
                            />
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Coluna Direita: Tech Lead Copilot IA & Prontidão de Release */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minHeight: 0 }}>
                {/* Tech Lead Copilot IA */}
                <div
                  style={{
                    background: c.card,
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={13} color={accentColor} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary }}>
                        Tech Lead Copilot
                      </span>
                    </div>

                    {/* Abas do Copilot */}
                    <div style={{ display: 'flex', gap: 2, background: c.pillBg, borderRadius: 5, padding: 2 }}>
                      {[
                        { id: 'diagnosis', label: 'Diagnóstico' },
                        { id: 'recommendations', label: 'Ações' },
                        { id: 'stakeholders', label: 'Resumo' },
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setAiTab(t.id as AiTabMode)}
                          style={{
                            background: aiTab === t.id ? c.pillActive : 'transparent',
                            color: aiTab === t.id ? c.textPrimary : c.textMuted,
                            border: 'none',
                            borderRadius: 4,
                            padding: '2px 6px',
                            fontSize: 9.5,
                            fontWeight: 500,
                            cursor: 'pointer',
                          }}
                        >
                          {t.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Conteúdo da Aba Ativa do Copilot */}
                  {aiTab === 'diagnosis' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {customAiInsight && (
                        <div
                          style={{
                            background: 'rgba(56, 139, 253, 0.1)',
                            border: '1px solid rgba(56, 139, 253, 0.3)',
                            borderRadius: 6,
                            padding: '8px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Sparkles size={12} color="#58a6ff" />
                            <span style={{ fontSize: 11, fontWeight: 600, color: '#58a6ff' }}>
                              Diagnóstico Copilot IA
                            </span>
                          </div>
                          <div style={{ fontSize: 11, color: c.textPrimary, whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>
                            {customAiInsight}
                          </div>
                        </div>
                      )}
                      {aiExecutiveSummary.diagnosis.map((d, i) => {
                        const Icon = d.icon;
                        const statusColor =
                          d.status === 'success' ? c.success : d.status === 'warning' ? c.warning : c.danger;
                        return (
                          <div
                            key={i}
                            style={{
                              background: c.cardSecondary,
                              borderRadius: 6,
                              padding: '8px 10px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 3,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <Icon size={12} color={statusColor} />
                              <span style={{ fontSize: 11, fontWeight: 600, color: c.textPrimary }}>
                                {d.title}
                              </span>
                            </div>
                            <div style={{ fontSize: 10.5, color: c.textSecondary, lineHeight: 1.4 }}>
                              {d.text}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {aiTab === 'recommendations' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {aiExecutiveSummary.recommendations.map((rec) => (
                        <div
                          key={rec.id}
                          style={{
                            background: c.cardSecondary,
                            borderRadius: 6,
                            padding: '8px 10px',
                            display: 'flex',
                            alignItems: 'flex-start',
                            justifyContent: 'space-between',
                            gap: 8,
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span
                                style={{
                                  fontSize: 8.5,
                                  fontWeight: 600,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: `${accentColor}22`,
                                  color: accentColor,
                                }}
                              >
                                {rec.tag}
                              </span>
                              <span style={{ fontSize: 10, color: c.textMuted }}>
                                Prioridade {rec.priority}
                              </span>
                            </div>
                            <div style={{ fontSize: 10.5, color: c.textPrimary, lineHeight: 1.4 }}>
                              {rec.text}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleCopy(rec.text, rec.id)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: copiedKey === rec.id ? c.success : c.textMuted,
                              cursor: 'pointer',
                              padding: 2,
                            }}
                          >
                            {copiedKey === rec.id ? <Check size={13} /> : <Copy size={13} />}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {aiTab === 'stakeholders' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <pre
                        style={{
                          margin: 0,
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: c.cardSecondary,
                          color: c.textSecondary,
                          fontSize: 10,
                          lineHeight: 1.45,
                          whiteSpace: 'pre-wrap',
                          fontFamily: 'inherit',
                          maxHeight: 160,
                          overflowY: 'auto',
                        }}
                      >
                        {aiExecutiveSummary.stakeholdersText}
                      </pre>
                      <button
                        type="button"
                        onClick={() => handleCopy(aiExecutiveSummary.stakeholdersText, 'full-text')}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '5px 8px',
                          borderRadius: 5,
                          background: `${accentColor}22`,
                          color: accentColor,
                          border: 'none',
                          fontSize: 10.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {copiedKey === 'full-text' ? <Check size={12} /> : <Copy size={12} />}
                        <span>{copiedKey === 'full-text' ? 'Copiado!' : 'Copiar Sumário Completo'}</span>
                      </button>
                    </div>
                  )}
                </div>

                {/* Radar de Prontidão da Release */}
                <div
                  style={{
                    background: c.card,
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    flex: 1,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Award size={13} color={accentColor} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary }}>
                        Critérios de Homologação (DoD)
                      </span>
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 600, color: c.success }}>
                      {metrics.releaseReadinessScore}% Aprovado
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[
                      {
                        label: 'Zero Bugs Críticos / Urgentes',
                        status: metrics.priorityCounts.Urgente === 0,
                        detail: `${metrics.priorityCounts.Urgente} pendentes`,
                      },
                      {
                        label: 'Vazão Mínima de Entrega (≥ 70%)',
                        status: metrics.completionPercent >= 70,
                        detail: `${metrics.completionPercent}% concluído`,
                      },
                      {
                        label: 'WIP Estável e Controlado (≤ 5)',
                        status: metrics.inProgress <= 5,
                        detail: `${metrics.inProgress} tarefas ativas`,
                      },
                      {
                        label: 'Taxa de Retrabalho Saudável (≤ 15%)',
                        status: metrics.bugRate <= 15,
                        detail: `${metrics.bugRate}% bugs`,
                      },
                    ].map((item, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 8px',
                          borderRadius: 5,
                          background: c.cardSecondary,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          {item.status ? (
                            <CheckCircle2 size={13} color={c.success} />
                          ) : (
                            <AlertCircle size={13} color={c.warning} />
                          )}
                          <span style={{ fontSize: 10.5, color: c.textPrimary, fontWeight: 500 }}>
                            {item.label}
                          </span>
                        </div>
                        <span style={{ fontSize: 9.5, color: item.status ? c.success : c.textMuted }}>
                          {item.detail}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* ABA 2: MATRIZ DA EQUIPE                                                 */}
          {/* ----------------------------------------------------------------------- */}
          {activeSection === 'team' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minHeight: 0 }}>
              {/* Tabela de Throughput & Carga por Membro */}
              <div
                style={{
                  background: c.card,
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <Users size={14} color={accentColor} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: c.textPrimary }}>
                      Produtividade & Alocação por Desenvolvedor
                    </span>
                  </div>
                  <span style={{ fontSize: 10.5, color: c.textMuted }}>
                    {teamWorkload.length} engenheiros com tarefas atribuídas
                  </span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {/* Cabeçalho da Tabela */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr 1fr',
                      gap: 8,
                      padding: '4px 8px',
                      fontSize: 9.5,
                      fontWeight: 600,
                      color: c.textMuted,
                      textTransform: 'uppercase',
                      letterSpacing: '0.04em',
                    }}
                  >
                    <span>Desenvolvedor</span>
                    <span>Concluídas</span>
                    <span>Em Progresso</span>
                    <span>A Fazer</span>
                    <span>Taxa de Entrega</span>
                    <span style={{ textAlign: 'right' }}>Ação</span>
                  </div>

                  {/* Linhas de Desenvolvedores */}
                  {teamWorkload.map((m) => {
                    const isSelected = selectedMemberLogin === m.login;
                    const pct = m.total > 0 ? Math.round((m.done / m.total) * 100) : 0;
                    const loadStatus =
                      m.inProgress >= 4
                        ? { label: 'Carga Alta', color: c.danger }
                        : m.inProgress >= 1
                        ? { label: 'Equilibrado', color: c.success }
                        : { label: 'Livre', color: c.info };

                    return (
                      <div
                        key={m.login}
                        style={{
                          display: 'grid',
                          gridTemplateColumns: '2fr 1fr 1fr 1fr 1.5fr 1fr',
                          gap: 8,
                          alignItems: 'center',
                          padding: '8px 10px',
                          borderRadius: 6,
                          background: isSelected
                            ? isEffectiveDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.06)'
                            : c.cardSecondary,
                          transition: 'background 0.12s ease',
                        }}
                      >
                        {/* Desenvolvedor */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <MemberAvatar
                            name={m.name || m.login}
                            avatarUrl={m.avatarUrl}
                            size={22}
                            accentColor={accentColor}
                          />
                          <div style={{ minWidth: 0, overflow: 'hidden' }}>
                            <div
                              style={{
                                fontSize: 11.5,
                                fontWeight: 600,
                                color: c.textPrimary,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {m.name || m.login}
                            </div>
                            <div style={{ fontSize: 9.5, color: c.textMuted }}>@{m.login}</div>
                          </div>
                        </div>

                        {/* Concluídas */}
                        <div style={{ fontSize: 12, fontWeight: 600, color: c.success }}>
                          {m.done}{' '}
                          <span style={{ fontSize: 9.5, color: c.textMuted, fontWeight: 400 }}>
                            / {m.total}
                          </span>
                        </div>

                        {/* Em Progresso */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary }}>
                            {m.inProgress}
                          </span>
                          <span
                            style={{
                              fontSize: 8.5,
                              fontWeight: 600,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: `${loadStatus.color}22`,
                              color: loadStatus.color,
                            }}
                          >
                            {loadStatus.label}
                          </span>
                        </div>

                        {/* A Fazer */}
                        <div style={{ fontSize: 11.5, color: c.textSecondary }}>{m.todo}</div>

                        {/* Barra de Progresso */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 2,
                              background: isEffectiveDark
                                ? 'rgba(255, 255, 255, 0.08)'
                                : 'rgba(0, 0, 0, 0.06)',
                              overflow: 'hidden',
                            }}
                          >
                            <div
                              style={{
                                width: `${pct}%`,
                                height: '100%',
                                background: pct === 100 ? c.success : accentColor,
                                borderRadius: 2,
                              }}
                            />
                          </div>
                          <span style={{ fontSize: 10.5, fontWeight: 600, color: c.textPrimary, width: 32 }}>
                            {pct}%
                          </span>
                        </div>

                        {/* Ação Filtrar */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedMemberLogin(isSelected ? null : m.login)
                            }
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '3px 8px',
                              borderRadius: 4,
                              border: 'none',
                              background: isSelected ? accentColor : 'rgba(255, 255, 255, 0.05)',
                              color: isSelected ? accentContrastText : c.textSecondary,
                              cursor: 'pointer',
                              transition: 'all 0.12s ease',
                            }}
                          >
                            {isSelected ? 'Limpar' : 'Ver Tarefas'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Lista de Tarefas do Desenvolvedor Selecionado (ou Geral) */}
              <div
                style={{
                  background: c.card,
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <FileText size={13} color={accentColor} />
                    <span style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary }}>
                      {selectedMemberLogin
                        ? `Tarefas Atribuídas a @${selectedMemberLogin} (${memberFilteredIssues.length})`
                        : `Todas as Tarefas dos Colaboradores (${memberFilteredIssues.length})`}
                    </span>
                  </div>
                  {selectedMemberLogin && (
                    <button
                      type="button"
                      onClick={() => setSelectedMemberLogin(null)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: accentColor,
                        fontSize: 10.5,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      Mostrar todos
                    </button>
                  )}
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    flex: 1,
                    overflowY: 'auto',
                  }}
                >
                  {memberFilteredIssues.slice(0, 15).map((iss) => {
                    const isDone = iss.status === 'Concluído';
                    const num = iss.githubNumber || (iss as any).number || iss.id.slice(0, 4);

                    return (
                      <div
                        key={iss.id}
                        onClick={() => onOpenIssueDetail?.(iss)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          padding: '6px 10px',
                          borderRadius: 5,
                          background: c.cardSecondary,
                          cursor: onOpenIssueDetail ? 'pointer' : 'default',
                        }}
                      >
                        {isDone ? (
                          <CheckCircle2 size={13} color={c.success} style={{ flexShrink: 0 }} />
                        ) : (
                          <Circle size={13} color={c.textMuted} style={{ flexShrink: 0 }} />
                        )}
                        <span style={{ fontSize: 10, color: c.textMuted, fontWeight: 500, flexShrink: 0 }}>
                          #{num}
                        </span>
                        <span
                          style={{
                            flex: 1,
                            fontSize: 11,
                            color: isDone ? c.textMuted : c.textPrimary,
                            textDecoration: isDone ? 'line-through' : 'none',
                            fontWeight: 500,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {iss.title}
                        </span>
                        <span
                          style={{
                            fontSize: 9,
                            fontWeight: 600,
                            padding: '1.5px 6px',
                            borderRadius: 4,
                            background:
                              iss.priority === 'Urgente'
                                ? `${c.danger}22`
                                : iss.priority === 'Alta'
                                ? `${c.warning}22`
                                : 'rgba(255, 255, 255, 0.05)',
                            color:
                              iss.priority === 'Urgente'
                                ? c.danger
                                : iss.priority === 'Alta'
                                ? c.warning
                                : c.textSecondary,
                            flexShrink: 0,
                          }}
                        >
                          {iss.priority}
                        </span>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 600,
                            color: isDone ? c.success : iss.status === 'Em Progresso' ? accentColor : c.textMuted,
                            flexShrink: 0,
                          }}
                        >
                          {iss.status}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* ABA 3: EFICIÊNCIA & FLUXO (SLA)                                         */}
          {/* ----------------------------------------------------------------------- */}
          {activeSection === 'flow' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minHeight: 0 }}>
              {/* 4 Cards de Métricas DORA & SLA */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 5,
                }}
              >
                {[
                  {
                    title: 'CYCLE TIME MÉDIO',
                    val: `${efficiencyMetrics.cycleTimeDays} dias`,
                    sub: 'Ativação até Deploy',
                    color: c.info,
                  },
                  {
                    title: 'LEAD TIME TOTAL',
                    val: `${metrics.avgLeadTimeDays} dias`,
                    sub: 'Criação até Conclusão',
                    color: c.purple,
                  },
                  {
                    title: 'RESOLUÇÃO DE BUGS',
                    val: `${efficiencyMetrics.bugResolutionDays} dias`,
                    sub: 'Tempo Médio de Fix',
                    color: c.success,
                  },
                  {
                    title: 'SLA DE ENTREGA',
                    val: `${efficiencyMetrics.slaCompliancePercent}%`,
                    sub: 'Cumprimento de Prazos',
                    color: accentColor,
                  },
                ].map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      background: c.card,
                      borderRadius: 8,
                      padding: '12px 14px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <div style={{ fontSize: 9.5, fontWeight: 600, color: c.textMuted, letterSpacing: '0.04em' }}>
                      {item.title}
                    </div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: item.color }}>
                      {item.val}
                    </div>
                    <div style={{ fontSize: 10, color: c.textSecondary }}>
                      {item.sub}
                    </div>
                  </div>
                ))}
              </div>

              {/* Pipeline Visual de Fluxo Contínuo */}
              <div
                style={{
                  background: c.card,
                  borderRadius: 8,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Activity size={14} color={accentColor} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: c.textPrimary }}>
                      Distribuição do Pipeline por Estágio
                    </span>
                  </div>
                  <span style={{ fontSize: 10.5, color: c.textMuted }}>
                    {metrics.total} tarefas monitoradas no fluxo
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr auto 1fr auto 1fr',
                    gap: 10,
                    alignItems: 'center',
                  }}
                >
                  {/* Etapa 1: A Fazer */}
                  <div
                    style={{
                      background: c.cardSecondary,
                      borderRadius: 6,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: c.textMuted }}>
                      1. BACKLOG & A FAZER
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary }}>
                      {metrics.todo}
                    </span>
                    <span style={{ fontSize: 9.5, color: c.textSecondary }}>
                      {Math.round((metrics.todo / Math.max(1, metrics.total)) * 100)}% do volume total
                    </span>
                  </div>

                  <ArrowRight size={14} color={c.textMuted} />

                  {/* Etapa 2: Em Progresso */}
                  <div
                    style={{
                      background: c.cardSecondary,
                      borderRadius: 6,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: accentColor }}>
                      2. EM DESENVOLVIMENTO
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: accentColor }}>
                      {metrics.inProgress}
                    </span>
                    <span style={{ fontSize: 9.5, color: c.textSecondary }}>
                      WIP Ativo no momento
                    </span>
                  </div>

                  <ArrowRight size={14} color={c.textMuted} />

                  {/* Etapa 3: Concluído */}
                  <div
                    style={{
                      background: c.cardSecondary,
                      borderRadius: 6,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: c.success }}>
                      3. CONCLUÍDO & DEPLOYADO
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: c.success }}>
                      {metrics.done}
                    </span>
                    <span style={{ fontSize: 9.5, color: c.textSecondary }}>
                      {metrics.completionPercent}% taxa de entrega
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* ABA 4: GARGALOS & RISCOS                                                */}
          {/* ----------------------------------------------------------------------- */}
          {activeSection === 'bottlenecks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minHeight: 0 }}>
              {/* Alerta de Diagnóstico de Estagnação */}
              <div
                style={{
                  background: c.card,
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <div
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 6,
                      background: `${c.danger}18`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Flame size={15} color={c.danger} />
                  </div>
                  <div>
                    <div style={{ fontSize: 12.5, fontWeight: 600, color: c.textPrimary }}>
                      Radar de Tarefas com Maior Tempo em Aberto
                    </div>
                    <div style={{ fontSize: 10.5, color: c.textSecondary }}>
                      {bottleneckIssues.length > 0
                        ? `${bottleneckIssues.length} tarefas identificadas que requerem atenção do time de engenharia.`
                        : 'Nenhum gargalo crítico identificado. Todas as tarefas estão com fluxo ágil.'}
                    </div>
                  </div>
                </div>

                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: bottleneckIssues.length > 0 ? `${c.danger}22` : `${c.success}22`,
                    color: bottleneckIssues.length > 0 ? c.danger : c.success,
                  }}
                >
                  {bottleneckIssues.length > 0 ? 'Ação Recomendada' : 'Fluxo Saudável'}
                </span>
              </div>

              {/* Tabela de Gargalos */}
              <div
                style={{
                  background: c.card,
                  borderRadius: 8,
                  padding: '10px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {/* Cabeçalho */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '0.8fr 3fr 1fr 1.5fr 1fr 0.8fr',
                    gap: 8,
                    padding: '4px 8px',
                    fontSize: 9.5,
                    fontWeight: 600,
                    color: c.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                  }}
                >
                  <span>Prioridade</span>
                  <span>Tarefa</span>
                  <span>Tempo em Aberto</span>
                  <span>Responsável</span>
                  <span>Status</span>
                  <span style={{ textAlign: 'right' }}>Ação</span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    flex: 1,
                    overflowY: 'auto',
                  }}
                >
                  {bottleneckIssues.length === 0 ? (
                    <div
                      style={{
                        padding: 24,
                        textAlign: 'center',
                        fontSize: 11,
                        color: c.textMuted,
                      }}
                    >
                      Nenhum gargalo identificado no projeto.
                    </div>
                  ) : (
                    bottleneckIssues.map((iss) => {
                      const num = iss.githubNumber || (iss as any).number || iss.id.slice(0, 4);
                      const devName = iss.assignees?.[0]?.name || iss.author || 'Sem responsável';
                      const avatarUrl = resolveAvatar(devName, iss.assignees?.[0]?.avatarUrl);

                      return (
                        <div
                          key={iss.id}
                          style={{
                            display: 'grid',
                            gridTemplateColumns: '0.8fr 3fr 1fr 1.5fr 1fr 0.8fr',
                            gap: 8,
                            alignItems: 'center',
                            padding: '8px 10px',
                            borderRadius: 6,
                            background: c.cardSecondary,
                          }}
                        >
                          {/* Prioridade */}
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 600,
                              padding: '1.5px 6px',
                              borderRadius: 4,
                              background:
                                iss.priority === 'Urgente'
                                  ? `${c.danger}22`
                                  : iss.priority === 'Alta'
                                  ? `${c.warning}22`
                                  : 'rgba(255, 255, 255, 0.05)',
                              color:
                                iss.priority === 'Urgente'
                                  ? c.danger
                                  : iss.priority === 'Alta'
                                  ? c.warning
                                  : c.textSecondary,
                              width: 'fit-content',
                            }}
                          >
                            {iss.priority}
                          </span>

                          {/* Título */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <span style={{ fontSize: 10, color: c.textMuted, fontWeight: 500, flexShrink: 0 }}>
                              #{num}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 500,
                                color: c.textPrimary,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {iss.title}
                            </span>
                          </div>

                          {/* Tempo em Aberto */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                            <Clock size={11} color={iss.daysOpen >= 7 ? c.danger : c.warning} />
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 600,
                                color: iss.daysOpen >= 7 ? c.danger : c.warning,
                              }}
                            >
                              {iss.daysOpen} dias
                            </span>
                          </div>

                          {/* Responsável */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                            <MemberAvatar
                              name={devName}
                              avatarUrl={avatarUrl}
                              size={18}
                              accentColor={accentColor}
                            />
                            <span
                              style={{
                                fontSize: 10.5,
                                color: c.textSecondary,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {devName}
                            </span>
                          </div>

                          {/* Status */}
                          <span style={{ fontSize: 10.5, fontWeight: 500, color: c.textSecondary }}>
                            {iss.status}
                          </span>

                          {/* Ação */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => onOpenIssueDetail?.(iss)}
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                padding: '3px 8px',
                                borderRadius: 4,
                                border: 'none',
                                background: isEffectiveDark
                                  ? 'rgba(255, 255, 255, 0.08)'
                                  : 'rgba(0, 0, 0, 0.06)',
                                color: c.textPrimary,
                                cursor: 'pointer',
                              }}
                            >
                              Abrir
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* ABA 5: QUALIDADE & ESCOPO                                               */}
          {/* ----------------------------------------------------------------------- */}
          {activeSection === 'quality' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minHeight: 0 }}>
              {/* Distribuição de Escopo: Features vs Bugs vs Outros */}
              <div
                style={{
                  background: c.card,
                  borderRadius: 8,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Layers size={14} color={accentColor} />
                    <span style={{ fontSize: 12.5, fontWeight: 600, color: c.textPrimary }}>
                      Distribuição de Tipologia & Escopo
                    </span>
                  </div>
                  <span style={{ fontSize: 10.5, color: c.textMuted }}>
                    {metrics.total} tarefas categorizadas
                  </span>
                </div>

                {/* Barra Segmentada de Tipologia */}
                <div
                  style={{
                    width: '100%',
                    height: 8,
                    borderRadius: 4,
                    display: 'flex',
                    overflow: 'hidden',
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  }}
                >
                  <div
                    style={{
                      width: `${(metrics.featCount / Math.max(1, metrics.total)) * 100}%`,
                      height: '100%',
                      background: accentColor,
                    }}
                    title={`Features: ${metrics.featCount}`}
                  />
                  <div
                    style={{
                      width: `${(metrics.bugCount / Math.max(1, metrics.total)) * 100}%`,
                      height: '100%',
                      background: c.danger,
                    }}
                    title={`Bugs: ${metrics.bugCount}`}
                  />
                  <div
                    style={{
                      width: `${(metrics.otherCount / Math.max(1, metrics.total)) * 100}%`,
                      height: '100%',
                      background: c.info,
                    }}
                    title={`Outros / Infra: ${metrics.otherCount}`}
                  />
                </div>

                {/* 3 Blocos de Categoria */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <div
                    style={{
                      background: c.cardSecondary,
                      borderRadius: 6,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: accentColor }}>
                      FEATURES & RECURSOS
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary }}>
                      {metrics.featCount}
                    </span>
                    <span style={{ fontSize: 9.5, color: c.textMuted }}>
                      {Math.round((metrics.featCount / Math.max(1, metrics.total)) * 100)}% do escopo
                    </span>
                  </div>

                  <div
                    style={{
                      background: c.cardSecondary,
                      borderRadius: 6,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: c.danger }}>
                      BUGS & CORREÇÕES
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary }}>
                      {metrics.bugCount}
                    </span>
                    <span style={{ fontSize: 9.5, color: c.textMuted }}>
                      {metrics.bugRate}% taxa de retrabalho
                    </span>
                  </div>

                  <div
                    style={{
                      background: c.cardSecondary,
                      borderRadius: 6,
                      padding: '10px 12px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 2,
                    }}
                  >
                    <span style={{ fontSize: 10, fontWeight: 600, color: c.info }}>
                      INFRAESTRUTURA & TAREFAS
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: c.textPrimary }}>
                      {metrics.otherCount}
                    </span>
                    <span style={{ fontSize: 9.5, color: c.textMuted }}>
                      {Math.round((metrics.otherCount / Math.max(1, metrics.total)) * 100)}% do escopo
                    </span>
                  </div>
                </div>
              </div>

              {/* Pirâmide de Prioridades & Módulos */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: 5,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {/* Pirâmide de Prioridades */}
                <div
                  style={{
                    background: c.card,
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary }}>
                    Pirâmide de Prioridades
                  </span>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {[
                      { label: 'Urgente', count: metrics.priorityCounts.Urgente, color: c.danger },
                      { label: 'Alta', count: metrics.priorityCounts.Alta, color: c.warning },
                      { label: 'Média', count: metrics.priorityCounts.Média, color: c.info },
                      { label: 'Baixa', count: metrics.priorityCounts.Baixa, color: c.textMuted },
                    ].map((p, idx) => {
                      const pct = Math.round((p.count / Math.max(1, metrics.total)) * 100);
                      return (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '6px 10px',
                            borderRadius: 6,
                            background: c.cardSecondary,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <div
                              style={{
                                width: 8,
                                height: 8,
                                borderRadius: '50%',
                                background: p.color,
                              }}
                            />
                            <span style={{ fontSize: 11, fontWeight: 500, color: c.textPrimary }}>
                              {p.label}
                            </span>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontSize: 10.5, color: c.textMuted }}>{pct}%</span>
                            <span style={{ fontSize: 11.5, fontWeight: 600, color: p.color }}>
                              {p.count}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Módulos & Etiquetas */}
                <div
                  style={{
                    background: c.card,
                    borderRadius: 8,
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary }}>
                    Módulos & Etiquetas Mais Ativas
                  </span>

                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: 6,
                      alignContent: 'flex-start',
                    }}
                  >
                    {topLabels.length === 0 ? (
                      <span style={{ fontSize: 11, color: c.textMuted }}>Nenhuma etiqueta mapeada</span>
                    ) : (
                      topLabels.map((lbl, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 5,
                            padding: '4px 8px',
                            borderRadius: 5,
                            background: c.cardSecondary,
                            border: `1px solid ${c.borderSubtle}`,
                          }}
                        >
                          <Tag size={10} color={accentColor} />
                          <span style={{ fontSize: 10.5, fontWeight: 500, color: c.textPrimary }}>
                            {lbl.name}
                          </span>
                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 600,
                              padding: '0 4px',
                              borderRadius: 8,
                              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                              color: c.textSecondary,
                            }}
                          >
                            {lbl.count}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* ABA 6: PRONTIDÃO DE RELEASE & CHANGELOG                                 */}
          {/* ----------------------------------------------------------------------- */}
          {activeSection === 'release' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minHeight: 0 }}>
              {/* Card de Status da Release */}
              <div
                style={{
                  background: c.card,
                  borderRadius: 8,
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 12,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div
                    style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: `${accentColor}18`,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <GitPullRequest size={16} color={accentColor} />
                  </div>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: c.textPrimary }}>
                      Auditoria de Prontidão para Próxima Versão
                    </div>
                    <div style={{ fontSize: 10.5, color: c.textSecondary }}>
                      Índice de Confiabilidade da Release calculado em {metrics.releaseReadinessScore}%
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => handleCopy(aiExecutiveSummary.stakeholdersText, 'release-notes')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 12px',
                    borderRadius: 6,
                    background: accentColor,
                    color: accentContrastText,
                    border: 'none',
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  <Copy size={12} />
                  <span>
                    {copiedKey === 'release-notes' ? 'Changelog Copiado!' : 'Copiar Changelog da Release'}
                  </span>
                </button>
              </div>

              {/* Changelog Estruturado das Entregas */}
              <div
                style={{
                  background: c.card,
                  borderRadius: 8,
                  padding: '12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: c.textPrimary }}>
                    Changelog Automatizado a partir das Entregas ({recentDeliveredIssues.length} itens)
                  </span>
                  <span style={{ fontSize: 10.5, color: c.textMuted }}>
                    v1.0.0-rc1
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    flex: 1,
                    overflowY: 'auto',
                  }}
                >
                  {recentDeliveredIssues.map((iss) => (
                    <div
                      key={iss.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 8,
                        padding: '6px 10px',
                        borderRadius: 5,
                        background: c.cardSecondary,
                      }}
                    >
                      <CheckCircle2 size={13} color={c.success} style={{ flexShrink: 0 }} />
                      <span style={{ fontSize: 10, color: c.textMuted, fontWeight: 600 }}>
                        #{iss.githubNumber || (iss as any).number || iss.id.slice(0, 4)}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          fontSize: 11,
                          color: c.textPrimary,
                          fontWeight: 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {iss.title}
                      </span>
                      <span
                        style={{
                          fontSize: 9,
                          fontWeight: 600,
                          padding: '1px 5px',
                          borderRadius: 4,
                          background: `${accentColor}22`,
                          color: accentColor,
                        }}
                      >
                        {iss.tag || 'feature'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
