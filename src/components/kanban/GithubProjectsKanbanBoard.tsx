import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  MoreHorizontal,
  CircleDot,
  CheckCircle2,
  Clock,
  GitPullRequest,
  Copy,
} from 'lucide-react';
import type { ProjectIssue } from '../ProjectsSchedulerView';

export interface GithubProjectsKanbanBoardProps {
  issues: ProjectIssue[];
  repoName?: string;
  theme: any;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  onOpenIssueDetail: (issue: ProjectIssue) => void;
  columns?: KanbanColumnDef[];
  onMoveIssue: (issueId: string, targetColumnId: string) => void;
  onAddNewIssue?: (defaultColumnId?: string) => void;
  showToast?: (msg: string) => void;
}

export interface KanbanColumnDef {
  id: string;
  title: string;
  subtitle?: string;
  dotColor: string;
  isDoneType?: boolean;
  optionId?: string;
  limit?: number;
  estimateTotal?: number;
}

export const KANBAN_COLUMNS: KanbanColumnDef[] = [
  {
    id: 'backlog',
    title: 'Backlog',
    subtitle: 'This is in the backlog.',
    dotColor: '#94a3b8',
  },
  {
    id: 'todo',
    title: 'To-do',
    subtitle: "This item hasn't been started",
    dotColor: '#22c55e',
  },
  {
    id: 'in_progress',
    title: 'In Progress',
    subtitle: 'This is actively being worked on',
    dotColor: '#f59e0b',
  },
  {
    id: 'test',
    title: 'Test',
    subtitle: 'In test and review',
    dotColor: '#38bdf8',
  },
  {
    id: 'done',
    title: 'Done',
    subtitle: 'This has been completed',
    dotColor: '#8957e5',
    isDoneType: true,
  },
];

// Paleta para etiquetas no estilo GitHub sem bordas
const LABEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  bug: { bg: 'rgba(239, 68, 68, 0.15)', border: 'none', text: '#f87171' },
  painel: { bg: 'rgba(6, 182, 212, 0.15)', border: 'none', text: '#22d3ee' },
  enhancement: { bg: 'rgba(14, 165, 233, 0.15)', border: 'none', text: '#38bdf8' },
  feature: { bg: 'rgba(59, 130, 246, 0.15)', border: 'none', text: '#60a5fa' },
  guia: { bg: 'rgba(16, 185, 129, 0.15)', border: 'none', text: '#34d399' },
  viajante: { bg: 'rgba(20, 184, 166, 0.15)', border: 'none', text: '#2dd4bf' },
  documentation: { bg: 'rgba(168, 85, 247, 0.15)', border: 'none', text: '#c084fc' },
  urgente: { bg: 'rgba(244, 63, 94, 0.15)', border: 'none', text: '#fb7185' },
};

function getLabelStyle(labelName: string, isEffectiveDark: boolean) {
  const key = labelName.toLowerCase().trim();
  if (LABEL_COLORS[key]) return LABEL_COLORS[key];
  return {
    bg: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    border: 'none',
    text: isEffectiveDark ? '#d4d4d4' : '#525252',
  };
}

