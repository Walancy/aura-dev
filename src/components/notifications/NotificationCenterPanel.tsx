import React, { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  Bell,
  Check,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Info,
  Palette,
  Trash2,
  X,
  ArrowUp,
  ArrowUpCircle,
} from 'lucide-react';
import { renderAiIcon } from '../icons/AiProviderIcons';
import { timeAgo, type CenterNotification } from './notificationStore';
import { logSystemActivity } from '../../utils/brainService';

interface Props {
  /** controla a abertura; o painel anima a saída antes de sair da tela */
  open: boolean;
  items: CenterNotification[];
  onClose: () => void;
  onOpen: (n: CenterNotification) => void;
  onRead: (id: string) => void;
  onReadAll: () => void;
  onRemove: (id: string) => void;
  onClearHistory: () => void;
  onUpdateAi?: (providerId: string, notification?: CenterNotification) => void;
  accentColor: string;
  isEffectiveDark: boolean;
  themeTokens?: Record<string, any>;
  /** distância do topo (altura da header) */
  top?: number;
}

/** Painel sempre preto: paleta própria, independente do tema do app */
const C = {
  bg: '#000000',
  text: '#F4F4F5',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  border: 'rgba(255,255,255,0.08)',
  card: 'rgba(255,255,255,0.05)',
  hover: 'rgba(255,255,255,0.09)',
  activeCard: 'rgba(255,255,255,0.07)',
};
const ANIM_MS = 240;

function KindIcon({ n, color }: { n: CenterNotification; color: string }) {
  if ((n.kind === 'ai' || n.kind === 'design') && n.provider) {
    const provId = n.provider === 'agy' ? 'antigravity' : n.provider;
    return (
      <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
        {renderAiIcon(provId, 18)}
        {n.isUpdate && (
          <span
            style={{
              position: 'absolute',
              bottom: -2,
              right: -2,
              width: 8.5,
              height: 8.5,
              borderRadius: '50%',
              background: '#0284c7',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: 'none',
              boxShadow: 'none',
              pointerEvents: 'none',
            }}
            title="Atualização disponível"
          >
            <ArrowUp size={6} strokeWidth={3.5} />
          </span>
        )}
      </div>
    );
  }
  if (n.kind === 'design') return <Palette size={18} color={color} />;
  if (n.kind === 'error') return <AlertCircle size={18} color="#f87171" />;
  return <Info size={18} color={color} />;
}

