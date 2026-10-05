import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  Bug,
  Trash2,
  Copy,
  Check,
  Search,
  ChevronRight,
  Terminal,
  Play,
  RotateCcw,
} from 'lucide-react';
import { logSystemActivity } from '../../utils/brainService';

export interface DebugHistoryItem {
  id: string;
  type: 'input' | 'result' | 'shell' | 'error' | 'info';
  content: string;
  timestamp: number;
  rawObj?: any;
}

interface DebugConsoleDockTabProps {
  themeTokens: any;
  isEffectiveDark: boolean;
  accentColor: string;
  workspacePath?: string;
  activeProjectName?: string;
  activeFilePath?: string;
  openFiles?: Array<{ path: string; name?: string }>;
  editorErrors?: number;
  editorWarnings?: number;
  allProblems?: any[];
  gitIssues?: any[];
}

export const DebugConsoleDockTab: React.FC<DebugConsoleDockTabProps> = ({
  themeTokens,
  isEffectiveDark,
  accentColor,
  workspacePath = process.cwd(),
  activeProjectName = 'devflow-desktop',
  activeFilePath,
  openFiles = [],
  editorErrors = 0,
  editorWarnings = 0,
  allProblems = [],
  gitIssues = [],
}) => {
  const [history, setHistory] = useState<DebugHistoryItem[]>([
    {
      id: 'init-1',
      type: 'info',
      content: 'DevFlow Debug Console iniciado. Digite expressões JS/TS ou comandos shell com prefixo $ (ex: $ git status).',
      timestamp: Date.now(),
    },
  ]);
  const [commandInput, setCommandInput] = useState<string>('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isExecuting, setIsExecuting] = useState<boolean>(false);
  const listEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on new entries
  useEffect(() => {
    if (listEndRef.current) {
      listEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [history]);

  // Execute debug command
  const evaluateCommand = async (cmdToRun: string) => {
    const rawCmd = cmdToRun.trim();
    if (!rawCmd) return;

    // Add to input history list
    setCommandHistory((prev) => [rawCmd, ...prev.filter((c) => c !== rawCmd)]);
    setHistoryIndex(-1);
    setCommandInput('');

    const inputItem: DebugHistoryItem = {
      id: `in-${Date.now()}-${Math.random()}`,
      type: 'input',
      content: rawCmd,
      timestamp: Date.now(),
    };

    setHistory((prev) => [...prev, inputItem]);
    setIsExecuting(true);

    try {
      // 1. Shell command execution with prefix $ or shell:
      if (rawCmd.startsWith('$') || rawCmd.startsWith('shell:')) {
        const shellCmd = rawCmd.replace(/^(\$|shell:)\s*/, '');
        if (window.electronAPI?.shell?.exec) {
          const res = await window.electronAPI.shell.exec(shellCmd, workspacePath);
          const out = res.stdout || res.stderr || `Comando concluído com código ${res.exitCode}`;
          setHistory((prev) => [
            ...prev,
            {
              id: `sh-${Date.now()}`,
              type: res.exitCode === 0 ? 'shell' : 'error',
              content: out.trim(),
              timestamp: Date.now(),
            },
          ]);
        } else {
          setHistory((prev) => [
            ...prev,
            {
              id: `sh-err-${Date.now()}`,
              type: 'error',
              content: 'Execução de shell não disponível no ambiente atual.',
              timestamp: Date.now(),
            },
          ]);
        }
        logSystemActivity('debug_console', 'shell_exec', activeProjectName, { command: shellCmd });
        return;
      }

      // 2. Clear command
      if (rawCmd === 'clear' || rawCmd === 'clear()' || rawCmd === 'cls') {
        setHistory([]);
        return;
      }

      // 3. Rich Contextual Scope
      const contextScope = {
        devflow: {
          workspacePath,
          activeProject: activeProjectName,
          activeFile: activeFilePath,
          openFilesCount: openFiles.length,
          openFiles: openFiles.map((f) => f.path),
          editorErrors,
          editorWarnings,
          problemsCount: allProblems.length,
          issuesCount: gitIssues.length,
        },
        git: {
          status: async () => {
            if (!window.electronAPI?.shell?.exec) return 'shell indisp';
            const r = await window.electronAPI.shell.exec('git status --short', workspacePath);
            return r.stdout.trim() || 'working tree clean';
          },
          branch: async () => {
            if (!window.electronAPI?.shell?.exec) return 'shell indisp';
            const r = await window.electronAPI.shell.exec('git branch --show-current', workspacePath);
            return r.stdout.trim();
          },
          log: async (n = 3) => {
            if (!window.electronAPI?.shell?.exec) return 'shell indisp';
            const r = await window.electronAPI.shell.exec(`git log -n ${n} --oneline`, workspacePath);
            return r.stdout.trim();
          },
        },
        ports: async () => {
          if (window.electronAPI?.ports?.scan) {
            const r = await window.electronAPI.ports.scan();
            return r.ports;
          }
          return [];
        },
        exec: async (cmd: string) => {
          if (!window.electronAPI?.shell?.exec) return 'shell indisponivel';
          const r = await window.electronAPI.shell.exec(cmd, workspacePath);
          return r.stdout.trim() || r.stderr.trim();
        },
        logs: () => {
          try {
            return JSON.parse(localStorage.getItem('devflow_system_activity_logs') || '[]');
          } catch {
            return [];
          }
        },
      };

      // Wrap in async function to support 'await' syntax seamlessly
      const funcBody = `
        return (async () => {
          const { devflow, git, ports, exec, logs } = context;
          return (${rawCmd});
        })();
      `;

      const evaluator = new Function('context', funcBody);
      const evalResult = await evaluator(contextScope);

      let formatted = '';
      if (evalResult === undefined) {
        formatted = 'undefined';
      } else if (evalResult === null) {
        formatted = 'null';
      } else if (typeof evalResult === 'object') {
        try {
          formatted = JSON.stringify(evalResult, null, 2);
        } catch {
          formatted = String(evalResult);
        }
      } else {
        formatted = String(evalResult);
      }

      setHistory((prev) => [
        ...prev,
        {
          id: `res-${Date.now()}`,
          type: 'result',
          content: formatted,
          rawObj: evalResult,
          timestamp: Date.now(),
        },
      ]);

      logSystemActivity('debug_console', 'evaluate', activeProjectName, { command: rawCmd });
    } catch (err: any) {
      setHistory((prev) => [
        ...prev,
        {
          id: `err-${Date.now()}`,
          type: 'error',
          content: `${err.name || 'Error'}: ${err.message}`,
          timestamp: Date.now(),
        },
      ]);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      evaluateCommand(commandInput);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const nextIdx = Math.min(historyIndex + 1, commandHistory.length - 1);
        setHistoryIndex(nextIdx);
        setCommandInput(commandHistory[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setCommandInput(commandHistory[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setCommandInput('');
      }
    }
  };

  const handleCopyHistory = () => {
    const text = history.map((h) => `${h.type === 'input' ? '> ' : ''}${h.content}`).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  const filteredHistory = useMemo(() => {
    if (!searchFilter.trim()) return history;
    const q = searchFilter.toLowerCase().trim();
    return history.filter((h) => h.content.toLowerCase().includes(q));
  }, [history, searchFilter]);

  // Quick Action Chips
  const quickActions = [
    { label: 'devflow.activeProject', cmd: 'devflow.activeProject' },
    { label: '$ git status', cmd: '$ git status --short' },
    { label: 'await ports()', cmd: 'await ports()' },
    { label: 'process.platform', cmd: 'process.platform' },
    { label: 'devflow.problemsCount', cmd: 'devflow.problemsCount' },
  ];

  return (
    <div
      style={{
        flex: '1 1 0',
        alignSelf: 'stretch',
        padding: '12px',
        gap: '12px',
        background: themeTokens.bgCard,
        borderRadius: 0,
        border: 'none',
        flexDirection: 'column',
        display: 'flex',
        overflow: 'hidden',
        boxSizing: 'border-box',
        height: '100%',
      }}
    >
      {/* Top Toolbar: Quick Action Chips + Search + Actions */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          flexShrink: 0,
          whiteSpace: 'nowrap',
        }}
      >
        {/* Left: Quick chips */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', scrollbarWidth: 'none' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: accentColor, marginRight: 2 }}>
            <Bug size={12} />
            <span style={{ fontSize: 11, fontFamily: 'Poppins, -apple-system, sans-serif', fontWeight: 400 }}>
              Console
            </span>
          </div>

          {quickActions.map((qa, idx) => (
            <div
              key={idx}
              onClick={() => evaluateCommand(qa.cmd)}
              style={{
                padding: '2px 8px',
                height: 22,
                borderRadius: 4,
                border: 'none',
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                color: themeTokens.textSecondary,
                fontSize: 10.5,
                fontFamily: 'JetBrains Mono, Menlo, monospace',
                fontWeight: 400,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 4,
                transition: 'all 0.12s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
                (e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary;
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)';
                (e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary;
              }}
              title={`Executar: ${qa.cmd}`}
            >
              <Play size={9} color={accentColor} />
              <span>{qa.label}</span>
            </div>
          ))}
        </div>

        {/* Right: Search Filter + Copy + Clear */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {/* Search Box */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 8px',
              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
              borderRadius: 4,
              border: 'none',
              height: 26,
              boxSizing: 'border-box',
            }}
          >
            <Search size={12} color={themeTokens.textSecondary} />
            <input
              type="text"
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder="Filtrar console..."
              style={{
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: themeTokens.textPrimary,
                fontSize: 11,
                fontFamily: 'Poppins, -apple-system, sans-serif',
                fontWeight: 400,
                width: 120,
              }}
            />
          </div>

          {/* Copy History */}
          <div
            onClick={handleCopyHistory}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 6px',
              height: 26,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: copied ? '#3fb950' : themeTokens.textSecondary,
              fontSize: 11,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
            title="Copiar histórico do console"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
          </div>

          {/* Clear Console */}
          <div
            onClick={() => setHistory([])}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 6px',
              height: 26,
              borderRadius: 4,
              border: 'none',
              background: 'transparent',
              color: themeTokens.textSecondary,
              fontSize: 11,
              fontFamily: 'Poppins, -apple-system, sans-serif',
              fontWeight: 400,
              cursor: 'pointer',
              transition: 'all 0.12s ease',
            }}
            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ef4444')}
            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
            title="Limpar console"
          >
            <Trash2 size={12} />
          </div>
        </div>
      </div>

      {/* Console Output Stream */}
      <div
        style={{
          flex: '1 1 0',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          overflowY: 'auto',
          minHeight: 0,
          fontFamily: 'JetBrains Mono, Menlo, monospace',
          fontSize: 11.5,
          lineHeight: '18px',
          background: isEffectiveDark ? 'rgba(0, 0, 0, 0.2)' : 'rgba(0, 0, 0, 0.02)',
          padding: '8px 10px',
          borderRadius: 4,
          border: 'none',
        }}
      >
        {filteredHistory.map((item) => {
          if (item.type === 'input') {
            return (
              <div key={item.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '6px' }}>
                <span style={{ color: accentColor, fontWeight: 500, flexShrink: 0 }}>&gt;</span>
                <span style={{ color: themeTokens.textPrimary, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {item.content}
                </span>
              </div>
            );
          }

          if (item.type === 'shell') {
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                  color: isEffectiveDark ? '#e4e4e7' : '#27272a',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  paddingLeft: 12,
                  opacity: 0.9,
                }}
              >
                {item.content}
              </div>
            );
          }

          if (item.type === 'error') {
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                  color: '#ef4444',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all',
                  paddingLeft: 12,
                }}
              >
                <span>{item.content}</span>
              </div>
            );
          }

          if (item.type === 'info') {
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '6px',
                  color: themeTokens.textSecondary,
                  opacity: 0.75,
                  fontSize: 11,
                  fontFamily: 'Poppins, -apple-system, sans-serif',
                  fontWeight: 400,
                  paddingLeft: 4,
                }}
              >
                <span>{item.content}</span>
              </div>
            );
          }

          // Result item
          return (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '6px',
                color: '#3fb950',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-all',
                paddingLeft: 12,
              }}
            >
              <span style={{ opacity: 0.6, flexShrink: 0 }}>&lt;</span>
              <span>{item.content}</span>
            </div>
          );
        })}
        <div ref={listEndRef} />
      </div>

      {/* Expression Input Form at Bottom */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          evaluateCommand(commandInput);
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 8px',
          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
          borderRadius: 4,
          border: 'none',
          flexShrink: 0,
        }}
      >
        <span style={{ color: accentColor, fontWeight: 600, fontSize: 13, fontFamily: 'JetBrains Mono, Menlo, monospace' }}>
          &gt;
        </span>
        <input
          ref={inputRef}
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Avaliar expressão JS/TS ou comando $ (ex: process.platform, git.status(), devflow.project, 2 + 2)"
          disabled={isExecuting}
          style={{
            flex: 1,
            background: 'transparent',
            border: 'none',
            outline: 'none',
            color: themeTokens.textPrimary,
            fontSize: 11.5,
            fontFamily: 'JetBrains Mono, Menlo, monospace',
            fontWeight: 400,
          }}
        />
        {isExecuting && (
          <span style={{ fontSize: 10, color: themeTokens.textSecondary, fontFamily: 'Poppins, -apple-system, sans-serif' }}>
            executando...
          </span>
        )}
      </form>
    </div>
  );
};
