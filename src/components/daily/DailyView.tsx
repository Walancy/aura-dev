import React, { useState, useEffect } from 'react';
import {
  CalendarCheck,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  User,
  Sparkles,
} from 'lucide-react';
import { Task } from '../../types';
import { api } from '../../services/api';

export const DailyView: React.FC = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dailyNotes, setDailyNotes] = useState({
    yesterday: '• Finalizada a integração com o Claude Code CLI via node-pty\n• Configuração do backend WebSocket e File System',
    today: '• Implementar interface da IDE completa e painel de portas\n• Testar execução de comandos do AGY no terminal',
    blockers: '• Nenhum impedimento no momento.',
  });

  const loadTasks = async () => {
    try {
      const res = await api.getTasks();
      setTasks(res.tasks);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const moveTask = async (taskId: string, newStatus: Task['status']) => {
    try {
      await api.updateTaskStatus(taskId, newStatus);
      setTasks((prev) =>
        prev.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t))
      );
    } catch (err) {
      console.error(err);
    }
  };

  const columns: { id: Task['status']; title: string; color: string }[] = [
    { id: 'todo', title: 'A Fazer', color: 'var(--text-muted)' },
    { id: 'in_progress', title: 'Em Progresso', color: 'var(--accent-orange)' },
    { id: 'review', title: 'Em Revisão', color: 'var(--accent-cyan)' },
    { id: 'done', title: 'Concluído', color: 'var(--accent-green)' },
  ];

  const getPriorityBadge = (priority: Task['priority']) => {
    switch (priority) {
      case 'urgent':
        return <span className="badge" style={{ backgroundColor: 'rgba(239,68,68,0.2)', color: '#f87171' }}>Urgente</span>;
      case 'high':
        return <span className="badge badge-orange">Alta</span>;
      case 'medium':
        return <span className="badge badge-cyan">Média</span>;
      default:
        return <span className="badge" style={{ backgroundColor: 'rgba(148,163,184,0.15)', color: '#94a3b8' }}>Baixa</span>;
    }
  };

  return (
    <div
      style={{
        flex: 1,
        height: 'calc(100vh - 66px)',
        overflowY: 'auto',
        padding: '24px 32px',
        backgroundColor: 'var(--bg-main)',
      }}
    >
      {/* Top Banner: Sprint Info & Daily Notes */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '2fr 1fr',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        {/* Daily Standup Quick Notes */}
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <CalendarCheck size={18} color="var(--accent-orange)" />
            <h2 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#fff' }}>
              Daily Standup do Time
            </h2>
            <span className="badge badge-orange">Hoje</span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '14px' }}>
            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-cyan)', display: 'block', marginBottom: '6px' }}>
                O que realizei ontem?
              </label>
              <textarea
                rows={3}
                value={dailyNotes.yesterday}
                onChange={(e) => setDailyNotes({ ...dailyNotes, yesterday: e.target.value })}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.75rem',
                  padding: '8px',
                  resize: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--accent-orange)', display: 'block', marginBottom: '6px' }}>
                O que farei hoje?
              </label>
              <textarea
                rows={3}
                value={dailyNotes.today}
                onChange={(e) => setDailyNotes({ ...dailyNotes, today: e.target.value })}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.75rem',
                  padding: '8px',
                  resize: 'none',
                }}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.74rem', fontWeight: 600, color: '#f87171', display: 'block', marginBottom: '6px' }}>
                Impedimentos?
              </label>
              <textarea
                rows={3}
                value={dailyNotes.blockers}
                onChange={(e) => setDailyNotes({ ...dailyNotes, blockers: e.target.value })}
                style={{
                  width: '100%',
                  backgroundColor: 'var(--bg-main)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '0.75rem',
                  padding: '8px',
                  resize: 'none',
                }}
              />
            </div>
          </div>
        </div>

        {/* Sprint Countdown Card */}
        <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: '#fff' }}>Sprint 2</h3>
              <span className="badge badge-green">Em Andamento</span>
            </div>
            <p style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
              Meta: Integração de CLIs de IA e estabilização do backend
            </p>
          </div>

          <div style={{ margin: '14px 0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: '4px' }}>
              <span>Progresso</span>
              <span style={{ color: 'var(--accent-orange)', fontWeight: 600 }}>68%</span>
            </div>
            <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--bg-main)', borderRadius: '4px', overflow: 'hidden' }}>
              <div style={{ width: '68%', height: '100%', backgroundColor: 'var(--accent-orange)', borderRadius: '4px' }} />
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', color: 'var(--text-muted)' }}>
            <Clock size={13} color="var(--accent-orange)" />
            <span>7 dias restantes para entrega</span>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: '14px' }}>
        Quadro de Tarefas da Sprint
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '16px',
          alignItems: 'start',
        }}
      >
        {columns.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.id);
          return (
            <div
              key={col.id}
              style={{
                backgroundColor: 'var(--bg-surface)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                minHeight: '400px',
              }}
            >
              {/* Column Header */}
              <div
                style={{
                  padding: '12px 14px',
                  borderBottom: '1px solid var(--border-color)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: col.color,
                    }}
                  />
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>
                    {col.title}
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '0.7rem',
                    backgroundColor: 'var(--bg-main)',
                    color: 'var(--text-secondary)',
                    padding: '2px 6px',
                    borderRadius: '10px',
                  }}
                >
                  {colTasks.length}
                </span>
              </div>

              {/* Tasks List */}
              <div style={{ padding: '10px', display: 'flex', flexDirection: 'column', gap: '10px', flex: 1 }}>
                {colTasks.map((task) => (
                  <div
                    key={task.id}
                    className="card"
                    style={{
                      padding: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '8px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#fff' }}>
                        {task.title}
                      </span>
                      {getPriorityBadge(task.priority)}
                    </div>

                    <p style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>
                      {task.description}
                    </p>

                    {/* Tags */}
                    <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                      {task.tags.map((tag) => (
                        <span
                          key={tag}
                          style={{
                            fontSize: '0.65rem',
                            backgroundColor: 'var(--bg-main)',
                            color: 'var(--text-muted)',
                            padding: '1px 5px',
                            borderRadius: '3px',
                          }}
                        >
                          #{tag}
                        </span>
                      ))}
                    </div>

                    {/* Footer / Move controls */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginTop: '4px',
                        paddingTop: '6px',
                        borderTop: '1px solid var(--border-color)',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        <User size={12} />
                        <span>{task.assignee}</span>
                      </div>

                      <div style={{ display: 'flex', gap: '4px' }}>
                        {col.id !== 'todo' && (
                          <button
                            onClick={() => moveTask(task.id, 'todo')}
                            style={{ fontSize: '0.65rem', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                          >
                            ←
                          </button>
                        )}
                        {col.id !== 'in_progress' && (
                          <button
                            onClick={() => moveTask(task.id, 'in_progress')}
                            style={{ fontSize: '0.65rem', background: 'none', border: 'none', color: 'var(--accent-orange)', cursor: 'pointer' }}
                          >
                            {col.id === 'todo' ? 'Iniciar →' : '←'}
                          </button>
                        )}
                        {col.id !== 'done' && (
                          <button
                            onClick={() => moveTask(task.id, 'done')}
                            style={{ fontSize: '0.65rem', background: 'none', border: 'none', color: 'var(--accent-green)', cursor: 'pointer' }}
                          >
                            Concluir ✓
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
