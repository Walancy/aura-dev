import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Calendar,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Target,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Sparkles,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  ArrowRight,
  Check,
  X,
  ExternalLink,
  Folder,
  Tag,
  AlertCircle,
  MoreHorizontal,
  Layers,
  SortAsc,
  CheckSquare,
  Square,
  Circle,
  RefreshCw,
  TrendingUp,
  Award,
  Shield,
  Briefcase,
  Flame,
  Palette,
  ChevronDown,
  GripVertical,
} from 'lucide-react';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';
import { GLOBAL_PROJECTS_CACHE } from '../ProjectsSchedulerView';

export type CardPalette = 'peach' | 'cyan' | 'lavender' | 'charcoal' | 'emerald' | 'rose';

export interface DailyItem {
  id: string;
  title: string;
  description?: string;
  category: 'yesterday' | 'blocker' | 'today';
  dateIso: string; // YYYY-MM-DD
  tag: string;
  priority?: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  estimatedHours?: number;
  completed?: boolean;
  blockerSeverity?: 'Crítico' | 'Alto' | 'Médio';
  blockerStatus?: 'Bloqueando' | 'Em análise' | 'Resolvido';
  projectId?: string;
  projectName?: string;
  projectColor?: string;
  cardTheme?: CardPalette;
  customColor?: string;
  order?: number;
  isFromPreviousDayPlanned?: boolean;
  assignee?: {
    name: string;
    avatarUrl?: string;
    initials?: string;
  };
  createdAt: string;
}

export interface WeeklyGoal {
  id: string;
  title: string;
  weekStartIso: string;
  completed: boolean;
  priority: 'Alta' | 'Média' | 'Baixa';
  owner?: string;
}

interface DailySchedulerViewProps {
  workspacePath?: string;
  repoName?: string;
  accentColor?: string;
  isEffectiveDark?: boolean;
  themeTokens?: any;
  selectedAiProvider?: string;
  selectedModel?: string;
  onSelectWorkspace?: (path: string) => void;
  installedClis?: Record<string, boolean>;
  activeModels?: Record<string, any>;
  onToast?: (msg: string) => void;
}

export type OrganizationMode = 'default' | 'by_project' | 'by_priority';
export type SortMode = 'date' | 'priority' | 'project' | 'hours';

const WEEKDAY_NAMES_PT = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
const WEEKDAY_SHORT_PT = ['DOM', 'SEG', 'TER', 'QUA', 'QUI', 'SEX', 'SÁB'];
const MONTH_NAMES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
];

// Paletas vibrantes de gradiente para os cards cinzas (inspiradas na referência)
const CARD_THEMES: Record<
  CardPalette,
  {
    name: string;
    accent: string;
    gradient: string;
    pillBg: string;
    pillText: string;
  }
> = {
  peach: {
    name: 'Pêssego / Laranja',
    accent: '#f97316',
    gradient: 'linear-gradient(90deg, #f97316 0%, #fb923c 50%, #f43f5e 100%)',
    pillBg: 'rgba(249, 115, 22, 0.15)',
    pillText: '#fdba74',
  },
  cyan: {
    name: 'Ciano / Céu',
    accent: '#38bdf8',
    gradient: 'linear-gradient(90deg, #06b6d4 0%, #38bdf8 50%, #818cf8 100%)',
    pillBg: 'rgba(56, 189, 248, 0.15)',
    pillText: '#7dd3fc',
  },
  lavender: {
    name: 'Lavanda / Violeta',
    accent: '#a855f7',
    gradient: 'linear-gradient(90deg, #8b5cf6 0%, #a855f7 50%, #ec4899 100%)',
    pillBg: 'rgba(168, 85, 247, 0.15)',
    pillText: '#d8b4fe',
  },
  charcoal: {
    name: 'Índigo / Grafite',
    accent: '#818cf8',
    gradient: 'linear-gradient(90deg, #6366f1 0%, #818cf8 50%, #c084fc 100%)',
    pillBg: 'rgba(99, 102, 241, 0.15)',
    pillText: '#c7d2fe',
  },
  emerald: {
    name: 'Esmeralda / Menta',
    accent: '#10b981',
    gradient: 'linear-gradient(90deg, #10b981 0%, #14b8a6 50%, #06b6d4 100%)',
    pillBg: 'rgba(16, 185, 129, 0.15)',
    pillText: '#6ee7b7',
  },
  rose: {
    name: 'Rosa / Carmim',
    accent: '#f43f5e',
    gradient: 'linear-gradient(90deg, #f43f5e 0%, #fb7185 50%, #fda4af 100%)',
    pillBg: 'rgba(244, 63, 94, 0.15)',
    pillText: '#fda4af',
  },
};

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseIsoDate(iso: string): Date {
  const parts = iso.split('-').map((p) => parseInt(p, 10));
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

/**
 * Retorna o dia de trabalho útil anterior:
 * - Se for Segunda (1), o dia anterior considerado é Sexta (-3 dias).
 * - Se for Domingo (0), Sexta (-2 dias).
 * - Se for Sábado (6), Sexta (-1 dia).
 * - Demais dias: -1 dia.
 */
function getPreviousWorkday(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 1) {
    d.setDate(d.getDate() - 3);
  } else if (day === 0) {
    d.setDate(d.getDate() - 2);
  } else if (day === 6) {
    d.setDate(d.getDate() - 1);
  } else {
    d.setDate(d.getDate() - 1);
  }
  return d;
}

/**
 * Retorna os códigos ISO dos dias considerados "dia anterior" para a Daily de uma determinada data.
 * - Para Segunda-feira (1): Sexta-feira útil anterior (-3 dias), além do fim de semana (Sábado -2 e Domingo -1).
 * - Para Domingo (0): Sábado (-1) e Sexta-feira (-2).
 * - Para os demais dias (Terça a Sábado): Dia anterior corrido (-1 dia).
 */
function getPreviousDaysIso(date: Date): string[] {
  const d = new Date(date);
  const day = d.getDay();
  if (day === 1) {
    const fri = new Date(d);
    fri.setDate(fri.getDate() - 3);
    const sat = new Date(d);
    sat.setDate(sat.getDate() - 2);
    const sun = new Date(d);
    sun.setDate(sun.getDate() - 1);
    return [toIsoDate(fri), toIsoDate(sat), toIsoDate(sun)];
  } else if (day === 0) {
    const sat = new Date(d);
    sat.setDate(sat.getDate() - 1);
    const fri = new Date(d);
    fri.setDate(fri.getDate() - 2);
    return [toIsoDate(sat), toIsoDate(fri)];
  } else {
    const prev = new Date(d);
    prev.setDate(prev.getDate() - 1);
    return [toIsoDate(prev)];
  }
}

function getMondayOfCurrentWeek(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff));
}

