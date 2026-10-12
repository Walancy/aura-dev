import React, { useState } from 'react';
import { Play, Plus, Trash2, Edit2, ListChecks, ExternalLink, Check, Terminal, FolderCheck, X } from 'lucide-react';
import { MiniSwitch } from '../../ui/MiniSwitch';
import type { ThemeTokens } from '../../../types/ide';
import { logSystemActivity } from '../../../utils/brainService';

export interface TaskItem {
  id: string;
  name: string;
  command: string;
  group: 'build' | 'test' | 'lint' | 'dev' | 'custom';
  description?: string;
  isBuiltIn?: boolean;
}

const DEFAULT_TASKS: TaskItem[] = [
  {
    id: 'task-build',
    name: 'Build do Projeto',
    command: 'npm run build',
    group: 'build',
    description: 'Compila a aplicação e gera os artefatos de distribuição',
    isBuiltIn: true,
  },
  {
    id: 'task-dev',
    name: 'Servidor de Desenvolvimento',
    command: 'npm run dev',
    group: 'dev',
    description: 'Inicia o servidor de desenvolvimento local com hot-reload',
    isBuiltIn: true,
  },
  {
    id: 'task-test',
    name: 'Testes Automatizados',
    command: 'npm test',
    group: 'test',
    description: 'Executa a suite de testes unitários e de integração',
    isBuiltIn: true,
  },
  {
    id: 'task-lint',
    name: 'Validação de Lint',
    command: 'npm run lint',
    group: 'lint',
    description: 'Verifica padrões de código, boas práticas e tipagem',
    isBuiltIn: true,
  },
];

const STORAGE_KEY = 'devflow_tasks_config_v1';
const PREFS_KEY = 'devflow_task_prefs_v1';

export interface TasksSettingsTabProps {
  themeTokens: ThemeTokens;
  isEffectiveDark: boolean;
  accentColor: string;
  onOpenTasksDock?: () => void;
  onToast?: (msg: string) => void;
}

