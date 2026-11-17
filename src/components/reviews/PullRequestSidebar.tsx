import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bell, BellOff, Check, CheckCircle2, CircleDashed, CircleDot, Loader2, Lock, Search, Settings, Unlock, X, XCircle } from 'lucide-react';
import { ghSettings } from '../settings/settingsUi';
import { logSystemActivity } from '../../utils/brainService';
import { hexToRgba } from '../../utils/color';
import { PopupPortal, popupColors } from '../ui/PopupPortal';

type Person = { login: string; avatar?: string };
interface Meta {
  nodeId?: string;
  isDraft: boolean;
  locked: boolean;
  subscription: 'SUBSCRIBED' | 'UNSUBSCRIBED' | 'IGNORED';
  canUpdate: boolean;
  closing: Array<{ number: number; title: string; state: string; url: string; repo?: string }>;
  projects: Array<{ itemId: string; id: string; title: string; url?: string }>;
}

export interface SidebarData {
  me?: string;
  rules: { requiredApprovals: number; canWrite: boolean };
  pr: {
    author?: string;
    authorAvatar?: string;
    state: string;
    merged: boolean;
    draft: boolean;
    labels: Array<{ name: string; color: string }>;
    assignees: Person[];
    requestedReviewers: Person[];
    milestone: string | null;
    milestoneNumber?: number | null;
  };
  reviews: Array<{ user?: string; avatar?: string; state: string }>;
  comments: Array<{ user?: string; avatar?: string }>;
}

interface Props {
  owner: string;
  repo: string;
  number: number;
  data: SidebarData;
  c: Record<string, string>;
  fieldBg: string;
  menuBg: string;
  accentColor: string;
  isEffectiveDark: boolean;
  onToast: (msg: string) => void;
  onChanged: () => void;
}

type PopupKey = 'reviewers' | 'assignees' | 'labels' | 'projects' | 'milestone' | 'development' | 'notify' | null;

