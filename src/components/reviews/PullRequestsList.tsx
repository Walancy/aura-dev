import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, ArrowDownToLine, ArrowRight, Check, CheckCircle2, ChevronDown, CircleDashed, GitMerge, XCircle, GitPullRequest, GitPullRequestClosed, GitPullRequestDraft, Loader2, MessageSquare, RefreshCw, Search, SlidersHorizontal, Sparkles, X } from 'lucide-react';
import { relativeTime } from '../team/teamTypes';
import { getCachedPulls, refreshPulls, subscribePulls, type PullListData } from './pullListStore';
import { getFieldTokens } from '../../utils/fieldTokens';
import { hexToRgba } from '../../utils/color';
import type { PullReviewTarget } from './PullRequestDetail';
import type { TeamAiProvider } from '../team/TeamAiPanel';
import { renderAiIcon } from '../icons/AiProviderIcons';
import { BulkReviewModal, type BulkMode } from './BulkReviewModal';

export interface PullListItem {
  number: number;
  title: string;
  state: 'open' | 'draft' | 'merged' | 'closed';
  author?: string;
  authorAvatar?: string;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  closedAt?: string;
  reviewDecision: 'APPROVED' | 'CHANGES_REQUESTED' | 'REVIEW_REQUIRED' | null;
  labels: Array<{ name: string; color: string }>;
  assignees: Array<{ login: string; avatar?: string }>;
  reviewers: Array<{ login: string; avatar?: string }>;
  comments: number;
  commits: number;
  base?: string;
  head?: string;
  mergeState?: 'BEHIND' | 'BLOCKED' | 'CLEAN' | 'DIRTY' | 'DRAFT' | 'HAS_HOOKS' | 'UNKNOWN' | 'UNSTABLE' | null;
  conflicting?: boolean;
  checks?: 'SUCCESS' | 'FAILURE' | 'ERROR' | 'PENDING' | 'EXPECTED' | null;
  additions?: number;
  deletions?: number;
  files?: number;
}

interface Props {
  isActive: boolean;
  repoFullName?: string;
  selected: PullReviewTarget | null;
  onSelect: (target: PullReviewTarget | null) => void;
  isEffectiveDark: boolean;
  accentColor: string;
  accentContrastText: string;
  /** fundo do painel (o mesmo dos outros painéis laterais) */
  background?: string;
  /** IA usada na revisão em massa */
  aiProvider?: TeamAiProvider;
}

const STATE_ICON = {
  open: { Icon: GitPullRequest, color: '#3fb950' },
  draft: { Icon: GitPullRequestDraft, color: '#8b949e' },
  merged: { Icon: GitMerge, color: '#a371f7' },
  closed: { Icon: GitPullRequestClosed, color: '#f85149' },
} as const;

const DECISION_LABEL: Record<string, { label: string; color: string }> = {
  APPROVED: { label: 'Aprovado', color: '#3fb950' },
  CHANGES_REQUESTED: { label: 'Alterações solicitadas', color: '#f85149' },
  REVIEW_REQUIRED: { label: 'Review pendente', color: '#d29922' },
};

