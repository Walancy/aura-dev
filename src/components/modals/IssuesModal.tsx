import React from 'react';
import { CircleDot, Plus, RefreshCw, X, Sparkles, ExternalLink } from 'lucide-react';
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
          width: 680,
          maxWidth: '92vw',
          maxHeight: '82vh',
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
                  {gitIssues.length} abertas
                </span>
              </div>
              <div style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                {gitRepoName || 'appmoove/ainaobra'}
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

        {/* Search issues */}
        <div style={{ padding: '10px 18px 6px' }}>
          <input
            type="text"
            placeholder="Pesquisar por título ou número da issue..."
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
          {gitIssues.length === 0 && !isLoadingIssues && (
            <div style={{ padding: '30px 20px', textAlign: 'center', color: themeTokens.textSecondary, fontSize: 12 }}>
              Nenhuma issue aberta encontrada neste repositório.
            </div>
          )}

          {gitIssues
            .filter((issue) => {
              const q = issuesSearchQuery.toLowerCase();
              return (
                issue.title.toLowerCase().includes(q) ||
                String(issue.number).includes(q) ||
                (issue.author && (typeof issue.author === 'string' ? issue.author : ((issue.author as any)?.login || '')).toLowerCase().includes(q))
              );
            })
            .map((issue) => (
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
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.025)' : 'rgba(0, 0, 0, 0.025)';
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1 }}>
                    <CircleDot size={15} color="#22c55e" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div>
                      <span style={{ fontWeight: 600, color: themeTokens.textPrimary, fontSize: 13, marginRight: 6 }}>
                        {issue.title}
                      </span>
                      <span style={{ color: themeTokens.textSecondary, fontSize: 11.5, fontWeight: 500 }}>
                        #{issue.number}
                      </span>
                      <div style={{ fontSize: 11, color: themeTokens.textSecondary, marginTop: 2 }}>
                        aberta por {typeof issue.author === 'string' ? issue.author : ((issue.author as any)?.login || (issue.author as any)?.name || 'walancy')}
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
            ))}
        </div>
      </div>
    </div>
  );
};
