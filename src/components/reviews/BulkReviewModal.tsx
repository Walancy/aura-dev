import React, { useEffect, useRef, useState } from 'react';
import { CheckCircle2, Circle, Loader2, Sparkles, X, XCircle } from 'lucide-react';
import type { TeamAiProvider } from '../team/TeamAiPanel';
import { hexToRgba } from '../../utils/color';
import { aiReviewAndSubmit, friendlyReviewError, submitDecision, type BulkEvent, type BulkItem } from './bulkReview';

export type BulkMode = BulkEvent | 'AI';

interface Props {
  mode: BulkMode;
  repo: string;
  prs: Array<{ number: number; title: string }>;
  provider: TeamAiProvider;
  isDark: boolean;
  accentColor: string;
  accentContrastText: string;
  onClose: () => void;
  /** chamado quando o lote termina, para recarregar a lista */
  onFinished: () => void;
}

const COPY: Record<BulkMode, { title: string; verb: string; color: string; text: (n: number) => string }> = {
  APPROVE: { title: 'Aprovar em massa', verb: 'Aprovar', color: '#3fb950', text: (n) => `${n} ${n === 1 ? 'pull request será aprovado' : 'pull requests serão aprovados'} no GitHub.` },
  REQUEST_CHANGES: { title: 'Solicitar alterações em massa', verb: 'Solicitar alterações', color: '#f85149', text: (n) => `Será pedida alteração em ${n} ${n === 1 ? 'pull request' : 'pull requests'}, com o comentário abaixo.` },
  AI: { title: 'Revisar com IA em massa', verb: 'Revisar com IA', color: '#3366ff', text: (n) => `A IA revisa ${n === 1 ? 'o pull request' : `os ${n} pull requests`} um por vez, decide entre aprovar ou solicitar alterações e envia a review ao GitHub com o texto dela.` },
};

