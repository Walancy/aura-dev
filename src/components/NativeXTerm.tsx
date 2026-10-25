import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { playTypingEffect } from './typingEffects';
import { Terminal as XTerm, type IDecoration, type IMarker } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { TerminalSkinBackground, TerminalSkinOverlay, skinGlow, skinTint, type TerminalSkinId } from './TerminalSkin';
import { WebLinksAddon } from '@xterm/addon-web-links';
import { Unicode11Addon } from '@xterm/addon-unicode11';
import { hexToRgba } from '../utils/color';

const TERMINAL_FONT_FAMILY = '"JetBrains Mono", Menlo, Monaco, "Courier New", monospace';

/** Cmd+A: seleciona do primeiro ao último texto do buffer; o selectAll do xterm pinta também as linhas vazias do fim (um bloco da cor de destaque) */
const selectContent = (term: XTerm) => {
  const b = term.buffer.active;
  let first = -1, last = -1;
  for (let i = 0; i < b.length; i++) {
    if (b.getLine(i)?.translateToString(true)) { if (first < 0) first = i; last = i; }
  }
  if (first < 0) return;
  term.select(0, first, (last - first) * term.cols + b.getLine(last)!.translateToString(true).length);
};

export interface TerminalThemeDef {
  id: string;
  name: string;
  background: string;
  foreground: string;
  cursor?: string;
  black?: string;
  red?: string;
  green?: string;
  yellow?: string;
  blue?: string;
  magenta?: string;
  cyan?: string;
  white?: string;
  brightBlack?: string;
  brightRed?: string;
  brightGreen?: string;
  brightYellow?: string;
  brightBlue?: string;
  brightMagenta?: string;
  brightCyan?: string;
  brightWhite?: string;
}

