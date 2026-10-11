import React, { useState, useMemo } from 'react';
import { CircleDot, CheckCircle2, Plus, RefreshCw, X, ChevronDown, Check, ExternalLink, Search, Loader2 } from 'lucide-react';
import type { ThemeTokens, GitHubIssueItem } from '../../types/ide';
import { hexToRgba } from '../../utils/color';

export interface IssuesModalProps {
  isEffectiveDark: boolean;
  themeTokens: ThemeTokens;
  accentColor: string;
  onClose: () => void;
  gitIssues: GitHubIssueItem[];
  gitRepoName: string;
  isCreatingIssue: boolean;
  setIsCreatingIssue: (value: boolean) => void;
  isLoadingIssues: boolean;
  onRefresh: () => void;
  newIssueTitle: string;
  setNewIssueTitle: (value: string) => void;
  onCreateIssue: (title: string) => void;
  issuesSearchQuery: string;
  setIssuesSearchQuery: (value: string) => void;
  onLinkIssueToChat: (issue: GitHubIssueItem) => void;
  onOpenIssueInBrowser: (issueNumber: number) => void;
  /** clicar no cartão abre os detalhes da issue (com botão Voltar para esta lista) */
  onOpenIssueDetails?: (issueNumber: number) => void;
  /** IA selecionada no cabeçalho (usada por "resolver"), lista de IAs para trocar e o ícone de cada uma */
  aiProvider?: string;
  aiProviders?: Array<{ id: string; name: string }>;
  onChangeAiProvider?: (id: string) => void;
  renderAiIcon?: (providerId: string, size: number) => React.ReactNode;
}

