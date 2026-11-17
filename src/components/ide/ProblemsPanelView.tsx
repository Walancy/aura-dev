import React, { useState, useMemo } from 'react';
import {
  XCircle,
  AlertTriangle,
  Info,
  CheckCircle2,
  Search,
  RefreshCw,
  ChevronRight,
  ExternalLink,
  Copy,
  Sparkles,
  Filter,
  FileText,
  Clock,
} from 'lucide-react';
import { getFieldTokens } from '../../utils/fieldTokens';
import { renderAiIcon } from '../icons/AiProviderIcons';

export interface IdeProblem {
  id: string;
  filePath: string;
  relPath?: string;
  fileName: string;
  line: number;
  column: number;
  endLine?: number;
  endColumn?: number;
  message: string;
  severity: 'error' | 'warning' | 'info';
  severityCode: number; // 8 = error, 4 = warning, 2 = info
  code?: string | number;
  source?: string; // 'monaco', 'tsc', 'eslint'
}

export interface ProblemsPanelViewProps {
  problems: IdeProblem[];
  activeFile: { id: string; name: string; path?: string } | null;
  onOpenFile: (filePath: string, fileName?: string) => Promise<void> | void;
  onJumpToLocation: (filePath: string, line: number, col: number) => void;
  onRunProjectCheck?: () => Promise<void>;
  isCheckingProject?: boolean;
  lastCheckedTime?: Date | null;
  /** resultado de cada verificação (tipos, ESLint, oxlint), inclusive as que não puderam rodar */
  checkResults?: Array<{ label: string; ok: boolean; count: number; error?: string }>;
  themeTokens: {
    bgCard: string;
    border: string;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
  };
  accentColor: string;
  isEffectiveDark: boolean;
  onAskAiAboutProblem?: (problem: IdeProblem) => void;
  /** pede à IA para corrigir os problemas listados (respeita busca, escopo e filtro de severidade) */
  onResolveWithAi?: (problems: IdeProblem[]) => void;
  /** IA selecionada na header (logo do botão Resolver com IA) */
  aiProviderId?: string;
}