export const TERMINAL_THEMES: Record<string, TerminalThemeDef> = {
  default: {
    id: 'default',
    name: 'Aura Dev Escuro',
    background: '#101010',
    foreground: '#dcdcdc',
    black: '#1a1a1a',
    red: '#ef4444',
    green: '#10b981',
    yellow: '#f59e0b',
    blue: '#3b82f6',
    magenta: '#a855f7',
    cyan: '#06b6d4',
    white: '#f8f8f8',
    brightBlack: '#64748b',
    brightRed: '#f87171',
    brightGreen: '#34d399',
    brightYellow: '#fbbf24',
    brightBlue: '#60a5fa',
    brightMagenta: '#c084fc',
    brightCyan: '#22d3ee',
    brightWhite: '#ffffff',
  },
  'tokyo-night': {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    background: '#1a1b26',
    foreground: '#c0caf5',
    black: '#15161e',
    red: '#f7768e',
    green: '#9ece6a',
    yellow: '#e0af68',
    blue: '#7aa2f7',
    magenta: '#bb9af7',
    cyan: '#7dcfff',
    white: '#a9b1d6',
    brightBlack: '#414868',
    brightRed: '#f7768e',
    brightGreen: '#9ece6a',
    brightYellow: '#e0af68',
    brightBlue: '#7aa2f7',
    brightMagenta: '#bb9af7',
    brightCyan: '#7dcfff',
    brightWhite: '#c0caf5',
  },
  dracula: {
    id: 'dracula',
    name: 'Dracula',
    background: '#282a36',
    foreground: '#f8f8f2',
    black: '#21222c',
    red: '#ff5555',
    green: '#50fa7b',
    yellow: '#f1fa8c',
    blue: '#bd93f9',
    magenta: '#ff79c6',
    cyan: '#8be9fd',
    white: '#f8f8f2',
    brightBlack: '#6272a4',
    brightRed: '#ff6e6e',
    brightGreen: '#69ff94',
    brightYellow: '#ffffa5',
    brightBlue: '#d6acff',
    brightMagenta: '#ff92df',
    brightCyan: '#a4ffff',
    brightWhite: '#ffffff',
  },
  'one-dark': {
    id: 'one-dark',
    name: 'One Dark Pro',
    background: '#1e1e24',
    foreground: '#abb2bf',
    black: '#282c34',
    red: '#e06c75',
    green: '#98c379',
    yellow: '#d19a66',
    blue: '#61afef',
    magenta: '#c678dd',
    cyan: '#56b6c2',
    white: '#abb2bf',
    brightBlack: '#5c6370',
    brightRed: '#be5046',
    brightGreen: '#98c379',
    brightYellow: '#e5c07b',
    brightBlue: '#61afef',
    brightMagenta: '#c678dd',
    brightCyan: '#56b6c2',
    brightWhite: '#ffffff',
  },
  monokai: {
    id: 'monokai',
    name: 'Monokai',
    background: '#272822',
    foreground: '#f8f8f2',
    black: '#272822',
    red: '#f92672',
    green: '#a6e22e',
    yellow: '#f4bf75',
    blue: '#66d9ef',
    magenta: '#ae81ff',
    cyan: '#a1efe4',
    white: '#f8f8f2',
    brightBlack: '#75715e',
    brightRed: '#f92672',
    brightGreen: '#a6e22e',
    brightYellow: '#f4bf75',
    brightBlue: '#66d9ef',
    brightMagenta: '#ae81ff',
    brightCyan: '#a1efe4',
    brightWhite: '#f9f8f5',
  },
  'github-dark': {
    id: 'github-dark',
    name: 'GitHub Dark',
    background: '#0d1117',
    foreground: '#c9d1d9',
    black: '#161b22',
    red: '#ff7b72',
    green: '#3fb950',
    yellow: '#d29922',
    blue: '#58a6ff',
    magenta: '#bc8cff',
    cyan: '#39c5cf',
    white: '#b1bac4',
    brightBlack: '#484f58',
    brightRed: '#ffa198',
    brightGreen: '#56d364',
    brightYellow: '#e3b341',
    brightBlue: '#79c0ff',
    brightMagenta: '#d2a8ff',
    brightCyan: '#56d4dd',
    brightWhite: '#f0f6fc',
  },
  // Estilos com moldura própria (Configurações → Terminal → Estilo visual)
  cyberdeck: {
    id: 'cyberdeck',
    name: 'Cyberdeck',
    background: '#20121a',
    foreground: '#ff9189',
    black: '#2b1a22',
    red: '#ff4d4d',
    green: '#4fd1c5',
    yellow: '#ffb86b',
    blue: '#4a9fe0',
    magenta: '#ff6fae',
    cyan: '#59c2d6',
    white: '#ffd7d2',
    brightBlack: '#8a5a66',
    brightRed: '#ff7a70',
    brightGreen: '#7fe6da',
    brightYellow: '#ffd08a',
    brightBlue: '#79bdf2',
    brightMagenta: '#ff94c4',
    brightCyan: '#8adbe9',
    brightWhite: '#fff0ee',
  },
  industrial: {
    id: 'industrial',
    name: 'Industrial',
    background: '#0a0a0a',
    foreground: '#efe6c4',
    black: '#1a1a1a',
    red: '#ee5a3a',
    green: '#b9c27a',
    yellow: '#f2a33a',
    blue: '#8fa8b8',
    magenta: '#d9774f',
    cyan: '#a7c4b5',
    white: '#d8d0b4',
    brightBlack: '#6b6558',
    brightRed: '#ff7a55',
    brightGreen: '#d3dc95',
    brightYellow: '#ffc060',
    brightBlue: '#b0c6d4',
    brightMagenta: '#f0956f',
    brightCyan: '#c4dccf',
    brightWhite: '#fffbe8',
  },
  amber: {
    id: 'amber',
    name: 'Âmbar CRT',
    background: '#1a0f05',
    foreground: '#ffb43a',
    black: '#1c1206',
    red: '#ff6a3a',
    green: '#c9a227',
    yellow: '#ffcf5a',
    blue: '#e0a050',
    magenta: '#ff8a4a',
    cyan: '#ffd08a',
    white: '#ffe0a8',
    brightBlack: '#8a6a2a',
    brightRed: '#ff8a60',
    brightGreen: '#e6c14a',
    brightYellow: '#ffe08a',
    brightBlue: '#f0c080',
    brightMagenta: '#ffa56a',
    brightCyan: '#ffe0b0',
    brightWhite: '#fff1d0',
  },
  reds: {
    id: 'reds',
    name: 'Reds',
    background: '#09090a',
    foreground: '#f4eeee',
    black: '#1a1a1c',
    red: '#ff7a7a',
    green: '#9fd8b6',
    yellow: '#ffd0a0',
    blue: '#9db7e8',
    magenta: '#ff9ec0',
    cyan: '#a8dcdc',
    white: '#e6e0e0',
    brightBlack: '#6a6a70',
    brightRed: '#ff9a9a',
    brightGreen: '#b9ead0',
    brightYellow: '#ffe0bc',
    brightBlue: '#b8ccf2',
    brightMagenta: '#ffb8d2',
    brightCyan: '#c4ecec',
    brightWhite: '#ffffff',
  },
  bios: {
    id: 'bios',
    name: 'BIOS',
    background: '#03100c',
    foreground: '#5ff2c0',
    black: '#04130f',
    red: '#ff6b6b',
    green: '#5ff2c0',
    yellow: '#e8e36a',
    blue: '#5aa8ff',
    magenta: '#d58cff',
    cyan: '#7ffff0',
    white: '#b8ffe6',
    brightBlack: '#2f7a66',
    brightRed: '#ff8f8f',
    brightGreen: '#8fffd6',
    brightYellow: '#f4f08a',
    brightBlue: '#85c0ff',
    brightMagenta: '#e2aaff',
    brightCyan: '#a8fff6',
    brightWhite: '#e8fff6',
  },
  scan: {
    id: 'scan',
    name: 'Scan',
    background: '#06100d',
    foreground: '#cdeedd',
    black: '#0a1612',
    red: '#f08a8a',
    green: '#9be3bd',
    yellow: '#e6e2a0',
    blue: '#8fc7d8',
    magenta: '#c9a8e0',
    cyan: '#9fe8dc',
    white: '#e6f7ee',
    brightBlack: '#4f7a6c',
    brightRed: '#f6a8a8',
    brightGreen: '#b8f0d2',
    brightYellow: '#f2eeb8',
    brightBlue: '#aadae8',
    brightMagenta: '#dcc2ee',
    brightCyan: '#bdf2ea',
    brightWhite: '#f6fffa',
  },
  blood: {
    id: 'blood',
    name: 'Anatomia',
    background: '#000000',
    foreground: '#ff4a4a',
    black: '#140000',
    red: '#ff2b2b',
    green: '#ff8a8a',
    yellow: '#ffb0b0',
    blue: '#ff9a9a',
    magenta: '#ff6b8b',
    cyan: '#ffc0c0',
    white: '#f5f5f5',
    brightBlack: '#7a2020',
    brightRed: '#ff5a5a',
    brightGreen: '#ffa0a0',
    brightYellow: '#ffc8c8',
    brightBlue: '#ffb0b0',
    brightMagenta: '#ff8aa4',
    brightCyan: '#ffd4d4',
    brightWhite: '#ffffff',
  },
  minimal: {
    id: 'minimal',
    name: 'Minimal HUD',
    background: '#050606',
    foreground: '#d9dedd',
    black: '#101212',
    red: '#e49a9a',
    green: '#9fd6c0',
    yellow: '#d6d0a0',
    blue: '#9fb8d6',
    magenta: '#c4a8d6',
    cyan: '#9fd6d0',
    white: '#e8eceb',
    brightBlack: '#5f6666',
    brightRed: '#f0b4b4',
    brightGreen: '#b8ead6',
    brightYellow: '#e8e2b8',
    brightBlue: '#b8cde6',
    brightMagenta: '#d8c2e6',
    brightCyan: '#b8e6e0',
    brightWhite: '#ffffff',
  },
  discovery: {
    id: 'discovery',
    name: 'Discovery',
    background: '#070812',
    foreground: '#eceaf2',
    black: '#10101c',
    red: '#ff3b5c',
    green: '#6fd6c0',
    yellow: '#ffc66b',
    blue: '#4aa3d9',
    magenta: '#ff6fa8',
    cyan: '#6fd0e8',
    white: '#f4f2fa',
    brightBlack: '#6b6a80',
    brightRed: '#ff6d86',
    brightGreen: '#98e8d8',
    brightYellow: '#ffd896',
    brightBlue: '#7cbce6',
    brightMagenta: '#ff94c0',
    brightCyan: '#98e0f0',
    brightWhite: '#ffffff',
  },
  hud: {
    id: 'hud',
    name: 'Nave',
    background: '#02080a',
    foreground: '#9ef0f0',
    black: '#06141a',
    red: '#ff6a1a',
    green: '#2fd6a0',
    yellow: '#ffb23a',
    blue: '#2f9ad6',
    magenta: '#d97ad6',
    cyan: '#2fd6d8',
    white: '#d8f8f8',
    brightBlack: '#2b6b70',
    brightRed: '#ff8f4d',
    brightGreen: '#6ff0c4',
    brightYellow: '#ffc870',
    brightBlue: '#6cc0f0',
    brightMagenta: '#eaa0e8',
    brightCyan: '#6ff0f0',
    brightWhite: '#ffffff',
  },
  neon: {
    id: 'neon',
    name: 'Neon Vital',
    background: '#050b1a',
    foreground: '#1effa6',
    black: '#0a1226',
    red: '#ff4d9a',
    green: '#1effa6',
    yellow: '#d8f060',
    blue: '#0aa0ff',
    magenta: '#8a4dff',
    cyan: '#3fe0ff',
    white: '#d8fff0',
    brightBlack: '#3a2a8a',
    brightRed: '#ff7ab8',
    brightGreen: '#6fffc4',
    brightYellow: '#e8f890',
    brightBlue: '#5cc0ff',
    brightMagenta: '#a98aff',
    brightCyan: '#8ff0ff',
    brightWhite: '#ffffff',
  },
  stat: {
    id: 'stat',
    name: 'Clã',
    background: '#050505',
    foreground: '#f5f5f0',
    black: '#121212',
    red: '#e8503a',
    green: '#a8c060',
    yellow: '#f5b800',
    blue: '#8aa8c0',
    magenta: '#c08ab0',
    cyan: '#8ac0c0',
    white: '#f5f5f0',
    brightBlack: '#6a6a60',
    brightRed: '#ff7a62',
    brightGreen: '#c8e080',
    brightYellow: '#ffd02e',
    brightBlue: '#b0c8e0',
    brightMagenta: '#e0aad0',
    brightCyan: '#b0e0e0',
    brightWhite: '#ffffff',
  },
  flow: {
    id: 'flow',
    name: 'Fluxo',
    background: '#17181b',
    foreground: '#e6e6ea',
    black: '#222327',
    red: '#ee2a4e',
    green: '#8ac08a',
    yellow: '#e8b860',
    blue: '#7a9ac8',
    magenta: '#c88ab8',
    cyan: '#7ac0c8',
    white: '#e6e6ea',
    brightBlack: '#5c5d66',
    brightRed: '#ff5a78',
    brightGreen: '#a8d8a8',
    brightYellow: '#f0cc88',
    brightBlue: '#9ab8e0',
    brightMagenta: '#e0a8d0',
    brightCyan: '#9ad8e0',
    brightWhite: '#ffffff',
  },
  recon: {
    id: 'recon',
    name: 'Recon',
    background: '#0a1211',
    foreground: '#c4cfcb',
    black: '#111c1a',
    red: '#e0383e',
    green: '#2de89b',
    yellow: '#d8c460',
    blue: '#6a9ab0',
    magenta: '#b08ab0',
    cyan: '#5ac8b8',
    white: '#d8e0dc',
    brightBlack: '#4a5c58',
    brightRed: '#ff6468',
    brightGreen: '#68f4b8',
    brightYellow: '#ecd888',
    brightBlue: '#8cb8cc',
    brightMagenta: '#c8a8c8',
    brightCyan: '#88e0d0',
    brightWhite: '#ffffff',
  },
  ember: {
    id: 'ember',
    name: 'Brasa',
    background: '#0a0302',
    foreground: '#ff8a4a',
    black: '#160805',
    red: '#ff4a1a',
    green: '#ffb23a',
    yellow: '#ffd05a',
    blue: '#d86a3a',
    magenta: '#ff6a8a',
    cyan: '#ffa06a',
    white: '#ffd8c0',
    brightBlack: '#7a3418',
    brightRed: '#ff7a4a',
    brightGreen: '#ffc870',
    brightYellow: '#ffe08a',
    brightBlue: '#ff9a6a',
    brightMagenta: '#ff8aa4',
    brightCyan: '#ffc08a',
    brightWhite: '#fff0e0',
  },
};

