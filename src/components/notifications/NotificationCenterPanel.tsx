import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, Bell, CheckCheck, Info, Palette, Trash2, X } from 'lucide-react';
import { renderAiIcon } from '../icons/AiProviderIcons';
import { timeAgo, type CenterNotification } from './notificationStore';

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
  border: 'rgba(255,255,255,0.10)',
  card: 'rgba(255,255,255,0.05)',
  hover: 'rgba(255,255,255,0.09)',
};
const ANIM_MS = 240;

function KindIcon({ n, color }: { n: CenterNotification; color: string }) {
  if ((n.kind === 'ai' || n.kind === 'design') && n.provider) return <>{renderAiIcon(n.provider === 'agy' ? 'antigravity' : n.provider, 18)}</>;
  if (n.kind === 'design') return <Palette size={18} color={color} />;
  if (n.kind === 'error') return <AlertCircle size={18} color="#f87171" />;
  return <Info size={18} color={color} />;
}

/** Sidebar à direita: notificações novas e histórico (as já lidas), com ações em massa. */
export default function NotificationCenterPanel({ open, items, onClose, onOpen, onRead, onReadAll, onRemove, onClearHistory, accentColor, isEffectiveDark, themeTokens, top = 56 }: Props) {
  const [tab, setTab] = useState<'new' | 'history'>('new');
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const tabBtn = (id: 'new' | 'history', label: string, count: number) => (
    <button
      type="button"
      onClick={() => setTab(id)}
      style={{ flex: 1, background: 'transparent', border: 'none', borderBottom: `2px solid ${tab === id ? accentColor : 'transparent'}`, color: tab === id ? C.text : C.textMuted, fontSize: 12, fontWeight: 600, padding: '10px 0', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}
    >
      {label} {count > 0 && <span style={{ color: tab === id ? accentColor : C.textMuted, fontWeight: 500 }}>({count})</span>}
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
      `}</style>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 99989, background: 'rgba(0,0,0,0.25)', animation: `${closing ? 'notifFadeOut' : 'notifFadeIn'} ${ANIM_MS}ms ease both` }} />
      <aside
        style={{ position: 'fixed', top, right: 0, bottom: 0, width: 380, maxWidth: '92vw', zIndex: 99990, display: 'flex', flexDirection: 'column', background: C.bg, borderLeft: `1px solid ${C.border}`, borderRadius: '18px 0 0 18px', overflow: 'hidden', boxShadow: '-16px 0 48px rgba(0,0,0,0.55)', color: C.text, fontFamily: "'Poppins', sans-serif", animation: `${closing ? 'notifPanelOut' : 'notifPanelIn'} ${ANIM_MS}ms cubic-bezier(0.22, 1, 0.36, 1) both` }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 16px 0' }}>
          <Bell size={16} color={accentColor} />
          <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Notificações</span>
          <button type="button" title="Fechar (Esc)" onClick={onClose} style={{ background: 'transparent', border: 'none', color: C.textSecondary, cursor: 'pointer', display: 'flex', padding: 4 }}>
            <X size={16} />
          </button>
        </div>
        <div style={{ display: 'flex', borderBottom: `1px solid ${C.border}`, marginTop: 6 }}>
          {tabBtn('new', 'Novas', fresh.length)}
          {tabBtn('history', 'Histórico', history.length)}
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {list.length === 0 && (
            <div style={{ margin: 'auto', textAlign: 'center', color: C.textMuted, fontSize: 12, lineHeight: 1.6, padding: 24 }}>
              {tab === 'new' ? 'Nenhuma notificação nova.\nAvisos de IA, geração de telas e erros aparecem aqui.' : 'O histórico está vazio.\nAs notificações lidas ficam guardadas aqui.'}
            </div>
          )}
          {list.map((n) => (
            <div
              key={n.id}
              onClick={() => onOpen(n)}
              style={{ position: 'relative', display: 'flex', gap: 10, padding: '10px 10px 10px 12px', borderRadius: 10, cursor: n.projectPath || n.source ? 'pointer' : 'default', background: C.card }}
              onMouseEnter={(e) => (e.currentTarget.style.background = C.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = C.card)}
            >
              <div style={{ width: 22, display: 'flex', justifyContent: 'center', paddingTop: 1, flexShrink: 0 }}>
                <KindIcon n={n} color={accentColor} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 12.5, fontWeight: n.read ? 500 : 600, color: C.text, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.title}</span>
                  {!n.read && <span style={{ width: 7, height: 7, borderRadius: 4, background: accentColor, flexShrink: 0 }} />}
                </div>
                {n.body && (
                  <div style={{ fontSize: 11.5, color: C.textSecondary, marginTop: 2, lineHeight: 1.45, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{n.body}</div>
                )}
                <div style={{ fontSize: 10.5, color: C.textMuted, marginTop: 4 }}>
                  {n.projectName ? `${n.projectName} · ` : ''}{timeAgo(n.timestamp)}
                </div>
              </div>
              <button
                type="button"
                title="Remover"
                onClick={(e) => { e.stopPropagation(); onRemove(n.id); }}
                style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: C.textMuted, cursor: 'pointer', display: 'flex', padding: 2 }}
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>

        {list.length > 0 && (
          <div style={{ padding: '8px 12px', borderTop: `1px solid ${C.border}`, display: 'flex', justifyContent: 'flex-end' }}>
            {tab === 'new' ? (
              <button type="button" onClick={onReadAll} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: accentColor, fontSize: 11.5, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
                <CheckCheck size={14} /> Marcar todas como lidas
              </button>
            ) : (
              <button type="button" onClick={onClearHistory} style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: 'none', color: C.textSecondary, fontSize: 11.5, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>
                <Trash2 size={14} /> Limpar histórico
              </button>
            )}
          </div>
        )}
      </aside>
    </>
  );
}
