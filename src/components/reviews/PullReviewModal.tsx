import React, { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronRight, ExternalLink, FileDiff, GitPullRequest, Loader2, MessageSquare, Search, Sparkles, X } from 'lucide-react';
import { callAi, type TeamAiProvider } from '../team/TeamAiPanel';
import { relativeTime } from '../team/teamTypes';
import { ghSettings } from '../settings/settingsUi';
import { renderMarkdownPreview } from '../../utils/markdown';
import { getFieldTokens } from '../../utils/fieldTokens';
import { logSystemActivity } from '../../utils/brainService';

interface PullFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string;
}
interface PullData {
  pr: {
    number: number;
    title: string;
    body: string;
    state: string;
    merged: boolean;
    draft: boolean;
    url: string;
    author?: string;
    base: string;
    head: string;
    commits: number;
    comments: number;
    reviewComments: number;
    additions: number;
    deletions: number;
    createdAt: string;
  };
  files: PullFile[];
  reviews: Array<{ id: number; user?: string; state: string; body: string; submittedAt: string }>;
}

export interface PullReviewTarget {
  repo: string; // owner/repo
  number: number;
}

interface Props {
  isOpen: boolean;
  target: PullReviewTarget | null;
  onClose: () => void;
  isEffectiveDark: boolean;
  accentColor: string;
  aiProvider: TeamAiProvider;
  onToast: (msg: string) => void;
}

type DiffRow = { type: 'hunk' | 'add' | 'del' | 'ctx'; oldNo?: number; newNo?: number; text: string };

function parsePatch(patch: string): DiffRow[] {
  const rows: DiffRow[] = [];
  let o = 0;
  let n = 0;
  for (const line of patch.split('\n')) {
    const h = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
    if (h) {
      o = Number(h[1]);
      n = Number(h[2]);
      rows.push({ type: 'hunk', text: line });
    } else if (line.startsWith('+')) rows.push({ type: 'add', newNo: n++, text: line.slice(1) });
    else if (line.startsWith('-')) rows.push({ type: 'del', oldNo: o++, text: line.slice(1) });
    else if (line.startsWith('\\')) rows.push({ type: 'ctx', text: line });
    else rows.push({ type: 'ctx', oldNo: o++, newNo: n++, text: line.slice(1) });
  }
  return rows;
}

const REVIEW_EVENTS = [
  { id: 'COMMENT', label: 'Comentar', hint: 'Enviar feedback geral sem aprovar nem bloquear.' },
  { id: 'APPROVE', label: 'Aprovar', hint: 'Enviar feedback e aprovar as alterações.' },
  { id: 'REQUEST_CHANGES', label: 'Solicitar alterações', hint: 'Enviar feedback que precisa ser resolvido antes do merge.' },
] as const;

const STATE_LABEL: Record<string, string> = { APPROVED: 'aprovou', CHANGES_REQUESTED: 'pediu alterações', COMMENTED: 'comentou', DISMISSED: 'teve a review descartada' };

const buildAiPrompt = (data: PullData) => {
  let budget = 50000;
  const diffs = data.files
    .map((f) => {
      const patch = f.patch.slice(0, Math.min(6000, Math.max(budget, 0)));
      budget -= patch.length;
      return `### ${f.filename} (${f.status}, +${f.additions} -${f.deletions})\n${patch || '(sem diff textual)'}`;
    })
    .join('\n\n');
  return `Você é um revisor de código sênior. Revise este Pull Request em português do Brasil.

Título: ${data.pr.title}
Branch: ${data.pr.head} -> ${data.pr.base}
Descrição:
${data.pr.body.slice(0, 2000) || '(sem descrição)'}

Responda em Markdown com estas seções: ## Resumo, ## Problemas (bugs, segurança, performance e casos de borda; cite arquivo e trecho), ## Sugestões, ## Veredito (aprovar ou pedir alterações, e por quê). Seja objetivo e não invente problemas.

Diffs:
${diffs}`;
};

