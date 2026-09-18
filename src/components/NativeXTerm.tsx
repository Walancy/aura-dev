import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { hexToRgba } from '../utils/color';

// Real Native XTerm.js Terminal connected to node-pty
export interface NativeXTermProps {
  sessionId: string;
  sessionType?: string;
  cwd: string;
  isActive: boolean;
  initialCommand?: string;
  accentColor?: string;
  isDark?: boolean;
  fontSize?: number;
  cursorStyle?: 'block' | 'bar' | 'underline';
  cursorBlink?: boolean;
  scrollback?: number;
  copyOnSelect?: boolean;
}

export const NativeXTerm: React.FC<NativeXTermProps> = ({
  sessionId,
  sessionType = 'zsh',
  cwd,
  isActive,
  initialCommand,
  accentColor = '#FF6A00',
  isDark = true,
  fontSize = 12,
  cursorStyle = 'block',
  cursorBlink = true,
  scrollback = 5000,
  copyOnSelect = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const copyOnSelectRef = useRef(copyOnSelect);
  copyOnSelectRef.current = copyOnSelect;

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      cursorBlink,
      cursorStyle,
      fontSize,
      scrollback,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: isDark ? '#101010' : '#ffffff',
        foreground: isDark ? '#d8dade' : '#1f2937',
        cursor: accentColor,
        selectionBackground: hexToRgba(accentColor, 0.35),
        black: isDark ? '#1a1d24' : '#e5e7eb',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: isDark ? '#f8fafc' : '#111827',
        brightBlack: '#64748b',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: isDark ? '#ffffff' : '#000000',
      },
      convertEol: true,
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(containerRef.current);

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    setTimeout(() => {
      try {
        fitAddon.fit();
      } catch {}
    }, 60);

    let cleanupDataListener: (() => void) | null = null;

    if (window.electronAPI?.pty) {
      const pty = window.electronAPI.pty;

      // Spawn native PTY session with current accentColor for prompt highlighting
      pty.create(sessionId, sessionType, cwd, term.cols || 80, term.rows || 24, accentColor);

      // If initialCommand is provided (e.g. automatic CLI installation or slash command), send it once prompt is ready
      if (initialCommand) {
        const delay = sessionType === 'zsh' || sessionType === 'bash' ? 500 : 1200;
        setTimeout(() => {
          pty.write(sessionId, `${initialCommand}\r`);
        }, delay);
      }

      // Load buffer history if session was already active
      pty.getHistory?.(sessionId).then((history) => {
        if (history) term.write(history);
      }).catch(() => {});

      cleanupDataListener = pty.onData((payload) => {
        if (payload.id === sessionId) {
          term.write(payload.data);
        }
      });

      const onDataDisp = term.onData((data) => {
        pty.write(sessionId, data);
      });

      const onSelectionDisp = term.onSelectionChange(() => {
        if (copyOnSelectRef.current && term.hasSelection()) {
          navigator.clipboard.writeText(term.getSelection()).catch(() => {});
        }
      });

      const handleResize = () => {
        try {
          fitAddon.fit();
          pty.resize(sessionId, term.cols, term.rows);
        } catch {}
      };

      const resizeObserver = new ResizeObserver(() => {
        handleResize();
      });
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      window.addEventListener('resize', handleResize);

      return () => {
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
        onDataDisp.dispose();
        onSelectionDisp.dispose();
        if (cleanupDataListener) cleanupDataListener();
        term.dispose();
      };
    } else {
      term.writeln('Terminal nativo disponível no aplicativo desktop.');
      return () => {
        term.dispose();
      };
    }
  }, [sessionId, sessionType, cwd]);

  // Dynamically update terminal theme when accentColor or themeMode (isDark) changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = {
        background: isDark ? '#101010' : '#ffffff',
        foreground: isDark ? '#d8dade' : '#1f2937',
        cursor: accentColor,
        cursorAccent: isDark ? '#101010' : '#ffffff',
        selectionBackground: hexToRgba(accentColor, 0.35),
        black: isDark ? '#1a1d24' : '#e5e7eb',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: isDark ? '#f8fafc' : '#111827',
        brightBlack: '#64748b',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: isDark ? '#ffffff' : '#000000',
      };
    }
  }, [accentColor, isDark]);

  // Dynamically apply font size, cursor style/blink and scrollback settings changes
  // without tearing down the PTY-backed session (which would lose scroll position).
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.fontSize = fontSize;
      termRef.current.options.cursorStyle = cursorStyle;
      termRef.current.options.cursorBlink = cursorBlink;
      termRef.current.options.scrollback = scrollback;
      try {
        fitAddonRef.current?.fit();
        if (window.electronAPI?.pty && termRef.current) {
          window.electronAPI.pty.resize(sessionId, termRef.current.cols, termRef.current.rows);
        }
      } catch {}
    }
  }, [fontSize, cursorStyle, cursorBlink, scrollback, sessionId]);

  // When tab becomes active, fit and focus
  useEffect(() => {
    if (isActive && termRef.current && fitAddonRef.current) {
      const timer = setTimeout(() => {
        try {
          fitAddonRef.current?.fit();
          if (window.electronAPI?.pty && termRef.current) {
            window.electronAPI.pty.resize(sessionId, termRef.current.cols, termRef.current.rows);
          }
          termRef.current?.focus();
        } catch {}
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isActive, sessionId]);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        flex: 1,
        overflow: 'hidden',
        background: isDark ? '#101010' : '#ffffff',
        display: isActive ? 'block' : 'none',
      }}
      onClick={() => termRef.current?.focus()}
    />
  );
};
