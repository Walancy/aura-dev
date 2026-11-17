import { createPortal } from 'react-dom';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Check, ChevronDown, ChevronRight, ExternalLink, FileText, GitBranch, GitMerge, Loader2, RotateCcw, Search, Sparkles, Trash2, UserPlus, X } from 'lucide-react';
import { PopupPortal, popupColors } from '../ui/PopupPortal';
import { renderAiIcon } from '../icons/AiProviderIcons';
import { ghSettings } from '../settings/settingsUi';
import { logSystemActivity } from '../../utils/brainService';

type Method = 'merge' | 'squash' | 'rebase';
interface CheckItem {
  id: string;
  name: string;
  status: string;
  conclusion: string | null;
  url?: string;
  app?: string;
  appAvatar?: string;
  description?: string;
  required?: boolean;
  workflow?: string;
  event?: string;
  startedAt?: string;
  completedAt?: string;
}
interface Meta {
  nodeId?: string;
  canUpdate: boolean;
  canAutoMerge: boolean;
  autoMerge: { by?: string; method: string } | null;
  closing?: Array<{ number: number; title: string; state: string; url: string; repo?: string; branches?: string[] }>;
}

export interface MergeBoxData {
  me?: string;
  rules: { requiredApprovals: number; canWrite: boolean; isAdmin: boolean; enforceAdmins: boolean; requiredChecks: string[] };
  behindBy?: number;
  allowedMethods?: Record<Method, boolean>;
  deleteBranchOnMerge?: boolean;
  checks: CheckItem[];
  pr: {
    title: string;
    number: number;
    state: string;
    merged: boolean;
    draft: boolean;
    mergeable?: boolean | null;
    mergeableState?: string;
    head: string;
    base: string;
    headSha?: string;
    headRepoDeleted?: boolean;
    headOwner?: string;
    mergedBy?: string;
    author?: string;
    requestedReviewers?: Array<{ login: string; avatar?: string }>;
  };
  timeline?: Array<{ event: string }>;
  merge?: { canMergeAsAdmin?: boolean; permission?: string; inQueue?: boolean; reviewDecision?: string | null } | null;
}

interface Props {
  owner: string;
  repo: string;
  data: MergeBoxData;
  approval: { approvals: string[]; blockers: string[]; missing: number } | null;
  c: Record<string, string>;
  fieldBg: string;
  menuBg: string;
  accentColor: string;
  accentText: string;
  isDark: boolean;
  /** pasta do projeto no computador: usada para listar os arquivos em conflito */
  cwd?: string;
  /** IA selecionada: o botão "Resolver com IA" usa o ícone dela */
  aiProviderId?: string;
  /** manda o pedido para a IA do CLI ou do chat da IDE */
  onResolveWithAi?: (prompt: string, title?: string) => void;
  onToast: (msg: string) => void;
  onChanged: () => void;
}

const METHOD_LABEL: Record<Method, string> = { merge: 'Criar um commit de merge', squash: 'Squash e merge', rebase: 'Rebase e merge' };
const METHOD_SHORT: Record<Method, string> = { merge: 'Merge', squash: 'Squash', rebase: 'Rebase' };