export const TERMINAL_FONT_FAMILIES = [
  { id: 'JetBrains Mono', label: 'JetBrains Mono', desc: 'Padrão Aura Dev' },
  { id: 'Fira Code', label: 'Fira Code', desc: 'Com ligaduras' },
  { id: 'Menlo', label: 'Menlo', desc: 'Padrão macOS' },
  { id: 'Cascadia Code', label: 'Cascadia Code', desc: 'Moderno' },
  { id: 'Source Code Pro', label: 'Source Code Pro', desc: 'Adobe Clean' },
  { id: 'Share Tech Mono', label: 'Share Tech Mono', desc: 'HUD / cyberpunk' },
  { id: 'Space Mono', label: 'Space Mono', desc: 'Industrial' },
  { id: 'VT323', label: 'VT323', desc: 'Monitor CRT' },
  { id: 'IBM Plex Mono', label: 'IBM Plex Mono', desc: 'Técnica' },
  { id: 'monospace', label: 'Sistema Monospace', desc: 'Fallback' },
];

// Real Native XTerm.js Terminal connected to node-pty
const liveTerms = new Map<string, XTerm>();

/** Rola o terminal até a primeira vez que o texto aparece e o destaca por instantes. Devolve false se não achar. */
export function scrollTerminalToText(sessionId: string, pattern: RegExp): boolean {
  const term = liveTerms.get(sessionId);
  if (!term) return false;
  const buf = term.buffer.active;
  for (let row = 0; row < buf.length; row++) {
    const text = buf.getLine(row)?.translateToString(true) ?? '';
    const m = pattern.exec(text);
    if (!m) continue;
    term.scrollToLine(Math.max(0, row - 2));
    term.select(m.index, row, m[0].length);
    setTimeout(() => term.clearSelection(), 1800);
    return true;
  }
  return false;
}

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
  /** fundo transparente: deixa aparecer o degradê/logo atrás do terminal */
  transparent?: boolean;
  /** estilo visual com moldura (Cyberdeck, Industrial...), escolhido em Configurações → Terminal */
  skin?: TerminalSkinId;
  /** false: o estilo só aplica paleta/brilho e deixa o fundo e a moldura para quem envolve (ex.: fundo único da tela do CLI) */
  skinLayers?: boolean;
  fontFamily?: string;
  lineHeight?: number;
  themePreset?: string;
  scrollOnUserInput?: boolean;
  drawBoldTextInBrightColors?: boolean;
  cursorWidth?: number;
}

