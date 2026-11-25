import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Check, Pencil, Trash2, CheckCircle2, ChevronDown, ChevronRight, CircleDashed, Copy, ExternalLink, FileDiff, GitBranch, GitCommit, GitMerge, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft, ListChecks, Loader2, MessageSquare, Search, X, XCircle } from 'lucide-react';
import type { TeamAiProvider } from '../team/TeamAiPanel';
import { renderAiIcon } from '../icons/AiProviderIcons';
import { PullRequestSidebar } from './PullRequestSidebar';
import { PullRequestMergeBox } from './PullRequestMergeBox';
import { FileIcon } from '../FileIcon';
import { DevFlowSelect } from '../ui/DevFlowSelect';
import { relativeTime } from '../team/teamTypes';
import { ghSettings } from '../settings/settingsUi';
import { renderMarkdownPreview } from '../../utils/markdown';
import { getFieldTokens } from '../../utils/fieldTokens';
import { getContrastTextColor, hexToRgba } from '../../utils/color';
import { logSystemActivity } from '../../utils/brainService';

interface PullFile {
  filename: string;
  status: string;
  additions: number;
  deletions: number;
  patch: string;
}
type Person = { login: string; avatar?: string };
interface ReviewRules {
  canWrite: boolean;
  isAdmin: boolean;
  requiredApprovals: number;
  requireCodeOwners: boolean;
  dismissStale: boolean;
  requireLastPush: boolean;
  requiredChecks: string[];
  enforceAdmins: boolean;
  known: boolean;
}
interface TimelineEvent {
  id: string;
  event: string;
  actor?: string;
  avatar?: string;
  at: string;
  label?: { name: string; color: string };
  assignee?: string;
  reviewer?: string;
  milestone?: string;
  rename?: { from: string; to: string };
  sha?: string;
}
interface MergeState {
  status: 'BEHIND' | 'BLOCKED' | 'CLEAN' | 'DIRTY' | 'DRAFT' | 'HAS_HOOKS' | 'UNKNOWN' | 'UNSTABLE';
  mergeable: 'MERGEABLE' | 'CONFLICTING' | 'UNKNOWN';
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  canMergeAsAdmin: boolean;
  permission?: 'ADMIN' | 'MAINTAIN' | 'WRITE' | 'TRIAGE' | 'READ';
  inQueue?: boolean;
}
interface PullData {
  me?: string;
  merge?: MergeState | null;
  timeline?: TimelineEvent[];
  behindBy?: number;
  allowedMethods?: Record<'merge' | 'squash' | 'rebase', boolean>;
  deleteBranchOnMerge?: boolean;
  rules: ReviewRules;
  comments: Array<{ id: number; user?: string; avatar?: string; body: string; createdAt: string }>;
  reviewComments: Array<{ id: number; user?: string; avatar?: string; body: string; path: string; line?: number; createdAt: string }>;
  commitList: Array<{ sha: string; message: string; author?: string; avatar?: string; date: string; url: string }>;
  checks: Array<{ id: string; name: string; status: string; conclusion: string | null; url?: string; app?: string; appAvatar?: string; description?: string; required?: boolean }>;
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
    authorAvatar?: string;
    changedFiles?: number;
    mergedAt?: string;
    closedAt?: string;
    mergedBy?: string;
    headSha?: string;
    headOwner?: string;
    headRepoDeleted?: boolean;
    mergeable?: boolean | null;
    mergeableState?: string;
    labels: Array<{ name: string; color: string }>;
    assignees: Person[];
    requestedReviewers: Person[];
    milestone: string | null;
    milestoneNumber?: number | null;
  };
  files: PullFile[];
  reviews: Array<{ id: number; user?: string; avatar?: string; state: string; body: string; submittedAt: string }>;
}

export interface PullReviewTarget {
  repo: string; // owner/repo
  number: number;
}

interface Props {
  target: PullReviewTarget | null;
  isEffectiveDark: boolean;
  accentColor: string;
  aiProvider: TeamAiProvider;
  onToast: (msg: string) => void;
  /** manda um pedido para a IA do CLI ou do chat da IDE (resolver conflito, atualizar branch) */
  onResolveWithAi?: (prompt: string, title?: string) => void;
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

// Revisão gerada pela IA fica salva neste computador por PR, mesmo sem ter sido enviada ao GitHub
export interface SavedAiReview {
  text: string;
  providerId: string;
  providerName: string;
  model?: string;
  savedAt: string;
  headSha?: string;
  files?: number;
  kb?: number;
  seconds?: number;
}
const REVIEW_KEY = (repo: string, n: number) => `aura_pr_ai_review_v1:${repo.toLowerCase()}#${n}`;
const readSavedReview = (repo: string, n: number): SavedAiReview | null => {
  try {
    const raw = localStorage.getItem(REVIEW_KEY(repo, n));
    return raw ? (JSON.parse(raw) as SavedAiReview) : null;
  } catch {
    return null;
  }
};
export const writeSavedReview = (repo: string, n: number, r: SavedAiReview | null) => {
  try {
    if (r) localStorage.setItem(REVIEW_KEY(repo, n), JSON.stringify(r));
    else localStorage.removeItem(REVIEW_KEY(repo, n));
  } catch {}
};

// processo principal antigo (app ainda não reiniciado) não devolve `rules`: a tela segue funcionando, sem as regras do branch
const DEFAULT_RULES: ReviewRules = { canWrite: true, isAdmin: false, requiredApprovals: 0, requireCodeOwners: false, dismissStale: false, requireLastPush: false, requiredChecks: [], enforceAdmins: false, known: false };
// detalhes já abertos ficam em cache: voltar a um PR mostra o que estava carregado e atualiza em segundo plano
const detailCache = new Map<string, PullData>();
const detailKey = (owner: string, repo: string, number: number) => `${owner}/${repo}#${number}`.toLowerCase();
// O GitHub calcula o estado do merge de forma preguiçosa (o REST costuma devolver "unknown"): usa o do GraphQL e confere de novo se ainda estiver calculando
const normalizeDetail = (d: PullData): PullData => {
  const full: PullData = { ...d, rules: d.rules ?? DEFAULT_RULES };
  const m = d.merge;
  if (m) {
    const map: Record<string, string> = { BEHIND: 'behind', BLOCKED: 'blocked', CLEAN: 'clean', DIRTY: 'dirty', DRAFT: 'draft', HAS_HOOKS: 'has_hooks', UNSTABLE: 'unstable', UNKNOWN: 'unknown' };
    full.pr = { ...d.pr, mergeableState: map[m.status] || d.pr.mergeableState, mergeable: m.mergeable === 'CONFLICTING' ? false : m.mergeable === 'MERGEABLE' ? true : d.pr.mergeable };
    if (m.status === 'BEHIND' && !(d.behindBy && d.behindBy > 0)) full.behindBy = 1;
    full.rules = { ...full.rules, requiredApprovals: m.reviewDecision === 'REVIEW_REQUIRED' ? Math.max(1, full.rules.requiredApprovals) : full.rules.requiredApprovals };
  }
  return full;
};
export const loadDetail = async (owner: string, repo: string, number: number) => {
  let d = await ghSettings<PullData>('getPullDetail', { owner, repo, number });
  if (d.merge?.status === 'UNKNOWN' || (d.pr.state === 'open' && !d.merge && (d.pr.mergeable == null || d.pr.mergeableState === 'unknown'))) {
    await new Promise((r) => setTimeout(r, 1800));
    d = await ghSettings<PullData>('getPullDetail', { owner, repo, number }).catch(() => d);
  }
  const full = normalizeDetail(d);
  detailCache.set(detailKey(owner, repo, number), full);
  return full;
};

const REVIEW_EVENTS = [
  { id: 'COMMENT', label: 'Comentar', hint: 'Enviar feedback geral sem aprovar nem bloquear.', Icon: MessageSquare, color: '#a3a3a3' },
  { id: 'APPROVE', label: 'Aprovar', hint: 'Enviar feedback e aprovar as alterações.', Icon: CheckCircle2, color: '#3fb950' },
  { id: 'REQUEST_CHANGES', label: 'Solicitar alterações', hint: 'Enviar feedback que precisa ser resolvido antes do merge.', Icon: XCircle, color: '#f85149' },
] as const;

const STATE_LABEL: Record<string, string> = { APPROVED: 'aprovou', CHANGES_REQUESTED: 'pediu alterações', COMMENTED: 'comentou', DISMISSED: 'teve a review descartada' };

export interface OtherPr { number: number; title: string; head: string; files: { filename: string; patch: string }[] }
export const OTHERS_KEY = 'aura_pr_ai_others_v1';

export const buildAiPrompt = (data: PullData, others: OtherPr[] = []) => {
  let budget = 50000;
  const diffs = data.files
    .map((f) => {
      const patch = f.patch.slice(0, Math.min(6000, Math.max(budget, 0)));
      budget -= patch.length;
      return `### ${f.filename} (${f.status}, +${f.additions} -${f.deletions})\n${patch || '(sem diff textual)'}`;
    })
    .join('\n\n');
  let othersBudget = 20000;
  const othersText = others.length
    ? `\n\nOutros Pull Requests abertos neste repositório (use para verificar se algum problema encontrado aqui já foi corrigido ou será corrigido em outro PR; nesse caso, cite o PR em vez de reportar como pendência):\n` +
      others
        .map((o) => {
          const files = o.files
            .map((f) => {
              const patch = f.patch.slice(0, Math.min(1500, Math.max(othersBudget, 0)));
              othersBudget -= patch.length;
              return `- ${f.filename}${patch ? `\n${patch}` : ''}`;
            })
            .join('\n');
          return `#### PR #${o.number}: ${o.title} (${o.head})\n${files}`;
        })
        .join('\n\n')
    : '';
  return `Você é um revisor de código sênior. Revise este Pull Request em português do Brasil.

Título: ${data.pr.title}
Branch: ${data.pr.head} -> ${data.pr.base}
Descrição:
${data.pr.body.slice(0, 2000) || '(sem descrição)'}

Responda em Markdown com estas seções: ## Resumo, ## Problemas (bugs, segurança, performance e casos de borda; cite arquivo e trecho), ## Sugestões, ## Veredito (aprovar ou pedir alterações, e por quê). Seja objetivo e não invente problemas.

Diffs:
${diffs}${othersText}`;
};

export const PullRequestDetail: React.FC<Props> = ({ target, isEffectiveDark, accentColor, aiProvider, onToast, onResolveWithAi }) => {
  const [data, setData] = useState<PullData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'conversa' | 'commits' | 'checks' | 'arquivos' | 'ia'>('conversa');
  const [commentBody, setCommentBody] = useState('');
  const [commentPreview, setCommentPreview] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [inline, setInline] = useState<{ path: string; line: number; side: 'LEFT' | 'RIGHT'; replyTo?: number } | null>(null);
  const [inlineText, setInlineText] = useState('');
  const [viewed, setViewed] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<{ kind: 'desc' | 'comment'; id?: number; text: string } | null>(null);
  const [titleEdit, setTitleEdit] = useState<string | null>(null);
  const [mergeMethod, setMergeMethod] = useState<'merge' | 'squash' | 'rebase'>('merge');
  const [filter, setFilter] = useState('');
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [aiText, setAiText] = useState('');
  const [withOthers, setWithOthers] = useState(() => {
    try { return localStorage.getItem(OTHERS_KEY) === '1'; } catch { return false; }
  });
  const [aiBusy, setAiBusy] = useState(false);
  const [aiPhase, setAiPhase] = useState<'idle' | 'preparing' | 'waiting' | 'streaming' | 'done' | 'error'>('idle');
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiElapsed, setAiElapsed] = useState(0);
  const [aiInfo, setAiInfo] = useState<{ files: number; kb: number; truncated: number; model?: string; retried?: boolean } | null>(null);
  const aiRun = useRef<{ id: string; cancelled: boolean } | null>(null);
  const [savedReview, setSavedReview] = useState<SavedAiReview | null>(null);
  const [aiRanBy, setAiRanBy] = useState<string | null>(null); // IA que gerou a revisão mostrada (a selecionada pode mudar depois)
  const aiScroll = useRef<HTMLDivElement>(null);
  const [submitOpen, setSubmitOpen] = useState(false);
  const [event, setEvent] = useState<(typeof REVIEW_EVENTS)[number]['id']>('COMMENT');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const submitWrapRef = useRef<HTMLDivElement>(null);
  const accentInk = getContrastTextColor(accentColor);