// Painel lateral de pull requests e reviews do repositório do projeto; o detalhe do selecionado abre na área central
export const PullRequestsList: React.FC<Props> = ({ isActive, repoFullName = '', selected, onSelect, isEffectiveDark, accentColor, accentContrastText, background, aiProvider }) => {
  const [owner, repo] = repoFullName.split('/');
  const [data, setData] = useState<PullListData | null>(() => getCachedPulls(repoFullName)?.data ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState<'open' | 'closed'>('open');
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [query, setQuery] = useState('');
  const [author, setAuthor] = useState('all');
  const [review, setReview] = useState('all');
  const [order, setOrder] = useState<'newest' | 'oldest'>('newest');
  const [filterOpen, setFilterOpen] = useState(false);
  const filterRef = useRef<HTMLDivElement>(null);
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const [bulk, setBulk] = useState<BulkMode | null>(null);

  const ft = getFieldTokens(isEffectiveDark);
  const c = useMemo(
    () => ({
      bg: isEffectiveDark ? '#101010' : '#ffffff',
      card: isEffectiveDark ? '#181818' : '#f5f5f5',
      text: isEffectiveDark ? '#ffffff' : '#111111',
      sub: isEffectiveDark ? '#8c8c8c' : '#666666',
      muted: isEffectiveDark ? '#666666' : '#999999',
      line: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)',
      hover: isEffectiveDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
    }),
    [isEffectiveDark],
  );

  useEffect(() => {
    if (!filterOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      if (filterRef.current && !filterRef.current.contains(e.target as Node)) {
        setFilterOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setFilterOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [filterOpen]);

  // Mostra na hora o que já foi carregado; busca de novo em segundo plano e só troca a lista se houver diferença.
  // O spinner só aparece quando não há nada em cache ou quando o usuário clica em atualizar.
  const repoRef = useRef(repoFullName);
  repoRef.current = repoFullName;
  const load = useCallback(
    async (manual = false) => {
      if (!owner || !repo) return;
      const hasCache = Boolean(getCachedPulls(repoFullName));
      if (manual || !hasCache) setLoading(true);
      setError(null);
      try {
        const fresh = await refreshPulls(repoFullName);
        if (repoRef.current === repoFullName) setData(fresh);
      } catch (e: any) {
        if (repoRef.current === repoFullName && (!hasCache || manual)) setError(e.message);
      } finally {
        if (repoRef.current === repoFullName) setLoading(false);
      }
    },
    [owner, repo, repoFullName],
  );

  // outro projeto: parte do cache dele (se houver); a tela só atualiza quando está visível
  useEffect(() => {
    setData(getCachedPulls(repoFullName)?.data ?? null);
    setError(null);
    setLoading(false);
    setExpanded(new Set());
    setChecked(new Set());
    setTab('open');
    setQuery('');
    setAuthor('all');
    setReview('all');
  }, [repoFullName]);
  useEffect(() => subscribePulls(() => setData(getCachedPulls(repoFullName)?.data ?? null)), [repoFullName]);
  useEffect(() => {
    if (!isActive) return;
    const cached = getCachedPulls(repoFullName);
    if (!cached || Date.now() - cached.at > 20000) load();
    const t = setInterval(() => !document.hidden && load(), 60000);
    return () => clearInterval(t);
  }, [isActive, load, repoFullName]);

  const authors = useMemo(() => Array.from(new Set((data?.items || []).map((i) => i.author).filter(Boolean) as string[])), [data]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase().replace('#', '');
    const me = (data?.me || '').toLowerCase();
    const out = (data?.items || [])
      .filter((i) => (tab === 'open' ? i.state === 'open' || i.state === 'draft' : i.state === 'merged' || i.state === 'closed'))
      .filter((i) => !q || String(i.number).includes(q) || i.title.toLowerCase().includes(q) || i.labels.some((l) => l.name.toLowerCase().includes(q)))
      .filter((i) => author === 'all' || i.author === author)
      .filter((i) => {
        if (review === 'all') return true;
        if (review === 'mine') return i.reviewers.some((r) => r.login.toLowerCase() === me) && i.author?.toLowerCase() !== me;
        if (review === 'none') return !i.reviewDecision;
        return i.reviewDecision === review;
      });
    out.sort((a, b) => (order === 'newest' ? 1 : -1) * (new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
    return out;
  }, [data, tab, query, author, review, order]);

  // só PRs abertos entram na seleção; o que sumiu da lista (filtro, merge) sai dela
  const selectable = useMemo(() => (tab === 'open' ? list.map((i) => i.number) : []), [list, tab]);
  const picked = useMemo(() => (data?.items || []).filter((i) => checked.has(i.number) && (i.state === 'open' || i.state === 'draft')), [data, checked]);
  const allChecked = selectable.length > 0 && selectable.every((n) => checked.has(n));
  const toggleChecked = (n: number) => setChecked((cur) => { const x = new Set(cur); if (!x.delete(n)) x.add(n); return x; });
  const box = (on: boolean, title: string, onClick: () => void) => (
    <button type="button" title={title} aria-label={title} aria-checked={on} role="checkbox" className="df-pressable" onClick={(e) => { e.stopPropagation(); onClick(); }} style={{ width: 16, height: 16, flexShrink: 0, padding: 0, border: 'none', borderRadius: 4, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: on ? accentColor : ft.fieldBg, color: accentContrastText, transition: 'background-color 150ms ease, transform 140ms var(--ease-out)' }}>
      {on && <Check size={11} />}
    </button>
  );

  const activeFiltersCount = (author !== 'all' ? 1 : 0) + (review !== 'all' ? 1 : 0) + (order !== 'newest' ? 1 : 0);

  const reviewOptions: Array<{ value: string; label: string }> = [
    { value: 'all', label: 'Todos' },
    { value: 'mine', label: 'Aguardando minha review' },
    { value: 'REVIEW_REQUIRED', label: 'Review pendente' },
    { value: 'APPROVED', label: 'Aprovados' },
    { value: 'CHANGES_REQUESTED', label: 'Alterações solicitadas' },
    { value: 'none', label: 'Sem review' },
  ];

  const tabBtn = (
    id: 'open' | 'closed',
    tooltip: string,
    IconComp: React.ComponentType<{ size?: number; color?: string }>,
    activeIconColor: string,
    count?: number,
  ) => {
    const active = tab === id;
    return (
      <button
        key={id}
        type="button"
        title={tooltip}
        aria-label={tooltip}
        onClick={() => setTab(id)}
        className="df-pressable"
        style={{
          height: 28,
          padding: '0 10px',
          border: 'none',
          boxShadow: 'none',
          borderRadius: 6,
          display: 'inline-flex',
          alignItems: 'center',
          gap: 6,
          fontSize: 11.5,
          fontWeight: 400,
          cursor: 'pointer',
          background: active ? ft.fieldBg : 'transparent',
          color: active ? c.text : c.sub,
          transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
        }}
      >
        <IconComp size={14} color={active ? activeIconColor : c.sub} />
        {count !== undefined && (
          <span
            style={{
              fontSize: 10.5,
              fontWeight: 400,
              color: active ? accentContrastText : c.sub,
              background: active ? accentColor : c.card,
              borderRadius: 10,
              padding: '0 6px',
              lineHeight: '16px',
              transition: 'background-color 150ms ease, color 150ms ease',
            }}
          >
            {count}
          </span>
        )}
      </button>
    );
  };

  const avatar = (u: { login: string; avatar?: string }, size = 18) => (
    <img key={u.login} src={u.avatar || `https://github.com/${u.login}.png?size=40`} alt={u.login} title={u.login} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', marginLeft: -4, transition: 'transform 150ms var(--ease-out)' }} onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.2)')} onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')} />
  );

  return (
    <div className="df-view-enter" style={{ flex: 1, minWidth: 0, minHeight: 0, width: '100%', background: background || c.bg, borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 8, flexShrink: 0 }}>
          {/* Linha superior: ícones de Abertos / Fechados à esquerda e ação de atualizar à direita */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            {tabBtn('open', 'Pull requests abertos', GitPullRequest, '#3fb950', data?.openCount)}
            {tabBtn('closed', 'Pull requests fechados', GitPullRequestClosed, '#a371f7', data?.closedCount)}
            <span style={{ flex: 1 }} />
            <button
              type="button"
              title="Atualizar pull requests"
              onClick={() => load(true)}
              className="df-pressable"
              style={{
                width: 28,
                height: 28,
                flexShrink: 0,
                border: 'none',
                boxShadow: 'none',
                borderRadius: 6,
                background: ft.fieldBg,
                color: c.sub,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
              }}
            >
              <RefreshCw size={13} className={loading ? 'spin-animate' : ''} color={loading ? accentColor : undefined} />
            </button>
          </div>

          {/* Linha inferior: campo de busca ocupando a largura + botão que abre popup com os filtros */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
            <div
              className="df-search-box"
              style={{
                flex: 1,
                minWidth: 0,
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                height: 28,
                padding: '0 8px',
                borderRadius: 6,
                border: 'none',
                boxShadow: 'none',
                background: ft.fieldBg,
                boxSizing: 'border-box',
              }}
            >
              <Search size={13} color={c.sub} style={{ flexShrink: 0 }} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar pull request..."
                style={{
                  flex: 1,
                  minWidth: 0,
                  height: '100%',
                  border: 'none',
                  outline: 'none',
                  background: 'transparent',
                  color: c.text,
                  fontSize: 11.5,
                  fontWeight: 400,
                  fontFamily: 'inherit',
                }}
              />
              {query && (
                <button
                  type="button"
                  title="Limpar busca"
                  onClick={() => setQuery('')}
                  className="df-pressable"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    color: c.sub,
                    cursor: 'pointer',
                    padding: 2,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <X size={12} />
                </button>
              )}
            </div>

            <div ref={filterRef} style={{ position: 'relative', flexShrink: 0 }}>
              <button
                type="button"
                title="Filtros"
                onClick={() => setFilterOpen((v) => !v)}
                className="df-dropdown-trigger df-pressable"
                style={{
                  position: 'relative',
                  width: 28,
                  height: 28,
                  border: 'none',
                  boxShadow: 'none',
                  borderRadius: 6,
                  background: filterOpen || activeFiltersCount > 0 ? hexToRgba(accentColor, 0.16) : ft.fieldBg,
                  color: filterOpen || activeFiltersCount > 0 ? accentColor : c.sub,
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  transition: 'transform 140ms var(--ease-out), background-color 150ms ease, color 150ms ease',
                }}
              >
                <SlidersHorizontal size={13} />
                {activeFiltersCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      minWidth: 14,
                      height: 14,
                      padding: '0 3px',
                      borderRadius: 999,
                      background: accentColor,
                      color: accentContrastText,
                      fontSize: 9,
                      fontWeight: 400,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      lineHeight: 1,
                      pointerEvents: 'none',
                    }}
                  >
                    {activeFiltersCount}
                  </span>
                )}
              </button>

              {filterOpen && (
                <div
                  className="df-dropdown-menu df-popover-right"
                  style={{
                    position: 'absolute',
                    top: 34,
                    right: 0,
                    zIndex: 60,
                    width: 216,
                    maxWidth: 'calc(100vw - 24px)',
                    padding: 8,
                    borderRadius: 8,
                    border: 'none',
                    boxShadow: 'none',
                    background: ft.dropdownMenuBg,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    boxSizing: 'border-box',
                  }}
                >
                  {/* Ordenação */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <span style={{ fontSize: 10, fontWeight: 400, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4, padding: '0 4px' }}>
                      Ordenação
                    </span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {([
                        { value: 'newest', label: 'Recentes' },
                        { value: 'oldest', label: 'Antigos' },
                      ] as const).map((opt) => {
                        const active = order === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setOrder(opt.value)}
                            className="df-pressable"
                            style={{
                              flex: 1,
                              height: 28,
                              border: 'none',
                              boxShadow: 'none',
                              borderRadius: 6,
                              background: active ? hexToRgba(accentColor, 0.16) : ft.fieldBg,
                              color: active ? accentColor : c.sub,
                              fontSize: 11,
                              fontWeight: 400,
                              cursor: 'pointer',
                              transition: 'background-color 150ms ease, color 150ms ease',
                            }}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div style={{ height: 1, background: c.line }} />

                  {/* Status de Review */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 400, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4, padding: '0 4px' }}>
                      Reviews
                    </span>
                    {reviewOptions.map((opt) => {
                      const active = review === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setReview(opt.value)}
                          style={{
                            height: 28,
                            padding: '0 8px',
                            border: 'none',
                            boxShadow: 'none',
                            borderRadius: 6,
                            background: active ? hexToRgba(accentColor, 0.14) : 'transparent',
                            color: active ? accentColor : c.text,
                            fontSize: 11.5,
                            fontWeight: 400,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 6,
                            textAlign: 'left',
                            transition: 'background-color 140ms ease, color 140ms ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!active) e.currentTarget.style.background = c.hover;
                          }}
                          onMouseLeave={(e) => {
                            if (!active) e.currentTarget.style.background = 'transparent';
                          }}
                        >
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                          {active && <Check size={12} color={accentColor} style={{ flexShrink: 0 }} />}
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ height: 1, background: c.line }} />

                  {/* Autor */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    <span style={{ fontSize: 10, fontWeight: 400, color: c.muted, textTransform: 'uppercase', letterSpacing: 0.4, padding: '0 4px' }}>
                      Autor
                    </span>
                    <div className="no-scrollbar" style={{ maxHeight: 132, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {[{ value: 'all', label: 'Todos os autores' }, ...authors.map((a) => ({ value: a, label: a }))].map((opt) => {
                        const active = author === opt.value;
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setAuthor(opt.value)}
                            style={{
                              height: 28,
                              padding: '0 8px',
                              border: 'none',
                              boxShadow: 'none',
                              borderRadius: 6,
                              background: active ? hexToRgba(accentColor, 0.14) : 'transparent',
                              color: active ? accentColor : c.text,
                              fontSize: 11.5,
                              fontWeight: 400,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: 6,
                              textAlign: 'left',
                              flexShrink: 0,
                              transition: 'background-color 140ms ease, color 140ms ease',
                            }}
                            onMouseEnter={(e) => {
                              if (!active) e.currentTarget.style.background = c.hover;
                            }}
                            onMouseLeave={(e) => {
                              if (!active) e.currentTarget.style.background = 'transparent';
                            }}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{opt.label}</span>
                            {active && <Check size={12} color={accentColor} style={{ flexShrink: 0 }} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {activeFiltersCount > 0 && (
                    <>
                      <div style={{ height: 1, background: c.line }} />
                      <button
                        type="button"
                        onClick={() => {
                          setAuthor('all');
                          setReview('all');
                          setOrder('newest');
                        }}
                        className="df-pressable"
                        style={{
                          height: 28,
                          border: 'none',
                          boxShadow: 'none',
                          borderRadius: 6,
                          background: hexToRgba(accentColor, 0.12),
                          color: accentColor,
                          fontSize: 11.5,
                          fontWeight: 400,
                          cursor: 'pointer',
                          transition: 'background-color 150ms ease',
                        }}
                      >
                        Limpar filtros
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        <div style={{ height: 1, background: c.line, flexShrink: 0 }} />
        {tab === 'open' && selectable.length > 0 && (
          <div onClick={() => setChecked(allChecked ? new Set() : new Set(selectable))} title="Selecionar todos os pull requests da lista para ações em massa" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '6px 14px', fontSize: 11.5, color: c.sub, cursor: 'pointer', borderBottom: `1px solid ${c.line}` }}>
            {box(allChecked, allChecked ? 'Desmarcar todos' : 'Selecionar todos', () => setChecked(allChecked ? new Set() : new Set(selectable)))}
            <span style={{ flex: 1 }}>{allChecked ? 'Desmarcar todos' : 'Selecionar todos'}</span>
            <span>{selectable.length}</span>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden', overscrollBehavior: 'contain' }}>
          {!owner || !repo ? (
            <div style={{ padding: 20, fontSize: 12, fontWeight: 400, color: c.sub }}>Selecione um projeto vinculado a um repositório do GitHub para ver os pull requests.</div>
          ) : error ? (
            <div style={{ padding: 20, fontSize: 12, fontWeight: 400, color: '#f85149', wordBreak: 'break-word' }}>{error}</div>
          ) : !data ? (
            <div style={{ padding: 20, fontSize: 12, fontWeight: 400, color: c.sub, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Loader2 size={14} className="spin-animate" color={accentColor} /> Carregando pull requests…
            </div>
          ) : list.length === 0 ? (
            <div className="df-subtle-enter" style={{ padding: 28, fontSize: 12, fontWeight: 400, color: c.sub, textAlign: 'center' }}>Nenhum pull request encontrado.</div>
          ) : (
            list.map((pr, idx) => {
              const { Icon, color } = STATE_ICON[pr.state];
              const isOpen = pr.state === 'open' || pr.state === 'draft';
              const isSel = selected?.number === pr.number && selected.repo === repoFullName;
              const isExp = expanded.has(pr.number);
              const when = pr.state === 'merged' ? `mergeado ${relativeTime(pr.mergedAt)}` : pr.state === 'closed' ? `fechado ${relativeTime(pr.closedAt)}` : `aberto ${relativeTime(pr.createdAt)}`;

              // Problemas e estado do PR, do mais grave para o mais leve
              type Chip = { key: string; label: string; color: string; Ic: React.ElementType; spin?: boolean; title: string };
              const chips: Chip[] = [];
              if (isOpen) {
                if (pr.state === 'draft') chips.push({ key: 'draft', label: 'Rascunho', color: '#8b949e', Ic: GitPullRequestDraft, title: 'Rascunhos não podem ser mergeados' });
                if (pr.conflicting || pr.mergeState === 'DIRTY') chips.push({ key: 'conf', label: 'Conflitos', color: '#f85149', Ic: AlertTriangle, title: 'A branch tem conflitos com a base' });
                else if (pr.mergeState === 'BEHIND') chips.push({ key: 'behind', label: 'Branch desatualizada', color: '#d29922', Ic: ArrowDownToLine, title: 'A branch está atrás da base' });
                if (pr.reviewDecision === 'CHANGES_REQUESTED') chips.push({ key: 'rev', label: 'Alterações solicitadas', color: '#f85149', Ic: XCircle, title: 'Alguém pediu alterações' });
                else if (pr.reviewDecision === 'REVIEW_REQUIRED') chips.push({ key: 'rev', label: 'Review pendente', color: '#d29922', Ic: CircleDashed, title: 'É exigida ao menos uma aprovação' });
                else if (pr.reviewDecision === 'APPROVED') chips.push({ key: 'rev', label: 'Aprovado', color: '#3fb950', Ic: CheckCircle2, title: 'Aprovado pelos revisores' });
                if (pr.checks === 'FAILURE' || pr.checks === 'ERROR') chips.push({ key: 'chk', label: 'Checks falhando', color: '#f85149', Ic: XCircle, title: 'Há checks com falha no último commit' });
                else if (pr.checks === 'PENDING' || pr.checks === 'EXPECTED') chips.push({ key: 'chk', label: 'Checks em andamento', color: '#d29922', Ic: Loader2, spin: true, title: 'Há checks ainda rodando ou esperados' });
                else if (pr.checks === 'SUCCESS') chips.push({ key: 'chk', label: 'Checks ok', color: '#3fb950', Ic: Check, title: 'Todos os checks passaram' });
                if (pr.mergeState === 'CLEAN' && pr.state === 'open' && pr.reviewDecision !== 'CHANGES_REQUESTED') chips.push({ key: 'ready', label: 'Pronto para merge', color: '#3fb950', Ic: GitMerge, title: 'Sem requisitos pendentes' });
                else if (pr.mergeState === 'BLOCKED' && !chips.some((x) => ['rev', 'conf'].includes(x.key))) chips.push({ key: 'blocked', label: 'Bloqueado pelas regras', color: '#f85149', Ic: AlertTriangle, title: 'As regras do branch ainda não foram atendidas' });
              }
              const problems = chips.filter((x) => x.color === '#f85149' || x.color === '#d29922').length;

              return (
                <div
                  key={pr.number}
                  className="df-stagger-item"
                  onClick={() => onSelect({ repo: repoFullName, number: pr.number })}
                  style={{ ['--stagger-idx' as any]: Math.min(idx, 12), display: 'flex', flexDirection: 'column', gap: 8, margin: '4px 6px', padding: 12, borderRadius: 10, cursor: 'pointer', background: isSel ? hexToRgba(accentColor, 0.14) : c.card, transition: 'background-color 150ms ease, transform 150ms var(--ease-out)' }}
                  onMouseEnter={(e) => { if (!isSel) e.currentTarget.style.background = c.hover; }}
                  onMouseLeave={(e) => (e.currentTarget.style.background = isSel ? hexToRgba(accentColor, 0.14) : c.card)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    {isOpen && box(checked.has(pr.number), checked.has(pr.number) ? 'Desmarcar' : 'Selecionar para ações em massa', () => toggleChecked(pr.number))}
                    <Icon size={16} color={color} style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 400, color: c.text, lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: isExp ? 4 : 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', wordBreak: 'break-word' }}>{pr.title}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 11, fontWeight: 400, color: c.sub }}>
                        <span style={{ color: c.muted, fontFamily: 'JetBrains Mono, ui-monospace, monospace' }}>#{pr.number}</span>
                        <img src={pr.authorAvatar || `https://github.com/${pr.author}.png?size=40`} alt="" style={{ width: 14, height: 14, borderRadius: '50%' }} />
                        <span>{pr.author}</span>
                        <span>· {when}</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {isOpen && problems > 0 ? (
                        <span title={`${problems} ponto${problems > 1 ? 's' : ''} de atenção`} style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: hexToRgba('#f85149', 0.18), color: '#f85149', fontSize: 11, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{problems}</span>
                      ) : null}
                      <button
                        type="button"
                        className="df-pressable"
                        title={isExp ? 'Ocultar detalhes' : 'Mostrar detalhes'}
                        onClick={(e) => {
                          e.stopPropagation();
                          setExpanded((cur) => {
                            const n = new Set(cur);
                            if (!n.delete(pr.number)) n.add(pr.number);
                            return n;
                          });
                        }}
                        style={{ width: 22, height: 22, border: 'none', borderRadius: 6, background: 'transparent', color: c.sub, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', transition: 'background-color 150ms ease, color 150ms ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = c.hover; e.currentTarget.style.color = c.text; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = c.sub; }}
                      >
                        <ChevronDown size={15} style={{ transition: 'transform 220ms var(--ease-out)', transform: isExp ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                      </button>
                    </div>
                  </div>

                  {/* Detalhes: só aparecem quando o card está expandido, separados por linha divisória */}
                  <div style={{ display: 'grid', gridTemplateRows: isExp ? '1fr' : '0fr', transition: 'grid-template-rows 220ms var(--ease-out)' }}>
                    <div style={{ overflow: 'hidden', minHeight: 0 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, paddingTop: 10, borderTop: `1px solid ${c.line}`, opacity: isExp ? 1 : 0, transition: 'opacity 200ms ease' }}>
                        {pr.head && pr.base && (
                          <span title={`${pr.head} → ${pr.base}`} style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 4, maxWidth: '100%', padding: '2px 7px', borderRadius: 5, background: c.line, fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontSize: 10.5, color: c.sub }}>
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pr.head}</span>
                            <ArrowRight size={9} style={{ flexShrink: 0 }} />
                            <span style={{ flexShrink: 0 }}>{pr.base}</span>
                          </span>
                        )}
                        {chips.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {chips.map((ch) => (
                              <span key={ch.key} title={ch.title} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, height: 22, padding: '0 8px', borderRadius: 11, background: hexToRgba(ch.color, 0.14), color: ch.color, fontSize: 11, fontWeight: 400, whiteSpace: 'nowrap' }}>
                                <ch.Ic size={12} className={ch.spin ? 'spin-animate' : undefined} />
                                {ch.label}
                              </span>
                            ))}
                          </div>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, fontWeight: 400, color: c.sub, flexWrap: 'wrap', paddingTop: 10, borderTop: `1px solid ${c.line}` }}>
                          {(pr.additions || pr.deletions) ? (
                            <span style={{ fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontVariantNumeric: 'tabular-nums' }}>
                              <span style={{ color: '#3fb950' }}>+{pr.additions}</span> <span style={{ color: '#f85149' }}>-{pr.deletions}</span>
                            </span>
                          ) : null}
                          {pr.files ? <span>{pr.files} arquivo{pr.files > 1 ? 's' : ''}</span> : null}
                          {pr.commits ? <span>{pr.commits} commit{pr.commits > 1 ? 's' : ''}</span> : null}
                          <span style={{ flex: 1 }} />
                          {pr.labels.slice(0, 2).map((l) => (
                            <span key={l.name} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 10, background: hexToRgba(`#${l.color}`, 0.2), color: `#${l.color}` }}>{l.name}</span>
                          ))}
                          {pr.reviewers.length > 0 && <span title={`Revisores solicitados: ${pr.reviewers.map((u) => u.login).join(', ')}`} style={{ display: 'inline-flex', alignItems: 'center', paddingLeft: 4 }}>{pr.reviewers.slice(0, 3).map((u) => avatar(u))}</span>}
                          {pr.comments > 0 && (
                            <span title="Comentários" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <MessageSquare size={12} /> {pr.comments}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
        {picked.length > 0 && (
          <div className="df-subtle-enter" style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6, padding: 8, borderTop: `1px solid ${c.line}` }}>
            <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: c.text, whiteSpace: 'nowrap' }}><span title={`${picked.length} selecionado${picked.length > 1 ? 's' : ''}`}>{picked.length}</span></span>
            {([
              { mode: 'APPROVE', label: 'Aprovar', tip: 'Aprovar todos os selecionados', color: '#3fb950', Ic: CheckCircle2 },
              { mode: 'REQUEST_CHANGES', label: 'Alterar', tip: 'Solicitar alterações em todos os selecionados', color: '#f85149', Ic: XCircle },
              { mode: 'AI', label: 'IA', tip: 'A IA revisa cada pull request selecionado e decide entre aprovar ou solicitar alterações', color: accentColor, Ic: Sparkles },
            ] as const).map((a) => (
              <button key={a.mode} type="button" title={a.tip} disabled={a.mode === 'AI' && !aiProvider} onClick={() => setBulk(a.mode)} className="df-pressable" style={{ height: 28, padding: '0 10px', border: 'none', borderRadius: 6, display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, cursor: 'pointer', background: hexToRgba(a.color, 0.16), color: a.color, transition: 'transform 140ms var(--ease-out), background-color 150ms ease' }}>
                {a.mode === 'AI' && aiProvider ? renderAiIcon(aiProvider.id, 16) : <a.Ic size={13} />}
                {a.mode === 'AI' && aiProvider ? aiProvider.name : a.label}
              </button>
            ))}
            <button type="button" title="Limpar seleção" onClick={() => setChecked(new Set())} className="df-pressable" style={{ width: 28, height: 28, border: 'none', borderRadius: 6, background: ft.fieldBg, color: c.sub, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
              <X size={13} />
            </button>
          </div>
        )}
      </div>
      {bulk && aiProvider && (
        <BulkReviewModal
          mode={bulk}
          repo={repoFullName}
          prs={picked.map((p) => ({ number: p.number, title: p.title }))}
          provider={aiProvider}
          isDark={isEffectiveDark}
          accentColor={accentColor}
          accentContrastText={accentContrastText}
          onClose={() => setBulk(null)}
          onFinished={() => { setChecked(new Set()); load(true); }}
        />
      )}
    </div>
  );
};
