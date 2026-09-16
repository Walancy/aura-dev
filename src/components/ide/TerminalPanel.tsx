import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  Terminal as TerminalIcon,
  Plus,
  Trash2,
  ChevronDown,
  Sparkles,
  Zap,
} from 'lucide-react';
import { TerminalTab } from '../../types';

interface TerminalPanelProps {
  projectCwd: string;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({ projectCwd }) => {
  const [tabs, setTabs] = useState<TerminalTab[]>([
    { id: 'term-zsh-1', title: 'zsh', type: 'zsh' },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('term-zsh-1');
  const [isCollapsed, setIsCollapsed] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const terminalInstanceRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];
  const isElectron = typeof window !== 'undefined' && (window as any).electronAPI !== undefined;

  useEffect(() => {
    if (!containerRef.current || isCollapsed) return;

    const term = new Terminal({
      cursorBlink: true,
      cursorStyle: 'bar',
      fontSize: 12,
      fontFamily: 'JetBrains Mono, Menlo, Courier New, monospace',
      theme: {
        background: '#0c0d12',
        foreground: '#e2e8f0',
        cursor: '#ff6600',
        selectionBackground: 'rgba(255, 102, 0, 0.3)',
        black: '#1a1d24',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f8fafc',
        brightBlack: '#64748b',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);
    fitAddon.fit();

    terminalInstanceRef.current = term;
    fitAddonRef.current = fitAddon;

    let cleanupDataListener: (() => void) | null = null;
    let ws: WebSocket | null = null;

    if (isElectron) {
      // Native Electron IPC Mode
      const electronPty = (window as any).electronAPI.pty;
      electronPty.create(activeTab.id, activeTab.type, projectCwd, term.cols, term.rows);

      cleanupDataListener = electronPty.onData((payload: { id: string; data: string }) => {
        if (payload.id === activeTab.id) {
          term.write(payload.data);
        }
      });

      const onDataDisposable = term.onData((data) => {
        electronPty.write(activeTab.id, data);
      });

      const handleResize = () => {
        try {
          fitAddon.fit();
          electronPty.resize(activeTab.id, term.cols, term.rows);
        } catch {}
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        onDataDisposable.dispose();
        if (cleanupDataListener) cleanupDataListener();
        term.dispose();
      };
    } else {
      // WebSocket Fallback Mode
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        ws?.send(
          JSON.stringify({
            type: 'pty_create',
            id: activeTab.id,
            sessionType: activeTab.type,
            cwd: projectCwd,
            cols: term.cols,
            rows: term.rows,
          })
        );
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if ((msg.type === 'pty_output' || msg.type === 'pty_history') && msg.id === activeTab.id) {
            term.write(msg.data);
          }
        } catch {
          term.write(event.data);
        }
      };

      const onDataDisposable = term.onData((data) => {
        if (ws?.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'pty_input', id: activeTab.id, data }));
        }
      });

      const handleResize = () => {
        try {
          fitAddon.fit();
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'pty_resize', id: activeTab.id, cols: term.cols, rows: term.rows }));
          }
        } catch {}
      };

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        onDataDisposable.dispose();
        term.dispose();
        if (ws?.readyState === WebSocket.OPEN) ws.close();
      };
    }
  }, [activeTabId, isCollapsed, projectCwd]);

  const addTab = (type: 'zsh' | 'claude' | 'agy') => {
    const id = `term-${type}-${Date.now()}`;
    let title = 'zsh';
    if (type === 'claude') title = 'Claude Code CLI';
    if (type === 'agy') title = 'AGY CLI (Agent)';

    const newTab: TerminalTab = { id, title, type };
    setTabs((prev) => [...prev, newTab]);
    setActiveTabId(id);
  };

  const closeTab = (id: string) => {
    if (tabs.length === 1) return;
    if (isElectron) {
      (window as any).electronAPI.pty.kill(id);
    }
    const remaining = tabs.filter((t) => t.id !== id);
    setTabs(remaining);
    if (activeTabId === id) {
      setActiveTabId(remaining[0].id);
    }
  };

  return (
    <div
      style={{
        height: isCollapsed ? '32px' : '230px',
        backgroundColor: 'var(--bg-main)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'height 0.2s ease',
      }}
    >
      <div
        style={{
          height: '32px',
          backgroundColor: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span
            style={{
              fontSize: '0.72rem',
              fontWeight: 700,
              color: 'var(--text-secondary)',
              textTransform: 'uppercase',
              marginRight: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
            }}
          >
            <TerminalIcon size={13} color="var(--accent-orange)" />
            Terminal {isElectron && <span style={{ fontSize: '0.6rem', color: '#10b981' }}>(Native IPC)</span>}
          </span>

          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <div
                key={tab.id}
                onClick={() => setActiveTabId(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: isActive ? 600 : 400,
                  backgroundColor: isActive ? '#0c0d12' : 'transparent',
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  border: isActive ? '1px solid var(--border-active)' : '1px solid transparent',
                  cursor: 'pointer',
                }}
              >
                {tab.type === 'claude' && <Sparkles size={11} color="var(--accent-orange)" />}
                {tab.type === 'agy' && <Zap size={11} color="var(--accent-cyan)" />}
                <span>{tab.title}</span>
                {tabs.length > 1 && (
                  <span
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}
                  >
                    ×
                  </span>
                )}
              </div>
            );
          })}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button
            onClick={() => addTab('claude')}
            className="btn-secondary"
            style={{
              padding: '2px 8px',
              fontSize: '0.72rem',
              borderColor: 'rgba(255, 102, 0, 0.4)',
              color: 'var(--accent-orange)',
            }}
            title="Abrir terminal nativo com Claude Code CLI"
          >
            <Sparkles size={12} />
            <span>+ Claude Code</span>
          </button>

          <button
            onClick={() => addTab('agy')}
            className="btn-secondary"
            style={{
              padding: '2px 8px',
              fontSize: '0.72rem',
              borderColor: 'rgba(0, 210, 255, 0.4)',
              color: 'var(--accent-cyan)',
            }}
            title="Abrir terminal nativo com Antigravity CLI"
          >
            <Zap size={12} />
            <span>+ AGY CLI</span>
          </button>

          <button onClick={() => addTab('zsh')} className="btn-icon" title="Novo Terminal zsh">
            <Plus size={14} />
          </button>

          <button onClick={() => closeTab(activeTabId)} className="btn-icon" title="Encerrar Sessão">
            <Trash2 size={13} />
          </button>

          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="btn-icon"
            title={isCollapsed ? 'Expandir Terminal' : 'Recolher Terminal'}
          >
            <ChevronDown
              size={14}
              style={{
                transform: isCollapsed ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s',
              }}
            />
          </button>
        </div>
      </div>

      {!isCollapsed && (
        <div
          ref={containerRef}
          style={{
            flex: 1,
            width: '100%',
            height: 'calc(100% - 32px)',
            backgroundColor: '#0c0d12',
          }}
        />
      )}
    </div>
  );
};
