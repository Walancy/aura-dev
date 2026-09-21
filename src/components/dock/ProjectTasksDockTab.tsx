import React, { useState, useMemo } from 'react';
import {
  CircleDot,
  CheckCircle2,
  Sparkles,
  Search,
  RefreshCw,
  ExternalLink,
  Milestone as MilestoneIcon,
  Tag,
  User,
  ListTodo,
} from 'lucide-react';
import type { GitHubIssueItem } from '../../types/ide';

interface ProjectTasksDockTabProps {
  issues: GitHubIssueItem[];
  isLoading: boolean;
  onRefresh: () => void;
  onDoWithAi: (issue: GitHubIssueItem) => void;
  onOpenIssueDetails?: (issueNumber: number) => void;
  currentUserLogin?: string;
  themeTokens: any;
  isEffectiveDark: boolean;
  accentColor: string;
}

export const ProjectTasksDockTab: React.FC<ProjectTasksDockTabProps> = ({
  issues = [],
  isLoading,
  onRefresh,
  onDoWithAi,
  onOpenIssueDetails,
  currentUserLogin = 'walancy',
  themeTokens,
  isEffectiveDark,
  accentColor,
}) => {
  const [filterMode, setFilterMode] = useState<'mine' | 'all'>('mine');
  const [searchQuery, setSearchQuery] = useState('');

  const normalizedUser = (currentUserLogin || 'walancy').toLowerCase().replace('@', '');

  // Helper to test if an issue is linked to current user
  const isLinkedToUser = (issue: GitHubIssueItem): boolean => {
    // 1. Check assignees array
    if (Array.isArray(issue.assignees) && issue.assignees.length > 0) {
      const match = issue.assignees.some((a) => {
        const login = typeof a === 'string' ? a : a?.login;
        return login && login.toLowerCase() === normalizedUser;
      });
      if (match) return true;
    }

    // 2. Check single assignee
    if (issue.assignee && typeof issue.assignee === 'object' && issue.assignee.login) {
      if (issue.assignee.login.toLowerCase() === normalizedUser) return true;
    }

    // 3. Check author
    const authorLogin = typeof issue.author === 'object' && issue.author !== null
      ? issue.author.login
      : String(issue.author || '');
    if (authorLogin && authorLogin.toLowerCase() === normalizedUser) {
      return true;
    }

    return false;
  };

  // Filtered issues
  const filteredIssues = useMemo(() => {
    let list = issues;

    // Filter by user assignment
    if (filterMode === 'mine') {
      list = list.filter(isLinkedToUser);
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter((i) => {
        const matchesNum = `#${i.number}`.includes(q) || String(i.number) === q;
        const matchesTitle = i.title.toLowerCase().includes(q);
        const matchesLabels = (i.labels || []).some((l) => l.name.toLowerCase().includes(q));
        return matchesNum || matchesTitle || matchesLabels;
      });
    }

    return list;
  }, [issues, filterMode, searchQuery, normalizedUser]);

  const myIssuesCount = useMemo(() => {
    return issues.filter(isLinkedToUser).length;
  }, [issues, normalizedUser]);

  const openCount = useMemo(() => {
    return filteredIssues.filter((i) => (i.state || 'open').toLowerCase() === 'open').length;
  }, [filteredIssues]);

  const surfaceBg = isEffectiveDark ? '#141414' : '#f8fafc';
  const cardBg = isEffectiveDark ? '#181818' : '#ffffff';
  const inputBg = isEffectiveDark ? '#1e1e1e' : '#ffffff';
  const textPrimary = themeTokens?.textPrimary || (isEffectiveDark ? '#f4f4f5' : '#0f172a');
  const textSecondary = themeTokens?.textSecondary || (isEffectiveDark ? '#8b949e' : '#64748b');

  return (
    <div
      style={{
        flex: '1 1 0',
        alignSelf: 'stretch',
        background: surfaceBg,
        borderRadius: 10,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontSize: 12,
        fontFamily: 'Poppins, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      {/* Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '10px 14px',
          borderBottom: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid rgba(0, 0, 0, 0.08)',
          gap: 12,
          flexWrap: 'wrap',
          background: cardBg,
        }}
      >
        {/* Left: Filter Toggle & Counters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'inline-flex',
              background: isEffectiveDark ? '#222222' : '#e2e8f0',
              borderRadius: 6,
              padding: 2,
              gap: 2,
            }}
          >
            <button
              type="button"
              onClick={() => setFilterMode('mine')}
              style={{
                background: filterMode === 'mine' ? (isEffectiveDark ? '#2e2e2e' : '#ffffff') : 'transparent',
                color: filterMode === 'mine' ? accentColor : textSecondary,
                border: 'none',
                borderRadius: 5,
                padding: '4px 9px',
                fontSize: 11.5,
                fontWeight: filterMode === 'mine' ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <User size={12} />
              <span>Minhas Tarefas</span>
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 10,
                  background: filterMode === 'mine' ? (isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
                  color: filterMode === 'mine' ? textPrimary : textSecondary,
                }}
              >
                {myIssuesCount}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setFilterMode('all')}
              style={{
                background: filterMode === 'all' ? (isEffectiveDark ? '#2e2e2e' : '#ffffff') : 'transparent',
                color: filterMode === 'all' ? accentColor : textSecondary,
                border: 'none',
                borderRadius: 5,
                padding: '4px 9px',
                fontSize: 11.5,
                fontWeight: filterMode === 'all' ? 600 : 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                transition: 'all 0.15s ease',
              }}
            >
              <ListTodo size={12} />
              <span>Todas</span>
              <span
                style={{
                  fontSize: 10,
                  padding: '1px 5px',
                  borderRadius: 10,
                  background: filterMode === 'all' ? (isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)') : 'transparent',
                  color: filterMode === 'all' ? textPrimary : textSecondary,
                }}
              >
                {issues.length}
              </span>
            </button>
          </div>

          <span style={{ color: textSecondary, fontSize: 11 }}>
            {openCount} {openCount === 1 ? 'aberta' : 'abertas'}
          </span>
        </div>

        {/* Right: Search & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              background: inputBg,
              border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d0d7de',
              borderRadius: 6,
              padding: '3px 8px',
              width: 180,
            }}
          >
            <Search size={12} color={textSecondary} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar tarefas..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: textPrimary,
                fontSize: 11.5,
                width: '100%',
              }}
            />
          </div>

          <button
            type="button"
            onClick={onRefresh}
            title="Recarregar issues do GitHub"
            style={{
              background: inputBg,
              border: isEffectiveDark ? '1px solid rgba(255, 255, 255, 0.1)' : '1px solid #d0d7de',
              borderRadius: 6,
              padding: '5px 7px',
              color: textSecondary,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
            onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
          >
            <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      {/* Task List Content */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {isLoading && issues.length === 0 ? (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: textSecondary,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <RefreshCw size={18} className="animate-spin" color={accentColor} />
            <span>Sincronizando tarefas com o GitHub...</span>
          </div>
        ) : filteredIssues.length === 0 ? (
          <div
            style={{
              padding: '36px 20px',
              textAlign: 'center',
              color: textSecondary,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 8,
            }}
          >
            <ListTodo size={24} color={textSecondary} style={{ opacity: 0.6 }} />
            <div style={{ fontSize: 13, fontWeight: 500, color: textPrimary }}>
              {filterMode === 'mine' ? 'Nenhuma tarefa atribuída a você no momento' : 'Nenhuma tarefa encontrada'}
            </div>
            <div style={{ fontSize: 11.5, maxWidth: 360, lineHeight: 1.4 }}>
              {filterMode === 'mine'
                ? `Não há issues vinculadas a @${normalizedUser}. Alterne para "Todas" para visualizar todas as tarefas do projeto.`
                : 'Não há issues abertas correspondentes à busca neste repositório.'}
            </div>
            {filterMode === 'mine' && issues.length > 0 && (
              <button
                type="button"
                onClick={() => setFilterMode('all')}
                style={{
                  marginTop: 6,
                  background: accentColor,
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: 6,
                  padding: '5px 12px',
                  fontSize: 11.5,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                Ver todas ({issues.length})
              </button>
            )}
          </div>
        ) : (
          filteredIssues.map((issue) => {
            const isOpen = (issue.state || 'open').toLowerCase() === 'open';
            const issueColor = isOpen ? '#3fb950' : '#8957e5';
            const authorLogin = typeof issue.author === 'object' && issue.author !== null
              ? issue.author.login
              : String(issue.author || '');

            return (
              <div
                key={issue.number}
                style={{
                  background: cardBg,
                  borderRadius: 8,
                  border: 'none',
                  padding: '10px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 7,
                  boxShadow: isEffectiveDark ? 'none' : '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'background 0.15s ease',
                }}
              >
                {/* Main Row: Icon, Title and Actions */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, flex: 1, minWidth: 0 }}>
                    {/* Colored Issue Icon */}
                    <div style={{ marginTop: 2, flexShrink: 0 }} title={isOpen ? 'Issue Aberta' : 'Issue Concluída'}>
                      {isOpen ? (
                        <CircleDot size={15} color={issueColor} />
                      ) : (
                        <CheckCircle2 size={15} color={issueColor} />
                      )}
                    </div>

                    {/* Number and Title */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
                        <span
                          style={{
                            color: textSecondary,
                            fontSize: 12,
                            fontWeight: 600,
                            fontFamily: 'JetBrains Mono, monospace',
                          }}
                        >
                          #{issue.number}
                        </span>
                        <span
                          onClick={() => onOpenIssueDetails?.(issue.number)}
                          title="Clique para ver detalhes da issue"
                          style={{
                            color: textPrimary,
                            fontSize: 12.5,
                            fontWeight: 500,
                            cursor: 'pointer',
                            lineHeight: 1.35,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                          onMouseLeave={(e) => (e.currentTarget.style.color = textPrimary)}
                        >
                          {issue.title}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions: "Fazer com IA" Button & External Link */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {/* Botão Fazer com IA */}
                    <button
                      type="button"
                      onClick={() => onDoWithAi(issue)}
                      title="Enviar tarefa para o chat de IA e resolver"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        background: `linear-gradient(135deg, ${accentColor}, #ff8c00)`,
                        border: 'none',
                        borderRadius: 6,
                        padding: '4px 10px',
                        color: '#ffffff',
                        fontSize: 11.5,
                        fontWeight: 600,
                        cursor: 'pointer',
                        boxShadow: `0 2px 8px ${accentColor}40`,
                        transition: 'transform 0.12s ease, filter 0.12s ease',
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.filter = 'brightness(1.1)';
                        e.currentTarget.style.transform = 'translateY(-1px)';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.filter = 'none';
                        e.currentTarget.style.transform = 'translateY(0)';
                      }}
                    >
                      <Sparkles size={12} color="#ffffff" />
                      <span>Fazer com IA</span>
                    </button>

                    {/* External Link */}
                    {issue.url && (
                      <button
                        type="button"
                        onClick={() => window.electronAPI?.shell?.openExternal?.(issue.url!)}
                        title="Abrir no GitHub"
                        style={{
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                          border: 'none',
                          borderRadius: 6,
                          padding: '5px',
                          color: textSecondary,
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
                        onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
                      >
                        <ExternalLink size={12} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Sub Row: Labels, Milestone, Author */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    flexWrap: 'wrap',
                    paddingLeft: 23,
                    fontSize: 11,
                    color: textSecondary,
                  }}
                >
                  {/* Status badge */}
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      padding: '1px 6px',
                      borderRadius: 10,
                      background: isOpen ? 'rgba(63, 185, 80, 0.15)' : 'rgba(137, 87, 229, 0.15)',
                      color: issueColor,
                    }}
                  >
                    {isOpen ? 'Aberta' : 'Concluída'}
                  </span>

                  {/* Labels */}
                  {Array.isArray(issue.labels) && issue.labels.length > 0 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                      {issue.labels.slice(0, 4).map((lbl, lIdx) => {
                        const bgHex = lbl.color ? `#${lbl.color.replace('#', '')}` : '#888888';
                        return (
                          <span
                            key={lbl.id || lbl.name || lIdx}
                            style={{
                              fontSize: 10,
                              fontWeight: 500,
                              padding: '1px 6px',
                              borderRadius: 4,
                              background: `${bgHex}22`,
                              color: isEffectiveDark ? '#f4f4f5' : '#1e293b',
                              border: `1px solid ${bgHex}44`,
                            }}
                          >
                            {lbl.name}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Milestone */}
                  {issue.milestone?.title && (
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 3,
                        color: textSecondary,
                        fontSize: 10.5,
                      }}
                    >
                      <MilestoneIcon size={11} />
                      <span>{issue.milestone.title}</span>
                    </span>
                  )}

                  {/* Author / Assignee */}
                  {authorLogin && (
                    <span style={{ fontSize: 10.5, color: textSecondary }}>
                      por @{authorLogin}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