/** Foto do usuário do GitHub (com a inicial como alternativa quando a imagem não carrega) */
const Avatar: React.FC<{ login: string; url?: string; size?: number; ring: string }> = ({ login, url, size = 18, ring }) => {
  const [failed, setFailed] = useState(false);
  const clean = login.replace('@', '').trim();
  return failed || !clean ? (
    <span title={`@${clean}`} style={{ width: size, height: size, borderRadius: '50%', background: '#3f3f46', color: '#e4e4e7', fontSize: size * 0.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', boxShadow: `0 0 0 2px ${ring}`, flexShrink: 0 }}>
      {(clean[0] || '?').toUpperCase()}
    </span>
  ) : (
    <img
      src={url || `https://github.com/${clean}.png?size=48`}
      alt={clean}
      title={`@${clean}`}
      onError={() => setFailed(true)}
      style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', boxShadow: `0 0 0 2px ${ring}`, flexShrink: 0 }}
    />
  );
};

const OPEN = '#22c55e';
const CLOSED = '#8b5cf6';

// Lista de issues do GitHub no mesmo padrão do painel de detalhes: painel lateral à direita, superfícies sem borda.
export const IssuesModal: React.FC<IssuesModalProps> = ({
  isEffectiveDark,
  themeTokens,
  accentColor,
  onClose,
  gitIssues,
  gitRepoName,
  isCreatingIssue,
  setIsCreatingIssue,
  isLoadingIssues,
  onRefresh,
  newIssueTitle,
  setNewIssueTitle,
  onCreateIssue,
  issuesSearchQuery,
  setIssuesSearchQuery,
  onLinkIssueToChat,
  onOpenIssueInBrowser,
  onOpenIssueDetails,
  aiProvider,
  aiProviders = [],
  onChangeAiProvider,
  renderAiIcon,
}) => {
  const [aiMenuFor, setAiMenuFor] = useState<number | null>(null);
  const [stateFilter, setStateFilter] = useState<'all' | 'open' | 'closed'>('all');

  // superfícies do padrão DevFlow (mesmas do painel de detalhes da issue)
  const sheetBg = isEffectiveDark ? '#101010' : '#ffffff';
  const cardBg = isEffectiveDark ? '#181818' : '#f8fafc';
  const cardHoverBg = isEffectiveDark ? '#1f1f1f' : '#f1f5f9';
  const controlBg = isEffectiveDark ? '#1e1e1e' : '#f1f5f9';
  const controlHoverBg = isEffectiveDark ? '#262626' : '#e2e8f0';
  const divider = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';

  const isClosedIssue = (i: GitHubIssueItem) => (i.state || 'open').toLowerCase() === 'closed';
  const openCount = useMemo(() => gitIssues.filter((i) => !isClosedIssue(i)).length, [gitIssues]);
  const closedCount = gitIssues.length - openCount;

  const filteredIssues = useMemo(() => {
    const q = issuesSearchQuery.trim().toLowerCase();
    return gitIssues.filter((issue) => {
      const closed = isClosedIssue(issue);
      if (stateFilter === 'open' && closed) return false;
      if (stateFilter === 'closed' && !closed) return false;
      if (!q) return true;
      const authorStr = typeof issue.author === 'string' ? issue.author : ((issue.author as any)?.login || '');
      return issue.title.toLowerCase().includes(q) || String(issue.number).includes(q) || authorStr.toLowerCase().includes(q);
    });
  }, [gitIssues, stateFilter, issuesSearchQuery]);

  const iconBtn: React.CSSProperties = {
    width: 32,
    height: 32,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: controlBg,
    border: 'none',
    borderRadius: 8,
    cursor: 'pointer',
    color: themeTokens.textSecondary,
    transition: 'background 0.12s ease, color 0.12s ease',
  };
  const hoverOn = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = controlHoverBg; e.currentTarget.style.color = themeTokens.textPrimary; };
  const hoverOff = (e: React.MouseEvent<HTMLElement>) => { e.currentTarget.style.background = controlBg; e.currentTarget.style.color = themeTokens.textSecondary; };

  const filters: Array<{ id: 'all' | 'open' | 'closed'; label: string; count: number; color?: string }> = [
    { id: 'all', label: 'Todas', count: gitIssues.length },
    { id: 'open', label: 'Abertas', count: openCount, color: OPEN },
    { id: 'closed', label: 'Fechadas', count: closedCount, color: CLOSED },
  ];

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99990,
        display: 'flex',
        justifyContent: 'flex-end',
        background: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(6px)',
        animation: 'sidesheetOverlayFadeIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 'clamp(520px, 46vw, 760px)',
          maxWidth: '92vw',
          height: '100%',
          background: sheetBg,
          borderRadius: '16px 0 0 16px',
          boxShadow: isEffectiveDark ? '-16px 0 48px rgba(0, 0, 0, 0.8)' : '-12px 0 36px rgba(0, 0, 0, 0.14)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'sidesheetPanelSlideIn 0.32s cubic-bezier(0.16, 1, 0.3, 1) forwards',
          willChange: 'transform',
        }}
      >
        {/* Cabeçalho */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 16,
            padding: '20px 20px 14px 24px',
            borderBottom: `1px solid ${divider}`,
            flexShrink: 0,
          }}
        >
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 20, fontWeight: 500, color: themeTokens.textPrimary }}>Issues do GitHub</span>
              <span style={{ background: hexToRgba(OPEN, 0.14), color: OPEN, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>
                {openCount} abertas
              </span>
              {closedCount > 0 && (
                <span style={{ background: hexToRgba(CLOSED, 0.16), color: CLOSED, fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 999 }}>
                  {closedCount} fechadas
                </span>
              )}
            </div>
            <span style={{ fontSize: 12, color: themeTokens.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {gitRepoName || 'Nenhum repositório selecionado'}
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => setIsCreatingIssue(!isCreatingIssue)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                height: 32,
                padding: '0 14px',
                background: isCreatingIssue ? controlBg : accentColor,
                color: isCreatingIssue ? themeTokens.textPrimary : '#ffffff',
                border: 'none',
                borderRadius: 8,
                fontSize: 12.5,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {isCreatingIssue ? <X size={14} /> : <Plus size={14} />}
              {isCreatingIssue ? 'Cancelar' : 'Nova issue'}
            </button>
            <button type="button" onClick={onRefresh} disabled={isLoadingIssues} title="Atualizar lista" style={{ ...iconBtn, cursor: isLoadingIssues ? 'default' : 'pointer' }} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
              <RefreshCw size={14} style={{ animation: isLoadingIssues ? 'spin 1s linear infinite' : 'none' }} />
            </button>
            <button type="button" onClick={onClose} title="Fechar" style={iconBtn} onMouseEnter={hoverOn} onMouseLeave={hoverOff}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Criação rápida */}
        {isCreatingIssue && (
          <div style={{ padding: '14px 24px', borderBottom: `1px solid ${divider}`, display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: themeTokens.textSecondary }}>Nova issue no GitHub</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                autoFocus
                placeholder="Título da issue (ex.: Corrigir erro no fluxo de login)"
                value={newIssueTitle}
                onChange={(e) => setNewIssueTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newIssueTitle.trim()) onCreateIssue(newIssueTitle);
                }}
                style={{ flex: 1, height: 36, background: controlBg, border: 'none', borderRadius: 8, padding: '0 12px', fontSize: 13, color: themeTokens.textPrimary, outline: 'none', fontFamily: 'inherit' }}
              />
              <button
                type="button"
                onClick={() => onCreateIssue(newIssueTitle)}
                disabled={!newIssueTitle.trim() || isLoadingIssues}
                style={{ height: 36, padding: '0 16px', background: OPEN, color: '#ffffff', border: 'none', borderRadius: 8, fontSize: 12.5, fontWeight: 500, cursor: newIssueTitle.trim() ? 'pointer' : 'not-allowed', opacity: newIssueTitle.trim() ? 1 : 0.5 }}
              >
                {isLoadingIssues ? 'Criando…' : 'Publicar'}
              </button>
            </div>
          </div>
        )}

        {/* Busca e filtros */}
        <div style={{ padding: '14px 24px 8px', display: 'flex', flexDirection: 'column', gap: 10, flexShrink: 0 }}>
          <div style={{ position: 'relative' }}>
            <Search size={14} color={themeTokens.textMuted} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }} />
            <input
              type="text"
              placeholder="Pesquisar por título, número ou autor"
              value={issuesSearchQuery}
              onChange={(e) => setIssuesSearchQuery(e.target.value)}
              style={{ width: '100%', boxSizing: 'border-box', height: 36, background: controlBg, border: 'none', borderRadius: 8, padding: '0 12px 0 34px', fontSize: 13, color: themeTokens.textPrimary, outline: 'none', fontFamily: 'inherit' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {filters.map((f) => {
              const active = stateFilter === f.id;
              const tone = f.color || themeTokens.textPrimary;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setStateFilter(f.id)}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    height: 28,
                    padding: '0 11px',
                    borderRadius: 7,
                    border: 'none',
                    background: active ? (f.color ? hexToRgba(f.color, 0.15) : controlBg) : 'transparent',
                    color: active ? tone : themeTokens.textSecondary,
                    fontSize: 12,
                    fontWeight: active ? 500 : 400,
                    cursor: 'pointer',
                    transition: 'background 0.12s ease, color 0.12s ease',
                  }}
                >
                  {f.id === 'open' && <CircleDot size={13} />}
                  {f.id === 'closed' && <CheckCircle2 size={13} />}
                  <span>{f.label}</span>
                  <span style={{ fontSize: 10.5, color: active ? tone : themeTokens.textMuted, opacity: 0.9 }}>{f.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 24px 24px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {isLoadingIssues && filteredIssues.length === 0 && (
            <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center', color: themeTokens.textSecondary }}>
              <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
            </div>
          )}
          {!isLoadingIssues && filteredIssues.length === 0 && (
            <div style={{ padding: '40px 20px', textAlign: 'center', color: themeTokens.textSecondary, fontSize: 13 }}>
              {issuesSearchQuery.trim()
                ? 'Nenhuma issue corresponde à busca.'
                : stateFilter === 'closed'
                ? 'Nenhuma issue fechada.'
                : stateFilter === 'open'
                ? 'Nenhuma issue aberta.'
                : 'Nenhuma issue neste repositório.'}
            </div>
          )}

          {filteredIssues.map((issue) => {
            const closed = isClosedIssue(issue);
            const tone = closed ? CLOSED : OPEN;
            const author = typeof issue.author === 'string' ? issue.author : ((issue.author as any)?.login || (issue.author as any)?.name || '');
            // responsáveis (assignees): só as fotos
            const assignees = [...(Array.isArray(issue.assignees) ? issue.assignees : []), ...(issue.assignee ? [issue.assignee] : [])]
              .map((a: any) => (typeof a === 'string' ? { login: a, url: undefined } : { login: a?.login || '', url: a?.avatarUrl }))
              .filter((a, i, arr) => a.login && arr.findIndex((b) => b.login === a.login) === i);
            return (
              <div
                key={issue.number}
                onClick={() => onOpenIssueDetails?.(issue.number)}
                style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '14px 16px', borderRadius: 10, background: cardBg, transition: 'background 0.12s ease', cursor: onOpenIssueDetails ? 'pointer' : 'default' }}
                onMouseEnter={(e) => (e.currentTarget.style.background = cardHoverBg)}
                onMouseLeave={(e) => (e.currentTarget.style.background = cardBg)}
              >
                {/* Linha 1: estado, título e abrir no GitHub */}
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <span style={{ marginTop: 2, display: 'flex', flexShrink: 0 }}>
                    {closed ? <CheckCircle2 size={16} color={tone} /> : <CircleDot size={16} color={tone} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0, fontSize: 14, lineHeight: 1.4, color: themeTokens.textPrimary, wordBreak: 'break-word' }}>
                    {issue.title}
                    <span style={{ marginLeft: 8, color: themeTokens.textMuted, fontSize: 12 }}>#{issue.number}</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onOpenIssueInBrowser(issue.number); }}
                    title="Abrir no GitHub"
                    style={{ ...iconBtn, width: 28, height: 28, background: 'transparent', flexShrink: 0 }}
                    onMouseEnter={hoverOn}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = themeTokens.textSecondary; }}
                  >
                    <ExternalLink size={13} />
                  </button>
                </div>

                {/* Linha 2: estado e etiquetas à esquerda; pessoas e ação à direita */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingLeft: 28, flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
                    <span style={{ fontSize: 11, fontWeight: 500, padding: '2px 9px', borderRadius: 999, background: hexToRgba(tone, 0.14), color: tone }}>
                      {closed ? 'Fechada' : 'Aberta'}
                    </span>
                    {(issue.labels || []).map((label, i) => {
                      const c = label.color ? `#${label.color}` : themeTokens.textSecondary;
                      return (
                        <span key={i} style={{ fontSize: 10.5, padding: '2px 8px', borderRadius: 999, background: label.color ? `${c}22` : controlBg, color: c, fontWeight: 500 }}>
                          {label.name}
                        </span>
                      );
                    })}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                    {author && (
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} title={`Criada por @${author.replace('@', '')}`}>
                        <span style={{ fontSize: 11.5, color: themeTokens.textMuted }}>por:</span>
                        <Avatar login={author} url={issue.authorAvatar} size={20} ring={cardBg} />
                        <span style={{ fontSize: 11.5, color: themeTokens.textSecondary }}>{author.replace('@', '')}</span>
                      </span>
                    )}
                    {assignees.length > 0 && (
                      <>
                        {author && <span style={{ width: 1, height: 14, background: divider }} />}
                        <span style={{ fontSize: 11.5, color: themeTokens.textMuted, marginRight: -4 }}>assignees:</span>
                        <span style={{ display: 'inline-flex', alignItems: 'center' }} title={`Responsáveis: ${assignees.map((a) => '@' + a.login).join(', ')}`}>
                          {assignees.slice(0, 5).map((a, i) => (
                            <span key={a.login} style={{ marginLeft: i === 0 ? 0 : -6, display: 'flex' }}>
                              <Avatar login={a.login} url={a.url} size={20} ring={cardBg} />
                            </span>
                          ))}
                        </span>
                      </>
                    )}
                    {/* Resolver com a IA selecionada no cabeçalho (só o logo) + troca de IA */}
                    <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }} onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => onLinkIssueToChat(issue)}
                        title={`Resolver com ${aiProviders.find((p) => p.id === aiProvider)?.name || 'a IA'}`}
                        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 28, height: 28, padding: 0, background: 'transparent', border: 'none', cursor: 'pointer', opacity: 0.9, transition: 'opacity 0.12s ease, transform 0.12s ease' }}
                        onMouseEnter={(e) => { e.currentTarget.style.opacity = '1'; e.currentTarget.style.transform = 'scale(1.1)'; }}
                        onMouseLeave={(e) => { e.currentTarget.style.opacity = '0.9'; e.currentTarget.style.transform = 'none'; }}
                      >
                        {renderAiIcon && aiProvider ? renderAiIcon(aiProvider, 20) : null}
                      </button>
                      {aiProviders.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setAiMenuFor((cur) => (cur === issue.number ? null : issue.number))}
                          title="Trocar a IA"
                          style={{ display: 'inline-flex', alignItems: 'center', padding: 2, marginLeft: -2, background: 'transparent', border: 'none', cursor: 'pointer', color: themeTokens.textMuted }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textMuted)}
                        >
                          <ChevronDown size={12} />
                        </button>
                      )}
                      {aiMenuFor === issue.number && (
                        <>
                          <div style={{ position: 'fixed', inset: 0, zIndex: 5 }} onClick={() => setAiMenuFor(null)} />
                          <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', minWidth: 170, background: isEffectiveDark ? '#1e1e1e' : '#ffffff', borderRadius: 10, boxShadow: '0 12px 32px rgba(0,0,0,0.55)', padding: 4, zIndex: 10, display: 'flex', flexDirection: 'column', gap: 1 }}>
                            {aiProviders.map((p) => (
                              <div
                                key={p.id}
                                onClick={() => { onChangeAiProvider?.(p.id); setAiMenuFor(null); }}
                                style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 7, fontSize: 12.5, color: themeTokens.textPrimary, cursor: 'pointer', background: p.id === aiProvider ? controlBg : 'transparent' }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = controlHoverBg)}
                                onMouseLeave={(e) => (e.currentTarget.style.background = p.id === aiProvider ? controlBg : 'transparent')}
                              >
                                <span style={{ display: 'flex', width: 18, justifyContent: 'center' }}>{renderAiIcon?.(p.id, 16)}</span>
                                <span style={{ flex: 1 }}>{p.name}</span>
                                {p.id === aiProvider && <Check size={13} color={accentColor} />}
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
