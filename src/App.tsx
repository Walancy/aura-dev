import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Editor, { DiffEditor, OnMount } from '@monaco-editor/react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import {
  Files,
  Search,
  GitBranch,
  Play,
  Monitor,
  Blocks,
  Settings,
  MoreHorizontal,
  ChevronRight,
  ChevronDown,
  Folder,
  FolderOpen,
  SplitSquareVertical,
  Columns,
  X,
  Plus,
  Minus,
  Trash2,
  Maximize2,
  Minimize2,
  Terminal as TerminalIcon,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  XCircle,
  CheckCircle2,
  CircleDot,
  Tag,
  Radio,
  ExternalLink,
  Sidebar,
  PanelLeft,
  PanelBottom,
  PanelRight,
  LayoutGrid,
  SquareTerminal,
  AtSign,
  Save,
  FileText,
  FilePlus,
  FolderPlus,
  AlertTriangle,
  Sparkles,
  Download,
  Layers,
  MessageSquare,
  Wand2,
  Check,
  RotateCcw,
  Scan,
  Disc,
  Eye,
  GitPullRequest,
  Palette,
  Sun,
  Moon,
  Sliders,
  Keyboard,
  Code,
  Clock,
  GripHorizontal,
  Pipette,
  GitCommit,
  Pencil,
  BookOpen,
  ChevronUp,
  Copy,
  FileCode,
  Lock,
  KeyRound,
  ThumbsUp,
  ThumbsDown,
} from 'lucide-react';
import avatarImg from './avatar.png';
import claudeLogo from './assets/logos/claude-color.svg';
import antigravityLogo from './assets/logos/google-antigravity-icon.svg';
import codexLogo from './assets/logos/codex-color.svg';
import geminiLogo from './assets/logos/gemini-icon-seeklogo.svg';
import ollamaLogo from './assets/logos/ollama-icon.svg';
import { FileIcon, FolderIcon } from './components/FileIcon';
import { SidebarPanels } from './components/ide/SidebarPanels';

// Customize Layout Official VS Code / Antigravity Icon
const CustomizeLayoutIcon: React.FC<{ size?: number; color?: string }> = ({ size = 18, color = 'currentColor' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <rect width="18" height="18" x="3" y="3" rx="3.5" />
    <rect width="3.5" height="11" x="6" y="6.5" rx="1" fill={color} stroke="none" />
    <rect width="5.5" height="4.5" x="12" y="6.5" rx="1" fill={color} stroke="none" />
    <rect width="5.5" height="4.5" x="12" y="13" rx="1" fill={color} stroke="none" />
  </svg>
);

// Git Diamond Icon (.gitignore & Git status)
const GitDiamondIcon: React.FC<{ size?: number }> = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
    <rect x="4.5" y="4.5" width="15" height="15" rx="3" transform="rotate(45 12 12)" fill="#F05032" />
    <circle cx="12" cy="7.5" r="1.5" fill="#ffffff" />
    <circle cx="7.5" cy="15" r="1.5" fill="#ffffff" />
    <circle cx="15.5" cy="15" r="1.5" fill="#ffffff" />
    <path d="M12 9v3.5m-2.5 1l-1.5 1m5.5-1l1.5 1" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round" />
  </svg>
);

// Keyboard Badge Component
const KbdBadge: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <span
    style={{
      padding: '1px 5px',
      background: 'rgba(255, 255, 255, 0.08)',
      borderRadius: 3,
      fontSize: 10.5,
      color: '#bbbbbb',
      border: 'none',
      display: 'inline-flex',
      alignItems: 'center',
      justifyContent: 'center',
      minWidth: 16,
      height: 18,
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      fontWeight: 500,
      userSelect: 'none',
    }}
  >
    {children}
  </span>
);

// Claude Color Official SVG Icon
const ClaudeIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={claudeLogo}
    alt="Claude"
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      flex: 'none',
      display: 'inline-block',
      ...style,
    }}
  />
);

// Google Antigravity Official SVG Icon
const AntigravityIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={antigravityLogo}
    alt="Google Antigravity"
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      borderRadius: 2,
      flex: 'none',
      display: 'inline-block',
      ...style,
    }}
  />
);

// Google Gemini Official SVG Icon
const GeminiIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={geminiLogo}
    alt="Google Gemini"
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      flex: 'none',
      display: 'inline-block',
      ...style,
    }}
  />
);

// Ollama Official SVG Icon
const OllamaIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={ollamaLogo}
    alt="Ollama"
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      flex: 'none',
      display: 'inline-block',
      ...style,
    }}
  />
);

// OpenAI Codex Official SVG Icon
const CodexIcon: React.FC<{ size?: number; style?: React.CSSProperties }> = ({ size = 16, style }) => (
  <img
    src={codexLogo}
    alt="OpenAI Codex"
    style={{
      width: size,
      height: size,
      objectFit: 'contain',
      flex: 'none',
      display: 'inline-block',
      ...style,
    }}
  />
);

// Helper to render AI icon by provider ID
const renderAiIcon = (providerId: string, size = 16, style?: React.CSSProperties) => {
  switch (providerId) {
    case 'claude':
      return <ClaudeIcon size={size} style={style} />;
    case 'antigravity':
      return <AntigravityIcon size={size} style={style} />;
    case 'codex':
      return <CodexIcon size={size} style={style} />;
    case 'gemini':
      return <GeminiIcon size={size} style={style} />;
    case 'ollama':
      return <OllamaIcon size={size} style={style} />;
    default:
      return <ClaudeIcon size={size} style={style} />;
  }
};

// Helper to compute contrast text color (black or white) based on background brightness
export function getContrastTextColor(hex: string): '#000000' | '#ffffff' {
  if (!hex) return '#ffffff';
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  if (c.length !== 6) return '#ffffff';
  const num = parseInt(c, 16);
  if (isNaN(num)) return '#ffffff';
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b);
  return luminance > 160 ? '#000000' : '#ffffff';
}

// Helper to convert hex colors to rgba with opacity
export function hexToRgba(hex: string, alpha: number): string {
  if (!hex) return `rgba(255, 106, 0, ${alpha})`;
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  if (c.length !== 6) return `rgba(255, 106, 0, ${alpha})`;
  const num = parseInt(c, 16);
  if (isNaN(num)) return `rgba(255, 106, 0, ${alpha})`;
  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ==========================================
// COLOR CONVERSION HELPERS
// ==========================================
export function hexToRgb(hex: string): [number, number, number] {
  if (!hex) return [255, 106, 0];
  let c = hex.replace('#', '').trim();
  if (c.length === 3) {
    c = c.split('').map((x) => x + x).join('');
  }
  if (c.length !== 6) return [255, 106, 0];
  const num = parseInt(c, 16);
  if (isNaN(num)) return [255, 106, 0];
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const rNorm = r / 255;
  const gNorm = g / 255;
  const bNorm = b / 255;
  const max = Math.max(rNorm, gNorm, bNorm);
  const min = Math.min(rNorm, gNorm, bNorm);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (d !== 0) {
    if (max === rNorm) {
      h = ((gNorm - bNorm) / d) % 6;
    } else if (max === gNorm) {
      h = (bNorm - rNorm) / d + 2;
    } else {
      h = (rNorm - gNorm) / d + 4;
    }
    h = Math.round(h * 60);
    if (h < 0) h += 360;
  }
  return [h, s, v];
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 360) + 360) % 360;
  s = Math.max(0, Math.min(1, s));
  v = Math.max(0, Math.min(1, v));
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  let r1 = 0, g1 = 0, b1 = 0;
  if (h >= 0 && h < 60) {
    r1 = c; g1 = x; b1 = 0;
  } else if (h >= 60 && h < 120) {
    r1 = x; g1 = c; b1 = 0;
  } else if (h >= 120 && h < 180) {
    r1 = 0; g1 = c; b1 = x;
  } else if (h >= 180 && h < 240) {
    r1 = 0; g1 = x; b1 = c;
  } else if (h >= 240 && h < 300) {
    r1 = x; g1 = 0; b1 = c;
  } else {
    r1 = c; g1 = 0; b1 = x;
  }
  return [
    Math.round((r1 + m) * 255),
    Math.round((g1 + m) * 255),
    Math.round((b1 + m) * 255),
  ];
}

export function hexToHsv(hex: string): [number, number, number] {
  const [r, g, b] = hexToRgb(hex);
  return rgbToHsv(r, g, b);
}

// ==========================================
// CUSTOM STYLIZED COLOR PICKER (DEVFLOW)
// ==========================================
export const DevFlowColorPicker: React.FC<{
  color: string;
  onChange: (hex: string) => void;
  isDark?: boolean;
}> = ({ color, onChange, isDark = true }) => {
  const [hue, setHue] = useState<number>(() => hexToHsv(color)[0]);
  const [sat, setSat] = useState<number>(() => hexToHsv(color)[1]);
  const [val, setVal] = useState<number>(() => hexToHsv(color)[2]);
  const [hexInput, setHexInput] = useState<string>(color.toUpperCase());

  const satValRef = useRef<HTMLDivElement | null>(null);
  const hueRef = useRef<HTMLDivElement | null>(null);

  const hueRefVal = useRef(hue);
  hueRefVal.current = hue;
  const satRefVal = useRef(sat);
  satRefVal.current = sat;
  const valRefVal = useRef(val);
  valRefVal.current = val;

  // Keep internal state synced when external color prop changes (e.g. clicking presets)
  useEffect(() => {
    const [h, s, v] = hexToHsv(color);
    if (s > 0.02 && v > 0.02) {
      setHue(h);
    }
    setSat(s);
    setVal(v);
    setHexInput(color.toUpperCase());
  }, [color]);

  const [r, g, b] = hexToRgb(color);

  // Saturation / Value Area Drag
  const handleSatValMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = satValRef.current?.getBoundingClientRect();
    if (!rect) return;

    const updateFromPoint = (clientX: number, clientY: number) => {
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const y = Math.max(0, Math.min(1, (clientY - rect.top) / rect.height));
      const newS = x;
      const newV = 1 - y;
      setSat(newS);
      setVal(newV);
      const [newR, newG, newB] = hsvToRgb(hueRefVal.current, newS, newV);
      const newHex = rgbToHex(newR, newG, newB);
      setHexInput(newHex);
      onChange(newHex);
    };

    updateFromPoint(e.clientX, e.clientY);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateFromPoint(moveEvent.clientX, moveEvent.clientY);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Hue Slider Drag
  const handleHueMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const rect = hueRef.current?.getBoundingClientRect();
    if (!rect) return;

    const updateFromPoint = (clientX: number) => {
      const x = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
      const newH = Math.round(x * 360) % 360;
      setHue(newH);
      const [newR, newG, newB] = hsvToRgb(newH, satRefVal.current, valRefVal.current);
      const newHex = rgbToHex(newR, newG, newB);
      setHexInput(newHex);
      onChange(newHex);
    };

    updateFromPoint(e.clientX);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      updateFromPoint(moveEvent.clientX);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  // Eyedropper API (Native Chromium / Electron support)
  const handleEyeDropper = async () => {
    if (typeof window !== 'undefined' && 'EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          onChange(result.sRGBHex.toUpperCase());
        }
      } catch {
        // User cancelled picker
      }
    }
  };

  const handleHexInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let valStr = e.target.value.trim().toUpperCase();
    setHexInput(valStr);
    if (!valStr.startsWith('#')) {
      valStr = '#' + valStr;
    }
    if (/^#[0-9A-F]{6}$/i.test(valStr)) {
      onChange(valStr);
    }
  };

  const handleHexInputBlur = () => {
    let valStr = hexInput.trim().toUpperCase();
    if (!valStr.startsWith('#')) {
      valStr = '#' + valStr;
    }
    if (/^#[0-9A-F]{6}$/i.test(valStr)) {
      onChange(valStr);
      setHexInput(valStr);
    } else {
      setHexInput(color.toUpperCase());
    }
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 9,
        background: isDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
        padding: 9,
        borderRadius: 8,
        border: 'none',
        userSelect: 'none',
      }}
    >
      {/* 2D Saturation & Brightness Board */}
      <div
        ref={satValRef}
        onMouseDown={handleSatValMouseDown}
        style={{
          position: 'relative',
          width: '100%',
          height: 105,
          borderRadius: 6,
          backgroundColor: `hsl(${hue}, 100%, 50%)`,
          backgroundImage: `
            linear-gradient(to right, #ffffff, rgba(255, 255, 255, 0)),
            linear-gradient(to top, #000000, rgba(0, 0, 0, 0))
          `,
          cursor: 'crosshair',
          overflow: 'hidden',
          border: 'none',
          boxShadow: 'inset 0 0 0 1px rgba(0, 0, 0, 0.1)',
        }}
      >
        {/* Sat/Val Handle */}
        <div
          style={{
            position: 'absolute',
            left: `${sat * 100}%`,
            top: `${(1 - val) * 100}%`,
            width: 13,
            height: 13,
            borderRadius: '50%',
            border: '2px solid #ffffff',
            boxShadow: '0 0 4px rgba(0, 0, 0, 0.7)',
            backgroundColor: color,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Rainbow Hue Slider */}
      <div
        ref={hueRef}
        onMouseDown={handleHueMouseDown}
        style={{
          position: 'relative',
          width: '100%',
          height: 11,
          borderRadius: 6,
          background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
          cursor: 'pointer',
          border: 'none',
        }}
      >
        {/* Hue Handle */}
        <div
          style={{
            position: 'absolute',
            left: `${(hue / 360) * 100}%`,
            top: '50%',
            width: 13,
            height: 13,
            borderRadius: '50%',
            border: '2px solid #ffffff',
            boxShadow: '0 1px 4px rgba(0, 0, 0, 0.5)',
            backgroundColor: `hsl(${hue}, 100%, 50%)`,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Controls: Eyedropper, Swatch, Hex, RGB readout */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
        {/* Eyedropper tool & Swatch */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          {typeof window !== 'undefined' && 'EyeDropper' in window && (
            <button
              type="button"
              onClick={handleEyeDropper}
              title="Conta-gotas (Capturar cor da tela)"
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: 24,
                height: 24,
                borderRadius: 5,
                background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                color: isDark ? '#e0e0e0' : '#333333',
                border: 'none',
                cursor: 'pointer',
                padding: 0,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.background = hexToRgba(color, 0.25);
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.background = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)';
              }}
            >
              <Pipette size={13} />
            </button>
          )}
          <div
            title={`Cor atual: ${color}`}
            style={{
              width: 24,
              height: 24,
              borderRadius: 5,
              backgroundColor: color,
              border: 'none',
              boxShadow: `0 0 6px ${hexToRgba(color, 0.5)}`,
              flexShrink: 0,
            }}
          />
        </div>

        {/* HEX Input */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            background: isDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)',
            borderRadius: 5,
            padding: '2px 6px',
            border: 'none',
            flex: 1,
            maxWidth: 82,
          }}
        >
          <input
            type="text"
            value={hexInput}
            onChange={handleHexInputChange}
            onBlur={handleHexInputBlur}
            placeholder="#HEX"
            maxLength={7}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: isDark ? '#f0f0f0' : '#111111',
              fontSize: 10.5,
              fontWeight: 600,
              fontFamily: 'monospace',
              textAlign: 'center',
              textTransform: 'uppercase',
            }}
          />
        </div>

        {/* RGB Badges */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
          {[
            { label: 'R', val: r },
            { label: 'G', val: g },
            { label: 'B', val: b },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minWidth: 26,
                padding: '2px 3px',
                borderRadius: 4,
                background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                border: 'none',
              }}
            >
              <span style={{ fontSize: 7.5, fontWeight: 700, color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)', lineHeight: 1 }}>
                {item.label}
              </span>
              <span style={{ fontSize: 9.5, fontWeight: 600, fontFamily: 'monospace', color: isDark ? '#e0e0e0' : '#333333', lineHeight: 1.1 }}>
                {item.val}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Mini Toggle Switch for Orchestration
const MiniSwitch: React.FC<{
  checked: boolean;
  onChange: () => void;
  disabled?: boolean;
  accentColor?: string;
}> = ({ checked, onChange, disabled, accentColor = '#FF6A00' }) => (
  <div
    onClick={(e) => {
      e.stopPropagation();
      if (!disabled) onChange();
    }}
    style={{
      width: 26,
      height: 15,
      borderRadius: 10,
      background: checked ? accentColor : 'rgba(128, 128, 128, 0.25)',
      position: 'relative',
      cursor: disabled ? 'not-allowed' : 'pointer',
      transition: 'background 0.15s ease',
      flexShrink: 0,
      opacity: disabled ? 0.35 : 1,
    }}
    title={checked ? 'Incluído no Orquestrador' : 'Desativado no Orquestrador'}
  >
    <div
      style={{
        width: 11,
        height: 11,
        borderRadius: '50%',
        background: checked ? getContrastTextColor(accentColor) : '#ffffff',
        position: 'absolute',
        top: 2,
        left: checked ? 13 : 2,
        transition: 'left 0.15s ease',
        boxShadow: '0 1px 2px rgba(0,0,0,0.3)',
      }}
    />
  </div>
);

// Document Symbol definition for Outline (VS Code & Antigravity Style)
interface DocumentSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'type' | 'variable' | 'constant' | 'method';
  line: number;
  badge: string;
  color: string;
}

function extractDocumentSymbols(content: string, _language?: string): DocumentSymbol[] {
  if (!content) return [];
  const lines = content.split('\n');
  const symbols: DocumentSymbol[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i];
    const trimmed = rawLine.trim();
    if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*') || trimmed.startsWith('*')) continue;

    // 1. Classes & Interfaces & Types
    let match = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:abstract\s+)?class\s+([A-Za-z0-9_$]+)/);
    if (match && !seen.has(`class-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'class', line: i + 1, badge: 'C', color: '#fb923c' });
      seen.add(`class-${match[1]}`);
      continue;
    }

    match = trimmed.match(/^(?:export\s+)?interface\s+([A-Za-z0-9_$]+)/);
    if (match && !seen.has(`interface-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'interface', line: i + 1, badge: 'I', color: '#60a5fa' });
      seen.add(`interface-${match[1]}`);
      continue;
    }

    match = trimmed.match(/^(?:export\s+)?type\s+([A-Za-z0-9_$]+)\s*=/);
    if (match && !seen.has(`type-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'type', line: i + 1, badge: 'T', color: '#facc15' });
      seen.add(`type-${match[1]}`);
      continue;
    }

    // 2. Functions (regular and arrow)
    match = trimmed.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function(?:\s*\*|\s+)([A-Za-z0-9_$]+)/);
    if (match && !seen.has(`func-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'function', line: i + 1, badge: 'ƒ', color: '#c084fc' });
      seen.add(`func-${match[1]}`);
      continue;
    }

    match = trimmed.match(/^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*(?::\s*[^=]+)?\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z0-9_$]+)\s*=>/);
    if (match && !seen.has(`func-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'function', line: i + 1, badge: 'ƒ', color: '#c084fc' });
      seen.add(`func-${match[1]}`);
      continue;
    }

    match = trimmed.match(/^(?:export\s+)?const\s+([A-Za-z0-9_$]+)\s*:\s*React\.FC/);
    if (match && !seen.has(`func-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'function', line: i + 1, badge: 'ƒ', color: '#c084fc' });
      seen.add(`func-${match[1]}`);
      continue;
    }

    // 3. Methods inside class or object
    match = trimmed.match(/^(?:public\s+|private\s+|protected\s+|static\s+|async\s+)*([A-Za-z0-9_$]+)\s*\([^)]*\)\s*(?::\s*[^{]+)?\s*\{/);
    if (match && !['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(match[1]) && !seen.has(`method-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'method', line: i + 1, badge: 'm', color: '#a78bfa' });
      seen.add(`method-${match[1]}`);
      continue;
    }

    // 4. Variables & Constants
    match = trimmed.match(/^(?:export\s+)?const\s+([A-Z0-9_$]{2,})\s*=/);
    if (match && !seen.has(`const-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'constant', line: i + 1, badge: 'k', color: '#4ade80' });
      seen.add(`const-${match[1]}`);
      continue;
    }

    match = trimmed.match(/^(?:export\s+)?(?:const|let|var)\s+([A-Za-z0-9_$]+)\s*=/);
    if (match && !seen.has(`var-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'variable', line: i + 1, badge: 'v', color: '#38bdf8' });
      seen.add(`var-${match[1]}`);
      continue;
    }

    // Python functions / classes
    match = trimmed.match(/^(?:async\s+)?def\s+([A-Za-z0-9_]+)\s*\(/);
    if (match && !seen.has(`pyfunc-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'function', line: i + 1, badge: 'ƒ', color: '#c084fc' });
      seen.add(`pyfunc-${match[1]}`);
      continue;
    }

    match = trimmed.match(/^class\s+([A-Za-z0-9_]+)/);
    if (match && !seen.has(`pyclass-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'class', line: i + 1, badge: 'C', color: '#fb923c' });
      seen.add(`pyclass-${match[1]}`);
      continue;
    }

    // Rust / Go
    match = trimmed.match(/^(?:pub\s+)?fn\s+([A-Za-z0-9_]+)/);
    if (match && !seen.has(`rsfn-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'function', line: i + 1, badge: 'ƒ', color: '#c084fc' });
      seen.add(`rsfn-${match[1]}`);
      continue;
    }

    match = trimmed.match(/^func\s+(?:\([^)]+\)\s+)?([A-Za-z0-9_]+)\s*\(/);
    if (match && !seen.has(`gofunc-${match[1]}`)) {
      symbols.push({ name: match[1], kind: 'function', line: i + 1, badge: 'ƒ', color: '#c084fc' });
      seen.add(`gofunc-${match[1]}`);
      continue;
    }
  }

  return symbols;
}

// Real Native XTerm.js Terminal connected to node-pty
interface NativeXTermProps {
  sessionId: string;
  sessionType?: string;
  cwd: string;
  isActive: boolean;
  initialCommand?: string;
  accentColor?: string;
  isDark?: boolean;
}

const NativeXTerm: React.FC<NativeXTermProps> = ({ sessionId, sessionType = 'zsh', cwd, isActive, initialCommand, accentColor = '#FF6A00', isDark = true }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef = useRef<XTerm | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      cursorStyle: 'block',
      fontSize: 12,
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

export interface AiSlashCommand {
  command: string;
  description: string;
  usage?: string;
}

interface AiProviderConfig {
  id: string;
  name: string;
  cliCommand: string;
  installUrl: string;
  installGuide: string;
  requiresLogin?: boolean;
  loginCommand?: string;
  loginUrl?: string;
  loginHelp?: string;
  models: string[];
  commands: AiSlashCommand[];
}

// Brand accent colors for AI providers
export const AI_BRAND_COLORS: Record<string, string> = {
  claude: '#FF8B67',
  antigravity: '#69C2FD',
  codex: '#8975B9',
  gemini: '#589EFF',
  ollama: '#ECECEC',
};

const AI_PROVIDERS: AiProviderConfig[] = [
  {
    id: 'claude',
    name: 'Claude',
    cliCommand: 'claude',
    installUrl: 'https://claude.com/download',
    installGuide: 'npm install -g @anthropic-ai/claude-code',
    requiresLogin: true,
    loginCommand: 'claude login',
    loginUrl: 'https://claude.ai/login',
    loginHelp: 'O Claude Code CLI requer login com sua conta Anthropic. Complete a autenticação no navegador ou envie a chave/código no terminal.',
    models: [
      'sonnet',
      'opus',
      'haiku',
      'fable',
      'best',
      'sonnet[1m]',
      'opus[1m]',
      'fable[1m]',
      'opusplan',
      'default',
    ],
    commands: [
      { command: '/help', description: 'Exibir comandos e opções disponíveis no Claude Code' },
      { command: '/model', description: 'Trocar ou configurar modelo do Claude', usage: '/model [nome]' },
      { command: '/cost', description: 'Ver custos acumulados e uso de tokens da sessão' },
      { command: '/clear', description: 'Limpar a conversa e resetar o contexto do agente' },
      { command: '/compact', description: 'Compactar histórico para liberar contexto' },
      { command: '/doctor', description: 'Diagnosticar saúde do ambiente e configurações' },
      { command: '/config', description: 'Ver ou alterar configurações do Claude Code' },
      { command: '/init', description: 'Criar arquivo CLAUDE.md com instruções do projeto' },
      { command: '/review', description: 'Revisar diff e alterações de código no projeto' },
      { command: '/pr', description: 'Criar um Pull Request com as alterações atuais' },
      { command: '/bug', description: 'Reportar um bug diretamente para a Anthropic' },
      { command: '/login', description: 'Fazer login ou autenticar conta Anthropic' },
    ],
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    cliCommand: 'agy',
    installUrl: 'https://antigravity.google/product/antigravity-cli?authuser=31',
    installGuide: 'curl -fsSL https://antigravity.google/cli/install.sh | bash',
    requiresLogin: true,
    loginCommand: 'export PATH="$HOME/.local/bin:$PATH"; agy',
    loginUrl: 'https://antigravity.google/product/antigravity-cli?authuser=31',
    loginHelp: 'O Antigravity requer autorização de login com sua conta Google. Faça login no navegador e envie o código gerado para o CLI.',
    models: [
      'AGY 2.0 Autonomous Agent',
      'AGY Agentic Pair Programmer',
      'AGY Planning & Architecture',
      'AGY Background Deep Search',
    ],
    commands: [
      { command: '/goal', description: 'Executar tarefa autônoma até o objetivo final', usage: '/goal [objetivo]' },
      { command: '/plan', description: 'Planejar implementação e arquitetura antes de codar', usage: '/plan [tarefa]' },
      { command: '/grill-me', description: 'Entrevista técnica interativa para refinar decisões de design' },
      { command: '/schedule', description: 'Agendar timer ou rotina periódica em segundo plano', usage: '/schedule [tempo]' },
      { command: '/learn', description: 'Registrar aprendizado e diretrizes para novas tarefas' },
      { command: '/browser', description: 'Invocar subagente de navegação web com gravação de sessão' },
      { command: '/subagents', description: 'Listar e gerenciar subagentes autônomos em background' },
      { command: '/status', description: 'Verificar status das tarefas ativas em segundo plano' },
      { command: '/clear', description: 'Limpar contexto e reiniciar agente' },
      { command: '/help', description: 'Guia completo de recursos e comandos do Antigravity' },
    ],
  },
  {
    id: 'codex',
    name: 'Codex',
    cliCommand: 'codex',
    installUrl: 'https://learn.chatgpt.com/docs/codex/cli',
    installGuide: 'npm install -g @openai/codex',
    requiresLogin: true,
    loginCommand: 'codex login',
    loginUrl: 'https://platform.openai.com/api-keys',
    loginHelp: 'O Codex CLI requer autenticação ou uma chave de API da OpenAI (OPENAI_API_KEY).',
    models: [
      'GPT-4o (Omni)',
      'o3-mini (Reasoning)',
      'o1 Pro Mode',
      'GPT-5 (Preview)',
    ],
    commands: [
      { command: '/help', description: 'Exibir comandos e opções do Codex CLI' },
      { command: '/model', description: 'Alternar modelo OpenAI (GPT-4o, o3-mini, o1)', usage: '/model [nome]' },
      { command: '/clear', description: 'Resetar histórico e contexto da sessão' },
      { command: '/review', description: 'Revisão profunda de código com recomendações' },
      { command: '/diff', description: 'Visualizar diff de alterações locais no repositório' },
      { command: '/test', description: 'Gerar e rodar suíte de testes unitários' },
      { command: '/exec', description: 'Executar comando no shell local e analisar saída', usage: '/exec [cmd]' },
      { command: '/login', description: 'Configurar chave OPENAI_API_KEY ou autenticação' },
    ],
  },
  {
    id: 'gemini',
    name: 'Gemini',
    cliCommand: 'gemini',
    installUrl: 'https://geminicli.com/docs/get-started/installation/',
    installGuide: 'npm install -g @google/gemini-cli',
    requiresLogin: true,
    loginCommand: 'gemini auth login',
    loginUrl: 'https://aistudio.google.com/apikey',
    loginHelp: 'O Gemini CLI requer autenticação com conta Google ou chave do Google AI Studio (GEMINI_API_KEY).',
    models: [
      '2.5 Pro (Thinking & Multimodal)',
      '2.5 Flash',
      '2.0 Flash Thinking',
      '1.5 Pro',
    ],
    commands: [
      { command: '/help', description: 'Exibir opções e ajuda do Gemini CLI' },
      { command: '/model', description: 'Alternar modelo (2.5 Pro, Flash, etc)', usage: '/model [nome]' },
      { command: '/clear', description: 'Limpar histórico e contexto da sessão' },
      { command: '/analyze', description: 'Análise detalhada do repositório e dependências' },
      { command: '/tokens', description: 'Exibir contagem de tokens e quotas da sessão' },
      { command: '/system', description: 'Definir instrução de sistema para o agente', usage: '/system [texto]' },
      { command: '/auth', description: 'Gerenciar autenticação com conta Google ou API key' },
    ],
  },
  {
    id: 'ollama',
    name: 'Ollama',
    cliCommand: 'ollama',
    installUrl: 'https://ollama.com/download',
    installGuide: 'brew install ollama',
    requiresLogin: false,
    loginHelp: 'O Ollama não requer login na nuvem! Ele executa modelos 100% locais e offline na sua máquina.',
    models: [
      'DeepSeek R1 (70B & 8B)',
      'Llama 3.3 70B',
      'Qwen 2.5 Coder 32B',
      'Mistral Large 2',
    ],
    commands: [
      { command: '/help', description: 'Exibir comandos disponíveis do Ollama' },
      { command: '/show', description: 'Exibir parâmetros e arquitetura do modelo atual' },
      { command: '/set', description: 'Configurar variáveis (temperatura, system prompt)', usage: '/set [param] [val]' },
      { command: '/load', description: 'Carregar modelo na memória da GPU/CPU', usage: '/load [modelo]' },
      { command: '/save', description: 'Salvar modelo com configurações personalizadas', usage: '/save [nome]' },
      { command: '/clear', description: 'Limpar contexto da sessão local atual' },
      { command: '/bye', description: 'Encerrar a sessão interativa do Ollama' },
    ],
  },
];

const formatModelDisplayName = (modelStr?: string | null): string => {
  if (!modelStr) return '';
  return modelStr
    .replace(/^gemini[\s-_]*/i, '')
    .replace(/^claude[\s-_]*/i, '')
    .trim();
};

interface AiQuotaConfig {
  dailyPercent: number;
  weeklyPercent: number;
  dailyResetTime: string;
  weeklyResetDay: string;
  weeklyResetTime: string;
}

const DEFAULT_AI_QUOTAS: Record<string, AiQuotaConfig> = {
  claude: {
    dailyPercent: 100,
    weeklyPercent: 0,
    dailyResetTime: 'Disponível',
    weeklyResetDay: 'Hoje',
    weeklyResetTime: 'em 1h 25min',
  },
  antigravity: {
    dailyPercent: 96,
    weeklyPercent: 97,
    dailyResetTime: 'em 4h 30min',
    weeklyResetDay: 'Quarta-feira',
    weeklyResetTime: 'em 6d 8h',
  },
  codex: {
    dailyPercent: 100,
    weeklyPercent: 84,
    dailyResetTime: 'em 5h',
    weeklyResetDay: 'Sexta-feira',
    weeklyResetTime: 'em 1d 13h',
  },
  gemini: {
    dailyPercent: 96,
    weeklyPercent: 97,
    dailyResetTime: 'em 4h 30min',
    weeklyResetDay: 'Quarta-feira',
    weeklyResetTime: 'em 6d 8h',
  },
  ollama: {
    dailyPercent: 100,
    weeklyPercent: 100,
    dailyResetTime: 'Ilimitado (Local)',
    weeklyResetDay: 'Ilimitado',
    weeklyResetTime: 'Sem limites',
  },
};

function formatRelativeResetTime(rawTime: string | undefined | null): string {
  if (!rawTime) return '';
  const trimmed = rawTime.trim();
  const lower = trimmed.toLowerCase();

  if (lower.includes('disponível') || lower.includes('ilimitado') || lower.includes('sem limites') || lower.includes('sem bloqueios')) {
    return trimmed;
  }

  const toShortFormat = (days: number, hours: number, mins: number) => {
    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (mins > 0) parts.push(`${mins}min`);
    if (parts.length === 0) return 'Disponível';
    return `em ${parts.join(' ')}`;
  };

  // Check if string already has "em Xd Yh Zmin" or "em Xd", "em Xh", "em Xmin"
  if (/^em\s+(\d+d\s*)?(\d+h\s*)?(\d+min)?$/i.test(lower)) {
    return trimmed;
  }

  // If already abbreviated without "em" (e.g. "1d 4h 30min", "4h 30min", "25min")
  const shortNoEmMatch = trimmed.match(/^(?:(\d+)\s*d)?\s*(?:(\d+)\s*h)?\s*(?:(\d+)\s*(?:m|min))?$/i);
  if (shortNoEmMatch && (shortNoEmMatch[1] || shortNoEmMatch[2] || shortNoEmMatch[3])) {
    const d = shortNoEmMatch[1] ? parseInt(shortNoEmMatch[1], 10) : 0;
    const h = shortNoEmMatch[2] ? parseInt(shortNoEmMatch[2], 10) : 0;
    const m = shortNoEmMatch[3] ? parseInt(shortNoEmMatch[3], 10) : 0;
    return toShortFormat(d, h, m);
  }

  // Convert natural Portuguese text: "em X dias e Y horas", "X horas e Y minutos", "X dias", etc.
  const ptTextMatch = trimmed.match(/(?:em\s+)?(?:(\d+)\s*dias?)?[,\s]*(?:e\s+)?(?:(\d+)\s*horas?)?[,\s]*(?:e\s+)?(?:(\d+)\s*min(?:utos?)?)?/i);
  if (ptTextMatch && (ptTextMatch[1] || ptTextMatch[2] || ptTextMatch[3])) {
    const d = ptTextMatch[1] ? parseInt(ptTextMatch[1], 10) : 0;
    const h = ptTextMatch[2] ? parseInt(ptTextMatch[2], 10) : 0;
    const m = ptTextMatch[3] ? parseInt(ptTextMatch[3], 10) : 0;
    return toShortFormat(d, h, m);
  }

  // Check if string contains "(em X dias)" or "(em Xh Ym)"
  const inDaysMatch = trimmed.match(/\(em\s*(\d+)\s*dias?\)/i);
  const inHoursMinsMatch = trimmed.match(/\(em\s*(\d+)h\s*(\d*)m?\)/i);
  const inHoursOnlyMatch = trimmed.match(/\(em\s*(\d+)h\)/i);

  if (inDaysMatch) {
    const d = parseInt(inDaysMatch[1], 10);
    const timeMatch = trimmed.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
      const targetHours = parseInt(timeMatch[1], 10);
      const targetMins = parseInt(timeMatch[2], 10);
      const now = new Date();
      const target = new Date();
      target.setDate(now.getDate() + d);
      target.setHours(targetHours, targetMins, 0, 0);
      const diffMs = target.getTime() - now.getTime();
      if (diffMs <= 0) return 'Disponível';
      const totalHours = Math.floor(diffMs / 3600000);
      const daysLeft = Math.floor(totalHours / 24);
      const hoursLeft = totalHours % 24;
      const minsLeft = Math.floor((diffMs % 3600000) / 60000);
      return toShortFormat(daysLeft, hoursLeft, minsLeft);
    }
    return `em ${d}d`;
  }

  if (inHoursMinsMatch) {
    const h = parseInt(inHoursMinsMatch[1], 10);
    const m = inHoursMinsMatch[2] ? parseInt(inHoursMinsMatch[2], 10) : 0;
    return toShortFormat(0, h, m);
  }

  if (inHoursOnlyMatch) {
    const h = parseInt(inHoursOnlyMatch[1], 10);
    return toShortFormat(0, h, 0);
  }

  // Check if string contains day + time e.g. "Qui às 15:00", "Quinta-feira às 15:00", "Hoje às 15:00"
  const weekdayTimeMatch = trimmed.match(/(seg|ter|qua|qui|sex|s[aá]b|dom|hoje)[a-z-]*\s*(?:às\s*)?(\d{1,2}):(\d{2})/i);
  if (weekdayTimeMatch) {
    const dayName = weekdayTimeMatch[1].toLowerCase();
    const h = parseInt(weekdayTimeMatch[2], 10);
    const m = parseInt(weekdayTimeMatch[3], 10);

    const daysMap: Record<string, number> = {
      dom: 0, seg: 1, ter: 2, qua: 3, qui: 4, sex: 5, sab: 6, 'sáb': 6,
    };

    const now = new Date();
    const target = new Date();
    target.setHours(h, m, 0, 0);

    if (dayName === 'hoje') {
      if (target.getTime() <= now.getTime()) {
        target.setDate(target.getDate() + 1);
      }
    } else if (daysMap[dayName] !== undefined) {
      const targetDay = daysMap[dayName];
      let diffDays = (targetDay - now.getDay() + 7) % 7;
      if (diffDays === 0 && target.getTime() <= now.getTime()) {
        diffDays = 7;
      }
      target.setDate(now.getDate() + diffDays);
    }

    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0) return 'Disponível';
    const totalHours = Math.floor(diffMs / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const mins = Math.floor((diffMs % 3600000) / 60000);

    return toShortFormat(days, hours, mins);
  }

  // Check if ISO date string
  const parsedDate = new Date(trimmed);
  if (!isNaN(parsedDate.getTime()) && (trimmed.includes('-') || trimmed.includes('T') || trimmed.includes(':'))) {
    const diffMs = parsedDate.getTime() - Date.now();
    if (diffMs <= 0) return 'Disponível';
    const totalHours = Math.floor(diffMs / 3600000);
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    const mins = Math.floor((diffMs % 3600000) / 60000);

    return toShortFormat(days, hours, mins);
  }

  return trimmed;
}

interface TerminalSessionItem {
  id: string;
  name: string;
  type: string;
  pid: number;
  command: string;
  initialCommand?: string;
  shellIntegration: string;
  isSplit?: boolean;
  splitWithId?: string;
}

export interface OpenFileItem {
  id: string;
  name: string;
  path: string;
  content: string;
  language: string;
  isDirty?: boolean;
}

export interface ExplorerNode {
  name: string;
  path: string;
  isDirectory: boolean;
  size?: number;
  extension?: string;
  children?: ExplorerNode[];
}

function getFileLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
    case 'mjs':
      return 'javascript';
    case 'json':
      return 'json';
    case 'html':
      return 'html';
    case 'css':
      return 'css';
    case 'md':
      return 'markdown';
    case 'py':
      return 'python';
    case 'sh':
    case 'zsh':
      return 'shell';
    case 'yml':
    case 'yaml':
      return 'yaml';
    case 'dockerfile':
      return 'dockerfile';
    default:
      return 'plaintext';
  }
}


const codeContent = `import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { translations } from './config/i18n/dashboard.translations';
import { getDashboardHtml } from './views/dashboard.view';
import { EsocialService } from './esocial/esocial.service';

@Injectable()
export class AppService {
  constructor(
    private readonly configService: ConfigService,
    private readonly esocialService: EsocialService,
  ) {}

  getDashboardView(): string {
    const sandboxActive = this.esocialService.isSandboxActive();
    const tpAmb = this.configService.get<string>('ESOCIAL_TPAMB') || '2';
    return getDashboardHtml(JSON.stringify(translations), sandboxActive, tpAmb);
  }

  getSystemStatus(): Record<string, unknown> {
    return {
      uptime: this.formatUptime(process.uptime()),
      environment: this.configService.get<string>('NODE_ENV') || 'development',
      memoryUsage: this.formatMemory(process.memoryUsage().heapUsed),
    };
  }

  private formatUptime(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    return \`\${hrs}h \${mins}m \${secs}s\`;
  }

  private formatMemory(bytes: number): string {
    const mb = bytes / 1024 / 1024;
    return \`\${mb.toFixed(2)} MB\`;
  }
}
`;

export interface ReviewSession {
  files: ChangedFileItem[];
  currentIndex: number;
  originalContent: string;
  modifiedContent: string;
  isSideBySide: boolean;
}

export interface GitHubIssueItem {
  number: number;
  title: string;
  state: string;
  updatedAt: string;
  author?: { login: string; name?: string };
  labels?: Array<{ name: string; color?: string; description?: string }>;
}

export interface GitBranchItem {
  name: string;
  isCurrent: boolean;
  isRemote: boolean;
}

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'projetos' | 'daily' | 'equipmentos' | 'ide' | 'ports'>('ide');
  const [activeTermTab, setActiveTermTab] = useState<'problems' | 'output' | 'debug' | 'terminal' | 'ports'>('terminal');

  // Code Review (Diff View) state
  const [activeReview, setActiveReview] = useState<ReviewSession | null>(null);

  // GitHub Issues state
  const [gitIssues, setGitIssues] = useState<GitHubIssueItem[]>([]);
  const [isIssuesModalOpen, setIsIssuesModalOpen] = useState(false);
  const [isLoadingIssues, setIsLoadingIssues] = useState(false);
  const [issuesSearchQuery, setIssuesSearchQuery] = useState('');
  const [newIssueTitle, setNewIssueTitle] = useState('');
  const [isCreatingIssue, setIsCreatingIssue] = useState(false);

  // Git Branches state
  const [currentBranch, setCurrentBranch] = useState('main');
  const [gitRepoName, setGitRepoName] = useState('ainaobra');
  const [branchesList, setBranchesList] = useState<GitBranchItem[]>([]);
  const [isBranchModalOpen, setIsBranchModalOpen] = useState(false);
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  const [newBranchInput, setNewBranchInput] = useState('');
  const [isCreatingBranch, setIsCreatingBranch] = useState(false);
  const [isSyncingGit, setIsSyncingGit] = useState(false);

  // Open Files in Monaco Editor
  const [openFiles, setOpenFiles] = useState<OpenFileItem[]>([
    {
      id: '/Users/walancy/Documents/codes/Ainaobra/ainaobra/apps/wireframe/src/pages/WireframeLogin.tsx',
      name: 'WireframeLogin.tsx',
      path: '/Users/walancy/Documents/codes/Ainaobra/ainaobra/apps/wireframe/src/pages/WireframeLogin.tsx',
      content: '',
      language: 'typescript',
      isDirty: false,
    },
    {
      id: '/Users/walancy/Documents/codes/Ainaobra/ainaobra/apps/wireframe/src/App.tsx',
      name: 'App.tsx',
      path: '/Users/walancy/Documents/codes/Ainaobra/ainaobra/apps/wireframe/src/App.tsx',
      content: '',
      language: 'typescript',
      isDirty: false,
    },
    {
      id: '/Users/walancy/Documents/codes/Ainaobra/ainaobra/apps/ainaobra-api/src/main.ts',
      name: 'main.ts',
      path: '/Users/walancy/Documents/codes/Ainaobra/ainaobra/apps/ainaobra-api/src/main.ts',
      content: '',
      language: 'typescript',
      isDirty: false,
    },
  ]);
  const [activeFileId, setActiveFileId] = useState<string>(
    '/Users/walancy/Documents/codes/Ainaobra/ainaobra/apps/wireframe/src/pages/WireframeLogin.tsx'
  );
  const activeFile = openFiles.find((f) => f.id === activeFileId) || openFiles[0];
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Auto-dismiss toast notification after 3.5 seconds
  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  // Load initial active files contents from disk if available
  useEffect(() => {
    if (window.electronAPI?.fs?.readFile) {
      openFiles.forEach(async (f) => {
        if (!f.content && f.path) {
          try {
            const res = await window.electronAPI.fs.readFile(f.path);
            if (res && res.content) {
              setOpenFiles((prev) =>
                prev.map((item) => (item.id === f.id ? { ...item, content: res.content } : item))
              );
            }
          } catch {}
        }
      });
    }
  }, []);

  // Workspace & Explorer State
  const [workspacePath, setWorkspacePath] = useState<string>(() => {
    const saved = localStorage.getItem('ide_workspace_path');
    if (saved && saved !== '/Users/walancy/Documents/codes/ainaobra' && saved !== '/Users/walancy/Documents/codes/Ainaobra') {
      return saved;
    }
    return '/Users/walancy/Documents/codes/Ainaobra/ainaobra';
  });
  const [fileTree, setFileTree] = useState<ExplorerNode[]>([]);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(
    new Set([
      '/Users/walancy/Documents/codes/Ainaobra/ainaobra',
      '/Users/walancy/Documents/codes/Ainaobra/ainaobra/apps',
      '/Users/walancy/Documents/codes/Ainaobra/ainaobra/apps/wireframe',
      '/Users/walancy/Documents/codes/Ainaobra/ainaobra/apps/wireframe/src',
      '/Users/walancy/Documents/codes/Ainaobra/ainaobra/apps/wireframe/src/pages',
    ])
  );
  const [explorerMenuOpen, setExplorerMenuOpen] = useState(false);
  const explorerMenuRef = useRef<HTMLDivElement>(null);

  // Outline & Timeline State (VS Code & Antigravity Style)
  const [isOutlineOpen, setIsOutlineOpen] = useState(false);
  const [outlineFilter, setOutlineFilter] = useState('');
  const [isTimelineOpen, setIsTimelineOpen] = useState(false);
  const [localTimelineSnapshots, setLocalTimelineSnapshots] = useState<Record<string, Array<{ id: string; time: string; timestamp: number; label: string; desc: string; type: 'edit' | 'save' | 'open' }>>>({});

  // Document Symbols for Outline
  const documentSymbols = useMemo(() => {
    if (!activeFile || !activeFile.content) return [];
    return extractDocumentSymbols(activeFile.content, activeFile.language);
  }, [activeFile?.content, activeFile?.language]);

  const filteredSymbols = useMemo(() => {
    if (!outlineFilter.trim()) return documentSymbols;
    const q = outlineFilter.toLowerCase();
    return documentSymbols.filter((s) => s.name.toLowerCase().includes(q) || s.kind.toLowerCase().includes(q));
  }, [documentSymbols, outlineFilter]);

  // Timeline events for active file
  const activeTimelineEntries = useMemo(() => {
    if (!activeFile) return [];
    const filePath = activeFile.path || activeFile.id;
    const custom = localTimelineSnapshots[filePath] || [];
    const base: Array<{ id: string; time: string; timestamp: number; label: string; desc: string; type: 'edit' | 'save' | 'open' }> = [
      {
        id: 'current',
        time: 'Agora',
        timestamp: Date.now(),
        label: activeFile.isDirty ? 'Edição não salva' : 'Edição atual',
        desc: `${activeFile.name} em edição ativa`,
        type: 'edit',
      },
      {
        id: 'opened',
        time: 'Hoje',
        timestamp: Date.now() - 60000 * 5,
        label: 'Arquivo carregado',
        desc: `Carregado do workspace: ${activeFile.name}`,
        type: 'open',
      },
    ];
    return [...custom, ...base];
  }, [activeFile?.path, activeFile?.id, activeFile?.isDirty, activeFile?.name, localTimelineSnapshots]);

  const handleTakeTimelineSnapshot = () => {
    if (!activeFile) return;
    const filePath = activeFile.path || activeFile.id;
    const newEntry = {
      id: String(Date.now()),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      timestamp: Date.now(),
      label: 'Snapshot Local',
      desc: `${activeFile.content ? activeFile.content.split('\n').length : 0} linhas salvas`,
      type: 'save' as const,
    };
    setLocalTimelineSnapshots((prev) => ({
      ...prev,
      [filePath]: [newEntry, ...(prev[filePath] || [])],
    }));
    setToastMessage(`Snapshot criado para ${activeFile.name}`);
  };

  const handleSelectOutlineSymbol = (sym: DocumentSymbol) => {
    if (editorInstanceRef.current) {
      editorInstanceRef.current.revealLineInCenter(sym.line);
      editorInstanceRef.current.setPosition({ lineNumber: sym.line, column: 1 });
      editorInstanceRef.current.focus();
    }
  };

  // Real Terminal Working Directory and Execution State
  const [terminalCwd, setTerminalCwd] = useState<string>(() => {
    const saved = localStorage.getItem('ide_terminal_cwd');
    if (saved && saved !== '/Users/walancy/Documents/codes/ainaobra' && saved !== '/Users/walancy/Documents/codes/Ainaobra') {
      return saved;
    }
    return '/Users/walancy/Documents/codes/Ainaobra/ainaobra';
  });
  const [terminalCommandHistory, setTerminalCommandHistory] = useState<string[]>([]);
  const [historyPointer, setHistoryPointer] = useState<number>(-1);
  const terminalScrollRef = useRef<HTMLDivElement>(null);

  const [askPrompt, setAskPrompt] = useState('');
  const [selectedSlashIndex, setSelectedSlashIndex] = useState<number>(0);
  const [isSlashDismissed, setIsSlashDismissed] = useState<boolean>(false);
  const [aiCommands, setAiCommands] = useState<Record<string, AiSlashCommand[]>>({});
  const [selectedAiProvider, setSelectedAiProvider] = useState<string>('claude');
  const [useAiChatThemeColor, setUseAiChatThemeColor] = useState<boolean>(() => {
    const saved = localStorage.getItem('ide_use_ai_chat_color');
    return saved !== null ? saved === 'true' : true;
  });
  const [selectedModel, setSelectedModel] = useState<string>('sonnet');
  const [providerDropdown, setProviderDropdown] = useState(false);
  const [modelDropdown, setModelDropdown] = useState(false);
  const [activeModels, setActiveModels] = useState<Record<string, { currentModel: string; currentModelId: string; models: Array<{ id: string; label: string; tag?: string; description?: string }> }>>({});
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [quotaTooltipOpen, setQuotaTooltipOpen] = useState(false);
  const [aiQuotas, setAiQuotas] = useState<Record<string, AiQuotaConfig>>(DEFAULT_AI_QUOTAS);

  interface ChangedFileItem {
    path: string;
    name: string;
    dir: string;
    additions: number;
    deletions: number;
  }

  interface ExecutionStepItem {
    type: 'explore' | 'edit' | 'run' | 'search';
    label: string;
    file?: string;
    additions?: number;
    deletions?: number;
    command?: string;
  }

  interface WalkthroughItem {
    title: string;
    summary: string;
  }

  interface ChatMessageItem {
    type: 'user' | 'assistant' | 'system' | 'error' | 'auth_required';
    text: string;
    downloadUrl?: string;
    command?: string;
    authUrl?: string;
    providerId?: string;
    timestamp?: number;
    workedDuration?: string;
    executionSteps?: ExecutionStepItem[];
    walkthrough?: WalkthroughItem;
    changedFiles?: ChangedFileItem[];
  }

  const [aiHistory, setAiHistory] = useState<ChatMessageItem[]>([]);
  const [isAiExecuting, setIsAiExecuting] = useState(false);
  const [showThinkingDots, setShowThinkingDots] = useState(false);

  // Debounce thinking dots so fast responses never flash the dots
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isAiExecuting) {
      timer = setTimeout(() => {
        setShowThinkingDots(true);
      }, 350);
    } else {
      setShowThinkingDots(false);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [isAiExecuting]);
  const [aiNotInstalledAlert, setAiNotInstalledAlert] = useState<{
    modelName: string;
    command: string;
    url: string;
    guide: string;
  } | null>(null);

  const [quotaExceededAlert, setQuotaExceededAlert] = useState<{
    providerName: string;
    modelName: string;
    resetTime: string;
    quotaType: 'diário' | 'semanal';
    dailyResetTime?: string;
    weeklyResetTime?: string;
  } | null>(null);

  // Orchestrator States
  const [isOrchestratorActive, setIsOrchestratorActive] = useState<boolean>(false);
  const [orchestratorTooltipOpen, setOrchestratorTooltipOpen] = useState<boolean>(false);
  const [orchestratedProviders, setOrchestratedProviders] = useState<Record<string, boolean>>({
    claude: true,
    antigravity: true,
    codex: false,
    gemini: false,
    ollama: false,
  });
  const [orchestratorIndex, setOrchestratorIndex] = useState<number>(0);

  // Installed CLIs state (detected via native shell)
  const [installedClis, setInstalledClis] = useState<Record<string, boolean>>({
    claude: true,
    antigravity: false,
    codex: false,
    gemini: false,
    ollama: false,
  });
  const prevInstalledClisRef = useRef<Record<string, boolean>>({});

  // AI CLI Login & OAuth Authorization Code State
  // Chat Sessions & History Popup
  interface ChatSessionItem {
    id: string;
    title: string;
    provider: string;
    updatedAt: number;
    history: ChatMessageItem[];
  }

  const [chatSessions, setChatSessions] = useState<ChatSessionItem[]>(() => {
    try {
      const saved = localStorage.getItem('ide_ai_chat_sessions');
      if (saved) {
        const parsed: ChatSessionItem[] = JSON.parse(saved);
        return parsed.map((s) => ({
          ...s,
          provider: s.provider || s.history?.find((h) => h.providerId)?.providerId || 'antigravity',
          history: (s.history || [])
            .map((h) => ({
              ...h,
              providerId: h.providerId || s.provider || 'antigravity',
            }))
            .filter((h) => !h.text?.toLowerCase().includes('executando')),
        }));
      }
    } catch {}
    return [
      {
        id: 'session-1',
        title: 'Chat Inicial',
        provider: 'antigravity',
        updatedAt: Date.now() - 1000 * 60 * 10,
        history: [],
      },
    ];
  });
  const [activeChatSessionId, setActiveChatSessionId] = useState<string>('session-1');
  const [chatHistoryPopupOpen, setChatHistoryPopupOpen] = useState<boolean>(false);
  const chatHistoryPopupRef = useRef<HTMLDivElement>(null);
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);
  const quotaTooltipRef = useRef<HTMLDivElement>(null);

  // Switch AI Provider and create a new chat session if messages exist
  const handleSwitchAiProvider = (newProviderId: string) => {
    if (newProviderId === selectedAiProvider) return;
    setSelectedAiProvider(newProviderId);

    // Quando o usuário trocar a IA, criar um novo chat
    if (aiHistory.length > 0) {
      const newId = 'session-' + Date.now();
      const newSession: ChatSessionItem = {
        id: newId,
        title: 'Nova Conversa',
        provider: newProviderId,
        updatedAt: Date.now(),
        history: [],
      };
      setChatSessions((prev) => [newSession, ...prev]);
      setActiveChatSessionId(newId);
      setAiHistory([]);
    } else {
      // Se o chat atual já está vazio, apenas vincula à nova IA
      setChatSessions((prev) =>
        prev.map((s) => (s.id === activeChatSessionId ? { ...s, provider: newProviderId } : s))
      );
    }
  };

  const handleSelectChatSession = (sessionId: string) => {
    const session = chatSessions.find((s) => s.id === sessionId);
    if (session) {
      setActiveChatSessionId(session.id);
      const histWithProviders = (session.history || []).map((h) => ({
        ...h,
        providerId: h.providerId || session.provider || 'antigravity',
      }));
      setAiHistory(histWithProviders);
      const targetProv = session.provider || session.history?.find((h) => h.providerId)?.providerId;
      if (targetProv && targetProv !== selectedAiProvider) {
        setSelectedAiProvider(targetProv);
      }
    }
    setChatHistoryPopupOpen(false);
  };

  const handleDeleteChatSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChatSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (sessionId === activeChatSessionId) {
        if (filtered.length > 0) {
          setActiveChatSessionId(filtered[0].id);
          setAiHistory(filtered[0].history || []);
        } else {
          const newId = 'session-' + Date.now();
          const newSession: ChatSessionItem = {
            id: newId,
            title: 'Nova Conversa',
            provider: selectedAiProvider,
            updatedAt: Date.now(),
            history: [],
          };
          setActiveChatSessionId(newId);
          setAiHistory([]);
          return [newSession];
        }
      }
      return filtered;
    });
  };

  const [editingChatSessionId, setEditingChatSessionId] = useState<string | null>(null);
  const [editingChatTitle, setEditingChatTitle] = useState<string>('');

  const handleStartRenameChatSession = (s: ChatSessionItem, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingChatSessionId(s.id);
    setEditingChatTitle(s.title);
  };

  const handleSaveRenameChatSession = (sessionId: string) => {
    const trimmed = editingChatTitle.trim();
    if (trimmed) {
      setChatSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? { ...s, title: trimmed } : s))
      );
    }
    setEditingChatSessionId(null);
    setEditingChatTitle('');
  };

  const handleCancelRenameChatSession = () => {
    setEditingChatSessionId(null);
    setEditingChatTitle('');
  };

  const [expandedWorkedMap, setExpandedWorkedMap] = useState<Record<number, boolean>>({});
  const [collapsedDiffMap, setCollapsedDiffMap] = useState<Record<number, boolean>>({});
  const [copiedMsgIdx, setCopiedMsgIdx] = useState<number | null>(null);
  const [copiedCodeKey, setCopiedCodeKey] = useState<string | null>(null);

  const handleCopyMessage = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedMsgIdx(idx);
    setTimeout(() => {
      setCopiedMsgIdx((curr) => (curr === idx ? null : curr));
    }, 2000);
  };

  const renderFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    if (ext === 'tsx' || ext === 'jsx') {
      return (
        <span style={{ color: '#38bdf8', fontSize: 13, display: 'inline-flex', alignItems: 'center', lineHeight: 1 }} title="React">
          ⚛️
        </span>
      );
    }
    if (ext === 'ts') {
      return (
        <span style={{ fontSize: 9.5, fontWeight: 700, background: '#3b82f6', color: '#fff', padding: '1px 3px', borderRadius: 2, lineHeight: 1 }}>
          TS
        </span>
      );
    }
    if (ext === 'js') {
      return (
        <span style={{ fontSize: 9.5, fontWeight: 700, background: '#eab308', color: '#000', padding: '1px 3px', borderRadius: 2, lineHeight: 1 }}>
          JS
        </span>
      );
    }
    if (ext === 'css' || ext === 'scss') {
      return (
        <span style={{ fontSize: 9.5, fontWeight: 700, background: '#ec4899', color: '#fff', padding: '1px 3px', borderRadius: 2, lineHeight: 1 }}>
          #
        </span>
      );
    }
    if (ext === 'svg') {
      return (
        <span style={{ fontSize: 9.5, fontWeight: 700, background: '#a855f7', color: '#fff', padding: '1px 3px', borderRadius: 2, lineHeight: 1 }}>
          SVG
        </span>
      );
    }
    if (ext === 'json') {
      return (
        <span style={{ fontSize: 9.5, fontWeight: 700, background: '#f59e0b', color: '#fff', padding: '1px 3px', borderRadius: 2, lineHeight: 1 }}>
          { }
        </span>
      );
    }
    return <FileText size={13} style={{ color: '#9ca3af' }} />;
  };

  const aiTerminalScrollRef = useRef<HTMLDivElement>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Panel & Layout Visibility Controls (Antigravity & VS Code Customize Layout)
  const [showExplorer, setShowExplorer] = useState(true);
  const [activeActivityTab, setActiveActivityTab] = useState<'explorer' | 'search' | 'git' | 'debug' | 'preview' | 'extensions'>('explorer');
  const [showAiPanel, setShowAiPanel] = useState(true);
  const [showActivityBar, setShowActivityBar] = useState(true);
  const [showStatusBar, setShowStatusBar] = useState(true);
  const [sidebarPosition, setSidebarPosition] = useState<'left' | 'right'>('left');
  const [panelAlignment, setPanelAlignment] = useState<'left' | 'right' | 'center' | 'justify'>(() => {
    return (localStorage.getItem('ide_panel_alignment') as any) || 'justify';
  });
  const [quickInputPosition, setQuickInputPosition] = useState<'top' | 'center'>('center');
  const [isZenMode, setIsZenMode] = useState(false);
  const [isCenteredLayout, setIsCenteredLayout] = useState(false);
  const [isCustomizeLayoutOpen, setIsCustomizeLayoutOpen] = useState(false);
  const customizeLayoutRef = useRef<HTMLDivElement>(null);

  // Quick Open / Command Palette State (VS Code & Antigravity Style)
  const [isQuickOpenOpen, setIsQuickOpenOpen] = useState(false);
  const [quickOpenQuery, setQuickOpenQuery] = useState('');
  const [quickOpenSelectedIndex, setQuickOpenSelectedIndex] = useState(0);
  const quickOpenInputRef = useRef<HTMLInputElement>(null);
  const quickOpenContainerRef = useRef<HTMLDivElement>(null);

  // Settings & Theme Styling State (VS Code & Antigravity Style)
  const [isSettingsMenuOpen, setIsSettingsMenuOpen] = useState(false);
  const settingsMenuRef = useRef<HTMLDivElement>(null);
  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [settingsActiveTab, setSettingsActiveTab] = useState<'appearance' | 'editor' | 'shortcuts' | 'extensions'>('appearance');

  // Minimalist Draggable Theme Popup State
  const [isThemePopupOpen, setIsThemePopupOpen] = useState(false);
  const [themePopupPos, setThemePopupPos] = useState({ x: 0, y: 0 });
  const [isDraggingThemePopup, setIsDraggingThemePopup] = useState(false);
  const themePopupDragRef = useRef<{ mouseX: number; mouseY: number; startX: number; startY: number } | null>(null);

  const openThemePopup = () => {
    setIsSettingsMenuOpen(false);
    setIsSettingsModalOpen(false);
    if (themePopupPos.x === 0 && themePopupPos.y === 0) {
      setThemePopupPos({
        x: Math.max(20, window.innerWidth - 350),
        y: 65,
      });
    }
    setIsThemePopupOpen((prev) => !prev);
  };

  const handleThemePopupMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    themePopupDragRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      startX: themePopupPos.x,
      startY: themePopupPos.y,
    };
    setIsDraggingThemePopup(true);
  };

  useEffect(() => {
    if (!isDraggingThemePopup) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!themePopupDragRef.current) return;
      const dx = e.clientX - themePopupDragRef.current.mouseX;
      const dy = e.clientY - themePopupDragRef.current.mouseY;
      const popupWidth = 320;
      const popupHeight = 310;
      const newX = Math.max(8, Math.min(window.innerWidth - popupWidth - 8, themePopupDragRef.current.startX + dx));
      const newY = Math.max(8, Math.min(window.innerHeight - popupHeight - 8, themePopupDragRef.current.startY + dy));
      setThemePopupPos({ x: newX, y: newY });
    };

    const handleMouseUp = () => {
      setIsDraggingThemePopup(false);
      themePopupDragRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDraggingThemePopup]);
  const [accentColor, setAccentColor] = useState<string>(() => {
    return localStorage.getItem('ide_accent_color') || '#FF6A00';
  });
  const accentTextColor = getContrastTextColor(accentColor);
  const chatAccentColor = useAiChatThemeColor
    ? (AI_BRAND_COLORS[selectedAiProvider] || accentColor)
    : accentColor;
  const [themeMode, setThemeMode] = useState<'dark' | 'light' | 'system'>(() => {
    return (localStorage.getItem('ide_theme_mode') as any) || 'dark';
  });
  const [editorFontSize, setEditorFontSize] = useState<number>(() => {
    const s = localStorage.getItem('ide_editor_font_size');
    return s ? Number(s) : 13;
  });
  const [editorTabSize, setEditorTabSize] = useState<number>(() => {
    const s = localStorage.getItem('ide_editor_tab_size');
    return s ? Number(s) : 2;
  });
  const [editorMinimap, setEditorMinimap] = useState<boolean>(() => {
    return localStorage.getItem('ide_editor_minimap') !== 'false';
  });
  const [editorWordWrap, setEditorWordWrap] = useState<boolean>(() => {
    return localStorage.getItem('ide_editor_word_wrap') === 'true';
  });
  const [editorLineNumbers, setEditorLineNumbers] = useState<boolean>(() => {
    return localStorage.getItem('ide_editor_line_numbers') !== 'false';
  });
  // Split Editor and More Actions menu states
  const [isEditorSplit, setIsEditorSplit] = useState<boolean>(false);
  const [editorSplitOrientation, setEditorSplitOrientation] = useState<'vertical' | 'horizontal'>('vertical');
  const [secondaryFileId, setSecondaryFileId] = useState<string | null>(null);
  const [editorSplitRatio, setEditorSplitRatio] = useState<number>(50);
  const [editorMoreMenuOpen, setEditorMoreMenuOpen] = useState<boolean>(false);
  const editorMoreMenuRef = useRef<HTMLDivElement>(null);
  const [recentlyClosedFiles, setRecentlyClosedFiles] = useState<OpenFileItem[]>([]);

  const [systemIsDark, setSystemIsDark] = useState(() => {
    return window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)').matches : true;
  });
  const isEffectiveDark = themeMode === 'system' ? systemIsDark : themeMode === 'dark';

  // Semantic theme tokens for complete Light/Dark adaptation (Border-free UI)
  const themeTokens = {
    bgApp: isEffectiveDark ? '#000000' : '#eaedf1',
    bgCard: isEffectiveDark ? '#101010' : '#ffffff',
    bgCardSecondary: isEffectiveDark ? '#181818' : '#f1f5f9',
    bgCardElevated: isEffectiveDark ? '#1f1f1f' : '#e2e8f0',
    textPrimary: isEffectiveDark ? '#ffffff' : '#0f172a',
    textSecondary: isEffectiveDark ? '#888888' : '#475569',
    textMuted: isEffectiveDark ? '#555555' : '#64748b',
    border: 'transparent',
    borderSubtle: 'transparent',
    hoverBg: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
  };
  const [explorerWidth, setExplorerWidth] = useState(() => {
    const saved = localStorage.getItem('ide_explorer_width');
    return saved ? parseInt(saved, 10) : 280;
  });
  const [aiPanelWidth, setAiPanelWidth] = useState(() => {
    const saved = localStorage.getItem('ide_ai_panel_width');
    return saved ? parseInt(saved, 10) : 340;
  });
  const [terminalHeight, setTerminalHeight] = useState(() => {
    const saved = localStorage.getItem('ide_terminal_height');
    return saved ? parseInt(saved, 10) : 220;
  });

  const [isDraggingExplorer, setIsDraggingExplorer] = useState(false);
  const [isDraggingAi, setIsDraggingAi] = useState(false);
  const [isDraggingTerminal, setIsDraggingTerminal] = useState(false);

  // Right Terminal Tabs Width (VS Code Style)
  const [terminalTabsWidth, setTerminalTabsWidth] = useState(() => {
    const saved = localStorage.getItem('ide_term_tabs_width');
    return saved ? parseInt(saved, 10) : 175;
  });
  const [isDraggingTermTabs, setIsDraggingTermTabs] = useState(false);

  // Left Terminal Split Panes Ratio (%)
  const [terminalSplitRatio, setTerminalSplitRatio] = useState(() => {
    const saved = localStorage.getItem('ide_term_split_ratio');
    return saved ? parseInt(saved, 10) : 50;
  });
  const [isDraggingSplitPanes, setIsDraggingSplitPanes] = useState(false);
  const splitContainerRef = useRef<HTMLDivElement>(null);

  // Terminal Interactive States
  const [isTerminalMaximized, setIsTerminalMaximized] = useState(false);
  const [isTerminalCollapsed, setIsTerminalCollapsed] = useState(false);
  const [isSplitTerminal, setIsSplitTerminal] = useState(false);
  const [terminalShell, setTerminalShell] = useState('zsh');
  const [shellDropdownOpen, setShellDropdownOpen] = useState(false);
  const [moreOptionsOpen, setMoreOptionsOpen] = useState(false);
  const [terminalCommand, setTerminalCommand] = useState('');
  const [debugCommand, setDebugCommand] = useState('');
  const [debugHistory, setDebugHistory] = useState<string[]>([
    'Debugger listening on ws://127.0.0.1:9229/ainaobra-api',
    'Debugger attached to process 58135 (Node.js runtime)',
  ]);
  const [terminalHistory, setTerminalHistory] = useState<string[]>([
    'walancy@MacBook-Pro-de-Walancy codes % ',
  ]);
  const [terminalSessions, setTerminalSessions] = useState<TerminalSessionItem[]>([
    {
      id: '1',
      name: 'zsh',
      type: 'zsh',
      pid: 61830,
      command: '/bin/zsh -il',
      shellIntegration: 'Rich',
    },
  ]);
  const [activeSessionId, setActiveSessionId] = useState('1');
  const [hoveredSessionId, setHoveredSessionId] = useState<string | null>(null);
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);
  const [popoverTop, setPopoverTop] = useState(25);
  const hoverTimerRef = useRef<any>(null);


  const inputRef = useRef<HTMLInputElement>(null);
  const termInputRef = useRef<HTMLInputElement>(null);
  const editorInstanceRef = useRef<any>(null);

  // Fullscreen Detection
  useEffect(() => {
    window.electronAPI?.windowState?.isFullscreen?.().then((fs) => {
      setIsFullscreen(fs);
    });

    const unsubFs = window.electronAPI?.windowState?.onFullscreenChange?.((fs) => {
      setIsFullscreen(fs);
    });

    return () => {
      unsubFs?.();
    };
  }, []);

  // Native Menu Listeners
  useEffect(() => {
    if (window.electronAPI?.menu?.onAction) {
      const unsubscribe = window.electronAPI.menu.onAction((action: string) => {
        if (action === 'focus-ai-prompt') {
          setShowAiPanel(true);
          setTimeout(() => inputRef.current?.focus(), 50);
        } else if (action === 'run-claude') {
          setShowAiPanel(true);
          setSelectedModel('Claude Sonnet 5');
          setAskPrompt('Execute uma análise completa do projeto ainaobra.');
          setTimeout(() => inputRef.current?.focus(), 50);
        } else if (action === 'run-agy') {
          setShowAiPanel(true);
          setSelectedModel('Google Antigravity (AGY CLI)');
          setAskPrompt('/plan Iniciar verificação autônoma de tarefas.');
          setTimeout(() => inputRef.current?.focus(), 50);
        } else if (action === 'toggle-terminal') {
          setIsTerminalCollapsed((prev) => !prev);
        } else if (action === 'toggle-explorer') {
          setShowExplorer((prev) => !prev);
        } else if (action === 'toggle-ai') {
          setShowAiPanel((prev) => !prev);
        } else if (action === 'scan-ports') {
          setActiveTermTab('ports');
          setIsTerminalCollapsed(false);
        } else if (action === 'new-terminal') {
          handleNewTerminalSession();
        } else if (action === 'split-terminal') {
          handleToggleSplitActiveSession();
        } else if (action === 'clear-terminal') {
          handleClearTerminal();
        }
      });
      return unsubscribe;
    }
  }, [terminalSessions]);

  // ============================================================
  // DRAG RESIZE HANDLERS (VS CODE BEHAVIOR)
  // ============================================================

  // 1. Resize Explorer Width
  const startResizeExplorer = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingExplorer(true);
    document.body.classList.add('resizing-col');

    const startX = e.clientX;
    const startW = explorerWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.clientX - startX;
      const newW = Math.min(Math.max(startW + delta, 160), 550);
      setExplorerWidth(newW);
      localStorage.setItem('ide_explorer_width', String(newW));
      editorInstanceRef.current?.layout();
    };

    const onMouseUp = () => {
      setIsDraggingExplorer(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      editorInstanceRef.current?.layout();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [explorerWidth]);

  // 2. Resize AI Assistant Panel Width
  const startResizeAiPanel = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingAi(true);
    document.body.classList.add('resizing-col');

    const startX = e.clientX;
    const startW = aiPanelWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newW = Math.min(Math.max(startW + delta, 220), 650);
      setAiPanelWidth(newW);
      localStorage.setItem('ide_ai_panel_width', String(newW));
      editorInstanceRef.current?.layout();
    };

    const onMouseUp = () => {
      setIsDraggingAi(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      editorInstanceRef.current?.layout();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [aiPanelWidth]);

  // 3. Resize Terminal Panel Height
  const startResizeTerminal = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingTerminal(true);
    document.body.classList.add('resizing-row');

    const startY = e.clientY;
    const startH = terminalHeight;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startY - moveEvent.clientY;
      const newH = Math.min(Math.max(startH + delta, 90), 600);
      setTerminalHeight(newH);
      localStorage.setItem('ide_terminal_height', String(newH));
      editorInstanceRef.current?.layout();
    };

    const onMouseUp = () => {
      setIsDraggingTerminal(false);
      document.body.classList.remove('resizing-row');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      editorInstanceRef.current?.layout();
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [terminalHeight]);

  // 4. Resize Terminal Tabs Width (Right Pane)
  const startResizeTermTabs = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingTermTabs(true);
    document.body.classList.add('resizing-col');

    const startX = e.clientX;
    const startW = terminalTabsWidth;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = startX - moveEvent.clientX;
      const newW = Math.min(Math.max(startW + delta, 110), 450);
      setTerminalTabsWidth(newW);
      localStorage.setItem('ide_term_tabs_width', String(newW));
    };

    const onMouseUp = () => {
      setIsDraggingTermTabs(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, [terminalTabsWidth]);

  // 5. Resize Split Panes (Left & Right inside Terminal)
  const startResizeSplitPanes = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDraggingSplitPanes(true);
    document.body.classList.add('resizing-col');

    const container = splitContainerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();

    const onMouseMove = (moveEvent: MouseEvent) => {
      const offsetX = moveEvent.clientX - rect.left;
      const pct = Math.min(Math.max(Math.round((offsetX / rect.width) * 100), 20), 80);
      setTerminalSplitRatio(pct);
      localStorage.setItem('ide_term_split_ratio', String(pct));
    };

    const onMouseUp = () => {
      setIsDraggingSplitPanes(false);
      document.body.classList.remove('resizing-col');
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const handleEditorMount: OnMount = (editor, monaco) => {
    editorInstanceRef.current = editor;
    monaco.editor.defineTheme('figma-ainaobra', {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff7b72' },
        { token: 'string', foreground: 'a5d6ff' },
        { token: 'number', foreground: '79c0ff' },
        { token: 'type', foreground: 'ffa657' },
        { token: 'function', foreground: 'd2a8ff' },
        { token: 'variable', foreground: 'c9d1d9' },
      ],
      colors: {
        'editor.background': '#101010',
        'editor.foreground': '#d8dade',
        'editorCursor.foreground': accentColor,
        'editor.lineHighlightBackground': '#181818',
        'editorLineNumber.foreground': '#4e5362',
        'editorLineNumber.activeForeground': '#ffffff',
        'editor.selectionBackground': '#264f78',
        'editorGutter.background': '#101010',
      },
    });
    monaco.editor.setTheme('figma-ainaobra');
  };

  const handleNewTerminalSession = (
    type: string = 'zsh',
    name?: string,
    initialCommand?: string
  ) => {
    const newId = String(Date.now());
    const pid = Math.floor(60000 + Math.random() * 5000);
    const cmd =
      type === 'bash'
        ? '/bin/bash -il'
        : type === 'claude'
        ? 'claude'
        : type === 'agy' || type === 'antigravity'
        ? 'agy'
        : type === 'codex'
        ? 'codex'
        : type === 'gemini'
        ? 'gemini'
        : type === 'ollama'
        ? 'ollama'
        : '/bin/zsh -il';
    const newSession: TerminalSessionItem = {
      id: newId,
      name: name || (type === 'claude' ? 'Claude' : type === 'agy' || type === 'antigravity' ? 'Antigravity' : type === 'codex' ? 'OpenAI Codex' : type),
      type,
      pid,
      command: cmd,
      initialCommand,
      shellIntegration: 'Rich',
    };
    setTerminalSessions((prev) => [...prev, newSession]);
    setActiveSessionId(newId);
    setIsTerminalCollapsed(false);
    setActiveTermTab('terminal');
    return newId;
  };

  const handleInstallCliInTerminal = async (provider: AiProviderConfig) => {
    setProviderDropdown(false);
    if (window.electronAPI?.shell?.openInSystemTerminal) {
      await window.electronAPI.shell.openInSystemTerminal(provider.installGuide);
      setToastMessage(`Terminal aberto para instalar ${provider.name}. Siga as instruções no terminal!`);
    } else {
      handleNewTerminalSession('zsh', `Instalar ${provider.name}`, provider.installGuide);
      setToastMessage(`Iniciando instalação do CLI ${provider.name} no terminal integrado...`);
    }
  };

  const handleKillTerminalSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setTerminalSessions((prev) => {
      if (prev.length <= 1) return prev;
      const target = prev.find((s) => s.id === sessionId);
      const siblingId = target?.splitWithId;

      const next = prev
        .filter((s) => s.id !== sessionId)
        .map((s) => (s.id === siblingId ? { ...s, isSplit: false, splitWithId: undefined } : s));

      if (activeSessionId === sessionId) {
        const fallbackId = siblingId && next.some((s) => s.id === siblingId) ? siblingId : next[0].id;
        setActiveSessionId(fallbackId);
      }
      return next;
    });
    if (hoveredSessionId === sessionId) {
      setHoveredSessionId(null);
    }
  };

  const handleSplitSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const newId = String(Date.now());
    const pid = Math.floor(60000 + Math.random() * 5000);
    setTerminalSessions((prev) => {
      const parent = prev.find((s) => s.id === sessionId);
      if (!parent) return prev;

      const newSession: TerminalSessionItem = {
        id: newId,
        name: parent.name,
        type: parent.type,
        pid,
        command: parent.command,
        shellIntegration: 'Rich',
        isSplit: true,
        splitWithId: parent.id,
      };

      const updated = prev.map((s) =>
        s.id === parent.id ? { ...s, isSplit: true, splitWithId: newId } : s
      );

      const parentIndex = updated.findIndex((s) => s.id === parent.id);
      const next = [...updated];
      next.splice(parentIndex + 1, 0, newSession);
      return next;
    });
    setActiveSessionId(newId);
    setIsTerminalCollapsed(false);
    setActiveTermTab('terminal');
  };

  const handleToggleSplitActiveSession = () => {
    const current = terminalSessions.find((s) => s.id === activeSessionId);
    if (current?.splitWithId) {
      handleKillTerminalSession(current.splitWithId);
    } else {
      handleSplitSession(activeSessionId);
    }
  };


  // Load Workspace File Tree
  const loadWorkspaceTree = useCallback(async (dirPath: string) => {
    if (window.electronAPI?.fs?.getTree) {
      try {
        const res = await window.electronAPI.fs.getTree(dirPath, 3);
        const tree = Array.isArray(res) ? res : (res as any).tree || [];
        setFileTree(tree);
      } catch (err) {
        console.warn('Error loading tree from electron:', err);
      }
    } else {
      setFileTree([
        {
          name: 'apps',
          path: `${dirPath}/apps`,
          isDirectory: true,
          children: [
            {
              name: 'ainaobra-api',
              path: `${dirPath}/apps/ainaobra-api`,
              isDirectory: true,
              children: [
                { name: 'app.service.ts', path: `${dirPath}/apps/ainaobra-api/src/app.service.ts`, isDirectory: false, extension: '.ts' },
                { name: 'app.service.spec.ts', path: `${dirPath}/apps/ainaobra-api/src/app.service.spec.ts`, isDirectory: false, extension: '.ts' },
                { name: 'main.ts', path: `${dirPath}/apps/ainaobra-api/src/main.ts`, isDirectory: false, extension: '.ts' },
              ],
            },
          ],
        },
        {
          name: 'data',
          path: `${dirPath}/data`,
          isDirectory: true,
          children: [
            { name: 'schema.sql', path: `${dirPath}/data/schema.sql`, isDirectory: false, extension: '.sql' },
          ],
        },
        { name: 'Dockerfile', path: `${dirPath}/Dockerfile`, isDirectory: false, extension: '' },
        { name: 'package.json', path: `${dirPath}/package.json`, isDirectory: false, extension: '.json' },
        { name: 'tsconfig.json', path: `${dirPath}/tsconfig.json`, isDirectory: false, extension: '.json' },
        { name: 'README.md', path: `${dirPath}/README.md`, isDirectory: false, extension: '.md' },
      ]);
    }
  }, []);

  useEffect(() => {
    loadWorkspaceTree(workspacePath);
  }, [workspacePath, loadWorkspaceTree]);

  // Open File in Monaco Editor
  const handleOpenFile = async (filePath: string, fileName?: string, existingContent?: string) => {
    const existing = openFiles.find((f) => f.path === filePath || f.id === filePath);
    if (existing) {
      setActiveFileId(existing.id);
      return;
    }

    let content = existingContent;
    if (content === undefined && window.electronAPI?.fs?.readFile) {
      try {
        const res = await window.electronAPI.fs.readFile(filePath);
        content = res.content;
      } catch {
        content = `// Não foi possível carregar o arquivo: ${filePath}`;
      }
    }

    const name = fileName || filePath.split('/').pop() || 'untitled';
    const newFile: OpenFileItem = {
      id: filePath,
      name,
      path: filePath,
      content: content || '',
      language: getFileLanguage(name),
      isDirty: false,
    };

    setOpenFiles((prev) => [...prev, newFile]);
    setActiveFileId(newFile.id);

    // If opening a file belonging to a git project, automatically synchronize workspacePath & terminalCwd
    if (filePath && filePath.startsWith('/')) {
      const parts = filePath.split('/');
      parts.pop();
      const fileDir = parts.join('/');
      if (window.electronAPI?.shell?.exec) {
        window.electronAPI.shell.exec('git rev-parse --show-toplevel', fileDir).then((res) => {
          if (res.exitCode === 0 && res.stdout.trim()) {
            const root = res.stdout.trim();
            if (root && root !== workspacePath) {
              setWorkspacePath(root);
              setTerminalCwd(root);
              localStorage.setItem('ide_workspace_path', root);
              localStorage.setItem('ide_terminal_cwd', root);
            }
          }
        }).catch(() => {});
      }
    }
  };

    // Close Editor More Menu on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (editorMoreMenuRef.current && !editorMoreMenuRef.current.contains(e.target as Node)) {
        setEditorMoreMenuOpen(false);
      }
    };
    if (editorMoreMenuOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [editorMoreMenuOpen]);

  const handleCloseAllFiles = () => {
    setRecentlyClosedFiles((prev) => [...openFiles, ...prev]);
    setOpenFiles([]);
    setActiveFileId('');
    setEditorMoreMenuOpen(false);
  };

  const handleCloseOtherFiles = () => {
    const current = openFiles.find((f) => f.id === activeFileId);
    if (current) {
      setRecentlyClosedFiles((prev) => [...openFiles.filter((f) => f.id !== activeFileId), ...prev]);
      setOpenFiles([current]);
    }
    setEditorMoreMenuOpen(false);
  };

  const handleCloseSavedFiles = () => {
    const unsaved = openFiles.filter((f) => f.isDirty);
    const saved = openFiles.filter((f) => !f.isDirty);
    setRecentlyClosedFiles((prev) => [...saved, ...prev]);
    if (unsaved.length > 0) {
      setOpenFiles(unsaved);
      if (!unsaved.some((f) => f.id === activeFileId)) {
        setActiveFileId(unsaved[0].id);
      }
    }
    setEditorMoreMenuOpen(false);
  };

  const handleReopenClosedFile = () => {
    if (recentlyClosedFiles.length === 0) return;
    const [last, ...rest] = recentlyClosedFiles;
    setRecentlyClosedFiles(rest);
    if (!openFiles.some((f) => f.id === last.id)) {
      setOpenFiles((prev) => [...prev, last]);
    }
    setActiveFileId(last.id);
    setEditorMoreMenuOpen(false);
  };

  const handleCopyPath = () => {
    if (activeFile?.path) {
      navigator.clipboard.writeText(activeFile.path);
      setToastMessage('Caminho absoluto copiado!');
    }
    setEditorMoreMenuOpen(false);
  };

  const handleCopyRelativePath = () => {
    if (activeFile?.path) {
      const rel = activeFile.path.replace(workspacePath, '').replace(/^\//, '');
      navigator.clipboard.writeText(rel);
      setToastMessage('Caminho relativo copiado!');
    }
    setEditorMoreMenuOpen(false);
  };

  const handleRevealInExplorer = () => {
    setShowExplorer(true);
    setActiveSidebarTab('explorer');
    setEditorMoreMenuOpen(false);
  };

  const handleFormatDocument = () => {
    try {
      editorInstanceRef.current?.getAction('editor.action.formatDocument')?.run();
      setToastMessage('Documento formatado!');
    } catch {}
    setEditorMoreMenuOpen(false);
  };

  const handleAiReviewCurrentFile = () => {
    setEditorMoreMenuOpen(false);
    setShowAiPanel(true);
    setSelectedAiProvider('antigravity');
    const promptText = `Por favor, faça um code review deste arquivo (${activeTab?.name || 'arquivo atual'}):\n\`\`\`${activeTab?.language || ''}\n${activeTab?.content || ''}\n\`\`\``;
    setAskPrompt(promptText);
  };

  const handleAiExplainCurrentFile = () => {
    setEditorMoreMenuOpen(false);
    setShowAiPanel(true);
    setSelectedAiProvider('antigravity');
    const promptText = `Por favor, explique o funcionamento e a lógica deste arquivo (${activeTab?.name || 'arquivo atual'}):\n\`\`\`${activeTab?.language || ''}\n${activeTab?.content || ''}\n\`\`\``;
    setAskPrompt(promptText);
  };

  const handleCloseFile = (fileId: string, e?: React.MouseEvent) => {
    e.stopPropagation();
    if (openFiles.length <= 1) return;
    const nextFiles = openFiles.filter((f) => f.id !== fileId);
    setOpenFiles(nextFiles);
    if (activeFileId === fileId) {
      setActiveFileId(nextFiles[nextFiles.length - 1].id);
    }
  };

  // Code Review (Diff View) Handlers
  const handleStartReview = async (files: ChangedFileItem[], index = 0) => {
    if (!files || files.length === 0) return;
    const safeIdx = Math.max(0, Math.min(index, files.length - 1));
    const targetFile = files[safeIdx];
    if (!targetFile) return;

    const baseCwd = workspacePath || targetFile.path.split('/').slice(0, -1).join('/');
    let relPath = targetFile.path;
    if (relPath.startsWith(baseCwd + '/')) {
      relPath = relPath.slice(baseCwd.length + 1);
    }

    let originalContent = '';
    if (window.electronAPI?.shell?.exec) {
      try {
        const gitShowRes = await window.electronAPI.shell.exec(`git show HEAD:"${relPath}"`, baseCwd);
        if (gitShowRes.exitCode === 0) {
          originalContent = gitShowRes.stdout;
        }
      } catch {}
    }

    let modifiedContent = '';
    const openF = openFiles.find((f) => f.path === targetFile.path);
    if (openF) {
      modifiedContent = openF.content;
    } else if (window.electronAPI?.fs?.readFile) {
      try {
        const res = await window.electronAPI.fs.readFile(targetFile.path);
        modifiedContent = res.content || '';
      } catch {}
    }

    setActiveReview({
      files,
      currentIndex: safeIdx,
      originalContent,
      modifiedContent,
      isSideBySide: true,
    });
  };

  const handleReviewNavigate = async (newIndex: number) => {
    if (!activeReview) return;
    if (newIndex < 0 || newIndex >= activeReview.files.length) return;
    await handleStartReview(activeReview.files, newIndex);
  };

  const handleReviewDiscard = async () => {
    if (!activeReview) return;
    const current = activeReview.files[activeReview.currentIndex];
    if (!current) return;

    const baseCwd = workspacePath || current.path.split('/').slice(0, -1).join('/');
    let relPath = current.path;
    if (relPath.startsWith(baseCwd + '/')) {
      relPath = relPath.slice(baseCwd.length + 1);
    }

    try {
      const isTracked = activeReview.originalContent.length > 0;
      if (isTracked) {
        await window.electronAPI.shell.exec(`git checkout -- "${relPath}"`, baseCwd);
      } else {
        await window.electronAPI.fs.deleteItem(current.path);
      }
      setToastMessage(`Alterações descartadas em ${current.name}`);
      await loadWorkspaceTree(baseCwd);

      if (isTracked) {
        const res = await window.electronAPI.fs.readFile(current.path);
        setOpenFiles((prev) =>
          prev.map((f) => (f.path === current.path ? { ...f, content: res.content, isDirty: false } : f))
        );
      } else {
        setOpenFiles((prev) => prev.filter((f) => f.path !== current.path));
      }
    } catch {
      setToastMessage(`Erro ao descartar alterações em ${current.name}`);
    }

    const remaining = activeReview.files.filter((_, i) => i !== activeReview.currentIndex);
    if (remaining.length > 0) {
      await handleStartReview(remaining, Math.min(activeReview.currentIndex, remaining.length - 1));
    } else {
      setActiveReview(null);
    }
  };

  const handleReviewAccept = () => {
    if (!activeReview) return;
    const current = activeReview.files[activeReview.currentIndex];
    setToastMessage(`Alterações aceitas em ${current.name}`);
    if (activeReview.currentIndex < activeReview.files.length - 1) {
      handleReviewNavigate(activeReview.currentIndex + 1);
    } else {
      setActiveReview(null);
      handleOpenFile(current.path, current.name);
    }
  };

  // GitHub Issues Integration
  const refreshGitHubIssues = useCallback(async () => {
    if (!window.electronAPI?.shell?.exec) return;
    const cwd = workspacePath || process.cwd();
    setIsLoadingIssues(true);
    try {
      const res = await window.electronAPI.shell.exec(
        'export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"; gh issue list --limit 30 --json number,title,author,updatedAt,labels,state',
        cwd
      );
      if (res.exitCode === 0 && res.stdout.trim()) {
        const parsed = JSON.parse(res.stdout.trim());
        if (Array.isArray(parsed)) {
          setGitIssues(parsed);
        }
      }
    } catch (e) {
      console.warn('Failed to load GitHub issues:', e);
    } finally {
      setIsLoadingIssues(false);
    }
  }, [workspacePath]);

  const handleCreateIssue = async (title: string) => {
    if (!title.trim() || !window.electronAPI?.shell?.exec) return;
    const cwd = workspacePath || process.cwd();
    setIsLoadingIssues(true);
    try {
      const res = await window.electronAPI.shell.exec(
        `export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"; gh issue create --title "${title.replace(/"/g, '\\"')}" --body "Criada via DevFlow IDE"`,
        cwd
      );
      if (res.exitCode === 0) {
        setToastMessage('Issue criada com sucesso no GitHub!');
        setNewIssueTitle('');
        setIsCreatingIssue(false);
        await refreshGitHubIssues();
      } else {
        setToastMessage(`Erro ao criar issue: ${res.stderr || res.error}`);
      }
    } catch (e: any) {
      setToastMessage(`Erro: ${e.message}`);
    } finally {
      setIsLoadingIssues(false);
    }
  };

  const handleLinkIssueToChat = (issue: GitHubIssueItem) => {
    setIsIssuesModalOpen(false);
    setShowAiPanel(true);
    const promptText = `Resolver Issue #${issue.number}: ${issue.title}`;
    setAskPrompt(promptText);
    setTimeout(() => {
      inputRef.current?.focus();
    }, 150);
    setToastMessage(`Issue #${issue.number} vinculada ao chat de IA`);
  };

  const handleOpenIssueInBrowser = (issueNumber: number) => {
    const repo = gitRepoName || 'appmoove/ainaobra';
    const cleanRepo = repo.includes('/') ? repo : `appmoove/${repo}`;
    const url = `https://github.com/${cleanRepo}/issues/${issueNumber}`;
    if (window.electronAPI?.shell?.openExternal) {
      window.electronAPI.shell.openExternal(url);
    }
  };

  // Git Branches Integration
  const refreshGitBranches = useCallback(async () => {
    if (!window.electronAPI?.shell?.exec) return;
    const cwd = workspacePath || process.cwd();
    try {
      const curRes = await window.electronAPI.shell.exec('git branch --show-current', cwd);
      if (curRes.exitCode === 0 && curRes.stdout.trim()) {
        setCurrentBranch(curRes.stdout.trim());
      }

      const remoteRes = await window.electronAPI.shell.exec('git config --get remote.origin.url', cwd);
      if (remoteRes.exitCode === 0 && remoteRes.stdout.trim()) {
        const rUrl = remoteRes.stdout.trim();
        const m = rUrl.match(/[:/]([^/:]+\/[^/:]+?)(?:\.git)?$/);
        if (m && m[1]) {
          setGitRepoName(m[1]);
        }
      }

      const branchRes = await window.electronAPI.shell.exec('git branch -a', cwd);
      if (branchRes.exitCode === 0 && branchRes.stdout.trim()) {
        const lines = branchRes.stdout.trim().split('\n');
        const items: GitBranchItem[] = [];
        for (const l of lines) {
          const isCurr = l.startsWith('*');
          const clean = l.replace(/^\*/, '').trim();
          if (!clean || clean.includes('->')) continue;
          const isRem = clean.startsWith('remotes/');
          const name = isRem ? clean.replace(/^remotes\/[^/]+\//, '') : clean;
          if (!items.some((b) => b.name === name)) {
            items.push({
              name,
              isCurrent: isCurr,
              isRemote: isRem,
            });
          }
        }
        setBranchesList(items);
      }
    } catch {}
  }, [workspacePath]);

  const handleCheckoutBranch = async (branch: string) => {
    if (!window.electronAPI?.shell?.exec) return;
    const cwd = workspacePath || process.cwd();
    try {
      const res = await window.electronAPI.shell.exec(`git checkout ${branch}`, cwd);
      if (res.exitCode === 0) {
        setCurrentBranch(branch);
        setIsBranchModalOpen(false);
        setToastMessage(`Branch alterada para: ${branch}`);
        await refreshGitBranches();
        await loadWorkspaceTree(cwd);
      } else {
        setToastMessage(`Erro ao trocar de branch: ${res.stderr || res.error}`);
      }
    } catch (e: any) {
      setToastMessage(`Erro: ${e.message}`);
    }
  };

  const handleCreateBranch = async (newBranch: string) => {
    if (!newBranch.trim() || !window.electronAPI?.shell?.exec) return;
    const cwd = workspacePath || process.cwd();
    try {
      const res = await window.electronAPI.shell.exec(`git checkout -b ${newBranch.trim()}`, cwd);
      if (res.exitCode === 0) {
        setCurrentBranch(newBranch.trim());
        setNewBranchInput('');
        setIsCreatingBranch(false);
        setIsBranchModalOpen(false);
        setToastMessage(`Branch criada e ativa: ${newBranch.trim()}`);
        await refreshGitBranches();
      } else {
        setToastMessage(`Erro ao criar branch: ${res.stderr || res.error}`);
      }
    } catch (e: any) {
      setToastMessage(`Erro: ${e.message}`);
    }
  };

  const handleSyncGit = async () => {
    if (!window.electronAPI?.shell?.exec || isSyncingGit) return;
    const cwd = workspacePath || process.cwd();
    setIsSyncingGit(true);
    try {
      const res = await window.electronAPI.shell.exec('git pull --rebase && git push', cwd);
      if (res.exitCode === 0) {
        setToastMessage('Sincronizado com sucesso com o GitHub!');
      } else {
        setToastMessage(`Sincronização: ${res.stdout || res.stderr || 'concluído'}`);
      }
      await refreshGitBranches();
      await refreshGitHubIssues();
    } catch (e: any) {
      setToastMessage(`Erro na sincronização: ${e.message}`);
    } finally {
      setIsSyncingGit(false);
    }
  };

  useEffect(() => {
    refreshGitBranches();
    refreshGitHubIssues();
  }, [refreshGitBranches, refreshGitHubIssues]);

  const handleEditorChange = (value: string | undefined) => {
    if (value === undefined) return;
    setOpenFiles((prev) =>
      prev.map((f) => (f.id === activeFileId ? { ...f, content: value, isDirty: true } : f))
    );
  };

  const handleSaveActiveFile = useCallback(async () => {
    const currentFile = openFiles.find((f) => f.id === activeFileId);
    if (!currentFile) return;

    if (window.electronAPI?.fs?.writeFile) {
      try {
        await window.electronAPI.fs.writeFile(currentFile.path, currentFile.content);
        setOpenFiles((prev) =>
          prev.map((f) => (f.id === activeFileId ? { ...f, isDirty: false } : f))
        );
        setToastMessage(`Salvo com sucesso: ${currentFile.name}`);
        setTimeout(() => setToastMessage(null), 2500);
      } catch (err: any) {
        setToastMessage(`Erro ao salvar: ${err.message}`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } else {
      setOpenFiles((prev) =>
        prev.map((f) => (f.id === activeFileId ? { ...f, isDirty: false } : f))
      );
      setToastMessage(`Alterações salvas localmente: ${currentFile.name}`);
      setTimeout(() => setToastMessage(null), 2500);
    }
  }, [openFiles, activeFileId]);

  // Helper to detect authentication / OAuth expired errors in AI output
  const isAuthErrorText = (text?: string): boolean => {
    if (!text) return false;
    const lower = text.toLowerCase();
    return (
      lower.includes('failed to authenticate') ||
      lower.includes('oauth session expired') ||
      lower.includes('session expired and could not be refreshed') ||
      lower.includes('please run claude login') ||
      lower.includes('please login') ||
      lower.includes('authentication required') ||
      lower.includes('not authenticated') ||
      lower.includes('login required') ||
      lower.includes('authorization required') ||
      lower.includes('token expired') ||
      lower.includes('api key is invalid') ||
      lower.includes('please authenticate')
    );
  };

  // Rich Markdown, Code Blocks, and Link Formatter for Assistant Responses
  const renderFormattedMessage = (rawText: string, msgIdx: number) => {
    if (!rawText) return null;

    // Split by fenced code blocks: ```lang\n...\n```
    const codeBlockRegex = /```([a-zA-Z0-9_-]*)\n([\s\S]*?)```/g;
    const parts: Array<{ type: 'text' | 'code'; content: string; lang?: string }> = [];
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = codeBlockRegex.exec(rawText)) !== null) {
      if (match.index > lastIndex) {
        parts.push({ type: 'text', content: rawText.slice(lastIndex, match.index) });
      }
      parts.push({
        type: 'code',
        lang: match[1] || 'text',
        content: match[2].replace(/\n$/, ''),
      });
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < rawText.length) {
      parts.push({ type: 'text', content: rawText.slice(lastIndex) });
    }

    // Helper to format inline elements: links [label](url), inline code `code`, bold **text**
    const renderInlineElements = (textChunk: string, chunkKey: string) => {
      const inlineRegex = /(\[([^\]]+)\]\(([^)]+)\)|`([^`]+)`|\*\*([^*]+)\*\*)/g;
      const inlineParts: React.ReactNode[] = [];
      let lIndex = 0;
      let inMatch: RegExpExecArray | null;

      while ((inMatch = inlineRegex.exec(textChunk)) !== null) {
        if (inMatch.index > lIndex) {
          inlineParts.push(textChunk.slice(lIndex, inMatch.index));
        }
        const fullMatch = inMatch[0];
        if (fullMatch.startsWith('[')) {
          // Markdown link
          const label = inMatch[2];
          const url = inMatch[3];
          if (url.startsWith('file://')) {
            const filePath = url.replace('file://', '');
            inlineParts.push(
              <span
                key={`${chunkKey}-link-${inMatch.index}`}
                onClick={() => handleOpenFile(filePath, label)}
                title={`Abrir ${label} no editor`}
                style={{
                  color: '#38bdf8',
                  background: isEffectiveDark ? 'rgba(56, 189, 248, 0.1)' : 'rgba(56, 189, 248, 0.15)',
                  padding: '1px 7px',
                  borderRadius: 5,
                  cursor: 'pointer',
                  fontWeight: 500,
                  fontSize: 12,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                  margin: '0 2px',
                  border: 'none',
                  transition: 'opacity 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
              >
                <FileText size={11} />
                <span>{label}</span>
              </span>
            );
          } else {
            inlineParts.push(
              <a
                key={`${chunkKey}-ext-${inMatch.index}`}
                href={url}
                onClick={(e) => {
                  e.preventDefault();
                  handleOpenExternalLink(url);
                }}
                style={{ color: '#38bdf8', textDecoration: 'underline', cursor: 'pointer' }}
              >
                {label}
              </a>
            );
          }
        } else if (fullMatch.startsWith('`')) {
          // Inline code
          const codeVal = inMatch[4];
          inlineParts.push(
            <code
              key={`${chunkKey}-code-${inMatch.index}`}
              style={{
                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                color: isEffectiveDark ? '#f3f4f6' : '#111827',
                padding: '2px 6px',
                borderRadius: 4,
                fontSize: 12,
                fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
                border: 'none',
              }}
            >
              {codeVal}
            </code>
          );
        } else if (fullMatch.startsWith('**')) {
          // Bold
          const boldVal = inMatch[5];
          inlineParts.push(
            <strong key={`${chunkKey}-b-${inMatch.index}`} style={{ fontWeight: 600, color: themeTokens.textPrimary }}>
              {boldVal}
            </strong>
          );
        }
        lIndex = inMatch.index + fullMatch.length;
      }
      if (lIndex < textChunk.length) {
        inlineParts.push(textChunk.slice(lIndex));
      }
      return inlineParts;
    };

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
        {parts.map((p, pIdx) => {
          if (p.type === 'code') {
            const codeKey = `${msgIdx}-code-${pIdx}`;
            const isCopied = copiedCodeKey === codeKey;
            return (
              <div
                key={pIdx}
                style={{
                  borderRadius: 6,
                  background: isEffectiveDark ? 'rgba(0, 0, 0, 0.4)' : 'rgba(0, 0, 0, 0.05)',
                  overflow: 'hidden',
                  marginTop: 4,
                  marginBottom: 4,
                  border: 'none',
                }}
              >
                {/* Code Header Bar */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 12px',
                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.04)',
                    fontSize: 11,
                    color: '#9ca3af',
                    fontFamily: 'monospace',
                    textTransform: 'uppercase',
                    letterSpacing: 0.5,
                  }}
                >
                  <span>{p.lang || 'código'}</span>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(p.content);
                      setCopiedCodeKey(codeKey);
                      setTimeout(() => setCopiedCodeKey(null), 2000);
                    }}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: isCopied ? '#22c55e' : '#9ca3af',
                      cursor: 'pointer',
                      fontSize: 11,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 4,
                      padding: '2px 6px',
                      borderRadius: 4,
                      transition: 'color 0.15s ease',
                    }}
                  >
                    {isCopied ? <Check size={12} /> : <Copy size={12} />}
                    <span>{isCopied ? 'Copiado' : 'Copiar'}</span>
                  </button>
                </div>
                {/* Code Body */}
                <pre
                  style={{
                    margin: 0,
                    padding: '10px 14px',
                    fontSize: 12,
                    fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Monaco, Consolas, monospace",
                    color: isEffectiveDark ? '#e5e7eb' : '#1f2937',
                    overflowX: 'auto',
                    lineHeight: '19px',
                    whiteSpace: 'pre',
                  }}
                >
                  <code>{p.content}</code>
                </pre>
              </div>
            );
          }

          // Plain text chunk: split by lines to handle list items cleanly
          const lines = p.content.split('\n');
          return (
            <div key={pIdx} style={{ display: 'flex', flexDirection: 'column', gap: 4, lineHeight: '20px' }}>
              {lines.map((line, lIdx) => {
                const trimmed = line.trim();
                const isBullet = trimmed.startsWith('•') || trimmed.startsWith('- ') || trimmed.startsWith('* ');
                const bulletText = isBullet ? trimmed.replace(/^[•\-\*]\s*/, '') : line;

                if (isBullet) {
                  return (
                    <div key={lIdx} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, paddingLeft: 4 }}>
                      <span style={{ color: accentColor || '#38bdf8', fontSize: 13, lineHeight: '20px' }}>•</span>
                      <span style={{ flex: 1 }}>{renderInlineElements(bulletText, `${msgIdx}-${pIdx}-${lIdx}`)}</span>
                    </div>
                  );
                }

                if (!line) {
                  return <div key={lIdx} style={{ height: 6 }} />;
                }

                return <div key={lIdx}>{renderInlineElements(line, `${msgIdx}-${pIdx}-${lIdx}`)}</div>;
              })}
            </div>
          );
        })}
      </div>
    );
  };

  // Layout Handlers & Helpers
  const handleResetLayout = () => {
    setShowActivityBar(true);
    setShowExplorer(true);
    setShowAiPanel(true);
    setIsTerminalCollapsed(false);
    setShowStatusBar(true);
    setSidebarPosition('left');
    setPanelAlignment('center');
    setQuickInputPosition('center');
    setIsZenMode(false);
    setIsCenteredLayout(false);
    setToastMessage('Layout redefinido para o padrão');
    setTimeout(() => setToastMessage(null), 2000);
  };

  const handleToggleFullscreen = () => {
    if (window.electronAPI?.window?.toggleMaximize) {
      window.electronAPI.window.toggleMaximize();
    } else if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen().catch(() => {});
    }
  };

  const handleToggleZenMode = () => {
    setIsZenMode((prev) => {
      const next = !prev;
      if (next) {
        setShowActivityBar(false);
        setShowExplorer(false);
        setShowAiPanel(false);
        setIsTerminalCollapsed(true);
        setShowStatusBar(false);
        setIsCenteredLayout(true);
      } else {
        setShowActivityBar(true);
        setShowExplorer(true);
        setShowAiPanel(true);
        setIsTerminalCollapsed(false);
        setShowStatusBar(true);
        setIsCenteredLayout(false);
      }
      return next;
    });
  };

  // Close Customize Layout when clicking outside
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (customizeLayoutRef.current && !customizeLayoutRef.current.contains(e.target as Node)) {
        setIsCustomizeLayoutOpen(false);
      }
    };
    if (isCustomizeLayoutOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isCustomizeLayoutOpen]);

  // Quick Open Commands list
  const quickOpenCommands = React.useMemo(() => [
    {
      id: 'view-sidebar',
      label: 'View: Toggle Primary Side Bar',
      badges: ['⌘', 'B'],
      action: () => setShowExplorer((prev) => !prev),
    },
    {
      id: 'view-panel',
      label: 'View: Toggle Panel (Terminal)',
      badges: ['⌘', 'J'],
      action: () => setIsTerminalCollapsed((prev) => !prev),
    },
    {
      id: 'view-ai',
      label: 'View: Toggle Secondary Side Bar (AI)',
      badges: ['⌘', '⇧', 'A'],
      action: () => setShowAiPanel((prev) => !prev),
    },
    {
      id: 'view-fullscreen',
      label: 'View: Toggle Full Screen',
      badges: ['⌘', 'F'],
      action: () => handleToggleFullscreen(),
    },
    {
      id: 'view-zen',
      label: 'View: Toggle Zen Mode',
      badges: ['⌘', 'K', 'Z'],
      action: () => handleToggleZenMode(),
    },
    {
      id: 'view-centered',
      label: 'View: Toggle Centered Layout',
      action: () => setIsCenteredLayout((prev) => !prev),
    },
    {
      id: 'view-activitybar',
      label: 'View: Toggle Activity Bar',
      action: () => setShowActivityBar((prev) => !prev),
    },
    {
      id: 'view-statusbar',
      label: 'View: Toggle Status Bar',
      action: () => setShowStatusBar((prev) => !prev),
    },
    {
      id: 'view-reset',
      label: 'View: Reset Layout',
      action: () => handleResetLayout(),
    },
    {
      id: 'file-save',
      label: 'File: Save Active File',
      badges: ['⌘', 'S'],
      action: () => handleSaveActiveFile(),
    },
    {
      id: 'file-new',
      label: 'File: New Untitled File',
      action: () => {
        const newId = `untitled-${Date.now()}`;
        const newFile: OpenFileItem = {
          id: newId,
          name: 'untitled.ts',
          path: newId,
          content: '',
          language: 'typescript',
          isDirty: false,
        };
        setOpenFiles((prev) => [...prev, newFile]);
        setActiveFileId(newId);
      },
    },
    {
      id: 'term-new',
      label: 'Terminal: Create New Terminal',
      action: () => handleNewTerminalSession(),
    },
    {
      id: 'term-clear',
      label: 'Terminal: Clear Terminal',
      action: () => {
        const term = activeTerminalInstanceRef.current;
        term?.clear();
      },
    },
    {
      id: 'pref-theme',
      label: 'Preferences: Color Theme & Appearance (Tema e Personalização)',
      action: () => openThemePopup(),
    },
    {
      id: 'pref-layout',
      label: 'Preferences: Customize Layout',
      action: () => setIsCustomizeLayoutOpen(true),
    },
    {
      id: 'dev-reload',
      label: 'Developer: Reload Window',
      action: () => window.location.reload(),
    },
  ], [handleResetLayout, handleSaveActiveFile, handleNewTerminalSession, openThemePopup]);

  // Flatten workspace files for quick search
  const allWorkspaceFiles = React.useMemo(() => {
    const list: { name: string; path: string; isGit?: boolean }[] = [];
    const seen = new Set<string>();

    const recurse = (nodes: ExplorerNode[]) => {
      for (const node of nodes) {
        if (!node.isDirectory) {
          if (!seen.has(node.path)) {
            seen.add(node.path);
            list.push({ name: node.name, path: node.path, isGit: node.name.startsWith('.git') });
          }
        }
        if (node.children && node.children.length > 0) {
          recurse(node.children);
        }
      }
    };
    recurse(fileTree);

    for (const f of openFiles) {
      if (!seen.has(f.path)) {
        seen.add(f.path);
        list.push({ name: f.name, path: f.path, isGit: f.name.startsWith('.git') });
      }
    }

    if (!seen.has(`${workspacePath}/.gitignore`) && !list.some((f) => f.name === '.gitignore')) {
      list.unshift({ name: '.gitignore', path: `${workspacePath}/.gitignore`, isGit: true });
    }

    return list;
  }, [fileTree, openFiles, workspacePath]);

  interface QuickOpenItemDef {
    id: string;
    title: string;
    suffix?: string;
    subtitle?: string;
    badges?: string[];
    badgeText?: string;
    badgeTextColor?: string;
    icon?: React.ReactNode;
    isDividerBefore?: boolean;
    onSelect: () => void;
  }

  const visibleQuickOpenItems = React.useMemo((): QuickOpenItemDef[] => {
    const q = quickOpenQuery.trim();

    // 1. Command Palette Mode (starts with '>')
    if (quickOpenQuery.startsWith('>')) {
      const cmdQuery = quickOpenQuery.slice(1).trim().toLowerCase();
      return quickOpenCommands
        .filter((c) => !cmdQuery || c.label.toLowerCase().includes(cmdQuery))
        .map((c) => ({
          id: c.id,
          title: c.label,
          badges: c.badges,
          onSelect: () => {
            c.action();
            setIsQuickOpenOpen(false);
          },
        }));
    }

    // 2. Go to Line Mode (starts with ':')
    if (quickOpenQuery.startsWith(':')) {
      const lineNum = quickOpenQuery.slice(1).trim();
      return [
        {
          id: 'goto-line',
          title: lineNum ? `Ir para linha ${lineNum}` : 'Digite o número da linha para navegar...',
          onSelect: () => {
            const num = parseInt(lineNum, 10);
            if (!isNaN(num) && activeEditorRef.current) {
              activeEditorRef.current.revealLineInCenter(num);
              activeEditorRef.current.setPosition({ lineNumber: num, column: 1 });
              activeEditorRef.current.focus();
            }
            setIsQuickOpenOpen(false);
          },
        },
      ];
    }

    // 3. Symbol in Editor Mode (starts with '@')
    if (quickOpenQuery.startsWith('@')) {
      return [
        {
          id: 'symbol-info',
          title: 'Símbolos no editor ativo',
          subtitle: 'Digite o nome da função, classe ou variável...',
          onSelect: () => {},
        },
      ];
    }

    // 4. File Search Mode (non-empty query without prefix)
    if (q.length > 0) {
      const lower = q.toLowerCase();
      const filtered = allWorkspaceFiles.filter(
        (f) => f.name.toLowerCase().includes(lower) || f.path.toLowerCase().includes(lower)
      );
      return filtered.map((f) => ({
        id: f.path,
        title: f.name,
        subtitle: f.path.replace(workspacePath, '').replace(/^\//, ''),
        icon: f.isGit || f.name.includes('git') ? <GitDiamondIcon size={14} /> : <FileIcon fileName={f.name} size={15} />,
        onSelect: () => {
          handleOpenFile(f.path, f.name);
          setIsQuickOpenOpen(false);
        },
      }));
    }

    // 5. Default Screen (Empty Query - Matching Screenshot perfectly!)
    const items: QuickOpenItemDef[] = [
      {
        id: 'goto-file',
        title: 'Go to File',
        badges: ['⌘', 'P'],
        onSelect: () => {
          quickOpenInputRef.current?.focus();
        },
      },
      {
        id: 'show-commands',
        title: 'Show and Run Commands',
        suffix: '>',
        badges: ['⇧', '⌘', 'P'],
        onSelect: () => {
          setQuickOpenQuery('>');
          setQuickOpenSelectedIndex(0);
        },
      },
      {
        id: 'search-text',
        title: 'Search for Text',
        suffix: '%',
        onSelect: () => {
          setQuickOpenQuery('%');
          setQuickOpenSelectedIndex(0);
        },
      },
      {
        id: 'goto-symbol',
        title: 'Go to Symbol in Editor',
        suffix: '@',
        badges: ['⇧', '⌘', 'O'],
        onSelect: () => {
          setQuickOpenQuery('@');
          setQuickOpenSelectedIndex(0);
        },
      },
      {
        id: 'start-debug',
        title: 'Start Debugging',
        suffix: 'debug',
        onSelect: () => {
          setQuickOpenQuery('debug ');
          setQuickOpenSelectedIndex(0);
        },
      },
      {
        id: 'run-task',
        title: 'Run Task',
        suffix: 'task',
        onSelect: () => {
          setQuickOpenQuery('task ');
          setQuickOpenSelectedIndex(0);
        },
      },
      {
        id: 'more-help',
        title: 'More',
        suffix: '?',
        onSelect: () => {
          setQuickOpenQuery('?');
          setQuickOpenSelectedIndex(0);
        },
      },
      // Divider and recently opened section
      {
        id: 'recent-gitignore',
        title: '.gitignore',
        badgeText: 'recently opened',
        badgeTextColor: '#3794ff',
        isDividerBefore: true,
        icon: <GitDiamondIcon size={14} />,
        onSelect: () => {
          handleOpenFile(`${workspacePath}/.gitignore`, '.gitignore');
          setIsQuickOpenOpen(false);
        },
      },
      {
        id: 'recent-git-review',
        title: 'Review Git Project Commit Request',
        icon: <GitPullRequest size={15} color="#58a6ff" />,
        onSelect: () => {
          setToastMessage('Git Commit Request carregado para revisão.');
          setIsQuickOpenOpen(false);
        },
      },
    ];

    // Add currently open files into recent section
    for (const f of openFiles) {
      if (f.name !== '.gitignore') {
        items.push({
          id: `recent-${f.id}`,
          title: f.name,
          subtitle: f.path.replace(workspacePath, '').replace(/^\//, ''),
          icon: <FileIcon fileName={f.name} size={15} />,
          onSelect: () => {
            handleOpenFile(f.path, f.name);
            setIsQuickOpenOpen(false);
          },
        });
      }
    }

    return items;
  }, [quickOpenQuery, quickOpenCommands, allWorkspaceFiles, workspacePath, openFiles, handleOpenFile]);

  // Quick Open input keyboard navigation
  const handleQuickOpenKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (visibleQuickOpenItems.length > 0) {
        setQuickOpenSelectedIndex((prev) => (prev + 1) % visibleQuickOpenItems.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (visibleQuickOpenItems.length > 0) {
        setQuickOpenSelectedIndex((prev) => (prev - 1 + visibleQuickOpenItems.length) % visibleQuickOpenItems.length);
      }
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (visibleQuickOpenItems.length > 0 && visibleQuickOpenItems[quickOpenSelectedIndex]) {
        visibleQuickOpenItems[quickOpenSelectedIndex].onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsQuickOpenOpen(false);
    }
  };

  // Auto focus input when Quick Open opens
  useEffect(() => {
    if (isQuickOpenOpen) {
      const timer = setTimeout(() => {
        quickOpenInputRef.current?.focus();
        quickOpenInputRef.current?.select();
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [isQuickOpenOpen]);

  // Close Quick Open on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (quickOpenContainerRef.current && !quickOpenContainerRef.current.contains(e.target as Node)) {
        setIsQuickOpenOpen(false);
      }
    };
    if (isQuickOpenOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isQuickOpenOpen]);

  // Close Settings Menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (settingsMenuRef.current && !settingsMenuRef.current.contains(e.target as Node)) {
        setIsSettingsMenuOpen(false);
      }
    };
    if (isSettingsMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isSettingsMenuOpen]);

  // Apply accent color and theme to document & native terminal
  useEffect(() => {
    document.documentElement.style.setProperty('--accent-color', accentColor);
    document.documentElement.style.setProperty('--accent-text-color', accentTextColor);
    localStorage.setItem('ide_accent_color', accentColor);
    if (window.electronAPI?.pty?.setAccentColor) {
      window.electronAPI.pty.setAccentColor(accentColor).catch(() => {});
    }
  }, [accentColor, accentTextColor]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', isEffectiveDark ? 'dark' : 'light');
    document.documentElement.style.setProperty('--bg-app', isEffectiveDark ? '#000000' : '#eaedf1');
    document.documentElement.style.setProperty('--bg-card', isEffectiveDark ? '#101010' : '#ffffff');
    document.documentElement.style.setProperty('--text-primary', isEffectiveDark ? '#ffffff' : '#0f172a');
    document.documentElement.style.setProperty('--text-secondary', isEffectiveDark ? '#888888' : '#475569');
    document.documentElement.style.setProperty('--border-color', 'transparent');
    localStorage.setItem('ide_theme_mode', themeMode);
    // Sync native window theme with Electron
    if ((window as any).electronAPI?.windowState?.setTheme) {
      (window as any).electronAPI.windowState.setTheme(isEffectiveDark ? 'dark' : 'light');
    }
  }, [themeMode, isEffectiveDark]);

  useEffect(() => {
    localStorage.setItem('ide_use_ai_chat_color', String(useAiChatThemeColor));
  }, [useAiChatThemeColor]);

  useEffect(() => {
    localStorage.setItem('ide_editor_font_size', String(editorFontSize));
  }, [editorFontSize]);

  useEffect(() => {
    localStorage.setItem('ide_editor_tab_size', String(editorTabSize));
  }, [editorTabSize]);

  useEffect(() => {
    localStorage.setItem('ide_editor_minimap', String(editorMinimap));
  }, [editorMinimap]);

  useEffect(() => {
    localStorage.setItem('ide_editor_word_wrap', String(editorWordWrap));
  }, [editorWordWrap]);

  useEffect(() => {
    localStorage.setItem('ide_editor_line_numbers', String(editorLineNumbers));
  }, [editorLineNumbers]);

  // Global shortcuts (Antigravity & VS Code layout toggles & Quick Open & Settings)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Escape: Exit Zen mode, Close Theme Popup, Settings Modal, Settings Menu, Quick Open, or Customize Layout
      if (e.key === 'Escape') {
        if (isThemePopupOpen) {
          setIsThemePopupOpen(false);
          return;
        }
        if (isZenMode) {
          setIsZenMode(false);
          return;
        }
        if (isSettingsModalOpen) {
          setIsSettingsModalOpen(false);
          return;
        }
        if (isSettingsMenuOpen) {
          setIsSettingsMenuOpen(false);
          return;
        }
        if (isQuickOpenOpen) {
          setIsQuickOpenOpen(false);
          return;
        }
        if (isCustomizeLayoutOpen) {
          setIsCustomizeLayoutOpen(false);
          return;
        }
      }
      // Cmd/Ctrl + ,: Open Settings Modal
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key === ',') {
        e.preventDefault();
        setIsSettingsModalOpen((prev) => !prev);
        setIsSettingsMenuOpen(false);
      }
      // Cmd/Ctrl + Shift + E: Explorer
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        if (showExplorer && activeActivityTab === 'explorer') {
          setShowExplorer(false);
        } else {
          setActiveActivityTab('explorer');
          setShowExplorer(true);
        }
      }
      // Cmd/Ctrl + Shift + F: Search in files
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        if (showExplorer && activeActivityTab === 'search') {
          setShowExplorer(false);
        } else {
          setActiveActivityTab('search');
          setShowExplorer(true);
        }
      }
      // Ctrl + Shift + G: Source Control / Git
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        if (showExplorer && activeActivityTab === 'git') {
          setShowExplorer(false);
        } else {
          setActiveActivityTab('git');
          setShowExplorer(true);
        }
      }
      // Cmd/Ctrl + Shift + D: Run and Debug
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        if (showExplorer && activeActivityTab === 'debug') {
          setShowExplorer(false);
        } else {
          setActiveActivityTab('debug');
          setShowExplorer(true);
        }
      }
      // Cmd/Ctrl + Shift + X: Extensions Marketplace
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'x') {
        e.preventDefault();
        if (showExplorer && activeActivityTab === 'extensions') {
          setShowExplorer(false);
        } else {
          setActiveActivityTab('extensions');
          setShowExplorer(true);
        }
      }
      // Cmd/Ctrl + P: Quick Open / Search files
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsQuickOpenOpen((prev) => !prev);
        setQuickOpenQuery('');
        setQuickOpenSelectedIndex(0);
      }
      // Cmd/Ctrl + Shift + P: Command Palette
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        setIsQuickOpenOpen(true);
        setQuickOpenQuery('>');
        setQuickOpenSelectedIndex(0);
      }
      // Cmd/Ctrl + Shift + O: Symbol in editor
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && !e.altKey && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        setIsQuickOpenOpen(true);
        setQuickOpenQuery('@');
        setQuickOpenSelectedIndex(0);
      }
      // Cmd/Ctrl + S: Save file
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveActiveFile();
      }
      // Cmd/Ctrl + B: Toggle Explorer (Sidebar)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setShowExplorer((prev) => !prev);
      }
      // Cmd/Ctrl + J: Toggle Bottom Panel (Terminal)
      if ((e.metaKey || e.ctrlKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        setIsTerminalCollapsed((prev) => !prev);
      }
      // Cmd/Ctrl + Shift + A or Cmd/Ctrl + Alt + B: Toggle AI Assistant Panel
      if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key.toLowerCase() === 'a') ||
          ((e.metaKey || e.ctrlKey) && e.altKey && e.key.toLowerCase() === 'b')) {
        e.preventDefault();
        setShowAiPanel((prev) => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSaveActiveFile, isCustomizeLayoutOpen, isQuickOpenOpen, isSettingsMenuOpen, isSettingsModalOpen, isThemePopupOpen, isZenMode]);

  // Check installed CLIs on native machine: startup, window focus, PTY command exits, and low-frequency poll
  useEffect(() => {
    const refreshInstalledClis = () => {
      if (window.electronAPI?.ai?.checkClis) {
        window.electronAPI.ai.checkClis().then((res) => {
          if (!res) return;
          const prev = prevInstalledClisRef.current;
          const newlyInstalled: string[] = [];

          let hasChanges = false;
          for (const p of AI_PROVIDERS) {
            if (res[p.id] !== prev[p.id]) {
              hasChanges = true;
            }
            if (res[p.id] && prev[p.id] === false) {
              newlyInstalled.push(p.id);
            }
          }

          if (hasChanges) {
            prevInstalledClisRef.current = res;
            setInstalledClis(res);
          }

          // If a new CLI was detected as installed, auto-unlock and auto-select it!
          if (newlyInstalled.length > 0) {
            const latestId = newlyInstalled[0];
            const prov = AI_PROVIDERS.find((p) => p.id === latestId);
            if (prov) {
              handleSwitchAiProvider(prov.id);
              setAiNotInstalledAlert(null);
              setToastMessage(`🎉 ${prov.name} instalado com sucesso e liberado para uso!`);
            }
          }
        }).catch(console.error);
      }
    };

    refreshInstalledClis();
    // Low-frequency background poll (30s) - window focus and pty.onExit handle instant updates
    const pollInterval = setInterval(refreshInstalledClis, 30000);
    window.addEventListener('focus', refreshInstalledClis);
    const unsubExit = window.electronAPI?.pty?.onExit?.(() => {
      refreshInstalledClis();
    });

    return () => {
      clearInterval(pollInterval);
      window.removeEventListener('focus', refreshInstalledClis);
      if (unsubExit) unsubExit();
    };
  }, []);

  // Dynamically synchronize slash commands with the actual CLI on the system (cached & non-blocking)
  useEffect(() => {
    const fetchCliCommands = (provId: string) => {
      if (window.electronAPI?.ai?.getCommands) {
        window.electronAPI.ai.getCommands(provId).then((cmds) => {
          if (cmds && cmds.length > 0) {
            setAiCommands((prev) => {
              if (prev[provId] && prev[provId].length === cmds.length) return prev;
              return { ...prev, [provId]: cmds };
            });
          }
        }).catch(console.error);
      }
    };

    if (!aiCommands[selectedAiProvider] || aiCommands[selectedAiProvider].length === 0) {
      fetchCliCommands(selectedAiProvider);
    }
  }, [selectedAiProvider]);

  // Save chat sessions to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('ide_ai_chat_sessions', JSON.stringify(chatSessions));
    } catch {}
  }, [chatSessions]);

  // Click outside listener for Explorer 3-dots popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (explorerMenuRef.current && !explorerMenuRef.current.contains(e.target as Node)) {
        setExplorerMenuOpen(false);
      }
    };
    if (explorerMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [explorerMenuOpen]);

  // Click outside listener for Chat History popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (chatHistoryPopupRef.current && !chatHistoryPopupRef.current.contains(e.target as Node)) {
        setChatHistoryPopupOpen(false);
      }
    };
    if (chatHistoryPopupOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [chatHistoryPopupOpen]);

  // Click outside listener for Provider Dropdown popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(e.target as Node)) {
        setProviderDropdown(false);
      }
    };
    if (providerDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [providerDropdown]);

  // Click outside listener for Model Dropdown popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdown(false);
      }
    };
    if (modelDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [modelDropdown]);

  // Fetch real live AI Models from native CLI service
  const refreshAiModels = useCallback(async (providerId?: string) => {
    const target = providerId || selectedAiProvider;
    if (window.electronAPI?.ai?.getModels) {
      setIsLoadingModels(true);
      try {
        const res = await window.electronAPI.ai.getModels(target);
        if (res && res.models?.length > 0) {
          setActiveModels((prev) => ({
            ...prev,
            [target]: res,
          }));
          setSelectedModel(res.currentModel);
        }
      } catch (err) {
        console.error('Error fetching AI models:', err);
      } finally {
        setIsLoadingModels(false);
      }
    }
  }, [selectedAiProvider]);

  useEffect(() => {
    refreshAiModels(selectedAiProvider);
  }, [selectedAiProvider, refreshAiModels]);

  const handleSelectModel = async (modelItem: { id: string; label: string }) => {
    setModelDropdown(false);
    setSelectedModel(modelItem.label);
    setActiveModels((prev) => {
      const existing = prev[selectedAiProvider];
      return {
        ...prev,
        [selectedAiProvider]: {
          providerId: selectedAiProvider,
          currentModel: modelItem.label,
          currentModelId: modelItem.id,
          models: existing?.models || [],
        },
      };
    });

    if (window.electronAPI?.ai?.setModel) {
      setIsLoadingModels(true);
      try {
        const res = await window.electronAPI.ai.setModel(selectedAiProvider, modelItem.id);
        if (res?.success) {
          setToastMessage(`Modelo alterado: ${modelItem.label}`);
        }
      } catch (err) {
        console.error('Failed to set AI model:', err);
      } finally {
        setIsLoadingModels(false);
      }
    }
  };

  // Fetch real live AI Quotas from native CLI service
  const refreshAiQuotas = useCallback(() => {
    if (window.electronAPI?.ai?.getQuotas) {
      window.electronAPI.ai.getQuotas().then((quotas) => {
        if (quotas && Object.keys(quotas).length > 0) {
          setAiQuotas(quotas);
        }
      }).catch(console.error);
    }
  }, []);

  useEffect(() => {
    refreshAiQuotas();
    const interval = setInterval(refreshAiQuotas, 120000);
    window.addEventListener('focus', refreshAiQuotas);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', refreshAiQuotas);
    };
  }, [refreshAiQuotas]);

  // Click outside listener for Quota Tooltip popup
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (quotaTooltipRef.current && !quotaTooltipRef.current.contains(e.target as Node)) {
        setQuotaTooltipOpen(false);
      }
    };
    if (quotaTooltipOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [quotaTooltipOpen]);

  // Dialog Handlers (3 Dots Menu)
  const handleOpenFolderDialog = async () => {
    setExplorerMenuOpen(false);
    if (window.electronAPI?.dialog?.openFolder) {
      const res = await window.electronAPI.dialog.openFolder();
      if (res && res.folderPath) {
        setWorkspacePath(res.folderPath);
        setTerminalCwd(res.folderPath);
        localStorage.setItem('ide_workspace_path', res.folderPath);
        localStorage.setItem('ide_terminal_cwd', res.folderPath);
        await loadWorkspaceTree(res.folderPath);
        setToastMessage(`Pasta aberta: ${res.name}`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } else {
      const folder = prompt('Digite o caminho absoluto da pasta:', workspacePath);
      if (folder && folder.trim()) {
        setWorkspacePath(folder.trim());
        setTerminalCwd(folder.trim());
        await loadWorkspaceTree(folder.trim());
      }
    }
  };

  const handleOpenFileDialog = async () => {
    setExplorerMenuOpen(false);
    if (window.electronAPI?.dialog?.openFile) {
      const res = await window.electronAPI.dialog.openFile();
      if (res && res.filePath) {
        handleOpenFile(res.filePath, res.name, res.content);
        setToastMessage(`Arquivo aberto: ${res.name}`);
        setTimeout(() => setToastMessage(null), 3000);
      }
    } else {
      const file = prompt('Digite o caminho absoluto do arquivo para abrir:');
      if (file && file.trim()) {
        handleOpenFile(file.trim());
      }
    }
  };

  const handleCreateNewFile = async () => {
    setExplorerMenuOpen(false);
    const fileName = prompt('Nome do novo arquivo (ex: app.module.ts, style.css):');
    if (!fileName || !fileName.trim()) return;

    const fullPath = `${workspacePath}/${fileName.trim()}`;
    if (window.electronAPI?.fs?.createItem) {
      try {
        await window.electronAPI.fs.createItem(fullPath, false);
        await loadWorkspaceTree(workspacePath);
        handleOpenFile(fullPath, fileName.trim(), '');
        setToastMessage(`Arquivo criado: ${fileName.trim()}`);
        setTimeout(() => setToastMessage(null), 3000);
      } catch (err: any) {
        alert(`Erro ao criar arquivo: ${err.message}`);
      }
    } else {
      handleOpenFile(fullPath, fileName.trim(), '');
    }
  };

  const handleCreateNewFolder = async () => {
    setExplorerMenuOpen(false);
    const folderName = prompt('Nome da nova pasta:');
    if (!folderName || !folderName.trim()) return;

    const fullPath = `${workspacePath}/${folderName.trim()}`;
    if (window.electronAPI?.fs?.createItem) {
      try {
        await window.electronAPI.fs.createItem(fullPath, true);
        await loadWorkspaceTree(workspacePath);
        setToastMessage(`Pasta criada: ${folderName.trim()}`);
        setTimeout(() => setToastMessage(null), 3000);
      } catch (err: any) {
        alert(`Erro ao criar pasta: ${err.message}`);
      }
    }
  };

  const handleClearTerminal = () => {
    const promptPrefix = `walancy@MacBook-Pro ${terminalCwd.split('/').pop() || 'codes'} % `;
    setTerminalHistory([promptPrefix]);
  };

  // Real Terminal Command Submission using native macOS zsh login shell
  const handleTerminalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!terminalCommand.trim()) return;

    const cmd = terminalCommand.trim();
    setTerminalCommandHistory((prev) => [...prev, cmd]);
    setHistoryPointer(-1);
    setTerminalCommand('');

    const folderShort = terminalCwd.split('/').filter(Boolean).pop() || 'workspace';
    const promptPrefix = `walancy@MacBook-Pro ${folderShort} % `;
    const cmdLine = `${promptPrefix}${cmd}`;

    if (cmd === 'clear') {
      setTerminalHistory([promptPrefix]);
      return;
    }

    if (cmd === 'claude') {
      setTerminalHistory((prev) => [
        ...prev,
        cmdLine,
        '💡 O Claude Code CLI requer um prompt neste modo de terminal.\n• Exemplo: claude "analise os arquivos deste projeto"\n• Ou envie sua pergunta diretamente no Chat de IA à direita!',
        promptPrefix,
      ]);
      return;
    }

    let cmdToExecute = cmd;
    if (cmd.startsWith('claude ') && !cmd.includes('-p ') && !cmd.includes('--print')) {
      const promptArg = cmd.substring(7).trim().replace(/^["']|["']$/g, '');
      cmdToExecute = `claude -p "${promptArg.replace(/"/g, '\\"')}" < /dev/null`;
    }

    // Execute real command in macOS via Electron native shell
    if (window.electronAPI?.shell?.exec) {
      setTerminalHistory((prev) => [...prev, cmdLine]);
      try {
        const res = await window.electronAPI.shell.exec(cmdToExecute, terminalCwd);

        // Update working directory if cd changed it
        let nextCwd = terminalCwd;
        if (res.newCwd) {
          nextCwd = res.newCwd;
          setTerminalCwd(res.newCwd);
          localStorage.setItem('ide_terminal_cwd', res.newCwd);
        }

        const nextFolderShort = nextCwd.split('/').filter(Boolean).pop() || 'workspace';
        const nextPromptPrefix = `walancy@MacBook-Pro ${nextFolderShort} % `;

        const output = (res.stdout || '') + (res.stderr ? (res.stdout ? '\n' : '') + res.stderr : '');
        if (output.trim()) {
          setTerminalHistory((prev) => [
            ...prev,
            output.trimEnd(),
            nextPromptPrefix,
          ]);
        } else if (res.exitCode !== 0 && res.error) {
          setTerminalHistory((prev) => [
            ...prev,
            res.error,
            nextPromptPrefix,
          ]);
        } else {
          setTerminalHistory((prev) => [...prev, nextPromptPrefix]);
        }
      } catch (err: any) {
        setTerminalHistory((prev) => [...prev, `Erro: ${err.message}`, promptPrefix]);
      }
    } else {
      setTerminalHistory((prev) => [
        ...prev,
        cmdLine,
        'Erro: Shell nativo não disponível no navegador web. Execute o app Desktop no Electron para executar comandos da máquina.',
        promptPrefix,
      ]);
    }
  };

  // Keyboard navigation for terminal history (Up / Down arrows)
  const handleTerminalKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (terminalCommandHistory.length === 0) return;
      const nextPtr = historyPointer === -1 ? terminalCommandHistory.length - 1 : Math.max(0, historyPointer - 1);
      setHistoryPointer(nextPtr);
      setTerminalCommand(terminalCommandHistory[nextPtr]);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyPointer === -1) return;
      const nextPtr = historyPointer + 1;
      if (nextPtr >= terminalCommandHistory.length) {
        setHistoryPointer(-1);
        setTerminalCommand('');
      } else {
        setHistoryPointer(nextPtr);
        setTerminalCommand(terminalCommandHistory[nextPtr]);
      }
    }
  };

  // Auto-scroll terminal to bottom
  useEffect(() => {
    if (terminalScrollRef.current) {
      terminalScrollRef.current.scrollTop = terminalScrollRef.current.scrollHeight;
    }
  }, [terminalHistory]);

  // Auto-scroll AI terminal to bottom
  useEffect(() => {
    if (aiTerminalScrollRef.current) {
      aiTerminalScrollRef.current.scrollTop = aiTerminalScrollRef.current.scrollHeight;
    }
  }, [aiHistory, quotaExceededAlert]);

  // Reset quota alert when switching AI provider
  useEffect(() => {
    setQuotaExceededAlert(null);
  }, [selectedAiProvider]);

  // Open download or guide link in default system browser
  const handleOpenExternalLink = async (url: string) => {
    if (window.electronAPI?.shell?.openExternal) {
      await window.electronAPI.shell.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  };



  // Execute AI CLI command (e.g., claude, agy, gemini) or check if installed
  const handleAiSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const prompt = askPrompt.trim();
    if (!prompt || isAiExecuting) return;

    // Determine target provider: alternate if orchestrator active, or use selected
    let currentProvider = AI_PROVIDERS.find((p) => p.id === selectedAiProvider) || AI_PROVIDERS[0];
    let isDelegatedByOrchestrator = false;

    if (isOrchestratorActive) {
      const activeOrchestrated = AI_PROVIDERS.filter((p) => orchestratedProviders[p.id]);
      if (activeOrchestrated.length > 0) {
        currentProvider = activeOrchestrated[orchestratorIndex % activeOrchestrated.length];
        setOrchestratorIndex((prev) => prev + 1);
        isDelegatedByOrchestrator = true;
      }
    }

    const cliCmd = currentProvider.cliCommand;

    // Helper to append message to aiHistory and sync with current chatSession
    const pushAiMessage = (msg: {
      type: 'user' | 'assistant' | 'system' | 'error' | 'auth_required';
      text: string;
      downloadUrl?: string;
      command?: string;
      authUrl?: string;
      providerId?: string;
      timestamp?: number;
      workedDuration?: string;
      executionSteps?: ExecutionStepItem[];
      walkthrough?: WalkthroughItem;
      changedFiles?: ChangedFileItem[];
    }) => {
      if (msg.text?.toLowerCase().includes('executando')) return;
      const messageWithProvider: ChatMessageItem = {
        ...msg,
        providerId: msg.providerId || currentProvider.id || selectedAiProvider,
      };
      setAiHistory((prev) => {
        const next = [...prev, messageWithProvider];
        setChatSessions((allSessions) => {
          const idx = allSessions.findIndex((s) => s.id === activeChatSessionId);
          if (idx >= 0) {
            const updated = [...allSessions];
            const curr = updated[idx];
            updated[idx] = {
              ...curr,
              provider: currentProvider.id,
              title: curr.title === 'Chat Inicial' || curr.title === 'Nova Conversa' ? prompt.slice(0, 36) : curr.title,
              updatedAt: Date.now(),
              history: next,
            };
            return updated;
          } else {
            const newSession: ChatSessionItem = {
              id: activeChatSessionId,
              title: prompt.slice(0, 36),
              provider: currentProvider.id,
              updatedAt: Date.now(),
              history: next,
            };
            return [newSession, ...allSessions];
          }
        });
        return next;
      });
    };

    // Add user message to AI history & session
    pushAiMessage({ type: 'user', text: prompt, command: `${cliCmd}` });

    // Check if provider has exhausted credits (0% daily or 0% weekly)
    const currentQuota = aiQuotas[currentProvider.id] || DEFAULT_AI_QUOTAS[currentProvider.id];
    const dailyResetFormatted = formatRelativeResetTime(currentQuota?.dailyResetTime);
    const weeklyResetFormatted = formatRelativeResetTime(currentQuota?.weeklyResetTime);

    const isDailyExhausted = currentQuota && currentQuota.dailyPercent === 0 && dailyResetFormatted !== 'Disponível' && !dailyResetFormatted.includes('resetado');
    const isWeeklyExhausted = currentQuota && currentQuota.weeklyPercent === 0 && weeklyResetFormatted !== 'Disponível' && !weeklyResetFormatted.includes('resetado');
    const isExhausted = isDailyExhausted || isWeeklyExhausted;

    if (isExhausted) {
      const resetTime = isWeeklyExhausted ? currentQuota.weeklyResetTime : currentQuota.dailyResetTime;
      const quotaType = isWeeklyExhausted ? 'semanal' : 'diário';
      setQuotaExceededAlert({
        providerName: currentProvider.name,
        modelName: selectedModel,
        resetTime,
        quotaType,
        dailyResetTime: currentQuota.dailyResetTime,
        weeklyResetTime: currentQuota.weeklyResetTime,
      });
      setAskPrompt('');
      return;
    }

    if (isDelegatedByOrchestrator) {
      pushAiMessage({
        type: 'system',
        text: `⚡ [Orquestrador: Tarefa alternada para ${currentProvider.name}]`,
      });
    }

    setAskPrompt('');
    setIsAiExecuting(true);
    setAiNotInstalledAlert(null);

    // 1. Check if the CLI is installed using `which <cli>` via login shell
    if (window.electronAPI?.shell?.exec) {
      try {
        const checkRes = await window.electronAPI.shell.exec(`which ${cliCmd}`, terminalCwd);
        const isInstalled = checkRes.exitCode === 0 && checkRes.stdout.trim().length > 0;

        if (!isInstalled) {
          const alertData = {
            modelName: currentProvider.name,
            command: cliCmd,
            url: currentProvider.installUrl,
            guide: currentProvider.installGuide,
          };
          setAiNotInstalledAlert(alertData);
          pushAiMessage({
            type: 'error',
            text: `⚠️ IA não instalada neste dispositivo!\nO CLI "${cliCmd}" não foi encontrado no seu PATH.\nInstale clicando no botão abaixo para começar a usar.`,
            downloadUrl: currentProvider.installUrl,
            command: currentProvider.installGuide,
          });
          setIsAiExecuting(false);
          return;
        }

        // 2. Built-in instant chat commands
        if (prompt === '/clear') {
          setAiHistory([]);
          setChatSessions((prev) =>
            prev.map((s) => (s.id === activeChatSessionId ? { ...s, history: [] } : s))
          );
          setIsAiExecuting(false);
          return;
        }

        if (prompt === '/help') {
          const cmds = aiCommands[currentProvider.id] || currentProvider.commands || [];
          const helpText = `Comandos disponíveis para ${currentProvider.name}:\n\n` +
            cmds.map((c) => `• \`${c.command}\`${c.usage ? ` (${c.usage})` : ''}: ${c.description}`).join('\n');
          pushAiMessage({
            type: 'assistant',
            text: helpText,
          });
          setIsAiExecuting(false);
          return;
        }

        // 3. AI prompt & slash command execution directly within the chat panel
        const currentModelData = activeModels[currentProvider.id];
        const activeModelId = currentModelData?.currentModelId;

        // 1. Resolve real project directory dynamically (via git rev-parse or active file)
        let effectiveCwd = workspacePath;
        if (activeFile?.path && activeFile.path.startsWith('/')) {
          const parts = activeFile.path.split('/');
          parts.pop();
          const fileDir = parts.join('/');
          try {
            const revRes = await window.electronAPI.shell.exec('git rev-parse --show-toplevel', fileDir);
            if (revRes.exitCode === 0 && revRes.stdout.trim()) {
              effectiveCwd = revRes.stdout.trim();
            } else {
              effectiveCwd = fileDir;
            }
          } catch {
            effectiveCwd = fileDir || workspacePath;
          }
        } else if (workspacePath) {
          try {
            const revRes = await window.electronAPI.shell.exec('git rev-parse --show-toplevel', workspacePath);
            if (revRes.exitCode === 0 && revRes.stdout.trim()) {
              effectiveCwd = revRes.stdout.trim();
            }
          } catch {}
        }

        // Correct outdated / non-git parent path
        if (!effectiveCwd || effectiveCwd === '/Users/walancy/Documents/codes/ainaobra' || effectiveCwd === '/Users/walancy/Documents/codes/Ainaobra') {
          effectiveCwd = '/Users/walancy/Documents/codes/Ainaobra/ainaobra';
        }

        // Detect subproject/app folder inside monorepo if applicable (e.g. apps/wireframe)
        let appSubDir = '';
        if (activeFile?.path && activeFile.path.includes('/apps/')) {
          const match = activeFile.path.match(/(^.*\/apps\/[^/]+)/);
          if (match) {
            appSubDir = match[1];
          }
        }

        // Keep IDE terminal & workspace state synchronized
        setTerminalCwd(effectiveCwd);
        if (workspacePath !== effectiveCwd) {
          setWorkspacePath(effectiveCwd);
          localStorage.setItem('ide_workspace_path', effectiveCwd);
          localStorage.setItem('ide_terminal_cwd', effectiveCwd);
        }

        // 2. Build full project context for the AI CLI
        let promptWithContext = prompt;
        if (!prompt.startsWith('/')) {
          promptWithContext = `[Contexto do Projeto Aberto no DevFlow]:
- Diretório Raiz do Projeto: ${effectiveCwd}
${appSubDir ? `- Módulo/Subaplicação em Edição: ${appSubDir}` : ''}
${activeFile?.path ? `- Arquivo Aberto no Editor: ${activeFile.path}` : ''}
${openFiles.length > 0 ? `- Arquivos Abertos: ${openFiles.map((f) => f.path).filter(Boolean).join(', ')}` : ''}

INSTRUÇÕES OBRIGATÓRIAS:
1. Você está executando DIRETAMENTE no diretório do projeto: "${effectiveCwd}".
2. Crie, leia, modifique e organize TODOS os arquivos e pastas SEMPRE dentro deste projeto ("${effectiveCwd}"${appSubDir ? ` ou mais especificamente em "${appSubDir}"` : ''}).
3. NUNCA crie arquivos na pasta pessoal do usuário (~ ou /Users/walancy) ou fora da raiz deste projeto.
4. Ao criar novos componentes, páginas ou utilitários, coloque-os na estrutura de pastas correspondente do projeto atual.

Instrução do Usuário:
${prompt}`;
        }

        let fullCommand = `${cliCmd} "${promptWithContext.replace(/"/g, '\\"')}"`;
        if (cliCmd === 'claude') {
          const modelFlag = activeModelId && !prompt.startsWith('/') ? ` --model "${activeModelId}"` : '';
          fullCommand = `export PATH="$HOME/.local/bin:$PATH"; claude${modelFlag} --dangerously-skip-permissions -p "${promptWithContext.replace(/"/g, '\\"')}" < /dev/null`;
        } else if (cliCmd === 'agy') {
          const modelFlag = activeModelId && !prompt.startsWith('/') ? ` --model "${activeModelId}"` : '';
          fullCommand = `export PATH="$HOME/.local/bin:$PATH"; agy${modelFlag} --dangerously-skip-permissions --add-dir "${effectiveCwd}" -p "${promptWithContext.replace(/"/g, '\\"')}"`;
        } else if (cliCmd === 'codex') {
          const modelFlag = activeModelId && !prompt.startsWith('/') ? ` -m "${activeModelId}"` : '';
          fullCommand = `export PATH="$HOME/.local/bin:/opt/homebrew/bin:$PATH"; codex exec${modelFlag} --dangerously-bypass-approvals-and-sandbox --cd "${effectiveCwd}" "${promptWithContext.replace(/"/g, '\\"')}"`;
        }

        // Snapshot git status BEFORE execution to detect only files modified by this prompt
        const gitStatusBefore = await window.electronAPI.shell.exec('git status --porcelain', effectiveCwd);
        const beforeStatusLines = new Set<string>(
          gitStatusBefore.exitCode === 0 && gitStatusBefore.stdout
            ? gitStatusBefore.stdout.trim().split('\n').map((l: string) => l.trim()).filter(Boolean)
            : []
        );

        const startTime = Date.now();
        const execRes = await window.electronAPI.shell.exec(fullCommand, effectiveCwd);
        const durationMs = Date.now() - startTime;
        const durationSec = Math.max(1, Math.round(durationMs / 1000));
        const workedDuration = durationSec >= 60 ? `${Math.floor(durationSec / 60)}m ${durationSec % 60}s` : `${durationSec}s`;

        // Refresh file tree immediately so newly created files appear in Explorer
        await loadWorkspaceTree(effectiveCwd);

        // Prefer clean stdout; fallback to stderr/error if stdout is empty
        let cleanOutput = '';
        if (execRes.stdout && execRes.stdout.trim().length > 0) {
          cleanOutput = execRes.stdout.trim();
        } else {
          cleanOutput = (execRes.stderr || execRes.error || '').trim();
        }

        // Strip ANSI terminal escape sequences for clean chat display
        cleanOutput = cleanOutput.replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').trim();

        // Check if output is an authentication / OAuth session expired error
        const isAuthError = isAuthErrorText(cleanOutput);
        if (isAuthError) {
          const authCmd =
            currentProvider.id === 'claude'
              ? 'claude login'
              : currentProvider.id === 'antigravity'
              ? 'agy auth login'
              : currentProvider.id === 'codex'
              ? 'codex login'
              : currentProvider.id === 'gemini'
              ? 'gemini auth login'
              : `${currentProvider.cliCommand} login`;

          pushAiMessage({
            type: 'auth_required',
            text: cleanOutput,
            command: authCmd,
            providerId: currentProvider.id,
            timestamp: Date.now(),
          });
          setIsAiExecuting(false);
          return;
        }

        // Check if output is a permission error or failure
        const hasPermissionOrCriticalError =
          cleanOutput.includes('jetski: no output produced') ||
          cleanOutput.includes('auto-denied') ||
          (execRes.exitCode !== 0 && cleanOutput.toLowerCase().includes('error'));

        // Check git status after to extract only files ACTUALLY changed by this prompt
        let changedFiles: ChangedFileItem[] = [];
        if (!hasPermissionOrCriticalError && execRes.exitCode === 0) {
          try {
            const gitStatusAfter = await window.electronAPI.shell.exec('git status --porcelain', effectiveCwd);
            if (gitStatusAfter.exitCode === 0 && gitStatusAfter.stdout) {
              const afterLines = gitStatusAfter.stdout.trim().split('\n').map((l: string) => l.trim()).filter(Boolean);
              const newlyModifiedFiles = new Set<string>();
              for (const line of afterLines) {
                if (!beforeStatusLines.has(line)) {
                  const relPath = line.slice(2).trim();
                  if (relPath && !relPath.endsWith('/')) {
                    newlyModifiedFiles.add(relPath);
                  }
                }
              }

              if (newlyModifiedFiles.size > 0) {
                const gitDiffRes = await window.electronAPI.shell.exec('git diff --numstat', effectiveCwd);
                const diffMap = new Map<string, { additions: number; deletions: number }>();
                if (gitDiffRes.exitCode === 0 && gitDiffRes.stdout.trim()) {
                  const dl = gitDiffRes.stdout.trim().split('\n');
                  for (const d of dl) {
                    const parts = d.split(/\t+/);
                    if (parts.length >= 3) {
                      diffMap.set(parts[2].trim(), {
                        additions: parseInt(parts[0], 10) || 0,
                        deletions: parseInt(parts[1], 10) || 0,
                      });
                    }
                  }
                }

                for (const relPath of newlyModifiedFiles) {
                  const partsSlash = relPath.split('/');
                  const fileName = partsSlash[partsSlash.length - 1];
                  const dirName = partsSlash.slice(0, -1).join('/');
                  const diffInfo = diffMap.get(relPath) || { additions: 1, deletions: 0 };
                  changedFiles.push({
                    path: `${effectiveCwd}/${relPath}`,
                    name: fileName,
                    dir: dirName ? `.../${dirName}` : '',
                    additions: diffInfo.additions,
                    deletions: diffInfo.deletions,
                  });
                }
              }
            }
          } catch {}
        }

        // Construct Antigravity-style execution steps only if actual files were modified
        const executionSteps: ExecutionStepItem[] = [];
        if (changedFiles.length > 0) {
          executionSteps.push({
            type: 'explore',
            label: `Explored ${changedFiles.length} file${changedFiles.length > 1 ? 's' : ''}`,
          });
          changedFiles.forEach((f) => {
            executionSteps.push({
              type: 'edit',
              label: `Edited ${f.name}`,
              file: f.name,
              additions: f.additions,
              deletions: f.deletions,
            });
          });
        }

        // Extract walkthrough summary ONLY when actual code changes were made or explicit walkthrough section exists
        let walkthrough: WalkthroughItem | undefined = undefined;
        if (!hasPermissionOrCriticalError && changedFiles.length > 0 && cleanOutput.length > 20) {
          const nonCodeLines = cleanOutput
            .split('\n')
            .filter((l: string) => l.trim().length > 0 && !l.startsWith('```') && !l.startsWith('>'));
          const firstFew = nonCodeLines.slice(0, 3).join(' ');
          if (firstFew.length > 10) {
            walkthrough = {
              title: 'Walkthrough',
              summary: firstFew.length > 240 ? firstFew.slice(0, 240) + '...' : firstFew,
            };
          }
        }

        const msgText = cleanOutput || (execRes.exitCode === 0 ? 'Concluído com sucesso.' : `Comando concluído com status ${execRes.exitCode}`);

        pushAiMessage({
          type: 'assistant',
          text: msgText,
          timestamp: Date.now(),
          workedDuration: changedFiles.length > 0 || durationSec > 2 ? workedDuration : undefined,
          executionSteps: executionSteps.length > 0 ? executionSteps : undefined,
          walkthrough,
          changedFiles: changedFiles.length > 0 ? changedFiles : undefined,
        });
      } catch (err: any) {
        pushAiMessage({
          type: 'error',
          text: `Erro na execução do terminal de IA: ${err.message}`,
        });
      } finally {
        setIsAiExecuting(false);
        refreshAiQuotas();
        if (prompt.startsWith('/model')) {
          refreshAiModels(currentProvider.id);
        }
      }
    } else {
      setTimeout(() => {
        const sampleChangedFiles: ChangedFileItem[] = [
          { path: 'src/App.tsx', name: 'App.tsx', dir: '...flow-desktop/src', additions: 144, deletions: 36 },
        ];
        const sampleSteps: ExecutionStepItem[] = [
          { type: 'explore', label: 'Explored 1 file, 1 search' },
          { type: 'edit', label: 'Edited App.tsx', file: 'App.tsx', additions: 1, deletions: 0 },
          { type: 'explore', label: 'Explored 1 file' },
          { type: 'edit', label: 'Edited App.tsx', file: 'App.tsx', additions: 25, deletions: 0 },
          { type: 'explore', label: 'Explored 1 file' },
          { type: 'edit', label: 'Edited App.tsx', file: 'App.tsx', additions: 115, deletions: 34 },
          { type: 'run', label: 'Ran npm run build', command: 'npm run build' },
        ];
        pushAiMessage({
          type: 'assistant',
          text: `Adicionei as opções e implementei as alterações solicitadas com sucesso.\n\n• Ajustado fluxo de processamento de arquivos\n• Atualizado layout e componentes`,
          timestamp: Date.now(),
          workedDuration: '3m',
          executionSteps: sampleSteps,
          walkthrough: {
            title: 'Walkthrough',
            summary: 'Implementação do resumo de arquivos modificados, card de walkthrough e acompanhamento de etapas de execução exatamente como no Antigravity.',
          },
          changedFiles: sampleChangedFiles,
        });
        setIsAiExecuting(false);
        refreshAiQuotas();
      }, 600);
    }
  };


  const handleDebugSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!debugCommand.trim()) return;

    let res = '';
    try {
      res = String(new Function('return (' + debugCommand + ')')());
    } catch (err: any) {
      res = `Evaluation Error: ${err.message}`;
    }

    setDebugHistory((prev) => [...prev, `> ${debugCommand}`, res]);
    setDebugCommand('');
  };

  const showTrafficLightSpacer = !isFullscreen;

  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        padding: 5,
        background: themeTokens.bgApp,
        flexDirection: 'column',
        justifyContent: 'flex-start',
        alignItems: 'flex-start',
        gap: 5,
        display: 'flex',
        overflow: 'hidden',
        boxSizing: 'border-box',
        position: 'relative',
        transition: 'background 0.2s ease',
      }}
    >

      {/* ============================================================ */}
      {/* 1. TOP BAR WITH ANIMATED TABS & INLINE CONTROLS              */}
      {/* ============================================================ */}
      <div
        style={{
          width: '100%',
          background: themeTokens.bgApp,
          borderRadius: 10,
          justifyContent: 'space-between',
          alignItems: 'center',
          display: 'flex',
          flexShrink: 0,
          WebkitAppRegion: 'drag' as any,
          position: 'relative',
        }}
      >
        {/* Left: Animated Traffic lights spacer + Nav Tabs */}
        <div
          style={{
            justifyContent: 'flex-start',
            alignItems: 'center',
            display: 'flex',
            WebkitAppRegion: 'no-drag' as any,
            flexShrink: 0,
          }}
        >
          {/* Animated Traffic Lights Capsule Container */}
          <div
            style={{
              width: showTrafficLightSpacer ? 72 : 0,
              height: 30,
              marginLeft: showTrafficLightSpacer ? 4 : 0,
              marginRight: showTrafficLightSpacer ? 6 : 0,
              borderRadius: 8,
              background: showTrafficLightSpacer
                ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#ffffff')
                : 'transparent',
              boxShadow: showTrafficLightSpacer && !isEffectiveDark
                ? '0 1px 4px rgba(0, 0, 0, 0.08)'
                : 'none',
              flexShrink: 0,
              transition: isDraggingExplorer || isDraggingAi || isDraggingTerminal ? 'none' : 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
            }}
          />

          <div
            style={{
              padding: 5,
              background: themeTokens.bgCard,
              borderRadius: 10,
              border: '1px solid ' + themeTokens.border,
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 5,
              display: 'flex',
              flexShrink: 0,
            }}
          >
            {[
              { id: 'projetos', label: 'Projetos' },
              { id: 'daily', label: 'Daily' },
              { id: 'equipmentos', label: 'Equipmentos' },
              { id: 'ide', label: 'IDE' },
              { id: 'ports', label: 'Ports' },
            ].map((t) => {
              const isActive = activeTab === t.id;
              return (
                <div
                  key={t.id}
                  onClick={() => setActiveTab(t.id as any)}
                  style={{
                    paddingLeft: 14,
                    paddingRight: 14,
                    paddingTop: 5,
                    paddingBottom: 5,
                    background: isActive ? (isEffectiveDark ? '#2E2E2E' : '#e4e7eb') : 'transparent',
                    borderRadius: 5,
                    border: 'none',
                    justifyContent: 'center',
                    alignItems: 'center',
                    display: 'flex',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    flexShrink: 0,
                    transition: 'all 0.15s ease',
                  }}
                >
                  <div
                    style={{
                      color: isActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                      fontSize: 12,
                      fontFamily: 'Poppins',
                      fontWeight: isActive ? '500' : '400',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {t.label}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Layout Icons, Dividers, Profile */}
        <div style={{ justifyContent: 'center', alignItems: 'center', gap: 10, display: 'flex', WebkitAppRegion: 'no-drag' as any, flexShrink: 0 }}>
          {/* Layout Controls: Customize Layout + 3 Panel Toggles */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }} ref={customizeLayoutRef}>
            <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 6, display: 'flex', WebkitAppRegion: 'no-drag' as any }}>
              {/* 1. Customize Layout Button */}
              <div
                onClick={() => setIsCustomizeLayoutOpen((prev) => !prev)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isCustomizeLayoutOpen ? accentColor : themeTokens.textSecondary,
                  background: isCustomizeLayoutOpen ? hexToRgba(accentColor, 0.12) : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  WebkitAppRegion: 'no-drag' as any,
                }}
                onMouseEnter={(e) => {
                  if (!isCustomizeLayoutOpen) (e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary;
                  (e.currentTarget as HTMLElement).style.background = isCustomizeLayoutOpen ? hexToRgba(accentColor, 0.2) : themeTokens.hoverBg;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = isCustomizeLayoutOpen ? accentColor : themeTokens.textSecondary;
                  (e.currentTarget as HTMLElement).style.background = isCustomizeLayoutOpen ? hexToRgba(accentColor, 0.12) : 'transparent';
                }}
                title="Personalizar Layout (Customize Layout)"
              >
                <CustomizeLayoutIcon size={17} />
              </div>

              {/* 2. Primary Sidebar (Explorer) */}
              <div
                onClick={() => setShowExplorer((prev) => !prev)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: showExplorer ? accentColor : themeTokens.textSecondary,
                  background: showExplorer ? hexToRgba(accentColor, 0.12) : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  WebkitAppRegion: 'no-drag' as any,
                }}
                onMouseEnter={(e) => {
                  if (!showExplorer) (e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary;
                  (e.currentTarget as HTMLElement).style.background = showExplorer ? hexToRgba(accentColor, 0.2) : themeTokens.hoverBg;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = showExplorer ? accentColor : themeTokens.textSecondary;
                  (e.currentTarget as HTMLElement).style.background = showExplorer ? hexToRgba(accentColor, 0.12) : 'transparent';
                }}
                title={showExplorer ? 'Ocultar Barra Lateral Primária (Explorer) ⌘B' : 'Mostrar Barra Lateral Primária (Explorer) ⌘B'}
              >
                <PanelLeft size={18} />
              </div>

              {/* 3. Bottom Panel (Terminal) */}
              <div
                onClick={() => setIsTerminalCollapsed((prev) => !prev)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: !isTerminalCollapsed ? accentColor : themeTokens.textSecondary,
                  background: !isTerminalCollapsed ? hexToRgba(accentColor, 0.12) : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  WebkitAppRegion: 'no-drag' as any,
                }}
                onMouseEnter={(e) => {
                  if (isTerminalCollapsed) (e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary;
                  (e.currentTarget as HTMLElement).style.background = !isTerminalCollapsed ? hexToRgba(accentColor, 0.2) : themeTokens.hoverBg;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = !isTerminalCollapsed ? accentColor : themeTokens.textSecondary;
                  (e.currentTarget as HTMLElement).style.background = !isTerminalCollapsed ? hexToRgba(accentColor, 0.12) : 'transparent';
                }}
                title={!isTerminalCollapsed ? 'Ocultar Painel Inferior (Terminal) ⌘J' : 'Mostrar Painel Inferior (Terminal) ⌘J'}
              >
                <PanelBottom size={18} />
              </div>

              {/* 4. Secondary Sidebar (AI Assistant Panel) */}
              <div
                onClick={() => setShowAiPanel((prev) => !prev)}
                style={{
                  width: 26,
                  height: 26,
                  borderRadius: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: showAiPanel ? accentColor : themeTokens.textSecondary,
                  background: showAiPanel ? hexToRgba(accentColor, 0.12) : 'transparent',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  WebkitAppRegion: 'no-drag' as any,
                }}
                onMouseEnter={(e) => {
                  if (!showAiPanel) (e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary;
                  (e.currentTarget as HTMLElement).style.background = showAiPanel ? hexToRgba(accentColor, 0.2) : themeTokens.hoverBg;
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.color = showAiPanel ? accentColor : themeTokens.textSecondary;
                  (e.currentTarget as HTMLElement).style.background = showAiPanel ? hexToRgba(accentColor, 0.12) : 'transparent';
                }}
                title={showAiPanel ? 'Ocultar Painel de IA ⌘⇧A' : 'Mostrar Painel de IA ⌘⇧A'}
              >
                <PanelRight size={18} />
              </div>
            </div>

            {/* Customize Layout Menu Popup (Matches Image 1 & 2) */}
            {isCustomizeLayoutOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: 38,
                  right: 0,
                  width: 340,
                  background: themeTokens.bgCardSecondary,
                  borderRadius: 10,
                  boxShadow: '0 12px 36px rgba(0, 0, 0, 0.5)',
                  border: '1px solid ' + themeTokens.border,
                  display: 'flex',
                  flexDirection: 'column',
                  zIndex: 99999,
                  overflow: 'hidden',
                  fontFamily: 'Poppins, -apple-system, sans-serif',
                  userSelect: 'none',
                  maxHeight: '80vh',
                  overflowY: 'auto',
                }}
                onClick={(e) => e.stopPropagation()}
              >
                {/* Header */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 12px',
                    borderBottom: '1px solid ' + themeTokens.border,
                    background: themeTokens.bgCard,
                  }}
                >
                  <span style={{ fontSize: 12, fontWeight: 500, color: themeTokens.textPrimary }}>
                    Customize Layout
                  </span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <button
                      onClick={handleResetLayout}
                      title="Restaurar Layout Padrão"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: themeTokens.textSecondary,
                        cursor: 'pointer',
                        padding: 3,
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: 4,
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                    >
                      <RotateCcw size={13} />
                    </button>
                    <button
                      onClick={() => setIsCustomizeLayoutOpen(false)}
                      title="Fechar"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: themeTokens.textSecondary,
                        cursor: 'pointer',
                        padding: 3,
                        display: 'flex',
                        alignItems: 'center',
                        borderRadius: 4,
                      }}
                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>

                {/* Content Rows */}
                <div style={{ padding: '6px 4px', display: 'flex', flexDirection: 'column', gap: 1 }}>
                  {/* --- Section 1: Visibility --- */}
                  {/* Activity Bar */}
                  <div
                    onClick={() => setShowActivityBar(!showActivityBar)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          border: showActivityBar ? `1px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                          background: showActivityBar ? accentColor : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {showActivityBar && <Check size={10} color="#ffffff" strokeWidth={3} />}
                      </div>
                      <span>Activity Bar</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: accentColor, fontSize: 10.5, fontWeight: 500 }}>
                      <Eye size={12} />
                      <span>Visibility</span>
                    </div>
                  </div>

                  {/* Secondary Activity Bar */}
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'default',
                      fontSize: 11.5,
                      color: themeTokens.textMuted,
                      background: 'transparent',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ width: 14, height: 14, borderRadius: 3, border: `1px solid ${themeTokens.border}` }} />
                      <span>Secondary Activity Bar</span>
                    </div>
                  </div>

                  {/* Primary Side Bar */}
                  <div
                    onClick={() => setShowExplorer(!showExplorer)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          border: showExplorer ? `1px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                          background: showExplorer ? accentColor : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {showExplorer && <Check size={10} color="#ffffff" strokeWidth={3} />}
                      </div>
                      <span>Primary Side Bar</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>⌘</span>
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>B</span>
                    </div>
                  </div>

                  {/* Secondary Side Bar */}
                  <div
                    onClick={() => setShowAiPanel(!showAiPanel)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          border: showAiPanel ? `1px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                          background: showAiPanel ? accentColor : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {showAiPanel && <Check size={10} color="#ffffff" strokeWidth={3} />}
                      </div>
                      <span>Secondary Side Bar</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>⌘</span>
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>⇧</span>
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>A</span>
                    </div>
                  </div>

                  {/* Panel */}
                  <div
                    onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          border: !isTerminalCollapsed ? `1px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                          background: !isTerminalCollapsed ? accentColor : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {!isTerminalCollapsed && <Check size={10} color="#ffffff" strokeWidth={3} />}
                      </div>
                      <span>Panel</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>⌘</span>
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>J</span>
                    </div>
                  </div>

                  {/* Status Bar */}
                  <div
                    onClick={() => setShowStatusBar(!showStatusBar)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div
                        style={{
                          width: 14,
                          height: 14,
                          borderRadius: 3,
                          border: showStatusBar ? `1px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                          background: showStatusBar ? accentColor : 'transparent',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {showStatusBar && <Check size={10} color="#ffffff" strokeWidth={3} />}
                      </div>
                      <span>Status Bar</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />

                  {/* --- Section 2: Primary Side Bar Position --- */}
                  {/* Left */}
                  <div
                    onClick={() => setSidebarPosition('left')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: sidebarPosition === 'left' ? hexToRgba(accentColor, 0.1) : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = sidebarPosition === 'left' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = sidebarPosition === 'left' ? hexToRgba(accentColor, 0.1) : 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PanelLeft size={14} color={sidebarPosition === 'left' ? accentColor : themeTokens.textSecondary} />
                      <span>Left {sidebarPosition === 'left' ? '✓' : ''}</span>
                    </div>
                    <span style={{ color: accentColor, fontSize: 10.5, fontWeight: 500 }}>
                      Primary Side Bar Position
                    </span>
                  </div>

                  {/* Right */}
                  <div
                    onClick={() => setSidebarPosition('right')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: sidebarPosition === 'right' ? hexToRgba(accentColor, 0.1) : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = sidebarPosition === 'right' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = sidebarPosition === 'right' ? hexToRgba(accentColor, 0.1) : 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PanelRight size={14} color={sidebarPosition === 'right' ? accentColor : themeTokens.textSecondary} />
                      <span>Right {sidebarPosition === 'right' ? '✓' : ''}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />

                  {/* --- Section 3: Panel Alignment --- */}
                  {/* Left */}
                  <div
                    onClick={() => {
                      setPanelAlignment('left');
                      localStorage.setItem('ide_panel_alignment', 'left');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: panelAlignment === 'left' ? hexToRgba(accentColor, 0.1) : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = panelAlignment === 'left' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = panelAlignment === 'left' ? hexToRgba(accentColor, 0.1) : 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PanelBottom size={14} color={panelAlignment === 'left' ? accentColor : themeTokens.textSecondary} />
                      <span>Left {panelAlignment === 'left' ? '✓' : ''}</span>
                    </div>
                    <span style={{ color: accentColor, fontSize: 10.5, fontWeight: 500 }}>
                      Panel Alignment
                    </span>
                  </div>

                  {/* Right */}
                  <div
                    onClick={() => {
                      setPanelAlignment('right');
                      localStorage.setItem('ide_panel_alignment', 'right');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: panelAlignment === 'right' ? hexToRgba(accentColor, 0.1) : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = panelAlignment === 'right' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = panelAlignment === 'right' ? hexToRgba(accentColor, 0.1) : 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PanelBottom size={14} color={panelAlignment === 'right' ? accentColor : themeTokens.textSecondary} />
                      <span>Right {panelAlignment === 'right' ? '✓' : ''}</span>
                    </div>
                  </div>

                  {/* Center */}
                  <div
                    onClick={() => {
                      setPanelAlignment('center');
                      localStorage.setItem('ide_panel_alignment', 'center');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: panelAlignment === 'center' ? hexToRgba(accentColor, 0.1) : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = panelAlignment === 'center' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = panelAlignment === 'center' ? hexToRgba(accentColor, 0.1) : 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PanelBottom size={14} color={panelAlignment === 'center' ? accentColor : themeTokens.textSecondary} />
                      <span>Center {panelAlignment === 'center' ? '✓' : ''}</span>
                    </div>
                  </div>

                  {/* Justify */}
                  <div
                    onClick={() => {
                      setPanelAlignment('justify');
                      localStorage.setItem('ide_panel_alignment', 'justify');
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: panelAlignment === 'justify' ? hexToRgba(accentColor, 0.1) : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = panelAlignment === 'justify' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = panelAlignment === 'justify' ? hexToRgba(accentColor, 0.1) : 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <PanelBottom size={14} color={panelAlignment === 'justify' ? accentColor : themeTokens.textSecondary} />
                      <span>Justify {panelAlignment === 'justify' ? '✓' : ''}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />

                  {/* --- Section 4: Quick Input Position --- */}
                  {/* Top */}
                  <div
                    onClick={() => setQuickInputPosition('top')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: quickInputPosition === 'top' ? hexToRgba(accentColor, 0.1) : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = quickInputPosition === 'top' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = quickInputPosition === 'top' ? hexToRgba(accentColor, 0.1) : 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: themeTokens.textSecondary }}>↑</span>
                      <span>Top {quickInputPosition === 'top' ? '✓' : ''}</span>
                    </div>
                    <span style={{ color: accentColor, fontSize: 10.5, fontWeight: 500 }}>
                      Quick Input Position
                    </span>
                  </div>

                  {/* Center */}
                  <div
                    onClick={() => setQuickInputPosition('center')}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: quickInputPosition === 'center' ? hexToRgba(accentColor, 0.1) : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = quickInputPosition === 'center' ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = quickInputPosition === 'center' ? hexToRgba(accentColor, 0.1) : 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ fontSize: 13, color: themeTokens.textSecondary }}>⚬</span>
                      <span>Center {quickInputPosition === 'center' ? '✓' : ''}</span>
                    </div>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />

                  {/* --- Section 5: Modes --- */}
                  {/* Full Screen */}
                  <div
                    onClick={handleToggleFullscreen}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Scan size={14} color={themeTokens.textSecondary} />
                      <span>Full Screen</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: accentColor, fontSize: 10.5, fontWeight: 500 }}>Modes ⌃</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                        <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>⌘</span>
                        <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>F</span>
                      </div>
                    </div>
                  </div>

                  {/* Zen Mode */}
                  <div
                    onClick={handleToggleZenMode}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: isZenMode ? hexToRgba(accentColor, 0.1) : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isZenMode ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = isZenMode ? hexToRgba(accentColor, 0.1) : 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Disc size={14} color={isZenMode ? accentColor : themeTokens.textSecondary} />
                      <span>Zen Mode {isZenMode ? '✓' : ''}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>⌘</span>
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>K</span>
                      <span style={{ fontSize: 9.5, padding: '1px 5px', borderRadius: 3, background: themeTokens.hoverBg, color: themeTokens.textSecondary, fontFamily: 'monospace' }}>Z</span>
                    </div>
                  </div>

                  {/* Centered Layout */}
                  <div
                    onClick={() => setIsCenteredLayout(!isCenteredLayout)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '5px 8px',
                      borderRadius: 5,
                      cursor: 'pointer',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      background: isCenteredLayout ? hexToRgba(accentColor, 0.1) : 'transparent',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = isCenteredLayout ? hexToRgba(accentColor, 0.15) : themeTokens.hoverBg)}
                    onMouseLeave={(e) => (e.currentTarget.style.background = isCenteredLayout ? hexToRgba(accentColor, 0.1) : 'transparent')}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Columns size={14} color={isCenteredLayout ? accentColor : themeTokens.textSecondary} />
                      <span>Centered Layout {isCenteredLayout ? '✓' : ''}</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Vertical Divider */}
          <div style={{ width: 1, height: 24, background: '#373737' }} />

          {/* Search and Settings */}
          <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 10, display: 'flex', WebkitAppRegion: 'no-drag' as any }}>
            <div
              onClick={() => {
                setIsQuickOpenOpen((prev) => !prev);
                setQuickOpenQuery('');
                setQuickOpenSelectedIndex(0);
              }}
              style={{
                width: 24,
                height: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: isQuickOpenOpen ? accentColor : themeTokens.textSecondary,
                cursor: 'pointer',
                borderRadius: 4,
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
              onMouseLeave={(e) => (e.currentTarget.style.color = isQuickOpenOpen ? accentColor : themeTokens.textSecondary)}
              title="Search files by name (⌘P)"
            >
              <Search size={18} />
            </div>
            {/* Settings Gear Button & Dropdown Menu */}
            <div style={{ position: 'relative' }} ref={settingsMenuRef}>
              <div
                onClick={() => setIsSettingsMenuOpen((prev) => !prev)}
                style={{
                  width: 24,
                  height: 24,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isSettingsMenuOpen ? accentColor : '#858585',
                  cursor: 'pointer',
                  borderRadius: 4,
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = isSettingsMenuOpen ? accentColor : '#858585')}
                title="Settings (⌘,)"
              >
                <Settings size={18} />
              </div>

              {/* Settings Dropdown Menu */}
              {isSettingsMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: 32,
                    right: 0,
                    background: '#1f1f1f',
                    border: 'none',
                    borderRadius: 6,
                    boxShadow: '0 12px 32px rgba(0, 0, 0, 0.85)',
                    zIndex: 999999,
                    minWidth: 280,
                    padding: '4px 0',
                    display: 'flex',
                    flexDirection: 'column',
                    animation: 'fadeIn 0.12s ease-out',
                    userSelect: 'none',
                  }}
                >
                  {/* Editor Settings */}
                  <div
                    onClick={() => {
                      setSettingsActiveTab('editor');
                      setIsSettingsModalOpen(true);
                      setIsSettingsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <span>Editor Settings</span>
                  </div>

                  {/* Open User Settings */}
                  <div
                    onClick={() => {
                      setSettingsActiveTab('appearance');
                      setIsSettingsModalOpen(true);
                      setIsSettingsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <span>Open User Settings</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 11, color: '#888888', fontFamily: 'monospace' }}>⌘ ,</span>
                    </div>
                  </div>

                  {/* Themes & System Appearance (Draggable Minimalist Popup) */}
                  <div
                    onClick={openThemePopup}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
                      <span>Themes & Appearance (Cor e Tema)</span>
                    </div>
                    <span style={{ fontSize: 10.5, color: '#888888', textTransform: 'capitalize' }}>{themeMode}</span>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: '#333333', margin: '4px 0' }} />

                  {/* Extensions */}
                  <div
                    onClick={() => {
                      setSettingsActiveTab('extensions');
                      setIsSettingsModalOpen(true);
                      setIsSettingsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <span>Extensions</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: 11, color: '#888888', fontFamily: 'monospace' }}>⇧ ⌘ X</span>
                    </div>
                  </div>

                  {/* Keyboard Shortcuts */}
                  <div
                    onClick={() => {
                      setSettingsActiveTab('shortcuts');
                      setIsSettingsModalOpen(true);
                      setIsSettingsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <span>Open Keyboard Shortcuts [⌘K ⌘S]</span>
                  </div>

                  {/* Configure Snippets */}
                  <div
                    onClick={() => {
                      setToastMessage('Configuração de Snippets aberta.');
                      setIsSettingsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <span>Configure Snippets</span>
                  </div>

                  {/* Divider */}
                  <div style={{ height: 1, background: '#333333', margin: '4px 0' }} />

                  {/* Tasks */}
                  <div
                    onClick={() => {
                      setToastMessage('Painel de Tarefas aberto.');
                      setIsSettingsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <span>Tasks</span>
                  </div>

                  {/* Customize Layout */}
                  <div
                    onClick={() => {
                      setIsCustomizeLayoutOpen(true);
                      setIsSettingsMenuOpen(false);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '6px 12px',
                      cursor: 'pointer',
                      fontSize: 12.5,
                      color: '#cccccc',
                      transition: 'background 0.08s ease',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#04395e';
                      e.currentTarget.style.color = '#ffffff';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'transparent';
                      e.currentTarget.style.color = '#cccccc';
                    }}
                  >
                    <span>Customize Layout</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Vertical Divider */}
          <div style={{ width: 1, height: 24, background: '#373737' }} />

          {/* Profile: Walancy / Walancy + Avatar */}
          <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 12, display: 'flex', whiteSpace: 'nowrap' }}>
            <div style={{ flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-end', display: 'inline-flex' }}>
              <div style={{ color: 'white', fontSize: 13, fontFamily: 'Poppins', fontWeight: '400', lineHeight: '14px', whiteSpace: 'nowrap' }}>
                Walancy
              </div>
              <div style={{ textAlign: 'right', color: '#727272', fontSize: 11, fontFamily: 'Poppins', fontWeight: '500', lineHeight: '15px', whiteSpace: 'nowrap' }}>
                Walancy
              </div>
            </div>
            {/* User Profile Avatar with NO border */}
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 9999,
                overflow: 'hidden',
                flexShrink: 0,
                background: '#1e1e1e',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <img
                src={avatarImg}
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.dataset.triedGithub) {
                    target.dataset.triedGithub = 'true';
                    target.src = 'https://github.com/walancy.png';
                  }
                }}
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: 9999,
                  border: 'none',
                  objectFit: 'cover',
                  display: 'block',
                }}
                alt="Walancy"
              />
            </div>
          </div>
        </div>
      </div>

      {/* ============================================================ */}
      {/* 2. MAIN CONTENT AREA (RESIZABLE COLUMNS & TERMINAL)         */}
      {/* ============================================================ */}
      {activeTab === 'ide' ? (
        <div
          style={{
            alignSelf: 'stretch',
            flex: '1 1 0',
            justifyContent: 'flex-start',
            alignItems: 'center',
            display: 'inline-flex',
            minHeight: 0,
            width: '100%',
          }}
        >
          {/* ---------------------------------------------------- */}
          {/* Activity Bar (Vertical Left Strip)                   */}
          {/* ---------------------------------------------------- */}
          {showActivityBar && !isZenMode && (
            <>
              <div
                style={{
                  alignSelf: 'stretch',
                  padding: 15,
                  background: themeTokens.bgCard,
                  borderRadius: 10,
                  border: '1px solid ' + themeTokens.border,
                  flexDirection: 'column',
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: 15,
                  display: 'inline-flex',
                  flexShrink: 0,
                  order: sidebarPosition === 'right' ? 7 : 1,
                  transition: 'background 0.2s ease',
                }}
              >
                {/* 1. Files / Explorer */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    color: (showExplorer && activeActivityTab === 'explorer') ? accentColor : themeTokens.textSecondary,
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                  title="Explorador de Arquivos (⌘⇧E)"
                  onClick={() => {
                    if (showExplorer && activeActivityTab === 'explorer') {
                      setShowExplorer(false);
                    } else {
                      setActiveActivityTab('explorer');
                      setShowExplorer(true);
                    }
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = (showExplorer && activeActivityTab === 'explorer') ? accentColor : themeTokens.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = (showExplorer && activeActivityTab === 'explorer') ? accentColor : themeTokens.textSecondary)}
                >
                  <Files size={20} />
                </div>

                {/* 2. Global Search & Replace */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    color: (showExplorer && activeActivityTab === 'search') ? accentColor : themeTokens.textSecondary,
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                  title="Buscar em Arquivos (⌘⇧F)"
                  onClick={() => {
                    if (showExplorer && activeActivityTab === 'search') {
                      setShowExplorer(false);
                    } else {
                      setActiveActivityTab('search');
                      setShowExplorer(true);
                    }
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = (showExplorer && activeActivityTab === 'search') ? accentColor : themeTokens.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = (showExplorer && activeActivityTab === 'search') ? accentColor : themeTokens.textSecondary)}
                >
                  <Search size={19} />
                </div>

                {/* 3. Source Control / Git */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    color: (showExplorer && activeActivityTab === 'git') ? accentColor : themeTokens.textSecondary,
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                  title="Controle de Versão / Git (⌃⇧G)"
                  onClick={() => {
                    if (showExplorer && activeActivityTab === 'git') {
                      setShowExplorer(false);
                    } else {
                      setActiveActivityTab('git');
                      setShowExplorer(true);
                    }
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = (showExplorer && activeActivityTab === 'git') ? accentColor : themeTokens.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = (showExplorer && activeActivityTab === 'git') ? accentColor : themeTokens.textSecondary)}
                >
                  <GitBranch size={20} />
                </div>

                {/* 4. Run and Debug */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    color: (showExplorer && activeActivityTab === 'debug') ? accentColor : themeTokens.textSecondary,
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                  title="Executar e Depurar (⌘⇧D)"
                  onClick={() => {
                    if (showExplorer && activeActivityTab === 'debug') {
                      setShowExplorer(false);
                    } else {
                      setActiveActivityTab('debug');
                      setShowExplorer(true);
                    }
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = (showExplorer && activeActivityTab === 'debug') ? accentColor : themeTokens.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = (showExplorer && activeActivityTab === 'debug') ? accentColor : themeTokens.textSecondary)}
                >
                  <Play size={19} />
                </div>

                {/* 5. Web Preview & Ports */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    color: (showExplorer && activeActivityTab === 'preview') ? accentColor : themeTokens.textSecondary,
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                  title="Web Preview & Portas Ativas"
                  onClick={() => {
                    if (showExplorer && activeActivityTab === 'preview') {
                      setShowExplorer(false);
                    } else {
                      setActiveActivityTab('preview');
                      setShowExplorer(true);
                    }
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = (showExplorer && activeActivityTab === 'preview') ? accentColor : themeTokens.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = (showExplorer && activeActivityTab === 'preview') ? accentColor : themeTokens.textSecondary)}
                >
                  <Monitor size={19} />
                </div>

                {/* 6. Extensions Marketplace (Open VSX) */}
                <div
                  style={{
                    width: 24,
                    height: 24,
                    color: (showExplorer && activeActivityTab === 'extensions') ? accentColor : themeTokens.textSecondary,
                    cursor: 'pointer',
                    transition: 'color 0.15s ease',
                  }}
                  title="Extensões do VS Code (Open VSX Marketplace) (⌘⇧X)"
                  onClick={() => {
                    if (showExplorer && activeActivityTab === 'extensions') {
                      setShowExplorer(false);
                    } else {
                      setActiveActivityTab('extensions');
                      setShowExplorer(true);
                    }
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = (showExplorer && activeActivityTab === 'extensions') ? accentColor : themeTokens.textPrimary)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = (showExplorer && activeActivityTab === 'extensions') ? accentColor : themeTokens.textSecondary)}
                >
                  <Blocks size={20} />
                </div>
                <div
                  style={{ width: 24, height: 24, color: themeTokens.textSecondary, marginTop: 'auto', cursor: 'pointer' }}
                  title="Settings (⌘,)"
                  onClick={() => setIsSettingsModalOpen(true)}
                  onMouseEnter={(e) => (e.currentTarget.style.color = accentColor)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
                >
                  <Settings size={19} />
                </div>
              </div>

              {/* 5px Spacing */}
              <div style={{ width: 5, flexShrink: 0, order: sidebarPosition === 'right' ? 6 : 1 }} />
            </>
          )}

          {/* ---------------------------------------------------- */}
          {/* Explorer Column (DRAGGABLE RESIZABLE WIDTH)          */}
          {/* ---------------------------------------------------- */}
          {showExplorer && !isZenMode && (
            <>
              <div
                style={{
                  alignSelf: 'stretch',
                  width: explorerWidth,
                  flexDirection: 'column',
                  justifyContent: 'center',
                  alignItems: 'flex-start',
                  gap: 5,
                  display: 'inline-flex',
                  flexShrink: 0,
                  transition: isDraggingExplorer ? 'none' : 'width 0.1s ease',
                  overflow: 'hidden',
                  order: sidebarPosition === 'right' ? 5 : 2,
                }}
              >
                {activeActivityTab !== 'explorer' ? (
                  <SidebarPanels
                    activeTab={activeActivityTab}
                    workspacePath={workspacePath}
                    themeTokens={themeTokens}
                    isEffectiveDark={isEffectiveDark}
                    accentColor={accentColor}
                    accentTextColor={getContrastTextColor(accentColor)}
                    activeFile={activeTab ? { path: activeTab.path, name: activeTab.name, language: activeTab.language } : null}
                    onOpenFile={(filePath, fileName) => {
                      handleOpenFile(filePath, fileName || filePath.split('/').pop() || 'Arquivo');
                    }}
                    onJumpToLine={(filePath, line) => {
                      handleOpenFile(filePath, filePath.split('/').pop() || 'Arquivo');
                      setTimeout(() => {
                        editorInstanceRef.current?.revealLineInCenter(line);
                        editorInstanceRef.current?.setPosition({ lineNumber: line, column: 1 });
                        editorInstanceRef.current?.focus();
                      }, 150);
                    }}
                    onStartReview={(files, index) => {
                      if (files && files.length > 0) {
                        startReview(files, index || 0);
                      }
                    }}
                    onRunTerminalCommand={(name, cmd) => {
                      handleNewTerminalSession('zsh', name, cmd);
                    }}
                    onToast={(msg) => setToastMessage(msg)}
                    onOpenBranchModal={() => setIsBranchModalOpen(true)}
                    currentBranch={currentBranch}
                  />
                ) : (
                  <>
                {/* Top Explorer Card */}
                <div
                  style={{
                    width: '100%',
                    flex: '1 1 0',
                    padding: 10,
                    background: themeTokens.bgCard,
                    borderRadius: 10,
                    border: '1px solid ' + themeTokens.border,
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 10,
                    display: 'flex',
                    overflowY: 'auto',
                    overflowX: 'hidden',
                    transition: 'background 0.2s ease',
                  }}
                >
                  {/* Explorer Title + More */}
                  <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex', whiteSpace: 'nowrap' }}>
                    <div style={{ color: themeTokens.textPrimary, fontSize: 12, fontFamily: 'Poppins', fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span>Explorer</span>
                      <span style={{ color: themeTokens.textMuted, fontSize: 11, fontWeight: 400 }}>
                        ({workspacePath.split('/').pop() || 'Workspace'})
                      </span>
                    </div>
                    <div
                      onClick={() => setExplorerMenuOpen(!explorerMenuOpen)}
                      title="Opções do Explorador (Abrir pasta/arquivo...)"
                      style={{ color: explorerMenuOpen ? accentColor : themeTokens.textSecondary, cursor: 'pointer', padding: 2, borderRadius: 3 }}
                    >
                      <MoreHorizontal size={16} />
                    </div>
                  </div>

                  {/* 3 Dots Popup Menu */}
                  {explorerMenuOpen && (
                    <div
                      ref={explorerMenuRef}
                      style={{
                        position: 'absolute',
                        top: 36,
                        right: 10,
                        width: 195,
                        background: themeTokens.bgCardSecondary,
                        border: '1px solid ' + themeTokens.border,
                        borderRadius: 8,
                        padding: '5px 0',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        zIndex: 99999,
                        display: 'flex',
                        flexDirection: 'column',
                      }}
                    >
                      <div
                        onClick={handleOpenFolderDialog}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <FolderOpen size={14} color={accentColor} />
                        <span>Abrir Pasta...</span>
                      </div>
                      <div
                        onClick={handleOpenFileDialog}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textPrimary }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <FileText size={14} color={accentColor} />
                        <span>Abrir Arquivo...</span>
                      </div>
                      <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />
                      <div
                        onClick={handleCreateNewFile}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textSecondary }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <FilePlus size={14} color={themeTokens.textSecondary} />
                        <span>Novo Arquivo</span>
                      </div>
                      <div
                        onClick={handleCreateNewFolder}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textSecondary }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <FolderPlus size={14} color={themeTokens.textSecondary} />
                        <span>Nova Pasta</span>
                      </div>
                      <div style={{ height: 1, background: themeTokens.border, margin: '4px 0' }} />
                      <div
                        onClick={() => {
                          setExplorerMenuOpen(false);
                          loadWorkspaceTree(workspacePath);
                        }}
                        style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, cursor: 'pointer', color: themeTokens.textSecondary }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <RefreshCw size={14} color={themeTokens.textSecondary} />
                        <span>Atualizar Explorador</span>
                      </div>
                    </div>
                  )}

                  {/* Dynamic Recursive File Tree */}
                  <div style={{ alignSelf: 'stretch', flexDirection: 'column', justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex', gap: 1 }}>
                    {fileTree.map((node) => {
                      const renderTreeItem = (item: ExplorerNode, depth = 0): React.ReactNode => {
                        const isExpanded = expandedFolders.has(item.path);
                        const isDir = item.isDirectory;
                        const ext = (item.extension || item.name.split('.').pop() || '').toLowerCase();
                        const isFileActive = activeFileId === item.path;

                        return (
                          <div key={item.path} style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                            <div
                              onClick={() => {
                                if (isDir) {
                                  setExpandedFolders((prev) => {
                                    const next = new Set(prev);
                                    if (next.has(item.path)) next.delete(item.path);
                                    else next.add(item.path);
                                    return next;
                                  });
                                } else {
                                  handleOpenFile(item.path, item.name);
                                }
                              }}
                              style={{
                                width: '100%',
                                paddingLeft: depth * 12 + 2,
                                paddingRight: 6,
                                height: 24,
                                borderRadius: 4,
                                background: isFileActive ? hexToRgba(accentColor, 0.12) : 'transparent',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 6,
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                userSelect: 'none',
                                transition: 'background 0.1s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (!isFileActive) e.currentTarget.style.background = themeTokens.hoverBg;
                              }}
                              onMouseLeave={(e) => {
                                if (!isFileActive) e.currentTarget.style.background = 'transparent';
                              }}
                            >
                              {isDir ? (
                                <>
                                  <div style={{ width: 14, height: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', color: themeTokens.textSecondary, flexShrink: 0 }}>
                                    {isExpanded ? <ChevronDown size={13} color={accentColor} /> : <ChevronRight size={13} color={themeTokens.textSecondary} />}
                                  </div>
                                  <FolderIcon folderName={item.name} isOpen={isExpanded} size={15} />
                                  <span style={{ color: isExpanded ? themeTokens.textPrimary : themeTokens.textSecondary, fontSize: 12, fontFamily: 'Poppins', fontWeight: 400 }}>
                                    {item.name}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <div style={{ width: 15, height: 15, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginLeft: 2 }}>
                                    <FileIcon fileName={item.name} size={15} />
                                  </div>
                                  <span
                                    style={{
                                      color: isFileActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                                      fontSize: 12,
                                      fontFamily: 'Poppins',
                                      fontWeight: isFileActive ? 500 : 400,
                                    }}
                                  >
                                    {item.name}
                                  </span>
                                </>
                              )}
                            </div>

                            {isDir && isExpanded && item.children && item.children.length > 0 && (
                              <div style={{ width: '100%', display: 'flex', flexDirection: 'column' }}>
                                {item.children.map((child) => renderTreeItem(child, depth + 1))}
                              </div>
                            )}
                          </div>
                        );
                      };

                      return renderTreeItem(node, 0);
                    })}
                  </div>
                </div>

                {/* Outline Card (VS Code & Antigravity Style) */}
                <div
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: themeTokens.bgCard,
                    borderRadius: 10,
                    border: 'none',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 8,
                    display: 'flex',
                    flexShrink: 0,
                    transition: 'background 0.2s ease',
                  }}
                >
                  {/* Header */}
                  <div
                    onClick={() => setIsOutlineOpen((prev) => !prev)}
                    style={{
                      alignSelf: 'stretch',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      display: 'inline-flex',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      userSelect: 'none',
                      padding: '2px 0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          transform: isOutlineOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          color: themeTokens.textSecondary,
                        }}
                      >
                        <ChevronRight size={13} />
                      </div>
                      <div style={{ color: themeTokens.textPrimary, fontSize: 12, fontFamily: 'Poppins', fontWeight: 500 }}>
                        Outline
                      </div>
                    </div>
                    {activeFile && documentSymbols.length > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: themeTokens.textSecondary,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                          padding: '1px 6px',
                          borderRadius: 10,
                          fontFamily: 'monospace',
                        }}
                      >
                        {documentSymbols.length}
                      </span>
                    )}
                  </div>

                  {/* Collapsible Content */}
                  {isOutlineOpen && (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Search Filter Input */}
                      {documentSymbols.length > 3 && (
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            width: '100%',
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                            borderRadius: 6,
                            padding: '4px 8px',
                            gap: 6,
                          }}
                        >
                          <Search size={11} color={themeTokens.textSecondary} />
                          <input
                            type="text"
                            placeholder="Filtrar símbolos..."
                            value={outlineFilter}
                            onChange={(e) => setOutlineFilter(e.target.value)}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              outline: 'none',
                              color: themeTokens.textPrimary,
                              fontSize: 11,
                              width: '100%',
                              fontFamily: 'Poppins, sans-serif',
                            }}
                          />
                          {outlineFilter && (
                            <X
                              size={11}
                              color={themeTokens.textSecondary}
                              style={{ cursor: 'pointer' }}
                              onClick={() => setOutlineFilter('')}
                            />
                          )}
                        </div>
                      )}

                      {/* Symbols List */}
                      <div
                        className="no-scrollbar"
                        style={{
                          width: '100%',
                          maxHeight: 180,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        {filteredSymbols.length > 0 ? (
                          filteredSymbols.map((sym, idx) => (
                            <div
                              key={`${sym.name}-${sym.line}-${idx}`}
                              onClick={() => handleSelectOutlineSymbol(sym)}
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '4px 6px',
                                borderRadius: 5,
                                cursor: 'pointer',
                                fontSize: 11.5,
                                color: themeTokens.textPrimary,
                                transition: 'background 0.1s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                              title={`Ir para linha ${sym.line}: ${sym.name} (${sym.kind})`}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden' }}>
                                <span
                                  style={{
                                    width: 16,
                                    height: 16,
                                    borderRadius: 3,
                                    background: hexToRgba(sym.color, 0.15),
                                    color: sym.color,
                                    fontSize: 10,
                                    fontWeight: 700,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    flexShrink: 0,
                                    fontFamily: 'monospace',
                                  }}
                                >
                                  {sym.badge}
                                </span>
                                <span
                                  style={{
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    fontFamily: 'JetBrains Mono, monospace',
                                    fontSize: 11,
                                    color: themeTokens.textPrimary,
                                  }}
                                >
                                  {sym.name}
                                </span>
                              </div>
                              <span style={{ fontSize: 10, color: themeTokens.textSecondary, fontFamily: 'monospace', flexShrink: 0 }}>
                                :{sym.line}
                              </span>
                            </div>
                          ))
                        ) : (
                          <div style={{ padding: '8px 4px', fontSize: 11, color: themeTokens.textSecondary, textAlign: 'center' }}>
                            {activeFile ? 'Nenhum símbolo detectado' : 'Nenhum arquivo ativo'}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Timeline Card (VS Code & Antigravity Style) */}
                <div
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: themeTokens.bgCard,
                    borderRadius: 10,
                    border: 'none',
                    flexDirection: 'column',
                    justifyContent: 'flex-start',
                    alignItems: 'flex-start',
                    gap: 8,
                    display: 'flex',
                    flexShrink: 0,
                    transition: 'background 0.2s ease',
                  }}
                >
                  {/* Header */}
                  <div
                    onClick={() => setIsTimelineOpen((prev) => !prev)}
                    style={{
                      alignSelf: 'stretch',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      display: 'inline-flex',
                      whiteSpace: 'nowrap',
                      cursor: 'pointer',
                      userSelect: 'none',
                      padding: '2px 0',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div
                        style={{
                          transform: isTimelineOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                          transition: 'transform 0.15s ease',
                          display: 'flex',
                          alignItems: 'center',
                          color: themeTokens.textSecondary,
                        }}
                      >
                        <ChevronRight size={13} />
                      </div>
                      <div style={{ color: themeTokens.textPrimary, fontSize: 12, fontFamily: 'Poppins', fontWeight: 500 }}>
                        Timeline
                      </div>
                    </div>
                    {activeFile && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 500,
                          color: themeTokens.textSecondary,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.05)',
                          padding: '1px 6px',
                          borderRadius: 10,
                          fontFamily: 'monospace',
                        }}
                      >
                        {activeTimelineEntries.length}
                      </span>
                    )}
                  </div>

                  {/* Collapsible Content */}
                  {isTimelineOpen && (
                    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {/* Action Bar */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 2px' }}>
                        <span style={{ fontSize: 10.5, color: themeTokens.textSecondary }}>
                          Histórico local
                        </span>
                        <button
                          onClick={handleTakeTimelineSnapshot}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            color: accentColor,
                            fontSize: 10.5,
                            fontWeight: 500,
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                            padding: '2px 4px',
                            borderRadius: 4,
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = hexToRgba(accentColor, 0.1))}
                          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          title="Criar snapshot manual deste arquivo"
                        >
                          <Plus size={11} />
                          <span>Snapshot</span>
                        </button>
                      </div>

                      {/* Entries List */}
                      <div
                        className="no-scrollbar"
                        style={{
                          width: '100%',
                          maxHeight: 180,
                          overflowY: 'auto',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 3,
                          position: 'relative',
                        }}
                      >
                        {activeTimelineEntries.map((item) => (
                          <div
                            key={item.id}
                            onClick={() => {
                              setToastMessage(`${item.label} (${item.time})`);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: 8,
                              padding: '5px 6px',
                              borderRadius: 6,
                              cursor: 'pointer',
                              transition: 'background 0.1s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = themeTokens.hoverBg)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                          >
                            <div style={{ marginTop: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              {item.type === 'edit' ? (
                                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
                              ) : item.type === 'save' ? (
                                <Save size={12} color={accentColor} />
                              ) : (
                                <Clock size={12} color={themeTokens.textSecondary} />
                              )}
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%' }}>
                                <span style={{ fontSize: 11, fontWeight: 500, color: themeTokens.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                  {item.label}
                                </span>
                                <span style={{ fontSize: 9.5, color: themeTokens.textSecondary, flexShrink: 0 }}>
                                  {item.time}
                                </span>
                              </div>
                              <span style={{ fontSize: 10, color: themeTokens.textSecondary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                {item.desc}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                  </>
                )}
              </div>

              {/* VS Code Style Vertical Resizer for Explorer */}
              <div
                className={`resizer-col ${isDraggingExplorer ? 'dragging' : ''}`}
                onMouseDown={startResizeExplorer}
                onDoubleClick={() => setExplorerWidth(280)}
                title="Arraste para redimensionar o Explorer (Duplo clique para restaurar)"
                style={{ order: sidebarPosition === 'right' ? 4 : 3 }}
              />
            </>
          )}

          {/* ---------------------------------------------------- */}
          {/* Center Area (Editor Tabs, Code Canvas, Terminal)     */}
          {/* ---------------------------------------------------- */}
          <div
            style={{
              flex: '1 1 0',
              alignSelf: 'stretch',
              flexDirection: 'column',
              justifyContent: 'flex-start',
              alignItems: 'flex-start',
              display: 'inline-flex',
              minWidth: 0,
              order: sidebarPosition === 'right' ? 1 : 4,
            }}
          >
            {/* Editor Tabs Row */}
            <div style={{ alignSelf: 'stretch', justifyContent: 'space-between', alignItems: 'center', display: 'inline-flex', flexShrink: 0 }}>
              {/* Left: Tabs pill container */}
              <div
                style={{
                  height: 38,
                  padding: '4px 5px',
                  background: themeTokens.bgCard,
                  borderRadius: 10,
                  border: '1px solid ' + themeTokens.border,
                  justifyContent: 'flex-start',
                  alignItems: 'center',
                  gap: 5,
                  display: 'flex',
                  boxSizing: 'border-box',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  overflowX: 'auto',
                  maxWidth: 'calc(100% - 150px)',
                  transition: 'background 0.2s ease',
                }}
              >
                {openFiles.length === 0 ? (
                  <div style={{ padding: '0 10px', color: themeTokens.textSecondary, fontSize: 12 }}>Nenhum arquivo aberto</div>
                ) : (
                  openFiles.map((file, idx) => {
                    const isActive = activeFileId === file.id;

                    return (
                      <React.Fragment key={file.id}>
                        {idx > 0 && <div style={{ width: 1, height: 16, background: themeTokens.border }} />}
                        <div
                          onClick={() => setActiveFileId(file.id)}
                          style={{
                            height: 28,
                            paddingLeft: 10,
                            paddingRight: 8,
                            borderRadius: 5,
                            border: 'none',
                            background: isActive ? (isEffectiveDark ? '#1c1c1c' : '#e5e7eb') : 'transparent',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: 6,
                            display: 'flex',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            flexShrink: 0,
                            transition: 'background 0.15s ease',
                          }}
                        >
                          <FileIcon fileName={file.name} size={14} />
                          <div
                            style={{
                              color: isActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                              fontSize: 12,
                              fontFamily: 'Poppins',
                              fontWeight: isActive ? '500' : '400',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {file.name}
                          </div>
                          {file.isDirty ? (
                            <span
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveActiveFile();
                              }}
                              title="Arquivo modificado (Clique ou Cmd+S para salvar)"
                              style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, display: 'inline-block', margin: '0 2px' }}
                            />
                          ) : null}
                          <div
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCloseFile(file.id);
                            }}
                            style={{
                              width: 16,
                              height: 16,
                              borderRadius: 3,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              cursor: 'pointer',
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                          >
                            <X size={12} color={themeTokens.textSecondary} />
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>

              {/* Right: Editor action icons pill */}
              <div
                style={{
                  height: 38,
                  padding: '4px 8px',
                  background: themeTokens.bgCard,
                  borderRadius: 10,
                  border: '1px solid ' + themeTokens.border,
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 8,
                  display: 'flex',
                  boxSizing: 'border-box',
                  flexShrink: 0,
                  transition: 'background 0.2s ease',
                }}
              >
                {activeFile?.isDirty && (
                  <div
                    onClick={handleSaveActiveFile}
                    title="Salvar Arquivo (Cmd+S)"
                    style={{
                      height: 26,
                      paddingLeft: 8,
                      paddingRight: 8,
                      background: accentColor,
                      borderRadius: 5,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                      cursor: 'pointer',
                      fontSize: 11,
                      color: accentTextColor,
                      fontWeight: 600,
                    }}
                  >
                    <Save size={13} color={accentTextColor} />
                    <span>Salvar</span>
                  </div>
                )}
                {/* 1. Split Editor Right / Vertical */}
                <div
                  onClick={() => {
                    if (isEditorSplit && editorSplitOrientation === 'vertical') {
                      setIsEditorSplit(false);
                    } else {
                      setIsEditorSplit(true);
                      setEditorSplitOrientation('vertical');
                      if (!secondaryFileId || secondaryFileId === activeFileId) {
                        const other = openFiles.find((f) => f.id !== activeFileId);
                        setSecondaryFileId(other ? other.id : activeFileId);
                      }
                    }
                  }}
                  style={{
                    width: 26,
                    height: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    borderRadius: 4,
                    background: isEditorSplit && editorSplitOrientation === 'vertical' ? hexToRgba(accentColor, 0.2) : 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                  title={isEditorSplit && editorSplitOrientation === 'vertical' ? 'Fechar Divisão do Editor' : 'Dividir Editor à Direita (Lado a Lado)'}
                >
                  <Columns size={15} color={isEditorSplit && editorSplitOrientation === 'vertical' ? accentColor : themeTokens.textPrimary} />
                </div>

                {/* 2. Split Editor Down / Horizontal */}
                <div
                  onClick={() => {
                    if (isEditorSplit && editorSplitOrientation === 'horizontal') {
                      setIsEditorSplit(false);
                    } else {
                      setIsEditorSplit(true);
                      setEditorSplitOrientation('horizontal');
                      if (!secondaryFileId || secondaryFileId === activeFileId) {
                        const other = openFiles.find((f) => f.id !== activeFileId);
                        setSecondaryFileId(other ? other.id : activeFileId);
                      }
                    }
                  }}
                  style={{
                    width: 26,
                    height: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    borderRadius: 4,
                    background: isEditorSplit && editorSplitOrientation === 'horizontal' ? hexToRgba(accentColor, 0.2) : 'transparent',
                    transition: 'background 0.15s ease',
                  }}
                  title={isEditorSplit && editorSplitOrientation === 'horizontal' ? 'Fechar Divisão do Editor' : 'Dividir Editor Abaixo (Horizontal)'}
                >
                  <SplitSquareVertical size={15} color={isEditorSplit && editorSplitOrientation === 'horizontal' ? accentColor : themeTokens.textPrimary} />
                </div>

                {/* 3. More Actions Dropdown */}
                <div style={{ position: 'relative' }} ref={editorMoreMenuRef}>
                  <div
                    onClick={() => setEditorMoreMenuOpen(!editorMoreMenuOpen)}
                    style={{
                      width: 26,
                      height: 26,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      borderRadius: 4,
                      background: editorMoreMenuOpen ? hexToRgba(accentColor, 0.2) : 'transparent',
                      transition: 'background 0.15s ease',
                    }}
                    title="Mais Ações do Editor"
                  >
                    <MoreHorizontal size={15} color={editorMoreMenuOpen ? accentColor : themeTokens.textSecondary} />
                  </div>

                  {editorMoreMenuOpen && (
                    <div
                      style={{
                        position: 'absolute',
                        top: 32,
                        right: 0,
                        width: 240,
                        background: themeTokens.bgCardElevated,
                        borderRadius: 8,
                        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
                        zIndex: 99999,
                        padding: '5px 0',
                        fontSize: 12,
                        fontFamily: 'Poppins, sans-serif',
                        color: themeTokens.textPrimary,
                        animation: 'fadeIn 0.12s ease-out',
                      }}
                    >
                      <div
                        onClick={handleCloseAllFiles}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <X size={13} color={themeTokens.textSecondary} />
                        <span>Fechar Todos os Editores</span>
                      </div>
                      <div
                        onClick={handleCloseOtherFiles}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <X size={13} color={themeTokens.textSecondary} />
                        <span>Fechar Outros</span>
                      </div>
                      <div
                        onClick={handleCloseSavedFiles}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Save size={13} color={themeTokens.textSecondary} />
                        <span>Fechar Salvos</span>
                      </div>
                      <div
                        onClick={handleReopenClosedFile}
                        style={{
                          padding: '6px 14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                          cursor: recentlyClosedFiles.length > 0 ? 'pointer' : 'default',
                          opacity: recentlyClosedFiles.length > 0 ? 1 : 0.4,
                        }}
                        onMouseEnter={(e) => {
                          if (recentlyClosedFiles.length > 0) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
                        }}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <RotateCcw size={13} color={themeTokens.textSecondary} />
                        <span>Reabrir Último Fechado</span>
                      </div>

                      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', margin: '4px 0' }} />

                      <div
                        onClick={handleCopyPath}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Copy size={13} color={themeTokens.textSecondary} />
                        <span>Copiar Caminho Absoluto</span>
                      </div>
                      <div
                        onClick={handleCopyRelativePath}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Copy size={13} color={themeTokens.textSecondary} />
                        <span>Copiar Caminho Relativo</span>
                      </div>
                      <div
                        onClick={handleRevealInExplorer}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Folder size={13} color={themeTokens.textSecondary} />
                        <span>Revelar no Explorador</span>
                      </div>

                      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', margin: '4px 0' }} />

                      <div
                        onClick={() => {
                          setEditorWordWrap(!editorWordWrap);
                          setEditorMoreMenuOpen(false);
                        }}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span>Quebra de Linha (Word Wrap)</span>
                        {editorWordWrap && <Check size={13} color={accentColor} />}
                      </div>
                      <div
                        onClick={() => {
                          setEditorMinimap(!editorMinimap);
                          setEditorMoreMenuOpen(false);
                        }}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <span>Exibir Mini-mapa</span>
                        {editorMinimap && <Check size={13} color={accentColor} />}
                      </div>
                      <div
                        onClick={handleFormatDocument}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <FileCode size={13} color={themeTokens.textSecondary} />
                        <span>Formatar Documento</span>
                      </div>

                      <div style={{ height: 1, background: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', margin: '4px 0' }} />

                      <div
                        onClick={handleAiExplainCurrentFile}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Sparkles size={13} color={accentColor} />
                        <span>Explicar Código com IA</span>
                      </div>
                      <div
                        onClick={handleAiReviewCurrentFile}
                        style={{ padding: '6px 14px', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}
                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                      >
                        <Sparkles size={13} color={accentColor} />
                        <span>Revisar com Antigravity IA</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* 5px Spacing */}
            <div style={{ height: 5, flexShrink: 0 }} />

            {/* Monaco Code Editor Card */}
            <div
              style={{
                alignSelf: (isCenteredLayout || isZenMode) ? 'center' : 'stretch',
                maxWidth: (isCenteredLayout || isZenMode) ? 960 : '100%',
                width: '100%',
                flex: '1 1 0',
                minHeight: 0,
                padding: 10,
                background: themeTokens.bgCard,
                borderRadius: 10,
                border: '1px solid ' + themeTokens.border,
                position: 'relative',
                overflow: 'hidden',
                transition: 'max-width 0.2s ease, background 0.2s ease',
              }}
            >
              {activeReview ? (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%', width: '100%' }}>
                  {/* Review Toolbar */}
                  <div
                    style={{
                      height: 40,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 10px',
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                      borderRadius: 6,
                      marginBottom: 8,
                      gap: 8,
                      flexShrink: 0,
                    }}
                  >
                    {/* Left: Info */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <Eye size={15} color={accentColor} />
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: themeTokens.textPrimary }}>
                        Revisão de Código
                      </span>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 6,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: 12,
                        }}
                      >
                        {renderFileIcon(activeReview.files[activeReview.currentIndex]?.name || '')}
                        <span style={{ fontWeight: 600, color: themeTokens.textPrimary }}>
                          {activeReview.files[activeReview.currentIndex]?.name}
                        </span>
                        <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 600 }}>
                          +{activeReview.files[activeReview.currentIndex]?.additions || 0}
                        </span>
                        <span style={{ color: '#ef4444', fontSize: 11, fontWeight: 600 }}>
                          -{activeReview.files[activeReview.currentIndex]?.deletions || 0}
                        </span>
                      </div>
                    </div>

                    {/* Middle: File Navigation */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => handleReviewNavigate(activeReview.currentIndex - 1)}
                        disabled={activeReview.currentIndex <= 0}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 7px',
                          borderRadius: 4,
                          background: 'transparent',
                          border: 'none',
                          cursor: activeReview.currentIndex > 0 ? 'pointer' : 'default',
                          color: activeReview.currentIndex > 0 ? themeTokens.textPrimary : themeTokens.textSecondary,
                          opacity: activeReview.currentIndex > 0 ? 1 : 0.4,
                          fontSize: 11.5,
                        }}
                        title="Arquivo Anterior"
                      >
                        <ArrowLeft size={13} />
                        <span>Ant</span>
                      </button>
                      <span style={{ fontSize: 11.5, color: themeTokens.textSecondary, fontWeight: 500 }}>
                        {activeReview.currentIndex + 1} de {activeReview.files.length}
                      </span>
                      <button
                        onClick={() => handleReviewNavigate(activeReview.currentIndex + 1)}
                        disabled={activeReview.currentIndex >= activeReview.files.length - 1}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 7px',
                          borderRadius: 4,
                          background: 'transparent',
                          border: 'none',
                          cursor: activeReview.currentIndex < activeReview.files.length - 1 ? 'pointer' : 'default',
                          color: activeReview.currentIndex < activeReview.files.length - 1 ? themeTokens.textPrimary : themeTokens.textSecondary,
                          opacity: activeReview.currentIndex < activeReview.files.length - 1 ? 1 : 0.4,
                          fontSize: 11.5,
                        }}
                        title="Próximo Arquivo"
                      >
                        <span>Próx</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>

                    {/* Right: Actions */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <button
                        onClick={() => setActiveReview((prev) => (prev ? { ...prev, isSideBySide: !prev.isSideBySide } : null))}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 8px',
                          borderRadius: 4,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)',
                          border: 'none',
                          color: themeTokens.textPrimary,
                          fontSize: 11,
                          cursor: 'pointer',
                        }}
                        title={activeReview.isSideBySide ? 'Alternar para visualização inline' : 'Alternar para visualização lado a lado'}
                      >
                        <SplitSquareVertical size={13} />
                        <span>{activeReview.isSideBySide ? 'Lado a lado' : 'Inline'}</span>
                      </button>

                      <button
                        onClick={handleReviewDiscard}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 9px',
                          borderRadius: 4,
                          background: 'rgba(239, 68, 68, 0.15)',
                          border: 'none',
                          color: '#ef4444',
                          fontSize: 11.5,
                          fontWeight: 500,
                          cursor: 'pointer',
                        }}
                        title="Descartar alterações deste arquivo"
                      >
                        <RotateCcw size={12} />
                        <span>Descartar</span>
                      </button>

                      <button
                        onClick={handleReviewAccept}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          padding: '3px 10px',
                          borderRadius: 4,
                          background: 'rgba(34, 197, 94, 0.2)',
                          border: 'none',
                          color: '#22c55e',
                          fontSize: 11.5,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                        title="Aceitar alterações e avançar"
                      >
                        <Check size={13} />
                        <span>Aceitar</span>
                      </button>

                      <button
                        onClick={() => setActiveReview(null)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          padding: '4px',
                          borderRadius: 4,
                          background: 'transparent',
                          border: 'none',
                          color: themeTokens.textSecondary,
                          cursor: 'pointer',
                          marginLeft: 4,
                        }}
                        title="Fechar modo de revisão"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Monaco DiffEditor */}
                  <div style={{ flex: '1 1 0', minHeight: 0, position: 'relative' }}>
                    <DiffEditor
                      height="100%"
                      original={activeReview.originalContent}
                      modified={activeReview.modifiedContent}
                      language={getFileLanguage(activeReview.files[activeReview.currentIndex]?.name || '')}
                      theme={isEffectiveDark ? 'figma-ainaobra' : 'light'}
                      options={{
                        fontSize: editorFontSize,
                        fontFamily: 'JetBrains Mono, Menlo, monospace',
                        automaticLayout: true,
                        renderSideBySide: activeReview.isSideBySide,
                        readOnly: false,
                        minimap: { enabled: editorMinimap },
                        scrollBeyondLastLine: false,
                        renderLineHighlight: 'all',
                      }}
                    />
                  </div>
                </div>
              ) : activeFile && isEditorSplit ? (
                <div style={{ display: 'flex', flexDirection: editorSplitOrientation === 'vertical' ? 'row' : 'column', height: '100%', width: '100%' }}>
                  {/* Pane 1 (Primary) */}
                  <div style={{ flex: `0 0 ${editorSplitRatio}%`, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ height: 26, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', fontSize: 11, color: themeTokens.textSecondary }}>
                      <span>{activeFile.name}</span>
                      <span style={{ fontSize: 10, color: accentColor }}>Painel 1</span>
                    </div>
                    <div style={{ flex: '1 1 0', minHeight: 0 }}>
                      <Editor
                        height="100%"
                        language={activeFile.language}
                        value={activeFile.content}
                        theme={isEffectiveDark ? 'figma-ainaobra' : 'light'}
                        onChange={handleEditorChange}
                        onMount={handleEditorMount}
                        options={{
                          fontSize: editorFontSize,
                          fontFamily: 'JetBrains Mono, Menlo, monospace',
                          tabSize: editorTabSize,
                          lineNumbers: editorLineNumbers ? 'on' : 'off',
                          wordWrap: editorWordWrap ? 'on' : 'off',
                          minimap: { enabled: false },
                          automaticLayout: true,
                        }}
                      />
                    </div>
                  </div>

                  {/* Divider */}
                  <div
                    style={{
                      width: editorSplitOrientation === 'vertical' ? 3 : '100%',
                      height: editorSplitOrientation === 'vertical' ? '100%' : 3,
                      background: isEffectiveDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
                      flexShrink: 0,
                    }}
                  />

                  {/* Pane 2 (Secondary) */}
                  <div style={{ flex: '1 1 0', minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
                    {(() => {
                      const secFile = openFiles.find((f) => f.id === secondaryFileId) || openFiles.find((f) => f.id !== activeFileId) || activeFile;
                      return (
                        <>
                          <div style={{ height: 26, padding: '0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)', fontSize: 11, color: themeTokens.textSecondary }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span>{secFile.name}</span>
                              {secFile.isDirty && <span style={{ width: 6, height: 6, borderRadius: '50%', background: accentColor }} />}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ display: 'inline-flex', cursor: 'pointer' }} onClick={() => setIsEditorSplit(false)} title="Fechar Painel Dividido">
                                <X size={12} />
                              </span>
                            </div>
                          </div>
                          <div style={{ flex: '1 1 0', minHeight: 0 }}>
                            <Editor
                              height="100%"
                              language={secFile.language}
                              value={secFile.content}
                              theme={isEffectiveDark ? 'figma-ainaobra' : 'light'}
                              onChange={(val) => {
                                if (val !== undefined) {
                                  setOpenFiles((prev) => prev.map((f) => (f.id === secFile.id ? { ...f, content: val, isDirty: true } : f)));
                                }
                              }}
                              options={{
                                fontSize: editorFontSize,
                                fontFamily: 'JetBrains Mono, Menlo, monospace',
                                tabSize: editorTabSize,
                                lineNumbers: editorLineNumbers ? 'on' : 'off',
                                wordWrap: editorWordWrap ? 'on' : 'off',
                                minimap: { enabled: false },
                                automaticLayout: true,
                              }}
                            />
                          </div>
                        </>
                      );
                    })()}
                  </div>
                </div>
              ) : activeFile ? (
                <Editor
                  height="100%"
                  language={activeFile.language}
                  value={activeFile.content}
                  theme={isEffectiveDark ? 'figma-ainaobra' : 'light'}
                  onChange={handleEditorChange}
                  onMount={handleEditorMount}
                  options={{
                    fontSize: editorFontSize,
                    fontFamily: 'JetBrains Mono, Menlo, monospace',
                    tabSize: editorTabSize,
                    lineNumbers: editorLineNumbers ? 'on' : 'off',
                    wordWrap: editorWordWrap ? 'on' : 'off',
                    minimap: { enabled: editorMinimap },
                    scrollBeyondLastLine: false,
                    automaticLayout: true,
                    renderLineHighlight: 'all',
                    cursorBlinking: 'smooth',
                    padding: { top: 6, bottom: 6 },
                  }}
                />
              ) : (
                <div
                  style={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: themeTokens.textSecondary,
                    gap: 12,
                  }}
                >
                  <FileText size={48} color={isEffectiveDark ? '#333333' : '#cccccc'} />
                  <div style={{ fontSize: 14, color: themeTokens.textSecondary }}>Selecione um arquivo no Explorer para editar</div>
                  <button
                    onClick={handleOpenFolderDialog}
                    style={{
                      padding: '8px 16px',
                      background: themeTokens.bgCardSecondary,
                      border: '1px solid ' + themeTokens.border,
                      borderRadius: 6,
                      color: themeTokens.textPrimary,
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    Abrir Pasta do Projeto
                  </button>
                </div>
              )}
            </div>

            {/* ======================================================= */}
            {/* BOTTOM TERMINAL PANEL (RESIZER + TABS + CONTENT PANES)  */}
            {/* ======================================================= */}
            {!isTerminalCollapsed && (
              <>
                {/* VS Code Style Horizontal Resizer for Terminal Panel */}
                <div
                  className={`resizer-row ${isDraggingTerminal ? 'dragging' : ''}`}
                  onMouseDown={startResizeTerminal}
                  onDoubleClick={() => setTerminalHeight(220)}
                  title="Arraste para redimensionar a altura do Terminal (Duplo clique para restaurar)"
                />

                {/* Terminal Alignment Wrapper based on panelAlignment */}
                <div
                  style={{
                    width: panelAlignment === 'justify' ? '100%' : panelAlignment === 'center' ? 'min(980px, 100%)' : 'min(84%, 100%)',
                    alignSelf: panelAlignment === 'center' ? 'center' : panelAlignment === 'left' ? 'flex-start' : panelAlignment === 'right' ? 'flex-end' : 'stretch',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 5,
                    flexShrink: 0,
                    transition: 'all 0.2s ease',
                  }}
                >
                  {/* ======================================================= */}
                  {/* TERMINAL TABS ROW: FULLY RESPONSIVE & NO TEXT WRAP      */}
                  {/* ======================================================= */}
                  <div
                    style={{
                      alignSelf: 'stretch',
                      width: '100%',
                      maxWidth: '100%',
                      boxSizing: 'border-box',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      display: 'flex',
                      flexShrink: 0,
                      gap: 6,
                      overflow: 'hidden',
                    }}
                  >
                    {/* Left Card: Subtabs with responsive shrink & horizontal scroll */}
                    <div
                      className="no-scrollbar"
                      style={{
                        height: 38,
                        padding: '4px 5px',
                        background: themeTokens.bgCard,
                        borderRadius: 10,
                        border: '1px solid ' + themeTokens.border,
                        justifyContent: 'flex-start',
                        alignItems: 'center',
                        gap: 3,
                        display: 'flex',
                        boxSizing: 'border-box',
                        whiteSpace: 'nowrap',
                        flex: '1 1 auto',
                        minWidth: 0,
                        overflowX: 'auto',
                        scrollbarWidth: 'none',
                        msOverflowStyle: 'none',
                        transition: 'background 0.2s ease',
                      }}
                    >
                      {[
                        { id: 'problems', label: 'Problems' },
                        { id: 'output', label: 'Output' },
                        { id: 'debug', label: 'Debug console' },
                        { id: 'terminal', label: 'Terminal' },
                        { id: 'ports', label: 'Ports' },
                      ].map((st) => {
                        const isActive = activeTermTab === st.id;
                        return (
                          <div
                            key={st.id}
                            onClick={() => {
                              setActiveTermTab(st.id as any);
                              setIsTerminalCollapsed(false);
                            }}
                            style={{
                              height: 28,
                              paddingLeft: 10,
                              paddingRight: 10,
                              background: isActive ? (isEffectiveDark ? '#2E2E2E' : '#e5e7eb') : 'transparent',
                              borderRadius: 5,
                              border: 'none',
                              justifyContent: 'center',
                              alignItems: 'center',
                              display: 'flex',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              flexShrink: 0,
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <div
                              style={{
                                color: isActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                                fontSize: 12,
                                fontFamily: 'Poppins',
                                fontWeight: isActive ? '500' : '400',
                                lineHeight: '12px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {st.label}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Right Card: Action Controls with identical 38px height, fixed to right edge */}
                    <div
                      style={{
                        height: 38,
                        padding: '4px 6px',
                        background: themeTokens.bgCard,
                        borderRadius: 10,
                        border: '1px solid ' + themeTokens.border,
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        gap: 2,
                        display: 'flex',
                        boxSizing: 'border-box',
                        position: 'relative',
                        whiteSpace: 'nowrap',
                        flexShrink: 0,
                        transition: 'background 0.2s ease',
                      }}
                    >
                      {/* Shell selector dropdown button */}
                      <div
                        onClick={() => setShellDropdownOpen(!shellDropdownOpen)}
                        style={{
                          height: 28,
                          paddingLeft: 8,
                          paddingRight: 8,
                          borderRadius: 5,
                          background: shellDropdownOpen ? (isEffectiveDark ? '#2E2E2E' : '#e5e7eb') : 'transparent',
                          justifyContent: 'flex-start',
                          alignItems: 'center',
                          gap: 6,
                          display: 'flex',
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          flexShrink: 0,
                          transition: 'background 0.15s ease',
                        }}
                        title="Selecionar Shell"
                      >
                        <TerminalIcon size={14} color={themeTokens.textPrimary} />
                        <div style={{ color: themeTokens.textPrimary, fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', lineHeight: '12px', whiteSpace: 'nowrap' }}>
                          {terminalShell}
                        </div>
                        <ChevronDown size={12} color={themeTokens.textSecondary} />
                      </div>

                      {/* Shell Dropdown Menu */}
                      {shellDropdownOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 44,
                            right: 120,
                            background: themeTokens.bgCardSecondary,
                            borderRadius: 8,
                            border: '1px solid ' + themeTokens.border,
                            padding: 6,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            zIndex: 99999,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                          }}
                        >
                          {[
                            { label: 'zsh (Padrão)', value: 'zsh' },
                            { label: 'bash', value: 'bash' },
                            { label: 'Claude Code CLI', value: 'claude' },
                            { label: 'Google Antigravity (AGY)', value: 'agy' },
                          ].map((sh) => (
                            <div
                              key={sh.value}
                              onClick={() => {
                                setTerminalShell(sh.value);
                                setShellDropdownOpen(false);
                                setTerminalHistory((prev) => [
                                  ...prev,
                                  `[Iniciando sessão com ${sh.label}...]`,
                                ]);
                              }}
                              style={{
                                padding: '6px 12px',
                                color: terminalShell === sh.value ? accentColor : themeTokens.textPrimary,
                                fontSize: 12,
                                fontFamily: 'Poppins',
                                cursor: 'pointer',
                                borderRadius: 4,
                                whiteSpace: 'nowrap',
                                background: terminalShell === sh.value ? hexToRgba(accentColor, 0.12) : 'transparent',
                              }}
                            >
                              {sh.label}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Separator */}
                      <div style={{ width: 1, height: 16, background: themeTokens.border, margin: '0 2px' }} />

                      {/* New Terminal Session (+) */}
                      <div
                        onClick={() => handleNewTerminalSession()}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: themeTokens.textSecondary,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                        title="Novo Terminal"
                      >
                        <Plus size={14} />
                      </div>

                      {/* Minimize Terminal (-) */}
                      <div
                        onClick={() => setIsTerminalCollapsed(!isTerminalCollapsed)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isEffectiveDark ? themeTokens.textSecondary : '#1f2937',
                          background: isEffectiveDark ? 'transparent' : 'rgba(0, 0, 0, 0.04)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)';
                          (e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary;
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'transparent' : 'rgba(0, 0, 0, 0.04)';
                          (e.currentTarget as HTMLElement).style.color = isEffectiveDark ? themeTokens.textSecondary : '#1f2937';
                        }}
                        title="Recolher Terminal"
                      >
                        <Minus size={14} />
                      </div>

                      {/* Split Terminal ([|]) */}
                      {(() => {
                        const activeSession = terminalSessions.find((s) => s.id === activeSessionId);
                        const isCurrentSplit = !!activeSession?.splitWithId;
                        return (
                          <div
                            onClick={handleToggleSplitActiveSession}
                            style={{
                              width: 26,
                              height: 26,
                              borderRadius: 5,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isCurrentSplit ? accentColor : themeTokens.textSecondary,
                              cursor: 'pointer',
                              transition: 'all 0.15s ease',
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = isCurrentSplit ? accentColor : themeTokens.textPrimary)}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = isCurrentSplit ? accentColor : themeTokens.textSecondary)}
                            title={isCurrentSplit ? "Desfazer Divisão do Terminal" : "Dividir Terminal (Ctrl+Shift+5)"}
                          >
                            <Columns size={14} />
                          </div>
                        );
                      })()}

                      {/* Clear Output (Trash) */}
                      <div
                        onClick={handleClearTerminal}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: themeTokens.textSecondary,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                        title="Limpar Terminal"
                      >
                        <Trash2 size={14} />
                      </div>

                      {/* Maximize Terminal */}
                      <div
                        onClick={() => {
                          setIsTerminalMaximized(!isTerminalMaximized);
                          setIsTerminalCollapsed(false);
                        }}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isTerminalMaximized ? accentColor : themeTokens.textSecondary,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = isTerminalMaximized ? accentColor : themeTokens.textPrimary)}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = isTerminalMaximized ? accentColor : themeTokens.textSecondary)}
                        title={isTerminalMaximized ? 'Restaurar Tamanho' : 'Maximizar Painel'}
                      >
                        {isTerminalMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                      </div>

                      {/* More Options (...) */}
                      <div
                        onClick={() => setMoreOptionsOpen(!moreOptionsOpen)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 5,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: moreOptionsOpen ? themeTokens.textPrimary : themeTokens.textSecondary,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = moreOptionsOpen ? themeTokens.textPrimary : themeTokens.textSecondary)}
                        title="Mais Opções"
                      >
                        <MoreHorizontal size={14} />
                      </div>

                      {/* More Options Dropdown Menu */}
                      {moreOptionsOpen && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 44,
                            right: 35,
                            background: themeTokens.bgCardSecondary,
                            borderRadius: 8,
                            border: '1px solid ' + themeTokens.border,
                            padding: 6,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 4,
                            zIndex: 99999,
                            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                          }}
                        >
                          {[
                            { label: 'Reiniciar Sessão PTY', action: () => handleClearTerminal() },
                            { label: 'Copiar Saída Completa', action: () => navigator.clipboard.writeText(terminalHistory.join('\n')) },
                            { label: 'Executar Verificação de Portas', action: () => setActiveTermTab('ports') },
                          ].map((opt, idx) => (
                            <div
                              key={idx}
                              onClick={() => {
                                opt.action();
                                setMoreOptionsOpen(false);
                              }}
                              style={{
                                padding: '6px 12px',
                                color: themeTokens.textPrimary,
                                fontSize: 12,
                                fontFamily: 'Poppins',
                                cursor: 'pointer',
                                borderRadius: 4,
                                whiteSpace: 'nowrap',
                              }}
                              onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)')}
                              onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = 'transparent')}
                            >
                              {opt.label}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Separator */}
                      <div style={{ width: 1, height: 16, background: themeTokens.border, margin: '0 2px' }} />

                      {/* Close Panel (X) */}
                      <div
                        onClick={() => setIsTerminalCollapsed(true)}
                        style={{
                          width: 26,
                          height: 26,
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: isEffectiveDark ? themeTokens.textSecondary : '#1f2937',
                          background: isEffectiveDark ? 'transparent' : 'rgba(0, 0, 0, 0.04)',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLElement).style.background = 'rgba(255, 95, 86, 0.15)';
                          (e.currentTarget as HTMLElement).style.color = '#ff5f56';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'transparent' : 'rgba(0, 0, 0, 0.04)';
                          (e.currentTarget as HTMLElement).style.color = isEffectiveDark ? themeTokens.textSecondary : '#1f2937';
                        }}
                        title="Fechar Painel"
                      >
                        <X size={14} />
                      </div>
                    </div>
                  </div>

                {/* ======================================================= */}
                {/* TERMINAL CONTENT PANES (DRAGGABLE RESIZABLE HEIGHT)     */}
                {/* ======================================================= */}
                <div
                style={{
                  alignSelf: 'stretch',
                  height: isTerminalMaximized ? 480 : terminalHeight,
                  justifyContent: 'flex-start',
                  alignItems: 'flex-start',
                  gap: 0,
                  display: 'inline-flex',
                  flexShrink: 0,
                  transition: isDraggingTerminal ? 'none' : 'height 0.15s ease',
                  overflow: 'hidden',
                  width: '100%',
                }}
              >
                {/* 1. Terminal View */}
                {activeTermTab === 'terminal' && (
                  <>
                    {/* Dual / Single Terminals Card (Left Card) */}
                    <div
                      ref={splitContainerRef}
                      style={{
                        flex: '1 1 0',
                        alignSelf: 'stretch',
                        padding: '6px 8px',
                        background: themeTokens.bgCard,
                        borderRadius: 10,
                        border: '1px solid ' + themeTokens.border,
                        justifyContent: 'flex-start',
                        alignItems: 'stretch',
                        gap: 0,
                        display: 'flex',
                        overflow: 'hidden',
                        minWidth: 0,
                        position: 'relative',
                        transition: 'background 0.2s ease',
                      }}
                    >
                    {/* Native Xterm Terminals Container (VS Code Multi-pane Split Engine) */}
                    {(() => {
                      const currentActive = terminalSessions.find((s) => s.id === activeSessionId) || terminalSessions[0];
                      const sibling = currentActive?.splitWithId
                        ? terminalSessions.find((s) => s.id === currentActive.splitWithId)
                        : null;

                      let leftSession = currentActive;
                      let rightSession = sibling;

                      if (sibling && currentActive) {
                        const activeIdx = terminalSessions.findIndex((s) => s.id === currentActive.id);
                        const siblingIdx = terminalSessions.findIndex((s) => s.id === sibling.id);
                        if (siblingIdx < activeIdx) {
                          leftSession = sibling;
                          rightSession = currentActive;
                        }
                      }

                      const isSplit = !!rightSession;

                      return (
                        <div
                          ref={splitContainerRef}
                          style={{
                            flex: '1 1 0',
                            minHeight: 0,
                            height: '100%',
                            display: 'flex',
                            flexDirection: 'row',
                            overflow: 'hidden',
                            position: 'relative',
                            background: isEffectiveDark ? '#0c0c0c' : '#f8f9fa',
                          }}
                        >
                          {/* Left / Main Terminal Pane */}
                          <div
                            onClick={() => leftSession && setActiveSessionId(leftSession.id)}
                            style={{
                              width: isSplit ? `${terminalSplitRatio}%` : '100%',
                              flex: isSplit ? 'none' : '1 1 0',
                              alignSelf: 'stretch',
                              height: '100%',
                              flexDirection: 'column',
                              justifyContent: 'flex-start',
                              alignItems: 'stretch',
                              display: 'flex',
                              overflow: 'hidden',
                              minWidth: 0,
                              position: 'relative',
                              outline: isSplit && activeSessionId === leftSession?.id ? `1px solid ${accentColor}` : 'none',
                              outlineOffset: -1,
                            }}
                          >
                            {terminalSessions.map((s) => {
                              if (isSplit && s.id === rightSession?.id) return null;
                              return (
                                <NativeXTerm
                                  key={s.id}
                                  sessionId={s.id}
                                  sessionType={s.type}
                                  cwd={workspacePath || terminalCwd || '/Users/walancy/Documents/codes/devflow-desktop'}
                                  isActive={s.id === leftSession?.id}
                                  initialCommand={s.initialCommand}
                                  accentColor={accentColor}
                                  isDark={isEffectiveDark}
                                />
                              );
                            })}
                          </div>

                          {/* Right Split Pane (Rendered ONLY when current active terminal is split) */}
                          {isSplit && rightSession && (
                            <>
                              {/* VS Code Style Subtle Splitter Resizer */}
                              <div
                                className={`resizer-col resizer-split-term ${isDraggingSplitPanes ? 'dragging' : ''}`}
                                onMouseDown={startResizeSplitPanes}
                                onDoubleClick={() => {
                                  setTerminalSplitRatio(50);
                                  localStorage.setItem('ide_term_split_ratio', '50');
                                }}
                                title="Arraste para redimensionar terminais divididos (Duplo clique para 50/50)"
                                style={{
                                  width: 6,
                                  margin: '0 -3px',
                                  cursor: 'col-resize',
                                  zIndex: 10,
                                  background: 'transparent',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <div style={{ width: 1, height: '100%', background: themeTokens.border }} />
                              </div>

                              <div
                                onClick={() => setActiveSessionId(rightSession.id)}
                                style={{
                                  flex: '1 1 0',
                                  alignSelf: 'stretch',
                                  height: '100%',
                                  flexDirection: 'column',
                                  justifyContent: 'flex-start',
                                  alignItems: 'stretch',
                                  display: 'flex',
                                  overflow: 'hidden',
                                  minWidth: 0,
                                  position: 'relative',
                                  outline: activeSessionId === rightSession.id ? `1px solid ${accentColor}` : 'none',
                                  outlineOffset: -1,
                                }}
                              >
                                <NativeXTerm
                                  key={rightSession.id}
                                  sessionId={rightSession.id}
                                  sessionType={rightSession.type}
                                  cwd={workspacePath || terminalCwd || '/Users/walancy/Documents/codes/devflow-desktop'}
                                  isActive={activeSessionId === rightSession.id}
                                  initialCommand={rightSession.initialCommand}
                                  accentColor={accentColor}
                                  isDark={isEffectiveDark}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })()}
                    </div>

                    {/* Interactive Resizer between Terminal Card (Left) and Terminal Tabs Panel (Right) */}
                    <div
                      className={`resizer-col ${isDraggingTermTabs ? 'dragging' : ''}`}
                      onMouseDown={startResizeTermTabs}
                      onDoubleClick={() => {
                        setTerminalTabsWidth(175);
                        localStorage.setItem('ide_term_tabs_width', '175');
                      }}
                      title="Arraste para redimensionar painel de abas (Duplo clique para 175px)"
                    />

                    {/* VS Code Style Terminal Tabs Panel (Right Card) */}
                    <div
                      style={{
                        width: terminalTabsWidth,
                        alignSelf: 'stretch',
                        background: themeTokens.bgCard,
                        borderRadius: 10,
                        border: '1px solid ' + themeTokens.border,
                        flexDirection: 'column',
                        justifyContent: 'flex-start',
                        alignItems: 'stretch',
                        display: 'inline-flex',
                        flexShrink: 0,
                        position: 'relative',
                        zIndex: 20,
                        transition: isDraggingTermTabs ? 'none' : 'width 0.15s ease',
                      }}
                    >
                      {/* VS Code Mini-Toolbar at top of tabs list */}
                      <div
                        style={{
                          height: 28,
                          padding: '0 8px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          gap: 6,
                          borderBottom: '1px solid ' + themeTokens.border,
                          flexShrink: 0,
                        }}
                      >
                        {/* Kill terminal icon */}
                        <div
                          onClick={(e) => handleKillTerminalSession(activeSessionId, e)}
                          title="Kill Terminal"
                          style={{
                            cursor: 'pointer',
                            color: themeTokens.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 2,
                            borderRadius: 3,
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                        >
                          <Trash2 size={13} />
                        </div>

                        {/* More actions (...) */}
                        <div
                          title="More Actions..."
                          style={{
                            cursor: 'pointer',
                            color: themeTokens.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 2,
                            borderRadius: 3,
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                        >
                          <MoreHorizontal size={13} />
                        </div>

                        {/* Separator */}
                        <div style={{ width: 1, height: 12, background: themeTokens.border, margin: '0 1px' }} />

                        {/* Maximize/restore panel icon */}
                        <div
                          onClick={() => setIsTerminalMaximized((prev) => !prev)}
                          title={isTerminalMaximized ? 'Restore Terminal Size' : 'Maximize Terminal Panel'}
                          style={{
                            cursor: 'pointer',
                            color: isTerminalMaximized ? accentColor : themeTokens.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 2,
                            borderRadius: 3,
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = isTerminalMaximized ? accentColor : themeTokens.textPrimary)}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = isTerminalMaximized ? accentColor : themeTokens.textSecondary)}
                        >
                          <Maximize2 size={12} />
                        </div>

                        {/* Close panel icon */}
                        <div
                          onClick={() => setIsTerminalCollapsed(true)}
                          title="Close Panel"
                          style={{
                            cursor: 'pointer',
                            color: themeTokens.textSecondary,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            padding: 2,
                            borderRadius: 3,
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ff5f56')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                        >
                          <X size={13} />
                        </div>
                      </div>

                      {/* Sessions List */}
                      <div
                        style={{
                          flex: 1,
                          overflowY: 'auto',
                          padding: '4px 0',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 1,
                        }}
                      >
                        {terminalSessions.map((s, index) => {
                          const isActive = s.id === activeSessionId;
                          const isHovered = s.id === hoveredRowId;
                          const hasSibling = !!s.splitWithId;
                          const siblingIndex = hasSibling ? terminalSessions.findIndex((other) => other.id === s.splitWithId) : -1;
                          const isFirstSplit = hasSibling && siblingIndex > index;
                          const isSecondSplit = hasSibling && siblingIndex < index;

                          return (
                            <div
                              key={s.id}
                              onClick={() => setActiveSessionId(s.id)}
                              onMouseEnter={(e) => {
                                setHoveredRowId(s.id);
                                if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                                hoverTimerRef.current = setTimeout(() => {
                                  const rect = e.currentTarget.getBoundingClientRect();
                                  const parentRect = e.currentTarget.parentElement?.getBoundingClientRect();
                                  if (parentRect) {
                                    setPopoverTop(rect.top - parentRect.top + 28);
                                  }
                                  setHoveredSessionId(s.id);
                                }, 250);
                              }}
                              onMouseLeave={() => {
                                setHoveredRowId(null);
                                if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                                hoverTimerRef.current = setTimeout(() => {
                                  setHoveredSessionId(null);
                                }, 300);
                              }}
                              style={{
                                width: '100%',
                                height: 26,
                                padding: '0 6px 0 0',
                                background: isActive
                                  ? hexToRgba(accentColor, 0.15)
                                  : isHovered
                                  ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)')
                                  : 'transparent',
                                borderLeft: isActive ? `2px solid ${accentColor}` : '2px solid transparent',
                                display: 'flex',
                                alignItems: 'center',
                                cursor: 'pointer',
                                userSelect: 'none',
                                transition: 'background 0.1s ease',
                                position: 'relative',
                              }}
                            >
                              {/* Tree Line Connector for Split Terminals */}
                              {hasSibling && (
                                <div style={{ width: 14, height: 26, position: 'relative', flexShrink: 0, marginLeft: 2 }}>
                                  {isFirstSplit && (
                                    <>
                                      <div style={{ position: 'absolute', top: 13, left: 6, width: 7, height: 1, background: '#606060' }} />
                                      <div style={{ position: 'absolute', top: 13, left: 6, width: 1, height: 13, background: '#606060' }} />
                                    </>
                                  )}
                                  {isSecondSplit && (
                                    <>
                                      <div style={{ position: 'absolute', top: 0, left: 6, width: 1, height: 13, background: '#606060' }} />
                                      <div style={{ position: 'absolute', top: 13, left: 6, width: 7, height: 1, background: '#606060' }} />
                                    </>
                                  )}
                                </div>
                              )}

                              {/* Terminal Icon (SquareTerminal codicon style) */}
                              <div style={{ marginLeft: hasSibling ? 2 : 8, marginRight: 6, display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                                <SquareTerminal size={14} color={isActive ? accentColor : themeTokens.textSecondary} />
                              </div>

                              {/* Session Name */}
                              <div
                                style={{
                                  color: isActive ? themeTokens.textPrimary : themeTokens.textSecondary,
                                  fontSize: 12,
                                  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                                  fontWeight: isActive ? 500 : 400,
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis',
                                  flex: 1,
                                }}
                              >
                                {s.name}
                              </div>

                              {/* Quick Actions (Hover visible like VS Code) */}
                              {isHovered && (
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    marginLeft: 'auto',
                                    paddingLeft: 4,
                                    flexShrink: 0,
                                  }}
                                >
                                  {/* @ Configure / Shell menu */}
                                  <div
                                    title="Configure Terminal"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleNewTerminalSession('zsh');
                                    }}
                                    style={{
                                      cursor: 'pointer',
                                      color: themeTokens.textSecondary,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 1,
                                    }}
                                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                                  >
                                    <AtSign size={12} />
                                  </div>

                                  {/* Split Terminal */}
                                  <div
                                    title="Split Terminal (Ctrl+Shift+5)"
                                    onClick={(e) => handleSplitSession(s.id, e)}
                                    style={{
                                      cursor: 'pointer',
                                      color: themeTokens.textSecondary,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 1,
                                    }}
                                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                                  >
                                    <SplitSquareVertical size={12} />
                                  </div>

                                  {/* Kill Terminal */}
                                  <div
                                    title="Kill Terminal"
                                    onClick={(e) => handleKillTerminalSession(s.id, e)}
                                    style={{
                                      cursor: 'pointer',
                                      color: themeTokens.textSecondary,
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      padding: 1,
                                    }}
                                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ff5f56')}
                                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                                  >
                                    <Trash2 size={12} />
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* VS Code Rich Tooltip Popover (Floating to the left of the sessions list) */}
                      {hoveredSessionId && (() => {
                        const hoveredSession = terminalSessions.find((s) => s.id === hoveredSessionId);
                        if (!hoveredSession) return null;

                        return (
                          <div
                            onMouseEnter={() => {
                              if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current);
                            }}
                            onMouseLeave={() => {
                              setHoveredSessionId(null);
                            }}
                            style={{
                              position: 'absolute',
                              right: 'calc(100% + 12px)',
                              top: Math.max(8, popoverTop - 15),
                              width: 330,
                              background: themeTokens.bgCardSecondary,
                              border: '1px solid ' + themeTokens.border,
                              borderRadius: 5,
                              padding: '12px 14px',
                              boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                              zIndex: 99999,
                              color: themeTokens.textPrimary,
                              fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                              fontSize: 12,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 9,
                              pointerEvents: 'auto',
                            }}
                          >
                            {/* Pointer triangle arrow pointing to the terminal tab */}
                            <div
                              style={{
                                position: 'absolute',
                                right: -6,
                                top: 18,
                                width: 0,
                                height: 0,
                                borderTop: '6px solid transparent',
                                borderBottom: '6px solid transparent',
                                borderLeft: '6px solid ' + themeTokens.bgCardSecondary,
                              }}
                            />
                            <div
                              style={{
                                position: 'absolute',
                                right: -7,
                                top: 18,
                                width: 0,
                                height: 0,
                                borderTop: '6px solid transparent',
                                borderBottom: '6px solid transparent',
                                borderLeft: '7px solid ' + themeTokens.border,
                                zIndex: -1,
                              }}
                            />

                            {/* Title (e.g. zsh) */}
                            <div style={{ fontSize: 13.5, fontWeight: 600, color: themeTokens.textPrimary }}>
                              {hoveredSession.name}
                            </div>

                            {/* Details: PID & Command line */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: themeTokens.textSecondary, fontSize: 12 }}>
                              <div>
                                <span style={{ color: themeTokens.textPrimary, fontWeight: 500 }}>Process ID (PID): </span>
                                <span>{hoveredSession.pid}</span>
                              </div>
                              <div>
                                <span style={{ color: themeTokens.textPrimary, fontWeight: 500 }}>Command line: </span>
                                <span>{hoveredSession.command}</span>
                              </div>
                            </div>

                            {/* Shell integration: Rich */}
                            <div style={{ color: themeTokens.textPrimary, fontSize: 12 }}>
                              <span style={{ fontWeight: 500 }}>Shell integration: </span>
                              <span style={{ color: themeTokens.textSecondary }}>{hoveredSession.shellIntegration}</span>
                            </div>

                            {/* Bottom Blue Action Links */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 3 }}>
                              <span
                                style={{ color: accentColor, fontSize: 11.5, cursor: 'pointer', textDecoration: 'none' }}
                                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
                                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
                                onClick={() => alert('Environment Contributions: PATH=/Users/walancy/.local/bin:/usr/local/bin:/bin, TERM_PROGRAM=vscode')}
                              >
                                Show Environment Contributions
                              </span>
                              <span
                                style={{ color: accentColor, fontSize: 11.5, cursor: 'pointer', textDecoration: 'none' }}
                                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'underline')}
                                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.textDecoration = 'none')}
                                onClick={() => alert(`Terminal Details:\nProcess: ${hoveredSession.name} (PID: ${hoveredSession.pid})\nCommand: ${hoveredSession.command}\nIntegration: ${hoveredSession.shellIntegration}`)}
                              >
                                Show Details
                              </span>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                )}

                {/* 2. Problems View */}
                {activeTermTab === 'problems' && (
                  <div
                    style={{
                      flex: '1 1 0',
                      alignSelf: 'stretch',
                      padding: 16,
                      background: themeTokens.bgCard,
                      borderRadius: 10,
                      border: '1px solid ' + themeTokens.border,
                      flexDirection: 'column',
                      gap: 12,
                      display: 'flex',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#3fb950', fontSize: 13, whiteSpace: 'nowrap' }}>
                      <CheckCircle2 size={16} />
                      <span style={{ fontWeight: 500 }}>Nenhum problema encontrado no projeto.</span>
                    </div>
                    <div style={{ color: themeTokens.textSecondary, fontSize: 12 }}>
                      0 erros de compilação • 0 alertas de linting • Todos os tipos TypeScript validados com sucesso.
                    </div>
                  </div>
                )}

                {/* 3. Output View */}
                {activeTermTab === 'output' && (
                  <div
                    style={{
                      flex: '1 1 0',
                      alignSelf: 'stretch',
                      padding: 14,
                      background: themeTokens.bgCard,
                      borderRadius: 10,
                      border: '1px solid ' + themeTokens.border,
                      flexDirection: 'column',
                      gap: 6,
                      display: 'flex',
                      overflowY: 'auto',
                      fontFamily: 'JetBrains Mono, Menlo, monospace',
                      fontSize: 12,
                      color: themeTokens.textSecondary,
                    }}
                  >
                    <div style={{ color: accentColor }}>[Ainaobra Build Server] Compilando ambiente...</div>
                    <div>[Nest] 58135 - 09/16/2026, 10:00:00 AM LOG [NestFactory] Starting Nest application...</div>
                    <div>[Nest] 58135 - 09/16/2026, 10:00:01 AM LOG [InstanceLoader] ConfigHostModule dependencies initialized</div>
                    <div>[Nest] 58135 - 09/16/2026, 10:00:01 AM LOG [InstanceLoader] ConfigModule dependencies initialized</div>
                    <div>[Nest] 58135 - 09/16/2026, 10:00:02 AM LOG [RoutesResolver] AppController &#123;/api&#125;: mapped &#123;/status, GET&#125;</div>
                    <div style={{ color: '#3fb950' }}>[Vite] Client build successful in 189ms.</div>
                  </div>
                )}

                {/* 4. Debug Console View */}
                {activeTermTab === 'debug' && (
                  <div
                    style={{
                      flex: '1 1 0',
                      alignSelf: 'stretch',
                      padding: 14,
                      background: themeTokens.bgCard,
                      borderRadius: 10,
                      border: '1px solid ' + themeTokens.border,
                      flexDirection: 'column',
                      justifyContent: 'space-between',
                      display: 'flex',
                      fontFamily: 'JetBrains Mono, Menlo, monospace',
                      fontSize: 12,
                    }}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, overflowY: 'auto' }}>
                      {debugHistory.map((item, idx) => (
                        <div key={idx} style={{ color: item.startsWith('>') ? accentColor : themeTokens.textSecondary }}>
                          {item}
                        </div>
                      ))}
                    </div>

                    <form onSubmit={handleDebugSubmit} style={{ display: 'flex', alignItems: 'center', gap: 6, borderTop: '1px solid ' + themeTokens.border, paddingTop: 8 }}>
                      <span style={{ color: accentColor }}>&gt;</span>
                      <input
                        type="text"
                        value={debugCommand}
                        onChange={(e) => setDebugCommand(e.target.value)}
                        placeholder="Avaliar expressão (ex: 2 + 2, Date.now(), process.platform)"
                        style={{
                          flex: 1,
                          background: 'transparent',
                          border: 'none',
                          outline: 'none',
                          color: themeTokens.textPrimary,
                          fontSize: 12,
                          fontFamily: 'JetBrains Mono, Menlo, monospace',
                        }}
                      />
                    </form>
                  </div>
                )}

                {/* 5. Ports View */}
                {activeTermTab === 'ports' && (
                  <div
                    style={{
                      flex: '1 1 0',
                      alignSelf: 'stretch',
                      padding: 14,
                      background: themeTokens.bgCard,
                      borderRadius: 10,
                      border: '1px solid ' + themeTokens.border,
                      flexDirection: 'column',
                      gap: 8,
                      display: 'flex',
                      overflowY: 'auto',
                    }}
                  >
                    <div style={{ color: themeTokens.textPrimary, fontSize: 13, fontWeight: 500, marginBottom: 4, whiteSpace: 'nowrap' }}>
                      Portas Encaminhadas e Serviços Ativos
                    </div>
                    {[
                      { port: 3000, proc: 'ainaobra-api (NestJS)', status: 'Online', url: 'http://localhost:3000' },
                      { port: 5173, proc: 'wireframe (Vite)', status: 'Online', url: 'http://localhost:5173' },
                      { port: 5432, proc: 'postgresql (Docker)', status: 'Online', url: 'localhost:5432' },
                    ].map((p) => (
                      <div
                        key={p.port}
                        style={{
                          padding: '8px 12px',
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Radio size={14} color="#3fb950" />
                          <span style={{ color: themeTokens.textPrimary, fontWeight: 600, fontSize: 12.5 }}>:{p.port}</span>
                          <span style={{ color: themeTokens.textSecondary, fontSize: 12 }}>{p.proc}</span>
                        </div>
                        <a
                          href={p.url}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            color: accentColor,
                            fontSize: 12,
                            textDecoration: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 4,
                          }}
                        >
                          {p.url}
                          <ExternalLink size={12} />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
                </div>
            </>
          )}
        </div>

          {/* ---------------------------------------------------- */}
          {/* Right AI Assistant Panel (DRAGGABLE RESIZABLE WIDTH) */}
          {/* ---------------------------------------------------- */}
          {showAiPanel && !isZenMode && (
            <>
              {/* VS Code Style Vertical Resizer for AI Panel */}
              <div
                className={`resizer-col ${isDraggingAi ? 'dragging' : ''}`}
                onMouseDown={startResizeAiPanel}
                onDoubleClick={() => setAiPanelWidth(340)}
                title="Arraste para redimensionar o Painel de IA (Duplo clique para restaurar)"
                style={{ order: sidebarPosition === 'right' ? 2 : 5 }}
              />

              <div
                style={{
                  width: aiPanelWidth,
                  alignSelf: 'stretch',
                  padding: 12,
                  background: isEffectiveDark
                    ? `radial-gradient(ellipse 120.00% 159.98% at 5.85% 100.00%, ${hexToRgba(chatAccentColor, 0.20)} 0%, #101010 100%)`
                    : `radial-gradient(ellipse 120.00% 159.98% at 5.85% 100.00%, ${hexToRgba(chatAccentColor, 0.22)} 0%, #ffffff 100%)`,
                  borderRadius: 10,
                  border: 'none',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  alignItems: 'stretch',
                  gap: 10,
                  display: 'flex',
                  position: 'relative',
                  flexShrink: 0,
                  transition: isDraggingAi ? 'none' : 'width 0.1s ease, background 0.2s ease',
                  overflow: 'visible',
                  zIndex: 40,
                  order: sidebarPosition === 'right' ? 3 : 6,
                }}
              >
                {/* Header: Stacked Icons + AI Logo + Provider Name + Clear History */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0, padding: '2px 4px', position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    {/* Stacked icons of other AIs used in orchestrator or with active chats */}
                    {(() => {
                      const otherProviders = AI_PROVIDERS.filter((p) => {
                        if (p.id === selectedAiProvider) return false;
                        const isOrchestrated = isOrchestratorActive && orchestratedProviders[p.id];
                        const hasChat = chatSessions.some((s) => s.provider === p.id && s.history.length > 0);
                        return isOrchestrated || hasChat;
                      });

                      return (
                        <div
                          onClick={() => setChatHistoryPopupOpen(!chatHistoryPopupOpen)}
                          title="Sessões & Histórico de Chats"
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            cursor: 'pointer',
                            padding: '2px 3px',
                            borderRadius: 6,
                            background: chatHistoryPopupOpen ? 'rgba(255, 255, 255, 0.12)' : 'transparent',
                            transition: 'background 0.15s ease',
                          }}
                        >
                          {otherProviders.length > 0 ? (
                            <div style={{ display: 'flex', alignItems: 'center' }}>
                              {otherProviders.slice(0, 4).map((p, idx) => (
                                <div
                                  key={p.id}
                                  style={{
                                    width: 19,
                                    height: 19,
                                    borderRadius: '50%',
                                    background: '#1c1c1c',
                                    border: '1.5px solid #101010',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    marginLeft: idx === 0 ? 0 : -7,
                                    zIndex: 10 - idx,
                                    boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                                    overflow: 'hidden',
                                  }}
                                  title={`${p.name} (Ativo no Orquestrador / Histórico)`}
                                >
                                  {renderAiIcon(p.id, 12)}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: 5,
                                background: 'rgba(255, 255, 255, 0.05)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                              }}
                              title="Histórico de Chats"
                            >
                              <MessageSquare size={11} color={themeTokens.textSecondary} />
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Active AI Logo, Name & Model Badge */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {renderAiIcon(selectedAiProvider, 17)}
                      <div style={{ color: themeTokens.textPrimary, fontSize: 13, fontFamily: 'Poppins, sans-serif', fontWeight: '500' }}>
                        {AI_PROVIDERS.find((p) => p.id === selectedAiProvider)?.name || 'Claude'}
                      </div>
                      {(() => {
                        const mInfo = activeModels[selectedAiProvider];
                        const raw = mInfo?.currentModel || mInfo?.currentModelId || (selectedAiProvider === 'claude' ? 'sonnet' : null);
                        const label = formatModelDisplayName(raw);
                        if (!label) return null;
                        return (
                          <div
                            onClick={() => setModelDropdown((prev) => !prev)}
                            title="Modelo ativo. Clique para alterar."
                            style={{
                              fontSize: 10.5,
                              color: chatAccentColor,
                              background: 'transparent',
                              padding: '1px 2px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 3,
                              maxWidth: 140,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                              transition: 'opacity 0.15s ease',
                            }}
                            onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.opacity = '0.75')}
                            onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.opacity = '1')}
                          >
                            <span>{label}</span>
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {aiHistory.length > 0 && (
                      <button
                        onClick={() => {
                          setAiHistory([]);
                          setChatSessions((prev) =>
                            prev.map((s) => (s.id === activeChatSessionId ? { ...s, history: [] } : s))
                          );
                        }}
                        title="Limpar histórico"
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: themeTokens.textSecondary,
                          cursor: 'pointer',
                          padding: '3px 6px',
                          fontSize: 11,
                          fontFamily: 'Poppins, sans-serif',
                          fontWeight: '400',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                          borderRadius: 4,
                        }}
                        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                      >
                        <Trash2 size={12} />
                        <span>Limpar</span>
                      </button>
                    )}
                  </div>

                  {/* Chat History & Sessions Popup */}
                  {chatHistoryPopupOpen && (
                    <div
                      ref={chatHistoryPopupRef}
                      style={{
                        position: 'absolute',
                        top: 34,
                        left: 0,
                        width: 270,
                        background: themeTokens.bgCardSecondary,
                        borderRadius: 10,
                        border: '1px solid ' + themeTokens.border,
                        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                        padding: '10px 12px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 8,
                        zIndex: 9999,
                      }}
                    >
                      {/* Popup Header */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: themeTokens.textPrimary, fontSize: 12, fontWeight: '500' }}>
                          <MessageSquare size={13} color={accentColor} />
                          <span>Chats Iniciados</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const newId = 'session-' + Date.now();
                            const newSession: ChatSessionItem = {
                              id: newId,
                              title: 'Nova Conversa',
                              provider: selectedAiProvider,
                              updatedAt: Date.now(),
                              history: [],
                            };
                            setChatSessions((prev) => [newSession, ...prev]);
                            setActiveChatSessionId(newId);
                            setAiHistory([]);
                            setChatHistoryPopupOpen(false);
                          }}
                          style={{
                            background: accentColor,
                            border: 'none',
                            color: accentTextColor,
                            borderRadius: 4,
                            padding: '3px 8px',
                            fontSize: 10.5,
                            fontWeight: '500',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 3,
                          }}
                        >
                          <Plus size={11} />
                          <span>Novo Chat</span>
                        </button>
                      </div>

                      {/* Chats List */}
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 220, overflowY: 'auto' }}>
                        {chatSessions.length === 0 ? (
                          <div style={{ color: themeTokens.textSecondary, fontSize: 11, textAlign: 'center', padding: '12px 0' }}>
                            Nenhum chat anterior. Inicie uma nova conversa!
                          </div>
                        ) : (
                          chatSessions.map((s) => {
                            const sessionProvider = s.provider || s.history?.find((h) => h.providerId)?.providerId || selectedAiProvider || 'claude';
                            const providerObj = AI_PROVIDERS.find((p) => p.id === sessionProvider);
                            const isActive = s.id === activeChatSessionId;

                            const isEditing = editingChatSessionId === s.id;

                            return (
                              <div
                                key={s.id}
                                onClick={() => {
                                  if (!isEditing) handleSelectChatSession(s.id);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'space-between',
                                  padding: '6px 8px',
                                  borderRadius: 5,
                                  cursor: isEditing ? 'default' : 'pointer',
                                  background: isActive ? hexToRgba(accentColor, 0.15) : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.03)'),
                                  border: 'none',
                                  gap: 6,
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, flex: 1 }}>
                                  <div
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'center',
                                      flexShrink: 0,
                                      width: 16,
                                      height: 16,
                                    }}
                                    title={providerObj?.name || sessionProvider}
                                  >
                                    {renderAiIcon(sessionProvider, 13)}
                                  </div>
                                  {isEditing ? (
                                    <form
                                      onSubmit={(e) => {
                                        e.preventDefault();
                                        handleSaveRenameChatSession(s.id);
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                      style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 4 }}
                                    >
                                      <input
                                        autoFocus
                                        value={editingChatTitle}
                                        onChange={(e) => setEditingChatTitle(e.target.value)}
                                        onBlur={() => handleSaveRenameChatSession(s.id)}
                                        onKeyDown={(e) => {
                                          if (e.key === 'Escape') {
                                            e.preventDefault();
                                            handleCancelRenameChatSession();
                                          }
                                        }}
                                        style={{
                                          flex: 1,
                                          minWidth: 0,
                                          background: isEffectiveDark ? 'rgba(0, 0, 0, 0.45)' : '#ffffff',
                                          color: themeTokens.textPrimary,
                                          border: `1px solid ${accentColor}`,
                                          borderRadius: 4,
                                          padding: '1px 5px',
                                          fontSize: 11.5,
                                          fontFamily: 'Poppins, sans-serif',
                                          outline: 'none',
                                        }}
                                      />
                                      <button
                                        type="submit"
                                        title="Salvar"
                                        style={{
                                          background: 'transparent',
                                          border: 'none',
                                          color: accentColor,
                                          cursor: 'pointer',
                                          padding: 1,
                                          display: 'flex',
                                          alignItems: 'center',
                                        }}
                                      >
                                        <Check size={11} />
                                      </button>
                                    </form>
                                  ) : (
                                    <span
                                      onDoubleClick={(e) => handleStartRenameChatSession(s, e)}
                                      title="Duplo clique para renomear"
                                      style={{
                                        fontSize: 11.5,
                                        color: themeTokens.textPrimary,
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        fontWeight: isActive ? '500' : '400',
                                        flex: 1,
                                      }}
                                    >
                                      {s.title}
                                    </span>
                                  )}
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
                                  {!isEditing && (
                                    <button
                                      onClick={(e) => handleStartRenameChatSession(s, e)}
                                      title="Renomear conversa"
                                      style={{
                                        background: 'transparent',
                                        border: 'none',
                                        color: themeTokens.textSecondary,
                                        cursor: 'pointer',
                                        padding: 2,
                                        display: 'flex',
                                        alignItems: 'center',
                                        borderRadius: 3,
                                        transition: 'color 0.15s ease',
                                      }}
                                      onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                                      onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                                    >
                                      <Pencil size={11} />
                                    </button>
                                  )}
                                  <button
                                    onClick={(e) => handleDeleteChatSession(s.id, e)}
                                    title="Excluir conversa"
                                    style={{
                                      background: 'transparent',
                                      border: 'none',
                                      color: themeTokens.textSecondary,
                                      cursor: 'pointer',
                                      padding: 2,
                                      display: 'flex',
                                      alignItems: 'center',
                                      borderRadius: 3,
                                      transition: 'color 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ff5f56')}
                                    onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Missing CLI installation alert banner */}
                {aiNotInstalledAlert && (
                  <div
                    style={{
                      padding: '8px 12px',
                      background: isEffectiveDark ? 'rgba(255, 75, 75, 0.12)' : 'rgba(255, 75, 75, 0.08)',
                      border: 'none',
                      borderRadius: 6,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 6,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#ff4b4b', fontSize: 11.5, fontWeight: '600' }}>
                        <AlertTriangle size={13} />
                        <span>CLI não detectada</span>
                      </div>
                      <button
                        onClick={() => setAiNotInstalledAlert(null)}
                        style={{ background: 'transparent', border: 'none', color: '#ff4b4b', cursor: 'pointer', padding: 0 }}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div style={{ fontSize: 11, color: themeTokens.textSecondary, lineHeight: '15px' }}>
                      {aiNotInstalledAlert.message}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                      <button
                        onClick={() => {
                          const prov = AI_PROVIDERS.find((p) => p.cliCommand === aiNotInstalledAlert.command || p.name === aiNotInstalledAlert.modelName) || AI_PROVIDERS[0];
                          handleInstallCliInTerminal(prov);
                          setAiNotInstalledAlert(null);
                        }}
                        style={{
                          background: accentColor,
                          border: 'none',
                          borderRadius: 4,
                          color: accentTextColor,
                          fontSize: 11,
                          fontWeight: '500',
                          fontFamily: 'Poppins, sans-serif',
                          padding: '5px 12px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          boxShadow: `0 2px 6px ${hexToRgba(accentColor, 0.3)}`,
                        }}
                      >
                        <SquareTerminal size={12} />
                        Instalar no Terminal ({aiNotInstalledAlert.guide})
                      </button>
                      <button
                        onClick={() => handleOpenExternalLink(aiNotInstalledAlert.url)}
                        style={{
                          background: 'rgba(255, 255, 255, 0.08)',
                          border: '1px solid rgba(255, 255, 255, 0.1)',
                          borderRadius: 4,
                          color: '#ccc',
                          fontSize: 11,
                          fontWeight: '400',
                          fontFamily: 'Poppins, sans-serif',
                          padding: '5px 10px',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 4,
                        }}
                      >
                        <ExternalLink size={11} />
                        Página de Download
                      </button>
                      <button
                        onClick={() => setAiNotInstalledAlert(null)}
                        style={{
                          marginLeft: 'auto',
                          background: 'transparent',
                          border: 'none',
                          color: '#777',
                          fontSize: 11,
                          cursor: 'pointer',
                          fontFamily: 'Poppins, sans-serif',
                          fontWeight: '400',
                        }}
                      >
                        Fechar
                      </button>
                    </div>
                  </div>
                )}

                {/* AI Interactive Terminal Scrollable History with Centered Loading Overlay */}
                <div style={{ flex: '1 1 0', minHeight: 0, position: 'relative', display: 'flex', flexDirection: 'column' }}>
                  {/* Watermark AI Logo in the background when chat has no messages yet */}
                  {(!aiHistory || !aiHistory.some((item) => item.text && !item.text.toLowerCase().includes('executando'))) && (
                    <div
                      style={{
                        position: 'absolute',
                        inset: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        pointerEvents: 'none',
                        zIndex: 0,
                        userSelect: 'none',
                      }}
                    >
                      <div
                        style={{
                          opacity: isEffectiveDark ? 0.08 : 0.06,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          transition: 'opacity 0.25s ease, transform 0.25s ease',
                        }}
                      >
                        {renderAiIcon(selectedAiProvider, 150)}
                      </div>
                    </div>
                  )}

                  <div
                    ref={aiTerminalScrollRef}
                    style={{
                      flex: '1 1 0',
                      minHeight: 0,
                      background: 'transparent',
                      borderRadius: 8,
                      padding: '4px 2px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: 10,
                      fontFamily: 'Poppins, sans-serif',
                      fontSize: 12,
                      fontWeight: '400',
                      position: 'relative',
                      zIndex: 1,
                    }}
                  >
                  {aiHistory.map((item, idx) => {
                    if (item.text && item.text.toLowerCase().includes('executando')) {
                      return null;
                    }
                    if (item.type === 'user') {
                      return (
                        <div
                          key={idx}
                          style={{
                            alignSelf: 'flex-end',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: 8,
                            maxWidth: '92%',
                          }}
                        >
                          <div
                            style={{
                              background: hexToRgba(chatAccentColor, 0.15),
                              color: themeTokens.textPrimary,
                              padding: '8px 12px',
                              borderRadius: '8px 2px 8px 8px',
                              wordBreak: 'break-word',
                              whiteSpace: 'pre-wrap',
                              fontWeight: '400',
                              lineHeight: '18px',
                              flex: '1 1 auto',
                            }}
                          >
                            {item.text}
                          </div>
                          <img
                            src={avatarImg}
                            onError={(e) => {
                              const target = e.target as HTMLImageElement;
                              if (!target.dataset.triedGithub) {
                                target.dataset.triedGithub = 'true';
                                target.src = 'https://github.com/walancy.png';
                              }
                            }}
                            alt="User"
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: '50%',
                              flexShrink: 0,
                              marginTop: 2,
                              objectFit: 'cover',
                              boxShadow: '0 1px 4px rgba(0, 0, 0, 0.3)',
                            }}
                          />
                        </div>
                      );
                    } else if (item.type === 'error') {
                      return (
                        <div
                          key={idx}
                          style={{
                            background: 'rgba(255, 60, 60, 0.08)',
                            borderLeft: '2px solid #ff4b4b',
                            padding: '8px 10px',
                            borderRadius: '0 6px 6px 0',
                            color: '#ff8585',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 6,
                            fontWeight: '400',
                          }}
                        >
                          <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '18px' }}>{item.text}</div>
                          {(item.command || item.downloadUrl) && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                              {item.command && (
                                <button
                                  onClick={() => {
                                    const prov = AI_PROVIDERS.find((p) => p.installGuide === item.command) || AI_PROVIDERS[0];
                                    handleInstallCliInTerminal(prov);
                                  }}
                                  style={{
                                    alignSelf: 'flex-start',
                                    background: accentColor,
                                    border: 'none',
                                    borderRadius: 4,
                                    color: accentTextColor,
                                    fontSize: 11,
                                    fontWeight: '500',
                                    fontFamily: 'Poppins, sans-serif',
                                    padding: '4px 10px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 5,
                                    boxShadow: `0 2px 6px ${hexToRgba(accentColor, 0.3)}`,
                                  }}
                                >
                                  <SquareTerminal size={11} />
                                  Instalar no Terminal
                                </button>
                              )}
                              {item.downloadUrl && (
                                <button
                                  onClick={() => handleOpenExternalLink(item.downloadUrl!)}
                                  style={{
                                    alignSelf: 'flex-start',
                                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                                    border: '1px solid ' + themeTokens.border,
                                    borderRadius: 4,
                                    color: themeTokens.textSecondary,
                                    fontSize: 11,
                                    fontWeight: '400',
                                    fontFamily: 'Poppins, sans-serif',
                                    padding: '4px 9px',
                                    cursor: 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 4,
                                  }}
                                >
                                  <ExternalLink size={11} />
                                  Página de Download
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    } else if (item.type === 'auth_required' || (item.type === 'assistant' && isAuthErrorText(item.text))) {
                      const prov = AI_PROVIDERS.find((p) => p.id === (item.providerId || selectedAiProvider)) || AI_PROVIDERS[0];
                      const authCmd = item.command || (prov.id === 'claude' ? 'claude login' : prov.id === 'antigravity' ? 'agy auth login' : prov.id === 'codex' ? 'codex login' : `${prov.cliCommand} login`);

                      return (
                        <div
                          key={idx}
                          style={{
                            alignSelf: 'flex-start',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: 8,
                            maxWidth: '96%',
                            width: '100%',
                          }}
                        >
                          {/* Assistant Avatar */}
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 5,
                              background: isEffectiveDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          >
                            <Lock size={13} color="#ef4444" />
                          </div>

                          {/* Card Content */}
                          <div
                            style={{
                              flex: '1 1 auto',
                              background: isEffectiveDark ? '#1a1414' : '#fff5f5',
                              border: isEffectiveDark ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(239, 68, 68, 0.2)',
                              borderLeft: '3px solid #ef4444',
                              borderRadius: 8,
                              padding: '12px 14px',
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 10,
                              fontFamily: 'Poppins, sans-serif',
                              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.15)',
                            }}
                          >
                            {/* Header */}
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                <KeyRound size={15} color="#ef4444" />
                                <span style={{ fontWeight: 600, fontSize: 12.5, color: isEffectiveDark ? '#fca5a5' : '#b91c1c' }}>
                                  Autenticação Necessária (OAuth Expirado)
                                </span>
                              </div>
                              <span
                                style={{
                                  fontSize: 10.5,
                                  fontWeight: 500,
                                  color: '#ef4444',
                                  background: isEffectiveDark ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)',
                                  padding: '2px 8px',
                                  borderRadius: 12,
                                }}
                              >
                                {prov.name}
                              </span>
                            </div>

                            {/* Informative text */}
                            <div style={{ fontSize: 12, color: themeTokens.textPrimary, lineHeight: '18px' }}>
                              A sessão OAuth do <strong>{prov.name}</strong> expirou ou requer autorização interativa via navegador. Escolha uma das opções abaixo para autenticar pelo terminal:
                            </div>

                            {/* Raw output box */}
                            <div
                              style={{
                                background: isEffectiveDark ? 'rgba(0, 0, 0, 0.45)' : 'rgba(0, 0, 0, 0.05)',
                                padding: '8px 10px',
                                borderRadius: 6,
                                fontSize: 11,
                                fontFamily: 'JetBrains Mono, monospace',
                                color: isEffectiveDark ? '#f87171' : '#dc2626',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                maxHeight: 110,
                                overflowY: 'auto',
                                lineHeight: '16px',
                              }}
                            >
                              {item.text}
                            </div>

                            {/* Action Buttons Row */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 2 }}>
                              {/* 1. System macOS Terminal */}
                              <button
                                onClick={async () => {
                                  if (window.electronAPI?.shell?.openInSystemTerminal) {
                                    setToastMessage(`Abrindo Terminal do macOS com "${authCmd}"...`);
                                    await window.electronAPI.shell.openInSystemTerminal(authCmd, terminalCwd);
                                  } else {
                                    handleNewTerminalSession(prov.id === 'claude' ? 'claude' : 'zsh', `${prov.name} Login`, authCmd);
                                  }
                                }}
                                style={{
                                  background: '#ef4444',
                                  border: 'none',
                                  borderRadius: 5,
                                  color: '#ffffff',
                                  fontSize: 11.5,
                                  fontWeight: 500,
                                  fontFamily: 'Poppins, sans-serif',
                                  padding: '6px 12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  boxShadow: '0 2px 8px rgba(239, 68, 68, 0.35)',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.9')}
                                onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                                title="Abre a janela do Terminal nativo do macOS para fazer o login OAuth"
                              >
                                <Monitor size={13} />
                                <span>Abrir no Terminal do Mac</span>
                              </button>

                              {/* 2. Integrated DevFlow Terminal */}
                              <button
                                onClick={() => {
                                  handleNewTerminalSession(prov.id === 'claude' ? 'claude' : 'zsh', `${prov.name} Login`, authCmd);
                                  setIsTerminalCollapsed(false);
                                  setActiveTermTab('terminal');
                                  setToastMessage(`Iniciando "${authCmd}" no terminal integrado...`);
                                }}
                                style={{
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                                  border: '1px solid ' + (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)'),
                                  borderRadius: 5,
                                  color: themeTokens.textPrimary,
                                  fontSize: 11.5,
                                  fontWeight: 500,
                                  fontFamily: 'Poppins, sans-serif',
                                  padding: '6px 12px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 6,
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.1)')}
                                onMouseLeave={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')}
                                title="Abre uma aba no terminal integrado do DevFlow para autenticar"
                              >
                                <SquareTerminal size={13} color={accentColor} />
                                <span>Terminal Integrado</span>
                              </button>

                              {/* 3. Copy Command */}
                              <button
                                onClick={() => {
                                  navigator.clipboard.writeText(authCmd);
                                  setToastMessage(`Comando "${authCmd}" copiado!`);
                                }}
                                style={{
                                  background: 'transparent',
                                  border: '1px solid ' + (isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'),
                                  borderRadius: 5,
                                  color: themeTokens.textSecondary,
                                  fontSize: 11.5,
                                  fontWeight: 400,
                                  fontFamily: 'Poppins, sans-serif',
                                  padding: '6px 10px',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 5,
                                  marginLeft: 'auto',
                                  transition: 'all 0.15s ease',
                                }}
                                onMouseEnter={(e) => (e.currentTarget.style.color = themeTokens.textPrimary)}
                                onMouseLeave={(e) => (e.currentTarget.style.color = themeTokens.textSecondary)}
                                title="Copiar comando de autenticação"
                              >
                                <Copy size={12} />
                                <span>Copiar "{authCmd}"</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    } else if (item.type === 'system') {
                      return (
                        <div
                          key={idx}
                          style={{
                            color: themeTokens.textSecondary,
                            fontSize: 11,
                            padding: '2px 4px',
                            whiteSpace: 'pre-wrap',
                            fontWeight: '400',
                            lineHeight: '16px',
                          }}
                        >
                          {item.text}
                        </div>
                      );
                    } else {
                      const isWorkedExpanded = expandedWorkedMap[idx] ?? false;
                      const isDiffCollapsed = collapsedDiffMap[idx] ?? true;
                      const steps = item.executionSteps || (item.changedFiles && item.changedFiles.length > 0 ? [
                        { type: 'explore' as const, label: `Explored ${item.changedFiles.length} file${item.changedFiles.length > 1 ? 's' : ''}` },
                        ...item.changedFiles.map((f) => ({
                          type: 'edit' as const,
                          label: `Edited ${f.name}`,
                          file: f.name,
                          additions: f.additions,
                          deletions: f.deletions,
                        }))
                      ] : null);

                      const changedFiles = item.changedFiles || [];
                      const totalFiles = changedFiles.length;
                      const totalAdditions = changedFiles.reduce((acc, f) => acc + (f.additions || 0), 0);
                      const totalDeletions = changedFiles.reduce((acc, f) => acc + (f.deletions || 0), 0);
                      const formattedTime = item.timestamp
                        ? new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                      return (
                        <div
                          key={idx}
                          style={{
                            alignSelf: 'flex-start',
                            display: 'flex',
                            flexDirection: 'row',
                            alignItems: 'flex-start',
                            gap: 8,
                            maxWidth: '96%',
                            width: '100%',
                          }}
                        >
                          {/* Assistant Avatar / Icon */}
                          <div
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 5,
                              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              marginTop: 2,
                            }}
                          >
                            {renderAiIcon(item.providerId || 'antigravity', 14)}
                          </div>

                          {/* Content Container */}
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 8,
                              flex: '1 1 auto',
                              minWidth: 0,
                            }}
                          >
                            {/* 1. Worked for X Collapsible Accordion */}
                            {(steps || item.workedDuration) && (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                <button
                                  onClick={() => setExpandedWorkedMap((prev) => ({ ...prev, [idx]: !isWorkedExpanded }))}
                                  style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                                    border: 'none',
                                    borderRadius: 6,
                                    padding: '4px 10px',
                                    color: isEffectiveDark ? '#9ca3af' : '#4b5563',
                                    fontSize: 12,
                                    cursor: 'pointer',
                                    marginBottom: isWorkedExpanded && steps && steps.length > 0 ? 8 : 0,
                                    transition: 'background 0.15s ease',
                                  }}
                                >
                                  <span style={{ color: themeTokens.textPrimary, fontWeight: 500 }}>
                                    Worked for {item.workedDuration || '3m'}
                                  </span>
                                  {isWorkedExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                                </button>

                                {isWorkedExpanded && steps && steps.length > 0 && (
                                  <div
                                    style={{
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 7,
                                      paddingLeft: 6,
                                      paddingBottom: 4,
                                    }}
                                  >
                                    {steps.map((step, sIdx) => {
                                      if (step.type === 'edit') {
                                        return (
                                          <div
                                            key={sIdx}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 6,
                                              fontSize: 12.5,
                                              color: themeTokens.textPrimary,
                                            }}
                                          >
                                            <span style={{ color: '#9ca3af' }}>Edited</span>
                                            {renderFileIcon(step.file || 'App.tsx')}
                                            <span style={{ fontWeight: 600, color: themeTokens.textPrimary }}>
                                              {step.file || 'App.tsx'}
                                            </span>
                                            <span style={{ color: '#22c55e', fontSize: 11.5, fontWeight: 600, marginLeft: 2 }}>
                                              +{step.additions ?? 1}
                                            </span>
                                            <span style={{ color: '#ef4444', fontSize: 11.5, fontWeight: 600 }}>
                                              -{step.deletions ?? 0}
                                            </span>
                                          </div>
                                        );
                                      }
                                      if (step.type === 'run') {
                                        return (
                                          <div
                                            key={sIdx}
                                            style={{
                                              display: 'flex',
                                              alignItems: 'center',
                                              gap: 6,
                                              fontSize: 12.5,
                                              color: themeTokens.textPrimary,
                                            }}
                                          >
                                            <span style={{ color: '#9ca3af' }}>Ran</span>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 600, color: themeTokens.textPrimary }}>
                                              {step.command || step.label}
                                            </span>
                                            <ChevronDown size={13} style={{ color: '#6b7280', marginLeft: 2 }} />
                                          </div>
                                        );
                                      }
                                      return (
                                        <div
                                          key={sIdx}
                                          style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 6,
                                            fontSize: 12.5,
                                            color: '#9ca3af',
                                          }}
                                        >
                                          <span>{step.label}</span>
                                          <ChevronRight size={13} style={{ color: '#6b7280', marginLeft: 2 }} />
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 2. Main Assistant Response Text (Rich Markdown & Code Formatted) */}
                            <div
                              style={{
                                background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
                                color: themeTokens.textPrimary,
                                padding: '10px 14px',
                                borderRadius: '8px',
                                border: 'none',
                                wordBreak: 'break-word',
                                lineHeight: '20px',
                                fontSize: 13,
                              }}
                            >
                              {renderFormattedMessage(item.text, idx)}
                            </div>

                            {/* 3. Walkthrough Card (Antigravity Style - Borderless) */}
                            {item.walkthrough && (
                              <div
                                style={{
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                                  border: 'none',
                                  borderRadius: 8,
                                  padding: '10px 14px',
                                }}
                              >
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 6,
                                    fontSize: 13,
                                    fontWeight: 600,
                                    color: themeTokens.textPrimary,
                                    marginBottom: 6,
                                  }}
                                >
                                  <BookOpen size={14} style={{ color: '#93c5fd' }} />
                                  <span>Walkthrough</span>
                                </div>
                                <div style={{ fontSize: 12.5, color: '#9ca3af', lineHeight: '18px' }}>
                                  {renderFormattedMessage(
                                    (item.walkthrough.summary || '')
                                      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                                      .replace(/```[a-zA-Z]*\n?/g, '')
                                      .replace(/```/g, ''),
                                    idx + 1000
                                  )}
                                </div>
                              </div>
                            )}

                            {/* 4. Files Changed Card (Resumo de arquivos modificados - Borderless) */}
                            {totalFiles > 0 && (
                              <div
                                style={{
                                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                                  border: 'none',
                                  borderRadius: 8,
                                  overflow: 'hidden',
                                }}
                              >
                                {/* Card Header */}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '8px 12px',
                                    borderBottom: isDiffCollapsed ? 'none' : `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'}`,
                                  }}
                                >
                                  <div
                                    onClick={() => setCollapsedDiffMap((prev) => ({ ...prev, [idx]: !isDiffCollapsed }))}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      gap: 6,
                                      cursor: 'pointer',
                                      userSelect: 'none',
                                    }}
                                  >
                                    {isDiffCollapsed ? (
                                      <ChevronRight size={14} style={{ color: '#9ca3af' }} />
                                    ) : (
                                      <ChevronDown size={14} style={{ color: '#9ca3af' }} />
                                    )}
                                    <span style={{ fontSize: 12.5, fontWeight: 500, color: themeTokens.textPrimary }}>
                                      {totalFiles} {totalFiles === 1 ? 'file changed' : 'files changed'}
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e', marginLeft: 4 }}>
                                      +{totalAdditions}
                                    </span>
                                    <span style={{ fontSize: 12, fontWeight: 600, color: '#ef4444' }}>
                                      -{totalDeletions}
                                    </span>
                                  </div>

                                  <button
                                    onClick={() => {
                                      handleStartReview(changedFiles, 0);
                                    }}
                                    style={{
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: 4,
                                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)',
                                      border: 'none',
                                      borderRadius: 6,
                                      padding: '4px 10px',
                                      fontSize: 11.5,
                                      fontWeight: 500,
                                      color: themeTokens.textPrimary,
                                      cursor: 'pointer',
                                      transition: 'background 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.14)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)')}
                                  >
                                    Review
                                  </button>
                                </div>

                                {/* Changed Files Rows */}
                                {!isDiffCollapsed && (
                                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                                    {changedFiles.map((file, fIdx) => (
                                      <div
                                        key={fIdx}
                                        onClick={() => handleStartReview(changedFiles, fIdx)}
                                        style={{
                                          display: 'flex',
                                          alignItems: 'center',
                                          justifyContent: 'space-between',
                                          padding: '6px 12px',
                                          fontSize: 12,
                                          cursor: 'pointer',
                                          transition: 'background 0.15s ease',
                                          borderTop: fIdx > 0 ? `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.02)'}` : 'none',
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)')}
                                        onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                                      >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, overflow: 'hidden' }}>
                                          {renderFileIcon(file.name)}
                                          <span style={{ fontWeight: 600, color: themeTokens.textPrimary }}>{file.name}</span>
                                          {file.dir && (
                                            <span style={{ color: '#6b7280', fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                              {file.dir}
                                            </span>
                                          )}
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0, marginLeft: 8 }}>
                                          <span style={{ color: '#22c55e', fontWeight: 600, fontSize: 11.5 }}>
                                            +{file.additions}
                                          </span>
                                          <span style={{ color: '#ef4444', fontWeight: 600, fontSize: 11.5 }}>
                                            -{file.deletions}
                                          </span>
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* 5. Footer: Timestamp & Copy Button Only */}
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: 10,
                                paddingLeft: 2,
                                color: '#6b7280',
                                fontSize: 11,
                                marginTop: 2,
                              }}
                            >
                              <span>{formattedTime}</span>
                              <button
                                onClick={() => handleCopyMessage(item.text, idx)}
                                title="Copiar resposta"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  cursor: 'pointer',
                                  color: copiedMsgIdx === idx ? '#22c55e' : '#9ca3af',
                                  display: 'flex',
                                  alignItems: 'center',
                                  transition: 'color 0.15s ease',
                                }}
                              >
                                {copiedMsgIdx === idx ? <Check size={13} /> : <Copy size={13} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    }
                  })}

                  {/* AI Thinking Indicator (3 jumping / bouncing dots) - only while waiting for AI response without flashing for fast responses */}
                  {showThinkingDots && isAiExecuting && aiHistory[aiHistory.length - 1]?.type === 'user' && (
                    <div
                      style={{
                        alignSelf: 'flex-start',
                        display: 'flex',
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        maxWidth: '96%',
                      }}
                    >
                      <div
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 5,
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {renderAiIcon(selectedAiProvider, 14)}
                      </div>
                      <div
                        style={{
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)',
                          padding: '7px 11px',
                          borderRadius: '2px 8px 8px 8px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: 3.5,
                        }}
                      >
                        <span className="thinking-dot" style={{ animationDelay: '0ms', backgroundColor: chatAccentColor }} />
                        <span className="thinking-dot" style={{ animationDelay: '180ms', backgroundColor: chatAccentColor }} />
                        <span className="thinking-dot" style={{ animationDelay: '360ms', backgroundColor: chatAccentColor }} />
                      </div>
                    </div>
                  )}

                  {/* Centered Quota Exceeded Notice inside conversation div */}
                  {quotaExceededAlert && (
                    <div
                      onClick={() => setQuotaExceededAlert(null)}
                      title="Clique para fechar"
                      style={{
                        margin: aiHistory.length <= 1 ? 'auto auto' : '24px auto',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        textAlign: 'center',
                        gap: 6,
                        background: 'transparent',
                        border: 'none',
                        outline: 'none',
                        boxShadow: 'none',
                        padding: '12px 16px',
                        cursor: 'pointer',
                        userSelect: 'none',
                        animation: 'fadeIn 0.2s ease-out',
                      }}
                    >
                      <AlertTriangle size={18} style={{ color: '#ff5c5c', opacity: 0.9 }} />
                      <div style={{ fontSize: 13, fontWeight: 500, color: themeTokens.textPrimary, letterSpacing: '-0.1px' }}>
                        Limite de créditos atingido
                      </div>
                      <div style={{ fontSize: 11.5, color: '#888' }}>
                        Reset: {formatRelativeResetTime(quotaExceededAlert.resetTime)}
                      </div>
                    </div>
                  )}
                </div>
                </div>

                {/* Floating Bottom Card: Input & Model Selection with Slash Commands Autocomplete */}
                {(() => {
                  const activeAiProvider = AI_PROVIDERS.find((p) => p.id === selectedAiProvider) || AI_PROVIDERS[0];
                  const currentCommands = aiCommands[selectedAiProvider] || activeAiProvider.commands || [];
                  const isSlashActive = askPrompt.startsWith('/') && !askPrompt.includes(' ') && !isSlashDismissed;
                  const slashQuery = isSlashActive ? askPrompt.slice(1).toLowerCase() : '';
                  const filteredSlashCommands = isSlashActive
                    ? currentCommands.filter(
                        (c) =>
                          c.command.slice(1).toLowerCase().includes(slashQuery) ||
                          c.description.toLowerCase().includes(slashQuery)
                      )
                    : [];
                  const safeSelectedIndex = filteredSlashCommands.length > 0 ? Math.min(Math.max(0, selectedSlashIndex), filteredSlashCommands.length - 1) : 0;

                  const handleSelectSlashCommand = (cmd: AiSlashCommand) => {
                    setAskPrompt(`${cmd.command} `);
                    setIsSlashDismissed(true);
                    setTimeout(() => {
                      if (inputRef.current) {
                        inputRef.current.focus();
                        const len = cmd.command.length + 1;
                        inputRef.current.setSelectionRange?.(len, len);
                      }
                    }, 50);
                  };

                  const currentQuota = aiQuotas[selectedAiProvider] || DEFAULT_AI_QUOTAS[selectedAiProvider];
                  const dailyResetFormatted = formatRelativeResetTime(currentQuota?.dailyResetTime);
                  const weeklyResetFormatted = formatRelativeResetTime(currentQuota?.weeklyResetTime);

                  const isDailyExhausted = currentQuota && currentQuota.dailyPercent === 0 && dailyResetFormatted !== 'Disponível' && !dailyResetFormatted.includes('resetado');
                  const isWeeklyExhausted = currentQuota && currentQuota.weeklyPercent === 0 && weeklyResetFormatted !== 'Disponível' && !weeklyResetFormatted.includes('resetado');
                  const isCurrentQuotaExhausted = isDailyExhausted || isWeeklyExhausted;
                  const exhaustedResetTime = isWeeklyExhausted ? currentQuota.weeklyResetTime : currentQuota.dailyResetTime;
                  const relativeReset = formatRelativeResetTime(exhaustedResetTime);

                  return (
                    <div style={{ alignSelf: 'stretch', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', zIndex: 50 }}>
                      {/* Minimalist Warning Notice above input region (borderless, compact, short text) */}
                      {isCurrentQuotaExhausted && (
                        <div
                          style={{
                            alignSelf: 'stretch',
                            background: 'rgba(255, 75, 75, 0.06)',
                            border: 'none',
                            outline: 'none',
                            boxShadow: 'none',
                            borderRadius: 6,
                            padding: '4px 8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 6,
                            animation: 'fadeIn 0.15s ease-out',
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0, overflow: 'hidden' }}>
                            <AlertTriangle size={12} style={{ color: '#ff5c5c', flexShrink: 0 }} />
                            <span
                              style={{
                                fontSize: 11,
                                color: '#e08888',
                                fontFamily: 'Poppins, sans-serif',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={`0 créditos. Reset: ${relativeReset}`}
                            >
                              0 créditos{relativeReset && relativeReset !== 'Disponível' ? ` · Reset ${relativeReset.startsWith('em ') ? relativeReset : `em ${relativeReset}`}` : ''}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                              type="button"
                              onClick={() => {
                                refreshAiQuotas();
                                setToastMessage('Atualizando cota de créditos...');
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: themeTokens.textSecondary,
                                fontSize: 10.5,
                                fontFamily: 'Poppins, sans-serif',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 3,
                              }}
                              title="Verificar se os créditos já resetaram"
                            >
                              <RefreshCw size={10} />
                              <span>Atualizar</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => setProviderDropdown(true)}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                outline: 'none',
                                color: accentColor,
                                fontSize: 11,
                                fontWeight: 500,
                                fontFamily: 'Poppins, sans-serif',
                                padding: '1px 4px',
                                cursor: 'pointer',
                                whiteSpace: 'nowrap',
                                flexShrink: 0,
                                display: 'flex',
                                alignItems: 'center',
                                gap: 2,
                                transition: 'opacity 0.15s ease',
                              }}
                              onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.8')}
                              onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
                            >
                              <span>Trocar IA</span>
                              <ChevronRight size={11} />
                            </button>
                          </div>
                        </div>
                      )}

                      <form
                        onSubmit={handleAiSubmit}
                        style={{
                          alignSelf: 'stretch',
                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(255, 255, 255, 0.45)',
                          backdropFilter: 'blur(12px)',
                          WebkitBackdropFilter: 'blur(12px)',
                          borderRadius: 10,
                          border: 'none',
                          outline: 'none',
                          boxShadow: 'none',
                          flexDirection: 'column',
                          justifyContent: 'flex-start',
                          alignItems: 'flex-start',
                          display: 'flex',
                          overflow: 'visible',
                          position: 'relative',
                          flexShrink: 0,
                          zIndex: 50,
                          transition: 'background 0.2s ease',
                        }}
                      >
                      {/* Floating Slash Commands Autocomplete Menu */}
                      {isSlashActive && (
                        <div
                          style={{
                            position: 'absolute',
                            bottom: 'calc(100% + 8px)',
                            left: 0,
                            right: 0,
                            background: isEffectiveDark ? '#181818' : '#ffffff',
                            borderRadius: 10,
                            border: 'none',
                            boxShadow: isEffectiveDark ? '0 8px 24px rgba(0, 0, 0, 0.7)' : '0 8px 24px rgba(0, 0, 0, 0.12)',
                            padding: 6,
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 2,
                            maxHeight: 240,
                            overflowY: 'auto',
                            zIndex: 99999,
                          }}
                        >
                          {filteredSlashCommands.length > 0 ? (
                            filteredSlashCommands.map((cmd, idx) => {
                              const isSelected = idx === safeSelectedIndex;
                              return (
                                <div
                                  key={cmd.command}
                                  onClick={() => handleSelectSlashCommand(cmd)}
                                  onMouseEnter={() => setSelectedSlashIndex(idx)}
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    padding: '7px 10px',
                                    borderRadius: 6,
                                    cursor: 'pointer',
                                    background: isSelected
                                      ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)')
                                      : 'transparent',
                                    transition: 'background 0.15s ease',
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                                    <span
                                      style={{
                                        color: isSelected ? themeTokens.textPrimary : (isEffectiveDark ? '#e0e0e0' : '#333333'),
                                        fontFamily: 'monospace',
                                        fontSize: 12,
                                        fontWeight: isSelected ? 600 : 500,
                                      }}
                                    >
                                      {cmd.command}
                                    </span>
                                    {cmd.usage && (
                                      <span
                                        style={{
                                          color: themeTokens.textSecondary,
                                          fontFamily: 'monospace',
                                          fontSize: 10.5,
                                        }}
                                      >
                                        {cmd.usage}
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    style={{
                                      color: isSelected ? themeTokens.textSecondary : (isEffectiveDark ? '#777777' : '#888888'),
                                      fontSize: 11.5,
                                      fontFamily: 'Poppins, sans-serif',
                                      marginLeft: 12,
                                      whiteSpace: 'nowrap',
                                      overflow: 'hidden',
                                      textOverflow: 'ellipsis',
                                    }}
                                  >
                                    {cmd.description}
                                  </span>
                                </div>
                              );
                            })
                          ) : (
                            <div style={{ padding: '8px 10px', color: themeTokens.textSecondary, fontSize: 11.5, fontFamily: 'Poppins, sans-serif' }}>
                              Nenhum comando correspondente para <strong style={{ color: themeTokens.textPrimary }}>{askPrompt}</strong> no {activeAiProvider.name}.
                            </div>
                          )}
                        </div>
                      )}

                      {/* Larger Typing Area (Multi-line Support with Enter to Send) */}
                      <div style={{ alignSelf: 'stretch', padding: '12px 14px', display: 'flex', alignItems: 'flex-start' }}>
                        <textarea
                          ref={inputRef as any}
                          value={askPrompt}
                          onChange={(e) => {
                            const val = e.target.value;
                            setAskPrompt(val);
                            if (!val.startsWith('/')) {
                              if (isSlashDismissed) setIsSlashDismissed(false);
                            } else {
                              setSelectedSlashIndex(0);
                            }
                          }}
                          onKeyDown={(e) => {
                            if (isSlashActive && filteredSlashCommands.length > 0) {
                              if (e.key === 'ArrowDown') {
                                e.preventDefault();
                                setSelectedSlashIndex((prev) => (prev + 1) % filteredSlashCommands.length);
                                return;
                              }
                              if (e.key === 'ArrowUp') {
                                e.preventDefault();
                                setSelectedSlashIndex((prev) => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
                                return;
                              }
                              if (e.key === 'Enter' || e.key === 'Tab') {
                                e.preventDefault();
                                const cmd = filteredSlashCommands[safeSelectedIndex] || filteredSlashCommands[0];
                                if (cmd) {
                                  handleSelectSlashCommand(cmd);
                                }
                                return;
                              }
                              if (e.key === 'Escape') {
                                e.preventDefault();
                                setIsSlashDismissed(true);
                                return;
                              }
                            }

                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleAiSubmit();
                            }
                          }}
                          placeholder={`Perguntar ou digite / para comandos do ${activeAiProvider.name}...`}
                          disabled={isAiExecuting}
                          rows={3}
                          style={{
                            flex: '1 1 0',
                            color: themeTokens.textPrimary,
                            fontSize: 12.5,
                            fontFamily: 'Poppins, sans-serif',
                            fontWeight: '400',
                            background: 'transparent',
                            border: 'none',
                            outline: 'none',
                            resize: 'none',
                            lineHeight: '19px',
                            minHeight: 58,
                          }}
                        />
                      </div>

                  {/* Bottom Row: AI Selector + Model Selector + Send Button */}
                  <div
                    style={{
                      alignSelf: 'stretch',
                      padding: '8px 10px',
                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      display: 'flex',
                      position: 'relative',
                      whiteSpace: 'nowrap',
                      borderBottomLeftRadius: 10,
                      borderBottomRightRadius: 10,
                      gap: 6,
                      zIndex: 60,
                    }}
                  >
                    {/* Left Controls: Orchestrator + AI Selector + Model Selector */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 5, flex: '1 1 auto', minWidth: 0, overflow: 'visible' }}>
                      {/* Orchestrator Toggle Button (Icon only with hover tooltip) */}
                      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        <div
                          onClick={() => setIsOrchestratorActive(!isOrchestratorActive)}
                          onMouseEnter={() => setOrchestratorTooltipOpen(true)}
                          onMouseLeave={() => setOrchestratorTooltipOpen(false)}
                          style={{
                            width: 26,
                            height: 26,
                            borderRadius: 5,
                            background: isOrchestratorActive ? accentColor : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'),
                            color: isOrchestratorActive ? accentTextColor : themeTokens.textSecondary,
                            boxShadow: isOrchestratorActive ? `0 0 10px ${hexToRgba(accentColor, 0.4)}` : 'none',
                            justifyContent: 'center',
                            alignItems: 'center',
                            display: 'flex',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease',
                            flexShrink: 0,
                            userSelect: 'none',
                          }}
                        >
                          <Wand2 size={13.5} color={isOrchestratorActive ? accentTextColor : themeTokens.textSecondary} />
                        </div>

                        {/* Hover Tooltip */}
                        {orchestratorTooltipOpen && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 'calc(100% + 8px)',
                              left: 0,
                              background: themeTokens.bgCardSecondary,
                              border: `1px solid ${themeTokens.border}`,
                              borderRadius: 6,
                              padding: '5px 9px',
                              color: themeTokens.textPrimary,
                              fontSize: 11,
                              fontFamily: 'Poppins, sans-serif',
                              whiteSpace: 'nowrap',
                              zIndex: 10000,
                              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.5)',
                              pointerEvents: 'none',
                              display: 'flex',
                              alignItems: 'center',
                              gap: 6,
                            }}
                          >
                            <span style={{ color: isOrchestratorActive ? accentColor : themeTokens.textPrimary, fontWeight: 500 }}>
                              {isOrchestratorActive ? 'Orquestrador Ativo' : 'Orquestrador'}
                            </span>
                            <span style={{ color: themeTokens.textSecondary, fontSize: 10 }}>
                              {isOrchestratorActive ? '• Alternando tarefas' : '• Clique para ativar'}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Select AI (Provider) Button with Logo */}
                      <div style={{ position: 'relative', flexShrink: 1, minWidth: 0 }} ref={providerDropdownRef}>
                        <div
                          onClick={() => setProviderDropdown(!providerDropdown)}
                          style={{
                            height: 26,
                            paddingLeft: 7,
                            paddingRight: 7,
                            borderRadius: 5,
                            background: providerDropdown
                              ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                              : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'),
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            gap: 5,
                            display: 'flex',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'background 0.15s ease',
                            maxWidth: 110,
                            minWidth: 0,
                            overflow: 'hidden',
                          }}
                        >
                          <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>
                            {renderAiIcon(selectedAiProvider, 13.5)}
                          </div>
                          <div
                            style={{
                              color: themeTokens.textPrimary,
                              fontSize: 11.5,
                              fontFamily: 'Poppins, sans-serif',
                              fontWeight: '400',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              minWidth: 0,
                            }}
                          >
                            {AI_PROVIDERS.find((p) => p.id === selectedAiProvider)?.name || 'Claude'}
                          </div>
                          <ChevronDown size={10} color={themeTokens.textSecondary} style={{ flexShrink: 0 }} />
                        </div>

                        {/* AI Providers Dropdown Menu */}
                        {providerDropdown && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 34,
                              left: 0,
                              background: themeTokens.bgCardSecondary,
                              borderRadius: 10,
                              border: `1px solid ${themeTokens.border}`,
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                              padding: 6,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                              zIndex: 9999,
                              whiteSpace: 'nowrap',
                              minWidth: isOrchestratorActive ? 230 : 190,
                            }}
                          >
                            {AI_PROVIDERS.map((p) => {
                              const isInstalled = installedClis[p.id] ?? true;
                              const isSelected = selectedAiProvider === p.id;
                              const isOrchestrated = !!orchestratedProviders[p.id];

                              return (
                                <div
                                  key={p.id}
                                  onClick={() => {
                                    if (!isInstalled) {
                                      // If CLI not installed, clicking row opens installer in terminal
                                      handleInstallCliInTerminal(p);
                                      return;
                                    }
                                    handleSwitchAiProvider(p.id);
                                    setProviderDropdown(false);
                                    setAiNotInstalledAlert(null);
                                  }}
                                  title={
                                    !isInstalled
                                      ? `CLI "${p.cliCommand}" não instalado. Clique para instalar no terminal (${p.installGuide})`
                                      : undefined
                                  }
                                  style={{
                                    padding: '7px 10px',
                                    color: themeTokens.textPrimary,
                                    fontSize: 12,
                                    fontFamily: 'Poppins, sans-serif',
                                    fontWeight: isSelected ? '600' : '400',
                                    cursor: 'pointer',
                                    borderRadius: 6,
                                    whiteSpace: 'nowrap',
                                    background: isSelected ? hexToRgba(accentColor, 0.15) : 'transparent',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 8,
                                    opacity: isInstalled ? 1 : 0.7,
                                    transition: 'background 0.15s ease, opacity 0.15s ease',
                                  }}
                                  onMouseEnter={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';
                                    }
                                  }}
                                  onMouseLeave={(e) => {
                                    if (!isSelected) {
                                      e.currentTarget.style.background = 'transparent';
                                    }
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                    {renderAiIcon(p.id, 15)}
                                    <span>{p.name}</span>
                                  </div>

                                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                    {isInstalled && !p.requiresLogin && (
                                      <span
                                        style={{
                                          fontSize: 9.5,
                                          padding: '2px 6px',
                                          borderRadius: 4,
                                          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)',
                                          color: themeTokens.textSecondary,
                                          fontFamily: 'Poppins, sans-serif',
                                        }}
                                        title="Roda localmente sem necessidade de login na nuvem"
                                      >
                                        Local
                                      </span>
                                    )}

                                    {!isInstalled && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleInstallCliInTerminal(p);
                                          }}
                                          title={`Executar instalação no terminal: ${p.installGuide}`}
                                          style={{
                                            fontSize: 10,
                                            padding: '2px 7px',
                                            borderRadius: 4,
                                            background: accentColor,
                                            border: 'none',
                                            color: '#fff',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: 4,
                                            fontWeight: 500,
                                            fontFamily: 'Poppins, sans-serif',
                                            cursor: 'pointer',
                                            boxShadow: `0 2px 6px ${hexToRgba(accentColor, 0.3)}`,
                                          }}
                                        >
                                          <SquareTerminal size={10} />
                                          <span>Instalar</span>
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleOpenExternalLink(p.installUrl);
                                          }}
                                          title="Abrir página oficial de download no navegador"
                                          style={{
                                            fontSize: 10,
                                            padding: '3px 5px',
                                            borderRadius: 4,
                                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                                            border: 'none',
                                            color: themeTokens.textSecondary,
                                            display: 'flex',
                                            alignItems: 'center',
                                            cursor: 'pointer',
                                          }}
                                        >
                                          <ExternalLink size={10} />
                                        </button>
                                      </div>
                                    )}

                                    {/* Small Switch for Orchestrator Selection */}
                                    {isOrchestratorActive && (
                                      <MiniSwitch
                                        checked={isOrchestrated}
                                        disabled={!isInstalled}
                                        accentColor={accentColor}
                                        onChange={() => {
                                          setOrchestratedProviders((prev) => ({
                                            ...prev,
                                            [p.id]: !prev[p.id],
                                          }));
                                        }}
                                      />
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Select AI Model Button with Pill & Dropdown */}
                      <div style={{ position: 'relative', flexShrink: 1, minWidth: 0 }} ref={modelDropdownRef}>
                        <div
                          onClick={() => setModelDropdown(!modelDropdown)}
                          title="Alterar modelo de IA da CLI"
                          style={{
                            height: 26,
                            paddingLeft: 7,
                            paddingRight: 7,
                            borderRadius: 5,
                            background: modelDropdown
                              ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)')
                              : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : '#e2e8f0'),
                            justifyContent: 'flex-start',
                            alignItems: 'center',
                            gap: 4,
                            display: 'flex',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            transition: 'background 0.15s ease',
                            maxWidth: 125,
                            minWidth: 0,
                            overflow: 'hidden',
                          }}
                          onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.08)')}
                          onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = modelDropdown ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)') : (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'))}
                        >
                          <span
                            style={{
                              color: themeTokens.textPrimary,
                              fontSize: 11,
                              fontFamily: 'Poppins, sans-serif',
                              fontWeight: 400,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              minWidth: 0,
                            }}
                          >
                            {(() => {
                              const m = activeModels[selectedAiProvider];
                              const name = m?.currentModel || m?.currentModelId || (selectedAiProvider === 'claude' ? 'sonnet' : 'Padrão');
                              return formatModelDisplayName(name) || name;
                            })()}
                          </span>
                          <ChevronDown size={10} color={themeTokens.textSecondary} style={{ flexShrink: 0 }} />
                        </div>

                        {/* Model Dropdown Menu */}
                        {modelDropdown && (
                          <div
                            style={{
                              position: 'absolute',
                              bottom: 34,
                              left: '50%',
                              transform: 'translateX(-50%)',
                              background: themeTokens.bgCardSecondary,
                              borderRadius: 10,
                              border: `1px solid ${themeTokens.border}`,
                              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                              padding: 6,
                              display: 'flex',
                              flexDirection: 'column',
                              gap: 2,
                              zIndex: 99999,
                              minWidth: 220,
                              maxWidth: 270,
                              maxHeight: 280,
                              overflowY: 'auto',
                            }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 8px 6px', borderBottom: `1px solid ${themeTokens.border}`, gap: 8 }}>
                              <span style={{ fontSize: 10.5, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                Modelos {activeAiProvider.name}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  refreshAiModels(selectedAiProvider);
                                }}
                                title="Recarregar modelos da CLI"
                                style={{ background: 'transparent', border: 'none', color: themeTokens.textSecondary, cursor: 'pointer', padding: 2, display: 'flex', alignItems: 'center' }}
                              >
                                <RefreshCw size={11} className={isLoadingModels ? 'spin' : ''} />
                              </button>
                            </div>

                            {(activeModels[selectedAiProvider]?.models || []).length > 0 ? (
                              (activeModels[selectedAiProvider]?.models || []).map((m) => {
                                const currentId = activeModels[selectedAiProvider]?.currentModelId;
                                const currentLabel = activeModels[selectedAiProvider]?.currentModel;
                                const isCurrent = currentId === m.id || currentLabel === m.label;
                                return (
                                  <div
                                    key={m.id}
                                    onClick={() => handleSelectModel(m)}
                                    style={{
                                      display: 'flex',
                                      alignItems: 'center',
                                      justifyContent: 'space-between',
                                      padding: '7px 10px',
                                      borderRadius: 6,
                                      cursor: 'pointer',
                                      background: isCurrent ? hexToRgba(accentColor, 0.15) : 'transparent',
                                      transition: 'background 0.15s ease',
                                    }}
                                    onMouseEnter={(e) => {
                                      if (!isCurrent) (e.currentTarget as HTMLElement).style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)';
                                    }}
                                    onMouseLeave={(e) => {
                                      if (!isCurrent) (e.currentTarget as HTMLElement).style.background = 'transparent';
                                    }}
                                  >
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                                      {isCurrent ? <Check size={13} color={accentColor} /> : <div style={{ width: 13 }} />}
                                      <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                                        <span style={{ color: isCurrent ? accentColor : themeTokens.textPrimary, fontSize: 11.5, fontWeight: isCurrent ? 600 : 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                          {formatModelDisplayName(m.label) || m.label}
                                        </span>
                                        {m.description && (
                                          <span style={{ color: themeTokens.textSecondary, fontSize: 10, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                            {m.description}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                    {m.tag && (
                                      <span style={{ fontSize: 9.5, color: accentColor, background: hexToRgba(accentColor, 0.12), padding: '2px 5px', borderRadius: 4, flexShrink: 0, marginLeft: 6 }}>
                                        {m.tag}
                                      </span>
                                    )}
                                  </div>
                                );
                              })
                            ) : (
                              <div style={{ padding: '8px 10px', color: themeTokens.textSecondary, fontSize: 11, fontFamily: 'Poppins, sans-serif' }}>
                                Carregando modelos da CLI...
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Controls: AI Usage Quota Badge + Circular Send Button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                      {/* AI Usage Quota Badge */}
                      {(() => {
                        const currentQuota = aiQuotas[selectedAiProvider] || aiQuotas.claude || DEFAULT_AI_QUOTAS.claude;
                        return (
                          <div
                            ref={quotaTooltipRef}
                            onClick={() => {
                              setQuotaTooltipOpen((prev) => !prev);
                              refreshAiQuotas();
                            }}
                            onMouseEnter={() => setQuotaTooltipOpen(true)}
                            onMouseLeave={() => setQuotaTooltipOpen(false)}
                            title="Clique para ver detalhes de uso e reset das quotas de IA"
                            style={{
                              position: 'relative',
                              display: 'flex',
                              flexDirection: 'column',
                              justifyContent: 'center',
                              alignItems: 'flex-end',
                              lineHeight: 1.05,
                              cursor: 'pointer',
                              userSelect: 'none',
                              flexShrink: 0,
                              padding: '2px 3px',
                            }}
                          >
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: currentQuota.weeklyPercent === 0 ? '#ef4444' : currentQuota.weeklyPercent <= 15 ? '#f97316' : themeTokens.textPrimary,
                                fontFamily: 'Poppins, -apple-system, sans-serif',
                                letterSpacing: '-0.02em',
                              }}
                            >
                              {currentQuota.dailyPercent}%
                            </span>
                            <span
                              style={{
                                fontSize: 9.5,
                                fontWeight: 700,
                                color: currentQuota.dailyPercent === 0 ? '#ef4444' : currentQuota.dailyPercent <= 15 ? '#f97316' : themeTokens.textPrimary,
                                fontFamily: 'Poppins, -apple-system, sans-serif',
                                letterSpacing: '-0.02em',
                              }}
                            >
                              {currentQuota.weeklyPercent}%
                            </span>

                            {/* Hover / Click Popup: fundo adaptativo do sistema, sem bordas, sombra suave */}
                            {quotaTooltipOpen && (
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: 'absolute',
                                  bottom: 34,
                                  right: 0,
                                  background: themeTokens.bgCardSecondary,
                                  border: `1px solid ${themeTokens.border}`,
                                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
                                  borderRadius: 10,
                                  padding: '12px 14px',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 10,
                                  zIndex: 99999,
                                  minWidth: 295,
                                  width: 'max-content',
                                  maxWidth: 340,
                                  boxSizing: 'border-box',
                                  pointerEvents: 'auto',
                                }}
                              >
                                {/* Header */}
                                <div
                                  style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    borderBottom: `1px solid ${themeTokens.border}`,
                                    paddingBottom: 8,
                                  }}
                                >
                                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                                    {selectedAiProvider === 'claude' && <ClaudeIcon size={15} />}
                                    {selectedAiProvider === 'antigravity' && <AntigravityIcon size={15} />}
                                    {selectedAiProvider === 'codex' && <CodexIcon size={15} />}
                                    {selectedAiProvider === 'gemini' && <GeminiIcon size={15} />}
                                    {selectedAiProvider === 'ollama' && <OllamaIcon size={15} />}
                                    <span style={{ fontSize: 12, fontWeight: 600, color: themeTokens.textPrimary, fontFamily: 'Poppins, sans-serif' }}>
                                      {AI_PROVIDERS.find((p) => p.id === selectedAiProvider)?.name || 'IA'}
                                    </span>
                                  </div>
                                  <span
                                    style={{
                                      fontSize: 9.5,
                                      color: themeTokens.textSecondary,
                                      background: isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)',
                                      padding: '2px 7px',
                                      borderRadius: 4,
                                      fontWeight: 500,
                                      fontFamily: 'Poppins, sans-serif',
                                    }}
                                  >
                                    Quota Restante
                                  </span>
                                </div>

                                {/* Daily Quota */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontFamily: 'Poppins, sans-serif' }}>
                                    <span style={{ color: themeTokens.textSecondary }}>Limite diário:</span>
                                    <span style={{ color: themeTokens.textPrimary, fontWeight: 700 }}>
                                      {currentQuota.dailyPercent}% disponível
                                    </span>
                                  </div>
                                  {/* Accent progress bar */}
                                  <div style={{ width: '100%', height: 4, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        width: `${Math.min(100, Math.max(0, currentQuota.dailyPercent))}%`,
                                        height: '100%',
                                        background: accentColor,
                                        borderRadius: 2,
                                        transition: 'width 0.3s ease',
                                      }}
                                    />
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 10.5,
                                      color: themeTokens.textSecondary,
                                      marginTop: 2,
                                      fontFamily: 'Poppins, sans-serif',
                                      whiteSpace: 'normal',
                                      wordBreak: 'break-word',
                                      lineHeight: '14px',
                                    }}
                                  >
                                    Reset diário: {formatRelativeResetTime(currentQuota.dailyResetTime)}
                                  </div>
                                </div>

                                {/* Weekly Quota */}
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, fontFamily: 'Poppins, sans-serif' }}>
                                    <span style={{ color: themeTokens.textSecondary }}>Limite semanal:</span>
                                    <span style={{ color: themeTokens.textPrimary, fontWeight: 700 }}>
                                      {currentQuota.weeklyPercent}% disponível
                                    </span>
                                  </div>
                                  {/* Accent progress bar */}
                                  <div style={{ width: '100%', height: 4, background: isEffectiveDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)', borderRadius: 2, overflow: 'hidden' }}>
                                    <div
                                      style={{
                                        width: `${Math.min(100, Math.max(0, currentQuota.weeklyPercent))}%`,
                                        height: '100%',
                                        background: accentColor,
                                        borderRadius: 2,
                                        transition: 'width 0.3s ease',
                                      }}
                                    />
                                  </div>
                                  <div
                                    style={{
                                      fontSize: 10.5,
                                      color: themeTokens.textSecondary,
                                      marginTop: 2,
                                      fontFamily: 'Poppins, sans-serif',
                                      whiteSpace: 'normal',
                                      wordBreak: 'break-word',
                                      lineHeight: '14px',
                                    }}
                                  >
                                    Reset semanal: {formatRelativeResetTime(currentQuota.weeklyResetTime)}
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* Circular Send Button */}
                      <button
                        type="submit"
                        disabled={isAiExecuting || !askPrompt.trim()}
                        style={{
                          width: 24,
                          height: 24,
                          background: askPrompt.trim() && !isAiExecuting ? chatAccentColor : (isEffectiveDark ? '#333333' : '#e2e8f0'),
                          borderRadius: 61,
                          border: 'none',
                          outline: 'none',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: askPrompt.trim() && !isAiExecuting ? getContrastTextColor(chatAccentColor) : (isEffectiveDark ? '#666666' : '#94a3b8'),
                          cursor: askPrompt.trim() && !isAiExecuting ? 'pointer' : 'default',
                          flexShrink: 0,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <ArrowRight size={13} strokeWidth={2.5} color={askPrompt.trim() && !isAiExecuting ? getContrastTextColor(chatAccentColor) : (isEffectiveDark ? '#666666' : '#94a3b8')} />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            );
          })()}
              </div>
            </>
          )}
        </div>
      ) : (
        /* Empty container for other tabs as requested */
        <div style={{ alignSelf: 'stretch', flex: '1 1 0', background: 'black', borderRadius: 10, border: 'none' }} />
      )}

      {/* ============================================================ */}
      {/* 3. BOTTOM STATUS BAR (RESPONSIVE NO-WRAP LAYOUT)             */}
      {/* ============================================================ */}
      {showStatusBar && !isZenMode && (
        <div
          style={{
            alignSelf: 'stretch',
            justifyContent: 'space-between',
            alignItems: 'center',
            display: 'inline-flex',
            flexShrink: 0,
            whiteSpace: 'nowrap',
            gap: 5,
          }}
        >
        {/* Left Segment: Branch + Status + Sprint + Issues */}
        <div style={{ justifyContent: 'flex-start', alignItems: 'center', gap: 5, display: 'flex', flexShrink: 0, whiteSpace: 'nowrap' }}>
          <div style={{ justifyContent: 'flex-start', alignItems: 'flex-start', display: 'flex', flexShrink: 0 }}>
            {/* Accent Left Indicator Block */}
            <div
              style={{
                width: 38,
                alignSelf: 'stretch',
                background: accentColor,
                borderTopLeftRadius: 10,
                borderBottomLeftRadius: 10,
                border: 'none',
                justifyContent: 'center',
                alignItems: 'center',
                display: 'flex',
                flexShrink: 0,
              }}
            >
              <TerminalIcon size={16} color={accentTextColor} />
            </div>

            {/* Status Card Left */}
            <div
              style={{
                padding: 5,
                background: themeTokens.bgCard,
                border: 'none',
                borderLeft: 'none',
                borderTopRightRadius: 10,
                borderBottomRightRadius: 10,
                justifyContent: 'center',
                alignItems: 'center',
                gap: 5,
                display: 'flex',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}
            >
              <div
                onClick={() => {
                  refreshGitBranches();
                  setIsBranchModalOpen(true);
                }}
                title="Gerenciar Branches e Git"
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  borderRadius: 5,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 6,
                  display: 'flex',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <GitBranch size={13} color={themeTokens.textSecondary} />
                <div style={{ color: themeTokens.textSecondary, fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap', maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {gitRepoName.split('/').pop() || 'ainaobra'}
                </div>
                <div style={{ color: accentColor, fontSize: 12, fontFamily: 'Poppins', fontWeight: '500', whiteSpace: 'nowrap', maxWidth: 100, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {currentBranch || 'main'}
                </div>
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSyncGit();
                  }}
                  title="Sincronizar com GitHub (Pull & Push)"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    cursor: 'pointer',
                    padding: 2,
                    borderRadius: 3,
                  }}
                >
                  <RefreshCw
                    size={12}
                    color={accentColor}
                    style={{
                      animation: isSyncingGit ? 'spin 1s linear infinite' : 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ width: 1, height: 16, background: themeTokens.border, flexShrink: 0 }} />

              <div
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  borderRadius: 5,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 6,
                  display: 'flex',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <XCircle size={13} color={themeTokens.textSecondary} />
                <div style={{ color: themeTokens.textSecondary, fontSize: 12, fontFamily: 'Poppins', fontWeight: '400' }}>0</div>
                <span style={{ color: themeTokens.textSecondary, fontSize: 12, fontFamily: 'Poppins', fontWeight: '400' }}>0</span>
              </div>
            </div>
          </div>

          {/* Sprint & Issues Card */}
          <div
            style={{
              padding: 5,
              background: themeTokens.bgCard,
              borderRadius: 10,
              border: `1px solid ${themeTokens.border}`,
              justifyContent: 'center',
              alignItems: 'center',
              gap: 5,
              display: 'flex',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <div style={{ alignSelf: 'stretch', justifyContent: 'flex-start', alignItems: 'center', gap: 5, display: 'flex', whiteSpace: 'nowrap' }}>
              <div
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  borderRadius: 5,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 5,
                  display: 'flex',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                <div style={{ color: themeTokens.textSecondary, fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>Sprint 2 -</div>
                <div style={{ color: accentColor, fontSize: 12, fontFamily: 'Poppins', fontWeight: '500', whiteSpace: 'nowrap' }}>7 days</div>
              </div>

              <div style={{ width: 1, height: 16, background: themeTokens.border, flexShrink: 0 }} />

              <div
                onClick={() => {
                  refreshGitHubIssues();
                  setIsIssuesModalOpen(true);
                }}
                title="Abrir Issues do GitHub"
                style={{
                  paddingLeft: 10,
                  paddingRight: 10,
                  paddingTop: 5,
                  paddingBottom: 5,
                  borderRadius: 5,
                  border: 'none',
                  justifyContent: 'center',
                  alignItems: 'center',
                  gap: 5,
                  display: 'flex',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                  cursor: 'pointer',
                  transition: 'background 0.15s ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)')}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <div style={{ color: themeTokens.textSecondary, fontSize: 12, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>Issues</div>
                <div style={{ color: accentColor, fontSize: 12, fontFamily: 'Poppins', fontWeight: '500', whiteSpace: 'nowrap' }}>
                  {gitIssues.length > 0 ? `${gitIssues.length} abertas` : '12 remming'}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Segment: Position Info + Accent "Ai na obra" Button */}
        <div
          style={{
            background: themeTokens.bgCard,
            overflow: 'hidden',
            borderRadius: 10,
            border: `1px solid ${themeTokens.border}`,
            justifyContent: 'center',
            alignItems: 'center',
            display: 'flex',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              paddingLeft: 12,
              paddingRight: 12,
              paddingTop: 8,
              paddingBottom: 8,
              borderRadius: 5,
              border: 'none',
              justifyContent: 'center',
              alignItems: 'center',
              gap: 8,
              display: 'flex',
              whiteSpace: 'nowrap',
            }}
          >
            <div style={{ color: themeTokens.textSecondary, fontSize: 11.5, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>
              Walancy (3 months ago)
            </div>
            <div style={{ color: isEffectiveDark ? '#666666' : '#999999', fontSize: 11.5, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>Ln 21, Col 13</div>
            <div style={{ color: isEffectiveDark ? '#666666' : '#999999', fontSize: 11.5, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>Spaces: 2</div>
            <div style={{ color: isEffectiveDark ? '#666666' : '#999999', fontSize: 11.5, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>UTF-8</div>
            <div style={{ color: isEffectiveDark ? '#666666' : '#999999', fontSize: 11.5, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>LF</div>
            <div style={{ color: isEffectiveDark ? '#666666' : '#999999', fontSize: 11.5, fontFamily: 'Poppins', fontWeight: '400', whiteSpace: 'nowrap' }}>TypeScript</div>
          </div>

          {/* Solid Accent Block "Ai na obra" */}
          <div
            style={{
              alignSelf: 'stretch',
              paddingLeft: 14,
              paddingRight: 14,
              background: accentColor,
              border: 'none',
              justifyContent: 'flex-start',
              alignItems: 'center',
              gap: 6,
              display: 'flex',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              flexShrink: 0,
            }}
          >
            <div style={{ color: accentTextColor, fontSize: 12, fontFamily: 'Poppins', fontWeight: '600', whiteSpace: 'nowrap' }}>Ai na obra</div>
            <TerminalIcon size={14} color={accentTextColor} />
          </div>
        </div>
      </div>
    )}

        {/* Global Toast Notification (Auto-dismisses & click to dismiss) */}
        {toastMessage && (
          <div
            onClick={() => setToastMessage(null)}
            title="Clique para fechar notificação"
            style={{
              position: 'fixed',
              bottom: 40,
              right: 25,
              background: themeTokens.bgCardSecondary,
              color: themeTokens.textPrimary,
              padding: '8px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontFamily: 'Poppins, sans-serif',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
              border: 'none',
              zIndex: 99999,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              cursor: 'pointer',
              animation: 'fadeIn 0.2s ease',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor, flexShrink: 0 }} />
            <span style={{ maxWidth: 360, lineHeight: '16px' }}>{toastMessage}</span>
            <X size={12} color={themeTokens.textSecondary} style={{ marginLeft: 6, flexShrink: 0 }} />
          </div>
        )}

        {/* Floating Zen Mode Escape Chip */}
        {isZenMode && (
          <div
            onClick={() => setIsZenMode(false)}
            title="Sair do Modo Zen (ou pressione Esc)"
            style={{
              position: 'fixed',
              top: 10,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 999999,
              background: themeTokens.bgCardSecondary,
              border: `1px solid ${accentColor}`,
              borderRadius: 20,
              padding: '5px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 7,
              cursor: 'pointer',
              boxShadow: `0 4px 16px ${hexToRgba(accentColor, 0.35)}`,
              color: themeTokens.textPrimary,
              fontSize: 12,
              fontFamily: 'Poppins, sans-serif',
              transition: 'all 0.15s ease',
            }}
          >
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: accentColor }} />
            <span>Sair do Modo Zen</span>
            <span style={{ fontSize: 10, opacity: 0.7, marginLeft: 2 }}>(Esc)</span>
          </div>
        )}

        {/* Quick Open / Command Palette Modal (VS Code & Antigravity Style) */}
        {isQuickOpenOpen && (
          <>
            {/* Click-outside transparent/dim backdrop */}
            <div
              onClick={() => setIsQuickOpenOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.45)',
                zIndex: 999998,
              }}
            />

            {/* Quick Open Floating Box */}
            <div
              ref={quickOpenContainerRef}
              style={{
                position: 'fixed',
                top: quickInputPosition === 'top' ? 46 : '16%',
                left: '50%',
                transform: 'translateX(-50%)',
                width: 620,
                maxWidth: 'calc(100vw - 32px)',
                background: themeTokens.bgCard,
                border: `1px solid ${themeTokens.border}`,
                borderRadius: 6,
                boxShadow: '0 16px 40px rgba(0, 0, 0, 0.85)',
                zIndex: 999999,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxSizing: 'border-box',
                animation: 'fadeIn 0.12s ease-out',
              }}
            >
              {/* Top Input Bar */}
              <div style={{ padding: '6px 8px', background: themeTokens.bgCard }}>
                <div
                  style={{
                    background: themeTokens.bgApp,
                    border: `1px solid ${accentColor}`,
                    borderRadius: 2,
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px 8px',
                    gap: 6,
                  }}
                >
                  <input
                    ref={quickOpenInputRef}
                    type="text"
                    value={quickOpenQuery}
                    onChange={(e) => {
                      setQuickOpenQuery(e.target.value);
                      setQuickOpenSelectedIndex(0);
                    }}
                    onKeyDown={handleQuickOpenKeyDown}
                    placeholder="Search files by name (append : to go to line or @ to go to symbol)"
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      outline: 'none',
                      color: themeTokens.textPrimary,
                      fontSize: 13,
                      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Poppins, sans-serif',
                    }}
                  />
                </div>
              </div>

              {/* Items List */}
              <div
                style={{
                  maxHeight: 380,
                  overflowY: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '2px 4px 6px 4px',
                }}
              >
                {visibleQuickOpenItems.length === 0 ? (
                  <div style={{ padding: '12px 14px', color: themeTokens.textSecondary, fontSize: 12.5, textAlign: 'center' }}>
                    Nenhum arquivo ou comando correspondente encontrado
                  </div>
                ) : (
                  visibleQuickOpenItems.map((item, idx) => {
                    const isSelected = idx === quickOpenSelectedIndex;
                    return (
                      <React.Fragment key={item.id}>
                        {item.isDividerBefore && (
                          <div
                            style={{
                              height: 1,
                              background: themeTokens.border,
                              margin: '4px 6px',
                            }}
                          />
                        )}
                        <div
                          onClick={() => item.onSelect()}
                          onMouseEnter={() => setQuickOpenSelectedIndex(idx)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '4px 8px',
                            borderRadius: 3,
                            cursor: 'pointer',
                            background: isSelected ? hexToRgba(accentColor, 0.18) : 'transparent',
                            color: isSelected ? accentColor : themeTokens.textPrimary,
                            fontSize: 13,
                            minHeight: 26,
                            transition: 'background 0.08s ease',
                          }}
                        >
                          {/* Left side: Icon + Title + Suffix + Subtitle */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                            {item.icon && <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>{item.icon}</div>}
                            <span
                              style={{
                                fontWeight: isSelected ? 500 : 400,
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                color: isSelected ? accentColor : themeTokens.textPrimary,
                              }}
                            >
                              {item.title}
                            </span>
                            {item.suffix && (
                              <span style={{ color: themeTokens.textSecondary, fontSize: 12, marginLeft: 2 }}>{item.suffix}</span>
                            )}
                            {item.subtitle && (
                              <span style={{ color: themeTokens.textSecondary, fontSize: 11.5, marginLeft: 6, whiteSpace: 'nowrap' }}>
                                {item.subtitle}
                              </span>
                            )}
                          </div>

                          {/* Right side: Badges or Category label */}
                          <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0, marginLeft: 12 }}>
                            {item.badgeText && (
                              <span style={{ color: item.badgeTextColor || accentColor, fontSize: 12, fontFamily: 'sans-serif' }}>
                                {item.badgeText}
                              </span>
                            )}
                            {item.badges && item.badges.length > 0 && (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                                {item.badges.map((b, bIdx) => (
                                  <KbdBadge key={bIdx}>{b}</KbdBadge>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </React.Fragment>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}

        {/* Settings & Appearance Modal (VS Code & Antigravity Style) */}
        {isSettingsModalOpen && (
          <>
            {/* Backdrop */}
            <div
              onClick={() => setIsSettingsModalOpen(false)}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0, 0, 0, 0.65)',
                zIndex: 999998,
                backdropFilter: 'blur(3px)',
              }}
            />

            {/* Modal Dialog */}
            <div
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 760,
                maxWidth: 'calc(100vw - 32px)',
                height: 540,
                maxHeight: 'calc(100vh - 48px)',
                background: themeTokens.bgCard,
                border: `1px solid ${themeTokens.border}`,
                borderRadius: 10,
                boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75)',
                zIndex: 999999,
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
                boxSizing: 'border-box',
                animation: 'fadeIn 0.15s ease-out',
                color: themeTokens.textPrimary,
                fontFamily: 'Poppins, -apple-system, sans-serif',
              }}
            >
              {/* Header */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '12px 18px',
                  borderBottom: `1px solid ${themeTokens.border}`,
                  background: themeTokens.bgApp,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                  <Settings size={18} color={accentColor} />
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>
                    Configurações & Estilização do Sistema
                  </span>
                </div>
                <div
                  onClick={() => setIsSettingsModalOpen(false)}
                  style={{
                    width: 26,
                    height: 26,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    borderRadius: 4,
                    cursor: 'pointer',
                    color: themeTokens.textSecondary,
                    transition: 'background 0.15s ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  title="Fechar (Esc)"
                >
                  <X size={16} />
                </div>
              </div>

              {/* Body */}
              <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
                {/* Left Sidebar Tabs */}
                <div
                  style={{
                    width: 200,
                    flexShrink: 0,
                    background: themeTokens.bgApp,
                    borderRight: `1px solid ${themeTokens.border}`,
                    padding: '12px 8px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 4,
                  }}
                >
                  {[
                    { id: 'appearance', label: 'Estilização & Temas', icon: <Palette size={15} /> },
                    { id: 'editor', label: 'Configurações Editor', icon: <Code size={15} /> },
                    { id: 'shortcuts', label: 'Atalhos de Teclado', icon: <Keyboard size={15} /> },
                    { id: 'extensions', label: 'Extensões & Status', icon: <Blocks size={15} /> },
                  ].map((tab) => {
                    const active = settingsActiveTab === tab.id;
                    return (
                      <div
                        key={tab.id}
                        onClick={() => setSettingsActiveTab(tab.id as any)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 9,
                          padding: '8px 12px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 12.5,
                          fontWeight: active ? 600 : 400,
                          color: active ? themeTokens.textPrimary : themeTokens.textSecondary,
                          background: active ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.07)') : 'transparent',
                          borderLeft: active ? `3px solid ${accentColor}` : '3px solid transparent',
                          transition: 'all 0.12s ease',
                        }}
                      >
                        <div style={{ color: active ? accentColor : 'inherit' }}>{tab.icon}</div>
                        <span>{tab.label}</span>
                      </div>
                    );
                  })}
                </div>

                {/* Right Content Pane */}
                <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 24 }}>
                  {/* TAB 1: APPEARANCE */}
                  {settingsActiveTab === 'appearance' && (
                    <>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Tema de Exibição</div>
                        <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 14 }}>
                          Alterne entre os modos escuro, claro ou sincronizado com o sistema operacional.
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
                          {[
                            { id: 'dark', label: 'Dark', desc: 'Modo escuro imersivo', icon: <Moon size={18} /> },
                            { id: 'light', label: 'Light', desc: 'Modo claro clean', icon: <Sun size={18} /> },
                            { id: 'system', label: 'Sistema', desc: 'Segue o sistema do SO', icon: <Monitor size={18} /> },
                          ].map((t) => {
                            const isSelected = themeMode === t.id;
                            return (
                              <div
                                key={t.id}
                                onClick={() => setThemeMode(t.id as any)}
                                style={{
                                  padding: '14px 12px',
                                  borderRadius: 8,
                                  cursor: 'pointer',
                                  border: isSelected ? `2px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                                  background: isSelected ? (isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)') : 'transparent',
                                  display: 'flex',
                                  flexDirection: 'column',
                                  gap: 6,
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <div style={{ color: isSelected ? accentColor : 'inherit' }}>{t.icon}</div>
                                  <div
                                    style={{
                                      width: 14,
                                      height: 14,
                                      borderRadius: '50%',
                                      border: isSelected ? `4px solid ${accentColor}` : `2px solid ${themeTokens.textSecondary}`,
                                      background: isSelected ? accentColor : 'transparent',
                                    }}
                                  />
                                </div>
                                <div style={{ fontSize: 13, fontWeight: 600, color: themeTokens.textPrimary }}>{t.label}</div>
                                <div style={{ fontSize: 11, color: themeTokens.textSecondary }}>{t.desc}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Accent Color Selection */}
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Cor Principal de Destaque (Accent Color)</div>
                        <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 14 }}>
                          A cor escolhida é aplicada aos botões principais, abas ativas, tags, bordas e destaques da IDE.
                        </div>

                        {/* Presets */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 14 }}>
                          {[
                            { name: 'Laranja DevFlow', color: '#FF6A00' },
                            { name: 'Azul VS Code', color: '#007ACC' },
                            { name: 'Verde Esmeralda', color: '#10B981' },
                            { name: 'Roxo Ultraviolet', color: '#8B5CF6' },
                            { name: 'Vermelho Coral', color: '#EF4444' },
                            { name: 'Dourado Solar', color: '#F59E0B' },
                            { name: 'Ciano Elétrico', color: '#06B6D4' },
                            { name: 'Rosa Magenta', color: '#EC4899' },
                          ].map((c) => {
                            const isSelected = accentColor.toUpperCase() === c.color.toUpperCase();
                            return (
                              <div
                                key={c.color}
                                onClick={() => setAccentColor(c.color)}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 7,
                                  padding: '6px 12px',
                                  borderRadius: 20,
                                  cursor: 'pointer',
                                  border: isSelected ? `2px solid ${c.color}` : `1px solid ${themeTokens.border}`,
                                  background: isSelected ? hexToRgba(c.color, 0.12) : 'transparent',
                                  transition: 'all 0.15s ease',
                                }}
                              >
                                <span style={{ width: 14, height: 14, borderRadius: '50%', background: c.color, flexShrink: 0 }} />
                                <span style={{ fontSize: 12, fontWeight: isSelected ? 600 : 400, color: themeTokens.textPrimary }}>{c.name}</span>
                                {isSelected && <Check size={12} color={c.color} />}
                              </div>
                            );
                          })}
                        </div>

                        {/* Custom Color Picker */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 14 }}>
                          <span style={{ fontSize: 11, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                            Cor Personalizada
                          </span>
                          <div style={{ maxWidth: 300 }}>
                            <DevFlowColorPicker
                              color={accentColor}
                              onChange={setAccentColor}
                              isDark={isEffectiveDark}
                            />
                          </div>
                        </div>

                        {/* Option: Sincronizar cor da div de chat com a IA ativa */}
                        <div
                          style={{
                            marginTop: 18,
                            padding: '12px 14px',
                            borderRadius: 8,
                            background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                            border: 'none',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span style={{ fontSize: 13, fontWeight: 600, color: themeTokens.textPrimary }}>
                                Cor da IA no Chat
                              </span>
                              <span
                                style={{
                                  fontSize: 10,
                                  fontWeight: 600,
                                  padding: '2px 7px',
                                  borderRadius: 4,
                                  background: hexToRgba(AI_BRAND_COLORS[selectedAiProvider] || accentColor, 0.18),
                                  color: AI_BRAND_COLORS[selectedAiProvider] || accentColor,
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <span style={{ width: 6, height: 6, borderRadius: '50%', background: AI_BRAND_COLORS[selectedAiProvider] || accentColor }} />
                                {AI_PROVIDERS.find((p) => p.id === selectedAiProvider)?.name} ({AI_BRAND_COLORS[selectedAiProvider] || accentColor})
                              </span>
                            </div>
                            <span style={{ fontSize: 11.5, color: themeTokens.textSecondary }}>
                              Aplica dinamicamente a cor da IA selecionada ao degradê do chat: Claude (#FF8B67), Antigravity (#69C2FD), Codex (#8975B9), Gemini (#589EFF).
                            </span>
                          </div>
                          <MiniSwitch
                            checked={useAiChatThemeColor}
                            onChange={() => setUseAiChatThemeColor(!useAiChatThemeColor)}
                            accentColor={AI_BRAND_COLORS[selectedAiProvider] || accentColor}
                          />
                        </div>
                      </div>
                    </>
                  )}

                  {/* TAB 2: EDITOR */}
                  {settingsActiveTab === 'editor' && (
                    <>
                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Tamanho da Fonte (Font Size)</div>
                        <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 10 }}>
                          Ajusta a escala tipográfica do editor de código Monaco.
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {[12, 13, 14, 15, 16, 18].map((size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setEditorFontSize(size)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: 6,
                                border: editorFontSize === size ? `2px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                                background: editorFontSize === size ? hexToRgba(accentColor, 0.15) : 'transparent',
                                color: editorFontSize === size ? accentColor : themeTokens.textPrimary,
                                fontSize: 12,
                                fontWeight: editorFontSize === size ? 600 : 400,
                                cursor: 'pointer',
                              }}
                            >
                              {size}px
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Tamanho da Tabulação (Tab Size)</div>
                        <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 10 }}>
                          Número de espaços inseridos ao pressionar a tecla Tab.
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          {[2, 4].map((size) => (
                            <button
                              key={size}
                              type="button"
                              onClick={() => setEditorTabSize(size)}
                              style={{
                                padding: '6px 14px',
                                borderRadius: 6,
                                border: editorTabSize === size ? `2px solid ${accentColor}` : `1px solid ${themeTokens.border}`,
                                background: editorTabSize === size ? hexToRgba(accentColor, 0.15) : 'transparent',
                                color: editorTabSize === size ? accentColor : themeTokens.textPrimary,
                                fontSize: 12,
                                fontWeight: editorTabSize === size ? 600 : 400,
                                cursor: 'pointer',
                              }}
                            >
                              {size} espaços
                            </button>
                          ))}
                        </div>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${themeTokens.border}` }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: themeTokens.textPrimary }}>Quebra Automática de Linha (Word Wrap)</div>
                            <div style={{ fontSize: 11.5, color: themeTokens.textSecondary }}>Quebra linhas longas sem necessidade de rolagem horizontal</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditorWordWrap(!editorWordWrap)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 6,
                              background: editorWordWrap ? accentColor : (isEffectiveDark ? '#333' : '#ccc'),
                              color: '#ffffff',
                              border: 'none',
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {editorWordWrap ? 'Ativado' : 'Desativado'}
                          </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0', borderBottom: `1px solid ${themeTokens.border}` }}>
                          <div>
                            <div style={{ fontSize: 13, fontWeight: 600, color: themeTokens.textPrimary }}>Minimapa de Código (Minimap)</div>
                            <div style={{ fontSize: 11.5, color: themeTokens.textSecondary }}>Exibe a visão geral em miniatura do arquivo no lado direito</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setEditorMinimap(!editorMinimap)}
                            style={{
                              padding: '5px 12px',
                              borderRadius: 6,
                              background: editorMinimap ? accentColor : (isEffectiveDark ? '#333' : '#ccc'),
                              color: '#ffffff',
                              border: 'none',
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: 'pointer',
                            }}
                          >
                            {editorMinimap ? 'Visível' : 'Oculto'}
                          </button>
                        </div>
                      </div>
                    </>
                  )}

                  {/* TAB 3: SHORTCUTS */}
                  {settingsActiveTab === 'shortcuts' && (
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Atalhos de Teclado Principais</div>
                      <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 14 }}>
                        Guia de atalhos rápidos disponíveis na interface estilo Antigravity / VS Code.
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {[
                          { action: 'Quick Open (Abrir Arquivo)', keys: ['⌘', 'P'] },
                          { action: 'Command Palette (Executar Comandos)', keys: ['⇧', '⌘', 'P'] },
                          { action: 'Abrir Configurações do Sistema', keys: ['⌘', ','] },
                          { action: 'Alternar Barra Lateral (Explorer)', keys: ['⌘', 'B'] },
                          { action: 'Alternar Painel Inferior (Terminal)', keys: ['⌘', 'J'] },
                          { action: 'Alternar Painel Lateral de IA', keys: ['⇧', '⌘', 'A'] },
                          { action: 'Modo Tela Cheia (Fullscreen)', keys: ['⌘', 'F'] },
                          { action: 'Modo Zen (Foco Limpo)', keys: ['⌘', 'K', 'Z'] },
                          { action: 'Salvar Arquivo Ativo', keys: ['⌘', 'S'] },
                          { action: 'Abrir Gerenciador de Extensões', keys: ['⇧', '⌘', 'X'] },
                        ].map((s, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '8px 12px',
                              borderRadius: 6,
                              background: isEffectiveDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.03)',
                              border: `1px solid ${themeTokens.border}`,
                            }}
                          >
                            <span style={{ fontSize: 12.5, color: themeTokens.textPrimary }}>{s.action}</span>
                            <div style={{ display: 'flex', gap: 3 }}>
                              {s.keys.map((k, kIdx) => (
                                <KbdBadge key={kIdx}>{k}</KbdBadge>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* TAB 4: EXTENSIONS */}
                  {settingsActiveTab === 'extensions' && (
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>Extensões & Status do Sistema</div>
                      <div style={{ fontSize: 12, color: themeTokens.textSecondary, marginBottom: 14 }}>
                        Recursos nativos integrados ao DevFlow Desktop.
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {[
                          { name: 'VS Code Material & Symbols Icon Theme', desc: 'Ícones oficiais para mais de 100 formatos de arquivos e pastas', status: 'Ativo' },
                          { name: 'Claude Code Agent CLI', desc: 'Assistente e motor de execução CLI oficial Claude', status: installedClis.claude ? 'Instalado & Pronto' : 'Não instalado' },
                          { name: 'Google Antigravity Agent (AGY)', desc: 'Motor de agentes inteligentes e sub-agentes Antigravity', status: installedClis.antigravity ? 'Instalado & Pronto' : 'Não instalado' },
                          { name: 'Native PTY Terminal Service', desc: 'Sessões de terminal interativo com zsh / bash integrado', status: 'Ativo' },
                          { name: 'Monaco Editor Engine', desc: 'Motor de código de alta performance da Microsoft com LSP', status: 'Ativo' },
                        ].map((ext, idx) => (
                          <div
                            key={idx}
                            style={{
                              padding: '10px 14px',
                              borderRadius: 8,
                              background: themeTokens.bgApp,
                              border: `1px solid ${themeTokens.border}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                            }}
                          >
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600, color: themeTokens.textPrimary }}>{ext.name}</div>
                              <div style={{ fontSize: 11.5, color: themeTokens.textSecondary }}>{ext.desc}</div>
                            </div>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: 4,
                                fontSize: 11,
                                fontWeight: 600,
                                background: ext.status.includes('Ativo') || ext.status.includes('Pronto') ? hexToRgba(accentColor, 0.15) : (isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)'),
                                color: ext.status.includes('Ativo') || ext.status.includes('Pronto') ? accentColor : themeTokens.textSecondary,
                              }}
                            >
                              {ext.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}

        {/* ======================================================= */}
        {/* MINIMALIST DRAGGABLE THEME POPUP (Tema & Aparência)     */}
        {/* ======================================================= */}
        {isThemePopupOpen && (
          <div
            style={{
              position: 'fixed',
              left: themePopupPos.x,
              top: themePopupPos.y,
              width: 320,
              background: themeTokens.bgCard,
              borderRadius: 12,
              border: 'none',
              boxShadow: '0 18px 45px rgba(0, 0, 0, 0.5)',
              zIndex: 999999,
              display: 'flex',
              flexDirection: 'column',
              boxSizing: 'border-box',
              userSelect: isDraggingThemePopup ? 'none' : 'auto',
              fontFamily: 'Poppins, -apple-system, sans-serif',
              backdropFilter: 'blur(16px)',
              overflow: 'hidden',
            }}
          >
            {/* Draggable Header */}
            <div
              onMouseDown={handleThemePopupMouseDown}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '10px 12px',
                borderBottom: 'none',
                background: themeTokens.bgCardSecondary,
                cursor: isDraggingThemePopup ? 'grabbing' : 'grab',
                userSelect: 'none',
              }}
              title="Arraste para reposicionar na tela"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <GripHorizontal size={14} color={themeTokens.textSecondary} style={{ opacity: 0.8 }} />
                <Palette size={14} color={accentColor} />
                <span style={{ fontSize: 12.5, fontWeight: 600, color: themeTokens.textPrimary }}>
                  Tema & Aparência
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                <button
                  type="button"
                  onClick={() => setAccentColor('#FF6A00')}
                  title="Restaurar cor padrão (Laranja DevFlow)"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: themeTokens.textSecondary,
                    cursor: 'pointer',
                    padding: 3,
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 4,
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textPrimary)}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                >
                  <RotateCcw size={13} />
                </button>
                <button
                  type="button"
                  onClick={() => setIsThemePopupOpen(false)}
                  title="Fechar (Esc)"
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: themeTokens.textSecondary,
                    cursor: 'pointer',
                    padding: 3,
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: 4,
                  }}
                  onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.color = '#ff5f56')}
                  onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.color = themeTokens.textSecondary)}
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Content Body */}
            <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 13, maxHeight: 'calc(88vh - 40px)', overflowY: 'auto' }}>
              {/* Section 1: Modo de Tema */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 }}>
                  Modo de Exibição
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6 }}>
                  {[
                    { id: 'dark', label: 'Dark', icon: <Moon size={13} /> },
                    { id: 'light', label: 'Light', icon: <Sun size={13} /> },
                    { id: 'system', label: 'Sistema', icon: <Monitor size={13} /> },
                  ].map((m) => {
                    const isSelected = themeMode === m.id;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setThemeMode(m.id as any)}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          padding: '7px 8px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          fontSize: 11.5,
                          fontWeight: isSelected ? 600 : 400,
                          border: 'none',
                          background: isSelected ? hexToRgba(accentColor, 0.18) : (isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)'),
                          color: isSelected ? (isEffectiveDark ? '#ffffff' : accentColor) : themeTokens.textPrimary,
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span style={{ color: isSelected ? accentColor : themeTokens.textSecondary }}>{m.icon}</span>
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 2: Cor de Destaque (Presets) */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 }}>
                  Cor de Destaque
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {[
                    { name: 'Laranja', color: '#FF6A00' },
                    { name: 'Azul', color: '#007ACC' },
                    { name: 'Esmeralda', color: '#10B981' },
                    { name: 'Roxo', color: '#8B5CF6' },
                    { name: 'Vermelho', color: '#EF4444' },
                    { name: 'Dourado', color: '#F59E0B' },
                    { name: 'Ciano', color: '#06B6D4' },
                    { name: 'Magenta', color: '#EC4899' },
                  ].map((c) => {
                    const isSelected = accentColor.toUpperCase() === c.color.toUpperCase();
                    return (
                      <button
                        key={c.color}
                        type="button"
                        onClick={() => setAccentColor(c.color)}
                        title={c.name}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 5,
                          padding: '5px 4px',
                          borderRadius: 6,
                          cursor: 'pointer',
                          border: 'none',
                          background: isSelected ? hexToRgba(c.color, 0.16) : (isEffectiveDark ? 'rgba(255, 255, 255, 0.03)' : 'rgba(0, 0, 0, 0.03)'),
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <span
                          style={{
                            width: 13,
                            height: 13,
                            borderRadius: '50%',
                            background: c.color,
                            flexShrink: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: isSelected ? `0 0 8px ${c.color}` : 'none',
                          }}
                        >
                          {isSelected && <Check size={8} color={getContrastTextColor(c.color)} strokeWidth={3} />}
                        </span>
                        <span style={{ fontSize: 10.5, color: themeTokens.textPrimary, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {c.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Section 3: Custom Stylized Color Picker */}
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: themeTokens.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 7 }}>
                  Cor Personalizada
                </div>
                <DevFlowColorPicker
                  color={accentColor}
                  onChange={setAccentColor}
                  isDark={isEffectiveDark}
                />
              </div>

              {/* Section 4: Sincronizar Cor do Chat com a IA */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '9px 10px',
                  borderRadius: 8,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                  border: 'none',
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 600, color: themeTokens.textPrimary }}>
                      Cor da IA no Chat
                    </span>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: AI_BRAND_COLORS[selectedAiProvider] || accentColor,
                        boxShadow: `0 0 6px ${AI_BRAND_COLORS[selectedAiProvider] || accentColor}`,
                      }}
                      title={`Cor ativa da IA: ${AI_BRAND_COLORS[selectedAiProvider] || accentColor}`}
                    />
                  </div>
                  <span style={{ fontSize: 9.5, color: themeTokens.textSecondary }}>
                    Claude (#FF8B67), Antigravity (#69C2FD), Codex (#8975B9), Gemini (#589EFF)
                  </span>
                </div>
                <MiniSwitch
                  checked={useAiChatThemeColor}
                  onChange={() => setUseAiChatThemeColor(!useAiChatThemeColor)}
                  accentColor={AI_BRAND_COLORS[selectedAiProvider] || accentColor}
                />
              </div>

              {/* Subtle footer tip */}
              <div style={{ fontSize: 9.5, color: themeTokens.textSecondary, textAlign: 'center', opacity: 0.65 }}>
                Arraste pelo cabeçalho • Atualização em tempo real
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* GIT BRANCH MANAGER MODAL                                                  */}
        {/* ========================================================================= */}
        {isBranchModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: 20,
            }}
            onClick={() => setIsBranchModalOpen(false)}
          >
            <div
              style={{
                width: 540,
                maxWidth: '92vw',
                maxHeight: '80vh',
                background: isEffectiveDark ? '#141416' : '#ffffff',
                borderRadius: 14,
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
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
                      background: 'rgba(255, 139, 103, 0.12)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <GitBranch size={17} color={accentColor} />
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14, color: themeTokens.textPrimary }}>
                      Gerenciador de Branches
                    </div>
                    <div style={{ fontSize: 11, color: themeTokens.textSecondary }}>
                      {gitRepoName || 'ainaobra'} • Ativa: <span style={{ color: accentColor, fontWeight: 500 }}>{currentBranch}</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <button
                    onClick={handleSyncGit}
                    disabled={isSyncingGit}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      background: 'rgba(255, 255, 255, 0.06)',
                      border: 'none',
                      borderRadius: 6,
                      padding: '5px 10px',
                      fontSize: 11.5,
                      color: themeTokens.textPrimary,
                      cursor: isSyncingGit ? 'not-allowed' : 'pointer',
                    }}
                    title="Git Pull & Push"
                  >
                    <RefreshCw
                      size={12}
                      color={accentColor}
                      style={{ animation: isSyncingGit ? 'spin 1s linear infinite' : 'none' }}
                    />
                    {isSyncingGit ? 'Sincronizando...' : 'Sync'}
                  </button>
                  <button
                    onClick={() => setIsBranchModalOpen(false)}
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

              {/* Create new branch section */}
              <div
                style={{
                  padding: '12px 18px',
                  borderBottom: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)'}`,
                  background: isEffectiveDark ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.015)',
                  display: 'flex',
                  gap: 8,
                }}
              >
                <input
                  type="text"
                  placeholder="Nome da nova branch (ex: feat/minha-feature)..."
                  value={newBranchInput}
                  onChange={(e) => setNewBranchInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newBranchInput.trim()) {
                      handleCreateBranch(newBranchInput);
                    }
                  }}
                  style={{
                    flex: 1,
                    background: isEffectiveDark ? '#1a1a1e' : '#f4f4f5',
                    border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'}`,
                    borderRadius: 7,
                    padding: '6px 12px',
                    fontSize: 12,
                    color: themeTokens.textPrimary,
                    outline: 'none',
                  }}
                />
                <button
                  onClick={() => handleCreateBranch(newBranchInput)}
                  disabled={!newBranchInput.trim() || isCreatingBranch}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: accentColor,
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: 7,
                    padding: '6px 12px',
                    fontSize: 12,
                    fontWeight: 500,
                    cursor: newBranchInput.trim() ? 'pointer' : 'not-allowed',
                    opacity: newBranchInput.trim() ? 1 : 0.5,
                  }}
                >
                  <Plus size={14} />
                  Criar Branch
                </button>
              </div>

              {/* Search branches */}
              <div style={{ padding: '10px 18px 6px' }}>
                <input
                  type="text"
                  placeholder="Filtrar branches..."
                  value={branchSearchQuery}
                  onChange={(e) => setBranchSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    background: isEffectiveDark ? '#18181b' : '#f9fafb',
                    border: `1px solid ${isEffectiveDark ? 'rgba(255, 255, 255, 0.07)' : 'rgba(0, 0, 0, 0.07)'}`,
                    borderRadius: 6,
                    padding: '6px 10px',
                    fontSize: 11.5,
                    color: themeTokens.textPrimary,
                    outline: 'none',
                  }}
                />
              </div>

              {/* Branches list */}
              <div
                style={{
                  flex: 1,
                  overflowY: 'auto',
                  padding: '6px 12px 14px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 3,
                }}
              >
                {branchesList
                  .filter((b) => b.name.toLowerCase().includes(branchSearchQuery.toLowerCase()))
                  .map((branch, idx) => {
                    const isCur = branch.isCurrent || branch.name === currentBranch;
                    return (
                      <div
                        key={idx}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          padding: '7px 10px',
                          borderRadius: 8,
                          background: isCur
                            ? 'rgba(255, 139, 103, 0.1)'
                            : 'transparent',
                          transition: 'background 0.15s ease',
                          fontSize: 12.5,
                        }}
                        onMouseEnter={(e) => {
                          if (!isCur) e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)';
                        }}
                        onMouseLeave={(e) => {
                          if (!isCur) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, overflow: 'hidden' }}>
                          <GitBranch size={14} color={isCur ? accentColor : themeTokens.textSecondary} />
                          <span style={{ fontWeight: isCur ? 600 : 400, color: isCur ? accentColor : themeTokens.textPrimary }}>
                            {branch.name}
                          </span>
                          {branch.isRemote && (
                            <span style={{ fontSize: 10, padding: '1px 5px', borderRadius: 4, background: 'rgba(255, 255, 255, 0.06)', color: themeTokens.textSecondary }}>
                              remote
                            </span>
                          )}
                        </div>

                        {isCur ? (
                          <div
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: 4,
                              color: '#22c55e',
                              fontSize: 11,
                              fontWeight: 600,
                            }}
                          >
                            <Check size={13} />
                            Atual
                          </div>
                        ) : (
                          <button
                            onClick={() => handleCheckoutBranch(branch.name)}
                            style={{
                              background: isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)',
                              border: 'none',
                              borderRadius: 5,
                              padding: '4px 10px',
                              fontSize: 11,
                              fontWeight: 500,
                              color: themeTokens.textPrimary,
                              cursor: 'pointer',
                              transition: 'background 0.15s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = accentColor)}
                            onMouseLeave={(e) => (e.currentTarget.style.background = isEffectiveDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.06)')}
                          >
                            Checkout
                          </button>
                        )}
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* GITHUB ISSUES MODAL                                                       */}
        {/* ========================================================================= */}
        {isIssuesModalOpen && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0, 0, 0, 0.65)',
              backdropFilter: 'blur(6px)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 9999,
              padding: 20,
            }}
            onClick={() => setIsIssuesModalOpen(false)}
          >
            <div
              style={{
                width: 680,
                maxWidth: '92vw',
                maxHeight: '82vh',
                background: isEffectiveDark ? '#141416' : '#ffffff',
                borderRadius: 14,
                boxShadow: '0 25px 60px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.08)',
                display: 'flex',
                flexDirection: 'column',
                overflow: 'hidden',
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
                    onClick={refreshGitHubIssues}
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
                    onClick={() => setIsIssuesModalOpen(false)}
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
                          handleCreateIssue(newIssueTitle);
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
                      onClick={() => handleCreateIssue(newIssueTitle)}
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
                      (issue.author && issue.author.toLowerCase().includes(q))
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
                              aberta por {issue.author || 'walancy'}
                            </div>
                          </div>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                          <button
                            onClick={() => handleLinkIssueToChat(issue)}
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
                            onClick={() => handleOpenIssueInBrowser(issue.number)}
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
        )}
      </div>
  );
};
export default App;