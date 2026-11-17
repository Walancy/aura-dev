import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, ChevronRight, CircleDashed, Clock, ExternalLink, GitBranch, Loader2, MoreHorizontal, Play, PlayCircle, RefreshCw, RotateCcw, Search, Sparkles, StopCircle, Trash2, X, XCircle } from 'lucide-react';
import { ghSettings } from '../settings/settingsUi';
import { PopupPortal, popupColors } from '../ui/PopupPortal';
import { renderAiIcon } from '../icons/AiProviderIcons';
import { getFieldTokens } from '../../utils/fieldTokens';
import { logSystemActivity } from '../../utils/brainService';
import { relativeTime } from '../team/teamTypes';

export interface WorkflowItem {
  id: number;
  name: string;
  path: string;
  state: string;
}
interface RunItem {
  id: number;
  workflowId: number;
  name: string;
  title: string;
  runNumber: number;
  attempt?: number;
  event: string;
  status: string;
  conclusion: string | null;
  branch: string;
  sha: string;
  actor?: string;
  actorAvatar?: string;
  createdAt: string;
  startedAt: string;
  updatedAt: string;
  url: string;
  commit?: string;
  path?: string;
}
interface StepItem {
  number: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt?: string;
  completedAt?: string;
  log?: string[];
}
interface JobItem {
  id: number;
  name: string;
  status: string;
  conclusion: string | null;
  startedAt?: string;
  completedAt?: string;
  url?: string;
  runner?: string;
  steps: StepItem[];
}

// ---------- utilidades ----------
const wfCache = new Map<string, { at: number; list: WorkflowItem[] }>();
const loadWorkflows = async (repoFullName: string, force = false): Promise<WorkflowItem[]> => {
  const hit = wfCache.get(repoFullName);
  if (hit && !force && Date.now() - hit.at < 30000) return hit.list;
  const [owner, repo] = repoFullName.split('/');
  const list = await ghSettings<WorkflowItem[]>('workflowList', { owner, repo });
  wfCache.set(repoFullName, { at: Date.now(), list });
  return list;
};

type Kind = 'ok' | 'bad' | 'run' | 'queued' | 'cancel' | 'skip' | 'warn';
const kindOf = (status: string, conclusion: string | null): Kind => {
  if (status === 'in_progress') return 'run';
  if (status !== 'completed') return 'queued';
  if (conclusion === 'success') return 'ok';
  if (conclusion === 'failure' || conclusion === 'timed_out' || conclusion === 'startup_failure') return 'bad';
  if (conclusion === 'cancelled') return 'cancel';
  if (conclusion === 'action_required') return 'warn';
  return 'skip';
};
const KIND_COLOR: Record<Kind, string> = { ok: '#3fb950', bad: '#f85149', run: '#d29922', queued: '#d29922', cancel: '#8b949e', skip: '#8b949e', warn: '#d29922' };
const KIND_LABEL: Record<Kind, string> = { ok: 'Sucesso', bad: 'Falhou', run: 'Em andamento', queued: 'Na fila', cancel: 'Cancelado', skip: 'Ignorado', warn: 'Requer ação' };

const StatusIcon: React.FC<{ kind: Kind; size?: number }> = ({ kind, size = 16 }) => {
  const color = KIND_COLOR[kind];
  if (kind === 'run') return <Loader2 size={size} className="spin-animate" color={color} />;
  if (kind === 'queued') return <Clock size={size} color={color} />;
  if (kind === 'ok') return <span style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Check size={size - 5} color="#fff" strokeWidth={3} /></span>;
  if (kind === 'bad') return <span style={{ width: size, height: size, borderRadius: '50%', background: color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={size - 5} color="#fff" strokeWidth={3} /></span>;
  if (kind === 'cancel') return <StopCircle size={size} color={color} />;
  if (kind === 'warn') return <CircleDashed size={size} color={color} />;
  return <CircleDashed size={size} color={color} />;
};

const EVENT_LABEL: Record<string, string> = {
  push: 'push',
  pull_request: 'pull request',
  pull_request_target: 'pull request',
  workflow_dispatch: 'executado manualmente',
  schedule: 'agendado',
  release: 'release',
  workflow_run: 'outro workflow',
  workflow_call: 'workflow reutilizado',
  issues: 'issue',
  issue_comment: 'comentário',
  repository_dispatch: 'dispatch externo',
  merge_group: 'fila de merge',
  dynamic: 'dinâmico',
};
const eventText = (e: string) => EVENT_LABEL[e] || e;

const fmtDuration = (a?: string | null, b?: string | null) => {
  if (!a) return '';
  const sec = Math.max(0, Math.round(((b ? Date.parse(b) : Date.now()) - Date.parse(a)) / 1000));
  if (sec < 60) return `${sec}s`;
  const m = Math.floor(sec / 60);
  return m < 60 ? `${m}min ${sec % 60}s` : `${Math.floor(m / 60)}h ${m % 60}min`;
};
const fmtDate = (iso: string) => {
  try {
    return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }).replace('.', '');
  } catch {
    return iso;
  }
};