export const DailySchedulerView: React.FC<DailySchedulerViewProps> = ({
  workspacePath = '/Users/walancy/Documents/codes/devflow-desktop',
  repoName = 'aura-dev',
  accentColor = '#007acc',
  isEffectiveDark = true,
  onToast = (msg: string) => console.log(msg),
}) => {
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly'>('daily');
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  // Estados de organização e filtragem
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string>('all');
  const [organizationMode, setOrganizationMode] = useState<OrganizationMode>('default');
  const [sortMode, setSortMode] = useState<SortMode>('date');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Sincronização e lista de projetos disponíveis a partir do cache global de projetos
  const availableProjects = useMemo(() => {
    const map = new Map<string, { id: string; name: string; fullName: string; color: string }>();

    if (repoName) {
      const clean = repoName.includes('/') ? repoName.split('/').pop()! : repoName;
      map.set(clean.toLowerCase(), { id: clean, name: clean, fullName: repoName, color: accentColor });
    }

    (GLOBAL_PROJECTS_CACHE?.repos || []).forEach((r) => {
      map.set(r.name.toLowerCase(), {
        id: r.name,
        name: r.name,
        fullName: r.full_name || r.name,
        color: '#38bdf8',
      });
    });

    (GLOBAL_PROJECTS_CACHE?.localClonedRepos || []).forEach((l) => {
      if (!map.has(l.name.toLowerCase())) {
        map.set(l.name.toLowerCase(), {
          id: l.name,
          name: l.name,
          fullName: l.repoFullName || l.name,
          color: '#a855f7',
        });
      }
    });

    // Se estiver vazio, popula com projetos padrão conhecidos
    if (map.size === 0) {
      ['aura-dev', 'ainaobra', 'ainaobra-api-esocial', 'cooperaagro-app', 'open-midia-api'].forEach((name) => {
        map.set(name.toLowerCase(), { id: name, name, fullName: `Walancy/${name}`, color: '#38bdf8' });
      });
    }

    return Array.from(map.values());
  }, [repoName, accentColor]);

  // Persistência unificada das tarefas no localStorage
  const storageKey = 'devflow_daily_items_unified_v2';
  const [items, setItems] = useState<DailyItem[]>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return JSON.parse(saved);
    } catch {}

    const todayIso = toIsoDate(new Date());
    return [
      {
        id: 'seed-1',
        title: 'Migração do processamento de OCR do frontend para o backend (#144)',
        description: 'Endpoint REST concluído com sucesso e validação de schema implementada.',
        category: 'yesterday',
        dateIso: todayIso,
        tag: 'Backend',
        priority: 'Alta',
        completed: true,
        projectId: 'ainaobra',
        projectName: 'ainaobra',
        cardTheme: 'cyan',
        assignee: { name: 'Walancy', initials: 'WA' },
        createdAt: new Date().toISOString(),
      },
      {
        id: 'seed-2',
        title: 'Incorporação do motor de cálculo MAED com Gemini Flash (#143)',
        description: 'Integração de leitura de notas e geração de payload tributário.',
        category: 'yesterday',
        dateIso: todayIso,
        tag: 'IA & OCR',
        priority: 'Alta',
        completed: true,
        projectId: 'ainaobra',
        projectName: 'ainaobra',
        cardTheme: 'peach',
        assignee: { name: 'Walancy', initials: 'WA' },
        createdAt: new Date().toISOString(),
      },
      {
        id: 'seed-3',
        title: 'Code review da PR #42 de Aferição SERO e emissão de CND',
        description: 'Ajustes solicitados em tratamento de exceções de certificado e-CAC.',
        category: 'yesterday',
        dateIso: todayIso,
        tag: 'Code Review',
        priority: 'Média',
        completed: true,
        projectId: 'aura-dev',
        projectName: 'aura-dev',
        cardTheme: 'lavender',
        assignee: { name: 'Walancy', initials: 'WA' },
        createdAt: new Date().toISOString(),
      },
      {
        id: 'seed-4',
        title: 'Timeout na API da Receita Federal em homologação para consulta DARF',
        description: 'Serviço do e-CAC com intermitência no proxy residencial ao consultar pendências.',
        category: 'blocker',
        dateIso: todayIso,
        tag: 'Infra / e-CAC',
        blockerSeverity: 'Crítico',
        blockerStatus: 'Bloqueando',
        projectId: 'ainaobra-api-esocial',
        projectName: 'ainaobra-api-esocial',
        cardTheme: 'charcoal',
        assignee: { name: 'Walancy', initials: 'WA' },
        createdAt: new Date().toISOString(),
      },
      {
        id: 'seed-5',
        title: 'Certificado digital A1 em homologação aguardando renovação',
        description: 'Dependência da equipe fiscal para disponibilizar o arquivo .pfx atualizado.',
        category: 'blocker',
        dateIso: todayIso,
        tag: 'Fiscal',
        blockerSeverity: 'Alto',
        blockerStatus: 'Em análise',
        projectId: 'ainaobra',
        projectName: 'ainaobra',
        cardTheme: 'charcoal',
        assignee: { name: 'Walancy', initials: 'WA' },
        createdAt: new Date().toISOString(),
      },
      {
        id: 'seed-6',
        title: 'Disponibilizar e povoar tabela CUF/TUF no banco de dados (#142)',
        description: 'Executar migrations no PostgreSQL e seeds de alíquotas estaduais.',
        category: 'today',
        dateIso: todayIso,
        tag: 'Database',
        priority: 'Alta',
        estimatedHours: 3,
        completed: false,
        projectId: 'cooperaagro-app',
        projectName: 'cooperaagro-app',
        cardTheme: 'peach',
        assignee: { name: 'Walancy', initials: 'WA' },
        createdAt: new Date().toISOString(),
      },
      {
        id: 'seed-7',
        title: 'Validação do fluxo de Aferição no SERO para emissão da CND',
        description: 'Testar automação simulada da tela StepAfericao.tsx ponta a ponta.',
        category: 'today',
        dateIso: todayIso,
        tag: 'Automação',
        priority: 'Alta',
        estimatedHours: 4,
        completed: false,
        projectId: 'aura-dev',
        projectName: 'aura-dev',
        cardTheme: 'cyan',
        assignee: { name: 'Walancy', initials: 'WA' },
        createdAt: new Date().toISOString(),
      },
      {
        id: 'seed-8',
        title: 'Alinhamento técnico de arquitetura com o time de engenharia às 16h',
        description: 'Alinhamento das regras de fator de ajuste e parametrização de INSS.',
        category: 'today',
        dateIso: todayIso,
        tag: 'Alinhamento',
        priority: 'Média',
        estimatedHours: 1,
        completed: false,
        projectId: 'aura-dev',
        projectName: 'aura-dev',
        cardTheme: 'lavender',
        assignee: { name: 'Walancy', initials: 'WA' },
        createdAt: new Date().toISOString(),
      },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(items));
    } catch {}
  }, [items]);

  // Metas da Weekly
  const weeklyStorageKey = `devflow_weekly_goals_${repoName || 'general'}`;
  const [weeklyGoals, setWeeklyGoals] = useState<WeeklyGoal[]>(() => {
    try {
      const saved = localStorage.getItem(weeklyStorageKey);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      { id: 'wg-1', title: 'Fechar módulo de OCR e motor MAED em produção', weekStartIso: toIsoDate(getMondayOfCurrentWeek(new Date())), completed: true, priority: 'Alta' },
      { id: 'wg-2', title: 'Subir seeds CUF/TUF atualizados para todos os estados', weekStartIso: toIsoDate(getMondayOfCurrentWeek(new Date())), completed: true, priority: 'Média' },
      { id: 'wg-3', title: 'Finalizar automação da CND / SERO para regularizações', weekStartIso: toIsoDate(getMondayOfCurrentWeek(new Date())), completed: false, priority: 'Alta' },
      { id: 'wg-4', title: 'Reduzir taxa de falha de captcha e-CAC abaixo de 5%', weekStartIso: toIsoDate(getMondayOfCurrentWeek(new Date())), completed: false, priority: 'Alta' },
    ];
  });

  useEffect(() => {
    try {
      localStorage.setItem(weeklyStorageKey, JSON.stringify(weeklyGoals));
    } catch {}
  }, [weeklyGoals, weeklyStorageKey]);



  // Modal de Exclusão (Regra obrigatória do AGENTS.md)
  const [itemToDelete, setItemToDelete] = useState<DailyItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Estados para criação e edição inline diretamente nas colunas da daily
  const [creatingInColumn, setCreatingInColumn] = useState<'yesterday' | 'blocker' | 'today' | null>(null);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const [draftCategory, setDraftCategory] = useState<'yesterday' | 'blocker' | 'today'>('today');
  const [draftTitle, setDraftTitle] = useState('');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftTag, setDraftTag] = useState('Geral');
  const [draftPriority, setDraftPriority] = useState<'Baixa' | 'Média' | 'Alta' | 'Urgente'>('Alta');
  const [draftBlockerSeverity, setDraftBlockerSeverity] = useState<'Crítico' | 'Alto' | 'Médio'>('Alto');
  const [draftProject, setDraftProject] = useState(repoName || availableProjects[0]?.name || 'aura-dev');
  const [draftCardTheme, setDraftCardTheme] = useState<CardPalette>('peach');
  const [draftCustomColor, setDraftCustomColor] = useState<string>('#f97316');

  // Estados de arrastar e soltar (reorganização vertical de cards)
  const [draggingItemId, setDraggingItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);

  const selectedDateIso = toIsoDate(selectedDate);
  const previousWorkday = useMemo(() => getPreviousWorkday(selectedDate), [selectedDate]);
  const isSelectedMonday = selectedDate.getDay() === 1;

  // Filtragem e ordenação inteligente das tarefas
  const filteredAndSortedItems = useMemo(() => {
    // 1. Itens associados diretamente à data selecionada
    const directItems = items.filter((it) => it.dateIso === selectedDateIso);

    // 2. Se as tarefas da coluna de planejado (category === 'today') do dia anterior estiverem
    // marcadas como concluído, elas devem ser exibidas na coluna dia anterior do próximo dia.
    const prevDaysIso = getPreviousDaysIso(selectedDate);
    const completedPlannedFromPrevDays: DailyItem[] = items
      .filter((it) => prevDaysIso.includes(it.dateIso) && it.category === 'today' && it.completed)
      .map((it) => ({
        ...it,
        category: 'yesterday',
        isFromPreviousDayPlanned: true,
      }));

    // Combina e deduplica por ID
    const seenIds = new Set<string>();
    const combined: DailyItem[] = [];

    // Prioriza os itens diretos da data
    for (const it of directItems) {
      if (!seenIds.has(it.id)) {
        seenIds.add(it.id);
        combined.push(it);
      }
    }

    // Adiciona as tarefas concluídas do dia anterior na coluna de dia anterior da data selecionada
    for (const it of completedPlannedFromPrevDays) {
      if (!seenIds.has(it.id)) {
        seenIds.add(it.id);
        combined.push(it);
      }
    }

    let list = combined;

    // Filtro por projeto
    if (selectedProjectFilter !== 'all') {
      list = list.filter(
        (it) =>
          it.projectName?.toLowerCase() === selectedProjectFilter.toLowerCase() ||
          it.projectId?.toLowerCase() === selectedProjectFilter.toLowerCase()
      );
    }

    // Filtro por busca
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          (it.description && it.description.toLowerCase().includes(q)) ||
          it.tag.toLowerCase().includes(q)
      );
    }

    // Ordenação: respeita custom order (drag & drop) quando houver, senão prioridade
    list.sort((a, b) => {
      const aOrder = typeof a.order === 'number' ? a.order : 9999;
      const bOrder = typeof b.order === 'number' ? b.order : 9999;
      if (aOrder !== bOrder) return aOrder - bOrder;

      const prioOrder = { Urgente: 0, Alta: 1, Média: 2, Baixa: 3 };
      const aP = prioOrder[a.priority || 'Alta'] ?? 1;
      const bP = prioOrder[b.priority || 'Alta'] ?? 1;
      return aP - bP;
    });

    return list;
  }, [items, selectedDate, selectedDateIso, selectedProjectFilter, searchQuery]);

  // Handler de reordenação manual por arrastar e soltar na coluna
  const handleReorderCategory = (category: 'yesterday' | 'blocker' | 'today', sourceId: string, targetId: string) => {
    if (!sourceId || !targetId || sourceId === targetId) return;

    setItems((prev) => {
      const currentCategoryList = filteredAndSortedItems.filter((i) => i.category === category);
      const sourceIndex = currentCategoryList.findIndex((i) => i.id === sourceId);
      const targetIndex = currentCategoryList.findIndex((i) => i.id === targetId);
      if (sourceIndex === -1 || targetIndex === -1) return prev;

      const reordered = [...currentCategoryList];
      const [moved] = reordered.splice(sourceIndex, 1);
      reordered.splice(targetIndex, 0, moved);

      const orderMap = new Map<string, number>();
      reordered.forEach((it, idx) => {
        orderMap.set(it.id, idx);
      });

      const next = prev.map((it) => {
        if (orderMap.has(it.id)) {
          return { ...it, order: orderMap.get(it.id)! };
        }
        return it;
      });

      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}

      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData('text/plain', id);
    e.dataTransfer.effectAllowed = 'move';
    setDraggingItemId(id);
  };

  const handleDragOver = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverItemId !== id) {
      setDragOverItemId(id);
    }
  };

  const handleDragLeave = (e: React.DragEvent, id: string) => {
    e.preventDefault();
    if (dragOverItemId === id) {
      setDragOverItemId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, targetId: string, category: 'yesterday' | 'blocker' | 'today') => {
    e.preventDefault();
    const sourceId = e.dataTransfer.getData('text/plain') || draggingItemId;
    if (sourceId) {
      handleReorderCategory(category, sourceId, targetId);
    }
    setDraggingItemId(null);
    setDragOverItemId(null);
  };

  const handleDragEnd = () => {
    setDraggingItemId(null);
    setDragOverItemId(null);
  };

  // Colunas de categorias
  const yesterdayItems = useMemo(() => filteredAndSortedItems.filter((i) => i.category === 'yesterday'), [filteredAndSortedItems]);
  const blockerItems = useMemo(() => filteredAndSortedItems.filter((i) => i.category === 'blocker'), [filteredAndSortedItems]);
  const todayItems = useMemo(() => filteredAndSortedItems.filter((i) => i.category === 'today'), [filteredAndSortedItems]);

  // Métricas para os Cards de Status da Daily (Estilo da aba de Riscos da tela de Projetos)
  const dailyHealthMetrics = useMemo(() => {
    const totalDayItems = filteredAndSortedItems.length;
    const completedItems = filteredAndSortedItems.filter((i) => i.completed || i.category === 'yesterday').length;
    const activeBlockers = blockerItems.filter((i) => i.blockerStatus !== 'Resolvido').length;
    const resolvedBlockers = blockerItems.filter((i) => i.blockerStatus === 'Resolvido').length;
    const plannedToday = todayItems.length;
    const todayCompleted = todayItems.filter((i) => i.completed).length;

    // Cálculo do score da Daily: base 100, deduz 20 por bloqueio ativo crítico, 10 por alto
    let score = 100;
    blockerItems.forEach((b) => {
      if (b.blockerStatus !== 'Resolvido') {
        score -= b.blockerSeverity === 'Crítico' ? 25 : 15;
      }
    });
    if (plannedToday > 0 && todayCompleted === 0) {
      score = Math.max(score - 10, 60);
    }
    score = Math.max(0, Math.min(100, score));

    const label = score >= 90 ? 'Ritmo Excelente' : score >= 75 ? 'Ritmo Saudável' : score >= 50 ? 'Atenção a Bloqueios' : 'Crítico';

    // Projetos com tarefas ativas no dia
    const projectsMap: Record<string, number> = {};
    filteredAndSortedItems.forEach((it) => {
      const p = it.projectName || repoName || 'Geral';
      projectsMap[p] = (projectsMap[p] || 0) + 1;
    });

    const completionRate = plannedToday > 0 ? Math.round((todayCompleted / plannedToday) * 100) : completedItems > 0 ? 100 : 0;

    return {
      score,
      label,
      totalDayItems,
      completedItems,
      activeBlockers,
      resolvedBlockers,
      plannedToday,
      todayCompleted,
      completionRate,
      projectsMap,
    };
  }, [filteredAndSortedItems, blockerItems, todayItems, repoName]);

  // Estrutura do Calendário Mensal 1:1
  const calendarDaysMatrix = useMemo(() => {
    const year = calendarMonth.getFullYear();
    const month = calendarMonth.getMonth();

    const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Domingo
    const totalDaysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();

    const matrix: Array<{
      date: Date;
      iso: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      isToday: boolean;
      isSelected: boolean;
      isWeekend: boolean;
      hasYesterday: boolean;
      hasBlocker: boolean;
      hasToday: boolean;
    }> = [];

    const checkHasYesterday = (d: Date, iso: string) =>
      items.some((it) => it.dateIso === iso && it.category === 'yesterday') ||
      items.some((it) => getPreviousDaysIso(d).includes(it.dateIso) && it.category === 'today' && it.completed);

    // Dias do mês anterior para completar a 1ª semana
    for (let i = firstDayIndex - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, daysInPrevMonth - i);
      const iso = toIsoDate(d);
      matrix.push({
        date: d,
        iso,
        dayNumber: daysInPrevMonth - i,
        isCurrentMonth: false,
        isToday: iso === toIsoDate(new Date()),
        isSelected: iso === selectedDateIso,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        hasYesterday: checkHasYesterday(d, iso),
        hasBlocker: items.some((it) => it.dateIso === iso && it.category === 'blocker'),
        hasToday: items.some((it) => it.dateIso === iso && it.category === 'today'),
      });
    }

    // Dias do mês atual
    for (let day = 1; day <= totalDaysInMonth; day++) {
      const d = new Date(year, month, day);
      const iso = toIsoDate(d);
      matrix.push({
        date: d,
        iso,
        dayNumber: day,
        isCurrentMonth: true,
        isToday: iso === toIsoDate(new Date()),
        isSelected: iso === selectedDateIso,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        hasYesterday: checkHasYesterday(d, iso),
        hasBlocker: items.some((it) => it.dateIso === iso && it.category === 'blocker'),
        hasToday: items.some((it) => it.dateIso === iso && it.category === 'today'),
      });
    }

    // Dias do próximo mês para completar 35 ou 42 células no grid
    const remainingCells = 35 - matrix.length > 0 ? 35 - matrix.length : 42 - matrix.length;
    for (let day = 1; day <= remainingCells; day++) {
      const d = new Date(year, month + 1, day);
      const iso = toIsoDate(d);
      matrix.push({
        date: d,
        iso,
        dayNumber: day,
        isCurrentMonth: false,
        isToday: iso === toIsoDate(new Date()),
        isSelected: iso === selectedDateIso,
        isWeekend: d.getDay() === 0 || d.getDay() === 6,
        hasYesterday: checkHasYesterday(d, iso),
        hasBlocker: items.some((it) => it.dateIso === iso && it.category === 'blocker'),
        hasToday: items.some((it) => it.dateIso === iso && it.category === 'today'),
      });
    }

    return matrix;
  }, [calendarMonth, selectedDateIso, items]);

  // Manipulação de Criação e Edição Inline de Cards da Daily
  const handleStartCreate = (category: 'yesterday' | 'blocker' | 'today') => {
    setEditingItemId(null);
    setCreatingInColumn(category);
    setDraftCategory(category);
    setDraftTitle('');
    setDraftDescription('');
    setDraftTag(category === 'blocker' ? 'Bugfix' : 'Feature');
    setDraftProject(selectedProjectFilter !== 'all' ? selectedProjectFilter : repoName || availableProjects[0]?.name || 'aura-dev');
    setDraftPriority('Alta');
    setDraftBlockerSeverity('Alto');
    const pal: CardPalette = category === 'yesterday' ? 'cyan' : category === 'blocker' ? 'charcoal' : 'peach';
    setDraftCardTheme(pal);
    setDraftCustomColor(CARD_THEMES[pal]?.accent || '#f97316');
  };

  const handleStartEdit = (item: DailyItem) => {
    setCreatingInColumn(null);
    setEditingItemId(item.id);
    setDraftCategory(item.category);
    setDraftTitle(item.title);
    setDraftDescription(item.description || '');
    setDraftTag(item.tag || 'Feature');
    setDraftProject(item.projectName || repoName || 'aura-dev');
    setDraftPriority(item.priority || 'Alta');
    setDraftBlockerSeverity(item.blockerSeverity || 'Alto');
    const pal: CardPalette = item.cardTheme || (item.category === 'yesterday' ? 'cyan' : item.category === 'blocker' ? 'charcoal' : 'peach');
    setDraftCardTheme(pal);
    setDraftCustomColor(item.customColor || CARD_THEMES[pal]?.accent || '#f97316');
  };

  const handleCancelInline = () => {
    setCreatingInColumn(null);
    setEditingItemId(null);
  };

  const handleConfirmInline = () => {
    if (!draftTitle.trim()) {
      onToast('Digite o título da tarefa.');
      return;
    }

    const matchedProject = availableProjects.find((p) => p.name.toLowerCase() === draftProject.toLowerCase());

    if (editingItemId) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === editingItemId
            ? {
                ...it,
                category: draftCategory,
                title: draftTitle.trim(),
                description: draftDescription.trim(),
                tag: draftTag.trim() || 'Geral',
                priority: draftPriority,
                blockerSeverity: draftCategory === 'blocker' ? draftBlockerSeverity : undefined,
                projectId: matchedProject?.id || draftProject,
                projectName: matchedProject?.name || draftProject,
                projectColor: matchedProject?.color,
                cardTheme: draftCardTheme,
                customColor: draftCustomColor,
              }
            : it
        )
      );
      setEditingItemId(null);
      onToast('Registro atualizado com sucesso.');
    } else if (creatingInColumn) {
      const newItem: DailyItem = {
        id: `daily-${Date.now()}`,
        category: draftCategory,
        title: draftTitle.trim(),
        description: draftDescription.trim(),
        dateIso: selectedDateIso,
        tag: draftTag.trim() || 'Geral',
        priority: draftPriority,
        completed: draftCategory === 'yesterday',
        blockerSeverity: draftCategory === 'blocker' ? draftBlockerSeverity : undefined,
        blockerStatus: draftCategory === 'blocker' ? 'Bloqueando' : undefined,
        projectId: matchedProject?.id || draftProject,
        projectName: matchedProject?.name || draftProject,
        projectColor: matchedProject?.color,
        cardTheme: draftCardTheme,
        customColor: draftCustomColor,
        assignee: { name: 'Walancy', initials: 'WA', avatarUrl: 'https://github.com/Walancy.png' },
        createdAt: new Date().toISOString(),
      };
      setItems((prev) => [newItem, ...prev]);
      setCreatingInColumn(null);
      onToast('Novo registro adicionado à Daily!');
    }
  };

  const handleConfirmDeleteItem = () => {
    if (!itemToDelete) return;
    setIsDeleting(true);
    setTimeout(() => {
      setItems((prev) => prev.filter((it) => it.id !== itemToDelete.id));
      setIsDeleting(false);
      setItemToDelete(null);
      onToast('Item removido com sucesso.');
    }, 200);
  };

  const handleToggleCompleted = (item: DailyItem) => {
    setItems((prev) =>
      prev.map((it) => (it.id === item.id ? { ...it, completed: !it.completed } : it))
    );
  };

  const handleToggleBlockerStatus = (item: DailyItem) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === item.id
          ? {
              ...it,
              blockerStatus: it.blockerStatus === 'Resolvido' ? 'Bloqueando' : 'Resolvido',
            }
          : it
      )
    );
  };

  // Copiar Daily em Markdown
  const handleCopyDailyMarkdown = () => {
    const isMon = selectedDate.getDay() === 1;
    const refDay = isMon
      ? `Sexta-feira (${previousWorkday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`
      : `Dia anterior (${previousWorkday.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })})`;

    const text = [
      `📅 **Daily - ${selectedDate.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}**`,
      `*Projeto: ${selectedProjectFilter !== 'all' ? selectedProjectFilter : repoName}*`,
      '',
      `✅ **O que fiz no dia anterior (${refDay}):**`,
      ...(yesterdayItems.length > 0
        ? yesterdayItems.map((i) => `- [x] [${i.projectName || 'Geral'}] ${i.title}${i.description ? ` (${i.description})` : ''}`)
        : ['- *Nenhum item registrado.*']),
      '',
      `🚨 **Impedimentos e Problemas:**`,
      ...(blockerItems.length > 0
        ? blockerItems.map(
            (i) =>
              `- [${i.blockerStatus === 'Resolvido' ? 'x' : ' '}] [${i.projectName || 'Geral'}] [${i.blockerSeverity || 'Alto'}] ${i.title}`
          )
        : ['- *Nenhum impedimento no momento.*']),
      '',
      `🎯 **Planejado para hoje:**`,
      ...(todayItems.length > 0
        ? todayItems.map((i) => `- [${i.completed ? 'x' : ' '}] [${i.projectName || 'Geral'}] ${i.title} (${i.estimatedHours || 2}h)`)
        : ['- *Nenhuma tarefa planejada ainda.*']),
    ].join('\n');

    navigator.clipboard.writeText(text);
    onToast('Daily copiada em Markdown para a área de transferência!');
  };

  // Sugerir Daily com IA
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const handleGenerateAiDaily = async () => {
    setIsGeneratingAi(true);
    await new Promise((r) => setTimeout(r, 600));

    const targetProj = selectedProjectFilter !== 'all' ? selectedProjectFilter : repoName;
    const aiItems: DailyItem[] = [
      {
        id: `ai-${Date.now()}-1`,
        title: 'Implementação de cache nos seletores de workspace e pipelines',
        description: 'Sugerido pela IA com base nos commits recentes do git.',
        category: 'yesterday',
        dateIso: selectedDateIso,
        tag: 'Git Sync',
        priority: 'Média',
        completed: true,
        projectId: targetProj,
        projectName: targetProj,
        cardTheme: 'cyan',
        assignee: { name: 'Walancy', initials: 'WA' },
        createdAt: new Date().toISOString(),
      },
      {
        id: `ai-${Date.now()}-2`,
        title: 'Validação e cobertura de testes do motor de cálculo MAED',
        description: 'Gerado a partir das issues abertas na sprint ativa.',
        category: 'today',
        dateIso: selectedDateIso,
        tag: 'QA / Testes',
        priority: 'Alta',
        estimatedHours: 3,
        completed: false,
        projectId: targetProj,
        projectName: targetProj,
        cardTheme: 'peach',
        assignee: { name: 'Walancy', initials: 'WA' },
        createdAt: new Date().toISOString(),
      },
    ];

    setItems((prev) => [...aiItems, ...prev]);
    setIsGeneratingAi(false);
    onToast('Sugestões de Daily adicionadas pela IA!');
  };

  // Cores do tema base (tons neutros sem matiz azulado)
  const theme = useMemo(() => {
    return {
      bgApp: isEffectiveDark ? '#000000' : '#f4f5f7',
      bgShelf: isEffectiveDark ? '#111111' : '#ffffff',
      shelfBorder: 'none',
      shelfShadow: isEffectiveDark ? '0 1px 3px rgba(0,0,0,0.5)' : '0 1px 3px rgba(0,0,0,0.06)',
      controlBg: isEffectiveDark ? '#181818' : '#f3f4f6',
      textPrimary: isEffectiveDark ? '#ffffff' : '#111111',
      textSecondary: isEffectiveDark ? '#888888' : '#666666',
      textMuted: isEffectiveDark ? '#555555' : '#888888',
      cardBg: isEffectiveDark ? '#181818' : '#ffffff',
      borderSubtle: 'transparent',
    };
  }, [isEffectiveDark]);

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: 5,
        padding: 5,
        boxSizing: 'border-box',
        background: theme.bgApp,
        overflow: 'hidden',
      }}
    >
      {/* ========================================================================= */}
      {/* CORPO PRINCIPAL COM SIDEBAR ESQUERDA FIXA E CONTEÚDO À DIREITA            */}
      {/* ========================================================================= */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          gap: 5,
          padding: 0,
          boxSizing: 'border-box',
          overflow: 'hidden',
          minHeight: 0,
        }}
      >
        {/* ===================================================================== */}
        {/* COLUNA ESQUERDA: TABS/AÇÕES + CALENDÁRIO + STATUS CARDS               */}
        {/* ===================================================================== */}
        <div
          style={{
            width: 330,
            background: 'transparent',
            borderRadius: 0,
            border: 'none',
            boxShadow: 'none',
            display: 'flex',
            flexDirection: 'column',
            gap: 5,
            padding: 0,
            boxSizing: 'border-box',
            flexShrink: 0,
            overflowY: 'auto',
            minHeight: 0,
          }}
        >
          {/* ------------------------------------------------------------------- */}
          {/* DIV EM CIMA DO CALENDÁRIO: TABS (DAILY | WEEKLY) + BOTÃO COPIAR DAILY */}
          {/* ------------------------------------------------------------------- */}
          <div
            style={{
              width: '100%',
              background: accentColor,
              borderRadius: 10,
              border: 'none',
              boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
              padding: '6px 8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
              boxSizing: 'border-box',
              flexShrink: 0,
              color: '#ffffff',
            }}
          >
            {/* Switcher Daily | Weekly */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                background: 'rgba(0, 0, 0, 0.28)',
                padding: 2.5,
                borderRadius: 7,
                border: 'none',
                gap: 2,
              }}
            >
              <button
                type="button"
                onClick={() => setActiveTab('daily')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 400,
                  background: activeTab === 'daily' ? accentColor : 'transparent',
                  color: '#ffffff',
                  border: activeTab === 'daily' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                  boxShadow: activeTab === 'daily' ? '0 2px 6px rgba(0, 0, 0, 0.25)' : 'none',
                  borderRadius: 5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.15s ease',
                  opacity: activeTab === 'daily' ? 1 : 0.8,
                }}
              >
                <Clock size={12} color="#ffffff" />
                <span>Daily</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('weekly')}
                style={{
                  padding: '4px 10px',
                  fontSize: 11,
                  fontWeight: 400,
                  background: activeTab === 'weekly' ? accentColor : 'transparent',
                  color: '#ffffff',
                  border: activeTab === 'weekly' ? '1px solid rgba(255, 255, 255, 0.25)' : '1px solid transparent',
                  boxShadow: activeTab === 'weekly' ? '0 2px 6px rgba(0, 0, 0, 0.25)' : 'none',
                  borderRadius: 5,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                  transition: 'all 0.15s ease',
                  opacity: activeTab === 'weekly' ? 1 : 0.8,
                }}
              >
                <Calendar size={12} color="#ffffff" />
                <span>Weekly</span>
              </button>
            </div>

            {/* Botão Copiar Daily */}
            <button
              type="button"
              onClick={handleCopyDailyMarkdown}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                padding: '5px 10px',
                borderRadius: 6,
                border: 'none',
                background: 'rgba(0, 0, 0, 0.22)',
                color: '#ffffff',
                fontSize: 11,
                fontWeight: 400,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.35)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 0, 0, 0.22)';
              }}
              title="Copiar Daily em Markdown"
            >
              <Copy size={12} strokeWidth={1.5} color="#ffffff" />
              <span>Copiar Daily</span>
            </button>
          </div>

          {/* ------------------------------------------------------------------- */}
          {/* CALENDÁRIO PADRÃO 1:1 (CARD INDEPENDENTE)                           */}
          {/* ------------------------------------------------------------------- */}
            <div
              style={{
                width: '100%',
                background: isEffectiveDark ? '#141414' : '#ffffff',
                borderRadius: 10,
                border: 'none',
                boxShadow: isEffectiveDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.06)',
                padding: '8px 10px',
                display: 'flex',
                flexDirection: 'column',
                gap: 5,
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
            >
              {/* Header do Mês com navegação */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    border: 'none',
                    background: 'transparent',
                    color: theme.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <ChevronLeft size={14} />
                </button>

                <span style={{ fontSize: 13, fontWeight: 400, color: theme.textPrimary }}>
                  {MONTH_NAMES_PT[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
                </span>

                <button
                  type="button"
                  onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 4,
                    border: 'none',
                    background: 'transparent',
                    color: theme.textSecondary,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                  }}
                >
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Botão rápido Hoje */}
              <button
                type="button"
                onClick={() => {
                  const now = new Date();
                  setSelectedDate(now);
                  setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1));
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '4px 6px',
                  borderRadius: 5,
                  border: 'none',
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                  color: accentColor,
                  fontSize: 11,
                  fontWeight: 400,
                  cursor: 'pointer',
                }}
              >
                <Calendar size={12} />
                <span>Hoje</span>
              </button>

              {/* Grid 7 Colunas (Dias da Semana: D S T Q Q S S) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 2,
                  textAlign: 'center',
                  paddingTop: 2,
                }}
              >
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((wd, idx) => (
                  <span
                    key={idx}
                    style={{
                      fontSize: 10.5,
                      fontWeight: 400,
                      color: idx === 0 || idx === 6 ? theme.textMuted : theme.textSecondary,
                    }}
                  >
                    {wd}
                  </span>
                ))}
              </div>

              {/* Matrix de Dias (Células quadradas 1:1) */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(7, 1fr)',
                  gap: 2,
                }}
              >
                {calendarDaysMatrix.map((dayItem) => {
                  const isSel = dayItem.isSelected;
                  const isCurM = dayItem.isCurrentMonth;
                  const isTod = dayItem.isToday;

                  return (
                    <div
                      key={dayItem.iso}
                      onClick={() => setSelectedDate(dayItem.date)}
                      style={{
                        aspectRatio: '1 / 1',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: 5,
                        background: isSel
                          ? accentColor
                          : isTod
                          ? isEffectiveDark
                            ? 'rgba(255, 255, 255, 0.1)'
                            : 'rgba(0, 0, 0, 0.08)'
                          : 'transparent',
                        color: isSel
                          ? '#ffffff'
                          : !isCurM
                          ? theme.textMuted
                          : dayItem.isWeekend
                          ? theme.textMuted
                          : theme.textPrimary,
                        cursor: 'pointer',
                        fontSize: 11.5,
                        fontWeight: 400,
                        opacity: !isCurM ? 0.35 : 1,
                        position: 'relative',
                        transition: 'all 0.12s ease',
                      }}
                      title={`${dayItem.dayNumber} de ${MONTH_NAMES_PT[dayItem.date.getMonth()]}`}
                    >
                      <span>{dayItem.dayNumber}</span>

                      {/* Micro-dots de status da daily */}
                      <div
                        style={{
                          position: 'absolute',
                          bottom: 2,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
                      >
                        {dayItem.hasYesterday && (
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: isSel ? '#ffffff' : '#22c55e' }} />
                        )}
                        {dayItem.hasBlocker && (
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: isSel ? '#fee2e2' : '#ef4444' }} />
                        )}
                        {dayItem.hasToday && (
                          <div style={{ width: 3, height: 3, borderRadius: '50%', background: isSel ? '#ffffff' : accentColor }} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ------------------------------------------------------------------- */}
            {/* 1. HERO CARD: SAÚDE DA DAILY (ESTILO AMPLO COMO O CARD DE PROJETO)  */}
            {/* ------------------------------------------------------------------- */}
            <div
              style={{
                width: '100%',
                background: accentColor,
                borderRadius: 10,
                border: 'none',
                padding: '12px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                color: '#ffffff',
                boxSizing: 'border-box',
                boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
                flexShrink: 0,
              }}
            >
              {/* Topo do Hero: Título + Badge de Status */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 400,
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                    color: 'rgba(255, 255, 255, 0.9)',
                  }}
                >
                  Saúde da Daily
                </span>
                <span
                  style={{
                    fontSize: 9.5,
                    fontWeight: 400,
                    padding: '2px 8px',
                    borderRadius: 10,
                    background: 'rgba(0, 0, 0, 0.22)',
                    color: '#ffffff',
                  }}
                >
                  {dailyHealthMetrics.label}
                </span>
              </div>

              {/* Linha Central: Score à esquerda + Grid 2x2 à direita */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <div style={{ fontSize: 34, fontWeight: 400, lineHeight: 1, letterSpacing: -0.8 }}>
                    {dailyHealthMetrics.score}%
                  </div>
                  <div style={{ fontSize: 10.5, fontWeight: 400, color: 'rgba(255, 255, 255, 0.85)', marginTop: 4 }}>
                    {dailyHealthMetrics.totalDayItems} tarefas no dia
                  </div>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '4px 10px',
                    background: 'rgba(0, 0, 0, 0.16)',
                    padding: '6px 10px',
                    borderRadius: 6,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 10 }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.75)', fontWeight: 400 }}>Entregas</span>
                    <span style={{ fontWeight: 400, color: '#ffffff' }}>{dailyHealthMetrics.completedItems}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 10 }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.75)', fontWeight: 400 }}>Bloqueios</span>
                    <span style={{ fontWeight: 400, color: dailyHealthMetrics.activeBlockers > 0 ? '#fca5a5' : '#ffffff' }}>
                      {dailyHealthMetrics.activeBlockers}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 10 }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.75)', fontWeight: 400 }}>Planejadas</span>
                    <span style={{ fontWeight: 400, color: '#ffffff' }}>{dailyHealthMetrics.plannedToday}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, fontSize: 10 }}>
                    <span style={{ color: 'rgba(255, 255, 255, 0.75)', fontWeight: 400 }}>Resolvidos</span>
                    <span style={{ fontWeight: 400, color: '#ffffff' }}>{dailyHealthMetrics.resolvedBlockers}</span>
                  </div>
                </div>
              </div>

              {/* Status footer */}
              <div
                style={{
                  fontSize: 10,
                  fontWeight: 400,
                  color: 'rgba(255, 255, 255, 0.85)',
                  paddingTop: 5,
                  borderTop: '1px solid rgba(255, 255, 255, 0.18)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <CheckCircle2 size={12} color="#ffffff" />
                <span style={{ fontWeight: 400 }}>
                  {dailyHealthMetrics.activeBlockers === 0
                    ? 'Fluxo operacional sem bloqueios ativos.'
                    : `${dailyHealthMetrics.activeBlockers} bloqueio(s) requerem atenção.`}
                </span>
              </div>
            </div>

            {/* ------------------------------------------------------------------- */}
            {/* 2. CARD DE DEMANDAS / METAS DO DIA                                  */}
            {/* ------------------------------------------------------------------- */}
            <div
              style={{
                width: '100%',
                background: isEffectiveDark ? '#141414' : '#ffffff',
                borderRadius: 10,
                border: 'none',
                boxShadow: isEffectiveDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.06)',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <span style={{ fontSize: 12, fontWeight: 400, color: theme.textPrimary }}>Demandas</span>
                  <span
                    style={{
                      fontSize: 9.5,
                      fontWeight: 400,
                      color: theme.textSecondary,
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                      padding: '2px 6px',
                      borderRadius: 4,
                    }}
                  >
                    Hoje
                  </span>
                </div>
                <Target size={13} color={accentColor} />
              </div>

              {/* Métrica principal + Sub-métricas + Medidor Circular */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.02)',
                  borderRadius: 6,
                  padding: '7px 10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 400, lineHeight: 1, color: theme.textPrimary }}>
                      {dailyHealthMetrics.plannedToday}
                    </div>
                    <div style={{ fontSize: 9.5, fontWeight: 400, color: theme.textMuted, marginTop: 2 }}>Planejadas</div>
                  </div>

                  <div style={{ height: 20, width: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)' }} />

                  <div style={{ display: 'flex', gap: 8, fontSize: 10.5 }}>
                    <div>
                      <span style={{ fontWeight: 400, color: '#22c55e' }}>{dailyHealthMetrics.todayCompleted}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 400, color: theme.textMuted, marginLeft: 3 }}>feitas</span>
                    </div>
                    <div>
                      <span style={{ fontWeight: 400, color: accentColor }}>
                        {dailyHealthMetrics.plannedToday - dailyHealthMetrics.todayCompleted}
                      </span>
                      <span style={{ fontSize: 9.5, fontWeight: 400, color: theme.textMuted, marginLeft: 3 }}>abertas</span>
                    </div>
                  </div>
                </div>

                {/* Gauge circular */}
                <div style={{ position: 'relative', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="26" height="26" viewBox="0 0 28 28">
                    <circle
                      cx="14"
                      cy="14"
                      r="11"
                      fill="none"
                      stroke={isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}
                      strokeWidth="2.5"
                    />
                    <circle
                      cx="14"
                      cy="14"
                      r="11"
                      fill="none"
                      stroke={accentColor}
                      strokeWidth="2.5"
                      strokeDasharray={69.1}
                      strokeDashoffset={69.1 - (69.1 * Math.min(100, Math.max(0, dailyHealthMetrics.completionRate))) / 100}
                      strokeLinecap="round"
                      transform="rotate(-90 14 14)"
                    />
                  </svg>
                  <span style={{ position: 'absolute', fontSize: 7.5, fontWeight: 400, color: theme.textPrimary }}>
                    {dailyHealthMetrics.completionRate}%
                  </span>
                </div>
              </div>
            </div>

            {/* ------------------------------------------------------------------- */}
            {/* 3. CARD DE PROJETOS VINCULADOS NA DAILY                             */}
            {/* ------------------------------------------------------------------- */}
            <div
              style={{
                width: '100%',
                background: isEffectiveDark ? '#141414' : '#ffffff',
                borderRadius: 10,
                border: 'none',
                boxShadow: isEffectiveDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 3px rgba(0,0,0,0.06)',
                padding: '10px 12px',
                display: 'flex',
                flexDirection: 'column',
                gap: 7,
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, fontWeight: 400, color: theme.textPrimary }}>Projetos Ativos</span>
                <span
                  style={{
                    fontSize: 9.5,
                    color: accentColor,
                    background: `${accentColor}15`,
                    padding: '2px 6px',
                    borderRadius: 4,
                    fontWeight: 400,
                  }}
                >
                  {Object.keys(dailyHealthMetrics.projectsMap).length} vinculados
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {Object.entries(dailyHealthMetrics.projectsMap).map(([projName, count]) => {
                  const isFiltered = selectedProjectFilter.toLowerCase() === projName.toLowerCase();
                  return (
                    <div
                      key={projName}
                      onClick={() => setSelectedProjectFilter(isFiltered ? 'all' : projName)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '4px 7px',
                        borderRadius: 4,
                        background: isFiltered
                          ? `${accentColor}20`
                          : isEffectiveDark
                          ? 'rgba(255, 255, 255, 0.03)'
                          : 'rgba(0, 0, 0, 0.02)',
                        cursor: 'pointer',
                        fontSize: 10,
                      }}
                      title="Clique para filtrar por este projeto"
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flex: 1 }}>
                        <div style={{ width: 5, height: 5, borderRadius: '50%', background: accentColor }} />
                        <span style={{ color: theme.textPrimary, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {projName}
                        </span>
                      </div>
                      <span
                        style={{
                          fontSize: 9.5,
                          fontWeight: 400,
                          padding: '1px 6px',
                          borderRadius: 10,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                          color: theme.textSecondary,
                        }}
                      >
                        {count} {count === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* ===================================================================== */}
          {/* CONTEÚDO PRINCIPAL À DIREITA: DAILY (3 COLUNAS) OU WEEKLY             */}
          {/* ===================================================================== */}
          {activeTab === 'daily' ? (
            <div
              style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              padding: 0,
              boxSizing: 'border-box',
              overflow: 'hidden',
              minHeight: 0,
            }}
          >
            {/* AS 3 COLUNAS COM CARDS */}
            <div
              style={{
                flex: 1,
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 5,
                padding: 0,
                boxSizing: 'border-box',
                overflow: 'hidden',
                minHeight: 0,
              }}
            >
              {/* --------------------------------------------------------------- */}
              {/* COLUNA 1: O QUE FIZ NO DIA ANTERIOR (ONTEM OU SEXTA)           */}
              {/* --------------------------------------------------------------- */}
              <div
                style={{
                  background: theme.bgShelf,
                  borderRadius: 10,
                  border: theme.shelfBorder,
                  boxShadow: theme.shelfShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  padding: 5,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  minHeight: 0,
                }}
              >
                {/* Header Coluna 1 estilo Image */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 8,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 400, textTransform: 'uppercase', letterSpacing: 0.5, color: theme.textPrimary }}>
                      {isSelectedMonday ? 'Sexta-feira' : 'Dia Anterior'}
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 400,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                        color: theme.textSecondary,
                      }}
                    >
                      {yesterdayItems.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartCreate('yesterday')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: accentColor,
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 400,
                      cursor: 'pointer',
                      transition: 'opacity 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                    title="Adicionar registro"
                  >
                    <Plus size={12} />
                    <span>Adicionar registro</span>
                  </button>
                </div>

                {/* Lista de Cards da Coluna 1 */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: 2,
                  }}
                >
                  {/* Card sendo criado inline */}
                  {creatingInColumn === 'yesterday' && (
                    <EditableDailyCard
                      category="yesterday"
                      title={draftTitle}
                      description={draftDescription}
                      tag={draftTag}
                      project={draftProject}
                      priority={draftPriority}
                      cardTheme={draftCardTheme}
                      customColor={draftCustomColor}
                      availableProjects={availableProjects}
                      isEffectiveDark={isEffectiveDark}
                      accentColor={accentColor}
                      onChangeTitle={setDraftTitle}
                      onChangeDescription={setDraftDescription}
                      onChangeTag={setDraftTag}
                      onChangeProject={setDraftProject}
                      onChangePriority={setDraftPriority}
                      onChangeCardTheme={setDraftCardTheme}
                      onChangeCustomColor={setDraftCustomColor}
                      onConfirm={handleConfirmInline}
                      onCancel={handleCancelInline}
                    />
                  )}

                  {yesterdayItems.length === 0 && creatingInColumn !== 'yesterday' ? (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                        textAlign: 'center',
                        color: theme.textMuted,
                        gap: 8,
                      }}
                    >
                      <CheckCircle2 size={24} color={theme.textMuted} opacity={0.5} />
                      <span style={{ fontSize: 12 }}>Nenhum item do dia anterior registrado.</span>
                      <button
                        type="button"
                        onClick={() => handleStartCreate('yesterday')}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: 'none',
                          background: theme.controlBg,
                          color: accentColor,
                          fontSize: 11,
                          fontWeight: 400,
                          cursor: 'pointer',
                        }}
                      >
                        + Adicionar entrega
                      </button>
                    </div>
                  ) : (
                    yesterdayItems.map((item) =>
                      editingItemId === item.id ? (
                        <EditableDailyCard
                          key={item.id}
                          category={draftCategory}
                          title={draftTitle}
                          description={draftDescription}
                          tag={draftTag}
                          project={draftProject}
                          priority={draftPriority}
                          blockerSeverity={draftBlockerSeverity}
                          cardTheme={draftCardTheme}
                          customColor={draftCustomColor}
                          availableProjects={availableProjects}
                          isEffectiveDark={isEffectiveDark}
                          accentColor={accentColor}
                          onChangeTitle={setDraftTitle}
                          onChangeDescription={setDraftDescription}
                          onChangeTag={setDraftTag}
                          onChangeProject={setDraftProject}
                          onChangePriority={setDraftPriority}
                          onChangeBlockerSeverity={setDraftBlockerSeverity}
                          onChangeCardTheme={setDraftCardTheme}
                          onChangeCustomColor={setDraftCustomColor}
                          onConfirm={handleConfirmInline}
                          onCancel={handleCancelInline}
                        />
                      ) : (
                        <DailyCardItem
                          key={item.id}
                          item={item}
                          isEffectiveDark={isEffectiveDark}
                          accentColor={accentColor}
                          onEdit={handleStartEdit}
                          onDelete={(it) => setItemToDelete(it)}
                          onToggleCompleted={handleToggleCompleted}
                          onToggleBlocker={handleToggleBlockerStatus}
                          isDragging={draggingItemId === item.id}
                          isDragOver={dragOverItemId === item.id}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={(e, targetId) => handleDrop(e, targetId, 'yesterday')}
                          onDragEnd={handleDragEnd}
                        />
                      )
                    )
                  )}
                </div>
              </div>

              {/* --------------------------------------------------------------- */}
              {/* COLUNA 2: IMPEDIMENTOS E PROBLEMAS                             */}
              {/* --------------------------------------------------------------- */}
              <div
                style={{
                  background: theme.bgShelf,
                  borderRadius: 10,
                  border: theme.shelfBorder,
                  boxShadow: theme.shelfShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  padding: 5,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  minHeight: 0,
                }}
              >
                {/* Header Coluna 2 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 8,
                    background: isEffectiveDark ? 'rgba(239, 68, 68, 0.08)' : 'rgba(239, 68, 68, 0.06)',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 400, textTransform: 'uppercase', letterSpacing: 0.5, color: '#ef4444' }}>
                      Impedimentos
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 400,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: '#ef444425',
                        color: '#ef4444',
                      }}
                    >
                      {blockerItems.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartCreate('blocker')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: accentColor,
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 400,
                      cursor: 'pointer',
                      transition: 'opacity 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                    title="Adicionar registro"
                  >
                    <Plus size={12} />
                    <span>Adicionar registro</span>
                  </button>
                </div>

                {/* Lista de Cards da Coluna 2 */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: 2,
                  }}
                >
                  {/* Card sendo criado inline */}
                  {creatingInColumn === 'blocker' && (
                    <EditableDailyCard
                      category="blocker"
                      title={draftTitle}
                      description={draftDescription}
                      tag={draftTag}
                      project={draftProject}
                      priority={draftPriority}
                      blockerSeverity={draftBlockerSeverity}
                      cardTheme={draftCardTheme}
                      customColor={draftCustomColor}
                      availableProjects={availableProjects}
                      isEffectiveDark={isEffectiveDark}
                      accentColor={accentColor}
                      onChangeTitle={setDraftTitle}
                      onChangeDescription={setDraftDescription}
                      onChangeTag={setDraftTag}
                      onChangeProject={setDraftProject}
                      onChangePriority={setDraftPriority}
                      onChangeBlockerSeverity={setDraftBlockerSeverity}
                      onChangeCardTheme={setDraftCardTheme}
                      onChangeCustomColor={setDraftCustomColor}
                      onConfirm={handleConfirmInline}
                      onCancel={handleCancelInline}
                    />
                  )}

                  {blockerItems.length === 0 && creatingInColumn !== 'blocker' ? (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                        textAlign: 'center',
                        color: theme.textMuted,
                        gap: 8,
                      }}
                    >
                      <CheckCircle2 size={24} color="#22c55e" opacity={0.6} />
                      <span style={{ fontSize: 12 }}>Sem bloqueios no momento. Tudo fluindo perfeitamente!</span>
                      <button
                        type="button"
                        onClick={() => handleStartCreate('blocker')}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: 'none',
                          background: theme.controlBg,
                          color: '#ef4444',
                          fontSize: 11,
                          fontWeight: 400,
                          cursor: 'pointer',
                        }}
                      >
                        + Registrar impedimento
                      </button>
                    </div>
                  ) : (
                    blockerItems.map((item) =>
                      editingItemId === item.id ? (
                        <EditableDailyCard
                          key={item.id}
                          category={draftCategory}
                          title={draftTitle}
                          description={draftDescription}
                          tag={draftTag}
                          project={draftProject}
                          priority={draftPriority}
                          blockerSeverity={draftBlockerSeverity}
                          cardTheme={draftCardTheme}
                          customColor={draftCustomColor}
                          availableProjects={availableProjects}
                          isEffectiveDark={isEffectiveDark}
                          accentColor={accentColor}
                          onChangeTitle={setDraftTitle}
                          onChangeDescription={setDraftDescription}
                          onChangeTag={setDraftTag}
                          onChangeProject={setDraftProject}
                          onChangePriority={setDraftPriority}
                          onChangeBlockerSeverity={setDraftBlockerSeverity}
                          onChangeCardTheme={setDraftCardTheme}
                          onChangeCustomColor={setDraftCustomColor}
                          onConfirm={handleConfirmInline}
                          onCancel={handleCancelInline}
                        />
                      ) : (
                        <DailyCardItem
                          key={item.id}
                          item={item}
                          isEffectiveDark={isEffectiveDark}
                          accentColor={accentColor}
                          onEdit={handleStartEdit}
                          onDelete={(it) => setItemToDelete(it)}
                          onToggleCompleted={handleToggleCompleted}
                          onToggleBlocker={handleToggleBlockerStatus}
                          isDragging={draggingItemId === item.id}
                          isDragOver={dragOverItemId === item.id}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={(e, targetId) => handleDrop(e, targetId, 'blocker')}
                          onDragEnd={handleDragEnd}
                        />
                      )
                    )
                  )}
                </div>
              </div>

              {/* --------------------------------------------------------------- */}
              {/* COLUNA 3: PLANEJADO PARA HOJE                                  */}
              {/* --------------------------------------------------------------- */}
              <div
                style={{
                  background: theme.bgShelf,
                  borderRadius: 10,
                  border: theme.shelfBorder,
                  boxShadow: theme.shelfShadow,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  padding: 5,
                  boxSizing: 'border-box',
                  overflow: 'hidden',
                  minHeight: 0,
                }}
              >
                {/* Header Coluna 3 */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '6px 8px',
                    borderRadius: 8,
                    background: isEffectiveDark ? 'rgba(56, 189, 248, 0.08)' : 'rgba(56, 189, 248, 0.06)',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 400, textTransform: 'uppercase', letterSpacing: 0.5, color: '#38bdf8' }}>
                      Planejado Hoje
                    </span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 400,
                        padding: '1px 6px',
                        borderRadius: 10,
                        background: '#38bdf825',
                        color: '#38bdf8',
                      }}
                    >
                      {todayItems.length}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleStartCreate('today')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '3px 8px',
                      borderRadius: 6,
                      border: 'none',
                      background: accentColor,
                      color: '#ffffff',
                      fontSize: 11,
                      fontWeight: 400,
                      cursor: 'pointer',
                      transition: 'opacity 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '0.9';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '1';
                    }}
                    title="Adicionar registro"
                  >
                    <Plus size={12} />
                    <span>Adicionar registro</span>
                  </button>
                </div>

                {/* Lista de Cards da Coluna 3 */}
                <div
                  style={{
                    flex: 1,
                    overflowY: 'auto',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: 2,
                  }}
                >
                  {/* Card sendo criado inline */}
                  {creatingInColumn === 'today' && (
                    <EditableDailyCard
                      category="today"
                      title={draftTitle}
                      description={draftDescription}
                      tag={draftTag}
                      project={draftProject}
                      priority={draftPriority}
                      cardTheme={draftCardTheme}
                      customColor={draftCustomColor}
                      availableProjects={availableProjects}
                      isEffectiveDark={isEffectiveDark}
                      accentColor={accentColor}
                      onChangeTitle={setDraftTitle}
                      onChangeDescription={setDraftDescription}
                      onChangeTag={setDraftTag}
                      onChangeProject={setDraftProject}
                      onChangePriority={setDraftPriority}
                      onChangeCardTheme={setDraftCardTheme}
                      onChangeCustomColor={setDraftCustomColor}
                      onConfirm={handleConfirmInline}
                      onCancel={handleCancelInline}
                    />
                  )}

                  {todayItems.length === 0 && creatingInColumn !== 'today' ? (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: 20,
                        textAlign: 'center',
                        color: theme.textMuted,
                        gap: 8,
                      }}
                    >
                      <Target size={24} color={theme.textMuted} opacity={0.5} />
                      <span style={{ fontSize: 12 }}>Nenhuma tarefa planejada para hoje ainda.</span>
                      <button
                        type="button"
                        onClick={() => handleStartCreate('today')}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 6,
                          border: 'none',
                          background: theme.controlBg,
                          color: accentColor,
                          fontSize: 11,
                          fontWeight: 400,
                          cursor: 'pointer',
                        }}
                      >
                        + Adicionar meta de hoje
                      </button>
                    </div>
                  ) : (
                    todayItems.map((item) =>
                      editingItemId === item.id ? (
                        <EditableDailyCard
                          key={item.id}
                          category={draftCategory}
                          title={draftTitle}
                          description={draftDescription}
                          tag={draftTag}
                          project={draftProject}
                          priority={draftPriority}
                          blockerSeverity={draftBlockerSeverity}
                          cardTheme={draftCardTheme}
                          customColor={draftCustomColor}
                          availableProjects={availableProjects}
                          isEffectiveDark={isEffectiveDark}
                          accentColor={accentColor}
                          onChangeTitle={setDraftTitle}
                          onChangeDescription={setDraftDescription}
                          onChangeTag={setDraftTag}
                          onChangeProject={setDraftProject}
                          onChangePriority={setDraftPriority}
                          onChangeBlockerSeverity={setDraftBlockerSeverity}
                          onChangeCardTheme={setDraftCardTheme}
                          onChangeCustomColor={setDraftCustomColor}
                          onConfirm={handleConfirmInline}
                          onCancel={handleCancelInline}
                        />
                      ) : (
                        <DailyCardItem
                          key={item.id}
                          item={item}
                          isEffectiveDark={isEffectiveDark}
                          accentColor={accentColor}
                          onEdit={handleStartEdit}
                          onDelete={(it) => setItemToDelete(it)}
                          onToggleCompleted={handleToggleCompleted}
                          onToggleBlocker={handleToggleBlockerStatus}
                          isDragging={draggingItemId === item.id}
                          isDragOver={dragOverItemId === item.id}
                          onDragStart={handleDragStart}
                          onDragOver={handleDragOver}
                          onDragLeave={handleDragLeave}
                          onDrop={(e, targetId) => handleDrop(e, targetId, 'today')}
                          onDragEnd={handleDragEnd}
                        />
                      )
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
            <WeeklyViewContainer
              items={items}
              weeklyGoals={weeklyGoals}
              onToggleGoal={(goalId) => {
                setWeeklyGoals((prev) =>
                  prev.map((g) => (g.id === goalId ? { ...g, completed: !g.completed } : g))
                );
              }}
              onAddGoal={() => {
                const title = prompt('Digite o título da meta da semana:');
                if (title?.trim()) {
                  const newGoal: WeeklyGoal = {
                    id: `wg-${Date.now()}`,
                    title: title.trim(),
                    weekStartIso: toIsoDate(getMondayOfCurrentWeek(new Date())),
                    completed: false,
                    priority: 'Alta',
                  };
                  setWeeklyGoals((prev) => [...prev, newGoal]);
                }
              }}
              theme={theme}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              selectedProjectFilter={selectedProjectFilter}
            />
          )}
        </div>



      {/* ========================================================================= */}
      {/* 5. MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (REGRA OBRIGATÓRIA DO AGENTS.MD)      */}
      {/* ========================================================================= */}
      <ConfirmDeleteModal
        isOpen={Boolean(itemToDelete)}
        title="Excluir Registro da Daily"
        message={`Tem certeza que deseja excluir o registro "${itemToDelete?.title}"?`}
        itemDescription="Esta ação não poderá ser desfeita e removerá o item do histórico desta daily."
        confirmLabel="Excluir Registro"
        cancelLabel="Cancelar"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDeleteItem}
        onCancel={() => setItemToDelete(null)}
      />
    </div>
  );
};

