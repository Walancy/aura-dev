import React, { useState, useMemo } from 'react';
import { CircleDot, CheckCircle2, Plus, RefreshCw, X, Sparkles, ExternalLink } from 'lucide-react';
import type { ThemeTokens, GitHubIssueItem } from '../../types/ide';

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
}

// GitHub Issues modal (list, search, quick-create, link to AI chat).
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
}) => {
  const [stateFilter, setStateFilter] = useState<'all' | 'open' | 'closed'>('all');

  const openCount = useMemo(
    () => gitIssues.filter((i) => (i.state || 'open').toLowerCase() === 'open').length,
    [gitIssues]
  );
  const closedCount = useMemo(
    () => gitIssues.filter((i) => (i.state || 'open').toLowerCase() === 'closed').length,
    [gitIssues]
  );

  const filteredIssues = useMemo(() => {
    return gitIssues.filter((issue) => {
      const isClosed = (issue.state || '').toLowerCase() === 'closed';
      if (stateFilter === 'open' && isClosed) return false;
      if (stateFilter === 'closed' && !isClosed) return false;
      if (issuesSearchQuery.trim()) {
        const q = issuesSearchQuery.toLowerCase();
        const matchesTitle = issue.title.toLowerCase().includes(q);
        const matchesNum = String(issue.number).includes(q);
        const authorStr = typeof issue.author === 'string' ? issue.author : ((issue.author as any)?.login || '');
        const matchesAuthor = authorStr.toLowerCase().includes(q);
        return matchesTitle || matchesNum || matchesAuthor;
      }
      return true;
    });
  }, [gitIssues, stateFilter, issuesSearchQuery]);

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.55)',
        backdropFilter: 'blur(3px)',
        animation: 'fadeIn 0.12s ease-out',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: 720,
          maxWidth: '92vw',
          maxHeight: '84vh',
          background: isEffectiveDark ? '#141416' : '#ffffff',
          border: `1px solid ${themeTokens.border}`,
          borderRadius: 10,
          boxShadow: '0 24px 64px rgba(0, 0, 0, 0.85)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          animation: 'fadeIn 0.12s ease-out',
          fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '14px 18px',
            borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 8,
                background: 'rgba(34, 197, 94, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <CircleDot size={17} color="#22c55e" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: themeTokens.textPrimary }}>
                  Issues do GitHub
                </span>
                <span
                  style={{
                    background: 'rgba(34, 197, 94, 0.14)',
                    color: '#22c55e',
                    fontSize: 10.5,
                    fontWeight: 600,
                    padding: '2px 7px',
                    borderRadius: 999,
                  }}
                >
                  {openCount} abertas
                </span>
                {closedCount > 0 && (
                  <span
                    style={{
                      background: isEffectiveDark ? 'rgba(130, 80, 223, 0.16)' : '#f3e8ff',
                      color: '#8250df',
                      fontSize: 10.5,
                      fontWeight: 600,
                      padding: '2px 7px',
                      borderRadius: 999,
                    }}
                  >
                    {closedCount} fechadas
                  </span>
                )}
              </div>
              <div style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                {gitRepoName || 'Nenhum repositório selecionado'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <button
              onClick={() => setIsCreatingIssue(!isCreatingIssue)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                background: isCreatingIssue ? 'rgba(255, 255, 255, 0.12)' : accentColor,
                color: '#ffffff',
                border: 'none',
                borderRadius: 6,
                padding: '5px 11px',
                fontSize: 11.5,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <Plus size={13} />
              {isCreatingIssue ? 'Cancelar' : 'Nova Issue'}
            </button>

            <button
              onClick={onRefresh}
              disabled={isLoadingIssues}
              style={{
                background: 'none',
                border: 'none',
                cursor: isLoadingIssues ? 'not-allowed' : 'pointer',
                color: themeTokens.textSecondary,
                padding: 4,
                display: 'flex',
              }}
              title="Atualizar lista"
            >
              <RefreshCw
                size={15}
                style={{ animation: isLoadingIssues ? 'spin 1s linear infinite' : 'none' }}
              />
            </button>

            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: themeTokens.textSecondary,
                padding: 4,
                display: 'flex',
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Quick create section */}
        {isCreatingIssue && (
          <div
            style={{
              padding: '14px 18px',
              borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)'}`,
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.025)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 500, color: themeTokens.textPrimary }}>
              Criar nova issue no GitHub
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                placeholder="Título da issue (ex: Corrigir erro no fluxo de login)..."
                value={newIssueTitle}
                onChange={(e) => setNewIssueTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && newIssueTitle.trim()) {
                    onCreateIssue(newIssueTitle);
                  }
                }}
                style={{
                  flex: 1,
                  background: isEffectiveDark ? '#1a1a1e' : '#f4f4f5',
                  border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                  borderRadius: 7,
                  padding: '7px 12px',
                  fontSize: 12,
                  color: themeTokens.textPrimary,
                  outline: 'none',
                }}
                autoFocus
              />
              <button
                onClick={() => onCreateIssue(newIssueTitle)}
                disabled={!newIssueTitle.trim() || isLoadingIssues}
                style={{
                  background: '#22c55e',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 7,
                  padding: '7px 14px',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: newIssueTitle.trim() ? 'pointer' : 'not-allowed',
                  opacity: newIssueTitle.trim() ? 1 : 0.5,
                }}
              >
                {isLoadingIssues ? 'Criando...' : 'Publicar'}
              </button>
            </div>
          </div>
        )}

        {/* Search issues and Status Filters */}
        <div style={{ padding: '10px 18px 8px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input
            type="text"
            placeholder="Pesquisar por título, número ou autor..."
            value={issuesSearchQuery}
            onChange={(e) => setIssuesSearchQuery(e.target.value)}
            style={{
              width: '100%',
              background: isEffectiveDark ? '#18181b' : '#f9fafb',
              border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)'}`,
              borderRadius: 6,
              padding: '7px 12px',
              fontSize: 11.5,
              color: themeTokens.textPrimary,
              outline: 'none',
            }}
          />

          {/* Filter tabs: Todas, Abertas, Fechadas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <button
              type="button"
              onClick={() => setStateFilter('all')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                background: stateFilter === 'all'
                  ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')
                  : 'transparent',
                color: stateFilter === 'all' ? themeTokens.textPrimary : themeTokens.textSecondary,
                fontSize: 11.5,
                fontWeight: stateFilter === 'all' ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              <span>Todas</span>
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 8,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.06)',
                }}
              >
                {gitIssues.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStateFilter('open')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                background: stateFilter === 'open'
                  ? 'rgba(34, 197, 94, 0.15)'
                  : 'transparent',
                color: stateFilter === 'open' ? '#22c55e' : themeTokens.textSecondary,
                fontSize: 11.5,
                fontWeight: stateFilter === 'open' ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              <CircleDot size={12} color={stateFilter === 'open' ? '#22c55e' : themeTokens.textSecondary} />
              <span>Abertas</span>
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 8,
                  background: stateFilter === 'open' ? 'rgba(34, 197, 94, 0.2)' : (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
                }}
              >
                {openCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setStateFilter('closed')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                padding: '4px 10px',
                borderRadius: 6,
                border: 'none',
                background: stateFilter === 'closed'
                  ? 'rgba(130, 80, 223, 0.18)'
                  : 'transparent',
                color: stateFilter === 'closed' ? '#8250df' : themeTokens.textSecondary,
                fontSize: 11.5,
                fontWeight: stateFilter === 'closed' ? 600 : 400,
                cursor: 'pointer',
                transition: 'all 0.12s ease',
              }}
            >
              <CheckCircle2 size={12} color={stateFilter === 'closed' ? '#8250df' : themeTokens.textSecondary} />
              <span>Fechadas</span>
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 8,
                  background: stateFilter === 'closed' ? 'rgba(130, 80, 223, 0.24)' : (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)'),
                }}
              >
                {closedCount}
              </span>
            </button>
          </div>
        </div>

        {/* Issues list */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {filteredIssues.length === 0 && !isLoadingIssues && (
            <div style={{ padding: '36px 20px', textAlign: 'center', color: themeTokens.textSecondary, fontSize: 12 }}>
              {stateFilter === 'closed'
                ? 'Nenhuma issue fechada encontrada.'
                : stateFilter === 'open'
                ? 'Nenhuma issue aberta encontrada.'
                : 'Nenhuma issue encontrada neste repositório.'}
            </div>
          )}

          {filteredIssues.map((issue) => {
            const isClosed = (issue.state || '').toLowerCase() === 'closed';
            return (
              <div
                key={issue.number}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                  padding: '10px 14px',
                  borderRadius: 9,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.025)',
                  border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'}`,
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                  opacity: isClosed ? 0.85 : 1,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.025)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
                    {isClosed ? (
                      <CheckCircle2 size={15} color="#8250df" style={{ marginTop: 2, flexShrink: 0 }} />
                    ) : (
                      <CircleDot size={15} color="#22c55e" style={{ marginTop: 2, flexShrink: 0 }} />
                    )}
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 600, color: themeTokens.textPrimary, fontSize: 13 }}>
                          {issue.title}
                        </span>
                        <span style={{ color: themeTokens.textSecondary, fontSize: 11.5, fontWeight: 500 }}>
                          #{issue.number}
                        </span>
                        {isClosed && (
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 600,
                              padding: '1px 6px',
                              borderRadius: 8,
                              background: isEffectiveDark ? 'rgba(130, 80, 223, 0.2)' : '#f3e8ff',
                              color: '#8250df',
                            }}
                          >
                            Fechada
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 11, color: themeTokens.textSecondary, marginTop: 2 }}>
                        {isClosed ? 'fechada' : 'aberta'} por {typeof issue.author === 'string' ? issue.author : ((issue.author as any)?.login || (issue.author as any)?.name || 'walancy')}
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    <button
                      onClick={() => onLinkIssueToChat(issue)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: 'rgba(255, 139, 103, 0.12)',
                        color: accentColor,
                        border: 'none',
                        borderRadius: 6,
                        padding: '5px 10px',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                      title="Carregar Issue no chat para a IA resolver"
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = accentColor;
                        e.currentTarget.style.color = '#ffffff';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = 'rgba(255, 139, 103, 0.12)';
                        e.currentTarget.style.color = accentColor;
                      }}
                    >
                      <Sparkles size={12} />
                      Resolver com IA
                    </button>

                    <button
                      onClick={() => onOpenIssueInBrowser(issue.number)}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                        color: themeTokens.textSecondary,
                        border: 'none',
                        borderRadius: 6,
                        padding: 6,
                        cursor: 'pointer',
                      }}
                      title="Abrir no GitHub"
                    >
                      <ExternalLink size={13} />
                    </button>
                  </div>
                </div>

                {/* Labels */}
                {issue.labels && issue.labels.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginLeft: 23 }}>
                    {issue.labels.map((label, lIdx) => (
                      <span
                        key={lIdx}
                        style={{
                          fontSize: 10,
                          padding: '1px 6px',
                          borderRadius: 4,
                          background: label.color ? `#${label.color}22` : 'rgba(255, 255, 255, 0.08)',
                          color: label.color ? `#${label.color}` : themeTokens.textSecondary,
                          fontWeight: 500,
                        }}
                      >
                        {label.name}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