const useColors = (isDark: boolean) =>
  useMemo(
    () => ({
      bg: isDark ? '#101010' : '#ffffff',
      card: isDark ? '#181818' : '#f5f5f5',
      text: isDark ? '#ffffff' : '#111111',
      sub: isDark ? '#8c8c8c' : '#666666',
      muted: isDark ? '#666666' : '#999999',
      line: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      hover: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    }),
    [isDark],
  );

// ---------- painel lateral: workflows do repositório ----------
interface SidebarProps {
  isActive: boolean;
  repoFullName?: string;
  workflowId: number | null;
  onSelect: (id: number | null) => void;
  isEffectiveDark: boolean;
  accentColor: string;
  background?: string;
}
export const ActionsSidebar: React.FC<SidebarProps> = ({ isActive, repoFullName = '', workflowId, onSelect, isEffectiveDark, accentColor, background }) => {
  const c = useColors(isEffectiveDark);
  const ft = getFieldTokens(isEffectiveDark);
  const [list, setList] = useState<WorkflowItem[] | null>(() => wfCache.get(repoFullName)?.list ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(
    async (force = false) => {
      if (!repoFullName.includes('/')) return;
      if (force || !wfCache.get(repoFullName)) setLoading(true);
      setError(null);
      try {
        setList(await loadWorkflows(repoFullName, force));
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [repoFullName],
  );
  useEffect(() => {
    setList(wfCache.get(repoFullName)?.list ?? null);
  }, [repoFullName]);
  useEffect(() => {
    if (isActive) load();
  }, [isActive, load]);

  const row = (key: string, label: string, active: boolean, onClick: () => void, icon: React.ReactNode, tag?: string) => (
    <div
      key={key}
      className="df-pressable"
      onClick={onClick}
      style={{ display: 'flex', alignItems: 'center', gap: 8, height: 30, padding: '0 10px', borderRadius: 6, cursor: 'pointer', fontSize: 12, color: active ? c.text : c.sub, background: active ? ft.fieldBg : 'transparent', transition: 'background-color 150ms ease, color 150ms ease' }}
      onMouseEnter={(e) => !active && (e.currentTarget.style.background = c.hover)}
      onMouseLeave={(e) => !active && (e.currentTarget.style.background = 'transparent')}
    >
      {icon}
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
      {tag && <span style={{ fontSize: 10.5, color: c.muted }}>{tag}</span>}
    </div>
  );

  return (
    <div className="df-view-enter" style={{ flex: 1, minWidth: 0, minHeight: 0, width: '100%', background: background || c.bg, borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 8, flexShrink: 0 }}>
        <span style={{ flex: 1, fontSize: 12, color: c.sub }}>Workflows</span>
        <button type="button" title="Atualizar workflows" onClick={() => load(true)} className="df-pressable" style={{ width: 28, height: 28, border: 'none', borderRadius: 6, background: ft.fieldBg, color: c.sub, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <RefreshCw size={13} className={loading ? 'spin-animate' : ''} color={loading ? accentColor : undefined} />
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 8px 8px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {!repoFullName.includes('/') && <span style={{ padding: 12, fontSize: 12, color: c.sub }}>Selecione um projeto vinculado a um repositório do GitHub.</span>}
        {error && <span style={{ padding: 12, fontSize: 12, color: '#f85149' }}>{error}</span>}
        {repoFullName.includes('/') && (
          <>
            {row('all', 'Todos os workflows', workflowId === null, () => onSelect(null), <PlayCircle size={14} color={workflowId === null ? accentColor : undefined} />)}
            <div style={{ height: 1, background: c.line, margin: '6px 0' }} />
            {!list && !error && [0, 1, 2].map((i) => <div key={i} className="df-skel" style={{ height: 30, borderRadius: 6 }} />)}
            {list && list.length === 0 && <span style={{ padding: 12, fontSize: 12, color: c.sub }}>Nenhum workflow neste repositório.</span>}
            {(list || []).map((w) => row(String(w.id), w.name, workflowId === w.id, () => onSelect(w.id), <Play size={13} color={workflowId === w.id ? accentColor : undefined} />, w.state !== 'active' ? 'desativado' : undefined))}
          </>
        )}
      </div>
    </div>
  );
};

// ---------- passos e log de um job ----------
const JobSteps: React.FC<{ owner: string; repo: string; job: JobItem; c: ReturnType<typeof useColors>; accentColor: string }> = ({ owner, repo, job, c, accentColor }) => {
  const [detail, setDetail] = useState<{ steps: StepItem[]; note?: string } | null>(null);
  const [openSteps, setOpenSteps] = useState<Record<number, boolean>>({});
  const sig = `${job.status}|${job.conclusion}`;
  useEffect(() => {
    let cancelled = false;
    ghSettings('checkRunDetail', { owner, repo, checkRunId: job.id })
      .then((r: any) => {
        if (cancelled) return;
        setDetail({ steps: r?.steps || [], note: r?.note });
        const bad = (r?.steps || []).find((x: StepItem) => ['failure', 'timed_out'].includes(x.conclusion || ''));
        if (bad) setOpenSteps((o) => (o[bad.number] === undefined ? { ...o, [bad.number]: true } : o));
      })
      .catch((e) => !cancelled && setDetail({ steps: job.steps, note: e?.message }));
    return () => {
      cancelled = true;
    };
  }, [owner, repo, job.id, sig]); // eslint-disable-line react-hooks/exhaustive-deps
  const steps = detail?.steps?.length ? detail.steps : job.steps;
  return (
    <div className="df-subtle-enter" style={{ display: 'flex', flexDirection: 'column', padding: '0 14px 8px 38px' }}>
      {!detail && <span style={{ fontSize: 11.5, color: c.sub, padding: '4px 0', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Loader2 size={12} className="spin-animate" color={accentColor} /> Carregando passos e log…</span>}
      {detail?.note && <span style={{ fontSize: 11.5, color: c.sub, padding: '4px 0' }}>{detail.note}</span>}
      {steps.map((st) => {
        const k = kindOf(st.status, st.conclusion);
        const secs = st.startedAt && st.completedAt ? fmtDuration(st.startedAt, st.completedAt) : '';
        return (
          <div key={st.number} style={{ display: 'flex', flexDirection: 'column' }}>
            <div onClick={() => setOpenSteps((o) => ({ ...o, [st.number]: !o[st.number] }))} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: 12, color: k === 'ok' || k === 'skip' ? c.sub : c.text }}>
              <ChevronRight size={13} color={c.sub} style={{ transition: 'transform 200ms var(--ease-out)', transform: openSteps[st.number] ? 'rotate(90deg)' : 'none', flexShrink: 0 }} />
              <StatusIcon kind={k} size={14} />
              <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.name}</span>
              {secs && <span style={{ fontSize: 11, color: c.sub }}>{secs}</span>}
            </div>
            {openSteps[st.number] && (
              <pre className="df-subtle-enter" style={{ margin: '0 0 6px 21px', padding: '4px 0 4px 10px', borderLeft: `2px solid ${c.line}`, maxHeight: 320, overflow: 'auto', fontSize: 11, lineHeight: 1.55, color: c.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                {st.log?.length ? st.log.join('\n') : 'Sem saída registrada para este passo.'}
              </pre>
            )}
          </div>
        );
      })}
    </div>
  );
};

// ---------- área central: execuções e detalhe ----------
interface ViewProps {
  isActive: boolean;
  repoFullName?: string;
  workflowId: number | null;
  runId: number | null;
  onOpenRun: (id: number | null) => void;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  aiProviderId?: string;
  onToast: (msg: string) => void;
  onResolveWithAi?: (prompt: string, title?: string) => void;
}

const EVENTS = ['push', 'pull_request', 'workflow_dispatch', 'schedule', 'release', 'workflow_run'];
const STATUSES: Array<{ v: string; l: string }> = [
  { v: 'success', l: 'Sucesso' },
  { v: 'failure', l: 'Falhou' },
  { v: 'cancelled', l: 'Cancelado' },
  { v: 'in_progress', l: 'Em andamento' },
  { v: 'queued', l: 'Na fila' },
];

export const ActionsView: React.FC<ViewProps> = ({ isActive, repoFullName = '', workflowId, runId, onOpenRun, isEffectiveDark, accentColor, accentContrastText, aiProviderId, onToast, onResolveWithAi }) => {
  const [owner, repo] = repoFullName.split('/');
  const c = useColors(isEffectiveDark);
  const ft = getFieldTokens(isEffectiveDark);
  const pc = popupColors(isEffectiveDark);
  const [workflows, setWorkflows] = useState<WorkflowItem[]>(() => wfCache.get(repoFullName)?.list ?? []);
  const [runs, setRuns] = useState<RunItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [event, setEvent] = useState('');
  const [status, setStatus] = useState('');
  const [branch, setBranch] = useState('');
  const [actor, setActor] = useState('');
  const [menu, setMenu] = useState<string | null>(null);
  const [rowMenu, setRowMenu] = useState<number | null>(null);
  const [branches, setBranches] = useState<string[]>([]);
  const [runOpen, setRunOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const anchors = useRef<Record<string, HTMLElement | null>>({});

  const workflow = workflowId ? workflows.find((w) => w.id === workflowId) : undefined;

  useEffect(() => {
    if (repoFullName.includes('/')) loadWorkflows(repoFullName).then(setWorkflows).catch(() => {});
  }, [repoFullName, isActive]);
  useEffect(() => {
    setRuns(null);
    setPage(1);
    setEvent('');
    setStatus('');
    setBranch('');
    setActor('');
    setQuery('');
  }, [repoFullName, workflowId]);

  const fetchRuns = useCallback(
    async (pageNo: number, silent: boolean) => {
      if (!owner || !repo) return;
      if (!silent) setLoading(true);
      try {
        const r = await ghSettings<{ total: number; runs: RunItem[] }>('workflowRuns', { owner, repo, workflowId: workflowId || undefined, branch: branch || undefined, event: event || undefined, status: status || undefined, actor: actor || undefined, page: 1, perPage: 30 * pageNo });
        setRuns(r.runs);
        setTotal(r.total);
        setError(null);
      } catch (e: any) {
        if (!silent) setError(e.message);
      } finally {
        setLoading(false);
      }
    },
    [owner, repo, workflowId, branch, event, status, actor],
  );

  const anyRunning = (runs || []).some((r) => r.status !== 'completed');
  useEffect(() => {
    if (!isActive || runId !== null) return;
    fetchRuns(page, false);
  }, [isActive, runId, fetchRuns, page]);
  // atualização automática: 5s com execução rodando, 30s parado
  useEffect(() => {
    if (!isActive || runId !== null) return;
    const t = setInterval(() => !document.hidden && fetchRuns(page, true), anyRunning ? 5000 : 30000);
    return () => clearInterval(t);
  }, [isActive, runId, fetchRuns, page, anyRunning]);

  useEffect(() => {
    if (!menu || menu !== 'branch' || branches.length || !owner) return;
    ghSettings<Array<{ name: string }>>('listBranches', { owner, repo }).then((b) => setBranches(b.map((x) => x.name))).catch(() => {});
  }, [menu, owner, repo, branches.length]);

  const actors = useMemo(() => Array.from(new Set((runs || []).map((r) => r.actor).filter(Boolean) as string[])), [runs]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (runs || []).filter((r) => !q || r.title?.toLowerCase().includes(q) || r.name?.toLowerCase().includes(q) || r.branch?.toLowerCase().includes(q) || r.actor?.toLowerCase().includes(q) || String(r.runNumber).includes(q.replace('#', '')));
  }, [runs, query]);

  const runAction = async (id: number, op: 'rerun' | 'rerunFailed' | 'cancel' | 'forceCancel' | 'delete', okMsg: string, afterDelete = false) => {
    setBusy(`${op}:${id}`);
    try {
      await ghSettings('workflowRunAction', { owner, repo, runId: id, op });
      logSystemActivity('actions', `${op}_workflow_run`, `${repoFullName}#${id}`, {});
      onToast(okMsg);
      if (afterDelete) onOpenRun(null);
      setTimeout(() => fetchRuns(page, true), 1200);
    } catch (e: any) {
      onToast(`Falhou: ${e.message}`);
    } finally {
      setBusy(null);
    }
  };

  const btn = (primary = false, disabled = false): React.CSSProperties => ({
    height: 28,
    padding: '0 10px',
    border: 'none',
    borderRadius: 6,
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    fontSize: 11.5,
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.55 : 1,
    background: primary ? accentColor : ft.fieldBg,
    color: primary ? accentContrastText : c.text,
    transition: 'transform 140ms var(--ease-out), background-color 150ms ease, opacity 150ms ease',
    flexShrink: 0,
  });

  const filterBtn = (key: string, label: string, value: string, valueLabel: string) => (
    <button key={key} type="button" className="df-pressable" ref={(el) => { anchors.current[key] = el; }} style={{ ...btn(), color: value ? accentColor : c.text }} onClick={() => setMenu(menu === key ? null : key)}>
      {label}{value ? `: ${valueLabel}` : ''} <ChevronDown size={12} />
    </button>
  );
  const filterMenu = (key: string, items: Array<{ v: string; l: string }>, current: string, set: (v: string) => void) =>
    menu === key && (
      <PopupPortal anchor={anchors.current[key] ?? null} open onClose={() => setMenu(null)} width={220} align="left" isDark={isEffectiveDark}>
        <div style={{ display: 'flex', flexDirection: 'column', padding: 4 }}>
          {[{ v: '', l: 'Todos' }, ...items].map((i) => (
            <div key={i.v} onClick={() => { set(i.v); setMenu(null); }} className="df-pressable" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, fontSize: 12.5, color: pc.text, cursor: 'pointer', background: current === i.v ? pc.hover : 'transparent' }} onMouseEnter={(e) => (e.currentTarget.style.background = pc.hover)} onMouseLeave={(e) => (e.currentTarget.style.background = current === i.v ? pc.hover : 'transparent')}>
              <span style={{ width: 14, display: 'inline-flex' }}>{current === i.v && <Check size={13} color={accentColor} />}</span>
              {i.l}
            </div>
          ))}
        </div>
      </PopupPortal>
    );

  // ----- detalhe de uma execução -----
  if (runId !== null) {
    return (
      <RunDetail
        key={runId}
        owner={owner}
        repo={repo}
        runId={runId}
        c={c}
        ft={ft}
        accentColor={accentColor}
        accentContrastText={accentContrastText}
        aiProviderId={aiProviderId}
        busy={busy}
        btn={btn}
        onAction={runAction}
        onToast={onToast}
        onResolveWithAi={onResolveWithAi}
      />
    );
  }

  const rowActions = (r: RunItem) => {
    const running = r.status !== 'completed';
    return [
      { key: 'rerun', label: 'Executar novamente tudo', disabled: running, run: () => runAction(r.id, 'rerun', 'Execução reiniciada.') },
      { key: 'rerunFailed', label: 'Executar novamente os jobs com falha', disabled: running || kindOf(r.status, r.conclusion) !== 'bad', run: () => runAction(r.id, 'rerunFailed', 'Jobs com falha reiniciados.') },
      { key: 'cancel', label: 'Cancelar execução', disabled: !running, run: () => runAction(r.id, 'cancel', 'Cancelamento solicitado.') },
      { key: 'open', label: 'Abrir no GitHub', run: () => window.electronAPI?.shell?.openExternal?.(r.url) },
      { key: 'delete', label: 'Excluir execução', disabled: running, danger: true, run: () => runAction(r.id, 'delete', 'Execução excluída.') },
    ];
  };

  return (
    <div className="df-view-enter" style={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column', background: c.bg, borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: 14, flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
          <span style={{ fontSize: 16, color: c.text }}>{workflow ? workflow.name : 'Todas as execuções'}</span>
          {workflow && <span onClick={() => window.electronAPI?.shell?.openExternal?.(`https://github.com/${repoFullName}/blob/HEAD/${workflow.path}`)} style={{ fontSize: 11.5, color: accentColor, cursor: 'pointer' }}>{workflow.path.split('/').pop()}</span>}
        </div>
        {workflow && (
          <button type="button" className="df-pressable" style={btn(true, workflow.state !== 'active')} disabled={workflow.state !== 'active'} onClick={() => setRunOpen(true)} title={workflow.state !== 'active' ? 'Workflow desativado' : undefined}>
            <Play size={12} /> Executar workflow
          </button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 14px 12px', flexWrap: 'wrap', flexShrink: 0 }}>
        <div style={{ flex: 1, minWidth: 180, display: 'flex', alignItems: 'center', gap: 6, height: 28, padding: '0 8px', borderRadius: 6, background: ft.fieldBg, boxSizing: 'border-box' }}>
          <Search size={13} color={c.sub} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar execuções..." style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'transparent', color: c.text, fontSize: 11.5, fontFamily: 'inherit' }} />
        </div>
        {filterBtn('event', 'Evento', event, eventText(event))}
        {filterBtn('status', 'Status', status, STATUSES.find((s) => s.v === status)?.l || '')}
        {filterBtn('branch', 'Branch', branch, branch)}
        {filterBtn('actor', 'Autor', actor, actor)}
        <button type="button" className="df-pressable" title="Atualizar" style={{ ...btn(), width: 28, padding: 0, justifyContent: 'center' }} onClick={() => fetchRuns(page, false)}>
          <RefreshCw size={13} className={loading ? 'spin-animate' : ''} color={loading ? accentColor : undefined} />
        </button>
        {filterMenu('event', EVENTS.map((e) => ({ v: e, l: eventText(e) })), event, setEvent)}
        {filterMenu('status', STATUSES, status, setStatus)}
        {filterMenu('branch', branches.map((b) => ({ v: b, l: b })), branch, setBranch)}
        {filterMenu('actor', actors.map((a) => ({ v: a, l: a })), actor, setActor)}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 14px 14px' }}>
        <div style={{ background: c.card, borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', fontSize: 12, color: c.sub, borderBottom: `1px solid ${c.line}` }}>
            {runs ? `${total} execuç${total === 1 ? 'ão' : 'ões'}` : 'Carregando…'}
            {anyRunning && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: '#d29922' }}><Loader2 size={12} className="spin-animate" /> atualizando a cada 5s</span>}
          </div>
          {error && <div style={{ padding: 14, fontSize: 12, color: '#f85149' }}>{error}</div>}
          {!runs && !error && [0, 1, 2, 3].map((i) => <div key={i} className="df-skel" style={{ height: 58, margin: 8, borderRadius: 6 }} />)}
          {runs && shown.length === 0 && <div style={{ padding: 24, fontSize: 12.5, color: c.sub, textAlign: 'center' }}>Nenhuma execução encontrada.</div>}
          {shown.map((r, i) => {
            const k = kindOf(r.status, r.conclusion);
            return (
              <div key={r.id} className="df-subtle-enter" onClick={() => onOpenRun(r.id)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', borderTop: i ? `1px solid ${c.line}` : 'none', cursor: 'pointer', transition: 'background-color 150ms ease' }} onMouseEnter={(e) => (e.currentTarget.style.background = c.hover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <span style={{ width: 18, display: 'inline-flex', justifyContent: 'center', flexShrink: 0, alignSelf: 'flex-start', marginTop: 2 }}><StatusIcon kind={k} /></span>
                <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                  <span style={{ fontSize: 13, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title || r.name}</span>
                  <span style={{ fontSize: 11.5, color: c.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {r.name} #{r.runNumber}: {eventText(r.event)}{r.actor ? ` por ${r.actor}` : ''}
                  </span>
                </div>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, color: c.sub, background: ft.fieldBg, borderRadius: 6, padding: '3px 8px', maxWidth: 160, flexShrink: 0 }}>
                  <GitBranch size={11} /> <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.branch}</span>
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 3, alignItems: 'flex-end', fontSize: 11, color: c.sub, flexShrink: 0, minWidth: 90 }}>
                  <span title={new Date(r.createdAt).toLocaleString('pt-BR')}>{fmtDate(r.createdAt)}</span>
                  <span>{fmtDuration(r.startedAt, r.status === 'completed' ? r.updatedAt : null)}</span>
                </div>
                <button type="button" className="df-pressable" ref={(el) => { if (rowMenu === r.id) anchors.current.row = el; }} onClick={(e) => { e.stopPropagation(); anchors.current.row = e.currentTarget; setRowMenu(rowMenu === r.id ? null : r.id); }} style={{ width: 28, height: 28, border: 'none', borderRadius: 6, background: 'transparent', color: c.sub, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <MoreHorizontal size={15} />
                </button>
                {rowMenu === r.id && (
                  <PopupPortal anchor={anchors.current.row ?? null} open onClose={() => setRowMenu(null)} width={260} align="right" isDark={isEffectiveDark}>
                    <div style={{ display: 'flex', flexDirection: 'column', padding: 4 }} onClick={(e) => e.stopPropagation()}>
                      {rowActions(r).map((a: any) => (
                        <div key={a.key} className="df-pressable" onClick={() => { if (a.disabled) return; setRowMenu(null); a.run(); }} style={{ padding: '7px 10px', borderRadius: 6, fontSize: 12.5, color: a.danger ? '#f85149' : pc.text, opacity: a.disabled ? 0.45 : 1, cursor: a.disabled ? 'not-allowed' : 'pointer' }} onMouseEnter={(e) => !a.disabled && (e.currentTarget.style.background = pc.hover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                          {a.label}
                        </div>
                      ))}
                    </div>
                  </PopupPortal>
                )}
              </div>
            );
          })}
        </div>
        {runs && runs.length < total && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 12 }}>
            <button type="button" className="df-pressable" style={btn(false, loading)} disabled={loading} onClick={() => setPage((p) => p + 1)}>
              {loading && <Loader2 size={13} className="spin-animate" color={accentColor} />} Carregar mais
            </button>
          </div>
        )}
      </div>

      {runOpen && workflow && (
        <RunWorkflowModal
          owner={owner}
          repo={repo}
          workflow={workflow}
          isDark={isEffectiveDark}
          accentColor={accentColor}
          accentContrastText={accentContrastText}
          onClose={() => setRunOpen(false)}
          onDone={() => {
            setRunOpen(false);
            onToast('Workflow disparado. A execução aparece na lista em instantes.');
            setTimeout(() => fetchRuns(page, true), 2500);
          }}
          onToast={onToast}
        />
      )}
    </div>
  );
};

// ---------- detalhe da execução ----------
interface DetailProps {
  owner: string;
  repo: string;
  runId: number;
  c: ReturnType<typeof useColors>;
  ft: ReturnType<typeof getFieldTokens>;
  accentColor: string;
  accentContrastText: string;
  aiProviderId?: string;
  busy: string | null;
  btn: (primary?: boolean, disabled?: boolean) => React.CSSProperties;
  onAction: (id: number, op: 'rerun' | 'rerunFailed' | 'cancel' | 'forceCancel' | 'delete', okMsg: string, afterDelete?: boolean) => void;
  onToast: (m: string) => void;
  onResolveWithAi?: (prompt: string, title?: string) => void;
}
const RunDetail: React.FC<DetailProps> = ({ owner, repo, runId, c, ft, accentColor, aiProviderId, busy, btn, onAction, onToast, onResolveWithAi }) => {
  const [data, setData] = useState<{ run: RunItem; jobs: JobItem[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openJobs, setOpenJobs] = useState<Record<number, boolean>>({});
  const seeded = useRef(false);

  const load = useCallback(async () => {
    try {
      const d = await ghSettings<{ run: RunItem; jobs: JobItem[] }>('workflowRunDetail', { owner, repo, runId });
      setData(d);
      setError(null);
      if (!seeded.current) {
        seeded.current = true;
        const bad = d.jobs.filter((j) => kindOf(j.status, j.conclusion) === 'bad');
        const first = bad.length ? bad : d.jobs.length === 1 ? d.jobs : [];
        setOpenJobs(Object.fromEntries(first.map((j) => [j.id, true])));
      }
    } catch (e: any) {
      setError(e.message);
    }
  }, [owner, repo, runId]);
  useEffect(() => {
    load();
  }, [load]);
  const running = data ? data.run.status !== 'completed' : false;
  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => !document.hidden && load(), 5000);
    return () => clearInterval(t);
  }, [running, load]);

  const fixWithAi = async () => {
    if (!data) return;
    if (!onResolveWithAi) {
      onToast('Abra o terminal de uma IA (CLI) ou o chat de IA da IDE para usar esta opção.');
      return;
    }
    logSystemActivity('actions', 'resolver_run_com_ia', `${owner}/${repo}#${runId}`, {});
    const failed = data.jobs.filter((j) => kindOf(j.status, j.conclusion) === 'bad').slice(0, 3);
    const parts: string[] = [];
    for (const j of failed) {
      try {
        const r: any = await ghSettings('checkRunDetail', { owner, repo, checkRunId: j.id });
        const bad = (r?.steps || []).find((x: StepItem) => ['failure', 'timed_out'].includes(x.conclusion || ''));
        parts.push(`Job "${j.name}"${bad ? `, passo "${bad.name}"` : ''}:${bad?.log?.length ? `\n${bad.log.slice(-80).join('\n')}` : ' (sem log disponível)'}`);
      } catch {
        parts.push(`Job "${j.name}" falhou (não foi possível baixar o log).`);
      }
    }
    onResolveWithAi(
      [
        `A execução #${data.run.runNumber} do workflow "${data.run.name}" falhou no repositório ${owner}/${repo} (branch ${data.run.branch}, commit ${data.run.sha.slice(0, 7)}).`,
        `Detalhes: ${data.run.url}`,
        '',
        parts.join('\n\n'),
        '',
        'Passos:',
        `1. git fetch origin e git checkout ${data.run.branch}`,
        '2. Reproduza localmente rodando o mesmo comando do workflow e corrija a causa da falha.',
        '3. Rode de novo até passar.',
        `4. Mostre o resumo e peça minha confirmação antes de commitar e dar git push origin ${data.run.branch}. Nunca use push --force.`,
      ].join('\n'),
      'Corrigindo CI',
    );
  };

  if (error && !data) return <div style={{ flex: 1, padding: 24, fontSize: 12.5, color: '#f85149' }}>{error}</div>;
  if (!data) return <div style={{ flex: 1, padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>{[0, 1, 2].map((i) => <div key={i} className="df-skel" style={{ height: 56, borderRadius: 8 }} />)}</div>;

  const { run, jobs } = data;
  const k = kindOf(run.status, run.conclusion);
  const failedCount = jobs.filter((j) => kindOf(j.status, j.conclusion) === 'bad').length;
  const b = (key: string) => busy === `${key}:${run.id}`;

  return (
    <div className="df-view-enter" style={{ flex: 1, minWidth: 0, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', background: c.bg, borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
        <span style={{ marginTop: 3 }}><StatusIcon kind={k} size={20} /></span>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 16, color: c.text, wordBreak: 'break-word' }}>{run.title || run.name}</span>
          <span style={{ fontSize: 12, color: c.sub, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            {run.name} #{run.runNumber}{run.attempt && run.attempt > 1 ? ` (tentativa ${run.attempt})` : ''} · {eventText(run.event)}
            {run.actor && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>por {run.actorAvatar && <img src={run.actorAvatar} alt="" style={{ width: 16, height: 16, borderRadius: '50%' }} />}{run.actor}</span>}
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: ft.fieldBg, borderRadius: 6, padding: '2px 8px' }}><GitBranch size={11} />{run.branch}</span>
            <span style={{ color: KIND_COLOR[k] }}>{KIND_LABEL[k]}</span>
            <span>{fmtDuration(run.startedAt, run.status === 'completed' ? run.updatedAt : null)}</span>
            <span>{relativeTime(run.createdAt)}</span>
          </span>
          {run.commit && <span style={{ fontSize: 11.5, color: c.muted }}>{run.sha.slice(0, 7)} · {run.commit}</span>}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" className="df-pressable" style={btn(false, running || busy !== null)} disabled={running || busy !== null} onClick={() => onAction(run.id, 'rerun', 'Execução reiniciada.')}>
          {b('rerun') ? <Loader2 size={13} className="spin-animate" color={accentColor} /> : <RotateCcw size={13} />} Executar novamente tudo
        </button>
        {failedCount > 0 && (
          <button type="button" className="df-pressable" style={btn(false, running || busy !== null)} disabled={running || busy !== null} onClick={() => onAction(run.id, 'rerunFailed', 'Jobs com falha reiniciados.')}>
            {b('rerunFailed') ? <Loader2 size={13} className="spin-animate" color={accentColor} /> : <RotateCcw size={13} />} Executar novamente os com falha
          </button>
        )}
        {running && (
          <button type="button" className="df-pressable" style={btn(false, busy !== null)} disabled={busy !== null} onClick={() => onAction(run.id, 'cancel', 'Cancelamento solicitado.')}>
            {b('cancel') ? <Loader2 size={13} className="spin-animate" color={accentColor} /> : <StopCircle size={13} />} Cancelar
          </button>
        )}
        {k === 'bad' && (
          <button type="button" className="df-pressable" style={btn()} onClick={fixWithAi}>
            {aiProviderId ? renderAiIcon(aiProviderId, 13) : <Sparkles size={13} color={accentColor} />} Resolver com IA
          </button>
        )}
        <button type="button" className="df-pressable" style={btn()} onClick={() => window.electronAPI?.shell?.openExternal?.(run.url)}>
          <ExternalLink size={13} /> Abrir no GitHub
        </button>
        {!running && (
          <button type="button" className="df-pressable" style={{ ...btn(false, busy !== null), color: '#f85149' }} disabled={busy !== null} onClick={() => onAction(run.id, 'delete', 'Execução excluída.', true)}>
            <Trash2 size={13} /> Excluir
          </button>
        )}
      </div>

      <div style={{ background: c.card, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ padding: '10px 14px', fontSize: 12, color: c.sub, borderBottom: `1px solid ${c.line}` }}>{jobs.length} job{jobs.length === 1 ? '' : 's'}</div>
        {jobs.map((j, i) => {
          const jk = kindOf(j.status, j.conclusion);
          return (
            <div key={j.id} style={{ borderTop: i ? `1px solid ${c.line}` : 'none' }}>
              <div onClick={() => setOpenJobs((o) => ({ ...o, [j.id]: !o[j.id] }))} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', cursor: 'pointer', fontSize: 12.5, color: c.text, transition: 'background-color 150ms ease' }} onMouseEnter={(e) => (e.currentTarget.style.background = c.hover)} onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <ChevronRight size={14} color={c.sub} style={{ transition: 'transform 200ms var(--ease-out)', transform: openJobs[j.id] ? 'rotate(90deg)' : 'none', flexShrink: 0 }} />
                <StatusIcon kind={jk} size={15} />
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{j.name}</span>
                {j.runner && <span style={{ fontSize: 11, color: c.muted }}>{j.runner}</span>}
                <span style={{ fontSize: 11, color: c.sub }}>{fmtDuration(j.startedAt, j.completedAt)}</span>
              </div>
              {openJobs[j.id] && <JobSteps owner={owner} repo={repo} job={j} c={c} accentColor={accentColor} />}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ---------- executar workflow manualmente ----------
const RunWorkflowModal: React.FC<{
  owner: string;
  repo: string;
  workflow: WorkflowItem;
  isDark: boolean;
  accentColor: string;
  accentContrastText: string;
  onClose: () => void;
  onDone: () => void;
  onToast: (m: string) => void;
}> = ({ owner, repo, workflow, isDark, accentColor, accentContrastText, onClose, onDone, onToast }) => {
  const pc = popupColors(isDark);
  const [branches, setBranches] = useState<string[]>([]);
  const [ref, setRef] = useState('');
  const [meta, setMeta] = useState<{ dispatchable: boolean; inputs: Array<{ name: string; description: string; default: string; required: boolean; type: string; options: string[] }> } | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => {
    ghSettings<Array<{ name: string }>>('listBranches', { owner, repo })
      .then((b) => {
        const names = b.map((x) => x.name);
        setBranches(names);
        setRef((r) => r || (names.includes('main') ? 'main' : names.includes('master') ? 'master' : names[0] || ''));
      })
      .catch(() => {});
  }, [owner, repo]);
  useEffect(() => {
    if (!ref) return;
    ghSettings('workflowInputs', { owner, repo, path: workflow.path, ref })
      .then((m: any) => {
        setMeta(m);
        setValues(Object.fromEntries((m.inputs || []).map((i: any) => [i.name, i.default || ''])));
      })
      .catch(() => setMeta({ dispatchable: true, inputs: [] }));
  }, [owner, repo, workflow.path, ref]);

  const send = async () => {
    setSending(true);
    try {
      await ghSettings('dispatchWorkflow', { owner, repo, workflowId: workflow.id, ref, inputs: Object.keys(values).length ? values : undefined });
      logSystemActivity('actions', 'executar_workflow', `${owner}/${repo}`, { workflow: workflow.name, ref });
      onDone();
    } catch (e: any) {
      onToast(`Falhou: ${e.message}`);
    } finally {
      setSending(false);
    }
  };
  const inputStyle: React.CSSProperties = { height: 30, border: 'none', outline: 'none', borderRadius: 6, padding: '0 10px', background: pc.field, color: pc.text, fontSize: 12.5, fontFamily: 'inherit' };
  const missing = (meta?.inputs || []).some((i) => i.required && !values[i.name]);

  return createPortal(
    <div onMouseDown={(e) => e.target === e.currentTarget && !sending && onClose()} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div className="df-subtle-enter" style={{ width: 'min(460px, 100%)', maxHeight: '88vh', overflowY: 'auto', background: pc.bg, color: pc.text, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Play size={15} color={accentColor} />
          <span style={{ flex: 1, fontSize: 14 }}>Executar {workflow.name}</span>
          <X size={16} style={{ cursor: 'pointer', color: pc.sub }} onClick={() => !sending && onClose()} />
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: pc.sub }}>
          Branch
          <select value={ref} onChange={(e) => setRef(e.target.value)} style={inputStyle}>
            {branches.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </label>
        {meta && !meta.dispatchable && <span style={{ fontSize: 12, color: '#d29922' }}>Este workflow não tem o gatilho workflow_dispatch nessa branch; o GitHub vai recusar a execução manual.</span>}
        {(meta?.inputs || []).map((i) => (
          <label key={i.name} style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12, color: pc.sub }}>
            <span>{i.name}{i.required ? ' *' : ''}{i.description ? ` — ${i.description}` : ''}</span>
            {i.type === 'boolean' ? (
              <select value={values[i.name] || 'false'} onChange={(e) => setValues((v) => ({ ...v, [i.name]: e.target.value }))} style={inputStyle}><option value="true">true</option><option value="false">false</option></select>
            ) : i.options.length ? (
              <select value={values[i.name] || ''} onChange={(e) => setValues((v) => ({ ...v, [i.name]: e.target.value }))} style={inputStyle}>{i.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
            ) : (
              <input value={values[i.name] || ''} onChange={(e) => setValues((v) => ({ ...v, [i.name]: e.target.value }))} style={inputStyle} />
            )}
          </label>
        ))}
        <div style={{ display: 'flex', gap: 8 }}>
          <button type="button" className="df-pressable" disabled={sending || !ref || missing} onClick={send} style={{ flex: 1, height: 30, border: 'none', borderRadius: 6, background: accentColor, color: accentContrastText, fontSize: 12.5, cursor: sending || !ref || missing ? 'not-allowed' : 'pointer', opacity: sending || !ref || missing ? 0.6 : 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
            {sending ? <Loader2 size={13} className="spin-animate" /> : <Play size={12} />} Executar workflow
          </button>
          <button type="button" className="df-pressable" onClick={onClose} style={{ flex: 1, height: 30, border: 'none', borderRadius: 6, background: pc.hover, color: pc.text, fontSize: 12.5, cursor: 'pointer' }}>
            Cancelar
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};
