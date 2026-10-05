import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Milestone,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Users,
  Sparkles,
  Plus,
  Search,
  Trash2,
  Edit2,
  GitBranch,
  Tag,
  FileText,
  CheckSquare,
  Layers,
  ChevronRight,
  ArrowUpDown,
  Check,
  X,
  ExternalLink,
  RefreshCw,
  BarChart2,
  Filter,
  Flag,
  CircleDot,
  CheckCircle,
  Clock3,
  Copy,
  ListChecks,
} from 'lucide-react';
import type { ProjectIssue } from '../ProjectsSchedulerView';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';

export interface MilestoneItem {
  id?: string;
  number: number;
  title: string;
  state: 'open' | 'closed';
  startDateIso?: string;
  dueDateIso?: string;
  openIssues: number;
  closedIssues: number;
  description?: string;
  isVirtual?: boolean;
  iterationId?: string;
  isProjectIteration?: boolean;
  projectId?: string;
  iterationFieldId?: string;
}

export interface ProjectMilestonesViewProps {
  milestones: MilestoneItem[];
  issues: ProjectIssue[];
  collaborators?: any[];
  selectedProject?: any;
  repoName: string;
  theme: any;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  onOpenCreateMilestone?: () => void;
  onDeleteMilestone?: (milestoneNumber: number) => void;
  onOpenIssueDetail?: (issue: ProjectIssue) => void;
  onCreateTaskInMilestone?: (milestoneNumber: number) => void;
  onUpdateMilestoneDates?: (milestoneNumber: number, startIso: string, dueIso: string) => Promise<void> | void;
  onToggleMilestoneState?: (milestoneNumber: number, newState: 'open' | 'closed') => Promise<void> | void;
  onAssignIssueToMilestone?: (issueNumber: number, milestoneNumber: number | null) => Promise<void> | void;
  showToast?: (msg: string) => void;
}

interface QualityGate {
  id: string;
  label: string;
  completed: boolean;
  createdAt: string;
}