// Coluna lateral do pull request, no mesmo funcionamento da do GitHub: cada seção tem a engrenagem que abre uma lista com busca
export const PullRequestSidebar: React.FC<Props> = ({ owner, repo, number, data, c, fieldBg, menuBg, accentColor, isEffectiveDark, onToast, onChanged }) => {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [popup, setPopup] = useState<PopupKey>(null);
  const [query, setQuery] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [users, setUsers] = useState<Person[] | null>(null);
  const [labels, setLabels] = useState<Array<{ name: string; color: string; description: string }> | null>(null);
  const [milestones, setMilestones] = useState<Array<{ number: number; title: string; dueOn?: string }> | null>(null);
  const [projects, setProjects] = useState<Array<{ id: string; title: string }> | null>(null);
  const [issues, setIssues] = useState<Array<{ number: number; title: string }> | null>(null);

  const base = useMemo(() => ({ owner, repo, number }), [owner, repo, number]);
  const pc = popupColors(isEffectiveDark);
  const anchors = useRef<Record<string, HTMLElement | null>>({});
  const loadMeta = useCallback(() => ghSettings<Meta>('pullMeta', base).then(setMeta).catch(() => setMeta(null)), [base]);
  useEffect(() => {
    setMeta(null);
    setPopup(null);
    loadMeta();
  }, [loadMeta]);

  // listas de opções: buscadas na primeira vez que a engrenagem abre
  useEffect(() => {
    setQuery('');
    if (popup === 'reviewers' || popup === 'assignees') {
      if (!users) ghSettings<Person[]>('assignableUsers', base).then(setUsers).catch(() => setUsers([]));
    } else if (popup === 'labels') {
      if (!labels) ghSettings<typeof labels>('repoLabels', base).then(setLabels).catch(() => setLabels([]));
    } else if (popup === 'milestone') {
      if (!milestones) ghSettings<typeof milestones>('repoMilestones', base).then(setMilestones).catch(() => setMilestones([]));
    } else if (popup === 'projects') {
      if (!projects) ghSettings<typeof projects>('ownerProjects', base).then(setProjects).catch(() => setProjects([]));
    } else if (popup === 'development') {
      if (!issues)
        window.electronAPI?.github
          ?.fetchRepoIssues?.(owner, repo)
          .then((r: any) => setIssues((r?.issues || []).filter((i: any) => !i.pull_request && (i.state || 'open') === 'open').map((i: any) => ({ number: i.number, title: i.title }))))
          .catch(() => setIssues([]));
    }
  }, [popup]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (key: string, fn: () => Promise<any>, log: string, extra: Record<string, unknown> = {}) => {
    setBusy(key);
    try {
      await fn();
      logSystemActivity('review', log, `${owner}/${repo}#${number}`, extra);
      await Promise.all([loadMeta(), Promise.resolve(onChanged())]);
    } catch (e: any) {
      const m: string = e?.message || String(e);
      onToast(/403|Resource not accessible|must have/i.test(m) ? 'Você não tem permissão para alterar isso neste pull request.' : `Falhou: ${m}`);
    } finally {
      setBusy(null);
    }
  };

  const open = data.pr.state === 'open' && !data.pr.merged;
  const isAuthor = Boolean(data.me && data.pr.author && data.me.toLowerCase() === data.pr.author.toLowerCase());
  const reviewState = useMemo(() => {
    const latest = new Map<string, { state: string; avatar?: string }>();
    data.reviews.forEach((r) => r.user && r.user !== data.pr.author && r.state !== 'COMMENTED' && latest.set(r.user, { state: r.state, avatar: r.avatar }));
    return latest;
  }, [data.reviews, data.pr.author]);
  const requested = new Set(data.pr.requestedReviewers.map((u) => u.login));
  const participants = useMemo(() => {
    const m = new Map<string, string | undefined>();
    [[data.pr.author, data.pr.authorAvatar], ...data.comments.map((x) => [x.user, x.avatar]), ...data.reviews.map((x) => [x.user, x.avatar]), ...data.pr.assignees.map((u) => [u.login, u.avatar])].forEach(([u, a]) => u && !m.has(u as string) && m.set(u as string, a as string | undefined));
    return [...m];
  }, [data]);

  const img = (login: string, avatar?: string, size = 18) => <img src={avatar || `https://github.com/${login}.png?size=40`} alt={login} title={login} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  const linkBtn = (label: string, onClick: () => void, disabled = false) => (
    <span onClick={() => !disabled && onClick()} style={{ color: accentColor, cursor: disabled ? 'default' : 'pointer', textDecoration: 'underline', opacity: disabled ? 0.5 : 1 }}>
      {label}
    </span>
  );

  // Cabeçalho da seção com a engrenagem e a lista suspensa
  const section = (key: Exclude<PopupKey, null | 'notify'>, title: string, body: React.ReactNode, popupBody: React.ReactNode, hint?: string) => {
    const isOpen = popup === key;
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 12, borderBottom: `1px solid ${c.line}`, position: 'relative' }}>
        <div
          role="button"
          ref={(el) => {
            anchors.current[key] = el;
          }}
          title={`Editar ${title.toLowerCase()}`}
          onClick={() => setPopup(isOpen ? null : key)}
          className="df-pressable"
          style={{ display: 'flex', alignItems: 'center', margin: '-3px -6px', padding: '3px 6px', borderRadius: 6, cursor: 'pointer', background: isOpen ? fieldBg : 'transparent', color: isOpen ? c.text : c.sub, transition: 'background-color 150ms ease, color 150ms ease' }}
          onMouseEnter={(e) => {
            if (!isOpen) e.currentTarget.style.background = c.hover;
            e.currentTarget.style.color = c.text;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = isOpen ? fieldBg : 'transparent';
            e.currentTarget.style.color = isOpen ? c.text : c.sub;
          }}
        >
          <span style={{ flex: 1, fontSize: 11.5 }}>{title}</span>
          <Settings size={13} style={{ transition: 'transform 320ms var(--ease-out)', transform: isOpen ? 'rotate(75deg)' : 'rotate(0deg)' }} />
        </div>
        {body}
        <PopupPortal anchor={anchors.current[key] ?? null} open={isOpen} onClose={() => setPopup(null)} width={270} align="right" isDark={isEffectiveDark}>
          {hint && <div style={{ padding: '4px 8px', fontSize: 11, color: pc.sub }}>{hint}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, height: 30, padding: '0 8px', borderRadius: 6, background: pc.field, flexShrink: 0 }}>
            <Search size={12} color={pc.sub} />
            <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrar" style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', color: pc.text, fontSize: 12 }} />
          </div>
          <div style={{ overflowY: 'auto', overscrollBehavior: 'contain', display: 'flex', flexDirection: 'column', gap: 1, minHeight: 0 }}>{popupBody}</div>
        </PopupPortal>
      </div>
    );
  };

  const option = (key: string, selected: boolean, onClick: () => void, left: React.ReactNode, label: string, sub?: string, right?: React.ReactNode) => (
    <div
      key={key}
      onClick={() => busy === null && onClick()}
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 6, cursor: busy ? 'wait' : 'pointer', fontSize: 12, color: pc.text, opacity: busy && busy !== key ? 0.6 : 1, transition: 'background-color 120ms ease, opacity 150ms ease' }}
      onMouseEnter={(e) => (e.currentTarget.style.background = pc.hover)}
      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
    >
      {left}
      <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {sub && <span style={{ fontSize: 10.5, color: pc.sub, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sub}</span>}
      </span>
      {right}
      {busy === key ? <Loader2 size={13} className="spin-animate" color={accentColor} style={{ flexShrink: 0 }} /> : selected ? <Check size={14} color={accentColor} style={{ flexShrink: 0 }} /> : null}
    </div>
  );
  const empty = (t: string) => <div style={{ padding: '12px 8px', fontSize: 12, color: pc.sub, textAlign: 'center' }}>{t}</div>;
  const none = (t: string) => <span style={{ color: c.muted }}>{t}</span>;
  const q = query.trim().toLowerCase();
  const match = (...vals: Array<string | undefined>) => !q || vals.some((v) => (v || '').toLowerCase().includes(q));

  // ---- Revisores
  const reviewerRows = new Map<string, { avatar?: string; state: 'APPROVED' | 'CHANGES_REQUESTED' | 'PENDING' | 'DISMISSED' }>();
  data.pr.requestedReviewers.forEach((u) => reviewerRows.set(u.login, { avatar: u.avatar, state: 'PENDING' }));
  reviewState.forEach((v, login) => !reviewerRows.has(login) && reviewerRows.set(login, { avatar: v.avatar, state: v.state as any }));
  const stateIcon = (st: string) => (st === 'APPROVED' ? <CheckCircle2 size={14} color="#3fb950" /> : st === 'CHANGES_REQUESTED' ? <XCircle size={14} color="#f85149" /> : <CircleDashed size={14} color={c.muted} />);

  const reviewersBody = (
    <>
      {reviewerRows.size === 0 ? (
        none(data.rules.requiredApprovals > 0 ? `Nenhuma review — é necessária pelo menos ${data.rules.requiredApprovals} aprovação${data.rules.requiredApprovals > 1 ? 'ões' : ''}.` : 'Nenhum revisor')
      ) : (
        [...reviewerRows].map(([login, v]) => (
          <div key={login} className="df-subtle-enter" style={{ display: 'flex', alignItems: 'center', gap: 8, color: c.text }}>
            {img(login, v.avatar)}
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{login}</span>
            {stateIcon(v.state)}
          </div>
        ))
      )}
      {open && data.pr.draft && (
        <span style={{ color: c.sub, fontSize: 11.5 }}>
          Este pull request é um rascunho.{' '}
          {linkBtn('Pronto para review', () => meta?.nodeId && run('draft', () => ghSettings('setPullDraft', { ...base, nodeId: meta.nodeId, draft: false }), 'pr_pronto_para_review'), !meta?.nodeId || busy !== null)}
        </span>
      )}
    </>
  );
  const reviewersPopup = !users ? empty('Carregando…') : (() => {
    const list = users.filter((u) => u.login !== data.pr.author && match(u.login));
    if (list.length === 0) return empty('Ninguém encontrado');
    return list.map((u) =>
      option(u.login, requested.has(u.login) || reviewState.has(u.login), () => {
        const isReq = requested.has(u.login);
        return run(u.login, () => ghSettings('requestPullReviewers', { ...base, add: isReq ? [] : [u.login], remove: isReq ? [u.login] : [] }), isReq ? 'remover_pedido_review' : 'pedir_review', { user: u.login });
      }, img(u.login, u.avatar), u.login, reviewState.get(u.login)?.state === 'APPROVED' ? 'Aprovou' : reviewState.get(u.login)?.state === 'CHANGES_REQUESTED' ? 'Pediu alterações' : requested.has(u.login) ? 'Review solicitada' : undefined),
    );
  })();

  // ---- Responsáveis
  const assigned = new Set(data.pr.assignees.map((u) => u.login));
  const toggleAssignee = (login: string) => {
    const next = assigned.has(login) ? [...assigned].filter((x) => x !== login) : [...assigned, login];
    return run(login, () => ghSettings('setPullAssignees', { ...base, assignees: next }), 'definir_responsaveis_pr', { assignees: next });
  };
  const assigneesBody =
    data.pr.assignees.length === 0 ? (
      <span style={{ color: c.muted }}>Ninguém — {data.me ? linkBtn('atribuir a mim', () => toggleAssignee(data.me!), busy !== null) : null}</span>
    ) : (
      data.pr.assignees.map((u) => (
        <div key={u.login} className="df-subtle-enter" style={{ display: 'flex', alignItems: 'center', gap: 8, color: c.text }}>
          {img(u.login, u.avatar)}
          <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{u.login}</span>
        </div>
      ))
    );
  const assigneesPopup = !users ? empty('Carregando…') : (() => {
    const list = users.filter((u) => match(u.login));
    if (list.length === 0) return empty('Ninguém encontrado');
    return list.map((u) => option(u.login, assigned.has(u.login), () => toggleAssignee(u.login), img(u.login, u.avatar), u.login));
  })();

  // ---- Labels
  const current = new Set(data.pr.labels.map((l) => l.name));
  const labelsBody =
    data.pr.labels.length === 0 ? (
      none('Nenhuma')
    ) : (
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {data.pr.labels.map((l) => (
          <span key={l.name} className="df-subtle-enter" style={{ fontSize: 11, padding: '1px 8px', borderRadius: 10, background: hexToRgba(`#${l.color}`, 0.2), color: `#${l.color}` }}>
            {l.name}
          </span>
        ))}
      </div>
    );
  const labelsPopup = !labels ? empty('Carregando…') : (() => {
    const list = labels.filter((l) => match(l.name, l.description));
    if (list.length === 0) return empty('Nenhuma label encontrada');
    return list.map((l) =>
      option(l.name, current.has(l.name), () => {
        const next = current.has(l.name) ? [...current].filter((x) => x !== l.name) : [...current, l.name];
        return run(l.name, () => ghSettings('setPullLabels', { ...base, labels: next }), 'definir_labels_pr', { labels: next });
      }, <span style={{ width: 10, height: 10, borderRadius: '50%', background: `#${l.color}`, flexShrink: 0 }} />, l.name, l.description || undefined),
    );
  })();

  // ---- Projetos
  const inProject = new Map((meta?.projects || []).map((p) => [p.id, p]));
  const projectsBody = !meta ? none('…') : meta.projects.length === 0 ? none('Nenhum ainda') : meta.projects.map((p) => (
    <div key={p.itemId} className="df-subtle-enter" style={{ display: 'flex', alignItems: 'center', gap: 8, color: c.text }}>
      <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.title}</span>
    </div>
  ));
  const projectsPopup = !projects ? empty('Carregando…') : (() => {
    const list = projects.filter((p) => match(p.title));
    if (list.length === 0) return empty('Nenhum Project encontrado');
    return list.map((p) =>
      option(p.id, inProject.has(p.id), () =>
        inProject.has(p.id)
          ? run(p.id, () => ghSettings('removePullFromProject', { ...base, projectId: p.id, itemId: inProject.get(p.id)!.itemId }), 'remover_pr_projeto', { project: p.title })
          : run(p.id, () => ghSettings('addPullToProject', { ...base, projectId: p.id, nodeId: meta?.nodeId }), 'adicionar_pr_projeto', { project: p.title }),
      <span />, p.title),
    );
  })();

  // ---- Milestone
  const milestoneBody = data.pr.milestone ? <span style={{ color: c.text }}>{data.pr.milestone}</span> : none('Sem milestone');
  const milestonePopup = !milestones ? empty('Carregando…') : (() => {
    const list = milestones.filter((m) => match(m.title));
    return (
      <>
        {data.pr.milestoneNumber != null && option('clear', false, () => run('clear', () => ghSettings('setPullMilestone', { ...base, milestone: null }), 'limpar_milestone_pr'), <X size={13} color={c.sub} />, 'Limpar milestone')}
        {list.length === 0 ? empty('Nenhum milestone aberto') : list.map((m) => option(String(m.number), data.pr.milestoneNumber === m.number, () => run(String(m.number), () => ghSettings('setPullMilestone', { ...base, milestone: m.number }), 'definir_milestone_pr', { milestone: m.title }), <span />, m.title, m.dueOn ? `Vence em ${new Date(m.dueOn).toLocaleDateString('pt-BR')}` : undefined))}
      </>
    );
  })();

  // ---- Desenvolvimento (issues que o merge fecha)
  const developmentBody = (
    <>
      <span style={{ color: c.sub, fontSize: 11.5 }}>Fazer o merge deste pull request pode fechar estas issues.</span>
      {!meta ? none('…') : meta.closing.length === 0 ? none('Nenhuma ainda') : meta.closing.map((i) => (
        <div key={`${i.repo}#${i.number}`} className="df-subtle-enter" style={{ display: 'flex', alignItems: 'center', gap: 6, color: c.text }}>
          <CircleDot size={13} color={i.state === 'OPEN' ? '#3fb950' : '#a371f7'} style={{ flexShrink: 0 }} />
          <span title={i.title} onClick={() => window.electronAPI?.shell?.openExternal?.(i.url)} style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>
            <span style={{ color: c.sub }}>#{i.number}</span> {i.title}
          </span>
          <button type="button" title="Desvincular" onClick={() => run(`u${i.number}`, () => ghSettings('unlinkIssueFromPull', { ...base, issueNumber: i.number }), 'desvincular_issue_pr', { issue: i.number })} style={{ border: 'none', background: 'transparent', color: c.sub, cursor: 'pointer', display: 'flex', padding: 2, transition: 'color 150ms ease' }} onMouseEnter={(e) => (e.currentTarget.style.color = '#f85149')} onMouseLeave={(e) => (e.currentTarget.style.color = c.sub)}>
            <X size={12} />
          </button>
        </div>
      ))}
    </>
  );
  const linked = new Set((meta?.closing || []).filter((i) => !i.repo || i.repo.toLowerCase() === `${owner}/${repo}`.toLowerCase()).map((i) => i.number));
  const developmentPopup = !issues ? empty('Carregando…') : (() => {
    const list = issues.filter((i) => match(String(i.number), i.title)).slice(0, 40);
    if (list.length === 0) return empty('Nenhuma issue aberta encontrada');
    return list.map((i) =>
      option(String(i.number), linked.has(i.number), () =>
        linked.has(i.number)
          ? run(`u${i.number}`, () => ghSettings('unlinkIssueFromPull', { ...base, issueNumber: i.number }), 'desvincular_issue_pr', { issue: i.number })
          : run(String(i.number), () => ghSettings('linkPullToIssue', { ...base, issueNumber: i.number }), 'vincular_issue_pr', { issue: i.number }),
      <span style={{ color: c.sub, fontSize: 11.5 }}>#{i.number}</span>, i.title),
    );
  })();

  // ---- Notificações
  const sub = meta?.subscription || 'UNSUBSCRIBED';
  const setSub = (state: Meta['subscription']) => meta?.nodeId && run('sub', () => ghSettings('setPullSubscription', { ...base, nodeId: meta.nodeId, state }), 'alterar_notificacoes_pr', { state }).then(() => setPopup(null));

  return (
    <>
      {section('reviewers', 'Revisores', reviewersBody, reviewersPopup, 'Solicitar review de')}
      {section('assignees', 'Responsáveis', assigneesBody, assigneesPopup, 'Atribuir a até 10 pessoas')}
      {section('labels', 'Labels', labelsBody, labelsPopup)}
      {section('projects', 'Projetos', projectsBody, projectsPopup)}
      {section('milestone', 'Milestone', milestoneBody, milestonePopup)}
      {section('development', 'Desenvolvimento', developmentBody, developmentPopup, 'Vincular issue que este PR resolve')}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12, borderBottom: `1px solid ${c.line}`, position: 'relative' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ flex: 1, color: c.sub, fontSize: 11.5 }}>Notificações</span>
          <span ref={(el) => { anchors.current.notify = el; }} onClick={() => setPopup(popup === 'notify' ? null : 'notify')} style={{ color: c.sub, fontSize: 11.5, cursor: 'pointer', transition: 'color 150ms ease' }} onMouseEnter={(e) => (e.currentTarget.style.color = c.text)} onMouseLeave={(e) => (e.currentTarget.style.color = c.sub)}>
            Personalizar
          </span>
        </div>
        <button
          type="button"
          className="df-pressable"
          disabled={!meta || busy !== null}
          onClick={() => setSub(sub === 'SUBSCRIBED' ? 'UNSUBSCRIBED' : 'SUBSCRIBED')}
          style={{ height: 30, border: 'none', borderRadius: 6, background: fieldBg, color: c.text, fontSize: 12, fontWeight: 400, cursor: meta && busy === null ? 'pointer' : 'default', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, opacity: meta ? 1 : 0.6, transition: 'background-color 150ms ease' }}
        >
          {busy === 'sub' ? <Loader2 size={13} className="spin-animate" color={accentColor} /> : sub === 'SUBSCRIBED' ? <BellOff size={13} /> : <Bell size={13} />}
          {sub === 'SUBSCRIBED' ? 'Cancelar inscrição' : 'Inscrever-se'}
        </button>
        <span style={{ color: c.sub, fontSize: 11.5 }}>
          {sub === 'SUBSCRIBED' ? 'Você está recebendo notificações desta conversa.' : sub === 'IGNORED' ? 'Você está ignorando esta conversa.' : 'Você só recebe notificações se participar ou for mencionado.'}
        </span>
        <PopupPortal anchor={anchors.current.notify ?? null} open={popup === 'notify'} onClose={() => setPopup(null)} width={260} align="right" isDark={isEffectiveDark}>
          {([['UNSUBSCRIBED', 'Participando e @menções', 'Só quando você participar ou for mencionado.'], ['SUBSCRIBED', 'Toda a atividade', 'Notifica sobre tudo nesta conversa.'], ['IGNORED', 'Ignorar', 'Nunca notifica sobre esta conversa.']] as const).map(([st, label, desc]) =>
            option(st, sub === st, () => setSub(st), <span />, label, desc),
          )}
        </PopupPortal>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 12, borderBottom: `1px solid ${c.line}` }}>
        <span style={{ color: c.sub, fontSize: 11.5 }}>
          {participants.length} {participants.length === 1 ? 'participante' : 'participantes'}
        </span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{participants.map(([login, avatar]) => img(login, avatar, 22))}</div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        <button
          type="button"
          className="df-pressable"
          disabled={!meta || busy !== null}
          onClick={() => run('lock', () => ghSettings('setPullLock', { ...base, locked: !meta?.locked }), meta?.locked ? 'desbloquear_conversa_pr' : 'bloquear_conversa_pr')}
          style={{ display: 'flex', alignItems: 'center', gap: 8, height: 28, padding: '0 6px', border: 'none', borderRadius: 6, background: 'transparent', color: c.text, fontSize: 12, fontWeight: 400, cursor: 'pointer', transition: 'background-color 150ms ease' }}
          onMouseEnter={(e) => (e.currentTarget.style.background = c.hover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
        >
          {busy === 'lock' ? <Loader2 size={13} className="spin-animate" color={accentColor} /> : meta?.locked ? <Unlock size={13} /> : <Lock size={13} />}
          {meta?.locked ? 'Desbloquear conversa' : 'Bloquear conversa'}
        </button>
      </div>
    </>
  );
};