// Caixa de merge no mesmo formato do GitHub: uma linha por requisito (review, checks, branch, conflitos), rodapé com o merge e o que fazer depois dele
export const PullRequestMergeBox: React.FC<Props> = ({ owner, repo, data, approval, c, fieldBg, menuBg, accentColor, accentText, isDark, cwd, aiProviderId, onResolveWithAi, onToast, onChanged }) => {
  const { pr, rules } = data;
  const number = pr.number;
  const base = useMemo(() => ({ owner, repo, number }), [owner, repo, number]);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [checksOpen, setChecksOpen] = useState(true);
  const [openChecks, setOpenChecks] = useState<Record<string, boolean>>({});
  const [openSteps, setOpenSteps] = useState<Record<string, boolean>>({});
  const [checkDetail, setCheckDetail] = useState<Record<string, { loading?: boolean; note?: string; steps?: Array<{ number: number; name: string; status: string; conclusion: string | null; startedAt?: string; completedAt?: string; log: string[] }> }>>({});
  // passos/log de um check aberto acompanham o andamento: refaz a busca quando o status do check muda ou enquanto ele roda
  const checkSigs = useRef<Record<string, string>>({});
  useEffect(() => {
    for (const k of data.checks) {
      if (!openChecks[k.id] || !k.id.startsWith('r')) continue;
      const sig = `${k.status}|${k.conclusion}`;
      const prev = checkSigs.current[k.id];
      checkSigs.current[k.id] = sig;
      if (prev === sig && k.status === 'completed') continue;
      if (prev === undefined && !checkDetail[k.id]) continue; // primeira abertura: toggleCheck já busca
      ghSettings('checkRunDetail', { owner, repo, checkRunId: k.id.slice(1) })
        .then((r: any) => setCheckDetail((d) => ({ ...d, [k.id]: { steps: r?.steps || [], note: r?.note } })))
        .catch(() => {});
    }
  }, [data.checks, openChecks]);
  const toggleCheck = (k: CheckItem) => {
    const next = !openChecks[k.id];
    setOpenChecks((o) => ({ ...o, [k.id]: next }));
    if (!next || checkDetail[k.id] || !k.id.startsWith('r')) return;
    setCheckDetail((d) => ({ ...d, [k.id]: { loading: true } }));
    ghSettings('checkRunDetail', { owner, repo, checkRunId: k.id.slice(1) })
      .then((r: any) => {
        setCheckDetail((d) => ({ ...d, [k.id]: { steps: r?.steps || [], note: r?.note } }));
        const bad = (r?.steps || []).find((x: any) => ['failure', 'timed_out'].includes(x.conclusion || ''));
        if (bad) setOpenSteps((o) => ({ ...o, [`${k.id}:${bad.number}`]: true }));
      })
      .catch((e: any) => setCheckDetail((d) => ({ ...d, [k.id]: { steps: [], note: e?.message || 'Erro ao carregar o check.' } })));
  };
  const [menu, setMenu] = useState<'method' | 'update' | 'cli' | 'reviewer' | null>(null);
  const [conflictFiles, setConflictFiles] = useState<string[]>([]);
  const [users, setUsers] = useState<Array<{ login: string; avatar?: string }> | null>(null);
  const [userQuery, setUserQuery] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  // quem já foi escolhido para review antes aparece no topo (mais recente primeiro), guardado neste computador
  const [recent, setRecent] = useState<string[]>(() => {
    try {
      const v = JSON.parse(localStorage.getItem('aura_recent_reviewers') || '[]');
      return Array.isArray(v) ? v.filter((x) => typeof x === 'string') : [];
    } catch {
      return [];
    }
  });
  const allowed = data.allowedMethods || { merge: true, squash: true, rebase: true };
  const firstAllowed = (['merge', 'squash', 'rebase'] as Method[]).find((m) => allowed[m]) || 'merge';
  const [method, setMethod] = useState<Method>(firstAllowed);
  const [confirming, setConfirming] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const loadMeta = useCallback(() => ghSettings<Meta>('pullMeta', base).then(setMeta).catch(() => setMeta(null)), [base]);
  useEffect(() => {
    loadMeta();
  }, [loadMeta, pr.state, pr.merged, pr.draft]);

  // Arquivos em conflito: o GitHub não informa pela API; simula o merge localmente (git merge-tree) quando o projeto aberto é este repositório
  const hasConflict = pr.mergeable === false || pr.mergeableState === 'dirty';
  useEffect(() => {
    setConflictFiles([]);
    if (!hasConflict || !cwd || pr.state !== 'open') return;
    const q = (v: string) => `'${v.replace(/'/g, `'\\''`)}'`;
    const cmd = `git remote get-url origin | grep -qi ${q(`${owner}/${repo}`)} && git fetch -q origin ${q(`+refs/pull/${number}/head:refs/remotes/origin/pr-${number}`)} ${q(pr.base)} && git merge-tree --write-tree --name-only --no-messages ${q(`origin/${pr.base}`)} ${q(`origin/pr-${number}`)}`;
    let cancelled = false;
    window.electronAPI?.shell
      ?.exec(cmd, cwd)
      .then((r: any) => {
        if (cancelled) return;
        const lines = String(r?.stdout || '').split('\n').map((l) => l.trim());
        // 1ª linha: id da árvore; depois os arquivos em conflito até a linha em branco
        const files: string[] = [];
        for (const l of lines.slice(1)) {
          if (!l) break;
          files.push(l);
        }
        setConflictFiles([...new Set(files)]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [hasConflict, cwd, owner, repo, number, pr.base, pr.state]);

  const aiPrompt = (kind: 'conflict' | 'behind') =>
    [
      `Resolva ${kind === 'conflict' ? 'os conflitos' : 'a desatualização'} do pull request #${number} (${pr.title}) do repositório ${owner}/${repo}.`,
      `A branch \`${pr.head}\` ${kind === 'conflict' ? `tem conflitos com` : `está desatualizada em relação a`} \`${pr.base}\`.${conflictFiles.length ? ` Arquivos em conflito: ${conflictFiles.join(', ')}.` : ''}`,
      '',
      'Passos:',
      '1. git fetch origin',
      `2. git checkout ${pr.head}`,
      `3. git merge origin/${pr.base}`,
      kind === 'conflict' ? '4. Resolva cada conflito preservando a intenção das duas lados; se houver dúvida em algum, pergunte antes de decidir.' : '4. Se surgirem conflitos, resolva preservando a intenção das duas lados.',
      '5. Rode o build e os testes do projeto.',
      `6. Mostre o resumo do que foi feito e peça minha confirmação antes de dar git push origin ${pr.head}. Nunca use push --force.`,
    ].join('\n');
  const fixCheckWithAi = async (k: CheckItem) => {
    if (!onResolveWithAi) {
      onToast('Abra o terminal de uma IA (CLI) ou o chat de IA da IDE para usar esta opção.');
      return;
    }
    logSystemActivity('review', 'resolver_ci_com_ia', `${owner}/${repo}#${number}`, { check: k.name });
    // log do passo que falhou, para a IA não depender do `gh` instalado/logado no terminal
    let failLog = '';
    if (k.id.startsWith('r')) {
      try {
        const d = checkDetail[k.id]?.steps ? checkDetail[k.id] : ((await ghSettings('checkRunDetail', { owner, repo, checkRunId: k.id.slice(1) })) as any);
        const bad = (d?.steps || []).find((x: any) => ['failure', 'timed_out'].includes(x.conclusion || ''));
        if (bad?.log?.length) failLog = `Passo que falhou: ${bad.name}\nÚltimas linhas do log:\n${bad.log.slice(-80).join('\n')}`;
      } catch {}
    }
    onResolveWithAi(
      [
        `O check "${k.name}" falhou no pull request #${number} (${pr.title}) do repositório ${owner}/${repo}.`,
        k.description ? `Mensagem do check: ${k.description}` : '',
        k.url ? `Detalhes: ${k.url}` : '',
        failLog ? `\n${failLog}\n` : '',
        '',
        'Passos:',
        `1. git fetch origin e git checkout ${pr.head}`,
        `2. Use o log acima; se precisar de mais, rode gh pr checks ${number} e gh run view <run-id> --log-failed (o run-id está na URL de detalhes).`,
        '3. Reproduza localmente rodando o mesmo comando do workflow (build, lint ou testes) e corrija a causa da falha.',
        '4. Rode de novo até passar.',
        `5. Mostre o resumo e peça minha confirmação antes de commitar e dar git push origin ${pr.head}. Nunca use push --force.`,
      ].filter((l, i) => l || i > 2).join('\n'),
      'Corrigindo CI',
    );
  };
  const checkLabel = (k: CheckItem) => (k.workflow ? `${k.workflow} / ${k.name}${k.event ? ` (${k.event})` : ''}` : k.name);
  const checkDuration = (k: CheckItem) => {
    if (!k.startedAt || !k.completedAt) return '';
    const sec = Math.max(0, Math.round((Date.parse(k.completedAt) - Date.parse(k.startedAt)) / 1000));
    const t = sec >= 60 ? `${Math.floor(sec / 60)}min ${sec % 60}s` : `${sec}s`;
    return ['success', 'neutral', 'skipped'].includes(k.conclusion || '') ? `Passou em ${t}` : `Falhou após ${t}`;
  };
  const resolveWithAi = (kind: 'conflict' | 'behind') => {
    if (!onResolveWithAi) {
      onToast('Abra o terminal de uma IA (CLI) ou o chat de IA da IDE para usar esta opção.');
      return;
    }
    logSystemActivity('review', 'resolver_pr_com_ia', `${owner}/${repo}#${number}`, { kind });
    onResolveWithAi(aiPrompt(kind), kind === 'conflict' ? 'Resolvendo conflitos' : 'Atualizando branch');
  };

  // Pedir review: todas as pessoas que podem ser escolhidas (repositório, organização e Projects vinculados)
  useEffect(() => {
    if (menu !== 'reviewer' || users) return;
    ghSettings<Array<{ login: string; avatar?: string }>>('assignableUsers', base).then(setUsers).catch(() => setUsers([]));
  }, [menu, users, base]);

  const run = async (key: string, fn: () => Promise<any>, ok: string, log: string, extra: Record<string, unknown> = {}) => {
    setBusy(key);
    try {
      await fn();
      logSystemActivity('review', log, `${owner}/${repo}#${number}`, extra);
      onToast(ok);
      await Promise.all([loadMeta(), Promise.resolve(onChanged())]);
      return true;
    } catch (e: any) {
      const m: string = e?.message || String(e);
      onToast(/405|not mergeable|Base branch was modified/i.test(m) ? 'O GitHub recusou: a branch mudou ou há requisitos pendentes. Atualize e tente de novo.' : /403|Resource not accessible/i.test(m) ? 'Você não tem permissão para fazer isso.' : `Falhou: ${m}`);
      return false;
    } finally {
      setBusy(null);
    }
  };

  const open = pr.state === 'open' && !pr.merged;
  const st = pr.mergeableState;
  const conflict = pr.mergeable === false || st === 'dirty';
  const behind = (data.behindBy || 0) > 0;
  const checks = data.checks;
  const failing = checks.filter((k) => k.status === 'completed' && !['success', 'neutral', 'skipped'].includes(k.conclusion || ''));
  const pending = checks.filter((k) => k.status !== 'completed');
  const passed = checks.length - failing.length - pending.length;
  // O GitHub bloqueia o merge enquanto algum requisito obrigatório não for atendido. O status de merge pode vir como "BEHIND"
  // (branch atrás) mesmo com o merge bloqueado pela review ou pelos checks obrigatórios, então o bloqueio é calculado pelas regras.
  const decision = data.merge?.reviewDecision;
  const reviewUnmet =
    decision === 'REVIEW_REQUIRED' ||
    decision === 'CHANGES_REQUESTED' ||
    (approval ? approval.blockers.length > 0 || (rules.requiredApprovals > 0 && approval.approvals.length < rules.requiredApprovals) : false);
  const requiredNames = new Set([...rules.requiredChecks, ...checks.filter((k) => k.required).map((k) => k.name)]);
  const requiredUnmet = [...requiredNames].some((n) => {
    const k = checks.find((x) => x.name === n);
    return !k || k.status !== 'completed' || !['success', 'neutral', 'skipped'].includes(k.conclusion || '');
  });
  const blocked = st === 'blocked' || reviewUnmet || requiredUnmet;
  // Quem pode fazer o merge (regras do GitHub): precisa de permissão de escrita; o PR não pode ser rascunho, ter conflitos,
  // estar na fila de merge nem estar bloqueado pelas regras do branch, a menos que a pessoa possa ignorar as regras (admin com bypass)
  const canBypass = Boolean(data.merge?.canMergeAsAdmin);
  const adminBypass = canBypass && blocked;
  const noMethod = !allowed.merge && !allowed.squash && !allowed.rebase;
  const cannotReason: string | null = !rules.canWrite
    ? `Você tem acesso ${data.merge?.permission === 'TRIAGE' ? 'de triagem' : 'somente de leitura'} neste repositório: só quem tem permissão de escrita pode fazer o merge.`
    : pr.draft
      ? 'Este pull request é um rascunho: marque como pronto para review.'
      : data.merge?.inQueue
        ? 'Este pull request já está na fila de merge.'
        : conflict
          ? 'Há conflitos que precisam ser resolvidos.'
          : noMethod
            ? 'O repositório não permite nenhum método de merge.'
            : blocked && !canBypass
              ? 'O GitHub bloqueou o merge: há requisitos pendentes (veja acima).'
              : null;
  const cannot = cannotReason !== null;
  const headRef = pr.headOwner && pr.headOwner.toLowerCase() !== owner.toLowerCase() ? `${pr.headOwner}:${pr.head}` : pr.head;

  const circle = (kind: 'ok' | 'bad' | 'warn' | 'wait' | 'merged') => {
    const bg = kind === 'ok' ? '#238636' : kind === 'bad' ? '#da3633' : kind === 'merged' ? '#8957e5' : kind === 'wait' ? '#9e6a03' : '#6e7681';
    return (
      <span style={{ width: 28, height: 28, borderRadius: '50%', background: bg, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {kind === 'ok' ? <Check size={15} /> : kind === 'bad' ? <X size={15} /> : kind === 'merged' ? <GitMerge size={15} /> : kind === 'wait' ? <Loader2 size={15} className="spin-animate" /> : <AlertTriangle size={14} />}
      </span>
    );
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
    cursor: disabled ? 'not-allowed' : 'pointer',
    opacity: disabled ? 0.5 : 1,
    background: primary ? accentColor : fieldBg,
    color: primary ? accentText : c.text,
    transition: 'opacity 150ms ease, background-color 150ms ease',
    flexShrink: 0,
    whiteSpace: 'nowrap',
  });
  const row = (key: string, icon: React.ReactNode, titleText: string, desc: React.ReactNode, right?: React.ReactNode, onClick?: () => void) => (
    <div key={key} className="df-subtle-enter" style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 14px', borderTop: `1px solid ${c.line}`, cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      {icon}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 13, color: c.text }}>{titleText}</span>
        <span style={{ fontSize: 11.5, color: c.sub, lineHeight: 1.4 }}>{desc}</span>
      </div>
      {right}
    </div>
  );
  const pc = popupColors(isDark);
  const anchors = useRef<Record<string, HTMLElement | null>>({});
  const dropdown = (anchorKey: string, items: Array<{ key: string; label: string; disabled?: boolean; onClick: () => void }>, onClose: () => void, align: 'left' | 'right' = 'right') => (
    <PopupPortal anchor={anchors.current[anchorKey] ?? null} open onClose={onClose} width={250} align={align} isDark={isDark}>
      {items.map((it) => (
        <div
          key={it.key}
          onClick={() => {
            if (it.disabled) return;
            onClose();
            it.onClick();
          }}
          style={{ padding: '8px 10px', borderRadius: 6, fontSize: 12, color: pc.text, opacity: it.disabled ? 0.4 : 1, cursor: it.disabled ? 'not-allowed' : 'pointer', transition: 'background-color 120ms ease' }}
          onMouseEnter={(e) => !it.disabled && (e.currentTarget.style.background = pc.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {it.label}
        </div>
      ))}
    </PopupPortal>
  );

  // ---------- PR já mergeado ou fechado
  if (!open) {
    const branchGone = Boolean(pr.headRepoDeleted) || (data.timeline || []).some((e) => e.event === 'head_ref_deleted') && !(data.timeline || []).some((e) => e.event === 'head_ref_restored');
    const sameRepo = !pr.headOwner || pr.headOwner.toLowerCase() === owner.toLowerCase();
    return (
      <div className="df-subtle-enter" style={{ background: c.card, borderRadius: 8, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px' }}>
          {circle(pr.merged ? 'merged' : 'bad')}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <span style={{ fontSize: 13, color: c.text }}>{pr.merged ? `Pull request mergeado e fechado${pr.mergedBy ? ` por ${pr.mergedBy}` : ''}` : 'Pull request fechado'}</span>
            <span style={{ fontSize: 11.5, color: c.sub }}>
              {pr.merged ? (branchGone ? `A branch ${pr.head} foi excluída.` : `Tudo certo — a branch ${pr.head} já pode ser excluída.`) : `Fechado sem merge${branchGone ? '' : `; a branch ${pr.head} pode ser excluída.`}`}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {pr.merged && meta?.nodeId && (
              <button type="button" className="df-pressable" style={btn(false, busy !== null)} disabled={busy !== null} onClick={() => run('revert', () => ghSettings<any>('revertPull', { ...base, nodeId: meta.nodeId }).then((r) => r?.url && window.electronAPI?.shell?.openExternal?.(r.url)), 'Pull request de reversão criado.', 'reverter_pr')}>
                {busy === 'revert' ? <Loader2 size={13} className="spin-animate" /> : <RotateCcw size={13} />} Reverter
              </button>
            )}
            {sameRepo && !branchGone && (
              <button type="button" className="df-pressable" style={btn(false, busy !== null)} disabled={busy !== null} onClick={() => run('delbranch', () => ghSettings('deletePullBranch', { ...base, ref: pr.head }), `Branch ${pr.head} excluída.`, 'excluir_branch_pr', { branch: pr.head })}>
                {busy === 'delbranch' ? <Loader2 size={13} className="spin-animate" /> : <Trash2 size={13} />} Excluir branch
              </button>
            )}
            {sameRepo && branchGone && pr.headSha && (
              <button type="button" className="df-pressable" style={btn(false, busy !== null)} disabled={busy !== null} onClick={() => run('restore', () => ghSettings('restorePullBranch', { ...base, ref: pr.head, sha: pr.headSha }), `Branch ${pr.head} restaurada.`, 'restaurar_branch_pr', { branch: pr.head })}>
                {busy === 'restore' ? <Loader2 size={13} className="spin-animate" /> : <GitBranch size={13} />} Restaurar branch
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ---------- PR aberto
  const rows: React.ReactNode[] = [];
  const aiBtn = (kind: 'conflict' | 'behind') => (
    <button type="button" className="df-pressable" style={btn()} onClick={() => resolveWithAi(kind)}>
      {aiProviderId ? renderAiIcon(aiProviderId, 14) : <Sparkles size={13} color={accentColor} />} Resolver com IA
    </button>
  );
  if (pr.draft) {
    rows.push(
      row('draft', circle('warn'), 'Este pull request ainda é um rascunho', 'Rascunhos não podem ser mergeados.', meta?.nodeId ? (
        <button type="button" className="df-pressable" style={btn(false, busy !== null)} disabled={busy !== null} onClick={() => run('draft', () => ghSettings('setPullDraft', { ...base, nodeId: meta.nodeId, draft: false }), 'Pronto para review.', 'pr_pronto_para_review')}>
          {busy === 'draft' && <Loader2 size={13} className="spin-animate" />} Pronto para review
        </button>
      ) : undefined),
    );
  }

  // Review: quando é exigida, oferece pedir a review de alguém (todas as pessoas do repositório, da organização e dos Projects vinculados)
  const alreadyRequested = new Set((pr.requestedReviewers || []).map((u) => u.login));
  const confirmPicked = () => {
    const list = picked.filter((l) => !alreadyRequested.has(l));
    setMenu(null);
    if (list.length === 0) return;
    const nextRecent = [...list, ...recent.filter((l) => !list.includes(l))].slice(0, 20);
    setRecent(nextRecent);
    try { localStorage.setItem('aura_recent_reviewers', JSON.stringify(nextRecent)); } catch { /* sem armazenamento: só não lembra */ }
    run('reviewer', () => ghSettings('requestPullReviewers', { ...base, add: list, remove: [] }), list.length === 1 ? `Review solicitada a ${list[0]}.` : `Review solicitada a ${list.length} pessoas.`, 'pedir_review', { users: list });
  };
  const reviewerPicker = (
    <div ref={(el) => { anchors.current.reviewer = el; }} style={{ position: 'relative' }}>
      <button type="button" className="df-pressable" style={btn(false, busy !== null)} disabled={busy !== null} onClick={() => { setUserQuery(''); setPicked([]); setMenu(menu === 'reviewer' ? null : 'reviewer'); }}>
        <UserPlus size={13} /> Solicitar review
      </button>
      <PopupPortal anchor={anchors.current.reviewer ?? null} open={menu === 'reviewer'} onClose={() => setMenu(null)} width={290} align="right" maxHeight={400} isDark={isDark}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 8px', borderRadius: 6, background: pc.field, flexShrink: 0 }}>
          <Search size={12} color={pc.sub} />
          <input autoFocus value={userQuery} onChange={(e) => setUserQuery(e.target.value)} placeholder="Buscar pessoa" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: pc.text, fontSize: 12 }} />
        </div>
        <div style={{ overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>
          {!users ? (
            <div style={{ padding: 12, fontSize: 12, color: pc.sub, textAlign: 'center' }}>Carregando pessoas…</div>
          ) : (
            (() => {
              const filtered = users.filter((u) => u.login !== pr.author && u.login !== data.me && (!userQuery.trim() || u.login.toLowerCase().includes(userQuery.trim().toLowerCase())));
              const rank = (l: string) => { const i = recent.indexOf(l); return i < 0 ? Infinity : i; };
              const list = [...filtered].sort((a, b) => rank(a.login) - rank(b.login));
              const recentCount = list.filter((u) => rank(u.login) !== Infinity).length;
              if (list.length === 0) return <div style={{ padding: 12, fontSize: 12, color: pc.sub, textAlign: 'center' }}>Ninguém encontrado</div>;
              return list.map((u, idx) => {
                const taken = alreadyRequested.has(u.login);
                const on = taken || picked.includes(u.login);
                return (
                  <React.Fragment key={u.login}>
                  {idx === recentCount && recentCount > 0 && <div style={{ height: 1, background: pc.line, margin: '4px 10px', flexShrink: 0 }} />}
                  <div
                    onClick={() => !taken && setPicked((cur) => (cur.includes(u.login) ? cur.filter((x) => x !== u.login) : [...cur, u.login]))}
                    style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, fontSize: 12.5, color: pc.text, cursor: taken ? 'default' : 'pointer', opacity: taken ? 0.55 : 1, background: picked.includes(u.login) ? pc.hover : 'transparent', transition: 'background-color 120ms ease' }}
                    onMouseEnter={(e) => !taken && (e.currentTarget.style.background = pc.hover)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = picked.includes(u.login) ? pc.hover : 'transparent')}
                  >
                    <img src={u.avatar || `https://github.com/${u.login}.png?size=40`} alt="" style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0 }} />
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.login}</span>
                    {taken && <span style={{ fontSize: 10.5, color: pc.sub }}>já solicitada</span>}
                    {on && <Check size={14} color={accentColor} style={{ flexShrink: 0 }} />}
                  </div>
                  </React.Fragment>
                );
              });
            })()
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, paddingTop: 6, borderTop: `1px solid ${pc.line}`, flexShrink: 0 }}>
          <button type="button" className="df-pressable" style={{ ...btn(), flex: 1, justifyContent: 'center' }} onClick={() => setMenu(null)}>
            Cancelar
          </button>
          <button type="button" className="df-pressable" style={{ ...btn(true, picked.length === 0), flex: 1, justifyContent: 'center' }} disabled={picked.length === 0} onClick={confirmPicked}>
            <Check size={13} /> Confirmar{picked.length > 0 ? ` (${picked.length})` : ''}
          </button>
        </div>
      </PopupPortal>
    </div>
  );
  if (approval) {
    if (approval.blockers.length > 0) rows.push(row('rev', circle('bad'), 'Alterações solicitadas', `${approval.blockers.join(', ')} pediu alterações que precisam ser resolvidas.`, reviewerPicker));
    else if (rules.requiredApprovals > 0 && approval.approvals.length >= rules.requiredApprovals) rows.push(row('rev', circle('ok'), 'Alterações aprovadas', `${approval.approvals.length} aprovaç${approval.approvals.length > 1 ? 'ões' : 'ão'} de quem tem acesso de escrita.`));
    else if (rules.requiredApprovals > 0) rows.push(row('rev', circle('bad'), 'Review necessária', <>
              Pelo menos {rules.requiredApprovals} aprovaç{rules.requiredApprovals > 1 ? 'ões são exigidas' : 'ão é exigida'} por revisores com acesso de escrita ({approval.approvals.length} de {rules.requiredApprovals}).
              {(pr.requestedReviewers || []).length > 0 && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                  <span>Review solicitada a:</span>
                  {(pr.requestedReviewers || []).map((u) => (
                    <span key={u.login} title={`${u.login} — aguardando review`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '2px 8px 2px 2px', borderRadius: 14, background: fieldBg, color: c.text, fontSize: 11.5 }}>
                      <img src={u.avatar || `https://github.com/${u.login}.png?size=40`} alt={u.login} style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                      {u.login}
                    </span>
                  ))}
                </span>
              )}
            </>, reviewerPicker));
    else if (approval.approvals.length > 0) rows.push(row('rev', circle('ok'), 'Alterações aprovadas', `${approval.approvals.length} aprovaç${approval.approvals.length > 1 ? 'ões' : 'ão'}.`));
  }

  // Checks: resumo + lista agrupada (com falha, pendentes, com sucesso), incluindo os obrigatórios que ainda nem reportaram
  if (checks.length > 0 || rules.requiredChecks.length > 0) {
    const reported = new Set(checks.map((k) => k.name));
    const expected = rules.requiredChecks.filter((n) => !reported.has(n));
    const ring = (() => {
      const total = Math.max(1, failing.length + pending.length + expected.length + passed);
      const parts: Array<[number, string]> = [[passed, '#3fb950'], [failing.length, '#f85149'], [pending.length + expected.length, '#d29922']];
      let off = 0;
      const R = 11;
      const C = 2 * Math.PI * R;
      return (
        <svg width="28" height="28" viewBox="0 0 28 28" style={{ flexShrink: 0, transform: 'rotate(-90deg)' }}>
          <circle cx="14" cy="14" r={R} fill="none" stroke={c.line} strokeWidth="3" />
          {parts.filter(([n]) => n > 0).map(([n, col], i) => {
            const len = (n / total) * C;
            const el = <circle key={i} cx="14" cy="14" r={R} fill="none" stroke={col} strokeWidth="3" strokeDasharray={`${Math.max(0, len - 2)} ${C}`} strokeDashoffset={-off} />;
            off += len;
            return el;
          })}
        </svg>
      );
    })();
    const waiting = conflict && (pending.length > 0 || expected.length > 0);
    rows.push(
      row(
        'checks',
        ring,
        waiting ? 'Checks aguardando a resolução dos conflitos' : failing.length > 0 ? 'Alguns checks não passaram' : pending.length > 0 || expected.length > 0 ? 'Alguns checks ainda não terminaram' : 'Todos os checks passaram',
        [failing.length > 0 && `${failing.length} com falha`, expected.length + pending.length > 0 && `${expected.length + pending.length} esperado${expected.length + pending.length > 1 ? 's' : ''}`, passed > 0 && `${passed} com sucesso`].filter(Boolean).join(', '),
        <ChevronRight size={16} color={c.sub} style={{ transition: 'transform 200ms var(--ease-out)', transform: checksOpen ? 'rotate(90deg)' : 'none' }} />,
        () => setChecksOpen((v) => !v),
      ),
    );
    if (checksOpen) {
      const required = new Set(rules.requiredChecks);
      const group = (key: string, label: string, items: Array<CheckItem | { id: string; name: string; expected: true }>) =>
        items.length === 0 ? null : (
          <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ padding: '10px 14px 4px', fontSize: 12, color: c.sub }}>{items.length} {label}{items.length > 1 ? 's' : ''}</span>
            {items.map((k: any) => {
              const isExpected = Boolean(k.expected);
              const run_ = isExpected || k.status !== 'completed';
              const ok = !run_ && ['success', 'neutral', 'skipped'].includes(k.conclusion || '');
              return (
                <div key={k.id} style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', fontSize: 12, color: c.text, cursor: isExpected ? 'default' : 'pointer' }} onClick={() => !isExpected && toggleCheck(k)}>
                  <span style={{ width: 14, display: 'inline-flex', flexShrink: 0 }}>{!isExpected && <ChevronRight size={14} color={c.sub} style={{ transition: 'transform 200ms var(--ease-out)', transform: openChecks[k.id] ? 'rotate(90deg)' : 'none' }} />}</span>
                  <span style={{ width: 16, display: 'inline-flex', flexShrink: 0 }}>{isExpected ? <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d29922', margin: 'auto' }} /> : run_ ? <Loader2 size={14} className="spin-animate" color="#d29922" /> : ok ? <Check size={14} color="#3fb950" /> : <X size={14} color="#f85149" />}</span>
                  {k.appAvatar ? <img src={k.appAvatar} alt="" style={{ width: 16, height: 16, borderRadius: 4, flexShrink: 0 }} /> : <span style={{ width: 16, height: 16, borderRadius: 4, background: c.line, flexShrink: 0 }} />}
                  <span style={{ flexShrink: 0 }}>{isExpected ? k.name : checkLabel(k)}</span>
                  <span title={isExpected ? 'Esperado — aguardando o status ser reportado' : k.description} style={{ flex: 1, minWidth: 0, color: c.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 11.5 }}>
                    {isExpected ? '— Esperado: aguardando o status ser reportado' : [!run_ && checkDuration(k), k.description].filter(Boolean).join(' — ') ? `— ${[!run_ && checkDuration(k), k.description].filter(Boolean).join(' — ')}` : run_ ? '— em andamento' : ''}
                  </span>
                  {(k.required || required.has(k.name)) && <span style={{ fontSize: 10.5, padding: '1px 8px', borderRadius: 10, background: c.line, color: c.text, flexShrink: 0 }}>Obrigatório</span>}
                  {!isExpected && !run_ && !ok && (
                    <button type="button" className="df-pressable" onClick={(e) => { e.stopPropagation(); fixCheckWithAi(k); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', border: 'none', borderRadius: 6, background: c.line, color: c.text, fontSize: 11.5, cursor: 'pointer', flexShrink: 0 }}>
                      {aiProviderId ? renderAiIcon(aiProviderId, 12) : <Sparkles size={12} color={accentColor} />} Resolver com IA
                    </button>
                  )}
                  {!isExpected && k.url && (
                    <button type="button" className="df-pressable" onClick={(e) => { e.stopPropagation(); window.electronAPI?.shell?.openExternal?.(k.url); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', border: 'none', borderRadius: 6, background: 'transparent', color: accentColor, fontSize: 11.5, cursor: 'pointer', flexShrink: 0 }}>
                      <ExternalLink size={12} /> Detalhes
                    </button>
                  )}
                </div>
                {!isExpected && openChecks[k.id] && (
                  <div className="df-subtle-enter" style={{ margin: '0 14px 6px 38px', display: 'flex', flexDirection: 'column' }}>
                    {checkDetail[k.id]?.loading && <span style={{ fontSize: 11.5, color: c.sub, padding: '4px 0', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Loader2 size={12} className="spin-animate" color={accentColor} /> Carregando passos e log…</span>}
                    {checkDetail[k.id]?.note && <span style={{ fontSize: 11.5, color: c.sub, padding: '4px 0' }}>{checkDetail[k.id]?.note}</span>}
                    {(checkDetail[k.id]?.steps || []).map((st) => {
                      const key = `${k.id}:${st.number}`;
                      const sOk = ['success', 'neutral', 'skipped'].includes(st.conclusion || '');
                      const sRun = st.status !== 'completed';
                      const secs = st.startedAt && st.completedAt ? Math.max(0, Math.round((Date.parse(st.completedAt) - Date.parse(st.startedAt)) / 1000)) : null;
                      return (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column' }}>
                          <div onClick={() => setOpenSteps((o) => ({ ...o, [key]: !o[key] }))} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', cursor: 'pointer', fontSize: 12, color: sOk ? c.sub : c.text }}>
                            <ChevronRight size={13} color={c.sub} style={{ transition: 'transform 200ms var(--ease-out)', transform: openSteps[key] ? 'rotate(90deg)' : 'none', flexShrink: 0 }} />
                            {sRun ? <Loader2 size={13} className="spin-animate" color="#d29922" /> : sOk ? <Check size={13} color="#3fb950" /> : <X size={13} color="#f85149" />}
                            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.name}</span>
                            {secs !== null && <span style={{ fontSize: 11, color: c.sub }}>{secs}s</span>}
                          </div>
                          {openSteps[key] && (
                            <pre className="df-subtle-enter" style={{ margin: '0 0 6px 21px', padding: '4px 0 4px 10px', borderLeft: `2px solid ${c.line}`, maxHeight: 320, overflow: 'auto', fontSize: 11, lineHeight: 1.55, color: c.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
                              {st.log.length ? st.log.join('\n') : 'Sem saída registrada para este passo.'}
                            </pre>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
                {!isExpected && !run_ && !ok && (
                  <div style={{ margin: '0 14px 6px 38px', padding: '0 10px', borderLeft: `2px solid ${c.line}`, fontSize: 11.5, lineHeight: 1.5, color: c.text, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {k.description || 'O check falhou, mas o GitHub não informou o motivo. Abra os detalhes para ver o log.'}
                  </div>
                )}
                </div>
              );
            })}
          </div>
        );
      rows.push(
        <div key="checks-list" className="df-subtle-enter" style={{ borderTop: `1px solid ${c.line}`, background: c.cardHeader || c.card, paddingBottom: 6 }}>
          {group('fail', 'check com falha', failing)}
          {group('pend', 'check pendente', [...pending, ...expected.map((n) => ({ id: `exp-${n}`, name: n, expected: true as const }))])}
          {group('ok', 'check com sucesso', checks.filter((k) => k.status === 'completed' && !failing.includes(k)))}
        </div>,
      );
    }
  }

  if (behind && !conflict) {
    rows.push(
      row(
        'behind',
        circle('warn'),
        'Esta branch está desatualizada em relação à base',
        `Traga as últimas mudanças de ${pr.base} para esta branch (${data.behindBy} commit${(data.behindBy || 0) > 1 ? 's' : ''} atrás). O commit de merge ficará associado a você.`,
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          {aiBtn('behind')}
          <div ref={(el) => { anchors.current.update = el; }} style={{ position: 'relative', display: 'flex' }}>
            <button type="button" className="df-pressable" style={{ ...btn(false, busy !== null || !meta?.nodeId), borderRadius: '6px 0 0 6px' }} disabled={busy !== null || !meta?.nodeId} onClick={() => run('update', () => ghSettings('updatePullBranch', { ...base, nodeId: meta!.nodeId, method: 'merge' }), 'Branch atualizada.', 'atualizar_branch_pr', { method: 'merge' })}>
              {busy === 'update' && <Loader2 size={13} className="spin-animate" />} Atualizar branch
            </button>
            <button type="button" className="df-pressable" style={{ ...btn(false, busy !== null), padding: '0 8px', borderRadius: '0 6px 6px 0', marginLeft: 1 }} disabled={busy !== null} onClick={() => setMenu(menu === 'update' ? null : 'update')}>
              <ChevronDown size={13} />
            </button>
            {menu === 'update' && dropdown('update', [{ key: 'm', label: 'Atualizar com commit de merge', onClick: () => run('update', () => ghSettings('updatePullBranch', { ...base, nodeId: meta!.nodeId, method: 'merge' }), 'Branch atualizada.', 'atualizar_branch_pr', { method: 'merge' }) }, { key: 'r', label: 'Atualizar com rebase', onClick: () => run('update', () => ghSettings('updatePullBranch', { ...base, nodeId: meta!.nodeId, method: 'rebase' }), 'Branch atualizada com rebase.', 'atualizar_branch_pr', { method: 'rebase' }) }], () => setMenu(null))}
          </div>
        </div>,
      ),
    );
  }
  if (conflict) {
    rows.push(
      row(
        'conflict',
        circle('bad'),
        'Esta branch tem conflitos que precisam ser resolvidos',
        <>
          Use o{' '}
          <span onClick={() => window.electronAPI?.shell?.openExternal?.(`https://github.com/${owner}/${repo}/pull/${number}/conflicts`)} style={{ color: accentColor, cursor: 'pointer', textDecoration: 'underline' }}>
            editor web
          </span>{' '}
          ou a linha de comando para resolver os conflitos antes de continuar.
          {conflictFiles.length > 0 && (
            <span style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 8 }}>
              {conflictFiles.map((f) => (
                <span key={f} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: c.text, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', fontSize: 11.5 }}>
                  <FileText size={13} color={c.sub} /> {f}
                </span>
              ))}
            </span>
          )}
        </>,
        <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
          {aiBtn('conflict')}
          <button type="button" className="df-pressable" style={btn()} onClick={() => window.electronAPI?.shell?.openExternal?.(`https://github.com/${owner}/${repo}/pull/${number}/conflicts`)}>
            <ExternalLink size={13} /> Resolver conflitos
          </button>
        </div>,
      ),
    );
  }
  if (blocked && !conflict && !pr.draft) {
    const unmetChecks = [...requiredNames].filter((n) => {
      const k = checks.find((x) => x.name === n);
      return !k || k.status !== 'completed' || !['success', 'neutral', 'skipped'].includes(k.conclusion || '');
    });
    const why =
      approval && approval.blockers.length > 0
        ? `${approval.blockers.join(', ')} pediu alterações que precisam ser resolvidas.`
        : reviewUnmet
          ? `Pelo menos ${Math.max(1, rules.requiredApprovals)} aprovaç${rules.requiredApprovals > 1 ? 'ões são exigidas' : 'ão é exigida'} por revisores com acesso de escrita.`
          : unmetChecks.length > 0
            ? `Checks obrigatórios pendentes ou com falha: ${unmetChecks.join(', ')}.`
            : 'As regras do branch ainda não foram atendidas.';
    rows.push(row('blocked', circle('bad'), 'O merge está bloqueado', why));
  }
  // Resumo no topo: os checks podem estar todos verdes e ainda faltar review, branch atualizada etc.
  const unmet: string[] = [];
  if (pr.draft) unmet.push('rascunho');
  if (approval && approval.blockers.length > 0) unmet.push('alterações solicitadas');
  else if (approval && rules.requiredApprovals > 0 && approval.approvals.length < rules.requiredApprovals) unmet.push('review necessária');
  if (failing.length > 0) unmet.push('checks com falha');
  if (pending.length > 0 || rules.requiredChecks.some((n) => !checks.some((k) => k.name === n))) unmet.push('checks pendentes');
  if (conflict) unmet.push('conflitos');
  else if (behind) unmet.push('branch desatualizada');
  if (unmet.length > 0) {
    rows.unshift(row('summary', circle('warn'), `${unmet.length} requisito${unmet.length > 1 ? 's' : ''} pendente${unmet.length > 1 ? 's' : ''} antes do merge`, `${unmet.map((u) => u.charAt(0).toUpperCase() + u.slice(1)).join(' · ')}. Os checks são só um dos requisitos.`));
  }
  if (rows.length === 0 && !cannot) rows.push(row('ready', circle('ok'), 'Este pull request está pronto para merge', 'Não há conflitos nem requisitos pendentes.'));

  const defaultTitle = (m: Method) => (m === 'squash' ? `${pr.title} (#${number})` : `Merge pull request #${number} from ${headRef}`);
  const startMerge = (m: Method) => {
    setMethod(m);
    setTitle(defaultTitle(m));
    setMessage(m === 'merge' ? pr.title : '');
    setConfirming(true);
  };
  const doMerge = async () => {
    const okMerge = await run('merge', () => ghSettings('mergePull', { ...base, method, ...(method !== 'rebase' ? { title: title.trim() || undefined, message: message.trim() || undefined } : {}) }), 'Pull request mergeado.', 'merge_pr', { method });
    if (okMerge) setConfirming(false);
  };

  return (
    <div className="df-subtle-enter" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
    <div style={{ background: c.card, borderRadius: 8, overflow: 'visible' }}>
      {confirming && createPortal(
        <div onMouseDown={(e) => { if (e.target === e.currentTarget && busy === null) setConfirming(false); }} style={{ position: 'fixed', inset: 0, zIndex: 10000, background: 'rgba(0,0,0,0.55)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
          <div className="df-subtle-enter" style={{ width: 'min(520px, 100%)', maxHeight: '88vh', overflowY: 'auto', background: pc.bg, color: pc.text, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <GitMerge size={16} color={accentColor} />
              <span style={{ flex: 1, fontSize: 14 }}>Confirmar merge do #{number}</span>
              <X size={16} style={{ cursor: 'pointer', color: pc.sub }} onClick={() => busy === null && setConfirming(false)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, color: pc.sub }}>Branches</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, flexWrap: 'wrap' }}>
                <GitBranch size={13} color={accentColor} /> <span>{pr.head}</span> <ChevronRight size={13} color={pc.sub} /> <span>{pr.base}</span>
                <span style={{ color: pc.sub, fontSize: 11.5 }}>· {METHOD_LABEL[method]}</span>
              </div>
              {data.deleteBranchOnMerge && <span style={{ fontSize: 11.5, color: pc.sub }}>A branch {pr.head} será excluída após o merge.</span>}
            </div>
            <div style={{ borderTop: `1px solid ${pc.line}` }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <span style={{ fontSize: 12, color: pc.sub }}>Issues que serão fechadas</span>
              {!meta ? (
                <span style={{ fontSize: 12.5, color: pc.sub }}>Carregando…</span>
              ) : (meta.closing || []).filter((i) => i.state === 'OPEN').length === 0 ? (
                <span style={{ fontSize: 12.5, color: pc.sub }}>Nenhuma issue vinculada será fechada.</span>
              ) : (
                (meta.closing || []).filter((i) => i.state === 'OPEN').map((i) => (
                  <div key={`${i.repo}#${i.number}`} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Check size={13} color="#3fb950" />
                      <span onClick={() => window.electronAPI?.shell?.openExternal?.(i.url)} style={{ cursor: 'pointer', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        <span style={{ color: pc.sub }}>#{i.number}</span> {i.title}
                      </span>
                    </div>
                    {(i.branches || []).length > 0 && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 21, flexWrap: 'wrap', fontSize: 11.5, color: pc.sub }}>
                        <GitBranch size={12} /> {(i.branches || []).join(', ')}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
            {method !== 'rebase' ? (
              <>
                <div style={{ borderTop: `1px solid ${pc.line}` }} />
                <input value={title} onChange={(e) => setTitle(e.target.value)} style={{ height: 32, border: 'none', outline: 'none', borderRadius: 6, padding: '0 10px', background: fieldBg, color: c.text, fontSize: 12.5 }} />
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Descrição estendida do commit (opcional)" style={{ minHeight: 70, resize: 'vertical', border: 'none', outline: 'none', borderRadius: 6, padding: 10, background: fieldBg, color: c.text, fontSize: 12.5, fontFamily: 'inherit' }} />
              </>
            ) : (
              <span style={{ fontSize: 12, color: pc.sub }}>O rebase reaplica os commits do PR sobre {pr.base}; não há mensagem de commit para editar.</span>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="df-pressable" style={{ ...btn(true, busy !== null), flex: 1, justifyContent: 'center' }} disabled={busy !== null} onClick={doMerge}>
                {busy === 'merge' ? <Loader2 size={13} className="spin-animate" /> : <GitMerge size={13} />} Confirmar {METHOD_SHORT[method].toLowerCase()}
              </button>
              <button type="button" className="df-pressable" style={{ ...btn(), flex: 1, justifyContent: 'center' }} onClick={() => setConfirming(false)}>
                Cancelar
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
      <div className="pr-merge-rows">{rows}</div>
      <div style={{ borderTop: rows.length ? `1px solid ${c.line}` : 'none', padding: 14, display: 'flex', flexDirection: 'column', gap: 10, position: 'relative', background: c.cardHeader || 'transparent', borderRadius: '0 0 8px 8px' }}>
        {false ? (
          <></>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div ref={(el) => { anchors.current.method = el; }} style={{ position: 'relative', display: 'flex' }}>
              <button type="button" className="df-pressable" style={{ ...btn(true, busy !== null || cannot), borderRadius: '6px 0 0 6px' }} disabled={busy !== null || cannot} onClick={() => startMerge(method)} title={cannotReason || undefined}>
                <GitMerge size={13} /> {adminBypass ? 'Merge como admin' : method === 'squash' ? 'Squash e merge' : method === 'rebase' ? 'Rebase e merge' : 'Fazer merge'}
              </button>
              <button type="button" className="df-pressable" style={{ ...btn(true, busy !== null || cannot), padding: '0 8px', borderRadius: '0 6px 6px 0', marginLeft: 1 }} disabled={busy !== null || cannot} onClick={() => setMenu(menu === 'method' ? null : 'method')}>
                <ChevronDown size={13} />
              </button>
              {menu === 'method' && dropdown('method', (['merge', 'squash', 'rebase'] as Method[]).map((m) => ({ key: m, label: `${METHOD_LABEL[m]}${allowed[m] ? '' : ' (desativado no repositório)'}`, disabled: !allowed[m], onClick: () => setMethod(m) })), () => setMenu(null), 'left')}
            </div>
            {meta?.canAutoMerge && (cannot || blocked || failing.length > 0 || pending.length > 0 || !!meta.autoMerge) && !pr.draft && (
              <button type="button" className="df-pressable" style={btn(false, busy !== null)} disabled={busy !== null} onClick={() => run('auto', () => ghSettings('setAutoMerge', { ...base, nodeId: meta.nodeId, enable: !meta.autoMerge, method }), meta.autoMerge ? 'Merge automático desativado.' : 'Merge automático ativado: o PR será mergeado quando os requisitos forem atendidos.', meta.autoMerge ? 'desativar_automerge_pr' : 'ativar_automerge_pr', { method })}>
                {busy === 'auto' && <Loader2 size={13} className="spin-animate" />} {meta.autoMerge ? 'Desativar merge automático' : 'Ativar merge automático'}
              </button>
            )}
            <span style={{ fontSize: 11.5, color: cannotReason ? '#d29922' : c.sub, whiteSpace: 'nowrap' }}>
              {cannotReason ? (
                cannotReason
              ) : (
                <>
                  {adminBypass ? 'Você pode ignorar as regras do branch como administrador. ' : ''}Você também pode fazer o merge pela linha de comando.{' '}
                  <span onClick={() => setMenu(menu === 'cli' ? null : 'cli')} style={{ color: accentColor, cursor: 'pointer', textDecoration: 'underline' }}>
                    Ver instruções
                  </span>
                </>
              )}
            </span>
            {meta?.autoMerge && <span style={{ fontSize: 11.5, color: '#d29922' }}>Merge automático ativado{meta.autoMerge.by ? ` por ${meta.autoMerge.by}` : ''} ({meta.autoMerge.method}).</span>}
          </div>
        )}
        {menu === 'cli' && (
          <div className="df-subtle-enter" style={{ background: fieldBg, borderRadius: 8, padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 11.5, color: c.sub }}>Passo a passo no terminal (clone do repositório):</span>
            <pre style={{ margin: 0, fontSize: 11.5, color: c.text, whiteSpace: 'pre-wrap', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', lineHeight: 1.6 }}>
              {`git fetch origin\ngit checkout ${pr.base}\ngit merge --no-ff origin/${pr.head}\ngit push origin ${pr.base}`}
            </pre>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                type="button"
                className="df-pressable"
                style={btn()}
                onClick={() => {
                  navigator.clipboard?.writeText(`git fetch origin\ngit checkout ${pr.base}\ngit merge --no-ff origin/${pr.head}\ngit push origin ${pr.base}`);
                  onToast('Comandos copiados.');
                }}
              >
                Copiar
              </button>
              <button type="button" className="df-pressable" style={btn()} onClick={() => setMenu(null)}>
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
      {!pr.draft && meta?.nodeId && (
        <div style={{ alignSelf: 'flex-end', fontSize: 11.5, color: c.sub, whiteSpace: 'nowrap', padding: '0 2px' }}>
          Ainda em andamento?{' '}
          <span onClick={() => busy === null && run('draft', () => ghSettings('setPullDraft', { ...base, nodeId: meta.nodeId, draft: true }), 'Convertido em rascunho.', 'converter_pr_rascunho')} style={{ color: accentColor, cursor: 'pointer', textDecoration: 'underline' }}>
            Converter para rascunho
          </span>
        </div>
      )}
    </div>
  );
};