export const BulkReviewModal: React.FC<Props> = ({ mode, repo, prs, provider, isDark, accentColor, accentContrastText, onClose, onFinished }) => {
  const [phase, setPhase] = useState<'confirm' | 'running' | 'done'>('confirm');
  const [comment, setComment] = useState('');
  const [items, setItems] = useState<BulkItem[]>(() => prs.map((p) => ({ ...p, status: 'pending' as const })));
  const run = useRef({ id: '', cancelled: false });
  const info = COPY[mode];
  const c = { bg: isDark ? '#181818' : '#ffffff', text: isDark ? '#ffffff' : '#111111', sub: isDark ? '#8c8c8c' : '#666666', line: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', field: isDark ? '#222222' : '#f1f1f1' };
  const needsComment = mode === 'REQUEST_CHANGES';

  const patch = (n: number, p: Partial<BulkItem>) => setItems((cur) => cur.map((i) => (i.number === n ? { ...i, ...p } : i)));

  const start = async () => {
    if (needsComment && !comment.trim()) return;
    setPhase('running');
    run.current.cancelled = false;
    for (const pr of prs) {
      if (run.current.cancelled) break;
      patch(pr.number, { status: 'running' });
      try {
        if (mode === 'AI') {
          run.current.id = `pr-bulk-${pr.number}-${Date.now()}`;
          const r = await aiReviewAndSubmit(repo, pr.number, provider, run.current);
          patch(pr.number, { status: 'done', decision: r.decision });
        } else {
          await submitDecision(repo, pr.number, mode, comment);
          patch(pr.number, { status: 'done', decision: mode });
        }
      } catch (e: any) {
        if (run.current.cancelled) { patch(pr.number, { status: 'pending' }); break; }
        patch(pr.number, { status: 'error', note: friendlyReviewError(e?.message || String(e)) });
      }
    }
    setPhase('done');
    onFinished();
  };

  const cancel = () => {
    run.current.cancelled = true;
    if (mode === 'AI' && run.current.id) window.electronAPI?.ai?.cancel?.(undefined, provider.cwd, run.current.id);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && phase !== 'running') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [phase, onClose]);

  const okCount = items.filter((i) => i.status === 'done').length;
  const errCount = items.filter((i) => i.status === 'error').length;
  const btn = (primary: boolean, disabled = false): React.CSSProperties => ({ height: 32, padding: '0 14px', border: 'none', borderRadius: 6, fontSize: 12, fontWeight: 400, cursor: disabled ? 'default' : 'pointer', opacity: disabled ? 0.5 : 1, background: primary ? (mode === 'AI' ? accentColor : info.color) : c.field, color: primary ? (mode === 'AI' ? accentContrastText : '#ffffff') : c.text, transition: 'transform 140ms var(--ease-out), opacity 150ms ease' });

  return (
    <div className="df-modal-backdrop" onClick={() => phase !== 'running' && onClose()} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', zIndex: 100005, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxWidth: '100%', maxHeight: '85vh', background: c.bg, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 12, color: c.text }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {mode === 'AI' ? <Sparkles size={16} color={accentColor} /> : mode === 'APPROVE' ? <CheckCircle2 size={16} color={info.color} /> : <XCircle size={16} color={info.color} />}
          <span style={{ flex: 1, fontSize: 14, fontWeight: 500 }}>{info.title}</span>
          {phase !== 'running' && (
            <button type="button" title="Fechar" onClick={onClose} className="df-pressable" style={{ width: 24, height: 24, border: 'none', background: 'transparent', color: c.sub, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={14} />
            </button>
          )}
        </div>
        {phase === 'confirm' && <span style={{ fontSize: 12, color: c.sub, lineHeight: 1.5 }}>{info.text(prs.length)}</span>}
        {phase === 'confirm' && needsComment && (
          <textarea autoFocus value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Comentário enviado em todos os pull requests (obrigatório)" rows={3} style={{ resize: 'vertical', border: 'none', outline: 'none', borderRadius: 6, background: c.field, color: c.text, fontFamily: 'inherit', fontSize: 12, padding: 8 }} />
        )}
        {phase === 'confirm' && mode === 'AI' && <span style={{ fontSize: 11.5, color: c.sub }}>IA usada: {provider.name}{provider.model ? ` (${provider.model})` : ''}. Cada revisão leva alguns minutos.</span>}

        <div style={{ overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, minHeight: 0 }}>
          {items.map((i) => (
            <div key={i.number} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderTop: `1px solid ${c.line}` }}>
              <span style={{ marginTop: 1, display: 'inline-flex' }}>
                {i.status === 'running' ? <Loader2 size={14} className="spin-animate" color={accentColor} /> : i.status === 'done' ? <CheckCircle2 size={14} color="#3fb950" /> : i.status === 'error' ? <XCircle size={14} color="#f85149" /> : <Circle size={14} color={c.sub} />}
              </span>
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 12, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>#{i.number} {i.title}</span>
                {i.status === 'running' && mode === 'AI' && <span style={{ fontSize: 11, color: c.sub }}>A IA está revisando…</span>}
                {i.status === 'done' && i.decision && <span style={{ fontSize: 11, color: i.decision === 'APPROVE' ? '#3fb950' : '#f85149' }}>{i.decision === 'APPROVE' ? 'Aprovado' : 'Alterações solicitadas'}</span>}
                {i.status === 'error' && <span style={{ fontSize: 11, color: '#f85149', wordBreak: 'break-word' }}>{i.note}</span>}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {phase === 'done' && <span style={{ flex: 1, fontSize: 11.5, color: c.sub }}>{okCount} concluído{okCount === 1 ? '' : 's'}{errCount ? `, ${errCount} com erro` : ''}</span>}
          {phase !== 'done' && <span style={{ flex: 1 }} />}
          {phase === 'confirm' && <button type="button" className="df-pressable" style={btn(false)} onClick={onClose}>Cancelar</button>}
          {phase === 'confirm' && <button type="button" className="df-pressable" style={btn(true, needsComment && !comment.trim())} disabled={needsComment && !comment.trim()} onClick={start}>{info.verb}</button>}
          {phase === 'running' && <button type="button" className="df-pressable" style={btn(false)} onClick={cancel}>Parar</button>}
          {phase === 'done' && <button type="button" className="df-pressable" style={{ ...btn(false), background: hexToRgba(accentColor, 0.16), color: accentColor }} onClick={onClose}>Fechar</button>}
        </div>
      </div>
    </div>
  );
};