export const NativeXTerm: React.FC<NativeXTermProps> = ({
  sessionId,
  sessionType = 'zsh',
  cwd,
  isActive,
  transparent: transparentProp = false,
  skin = 'none',
  skinLayers = true,
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
  fontFamily = 'JetBrains Mono',
  lineHeight = 1.15,
  themePreset = 'default',
  scrollOnUserInput = true,
  drawBoldTextInBrightColors = true,
  cursorWidth = 2,
}) => {
  const transparent = transparentProp || skin !== 'none';
  const containerRef = useRef<HTMLDivElement>(null);
  // último prompt enviado à IA deste terminal: fica numa barra fixa no topo
  const [stickyPrompt, setStickyPrompt] = useState('');
  const [stickyH, setStickyH] = useState(26);
  const stickyRef = useRef<HTMLDivElement>(null);
  const stickyTextRef = useRef<HTMLSpanElement>(null);
  // Claude: ele já mostra o prompt do ponto de rolagem na 1ª linha; a barra só o espelha por cima, estilizada
  const nativeBar = sessionType === 'claude';
  const [rowBox, setRowBox] = useState({ top: 0, left: 0, width: 0, h: 18 });
  // a barra mostra 2 linhas; a seta (só quando o prompt é maior) expande
  const [stickyOpen, setStickyOpen] = useState(false);
  const [stickyMore, setStickyMore] = useState(false);
  const typedRef = useRef('');
  // prompts enviados (em ordem): rolando o terminal, a barra mostra o prompt daquele ponto
  const promptsRef = useRef<string[]>([]);
  const refreshStickyRef = useRef<(() => void) | undefined>(undefined);
  const aiSessionRef = useRef(false);
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

    const customTheme = TERMINAL_THEMES[themePreset || 'default'] || TERMINAL_THEMES.default;
    const effectiveFontFamily = fontFamily
      ? `"${fontFamily}", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace`
      : TERMINAL_FONT_FAMILY;

    const term = new XTerm({
      cursorBlink,
      cursorStyle,
      // sem foco o xterm desenha um contorno de bloco por padrão; mantém o estilo escolhido
      cursorInactiveStyle: cursorStyle,
      cursorWidth: cursorWidth || 2,
      fontSize,
      scrollback,
      fontFamily: effectiveFontFamily,
      lineHeight: lineHeight || 1.15,
      scrollOnUserInput: scrollOnUserInput !== false,
      drawBoldTextInBrightColors: drawBoldTextInBrightColors !== false,
      theme: {
        background: transparent ? 'rgba(0, 0, 0, 0)' : isDark ? customTheme.background : '#ffffff',
        foreground: isDark ? customTheme.foreground : '#1f1f1f',
        cursor: accentColor,
        cursorAccent: isDark ? customTheme.background : '#ffffff',
        selectionBackground: hexToRgba(accentColor, 0.22),
        scrollbarSliderBackground: isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.28)',
        scrollbarSliderHoverBackground: isDark ? 'rgba(255, 255, 255, 0.42)' : 'rgba(0, 0, 0, 0.42)',
        scrollbarSliderActiveBackground: hexToRgba(accentColor, 0.7),
        black: isDark ? (customTheme.black || '#1a1a1a') : '#e5e5e5',
        red: customTheme.red || '#ef4444',
        green: customTheme.green || '#10b981',
        yellow: customTheme.yellow || '#f59e0b',
        blue: customTheme.blue || '#3b82f6',
        magenta: customTheme.magenta || '#a855f7',
        cyan: customTheme.cyan || '#06b6d4',
        white: isDark ? (customTheme.white || '#f8f8f8') : '#111111',
        brightBlack: customTheme.brightBlack || '#64748b',
        brightRed: customTheme.brightRed || '#f87171',
        brightGreen: customTheme.brightGreen || '#34d399',
        brightYellow: customTheme.brightYellow || '#fbbf24',
        brightBlue: customTheme.brightBlue || '#60a5fa',
        brightMagenta: customTheme.brightMagenta || '#c084fc',
        brightCyan: customTheme.brightCyan || '#22d3ee',
        brightWhite: isDark ? (customTheme.brightWhite || '#ffffff') : '#000000',
      },
      // Sem convertEol: o PTY já entrega \r\n. Converter \n quebrava CLIs de tela cheia (Ink/TUI),
      // que usam \n para mover o cursor e ficavam com texto deslocado e restos na tela.
      allowProposedApi: true,
      allowTransparency: transparent,
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
    // Mede já na abertura: com 80x24 padrão, o histórico reproduzido (e o TUI da CLI) era desenhado na largura errada e quebrava ao ajustar depois
    try {
      if (containerRef.current.offsetWidth >= 50 && containerRef.current.offsetHeight >= 50) fitAddon.fit();
    } catch {}
    term.focus();

    // Garante que Backspace, Delete e atalhos de apagar funcionem com precisão no CLI
    // apagar seleção: segura a saída por instantes e escreve de uma vez, para o cursor não "andar" até a seleção
    const hold = { until: 0, buf: '', timer: 0 as any };
    const flushHold = () => { hold.timer = 0; if (hold.buf) { const d = hold.buf; hold.buf = ''; term.write(d); } };
    term.attachCustomKeyEventHandler((e: KeyboardEvent) => {
      // Deixar Cmd+C / Ctrl+C copiar seleção nativa quando houver texto selecionado
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'c' || e.key === 'C')) {
        if (term.hasSelection()) {
          // a cópia nativa falha com seleções grandes (ex.: Cmd+A): copia direto do xterm
          if (e.type === 'keydown') navigator.clipboard.writeText(term.getSelection()).catch(() => {});
          e.preventDefault();
          return false;
        }
      }
      // Cmd+A / Ctrl+A seleciona todo o texto do terminal (em vez do "início da linha" do shell)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'a' || e.key === 'A')) {
        if (e.type === 'keydown') selectContent(term);
        e.preventDefault();
        return false;
      }
      // Deixar Cmd+V / Ctrl+V colar nativamente
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && (e.key === 'v' || e.key === 'V')) {
        return false;
      }

      // Backspace/Delete com texto selecionado na linha de comando: apaga a seleção (vai até o fim dela com as setas e apaga N caracteres)
      if (e.type === 'keydown' && (e.key === 'Backspace' || e.key === 'Delete') && !e.metaKey && !e.altKey && !e.ctrlKey && term.hasSelection()) {
        const sel = term.getSelectionPosition();
        const buf = term.buffer.active;
        const pty = window.electronAPI?.pty;
        if (pty && sel && sel.start.y === sel.end.y && sel.start.y === buf.baseY + buf.cursorY) {
          const len = sel.end.x - sel.start.x;
          const move = sel.end.x - buf.cursorX;
          if (len > 0) {
            hold.until = Date.now() + 120;
            pty.write(sessionId, (move >= 0 ? '\x1b[C' : '\x1b[D').repeat(Math.abs(move)) + '\x7f'.repeat(len));
            term.clearSelection();
            e.preventDefault();
            return false;
          }
        }
        // seleção em várias linhas (ex.: Cmd+A) que alcança a linha do cursor: apaga o texto digitado na linha de comando (Ctrl+E, Ctrl+U)
        if (pty && sel && sel.start.y !== sel.end.y && sel.end.y >= buf.baseY + buf.cursorY) {
          pty.write(sessionId, '\x05\x15');
          term.clearSelection();
          e.preventDefault();
          return false;
        }
      }

      // Atalhos de apagar:
      if (e.type === 'keydown' && e.key === 'Backspace') {
        const pty = window.electronAPI?.pty;
        if (pty) {
          if (e.altKey && !e.metaKey && !e.ctrlKey) {
            // Option + Backspace: apaga palavra anterior (Ctrl+W)
            pty.write(sessionId, '\x17');
            typedRef.current = typedRef.current.replace(/\S*\s*$/, ''); // o texto digitado acompanha o que foi apagado (prompt fixo da barra)
            e.preventDefault();
            return false;
          }
          if (e.metaKey && !e.altKey && !e.ctrlKey) {
            // Cmd + Backspace: apaga linha inteira (Ctrl+U)
            pty.write(sessionId, '\x15');
            typedRef.current = '';
            e.preventDefault();
            return false;
          }
          // Backspace normal: envia \x7f (DEL) diretamente ao PTY
          pty.write(sessionId, '\x7f');
          typedRef.current = typedRef.current.slice(0, -1);
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
    liveTerms.set(sessionId, term);
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
        // Sessões de IA já abrem direto na CLI (claude, agy...): digitar o nome dela de novo mandava um Enter para o primeiro
        // diálogo (ex.: "Bypass Permissions"), que escolhia "No, exit" e encerrava a CLI na hora.
        const AI_CLI = /^(claude|agy|antigravity|codex|gemini|ollama)$/;
        const typesItself = AI_CLI.test(sessionType) && AI_CLI.test((initialCommand || '').trim());
        if (initialCommand && !res?.reused && !typesItself) {
          const delay = sessionType === 'zsh' || sessionType === 'bash' ? 500 : 1200;
          setTimeout(() => {
            pty.write(sessionId, `${initialCommand}\r`);
          }, delay);
        }
      }).catch(() => {});

      // Histórico da sessão que já existia: a saída ao vivo espera ele ser escrito e descarta o que já veio dentro dele
      // (antes chegava na frente e em duplicidade, o que bagunçava o TUI das CLIs de IA ao voltar para um projeto)
      let historyReady = !pty.getHistoryWithSeq;
      let historySeq = 0;
      const pendingLive: Array<{ id: string; data: string; seq?: number }> = [];
      const isAiTui = /^(claude|agy|antigravity|codex|gemini|ollama)$/.test(sessionType);
      const isAgy = sessionType === 'agy' || sessionType === 'antigravity';
      // reabrir uma sessão longa: esconde o terminal enquanto o histórico é escrito e rolado até o fim, para não ver a rolagem desde o começo
      const hostEl = containerRef.current;
      const reveal = () => { if (hostEl) hostEl.style.visibility = ''; };
      const revealTimer = setTimeout(reveal, 1500);
      const finishHistory = (replayed: boolean) => {
        historyReady = true;
        pendingLive.splice(0).forEach((p) => { if (!p.seq || p.seq > historySeq) handleLive(p); });
        // reabrir uma conversa longa deve cair no fim dela, não no começo
        if (replayed) {
          term.scrollToBottom();
          [150, 500].forEach((ms) => setTimeout(() => { if (!disposed) term.scrollToBottom(); }, ms));
          setTimeout(reveal, isAiTui ? 380 : 60);
        } else reveal();
        // TUIs redesenham por posição do cursor: um SIGWINCH (tamanho muda e volta) faz a CLI repintar a tela limpa
        // (o agy usa tela alternativa e, ao receber o resize, redesenha a própria rolagem desde o começo da conversa: nele o histórico escrito já basta)
        if (replayed && isAiTui && !isAgy && !disposed && term.cols > 6) {
          setTimeout(() => {
            if (disposed) return;
            pty.resize(sessionId, term.cols - 1, term.rows);
            setTimeout(() => { if (!disposed) pty.resize(sessionId, term.cols, term.rows); }, 80);
          }, 120);
        }
      };
      if (pty.getHistoryWithSeq) {
        if (hostEl) hostEl.style.visibility = 'hidden';
        pty.getHistoryWithSeq(sessionId).then((r) => {
          if (r?.history) term.write(r.history, () => { historySeq = r.seq || 0; finishHistory(true); });
          else { historySeq = r?.seq || 0; finishHistory(false); }
        }).catch(() => finishHistory(false));
      } else {
        pty.getHistory?.(sessionId).then((history) => {
          if (history) term.write(history);
        }).catch(() => {});
      }

      let urlTail = '';
      const handleLive = (payload: { id: string; data: string; seq?: number }) => {
        {
          if (Date.now() < hold.until) {
            hold.buf += payload.data;
            if (!hold.timer) hold.timer = setTimeout(flushHold, Math.max(0, hold.until - Date.now()) + 10);
          } else if (hold.buf) {
            hold.buf += payload.data;
            clearTimeout(hold.timer);
            flushHold();
          } else {
            term.write(payload.data);
          }

          // Detect dev servers starting up (e.g. Vite, Next, React, Nest, Fastify)
          if (onServerUrlDetectedRef.current) {
            // sem os códigos de cor/OSC (o Vite imprime a porta em negrito: "localhost:\x1b[1m5173\x1b[22m") e com a cauda do pedaço anterior (URL partida entre dois chunks)
            const plain = (urlTail + payload.data).replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g, '');
            urlTail = plain.slice(-200);
            const serverMatch = plain.match(/https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0):\d+(?:\/[^\s\x1b]*)?/i);
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
      };
      cleanupDataListener = pty.onData((payload) => {
        if (payload.id !== sessionId) return;
        if (!historyReady) pendingLive.push(payload);
        else handleLive(payload);
      });

      // prompt da barra: no fim do buffer é o último digitado; rolando, é o último prompt acima (ou no) topo da área visível.
      // O prompt é lido do próprio transcript ("❯ texto"): vale também para o que veio de um /resume, que não foi digitado aqui
      const refreshSticky = () => {
        if (nativeBar) {
          // só aparece quando a 1ª linha da tela é o cabeçalho de prompt do Claude ("❯ texto…"); o texto completo vem do que foi digitado
          const m = /^\s*[❯>›»]\s*(\S.*)/.exec(term.buffer.active.getLine(term.buffer.active.viewportY)?.translateToString(true) ?? '');
          const head = m ? m[1].replace(/\s+/g, ' ').replace(/…$/, '').trim() : '';
          const full = head && promptsRef.current.findLast((x) => x.replace(/\s+/g, ' ').startsWith(head.slice(0, 25)));
          setStickyPrompt(head ? (full || m![1].trim()) : '');
          // posição exata da 1ª linha da tela do xterm dentro do contêiner da barra (o xterm tem margem própria)
          const screen = term.element?.querySelector('.xterm-screen') as HTMLElement | null;
          const root = containerRef.current?.parentElement;
          if (screen && root && term.rows) {
            const sr = screen.getBoundingClientRect(), rr = root.getBoundingClientRect();
            setRowBox((b) => {
              const n = { top: sr.top - rr.top, left: sr.left - rr.left, width: sr.width, h: sr.height / term.rows };
              return Math.abs(b.top - n.top) + Math.abs(b.left - n.left) + Math.abs(b.width - n.width) + Math.abs(b.h - n.h) < 0.5 ? b : n;
            });
          }
          return;
        }
        // o app só descobre que é uma sessão de IA alguns segundos depois: antes disso anota, mas não mostra
        if (!aiSessionRef.current) return;
        const list = promptsRef.current;
        const buf = term.buffer.active;
        const atBottom = buf.viewportY >= buf.baseY;
        if (atBottom && list.length) return setStickyPrompt(list[list.length - 1]);
        // sem digitado no fim (ex.: acabou de dar /resume): o prompt mais abaixo da área visível, fora do campo de input
        for (let y = atBottom ? buf.baseY + term.rows - 5 : buf.viewportY; y >= 0; y--) {
          const m = /^\s*[❯>›»]\s*(\S.*)/.exec(buf.getLine(y)?.translateToString(true) ?? '');
          if (!m || m[1].startsWith('/')) continue;
          const t = m[1].replace(/\s+/g, ' ').trim();
          // o transcript pode cortar o prompt com "…": prefere o texto completo digitado, quando for o mesmo
          const full = list.findLast((x) => x.replace(/\s+/g, ' ').startsWith(t.replace(/…$/, '').slice(0, 25)));
          return setStickyPrompt(full ?? t);
        }
        if (list.length) setStickyPrompt(list[0]);
      };
      refreshStickyRef.current = refreshSticky;
      const onScrollDisp = term.onScroll(refreshSticky);
      let parsedRaf = 0;
      const onParsedDisp = nativeBar ? term.onWriteParsed(() => { cancelAnimationFrame(parsedRaf); parsedRaf = requestAnimationFrame(refreshSticky); }) : null;
      const onDataDisp = term.onData((data) => {
        // anota sempre (as primeiras letras chegam antes do app saber que é uma sessão de IA); só o Enter decide se vira o prompt fixo
        const pasted = data.startsWith('\x1b[200~');
        if (pasted) typedRef.current += data.replace(/\x1b\[20[01]~/g, '').replace(/[\r\n]+/g, ' ');
        else if (data === '\r') {
          const t = typedRef.current.trim();
          // comandos (/resume, /clear...) não são prompts: não substituem o prompt da barra
          if (/^\/(resume|clear)\b/.test(t)) {
            // a conversa muda: o que foi digitado antes não vale mais, os prompts passam a vir do transcript
            promptsRef.current = [];
          } else if (t && !t.startsWith('/')) {
            promptsRef.current.push(t);
            if (promptsRef.current.length > 300) promptsRef.current.shift();
            refreshSticky();
          }
          typedRef.current = '';
        } else if (data === '\x7f') typedRef.current = typedRef.current.slice(0, -1);
        else if (data === '\x03' || data === '\x15') typedRef.current = '';
        else if (data[0] !== '\x1b' && data >= ' ') typedRef.current += data;
        // digitar descarta a seleção (como em campos de texto); sem isso o bloco do Cmd+A fica pintado enquanto a IA redesenha a tela
        if (term.hasSelection()) term.clearSelection();
        pty.write(sessionId, data);
        if (containerRef.current) playTypingEffect(term, containerRef.current, data);
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
      const pastedImages: Array<{ path: string; label: string }> = [];
      const imageDecos: Array<{ deco: IDecoration; marker: IMarker; path: string; x: number }> = [];
      // troca o caminho do arquivo por um rótulo na tela: um chip cobre as células do caminho (o texto real continua no buffer/CLI)
      const labelPastedImages = () => {
        if (!pastedImages.length) return;
        const buf = term.buffer.active;
        for (let i = imageDecos.length - 1; i >= 0; i--) {
          const d = imageDecos[i];
          const line = d.marker.isDisposed ? undefined : buf.getLine(d.marker.line)?.translateToString(false);
          if (line === undefined || line.substr(d.x, d.path.length) !== d.path) { d.deco.dispose(); imageDecos.splice(i, 1); }
        }
        for (let row = buf.viewportY; row < buf.viewportY + term.rows; row++) {
          const line = buf.getLine(row)?.translateToString(false);
          if (!line) continue;
          for (const p of pastedImages) {
            const x = line.indexOf(p.path);
            if (x < 0 || imageDecos.some((d) => d.marker.line === row && d.x === x)) continue;
            const marker = term.registerMarker(row - (buf.baseY + buf.cursorY));
            const deco = marker && term.registerDecoration({ marker, x, width: p.path.length });
            if (!marker || !deco) continue;
            deco.onRender((el) => {
              // mesmo texto do terminal (fonte, tamanho, cor), cobrindo exatamente as células do caminho
              const h = el.getBoundingClientRect().height;
              el.style.cssText += `;background:${isDark ? '#101010' : '#ffffff'};color:${isDark ? '#dcdcdc' : '#1f1f1f'};overflow:hidden;white-space:pre;font-family:${term.options.fontFamily};font-size:${term.options.fontSize}px;line-height:${h}px`;
              el.textContent = p.label.padEnd(p.path.length);
            });
            imageDecos.push({ deco, marker, path: p.path, x });
          }
        }
      };
      const writeParsedDisp = term.onWriteParsed(() => requestAnimationFrame(labelPastedImages));
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
          if (res?.path) {
            pastedImages.push({ path: res.path, label: `[Imagem #${pastedImages.length + 1}]` });
            term.paste(res.path); // a CLI recebe o caminho; na tela ele aparece como [Imagem #N]
          }
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
        onScrollDisp.dispose();
        onParsedDisp?.dispose();
        cancelAnimationFrame(parsedRaf);
        writeParsedDisp.dispose();
        onSelectionDisp.dispose();
        webLinksAddon.dispose();
        if (cleanupDataListener) cleanupDataListener();
        liveTerms.delete(sessionId);
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

  // Dynamically update terminal theme when accentColor, themeMode (isDark), or themePreset changes
  useEffect(() => {
    if (termRef.current) {
      const customTheme = TERMINAL_THEMES[themePreset || 'default'] || TERMINAL_THEMES.default;
      termRef.current.options.theme = {
        background: transparent ? 'rgba(0, 0, 0, 0)' : isDark ? customTheme.background : '#ffffff',
        foreground: isDark ? customTheme.foreground : '#1f1f1f',
        cursor: accentColor,
        cursorAccent: isDark ? customTheme.background : '#ffffff',
        selectionBackground: hexToRgba(accentColor, 0.22),
        scrollbarSliderBackground: isDark ? 'rgba(255, 255, 255, 0.28)' : 'rgba(0, 0, 0, 0.28)',
        scrollbarSliderHoverBackground: isDark ? 'rgba(255, 255, 255, 0.42)' : 'rgba(0, 0, 0, 0.42)',
        scrollbarSliderActiveBackground: hexToRgba(accentColor, 0.7),
        black: isDark ? (customTheme.black || '#1a1a1a') : '#e5e5e5',
        red: customTheme.red || '#ef4444',
        green: customTheme.green || '#10b981',
        yellow: customTheme.yellow || '#f59e0b',
        blue: customTheme.blue || '#3b82f6',
        magenta: customTheme.magenta || '#a855f7',
        cyan: customTheme.cyan || '#06b6d4',
        white: isDark ? (customTheme.white || '#f8f8f8') : '#111111',
        brightBlack: customTheme.brightBlack || '#64748b',
        brightRed: customTheme.brightRed || '#f87171',
        brightGreen: customTheme.brightGreen || '#34d399',
        brightYellow: customTheme.brightYellow || '#fbbf24',
        brightBlue: customTheme.brightBlue || '#60a5fa',
        brightMagenta: customTheme.brightMagenta || '#c084fc',
        brightCyan: customTheme.brightCyan || '#22d3ee',
        brightWhite: isDark ? (customTheme.brightWhite || '#ffffff') : '#000000',
      };
    }
    if (termRef.current) termRef.current.options.allowTransparency = transparent;
  }, [accentColor, isDark, transparent, themePreset]);

  // Dynamically apply font size, font family, line height, cursor style/blink, cursor width, scrollback
  // without tearing down the PTY-backed session (which would lose scroll position).
  useEffect(() => {
    if (termRef.current) {
      const effectiveFontFamily = fontFamily
        ? `"${fontFamily}", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace`
        : TERMINAL_FONT_FAMILY;
      termRef.current.options.fontSize = fontSize;
      termRef.current.options.cursorStyle = cursorStyle;
      termRef.current.options.cursorInactiveStyle = cursorStyle;
      termRef.current.options.cursorBlink = cursorBlink;
      termRef.current.options.cursorWidth = cursorWidth || 2;
      termRef.current.options.scrollback = scrollback;
      termRef.current.options.fontFamily = effectiveFontFamily;
      termRef.current.options.lineHeight = lineHeight || 1.15;
      termRef.current.options.scrollOnUserInput = scrollOnUserInput !== false;
      termRef.current.options.drawBoldTextInBrightColors = drawBoldTextInBrightColors !== false;
      try {
        fitAddonRef.current?.fit();
        if (window.electronAPI?.pty && termRef.current) {
          window.electronAPI.pty.resize(sessionId, termRef.current.cols, termRef.current.rows);
        }
      } catch {}
    }
  }, [fontSize, cursorStyle, cursorBlink, cursorWidth, scrollback, fontFamily, lineHeight, scrollOnUserInput, drawBoldTextInBrightColors, sessionId]);

  // A fonte escolhida (Fira Code, Cascadia...) pode ainda não estar carregada: sem ela o xterm mede a célula com a substituta e a escolha "não pega".
  // Carrega e reaplica a família para ele remedir e reajustar as colunas.
  useEffect(() => {
    const term = termRef.current;
    if (!term || !fontFamily || !document.fonts) return;
    let cancelled = false;
    document.fonts.load(`${fontSize}px "${fontFamily}"`).then(() => {
      if (cancelled || termRef.current !== term) return;
      const family = `"${fontFamily}", "JetBrains Mono", Menlo, Monaco, "Courier New", monospace`;
      term.options.fontFamily = 'monospace';
      term.options.fontFamily = family;
      try {
        fitAddonRef.current?.fit();
        window.electronAPI?.pty?.resize(sessionId, term.cols, term.rows);
      } catch {}
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [fontFamily, fontSize, sessionId]);

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
            termRef.current?.scrollToBottom();
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

  useEffect(() => {
    const el = stickyRef.current;
    if (!el) return;
    const measure = () => {
      setStickyH(Math.ceil(el.getBoundingClientRect().height));
      const t = stickyTextRef.current;
      if (t && !stickyOpen) setStickyMore(t.scrollHeight > t.clientHeight + 1);
    };
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    measure();
    return () => ro.disconnect();
  }, [!!stickyPrompt, stickyPrompt, stickyOpen]);

  // prompt novo (ou rolagem para outro prompt) volta recolhido
  useEffect(() => setStickyOpen(false), [stickyPrompt]);

  // sessão de IA (CLI de IA aberta no terminal): só nela o prompt enviado vira a barra do topo
  useEffect(() => {
    window.electronAPI?.pty?.getRunningSessions?.().then((list) => {
      if (list?.some((x) => x.id === sessionId && x.isAi)) { aiSessionRef.current = true; refreshStickyRef.current?.(); }
    }).catch(() => {});
    return window.electronAPI?.pty?.onSessionStatus?.((st) => {
      if (st.id !== sessionId) return;
      if (st.exited) { aiSessionRef.current = false; typedRef.current = ''; promptsRef.current = []; setStickyPrompt(''); }
      else if (st.isAi && !aiSessionRef.current) { aiSessionRef.current = true; refreshStickyRef.current?.(); }
    });
  }, [sessionId]);

  // Cmd+A / Cmd+C vêm do menu nativo (roles que só mexem no DOM): o menu avisa o terminal em foco
  useEffect(() => {
    const onSelectAll = () => {
      if (containerRef.current?.contains(document.activeElement)) termRef.current && selectContent(termRef.current);
    };
    const onCopy = () => {
      const t = termRef.current;
      if (containerRef.current?.contains(document.activeElement) && t?.hasSelection()) navigator.clipboard.writeText(t.getSelection()).catch(() => {});
    };
    window.addEventListener('devflow:terminal-select-all', onSelectAll);
    window.addEventListener('devflow:terminal-copy', onCopy);
    return () => {
      window.removeEventListener('devflow:terminal-select-all', onSelectAll);
      window.removeEventListener('devflow:terminal-copy', onCopy);
    };
  }, []);

  const [padY, padX] = skin !== 'none' ? (skinLayers ? [14, 22] : [6, 10]) : [0, 0];
  // com a barra, o terminal começa abaixo dela (o xterm se reajusta ao novo tamanho)
  const containerInset = { top: padY + (stickyPrompt && !nativeBar ? stickyH : 0), right: padX, bottom: padY, left: padX };

  return (
    <div
      className={[skinGlow(skin) && 'term-glow', skinTint(skin) && 'term-tint'].filter(Boolean).join(' ') || undefined}
      style={{
        ['--term-glow' as any]: skinGlow(skin),
        ['--term-tint' as any]: skinTint(skin),
        position: 'relative',
        width: '100%',
        height: '100%',
        flex: 1,
        overflow: 'hidden',
        background: transparent ? 'rgba(0, 0, 0, 0)' : isDark ? '#101010' : '#ffffff',
        display: (alwaysVisible || isActive) ? 'block' : 'none',
      }}
    >
      {skinLayers && <TerminalSkinBackground skin={skin} />}
      <div
        ref={containerRef}
        data-session-id={sessionId}
        data-terminal="true"
        data-transparent={transparent ? 'true' : undefined}
        // com moldura, o texto sai das bordas para não ficar sob os colchetes e réguas
        style={{ position: 'absolute', ...containerInset, overflow: 'hidden', background: transparent ? 'rgba(0, 0, 0, 0)' : isDark ? '#101010' : '#ffffff' }}
        onClick={() => termRef.current?.focus()}
      />
      {stickyPrompt && nativeBar && (
        // base opaca: esconde a linha original do Claude, que ficaria visível por baixo do fundo translúcido do estilo
        <div aria-hidden style={{ position: 'absolute', top: rowBox.top, left: rowBox.left, width: rowBox.width, height: rowBox.h, zIndex: 3, pointerEvents: 'none', background: isDark ? '#110b0d' : '#f4f4f5' }} />
      )}
      {stickyPrompt && (
        // skin-tab: dentro de um estilo visual herda cantos, cores e borda do tema (o texto do prompt não vira maiúsculo)
        <div
          ref={stickyRef}
          className="skin-tab"
          data-on="1"
          title={stickyPrompt}
          style={{
            position: 'absolute', top: padY, left: padX, right: padX, zIndex: 4, boxSizing: 'border-box', padding: '5px 10px',
            display: 'flex', alignItems: 'flex-start', gap: 8, pointerEvents: 'none', fontSize: 11.5, lineHeight: 1.4, textTransform: 'none', letterSpacing: 'normal',
            fontFamily: 'inherit', color: isDark ? '#e6e6e6' : '#222',
            background: `color-mix(in srgb, ${accentColor} 16%, ${isDark ? '#101010' : '#ffffff'})`,
            borderBottom: `1px solid color-mix(in srgb, ${accentColor} 45%, transparent)`,
            // espelho do cabeçalho do Claude: cobre a 1ª linha da tela, com a fonte do terminal e sem mexer no layout
            ...(nativeBar ? { top: rowBox.top, left: rowBox.left, right: 'auto', width: rowBox.width, height: rowBox.h, padding: '0 10px', alignItems: 'center', fontSize, lineHeight: `${rowBox.h}px`, fontFamily: `"${fontFamily}", "JetBrains Mono", monospace`, whiteSpace: 'nowrap' } : {}),
          }}
        >
          <span style={{ color: accentColor, flexShrink: 0 }}>❯</span>
          <span
            ref={stickyTextRef}
            style={{ flex: 1, minWidth: 0, display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: (stickyOpen ? 'none' : nativeBar ? 1 : 2) as any, overflow: stickyOpen ? 'auto' : 'hidden', maxHeight: stickyOpen ? 220 : undefined, wordBreak: 'break-word', pointerEvents: stickyOpen ? 'auto' : 'none' }}
          >
            {stickyPrompt}
          </span>
          {!nativeBar && (stickyMore || stickyOpen) && (
            <button
              type="button"
              title={stickyOpen ? 'Recolher' : 'Ver o prompt inteiro'}
              onClick={() => setStickyOpen((v) => !v)}
              style={{ pointerEvents: 'auto', flexShrink: 0, display: 'flex', alignItems: 'center', background: 'transparent', border: 'none', color: 'inherit', cursor: 'pointer', padding: 2, opacity: 0.8 }}
            >
              <ChevronDown size={14} style={{ transform: stickyOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>
          )}
        </div>
      )}
      {skinLayers && <TerminalSkinOverlay skin={skin} />}
    </div>
  );
};