/** Sidebar à direita: notificações novas e histórico (as já lidas), com suporte a expandir detalhes */
export default function NotificationCenterPanel({
  open,
  items,
  onClose,
  onOpen,
  onRead,
  onReadAll,
  onRemove,
  onClearHistory,
  onUpdateAi,
  accentColor,
  isEffectiveDark,
  themeTokens,
  top = 56,
}: Props) {
  const [tab, setTab] = useState<'new' | 'history'>('new');
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // monta ao abrir e só desmonta depois da animação de saída
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (open) {
      setMounted(true);
      setClosing(false);
    } else if (mounted) {
      setClosing(true);
      closeTimer.current = setTimeout(() => {
        setMounted(false);
        setClosing(false);
      }, ANIM_MS);
    }
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, [open]);

  const [, tick] = useState(0);
  const fresh = items.filter((n) => !n.read);
  const history = items.filter((n) => n.read);
  const list = tab === 'new' ? fresh : history;

  // "há 5 min" se mantém atualizado enquanto aberto
  useEffect(() => {
    const t = setInterval(() => tick((x) => x + 1), 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  // Abrir o card não marca como lida na hora: ela é lida quando o painel fecha ou quando outra notificação é aberta
  const openedRef = useRef<Set<string>>(new Set());
  const flushOpened = () => {
    openedRef.current.forEach((id) => onRead(id));
    openedRef.current.clear();
  };
  const flushOpenedRef = useRef(flushOpened);
  flushOpenedRef.current = flushOpened;
  useEffect(() => {
    if (!open) flushOpenedRef.current();
  }, [open]);
  useEffect(() => () => flushOpenedRef.current(), []);

  const toggleExpand = (id: string, n: CenterNotification) => {
    if (!expandedIds.has(id) && !n.read) {
      flushOpened();
      openedRef.current.add(id);
    }
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCardClick = (e: React.MouseEvent, n: CenterNotification) => {
    // Evita colapsar se o usuário estiver selecionando texto com o mouse
    const sel = window.getSelection();
    if (sel && sel.toString().trim().length > 0) {
      return;
    }
    toggleExpand(n.id, n);
  };

  const handleCopyDetails = (e: React.MouseEvent, n: CenterNotification) => {
    e.stopPropagation();
    const fullText = n.body ? `${n.title}\n\n${n.body}` : n.title;
    navigator.clipboard?.writeText(fullText);
    setCopiedId(n.id);
    setTimeout(() => {
      setCopiedId((curr) => (curr === n.id ? null : curr));
    }, 2000);
    logSystemActivity('notifications', 'Copiar detalhes da notificação', n.projectName || 'Geral', {
      id: n.id,
      title: n.title,
    });
  };

  const tabBtn = (id: 'new' | 'history', label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{
        flex: 1,
        background: 'transparent',
        border: 'none',
        borderBottom: `2px solid ${tab === id ? accentColor : 'transparent'}`,
        color: tab === id ? C.text : C.textMuted,
        fontSize: 12,
        fontWeight: 500,
        padding: '10px 0',
        cursor: 'pointer',
        fontFamily: "'Poppins', sans-serif",
        transition: 'color 0.15s ease, border-color 0.15s ease',
      }}
    >
      {label}{' '}
      {count > 0 && (
        <span style={{ color: tab === id ? accentColor : C.textMuted, fontWeight: 400 }}>
          ({count})
        </span>
      )}
    </button>
  );

  if (!mounted) return null;

  return (
    <>
      <style>{`
        @keyframes notifPanelIn { from { transform: translateX(100%); opacity: 0.4; } to { transform: translateX(0); opacity: 1; } }
        @keyframes notifPanelOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(100%); opacity: 0; } }
        @keyframes notifFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes notifFadeOut { from { opacity: 1; } to { opacity: 0; } }
        @keyframes notifDetailIn { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          zIndex: 99989,
          background: 'rgba(0,0,0,0.25)',
          animation: `${closing ? 'notifFadeOut' : 'notifFadeIn'} ${ANIM_MS}ms ease both`,
        }}
      />
      <aside
        style={{
          position: 'fixed',
          top,
          right: 0,
          bottom: 0,
          width: 400,
          maxWidth: '92vw',
          zIndex: 99990,
          display: 'flex',
          flexDirection: 'column',
          background: C.bg,
          borderLeft: `1px solid ${C.border}`,
          borderRadius: '16px 0 0 16px',
          overflow: 'hidden',
          color: C.text,
          fontFamily: "'Poppins', sans-serif",
          animation: `${closing ? 'notifPanelOut' : 'notifPanelIn'} ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px 0' }}>
          <Bell size={16} color={accentColor} />
          <span style={{ fontSize: 14, fontWeight: 500, flex: 1 }}>Notificações</span>
          <button
            type="button"
            title="Fechar (Esc)"
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: C.textSecondary,
              cursor: 'pointer',
              display: 'flex',
              padding: 4,
              borderRadius: 6,
              transition: 'color 0.15s ease',
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginTop: 6 }}>
          {tabBtn('new', 'Novas', fresh.length)}
          {tabBtn('history', 'Histórico', history.length)}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {list.length === 0 && (
            <div
              style={{
                margin: 'auto',
                textAlign: 'center',
                color: C.textMuted,
                fontSize: 12,
                lineHeight: 1.6,
                padding: 24,
              }}
            >
              {tab === 'new'
                ? 'Nenhuma notificação nova.\nAvisos de IA, geração de telas e erros aparecem aqui.'
                : 'O histórico está vazio.\nAs notificações lidas ficam guardadas aqui.'}
            </div>
          )}

          {list.map((n) => {
            const isExpanded = expandedIds.has(n.id);
            const isCopied = copiedId === n.id;

            return (
              <div
                key={n.id}
                onClick={(e) => handleCardClick(e, n)}
                style={{
                  position: 'relative',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  padding: 10,
                  borderRadius: 10,
                  cursor: 'pointer',
                  background: isExpanded ? C.activeCard : C.card,
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  if (!isExpanded) e.currentTarget.style.background = C.hover;
                }}
                onMouseLeave={(e) => {
                  if (!isExpanded) e.currentTarget.style.background = C.card;
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div
                    style={{
                      width: 22,
                      display: 'flex',
                      justifyContent: 'center',
                      paddingTop: 2,
                      flexShrink: 0,
                    }}
                  >
                    <KindIcon n={n} color={accentColor} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          fontSize: 12.5,
                          fontWeight: n.read ? 400 : 500,
                          color: C.text,
                          flex: 1,
                          minWidth: 0,
                          overflow: isExpanded ? 'visible' : 'hidden',
                          textOverflow: isExpanded ? 'clip' : 'ellipsis',
                          whiteSpace: isExpanded ? 'normal' : 'nowrap',
                          wordBreak: 'break-word',
                          lineHeight: 1.4,
                        }}
                      >
                        {n.title}
                      </span>
                      {!n.read && (
                        <span
                          style={{
                            width: 7,
                            height: 7,
                            borderRadius: 4,
                            background: accentColor,
                            flexShrink: 0,
                          }}
                        />
                      )}
                      <div
                        style={{
                          color: C.textMuted,
                          display: 'flex',
                          alignItems: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      </div>
                    </div>

                    {!isExpanded && n.body && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: C.textSecondary,
                          marginTop: 2,
                          lineHeight: 1.45,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                        }}
                      >
                        {n.body}
                      </div>
                    )}

                    {!isExpanded && (
                      <div
                        style={{
                          fontSize: 10.5,
                          color: C.textMuted,
                          marginTop: 4,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: 6,
                        }}
                      >
                        <span>
                          {n.projectName ? `${n.projectName} · ` : ''}
                          {timeAgo(n.timestamp)}
                        </span>
                        {n.isUpdate && onUpdateAi && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateAi(n.provider || 'antigravity', n);
                            }}
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: accentColor,
                              border: 'none',
                              boxShadow: 'none',
                              color: '#ffffff',
                              fontSize: 10.5,
                              fontWeight: 400,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              transition: 'opacity 0.15s ease, transform 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                          >
                            <ArrowUpCircle size={11} strokeWidth={2} />
                            <span>Atualizar IA</span>
                          </button>
                        )}
                        {n.patchNotesUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.electronAPI?.shell?.openExternal) {
                                window.electronAPI.shell.openExternal(n.patchNotesUrl!);
                              } else {
                                window.open(n.patchNotesUrl, '_blank', 'noopener,noreferrer');
                              }
                              logSystemActivity('notifications', 'Abrir patch notes da IA', n.projectName || 'Geral', {
                                id: n.id,
                                provider: n.provider,
                                url: n.patchNotesUrl,
                              });
                            }}
                            title="Ver notas da versão (patch notes)"
                            style={{
                              padding: '2px 8px',
                              borderRadius: 4,
                              background: accentColor,
                              border: 'none',
                              boxShadow: 'none',
                              color: '#ffffff',
                              fontSize: 10.5,
                              fontWeight: 400,
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              transition: 'opacity 0.15s ease, transform 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                          >
                            <ExternalLink size={10.5} strokeWidth={2} />
                            <span>Patch Notes</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    title="Remover"
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemove(n.id);
                      logSystemActivity('notifications', 'Remover notificação', n.projectName || 'Geral', {
                        id: n.id,
                      });
                    }}
                    style={{
                      alignSelf: 'flex-start',
                      background: 'transparent',
                      border: 'none',
                      color: C.textMuted,
                      cursor: 'pointer',
                      display: 'flex',
                      padding: 2,
                      borderRadius: 4,
                      transition: 'color 0.15s ease',
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>

                {isExpanded && (
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 8,
                      marginTop: 2,
                      paddingLeft: 32,
                      animation: 'notifDetailIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) both',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {n.body && (
                      <div
                        style={{
                          fontSize: 11.5,
                          color: C.textSecondary,
                          lineHeight: 1.5,
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-word',
                          userSelect: 'text',
                          maxHeight: 240,
                          overflowY: 'auto',
                        }}
                      >
                        {n.body}
                      </div>
                    )}

                    <div style={{ height: 1, background: 'rgba(255, 255, 255, 0.08)', margin: '2px 0' }} />

                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: 8,
                        fontSize: 10.5,
                        color: C.textMuted,
                      }}
                    >
                      <span>
                        {n.projectName ? `${n.projectName} · ` : ''}
                        {new Date(n.timestamp).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <button
                          type="button"
                          onClick={(e) => handleCopyDetails(e, n)}
                          style={{
                            height: 28,
                            padding: '0 10px',
                            borderRadius: 6,
                            background: 'rgba(255, 255, 255, 0.06)',
                            border: 'none',
                            color: isCopied ? '#4ade80' : C.textSecondary,
                            fontSize: 11,
                            fontWeight: 400,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                            transition: 'background 0.15s ease, color 0.15s ease',
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)')}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)')}
                        >
                          {isCopied ? <Check size={12} /> : <Copy size={12} />}
                          <span>{isCopied ? 'Copiado' : 'Copiar'}</span>
                        </button>

                        {n.isUpdate && onUpdateAi && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onUpdateAi(n.provider || 'antigravity', n);
                            }}
                            style={{
                              height: 28,
                              padding: '0 10px',
                              borderRadius: 6,
                              background: accentColor,
                              border: 'none',
                              boxShadow: 'none',
                              color: '#ffffff',
                              fontSize: 11,
                              fontWeight: 400,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              transition: 'opacity 0.15s ease, transform 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                          >
                            <ArrowUpCircle size={12} strokeWidth={2} />
                            <span>Atualizar IA</span>
                          </button>
                        )}

                        {n.patchNotesUrl && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (window.electronAPI?.shell?.openExternal) {
                                window.electronAPI.shell.openExternal(n.patchNotesUrl!);
                              } else {
                                window.open(n.patchNotesUrl, '_blank', 'noopener,noreferrer');
                              }
                              logSystemActivity('notifications', 'Abrir patch notes da IA', n.projectName || 'Geral', {
                                id: n.id,
                                provider: n.provider,
                                url: n.patchNotesUrl,
                              });
                            }}
                            title="Ver patch notes no site oficial da IA"
                            style={{
                              height: 28,
                              padding: '0 10px',
                              borderRadius: 6,
                              background: accentColor,
                              border: 'none',
                              boxShadow: 'none',
                              color: '#ffffff',
                              fontSize: 11,
                              fontWeight: 400,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              transition: 'opacity 0.15s ease, transform 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                          >
                            <ExternalLink size={12} strokeWidth={2} />
                            <span>Ver Patch Notes</span>
                          </button>
                        )}

                        {(n.projectPath || n.source) && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onOpen(n);
                              logSystemActivity('notifications', 'Abrir ação da notificação', n.projectName || 'Geral', {
                                id: n.id,
                                source: n.source,
                                projectPath: n.projectPath,
                              });
                            }}
                            style={{
                              height: 28,
                              padding: '0 10px',
                              borderRadius: 6,
                              background: accentColor,
                              border: 'none',
                              color: '#ffffff',
                              fontSize: 11,
                              fontWeight: 400,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 4,
                              transition: 'opacity 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                          >
                            <ExternalLink size={12} />
                            <span>Abrir</span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {list.length > 0 && (
          <div
            style={{
              padding: '8px 12px',
              borderTop: `1px solid ${C.border}`,
              display: 'flex',
              justifyContent: 'flex-end',
            }}
          >
            {tab === 'new' ? (
              <button
                type="button"
                onClick={() => {
                  onReadAll();
                  logSystemActivity('notifications', 'Marcar todas como lidas', 'Sistema');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 28,
                  padding: '0 10px',
                  background: 'transparent',
                  border: 'none',
                  color: accentColor,
                  fontSize: 11.5,
                  fontWeight: 400,
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                <CheckCheck size={14} /> Marcar todas como lidas
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  onClearHistory();
                  logSystemActivity('notifications', 'Limpar histórico', 'Sistema');
                }}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  height: 28,
                  padding: '0 10px',
                  background: 'transparent',
                  border: 'none',
                  color: C.textSecondary,
                  fontSize: 11.5,
                  fontWeight: 400,
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                <Trash2 size={14} /> Limpar histórico
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