export const ProblemsPanelView: React.FC<ProblemsPanelViewProps> = ({
  problems,
  activeFile,
  onOpenFile,
  onJumpToLocation,
  onRunProjectCheck,
  isCheckingProject = false,
  lastCheckedTime,
  checkResults,
  themeTokens,
  accentColor,
  isEffectiveDark,
  onAskAiAboutProblem,
  onResolveWithAi,
  aiProviderId,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<'all' | 'error' | 'warning' | 'info'>('all');
  const [scope, setScope] = useState<'all' | 'active'>('all');
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Group and count stats
  const stats = useMemo(() => {
    let errors = 0;
    let warnings = 0;
    let infos = 0;
    for (const p of problems) {
      if (p.severity === 'error') errors++;
      else if (p.severity === 'warning') warnings++;
      else infos++;
    }
    return { total: problems.length, errors, warnings, infos };
  }, [problems]);

  // Filtered problems
  const filteredProblems = useMemo(() => {
    return problems.filter((p) => {
      // Scope filter
      if (scope === 'active') {
        if (!activeFile) return false;
        const matchesActive =
          (activeFile.path && p.filePath === activeFile.path) ||
          (activeFile.name && p.fileName === activeFile.name) ||
          (activeFile.path && p.filePath.endsWith(activeFile.path));
        if (!matchesActive) return false;
      }

      // Severity filter
      if (filterSeverity !== 'all' && p.severity !== filterSeverity) {
        return false;
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const msgMatch = p.message.toLowerCase().includes(q);
        const fileMatch = p.fileName.toLowerCase().includes(q) || (p.relPath && p.relPath.toLowerCase().includes(q));
        const codeMatch = p.code ? String(p.code).toLowerCase().includes(q) : false;
        const lineMatch = String(p.line) === q;
        if (!msgMatch && !fileMatch && !codeMatch && !lineMatch) {
          return false;
        }
      }

      return true;
    });
  }, [problems, scope, activeFile, filterSeverity, searchQuery]);

  // Group by file
  const groupedByFile = useMemo(() => {
    const map = new Map<string, { filePath: string; fileName: string; relPath: string; items: IdeProblem[] }>();
    for (const p of filteredProblems) {
      const key = p.filePath || p.fileName;
      if (!map.has(key)) {
        map.set(key, {
          filePath: p.filePath,
          fileName: p.fileName,
          relPath: p.relPath || p.filePath,
          items: [],
        });
      }
      map.get(key)!.items.push(p);
    }
    return Array.from(map.values()).sort((a, b) => b.items.length - a.items.length);
  }, [filteredProblems]);

  // Shift + clique: contrai ou expande todos os arquivos de uma vez (segue o novo estado do arquivo clicado)
  const toggleFileCollapse = (fileKey: string, all = false) => {
    if (all) {
      const next = !collapsedFiles[fileKey];
      setCollapsedFiles(Object.fromEntries(groupedByFile.map((g) => [g.filePath || g.fileName, next])));
      return;
    }
    setCollapsedFiles((prev) => ({ ...prev, [fileKey]: !prev[fileKey] }));
  };

  const handleCopyProblem = (e: React.MouseEvent, p: IdeProblem) => {
    e.stopPropagation();
    const text = `${p.relPath || p.fileName}:${p.line}:${p.column} - ${p.severity.toUpperCase()} ${p.code ? `[${p.code}]` : ''}: ${p.message}`;
    navigator.clipboard.writeText(text);
    setCopiedId(p.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleRowClick = async (p: IdeProblem) => {
    if (p.filePath) {
      if (!activeFile || (activeFile.path !== p.filePath && activeFile.id !== p.filePath)) {
        await onOpenFile(p.filePath, p.fileName);
        setTimeout(() => {
          onJumpToLocation(p.filePath, p.line, p.column);
        }, 120);
      } else {
        onJumpToLocation(p.filePath, p.line, p.column);
      }
    }
  };

  return (
    <div
      className="df-ide-surface df-view-enter"
      style={{
        flex: '1 1 0',
        alignSelf: 'stretch',
        background: themeTokens.bgCard,
        borderRadius: 10,
        border: 'none',
        boxShadow: 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontSize: 12,
        color: themeTokens.textPrimary,
        userSelect: 'none',
      }}
    >
      {/* 1. Header Toolbar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: 12,
          borderBottom: '1px solid ' + (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'),
          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
          gap: 12,
          flexWrap: 'wrap',
          flexShrink: 0,
        }}
      >
        {/* Left: Search input & Scope */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 260 }}>
          <div
            className="df-search-box"
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              flex: 1,
              maxWidth: 340,
              height: 30,
              background: getFieldTokens(isEffectiveDark).fieldBg,
              borderRadius: 6,
              border: 'none',
              boxShadow: 'none',
              padding: '0 8px',
              boxSizing: 'border-box',
            }}
          >
            <Search size={13} color={themeTokens.textSecondary} style={{ marginRight: 6, flexShrink: 0 }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filtrar por mensagem, código (TS...) ou arquivo..."
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: themeTokens.textPrimary,
                fontSize: 11.5,
                fontWeight: 400,
                padding: '5px 0',
              }}
            />
            {searchQuery && (
              <span
                className="df-pressable"
                onClick={() => setSearchQuery('')}
                style={{ cursor: 'pointer', fontSize: 13, color: themeTokens.textSecondary, marginLeft: 4 }}
                title="Limpar busca"
              >
                ×
              </span>
            )}
          </div>

          {/* Scope selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 30,
              boxSizing: 'border-box',
              background: isEffectiveDark ? '#0c0c0e' : '#e4e6ea',
              borderRadius: 6,
              padding: 2,
              border: 'none',
              boxShadow: 'none',
            }}
          >
            <button
              onClick={() => setScope('all')}
              style={{
                background: scope === 'all' ? (isEffectiveDark ? '#2c2e35' : '#ffffff') : 'transparent',
                border: 'none',
                borderRadius: 4,
                height: 26,
                padding: '0 10px',
                fontSize: 11.5,
                cursor: 'pointer',
                transition: 'background-color 150ms ease, color 150ms ease',
                color: scope === 'all' ? themeTokens.textPrimary : themeTokens.textSecondary,
                fontWeight: 400,
                boxShadow: 'none',
              }}
            >
              Projeto Todo ({problems.length})
            </button>
            <button
              onClick={() => setScope('active')}
              style={{
                background: scope === 'active' ? (isEffectiveDark ? '#2c2e35' : '#ffffff') : 'transparent',
                border: 'none',
                borderRadius: 4,
                height: 26,
                padding: '0 10px',
                fontSize: 11.5,
                cursor: 'pointer',
                transition: 'background-color 150ms ease, color 150ms ease',
                color: scope === 'active' ? themeTokens.textPrimary : themeTokens.textSecondary,
                fontWeight: 400,
                boxShadow: 'none',
              }}
            >
              Arquivo Atual {activeFile ? `(${problems.filter((p) => p.fileName === activeFile.name || p.filePath === activeFile.path).length})` : ''}
            </button>
          </div>
        </div>

        {/* Right: Counters / Filters & Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          {/* Filtro de severidade: mesmo visual das abas de escopo */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              height: 30,
              boxSizing: 'border-box',
              background: isEffectiveDark ? '#0c0c0e' : '#e4e6ea',
              borderRadius: 6,
              padding: 2,
              gap: 2,
            }}
          >
            {(
              [
                { key: 'error', label: `${stats.errors} Erros`, color: '#ef4444', Icon: XCircle, title: 'Filtrar apenas erros', show: true },
                { key: 'warning', label: `${stats.warnings} Avisos`, color: '#f59e0b', Icon: AlertTriangle, title: 'Filtrar apenas avisos', show: true },
                { key: 'info', label: `${stats.infos} Infos`, color: '#3b82f6', Icon: Info, title: 'Filtrar apenas informações', show: stats.infos > 0 },
              ] as const
            )
              .filter((t) => t.show)
              .map((t) => {
                const active = filterSeverity === t.key;
                return (
                  <button
                    key={t.key}
                    onClick={() => setFilterSeverity(active ? 'all' : t.key)}
                    title={t.title}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      background: active ? (isEffectiveDark ? '#2c2e35' : '#ffffff') : 'transparent',
                      border: 'none',
                      borderRadius: 4,
                      height: 26,
                      padding: '0 10px',
                      fontSize: 11.5,
                      cursor: 'pointer',
                      color: active ? themeTokens.textPrimary : themeTokens.textSecondary,
                      fontWeight: 400,
                      transition: 'background-color 150ms ease, color 150ms ease',
                    }}
                  >
                    <t.Icon size={13} color={t.color} />
                    <span>{t.label}</span>
                  </button>
                );
              })}
          </div>
          {/* Resolver com IA: manda os problemas exibidos para a IA corrigir */}
          {onResolveWithAi && (
            <button
              onClick={() => onResolveWithAi(filteredProblems)}
              disabled={filteredProblems.length === 0}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 5,
                background: getFieldTokens(isEffectiveDark).fieldBg,
                border: 'none',
                borderRadius: 6,
                height: 30,
                padding: '0 12px',
                fontSize: 11.5,
                color: themeTokens.textPrimary,
                cursor: filteredProblems.length === 0 ? 'not-allowed' : 'pointer',
                opacity: filteredProblems.length === 0 ? 0.5 : 1,
                fontWeight: 400,
                marginLeft: 8,
                transition: 'opacity 150ms ease, background-color 150ms ease',
              }}
              title="Pedir à IA para corrigir os problemas exibidos"
            >
              {aiProviderId ? renderAiIcon(aiProviderId, 14) : <Sparkles size={13} />}
              <span>Resolver com IA</span>
            </button>
          )}

        </div>
      </div>

      {/* 2. Content Area */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          padding: groupedByFile.length === 0 ? 0 : '4px 0',
        }}
      >
        {/* Loading overlay / indicator */}
        {isCheckingProject && (
          <div
            className="df-subtle-enter"
            style={{
              padding: '8px 16px',
              background: 'rgba(59, 130, 246, 0.08)',
              borderBottom: '1px solid rgba(59, 130, 246, 0.14)',
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontSize: 11.5,
              color: '#60a5fa',
            }}
          >
            <RefreshCw size={13} style={{ animation: 'spin 1s linear infinite' }} />
            <span>Compilador TypeScript executando análise estática completa do projeto...</span>
          </div>
        )}

        {/* Empty State */}
        {filteredProblems.length === 0 ? (
          <div
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 40,
              gap: 12,
              textAlign: 'center',
            }}
          >
            {problems.length === 0 ? (
              <>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 24,
                    background: 'rgba(16, 185, 129, 0.1)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#10b981',
                  }}
                >
                  <CheckCircle2 size={26} />
                </div>
                <div style={{ fontSize: 14, fontWeight: 500, color: themeTokens.textPrimary }}>
                  Nenhum problema encontrado
                </div>
                <div style={{ fontSize: 12, color: themeTokens.textSecondary, maxWidth: 360, lineHeight: 1.5 }}>
                  Todos os arquivos validados estão livres de erros de sintaxe ou alertas.
                </div>
                {onRunProjectCheck && (
                  <button
                    onClick={onRunProjectCheck}
                    disabled={isCheckingProject}
                    style={{
                      marginTop: 6,
                      background: accentColor,
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: 6,
                      padding: '6px 14px',
                      fontSize: 11.5,
                      fontWeight: 500,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Executar Verificação do Projeto (tsc)</span>
                  </button>
                )}
              </>
            ) : (
              <>
                <Filter size={28} color={themeTokens.textSecondary} />
                <div style={{ fontSize: 13, fontWeight: 500, color: themeTokens.textPrimary }}>
                  Nenhum problema corresponde ao filtro atual
                </div>
                <div style={{ fontSize: 11.5, color: themeTokens.textSecondary }}>
                  Tente alterar os termos da busca ou os filtros de gravidade.
                </div>
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setFilterSeverity('all');
                    setScope('all');
                  }}
                  style={{
                    marginTop: 6,
                    background: isEffectiveDark ? '#23252b' : '#e5e7eb',
                    border: 'none',
                    boxShadow: 'none',
                    borderRadius: 5,
                    padding: '4px 10px',
                    fontSize: 11,
                    fontWeight: 400,
                    color: themeTokens.textPrimary,
                    cursor: 'pointer',
                  }}
                >
                  Limpar Filtros
                </button>
              </>
            )}
          </div>
        ) : (
          /* List Grouped by File */
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {groupedByFile.map((group) => {
              const fileKey = group.filePath || group.fileName;
              const isCollapsed = !!collapsedFiles[fileKey];
              const fileErrors = group.items.filter((i) => i.severity === 'error').length;
              const fileWarnings = group.items.filter((i) => i.severity === 'warning').length;

              return (
                <div key={fileKey} style={{ borderBottom: '1px solid ' + (isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)') }}>
                  {/* File Header */}
                  <div
                    className="df-row-interactive"
                    onClick={(e) => toggleFileCollapse(fileKey, e.shiftKey)}
                    title="Shift + clique: contrair ou expandir todos"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)',
                      cursor: 'pointer',
                      fontSize: 12,
                      fontWeight: 400,
                    }}
                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)')}
                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <ChevronRight
                        size={13}
                        color={themeTokens.textSecondary}
                        className="df-chevron"
                        style={{ transform: isCollapsed ? 'rotate(0deg)' : 'rotate(90deg)', flexShrink: 0 }}
                      />
                      <FileText size={14} color={accentColor} />
                      <span style={{ color: themeTokens.textPrimary }}>{group.fileName}</span>
                      <span
                        style={{
                          fontSize: 11,
                          color: themeTokens.textSecondary,
                          textOverflow: 'ellipsis',
                          overflow: 'hidden',
                          whiteSpace: 'nowrap',
                          maxWidth: 380,
                        }}
                      >
                        {group.relPath}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {fileErrors > 0 && (
                        <span
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#ef4444',
                            borderRadius: 10,
                            padding: '1px 6px',
                            fontSize: 10.5,
                            fontWeight: 400,
                          }}
                        >
                          {fileErrors} {fileErrors === 1 ? 'erro' : 'erros'}
                        </span>
                      )}
                      {fileWarnings > 0 && (
                        <span
                          style={{
                            background: 'rgba(245, 158, 11, 0.15)',
                            color: '#f59e0b',
                            borderRadius: 10,
                            padding: '1px 6px',
                            fontSize: 10.5,
                            fontWeight: 400,
                          }}
                        >
                          {fileWarnings} {fileWarnings === 1 ? 'aviso' : 'avisos'}
                        </span>
                      )}
                      <span style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                        {group.items.length}
                      </span>
                    </div>
                  </div>

                  {/* File Problem Items */}
                  {!isCollapsed && (
                    <div className="df-subtle-enter" style={{ display: 'flex', flexDirection: 'column' }}>
                      {group.items.map((p) => {
                        const isError = p.severity === 'error';
                        const isWarning = p.severity === 'warning';

                        return (
                          <div
                            key={p.id}
                            className="df-row-interactive pp-row"
                            data-problem-row="true"
                            data-line={p.line}
                            data-col={p.column}
                            onClick={() => handleRowClick(p)}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px 8px 32px',
                              cursor: 'pointer',
                              borderBottom: '1px solid ' + (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                              gap: 12,
                              transition: 'background-color 120ms ease',
                            }}
                            onMouseEnter={(e) => {
                              (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.045)' : 'rgba(0, 0, 0, 0.04)';
                            }}
                            onMouseLeave={(e) => {
                              (e.currentTarget as HTMLElement).style.background = 'transparent';
                            }}
                          >
                            {/* Problem Body */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', flexShrink: 0 }}>
                                {isError ? (
                                  <XCircle size={13} color="#ef4444" />
                                ) : isWarning ? (
                                  <AlertTriangle size={13} color="#f59e0b" />
                                ) : (
                                  <Info size={13} color="#3b82f6" />
                                )}
                              </div>

                              <div style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                  <span
                                    style={{
                                      color: themeTokens.textPrimary,
                                      fontSize: 12,
                                      fontWeight: 400,
                                      lineHeight: 1.45,
                                      wordBreak: 'break-word',
                                    }}
                                  >
                                    {p.message}
                                  </span>

                                  {p.code && (
                                    <span
                                      style={{
                                        background: isEffectiveDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.06)',
                                        color: themeTokens.textSecondary,
                                        borderRadius: 4,
                                        padding: '1px 6px',
                                        fontSize: 10.5,
                                        fontFamily: 'JetBrains Mono, Menlo, monospace',
                                        border: 'none',
                                        boxShadow: 'none',
                                      }}
                                    >
                                      {p.code}
                                    </span>
                                  )}

                                  {p.source && (
                                    <span
                                      style={{
                                        color: themeTokens.textMuted || themeTokens.textSecondary,
                                        fontSize: 10.5,
                                        opacity: 0.9,
                                      }}
                                    >
                                      [{p.source}]
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Position & Action Buttons */}
                            <div className="pp-actions" style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                              <span
                                style={{
                                  marginRight: 8,
                                  fontSize: 11,
                                  fontFamily: 'JetBrains Mono, Menlo, monospace',
                                  color: themeTokens.textSecondary,
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
                                  borderRadius: 4,
                                  padding: '2px 6px',
                                  whiteSpace: 'nowrap',
                                }}
                              >
                                Ln {p.line}, Col {p.column}
                              </span>

                              {/* Ask AI button */}
                              {onAskAiAboutProblem && (
                                <button
                                  className="pp-act"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onAskAiAboutProblem(p);
                                  }}
                                  style={{
                                    background: 'transparent',
                                    border: 'none',
                                    cursor: 'pointer',
                                    width: 26,
                                    height: 26,
                                    borderRadius: 6,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                  title="Pedir correção à IA"
                                >
                                  {aiProviderId ? renderAiIcon(aiProviderId, 14) : <Sparkles size={13} color={accentColor} />}
                                </button>
                              )}

                              {/* Copy details button */}
                              <button
                                className="pp-act"
                                onClick={(e) => handleCopyProblem(e, p)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  width: 26,
                                  height: 26,
                                  justifyContent: 'center',
                                  borderRadius: 6,
                                  color: copiedId === p.id ? '#10b981' : themeTokens.textSecondary,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                                title={copiedId === p.id ? 'Copiado!' : 'Copiar detalhes do problema'}
                              >
                                {copiedId === p.id ? <CheckCircle2 size={13} /> : <Copy size={13} />}
                              </button>

                              {/* Go to line button */}
                              <button
                                className="pp-act"
                                onClick={() => handleRowClick(p)}
                                style={{
                                  background: 'transparent',
                                  border: 'none',
                                  cursor: 'pointer',
                                  width: 26,
                                  height: 26,
                                  justifyContent: 'center',
                                  borderRadius: 6,
                                  color: themeTokens.textSecondary,
                                  display: 'flex',
                                  alignItems: 'center',
                                }}
                                title="Ir para a linha"
                              >
                                <ExternalLink size={13} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. Footer Status Bar */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 12px',
          borderTop: '1px solid ' + (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'),
          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.01)' : 'rgba(0, 0, 0, 0.01)',
          fontSize: 11,
          color: themeTokens.textSecondary,
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span>
            Exibindo <strong>{filteredProblems.length}</strong> de <strong>{problems.length}</strong> problemas
          </span>
          {isCheckingProject && (
            <span className="df-subtle-enter" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <RefreshCw size={11} style={{ animation: 'spin 1s linear infinite' }} /> Verificando…
            </span>
          )}
          {scope === 'active' && activeFile && <span>• Apenas {activeFile.name}</span>}
        </div>

        {checkResults && checkResults.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', minWidth: 0 }}>
            {checkResults.map((r) => (
              <span key={r.label} title={r.error || `${r.count} problema(s)`} style={{ color: r.ok ? undefined : '#f97316', display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap', maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {r.ok ? <CheckCircle2 size={11} /> : <AlertTriangle size={11} />}
                <span>{r.ok ? `${r.label}: ${r.count}` : `${r.label}: ${r.error}`}</span>
              </span>
            ))}
          </div>
        )}

        {lastCheckedTime && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, opacity: 0.85 }}>
            <Clock size={11} />
            <span>Última checagem: {lastCheckedTime.toLocaleTimeString()}</span>
          </div>
        )}
      </div>
    </div>
  );
};