export const PullReviewModal: React.FC<Props> = ({ isOpen, target, onClose, isEffectiveDark, accentColor, aiProvider, onToast }) => {
  const [data, setData] = useState<PullData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'conversa' | 'arquivos' | 'ia'>('arquivos');
  const [filter, setFilter] = useState('');
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [aiText, setAiText] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [event, setEvent] = useState<(typeof REVIEW_EVENTS)[number]['id']>('COMMENT');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const ft = getFieldTokens(isEffectiveDark);
  const c = useMemo(
    () => ({
      bg: isEffectiveDark ? '#161618' : '#ffffff',
      card: isEffectiveDark ? '#1c1c1f' : '#f6f8fa',
      text: isEffectiveDark ? '#ffffff' : '#111111',
      sub: isEffectiveDark ? '#9a9a9a' : '#666666',
      muted: isEffectiveDark ? '#6b6b6b' : '#999999',
      line: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      add: 'rgba(46,160,67,0.18)',
      del: 'rgba(248,81,73,0.18)',
      hunk: 'rgba(56,139,253,0.14)',
      addText: '#3fb950',
      delText: '#f85149',
    }),
    [isEffectiveDark],
  );

  const [owner, repo] = (target?.repo || '').split('/');

  useEffect(() => {
    if (!isOpen || !target) return;
    setData(null);
    setError(null);
    setTab('arquivos');
    setFilter('');
    setAiText('');
    setBody('');
    setSubmitOpen(false);
    setCollapsed(new Set());
    let cancelled = false;
    ghSettings<PullData>('getPullReview', { owner, repo, number: target.number })
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setActiveFile(d.files[0]?.filename || null);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [isOpen, target?.repo, target?.number]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (submitOpen) setSubmitOpen(false);
      else onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, submitOpen, onClose]);

  const files = useMemo(() => (data?.files || []).filter((f) => f.filename.toLowerCase().includes(filter.trim().toLowerCase())), [data, filter]);

  if (!isOpen || !target) return null;

  const runAiReview = async () => {
    if (!data || aiBusy) return;
    setAiBusy(true);
    setTab('ia');
    logSystemActivity('review', 'revisar_com_ia', `${target.repo}#${target.number}`, { provider: aiProvider.id });
    try {
      setAiText(await callAi(aiProvider, buildAiPrompt(data)));
    } catch (e: any) {
      setAiText('');
      onToast(`Falhou: ${e.message}`);
    } finally {
      setAiBusy(false);
    }
  };

  const sendReview = async () => {
    if (event !== 'APPROVE' && !body.trim()) {
      onToast('Escreva um comentário para enviar este tipo de review.');
      return;
    }
    setSending(true);
    try {
      await ghSettings('submitReview', { owner, repo, number: target.number, event, body: body.trim() || undefined });
      logSystemActivity('review', 'enviar_review', `${target.repo}#${target.number}`, { event });
      onToast('Review enviado.');
      setSubmitOpen(false);
      setBody('');
      ghSettings<PullData>('getPullReview', { owner, repo, number: target.number }).then(setData).catch(() => {});
    } catch (e: any) {
      onToast(`Falhou: ${e.message}`);
    } finally {
      setSending(false);
    }
  };

  const btn = (primary = false, disabled = false): React.CSSProperties => ({
    height: 30,
    padding: '0 12px',
    border: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 400,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    background: primary ? accentColor : ft.fieldBg,
    color: primary ? '#ffffff' : c.text,
    transition: 'opacity 0.15s ease, background 0.15s ease',
  });

  const pr = data?.pr;
  const statusLabel = pr ? (pr.merged ? 'Merged' : pr.draft ? 'Draft' : pr.state === 'open' ? 'Open' : 'Closed') : '';
  const statusColor = pr ? (pr.merged ? '#8957e5' : pr.draft ? '#6e7681' : pr.state === 'open' ? '#238636' : '#da3633') : c.muted;

  const tabBtn = (id: typeof tab, label: string, count?: number, icon?: React.ReactNode) => (
    <button
      key={id}
      type="button"
      onClick={() => setTab(id)}
      style={{ height: 32, padding: '0 12px', border: 'none', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 400, cursor: 'pointer', background: tab === id ? ft.fieldBg : 'transparent', color: tab === id ? c.text : c.sub, transition: 'background 0.15s ease' }}
    >
      {icon}
      {label}
      {count !== undefined && <span style={{ fontSize: 10.5, color: c.sub, background: c.card, borderRadius: 10, padding: '0 6px' }}>{count}</span>}
    </button>
  );

  const renderDiff = (f: PullFile) => {
    const rows = parsePatch(f.patch);
    const isCollapsed = collapsed.has(f.filename);
    return (
      <div key={f.filename} id={`pr-file-${f.filename}`} style={{ background: c.card, borderRadius: 8, overflow: 'hidden', marginBottom: 12 }}>
        <div
          onClick={() => setCollapsed((prev) => { const n = new Set(prev); if (!n.delete(f.filename)) n.add(f.filename); return n; })}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', cursor: 'pointer', fontSize: 12, color: c.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}
        >
          {isCollapsed ? <ChevronRight size={14} color={c.sub} /> : <ChevronDown size={14} color={c.sub} />}
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename}</span>
          <span style={{ color: c.addText }}>+{f.additions}</span>
          <span style={{ color: c.delText }}>-{f.deletions}</span>
        </div>
        {!isCollapsed &&
          (rows.length > 1 || f.patch ? (
            <div style={{ overflowX: 'auto', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 12, lineHeight: '20px' }}>
              {rows.map((r, i) => (
                <div key={i} style={{ display: 'flex', minWidth: 'max-content', background: r.type === 'add' ? c.add : r.type === 'del' ? c.del : r.type === 'hunk' ? c.hunk : 'transparent', color: r.type === 'hunk' ? c.sub : c.text }}>
                  <span style={{ width: 44, textAlign: 'right', paddingRight: 8, color: c.muted, userSelect: 'none', flexShrink: 0 }}>{r.oldNo ?? ''}</span>
                  <span style={{ width: 44, textAlign: 'right', paddingRight: 8, color: c.muted, userSelect: 'none', flexShrink: 0 }}>{r.newNo ?? ''}</span>
                  <span style={{ width: 16, color: r.type === 'add' ? c.addText : r.type === 'del' ? c.delText : c.muted, userSelect: 'none', flexShrink: 0 }}>{r.type === 'add' ? '+' : r.type === 'del' ? '-' : ''}</span>
                  <span style={{ whiteSpace: 'pre', paddingRight: 12 }}>{r.text}</span>
                </div>
              ))}
            </div>
          ) : (
            <div style={{ padding: '10px 12px', fontSize: 12, color: c.sub }}>Sem diff textual (arquivo binário, renomeado ou grande demais). Veja no GitHub.</div>
          ))}
      </div>
    );
  };

  return (
    <div
      style={{ position: 'fixed', inset: 0, zIndex: 99999, background: isEffectiveDark ? 'rgba(0,0,0,0.75)' : 'rgba(0,0,0,0.45)', backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: 1240, height: 'min(860px, calc(100vh - 32px))', background: c.bg, borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Título e status */}
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 18, color: c.text, lineHeight: 1.3 }}>
              {pr?.title || 'Carregando review…'} <span style={{ color: c.muted }}>#{target.number}</span>
            </div>
            <button type="button" title="Abrir no GitHub" onClick={() => window.electronAPI?.shell?.openExternal?.(pr?.url || `https://github.com/${target.repo}/pull/${target.number}`)} style={{ ...btn(), width: 30, padding: 0, justifyContent: 'center' }}>
              <ExternalLink size={13} />
            </button>
            <button type="button" title="Fechar" onClick={onClose} style={{ ...btn(), width: 30, padding: 0, justifyContent: 'center' }}>
              <X size={14} />
            </button>
          </div>
          {pr && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: c.sub, flexWrap: 'wrap' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: statusColor, color: '#fff', borderRadius: 16, padding: '3px 10px', fontSize: 12 }}>
                <GitPullRequest size={12} /> {statusLabel}
              </span>
              <span>
                <span style={{ color: c.text }}>{pr.author}</span> quer fazer merge de {pr.commits} {pr.commits === 1 ? 'commit' : 'commits'} em <code style={{ background: c.card, borderRadius: 4, padding: '1px 6px' }}>{pr.base}</code> a partir de{' '}
                <code style={{ background: c.card, borderRadius: 4, padding: '1px 6px' }}>{pr.head}</code>
              </span>
              <span>{relativeTime(pr.createdAt)}</span>
              <span style={{ color: c.muted }}>{target.repo}</span>
            </div>
          )}
        </div>

        {/* Abas à esquerda, ações à direita */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '0 16px 8px', flexShrink: 0, position: 'relative' }}>
          {tabBtn('conversa', 'Conversa', pr ? pr.comments + data!.reviews.length : undefined, <MessageSquare size={13} />)}
          {tabBtn('arquivos', 'Arquivos alterados', data?.files.length, <FileDiff size={13} />)}
          {(aiBusy || aiText) && tabBtn('ia', 'Revisão da IA', undefined, <Sparkles size={13} />)}
          <span style={{ flex: 1 }} />
          {pr && (
            <span style={{ fontSize: 12, marginRight: 8 }}>
              <span style={{ color: c.addText }}>+{pr.additions}</span> <span style={{ color: c.delText }}>-{pr.deletions}</span>
            </span>
          )}
          <button type="button" style={btn(false, !data || aiBusy)} disabled={!data || aiBusy} onClick={runAiReview}>
            {aiBusy ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Sparkles size={13} color={accentColor} />}
            Revisar com IA
          </button>
          <button type="button" style={btn(true, !data)} disabled={!data} onClick={() => setSubmitOpen((v) => !v)}>
            Enviar review <ChevronDown size={13} />
          </button>
          {submitOpen && (
            <div style={{ position: 'absolute', right: 16, top: 'calc(100% - 4px)', zIndex: 5, width: 380, background: c.card, borderRadius: 10, padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontSize: 13, color: c.text }}>Enviar review</div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Deixe um comentário"
                style={{ minHeight: 110, resize: 'vertical', border: 'none', outline: 'none', borderRadius: 6, padding: 10, background: ft.fieldBg, color: c.text, fontSize: 12.5, fontFamily: 'inherit' }}
              />
              {REVIEW_EVENTS.map((ev) => (
                <label key={ev.id} style={{ display: 'flex', gap: 8, cursor: 'pointer', alignItems: 'flex-start' }}>
                  <input type="radio" checked={event === ev.id} onChange={() => setEvent(ev.id)} style={{ marginTop: 3, accentColor }} />
                  <span>
                    <span style={{ display: 'block', fontSize: 12.5, color: c.text }}>{ev.label}</span>
                    <span style={{ display: 'block', fontSize: 11.5, color: c.sub }}>{ev.hint}</span>
                  </span>
                </label>
              ))}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <button type="button" style={btn()} onClick={() => setSubmitOpen(false)}>
                  Cancelar
                </button>
                <button type="button" style={btn(true, sending)} disabled={sending} onClick={sendReview}>
                  {sending ? <Loader2 size={13} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={13} />}
                  Enviar
                </button>
              </div>
            </div>
          )}
        </div>
        <div style={{ height: 1, background: c.line, flexShrink: 0 }} />

        {/* Conteúdo */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
          {error ? (
            <div style={{ padding: 24, fontSize: 13, color: c.delText }}>{error}</div>
          ) : !data ? (
            <div style={{ padding: 24, fontSize: 13, color: c.sub, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Carregando…
            </div>
          ) : tab === 'arquivos' ? (
            <>
              <div style={{ width: 300, flexShrink: 0, padding: 12, display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderRadius: 6, background: ft.fieldBg }}>
                  <Search size={13} color={c.sub} />
                  <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filtrar arquivos…" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: c.text, fontSize: 12 }} />
                </div>
                {files.map((f) => {
                  const i = f.filename.lastIndexOf('/');
                  return (
                    <div
                      key={f.filename}
                      onClick={() => {
                        setActiveFile(f.filename);
                        document.getElementById(`pr-file-${f.filename}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      title={f.filename}
                      style={{ padding: '5px 8px', borderRadius: 6, cursor: 'pointer', fontSize: 12, background: activeFile === f.filename ? ft.fieldBg : 'transparent', transition: 'background 0.12s ease' }}
                    >
                      <div style={{ color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename.slice(i + 1)}</div>
                      {i > 0 && <div style={{ color: c.muted, fontSize: 10.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.filename.slice(0, i)}</div>}
                    </div>
                  );
                })}
              </div>
              <div style={{ width: 1, background: c.line }} />
              <div style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: 12 }}>{(filter ? files : data.files).map(renderDiff)}</div>
            </>
          ) : tab === 'conversa' ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ background: c.card, borderRadius: 8, padding: 14 }}>
                {renderMarkdownPreview(data.pr.body || '_Sem descrição._', { textPrimary: c.text, textSecondary: c.sub, textMuted: c.muted, border: c.line, accentColor, isEffectiveDark, fontSize: 12.5, regularFont: true })}
              </div>
              {data.reviews.map((r) => (
                <div key={r.id} style={{ background: c.card, borderRadius: 8, padding: 12, fontSize: 12.5, color: c.text }}>
                  <span>{r.user}</span> <span style={{ color: r.state === 'APPROVED' ? c.addText : r.state === 'CHANGES_REQUESTED' ? c.delText : c.sub }}>{STATE_LABEL[r.state] || r.state.toLowerCase()}</span> <span style={{ color: c.muted }}>{relativeTime(r.submittedAt)}</span>
                  {r.body && <div style={{ marginTop: 6, color: c.sub, whiteSpace: 'pre-wrap' }}>{r.body}</div>}
                </div>
              ))}
              {data.reviews.length === 0 && <div style={{ fontSize: 12.5, color: c.sub }}>Nenhuma review enviada ainda.</div>}
            </div>
          ) : (
            <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {aiBusy ? (
                <div style={{ fontSize: 13, color: c.sub, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> A IA está revisando o código…
                </div>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      type="button"
                      style={btn(true)}
                      onClick={() => {
                        setBody(aiText);
                        setSubmitOpen(true);
                      }}
                    >
                      Usar como comentário da review
                    </button>
                    <button type="button" style={btn()} onClick={runAiReview}>
                      Revisar de novo
                    </button>
                  </div>
                  <div style={{ background: c.card, borderRadius: 8, padding: 14 }}>
                    {renderMarkdownPreview(aiText, { textPrimary: c.text, textSecondary: c.sub, textMuted: c.muted, border: c.line, accentColor, isEffectiveDark, fontSize: 12.5, regularFont: true })}
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
