import React, { useState, useMemo, useEffect, useCallback } from 'react';
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
import { logSystemActivity } from '../../utils/brainService';
import { computeProjectHealthScore } from '../../utils/gitProjects';
import { ThroughputTrendCard } from './ThroughputTrendCard';
import { ProjectHealthReasonsCard } from './ProjectHealthReasonsCard';

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
        fontWeight: 400,
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
  const [teamTab, setTeamTab] = useState<'tasks' | 'workload'>('tasks');
  const [aiTab, setAiTab] = useState<AiTabMode>('diagnosis');
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [customAiInsight, setCustomAiInsight] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Redimensionamento horizontal da sidebar (estilo Marcos)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('aura_project_reports_sidebar_width');
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 180 && val <= 450) return val;
      }
    } catch {}
    return 240;
  });
  const [isDraggingLeftSidebar, setIsDraggingLeftSidebar] = useState(false);

  const startResizeLeftSidebar = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingLeftSidebar(true);
      document.body.classList.add('resizing-col');

      const startX = e.clientX;
      const initialWidth = leftSidebarWidth;

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaX = moveEvent.clientX - startX;
        const newWidth = Math.max(180, Math.min(450, initialWidth + deltaX));
        setLeftSidebarWidth(newWidth);
        try {
          localStorage.setItem('aura_project_reports_sidebar_width', String(newWidth));
        } catch {}
      };

      const onMouseUp = () => {
        setIsDraggingLeftSidebar(false);
        document.body.classList.remove('resizing-col');
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    },
    [leftSidebarWidth],
  );

  const resetLeftSidebarWidth = useCallback(() => {
    setLeftSidebarWidth(240);
    try {
      localStorage.setItem('aura_project_reports_sidebar_width', '240');
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      document.body.classList.remove('resizing-col');
    };
  }, []);

  // Paleta de cores 100% neutra monocromática (R = G = B, ZERO tom azulado ou slate) alinhada à aba Marcos
  const c = useMemo(() => {
    if (isEffectiveDark) {
      return {
        shelf: '#101010',
        card: '#161616',
        cardSecondary: '#1e1e1e',
        cardHover: '#242424',
        cardSelected: '#2a2a2a',
        pillBg: '#202020',
        pillActive: '#2a2a2a',
        inputBg: '#202020',
        divider: 'rgba(255, 255, 255, 0.07)',
        borderSubtle: 'rgba(255, 255, 255, 0.07)',
        textPrimary: '#ffffff',
        textSecondary: '#a3a3a3',
        textMuted: '#737373',
        success: '#10b981',
        successBg: 'rgba(16, 185, 129, 0.15)',
        danger: '#ef4444',
        dangerBg: 'rgba(239, 68, 68, 0.15)',
        warning: '#f59e0b',
        warningBg: 'rgba(245, 158, 11, 0.15)',
        info: '#3b82f6',
        purple: '#a855f7',
      };
    }
    return {
      shelf: '#f5f5f5',
      card: '#ffffff',
      cardSecondary: '#fafafa',
      cardHover: '#f0f0f0',
      cardSelected: '#e5e5e5',
      pillBg: '#eeeeee',
      pillActive: '#ffffff',
      inputBg: '#f0f0f0',
      divider: 'rgba(0, 0, 0, 0.05)',
      borderSubtle: 'rgba(0, 0, 0, 0.05)',
      textPrimary: '#111111',
      textSecondary: '#777777',
      textMuted: '#999999',
      success: '#10b981',
      successBg: 'rgba(16, 185, 129, 0.12)',
      danger: '#ef4444',
      dangerBg: 'rgba(239, 68, 68, 0.12)',
      warning: '#f59e0b',
      warningBg: 'rgba(245, 158, 11, 0.12)',
      info: '#3b82f6',
      purple: '#a855f7',
    };
  }, [isEffectiveDark]);

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

    // Health Score (utiliza a mesma função unificada computeProjectHealthScore)
    const healthScore = computeProjectHealthScore(
      timeFilteredIssues,
      done,
      inProgress,
      total,
      completionPercent
    );

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
      healthScore,
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
          width: leftSidebarWidth,
          minWidth: 180,
          maxWidth: 450,
          flexShrink: 0,
          background: c.card,
          borderRadius: 8,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          padding: 10,
          gap: 7,
          border: 'none',
          boxShadow: 'none',
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
              <span style={{ fontSize: 13, fontWeight: 400, color: c.textPrimary }}>Relatórios</span>
              <span
                style={{
                  fontSize: 9.5,
                  fontWeight: 400,
                  padding: '1px 5px',
                  borderRadius: 10,
                  background: c.cardSecondary,
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
                  fontWeight: 400,
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
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = c.cardHover;
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '7px 8px',
                  borderRadius: 6,
                  border: 'none',
                  background: isSelected ? c.cardSelected : 'transparent',
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
                    fontWeight: 400,
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
                      fontWeight: 400,
                      padding: '1px 5px',
                      borderRadius: 10,
                      background: sec.badgeColor
                        ? `${sec.badgeColor}22`
                        : isSelected
                        ? c.cardHover
                        : c.cardSecondary,
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
            onMouseEnter={(e) => (e.currentTarget.style.background = c.cardHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = c.cardSecondary)}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 6,
              padding: '6px 8px',
              borderRadius: 6,
              background: c.cardSecondary,
              color: c.textSecondary,
              border: 'none',
              fontSize: 10.5,
              fontWeight: 400,
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
            onMouseEnter={(e) => (e.currentTarget.style.background = c.cardHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
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
              fontWeight: 400,
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
      {/* DIVISOR REDIMENSIONÁVEL ESTILO MARCOS                                    */}
      {/* ========================================================================= */}
      <div
        data-testid="resizer-reports-left"
        className={`resizer-col ${isDraggingLeftSidebar ? 'dragging' : ''}`}
        onMouseDown={startResizeLeftSidebar}
        onDoubleClick={resetLeftSidebarWidth}
        title="Arraste para redimensionar (Duplo clique para restaurar 240px)"
        style={{
          width: 7,
          marginLeft: -6,
          marginRight: -6,
          cursor: 'col-resize',
          position: 'relative',
          zIndex: 25,
          userSelect: 'none',
          alignSelf: 'stretch',
          flexShrink: 0,
        }}
      />

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
        {/* LINHA SUPERIOR: Card de Informações da Seção + 4 Cards de Métricas Modulares (Estilo Marcos) */}
        <div
          style={{
            display: 'flex',
            gap: 5,
            alignItems: 'stretch',
            flexShrink: 0,
          }}
        >
          {/* Card 1: Contexto e Ações da Seção */}
          <div
            style={{
              flex: 1.3,
              minWidth: 0,
              background: c.card,
              borderRadius: 8,
              padding: '9px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ fontSize: 13.5, fontWeight: 400, color: c.textPrimary }}>
                  {getSectionTitle()}
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 400,
                    padding: '1.5px 6px',
                    borderRadius: 10,
                    background: `${accentColor}18`,
                    color: accentColor,
                  }}
                >
                  {timeRange === 'all' ? 'Histórico Completo' : `Últimos ${timeRange}`}
                </span>
              </div>
              <div style={{ fontSize: 10.5, color: c.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {repoName} · {metrics.total} tarefas monitoradas · {metrics.done} concluídas ({metrics.completionPercent}%) · Lead Time {metrics.avgLeadTimeDays}d
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => {
                  handleCopy(aiExecutiveSummary.stakeholdersText, 'header-copy');
                  logSystemActivity('relatorios', 'copiar_relatorio', repoName);
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = c.cardHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = c.cardSecondary)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: c.cardSecondary,
                  color: c.textSecondary,
                  border: 'none',
                  borderRadius: 6,
                  height: 28,
                  padding: '0 9px',
                  fontSize: 11,
                  fontWeight: 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: 'none',
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
                onClick={() => {
                  handleDownloadMarkdown();
                  logSystemActivity('relatorios', 'exportar_markdown', repoName);
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = c.cardHover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = c.cardSecondary)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: c.cardSecondary,
                  color: c.textSecondary,
                  border: 'none',
                  borderRadius: 6,
                  height: 28,
                  padding: '0 9px',
                  fontSize: 11,
                  fontWeight: 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: 'none',
                }}
              >
                <Download size={12} />
                <span>Exportar .md</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  handleTriggerAiRefresh();
                  logSystemActivity('relatorios', 'ia_insights', repoName);
                }}
                disabled={isGeneratingAi}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  background: accentColor,
                  color: accentContrastText,
                  border: 'none',
                  borderRadius: 6,
                  height: 28,
                  padding: '0 10px',
                  fontSize: 11,
                  fontWeight: 400,
                  cursor: isGeneratingAi ? 'default' : 'pointer',
                  opacity: isGeneratingAi ? 0.7 : 1,
                  transition: 'all 0.15s ease',
                  boxShadow: 'none',
                }}
              >
                <Sparkles size={12} className={isGeneratingAi ? 'spin-animation' : ''} />
                <span>{isGeneratingAi ? 'Analisando...' : 'IA Insights'}</span>
              </button>
            </div>
          </div>

          {/* Card 2: Saúde do Projeto */}
          <div
            style={{
              background: metrics.healthScore < 60
                ? (isEffectiveDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.14)')
                : c.card,
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 2,
              minWidth: 100,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: metrics.healthScore < 60 ? (isEffectiveDark ? '#fca5a5' : '#b91c1c') : c.textMuted }}>
              <Activity size={11} color={metrics.healthScore >= 80 ? c.success : metrics.healthScore >= 60 ? c.warning : c.danger} />
              <span>Saúde</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
              <span style={{ fontSize: 15, fontWeight: 400, color: metrics.healthScore < 60 ? (isEffectiveDark ? '#ffffff' : '#991b1b') : c.textPrimary, lineHeight: 1.2 }}>
                {metrics.healthScore}%
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 400, color: metrics.healthScore >= 80 ? c.success : metrics.healthScore >= 60 ? c.warning : c.danger }}>
                {metrics.healthScore >= 80 ? 'Excelente' : metrics.healthScore >= 60 ? 'Estável' : 'Alerta'}
              </span>
            </div>
          </div>

          {/* Card 3: Vazão de Entregas */}
          <div
            style={{
              background: c.card,
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 2,
              minWidth: 120,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: c.textMuted }}>
              <CheckCircle2 size={11} color={c.success} />
              <span>Vazão</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: 15, fontWeight: 400, color: c.textPrimary, lineHeight: 1.2 }}>
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
                background: c.cardSecondary,
                overflow: 'hidden',
                marginTop: 1,
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

          {/* Card 4: Lead Time Médio */}
          <div
            style={{
              background: c.card,
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 2,
              minWidth: 100,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: c.textMuted }}>
              <Clock size={11} color={c.info} />
              <span>Lead Time</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: 15, fontWeight: 400, color: c.textPrimary, lineHeight: 1.2 }}>
                {metrics.avgLeadTimeDays}d
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 400, color: c.info }}>
                Ágil (≤14d)
              </span>
            </div>
          </div>

          {/* Card 5: Taxa de Retrabalho / Bugs */}
          <div
            style={{
              background: c.card,
              borderRadius: 8,
              padding: '8px 12px',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              gap: 2,
              minWidth: 100,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: c.textMuted }}>
              <Bug size={11} color={metrics.bugRate <= 15 ? c.success : c.danger} />
              <span>Retrabalho</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
              <span style={{ fontSize: 15, fontWeight: 400, color: c.textPrimary, lineHeight: 1.2 }}>
                {metrics.bugRate}%
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 400, color: metrics.bugRate <= 15 ? c.success : c.danger }}>
                {metrics.bugCount} bugs
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
                gridTemplateColumns: 'minmax(0, 1fr) clamp(280px, 24vw, 330px)',
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
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 400, color: c.textPrimary }}>
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
                            fontWeight: 400,
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
                            <span style={{ fontSize: 10, color: c.textMuted, fontWeight: 400, flexShrink: 0 }}>
                              #{num}
                            </span>
                            <span
                              style={{
                                flex: 1,
                                fontSize: 11,
                                color: c.textPrimary,
                                fontWeight: 400,
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
                                  fontWeight: 400,
                                  padding: '1.5px 5px',
                                  borderRadius: 4,
                                  background: c.cardHover,
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
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5, minHeight: 0, overflowY: 'auto' }}>
                {/* Card Explicativo: Motivos da Saúde do Projeto */}
                <ProjectHealthReasonsCard
                  healthScore={metrics.healthScore}
                  total={metrics.total}
                  done={metrics.done}
                  inProgress={metrics.inProgress}
                  todo={metrics.todo}
                  completionPercent={metrics.completionPercent}
                  bugCount={metrics.bugCount}
                  bugRate={metrics.bugRate}
                  isEffectiveDark={isEffectiveDark}
                  c={c}
                  projectName={selectedProject?.name || repoName}
                />

                {/* Tech Lead Copilot IA */}
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 400, color: c.textPrimary }}>
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
                            fontWeight: 400,
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
                            background: c.cardSecondary,
                            border: 'none',
                            borderRadius: 6,
                            padding: '8px 10px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <Sparkles size={12} color={accentColor} />
                            <span style={{ fontSize: 11, fontWeight: 400, color: accentColor }}>
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
                              <span style={{ fontSize: 11, fontWeight: 400, color: c.textPrimary }}>
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
                                  fontWeight: 400,
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
                          fontWeight: 400,
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
                    padding: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    flex: 1,
                    border: 'none',
                    boxShadow: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div>
                      <span style={{ fontSize: 12, fontWeight: 400, color: c.textPrimary }}>
                        Critérios de Homologação (DoD)
                      </span>
                    </div>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 5,
                        background: isEffectiveDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)',
                        borderRadius: 4,
                        padding: '2px 7px',
                        border: 'none',
                        boxShadow: 'none',
                        flexShrink: 0,
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 400,
                          color: c.success,
                          lineHeight: 1.2,
                        }}
                      >
                        {metrics.releaseReadinessScore}% Aprovado
                      </span>
                    </div>
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
                          border: 'none',
                          boxShadow: 'none',
                          transition: 'background 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          {item.status ? (
                            <CheckCircle2 size={13} color={c.success} />
                          ) : (
                            <AlertCircle size={13} color={c.warning} />
                          )}
                          <span style={{ fontSize: 10.5, color: c.textPrimary, fontWeight: 400 }}>
                            {item.label}
                          </span>
                        </div>
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 400,
                            color: item.status ? c.success : c.warning,
                            background: item.status
                              ? (isEffectiveDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)')
                              : (isEffectiveDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.12)'),
                            padding: '2px 6px',
                            borderRadius: 4,
                            lineHeight: 1.2,
                            flexShrink: 0,
                            border: 'none',
                            boxShadow: 'none',
                            transition: 'all 0.15s ease',
                          }}
                        >
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
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                flex: 1,
                minHeight: 0,
              }}
            >
              {/* Barra de Tabs Superior da Matriz da Equipe */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 8,
                  padding: '0 2px',
                }}
              >
                {/* Tabs à esquerda */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                    background: c.pillBg,
                    borderRadius: 6,
                    padding: 3,
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setTeamTab('tasks');
                      logSystemActivity('relatorios', 'alternar_aba_equipe', `${repoName} - tarefas`);
                    }}
                    style={{
                      background: teamTab === 'tasks' ? c.pillActive : 'transparent',
                      color: teamTab === 'tasks' ? c.textPrimary : c.textMuted,
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 400,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>
                      {selectedMemberLogin
                        ? `Tarefas de @${selectedMemberLogin}`
                        : 'Todas as Tarefas dos Colaboradores'}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 400,
                        padding: '1px 5px',
                        borderRadius: 10,
                        background: teamTab === 'tasks' ? c.cardSecondary : 'rgba(255, 255, 255, 0.05)',
                        color: teamTab === 'tasks' ? c.textPrimary : c.textMuted,
                      }}
                    >
                      {memberFilteredIssues.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setTeamTab('workload');
                      logSystemActivity('relatorios', 'alternar_aba_equipe', `${repoName} - alocacao`);
                    }}
                    style={{
                      background: teamTab === 'workload' ? c.pillActive : 'transparent',
                      color: teamTab === 'workload' ? c.textPrimary : c.textMuted,
                      border: 'none',
                      borderRadius: 4,
                      padding: '4px 10px',
                      fontSize: 11,
                      fontWeight: 400,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <span>Produtividade & Alocação</span>
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 400,
                        padding: '1px 5px',
                        borderRadius: 10,
                        background: teamTab === 'workload' ? c.cardSecondary : 'rgba(255, 255, 255, 0.05)',
                        color: teamTab === 'workload' ? c.textPrimary : c.textMuted,
                      }}
                    >
                      {teamWorkload.length} engenheiros
                    </span>
                  </button>
                </div>

                {/* Botões de Ações à direita da div de tabs */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {selectedMemberLogin && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 10.5, color: c.textMuted, fontWeight: 400 }}>
                        Filtrado por: <span style={{ color: accentColor }}>@{selectedMemberLogin}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMemberLogin(null);
                          logSystemActivity('relatorios', 'limpar_filtro_desenvolvedor', repoName);
                        }}
                        style={{
                          background: c.cardSecondary,
                          border: 'none',
                          color: c.textSecondary,
                          fontSize: 10,
                          fontWeight: 400,
                          cursor: 'pointer',
                          padding: '3px 8px',
                          borderRadius: 4,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        Limpar filtro
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* CONTEÚDO DA ABA 1: LISTA DE TAREFAS DOS COLABORADORES */}
              {teamTab === 'tasks' && (
                <div
                  style={{
                    background: c.card,
                    borderRadius: 8,
                    padding: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    border: 'none',
                    boxShadow: 'none',
                  }}
                >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 400, color: c.textPrimary }}>
                      {selectedMemberLogin
                        ? `Tarefas Atribuídas a @${selectedMemberLogin}`
                        : 'Todas as Tarefas dos Colaboradores'}
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        fontWeight: 400,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: c.cardSecondary,
                        color: c.textSecondary,
                      }}
                    >
                      {memberFilteredIssues.length}
                    </span>
                  </div>
                  {selectedMemberLogin && (
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedMemberLogin(null);
                        logSystemActivity('relatorios', 'limpar_filtro_desenvolvedor', repoName);
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: accentColor,
                        fontSize: 10.5,
                        fontWeight: 400,
                        cursor: 'pointer',
                        padding: '2px 6px',
                        borderRadius: 4,
                        transition: 'opacity 0.15s ease',
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
                    minHeight: 0,
                    overflowY: 'auto',
                  }}
                >
                  {memberFilteredIssues.length === 0 ? (
                    <div style={{ padding: '24px 10px', textAlign: 'center', color: c.textMuted, fontSize: 11, fontWeight: 400 }}>
                      Nenhuma tarefa encontrada para este filtro.
                    </div>
                  ) : (
                    memberFilteredIssues.map((iss) => {
                      const isDone = iss.status === 'Concluído';
                      const num = iss.githubNumber || (iss as any).number || iss.id.slice(0, 4);
                      const devName = iss.assignees?.[0]?.name || (iss as any).assignee || iss.author || 'Sem responsável';
                      const avatarUrl = resolveAvatar(devName, iss.assignees?.[0]?.avatarUrl);

                      return (
                        <div
                          key={iss.id}
                          onClick={() => onOpenIssueDetail?.(iss)}
                          onMouseEnter={(e) => (e.currentTarget.style.background = c.cardHover)}
                          onMouseLeave={(e) => (e.currentTarget.style.background = c.cardSecondary)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            padding: '7px 10px',
                            borderRadius: 5,
                            background: c.cardSecondary,
                            cursor: onOpenIssueDetail ? 'pointer' : 'default',
                            transition: 'background 0.12s ease',
                            border: 'none',
                            boxShadow: 'none',
                          }}
                        >
                          {isDone ? (
                            <CheckCircle2 size={13} color={c.success} style={{ flexShrink: 0 }} />
                          ) : (
                            <Circle size={13} color={c.textMuted} style={{ flexShrink: 0 }} />
                          )}
                          <span style={{ fontSize: 10, color: c.textMuted, fontWeight: 400, flexShrink: 0 }}>
                            #{num}
                          </span>
                          <span
                            style={{
                              flex: 1,
                              fontSize: 11,
                              color: isDone ? c.textMuted : c.textPrimary,
                              textDecoration: isDone ? 'line-through' : 'none',
                              fontWeight: 400,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {iss.title}
                          </span>

                          {/* Usuário Responsável com Fotinha/Avatar */}
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 5,
                              flexShrink: 0,
                              background: isEffectiveDark
                                ? 'rgba(255, 255, 255, 0.04)'
                                : 'rgba(0, 0, 0, 0.04)',
                              padding: '2px 7px',
                              borderRadius: 4,
                              border: 'none',
                              boxShadow: 'none',
                            }}
                          >
                            <MemberAvatar
                              name={devName}
                              avatarUrl={avatarUrl}
                              size={16}
                              accentColor={accentColor}
                            />
                            <span
                              style={{
                                fontSize: 10,
                                color: devName === 'Sem responsável' ? c.textMuted : c.textSecondary,
                                fontWeight: 400,
                                maxWidth: 100,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {devName.replace(/^@/, '')}
                            </span>
                          </div>

                          <span
                            style={{
                              fontSize: 9,
                              fontWeight: 400,
                              padding: '1.5px 6px',
                              borderRadius: 4,
                              background:
                                iss.priority === 'Urgente'
                                  ? `${c.danger}22`
                                  : iss.priority === 'Alta'
                                  ? `${c.warning}22`
                                  : c.cardHover,
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
                              fontWeight: 400,
                              color: isDone ? c.success : iss.status === 'Em Progresso' ? accentColor : c.textMuted,
                              flexShrink: 0,
                            }}
                          >
                            {iss.status}
                          </span>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
              )}

              {/* CONTEÚDO DA ABA 2: PRODUTIVIDADE & ALOCAÇÃO POR DESENVOLVEDOR */}
              {teamTab === 'workload' && (
                <div
                style={{
                  background: c.card,
                  borderRadius: 8,
                  padding: 10,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                  flex: 1,
                  minHeight: 0,
                  overflow: 'hidden',
                  border: 'none',
                  boxShadow: 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <span style={{ fontSize: 12.5, fontWeight: 400, color: c.textPrimary }}>
                      Produtividade & Alocação por Desenvolvedor
                    </span>
                  </div>
                  <span style={{ fontSize: 10, color: c.textMuted }}>
                    {teamWorkload.length} engenheiros
                  </span>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                  }}
                >
                  {/* Cabeçalho da Tabela */}
                  <div
                    style={{
                      display: 'grid',
                      gridTemplateColumns: 'minmax(110px, 1.4fr) minmax(50px, 0.7fr) minmax(70px, 0.9fr) minmax(45px, 0.6fr) minmax(80px, 1.1fr) minmax(60px, 0.7fr)',
                      gap: 6,
                      padding: '4px 8px',
                      fontSize: 9,
                      fontWeight: 400,
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
                          gridTemplateColumns: 'minmax(110px, 1.4fr) minmax(50px, 0.7fr) minmax(70px, 0.9fr) minmax(45px, 0.6fr) minmax(80px, 1.1fr) minmax(60px, 0.7fr)',
                          gap: 6,
                          alignItems: 'center',
                          padding: '7px 8px',
                          borderRadius: 6,
                          background: isSelected ? c.cardSelected : c.cardSecondary,
                          transition: 'background 0.12s ease',
                          border: 'none',
                          boxShadow: 'none',
                        }}
                      >
                        {/* Desenvolvedor */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                          <MemberAvatar
                            name={m.name || m.login}
                            avatarUrl={m.avatarUrl}
                            size={22}
                            accentColor={accentColor}
                          />
                          <div style={{ minWidth: 0, overflow: 'hidden' }}>
                            <div
                              style={{
                                fontSize: 11,
                                fontWeight: 400,
                                color: c.textPrimary,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {m.name || m.login}
                            </div>
                            <div style={{ fontSize: 9, color: c.textMuted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>@{m.login}</div>
                          </div>
                        </div>

                        {/* Concluídas */}
                        <div style={{ fontSize: 11.5, fontWeight: 400, color: c.success }}>
                          {m.done}{' '}
                          <span style={{ fontSize: 9, color: c.textMuted, fontWeight: 400 }}>
                            / {m.total}
                          </span>
                        </div>

                        {/* Em Progresso */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 400, color: c.textPrimary }}>
                            {m.inProgress}
                          </span>
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 400,
                              padding: '1px 4px',
                              borderRadius: 4,
                              background: `${loadStatus.color}22`,
                              color: loadStatus.color,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {loadStatus.label}
                          </span>
                        </div>

                        {/* A Fazer */}
                        <div style={{ fontSize: 11, color: c.textSecondary }}>{m.todo}</div>

                        {/* Barra de Progresso */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                          <div
                            style={{
                              flex: 1,
                              height: 4,
                              borderRadius: 2,
                              background: c.cardHover,
                              overflow: 'hidden',
                              minWidth: 24,
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
                          <span style={{ fontSize: 9.5, fontWeight: 400, color: c.textPrimary, width: 28, textAlign: 'right' }}>
                            {pct}%
                          </span>
                        </div>

                          {/* Ação Filtrar */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => {
                                const next = isSelected ? null : m.login;
                                setSelectedMemberLogin(next);
                                setTeamTab('tasks');
                                if (next) {
                                  logSystemActivity('relatorios', 'filtrar_desenvolvedor', `${repoName} - @${next}`);
                                } else {
                                  logSystemActivity('relatorios', 'limpar_filtro_desenvolvedor', repoName);
                                }
                              }}
                              style={{
                                fontSize: 9.5,
                                fontWeight: 400,
                                padding: '3px 7px',
                                borderRadius: 4,
                                border: 'none',
                                background: isSelected ? accentColor : c.cardHover,
                                color: isSelected ? accentContrastText : c.textSecondary,
                                cursor: 'pointer',
                                transition: 'all 0.12s ease',
                                whiteSpace: 'nowrap',
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
              )}
            </div>
          )}

          {/* ----------------------------------------------------------------------- */}
          {/* ABA 3: EFICIÊNCIA & FLUXO (SLA)                                         */}
          {/* ----------------------------------------------------------------------- */}
          {/* ----------------------------------------------------------------------- */}
          {/* ABA 3: EFICIÊNCIA & FLUXO (SLA / SLI)                                   */}
          {/* ----------------------------------------------------------------------- */}
          {activeSection === 'flow' && (
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) clamp(280px, 24vw, 330px)',
                gap: 8,
                flex: 1,
                minHeight: 0,
              }}
            >
              {/* COLUNA ESQUERDA / CENTRAL (MAIOR): CARDS DORA/SLA + AGING WIP */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                {/* 4 Cards de Métricas DORA & SLA */}
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, 1fr)',
                    gap: 6,
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
                        padding: 10,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        border: 'none',
                        boxShadow: 'none',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ fontSize: 9.5, fontWeight: 400, color: c.textMuted, letterSpacing: '0.04em' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 17, fontWeight: 400, color: item.color }}>
                        {item.val}
                      </div>
                      <div style={{ fontSize: 9.5, color: c.textSecondary }}>
                        {item.sub}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Aging WIP: Tarefas Ativas no Fluxo */}
                <div
                  style={{
                    background: c.card,
                    borderRadius: 8,
                    padding: 10,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                    flex: 1,
                    minHeight: 0,
                    overflow: 'hidden',
                    border: 'none',
                    boxShadow: 'none',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontSize: 12, fontWeight: 400, color: c.textPrimary }}>
                        Aging WIP · Idade das Tarefas em Andamento
                      </span>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 400,
                          padding: '1px 6px',
                          borderRadius: 10,
                          background: c.cardSecondary,
                          color: c.textSecondary,
                        }}
                      >
                        {metrics.inProgress} ativas
                      </span>
                    </div>
                    <span style={{ fontSize: 10, color: c.textMuted }}>
                      Monitoramento preventivo para evitar extrapolação de SLA
                    </span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      flex: 1,
                      minHeight: 0,
                      overflowY: 'auto',
                    }}
                  >
                    {timeFilteredIssues
                      .filter((i) => i.status === 'Em Progresso' || (i as any).state === 'in_progress' || (i.rawLabels || []).some((l: any) => String(l.name || l).toLowerCase().includes('progress')))
                      .map((task, idx) => {
                        const createdTime = (task as any).createdAt || task.createdAtIso || Date.now();
                        const daysOld = Math.max(1, Math.round((Date.now() - new Date(createdTime).getTime()) / 86400000));
                        const isAtRisk = daysOld > 5;
                        const devName = task.assignees?.[0]?.name || (task as any).assignee || task.author || 'Sem responsável';
                        const avatarUrl = resolveAvatar(devName, task.assignees?.[0]?.avatarUrl);

                        return (
                          <div
                            key={task.id || idx}
                            onClick={() => onOpenIssueDetail?.(task)}
                            onMouseEnter={(e) => (e.currentTarget.style.background = c.cardHover)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = c.cardSecondary)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 8,
                              padding: '7px 10px',
                              borderRadius: 5,
                              background: c.cardSecondary,
                              cursor: onOpenIssueDetail ? 'pointer' : 'default',
                              transition: 'background 0.12s ease',
                              border: 'none',
                              boxShadow: 'none',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                              <span style={{ fontSize: 10, color: c.textMuted, fontWeight: 400, flexShrink: 0 }}>
                                #{task.githubNumber || (task as any).number || task.id.slice(0, 4)}
                              </span>
                              <span
                                style={{
                                  fontSize: 11,
                                  color: c.textPrimary,
                                  fontWeight: 400,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                }}
                              >
                                {task.title}
                              </span>
                            </div>

                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                              {/* Responsável com Avatar */}
                              <div
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  background: isEffectiveDark
                                    ? 'rgba(255, 255, 255, 0.04)'
                                    : 'rgba(0, 0, 0, 0.04)',
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                }}
                              >
                                <MemberAvatar
                                  name={devName}
                                  avatarUrl={avatarUrl}
                                  size={16}
                                  accentColor={accentColor}
                                />
                                <span
                                  style={{
                                    fontSize: 10,
                                    color: devName === 'Sem responsável' ? c.textMuted : c.textSecondary,
                                    fontWeight: 400,
                                    maxWidth: 90,
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                  }}
                                >
                                  {devName.replace(/^@/, '')}
                                </span>
                              </div>

                              {/* SLA Status Chip */}
                              <span
                                style={{
                                  fontSize: 9.5,
                                  fontWeight: 400,
                                  padding: '2px 6px',
                                  borderRadius: 4,
                                  background: isAtRisk
                                    ? (isEffectiveDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.12)')
                                    : (isEffectiveDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)'),
                                  color: isAtRisk ? c.warning : c.success,
                                  border: 'none',
                                  boxShadow: 'none',
                                }}
                              >
                                {daysOld}d no fluxo · {isAtRisk ? 'Atenção' : 'Dentro do SLA'}
                              </span>
                            </div>
                          </div>
                        );
                      })}

                    {timeFilteredIssues.filter((i) => i.status === 'Em Progresso' || (i as any).state === 'in_progress').length === 0 && (
                      <div
                        style={{
                          padding: '24px 12px',
                          textAlign: 'center',
                          color: c.textMuted,
                          fontSize: 11,
                          fontWeight: 400,
                          background: c.cardSecondary,
                          borderRadius: 6,
                        }}
                      >
                        Nenhuma tarefa ativa com envelhecimento excessivo no WIP. Fluxo saudável e controlado.
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* COLUNA DIREITA (LARGURA MENOR, ORGANIZADA VERTICALMENTE): */}
              {/* 1. DISTRIBUIÇÃO DO PIPELINE POR ESTÁGIO */}
              {/* 2. EFICIÊNCIA DE FLUXO */}
              {/* 3. CUMPRIMENTO DE SLI / SLA */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  minHeight: 0,
                  overflowY: 'auto',
                }}
              >
                {/* 1. Pipeline Visual de Fluxo Contínuo */}
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 400, color: c.textPrimary }}>
                      Distribuição do Pipeline por Estágio
                    </span>
                    <span style={{ fontSize: 9.5, color: c.textMuted, flexShrink: 0 }}>
                      {metrics.total} tarefas
                    </span>
                  </div>

                  {/* Barra Segmentada do Pipeline */}
                  <div style={{ display: 'flex', height: 4, borderRadius: 2, overflow: 'hidden', background: c.cardHover, gap: 2 }}>
                    <div style={{ width: `${Math.round((metrics.todo / Math.max(1, metrics.total)) * 100)}%`, background: isEffectiveDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.25)' }} />
                    <div style={{ width: `${Math.round((metrics.inProgress / Math.max(1, metrics.total)) * 100)}%`, background: accentColor }} />
                    <div style={{ width: `${metrics.completionPercent}%`, background: c.success }} />
                  </div>

                  {/* Lista Vertical dos 3 Estágios */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {/* Etapa 1: A Fazer */}
                    <div
                      style={{
                        background: c.cardSecondary,
                        borderRadius: 6,
                        padding: '7px 9px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.textMuted }} />
                        <span style={{ fontSize: 10.5, fontWeight: 400, color: c.textPrimary }}>
                          1. Backlog & A Fazer
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 400, color: c.textPrimary }}>
                          {metrics.todo}
                        </span>
                        <span style={{ fontSize: 9.5, color: c.textMuted }}>
                          ({Math.round((metrics.todo / Math.max(1, metrics.total)) * 100)}%)
                        </span>
                      </div>
                    </div>

                    {/* Etapa 2: Em Desenvolvimento */}
                    <div
                      style={{
                        background: c.cardSecondary,
                        borderRadius: 6,
                        padding: '7px 9px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor }} />
                        <span style={{ fontSize: 10.5, fontWeight: 400, color: accentColor }}>
                          2. Em Desenvolvimento
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 400, color: accentColor }}>
                          {metrics.inProgress}
                        </span>
                        <span style={{ fontSize: 9.5, color: c.textMuted }}>
                          WIP ativo
                        </span>
                      </div>
                    </div>

                    {/* Etapa 3: Concluído */}
                    <div
                      style={{
                        background: c.cardSecondary,
                        borderRadius: 6,
                        padding: '7px 9px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: c.success }} />
                        <span style={{ fontSize: 10.5, fontWeight: 400, color: c.success }}>
                          3. Concluído & Deployado
                        </span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                        <span style={{ fontSize: 12.5, fontWeight: 400, color: c.success }}>
                          {metrics.done}
                        </span>
                        <span style={{ fontSize: 9.5, color: c.textMuted }}>
                          ({metrics.completionPercent}%)
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Eficiência de Fluxo */}
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 400, color: c.textPrimary }}>
                      Eficiência de Fluxo (Tempo Ativo vs Espera)
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        color: accentColor,
                        fontWeight: 400,
                        background: `${accentColor}18`,
                        padding: '2px 6px',
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      68% Tempo de Ação
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', background: c.cardSecondary }}>
                      <div
                        style={{
                          width: '68%',
                          background: accentColor,
                          transition: 'width 0.3s ease',
                        }}
                        title="Tempo em Desenvolvimento Ativo: 68%"
                      />
                      <div
                        style={{
                          width: '32%',
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.18)' : 'rgba(0, 0, 0, 0.18)',
                          transition: 'width 0.3s ease',
                        }}
                        title="Tempo em Fila / Revisão / Espera: 32%"
                      />
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9.5, color: c.textSecondary }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor }} />
                        Mão na Massa: {(parseFloat(metrics.avgLeadTimeDays) * 0.68 || 2.1).toFixed(1)}d
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: isEffectiveDark ? 'rgba(255, 255, 255, 0.3)' : 'rgba(0, 0, 0, 0.3)' }} />
                        Review/Espera: {(parseFloat(metrics.avgLeadTimeDays) * 0.32 || 1.0).toFixed(1)}d
                      </span>
                    </div>
                  </div>

                  <div
                    style={{
                      background: c.cardSecondary,
                      borderRadius: 6,
                      padding: '7px 9px',
                      fontSize: 10,
                      color: c.textSecondary,
                      lineHeight: 1.4,
                    }}
                  >
                    O fluxo contínuo opera com cadência ágil. A maior parte do tempo de ciclo está concentrada na resolução técnica, com baixo atrito de filas.
                  </div>
                </div>

                {/* 3. Metas de SLA / SLI por Categoria */}
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
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 12, fontWeight: 400, color: c.textPrimary }}>
                      Cumprimento de SLI / SLA por Severidade
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        color: c.success,
                        fontWeight: 400,
                        background: isEffectiveDark ? 'rgba(16, 185, 129, 0.16)' : 'rgba(16, 185, 129, 0.12)',
                        padding: '2px 6px',
                        borderRadius: 4,
                        flexShrink: 0,
                      }}
                    >
                      {efficiencyMetrics.slaCompliancePercent}% Conformidade
                    </span>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {[
                      { nivel: 'Crítico & Bugs', sla: '< 2 dias', conformidade: '100%', cor: c.danger },
                      { nivel: 'Features & Recursos', sla: '< 7 dias', conformidade: '94%', cor: accentColor },
                      { nivel: 'Tarefas Gerais', sla: '< 10 dias', conformidade: '98%', cor: c.textSecondary },
                    ].map((slaItem, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '6px 9px',
                          borderRadius: 6,
                          background: c.cardSecondary,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span style={{ width: 6, height: 6, borderRadius: '50%', background: slaItem.cor }} />
                          <span style={{ fontSize: 10.5, color: c.textPrimary }}>{slaItem.nivel}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 9.5, color: c.textMuted }}>Meta {slaItem.sla}</span>
                          <span
                            style={{
                              fontSize: 9.5,
                              color: c.success,
                              fontWeight: 400,
                              background: isEffectiveDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.10)',
                              padding: '1px 5px',
                              borderRadius: 4,
                            }}
                          >
                            {slaItem.conformidade} no prazo
                          </span>
                        </div>
                      </div>
                    ))}
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
                    <div style={{ fontSize: 12.5, fontWeight: 400, color: c.textPrimary }}>
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
                    fontWeight: 400,
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
                    fontWeight: 400,
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
                              fontWeight: 400,
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
                            <span style={{ fontSize: 10, color: c.textMuted, fontWeight: 400, flexShrink: 0 }}>
                              #{num}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                fontWeight: 400,
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
                                fontWeight: 400,
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
                          <span style={{ fontSize: 10.5, fontWeight: 400, color: c.textSecondary }}>
                            {iss.status}
                          </span>

                          {/* Ação */}
                          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                              type="button"
                              onClick={() => onOpenIssueDetail?.(iss)}
                              style={{
                                fontSize: 10,
                                fontWeight: 400,
                                padding: '3px 8px',
                                borderRadius: 4,
                                border: 'none',
                                background: c.cardHover,
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
                  <div>
                    <span style={{ fontSize: 12.5, fontWeight: 400, color: c.textPrimary }}>
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
                    background: c.cardSecondary,
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
                    <span style={{ fontSize: 10, fontWeight: 400, color: accentColor }}>
                      FEATURES & RECURSOS
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 400, color: c.textPrimary }}>
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
                    <span style={{ fontSize: 10, fontWeight: 400, color: c.danger }}>
                      BUGS & CORREÇÕES
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 400, color: c.textPrimary }}>
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
                    <span style={{ fontSize: 10, fontWeight: 400, color: c.info }}>
                      INFRAESTRUTURA & TAREFAS
                    </span>
                    <span style={{ fontSize: 16, fontWeight: 400, color: c.textPrimary }}>
                      {metrics.otherCount}
                    </span>
                    <span style={{ fontSize: 9.5, color: c.textMuted }}>
                      {Math.round((metrics.otherCount / Math.max(1, metrics.total)) * 100)}% do escopo
                    </span>
                  </div>
                </div>
              </div>

              {/* Pirâmide Visual de Prioridades */}
              <div
                style={{
                  background: c.card,
                  borderRadius: 8,
                  padding: '16px 20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                  flex: 1,
                  minHeight: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 400, color: c.textPrimary }}>
                      Pirâmide de Prioridades
                    </span>
                    <span style={{ fontSize: 10.5, color: c.textMuted }}>
                      Hierarquia de severidade e alocação do backlog de engenharia
                    </span>
                  </div>
                  <span style={{ fontSize: 11, color: c.textSecondary }}>
                    Total: {metrics.total} demandas categorizadas
                  </span>
                </div>

                {/* Estrutura Geométrica da Pirâmide */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: 6,
                    width: '100%',
                    padding: '8px 0',
                  }}
                >
                  {[
                    {
                      label: 'Urgente',
                      count: metrics.priorityCounts.Urgente,
                      color: c.danger,
                      bg: isEffectiveDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.12)',
                      hoverBg: isEffectiveDark ? 'rgba(239, 68, 68, 0.24)' : 'rgba(239, 68, 68, 0.18)',
                      width: '38%',
                      sla: 'SLA < 24h · Bloqueios e Falhas Críticas',
                    },
                    {
                      label: 'Alta',
                      count: metrics.priorityCounts.Alta,
                      color: c.warning,
                      bg: isEffectiveDark ? 'rgba(249, 115, 22, 0.16)' : 'rgba(249, 115, 22, 0.12)',
                      hoverBg: isEffectiveDark ? 'rgba(249, 115, 22, 0.24)' : 'rgba(249, 115, 22, 0.18)',
                      width: '56%',
                      sla: 'SLA < 3 dias · Principais Entregas da Sprint',
                    },
                    {
                      label: 'Média',
                      count: metrics.priorityCounts.Média,
                      color: c.info,
                      bg: isEffectiveDark ? 'rgba(56, 189, 248, 0.16)' : 'rgba(56, 189, 248, 0.12)',
                      hoverBg: isEffectiveDark ? 'rgba(56, 189, 248, 0.24)' : 'rgba(56, 189, 248, 0.18)',
                      width: '76%',
                      sla: 'SLA < 7 dias · Evoluções e Melhorias Contínuas',
                    },
                    {
                      label: 'Baixa',
                      count: metrics.priorityCounts.Baixa,
                      color: c.textSecondary,
                      bg: isEffectiveDark ? 'rgba(148, 163, 184, 0.14)' : 'rgba(148, 163, 184, 0.1)',
                      hoverBg: isEffectiveDark ? 'rgba(148, 163, 184, 0.22)' : 'rgba(148, 163, 184, 0.16)',
                      width: '96%',
                      sla: 'Backlog Geral · Sem criticidade de prazo imediato',
                    },
                  ].map((tier, idx) => {
                    const pct = Math.round((tier.count / Math.max(1, metrics.total)) * 100);
                    return (
                      <div
                        key={idx}
                        style={{
                          width: tier.width,
                          background: tier.bg,
                          borderRadius: 6,
                          padding: '10px 18px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 12,
                          transition: 'all 0.15s ease',
                          cursor: 'default',
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.background = tier.hoverBg;
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.background = tier.bg;
                          e.currentTarget.style.transform = 'translateY(0)';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: '50%',
                              background: tier.color,
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: 12, fontWeight: 400, color: c.textPrimary }}>
                            {tier.label}
                          </span>
                        </div>

                        <span
                          style={{
                            fontSize: 10,
                            color: c.textSecondary,
                            display: 'inline-block',
                            textAlign: 'center',
                          }}
                        >
                          {tier.sla}
                        </span>

                        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexShrink: 0 }}>
                          <span style={{ fontSize: 13, fontWeight: 400, color: tier.color }}>
                            {tier.count}
                          </span>
                          <span style={{ fontSize: 10, color: c.textMuted }}>
                            ({pct}%)
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Resumo do Balanço da Pirâmide */}
                <div
                  style={{
                    background: c.cardSecondary,
                    borderRadius: 6,
                    padding: '10px 14px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 12,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <ShieldCheck size={14} color={c.success} />
                    <span style={{ fontSize: 11, color: c.textSecondary }}>
                      {metrics.priorityCounts.Urgente === 0
                        ? 'Pirâmide equilibrada: Nenhuma demanda urgente bloqueando o fluxo de engenharia no momento.'
                        : `Atenção concentrada: ${metrics.priorityCounts.Urgente} demandas urgentes no topo da pirâmide requerem foco imediato.`}
                    </span>
                  </div>
                  <span style={{ fontSize: 10.5, color: c.textMuted }}>
                    {Math.round(((metrics.priorityCounts.Média + metrics.priorityCounts.Baixa) / Math.max(1, metrics.total)) * 100)}% base planejada
                  </span>
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
                    <div style={{ fontSize: 13, fontWeight: 400, color: c.textPrimary }}>
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
                    fontWeight: 400,
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
                  <span style={{ fontSize: 12, fontWeight: 400, color: c.textPrimary }}>
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
                      <span style={{ fontSize: 10, color: c.textMuted, fontWeight: 400 }}>
                        #{iss.githubNumber || (iss as any).number || iss.id.slice(0, 4)}
                      </span>
                      <span
                        style={{
                          flex: 1,
                          fontSize: 11,
                          color: c.textPrimary,
                          fontWeight: 400,
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
                          fontWeight: 400,
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
