import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Flag,
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
  Loader2,
} from 'lucide-react';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';
import { DailyAiChatPanel } from './DailyAiChatPanel';
import { getProjectSettings } from '../settings/projectSettingsStore';
import { GLOBAL_PROJECTS_CACHE } from '../ProjectsSchedulerView';
import type { HeaderActiveProjectInfo, HeaderProjectItem } from '../HeaderProjectSelector';

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
  onSelectAiProvider?: (providerId: string) => void;
  onSelectModel?: (modelItem: { id: string; label: string } | string, providerId?: string) => void;
  onToast?: (msg: string) => void;
  activeProject?: HeaderActiveProjectInfo | null;
  availableProjects?: HeaderProjectItem[];
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
  selectedAiProvider = 'claude',
  selectedModel = 'sonnet',
  activeModels,
  onSelectAiProvider,
  onSelectModel,
  onToast = (msg: string) => console.log(msg),
  activeProject,
  availableProjects: propsAvailableProjects,
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

    if (activeProject?.name) {
      map.set(activeProject.name.toLowerCase(), {
        id: activeProject.name,
        name: activeProject.name,
        fullName: activeProject.fullName || activeProject.name,
        color: accentColor,
      });
    }

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
      if (saved) {
        const parsed: DailyItem[] = JSON.parse(saved);
        // Corrige itens existentes que foram vinculados incorretamente ao repositório do cabeçalho
        const sanitized = parsed.map((item) => {
          const text = `${item.title} ${item.description || ''}`.toLowerCase();
          if (
            (item.projectName?.includes('clickfan') || item.projectName?.includes('appmoove')) &&
            (text.includes('inss') || text.includes('maed') || text.includes('vau') || text.includes('autojump') || text.includes('ainaobra') || text.includes('cors') || text.includes('payment') || text.includes('concreto'))
          ) {
            return {
              ...item,
              projectId: 'ainaobra',
              projectName: 'ainaobra',
            };
          }
          return item;
        });
        return sanitized;
      }
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

  useEffect(() => {
    const handleDailyUpdate = () => {
      try {
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (Array.isArray(parsed)) {
            setItems(parsed);
          }
        }
      } catch {}
    };

    window.addEventListener('devflow_daily_updated', handleDailyUpdate);
    window.addEventListener('storage', handleDailyUpdate);
    return () => {
      window.removeEventListener('devflow_daily_updated', handleDailyUpdate);
      window.removeEventListener('storage', handleDailyUpdate);
    };
  }, [storageKey]);

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

  // Modal de Exclusão de Coluna Inteira (Regra obrigatória do AGENTS.md)
  const [columnToClear, setColumnToClear] = useState<'yesterday' | 'blocker' | 'today' | null>(null);
  const [isClearingColumn, setIsClearingColumn] = useState<boolean>(false);
  const [aiHint, setAiHint] = useState<string>(() => {
    try { return localStorage.getItem('daily_ai_hint') || ''; } catch { return ''; }
  });
  // Cards gerados pela IA aguardando aceite/recusa, por coluna (só os do momento; anteriores não são afetados)
  const [pendingAiIds, setPendingAiIds] = useState<Record<string, string[]>>({});
  const [generatingAiColumn, setGeneratingAiColumn] = useState<'yesterday' | 'blocker' | 'today' | null>(null);

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
  const currentWeekStartIso = useMemo(() => toIsoDate(getMondayOfCurrentWeek(new Date())), []);
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

  // Limpeza de toda a coluna com confirmação
  const handleConfirmClearColumn = async () => {
    if (!columnToClear) return;
    setIsClearingColumn(true);
    try {
      const col = columnToClear;
      if (col === 'yesterday') {
        const prevDays = getPreviousDaysIso(selectedDate);
        setItems((prev) =>
          prev.filter((it) => !(it.category === 'yesterday' && (it.dateIso === selectedDateIso || prevDays.includes(it.dateIso))))
        );
      } else if (col === 'blocker') {
        setItems((prev) => prev.filter((it) => !(it.category === 'blocker' && it.dateIso === selectedDateIso)));
      } else if (col === 'today') {
        setItems((prev) => prev.filter((it) => !(it.category === 'today' && it.dateIso === selectedDateIso)));
      }
      const colTitle =
        col === 'yesterday'
          ? isSelectedMonday ? 'Sexta-feira' : 'Dia Anterior'
          : col === 'blocker'
          ? 'Impedimentos'
          : 'Planejado Hoje';
      onToast?.(`Coluna "${colTitle}" limpa com sucesso.`);
      setColumnToClear(null);
    } finally {
      setIsClearingColumn(false);
    }
  };

  // Geração de tarefas com IA baseada no histórico de commits do Git com Anti-Duplicação rigorosa
  const handleGenerateColumnTasksWithAi = async (colCategory: 'yesterday' | 'blocker' | 'today') => {
    if (generatingAiColumn) return;
    setGeneratingAiColumn(colCategory);

    const isMon = selectedDate.getDay() === 1;
    const targetDatesIso = getPreviousDaysIso(selectedDate);
    const refDayName = isMon ? 'sexta-feira' : 'ontem';
    const prevWorkday = getPreviousWorkday(selectedDate);

    const colLabel =
      colCategory === 'yesterday'
        ? isMon ? 'Sexta-feira' : 'Dia Anterior'
        : colCategory === 'blocker'
        ? 'Impedimentos'
        : 'Planejado Hoje';

    try {
      // 1. Obtém usuário autenticado no GitHub / Git
      let ghUser = '';
      let gitName = '';
      try {
        const uRes = await window.electronAPI?.github?.getUser();
        if (uRes?.success && uRes.user?.login) {
          ghUser = uRes.user.login;
        } else if (window.electronAPI?.shell?.exec) {
          const userExec = await window.electronAPI.shell.exec(
            'export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"; git config user.name || gh api user --jq .login'
          );
          if (userExec?.stdout?.trim()) {
            ghUser = userExec.stdout.trim().split('\n')[0];
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar usuário do Git/GitHub:', err);
      }

      try {
        const nameRes = await window.electronAPI?.shell?.exec('git config user.name');
        gitName = (nameRes?.stdout || '').trim();
      } catch {}
      const authorNames = [ghUser, gitName].map((n) => n.toLowerCase()).filter(Boolean);
      const isMine = (author?: string) => {
        const a = (author || '').toLowerCase();
        return authorNames.some((n) => a.includes(n) || n.includes(a));
      };
      if (!ghUser) ghUser = gitName || 'usuario';

      // 2. Determina diretórios candidatos para busca de commits
      const targetFilteredProj = selectedProjectFilter !== 'all'
        ? availableProjects?.find((p) => p.name?.toLowerCase() === selectedProjectFilter.toLowerCase() || p.fullName?.toLowerCase() === selectedProjectFilter.toLowerCase())
        : null;

      const specificRepoPath = targetFilteredProj
        ? (targetFilteredProj.localDir || targetFilteredProj.path)
        : undefined;

      const fallbackCwd =
        specificRepoPath ||
        activeProject?.localDir ||
        activeProject?.path ||
        workspacePath;

      // 3. Coleta os commits do Git do período de referência (ontem ou sexta-feira)
      let commitList: Array<{
        hash: string;
        message: string;
        body?: string;
        author: string;
        date: string;
        relativeDate?: string;
        projectName: string;
      }> = [];

      try {
        if (window.electronAPI?.git?.getRecentCommitsSummary) {
          // Busca primeiro no diretório do projeto alvo (ou em todos os repositórios locais se 'all')
          const summaries = await window.electronAPI.git.getRecentCommitsSummary({
            targetDates: targetDatesIso,
            repoPath: specificRepoPath,
          });

          if (Array.isArray(summaries) && summaries.length > 0) {
            for (const s of summaries) {
              for (const c of s.commits || []) {
                commitList.push({
                  ...c,
                  projectName: s.projectName,
                });
              }
            }
          }

          // Se não encontrou no projeto específico, faz varredura ampla em todos os repositórios locais
          if (commitList.length === 0 && specificRepoPath) {
            const allSummaries = await window.electronAPI.git.getRecentCommitsSummary({
              targetDates: targetDatesIso,
            });
            if (Array.isArray(allSummaries)) {
              for (const s of allSummaries) {
                for (const c of s.commits || []) {
                  commitList.push({
                    ...c,
                    projectName: s.projectName,
                  });
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Erro ao consultar getRecentCommitsSummary:', err);
      }

      // Fallback via shell exec se o IPC não retornou nada
      if (commitList.length === 0 && window.electronAPI?.shell?.exec) {
        try {
          const candidateDirs = [
            specificRepoPath,
            fallbackCwd,
            '/Users/walancy/Documents/codes/Ainaobra/ainaobra',
            '/Users/walancy/Documents/codes/Ainaobra/ainaobra-api-esocial',
            '/Users/walancy/Documents/codes/devflow-desktop',
            '/Users/walancy/Documents/codes/estancia bahia/estancia-bahia-painel-interno',
            '/Users/walancy/Documents/codes/estancia bahia/estancia-bahia-api',
          ].filter((d): d is string => Boolean(d));

          const sortedDates = [...targetDatesIso].sort();
          const sinceArg = `${sortedDates[0]} 00:00:00`;
          const untilArg = `${sortedDates[sortedDates.length - 1]} 23:59:59`;

          for (const d of candidateDirs) {
            const cmd = `git -C "${d}" log --since="${sinceArg}" --until="${untilArg}" --format="COMMIT_START%x1f%h%x1f%s%x1f%b%x1f%an%x1f%aiCOMMIT_END" -n 35 2>/dev/null`;
            const res = await window.electronAPI.shell.exec(cmd);
            if (res?.stdout?.includes('COMMIT_START')) {
              const chunks = res.stdout.split('COMMIT_END').filter((c: string) => c.includes('COMMIT_START'));
              const pName = d.split('/').pop() || 'Projeto';
              for (const chunk of chunks) {
                const clean = chunk.replace(/[\s\S]*COMMIT_START\x1f/, '');
                const [hash, message, body, author, date] = clean.split('\x1f');
                if (hash && message) {
                  commitList.push({
                    hash: hash.trim(),
                    message: message.trim(),
                    body: body?.trim(),
                    author: author?.trim() || ghUser,
                    date: date?.trim() || '',
                    projectName: pName,
                  });
                }
              }
            }
          }
        } catch (e) {
          console.warn('Falha no fallback de git log via shell:', e);
        }
      }

      // Filtra prioritariamente commits feitos pelo usuário desenvolvedor
      const userCommits = commitList.filter((c) => isMine(c.author));
      const effectiveCommits = userCommits.length > 0 ? userCommits : commitList;

      // Se nenhum commit foi encontrado para a data exata, busca os mais recentes (últimos 7 dias)
      let finalCommitsToAnalyze = effectiveCommits;

      if (finalCommitsToAnalyze.length === 0 && window.electronAPI?.git?.getRecentCommitsSummary) {
        try {
          const recentSummaries = await window.electronAPI.git.getRecentCommitsSummary({
            days: 7,
            repoPath: specificRepoPath,
          });
          if (Array.isArray(recentSummaries)) {
            const recentFound: typeof commitList = [];
            for (const s of recentSummaries) {
              for (const c of s.commits || []) {
                recentFound.push({ ...c, projectName: s.projectName });
              }
            }
            if (recentFound.length > 0) {
              const recentUser = recentFound.filter((c) => isMine(c.author));
              finalCommitsToAnalyze = recentUser.length > 0 ? recentUser : recentFound;
            }
          }
        } catch {}
      }

      // 4. Coleta itens que JÁ EXISTEM nesta coluna (e na Daily) para análise rigorosa de anti-duplicação
      const existingInThisCol =
        colCategory === 'yesterday'
          ? yesterdayItems
          : colCategory === 'blocker'
          ? blockerItems
          : todayItems;

      const existingFormatted =
        existingInThisCol.length > 0
          ? existingInThisCol
              .map(
                (it, idx) =>
                  `${idx + 1}. [Projeto: ${it.projectName || 'Geral'}] "${it.title}" - ${it.description || 'Sem descrição'} (Tag: ${it.tag || 'Geral'})`
              )
              .join('\n')
          : '(Nenhum card registrado nesta coluna até o momento)';

      const primaryProject =
        finalCommitsToAnalyze[0]?.projectName ||
        targetFilteredProj?.name ||
        activeProject?.name ||
        repoName ||
        'Geral';

      const hasCommits = finalCommitsToAnalyze.length > 0;

      // Arquivos tocados por commit (contexto extra para a IA descrever o que mudou de fato)
      const analyzed = finalCommitsToAnalyze.slice(0, 30);
      const filesByHash = new Map<string, string>();
      const fileCountByHash = new Map<string, number>();
      const filePathsByHash = new Map<string, string[]>();
      if (window.electronAPI?.shell?.exec) {
        await Promise.all(
          analyzed.map(async (c) => {
            const proj: any = availableProjects?.find((p) => p.name?.toLowerCase() === c.projectName?.toLowerCase());
            const dir = proj?.localDir || proj?.path || fallbackCwd;
            if (!dir) return;
            try {
              const res = await window.electronAPI.shell.exec(`git -C "${dir}" show --numstat --format= ${c.hash}`);
              const rows = (res?.stdout || '').trim().split('\n').filter(Boolean).map((l: string) => l.split('\t'));
              if (rows.length) {
                fileCountByHash.set(c.hash, rows.length);
                filePathsByHash.set(c.hash, rows.map((r: string[]) => r[2]));
                filesByHash.set(
                  c.hash,
                  rows.slice(0, 25).map((r: string[]) => `${r[2]} (+${r[0]} -${r[1]})`).join(', ') + (rows.length > 25 ? ` … e mais ${rows.length - 25} arquivos` : '')
                );
              }
            } catch {}
          })
        );
      }

      // Trabalho ainda não commitado entra como material da coluna "Planejado Hoje" (o que está em andamento)
      let workingTree = '';
      if (colCategory === 'today' && fallbackCwd && window.electronAPI?.shell?.exec) {
        try {
          const wt = await window.electronAPI.shell.exec('git status --short | head -30', fallbackCwd);
          workingTree = (wt?.stdout || '').trim();
        } catch {}
      }

      // Limite proporcional ao volume real: commits e arquivos tocados (sem teto fixo de 4)
      const totalFiles = Array.from(fileCountByHash.values()).reduce((a, b) => a + b, 0);
      const maxCards = Math.min(10, Math.max(3, Math.ceil(finalCommitsToAnalyze.length / 2), Math.ceil(totalFiles / 4)));
      const minCards = Math.min(maxCards, hasCommits ? Math.max(2, Math.min(5, Math.ceil(totalFiles / 6) || 2)) : 1);

      const commitsFormatted = hasCommits
        ? analyzed
            .map((c) => {
              const body = c.body ? `\n    Contexto: ${c.body.slice(0, 600).replace(/\r?\n/g, ' ')}` : '';
              const files = filesByHash.get(c.hash) ? `\n    Arquivos (${fileCountByHash.get(c.hash)}): ${filesByHash.get(c.hash)}` : '';
              return `- [${c.projectName}] ${c.hash.slice(0, 7)} "${c.message}"${body}${files}`;
            })
            .join('\n')
        : `Nenhum commit encontrado no período. Sugira atividades plausíveis e específicas para "${colLabel}" no projeto "${primaryProject}".`;

      const colGuidelines =
        colCategory === 'yesterday'
          ? `O que foi ENTREGUE ${refDayName}. Passado, foco no resultado para o usuário/produto. Ex.: "Ajustei o fluxo de cadastro para validar o CPF antes de enviar".`
          : colCategory === 'blocker'
          ? `O que está BLOQUEANDO o andamento e o que falta para destravar. Ex.: "Aguardando retorno da API de pagamentos para finalizar a conciliação".`
          : `O PRÓXIMO PASSO concreto de hoje, em continuidade ao que já foi feito. Futuro, objetivo. Ex.: "Finalizar a tela de relatórios e validar com dados reais".`;

      const hintBlock = aiHint.trim() ? `\nINSTRUÇÃO EXTRA DO USUÁRIO (siga com prioridade): ${aiHint.trim()}\n` : '';

      const prompt = `Você escreve os cards da Daily Scrum de @${ghUser}, como se o próprio desenvolvedor estivesse contando ao time.

COLUNA: "${colLabel}" (Daily de ${selectedDateIso})
${colGuidelines}
${hintBlock}
MATERIAL (commits reais, use só para entender o que foi feito):
${commitsFormatted}

${workingTree ? `TRABALHO EM ANDAMENTO (alterações ainda não commitadas):\n${workingTree}\n\n` : ''}CARDS JÁ EXISTENTES NESTA COLUNA (não repita):
${existingFormatted}

COMO ESCREVER:
1. Analise TODO o material e quebre o trabalho em entregas distintas: gere ENTRE ${minCards} E ${maxCards} cards. Um único commit grande quase sempre contém várias entregas (telas, endpoints, correções, ajustes de layout, integrações): use o corpo do commit e as pastas/arquivos tocados para separá-las em cards diferentes. NUNCA resuma tudo em um card só. Só agrupe commits que sejam realmente a mesma entrega.
2. Título: curto (até ~60 caracteres), em português natural, começando por verbo ou pelo assunto. Ex. bom: "Fluxo de login com 2 etapas". Ex. ruim: "feat(auth): add login".
3. Descrição: 1 ou 2 frases, primeira pessoa, dizendo o que mudou e para quê (resultado), não como foi implementado.
4. PROIBIDO no título e na descrição: hash de commit, número de issue/PR (#123), as palavras "commit", "issue", "PR", prefixos feat/fix/chore, nomes de arquivos e frases genéricas como "Gerado via IA" ou "Continuidade".
5. Tag: "Feature" | "Fix" | "Design" | "Refactor" | "Impedimento" | "Planejado".
6. "projectName" deve ser exatamente o projeto entre colchetes dos commits do card; "commitHashes" com os hashes (7 chars) que ele resume.

RETORNE SOMENTE JSON VÁLIDO (sem markdown):
{"tasks":[{"title":"...","description":"...","tag":"Feature","priority":"Alta","projectName":"${primaryProject}","commitHashes":[]}]}`;

      // 5. Executa a IA conectada
      const cliCmd = (() => {
        const p = (selectedAiProvider || '').toLowerCase();
        if (p.includes('codex')) return 'codex';
        if (p.includes('antigravity') || p.includes('agy')) return 'agy';
        if (p.includes('gemini')) return 'gemini';
        return 'claude';
      })();

      onToast?.(`⚡ Gerando cards para "${colLabel}" via IA (${selectedAiProvider || 'IA'})...`);

      let aiRawOutput = '';

      // Tenta primeiro via ai.runCli (execução limpa e rápida do CLI)
      if (window.electronAPI?.ai?.runCli) {
        try {
          // Timeout para o spinner nunca ficar preso se a CLI travar
          const cliResult = await Promise.race([
            window.electronAPI.ai.runCli({ cliCmd, prompt, model: selectedModel, cwd: fallbackCwd || undefined }),
            new Promise<null>((resolve) => setTimeout(() => resolve(null), 150000)),
          ]);
          if (!cliResult) {
            window.electronAPI.ai.cancel?.();
            onToast?.('A IA demorou demais para responder. Usando resumo dos commits.');
          }
          if (cliResult?.stdout && cliResult.exitCode === 0) {
            aiRawOutput = cliResult.stdout.trim();
          }
        } catch (cliErr) {
          console.warn('[handleGenerateColumnTasksWithAi] Falha ao rodar CLI:', cliErr);
        }
      }

      // Fallback para ai.prompt
      if (!aiRawOutput && window.electronAPI?.ai?.prompt) {
        try {
          const promptRes = await window.electronAPI.ai.prompt(
            prompt,
            selectedModel || 'claude-headless',
            fallbackCwd || undefined,
            cliCmd,
            60000
          );
          if (promptRes?.response) aiRawOutput = promptRes.response.trim();
        } catch (promptErr) {
          console.warn('[handleGenerateColumnTasksWithAi] Falha no ai.prompt:', promptErr);
        }
      }

      // 6. Faz o parse do JSON da IA com resiliência total a markdown e formatações
      let parsedTasks: any[] = [];
      if (aiRawOutput) {
        try {
          let cleaned = aiRawOutput.trim();
          // Remove código markdown (```json ... ``` ou ``` ... ```)
          const codeBlockMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
          if (codeBlockMatch) {
            cleaned = codeBlockMatch[1].trim();
          }

          // Tenta parse direto
          try {
            const parsed = JSON.parse(cleaned);
            if (Array.isArray(parsed)) parsedTasks = parsed;
            else if (Array.isArray(parsed.tasks)) parsedTasks = parsed.tasks;
            else if (Array.isArray(parsed.items)) parsedTasks = parsed.items;
          } catch {
            // Extrai objeto { "tasks": [...] }
            const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              const parsed = JSON.parse(jsonMatch[0]);
              if (Array.isArray(parsed.tasks)) parsedTasks = parsed.tasks;
              else if (Array.isArray(parsed.items)) parsedTasks = parsed.items;
              else if (Array.isArray(parsed)) parsedTasks = parsed;
            } else {
              const arrayMatch = cleaned.match(/\[[\s\S]*\]/);
              if (arrayMatch) {
                parsedTasks = JSON.parse(arrayMatch[0]);
              }
            }
          }
        } catch (parseError) {
          console.warn('Erro ao processar JSON retornado pela IA:', parseError, aiRawOutput);
        }
      }

      const defaultTag = colCategory === 'yesterday' ? 'Feature' : colCategory === 'blocker' ? 'Impedimento' : 'Planejado';
      const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
      const cleanSubject = (m: string) =>
        cap(m.replace(/^(feat|fix|chore|docs|refactor|test|style|perf)(\([^)]*\))?!?:\s*/i, '').trim());

      // Fallback sem IA: um card por projeto + escopo; se sobrar poucos, quebra por área dos arquivos tocados
      if (parsedTasks.length === 0 && hasCommits) {
        const groups = new Map<string, typeof finalCommitsToAnalyze>();
        for (const c of finalCommitsToAnalyze) {
          const scope = c.message.match(/^\w+\(([^)]+)\)/)?.[1] || '';
          const key = `${c.projectName}|${scope}`;
          groups.set(key, [...(groups.get(key) || []), c]);
        }
        parsedTasks = Array.from(groups.values()).slice(0, maxCards).map((g) => {
          const subjects = g.map((c) => cleanSubject(c.message));
          return {
            title: subjects[0],
            description: subjects.slice(1, 3).length ? `${subjects[0]}; ${subjects.slice(1, 3).join('; ').toLowerCase()}.` : `${subjects[0]}.`,
            tag: g.some((c) => /^fix/i.test(c.message)) ? 'Fix' : defaultTag,
            priority: 'Alta',
            projectName: g[0].projectName,
            commitHashes: g.map((c) => c.hash.slice(0, 7)),
          };
        });

        if (parsedTasks.length < minCards) {
          const areas = new Map<string, { project: string; hash: string; subject: string; count: number }>();
          for (const c of finalCommitsToAnalyze) {
            for (const f of filePathsByHash.get(c.hash) || []) {
              const dir = f.split('/').slice(0, -1).slice(-2).join('/') || f;
              const key = `${c.projectName}|${dir}`;
              const cur = areas.get(key);
              areas.set(key, { project: c.projectName, hash: c.hash.slice(0, 7), subject: cleanSubject(c.message), count: (cur?.count || 0) + 1 });
            }
          }
          const byArea = Array.from(areas.entries())
            .sort((x, y) => y[1].count - x[1].count)
            .slice(0, maxCards)
            .map(([key, v]) => ({
              title: `Ajustes em ${key.split('|')[1]}`,
              description: `${v.subject} — ${v.count} ${v.count === 1 ? 'arquivo alterado' : 'arquivos alterados'} nesta área.`,
              tag: defaultTag,
              priority: 'Alta',
              projectName: v.project,
              commitHashes: [v.hash],
            }));
          if (byArea.length > parsedTasks.length) parsedTasks = byArea;
        }
      }

      // 7. Filtro anti-duplicação refinado (sem falso-positivo de substring em títulos curtos)
      const finalTasks = parsedTasks.filter((task: any) => {
        if (!task || !task.title) return false;
        const normTitle = task.title.toLowerCase().trim();
        const isDuplicate = existingInThisCol.some((ex) => {
          const normEx = ex.title.toLowerCase().trim();
          if (normEx === normTitle) return true;
          if (normEx.length > 25 && normTitle.length > 25 && (normEx.includes(normTitle) || normTitle.includes(normEx))) {
            return true;
          }
          if (Array.isArray(task.commitHashes) && task.commitHashes.length > 0) {
            for (const h of task.commitHashes) {
              if (h && (normEx.includes(h.toLowerCase()) || (ex.description && ex.description.toLowerCase().includes(h.toLowerCase())))) {
                return true;
              }
            }
          }
          return false;
        });
        return !isDuplicate;
      });

      if (finalTasks.length === 0) {
        onToast?.(`Nada novo para "${colLabel}": os cards existentes já cobrem o período.`);
        return;
      }
      const tasksToCreate = finalTasks.slice(0, maxCards);

      // Remove vazamentos de commit/issue que o modelo possa ter deixado no texto
      const sanitize = (t: string) =>
        (t || '')
          .replace(/\b[0-9a-f]{7,40}\b/g, '')
          .replace(/\(?#\d+\)?/g, '')
          .replace(/^(feat|fix|chore|docs|refactor|test)(\([^)]*\))?:\s*/i, '')
          .replace(/\s{2,}/g, ' ')
          .trim();

      // 8. Cria os novos itens da Daily associados à data atual da Daily (selectedDateIso)
      const defaultCardTheme: CardPalette =
        colCategory === 'yesterday' ? 'cyan' : colCategory === 'blocker' ? 'charcoal' : 'peach';

      const newItems: DailyItem[] = tasksToCreate.map((t: any) => {
        // Projeto do card = projeto dos commits que ele resume (evita atribuir ao projeto do 1º commit)
        const hashProj = Array.isArray(t.commitHashes)
          ? finalCommitsToAnalyze.find((c) => t.commitHashes.some((h: string) => h && c.hash.startsWith(String(h).slice(0, 7))))?.projectName
          : undefined;
        const projName = hashProj || t.projectName || primaryProject;
        const matchedProj = availableProjects?.find(
          (p) => p.name?.toLowerCase() === projName.toLowerCase() || p.fullName?.toLowerCase() === projName.toLowerCase() || p.id === projName
        );

        return {
          id: `daily-ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          dateIso: selectedDateIso, // SEMPRE a data ativa da Daily para renderizar imediatamente na coluna!
          category: colCategory,
          title: sanitize(t.title),
          description: sanitize(t.description),
          projectName: matchedProj?.name || projName,
          projectId: matchedProj?.id || projName,
          projectColor: matchedProj?.color,
          tag: t.tag || defaultTag,
          priority: (t.priority as any) || 'Alta',
          completed: colCategory === 'yesterday',
          cardTheme: defaultCardTheme,
          customColor: CARD_THEMES[defaultCardTheme]?.accent || '#f97316',
          assignee: { name: ghUser, initials: ghUser.slice(0, 2).toUpperCase(), avatarUrl: `https://github.com/${ghUser}.png` },
          createdAt: new Date().toISOString(),
        };
      });

      setItems((prev) => [...newItems, ...prev]);
      setPendingAiIds((prev) => ({ ...prev, [colCategory]: [...(prev[colCategory] || []), ...newItems.map((i) => i.id)] }));
      onToast?.(`✨ ${newItems.length} ${newItems.length === 1 ? 'tarefa criada' : 'tarefas criadas'} na coluna "${colLabel}"!`);
    } catch (globalErr: any) {
      console.error('Erro ao gerar tarefas via IA para a coluna:', globalErr);
      onToast?.(`Erro ao gerar tarefas: ${globalErr?.message || 'Falha inesperada'}`);
    } finally {
      setGeneratingAiColumn(null);
    }
  };

  const renderAiReview = (col: 'yesterday' | 'blocker' | 'today') => {
    const ids = pendingAiIds[col] || [];
    if (ids.length === 0) return null;
    const clear = () => setPendingAiIds((prev) => ({ ...prev, [col]: [] }));
    const btn = (color: string, hover: string): React.CSSProperties => ({
      width: 24, height: 24, borderRadius: 6, border: 'none', background: 'transparent', color,
      display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s ease',
    });
    return (
      <>
        <button
          type="button"
          title={`Aceitar ${ids.length} ${ids.length === 1 ? 'card gerado' : 'cards gerados'} pela IA`}
          onClick={() => { clear(); onToast?.('Cards da IA mantidos'); }}
          style={btn('#22c55e', 'rgba(34, 197, 94, 0.15)')}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(34, 197, 94, 0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <Check size={14} strokeWidth={2.5} />
        </button>
        <button
          type="button"
          title={`Recusar e excluir ${ids.length === 1 ? 'o card gerado' : `os ${ids.length} cards gerados`} pela IA`}
          onClick={() => {
            setItems((prev) => prev.filter((i) => !ids.includes(i.id)));
            clear();
            onToast?.('Cards da IA descartados');
          }}
          style={btn('#ef4444', 'rgba(239, 68, 68, 0.15)')}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)'; }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
        >
          <X size={14} strokeWidth={2.5} />
        </button>
      </>
    );
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

  // Preferência por projeto (Configurações → Geral → Sugestões de IA na Daily)
  const dailyAiEnabled = useMemo(() => {
    let full = repoName && repoName.includes('/') ? repoName : null;
    if (!full) {
      try {
        full = localStorage.getItem('header_active_project_fullname');
      } catch {}
    }
    return getProjectSettings(full).prefs.dailyAi;
  }, [repoName]);

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
            height: '100%',
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
            overflow: 'hidden',
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
            {/* CHAT IA PARA DAILY & WEEKLY (PREENCHE TODO O ESPAÇO VERTICAL)      */}
            {/* ------------------------------------------------------------------- */}
            {dailyAiEnabled ? (
            <DailyAiChatPanel
              selectedDate={selectedDate}
              selectedDateIso={selectedDateIso}
              workspacePath={workspacePath}
              repoName={repoName}
              themeTokens={theme}
              isEffectiveDark={isEffectiveDark}
              accentColor={accentColor}
              currentDailyItems={items}
              weeklyGoals={weeklyGoals}
              onAddDailyItem={(itemDraft) => {
                const newItem: DailyItem = {
                  id: `daily-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  category: (itemDraft.category as any) || 'today',
                  title: itemDraft.title || 'Nova tarefa sugerida',
                  description: itemDraft.description || '',
                  dateIso: itemDraft.dateIso || selectedDateIso,
                  tag: itemDraft.tag || 'Daily IA',
                  priority: itemDraft.priority || 'Média',
                  completed: itemDraft.category === 'yesterday',
                  blockerSeverity: itemDraft.category === 'blocker' ? 'Alto' : undefined,
                  blockerStatus: itemDraft.category === 'blocker' ? 'Bloqueando' : undefined,
                  projectId: itemDraft.projectName || repoName,
                  projectName: itemDraft.projectName || repoName,
                  cardTheme:
                    itemDraft.category === 'yesterday'
                      ? 'emerald'
                      : itemDraft.category === 'blocker'
                      ? 'rose'
                      : 'peach',
                  assignee: { name: 'Walancy', initials: 'WA', avatarUrl: 'https://github.com/Walancy.png' },
                  createdAt: new Date().toISOString(),
                };
                setItems((prev) => [newItem, ...prev]);
                onToast?.(`Item adicionado: ${newItem.title}`);
              }}
              onAddWeeklyGoal={(goalDraft) => {
                const newGoal: WeeklyGoal = {
                  id: `goal-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                  title: goalDraft.title || 'Nova meta semanal',
                  weekStartIso: currentWeekStartIso,
                  completed: false,
                  priority: goalDraft.priority || 'Alta',
                  owner: 'Walancy',
                };
                setWeeklyGoals((prev) => [...prev, newGoal]);
                onToast?.(`Demanda adicionada à Weekly: ${newGoal.title}`);
              }}
              selectedAiProvider={selectedAiProvider}
              selectedModel={selectedModel}
              activeModels={activeModels}
              onSelectAiProvider={onSelectAiProvider}
              onSelectModel={onSelectModel}
              onToast={onToast}
            />
            ) : (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 24, fontSize: 12, color: theme?.textSecondary || '#888', borderRadius: 10, background: isEffectiveDark ? '#141414' : '#f8fafc' }}>
                Sugestões de IA desativadas para este projeto em Projetos → Configurações → Geral.
              </div>
            )}
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
            <input
              value={aiHint}
              onChange={(e) => {
                setAiHint(e.target.value);
                try { localStorage.setItem('daily_ai_hint', e.target.value); } catch {}
              }}
              placeholder="Instrução opcional para a IA ao gerar cards (ex.: mais curto, tom para cliente, foco em backend)"
              style={{
                height: 28,
                padding: '0 10px',
                borderRadius: 8,
                border: theme.shelfBorder,
                background: theme.bgShelf,
                color: theme?.textPrimary,
                fontSize: 12,
                outline: 'none',
                boxSizing: 'border-box',
                flexShrink: 0,
              }}
            />

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

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {renderAiReview('yesterday')}
                    {/* 1. Lixeira para limpar toda a coluna */}
                    <button
                      type="button"
                      onClick={() => setColumnToClear('yesterday')}
                      disabled={yesterdayItems.length === 0}
                      title={`Limpar todos os registros da coluna "${isSelectedMonday ? 'Sexta-feira' : 'Dia Anterior'}"`}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: yesterdayItems.length === 0 ? (isEffectiveDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: yesterdayItems.length === 0 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (yesterdayItems.length > 0) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <Trash2 size={13} />
                    </button>

                    {/* 2. Gerar tarefas com IA via histórico de commits */}
                    <button
                      type="button"
                      onClick={() => handleGenerateColumnTasksWithAi('yesterday')}
                      disabled={generatingAiColumn === 'yesterday'}
                      title={`Gerar tarefas com IA (${selectedAiProvider || 'IA'}) a partir dos seus commits de ${isSelectedMonday ? 'sexta-feira' : 'ontem'}`}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: accentColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: generatingAiColumn === 'yesterday' ? 'wait' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (generatingAiColumn !== 'yesterday') {
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      {generatingAiColumn === 'yesterday' ? (
                        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Sparkles size={13} />
                      )}
                    </button>

                    {/* 3. Adicionar registro manualmente */}
                    <button
                      type="button"
                      onClick={() => handleStartCreate('yesterday')}
                      title="Adicionar registro"
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: 'none',
                        background: accentColor,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.9';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Lista de Cards da Coluna 1 */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '2px 4px 6px 2px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: isEffectiveDark ? 'rgba(255, 255, 255, 0.2) transparent' : 'rgba(0, 0, 0, 0.2) transparent',
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
                          isPendingAi={Object.values(pendingAiIds).some((ids) => ids.includes(item.id))}
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {renderAiReview('blocker')}
                    {/* 1. Lixeira para limpar toda a coluna */}
                    <button
                      type="button"
                      onClick={() => setColumnToClear('blocker')}
                      disabled={blockerItems.length === 0}
                      title="Limpar todos os registros da coluna 'Impedimentos'"
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: blockerItems.length === 0 ? (isEffectiveDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: blockerItems.length === 0 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (blockerItems.length > 0) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <Trash2 size={13} />
                    </button>

                    {/* 2. Identificar impedimentos com IA via commits recentes */}
                    <button
                      type="button"
                      onClick={() => handleGenerateColumnTasksWithAi('blocker')}
                      disabled={generatingAiColumn === 'blocker'}
                      title={`Identificar impedimentos com IA (${selectedAiProvider || 'IA'}) com base nos seus commits de ${isSelectedMonday ? 'sexta-feira' : 'ontem'}`}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: accentColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: generatingAiColumn === 'blocker' ? 'wait' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (generatingAiColumn !== 'blocker') {
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      {generatingAiColumn === 'blocker' ? (
                        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Sparkles size={13} />
                      )}
                    </button>

                    {/* 3. Adicionar registro manualmente */}
                    <button
                      type="button"
                      onClick={() => handleStartCreate('blocker')}
                      title="Adicionar registro"
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: 'none',
                        background: accentColor,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.9';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Lista de Cards da Coluna 2 */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '2px 4px 6px 2px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: isEffectiveDark ? 'rgba(255, 255, 255, 0.2) transparent' : 'rgba(0, 0, 0, 0.2) transparent',
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
                          isPendingAi={Object.values(pendingAiIds).some((ids) => ids.includes(item.id))}
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

                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    {renderAiReview('today')}
                    {/* 1. Lixeira para limpar toda a coluna */}
                    <button
                      type="button"
                      onClick={() => setColumnToClear('today')}
                      disabled={todayItems.length === 0}
                      title="Limpar todos os registros da coluna 'Planejado Hoje'"
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: todayItems.length === 0 ? (isEffectiveDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)') : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: todayItems.length === 0 ? 'not-allowed' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (todayItems.length > 0) e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                      }}
                    >
                      <Trash2 size={13} />
                    </button>

                    {/* 2. Planejar tarefas de hoje com IA via commits */}
                    <button
                      type="button"
                      onClick={() => handleGenerateColumnTasksWithAi('today')}
                      disabled={generatingAiColumn === 'today'}
                      title={`Planejar tarefas de hoje com IA (${selectedAiProvider || 'IA'}) com base nos seus commits de ${isSelectedMonday ? 'sexta-feira' : 'ontem'}`}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: 'none',
                        background: 'transparent',
                        color: accentColor,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: generatingAiColumn === 'today' ? 'wait' : 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (generatingAiColumn !== 'today') {
                          e.currentTarget.style.transform = 'scale(1.1)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      {generatingAiColumn === 'today' ? (
                        <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} />
                      ) : (
                        <Sparkles size={13} />
                      )}
                    </button>

                    {/* 3. Adicionar registro manualmente */}
                    <button
                      type="button"
                      onClick={() => handleStartCreate('today')}
                      title="Adicionar registro"
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        border: 'none',
                        background: accentColor,
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.opacity = '0.9';
                        e.currentTarget.style.transform = 'scale(1.05)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.opacity = '1';
                        e.currentTarget.style.transform = 'none';
                      }}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* Lista de Cards da Coluna 3 */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '2px 4px 6px 2px',
                    scrollbarWidth: 'thin',
                    scrollbarColor: isEffectiveDark ? 'rgba(255, 255, 255, 0.2) transparent' : 'rgba(0, 0, 0, 0.2) transparent',
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
                          isPendingAi={Object.values(pendingAiIds).some((ids) => ids.includes(item.id))}
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
      {/* 5. MODAIS DE CONFIRMAÇÃO DE EXCLUSÃO (REGRA OBRIGATÓRIA DO AGENTS.MD)     */}
      {/* ========================================================================= */}
      {/* Modal para excluir um item específico */}
      <ConfirmDeleteModal
        isOpen={Boolean(itemToDelete)}
        title="Excluir Registro da Daily"
        message={`Tem certeza que deseja excluir o registro "${itemToDelete?.title}"?`}
        itemDescription="Esta ação não poderá ser desfeita e removerá o item do histórico desta daily."
        confirmLabel="Excluir Registro"
        cancelLabel="Cancelar"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDeleteItem}
        onClose={() => setItemToDelete(null)}
      />

      {/* Modal para limpar todos os registros de uma coluna */}
      <ConfirmDeleteModal
        isOpen={Boolean(columnToClear)}
        title={
          columnToClear === 'yesterday'
            ? `Limpar Coluna "${isSelectedMonday ? 'Sexta-feira' : 'Dia Anterior'}"`
            : columnToClear === 'blocker'
            ? 'Limpar Coluna "Impedimentos"'
            : 'Limpar Coluna "Planejado Hoje"'
        }
        message={
          columnToClear === 'yesterday'
            ? `Tem certeza que deseja excluir todos os ${yesterdayItems.length} registros da coluna "${isSelectedMonday ? 'Sexta-feira' : 'Dia Anterior'}"?`
            : columnToClear === 'blocker'
            ? `Tem certeza que deseja excluir todos os ${blockerItems.length} registros da coluna "Impedimentos"?`
            : `Tem certeza que deseja excluir todos os ${todayItems.length} registros da coluna "Planejado Hoje"?`
        }
        itemDescription="Esta ação não poderá ser desfeita. Todos os cards desta coluna nesta data serão removidos permanentemente."
        confirmLabel="Limpar Coluna"
        cancelLabel="Cancelar"
        isDeleting={isClearingColumn}
        onConfirm={handleConfirmClearColumn}
        onClose={() => {
          if (!isClearingColumn) setColumnToClear(null);
        }}
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
        flexShrink: 0,
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
  isPendingAi?: boolean;
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
  isPendingAi,
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
        flexShrink: 0,
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
        // Cards gerados pela IA aguardando aceite/recusa: mais claros no dark e mais escuros no light
        filter: isPendingAi ? `brightness(${isEffectiveDark ? 1.3 : 0.82})` : undefined,
        position: 'relative',
        overflow: isMenuOpen ? 'visible' : 'hidden',
        zIndex: isMenuOpen ? 100 : 1,
      }}
    >
      {/* DIV COM PONTINHOS NA ESQUERDA (DRAG HANDLE PARA ARRASTAR DE CIMA PRA BAIXO) */}
      <div
        title="Arraste para organizar de cima para baixo"
        style={{
          width: 24,
          borderTopLeftRadius: 12,
          borderBottomLeftRadius: 12,
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
                border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.15)' : '1px solid rgba(0, 0, 0, 0.12)',
                borderRadius: 8,
                boxShadow: isEffectiveDark ? '0 12px 32px rgba(0,0,0,0.65)' : '0 8px 24px rgba(0,0,0,0.18)',
                padding: 4,
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minWidth: 155,
                zIndex: 9999,
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flexWrap: 'nowrap', flex: '1 1 auto' }}>
          {item.projectName && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '0 8px',
                height: 20,
                boxSizing: 'border-box',
                borderRadius: 6,
                background: 'rgba(0, 0, 0, 0.22)',
                color: '#ffffff',
                fontSize: 10.5,
                fontWeight: 400,
                whiteSpace: 'nowrap',
                minWidth: 0,
              }}
              title={`Projeto: ${item.projectName}\nRepositório ao qual este card pertence`}
            >
              <Folder size={11} color="rgba(255, 255, 255, 0.9)" style={{ flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.projectName}</span>
            </div>
          )}

          {item.tag && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                padding: '0 8px',
                height: 20,
                boxSizing: 'border-box',
                borderRadius: 6,
                background: 'rgba(0, 0, 0, 0.22)',
                color: '#ffffff',
                fontSize: 10.5,
                fontWeight: 400,
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
              title={`Categoria: ${item.tag}\nTipo de trabalho (Feature, Fix, Design, Refactor, Impedimento ou Planejado)`}
            >
              <Tag size={10} color="rgba(255, 255, 255, 0.9)" />
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
                padding: '0 7px',
                height: 20,
                boxSizing: 'border-box',
                borderRadius: 6,
                background: 'rgba(0, 0, 0, 0.28)',
                color: '#86efac',
                fontSize: 10,
                fontWeight: 400,
              }}
              title={item.isFromPreviousDayPlanned ? 'Concluído\nTarefa planejada que foi finalizada no dia anterior' : 'Concluído\nEsta atividade já foi finalizada'}
            >
              <Check size={10} strokeWidth={2.5} />
            </div>
          )}

          {/* Tag de Bloqueio */}
          {isBlocker && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 3,
                padding: '0 7px',
                height: 20,
                boxSizing: 'border-box',
                borderRadius: 6,
                background: isResolved ? 'rgba(0, 0, 0, 0.28)' : 'rgba(239, 68, 68, 0.45)',
                color: isResolved ? '#86efac' : '#ffffff',
                fontSize: 10,
                fontWeight: 400,
              }}
              title={isResolved ? 'Resolvido\nO impedimento foi destravado' : `Bloqueio${item.blockerSeverity ? ` (${item.blockerSeverity})` : ''}\nImpedimento que está travando o andamento`}
            >
              <AlertCircle size={10} />
            </div>
          )}

          {/* Tag de Prioridade: Alta / Média / Baixa */}
          {item.priority && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '0 7px',
                height: 20,
                boxSizing: 'border-box',
                borderRadius: 6,
                background: 'rgba(0, 0, 0, 0.22)',
              }}
              title={`Prioridade: ${item.priority}\nUrgência desta atividade (vermelho = Alta, amarelo = Média, azul = Baixa)`}
            >
              <Flag
                size={10}
                color={item.priority === 'Alta' ? '#fca5a5' : item.priority === 'Média' ? '#fde68a' : '#bfdbfe'}
                fill={item.priority === 'Alta' ? '#fca5a5' : item.priority === 'Média' ? '#fde68a' : '#bfdbfe'}
              />
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
              minHeight: 0,
              overflowY: 'auto',
              overflowX: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
              padding: '2px 4px 6px 2px',
              scrollbarWidth: 'thin',
              scrollbarColor: isEffectiveDark ? 'rgba(255, 255, 255, 0.2) transparent' : 'rgba(0, 0, 0, 0.2) transparent',
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
                    flexShrink: 0,
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