const MemberAvatar: React.FC<{
  name: string;
  avatarUrl?: string;
  avatarBg?: string;
  initial?: string;
  size?: number;
  accentColor: string;
}> = ({ name, avatarUrl, avatarBg, initial, size = 18, accentColor }) => {
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
        fontSize: Math.max(8, Math.round(size * 0.46)),
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

const formatMilestoneDate = (iso?: string): string => {
  if (!iso) return '';
  try {
    const d = new Date(`${iso}T00:00:00`);
    if (isNaN(d.getTime())) return iso;
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  } catch {
    return iso;
  }
};

const formatMilestoneDateRange = (startIso?: string, dueIso?: string): string => {
  const startFmt = startIso ? formatMilestoneDate(startIso) : '';
  const dueFmt = dueIso ? formatMilestoneDate(dueIso) : '';
  if (startFmt && dueFmt) {
    return `${startFmt} - ${dueFmt}`;
  }
  if (dueFmt) {
    return `Até ${dueFmt}`;
  }
  if (startFmt) {
    return `Início: ${startFmt}`;
  }
  return 'Sem prazo';
};

export const ProjectMilestonesView: React.FC<ProjectMilestonesViewProps> = ({
  milestones = [],
  issues = [],
  collaborators = [],
  selectedProject,
  repoName,
  theme,
  isEffectiveDark,
  accentColor,
  accentContrastText,
  onOpenCreateMilestone,
  onDeleteMilestone,
  onOpenIssueDetail,
  onCreateTaskInMilestone,
  onUpdateMilestoneDates,
  onToggleMilestoneState,
  onAssignIssueToMilestone,
  showToast = (msg: string) => console.log(msg),
}) => {
  // Paleta de cores 100% neutra monocromática (R = G = B, ZERO tom azulado ou slate)
  const c = useMemo(() => {
    if (isEffectiveDark) {
      return {
        shelf: '#000000',
        card: '#141414',
        cardSecondary: '#1c1c1c',
        cardHover: '#242424',
        cardSelected: '#2a2a2a',
        pillBg: '#1c1c1c',
        pillActive: '#2a2a2a',
        inputBg: '#1c1c1c',
        divider: 'rgba(255, 255, 255, 0.05)',
        textPrimary: '#ffffff',
        textSecondary: '#888888',
        textMuted: '#555555',
        success: '#10b981',
        successBg: 'rgba(16, 185, 129, 0.15)',
        danger: '#ef4444',
        dangerBg: 'rgba(239, 68, 68, 0.15)',
        warning: '#f59e0b',
        warningBg: 'rgba(245, 158, 11, 0.15)',
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
      textPrimary: '#111111',
      textSecondary: '#777777',
      textMuted: '#999999',
      success: '#10b981',
      successBg: 'rgba(16, 185, 129, 0.12)',
      danger: '#ef4444',
      dangerBg: 'rgba(239, 68, 68, 0.12)',
      warning: '#f59e0b',
      warningBg: 'rgba(245, 158, 11, 0.12)',
    };
  }, [isEffectiveDark]);
  // Data atual ISO YYYY-MM-DD
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const getMilestoneKey = (m: MilestoneItem): string => {
    if (m.iterationId) return `iter_${m.iterationId}`;
    if (m.id) return `id_${m.id}`;
    return `num_${m.number}`;
  };

  // Marco selecionado
  const [selectedMilestoneKey, setSelectedMilestoneKey] = useState<string | null>(() => {
    if (milestones.length > 0) {
      const open = milestones.find((m) => m.state === 'open') || milestones[0];
      return open ? getMilestoneKey(open) : null;
    }
    return null;
  });

  useEffect(() => {
    if (selectedMilestoneKey === null && milestones.length > 0) {
      const open = milestones.find((m) => m.state === 'open') || milestones[0];
      setSelectedMilestoneKey(open ? getMilestoneKey(open) : null);
    }
  }, [milestones, selectedMilestoneKey]);

  // Filtros da coluna esquerda
  const [milestoneSearch, setMilestoneSearch] = useState('');
  const [milestoneStatusFilter, setMilestoneStatusFilter] = useState<'all' | 'open' | 'closed' | 'delayed'>('all');

  // Filtros internos de issues
  const [issueSearch, setIssueSearch] = useState('');
  const [issueStatusFilter, setIssueStatusFilter] = useState<'all' | 'open' | 'closed'>('all');

  // Edição inline de datas
  const [isEditingDates, setIsEditingDates] = useState(false);
  const [editStartDate, setEditStartDate] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [isSavingDates, setIsSavingDates] = useState(false);

  // Modal de exclusão com ConfirmDeleteModal
  const [deletingMilestone, setDeletingMilestone] = useState<MilestoneItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Modal de vincular issues existentes
  const [isLinkingModalOpen, setIsLinkingModalOpen] = useState(false);
  const [linkSearch, setLinkSearch] = useState('');

  // Release Notes gerado com IA
  const [generatedChangelog, setGeneratedChangelog] = useState<string>('');
  const [isGeneratingChangelog, setIsGeneratingChangelog] = useState(false);

  // Quality Gates (DoD) persistidos localmente
  const storageKey = `devflow_milestone_dod_${repoName.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
  const [qualityGatesMap, setQualityGatesMap] = useState<Record<string, QualityGate[]>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });
  const [newGateText, setNewGateText] = useState('');

  const saveQualityGates = (next: Record<string, QualityGate[]>) => {
    setQualityGatesMap(next);
    try {
      localStorage.setItem(storageKey, JSON.stringify(next));
    } catch (e) {
      console.warn('Erro ao salvar quality gates:', e);
    }
  };

  // Redimensionamento vertical dos 3 painéis modulares da direita (DoD, Equipe, Release Notes)
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const [activeDragSplitter, setActiveDragSplitter] = useState<'dod-team' | 'team-release' | null>(null);

  const [panelRatios, setPanelRatios] = useState<{ dod: number; team: number; release: number }>(() => {
    try {
      const saved = localStorage.getItem('milestone_right_panel_ratios');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (typeof parsed.dod === 'number' && typeof parsed.team === 'number' && typeof parsed.release === 'number') {
          const total = parsed.dod + parsed.team + parsed.release;
          if (total > 0) {
            return {
              dod: (parsed.dod / total) * 100,
              team: (parsed.team / total) * 100,
              release: (parsed.release / total) * 100,
            };
          }
        }
      }
    } catch {}
    return { dod: 28, team: 28, release: 44 };
  });

  const startResizeDodTeam = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDragSplitter('dod-team');
    document.body.classList.add('resizing-row');

    const startY = e.clientY;
    const initialDod = panelRatios.dod;
    const initialTeam = panelRatios.team;
    const panelEl = rightPanelRef.current;
    const totalHeight = Math.max(200, (panelEl ? panelEl.clientHeight : 600) - 14);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaPct = (deltaY / totalHeight) * 100;

      const minPct = 10;
      const combined = initialDod + initialTeam;
      let newDod = initialDod + deltaPct;
      let newTeam = initialTeam - deltaPct;

      if (newDod < minPct) {
        newDod = minPct;
        newTeam = combined - minPct;
      } else if (newTeam < minPct) {
        newTeam = minPct;
        newDod = combined - minPct;
      }

      setPanelRatios((prev) => {
        const next = { ...prev, dod: newDod, team: newTeam };
        try {
          localStorage.setItem('milestone_right_panel_ratios', JSON.stringify(next));
        } catch {}
        return next;
      });
    };

    const onMouseUp = () => {
      setActiveDragSplitter(null);
      document.body.classList.remove('resizing-row');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [panelRatios]);

  const startResizeTeamRelease = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setActiveDragSplitter('team-release');
    document.body.classList.add('resizing-row');

    const startY = e.clientY;
    const initialTeam = panelRatios.team;
    const initialRelease = panelRatios.release;
    const panelEl = rightPanelRef.current;
    const totalHeight = Math.max(200, (panelEl ? panelEl.clientHeight : 600) - 14);

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaY = moveEvent.clientY - startY;
      const deltaPct = (deltaY / totalHeight) * 100;

      const minPct = 10;
      const combined = initialTeam + initialRelease;
      let newTeam = initialTeam + deltaPct;
      let newRelease = initialRelease - deltaPct;

      if (newTeam < minPct) {
        newTeam = minPct;
        newRelease = combined - minPct;
      } else if (newRelease < minPct) {
        newRelease = minPct;
        newTeam = combined - minPct;
      }

      setPanelRatios((prev) => {
        const next = { ...prev, team: newTeam, release: newRelease };
        try {
          localStorage.setItem('milestone_right_panel_ratios', JSON.stringify(next));
        } catch {}
        return next;
      });
    };

    const onMouseUp = () => {
      setActiveDragSplitter(null);
      document.body.classList.remove('resizing-row');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [panelRatios]);

  const resetPanelRatios = useCallback(() => {
    const defaults = { dod: 28, team: 28, release: 44 };
    setPanelRatios(defaults);
    try {
      localStorage.setItem('milestone_right_panel_ratios', JSON.stringify(defaults));
    } catch {}
  }, []);

  useEffect(() => {
    return () => {
      document.body.classList.remove('resizing-row');
      document.body.classList.remove('resizing-col');
    };
  }, []);

  // Redimensionamento horizontal da coluna esquerda (Marcos)
  const [leftSidebarWidth, setLeftSidebarWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('devflow_milestone_left_sidebar_width');
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 180 && val <= 550) return val;
      }
    } catch {}
    return 260;
  });
  const [isDraggingLeftSidebar, setIsDraggingLeftSidebar] = useState(false);

  const startResizeLeftSidebar = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingLeftSidebar(true);
    document.body.classList.add('resizing-col');

    const startX = e.clientX;
    const initialWidth = leftSidebarWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const newWidth = Math.max(180, Math.min(550, initialWidth + deltaX));
      setLeftSidebarWidth(newWidth);
      try {
        localStorage.setItem('devflow_milestone_left_sidebar_width', String(newWidth));
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
  }, [leftSidebarWidth]);

  const resetLeftSidebarWidth = useCallback(() => {
    setLeftSidebarWidth(260);
    try {
      localStorage.setItem('devflow_milestone_left_sidebar_width', '260');
    } catch {}
  }, []);

  // Redimensionamento horizontal da coluna direita modular (DoD, Equipe, Release Notes)
  const [rightPanelWidth, setRightPanelWidth] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('devflow_milestone_right_panel_width');
      if (saved) {
        const val = Number(saved);
        if (!isNaN(val) && val >= 220 && val <= 600) return val;
      }
    } catch {}
    return 320;
  });
  const [isDraggingRightCol, setIsDraggingRightCol] = useState(false);

  const startResizeRightCol = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingRightCol(true);
    document.body.classList.add('resizing-col');

    const startX = e.clientX;
    const initialWidth = rightPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = startX - moveEvent.clientX;
      const newWidth = Math.max(220, Math.min(600, initialWidth + deltaX));
      setRightPanelWidth(newWidth);
      try {
        localStorage.setItem('devflow_milestone_right_panel_width', String(newWidth));
      } catch {}
    };

    const onMouseUp = () => {
      setIsDraggingRightCol(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [rightPanelWidth]);

  const resetRightPanelWidth = useCallback(() => {
    setRightPanelWidth(320);
    try {
      localStorage.setItem('devflow_milestone_right_panel_width', '320');
    } catch {}
  }, []);

  // Marco atualmente selecionado
  const currentMilestone = useMemo(() => {
    return milestones.find((m) => getMilestoneKey(m) === selectedMilestoneKey) || milestones[0] || null;
  }, [milestones, selectedMilestoneKey]);

  useEffect(() => {
    if (currentMilestone) {
      setEditStartDate(currentMilestone.startDateIso || '');
      setEditDueDate(currentMilestone.dueDateIso || '');
      setIsEditingDates(false);
      setGeneratedChangelog('');
    }
  }, [currentMilestone]);

  // Helper de associação idêntico ao issueBelongsToSprint da IDE
  const issueBelongsToMilestone = (iss: ProjectIssue, m: MilestoneItem): boolean => {
    // 1. Se ambos tiverem iterationId, bate direto por id
    if (m.iterationId && iss.iterationId && m.iterationId === iss.iterationId) {
      return true;
    }
    // 2. Se ambos tiverem milestone number válido
    if (m.number && m.number > 0 && iss.milestoneNumber === m.number) {
      return true;
    }
    // 3. Comparação de títulos (normalizado)
    const spTitle = (m.title || '').toLowerCase().trim();
    const itTitle = (iss.iterationTitle || '').toLowerCase().trim();
    const msTitle = (iss.milestoneTitle || '').toLowerCase().trim();
    if (spTitle) {
      if (itTitle && itTitle === spTitle) return true;
      if (msTitle && msTitle === spTitle) return true;

      // 4. Comparação por prefixo de número (ex: 'Sprint 2' ou 'Sprint2')
      const spNumMatch = spTitle.match(/^sprint\s*(\d+)/i);
      if (spNumMatch) {
        const spNum = parseInt(spNumMatch[1], 10);
        if (iss.milestoneNumber === spNum) return true;
        const itNumMatch = itTitle.match(/^sprint\s*(\d+)/i);
        if (itNumMatch && parseInt(itNumMatch[1], 10) === spNum) return true;
        const msNumMatch = msTitle.match(/^sprint\s*(\d+)/i);
        if (msNumMatch && parseInt(msNumMatch[1], 10) === spNum) return true;
      }
    }

    // 5. Fallback para iterationId se nada mais bateu
    if (m.isProjectIteration || m.iterationId) {
      return Boolean(m.iterationId && iss.iterationId === m.iterationId);
    }

    return false;
  };

  // Agrupamento de issues por milestone
  const issuesByMilestone = useMemo(() => {
    const map = new Map<string, ProjectIssue[]>();
    milestones.forEach((m) => {
      const list = issues.filter((iss) => issueBelongsToMilestone(iss, m));
      map.set(getMilestoneKey(m), list);
    });
    return map;
  }, [issues, milestones]);

  // Issues do marco atual
  const currentMilestoneIssues = useMemo(() => {
    if (!currentMilestone) return [];
    return issuesByMilestone.get(getMilestoneKey(currentMilestone)) || [];
  }, [currentMilestone, issuesByMilestone]);

  // Métricas do marco atual
  const currentMilestoneMetrics = useMemo(() => {
    if (!currentMilestone) {
      return { total: 0, closed: 0, open: 0, percent: 0, isDelayed: false, daysLeftText: 'Sem prazo' };
    }
    const mIssues = currentMilestoneIssues;
    const total = mIssues.length > 0 ? mIssues.length : currentMilestone.openIssues + currentMilestone.closedIssues;
    const closed =
      mIssues.length > 0 ? mIssues.filter((i) => i.status === 'Concluído').length : currentMilestone.closedIssues;
    const open = Math.max(0, total - closed);
    const percent = total > 0 ? Math.round((closed / total) * 100) : 0;
    const isClosed = currentMilestone.state === 'closed';
    const isDelayed = !isClosed && !!currentMilestone.dueDateIso && currentMilestone.dueDateIso < todayIso;

    let daysLeftText = 'Sem prazo';
    if (isClosed) {
      daysLeftText = 'Concluído';
    } else if (currentMilestone.dueDateIso) {
      const diffMs =
        new Date(`${currentMilestone.dueDateIso}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime();
      const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
      if (diffDays < 0) {
        daysLeftText = `${Math.abs(diffDays)}d atrasado`;
      } else if (diffDays === 0) {
        daysLeftText = 'Entrega hoje';
      } else {
        daysLeftText = `Faltam ${diffDays}d`;
      }
    }

    return { total, closed, open, percent, isDelayed, daysLeftText };
  }, [currentMilestone, currentMilestoneIssues, todayIso]);

  // Filtragem da lista de marcos
  const filteredMilestones = useMemo(() => {
    return milestones.filter((m) => {
      if (milestoneSearch.trim()) {
        const query = milestoneSearch.toLowerCase();
        const matchTitle = m.title.toLowerCase().includes(query);
        const matchDesc = m.description ? m.description.toLowerCase().includes(query) : false;
        if (!matchTitle && !matchDesc) return false;
      }
      if (milestoneStatusFilter === 'open' && m.state !== 'open') return false;
      if (milestoneStatusFilter === 'closed' && m.state !== 'closed') return false;
      if (milestoneStatusFilter === 'delayed') {
        if (m.state === 'closed') return false;
        if (!m.dueDateIso || m.dueDateIso >= todayIso) return false;
      }
      return true;
    });
  }, [milestones, milestoneSearch, milestoneStatusFilter, todayIso]);

  // Filtragem de issues do marco atual
  const filteredCurrentIssues = useMemo(() => {
    return currentMilestoneIssues.filter((iss) => {
      if (issueSearch.trim()) {
        const query = issueSearch.toLowerCase();
        const matchTitle = iss.title.toLowerCase().includes(query);
        const matchNum = String(iss.githubNumber || '').includes(query);
        if (!matchTitle && !matchNum) return false;
      }
      if (issueStatusFilter === 'open' && iss.status === 'Concluído') return false;
      if (issueStatusFilter === 'closed' && iss.status !== 'Concluído') return false;
      return true;
    });
  }, [currentMilestoneIssues, issueSearch, issueStatusFilter]);

  // Issues sem marco (para vincular)
  const unassignedIssues = useMemo(() => {
    return issues.filter((i) => (!i.milestoneNumber || i.milestoneNumber === 0) && !i.iterationId && !i.iterationTitle);
  }, [issues]);

  const filteredUnassignedIssues = useMemo(() => {
    if (!linkSearch.trim()) return unassignedIssues;
    const q = linkSearch.toLowerCase();
    return unassignedIssues.filter(
      (i) => i.title.toLowerCase().includes(q) || String(i.githubNumber || '').includes(q)
    );
  }, [unassignedIssues, linkSearch]);

  // Quality Gates
  const currentQualityGates = useMemo<QualityGate[]>(() => {
    if (!currentMilestone) return [];
    const k = getMilestoneKey(currentMilestone);
    return (
      qualityGatesMap[k] ||
      qualityGatesMap[String(currentMilestone.number)] || [
        { id: 'gate-1', label: 'Testes automatizados e CI aprovados', completed: false, createdAt: todayIso },
        { id: 'gate-2', label: 'Homologação e validação de requisitos', completed: false, createdAt: todayIso },
        { id: 'gate-3', label: 'Documentação técnica e changelog revisados', completed: false, createdAt: todayIso },
      ]
    );
  }, [currentMilestone, qualityGatesMap, todayIso]);

  const handleToggleGate = (gateId: string) => {
    if (!currentMilestone) return;
    const k = getMilestoneKey(currentMilestone);
    const nextList = currentQualityGates.map((g) => (g.id === gateId ? { ...g, completed: !g.completed } : g));
    saveQualityGates({ ...qualityGatesMap, [k]: nextList });
  };

  const handleAddGate = () => {
    if (!currentMilestone || !newGateText.trim()) return;
    const k = getMilestoneKey(currentMilestone);
    const nextList: QualityGate[] = [
      ...currentQualityGates,
      { id: `gate-${Date.now()}`, label: newGateText.trim(), completed: false, createdAt: todayIso },
    ];
    saveQualityGates({ ...qualityGatesMap, [k]: nextList });
    setNewGateText('');
    showToast('Critério de homologação adicionado.');
  };

  const handleDeleteGate = (gateId: string) => {
    if (!currentMilestone) return;
    const k = getMilestoneKey(currentMilestone);
    const nextList = currentQualityGates.filter((g) => g.id !== gateId);
    saveQualityGates({ ...qualityGatesMap, [k]: nextList });
  };

  // Carga de trabalho por colaborador no marco
  const workloadByMember = useMemo(() => {
    const map = new Map<
      string,
      {
        member: string;
        avatarUrl?: string;
        avatarBg?: string;
        initial: string;
        total: number;
        closed: number;
        open: number;
      }
    >();

    currentMilestoneIssues.forEach((iss) => {
      const assignees =
        iss.assignees && iss.assignees.length > 0
          ? iss.assignees
          : [{ name: iss.author || 'Sem responsável', avatarUrl: iss.authorAvatarUrl }];

      assignees.forEach((a) => {
        const rawName = a.name || 'Sem responsável';
        const cleanName = rawName.replace(/^@/, '').trim();
        const collab = (collaborators || []).find((c: any) => {
          const cLogin = (c.login || '').replace(/^@/, '').toLowerCase().trim();
          const cName = (c.name || '').replace(/^@/, '').toLowerCase().trim();
          return cLogin === cleanName.toLowerCase() || cName === cleanName.toLowerCase();
        });
        const avatarUrl =
          a.avatarUrl ||
          collab?.avatarUrl ||
          collab?.avatar_url ||
          (cleanName && cleanName !== 'Sem responsável'
            ? `https://github.com/${encodeURIComponent(cleanName)}.png?size=60`
            : undefined);
        const avatarBg = a.avatarBg || accentColor;
        const initial = (a.initial || cleanName.slice(0, 1) || '?').toUpperCase();

        const cur = map.get(rawName) || {
          member: rawName,
          avatarUrl,
          avatarBg,
          initial,
          total: 0,
          closed: 0,
          open: 0,
        };

        if (!cur.avatarUrl && avatarUrl) {
          cur.avatarUrl = avatarUrl;
        }

        cur.total += 1;
        if (iss.status === 'Concluído') cur.closed += 1;
        else cur.open += 1;

        map.set(rawName, cur);
      });
    });

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [currentMilestoneIssues, collaborators, accentColor]);

  // Gerador de Release Notes (IA)
  const handleGenerateChangelog = () => {
    if (!currentMilestone) return;
    setIsGeneratingChangelog(true);
    setTimeout(() => {
      const completed = currentMilestoneIssues.filter((i) => i.status === 'Concluído');
      const features = completed.filter(
        (i) => (i.tag && /feat|feature|nova/i.test(i.tag)) || (i.rawLabels && i.rawLabels.some((l) => /feat|enhancement/i.test(l)))
      );
      const fixes = completed.filter(
        (i) => (i.tag && /fix|bug|corre/i.test(i.tag)) || (i.rawLabels && i.rawLabels.some((l) => /bug|fix/i.test(l)))
      );
      const others = completed.filter((i) => !features.includes(i) && !fixes.includes(i));

      const lines: string[] = [];
      lines.push(`## Release Notes - ${currentMilestone.title}`);
      lines.push(`Data de Entrega: ${currentMilestone.dueDateIso || todayIso}`);
      lines.push(`Status: ${completed.length}/${currentMilestoneIssues.length} tarefas entregues`);
      lines.push('');

      if (features.length > 0) {
        lines.push('### Novas Funcionalidades');
        features.forEach((f) => lines.push(`- ${f.title} (#${f.githubNumber || f.id})`));
        lines.push('');
      }

      if (fixes.length > 0) {
        lines.push('### Correções e Ajustes');
        fixes.forEach((f) => lines.push(`- ${f.title} (#${f.githubNumber || f.id})`));
        lines.push('');
      }

      if (others.length > 0) {
        lines.push('### Outras Entregas');
        others.forEach((o) => lines.push(`- ${o.title} (#${o.githubNumber || o.id})`));
        lines.push('');
      }

      if (completed.length === 0) {
        lines.push('Nenhuma tarefa marcada como Concluída até o momento para este marco.');
      }

      setGeneratedChangelog(lines.join('\n'));
      setIsGeneratingChangelog(false);
      showToast('Release Notes gerado com sucesso.');
    }, 450);
  };

  const handleCopyChangelog = () => {
    if (!generatedChangelog) return;
    navigator.clipboard.writeText(generatedChangelog);
    showToast('Release notes copiado para a área de transferência.');
  };

  // Salvar datas editadas
  const handleSaveDates = async () => {
    if (!currentMilestone) return;
    setIsSavingDates(true);
    try {
      if (onUpdateMilestoneDates) {
        await onUpdateMilestoneDates(currentMilestone.number, editStartDate, editDueDate);
      }
      currentMilestone.startDateIso = editStartDate;
      currentMilestone.dueDateIso = editDueDate;
      setIsEditingDates(false);
      showToast('Datas do marco salvas.');
    } catch {
      showToast('Erro ao atualizar datas do marco.');
    } finally {
      setIsSavingDates(false);
    }
  };

  // Confirmar exclusão do marco via ConfirmDeleteModal (AGENTS.md)
  const handleConfirmDelete = async () => {
    if (!deletingMilestone) return;
    setIsDeleting(true);
    try {
      if (onDeleteMilestone) {
        await onDeleteMilestone(deletingMilestone.number);
      }
      showToast(`Marco "${deletingMilestone.title}" excluído.`);
      setDeletingMilestone(null);
      if (selectedMilestoneKey === getMilestoneKey(deletingMilestone)) {
        const remaining = milestones.filter((m) => getMilestoneKey(m) !== getMilestoneKey(deletingMilestone));
        setSelectedMilestoneKey(remaining.length > 0 ? getMilestoneKey(remaining[0]) : null);
      }
    } catch {
      showToast('Erro ao excluir marco.');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        gap: 5,
        padding: 5,
        boxSizing: 'border-box',
        background: c.shelf,
        borderRadius: 10,
        border: 'none',
        boxShadow: 'none',
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
      }}
    >
      {/* ========================================================================= */}
      {/* COLUNA ESQUERDA: LISTA MODULAR DE MARCOS                                   */}
      {/* ========================================================================= */}
      <div
        style={{
          width: leftSidebarWidth,
          minWidth: 180,
          maxWidth: 550,
          flexShrink: 0,
          height: '100%',
          background: c.card,
          borderRadius: 8,
          padding: 10,
          display: 'flex',
          flexDirection: 'column',
          gap: 7,
          border: 'none',
          boxShadow: 'none',
          overflow: 'hidden',
        }}
      >
        {/* Cabeçalho da Lista de Marcos */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '2px 4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Milestone size={14} color={accentColor} />
            <span style={{ fontSize: 13, fontWeight: 500, color: c.textPrimary }}>Marcos</span>
            <span
              style={{
                fontSize: 10.5,
                fontWeight: 500,
                padding: '1px 6px',
                borderRadius: 4,
                background: c.cardSecondary,
                color: c.textSecondary,
              }}
            >
              {milestones.length}
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenCreateMilestone}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              background: accentColor,
              color: accentContrastText,
              border: 'none',
              boxShadow: 'none',
              borderRadius: 5,
              padding: '4px 10px',
              fontSize: 11.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Plus size={13} />
            <span>Novo</span>
          </button>
        </div>

        {/* Campo de Busca de Marcos */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 7,
            background: c.inputBg,
            borderRadius: 6,
            padding: '6px 9px',
            border: 'none',
            boxShadow: 'none',
          }}
        >
          <Search size={12} color={c.textSecondary} />
          <input
            type="text"
            placeholder="Buscar marcos..."
            value={milestoneSearch}
            onChange={(e) => setMilestoneSearch(e.target.value)}
            style={{
              background: 'transparent',
              border: 'none',
              boxShadow: 'none',
              outline: 'none',
              fontSize: 12,
              fontWeight: 400,
              color: c.textPrimary,
              width: '100%',
            }}
          />
          {milestoneSearch && (
            <button
              type="button"
              onClick={() => setMilestoneSearch('')}
              style={{
                background: 'transparent',
                border: 'none',
                boxShadow: 'none',
                color: c.textSecondary,
                cursor: 'pointer',
                padding: 0,
                display: 'flex',
              }}
            >
              <X size={12} />
            </button>
          )}
        </div>

        {/* Filtros rápidos: [ Todos | Abertos | Fechados | Atrasados ] */}
        <div
          style={{
            display: 'flex',
            background: c.pillBg,
            borderRadius: 6,
            padding: 2,
            gap: 2,
            border: 'none',
          }}
        >
          {[
            { id: 'all', label: 'Todos' },
            { id: 'open', label: 'Abertos' },
            { id: 'closed', label: 'Fechados' },
            { id: 'delayed', label: 'Atrasados' },
          ].map((tab) => {
            const isSelected = milestoneStatusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setMilestoneStatusFilter(tab.id as any)}
                style={{
                  flex: 1,
                  background: isSelected ? c.pillActive : 'transparent',
                  color: isSelected ? c.textPrimary : c.textSecondary,
                  border: 'none',
                  borderRadius: 4,
                  padding: '4px 0',
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: 'pointer',
                  textAlign: 'center',
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Lista Scrollável de Marcos */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
            paddingRight: 1,
          }}
        >
          {filteredMilestones.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 10px', color: c.textSecondary, fontSize: 12 }}>
              Nenhum marco encontrado.
            </div>
          ) : (
            filteredMilestones.map((m) => {
              const mKey = getMilestoneKey(m);
              const isSelected = selectedMilestoneKey === mKey;
              const mIssues = issuesByMilestone.get(mKey) || [];
              const total = mIssues.length > 0 ? mIssues.length : m.openIssues + m.closedIssues;
              const closed =
                mIssues.length > 0 ? mIssues.filter((i) => i.status === 'Concluído').length : m.closedIssues;
              const percent = total > 0 ? Math.round((closed / total) * 100) : 0;
              const isClosed = m.state === 'closed';
              const isDelayed = !isClosed && !!m.dueDateIso && m.dueDateIso < todayIso;

              const getDaysBadge = () => {
                if (isClosed) {
                  return {
                    text: 'Concluído',
                    color: '#10b981',
                    bg: isEffectiveDark ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.12)',
                  };
                }
                if (isDelayed) {
                  return {
                    text: 'Atrasado',
                    color: '#ef4444',
                    bg: isEffectiveDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.12)',
                  };
                }
                if (!m.dueDateIso) {
                  return null;
                }
                try {
                  const diffMs =
                    new Date(`${m.dueDateIso}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime();
                  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
                  if (diffDays < 0) {
                    return {
                      text: `${Math.abs(diffDays)}d atrasado`,
                      color: '#ef4444',
                      bg: isEffectiveDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.12)',
                    };
                  }
                  if (diffDays === 0) {
                    return {
                      text: 'Hoje',
                      color: '#f59e0b',
                      bg: isEffectiveDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.12)',
                    };
                  }
                  if (diffDays <= 3) {
                    return {
                      text: `Faltam ${diffDays}d`,
                      color: '#ef4444',
                      bg: isEffectiveDark ? 'rgba(239, 68, 68, 0.16)' : 'rgba(239, 68, 68, 0.12)',
                    };
                  }
                  if (diffDays <= 7) {
                    return {
                      text: `Faltam ${diffDays}d`,
                      color: '#f59e0b',
                      bg: isEffectiveDark ? 'rgba(245, 158, 11, 0.16)' : 'rgba(245, 158, 11, 0.12)',
                    };
                  }
                  return {
                    text: `Faltam ${diffDays}d`,
                    color: c.textSecondary,
                    bg: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                  };
                } catch {
                  return null;
                }
              };
              const daysBadge = getDaysBadge();
              const dateRangeText = formatMilestoneDateRange(m.startDateIso, m.dueDateIso);

              return (
                <div
                  key={mKey}
                  data-milestone-key={mKey}
                  onClick={() => setSelectedMilestoneKey(mKey)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: isSelected
                      ? (isEffectiveDark ? '#262629' : '#e4e7eb')
                      : (isEffectiveDark ? '#141416' : '#ffffff'),
                    border: 'none',
                    boxShadow: 'none',
                    transition: 'all 0.15s ease',
                    position: 'relative',
                    overflow: 'hidden',
                    flexShrink: 0,
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = isEffectiveDark ? '#1e1e21' : '#f1f5f9';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = isEffectiveDark ? '#141416' : '#ffffff';
                    }
                  }}
                >
                  {/* Linha 1: Status Dot + Título + Badge de Prazo/Status + Excluir */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: isClosed ? '#10b981' : isDelayed ? '#ef4444' : accentColor,
                          flexShrink: 0,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 12,
                          fontWeight: isSelected ? 600 : 500,
                          color: c.textPrimary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={m.title}
                      >
                        {m.title}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                      {daysBadge ? (
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 600,
                            color: daysBadge.color,
                            background: daysBadge.bg,
                            padding: '1.5px 6px',
                            borderRadius: 10,
                            lineHeight: 1.2,
                            display: 'inline-flex',
                            alignItems: 'center',
                          }}
                        >
                          {daysBadge.text}
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 9.5,
                            fontWeight: 500,
                            color: c.textMuted,
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                            padding: '1.5px 6px',
                            borderRadius: 10,
                            lineHeight: 1.2,
                          }}
                        >
                          {isClosed ? 'Concluído' : 'Aberto'}
                        </span>
                      )}

                      {onDeleteMilestone && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeletingMilestone(m);
                          }}
                          title="Excluir marco"
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: c.textSecondary,
                            cursor: 'pointer',
                            padding: 2,
                            display: 'flex',
                            borderRadius: 3,
                            opacity: 0.45,
                            transition: 'opacity 0.15s ease, color 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = '#ef4444';
                            e.currentTarget.style.opacity = '1';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = c.textSecondary;
                            e.currentTarget.style.opacity = '0.45';
                          }}
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Linha 2: Datas da Sprint / Prazo + Contagem de Tarefas e Porcentagem */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      fontSize: 10.5,
                      paddingLeft: 12,
                      color: c.textSecondary,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, minWidth: 0 }}>
                      <Calendar size={10} color={c.textMuted} style={{ flexShrink: 0 }} />
                      <span
                        style={{
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          color: c.textSecondary,
                        }}
                      >
                        {dateRangeText}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      <span>
                        <strong style={{ color: c.textPrimary, fontWeight: 500 }}>{closed}</strong>
                        <span style={{ opacity: 0.7 }}>/{total}</span>
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          fontWeight: isSelected ? 600 : 500,
                          color: isSelected ? c.textPrimary : c.textSecondary,
                        }}
                      >
                        {percent}%
                      </span>
                    </div>
                  </div>

                  {/* Linha de progresso colada na borda inferior do card */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: 0,
                      right: 0,
                      height: 2.5,
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                    }}
                  >
                    <div
                      style={{
                        height: '100%',
                        width: `${percent}%`,
                        background: isClosed
                          ? '#10b981'
                          : isDelayed
                          ? '#ef4444'
                          : isSelected
                          ? accentColor
                          : (isEffectiveDark ? 'rgba(255, 255, 255, 0.35)' : 'rgba(0, 0, 0, 0.25)'),
                        transition: 'width 0.25s ease, background 0.15s ease',
                      }}
                    />
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Resizer Horizontal: Entre Lista de Marcos e Detalhes */}
      <div
        data-testid="resizer-milestone-left"
        className={`resizer-col ${isDraggingLeftSidebar ? 'dragging' : ''}`}
        onMouseDown={startResizeLeftSidebar}
        onDoubleClick={resetLeftSidebarWidth}
        title="Arraste para redimensionar horizontalmente (Duplo clique para restaurar 260px)"
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
      {/* ÁREA DIREITA: CARDS MODULARES DE DETALHES (NUNCA UM CARD GRANDÃO)         */}
      {/* ========================================================================= */}
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          gap: 5,
          background: 'transparent',
          border: 'none',
          boxShadow: 'none',
          overflow: 'hidden',
        }}
      >
        {milestones.length === 0 ? (
          /* Empty state modular elegante */
          <div
            style={{
              flex: 1,
              background: c.card,
              borderRadius: 8,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              padding: 40,
              textAlign: 'center',
              border: 'none',
            }}
          >
            <div
              style={{
                width: 44,
                height: 44,
                borderRadius: 8,
                background: c.cardSecondary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accentColor,
              }}
            >
              <Milestone size={22} />
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: c.textPrimary }}>
              Nenhum marco cadastrado para este projeto
            </div>
            <div style={{ fontSize: 12, color: c.textSecondary, maxWidth: 360, lineHeight: 1.5 }}>
              Marcos agrupam releases, definem metas estratégicas e acompanham critérios de homologação e entregas.
            </div>
            <button
              type="button"
              onClick={onOpenCreateMilestone}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: accentColor,
                color: accentContrastText,
                border: 'none',
                borderRadius: 6,
                padding: '8px 16px',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                marginTop: 4,
              }}
            >
              <Plus size={14} />
              <span>Criar Primeiro Marco</span>
            </button>
          </div>
        ) : !currentMilestone ? (
          <div
            style={{
              flex: 1,
              background: c.card,
              borderRadius: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: c.textSecondary,
              fontSize: 13,
            }}
          >
            Selecione um marco à esquerda para visualizar seus detalhes.
          </div>
        ) : (
          <>
            {/* ----------------------------------------------------------------- */}
            {/* LINHA SUPERIOR: CABEÇALHO DO MARCO + 3 MÉTRICAS À DIREITA        */}
            {/* ----------------------------------------------------------------- */}
            <div
              style={{
                display: 'flex',
                gap: 5,
                alignItems: 'stretch',
                flexShrink: 0,
              }}
            >
              {/* DIV DE CIMA: Informações do Marco e Ações */}
              <div
                style={{
                  flex: 1,
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
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: c.textPrimary }}>{currentMilestone.title}</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '2px 7px',
                        borderRadius: 4,
                        background:
                          currentMilestone.state === 'closed'
                            ? c.successBg
                            : currentMilestoneMetrics.isDelayed
                            ? c.dangerBg
                            : c.cardSecondary,
                        color:
                          currentMilestone.state === 'closed'
                            ? c.success
                            : currentMilestoneMetrics.isDelayed
                            ? c.danger
                            : c.textSecondary,
                      }}
                    >
                      {currentMilestone.state === 'closed'
                        ? 'Concluído'
                        : currentMilestoneMetrics.isDelayed
                        ? 'Atrasado'
                        : 'Aberto'}
                    </span>
                  </div>

                  {/* Edição rápida de datas inline */}
                  {!isEditingDates ? (
                    <div
                      onClick={() => setIsEditingDates(true)}
                      role="button"
                      tabIndex={0}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer',
                        color: c.textSecondary,
                        fontSize: 11,
                        fontWeight: 400,
                      }}
                    >
                      <Calendar size={12} color={accentColor} />
                      <span>
                        {currentMilestone.dueDateIso
                          ? `Entrega até ${currentMilestone.dueDateIso}`
                          : 'Definir data de entrega'}
                      </span>
                      <Edit2 size={10} color={c.textMuted} />
                    </div>
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 11, color: c.textSecondary }}>De:</span>
                      <input
                        type="date"
                        value={editStartDate}
                        onChange={(e) => setEditStartDate(e.target.value)}
                        style={{
                          background: c.inputBg,
                          border: 'none',
                          borderRadius: 4,
                          padding: '2px 6px',
                          fontSize: 11,
                          color: c.textPrimary,
                          colorScheme: isEffectiveDark ? 'dark' : 'light',
                          outline: 'none',
                        }}
                      />
                      <span style={{ fontSize: 11, color: c.textSecondary }}>Até:</span>
                      <input
                        type="date"
                        value={editDueDate}
                        onChange={(e) => setEditDueDate(e.target.value)}
                        style={{
                          background: c.inputBg,
                          border: 'none',
                          borderRadius: 4,
                          padding: '2px 6px',
                          fontSize: 11,
                          color: c.textPrimary,
                          colorScheme: isEffectiveDark ? 'dark' : 'light',
                          outline: 'none',
                        }}
                      />
                      <button
                        type="button"
                        onClick={handleSaveDates}
                        disabled={isSavingDates}
                        style={{
                          background: accentColor,
                          color: accentContrastText,
                          border: 'none',
                          borderRadius: 4,
                          padding: '3px 8px',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        Salvar
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsEditingDates(false)}
                        style={{
                          background: 'transparent',
                          color: c.textSecondary,
                          border: 'none',
                          fontSize: 11,
                          cursor: 'pointer',
                          padding: '3px 6px',
                        }}
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>

                {/* Ações do Marco */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto' }}>
                  <button
                    type="button"
                    onClick={() => {
                      const nextState = currentMilestone.state === 'closed' ? 'open' : 'closed';
                      if (onToggleMilestoneState) {
                        onToggleMilestoneState(currentMilestone.number, nextState);
                      }
                      showToast(nextState === 'closed' ? 'Marco concluído.' : 'Marco reaberto.');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 5,
                      background: c.cardSecondary,
                      color: c.textPrimary,
                      border: 'none',
                      borderRadius: 5,
                      padding: '5px 11px',
                      fontSize: 11.5,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >
                    <CheckCircle2 size={13} color={currentMilestone.state === 'closed' ? c.textSecondary : c.success} />
                    <span>{currentMilestone.state === 'closed' ? 'Reabrir Marco' : 'Concluir Marco'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setDeletingMilestone(currentMilestone)}
                    title="Excluir Marco"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: 'transparent',
                      color: c.textSecondary,
                      border: 'none',
                      borderRadius: 5,
                      padding: '5px 7px',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = c.danger)}
                    onMouseLeave={(e) => (e.currentTarget.style.color = c.textSecondary)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* AS OUTRAS 3 DIVS AO LADO DIREITO (COM TAMANHO HORIZONTAL MENOR) */}
              {/* Metric 2: Concluídas */}
              <div
                style={{
                  width: 105,
                  flexShrink: 0,
                  background: c.card,
                  borderRadius: 8,
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 2,
                  border: 'none',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 500, color: c.textSecondary, textTransform: 'uppercase' }}>
                  Concluídas
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: c.textPrimary }}>
                  {currentMilestoneMetrics.closed} <span style={{ fontSize: 11, color: c.textSecondary }}>issues</span>
                </span>
              </div>

              {/* Metric 3: A Fazer */}
              <div
                style={{
                  width: 105,
                  flexShrink: 0,
                  background: c.card,
                  borderRadius: 8,
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 2,
                  border: 'none',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 500, color: c.textSecondary, textTransform: 'uppercase' }}>
                  A Fazer
                </span>
                <span style={{ fontSize: 13, fontWeight: 500, color: c.textPrimary }}>
                  {currentMilestoneMetrics.open} <span style={{ fontSize: 11, color: c.textSecondary }}>issues</span>
                </span>
              </div>

              {/* Metric 4: Prazo */}
              <div
                style={{
                  width: 110,
                  flexShrink: 0,
                  background: c.card,
                  borderRadius: 8,
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'center',
                  gap: 2,
                  border: 'none',
                }}
              >
                <span style={{ fontSize: 10, fontWeight: 500, color: c.textSecondary, textTransform: 'uppercase' }}>
                  Prazo
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: currentMilestoneMetrics.isDelayed ? c.danger : c.textPrimary,
                  }}
                >
                  {currentMilestoneMetrics.daysLeftText}
                </span>
              </div>
            </div>

            {/* ----------------------------------------------------------------- */}
            {/* ÁREA INFERIOR: DUAS COLUNAS MODULARES EQUILIBRADAS (SEM CARDÃO)    */}
            {/* ----------------------------------------------------------------- */}
            <div
              style={{
                display: 'flex',
                gap: 5,
                flex: 1,
                minHeight: 0,
                overflow: 'hidden',
              }}
            >
              {/* =============================================================== */}
              {/* SUB-COLUNA 1: GESTÃO DE TAREFAS DO MARCO                        */}
              {/* =============================================================== */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 5,
                  height: '100%',
                }}
              >
                {/* Card de Ações e Filtros das Tarefas */}
                <div
                  style={{
                    background: c.card,
                    borderRadius: 8,
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: 8,
                    flexWrap: 'wrap',
                    border: 'none',
                    boxShadow: 'none',
                    flexShrink: 0,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ListChecks size={14} color={accentColor} />
                    <span style={{ fontSize: 12.5, fontWeight: 500, color: c.textPrimary }}>Tarefas do Marco</span>
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 500,
                        padding: '1px 6px',
                        borderRadius: 4,
                        background: c.cardSecondary,
                        color: c.textSecondary,
                      }}
                    >
                      {currentMilestoneIssues.length}
                    </span>
                  </div>

                  {/* Filtro de Status das Issues */}
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
                      { id: 'all', label: `Todas (${currentMilestoneIssues.length})` },
                      {
                        id: 'open',
                        label: `Abertas (${currentMilestoneIssues.filter((i) => i.status !== 'Concluído').length})`,
                      },
                      {
                        id: 'closed',
                        label: `Concluídas (${currentMilestoneIssues.filter((i) => i.status === 'Concluído').length})`,
                      },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setIssueStatusFilter(tab.id as any)}
                        style={{
                          padding: '3px 8px',
                          border: 'none',
                          borderRadius: 4,
                          background: issueStatusFilter === tab.id ? c.pillActive : 'transparent',
                          color: issueStatusFilter === tab.id ? c.textPrimary : c.textSecondary,
                          fontSize: 10.5,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Ações de Tarefa */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <button
                      type="button"
                      onClick={() => setIsLinkingModalOpen(true)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: c.cardSecondary,
                        color: c.textPrimary,
                        border: 'none',
                        borderRadius: 5,
                        padding: '4px 9px',
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={11} />
                      <span>Vincular</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onCreateTaskInMilestone?.(currentMilestone.number)}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 4,
                        background: accentColor,
                        color: accentContrastText,
                        border: 'none',
                        borderRadius: 5,
                        padding: '4px 10px',
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: 'pointer',
                      }}
                    >
                      <Plus size={11} />
                      <span>Nova Tarefa</span>
                    </button>
                  </div>
                </div>

                {/* Card da Lista de Tarefas */}
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    background: c.card,
                    borderRadius: 8,
                    padding: 8,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    border: 'none',
                    boxShadow: 'none',
                    overflowY: 'auto',
                  }}
                >
                  {/* Busca Rápida de Tarefas */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: c.inputBg,
                      borderRadius: 6,
                      padding: '5px 9px',
                      border: 'none',
                      flexShrink: 0,
                    }}
                  >
                    <Search size={12} color={c.textSecondary} />
                    <input
                      type="text"
                      placeholder="Filtrar tarefas pelo título ou número..."
                      value={issueSearch}
                      onChange={(e) => setIssueSearch(e.target.value)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: 11.5,
                        color: c.textPrimary,
                        width: '100%',
                      }}
                    />
                    {issueSearch && (
                      <button
                        type="button"
                        onClick={() => setIssueSearch('')}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: c.textSecondary,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <X size={11} />
                      </button>
                    )}
                  </div>

                  {filteredCurrentIssues.length === 0 ? (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: c.textSecondary,
                        fontSize: 12,
                        gap: 6,
                        padding: '30px 10px',
                        textAlign: 'center',
                      }}
                    >
                      <ListChecks size={20} color={c.textMuted} />
                      <span>Nenhuma tarefa vinculada a este marco.</span>
                      <span style={{ fontSize: 11, color: c.textMuted }}>
                        Clique em <strong>Vincular</strong> ou <strong>Nova Tarefa</strong> acima.
                      </span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {filteredCurrentIssues.map((iss) => {
                        const isDone = iss.status === 'Concluído';
                        return (
                          <div
                            key={iss.id || iss.githubNumber}
                            onClick={() => onOpenIssueDetail?.(iss)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: 9,
                              padding: '7px 10px',
                              borderRadius: 6,
                              background: c.cardSecondary,
                              cursor: 'pointer',
                              border: 'none',
                              boxShadow: 'none',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = c.cardHover)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = c.cardSecondary)}
                          >
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                color: isDone ? c.success : c.textSecondary,
                              }}
                            >
                              {isDone ? <CheckCircle size={13} /> : <CircleDot size={13} />}
                            </div>

                            <span style={{ fontSize: 11, color: c.textSecondary, minWidth: 28 }}>
                              #{iss.githubNumber || iss.id}
                            </span>

                            <span
                              style={{
                                fontSize: 12,
                                fontWeight: 400,
                                color: c.textPrimary,
                                flex: 1,
                                textDecoration: isDone ? 'line-through' : 'none',
                                opacity: isDone ? 0.7 : 1,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {iss.title}
                            </span>

                            {/* Etiquetas */}
                            {iss.tag && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background: c.card,
                                  color: c.textSecondary,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {iss.tag}
                              </span>
                            )}

                            {iss.priority && (
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  padding: '1px 5px',
                                  borderRadius: 4,
                                  background:
                                    iss.priority === 'Alta' || iss.priority === 'Urgente'
                                      ? c.dangerBg
                                      : c.card,
                                  color:
                                    iss.priority === 'Alta' || iss.priority === 'Urgente'
                                      ? c.danger
                                      : c.textSecondary,
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                {iss.priority}
                              </span>
                            )}

                            {/* Responsáveis */}
                            {iss.assignees && iss.assignees.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                                {iss.assignees.slice(0, 2).map((a, aIdx) => {
                                  const collab = (collaborators || []).find(
                                    (c: any) => (c.login || c.name || '').toLowerCase() === (a.name || '').toLowerCase()
                                  );
                                  const effectiveAvatar =
                                    a.avatarUrl ||
                                    collab?.avatarUrl ||
                                    collab?.avatar_url ||
                                    (a.name && a.name !== 'Sem responsável' ? `https://github.com/${a.name}.png?size=40` : undefined);
                                  return (
                                    <MemberAvatar
                                      key={aIdx}
                                      name={a.name}
                                      avatarUrl={effectiveAvatar}
                                      avatarBg={a.avatarBg}
                                      initial={a.initial}
                                      size={17}
                                      accentColor={accentColor}
                                    />
                                  );
                                })}
                              </div>
                            )}

                            {/* Desvincular Tarefa */}
                            {onAssignIssueToMilestone && (
                              <button
                                type="button"
                                title="Desvincular do marco"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAssignIssueToMilestone(iss.githubNumber || 0, null);
                                  showToast(`Tarefa #${iss.githubNumber || iss.id} desvinculada.`);
                                }}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  color: c.textMuted,
                                  cursor: 'pointer',
                                  padding: 2,
                                  display: 'flex',
                                  borderRadius: 3,
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = c.danger)}
                                onMouseLeave={(e) => (e.currentTarget.style.color = c.textMuted)}
                              >
                                <X size={12} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Resizer Horizontal: Entre Lista de Tarefas e Painéis de Qualidade */}
              <div
                data-testid="resizer-milestone-right-col"
                className={`resizer-col ${isDraggingRightCol ? 'dragging' : ''}`}
                onMouseDown={startResizeRightCol}
                onDoubleClick={resetRightPanelWidth}
                title="Arraste para redimensionar horizontalmente (Duplo clique para restaurar 320px)"
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

              {/* =============================================================== */}
              {/* SUB-COLUNA 2: QUALIDADE & ENTREGA (PAINÉIS MODULARES)            */}
              {/* =============================================================== */}
              <div
                ref={rightPanelRef}
                data-testid="milestone-right-panel"
                style={{
                  width: rightPanelWidth,
                  minWidth: 220,
                  maxWidth: 600,
                  flexShrink: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 0,
                  height: '100%',
                  overflow: 'hidden',
                }}
              >
                {/* 1. Card de Critérios de Homologação (DoD) */}
                <div
                  style={{
                    background: c.card,
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    border: 'none',
                    boxShadow: 'none',
                    flex: `${panelRatios.dod} 1 0px`,
                    minHeight: 70,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <CheckSquare size={13} color={accentColor} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: c.textPrimary }}>Critérios DoD</span>
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 500, color: c.textSecondary }}>
                      {currentQualityGates.filter((g) => g.completed).length}/{currentQualityGates.length}
                    </span>
                  </div>

                  {/* Barra de Progresso DoD */}
                  <div
                    style={{
                      width: '100%',
                      height: 3,
                      background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                      borderRadius: 2,
                      overflow: 'hidden',
                      flexShrink: 0,
                    }}
                  >
                    <div
                      style={{
                        width: `${
                          currentQualityGates.length > 0
                            ? Math.round(
                                (currentQualityGates.filter((g) => g.completed).length /
                                  currentQualityGates.length) *
                                  100
                              )
                            : 0
                        }%`,
                        height: '100%',
                        background: c.success,
                        borderRadius: 2,
                      }}
                    />
                  </div>

                  {/* Lista de Critérios */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 3, flex: 1, minHeight: 30, overflowY: 'auto' }}>
                    {currentQualityGates.map((g) => (
                      <div
                        key={g.id}
                        onClick={() => handleToggleGate(g.id)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 7,
                          padding: '4px 6px',
                          borderRadius: 4,
                          background: c.cardSecondary,
                          cursor: 'pointer',
                        }}
                      >
                        <div
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: 3,
                            border: `1px solid ${g.completed ? c.success : c.textSecondary}`,
                            background: g.completed ? c.success : 'transparent',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            flexShrink: 0,
                          }}
                        >
                          {g.completed && <Check size={10} color="#ffffff" />}
                        </div>
                        <span
                          style={{
                            fontSize: 11,
                            color: g.completed ? c.textSecondary : c.textPrimary,
                            textDecoration: g.completed ? 'line-through' : 'none',
                            flex: 1,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {g.label}
                        </span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGate(g.id);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: c.textMuted,
                            cursor: 'pointer',
                            padding: 0,
                            display: 'flex',
                          }}
                        >
                          <X size={10} />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Input Rápido para Novo Critério */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      background: c.inputBg,
                      borderRadius: 4,
                      padding: '3px 6px',
                      flexShrink: 0,
                    }}
                  >
                    <input
                      type="text"
                      placeholder="+ Adicionar critério..."
                      value={newGateText}
                      onChange={(e) => setNewGateText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleAddGate();
                      }}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        fontSize: 11,
                        color: c.textPrimary,
                        width: '100%',
                      }}
                    />
                    {newGateText.trim() && (
                      <button
                        type="button"
                        onClick={handleAddGate}
                        style={{
                          background: accentColor,
                          color: accentContrastText,
                          border: 'none',
                          borderRadius: 3,
                          padding: '1px 5px',
                          fontSize: 10,
                          cursor: 'pointer',
                        }}
                      >
                        Add
                      </button>
                    )}
                  </div>
                </div>

                {/* Resizer 1: Entre DoD e Equipe */}
                <div
                  data-testid="resizer-dod-team"
                  className={`resizer-row ${activeDragSplitter === 'dod-team' ? 'dragging' : ''}`}
                  onMouseDown={startResizeDodTeam}
                  onDoubleClick={resetPanelRatios}
                  title="Arraste para redimensionar verticalmente (Duplo clique para restaurar)"
                  style={{
                    height: 8,
                    margin: '-1px 0',
                    cursor: 'row-resize',
                    position: 'relative',
                    zIndex: 20,
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                />

                {/* 2. Card de Equipe & Alocação */}
                <div
                  style={{
                    background: c.card,
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    border: 'none',
                    boxShadow: 'none',
                    flex: `${panelRatios.team} 1 0px`,
                    minHeight: 70,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <Users size={13} color={accentColor} />
                    <span style={{ fontSize: 12, fontWeight: 500, color: c.textPrimary }}>Equipe & Alocação</span>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 4,
                      flex: 1,
                      minHeight: 30,
                      overflowY: 'auto',
                    }}
                  >
                    {workloadByMember.length === 0 ? (
                      <div style={{ fontSize: 11, color: c.textSecondary, padding: '6px 0', textAlign: 'center' }}>
                        Nenhum membro atribuído às tarefas.
                      </div>
                    ) : (
                      workloadByMember.map((w) => {
                        const pct = w.total > 0 ? Math.round((w.closed / w.total) * 100) : 0;
                        return (
                          <div
                            key={w.member}
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 3,
                              background: c.cardSecondary,
                              padding: '6px 8px',
                              borderRadius: 5,
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                                <MemberAvatar
                                  name={w.member}
                                  avatarUrl={w.avatarUrl}
                                  avatarBg={w.avatarBg}
                                  initial={w.initial}
                                  size={18}
                                  accentColor={accentColor}
                                />
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
                                  {w.member}
                                </span>
                              </div>
                              <span style={{ fontSize: 10, color: c.textSecondary, flexShrink: 0 }}>
                                {w.closed}/{w.total} ({pct}%)
                              </span>
                            </div>
                            <div
                              style={{
                                width: '100%',
                                height: 3,
                                background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
                                borderRadius: 2,
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
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Resizer 2: Entre Equipe e Release Notes */}
                <div
                  data-testid="resizer-team-release"
                  className={`resizer-row ${activeDragSplitter === 'team-release' ? 'dragging' : ''}`}
                  onMouseDown={startResizeTeamRelease}
                  onDoubleClick={resetPanelRatios}
                  title="Arraste para redimensionar verticalmente (Duplo clique para restaurar)"
                  style={{
                    height: 8,
                    margin: '-1px 0',
                    cursor: 'row-resize',
                    position: 'relative',
                    zIndex: 20,
                    userSelect: 'none',
                    flexShrink: 0,
                  }}
                />

                {/* 3. Card de Release Notes IA */}
                <div
                  style={{
                    background: c.card,
                    borderRadius: 8,
                    padding: '10px 12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 6,
                    border: 'none',
                    boxShadow: 'none',
                    flex: `${panelRatios.release} 1 0px`,
                    minHeight: 80,
                    overflow: 'hidden',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Sparkles size={13} color={accentColor} />
                      <span style={{ fontSize: 12, fontWeight: 500, color: c.textPrimary }}>Release Notes (IA)</span>
                    </div>

                    {generatedChangelog && (
                      <button
                        type="button"
                        onClick={handleCopyChangelog}
                        title="Copiar Markdown"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3,
                          background: 'transparent',
                          border: 'none',
                          color: c.textSecondary,
                          fontSize: 10.5,
                          cursor: 'pointer',
                          padding: 0,
                        }}
                      >
                        <Copy size={11} />
                        <span>Copiar</span>
                      </button>
                    )}
                  </div>

                  {!generatedChangelog ? (
                    <div
                      style={{
                        flex: 1,
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 8,
                        padding: 10,
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ fontSize: 11, color: c.textSecondary, lineHeight: 1.4 }}>
                        Sintetize tarefas entregues em um changelog formatado em Markdown.
                      </span>
                      <button
                        type="button"
                        onClick={handleGenerateChangelog}
                        disabled={isGeneratingChangelog}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          background: accentColor,
                          color: accentContrastText,
                          border: 'none',
                          borderRadius: 5,
                          padding: '5px 12px',
                          fontSize: 11,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                      >
                        <Sparkles size={12} />
                        <span>{isGeneratingChangelog ? 'Gerando...' : 'Gerar com IA'}</span>
                      </button>
                    </div>
                  ) : (
                    <div
                      style={{
                        flex: 1,
                        minHeight: 0,
                        background: c.cardSecondary,
                        borderRadius: 6,
                        padding: 8,
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: c.textPrimary,
                        overflowY: 'auto',
                        whiteSpace: 'pre-wrap',
                      }}
                    >
                      {generatedChangelog}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* ========================================================================= */}
      {/* MODAL DE VINCULAR TAREFAS EXISTENTES AO MARCO                              */}
      {/* ========================================================================= */}
      {isLinkingModalOpen && (
        <div
          onClick={() => setIsLinkingModalOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 440,
              maxHeight: 460,
              background: c.card,
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13.5, fontWeight: 500, color: c.textPrimary }}>
                Vincular Tarefas a "{currentMilestone?.title}"
              </span>
              <button
                type="button"
                onClick={() => setIsLinkingModalOpen(false)}
                style={{ background: 'transparent', border: 'none', color: c.textSecondary, cursor: 'pointer' }}
              >
                <X size={15} />
              </button>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: c.inputBg,
                borderRadius: 6,
                padding: '6px 10px',
                border: 'none',
              }}
            >
              <Search size={12} color={c.textSecondary} />
              <input
                type="text"
                placeholder="Buscar tarefas não vinculadas..."
                value={linkSearch}
                onChange={(e) => setLinkSearch(e.target.value)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  fontSize: 12,
                  color: c.textPrimary,
                  width: '100%',
                }}
              />
            </div>

            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 280 }}>
              {filteredUnassignedIssues.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', fontSize: 12, color: c.textSecondary }}>
                  Nenhuma tarefa disponível para vinculação.
                </div>
              ) : (
                filteredUnassignedIssues.map((iss) => (
                  <div
                    key={iss.id || iss.githubNumber}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 8,
                      padding: '7px 10px',
                      borderRadius: 6,
                      background: c.cardSecondary,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                      <span style={{ fontSize: 11, color: c.textSecondary }}>#{iss.githubNumber || iss.id}</span>
                      <span
                        style={{
                          fontSize: 12,
                          color: c.textPrimary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {iss.title}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (currentMilestone && onAssignIssueToMilestone) {
                          onAssignIssueToMilestone(iss.githubNumber || 0, currentMilestone.number);
                          showToast(`Tarefa #${iss.githubNumber || iss.id} vinculada.`);
                        }
                      }}
                      style={{
                        background: accentColor,
                        color: accentContrastText,
                        border: 'none',
                        borderRadius: 4,
                        padding: '3px 8px',
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Vincular
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO (REGRA OBRIGATÓRIA AGENTS.md)             */}
      {/* ========================================================================= */}
      <ConfirmDeleteModal
        isOpen={!!deletingMilestone}
        title="Excluir Marco"
        message={`Tem certeza que deseja excluir o marco "${deletingMilestone?.title}"?`}
        itemDescription="As tarefas vinculadas a este marco não serão excluídas, mas ficarão desassociadas de qualquer marco."
        confirmLabel="Excluir Marco"
        isDeleting={isDeleting}
        onConfirm={handleConfirmDelete}
        onClose={() => setDeletingMilestone(null)}
      />
    </div>
  );
};