  const ft = getFieldTokens(isEffectiveDark);
  const skelA = isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const skelB = isEffectiveDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.11)';
  const c = useMemo(
    () => ({
      bg: isEffectiveDark ? '#101010' : '#ffffff',
      card: isEffectiveDark ? '#161616' : '#f6f6f6',
      cardHeader: isEffectiveDark ? '#1b1b1b' : '#efefef',
      popover: isEffectiveDark ? '#181818' : '#ffffff',
      text: isEffectiveDark ? '#ffffff' : '#111111',
      sub: isEffectiveDark ? '#8c8c8c' : '#666666',
      muted: isEffectiveDark ? '#666666' : '#999999',
      line: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      hover: isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      add: isEffectiveDark ? 'rgba(46,160,67,0.14)' : 'rgba(46,160,67,0.12)',
      del: isEffectiveDark ? 'rgba(248,81,73,0.14)' : 'rgba(248,81,73,0.12)',
      addGutter: isEffectiveDark ? 'rgba(46,160,67,0.22)' : 'rgba(46,160,67,0.2)',
      delGutter: isEffectiveDark ? 'rgba(248,81,73,0.22)' : 'rgba(248,81,73,0.2)',
      hunk: isEffectiveDark ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.04)',
      addText: '#3fb950',
      delText: '#f85149',
    }),
    [isEffectiveDark],
  );

  const [owner, repo] = (target?.repo || '').split('/');

  useEffect(() => {
    if (!target) return;
    const hit = detailCache.get(detailKey(owner, repo, target.number)) ?? null;
    setData(hit);
    setActiveFile(hit?.files[0]?.filename || null);
    setError(null);
    setTab('conversa');
    setCommentBody('');
    setCommentPreview(false);
    setEditing(null);
    setTitleEdit(null);
    setInline(null);
    try {
      setViewed(new Set(JSON.parse(localStorage.getItem(`aura_pr_viewed_v1:${target.repo.toLowerCase()}#${target.number}`) || '[]')));
    } catch {
      setViewed(new Set());
    }
    const saved = readSavedReview(target.repo, target.number);
    setSavedReview(saved);
    setAiRanBy(saved?.providerId || null);
    setAiText(saved?.text || '');
    setAiPhase(saved ? 'done' : 'idle');
    setAiError(null);
    setAiInfo(saved ? { files: saved.files || 0, kb: saved.kb || 0, truncated: 0, model: saved.model } : null);
    setAiElapsed(saved?.seconds || 0);
    setFilter('');
    setBody('');
    setSubmitOpen(false);
    setCollapsed(new Set());
    let cancelled = false;
    loadDetail(owner, repo, target.number)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setActiveFile(d.files[0]?.filename || null);
      })
      .catch((e) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [target?.repo, target?.number]);

  // Checks rodando: atualiza sozinho até terminarem (não precisa reabrir o PR para ver o resultado)
  const checksRunning = Boolean(data && data.pr.state === 'open' && (data.checks || []).some((k: any) => k.status !== 'completed'));
  useEffect(() => {
    if (!target || !checksRunning) return;
    const num = target.number;
    const t = setInterval(() => {
      loadDetail(owner, repo, num)
        .then((d) => setData((cur) => (cur && cur.pr.number === num ? d : cur)))
        .catch(() => {});
    }, 5000);
    return () => clearInterval(t);
  }, [target?.repo, target?.number, checksRunning]);

  // Regras de aprovação do GitHub: aprovações vigentes (a última review de cada pessoa), bloqueios e o que cada tipo de review permite
  const approval = useMemo(() => {
    if (!data) return null;
    const latest = new Map<string, string>();
    [...data.reviews].sort((a, b) => new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()).forEach((r) => {
      if (!r.user || r.user === data.pr.author) return;
      if (r.state === 'APPROVED' || r.state === 'CHANGES_REQUESTED' || r.state === 'DISMISSED') latest.set(r.user, r.state);
    });
    const approvals = [...latest].filter(([, st]) => st === 'APPROVED').map(([u]) => u);
    const blockers = [...latest].filter(([, st]) => st === 'CHANGES_REQUESTED').map(([u]) => u);
    const ownPr = Boolean(data.me && data.pr.author && data.me.toLowerCase() === data.pr.author.toLowerCase());
    const closed = data.pr.state !== 'open' || data.pr.merged;
    const missing = Math.max(0, data.rules.requiredApprovals - approvals.length);
    const blockedReason = (ev: 'COMMENT' | 'APPROVE' | 'REQUEST_CHANGES') => {
      if (ev === 'COMMENT') return null;
      if (ownPr) return 'Você é o autor: o GitHub não permite aprovar nem pedir alterações no próprio pull request.';
      if (closed) return 'Pull request fechado ou mergeado: só dá para comentar.';
      return null;
    };
    return { approvals, blockers, ownPr, closed, missing, blockedReason };
  }, [data]);

  useEffect(() => {
    if (approval?.blockedReason(event)) setEvent('COMMENT');
  }, [approval, event]);
  useEffect(() => {
    if (!submitOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setSubmitOpen(false);
    const onPointerDown = (e: MouseEvent) => {
      if (submitWrapRef.current && !submitWrapRef.current.contains(e.target as Node)) {
        setSubmitOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      window.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, [submitOpen]);

  useEffect(() => {
    if (!aiBusy) return;
    const t0 = Date.now();
    setAiElapsed(0);
    const t = setInterval(() => setAiElapsed(Math.floor((Date.now() - t0) / 1000)), 500);
    return () => clearInterval(t);
  }, [aiBusy]);
  useEffect(() => {
    if (aiBusy && aiScroll.current) aiScroll.current.scrollTop = aiScroll.current.scrollHeight;
  }, [aiText, aiBusy]);

  const files = useMemo(() => (data?.files || []).filter((f) => f.filename.toLowerCase().includes(filter.trim().toLowerCase())), [data, filter]);

  if (!target) {
    return (
      <div style={{ flex: 1, width: '100%', height: '100%', minWidth: 0, minHeight: 0, background: c.bg, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, color: c.sub }}>
        Selecione um pull request para ver os detalhes.
      </div>
    );
  }

  const cancelAiReview = () => {
    if (!aiRun.current) return;
    aiRun.current.cancelled = true;
    window.electronAPI?.ai?.cancel?.(undefined, aiProvider.cwd, aiRun.current.id);
    setAiBusy(false);
    setAiPhase('idle');
    setAiText('');
  };

  const runAiReview = async () => {
    if (!data || aiBusy) return;
    const api = window.electronAPI?.ai;
    setAiBusy(true);
    setTab('ia');
    setAiText('');
    setAiError(null);
    setAiPhase('preparing');
    logSystemActivity('review', 'revisar_com_ia', `${target.repo}#${target.number}`, { provider: aiProvider.id });
    let others: OtherPr[] = [];
    if (withOthers) {
      try {
        const list = await ghSettings<any[]>('listPulls', { owner, repo });
        const open = list.filter((x) => x.state === 'open' && x.number !== target.number).slice(0, 8);
        const details = await Promise.all(open.map((x) => loadDetail(owner, repo, x.number).catch(() => null)));
        others = details.flatMap((d, i) => (d ? [{ number: open[i].number, title: open[i].title, head: `${d.pr.head} -> ${d.pr.base}`, files: d.files.map((f) => ({ filename: f.filename, patch: f.patch })) }] : []));
      } catch {
        onToast('Não foi possível carregar os outros PRs abertos. A revisão segue só com este PR.');
      }
    }
    const prompt = buildAiPrompt(data, others);
    const total = data.files.reduce((n, f) => n + f.patch.length, 0);
    setAiInfo({ files: data.files.length, kb: Math.round(prompt.length / 1024), truncated: data.files.filter((f) => f.patch.length > 6000).length + (total > 50000 ? 1 : 0), model: aiProvider.model });
    setAiRanBy(aiProvider.id);
    const startedAt = Date.now();
    const run = { id: `pr-review-${Date.now()}`, cancelled: false };
    aiRun.current = run;
    if (!api?.runCli || !aiProvider.cliCommand) {
      setAiError(`A IA selecionada (${aiProvider.name}) não tem CLI configurada para rodar por aqui. Escolha outra IA no cabeçalho.`);
      setAiPhase('error');
      setAiBusy(false);
      return;
    }
    let streamedText = '';
    const off = api.onEvent?.((ev: any) => {
      if (run.cancelled || ev?.kind !== 'progress' || ev?.payload?.streamId !== run.id || typeof ev.payload.text !== 'string') return;
      setAiPhase('streaming');
      streamedText += ev.payload.text;
      setAiText(streamedText);
      const partialRec: SavedAiReview = {
        text: streamedText,
        providerId: aiProvider.id,
        providerName: aiProvider.name,
        model: aiProvider.model || undefined,
        savedAt: new Date().toISOString(),
        headSha: data.commitList[data.commitList.length - 1]?.sha,
        files: data.files.length,
        kb: Math.round(prompt.length / 1024),
        seconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
      };
      writeSavedReview(target.repo, target.number, partialRec);
      setSavedReview(partialRec);
    });
    setAiPhase('waiting');
    let lastErr = '';
    try {
      for (const model of aiProvider.model ? [aiProvider.model, undefined] : [undefined]) {
        if (model === undefined && aiProvider.model) {
          setAiInfo((i) => (i ? { ...i, retried: true } : i));
          streamedText = '';
          setAiText('');
          setAiPhase('waiting');
        }
        let res: any;
        try {
          res = await api.runCli({ cliCmd: aiProvider.cliCommand, prompt, model, cwd: aiProvider.cwd, streamText: true, streamId: run.id });
        } catch (e: any) {
          lastErr = e?.message || String(e);
          continue;
        }
        if (run.cancelled || res?.cancelled) return;
        const out = (res?.stdout || '').trim();
        const bad = !out || res?.exitCode !== 0 || out.includes("There's an issue with the selected model") || out.includes('[claude-code:unrecognized_model]') || out.startsWith('Error:');
        if (!bad) {
          setAiText(out);
          setAiPhase('done');
          const rec: SavedAiReview = {
            text: out,
            providerId: aiProvider.id,
            providerName: aiProvider.name,
            model: model || undefined,
            savedAt: new Date().toISOString(),
            headSha: data.commitList[data.commitList.length - 1]?.sha,
            files: data.files.length,
            kb: Math.round(prompt.length / 1024),
            seconds: Math.max(1, Math.round((Date.now() - startedAt) / 1000)),
          };
          writeSavedReview(target.repo, target.number, rec);
          setSavedReview(rec);
          return;
        }
        lastErr = (res?.stderr || out || `a CLI saiu com código ${res?.exitCode}`).trim().slice(-600);
      }
      setAiError(lastErr || 'A IA não respondeu.');
      setAiPhase('error');
      onToast('A revisão com IA falhou. Veja o motivo na aba "Revisão da IA".');
    } finally {
      off?.();
      if (!run.cancelled) setAiBusy(false);
    }
  };

  const friendlyError = (m: string) =>
    /own pull request/i.test(m) ? 'O GitHub não permite aprovar nem pedir alterações no próprio pull request.' : /can not approve|cannot approve/i.test(m) ? 'Você não pode aprovar este pull request.' : /review.*(pending|already)/i.test(m) ? 'Você já tem uma review pendente neste pull request.' : m;
  const sendReview = async () => {
    const reason = approval?.blockedReason(event);
    if (reason) {
      onToast(reason);
      return;
    }
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
      loadDetail(owner, repo, target.number).then(setData).catch(() => {});
    } catch (e: any) {
      onToast(`Falhou: ${friendlyError(e.message)}`);
    } finally {
      setSending(false);
    }
  };

  // editar título e descrição do PR; editar e excluir os próprios comentários (como no GitHub)
  const saveEdit = async () => {
    if (!editing) return;
    await runAction(
      'edit',
      () => (editing.kind === 'desc' ? ghSettings('editPull', { owner, repo, number: target.number, body: editing.text }) : ghSettings('editComment', { owner, repo, id: editing.id, body: editing.text })),
      editing.kind === 'desc' ? 'Descrição atualizada.' : 'Comentário atualizado.',
      editing.kind === 'desc' ? 'editar_descricao_pr' : 'editar_comentario_pr',
    );
    setEditing(null);
  };
  const toggleViewed = (filename: string) => {
    const next = new Set(viewed);
    const nowViewed = !next.delete(filename);
    if (nowViewed) next.add(filename);
    setViewed(next);
    try {
      localStorage.setItem(`aura_pr_viewed_v1:${target.repo.toLowerCase()}#${target.number}`, JSON.stringify([...next]));
    } catch {}
    // como no GitHub: marcar como visualizado recolhe o arquivo
    setCollapsed((c0) => {
      const n = new Set(c0);
      if (nowViewed) n.add(filename);
      else n.delete(filename);
      return n;
    });
  };
  const sendInline = async () => {
    if (!inline || !inlineText.trim() || !data) return;
    await runAction(
      'inline',
      () => (inline.replyTo ? ghSettings('replyReviewComment', { owner, repo, number: target.number, commentId: inline.replyTo, body: inlineText.trim() }) : ghSettings('addReviewComment', { owner, repo, number: target.number, body: inlineText.trim(), commitId: data.pr.headSha, path: inline.path, line: inline.line, side: inline.side })),
      'Comentário adicionado ao código.',
      'comentar_linha_pr',
    );
    setInline(null);
    setInlineText('');
  };
  const removeComment = (id: number) => runAction('delcomment', () => ghSettings('deleteComment', { owner, repo, id }), 'Comentário excluído.', 'excluir_comentario_pr');
  const saveTitle = async () => {
    const t = (titleEdit || '').trim();
    setTitleEdit(null);
    if (!t || t === data?.pr.title) return;
    await runAction('title', () => ghSettings('editPull', { owner, repo, number: target.number, title: t }), 'Título atualizado.', 'editar_titulo_pr');
  };

  // checkout local do PR (gh pr checkout) na pasta do projeto, só se o remoto dela for este repositório
  const checkoutLocal = async () => {
    if (!data || !aiProvider.cwd) {
      onToast('Abra o projeto deste repositório para fazer checkout.');
      return;
    }
    if (!window.confirm(`Fazer checkout da branch "${data.pr.head}" (PR #${target.number}) no projeto aberto?`)) return;
    const q = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`;
    const res: any = await window.electronAPI?.shell?.exec(`export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"; git remote get-url origin | grep -qi ${q(`${owner}/${repo}`)} && gh pr checkout ${target.number}`, aiProvider.cwd);
    logSystemActivity('review', 'checkout_pr', `${target.repo}#${target.number}`, { ok: res?.exitCode === 0 });
    onToast(res?.exitCode === 0 ? `Checkout feito: ${data.pr.head}` : 'Não foi possível fazer checkout (o projeto aberto é deste repositório e o gh está instalado?).');
  };

  const reload = () => loadDetail(owner, repo, target.number).then(setData).catch(() => {});
  const runAction = async (key: string, fn: () => Promise<any>, okMsg: string, log: string) => {
    setBusyAction(key);
    try {
      await fn();
      logSystemActivity('review', log, `${target.repo}#${target.number}`, {});
      onToast(okMsg);
      await reload();
    } catch (e: any) {
      onToast(`Falhou: ${e.message}`);
    } finally {
      setBusyAction(null);
    }
  };
  const sendComment = () =>
    commentBody.trim() &&
    runAction('comment', () => ghSettings('addPullComment', { owner, repo, number: target.number, body: commentBody.trim() }), 'Comentário enviado.', 'comentar_pr').then(() => setCommentBody(''));
  const toggleState = () => runAction('state', () => ghSettings('setPullState', { owner, repo, number: target.number, state: data?.pr.state === 'open' ? 'closed' : 'open' }), data?.pr.state === 'open' ? 'Pull request fechado.' : 'Pull request reaberto.', 'alterar_estado_pr');
  const mergePr = () => runAction('merge', () => ghSettings('mergePull', { owner, repo, number: target.number, method: mergeMethod }), 'Pull request mergeado.', 'merge_pr');
  const assignMe = () => data?.me && runAction('assign', () => ghSettings('assignPull', { owner, repo, number: target.number, assignees: [data.me] }), 'Você foi atribuído ao pull request.', 'atribuir_pr');

  const btn = (primary = false, disabled = false): React.CSSProperties => ({
    height: 30,
    padding: '0 12px',
    border: 'none',
    outline: 'none',
    boxShadow: 'none',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 400,
    fontFamily: 'inherit',
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    cursor: disabled ? 'default' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background: primary ? accentColor : ft.fieldBg,
    color: primary ? accentInk : c.text,
    transition: 'transform 140ms var(--ease-out), opacity 150ms ease, background-color 150ms ease, color 150ms ease',
  });

  const pr = data?.pr;
  const statusLabel = pr ? (pr.merged ? 'Mergeado' : pr.draft ? 'Rascunho' : pr.state === 'open' ? 'Aberto' : 'Fechado') : '';
  const statusColor = pr ? (pr.merged ? '#a371f7' : pr.draft ? '#8b949e' : pr.state === 'open' ? '#3fb950' : '#f85149') : c.muted;
  const StatusIcon = pr?.merged ? GitMerge : pr?.draft ? GitPullRequestDraft : pr?.state === 'open' ? GitPullRequest : GitPullRequestClosed;

  const tabBtn = (id: typeof tab, label: string, count?: number, icon?: React.ReactNode) => {
    const active = tab === id;
    return (
      <button
        key={id}
        type="button"
        onClick={() => setTab(id)}
        className="df-pressable"
        style={{
          height: 30,
          padding: '0 10px',
          border: 'none',
          outline: 'none',
          boxShadow: 'none',
          borderRadius: 6,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 12,
          fontWeight: 400,
          fontFamily: 'inherit',
          cursor: 'pointer',
          background: active ? ft.fieldBg : 'transparent',
          color: active ? c.text : c.sub,
          transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
        }}
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', color: active ? accentColor : c.sub }}>{icon}</span>
        <span>{label}</span>
        {count !== undefined && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 400,
              color: active ? accentInk : c.sub,
              background: active ? accentColor : c.card,
              borderRadius: 10,
              padding: '0 6px',
              lineHeight: '16px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {count}
          </span>
        )}
      </button>
    );
  };

  const renderDiff = (f: PullFile) => {
    const rows = parsePatch(f.patch);
    const isCollapsed = collapsed.has(f.filename);
    const slashIdx = f.filename.lastIndexOf('/');
    const dirPart = slashIdx > 0 ? f.filename.slice(0, slashIdx + 1) : '';
    const baseName = slashIdx > 0 ? f.filename.slice(slashIdx + 1) : f.filename;
    const totalChanges = f.additions + f.deletions;
    const addBlocks = totalChanges > 0 ? Math.round((f.additions / totalChanges) * 4) : 0;

    return (
      <div key={f.filename} id={`pr-file-${f.filename}`} style={{ background: c.card, borderRadius: 8, overflow: 'hidden', marginBottom: 10 }}>
        <div
          onClick={() => setCollapsed((prev) => { const n = new Set(prev); if (!n.delete(f.filename)) n.add(f.filename); return n; })}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            cursor: 'pointer',
            fontSize: 12,
            fontWeight: 400,
            color: c.text,
            background: c.cardHeader,
            borderBottom: isCollapsed ? 'none' : `1px solid ${c.line}`,
            userSelect: 'none',
          }}
        >
          <ChevronRight
            size={13}
            color={c.sub}
            className="df-chevron"
            style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', flexShrink: 0 }}
          />
          <FileIcon fileName={baseName} size={14} />
          <div style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5 }}>
            {dirPart && <span style={{ color: c.sub }}>{dirPart}</span>}
            <span style={{ color: c.text }}>{baseName}</span>
          </div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontVariantNumeric: 'tabular-nums', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, flexShrink: 0 }}>
            {f.additions > 0 && <span style={{ color: c.addText }}>+{f.additions}</span>}
            {f.deletions > 0 && <span style={{ color: c.delText }}>-{f.deletions}</span>}
            <label
              onClick={(e) => e.stopPropagation()}
              title="Marcar como visualizado"
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginLeft: 4, cursor: 'pointer', color: viewed.has(f.filename) ? accentColor : c.sub, fontFamily: 'inherit', fontSize: 11, transition: 'color 150ms ease' }}
            >
              <input type="checkbox" checked={viewed.has(f.filename)} onChange={() => toggleViewed(f.filename)} style={{ accentColor, margin: 0 }} />
              Visualizado
            </label>
            {totalChanges > 0 && (
              <span style={{ display: 'inline-flex', gap: 2, marginLeft: 2 }}>
                {[0, 1, 2, 3].map((b) => (
                  <span
                    key={b}
                    style={{
                      width: 5,
                      height: 5,
                      borderRadius: 1.5,
                      background: b < addBlocks ? c.addText : f.deletions > 0 ? c.delText : c.muted,
                    }}
                  />
                ))}
              </span>
            )}
          </div>
        </div>
        {!isCollapsed &&
          (rows.length > 1 || f.patch ? (
            <div style={{ overflowX: 'auto', fontFamily: 'JetBrains Mono, ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5, lineHeight: '20px' }}>
              {rows.map((r, i) => {
                const isAdd = r.type === 'add';
                const isDel = r.type === 'del';
                const isHunk = r.type === 'hunk';
                const side: 'LEFT' | 'RIGHT' = isDel ? 'LEFT' : 'RIGHT';
                const lineNo = isDel ? r.oldNo : r.newNo;
                const thread = !isHunk && lineNo ? (data?.reviewComments || []).filter((cm) => cm.path === f.filename && cm.line === lineNo && ((cm as any).side || 'RIGHT') === side) : [];
                const formHere = inline && inline.path === f.filename && inline.line === lineNo && inline.side === side;
                return (
                  <React.Fragment key={i}>
                  <div
                    style={{
                      display: 'flex',
                      minWidth: 'max-content',
                      background: isAdd ? c.add : isDel ? c.del : isHunk ? c.hunk : 'transparent',
                      color: isHunk ? c.sub : c.text,
                      borderLeft: isAdd ? `2px solid ${c.addText}` : isDel ? `2px solid ${c.delText}` : '2px solid transparent',
                    }}
                  >
                    <span style={{ width: 42, textAlign: 'right', paddingRight: 8, color: c.muted, background: isAdd ? c.addGutter : isDel ? c.delGutter : 'transparent', userSelect: 'none', flexShrink: 0, fontVariantNumeric: 'tabular-nums', fontSize: 10.5 }}>
                      {r.oldNo ?? ''}
                    </span>
                    <span style={{ width: 42, textAlign: 'right', paddingRight: 8, color: c.muted, background: isAdd ? c.addGutter : isDel ? c.delGutter : 'transparent', userSelect: 'none', flexShrink: 0, fontVariantNumeric: 'tabular-nums', fontSize: 10.5 }}>
                      {r.newNo ?? ''}
                    </span>
                    <span style={{ width: 20, textAlign: 'center', color: isAdd ? c.addText : isDel ? c.delText : c.muted, userSelect: 'none', flexShrink: 0 }}>
                      {isAdd ? '+' : isDel ? '-' : ''}
                    </span>
                    <span style={{ whiteSpace: 'pre', paddingRight: 14 }}>{r.text}</span>
                    {!isHunk && lineNo && (
                      <button
                        type="button"
                        title="Comentar nesta linha"
                        onClick={() => {
                          setInline({ path: f.filename, line: lineNo, side });
                          setInlineText('');
                        }}
                        style={{ position: 'sticky', right: 6, marginLeft: 'auto', alignSelf: 'center', width: 18, height: 18, border: 'none', borderRadius: 4, background: accentColor, color: getContrastTextColor(accentColor), cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0, transition: 'opacity 120ms ease' }}
                        className="pr-line-add"
                      >
                        <MessageSquare size={11} />
                      </button>
                    )}
                  </div>
                  {(thread.length > 0 || formHere) && (
                    <div className="df-subtle-enter" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '8px 12px 8px 56px', background: c.cardHeader, borderTop: `1px solid ${c.line}`, borderBottom: `1px solid ${c.line}`, fontFamily: 'inherit', whiteSpace: 'normal' }}>
                      {thread.map((cm) => (
                        <div key={cm.id} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: c.text, lineHeight: 1.45 }}>
                          <img src={cm.avatar || `https://github.com/${cm.user}.png?size=40`} alt="" style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: c.sub, fontSize: 11 }}>
                              <span style={{ color: c.text }}>{cm.user}</span> {relativeTime(cm.createdAt)}
                            </div>
                            <div style={{ whiteSpace: 'pre-wrap' }}>{cm.body}</div>
                          </div>
                        </div>
                      ))}
                      {thread.length > 0 && !formHere && (
                        <span onClick={() => { setInline({ path: f.filename, line: lineNo!, side, replyTo: thread[0].id }); setInlineText(''); }} style={{ color: accentColor, fontSize: 11.5, cursor: 'pointer', alignSelf: 'flex-start' }}>
                          Responder
                        </span>
                      )}
                      {formHere && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          <textarea
                            autoFocus
                            value={inlineText}
                            onChange={(e) => setInlineText(e.target.value)}
                            placeholder={inline?.replyTo ? 'Responder…' : `Comentar a linha ${lineNo}`}
                            style={{ minHeight: 70, resize: 'vertical', border: 'none', outline: 'none', borderRadius: 6, padding: 8, background: ft.fieldBg, color: c.text, fontSize: 12, fontFamily: 'inherit' }}
                          />
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6 }}>
                            <button type="button" className="df-pressable" style={btn()} onClick={() => setInline(null)}>
                              Cancelar
                            </button>
                            <button type="button" className="df-pressable" style={btn(true, !inlineText.trim() || busyAction !== null)} disabled={!inlineText.trim() || busyAction !== null} onClick={sendInline}>
                              {busyAction === 'inline' && <Loader2 size={13} className="spin-animate" />} Comentar
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  </React.Fragment>
                );
              })}
            </div>
          ) : (
            <div style={{ padding: 12, fontSize: 12, fontWeight: 400, color: c.sub }}>Sem diff textual (arquivo binário, renomeado ou grande demais). Veja no GitHub.</div>
          ))}
      </div>
    );
  };

  return (
    <div key={`${target.repo}#${target.number}`} className="df-opacity-enter" style={{ flex: 1, width: '100%', height: '100%', minWidth: 0, minHeight: 0, background: c.bg, borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Contexto compacto do PR + Barra de abas à esquerda e ações à direita */}
        <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 10, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, minWidth: 0, width: '100%' }}>
            {pr && (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 5,
                  height: 24,
                  background: hexToRgba(statusColor, 0.16),
                  color: statusColor,
                  borderRadius: 6,
                  padding: '0 8px',
                  fontSize: 11.5,
                  fontWeight: 400,
                  flexShrink: 0,
                }}
              >
                <StatusIcon size={12} /> {statusLabel}
              </span>
            )}
            {titleEdit !== null ? (
              <input
                autoFocus
                value={titleEdit}
                onChange={(e) => setTitleEdit(e.target.value)}
                onBlur={saveTitle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') saveTitle();
                  if (e.key === 'Escape') setTitleEdit(null);
                }}
                style={{ flex: 1, minWidth: 0, height: 30, border: 'none', outline: 'none', borderRadius: 6, padding: '0 10px', background: ft.fieldBg, color: c.text, fontSize: 14, fontFamily: 'inherit' }}
              />
            ) : (
              <div
                title={pr && (pr.author === data?.me || data?.rules.canWrite) ? 'Clique para editar o título' : undefined}
                onClick={() => pr && (pr.author === data?.me || data?.rules.canWrite) && setTitleEdit(pr.title)}
                style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 400, color: c.text, lineHeight: 1.35, overflowWrap: 'anywhere', cursor: pr && (pr.author === data?.me || data?.rules.canWrite) ? 'text' : 'default' }}
              >
                {pr?.title || 'Carregando pull request…'}{' '}
                <span style={{ color: c.muted, fontSize: 13.5, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>#{target.number}</span>
              </div>
            )}
            </div>
            {pr && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 400, color: c.sub, flexWrap: 'wrap' }}>
                <span style={{ color: c.text }}>{pr.author}</span>
                <span>·</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: c.card, borderRadius: 5, padding: '2px 7px', fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 11, color: c.text }}>
                  <GitBranch size={11} color={c.sub} />
                  {pr.head}
                  <ArrowRight size={10} color={c.muted} />
                  {pr.base}
                </span>
                <span>· {relativeTime(pr.createdAt)}</span>
              </div>
            )}
          </div>

          {/* Abas à esquerda, estatísticas e botões de ação à direita (todos com altura 30px) */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, position: 'relative', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
              {tabBtn('conversa', 'Conversa', pr ? pr.comments + data!.reviews.length : undefined, <MessageSquare size={13} />)}
              {tabBtn('commits', 'Commits', data?.commitList.length, <GitCommit size={13} />)}
              {tabBtn('checks', 'Checks', data?.checks.length, <ListChecks size={13} />)}
              {tabBtn('arquivos', 'Arquivos alterados', data?.files.length, <FileDiff size={13} />)}
              {(aiBusy || aiText || aiPhase === 'error') && tabBtn('ia', 'Revisão da IA', undefined, renderAiIcon(aiRanBy || aiProvider.id, 13))}
            </div>

            <span style={{ flex: 1 }} />

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {pr && (
                <div
                  title="Linhas adicionadas e removidas"
                  style={{
                    height: 30,
                    padding: '0 10px',
                    borderRadius: 6,
                    background: c.card,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    fontSize: 11.5,
                    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  <span style={{ color: c.addText }}>+{pr.additions}</span>
                  <span style={{ color: c.delText }}>-{pr.deletions}</span>
                </div>
              )}

              <button
                type="button"
                className="df-pressable"
                title={withOthers ? 'A IA também analisa os outros PRs abertos para saber se um problema já foi resolvido em outro. Clique para desativar.' : 'Incluir os outros PRs abertos na revisão da IA, para saber se um problema já foi resolvido em outro'}
                style={{ ...btn(false, false), color: withOthers ? accentColor : c.sub, background: withOthers ? `${accentColor}1f` : c.card }}
                onClick={() => setWithOthers((v) => { const n = !v; try { localStorage.setItem(OTHERS_KEY, n ? '1' : '0'); } catch {} return n; })}
              >
                <GitPullRequest size={13} />
                <span>Outros PRs</span>
              </button>

              <button type="button" className="df-pressable" style={btn(false, !data || aiBusy)} disabled={!data || aiBusy} onClick={runAiReview}>
                {aiBusy ? <Loader2 size={13} className="spin-animate" color={accentColor} /> : renderAiIcon(aiProvider.id, 14)}
                <span>{aiText && aiPhase === 'done' ? 'Revisar de novo' : 'Revisar com IA'}</span>
              </button>

              <div ref={submitWrapRef} style={{ position: 'relative', display: 'inline-flex' }}>
                <button
                  type="button"
                  className="df-dropdown-trigger df-pressable"
                  style={btn(true, !data)}
                  disabled={!data}
                  onClick={() => setSubmitOpen((v) => !v)}
                >
                  <span>Enviar review</span>
                  <ChevronDown
                    size={13}
                    className="df-chevron"
                    style={{ transform: submitOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>

                {submitOpen && (
                  <div
                    className="df-dropdown-menu df-popover-right"
                    style={{
                      position: 'absolute',
                      right: 0,
                      top: 'calc(100% + 6px)',
                      zIndex: 60,
                      width: 360,
                      maxWidth: 'calc(100vw - 32px)',
                      background: ft.dropdownMenuBg,
                      borderRadius: 10,
                      border: 'none',
                      boxShadow: 'none',
                      padding: 12,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 12,
                      boxSizing: 'border-box',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 400, color: c.text }}>Finalizar review</span>
                      <button
                        type="button"
                        onClick={() => setSubmitOpen(false)}
                        className="df-pressable"
                        style={{
                          width: 24,
                          height: 24,
                          border: 'none',
                          outline: 'none',
                          background: 'transparent',
                          color: c.sub,
                          borderRadius: 5,
                          cursor: 'pointer',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <X size={13} />
                      </button>
                    </div>

                    <textarea
                      value={body}
                      onChange={(e) => setBody(e.target.value)}
                      placeholder="Deixe um comentário sobre as alterações (Markdown suportado)..."
                      style={{
                        width: '100%',
                        minHeight: 96,
                        resize: 'none',
                        border: 'none',
                        outline: 'none',
                        boxShadow: 'none',
                        borderRadius: 8,
                        padding: 10,
                        background: ft.fieldBg,
                        color: c.text,
                        fontSize: 12,
                        fontWeight: 400,
                        lineHeight: 1.45,
                        fontFamily: 'inherit',
                        boxSizing: 'border-box',
                      }}
                    />

                    {data && approval && (
                      <div className="df-subtle-enter" style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: 10, borderRadius: 8, background: ft.fieldBg, fontSize: 11.5, fontWeight: 400, color: c.sub, lineHeight: 1.4 }}>
                        <span style={{ color: c.text }}>Regras de aprovação</span>
                        <span>
                          Aprovações: {approval.approvals.length}
                          {data.rules.requiredApprovals > 0 ? ` de ${data.rules.requiredApprovals} necessária${data.rules.requiredApprovals > 1 ? 's' : ''}` : data.rules.known ? ' (nenhum mínimo exigido)' : ' (as regras do branch não estão visíveis para você)'}
                        </span>
                        {approval.blockers.length > 0 && <span style={{ color: c.delText }}>Alterações solicitadas por {approval.blockers.join(', ')} bloqueiam o merge até serem resolvidas.</span>}
                        {data.rules.requireCodeOwners && <span>Exige aprovação de um code owner.</span>}
                        {data.rules.dismissStale && <span>Novos commits descartam as aprovações anteriores.</span>}
                        {data.rules.requireLastPush && <span>A aprovação precisa ser de alguém que não fez o último push.</span>}
                        {data.rules.requiredChecks.length > 0 && <span>Checks obrigatórios: {data.rules.requiredChecks.join(', ')}.</span>}
                        {!data.rules.canWrite && <span style={{ color: '#d29922' }}>Você não tem permissão de escrita: sua aprovação não conta para liberar o merge.</span>}
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {REVIEW_EVENTS.map((ev) => {
                        const blockedMsg = approval?.blockedReason(ev.id) || null;
                        const selectedEv = event === ev.id;
                        const EvIcon = ev.Icon;
                        return (
                          <button
                            key={ev.id}
                            type="button"
                            onClick={() => !blockedMsg && setEvent(ev.id)}
                            disabled={Boolean(blockedMsg)}
                            title={blockedMsg || undefined}
                            className="df-pressable"
                            style={{
                              width: '100%',
                              textAlign: 'left',
                              padding: 10,
                              borderRadius: 8,
                              border: 'none',
                              outline: 'none',
                              boxShadow: 'none',
                              cursor: blockedMsg ? 'not-allowed' : 'pointer',
                              opacity: blockedMsg ? 0.45 : 1,
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 10,
                              background: selectedEv ? hexToRgba(ev.color, 0.14) : ft.fieldBg,
                              transition: 'background-color 150ms ease, transform 140ms var(--ease-out)',
                            }}
                          >
                            <span
                              style={{
                                width: 16,
                                height: 16,
                                marginTop: 1,
                                borderRadius: '50%',
                                flexShrink: 0,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: selectedEv ? ev.color : isEffectiveDark ? 'rgba(255,255,255,0.10)' : 'rgba(0,0,0,0.10)',
                                color: selectedEv ? getContrastTextColor(ev.color) : c.sub,
                                transition: 'background-color 150ms ease, transform 140ms var(--ease-out)',
                              }}
                            >
                              {selectedEv ? <Check size={10} /> : <EvIcon size={10} />}
                            </span>
                            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0, flex: 1 }}>
                              <span style={{ fontSize: 12, fontWeight: 400, color: selectedEv ? c.text : c.text }}>{ev.label}</span>
                              <span style={{ fontSize: 11, fontWeight: 400, color: c.sub, lineHeight: 1.35 }}>{blockedMsg || ev.hint}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 8 }}>
                      <button type="button" className="df-pressable" style={btn()} onClick={() => setSubmitOpen(false)}>
                        Cancelar
                      </button>
                      <button type="button" className="df-pressable" style={btn(true, sending)} disabled={sending} onClick={sendReview}>
                        {sending ? <Loader2 size={13} className="spin-animate" /> : <Check size={13} />}
                        <span>
                          {event === 'APPROVE' ? 'Aprovar review' : event === 'REQUEST_CHANGES' ? 'Solicitar alterações' : 'Enviar comentário'}
                        </span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <button type="button" title="Copiar link do pull request" className="df-pressable" onClick={() => { navigator.clipboard?.writeText(pr?.url || `https://github.com/${target.repo}/pull/${target.number}`); onToast('Link copiado.'); }} style={{ ...btn(), width: 30, padding: 0, justifyContent: 'center' }}>
                <Copy size={13} />
              </button>
              <button type="button" title="Fazer checkout da branch no projeto" className="df-pressable" disabled={!data} onClick={checkoutLocal} style={{ ...btn(false, !data), width: 30, padding: 0, justifyContent: 'center' }}>
                <GitBranch size={13} />
              </button>
              <button
                type="button"
                title="Abrir no GitHub"
                className="df-pressable"
                onClick={() => window.electronAPI?.shell?.openExternal?.(pr?.url || `https://github.com/${target.repo}/pull/${target.number}`)}
                style={{ ...btn(), width: 30, padding: 0, justifyContent: 'center' }}
              >
                <ExternalLink size={13} />
              </button>
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: c.line, flexShrink: 0 }} />

        {/* Conteúdo */}
        <div style={{ flex: 1, minHeight: 0, minWidth: 0, display: 'flex', overflow: 'hidden' }}>
          {error ? (
            <div style={{ padding: 24, fontSize: 13, color: c.delText }}>{error}</div>
          ) : !data ? (
            <div className="df-opacity-enter" style={{ flex: 1, minWidth: 0, display: 'flex', gap: 14, padding: 16, overflow: 'hidden' }}>
              {/* esqueleto da conversa: avatar + cartões com brilho animado */}
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 14 }}>
                {[0, 1, 2].map((i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', opacity: 1 - i * 0.22 }}>
                    <span className="df-skel" style={{ width: 32, height: 32, borderRadius: '50%', flexShrink: 0, ['--skel-a' as any]: skelA, ['--skel-b' as any]: skelB, animationDelay: `${i * 120}ms` }} />
                    <div style={{ flex: 1, minWidth: 0, background: c.card, borderRadius: 8, overflow: 'hidden' }}>
                      <div style={{ height: 34, background: c.cardHeader, display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px' }}>
                        <span className="df-skel" style={{ width: 90, height: 10, borderRadius: 5, ['--skel-a' as any]: skelA, ['--skel-b' as any]: skelB, animationDelay: `${i * 120}ms` }} />
                        <span className="df-skel" style={{ width: 60, height: 10, borderRadius: 5, ['--skel-a' as any]: skelA, ['--skel-b' as any]: skelB, animationDelay: `${i * 120 + 80}ms` }} />
                      </div>
                      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
                        {[92, 78, i === 0 ? 55 : 66].map((w, k) => (
                          <span key={k} className="df-skel" style={{ width: `${w}%`, height: 10, borderRadius: 5, ['--skel-a' as any]: skelA, ['--skel-b' as any]: skelB, animationDelay: `${i * 120 + k * 90}ms` }} />
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
                <div style={{ alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12, color: c.sub, marginTop: 4 }}>
                  <Loader2 size={14} className="spin-animate" color={accentColor} />
                  <span>Carregando o pull request #{target.number}…</span>
                </div>
              </div>
              {/* esqueleto da coluna lateral */}
              <div style={{ width: 230, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 18, paddingLeft: 14, borderLeft: `1px solid ${c.line}` }}>
                {['Revisores', 'Responsáveis', 'Labels', 'Milestone'].map((t, i) => (
                  <div key={t} style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 14, borderBottom: `1px solid ${c.line}` }}>
                    <span className="df-skel" style={{ width: 70, height: 9, borderRadius: 5, ['--skel-a' as any]: skelA, ['--skel-b' as any]: skelB, animationDelay: `${i * 100}ms` }} />
                    <span className="df-skel" style={{ width: `${55 + ((i * 17) % 35)}%`, height: 11, borderRadius: 5, ['--skel-a' as any]: skelA, ['--skel-b' as any]: skelB, animationDelay: `${i * 100 + 60}ms` }} />
                  </div>
                ))}
              </div>
            </div>
          ) : tab === 'arquivos' ? (
            <>
              <div style={{ width: 280, height: '100%', minHeight: 0, flexShrink: 0, padding: 10, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', overscrollBehavior: 'contain' }}>
                <div className="df-search-box" style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 10px', borderRadius: 6, border: 'none', boxShadow: 'none', background: ft.fieldBg, flexShrink: 0, boxSizing: 'border-box' }}>
                  <Search size={13} color={c.sub} style={{ flexShrink: 0 }} />
                  <input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder="Filtrar arquivos…"
                    style={{ flex: 1, minWidth: 0, height: '100%', border: 'none', outline: 'none', background: 'transparent', color: c.text, fontSize: 12, fontWeight: 400, fontFamily: 'inherit' }}
                  />
                  {filter && (
                    <button
                      type="button"
                      onClick={() => setFilter('')}
                      className="df-pressable"
                      style={{ border: 'none', outline: 'none', background: 'transparent', color: c.sub, cursor: 'pointer', padding: 2, display: 'inline-flex', alignItems: 'center' }}
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {files.map((f) => {
                    const i = f.filename.lastIndexOf('/');
                    const baseName = i >= 0 ? f.filename.slice(i + 1) : f.filename;
                    const dirName = i > 0 ? f.filename.slice(0, i) : '';
                    const isCurrent = activeFile === f.filename;
                    return (
                      <div
                        key={f.filename}
                        className="df-row-interactive"
                        onClick={() => {
                          setActiveFile(f.filename);
                          document.getElementById(`pr-file-${f.filename}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                        }}
                        title={f.filename}
                        style={{
                          padding: '6px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          background: isCurrent ? hexToRgba(accentColor, 0.14) : 'transparent',
                          transition: 'background-color 140ms ease',
                        }}
                        onMouseEnter={(e) => {
                          if (!isCurrent) e.currentTarget.style.background = c.hover;
                        }}
                        onMouseLeave={(e) => {
                          if (!isCurrent) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <FileIcon fileName={baseName} size={14} />
                        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 400, color: isCurrent ? c.text : c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {baseName}
                          </div>
                          {dirName && (
                            <div style={{ color: c.muted, fontSize: 10.5, fontWeight: 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {dirName}
                            </div>
                          )}
                        </div>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>
                          {f.additions > 0 && <span style={{ color: c.addText }}>+{f.additions}</span>}
                          {f.deletions > 0 && <span style={{ color: c.delText }}>-{f.deletions}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ width: 1, background: c.line, flexShrink: 0 }} />
              <div style={{ flex: 1, height: '100%', minHeight: 0, minWidth: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: 12 }}>{(filter ? files : data.files).map(renderDiff)}</div>
            </>
          ) : tab === 'conversa' ? (
            <>
              <div style={{ flex: 1, height: '100%', minHeight: 0, minWidth: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: 16 }}>
                {(() => {
                  const isBot = (login?: string) => Boolean(login && login.toLowerCase().endsWith('[bot]'));
                  const cleanLogin = (login?: string) => (login ? login.replace(/\[bot\]$/i, '') : 'usuário');
                  const avatarUrl = (login?: string, avatar?: string, size = 64) => {
                    if (avatar) return avatar;
                    const clean = cleanLogin(login);
                    return `https://github.com/${clean}.png?size=${size}`;
                  };
                  const renderAvatar = (login?: string, avatar?: string, size = 32) => {
                    const bot = isBot(login);
                    return (
                      <img
                        src={avatarUrl(login, avatar, size * 2)}
                        alt={cleanLogin(login)}
                        style={{
                          width: size,
                          height: size,
                          borderRadius: bot ? 6 : '50%',
                          objectFit: 'cover',
                          flexShrink: 0,
                          background: c.cardHeader,
                        }}
                      />
                    );
                  };
                  const renderAuthorBadge = (login?: string) => {
                    const bot = isBot(login);
                    return (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ color: c.text }}>{cleanLogin(login)}</span>
                        {bot && (
                          <span
                            style={{
                              fontSize: 10.5,
                              lineHeight: '16px',
                              padding: '0 6px',
                              borderRadius: 999,
                              background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)',
                              color: c.sub,
                            }}
                          >
                            Bot
                          </span>
                        )}
                      </span>
                    );
                  };
                  const md = (t: string) =>
                    renderMarkdownPreview(t, {
                      textPrimary: c.text,
                      textSecondary: c.sub,
                      textMuted: c.muted,
                      border: c.line,
                      accentColor,
                      isEffectiveDark,
                      fontSize: 12.5,
                      regularFont: true,
                    });

                  // Timeline item with 32px left avatar column + right card
                  const timelineCard = (
                    key: string,
                    who: string | undefined,
                    avatar: string | undefined,
                    meta: React.ReactNode,
                    bodyNode: React.ReactNode,
                    ctx?: string,
                    actions?: React.ReactNode,
                  ) => (
                    <div key={key} className="df-subtle-enter" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative', zIndex: 1 }}>
                      <div style={{ width: 32, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
                        {renderAvatar(who, avatar, 32)}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, background: c.card, borderRadius: 8, overflow: 'hidden' }}>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            padding: '8px 12px',
                            fontSize: 12,
                            fontWeight: 400,
                            background: c.cardHeader,
                            borderBottom: `1px solid ${c.line}`,
                            flexWrap: 'wrap',
                          }}
                        >
                          {renderAuthorBadge(who)}
                          <span style={{ color: c.sub }}>{meta}</span>
                          {ctx && (
                            <code
                              style={{
                                marginLeft: 'auto',
                                fontSize: 11,
                                color: c.sub,
                                background: isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                padding: '2px 6px',
                                borderRadius: 4,
                                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                              }}
                            >
                              {ctx}
                            </code>
                          )}
                          {actions && <span style={{ marginLeft: ctx ? 4 : 'auto', display: 'inline-flex', gap: 2 }}>{actions}</span>}
                        </div>
                        <div style={{ padding: 12, overflowX: 'auto' }}>{bodyNode}</div>
                      </div>
                    </div>
                  );

                  const iconBtn = (title: string, onClick: () => void, icon: React.ReactNode, danger = false) => (
                    <button
                      type="button"
                      title={title}
                      className="df-pressable"
                      onClick={onClick}
                      style={{ width: 24, height: 24, border: 'none', borderRadius: 5, background: 'transparent', color: c.sub, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 150ms ease, color 150ms ease' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = ft.fieldBg;
                        e.currentTarget.style.color = danger ? c.delText : c.text;
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'transparent';
                        e.currentTarget.style.color = c.sub;
                      }}
                    >
                      {icon}
                    </button>
                  );
                  const editor = (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      <textarea
                        autoFocus
                        value={editing?.text || ''}
                        onChange={(e) => setEditing((cur) => (cur ? { ...cur, text: e.target.value } : cur))}
                        style={{ minHeight: 120, resize: 'vertical', border: 'none', outline: 'none', borderRadius: 6, padding: 10, background: ft.fieldBg, color: c.text, fontSize: 12.5, fontFamily: 'inherit' }}
                      />
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                        <button type="button" className="df-pressable" style={btn()} onClick={() => setEditing(null)}>
                          Cancelar
                        </button>
                        <button type="button" className="df-pressable" style={btn(true, busyAction !== null)} disabled={busyAction !== null} onClick={saveEdit}>
                          {busyAction === 'edit' && <Loader2 size={13} className="spin-animate" />} Salvar
                        </button>
                      </div>
                    </div>
                  );
                  const canEditDesc = data.pr.author === data.me || data.rules.canWrite;
                  const events: Array<{ at: number; node: React.ReactNode }> = [];

                  data.commitList.forEach((cm) => {
                    const firstLine = cm.message.split('\n')[0];
                    const hasExtra = cm.message.trim().includes('\n');
                    events.push({
                      at: new Date(cm.date).getTime(),
                      node: (
                        <div
                          key={`c${cm.sha}`}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            position: 'relative',
                            zIndex: 1,
                            padding: '2px 0',
                            fontSize: 12,
                            fontWeight: 400,
                            color: c.sub,
                          }}
                        >
                          <div style={{ width: 32, flexShrink: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                            <span
                              style={{
                                width: 24,
                                height: 24,
                                borderRadius: '50%',
                                background: c.card,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: c.sub,
                              }}
                            >
                              <GitCommit size={13} />
                            </span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                            {renderAvatar(cm.author, cm.avatar, 18)}
                            <span
                              onClick={() => cm.url && window.electronAPI?.shell?.openExternal?.(cm.url)}
                              title={cm.message}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                color: c.sub,
                                cursor: cm.url ? 'pointer' : 'default',
                                textDecoration: 'underline',
                                textDecorationColor: isEffectiveDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
                                textUnderlineOffset: 3,
                              }}
                            >
                              {firstLine}
                            </span>
                            {hasExtra && (
                              <span
                                style={{
                                  padding: '0 5px',
                                  height: 16,
                                  borderRadius: 4,
                                  background: c.card,
                                  color: c.sub,
                                  fontSize: 10.5,
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  flexShrink: 0,
                                }}
                              >
                                …
                              </span>
                            )}
                            <Check size={13} color={c.addText} style={{ flexShrink: 0 }} />
                            <code
                              onClick={() => cm.url && window.electronAPI?.shell?.openExternal?.(cm.url)}
                              title="Abrir commit no GitHub"
                              style={{
                                fontSize: 11.5,
                                color: c.sub,
                                fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                                cursor: cm.url ? 'pointer' : 'default',
                                textDecoration: 'underline',
                                textDecorationColor: isEffectiveDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)',
                                textUnderlineOffset: 3,
                                flexShrink: 0,
                              }}
                            >
                              {cm.sha.slice(0, 7)}
                            </code>
                          </div>
                        </div>
                      ),
                    });
                  });

                  // eventos do sistema (labels, responsáveis, pedidos de review, force-push, branch excluída...) em linhas compactas
                  (data.timeline || []).forEach((ev) => {
                    const who = ev.actor || 'alguém';
                    const lab = ev.label ? (
                      <span style={{ fontSize: 10.5, padding: '0 8px', borderRadius: 10, background: hexToRgba(`#${ev.label.color}`, 0.2), color: `#${ev.label.color}` }}>{ev.label.name}</span>
                    ) : null;
                    const text: React.ReactNode =
                      ev.event === 'labeled' ? <>adicionou a label {lab}</>
                      : ev.event === 'unlabeled' ? <>removeu a label {lab}</>
                      : ev.event === 'assigned' ? <>atribuiu a {ev.assignee}</>
                      : ev.event === 'unassigned' ? <>removeu {ev.assignee} dos responsáveis</>
                      : ev.event === 'review_requested' ? <>pediu review de {ev.reviewer}</>
                      : ev.event === 'review_request_removed' ? <>removeu o pedido de review de {ev.reviewer}</>
                      : ev.event === 'head_ref_force_pushed' ? <>fez force-push na branch</>
                      : ev.event === 'head_ref_deleted' ? <>excluiu a branch</>
                      : ev.event === 'head_ref_restored' ? <>restaurou a branch</>
                      : ev.event === 'renamed' ? <>mudou o título de “{ev.rename?.from}” para “{ev.rename?.to}”</>
                      : ev.event === 'closed' ? <>fechou o pull request</>
                      : ev.event === 'reopened' ? <>reabriu o pull request</>
                      : ev.event === 'ready_for_review' ? <>marcou como pronto para review</>
                      : ev.event === 'convert_to_draft' ? <>converteu em rascunho</>
                      : ev.event === 'milestoned' ? <>adicionou ao milestone {ev.milestone}</>
                      : ev.event === 'demilestoned' ? <>removeu do milestone {ev.milestone}</>
                      : ev.event === 'locked' ? <>bloqueou a conversa</>
                      : ev.event === 'unlocked' ? <>desbloqueou a conversa</>
                      : ev.event === 'base_ref_changed' ? <>mudou a branch base</>
                      : ev.event === 'merged' ? <>fez o merge do pull request</>
                      : null;
                    if (!text) return;
                    events.push({
                      at: new Date(ev.at).getTime(),
                      node: (
                        <div key={`t${ev.id}`} className="df-subtle-enter" style={{ display: 'flex', alignItems: 'center', gap: 12, position: 'relative', zIndex: 1, padding: '2px 0', fontSize: 12, fontWeight: 400, color: c.sub }}>
                          <div style={{ width: 32, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                            <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.sub, opacity: 0.5 }} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            {renderAvatar(ev.actor, ev.avatar, 16)}
                            <span style={{ color: c.text }}>{who}</span>
                            <span>{text}</span>
                            <span style={{ color: c.muted }}>{relativeTime(ev.at)}</span>
                          </div>
                        </div>
                      ),
                    });
                  });

                  // "Resolver com IA" nas reviews que pedem alterações: manda o texto da review e os comentários no código para a IA corrigir
                  const fixWithAi = (r: PullData['reviews'][number]) => {
                    const inlineByUser = data.reviewComments.filter((cm) => cm.user === r.user);
                    const prompt = [
                      `Resolva as alterações solicitadas por ${r.user} no pull request #${target.number} (${data.pr.title}) do repositório ${owner}/${repo}.`,
                      '',
                      'Review:',
                      r.body?.trim() || '(sem texto: veja os comentários no código abaixo)',
                      ...(inlineByUser.length > 0 ? ['', 'Comentários no código:', ...inlineByUser.map((cm) => `- ${cm.path}${cm.line ? `:${cm.line}` : ''}: ${cm.body.replace(/\n+/g, ' ')}`)] : []),
                      '',
                      'Passos:',
                      `1. git fetch origin e git checkout ${data.pr.head}`,
                      '2. Aplique cada correção pedida na review; se algum ponto for ambíguo ou discordar do pedido, pergunte antes.',
                      '3. Rode o build e os testes do projeto.',
                      `4. Mostre o resumo do que mudou e peça minha confirmação antes de commitar e dar push em ${data.pr.head}. Nunca use push --force.`,
                    ].join('\n');
                    if (!onResolveWithAi) {
                      onToast('Abra o terminal de uma IA (CLI) ou o chat de IA da IDE para usar esta opção.');
                      return;
                    }
                    logSystemActivity('review', 'resolver_review_com_ia', `${target.repo}#${target.number}`, { reviewer: r.user });
                    onResolveWithAi(prompt, 'Corrigindo review');
                  };
                  data.reviews.forEach((r) =>
                    events.push({
                      at: new Date(r.submittedAt).getTime(),
                      node: timelineCard(
                        `r${r.id}`,
                        r.user,
                        r.avatar,
                        `${STATE_LABEL[r.state] || r.state.toLowerCase()} ${relativeTime(r.submittedAt)}`,
                        r.body ? (
                          md(r.body)
                        ) : (
                          <span style={{ fontSize: 12, color: r.state === 'APPROVED' ? c.addText : r.state === 'CHANGES_REQUESTED' ? c.delText : c.sub }}>
                            {STATE_LABEL[r.state] || r.state}
                          </span>
                        ),
                        undefined,
                        r.state === 'CHANGES_REQUESTED' && data.pr.state === 'open' ? (
                          <button type="button" className="df-pressable" onClick={() => fixWithAi(r)} title="Corrigir o que foi pedido nesta review com a IA selecionada" style={{ ...btn(), height: 26, padding: '0 10px', fontSize: 11.5 }}>
                            {renderAiIcon(aiProvider.id, 13)} Resolver com IA
                          </button>
                        ) : undefined,
                      ),
                    }),
                  );

                  data.comments.forEach((cm) =>
                    events.push({
                      at: new Date(cm.createdAt).getTime(),
                      node: timelineCard(
                        `m${cm.id}`,
                        cm.user,
                        cm.avatar,
                        `comentou ${relativeTime(cm.createdAt)}`,
                        editing?.kind === 'comment' && editing.id === cm.id ? editor : md(cm.body),
                        undefined,
                        cm.user === data.me && !(editing?.kind === 'comment' && editing.id === cm.id) ? (
                          <>
                            {iconBtn('Editar comentário', () => setEditing({ kind: 'comment', id: cm.id, text: cm.body }), <Pencil size={13} />)}
                            {iconBtn('Excluir comentário', () => window.confirm('Excluir este comentário?') && removeComment(cm.id), <Trash2 size={13} />, true)}
                          </>
                        ) : undefined,
                      ),
                    }),
                  );

                  data.reviewComments.forEach((cm) =>
                    events.push({
                      at: new Date(cm.createdAt).getTime(),
                      node: timelineCard(
                        `v${cm.id}`,
                        cm.user,
                        cm.avatar,
                        `comentou no código ${relativeTime(cm.createdAt)}`,
                        md(cm.body),
                        `${cm.path}${cm.line ? `:${cm.line}` : ''}`,
                      ),
                    }),
                  );

                  events.sort((x, y) => x.at - y.at);
                  const open = data.pr.state === 'open';

                  // Checks summary for GitHub Merge Box
                  const totalChecks = data.checks.length;
                  const pendingChecks = data.checks.filter((ck) => ck.status !== 'completed').length;
                  const failedChecks = data.checks.filter(
                    (ck) => ck.status === 'completed' && ck.conclusion && !['success', 'neutral', 'skipped'].includes(ck.conclusion),
                  ).length;
                  const skippedChecks = data.checks.filter((ck) => ck.status === 'completed' && ck.conclusion === 'skipped').length;
                  const passedChecks = data.checks.filter((ck) => ck.status === 'completed' && ck.conclusion === 'success').length;

                  return (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, position: 'relative' }}>
                      {/* Timeline vertical connector line running along the left column */}
                      <div
                        style={{
                          position: 'absolute',
                          left: 15,
                          top: 16,
                          bottom: 140,
                          width: 2,
                          background: c.line,
                          zIndex: 0,
                          pointerEvents: 'none',
                        }}
                      />

                      {timelineCard(
                        'desc',
                        data.pr.author,
                        data.pr.authorAvatar,
                        `abriu ${relativeTime(data.pr.createdAt)}`,
                        editing?.kind === 'desc' ? editor : md(data.pr.body || '_Sem descrição._'),
                        undefined,
                        canEditDesc && editing?.kind !== 'desc' ? iconBtn('Editar descrição', () => setEditing({ kind: 'desc', text: data.pr.body || '' }), <Pencil size={13} />) : undefined,
                      )}
                      {events.map((e) => e.node)}

                      {/* Caixa de merge no formato do GitHub: requisitos, checks, conflitos e o que fazer depois do merge */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative', zIndex: 1 }}>
                        <div style={{ width: 32, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
                          <span style={{ width: 32, height: 32, borderRadius: 8, background: data.pr.merged ? '#8957e5' : ft.fieldBg, color: data.pr.merged ? '#fff' : c.text, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                            <GitMerge size={16} />
                          </span>
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <PullRequestMergeBox
                            owner={owner}
                            repo={repo}
                            data={data as any}
                            approval={approval}
                            c={{ ...c, hover: isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } as any}
                            fieldBg={ft.fieldBg}
                            menuBg={ft.dropdownMenuBg}
                            accentColor={accentColor}
                            accentText={getContrastTextColor(accentColor)}
                            isDark={isEffectiveDark}
                            cwd={aiProvider.cwd}
                            aiProviderId={aiProvider.id}
                            onResolveWithAi={onResolveWithAi}
                            onToast={onToast}
                            onChanged={reload}
                          />
                        </div>
                      </div>


                      {/* Comment composer aligned with left avatar column */}
                      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, position: 'relative', zIndex: 1 }}>
                        <div style={{ width: 32, flexShrink: 0, display: 'flex', justifyContent: 'center', paddingTop: 2 }}>
                          {renderAvatar(data.me || data.pr.author, undefined, 32)}
                        </div>
                        <div style={{ flex: 1, minWidth: 0, background: c.card, borderRadius: 8, overflow: 'hidden' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: 6, background: c.cardHeader, borderBottom: `1px solid ${c.line}` }}>
                            {([false, true] as const).map((pv) => (
                              <button
                                key={String(pv)}
                                type="button"
                                className="df-pressable"
                                onClick={() => setCommentPreview(pv)}
                                style={{
                                  height: 28,
                                  padding: '0 10px',
                                  border: 'none',
                                  outline: 'none',
                                  borderRadius: 6,
                                  fontSize: 12,
                                  fontWeight: 400,
                                  cursor: 'pointer',
                                  background: commentPreview === pv ? ft.fieldBg : 'transparent',
                                  color: commentPreview === pv ? c.text : c.sub,
                                  transition: 'background-color 150ms ease',
                                }}
                              >
                                {pv ? 'Pré-visualizar' : 'Escrever'}
                              </button>
                            ))}
                          </div>
                          {commentPreview ? (
                            <div style={{ padding: 12, minHeight: 110 }}>
                              {commentBody.trim() ? md(commentBody) : <span style={{ fontSize: 12, color: c.sub }}>Nada para pré-visualizar.</span>}
                            </div>
                          ) : (
                            <textarea
                              value={commentBody}
                              onChange={(e) => setCommentBody(e.target.value)}
                              placeholder="Adicione um comentário (Markdown)"
                              style={{
                                width: '100%',
                                boxSizing: 'border-box',
                                minHeight: 110,
                                resize: 'none',
                                border: 'none',
                                outline: 'none',
                                padding: 12,
                                background: 'transparent',
                                color: c.text,
                                fontSize: 12.5,
                                fontWeight: 400,
                                fontFamily: 'inherit',
                              }}
                            />
                          )}
                          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, padding: 8, borderTop: `1px solid ${c.line}` }}>
                            {!data.pr.merged && (
                              <button type="button" className="df-pressable" style={btn(false, busyAction !== null)} disabled={busyAction !== null} onClick={toggleState}>
                                {busyAction === 'state' && <Loader2 size={13} className="spin-animate" />}{' '}
                                {open ? 'Fechar pull request' : 'Reabrir pull request'}
                              </button>
                            )}
                            <button
                              type="button"
                              className="df-pressable"
                              style={btn(true, !commentBody.trim() || busyAction !== null)}
                              disabled={!commentBody.trim() || busyAction !== null}
                              onClick={sendComment}
                            >
                              {busyAction === 'comment' && <Loader2 size={13} className="spin-animate" />} Comentar
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div style={{ width: 1, background: c.line, flexShrink: 0 }} />
              <div style={{ width: 250, height: '100%', minHeight: 0, flexShrink: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: 14, display: 'flex', flexDirection: 'column', gap: 14, fontSize: 12, fontWeight: 400 }}>
                <PullRequestSidebar
                  owner={owner}
                  repo={repo}
                  number={target.number}
                  data={data}
                  c={{ ...c, hover: isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)' } as any}
                  fieldBg={ft.fieldBg}
                  menuBg={ft.dropdownMenuBg}
                  accentColor={accentColor}
                  isEffectiveDark={isEffectiveDark}
                  onToast={onToast}
                  onChanged={reload}
                />
              </div>
            </>
          ) : tab === 'commits' ? (
            <div style={{ flex: 1, height: '100%', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.commitList.length === 0 && <div style={{ fontSize: 12.5, color: c.sub }}>Sem commits.</div>}
              {data.commitList.map((cm, i) => (
                <div key={cm.sha} className="df-stagger-item" style={{ ['--stagger-idx' as any]: Math.min(i, 12), display: 'flex', alignItems: 'center', gap: 10, background: c.card, borderRadius: 8, padding: 10, transition: 'background-color 150ms ease' }}>
                  <img src={cm.avatar || `https://github.com/${cm.author}.png?size=40`} alt="" style={{ width: 20, height: 20, borderRadius: '50%' }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 400, color: c.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cm.message.split('\n')[0]}</div>
                    <div style={{ fontSize: 11, fontWeight: 400, color: c.sub }}>{cm.author} commitou {relativeTime(cm.date)}</div>
                  </div>
                  <code style={{ fontSize: 11.5, color: c.sub, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>{cm.sha.slice(0, 7)}</code>
                  <button type="button" className="df-pressable" title="Copiar SHA" onClick={() => { navigator.clipboard?.writeText(cm.sha); onToast('SHA copiado.'); }} style={{ ...btn(), width: 30, padding: 0, justifyContent: 'center' }}>
                    <Copy size={12} />
                  </button>
                  <button type="button" className="df-pressable" title="Abrir no GitHub" onClick={() => window.electronAPI?.shell?.openExternal?.(cm.url)} style={{ ...btn(), width: 30, padding: 0, justifyContent: 'center' }}>
                    <ExternalLink size={12} />
                  </button>
                </div>
              ))}
            </div>
          ) : tab === 'checks' ? (
            <div style={{ flex: 1, height: '100%', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.checks.length === 0 && <div style={{ fontSize: 12.5, color: c.sub }}>Nenhum check configurado neste pull request.</div>}
              {data.checks.map((ck, i) => {
                const done = ck.status === 'completed';
                const ok = ck.conclusion === 'success' || ck.conclusion === 'neutral' || ck.conclusion === 'skipped';
                return (
                  <div key={ck.id} className="df-stagger-item" style={{ ['--stagger-idx' as any]: Math.min(i, 12), display: 'flex', alignItems: 'center', gap: 10, background: c.card, borderRadius: 8, padding: 10 }}>
                    {!done ? <Loader2 size={16} className="spin-animate" color="#d29922" /> : ok ? <CheckCircle2 size={16} color={c.addText} /> : <XCircle size={16} color={c.delText} />}
                    <span style={{ flex: 1, fontSize: 12.5, fontWeight: 400, color: c.text }}>{ck.name}</span>
                    <span style={{ fontSize: 11.5, fontWeight: 400, color: c.sub }}>{done ? ck.conclusion || 'concluído' : 'em andamento'}{ck.app ? ` · ${ck.app}` : ''}</span>
                    {ck.url && (
                      <button type="button" className="df-pressable" title="Abrir detalhes" onClick={() => window.electronAPI?.shell?.openExternal?.(ck.url!)} style={{ ...btn(), width: 30, padding: 0, justifyContent: 'center' }}>
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div ref={aiScroll} style={{ flex: 1, height: '100%', minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(() => {
                const steps: Array<{ key: string; label: string; state: 'done' | 'active' | 'todo' | 'error' }> = [
                  { key: 'prep', label: aiInfo ? `Diff preparado: ${aiInfo.files} ${aiInfo.files === 1 ? 'arquivo' : 'arquivos'}, ${aiInfo.kb} KB${aiInfo.truncated ? ` (${aiInfo.truncated} truncado${aiInfo.truncated > 1 ? 's' : ''} para caber)` : ''}` : 'Preparando o diff', state: aiPhase === 'preparing' ? 'active' : 'done' },
                  { key: 'send', label: `Aguardando ${aiProvider.name}${aiInfo?.model && !aiInfo.retried ? ` (${aiInfo.model})` : aiInfo?.retried ? ' (modelo padrão)' : ''}`, state: aiPhase === 'preparing' ? 'todo' : aiPhase === 'waiting' ? 'active' : aiPhase === 'error' && !aiText ? 'error' : 'done' },
                  { key: 'gen', label: aiPhase === 'streaming' ? `Escrevendo a revisão · ${aiText.length} caracteres` : 'Escrevendo a revisão', state: aiPhase === 'streaming' ? 'active' : aiPhase === 'done' ? 'done' : aiPhase === 'error' && aiText ? 'error' : 'todo' },
                ];
                // revisão pronta: o andamento some e fica só o texto
                if (aiPhase === 'done' && !aiBusy) return null;
                return (
                  <div style={{ background: c.card, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {steps.map((st) => (
                      <div key={st.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: st.state === 'todo' ? c.muted : c.text, transition: 'color 150ms ease' }}>
                        {st.state === 'done' ? <CheckCircle2 size={14} color={c.addText} /> : st.state === 'active' ? <Loader2 size={14} className="spin-animate" color={accentColor} /> : st.state === 'error' ? <XCircle size={14} color={c.delText} /> : <CircleDashed size={14} color={c.muted} />}
                        <span>{st.label}</span>
                      </div>
                    ))}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
                      <span style={{ fontSize: 11.5, color: c.sub, flex: 1 }}>
                        {aiBusy ? `${aiElapsed}s decorridos` : aiPhase === 'done' ? `${savedReview ? `${savedReview.providerName} · salva neste computador ${relativeTime(savedReview.savedAt)}` : `Concluída em ${aiElapsed}s`}` : aiPhase === 'error' ? 'Falhou' : ''}
                      </span>
                      {aiBusy && (
                        <button type="button" style={btn()} onClick={cancelAiReview}>
                          <X size={13} /> Cancelar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
              {aiPhase === 'error' && (
                <div className="df-subtle-enter" style={{ background: c.card, borderRadius: 8, padding: 12, fontSize: 12.5, color: c.text, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <span style={{ color: c.delText }}>Não foi possível concluir a revisão com {aiProvider.name}.</span>
                  <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: 11.5, color: c.sub, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>{aiError}</pre>
                  <div>
                    <button type="button" style={btn(true)} onClick={runAiReview}>
                      Tentar de novo
                    </button>
                  </div>
                </div>
              )}
              {aiText && (
                <>
                  {aiPhase === 'done' && savedReview?.headSha && data && data.commitList.length > 0 && data.commitList[data.commitList.length - 1].sha !== savedReview.headSha && (
                    <div className="df-subtle-enter" style={{ background: c.card, borderRadius: 8, padding: 10, fontSize: 12, color: '#d29922' }}>
                      Esta revisão foi feita antes dos commits mais recentes do pull request. Use "Revisar de novo" para atualizá-la.
                    </div>
                  )}
                  <div className="df-subtle-enter" style={{ background: c.card, borderRadius: 8, padding: 14 }}>
                    {renderMarkdownPreview(aiText, { textPrimary: c.text, textSecondary: c.sub, textMuted: c.muted, border: c.line, accentColor, isEffectiveDark, fontSize: 12.5, regularFont: true })}
                    {aiBusy && <span style={{ display: 'inline-block', width: 7, height: 14, background: accentColor, marginLeft: 2, verticalAlign: 'text-bottom', animation: 'dfBlink 1s steps(1) infinite' }} />}
                  </div>
                  {aiPhase === 'done' && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" style={btn(true)} onClick={() => { setBody(aiText); setSubmitOpen(true); }}>
                        Usar como comentário da review
                      </button>
                      <button
                        type="button"
                        style={btn()}
                        onClick={() => {
                          writeSavedReview(target.repo, target.number, null);
                          setSavedReview(null);
                          setAiText('');
                          setAiPhase('idle');
                          setAiRanBy(null);
                          setTab('conversa');
                          onToast('Revisão da IA descartada.');
                        }}
                      >
                        Descartar
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
    </div>
  );
};
