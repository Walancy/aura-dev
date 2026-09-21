import React, { useState, useMemo } from 'react';
import {
  Plus,
  MoreHorizontal,
  CircleDot,
  CheckCircle2,
  Clock,
  GitPullRequest,
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
  onMoveIssue: (issueId: string, targetColumnId: string) => void;
  onAddNewIssue?: (defaultColumnId?: string) => void;
  showToast?: (msg: string) => void;
}

export interface KanbanColumnDef {
  id: 'backlog' | 'todo' | 'in_progress' | 'test' | 'done';
  title: string;
  subtitle: string;
  dotColor: string;
  isDoneType?: boolean;
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

// Paleta para etiquetas no estilo GitHub
const LABEL_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  bug: { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#f87171' },
  painel: { bg: 'rgba(6, 182, 212, 0.15)', border: '#06b6d4', text: '#22d3ee' },
  enhancement: { bg: 'rgba(14, 165, 233, 0.15)', border: '#0ea5e9', text: '#38bdf8' },
  feature: { bg: 'rgba(59, 130, 246, 0.15)', border: '#3b82f6', text: '#60a5fa' },
  guia: { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#34d399' },
  viajante: { bg: 'rgba(20, 184, 166, 0.15)', border: '#14b8a6', text: '#2dd4bf' },
  documentation: { bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', text: '#c084fc' },
  urgente: { bg: 'rgba(244, 63, 94, 0.15)', border: '#f43f5e', text: '#fb7185' },
};

function getLabelStyle(labelName: string, isEffectiveDark: boolean) {
  const key = labelName.toLowerCase().trim();
  if (LABEL_COLORS[key]) return LABEL_COLORS[key];
  return {
    bg: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
    border: isEffectiveDark ? 'rgba(255, 255, 255, 0.2)' : 'rgba(0, 0, 0, 0.15)',
    text: isEffectiveDark ? '#cbd5e1' : '#475569',
  };
}

// Determinar coluna padrão de uma issue
export function getIssueKanbanColumn(issue: any): 'backlog' | 'todo' | 'in_progress' | 'test' | 'done' {
  if (issue.kanbanColumnId) {
    return issue.kanbanColumnId;
  }
  if (issue.status === 'Concluído' || issue.rawState === 'closed') {
    return 'done';
  }
  const rawLabels = (issue.rawLabels || []).map((l: string) => l.toLowerCase());
  if (rawLabels.includes('test') || rawLabels.includes('testing') || rawLabels.includes('em teste')) {
    return 'test';
  }
  if (issue.status === 'Em Progresso') {
    return 'in_progress';
  }
  if (rawLabels.includes('backlog')) {
    return 'backlog';
  }
  // Se não tem milestone ou prioridade baixa, pode ser backlog
  if (!issue.milestoneNumber && !issue.startDateIso && !issue.dueDateIso && issue.priority === 'Baixa') {
    return 'backlog';
  }
  return 'todo';
}

export const GithubProjectsKanbanBoard: React.FC<GithubProjectsKanbanBoardProps> = ({
  issues,
  repoName = 'repositório',
  theme,
  isEffectiveDark,
  accentColor,
  accentContrastText,
  onOpenIssueDetail,
  onMoveIssue,
  onAddNewIssue,
}) => {
  const [searchFilter, setSearchFilter] = useState('');
  const [draggedIssueId, setDraggedIssueId] = useState<string | null>(null);
  const [dragOverColumnId, setDragOverColumnId] = useState<string | null>(null);
  const [columnMenuOpenId, setColumnMenuOpenId] = useState<string | null>(null);

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
    const map: Record<string, ProjectIssue[]> = {
      backlog: [],
      todo: [],
      in_progress: [],
      test: [],
      done: [],
    };

    filteredIssues.forEach((iss) => {
      const colId = getIssueKanbanColumn(iss);
      if (map[colId]) {
        map[colId].push(iss);
      } else {
        map.todo.push(iss);
      }
    });

    return map;
  }, [filteredIssues]);

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
        {KANBAN_COLUMNS.map((col) => {
          const colCards = issuesByColumn[col.id] || [];
          const isDragOver = dragOverColumnId === col.id;

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
                    ? 'rgba(255, 255, 255, 0.05)'
                    : 'rgba(0, 0, 0, 0.04)'
                  : theme.viewCanvasBg,
                borderRadius: 9,
                border: `1px solid ${
                  isDragOver
                    ? accentColor
                    : isEffectiveDark
                    ? 'rgba(255, 255, 255, 0.06)'
                    : 'rgba(0, 0, 0, 0.06)'
                }`,
                display: 'flex',
                flexDirection: 'column',
                transition: 'background 0.15s ease, border-color 0.15s ease',
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
                {/* Linha 1: Dot/Icon + Título + Badge + Menus */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div
                      style={{
                        width: 14,
                        height: 14,
                        borderRadius: '50%',
                        border: `2px solid ${col.dotColor}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxSizing: 'border-box',
                      }}
                    >
                      {col.isDoneType && (
                        <div
                          style={{
                            width: 6,
                            height: 6,
                            borderRadius: '50%',
                            background: col.dotColor,
                          }}
                        />
                      )}
                    </div>

                    <span style={{ fontSize: 13, fontWeight: 600, color: theme.textPrimary }}>
                      {col.title}
                    </span>

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
                      }}
                    >
                      {colCards.length}
                    </span>
                  </div>

                  {/* Ações da Coluna (··· e +) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
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
                <div style={{ fontSize: 11, color: theme.textSecondary, lineHeight: 1.3 }}>
                  {col.subtitle}
                </div>
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
                        background: theme.viewCardBg,
                        border: `1px solid ${
                          isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'
                        }`,
                        borderRadius: 7,
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 7,
                        cursor: isBeingDragged ? 'grabbing' : 'grab',
                        opacity: isBeingDragged ? 0.35 : 1,
                        boxShadow: isEffectiveDark
                          ? '0 1px 3px rgba(0,0,0,0.4)'
                          : '0 1px 3px rgba(0,0,0,0.05)',
                        transition: 'transform 0.12s ease, border-color 0.15s ease, box-shadow 0.15s ease',
                        userSelect: 'none',
                      }}
                      onMouseEnter={(e) => {
                        if (!isBeingDragged) {
                          e.currentTarget.style.borderColor = isEffectiveDark
                            ? 'rgba(255, 255, 255, 0.2)'
                            : 'rgba(0, 0, 0, 0.2)';
                          e.currentTarget.style.transform = 'translateY(-1px)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isBeingDragged) {
                          e.currentTarget.style.borderColor = isEffectiveDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.08)';
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
                              background: assignee.avatarBg || '#475569',
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

                      {/* Rodapé: Pílulas de Etiquetas / Labels */}
                      {labelsList.length > 0 && (
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 5, marginTop: 2 }}>
                          {labelsList.map((lbl, idx) => {
                            const lblStyle = getLabelStyle(lbl, isEffectiveDark);
                            return (
                              <span
                                key={idx}
                                style={{
                                  fontSize: 10,
                                  fontWeight: 500,
                                  padding: '1px 6px',
                                  borderRadius: 10,
                                  border: `1px solid ${lblStyle.border}`,
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
                      )}
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
                      border: `1px dashed ${
                        isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'
                      }`,
                      borderRadius: 6,
                    }}
                  >
                    Arraste tarefas para cá
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
