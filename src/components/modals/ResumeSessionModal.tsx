import React, { useEffect, useMemo, useState } from 'react';
import { History, Loader2, Search, X } from 'lucide-react';
import { Segmented } from '../settings/settingsUi';
import { getFieldTokens } from '../../utils/fieldTokens';

export interface ResumableSession {
  id: string;
  title: string;
  updatedAt: number;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  projectPath: string;
  projectName?: string;
  initialProvider?: string;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  onResume: (provider: string, session: ResumableSession) => void;
}

const PROVIDERS = [
  { id: 'claude', label: 'Claude Code' },
  { id: 'codex', label: 'Codex' },
  { id: 'gemini', label: 'Gemini' },
  { id: 'agy', label: 'Antigravity' },
];

const ago = (ts: number) => {
  const m = Math.max(0, Math.round((Date.now() - ts) / 60000));
  if (m < 1) return 'agora';
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.round(m / 60)} h`;
  if (m < 43200) return `${Math.round(m / 1440)} d`;
  return new Date(ts).toLocaleDateString('pt-BR');
};

// Conversas que o /resume de cada CLI mostraria para o projeto aberto; ao escolher, abre o CLI já retomando a conversa
export const ResumeSessionModal: React.FC<Props> = ({ isOpen, onClose, projectPath, projectName, initialProvider, isEffectiveDark, accentColor, accentContrastText, onResume }) => {
  const [provider, setProvider] = useState('claude');
  const [items, setItems] = useState<ResumableSession[] | null>(null);
  const [query, setQuery] = useState('');

  const ft = getFieldTokens(isEffectiveDark);
  const theme = useMemo(
    () => ({
      controlBg: ft.fieldBg,
      controlHoverBg: ft.fieldBgHover,
      textPrimary: isEffectiveDark ? '#ffffff' : '#111111',
      textSecondary: isEffectiveDark ? '#888888' : '#777777',
      textMuted: isEffectiveDark ? '#555555' : '#999999',
    }),
    [isEffectiveDark, ft],
  );

  useEffect(() => {
    if (!isOpen) return;
    const p = initialProvider === 'antigravity' ? 'agy' : initialProvider;
    setProvider(PROVIDERS.some((x) => x.id === p) ? (p as string) : 'claude');
    setQuery('');
  }, [isOpen, initialProvider]);

  useEffect(() => {
    if (!isOpen) return;
    let stop = false;
    setItems(null);
    window.electronAPI?.aiSessions?.list(provider, projectPath).then((r) => !stop && setItems(r || [])).catch(() => !stop && setItems([]));
    return () => {
      stop = true;
    };
  }, [isOpen, provider, projectPath]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  const q = query.trim().toLowerCase();
  const visible = (items || []).filter((s) => !q || s.title.toLowerCase().includes(q));

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: isEffectiveDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 640, height: 'min(620px, calc(100vh - 32px))', background: isEffectiveDark ? '#161618' : '#ffffff', borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 16, flexShrink: 0 }}>
          <History size={15} color={accentColor} />
          <span style={{ flex: 1, fontSize: 13, color: theme.textPrimary }}>
            Retomar conversa {projectName && <span style={{ color: theme.textMuted, fontSize: 11.5 }}>{projectName}</span>}
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Fechar"
            style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', borderRadius: 6, background: 'transparent', color: theme.textSecondary, cursor: 'pointer', transition: 'background 0.15s ease' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = theme.controlHoverBg)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={14} />
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '0 16px 12px', flexShrink: 0 }}>
          <Segmented ctx={{ theme, accentColor, accentContrastText, isEffectiveDark }} value={provider} options={PROVIDERS} onChange={setProvider} />
          <div style={{ flex: 1, height: 28, display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px', background: ft.fieldBg, borderRadius: 6 }}>
            <Search size={12} color={theme.textSecondary} />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar conversa…"
              style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: theme.textPrimary, fontSize: 12, fontFamily: 'inherit' }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {items === null ? (
            <div style={{ padding: 32, display: 'flex', justifyContent: 'center', color: theme.textSecondary }}>
              <Loader2 size={16} className="spin" />
            </div>
          ) : visible.length === 0 ? (
            <div style={{ padding: 32, textAlign: 'center', fontSize: 12, color: theme.textSecondary }}>{items.length ? 'Nenhuma conversa corresponde à busca.' : 'Nenhuma conversa deste projeto nesta IA.'}</div>
          ) : (
            visible.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => onResume(provider, s)}
                style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 10px', border: 'none', borderRadius: 6, background: 'transparent', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'background 0.12s ease' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = theme.controlHoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: theme.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</span>
                <span style={{ fontSize: 11, color: theme.textMuted, flexShrink: 0 }}>{ago(s.updatedAt)}</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
};