// Determinar coluna padrão de uma issue
export function getIssueKanbanColumn(issue: any, availableColumns?: KanbanColumnDef[]): string {
  const cols = availableColumns && availableColumns.length > 0 ? availableColumns : KANBAN_COLUMNS;

  // 1. Vinculação direta por kanbanColumnId
  if (issue.kanbanColumnId) {
    const target = String(issue.kanbanColumnId).toLowerCase().trim();
    const found = cols.find(
      (c) =>
        c.id.toLowerCase().trim() === target ||
        c.title.toLowerCase().trim() === target ||
        (c.optionId && c.optionId.toLowerCase() === target)
    );
    if (found) return found.id;
  }

  // 2. Vinculação direta por projectV2StatusOptionId ou projectV2Status vindo do GitHub Projects
  if (issue.projectV2StatusOptionId) {
    const found = cols.find((c) => c.optionId === issue.projectV2StatusOptionId);
    if (found) return found.id;
  }
  if (issue.projectV2Status) {
    const target = String(issue.projectV2Status).toLowerCase().trim();
    const found = cols.find(
      (c) =>
        c.title.toLowerCase().trim() === target ||
        c.id.toLowerCase().trim() === target
    );
    if (found) return found.id;
  }

  // 3. Fallback inteligente baseado no estado da issue
  const isClosed = issue.status === 'Concluído' || issue.rawState === 'closed';
  if (isClosed) {
    const doneCol = cols.find(
      (c) =>
        c.isDoneType ||
        c.id.toLowerCase().includes('done') ||
        c.title.toLowerCase().includes('done') ||
        c.title.toLowerCase().includes('conclu')
    );
    if (doneCol) return doneCol.id;
  }

  const rawLabels = (issue.rawLabels || []).map((l: string) => l.toLowerCase());
  if (rawLabels.includes('test') || rawLabels.includes('testing') || rawLabels.includes('em teste') || rawLabels.includes('qa')) {
    const testCol = cols.find((c) => c.id.toLowerCase().includes('test') || c.title.toLowerCase().includes('test'));
    if (testCol) return testCol.id;
  }

  if (issue.status === 'Em Progresso' || rawLabels.includes('em-progresso') || rawLabels.includes('in progress')) {
    const inProgCol = cols.find(
      (c) =>
        c.id.toLowerCase().includes('in_prog') ||
        c.id.toLowerCase().includes('progress') ||
        c.title.toLowerCase().includes('progress') ||
        c.title.toLowerCase().includes('progresso')
    );
    if (inProgCol) return inProgCol.id;
  }

  if (rawLabels.includes('waiting') || rawLabels.includes('bloqueado') || rawLabels.includes('blocked') || rawLabels.includes('espera')) {
    const waitCol = cols.find(
      (c) =>
        c.id.toLowerCase().includes('wait') ||
        c.title.toLowerCase().includes('wait') ||
        c.title.toLowerCase().includes('espera') ||
        c.title.toLowerCase().includes('bloq')
    );
    if (waitCol) return waitCol.id;
  }

  if (
    rawLabels.includes('backlog') ||
    (!issue.milestoneNumber && !issue.startDateIso && !issue.dueDateIso && issue.priority === 'Baixa')
  ) {
    const backlogCol = cols.find(
      (c) => c.id.toLowerCase().includes('backlog') || c.title.toLowerCase().includes('backlog')
    );
    if (backlogCol) return backlogCol.id;
  }

  const todoCol = cols.find(
    (c) =>
      c.id.toLowerCase().includes('todo') ||
      c.title.toLowerCase().includes('todo') ||
      c.title.toLowerCase().includes('to-do') ||
      c.title.toLowerCase().includes('fazer')
  );
  if (todoCol) return todoCol.id;

  return cols[0]?.id || 'todo';
}