// =============================================================================
// COMPONENTE DO CARD EDITÁVEL (CRIAÇÃO E EDIÇÃO INLINE COM SELETORES E COLORPICKER)
// =============================================================================
interface EditableDailyCardProps {
  category: 'yesterday' | 'blocker' | 'today';
  title: string;
  description: string;
  tag: string;
  project: string;
  priority: 'Baixa' | 'Média' | 'Alta' | 'Urgente';
  blockerSeverity?: 'Crítico' | 'Alto' | 'Médio';
  cardTheme: CardPalette;
  customColor?: string;
  availableProjects: { id: string; name: string; color?: string }[];
  isEffectiveDark: boolean;
  accentColor: string;
  onChangeTitle: (val: string) => void;
  onChangeDescription: (val: string) => void;
  onChangeTag: (val: string) => void;
  onChangeProject: (val: string) => void;
  onChangePriority: (val: 'Baixa' | 'Média' | 'Alta' | 'Urgente') => void;
  onChangeBlockerSeverity?: (val: 'Crítico' | 'Alto' | 'Médio') => void;
  onChangeCardTheme: (val: CardPalette) => void;
  onChangeCustomColor?: (val: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const EditableDailyCard: React.FC<EditableDailyCardProps> = ({
  category,
  title,
  description,
  tag,
  project,
  priority,
  blockerSeverity,
  cardTheme,
  customColor,
  availableProjects,
  isEffectiveDark,
  accentColor,
  onChangeTitle,
  onChangeDescription,
  onChangeTag,
  onChangeProject,
  onChangePriority,
  onChangeBlockerSeverity,
  onChangeCardTheme,
  onChangeCustomColor,
  onConfirm,
  onCancel,
}) => {
  const [isColorPickerOpen, setIsColorPickerOpen] = useState(false);
  const colorPickerRef = useRef<HTMLDivElement>(null);
  const titleTextareaRef = useRef<HTMLTextAreaElement>(null);
  const descriptionTextareaRef = useRef<HTMLTextAreaElement>(null);
  const themeCfg = CARD_THEMES[cardTheme || 'peach'] || CARD_THEMES.peach;
  const isBlocker = category === 'blocker';

  const cardBg = isEffectiveDark ? '#1a1a1c' : '#ffffff';
  const textColor = isEffectiveDark ? '#ffffff' : '#111827';
  const subColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.65)' : '#666666';

  const effectiveColor = customColor || themeCfg.accent || '#f97316';

  const PRESET_COLORS = [
    { label: 'Laranja', color: '#f97316', theme: 'peach' as CardPalette },
    { label: 'Azul', color: '#38bdf8', theme: 'cyan' as CardPalette },
    { label: 'Roxo', color: '#a855f7', theme: 'lavender' as CardPalette },
    { label: 'Índigo', color: '#818cf8', theme: 'charcoal' as CardPalette },
    { label: 'Verde', color: '#10b981', theme: 'emerald' as CardPalette },
    { label: 'Rosa', color: '#f43f5e', theme: 'rose' as CardPalette },
    { label: 'Amarelo', color: '#eab308', theme: 'peach' as CardPalette },
    { label: 'Vermelho', color: '#ef4444', theme: 'rose' as CardPalette },
  ];

  // Auto-ajuste dinâmico da altura vertical dos campos conforme o usuário digita
  useEffect(() => {
    if (titleTextareaRef.current) {
      titleTextareaRef.current.style.height = 'auto';
      titleTextareaRef.current.style.height = `${titleTextareaRef.current.scrollHeight}px`;
    }
  }, [title]);

  useEffect(() => {
    if (descriptionTextareaRef.current) {
      descriptionTextareaRef.current.style.height = 'auto';
      descriptionTextareaRef.current.style.height = `${descriptionTextareaRef.current.scrollHeight}px`;
    }
  }, [description]);

  useEffect(() => {
    if (!isColorPickerOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (colorPickerRef.current && !colorPickerRef.current.contains(e.target as Node)) {
        setIsColorPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isColorPickerOpen]);

  return (
    <div
      style={{
        width: '100%',
        borderRadius: 12,
        background: cardBg,
        border: 'none',
        padding: '12px 14px',
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        boxSizing: 'border-box',
        boxShadow: isEffectiveDark ? '0 4px 16px rgba(0,0,0,0.35)' : '0 2px 8px rgba(0,0,0,0.08)',
        position: 'relative',
      }}
    >
      {/* LINHA SUPERIOR: TÍTULO, DESCRIÇÃO E BOTÕES DE AÇÃO */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <textarea
            ref={titleTextareaRef}
            autoFocus
            rows={1}
            placeholder="Título da atividade ou entrega..."
            value={title}
            onChange={(e) => {
              onChangeTitle(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                onConfirm();
              }
              if (e.key === 'Escape') onCancel();
            }}
            style={{
              fontSize: 14,
              fontWeight: 400,
              color: textColor,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              padding: 0,
              resize: 'none',
              overflow: 'hidden',
              lineHeight: 1.35,
              minHeight: 22,
              boxSizing: 'border-box',
              display: 'block',
              fontFamily: 'inherit',
            }}
          />
          <textarea
            ref={descriptionTextareaRef}
            rows={1}
            placeholder="Descrição ou detalhes (opcional)..."
            value={description}
            onChange={(e) => {
              onChangeDescription(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = `${e.target.scrollHeight}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onCancel();
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                onConfirm();
              }
            }}
            style={{
              fontSize: 11.5,
              fontWeight: 400,
              color: subColor,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              width: '100%',
              resize: 'none',
              overflow: 'hidden',
              padding: 0,
              lineHeight: 1.4,
              minHeight: 18,
              boxSizing: 'border-box',
              display: 'block',
              fontFamily: 'inherit',
            }}
          />
        </div>

        {/* Botões Cancelar e Confirmar no canto superior direito */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: 'none',
              background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
              color: isEffectiveDark ? '#ffffff' : '#444444',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
            title="Cancelar (Esc)"
          >
            <X size={14} />
          </button>
          <button
            type="button"
            onClick={onConfirm}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: 'none',
              background: '#16a34a',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
            }}
            title="Confirmar (Enter)"
          >
            <Check size={14} strokeWidth={2.5} />
          </button>
        </div>
      </div>

      {/* DIV COLORIDA INFERIOR (COR SELECIONADA PELO USUÁRIO) */}
      <div
        style={{
          width: '100%',
          borderRadius: 9,
          background: effectiveColor,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          boxSizing: 'border-box',
          color: '#ffffff',
          position: 'relative',
        }}
      >
        {/* LADO ESQUERDO: SELETOR DE PROJETO, TAG E COLORPICKER */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
          {/* Seletor de Projeto Vinculado */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 6,
              background: 'rgba(0, 0, 0, 0.25)',
              color: '#ffffff',
              fontSize: 10.5,
              fontWeight: 400,
            }}
          >
            <Folder size={11} color="rgba(255, 255, 255, 0.9)" />
            <select
              value={project}
              onChange={(e) => onChangeProject(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: 10.5,
                fontWeight: 400,
                outline: 'none',
                cursor: 'pointer',
                padding: 0,
                maxWidth: 110,
              }}
            >
              {availableProjects.map((p) => (
                <option
                  key={p.id}
                  value={p.name}
                  style={{
                    background: isEffectiveDark ? '#1a1a1a' : '#ffffff',
                    color: isEffectiveDark ? '#ffffff' : '#111827',
                  }}
                >
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Input de Tag */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '2px 8px',
              borderRadius: 6,
              background: 'rgba(0, 0, 0, 0.25)',
              color: '#ffffff',
              fontSize: 10.5,
              fontWeight: 400,
            }}
          >
            <Tag size={10} color="rgba(255, 255, 255, 0.9)" />
            <input
              type="text"
              placeholder="Tag..."
              value={tag}
              onChange={(e) => onChangeTag(e.target.value)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: 10.5,
                fontWeight: 400,
                outline: 'none',
                width: 60,
                padding: 0,
              }}
            />
          </div>

          {/* Botão de Colorpicker */}
          <div style={{ position: 'relative' }} ref={colorPickerRef}>
            <button
              type="button"
              onClick={() => setIsColorPickerOpen(!isColorPickerOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 7px',
                borderRadius: 6,
                background: 'rgba(0, 0, 0, 0.28)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                fontSize: 10,
                fontWeight: 400,
                cursor: 'pointer',
              }}
              title="Escolher cor da tarefa"
            >
              <Palette size={11} color="#ffffff" />
              <span>Cor</span>
            </button>

            {/* Popup do ColorPicker */}
            {isColorPickerOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 26,
                  left: 0,
                  zIndex: 200,
                  background: isEffectiveDark ? '#222226' : '#ffffff',
                  border: isEffectiveDark ? '1px solid rgba(255,255,255,0.12)' : '1px solid rgba(0,0,0,0.1)',
                  borderRadius: 8,
                  padding: 8,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  minWidth: 160,
                }}
              >
                <div style={{ fontSize: 10, color: isEffectiveDark ? 'rgba(255,255,255,0.6)' : '#666666' }}>
                  Cores Rápidas
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {PRESET_COLORS.map((pc) => {
                    const isSelected = effectiveColor.toLowerCase() === pc.color.toLowerCase();
                    return (
                      <button
                        key={pc.color}
                        type="button"
                        onClick={() => {
                          onChangeCustomColor?.(pc.color);
                          onChangeCardTheme(pc.theme);
                          setIsColorPickerOpen(false);
                        }}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: pc.color,
                          border: isSelected ? '2px solid #ffffff' : 'none',
                          boxShadow: isSelected ? `0 0 0 2px ${pc.color}` : 'none',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: 0,
                        }}
                        title={pc.label}
                      >
                        {isSelected && <Check size={12} color="#ffffff" strokeWidth={3} />}
                      </button>
                    );
                  })}
                </div>

                <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)' }} />

                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                  <span style={{ fontSize: 10, color: isEffectiveDark ? 'rgba(255,255,255,0.8)' : '#333333' }}>
                    Personalizado:
                  </span>
                  <input
                    type="color"
                    value={effectiveColor.startsWith('#') ? effectiveColor : '#f97316'}
                    onChange={(e) => {
                      onChangeCustomColor?.(e.target.value);
                    }}
                    style={{
                      width: 28,
                      height: 24,
                      padding: 0,
                      border: 'none',
                      background: 'transparent',
                      cursor: 'pointer',
                      borderRadius: 4,
                    }}
                    title="Seletor de cor livre"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* LADO DIREITO: STATUS/PRIORIDADE À ESQUERDA DA FOTO DO USUÁRIO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          {/* Seletor de Severidade (se for blocker) */}
          {isBlocker && onChangeBlockerSeverity && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 7px',
                borderRadius: 6,
                background: 'rgba(239, 68, 68, 0.4)',
                fontSize: 10,
              }}
            >
              <select
                value={blockerSeverity || 'Alto'}
                onChange={(e) => onChangeBlockerSeverity(e.target.value as any)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: 10,
                  fontWeight: 400,
                  outline: 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              >
                <option value="Crítico" style={{ background: isEffectiveDark ? '#1a1a1a' : '#ffffff', color: isEffectiveDark ? '#ffffff' : '#111827' }}>
                  Crítico
                </option>
                <option value="Alto" style={{ background: isEffectiveDark ? '#1a1a1a' : '#ffffff', color: isEffectiveDark ? '#ffffff' : '#111827' }}>
                  Alto
                </option>
                <option value="Médio" style={{ background: isEffectiveDark ? '#1a1a1a' : '#ffffff', color: isEffectiveDark ? '#ffffff' : '#111827' }}>
                  Médio
                </option>
              </select>
            </div>
          )}

          {/* Seletor de Prioridade: Baixa | Média | Alta */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '2px 6px',
              borderRadius: 6,
              background: 'rgba(0, 0, 0, 0.25)',
              fontSize: 10,
            }}
          >
            <select
              value={priority}
              onChange={(e) => onChangePriority(e.target.value as any)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#ffffff',
                fontSize: 10,
                fontWeight: 400,
                outline: 'none',
                cursor: 'pointer',
                padding: 0,
              }}
              title="Prioridade da tarefa"
            >
              <option value="Baixa" style={{ background: isEffectiveDark ? '#1a1a1a' : '#ffffff', color: isEffectiveDark ? '#ffffff' : '#111827' }}>
                Baixa
              </option>
              <option value="Média" style={{ background: isEffectiveDark ? '#1a1a1a' : '#ffffff', color: isEffectiveDark ? '#ffffff' : '#111827' }}>
                Média
              </option>
              <option value="Alta" style={{ background: isEffectiveDark ? '#1a1a1a' : '#ffffff', color: isEffectiveDark ? '#ffffff' : '#111827' }}>
                Alta
              </option>
            </select>
          </div>

          {/* Foto do Usuário Logado */}
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1.5px solid rgba(255, 255, 255, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9.5,
              fontWeight: 400,
              color: '#ffffff',
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }}
            title="Usuário logado: Walancy"
          >
            <img
              src="https://github.com/Walancy.png"
              alt="Walancy"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
                const sibling = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
                if (sibling) sibling.style.display = 'block';
              }}
            />
            <span style={{ display: 'none' }}>W</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// =============================================================================
// COMPONENTE DO CARD DE TAREFA (TÍTULO/DESCRIÇÃO + '...' MENU + DIV COLORIDA INFERIOR)
// =============================================================================
interface DailyCardItemProps {
  item: DailyItem;
  isEffectiveDark: boolean;
  accentColor: string;
  onEdit: (item: DailyItem) => void;
  onDelete: (item: DailyItem) => void;
  onToggleCompleted: (item: DailyItem) => void;
  onToggleBlocker: (item: DailyItem) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragOver?: (e: React.DragEvent, id: string) => void;
  onDragLeave?: (e: React.DragEvent, id: string) => void;
  onDrop?: (e: React.DragEvent, targetId: string) => void;
  onDragEnd?: (e: React.DragEvent) => void;
}

const DailyCardItem: React.FC<DailyCardItemProps> = ({
  item,
  isEffectiveDark,
  accentColor,
  onEdit,
  onDelete,
  onToggleCompleted,
  onToggleBlocker,
  isDragging,
  isDragOver,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const themeCfg = CARD_THEMES[item.cardTheme || 'peach'] || CARD_THEMES.peach;
  const isBlocker = item.category === 'blocker';
  const isResolved = item.blockerStatus === 'Resolvido';

  const cardBg = isEffectiveDark ? '#1a1a1c' : '#ffffff';
  const textColor = isEffectiveDark ? '#ffffff' : '#111827';
  const subColor = isEffectiveDark ? 'rgba(255, 255, 255, 0.65)' : '#666666';

  const effectiveColor = item.customColor || themeCfg.accent || '#f97316';

  useEffect(() => {
    if (!isMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  return (
    <div
      draggable
      onDragStart={(e) => {
        setIsMenuOpen(false);
        onDragStart?.(e, item.id);
      }}
      onDragOver={(e) => onDragOver?.(e, item.id)}
      onDragLeave={(e) => onDragLeave?.(e, item.id)}
      onDrop={(e) => onDrop?.(e, item.id)}
      onDragEnd={onDragEnd}
      style={{
        width: '100%',
        borderRadius: 12,
        background: cardBg,
        border: isDragOver
          ? `2px dashed ${accentColor}`
          : 'none',
        display: 'flex',
        flexDirection: 'row',
        alignItems: 'stretch',
        boxSizing: 'border-box',
        boxShadow: isDragOver
          ? `0 4px 16px ${accentColor}40`
          : isEffectiveDark
          ? '0 3px 12px rgba(0,0,0,0.25)'
          : '0 2px 6px rgba(0,0,0,0.05)',
        transition: 'border 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease, transform 0.15s ease',
        opacity: isDragging ? 0.35 : isResolved ? 0.65 : 1,
        transform: isDragOver ? 'scale(1.01)' : 'none',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* DIV COM PONTINHOS NA ESQUERDA (DRAG HANDLE PARA ARRASTAR DE CIMA PRA BAIXO) */}
      <div
        title="Arraste para organizar de cima para baixo"
        style={{
          width: 24,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'grab',
          color: isEffectiveDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.28)',
          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
          borderRight: 'none',
          transition: 'all 0.15s ease',
          userSelect: 'none',
          flexShrink: 0,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.color = isEffectiveDark ? 'rgba(255, 255, 255, 0.85)' : 'rgba(0, 0, 0, 0.85)';
          (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.color = isEffectiveDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.28)';
          (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)';
        }}
      >
        <GripVertical size={16} />
      </div>

      {/* CONTEÚDO PRINCIPAL DO CARD */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          padding: '12px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
          boxSizing: 'border-box',
        }}
      >
        {/* LINHA SUPERIOR: TÍTULO + DESCRIÇÃO + BOTÃO '...' NO CANTO SUPERIOR DIREITO */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
          {/* Checkbox para tarefas do dia */}
          {item.category === 'today' && (
            <button
              type="button"
              onClick={() => onToggleCompleted(item)}
              style={{
                width: 18,
                height: 18,
                borderRadius: 5,
                border: 'none',
                background: item.completed ? '#16a34a' : isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                padding: 0,
                marginTop: 2,
                flexShrink: 0,
                transition: 'all 0.15s ease',
              }}
              title={item.completed ? 'Marcar como pendente' : 'Marcar como concluído'}
            >
              {item.completed && <Check size={12} color="#ffffff" strokeWidth={2.5} />}
            </button>
          )}

          {/* Indicador de Bloqueio */}
          {item.category === 'blocker' && (
            <div
              onClick={() => onToggleBlocker(item)}
              style={{
                cursor: 'pointer',
                marginTop: 2,
                flexShrink: 0,
              }}
              title={isResolved ? 'Clique para reabrir bloqueio' : 'Clique para marcar como resolvido'}
            >
              <AlertCircle size={16} color={isResolved ? '#16a34a' : '#ef4444'} />
            </div>
          )}

          {/* Título e Descrição */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
            <div
              style={{
                fontSize: 13.5,
                fontWeight: 400,
                color: textColor,
                lineHeight: 1.35,
                textDecoration: item.category !== 'yesterday' && (item.completed || isResolved) ? 'line-through' : 'none',
                overflowWrap: 'break-word',
                wordBreak: 'break-word',
                whiteSpace: 'pre-wrap',
              }}
            >
              {item.title}
            </div>
            {item.description && (
              <div
                style={{
                  fontSize: 11.5,
                  fontWeight: 400,
                  color: subColor,
                  lineHeight: 1.35,
                  overflowWrap: 'break-word',
                  wordBreak: 'break-word',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {item.description}
              </div>
            )}
          </div>
        </div>

        {/* Botão '...' no canto superior direito */}
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            type="button"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              border: 'none',
              background: isMenuOpen
                ? isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)'
                : 'transparent',
              color: isMenuOpen ? textColor : subColor,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              padding: 0,
              transition: 'all 0.15s ease',
            }}
            title="Mais opções do card"
          >
            <MoreHorizontal size={15} />
          </button>

          {/* Popup com opções para o card */}
          {isMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: 28,
                right: 0,
                background: isEffectiveDark ? '#222225' : '#ffffff',
                border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.12)' : '1px solid rgba(0, 0, 0, 0.1)',
                borderRadius: 8,
                boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minWidth: 145,
                zIndex: 100,
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onEdit(item);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  fontSize: 11.5,
                  fontWeight: 400,
                  color: textColor,
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <Edit2 size={12} color={subColor} />
                <span>Editar</span>
              </button>

              {(item.category === 'today' || item.completed) && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onToggleCompleted(item);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    fontSize: 11.5,
                    fontWeight: 400,
                    color: textColor,
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <Check size={12} color={item.completed ? '#eab308' : '#16a34a'} />
                  <span>{item.completed ? 'Marcar pendente' : 'Marcar concluído'}</span>
                </button>
              )}

              {item.category === 'blocker' && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMenuOpen(false);
                    onToggleBlocker(item);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 10px',
                    fontSize: 11.5,
                    fontWeight: 400,
                    color: textColor,
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 6,
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                  }}
                >
                  <AlertCircle size={12} color={isResolved ? '#ef4444' : '#16a34a'} />
                  <span>{isResolved ? 'Reabrir bloqueio' : 'Marcar resolvido'}</span>
                </button>
              )}

              <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)', margin: '2px 0' }} />

              <button
                type="button"
                onClick={() => {
                  setIsMenuOpen(false);
                  onDelete(item);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '6px 10px',
                  fontSize: 11.5,
                  fontWeight: 400,
                  color: '#ef4444',
                  background: 'transparent',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  textAlign: 'left',
                  width: '100%',
                }}
              >
                <Trash2 size={12} color="#ef4444" />
                <span>Excluir</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* DIV COLORIDA INFERIOR */}
      <div
        style={{
          width: '100%',
          borderRadius: 9,
          background: effectiveColor,
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 6,
          boxSizing: 'border-box',
          color: '#ffffff',
        }}
      >
        {/* LADO ESQUERDO: NOME DO PROJETO E TAG */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'wrap' }}>
          {item.projectName && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'rgba(0, 0, 0, 0.22)',
                color: '#ffffff',
                fontSize: 10.5,
                fontWeight: 400,
                whiteSpace: 'nowrap',
              }}
              title={`Projeto: ${item.projectName}`}
            >
              <Folder size={11} color="rgba(255, 255, 255, 0.9)" />
              <span>{item.projectName}</span>
            </div>
          )}

          {item.tag && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '2px 8px',
                borderRadius: 6,
                background: 'rgba(0, 0, 0, 0.22)',
                color: '#ffffff',
                fontSize: 10.5,
                fontWeight: 400,
                whiteSpace: 'nowrap',
              }}
              title={`Tag: ${item.tag}`}
            >
              <Tag size={10} color="rgba(255, 255, 255, 0.9)" />
              <span>{item.tag}</span>
            </div>
          )}
        </div>

        {/* LADO DIREITO: TAGS DE STATUS/PRIORIDADE À ESQUERDA DA FOTO DO USUÁRIO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0 }}>
          {/* Tag de Concluído */}
          {item.completed && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 7px',
                borderRadius: 6,
                background: 'rgba(0, 0, 0, 0.28)',
                color: '#86efac',
                fontSize: 10,
                fontWeight: 400,
              }}
              title={item.isFromPreviousDayPlanned ? 'Tarefa planejada concluída no dia anterior' : 'Concluído'}
            >
              <Check size={10} strokeWidth={2.5} />
              <span>Concluído</span>
            </div>
          )}

          {/* Tag de Bloqueio */}
          {isBlocker && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                padding: '2px 7px',
                borderRadius: 6,
                background: isResolved ? 'rgba(0, 0, 0, 0.28)' : 'rgba(239, 68, 68, 0.45)',
                color: isResolved ? '#86efac' : '#ffffff',
                fontSize: 10,
                fontWeight: 400,
              }}
            >
              <AlertCircle size={10} />
              <span>{isResolved ? 'Resolvido' : (item.blockerSeverity || 'Bloqueio')}</span>
            </div>
          )}

          {/* Tag de Prioridade: Alta / Média / Baixa */}
          {item.priority && (
            <div
              style={{
                padding: '2px 7px',
                borderRadius: 6,
                background: 'rgba(0, 0, 0, 0.22)',
                color: '#ffffff',
                fontSize: 10,
                fontWeight: 400,
              }}
            >
              {item.priority}
            </div>
          )}

          {/* Foto do Usuário Logado */}
          <div
            style={{
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'rgba(0, 0, 0, 0.35)',
              border: '1.5px solid rgba(255, 255, 255, 0.85)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 9.5,
              fontWeight: 400,
              color: '#ffffff',
              overflow: 'hidden',
              flexShrink: 0,
              boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
            }}
            title={item.assignee?.name || 'Walancy'}
          >
            <img
              src={item.assignee?.avatarUrl || 'https://github.com/Walancy.png'}
              alt={item.assignee?.name || 'Walancy'}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              onError={(e) => {
                (e.currentTarget as HTMLElement).style.display = 'none';
                const sibling = (e.currentTarget as HTMLElement).nextElementSibling as HTMLElement;
                if (sibling) sibling.style.display = 'block';
              }}
            />
            <span style={{ display: 'none' }}>{(item.assignee?.name || 'W').charAt(0).toUpperCase()}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
  );
};

// =============================================================================
// COMPONENTE DA VISÃO DE WEEKLY
// =============================================================================
interface WeeklyViewContainerProps {
  items: DailyItem[];
  weeklyGoals?: WeeklyGoal[];
  onToggleGoal?: (id: string) => void;
  onAddGoal?: () => void;
  theme: any;
  isEffectiveDark: boolean;
  accentColor: string;
  selectedProjectFilter: string;
}

const WeeklyViewContainer: React.FC<WeeklyViewContainerProps> = ({
  items,
  theme,
  isEffectiveDark,
  accentColor,
  selectedProjectFilter,
}) => {
  const monday = useMemo(() => getMondayOfCurrentWeek(new Date()), []);

  const weekWorkdays = useMemo(() => {
    const list: Array<{ date: Date; iso: string; name: string; items: DailyItem[] }> = [];
    for (let i = 0; i < 5; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      const iso = toIsoDate(d);
      let dayItems = items.filter((it) => it.dateIso === iso);
      if (selectedProjectFilter !== 'all') {
        dayItems = dayItems.filter((it) => it.projectName?.toLowerCase() === selectedProjectFilter.toLowerCase());
      }
      list.push({
        date: d,
        iso,
        name: WEEKDAY_NAMES_PT[d.getDay()],
        items: dayItems,
      });
    }
    return list;
  }, [monday, items, selectedProjectFilter]);

  return (
    <div
      style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: 'repeat(5, 1fr)',
        gap: 6,
        padding: 0,
        boxSizing: 'border-box',
        height: '100%',
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {weekWorkdays.map((wd) => (
        <div
          key={wd.iso}
          style={{
            background: theme.bgShelf,
            borderRadius: 10,
            border: 'none',
            boxShadow: theme.shelfShadow,
            padding: 8,
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            overflow: 'hidden',
            minHeight: 0,
            boxSizing: 'border-box',
          }}
        >
          {/* Header da Coluna da Semana */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '6px 8px',
              borderRadius: 8,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
              flexShrink: 0,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 400, textTransform: 'uppercase', letterSpacing: 0.5, color: theme.textPrimary }}>
                {wd.name.split('-')[0]}
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 400,
                  padding: '1px 6px',
                  borderRadius: 10,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                  color: theme.textSecondary,
                }}
              >
                {wd.items.length}
              </span>
            </div>
            <span style={{ fontSize: 11, fontWeight: 400, color: theme.textMuted }}>
              {wd.date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
            </span>
          </div>

          {/* Lista de Cards da Semana */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              minHeight: 0,
              padding: 2,
            }}
          >
            {wd.items.length === 0 ? (
              <div
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '24px 0',
                  textAlign: 'center',
                  fontSize: 11.5,
                  fontWeight: 400,
                  color: theme.textMuted,
                }}
              >
                Sem tarefas registradas
              </div>
            ) : (
              wd.items.map((it) => (
                <div
                  key={it.id}
                  style={{
                    background: isEffectiveDark ? '#1a1a1c' : '#ffffff',
                    borderRadius: 8,
                    border: 'none',
                    boxShadow: isEffectiveDark ? '0 2px 8px rgba(0,0,0,0.2)' : '0 1px 4px rgba(0,0,0,0.05)',
                    padding: '8px 10px',
                    fontSize: 11.5,
                    fontWeight: 400,
                    color: theme.textPrimary,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    boxSizing: 'border-box',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <div
                      style={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        background: it.completed ? '#22c55e' : it.category === 'blocker' ? '#ef4444' : accentColor,
                        flexShrink: 0,
                        marginTop: 4,
                      }}
                    />
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        fontSize: 12,
                        fontWeight: 400,
                        lineHeight: 1.35,
                        textDecoration: it.completed ? 'line-through' : 'none',
                        color: it.completed ? theme.textMuted : theme.textPrimary,
                      }}
                      title={it.title}
                    >
                      {it.title}
                    </span>
                  </div>

                  {(it.projectName || it.tag || it.priority) && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      {it.projectName && (
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 400,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                            color: theme.textSecondary,
                          }}
                        >
                          {it.projectName}
                        </span>
                      )}
                      {it.tag && (
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 400,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                            color: theme.textMuted,
                          }}
                        >
                          {it.tag}
                        </span>
                      )}
                      {it.completed && (
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 400,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: 'rgba(34, 197, 94, 0.15)',
                            color: '#22c55e',
                          }}
                        >
                          Concluído
                        </span>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
};
