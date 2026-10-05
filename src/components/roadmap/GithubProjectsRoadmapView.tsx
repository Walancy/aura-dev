import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Plus,
  CircleDot,
  CheckCircle2,
  Calendar,
  ArrowUpDown,
  Pin,
} from 'lucide-react';
import type { ProjectIssue } from '../ProjectsSchedulerView';

export interface GithubProjectsRoadmapViewProps {
  issues: ProjectIssue[];
  repoName?: string;
  theme?: any;
  isEffectiveDark?: boolean;
  accentColor?: string;
  accentContrastText?: string;
  onOpenIssueDetail?: (issue: ProjectIssue) => void;
  onUpdateIssueDates?: (issueId: string, startDateIso: string, dueDateIso: string) => void;
  onAddNewIssue?: () => void;
  showToast?: (msg: string) => void;
}

export const MONTH_NAMES_PT = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];

export const GithubProjectsRoadmapViewInner: React.FC<GithubProjectsRoadmapViewProps> = ({
  issues = [],
  repoName = 'repositório',
  theme = {},
  isEffectiveDark = true,
  accentColor = '#FF6A00',
  accentContrastText = '#ffffff',
  onOpenIssueDetail = () => {},
  onUpdateIssueDates,
  onAddNewIssue,
  showToast,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [viewYear, setViewYear] = useState(() => new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => new Date().getMonth()); // 0-indexed
  const [leftColWidth, setLeftColWidth] = useState(360);
  const [isResizingLeftCol, setIsResizingLeftCol] = useState(false);
  const [sortOrder, setSortOrder] = useState<'default' | 'asc' | 'desc'>('default');
  const [showMarkers, setShowMarkers] = useState(true);
  const [dateFieldMode, setDateFieldMode] = useState<'issue' | 'sprint'>('issue');
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false);

  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const leftTableScrollRef = useRef<HTMLDivElement>(null);

  // Safe theme tokens
  const textPrimary = theme?.textPrimary || (isEffectiveDark ? '#ffffff' : '#0f172a');
  const textSecondary = theme?.textSecondary || (isEffectiveDark ? '#888888' : '#64748b');
  const textMuted = theme?.textMuted || (isEffectiveDark ? '#555555' : '#94a3b8');
  const viewCanvasBg = theme?.viewCanvasBg || (isEffectiveDark ? '#141414' : '#f8fafc');
  const controlBg = theme?.controlBg || (isEffectiveDark ? '#181818' : '#ffffff');
  const controlHoverBg = theme?.controlHoverBg || (isEffectiveDark ? '#242424' : '#f8fafc');

  // Data de hoje
  const today = useMemo(() => new Date(), []);
  const todayIso = useMemo(() => {
    try {
      const y = today.getFullYear();
      const m = String(today.getMonth() + 1).padStart(2, '0');
      const d = String(today.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    } catch {
      return '';
    }
  }, [today]);

  // Gerar dias do mês atual + dias do mês adjacente para um grid amplo contínuo
  const { daysList, monthTitle } = useMemo(() => {
    try {
      const curDate = new Date(viewYear, viewMonth, 1);
      const monthFormatter = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' });
      const monthName = monthFormatter.format(curDate);
      const capitalizedMonth = monthName.charAt(0).toUpperCase() + monthName.slice(1);

      const days: { date: Date; dayNum: number; iso: string; isCurrentMonth: boolean; isWeekend: boolean; isToday: boolean }[] = [];
      const startDate = new Date(viewYear, viewMonth, 1);
      startDate.setDate(startDate.getDate() - 3);

      for (let i = 0; i < 40; i++) {
        const d = new Date(startDate);
        d.setDate(startDate.getDate() + i);

        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dayStr = String(d.getDate()).padStart(2, '0');
        const iso = `${y}-${m}-${dayStr}`;

        days.push({
          date: d,
          dayNum: d.getDate(),
          iso,
          isCurrentMonth: d.getMonth() === viewMonth,
          isWeekend: d.getDay() === 0 || d.getDay() === 6,
          isToday: iso === todayIso,
        });
      }

      return { daysList: days, monthTitle: capitalizedMonth };
    } catch {
      return { daysList: [], monthTitle: '' };
    }
  }, [viewYear, viewMonth, todayIso]);

  // Filtragem de issues segura
  const filteredIssues = useMemo(() => {
    let list = Array.isArray(issues) ? issues : [];
    if (searchFilter.trim()) {
      const q = searchFilter.toLowerCase().trim();
      list = list.filter((iss) => {
        if (!iss) return false;
        const matchTitle = String(iss.title || '').toLowerCase().includes(q);
        const matchId = String(iss.id || '').toLowerCase().includes(q) || String(iss.githubNumber || '').includes(q);
        const matchTag = String(iss.tag || '').toLowerCase().includes(q);
        const matchLabels = Array.isArray(iss.rawLabels)
          ? iss.rawLabels.some((l) => String(l || '').toLowerCase().includes(q))
          : false;
        return matchTitle || matchId || matchTag || matchLabels;
      });
    }

    if (sortOrder === 'asc') {
      return [...list].sort((a, b) => String(a?.title || '').localeCompare(String(b?.title || '')));
    }
    if (sortOrder === 'desc') {
      return [...list].sort((a, b) => String(b?.title || '').localeCompare(String(a?.title || '')));
    }
    return list;
  }, [issues, searchFilter, sortOrder]);

  // Sincronizar scroll vertical entre a tabela da esquerda e a timeline da direita
  const handleLeftScroll = () => {
    try {
      if (leftTableScrollRef.current && timelineScrollRef.current) {
        timelineScrollRef.current.scrollTop = leftTableScrollRef.current.scrollTop;
      }
    } catch (_) {}
  };

  const handleRightScroll = () => {
    try {
      if (leftTableScrollRef.current && timelineScrollRef.current) {
        leftTableScrollRef.current.scrollTop = timelineScrollRef.current.scrollTop;
      }
    } catch (_) {}
  };

  // Navegar meses
  const handlePrevMonth = () => {
    if (viewMonth === 0) {
      setViewMonth(11);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 11) {
      setViewMonth(0);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const handleJumpToToday = () => {
    try {
      const now = new Date();
      setViewYear(now.getFullYear());
      setViewMonth(now.getMonth());

      setTimeout(() => {
        try {
          const todayEl = document.getElementById('roadmap-today-col');
          if (todayEl && timelineScrollRef.current) {
            const offsetLeft = todayEl.offsetLeft;
            timelineScrollRef.current.scrollTo({
              left: Math.max(0, offsetLeft - 200),
              behavior: 'smooth',
            });
          }
        } catch (_) {}
      }, 100);
    } catch (_) {}
  };

  useEffect(() => {
    handleJumpToToday();
  }, []);

  // Redimensionamento da coluna esquerda
  const handleMouseDownResize = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizingLeftCol(true);

    const startX = e.clientX;
    const startW = leftColWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const diff = moveEvent.clientX - startX;
      const newW = Math.max(220, Math.min(600, startW + diff));
      setLeftColWidth(newW);
    };

    const onMouseUp = () => {
      setIsResizingLeftCol(false);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const DAY_COL_WIDTH = 42;
  const ROW_HEIGHT = 38;

  // Calcular barra para uma issue de forma 100% à prova de falhas
  const getTaskBarSpan = (task: ProjectIssue) => {
    try {
      if (!task || !daysList || daysList.length === 0) return null;
      const firstDayIso = daysList[0].iso;
      const lastDayIso = daysList[daysList.length - 1].iso;

      let startIso: string | undefined = task.startDateIso;
      let dueIso: string | undefined = task.dueDateIso;

      if (!startIso && !dueIso) {
        if (task.createdAtIso && typeof task.createdAtIso === 'string') {
          startIso = task.createdAtIso.slice(0, 10);
          const d = new Date(startIso);
          if (!isNaN(d.getTime())) {
            const dur = Number(task.durationDays);
            d.setDate(d.getDate() + (isNaN(dur) || dur < 1 ? 5 : dur));
            if (!isNaN(d.getTime())) {
              dueIso = d.toISOString().slice(0, 10);
            }
          }
        }
        if (!startIso || !dueIso) {
          const rawUpdated = (task as any).updatedAtIso;
          const baseDate = rawUpdated ? new Date(rawUpdated) : new Date();
          if (!isNaN(baseDate.getTime())) {
            startIso = baseDate.toISOString().slice(0, 10);
            const due = new Date(baseDate);
            due.setDate(due.getDate() + 3);
            dueIso = due.toISOString().slice(0, 10);
          }
        }
      } else if (startIso && !dueIso) {
        const d = new Date(startIso);
        if (!isNaN(d.getTime())) {
          d.setDate(d.getDate() + 4);
          if (!isNaN(d.getTime())) {
            dueIso = d.toISOString().slice(0, 10);
          }
        }
      } else if (!startIso && dueIso) {
        const d = new Date(dueIso);
        if (!isNaN(d.getTime())) {
          d.setDate(d.getDate() - 4);
          if (!isNaN(d.getTime())) {
            startIso = d.toISOString().slice(0, 10);
          }
        }
      }

      if (!startIso || !dueIso) return null;

      const startIndex = daysList.findIndex((d) => d.iso >= startIso!);
      const endIndex = daysList.findIndex((d) => d.iso >= dueIso!);

      const effectiveStart = startIndex === -1 ? (startIso < firstDayIso ? 0 : daysList.length) : startIndex;
      const effectiveEnd = endIndex === -1 ? (dueIso > lastDayIso ? daysList.length - 1 : 0) : endIndex;

      if (effectiveStart >= daysList.length && effectiveEnd >= daysList.length) return null;
      if (effectiveStart <= 0 && effectiveEnd <= 0 && dueIso < firstDayIso) return null;
      if (effectiveStart >= daysList.length && startIso > lastDayIso) return null;

      const clampedStart = Math.max(0, Math.min(effectiveStart, daysList.length - 1));
      const clampedEnd = Math.max(clampedStart, Math.min(effectiveEnd, daysList.length - 1));

      const spanCols = Math.max(1, clampedEnd - clampedStart + 1);
      const leftPx = clampedStart * DAY_COL_WIDTH;
      const widthPx = Math.max(20, spanCols * DAY_COL_WIDTH - 6);

      return {
        leftPx,
        widthPx,
        startIso,
        dueIso,
      };
    } catch {
      return null;
    }
  };

  const handleShiftIssueDates = (task: ProjectIssue, deltaDays: number, mode: 'both' | 'start' | 'due' = 'both') => {
    if (!task || deltaDays === 0 || !onUpdateIssueDates) return;
    const span = getTaskBarSpan(task);
    if (!span) return;
    const sDate = new Date(span.startIso);
    const dDate = new Date(span.dueIso);
    if (mode === 'both' || mode === 'start') {
      sDate.setDate(sDate.getDate() + deltaDays);
    }
    if (mode === 'both' || mode === 'due') {
      dDate.setDate(dDate.getDate() + deltaDays);
    }
    if (sDate > dDate) return;
    const newStart = sDate.toISOString().slice(0, 10);
    const newDue = dDate.toISOString().slice(0, 10);
    onUpdateIssueDates(task.id, newStart, newDue);
    showToast?.(`Datas de #${task.githubNumber || task.id} alteradas para ${newStart} → ${newDue}`);
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100%',
        flex: 1,
        minHeight: 460,
        gap: 8,
        boxSizing: 'border-box',
        fontFamily: "'Poppins', -apple-system, sans-serif",
      }}
    >


      {/* ----------------------------------------------------------------- */}
      {/* BARRA DE CONTROLES DO ROADMAP: MÊS/ANO + BOTÕES AUXILIARES         */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '4px 6px',
          borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}`,
          flexWrap: 'wrap',
          gap: 8,
        }}
      >
        {/* Título do Mês */}
        <div style={{ fontSize: 13, fontWeight: 600, color: textPrimary, letterSpacing: '-0.01em' }}>
          {monthTitle || 'Roadmap'}
        </div>

        {/* Ferramentas: Markers, Sort, Date Fields, Month, Today, Setas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            onClick={() => {
              setShowMarkers((m) => {
                const next = !m;
                showToast?.(next ? 'Marcadores ativados.' : 'Marcadores desativados.');
                return next;
              });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: showMarkers ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)') : 'transparent',
              border: 'none',
              color: showMarkers ? accentColor : textSecondary,
              fontSize: 11.5,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = showMarkers ? accentColor : textSecondary)}
            title="Alternar marcadores verticais no cronograma"
          >
            <Pin size={12} />
            <span>Markers</span>
          </button>

          <button
            type="button"
            onClick={() => setSortOrder((s) => (s === 'default' ? 'asc' : s === 'asc' ? 'desc' : 'default'))}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: 'transparent',
              border: 'none',
              color: sortOrder !== 'default' ? accentColor : textSecondary,
              fontSize: 11.5,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = sortOrder !== 'default' ? accentColor : textSecondary)}
          >
            <ArrowUpDown size={12} />
            <span>Sort</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setDateFieldMode((m) => {
                const next = m === 'issue' ? 'sprint' : 'issue';
                showToast?.(next === 'issue' ? 'Exibindo datas da Issue' : 'Exibindo datas vinculadas da Sprint');
                return next;
              });
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              background: dateFieldMode === 'sprint' ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)') : 'transparent',
              border: 'none',
              color: dateFieldMode === 'sprint' ? accentColor : textSecondary,
              fontSize: 11.5,
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
            onMouseLeave={(e) => (e.currentTarget.style.color = dateFieldMode === 'sprint' ? accentColor : textSecondary)}
            title="Alternar campo de datas utilizado"
          >
            <Calendar size={12} />
            <span>Date fields: {dateFieldMode === 'issue' ? 'Issue' : 'Sprint'}</span>
          </button>

          <div
            style={{
              height: 14,
              width: 1,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)',
              margin: '0 4px',
            }}
          />

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setIsMonthPickerOpen((p) => !p)}
              style={{
                fontSize: 11.5,
                color: isMonthPickerOpen ? accentColor : textSecondary,
                padding: '3px 7px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                borderRadius: 4,
                display: 'flex',
                alignItems: 'center',
                gap: 4,
              }}
              title="Mudar mês do roadmap"
            >
              <span>{monthTitle || 'Mês'}</span>
              <ChevronDown size={11} />
            </button>
            {isMonthPickerOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 24,
                  right: 0,
                  background: isEffectiveDark ? '#161b22' : '#ffffff',
                  border: isEffectiveDark ? '1px solid #30363d' : '1px solid #d0d7de',
                  borderRadius: 6,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                  padding: 6,
                  zIndex: 100,
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 4,
                  minWidth: 190,
                }}
              >
                {MONTH_NAMES_PT.map((mName, mIdx) => (
                  <button
                    key={mIdx}
                    type="button"
                    onClick={() => {
                      setViewMonth(mIdx);
                      setIsMonthPickerOpen(false);
                    }}
                    style={{
                      padding: '4px 6px',
                      fontSize: 11,
                      border: 'none',
                      borderRadius: 4,
                      cursor: 'pointer',
                      background: viewMonth === mIdx ? accentColor : 'transparent',
                      color: viewMonth === mIdx ? accentContrastText : textPrimary,
                    }}
                  >
                    {mName.slice(0, 3)}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleJumpToToday}
            style={{
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
              border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
              borderRadius: 5,
              padding: '3px 9px',
              color: textPrimary,
              fontSize: 11.5,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Today
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <button
              type="button"
              onClick={handlePrevMonth}
              style={{
                background: 'transparent',
                border: 'none',
                color: textSecondary,
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
            >
              <ChevronLeft size={14} />
            </button>
            <button
              type="button"
              onClick={handleNextMonth}
              style={{
                background: 'transparent',
                border: 'none',
                color: textSecondary,
                cursor: 'pointer',
                padding: 4,
                borderRadius: 4,
                display: 'flex',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* GRID PRINCIPAL: TABELA DE TAREFAS À ESQUERDA + TIMELINE À DIREITA */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          flex: 1,
          border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
          borderRadius: 8,
          overflow: 'hidden',
          background: viewCanvasBg,
          position: 'relative',
        }}
      >
        {/* =============================================================== */}
        {/* COLUNA ESQUERDA: LISTA DE TAREFAS NUMERADAS                     */}
        {/* =============================================================== */}
        <div
          style={{
            width: leftColWidth,
            minWidth: 220,
            maxWidth: 600,
            display: 'flex',
            flexDirection: 'column',
            borderRight: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
            flexShrink: 0,
            background: viewCanvasBg,
          }}
        >
          {/* Cabeçalho da Tabela Esquerda */}
          <div
            style={{
              height: 34,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 12px',
              borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
              background: isEffectiveDark ? '#161616' : '#f8fafc',
              fontSize: 11,
              fontWeight: 600,
              color: textSecondary,
            }}
          >
            <span>Item</span>
            {onAddNewIssue && (
              <button
                type="button"
                onClick={onAddNewIssue}
                title="Adicionar item"
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: textSecondary,
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
              >
                <Plus size={13} />
              </button>
            )}
          </div>

          {/* Linhas de Tarefas da Esquerda */}
          <div
            ref={leftTableScrollRef}
            onScroll={handleLeftScroll}
            style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
            }}
            className="no-scrollbar"
          >
            {filteredIssues.map((task, idx) => {
              if (!task) return null;
              const isClosed = task.status === 'Concluído' || task.rawState === 'closed';
              const displayId = task.githubNumber || (typeof task.id === 'string' ? task.id.replace(/^issue-/, '') : String(task.id ?? idx + 1));
              const titleText = String(task.title || 'Sem título');

              return (
                <div
                  key={task.id || `task-${idx}`}
                  onClick={() => onOpenIssueDetail(task)}
                  style={{
                    height: ROW_HEIGHT,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0 10px',
                    borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'}`,
                    cursor: 'pointer',
                    transition: 'background 0.12s ease',
                    gap: 8,
                    boxSizing: 'border-box',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isEffectiveDark ? '#1c1c1c' : '#f1f5f9';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                    {/* Número da linha */}
                    <span style={{ fontSize: 11, color: textSecondary, width: 20, textAlign: 'right', flexShrink: 0 }}>
                      {idx + 1}
                    </span>

                    {/* Ícone de status */}
                    {isClosed ? (
                      <CheckCircle2 size={13.5} color="#8957e5" style={{ flexShrink: 0 }} />
                    ) : (
                      <CircleDot size={13.5} color="#22c55e" style={{ flexShrink: 0 }} />
                    )}

                    {/* Título da Atividade + #ID */}
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 400,
                        color: textPrimary,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                      title={titleText}
                    >
                      {titleText}{' '}
                      <span style={{ color: textSecondary, fontSize: 11 }}>#{displayId}</span>
                    </span>
                  </div>

                  {/* Botão + de ação rápida */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onOpenIssueDetail(task);
                    }}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: textSecondary,
                      cursor: 'pointer',
                      padding: 2,
                      display: 'flex',
                      opacity: 0.5,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.opacity = '1';
                      e.currentTarget.style.color = textPrimary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.opacity = '0.5';
                      e.currentTarget.style.color = textSecondary;
                    }}
                  >
                    <Plus size={12} />
                  </button>
                </div>
              );
            })}

            {filteredIssues.length === 0 && (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: textSecondary, fontSize: 12 }}>
                Nenhuma tarefa encontrada.
              </div>
            )}
          </div>
        </div>

        {/* Resizer entre coluna esquerda e timeline */}
        <div
          onMouseDown={handleMouseDownResize}
          style={{
            width: 5,
            cursor: 'col-resize',
            background: isResizingLeftCol ? accentColor : 'transparent',
            zIndex: 10,
            margin: '0 -2px',
          }}
        />

        {/* =============================================================== */}
        {/* COLUNA DIREITA: GRID DE DIAS E BARRAS HORIZONTAIS DE ROADMAP   */}
        {/* =============================================================== */}
        <div
          ref={timelineScrollRef}
          onScroll={handleRightScroll}
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'auto',
            position: 'relative',
            background: viewCanvasBg,
          }}
          className="no-scrollbar"
        >
          {/* Cabeçalho de Dias */}
          <div
            style={{
              height: 34,
              display: 'flex',
              flexDirection: 'row',
              borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
              background: isEffectiveDark ? '#161616' : '#f8fafc',
              position: 'sticky',
              top: 0,
              zIndex: 5,
              width: Math.max(100, daysList.length * DAY_COL_WIDTH),
            }}
          >
            {daysList.map((day) => (
              <div
                key={day.iso}
                id={day.isToday ? 'roadmap-today-col' : undefined}
                style={{
                  width: DAY_COL_WIDTH,
                  minWidth: DAY_COL_WIDTH,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRight: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'}`,
                  background: day.isWeekend
                    ? isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.015)'
                      : 'rgba(0, 0, 0, 0.015)'
                    : 'transparent',
                  position: 'relative',
                }}
              >
                {/* Marcador Vermelho se for Hoje */}
                {day.isToday && (
                  <div
                    style={{
                      position: 'absolute',
                      top: 4,
                      width: 5,
                      height: 5,
                      borderRadius: '50%',
                      background: '#ef4444',
                    }}
                  />
                )}
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: day.isToday ? 700 : 500,
                    color: day.isToday ? '#ef4444' : day.isCurrentMonth ? textPrimary : textMuted,
                  }}
                >
                  {day.dayNum}
                </span>
              </div>
            ))}
          </div>

          {/* Grid de Linhas com Barras de Roadmap */}
          <div
            style={{
              position: 'relative',
              width: Math.max(100, daysList.length * DAY_COL_WIDTH),
              minHeight: Math.max(200, filteredIssues.length * ROW_HEIGHT),
            }}
          >
            {/* Linhas de fundo das colunas */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                right: 0,
                display: 'flex',
                flexDirection: 'row',
                pointerEvents: 'none',
              }}
            >
              {daysList.map((day) => (
                <div
                  key={day.iso}
                  style={{
                    width: DAY_COL_WIDTH,
                    minWidth: DAY_COL_WIDTH,
                    height: '100%',
                    borderRight: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)'}`,
                    background: day.isWeekend
                      ? isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.012)'
                        : 'rgba(0, 0, 0, 0.012)'
                      : 'transparent',
                    position: 'relative',
                  }}
                >
                  {/* Linha vertical contínua indicando "Hoje" */}
                  {day.isToday && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 0,
                        bottom: 0,
                        left: '50%',
                        width: 1.5,
                        background: '#ef4444',
                        zIndex: 3,
                        transform: 'translateX(-50%)',
                      }}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Linhas horizontais correspondentes a cada tarefa */}
            {filteredIssues.map((task, idx) => {
              if (!task) return null;
              const span = getTaskBarSpan(task);
              const isClosed = task.status === 'Concluído' || task.rawState === 'closed';
              const titleText = String(task.title || 'Sem título');

              // Cores da barra no estilo GitHub
              const barBg = isClosed
                ? isEffectiveDark
                  ? 'rgba(137, 87, 229, 0.28)'
                  : 'rgba(137, 87, 229, 0.2)'
                : task.status === 'Em Progresso'
                ? isEffectiveDark
                  ? 'rgba(245, 158, 11, 0.28)'
                  : 'rgba(245, 158, 11, 0.2)'
                : isEffectiveDark
                ? 'rgba(34, 197, 94, 0.28)'
                : 'rgba(34, 197, 94, 0.2)';

              const barBorder = isClosed
                ? '#8957e5'
                : task.status === 'Em Progresso'
                ? '#f59e0b'
                : '#22c55e';

              return (
                <div
                  key={task.id || `bar-${idx}`}
                  style={{
                    height: ROW_HEIGHT,
                    position: 'relative',
                    borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'}`,
                    boxSizing: 'border-box',
                  }}
                >
                  {span && (
                    <div
                      onClick={() => onOpenIssueDetail(task)}
                      title={`${titleText} (${span.startIso} → ${span.dueIso})`}
                      style={{
                        position: 'absolute',
                        top: 5,
                        height: ROW_HEIGHT - 10,
                        left: span.leftPx + 3,
                        width: span.widthPx,
                        background: barBg,
                        border: `1px solid ${barBorder}`,
                        borderRadius: 5,
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                        padding: '0 8px',
                        cursor: 'pointer',
                        zIndex: 2,
                        transition: 'transform 0.12s ease, box-shadow 0.12s ease',
                        boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
                        overflow: 'hidden',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'translateY(-1px)';
                        e.currentTarget.style.boxShadow = '0 2px 6px rgba(0,0,0,0.2)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.1)';
                      }}
                    >
                      {/* Handle Esquerdo de Redimensionamento */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const startX = e.clientX;
                          const onMouseUp = (ev: MouseEvent) => {
                            document.removeEventListener('mouseup', onMouseUp);
                            const deltaX = ev.clientX - startX;
                            const days = Math.round(deltaX / DAY_COL_WIDTH);
                            if (days !== 0) handleShiftIssueDates(task, days, 'start');
                          };
                          document.addEventListener('mouseup', onMouseUp);
                        }}
                        style={{
                          position: 'absolute',
                          left: 0,
                          top: 0,
                          bottom: 0,
                          width: 8,
                          cursor: 'ew-resize',
                          background: 'rgba(0, 0, 0, 0.2)',
                          zIndex: 5,
                        }}
                        title="Arrastar para alterar data de início"
                      />

                      {/* Handle Direito de Redimensionamento */}
                      <div
                        onMouseDown={(e) => {
                          e.stopPropagation();
                          const startX = e.clientX;
                          const onMouseUp = (ev: MouseEvent) => {
                            document.removeEventListener('mouseup', onMouseUp);
                            const deltaX = ev.clientX - startX;
                            const days = Math.round(deltaX / DAY_COL_WIDTH);
                            if (days !== 0) handleShiftIssueDates(task, days, 'due');
                          };
                          document.addEventListener('mouseup', onMouseUp);
                        }}
                        style={{
                          position: 'absolute',
                          right: 0,
                          top: 0,
                          bottom: 0,
                          width: 8,
                          cursor: 'ew-resize',
                          background: 'rgba(0, 0, 0, 0.2)',
                          zIndex: 5,
                        }}
                        title="Arrastar para alterar prazo final"
                      />
                      {isClosed ? (
                        <CheckCircle2 size={11.5} color="#8957e5" style={{ flexShrink: 0 }} />
                      ) : (
                        <CircleDot size={11.5} color="#22c55e" style={{ flexShrink: 0 }} />
                      )}
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: textPrimary,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {titleText}
                      </span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class GithubProjectsRoadmapView extends React.Component<
  GithubProjectsRoadmapViewProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[GithubProjectsRoadmapView] Erro na visualização de Roadmap:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const isDark = this.props.isEffectiveDark ?? true;
      return (
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 32,
            gap: 12,
            background: isDark ? '#141414' : '#f8fafc',
            borderRadius: 8,
            color: isDark ? '#ffffff' : '#0f172a',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
          }}
        >
          <div style={{ fontSize: 14, fontWeight: 600 }}>Não foi possível carregar a visualização de Roadmap</div>
          <div style={{ fontSize: 12, color: isDark ? '#888888' : '#64748b' }}>
            {this.state.error?.message || 'Ocorreu um erro inesperado ao renderizar as tarefas na linha do tempo.'}
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              marginTop: 8,
              padding: '6px 14px',
              borderRadius: 6,
              background: this.props.accentColor || '#FF6A00',
              color: this.props.accentContrastText || '#ffffff',
              border: 'none',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 500,
            }}
          >
            Tentar novamente
          </button>
        </div>
      );
    }
    return <GithubProjectsRoadmapViewInner {...this.props} />;
  }
}