export const GithubProjectsKanbanBoard: React.FC<GithubProjectsKanbanBoardProps> = ({
  issues,
  columns,
  repoName = 'repositório',
  theme,
  isEffectiveDark,
  accentColor,
  accentContrastText,
  onOpenIssueDetail,
  onMoveIssue,
  onAddNewIssue,
  showToast,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [columnMenuOpenId, setColumnMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!columnMenuOpenId) return;
    const handleDocumentClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-column-menu]')) {
        setColumnMenuOpenId(null);
      }
    };
    document.addEventListener('mousedown', handleDocumentClick);
    return () => document.removeEventListener('mousedown', handleDocumentClick);
  }, [columnMenuOpenId]);

  const activeColumns = useMemo(() => {
    return columns && columns.length > 0 ? columns : KANBAN_COLUMNS;
  }, [columns]);

  // Filtragem por busca
  const filteredIssues = useMemo(() => {
    if (!searchFilter.trim()) return issues;
    const q = searchFilter.toLowerCase().trim();
    return issues.filter((iss) => {
      const matchTitle = iss.title.toLowerCase().includes(q);
      const matchId = String(iss.id).toLowerCase().includes(q) || String(iss.githubNumber || '').includes(q);
      const matchTag = iss.tag?.toLowerCase().includes(q);
      const matchLabels = (iss.rawLabels || []).some((l) => l.toLowerCase().includes(q));
      const matchAssignee = (iss.assignees || []).some((a) => a.name.toLowerCase().includes(q));
      return matchTitle || matchId || matchTag || matchLabels || matchAssignee;
    });
  }, [issues, searchFilter]);

  // Agrupamento por coluna
  const issuesByColumn = useMemo(() => {
    const map: Record<string, ProjectIssue[]> = {};
    activeColumns.forEach((c) => {
      map[c.id] = [];
    });

    filteredIssues.forEach((iss) => {
      const colId = getIssueKanbanColumn(iss, activeColumns);
      if (map[colId]) {
        map[colId].push(iss);
      } else {
        const firstColId = activeColumns[0]?.id || 'todo';
        if (map[firstColId]) {
          map[firstColId].push(iss);
        }
      }
    });

    return map;
  }, [filteredIssues, activeColumns]);

  // Handlers de Drag and Drop
  const handleDragStart = (e: React.DragEvent, issueId: string) => {
    setDraggedIssueId(issueId);
    e.dataTransfer.setData('text/plain', issueId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragEnd = () => {
    setDraggedIssueId(null);
    setDragOverColumnId(null);
  };

  const handleDragOver = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverColumnId !== columnId) {
      setDragOverColumnId(columnId);
    }
  };

  const handleDragLeave = (e: React.DragEvent, columnId: string) => {
    // Apenas remove o highlight se estiver saindo do container principal da coluna
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    if (dragOverColumnId === columnId) {
      setDragOverColumnId(null);
    }
  };

  const handleDrop = (e: React.DragEvent, columnId: string) => {
    e.preventDefault();
    const issueId = e.dataTransfer.getData('text/plain') || draggedIssueId;
    if (issueId) {
      onMoveIssue(issueId, columnId);
    }
    setDraggedIssueId(null);
    setDragOverColumnId(null);
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
      {/* CORPO DO QUADRO: 5 COLUNAS LADO A LADO COM SCROLL HORIZONTAL     */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 10,
          alignItems: 'stretch',
          flex: 1,
          overflowX: 'auto',
          overflowY: 'hidden',
          paddingBottom: 4,
        }}
        className="no-scrollbar"
      >
        {activeColumns.map((col) => {
          const colCards = issuesByColumn[col.id] || [];
          const isDragOver = dragOverColumnId === col.id;
          const colEstimateSum = colCards.reduce(
            (acc, curr) => acc + (typeof curr.projectV2Estimate === 'number' ? curr.projectV2Estimate : 0),
            0
          );
          const hasLimit = typeof col.limit === 'number' && col.limit > 0;
          const isLimitExceeded = hasLimit && colCards.length > (col.limit as number);

          return (
            <div
              key={col.id}
              onDragOver={(e) => handleDragOver(e, col.id)}
              onDragLeave={(e) => handleDragLeave(e, col.id)}
              onDrop={(e) => handleDrop(e, col.id)}
              style={{
                flex: '1 0 250px',
                minWidth: 240,
                maxWidth: 380,
                background: isDragOver
                  ? isEffectiveDark
                    ? '#222222'
                    : '#e2e8f0'
                  : isEffectiveDark
                  ? '#161616'
                  : '#f1f5f9',
                borderRadius: 9,
                border: 'none',
                display: 'flex',
                flexDirection: 'column',
                transition: 'background 0.15s ease',
                overflow: 'hidden',
              }}
            >
              {/* CABEÇALHO DA COLUNA ESTILO GITHUB */}
              <div
                style={{
                  padding: '10px 12px 8px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                  borderBottom: `1px solid ${
                    isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.05)'
                  }`,
                  position: 'relative',
                }}
              >
                {/* Linha 1: Dot/Icon + Título + Badge + Estimate + Menus */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        background: `${col.dotColor}22`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                      }}
                    >
                      <div
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: '50%',
                          background: col.dotColor,
                        }}
                      />
                    </div>

                    <span style={{ fontSize: 13, fontWeight: 400, color: theme.textPrimary }}>
                      {col.title}
                    </span>

                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: isLimitExceeded ? '#ffffff' : theme.textSecondary,
                        background: isLimitExceeded
                          ? '#dc2626'
                          : isEffectiveDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : 'rgba(0, 0, 0, 0.06)',
                        padding: '1px 7px',
                        borderRadius: 10,
                        lineHeight: 1.3,
                      }}
                    >
                      {hasLimit ? `${colCards.length} / ${col.limit}` : colCards.length}
                    </span>

                    {(colEstimateSum > 0 || col.estimateTotal !== undefined) && (
                      <span
                        style={{
                          fontSize: 11,
                          fontWeight: 500,
                          color: theme.textSecondary,
                          background: isEffectiveDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.06)',
                          padding: '1px 7px',
                          borderRadius: 10,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        Estimate: {col.estimateTotal ?? colEstimateSum}
                      </span>
                    )}
                  </div>

                  {/* Ações da Coluna (··· e +) */}
                  <div data-column-menu style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 2 }}>
                    <button
                      type="button"
                      onClick={() => setColumnMenuOpenId((prev) => (prev === col.id ? null : col.id))}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: theme.textSecondary,
                        cursor: 'pointer',
                        padding: 3,
                        borderRadius: 4,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                      onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
                      title="Opções da coluna"
                    >
                      <MoreHorizontal size={14} />
                    </button>

                    {columnMenuOpenId === col.id && (
                      <div
                        style={{
                          position: 'absolute',
                          top: 24,
                          right: 0,
                          background: isEffectiveDark ? '#1a1a1a' : '#ffffff',
                          border: 'none',
                          borderRadius: 6,
                          boxShadow: 'none',
                          padding: 4,
                          zIndex: 100,
                          minWidth: 170,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 2,
                        }}
                      >
                        {onAddNewIssue && (
                          <button
                            type="button"
                            onClick={() => {
                              setColumnMenuOpenId(null);
                              onAddNewIssue(col.id);
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: theme.textPrimary,
                              fontSize: 12,
                              padding: '6px 8px',
                              textAlign: 'left',
                              cursor: 'pointer',
                              borderRadius: 4,
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <Plus size={13} />
                            <span>Adicionar tarefa</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard?.writeText?.(col.title || col.id);
                            showToast?.('Nome da coluna copiado!');
                            setColumnMenuOpenId(null);
                          }}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: theme.textPrimary,
                            fontSize: 12,
                            padding: '6px 8px',
                            textAlign: 'left',
                            cursor: 'pointer',
                            borderRadius: 4,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                        >
                          <Copy size={13} />
                          <span>Copiar nome da coluna</span>
                        </button>
                      </div>
                    )}

                    {onAddNewIssue && (
                      <button
                        type="button"
                        onClick={() => onAddNewIssue(col.id)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: theme.textSecondary,
                          cursor: 'pointer',
                          padding: 3,
                          borderRadius: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = theme.textPrimary)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = theme.textSecondary)}
                        title={`Adicionar item em ${col.title}`}
                      >
                        <Plus size={14} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Linha 2: Subtítulo descritivo estilo GitHub Projects */}
                {col.subtitle && (
                  <div style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 1.3 }}>
                    {col.subtitle}
                  </div>
                )}
              </div>

              {/* LISTA DE CARDS DRAGGABLE */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: 8,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 7,
                  minHeight: 120,
                }}
                className="no-scrollbar"
              >
                {colCards.map((task) => {
                  const isBeingDragged = draggedIssueId === task.id;
                  const isClosed = task.status === 'Concluído' || task.rawState === 'closed';
                  const assignee = task.assignees && task.assignees[0];

                  // Identificador limpo
                  const displayId = task.githubNumber || task.id.replace(/^issue-/, '');
                  const displayRepo = repoName.replace(/^.*\//, '');

                  // Rótulos / Labels
                  const labelsList =
                    task.rawLabels && task.rawLabels.length > 0
                      ? task.rawLabels
                      : task.tag
                      ? [task.tag]
                      : [];

                  return (
                    <div
                      key={task.id}
                      draggable={true}
                      onDragStart={(e) => handleDragStart(e, task.id)}
                      onDragEnd={handleDragEnd}
                      onClick={() => onOpenIssueDetail(task)}
                      style={{
                        background: isEffectiveDark ? '#202020' : '#ffffff',
                        border: 'none',
                        borderRadius: 7,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 7,
                        cursor: isBeingDragged ? 'grabbing' : 'grab',
                        opacity: isBeingDragged ? 0.35 : 1,
                        boxShadow: 'none',
                        transition: 'transform 0.12s ease, background 0.15s ease',
                        userSelect: 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isBeingDragged) {
                          e.currentTarget.style.background = isEffectiveDark ? '#262626' : '#f8fafc';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isBeingDragged) {
                          e.currentTarget.style.background = isEffectiveDark ? '#202020' : '#ffffff';
                          e.currentTarget.style.transform = 'translateY(0)';
                        }
                      }}
                    >
                      {/* Topo do Card: Ícone de Status + Repo e Número + Avatar */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, flex: 1 }}>
                          {isClosed ? (
                            <CheckCircle2 size={13.5} color="#8957e5" style={{ flexShrink: 0 }} />
                          ) : (
                            <CircleDot size={13.5} color="#22c55e" style={{ flexShrink: 0 }} />
                          )}
                          <span
                            style={{
                              fontSize: 11,
                              color: theme.textSecondary,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {displayRepo} #{displayId}
                          </span>
                        </div>

                        {assignee && (
                          <div
                            title={assignee.name}
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: assignee.avatarBg || '#525252',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 9.5,
                              color: '#ffffff',
                              fontWeight: 600,
                              flexShrink: 0,
                              overflow: 'hidden',
                              border: `1px solid ${isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                            }}
                          >
                            {assignee.avatarUrl ? (
                              <img
                                src={assignee.avatarUrl}
                                alt={assignee.name}
                                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                              />
                            ) : (
                              assignee.initial || assignee.name.charAt(0).toUpperCase()
                            )}
                          </div>
                        )}
                      </div>

                      {/* Título da Atividade */}
                      <div
                        style={{
                          fontSize: 12.5,
                          fontWeight: 500,
                          color: theme.textPrimary,
                          lineHeight: 1.35,
                          wordBreak: 'break-word',
                        }}
                      >
                        {task.title}
                      </div>

                      {/* Pull Request Link (se houver) */}
                      {task.pullRequest && (
                        <div
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 4,
                            fontSize: 10.5,
                            color: '#38bdf8',
                            alignSelf: 'flex-start',
                          }}
                        >
                          <GitPullRequest size={11} />
                          <span>#{task.pullRequest.number}</span>
                        </div>
                      )}

                      {/* Metadados: Estimate, Prioridade, Sprint e Labels */}
                      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 2 }}>
                        {/* Estimate Pill */}
                        {task.projectV2Estimate != null && (
                          <span
                            title={`Estimativa: ${task.projectV2Estimate}`}
                            style={{
                              fontSize: 10,
                              fontWeight: 400,
                              color: theme.textSecondary,
                              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                              border: 'none',
                              padding: '1px 6px',
                              borderRadius: 10,
                              lineHeight: 1.2,
                            }}
                          >
                            {task.projectV2Estimate}
                          </span>
                        )}

                        {/* Prioridade Circle */}
                        {task.priority && (
                          <span
                            title={`Prioridade: ${task.priority}`}
                            style={{
                              width: 17,
                              height: 17,
                              borderRadius: '50%',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: 9.5,
                              fontWeight: 400,
                              color: task.priorityColor || theme.textSecondary,
                              border: 'none',
                              background: task.priorityColor ? `${task.priorityColor}22` : (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)'),
                              boxSizing: 'border-box',
                            }}
                          >
                            {task.priority === 'Baixa' ? 'B' : task.priority === 'Média' ? 'M' : task.priority === 'Alta' ? 'A' : 'U'}
                          </span>
                        )}

                        {/* Sprint / Iteration Pill */}
                        {(task.iterationTitle || task.milestoneTitle) && (
                          <span
                            title={`Sprint: ${task.iterationTitle || task.milestoneTitle}`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 3.5,
                              fontSize: 10,
                              fontWeight: 400,
                              color: theme.textSecondary,
                              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.05)',
                              border: 'none',
                              padding: '1px 6px',
                              borderRadius: 10,
                              lineHeight: 1.2,
                            }}
                          >
                            <Clock size={9.5} style={{ opacity: 0.75 }} />
                            <span>{task.iterationTitle || task.milestoneTitle}</span>
                          </span>
                        )}

                        {/* Rótulos / Labels */}
                        {labelsList.map((lbl, idx) => {
                          const lblStyle = getLabelStyle(lbl, isEffectiveDark);
                          return (
                            <span
                              key={idx}
                              style={{
                                fontSize: 10,
                                fontWeight: 400,
                                padding: '1px 6px',
                                borderRadius: 10,
                                border: 'none',
                                background: lblStyle.bg,
                                color: lblStyle.text,
                                lineHeight: 1.2,
                                letterSpacing: '0.01em',
                              }}
                            >
                              {lbl}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}

                {colCards.length === 0 && (
                  <div
                    style={{
                      padding: '24px 12px',
                      textAlign: 'center',
                      color: theme.textMuted,
                      fontSize: 11.5,
                      border: 'none',
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                      borderRadius: 6,
                    }}
                  >
                    Arraste tarefas para cá
                  </div>
                )}

                {/* Botão + Add item no rodapé da coluna */}
                {onAddNewIssue && (
                  <button
                    type="button"
                    onClick={() => onAddNewIssue(col.id)}
                    style={{
                      marginTop: 4,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 5,
                      padding: '6px 10px',
                      background: 'transparent',
                      border: 'none',
                      borderRadius: 6,
                      color: theme.textSecondary,
                      fontSize: 12,
                      fontWeight: 500,
                      cursor: 'pointer',
                      transition: 'background 0.15s ease, color 0.15s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)';
                      e.currentTarget.style.color = theme.textPrimary;
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = theme.textSecondary;
                    }}
                  >
                    <Plus size={13} />
                    <span>Add item</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