export const TasksSettingsTab: React.FC<TasksSettingsTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
  onOpenTasksDock,
  onToast,
}) => {
  const [tasks, setTasks] = useState<TaskItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return DEFAULT_TASKS;
  });

  const [prefs, setPrefs] = useState(() => {
    try {
      const saved = localStorage.getItem(PREFS_KEY);
      if (saved) return JSON.parse(saved);
    } catch {}
    return {
      packageManager: 'npm',
      clearBeforeRun: true,
      focusOnError: true,
      notifyCompletion: true,
      autoSaveBeforeRun: true,
    };
  });

  const [isEditing, setIsEditing] = useState(false);
  const [editTarget, setEditTarget] = useState<TaskItem | null>(null);
  const [formName, setFormName] = useState('');
  const [formCommand, setFormCommand] = useState('');
  const [formGroup, setFormGroup] = useState<TaskItem['group']>('build');
  const [formDesc, setFormDesc] = useState('');

  // Delete modal state conforming to AGENTS.md rule
  const [deletingTask, setDeletingTask] = useState<TaskItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const saveTasks = (list: TaskItem[]) => {
    setTasks(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {}
  };

  const updatePrefs = (partial: Partial<typeof prefs>) => {
    const next = { ...prefs, ...partial };
    setPrefs(next);
    try {
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
    } catch {}
  };

  const handleOpenCreate = () => {
    setEditTarget(null);
    setFormName('');
    setFormCommand('');
    setFormGroup('build');
    setFormDesc('');
    setIsEditing(true);
  };

  const handleOpenEdit = (t: TaskItem) => {
    setEditTarget(t);
    setFormName(t.name);
    setFormCommand(t.command);
    setFormGroup(t.group);
    setFormDesc(t.description || '');
    setIsEditing(true);
  };

  const handleSaveForm = () => {
    if (!formName.trim() || !formCommand.trim()) return;

    if (editTarget) {
      const updated = tasks.map((t) =>
        t.id === editTarget.id
          ? {
              ...t,
              name: formName.trim(),
              command: formCommand.trim(),
              group: formGroup,
              description: formDesc.trim(),
            }
          : t
      );
      saveTasks(updated);
      logSystemActivity('tarefas', 'atualizar_tarefa', formName.trim(), { command: formCommand.trim(), group: formGroup });
    } else {
      const newItem: TaskItem = {
        id: `task-${Date.now()}`,
        name: formName.trim(),
        command: formCommand.trim(),
        group: formGroup,
        description: formDesc.trim(),
      };
      const updated = [newItem, ...tasks];
      saveTasks(updated);
      logSystemActivity('tarefas', 'criar_tarefa', formName.trim(), { command: formCommand.trim(), group: formGroup });
    }

    setIsEditing(false);
    setEditTarget(null);
  };

  const handleConfirmDelete = async () => {
    if (!deletingTask) return;
    setIsDeleting(true);
    try {
      const updated = tasks.filter((t) => t.id !== deletingTask.id);
      saveTasks(updated);
      logSystemActivity('tarefas', 'excluir_tarefa', deletingTask.name, { id: deletingTask.id });
    } finally {
      setIsDeleting(false);
      setDeletingTask(null);
    }
  };

  const handleRunTask = (t: TaskItem) => {
    logSystemActivity('tarefas', 'executar_tarefa', t.name, { command: t.command });
    if (onToast) {
      onToast(`Tarefa "${t.name}" iniciada: ${t.command}`);
    }
  };

  const cardBg = isEffectiveDark ? 'rgba(255, 255, 255, 0.035)' : 'rgba(0, 0, 0, 0.025)';
  const inputBg = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  const divider = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%' }}>
      {/* Gerenciador de Pacotes e Execução */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 500,
            color: themeTokens.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Gerenciador de Pacotes Padrão
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))', gap: 8 }}>
          {['npm', 'pnpm', 'yarn', 'bun', 'cargo', 'deno'].map((pkg) => {
            const isSelected = prefs.packageManager === pkg;
            return (
              <div
                key={pkg}
                onClick={() => {
                  updatePrefs({ packageManager: pkg });
                  logSystemActivity('configuracoes_tarefas', 'alterar_package_manager', pkg);
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: 'none',
                  boxShadow: 'none',
                  background: isSelected
                    ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0')
                    : cardBg,
                  color: isSelected ? accentColor : themeTokens.textPrimary,
                  fontSize: 11.5,
                  fontWeight: 400,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.05)'
                      : 'rgba(0, 0, 0, 0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.background = cardBg;
                  }
                }}
              >
                <Terminal size={12} />
                <span>{pkg}</span>
                {isSelected && <Check size={12} color={accentColor} style={{ marginLeft: 'auto' }} />}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ height: 1, background: divider }} />

      {/* Preferências de Execução de Tarefas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div
          style={{
            fontSize: 10.5,
            fontWeight: 500,
            color: themeTokens.textSecondary,
            textTransform: 'uppercase',
            letterSpacing: 0.5,
          }}
        >
          Comportamento do Executor de Tarefas
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              borderRadius: 8,
              background: cardBg,
              border: 'none',
              boxShadow: 'none',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                Limpar Terminal Antes de Executar
              </span>
              <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                Limpa o histórico de saída do terminal ao iniciar uma nova tarefa.
              </span>
            </div>
            <MiniSwitch
              checked={prefs.clearBeforeRun}
              onChange={() => {
                const next = !prefs.clearBeforeRun;
                updatePrefs({ clearBeforeRun: next });
                logSystemActivity('configuracoes_tarefas', 'toggle_clear_before_run', 'tarefas', { ativo: next });
              }}
              accentColor={accentColor}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              borderRadius: 8,
              background: cardBg,
              border: 'none',
              boxShadow: 'none',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                Focar Terminal em Caso de Falha
              </span>
              <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                Abre e foca a aba de terminal automaticamente quando o comando retornar código diferente de zero.
              </span>
            </div>
            <MiniSwitch
              checked={prefs.focusOnError}
              onChange={() => {
                const next = !prefs.focusOnError;
                updatePrefs({ focusOnError: next });
                logSystemActivity('configuracoes_tarefas', 'toggle_focus_on_error', 'tarefas', { ativo: next });
              }}
              accentColor={accentColor}
            />
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              borderRadius: 8,
              background: cardBg,
              border: 'none',
              boxShadow: 'none',
              gap: 12,
            }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                Salvar Arquivos Automaticamente Antes de Rodar
              </span>
              <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                Salva todas as alterações pendentes nos arquivos antes de disparar testes ou builds.
              </span>
            </div>
            <MiniSwitch
              checked={prefs.autoSaveBeforeRun}
              onChange={() => {
                const next = !prefs.autoSaveBeforeRun;
                updatePrefs({ autoSaveBeforeRun: next });
                logSystemActivity('configuracoes_tarefas', 'toggle_auto_save', 'tarefas', { ativo: next });
              }}
              accentColor={accentColor}
            />
          </div>
        </div>
      </div>

      <div style={{ height: 1, background: divider }} />

      {/* Lista de Tarefas Configuradas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div
            style={{
              fontSize: 10.5,
              fontWeight: 500,
              color: themeTokens.textSecondary,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            Tarefas & Scripts do Projeto
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {onOpenTasksDock && (
              <button
                type="button"
                onClick={onOpenTasksDock}
                style={{
                  height: 28,
                  padding: '0 10px',
                  borderRadius: 6,
                  border: 'none',
                  boxShadow: 'none',
                  cursor: 'pointer',
                  background: cardBg,
                  color: themeTokens.textSecondary,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  fontSize: 11.5,
                  fontWeight: 400,
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
                onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
              >
                <FolderCheck size={13} />
                <span>Painel de Tarefas no Dock</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleOpenCreate}
              style={{
                height: 28,
                padding: '0 12px',
                borderRadius: 6,
                border: 'none',
                boxShadow: 'none',
                cursor: 'pointer',
                background: accentColor,
                color: '#ffffff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                fontSize: 11.5,
                fontWeight: 400,
                transition: 'opacity 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
            >
              <Plus size={13} />
              <span>Adicionar Tarefa</span>
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {tasks.map((t) => (
            <div
              key={t.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderRadius: 8,
                background: cardBg,
                border: 'none',
                boxShadow: 'none',
                gap: 12,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: accentColor,
                    flexShrink: 0,
                  }}
                >
                  <ListChecks size={14} />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 400, color: themeTokens.textPrimary }}>
                      {t.name}
                    </span>
                    <span
                      style={{
                        fontSize: 9.5,
                        padding: '1px 5px',
                        borderRadius: 4,
                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                        color: themeTokens.textSecondary,
                        textTransform: 'uppercase',
                      }}
                    >
                      {t.group}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span
                      style={{
                        fontSize: 10.5,
                        fontFamily: "'JetBrains Mono', Menlo, monospace",
                        color: isEffectiveDark ? '#a1a1aa' : '#71717a',
                      }}
                    >
                      $ {t.command}
                    </span>
                    {t.description && (
                      <span style={{ fontSize: 10.5, color: themeTokens.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        • {t.description}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <button
                  type="button"
                  onClick={() => handleRunTask(t)}
                  style={{
                    height: 28,
                    padding: '0 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                    color: accentColor,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11,
                    fontWeight: 400,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.1)'
                      : 'rgba(0, 0, 0, 0.08)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = isEffectiveDark
                      ? 'rgba(255, 255, 255, 0.06)'
                      : 'rgba(0, 0, 0, 0.05)';
                  }}
                  title="Executar comando da tarefa"
                >
                  <Play size={11} fill={accentColor} />
                  <span>Executar</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleOpenEdit(t)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: themeTokens.textSecondary,
                    transition: 'color 0.15s ease',
                  }}
                  title="Editar tarefa"
                >
                  <Edit2 size={13} />
                </button>

                <button
                  type="button"
                  onClick={() => setDeletingTask(t)}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 6,
                    border: 'none',
                    background: 'transparent',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#ef4444',
                    transition: 'opacity 0.15s ease',
                  }}
                  title="Excluir tarefa"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal de Criação / Edição de Tarefa */}
      {isEditing && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.6)',
            zIndex: 1000000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => setIsEditing(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(500px, calc(100vw - 32px))',
              background: isEffectiveDark ? '#18181b' : '#ffffff',
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: themeTokens.textPrimary }}>
                {editTarget ? 'Editar Tarefa' : 'Nova Tarefa'}
              </span>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{
                  width: 28,
                  height: 28,
                  border: 'none',
                  background: 'transparent',
                  color: themeTokens.textSecondary,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <X size={15} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div>
                <div style={{ fontSize: 11, color: themeTokens.textSecondary, marginBottom: 4 }}>Nome da Tarefa</div>
                <input
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="ex: Build de Produção"
                  style={{
                    height: 28,
                    padding: '0 8px',
                    borderRadius: 6,
                    background: inputBg,
                    border: 'none',
                    color: themeTokens.textPrimary,
                    fontSize: 11.5,
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <div style={{ fontSize: 11, color: themeTokens.textSecondary, marginBottom: 4 }}>Comando a Executar</div>
                <input
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                  placeholder="ex: npm run build"
                  style={{
                    height: 28,
                    padding: '0 8px',
                    borderRadius: 6,
                    background: inputBg,
                    border: 'none',
                    color: themeTokens.textPrimary,
                    fontSize: 11.5,
                    fontFamily: "'JetBrains Mono', monospace",
                    width: '100%',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 8 }}>
                <div>
                  <div style={{ fontSize: 11, color: themeTokens.textSecondary, marginBottom: 4 }}>Grupo</div>
                  <select
                    value={formGroup}
                    onChange={(e) => setFormGroup(e.target.value as any)}
                    style={{
                      height: 28,
                      padding: '0 8px',
                      borderRadius: 6,
                      background: inputBg,
                      border: 'none',
                      color: themeTokens.textPrimary,
                      fontSize: 11.5,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  >
                    <option value="build">Build</option>
                    <option value="test">Test</option>
                    <option value="lint">Lint</option>
                    <option value="dev">Dev</option>
                    <option value="custom">Custom</option>
                  </select>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: themeTokens.textSecondary, marginBottom: 4 }}>Descrição</div>
                  <input
                    value={formDesc}
                    onChange={(e) => setFormDesc(e.target.value)}
                    placeholder="Objetivo da tarefa…"
                    style={{
                      height: 28,
                      padding: '0 8px',
                      borderRadius: 6,
                      background: inputBg,
                      border: 'none',
                      color: themeTokens.textPrimary,
                      fontSize: 11.5,
                      width: '100%',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                style={{
                  height: 28,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: themeTokens.textSecondary,
                  cursor: 'pointer',
                  fontSize: 11.5,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveForm}
                disabled={!formName.trim() || !formCommand.trim()}
                style={{
                  height: 28,
                  padding: '0 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: accentColor,
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 400,
                  opacity: !formName.trim() || !formCommand.trim() ? 0.5 : 1,
                }}
              >
                Salvar Tarefa
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Exclusão (Regra AGENTS.md) */}
      {deletingTask && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            zIndex: 1000001,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 16,
          }}
          onClick={() => !isDeleting && setDeletingTask(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(420px, calc(100vw - 32px))',
              background: isEffectiveDark ? '#18181b' : '#ffffff',
              borderRadius: 10,
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <div style={{ fontSize: 13.5, fontWeight: 500, color: themeTokens.textPrimary }}>
              Excluir Tarefa
            </div>
            <div style={{ fontSize: 11.5, color: themeTokens.textSecondary, lineHeight: 1.45 }}>
              Tem certeza que deseja remover a tarefa "{deletingTask.name}" ({deletingTask.command})? Esta ação não pode ser desfeita.
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeletingTask(null)}
                style={{
                  height: 28,
                  padding: '0 12px',
                  borderRadius: 6,
                  border: 'none',
                  background: 'transparent',
                  color: themeTokens.textSecondary,
                  cursor: 'pointer',
                  fontSize: 11.5,
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                style={{
                  height: 28,
                  padding: '0 14px',
                  borderRadius: 6,
                  border: 'none',
                  background: '#ef4444',
                  color: '#ffffff',
                  cursor: 'pointer',
                  fontSize: 11.5,
                  fontWeight: 400,
                  opacity: isDeleting ? 0.7 : 1,
                }}
              >
                {isDeleting ? 'Excluindo…' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
