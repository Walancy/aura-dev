import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Sparkles, Download, ExternalLink } from 'lucide-react';
import { popupColors } from './PopupPortal';
import { logSystemActivity } from '../../utils/brainService';

type Info = NonNullable<Awaited<ReturnType<NonNullable<NonNullable<Window['electronAPI']>['updater']>['check']>>['info']>;

const CHECK_EVERY_MS = 4 * 60 * 60 * 1000;
const NOTIFIED_KEY = 'aura_update_notified_version';

/** Texto da release sem os títulos/links de markdown, para caber no popup. */
const plainNotes = (md: string) =>
  md
    .replace(/\r/g, '')
    .replace(/^#{1,6}\s*/gm, '')
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^\s*\*\s+/gm, '- ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

/** Ícone brilhante ao lado da foto do usuário: aparece só quando há release nova no GitHub e abre o popup de atualização. */
export const AppUpdateButton: React.FC<{
  isDark: boolean;
  accentColor: string;
  accentTextColor: string;
  onNotify: (title: string, body: string) => void;
}> = ({ isDark, accentColor, accentTextColor, onNotify }) => {
  const api = window.electronAPI?.updater;
  const [info, setInfo] = useState<Info | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [percent, setPercent] = useState(0);
  const [message, setMessage] = useState('');
  const colors = popupColors(isDark);
  // o pai recria o callback a cada render; em ref para não reiniciar os timers da checagem
  const notifyRef = useRef(onNotify);
  notifyRef.current = onNotify;

  const check = useCallback(async () => {
    if (!api) return;
    const res = await api.check();
    if (!res.success || !res.info?.available) return;
    setInfo(res.info);
    let seen: string | null = null;
    try { seen = localStorage.getItem(NOTIFIED_KEY); } catch {}
    if (seen !== res.info.latest) {
      try { localStorage.setItem(NOTIFIED_KEY, res.info.latest); } catch {}
      notifyRef.current(`Aura Dev ${res.info.latest} disponível`, `Você está na versão ${res.info.current}. Clique no ícone brilhante ao lado da sua foto para atualizar.`);
    }
  }, [api]);

  useEffect(() => {
    if (!api) return;
    const first = setTimeout(check, 8000);
    const timer = setInterval(check, CHECK_EVERY_MS);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, [api, check]);

  useEffect(() => api?.onProgress((p) => setPercent(p.percent)), [api]);

  if (!api || !info) return null;

  const update = async () => {
    setBusy(true);
    setPercent(0);
    setMessage('');
    logSystemActivity('app', 'atualizar_app', `Aura Dev ${info.latest}`, { de: info.current });
    const res = await api.install();
    if (!res.success) setMessage(res.error || 'Não consegui atualizar. Tente de novo.');
    else if (res.manual) setMessage('Abri a página da release no navegador para você baixar a nova versão.');
    else setMessage('Reiniciando o Aura Dev...');
    if (!res.success || res.manual) setBusy(false);
  };

  const btn: React.CSSProperties = { width: '100%', height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, border: 'none', borderRadius: 6, fontSize: 12, fontFamily: 'Poppins', fontWeight: 400, cursor: 'pointer', transition: 'background-color 0.15s ease, opacity 0.15s ease' };
  const notes = plainNotes(info.notes);

  return (
    <div style={{ position: 'relative' }}>
      <div
        className="df-pressable df-update-glow"
        onClick={() => setOpen((v) => !v)}
        title={`Nova versão ${info.latest} disponível`}
        style={{ ['--update-color' as any]: accentColor, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accentColor, cursor: 'pointer' }}
      >
        <Sparkles size={18} />
      </div>
      {open && (
        <>
          <div onClick={() => !busy && setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 99998 }} />
          <div
            className="df-dropdown-menu df-popover-right"
            style={{ position: 'absolute', top: 'calc(100% + 8px)', right: 0, width: 300, padding: 12, borderRadius: 10, zIndex: 99999, display: 'flex', flexDirection: 'column', gap: 12, color: colors.text }}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontSize: 13, fontWeight: 500 }}>Aura Dev {info.latest} disponível</div>
              <div style={{ fontSize: 11, color: colors.sub }}>Você está na versão {info.current}.</div>
            </div>
            {notes && (
              <div style={{ maxHeight: 140, overflowY: 'auto', fontSize: 12, lineHeight: '17px', color: colors.sub, whiteSpace: 'pre-wrap', background: colors.field, borderRadius: 6, padding: 8 }}>
                {notes}
              </div>
            )}
            {busy && (
              <div style={{ height: 4, borderRadius: 2, background: colors.line, overflow: 'hidden' }}>
                <div style={{ width: `${percent}%`, height: '100%', background: accentColor, transition: 'width 0.2s ease' }} />
              </div>
            )}
            {message && <div style={{ fontSize: 11, color: colors.sub }}>{message}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button type="button" disabled={busy} onClick={update} style={{ ...btn, background: accentColor, color: accentTextColor, opacity: busy ? 0.6 : 1 }}>
                <Download size={14} />
                {busy ? (percent < 100 ? `Baixando ${percent}%` : 'Instalando...') : 'Atualizar agora'}
              </button>
              <button
                type="button"
                onClick={() => api.openReleasePage(info.pageUrl)}
                style={{ ...btn, background: 'transparent', color: colors.sub }}
                onMouseEnter={(e) => (e.currentTarget.style.background = colors.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <ExternalLink size={14} />
                Ver novidades
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
