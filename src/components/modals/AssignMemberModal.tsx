import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  X,
  Search,
  Check,
  UserPlus,
  UserCheck,
  Users,
  UserX,
  Sparkles,
  ExternalLink,
} from 'lucide-react';
import type { ProjectIssue, RepoCollaborator } from '../ProjectsSchedulerView';
import { hexToRgba } from '../../utils/color';

export interface AssignMemberModalProps {
  isOpen: boolean;
  task: ProjectIssue | null;
  collaborators: RepoCollaborator[];
  currentUser?: { login: string; avatarUrl: string } | null;
  accentColor: string;
  accentContrastText: string;
  theme: any;
  isEffectiveDark: boolean;
  onClose: () => void;
  onAssign: (issueId: string, assigneeLogin: string, assigneeAvatar?: string) => void;
  showToast?: (msg: string) => void;
}

export const AssignMemberModal: React.FC<AssignMemberModalProps> = ({
  isOpen,
  task,
  collaborators,
  currentUser,
  accentColor,
  accentContrastText,
  theme,
  isEffectiveDark,
  onClose,
  onAssign,
  showToast,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setTimeout(() => {
        searchInputRef.current?.focus();
      }, 100);
    }
  }, [isOpen]);

  // Fechar com Escape
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Lista de membros filtrados
  const filteredCollaborators = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return collaborators;
    return collaborators.filter(
      (c) =>
        c.login.toLowerCase().includes(q) ||
        (c.name && c.name.toLowerCase().includes(q))
    );
  }, [collaborators, searchQuery]);

  if (!isOpen || !task) return null;

  const currentAssignees = task.assignees || [];
  const isMeAssigned = currentUser
    ? currentAssignees.some(
        (a) => a.name?.toLowerCase() === currentUser.login.toLowerCase()
      )
    : false;

  const handleSelectMember = (collaborator: RepoCollaborator) => {
    const isAlreadyAssigned = currentAssignees.some(
      (a) => a.name?.toLowerCase() === collaborator.login.toLowerCase()
    );

    if (isAlreadyAssigned) {
      onAssign(task.id, '', '');
      showToast?.(`Responsável @${collaborator.login} removido.`);
    } else {
      onAssign(task.id, collaborator.login, collaborator.avatarUrl);
      showToast?.(`Tarefa atribuída a @${collaborator.login}.`);
    }
    onClose();
  };

  const handleAssignToMe = () => {
    if (!currentUser) return;
    onAssign(task.id, currentUser.login, currentUser.avatarUrl);
    showToast?.(`Tarefa atribuída a você (@${currentUser.login}).`);
    onClose();
  };

  const handleClearAssignees = () => {
    onAssign(task.id, '', '');
    showToast?.('Responsável removido da tarefa.');
    onClose();
  };

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: theme.modalOverlay || 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(6px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 420,
          background: theme.modalBg || (isEffectiveDark ? '#161616' : '#ffffff'),
          borderRadius: 12,
          border: theme.modalBorder || `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'}`,
          boxShadow: theme.modalShadow || '0 20px 40px rgba(0, 0, 0, 0.45)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          animation: 'fadeInModal 0.15s ease-out',
        }}
      >
        {/* Cabeçalho */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: `1px solid ${hexToRgba(theme.textSecondary, 0.12)}`,
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: 7,
                background: hexToRgba(accentColor, 0.12),
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: accentColor,
              }}
            >
              <UserPlus size={15} />
            </div>
            <div>
              <h3
                style={{
                  margin: 0,
                  fontSize: 13.5,
                  fontWeight: 600,
                  color: theme.textPrimary,
                  letterSpacing: -0.2,
                }}
              >
                Atribuir Responsável
              </h3>
              <p
                style={{
                  margin: 0,
                  fontSize: 11,
                  color: theme.textSecondary,
                  maxWidth: 290,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={task.title}
              >
                {task.id} · {task.title}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: theme.textSecondary,
              cursor: 'pointer',
              padding: 5,
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background 0.12s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = theme.textPrimary;
              e.currentTarget.style.background = hexToRgba(theme.textSecondary, 0.1);
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = theme.textSecondary;
              e.currentTarget.style.background = 'transparent';
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Campo de Busca */}
        <div style={{ padding: '12px 16px 8px' }}>
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
            <Search
              size={14}
              color={theme.textSecondary}
              style={{
                position: 'absolute',
                left: 10,
                pointerEvents: 'none',
              }}
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar membro do repositório..."
              style={{
                width: '100%',
                background: isEffectiveDark ? '#1f1f1f' : '#f8fafc',
                border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1'}`,
                borderRadius: 7,
                padding: '7px 10px 7px 32px',
                fontSize: 12.5,
                color: theme.textPrimary,
                outline: 'none',
                transition: 'border-color 0.12s ease',
                boxSizing: 'border-box',
              }}
              onFocus={(e) => (e.currentTarget.style.borderColor = accentColor)}
              onBlur={(e) =>
                (e.currentTarget.style.borderColor = isEffectiveDark
                  ? 'rgba(255, 255, 255, 0.1)'
                  : '#cbd5e1')
              }
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  position: 'absolute',
                  right: 8,
                  background: 'transparent',
                  border: 'none',
                  color: theme.textSecondary,
                  cursor: 'pointer',
                  padding: 2,
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Ação Rápida: Atribuir a Mim */}
        {currentUser && !isMeAssigned && !searchQuery && (
          <div style={{ padding: '0 16px 8px' }}>
            <button
              type="button"
              onClick={handleAssignToMe}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '7px 10px',
                background: hexToRgba(accentColor, 0.08),
                border: `1px solid ${hexToRgba(accentColor, 0.22)}`,
                borderRadius: 7,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = hexToRgba(accentColor, 0.15);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = hexToRgba(accentColor, 0.08);
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {currentUser.avatarUrl ? (
                  <img
                    src={currentUser.avatarUrl}
                    alt={currentUser.login}
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      objectFit: 'cover',
                    }}
                  />
                ) : (
                  <div
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: '50%',
                      background: accentColor,
                      color: accentContrastText,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: 10,
                      fontWeight: 600,
                    }}
                  >
                    {currentUser.login.charAt(0).toUpperCase()}
                  </div>
                )}
                <span
                  style={{
                    fontSize: 12,
                    fontWeight: 500,
                    color: accentColor,
                  }}
                >
                  Atribuir a mim (@{currentUser.login})
                </span>
              </div>
              <span
                style={{
                  fontSize: 10.5,
                  padding: '1.5px 6px',
                  borderRadius: 4,
                  background: hexToRgba(accentColor, 0.18),
                  color: accentColor,
                  fontWeight: 600,
                }}
              >
                Você
              </span>
            </button>
          </div>
        )}

        {/* Lista de Membros */}
        <div
          style={{
            maxHeight: 280,
            overflowY: 'auto',
            padding: '4px 10px 10px',
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
          }}
          className="no-scrollbar"
        >
          <div
            style={{
              padding: '6px 8px 4px',
              fontSize: 10.5,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
              color: theme.textSecondary,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <span>Membros do Repositório ({filteredCollaborators.length})</span>
          </div>

          {filteredCollaborators.length === 0 ? (
            <div
              style={{
                padding: '24px 16px',
                textAlign: 'center',
                color: theme.textSecondary,
                fontSize: 12,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 6,
              }}
            >
              <Users size={22} color={theme.textSecondary} style={{ opacity: 0.5 }} />
              <span>Nenhum membro encontrado{searchQuery ? ` para "${searchQuery}"` : ''}.</span>
            </div>
          ) : (
            filteredCollaborators.map((c) => {
              const isAssigned = currentAssignees.some(
                (a) => a.name?.toLowerCase() === c.login.toLowerCase()
              );
              const isMe =
                currentUser &&
                currentUser.login.toLowerCase() === c.login.toLowerCase();

              return (
                <button
                  key={c.login}
                  type="button"
                  onClick={() => handleSelectMember(c)}
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: 7,
                    border: 'none',
                    background: isAssigned
                      ? isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : '#f1f5f9'
                      : 'transparent',
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                    textAlign: 'left',
                  }}
                  onMouseEnter={(e) => {
                    if (!isAssigned) {
                      e.currentTarget.style.background = isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.04)'
                        : '#f8fafc';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isAssigned) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    {/* Avatar */}
                    {c.avatarUrl ? (
                      <img
                        src={c.avatarUrl}
                        alt={c.login}
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          objectFit: 'cover',
                          flexShrink: 0,
                          border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1'}`,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 24,
                          height: 24,
                          borderRadius: '50%',
                          background: isMe ? accentColor : '#64748b',
                          color: '#ffffff',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11,
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {c.login.charAt(0).toUpperCase()}
                      </div>
                    )}

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                        }}
                      >
                        <span
                          style={{
                            fontSize: 12.5,
                            fontWeight: isAssigned ? 600 : 400,
                            color: theme.textPrimary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          @{c.login}
                        </span>
                        {isMe && (
                          <span
                            style={{
                              fontSize: 9.5,
                              padding: '1px 5px',
                              borderRadius: 4,
                              background: hexToRgba(accentColor, 0.18),
                              color: accentColor,
                              fontWeight: 600,
                            }}
                          >
                            Você
                          </span>
                        )}
                      </div>
                      {c.name && (
                        <div
                          style={{
                            fontSize: 11,
                            color: theme.textSecondary,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}
                        >
                          {c.name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Indicador de Seleção */}
                  <div style={{ flexShrink: 0, marginLeft: 8 }}>
                    {isAssigned ? (
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          background: accentColor,
                          color: accentContrastText,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Check size={12} strokeWidth={2.5} />
                      </div>
                    ) : (
                      <div
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: '50%',
                          border: `1.5px solid ${hexToRgba(theme.textSecondary, 0.25)}`,
                        }}
                      />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Rodapé: Limpar Responsáveis */}
        {currentAssignees.length > 0 && (
          <div
            style={{
              padding: '10px 16px',
              borderTop: `1px solid ${hexToRgba(theme.textSecondary, 0.12)}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.01)',
            }}
          >
            <button
              type="button"
              onClick={handleClearAssignees}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: 'none',
                color: '#ef4444',
                fontSize: 11.5,
                fontWeight: 500,
                cursor: 'pointer',
                padding: '4px 6px',
                borderRadius: 5,
                transition: 'background 0.12s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <UserX size={13} />
              <span>Remover responsável atual</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: `1px solid ${hexToRgba(theme.textSecondary, 0.2)}`,
                borderRadius: 6,
                padding: '5px 12px',
                fontSize: 11.5,
                color: theme.textSecondary,
                cursor: 'pointer',
              }}
            >
              Fechar
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
