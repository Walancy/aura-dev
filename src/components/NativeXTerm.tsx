import React, { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { hexToRgba } from '../utils/color';

const TERMINAL_FONT_FAMILY = '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace';

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
  onFocus?: () => void;
  onTitleChange?: (title: string) => void;
  alwaysVisible?: boolean;
  onOpenUrl?: (url: string) => void;
  onServerUrlDetected?: (url: string) => void;
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
  onFocus,
  onTitleChange,
  alwaysVisible = false,
  onOpenUrl,
  onServerUrlDetected,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const copyOnSelectRef = useRef(copyOnSelect);
  copyOnSelectRef.current = copyOnSelect;
  const onFocusRef = useRef(onFocus);
  onFocusRef.current = onFocus;
  const onTitleChangeRef = useRef(onTitleChange);
  onTitleChangeRef.current = onTitleChange;
  const onOpenUrlRef = useRef(onOpenUrl);
  onOpenUrlRef.current = onOpenUrl;
  const onServerUrlDetectedRef = useRef(onServerUrlDetected);
  onServerUrlDetectedRef.current = onServerUrlDetected;
  const lastDetectedUrlRef = useRef<string>('');
  const lastDetectedUrlTimeRef = useRef<number>(0);

  // Intercept Ctrl/Cmd + scroll so xterm does not swallow canvas zoom gestures
  useEffect(() => {
    const containerEl = containerRef.current;
    if (!containerEl) return;

    const handleWheel = (e: WheelEvent) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(
          new CustomEvent('orchestration-zoom', {
            detail: {
              clientX: e.clientX,
              clientY: e.clientY,
              deltaY: e.deltaY,
            },
          })
        );
      }
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Evita que atalhos globais do IDE (como Escape ou Ctrl+C para cancelar chat) sejam acionados pelo terminal
      // Registrado na fase de BUBBLING (não capture), para que o xterm interno processe primeiro no textarea (Backspace, Enter, setas, etc.)
      e.stopPropagation();
    };

    containerEl.addEventListener('wheel', handleWheel, { passive: false, capture: true });
    containerEl.addEventListener('keydown', handleKeyDown, false);
    return () => {
      containerEl.removeEventListener('wheel', handleWheel, { capture: true } as any);
      containerEl.removeEventListener('keydown', handleKeyDown, false as any);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      cursorBlink,
      cursorStyle,
      fontSize,
      scrollback,
      fontFamily: TERMINAL_FONT_FAMILY,
      theme: {
        background: isDark ? '#101010' : '#ffffff',
        foreground: isDark ? '#dcdcdc' : '#1f1f1f',
        cursor: accentColor,
        selectionBackground: hexToRgba(accentColor, 0.35),
        black: isDark ? '#1a1a1a' : '#e5e5e5',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: isDark ? '#f8f8f8' : '#111111',
        brightBlack: '#64748b',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: isDark ? '#ffffff' : '#000000',
      },
      // Sem convertEol: o PTY já entrega \r\n. Converter \n quebrava CLIs de tela cheia (Ink/TUI),
      // que usam \n para mover o cursor e ficavam com texto deslocado e restos na tela.
      allowProposedApi: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);

    // Larguras Unicode 11 (as mesmas que as CLIs modernas assumem) para símbolos e emojis.
    const unicode11 = new Unicode11Addon();
    term.loadAddon(unicode11);
    term.unicode.activeVersion = '11';

    // WebLinksAddon: Intercept URL clicks so Orchestration can route to connected canvas browser
    const webLinksAddon = new WebLinksAddon((event: MouseEvent, uri: string) => {
      event.preventDefault();
      event.stopPropagation();
      if (onOpenUrlRef.current) {
        onOpenUrlRef.current(uri);
      } else if (window.electronAPI?.shell?.openExternal) {
        window.electronAPI.shell.openExternal(uri);
      } else {
        window.open(uri, '_blank');
      }
    });
    term.loadAddon(webLinksAddon);

    term.open(containerRef.current);
    term.focus();

    // Garante que Backspace, Delete e atalhos de apagar funcionem com precisão no CLI
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      // Deixar Cmd+C / Ctrl+C copiar seleção nativa quando houver texto selecionado
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'c' || e.key === 'C')) {
        if (term.hasSelection()) {
          return false;
        }
      }
      // Deixar Cmd+V / Ctrl+V colar nativamente
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'v' || e.key === 'V')) {
        return false;
      }

      // Atalhos de apagar:
      if (e.type === 'keydown' && e.key === 'Backspace') {
        const pty = window.electronAPI?.pty;
        if (pty) {
          if (e.altKey && !e.metaKey && !e.ctrlKey) {
            // Option + Backspace: apaga palavra anterior (Ctrl+W)
            pty.write(sessionId, '\x17');
            e.preventDefault();
            return false;
          }
          if (e.metaKey && !e.altKey && !e.ctrlKey) {
            // Cmd + Backspace: apaga linha inteira (Ctrl+U)
            pty.write(sessionId, '\x15');
            e.preventDefault();
            return false;
          }
          // Backspace normal: envia \x7f (DEL) diretamente ao PTY
          pty.write(sessionId, '\x7f');
          e.preventDefault();
          return false;
        }
      }

      if (e.type === 'keydown' && e.key === 'Delete') {
        const pty = window.electronAPI?.pty;
        if (pty) {
          pty.write(sessionId, '\x1b[3~');
          e.preventDefault();
          return false;
        }
      }

      return true;
    });

    // OSC 7777 "open-url;<url>": emitida pelos shims `open`/$BROWSER do PTY quando um projeto ou a
    // IA tenta abrir um site — roteia para o navegador conectado em vez do navegador do sistema.
    const oscDisp = term.parser.registerOscHandler(7777, (data) => {
      const match = data.match(/^open-url;(.+)$/s);
      if (!match) return false;
      const uri = match[1].trim();
      if (!/^https?:\/\//i.test(uri)) return true;
      if (onOpenUrlRef.current) onOpenUrlRef.current(uri);
      else window.electronAPI?.shell?.openExternal?.(uri);
      return true;
    });

    const onTitleDisp = term.onTitleChange((title) => {
      onTitleChangeRef.current?.(title);
    });

    termRef.current = term;
    fitAddonRef.current = fitAddon;

    const syncSize = () => {
      try {
        fitAddon.fit();
        window.electronAPI?.pty?.resize(sessionId, term.cols, term.rows);
      } catch {}
    };
    setTimeout(syncSize, 60);

    // A fonte pode terminar de carregar depois do term.open: o xterm mediu a célula com a fonte
    // substituta e as colunas ficavam desalinhadas. Remede quando a fonte real estiver pronta.
    let disposed = false;
    document.fonts?.load(`${fontSize}px "JetBrains Mono"`).then(() => {
      if (disposed) return;
      term.options.fontFamily = 'monospace';
      term.options.fontFamily = TERMINAL_FONT_FAMILY;
      syncSize();
    }).catch(() => {});

    let cleanupDataListener: (() => void) | null = null;

    if (window.electronAPI?.pty) {
      const pty = window.electronAPI.pty;

      // Spawn native PTY session with current accentColor for prompt highlighting
      pty.create(sessionId, sessionType, cwd, term.cols || 80, term.rows || 24, accentColor).then((res) => {
        // If initialCommand is provided (e.g. automatic CLI installation or slash command), send it once prompt is ready and session is fresh
        if (initialCommand && !res?.reused) {
          const delay = sessionType === 'zsh' || sessionType === 'bash' ? 500 : 1200;
          setTimeout(() => {
            pty.write(sessionId, `${initialCommand}\r`);
          }, delay);
        }
      }).catch(() => {});

      // Load buffer history if session was already active
      pty.getHistory?.(sessionId).then((history) => {
        if (history) term.write(history);
      }).catch(() => {});

      cleanupDataListener = pty.onData((payload) => {
        if (payload.id === sessionId) {
          term.write(payload.data);

          // Detect dev servers starting up (e.g. Vite, Next, React, Nest, Fastify)
          if (onServerUrlDetectedRef.current) {
            const serverMatch = payload.data.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+(?:\/[^\s\x1b]*)?/i);
            if (serverMatch) {
              const detectedUrl = serverMatch[0].replace('0.0.0.0', 'localhost');
              const now = Date.now();
              if (lastDetectedUrlRef.current !== detectedUrl || now - lastDetectedUrlTimeRef.current > 10000) {
                lastDetectedUrlRef.current = detectedUrl;
                lastDetectedUrlTimeRef.current = now;
                onServerUrlDetectedRef.current(detectedUrl);
              }
            }
          }
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
          if (!containerRef.current || containerRef.current.offsetWidth < 50 || containerRef.current.offsetHeight < 50) {
            return;
          }
          fitAddon.fit();
          if (term.cols > 5 && term.rows > 2) {
            pty.resize(sessionId, term.cols, term.rows);
          }
        } catch {}
      };

      const resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry || entry.contentRect.width < 50 || entry.contentRect.height < 50) {
          return;
        }
        handleResize();
      });
      if (containerRef.current) {
        resizeObserver.observe(containerRef.current);
      }

      const handleMouseDown = () => {
        onFocusRef.current?.();
        term.focus();
      };
      // Imagem na área de transferência (print, cópia de imagem): salva num arquivo e cola o caminho,
      // que as CLIs de IA (Claude Code, etc.) entendem como anexo, como no Warp
      const handleImagePaste = async (e: ClipboardEvent) => {
        const imageItem = Array.from(e.clipboardData?.items || []).find((i) => i.kind === 'file' && i.type.startsWith('image/'));
        const file = imageItem?.getAsFile();
        if (!file || !window.electronAPI?.fs?.saveTempImage) return;
        e.preventDefault();
        e.stopPropagation();
        try {
          const bytes = new Uint8Array(await file.arrayBuffer());
          let bin = '';
          for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          const res = await window.electronAPI.fs.saveTempImage(btoa(bin), file.type.split('/')[1]?.replace('jpeg', 'jpg'));
          if (res?.path) term.paste(res.path);
        } catch (err) {
          console.warn('[NativeXTerm] Falha ao colar imagem:', err);
        }
      };
      const containerEl = containerRef.current;
      if (containerEl) {
        containerEl.addEventListener('mousedown', handleMouseDown, true);
        containerEl.addEventListener('paste', handleImagePaste, true);
      }

      window.addEventListener('resize', handleResize);

      return () => {
        disposed = true;
        if (containerEl) {
          containerEl.removeEventListener('mousedown', handleMouseDown, true);
          containerEl.removeEventListener('paste', handleImagePaste, true);
        }
        window.removeEventListener('resize', handleResize);
        resizeObserver.disconnect();
        onTitleDisp.dispose();
        oscDisp.dispose();
        onDataDisp.dispose();
        onSelectionDisp.dispose();
        webLinksAddon.dispose();
        if (cleanupDataListener) cleanupDataListener();
        term.dispose();
      };
    } else {
      term.writeln('Terminal nativo disponível no aplicativo desktop.');
      return () => {
        disposed = true;
        oscDisp.dispose();
        webLinksAddon.dispose();
        term.dispose();
      };
    }
  }, [sessionId, sessionType]);

  // When cwd prop changes (e.g. user selected another project in the header),
  // update the session cwd and navigate the shell only if it is idle.
  const prevCwdRef = useRef(cwd);
  useEffect(() => {
    if (prevCwdRef.current !== cwd && cwd) {
      prevCwdRef.current = cwd;
      if (window.electronAPI?.pty) {
        window.electronAPI.pty.setCwd?.(sessionId, cwd);
      }
    }
  }, [cwd, sessionId]);

  // Dynamically update terminal theme when accentColor or themeMode (isDark) changes
  useEffect(() => {
    if (termRef.current) {
      termRef.current.options.theme = {
        background: isDark ? '#101010' : '#ffffff',
        foreground: isDark ? '#dcdcdc' : '#1f1f1f',
        cursor: accentColor,
        cursorAccent: isDark ? '#101010' : '#ffffff',
        selectionBackground: hexToRgba(accentColor, 0.35),
        black: isDark ? '#1a1a1a' : '#e5e5e5',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: isDark ? '#f8f8f8' : '#111111',
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

  // When tab/card becomes active, fit and focus
  useEffect(() => {
    if (isActive && termRef.current && fitAddonRef.current) {
      const timer = setTimeout(() => {
        try {
          if (containerRef.current && containerRef.current.offsetWidth >= 50 && containerRef.current.offsetHeight >= 50) {
            fitAddonRef.current?.fit();
            if (window.electronAPI?.pty && termRef.current && termRef.current.cols > 5 && termRef.current.rows > 2) {
              window.electronAPI.pty.resize(sessionId, termRef.current.cols, termRef.current.rows);
            }
            termRef.current?.focus();
          }
        } catch {}
      }, 60);
      return () => clearTimeout(timer);
    }
  }, [isActive, sessionId]);

  // Listener para foco programático do terminal (ex: ao clicar em "Enviar issue")
  useEffect(() => {
    const handleFocusEvent = (e: any) => {
      if (!e.detail?.sessionId || e.detail.sessionId === sessionId) {
        if (isActive && termRef.current) {
          termRef.current.focus();
        }
      }
    };
    window.addEventListener('devflow:focus-terminal', handleFocusEvent);
    return () => window.removeEventListener('devflow:focus-terminal', handleFocusEvent);
  }, [sessionId, isActive]);

  return (
    <div
      ref={containerRef}
      data-session-id={sessionId}
      data-terminal="true"
      style={{
        width: '100%',
        height: '100%',
        flex: 1,
        overflow: 'hidden',
        background: isDark ? '#101010' : '#ffffff',
        display: (alwaysVisible || isActive) ? 'block' : 'none',
      }}
      onClick={() => termRef.current?.focus()}
    />
  );
};
