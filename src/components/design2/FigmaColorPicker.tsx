import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  X,
  Plus,
  Pipette,
  Square,
  ChevronDown,
  Image as ImageIcon,
  Video,
  Grid,
  Droplet,
  Trash2,
  GripVertical,
} from 'lucide-react';
import ScrubbableNumberInput from './ScrubbableNumberInput';
import type { FillItem, GradientStop } from './types';
import { cssGradient, defaultGradientStops, sortStops } from './gradient';

interface FigmaColorPickerProps {
  color: string; // e.g. '#D9D9D9' or '#000000'
  opacity: number; // 0 to 1
  themeTokens?: any;
  accentColor?: string;
  onChange: (hex: string, opacity: number) => void;
  onClose: () => void;
  /** Tipo do preenchimento em edição e dados do gradiente (quando linear/radial) */
  fillType?: FillItem['type'];
  gradientStops?: GradientStop[];
  gradientAngle?: number;
  /** Mudanças de tipo, paradas ou ângulo do gradiente */
  onGradientChange?: (patch: { type?: FillItem['type']; gradientStops?: GradientStop[]; gradientAngle?: number }) => void;
}

// Utilitários de conversão de cores HSV <-> RGB <-> Hex
function hexToRgb(hex: string): { r: number; g: number; b: number } {
  let clean = hex.replace('#', '').trim();
  if (clean.length === 3) {
    clean = clean.split('').map((c) => c + c).join('');
  }
  const num = parseInt(clean, 16);
  if (isNaN(num) || clean.length < 6) return { r: 217, g: 217, b: 217 };
  return {
    r: (num >> 16) & 255,
    g: (num >> 8) & 255,
    b: num & 255,
  };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toHex = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0').toUpperCase();
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function rgbToHsv(r: number, g: number, b: number): { h: number; s: number; v: number } {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }
  return { h: h * 360, s, v };
}

function hsvToRgb(h: number, s: number, v: number): { r: number; g: number; b: number } {
  h = (h % 360) / 60;
  const i = Math.floor(h);
  const f = h - i;
  const p = v * (1 - s);
  const q = v * (1 - s * f);
  const t = v * (1 - s * (1 - f));

  let r = 0, g = 0, b = 0;
  switch (i) {
    case 0: r = v; g = t; b = p; break;
    case 1: r = q; g = v; b = p; break;
    case 2: r = p; g = v; b = t; break;
    case 3: r = p; g = q; b = v; break;
    case 4: r = t; g = p; b = v; break;
    default: r = v; g = p; b = q; break;
  }
  return {
    r: Math.round(r * 255),
    g: Math.round(g * 255),
    b: Math.round(b * 255),
  };
}

const DOCUMENT_PALETTE = [
  '#FFFFFF', '#F97316', '#4B5563', '#1F2937', '#111827', '#9CA3AF', '#0D99FF',
  '#000000', '#374151', '#4B5563', '#1E293B', '#0284C7', '#FFFFFF', '#18181B',
  '#27272A', '#E5E7EB', '#000000', '#FFFFFF', '#EF4444', '#10B981', '#3B82F6',
  '#3B82F6', '#000000', '#FFFFFF', '#2563EB', '#22C55E', '#FFFFFF', '#78350F',
];

export default function FigmaColorPicker({
  color,
  opacity,
  themeTokens,
  accentColor = '#007acc',
  onChange,
  onClose,
  fillType: fillTypeProp,
  gradientStops,
  gradientAngle = 90,
  onGradientChange,
}: FigmaColorPickerProps) {
  const [tab, setTab] = useState<'custom' | 'libraries'>('custom');
  const [fillType, setFillTypeState] = useState<string>(fillTypeProp || 'solid');
  const [activeStop, setActiveStop] = useState(0);
  const isGradientMode = (fillType === 'linear' || fillType === 'radial' || fillType === 'angular' || fillType === 'diamond') && Boolean(gradientStops && gradientStops.length >= 2 && onGradientChange);
  const stops = gradientStops || [];
  const gradientBarRef = useRef<HTMLDivElement>(null);

  // Troca o tipo: ao entrar em gradiente cria as paradas a partir da cor atual
  const setFillType = (next: string) => {
    setFillTypeState(next);
    if (!onGradientChange) return;
    if (next === 'linear' || next === 'radial' || next === 'angular' || next === 'diamond') {
      onGradientChange({
        type: next,
        gradientStops: stops.length >= 2 ? stops : defaultGradientStops(color, opacity),
        gradientAngle,
      });
      setActiveStop(0);
    } else if (next === 'solid') {
      onGradientChange({ type: 'solid' });
    }
  };
  const [format, setFormat] = useState<'Hex' | 'RGB' | 'HSL'>('Hex');

  const textPrimary = themeTokens?.textPrimary || '#ffffff';
  const textSecondary = themeTokens?.textSecondary || '#888888';
  const bgElevated = themeTokens?.bgCardElevated || '#1f1f1f';
  const bgSecondary = themeTokens?.bgCardSecondary || '#161616';
  const bgCard = themeTokens?.bgCard || '#101010';
  const divider = themeTokens?.borderSubtle && themeTokens.borderSubtle !== 'transparent'
    ? themeTokens.borderSubtle
    : 'rgba(255, 255, 255, 0.08)';

  const rgb = hexToRgb(color);
  const initialHsv = rgbToHsv(rgb.r, rgb.g, rgb.b);

  const [hue, setHue] = useState<number>(initialHsv.h || 0);
  const [sat, setSat] = useState<number>(initialHsv.s);
  const [val, setVal] = useState<number>(initialHsv.v);
  const [alpha, setAlpha] = useState<number>(opacity ?? 1);

  const satValRef = useRef<HTMLDivElement>(null);
  const isDraggingSatVal = useRef(false);
  const isDraggingHue = useRef(false);
  const isDraggingAlpha = useRef(false);

  // Atualiza cor externa quando HSV/Alpha mudam
  const emitChange = useCallback((h: number, s: number, v: number, a: number) => {
    const { r, g, b } = hsvToRgb(h, s, v);
    const hex = rgbToHex(r, g, b);
    if (isGradientMode) {
      // No modo gradiente os controles de cor editam a parada selecionada
      onGradientChange!({ gradientStops: stops.map((st, i) => (i === activeStop ? { ...st, color: hex, opacity: a } : st)) });
      return;
    }
    onChange(hex, a);
  }, [onChange, isGradientMode, onGradientChange, stops, activeStop]);

  // Ao trocar a parada selecionada, os controles passam a mostrar a cor dela
  useEffect(() => {
    if (!isGradientMode) return;
    const st = stops[Math.min(activeStop, stops.length - 1)];
    if (!st) return;
    const c = hexToRgb(st.color);
    const hsv = rgbToHsv(c.r, c.g, c.b);
    setHue(hsv.h || 0);
    setSat(hsv.s);
    setVal(hsv.v);
    setAlpha(st.opacity);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStop, isGradientMode]);

  // Manipulação da área 2D de saturação e brilho
  const handleSatValMove = useCallback((e: MouseEvent | React.MouseEvent) => {
    if (!satValRef.current) return;
    const rect = satValRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const y = Math.max(0, Math.min(rect.height, e.clientY - rect.top));
    const nextSat = x / rect.width;
    const nextVal = 1 - y / rect.height;
    setSat(nextSat);
    setVal(nextVal);
    emitChange(hue, nextSat, nextVal, alpha);
  }, [hue, alpha, emitChange]);

  const handleHueMove = useCallback((e: MouseEvent | React.MouseEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const nextHue = (x / rect.width) * 360;
    setHue(nextHue);
    emitChange(nextHue, sat, val, alpha);
  }, [sat, val, alpha, emitChange]);

  const handleAlphaMove = useCallback((e: MouseEvent | React.MouseEvent, el: HTMLElement) => {
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left));
    const nextAlpha = Math.round((x / rect.width) * 100) / 100;
    setAlpha(nextAlpha);
    emitChange(hue, sat, val, nextAlpha);
  }, [hue, sat, val, emitChange]);

  // Suporte ao EyeDropper
  const handleEyeDropper = async () => {
    if ('EyeDropper' in window) {
      try {
        const eyeDropper = new (window as any).EyeDropper();
        const result = await eyeDropper.open();
        if (result?.sRGBHex) {
          const pickedRgb = hexToRgb(result.sRGBHex);
          const pickedHsv = rgbToHsv(pickedRgb.r, pickedRgb.g, pickedRgb.b);
          setHue(pickedHsv.h);
          setSat(pickedHsv.s);
          setVal(pickedHsv.v);
          emitChange(pickedHsv.h, pickedHsv.s, pickedHsv.v, alpha);
        }
      } catch (err) {
        // cancelado
      }
    }
  };

  // Posicionamento arrastável dentro do container pai (div do centro)
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{ startMouseX: number; startMouseY: number; startPosX: number; startPosY: number } | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Fechar com Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    e.preventDefault();

    const pickerEl = pickerRef.current;
    if (!pickerEl) return;
    const parentEl = pickerEl.parentElement;
    const parentRect = parentEl
      ? parentEl.getBoundingClientRect()
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const pickerRect = pickerEl.getBoundingClientRect();

    const currentX = pickerRect.left - parentRect.left;
    const currentY = pickerRect.top - parentRect.top;

    dragStartRef.current = {
      startMouseX: e.clientX,
      startMouseY: e.clientY,
      startPosX: currentX,
      startPosY: currentY,
    };
    setIsDragging(true);

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.startMouseX;
      const dy = moveEvent.clientY - dragStartRef.current.startMouseY;
      const parentW = parentEl?.clientWidth || window.innerWidth;
      const parentH = parentEl?.clientHeight || window.innerHeight;
      const maxX = Math.max(10, parentW - pickerRect.width - 10);
      const maxY = Math.max(10, parentH - pickerRect.height - 10);

      const nextX = Math.max(10, Math.min(maxX, dragStartRef.current.startPosX + dx));
      const nextY = Math.max(10, Math.min(maxY, dragStartRef.current.startPosY + dy));

      setPos({ x: nextX, y: nextY });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      dragStartRef.current = null;
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const pureHueColor = `hsl(${hue}, 100%, 50%)`;
  const currentHexClean = color.replace('#', '').toUpperCase();

  return (
    <div
      ref={pickerRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        ...(pos ? { left: pos.x, top: pos.y } : { top: 24, right: 24 }),
        width: 250,
        background: bgElevated,
        borderRadius: 10,
        border: `1px solid ${divider}`,
        boxShadow: '0 16px 48px rgba(0,0,0,0.65), 0 2px 10px rgba(0,0,0,0.3)',
        color: textPrimary,
        fontSize: 11,
        fontFamily: "'Poppins', -apple-system, sans-serif",
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        userSelect: 'none',
      }}
    >
      {/* ----------------------------------------------------------------- */}
      {/* HEADER: TABS + DRAG HANDLE + ACTIONS                              */}
      {/* ----------------------------------------------------------------- */}
      <div
        onMouseDown={handleHeaderMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 10px',
          borderBottom: `1px solid ${divider}`,
          cursor: isDragging ? 'grabbing' : 'grab',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', background: bgSecondary, borderRadius: 6, padding: 2 }}>
          <button
            type="button"
            onClick={() => setTab('custom')}
            style={{
              background: tab === 'custom' ? bgCard : 'transparent',
              color: tab === 'custom' ? textPrimary : textSecondary,
              border: 'none',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Custom
          </button>
          <button
            type="button"
            onClick={() => setTab('libraries')}
            style={{
              background: tab === 'libraries' ? bgCard : 'transparent',
              color: tab === 'libraries' ? textPrimary : textSecondary,
              border: 'none',
              borderRadius: 4,
              padding: '2px 8px',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Libraries
          </button>
        </div>

        {/* Drag handle icon */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: textSecondary,
            opacity: 0.5,
            cursor: isDragging ? 'grabbing' : 'grab',
          }}
          title="Arraste para mover o seletor"
        >
          <GripVertical size={13} />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            type="button"
            style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 2, display: 'flex' }}
            title="Criar estilo de cor"
          >
            <Plus size={13} />
          </button>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 2, display: 'flex' }}
            title="Fechar seletor"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* TIPOS DE PREENCHIMENTO                                            */}
      {/* ----------------------------------------------------------------- */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 10px',
          borderBottom: `1px solid ${divider}`,
          color: textSecondary,
        }}
      >
        <button
          type="button"
          onClick={() => setFillType('solid')}
          style={{
            background: fillType === 'solid' ? `${accentColor}22` : 'transparent',
            border: 'none',
            borderRadius: 4,
            color: fillType === 'solid' ? accentColor : textSecondary,
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
          title="Cor sólida"
        >
          <Square size={13} />
        </button>
        <button
          type="button"
          onClick={() => setFillType('linear')}
          style={{
            background: fillType === 'linear' ? `${accentColor}22` : 'transparent',
            border: 'none',
            borderRadius: 4,
            color: fillType === 'linear' ? accentColor : textSecondary,
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
          title="Gradiente linear"
        >
          <span style={{ fontSize: 11, fontWeight: 700 }}>▨</span>
        </button>
        <button
          type="button"
          onClick={() => setFillType('radial')}
          style={{
            background: fillType === 'radial' ? `${accentColor}22` : 'transparent',
            border: 'none',
            borderRadius: 4,
            color: fillType === 'radial' ? accentColor : textSecondary,
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
          title="Gradiente radial"
        >
          <span style={{ fontSize: 11, fontWeight: 700 }}>◎</span>
        </button>
        <button
          type="button"
          onClick={() => setFillType('angular')}
          style={{ background: fillType === 'angular' ? `${accentColor}22` : 'transparent', border: 'none', borderRadius: 4, color: fillType === 'angular' ? accentColor : textSecondary, cursor: 'pointer', padding: 4, display: 'flex' }}
          title="Gradiente angular"
        >
          <span style={{ fontSize: 11, fontWeight: 700 }}>◐</span>
        </button>
        <button
          type="button"
          onClick={() => setFillType('diamond')}
          style={{ background: fillType === 'diamond' ? `${accentColor}22` : 'transparent', border: 'none', borderRadius: 4, color: fillType === 'diamond' ? accentColor : textSecondary, cursor: 'pointer', padding: 4, display: 'flex' }}
          title="Gradiente diamante"
        >
          <span style={{ fontSize: 11, fontWeight: 700 }}>◇</span>
        </button>
        <button
          type="button"
          onClick={() => setFillType('image')}
          style={{
            background: fillType === 'image' ? `${accentColor}22` : 'transparent',
            border: 'none',
            borderRadius: 4,
            color: fillType === 'image' ? accentColor : textSecondary,
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
          title="Imagem"
        >
          <ImageIcon size={13} />
        </button>
        <button
          type="button"
          onClick={() => setFillType('video')}
          style={{
            background: fillType === 'video' ? `${accentColor}22` : 'transparent',
            border: 'none',
            borderRadius: 4,
            color: fillType === 'video' ? accentColor : textSecondary,
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
          }}
          title="Vídeo"
        >
          <Video size={13} />
        </button>
        <button
          type="button"
          style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 4, display: 'flex' }}
          title="Padrão"
        >
          <Grid size={13} />
        </button>
        <button
          type="button"
          style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 4, display: 'flex' }}
          title="Modo de mesclagem"
        >
          <Droplet size={13} />
        </button>
        <button
          type="button"
          onClick={() => {
            onChange('none', 0);
            onClose();
          }}
          style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 4, display: 'flex' }}
          title="Remover preenchimento"
        >
          <Trash2 size={13} />
        </button>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* EDITOR DE GRADIENTE (linear/radial)                                */}
      {/* ----------------------------------------------------------------- */}
      {isGradientMode && (
        <div style={{ padding: '10px 10px 0 10px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div
            ref={gradientBarRef}
            title="Clique na barra para adicionar uma parada"
            onMouseDown={(e) => {
              if (e.target !== e.currentTarget) return;
              const rect = e.currentTarget.getBoundingClientRect();
              const position = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
              const near = sortStops(stops).reduce((a, b) => (Math.abs(b.position - position) < Math.abs(a.position - position) ? b : a));
              const next = [...stops, { position: Math.round(position * 100) / 100, color: near.color, opacity: near.opacity }];
              onGradientChange!({ gradientStops: next });
              setActiveStop(next.length - 1);
            }}
            style={{
              position: 'relative',
              height: 18,
              borderRadius: 4,
              cursor: 'copy',
              backgroundImage: `${cssGradient({ type: 'linear', gradientStops: stops }, 90)}, repeating-conic-gradient(#888 0% 25%, #444 0% 50%)`,
              backgroundSize: '100% 100%, 8px 8px',
            }}
          >
            {stops.map((st, i) => (
              <div
                key={i}
                onMouseDown={(e) => {
                  e.stopPropagation();
                  setActiveStop(i);
                  const bar = gradientBarRef.current;
                  if (!bar) return;
                  const onMove = (ev: MouseEvent) => {
                    const rect = bar.getBoundingClientRect();
                    const position = Math.round(Math.max(0, Math.min(1, (ev.clientX - rect.left) / rect.width)) * 100) / 100;
                    onGradientChange!({ gradientStops: stops.map((x, k) => (k === i ? { ...x, position } : x)) });
                  };
                  const onUp = () => {
                    window.removeEventListener('mousemove', onMove);
                    window.removeEventListener('mouseup', onUp);
                  };
                  window.addEventListener('mousemove', onMove);
                  window.addEventListener('mouseup', onUp);
                }}
                style={{
                  position: 'absolute',
                  top: -3,
                  left: `calc(${st.position * 100}% - 6px)`,
                  width: 12,
                  height: 24,
                  borderRadius: 3,
                  background: st.color,
                  border: `2px solid ${i === activeStop ? accentColor : '#ffffff'}`,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.5)',
                  cursor: 'ew-resize',
                  boxSizing: 'border-box',
                }}
              />
            ))}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
            {(fillType === 'linear' || fillType === 'angular') && (
              <label style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: textSecondary }}>
                Ângulo
                <ScrubbableNumberInput
                  value={gradientAngle}
                  onChange={(v: number) => onGradientChange!({ gradientAngle: Math.round(v) })}
                  min={-360}
                  max={360}
                  suffix="°"
                  style={{ width: 62, height: 22 }}
                />
              </label>
            )}
            <span style={{ flex: 1 }} />
            <button
              type="button"
              disabled={stops.length <= 2}
              onClick={() => {
                onGradientChange!({ gradientStops: stops.filter((_, i) => i !== activeStop) });
                setActiveStop(0);
              }}
              title="Remover parada selecionada"
              style={{ background: 'transparent', border: 'none', color: stops.length <= 2 ? `${textSecondary}55` : textSecondary, cursor: stops.length <= 2 ? 'not-allowed' : 'pointer', padding: 3, display: 'flex' }}
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>
      )}

      {/* ----------------------------------------------------------------- */}
      {/* GRADIENTE 2D SATURAÇÃO & BRILHO                                    */}
      {/* ----------------------------------------------------------------- */}
      <div style={{ padding: '10px 10px 6px 10px' }}>
        <div
          ref={satValRef}
          onMouseDown={(e) => {
            isDraggingSatVal.current = true;
            handleSatValMove(e);
            const onMove = (ev: MouseEvent) => isDraggingSatVal.current && handleSatValMove(ev);
            const onUp = () => {
              isDraggingSatVal.current = false;
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
          }}
          style={{
            position: 'relative',
            width: '100%',
            height: 140,
            borderRadius: 6,
            backgroundColor: pureHueColor,
            backgroundImage: `
              linear-gradient(to top, #000000, transparent),
              linear-gradient(to right, #FFFFFF, transparent)
            `,
            cursor: 'crosshair',
            overflow: 'hidden',
          }}
        >
          {/* Indicador circular */}
          <div
            style={{
              position: 'absolute',
              left: `${sat * 100}%`,
              top: `${(1 - val) * 100}%`,
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: '2px solid #ffffff',
              boxShadow: '0 0 2px rgba(0,0,0,0.8), inset 0 0 2px rgba(0,0,0,0.8)',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
            }}
          />
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* CONTROLES: CONTA-GOTAS + HUE + ALFA                               */}
      {/* ----------------------------------------------------------------- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px 8px 10px' }}>
        <button
          type="button"
          onClick={handleEyeDropper}
          style={{
            background: 'transparent',
            border: 'none',
            color: textSecondary,
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            borderRadius: 4,
          }}
          title="Conta-gotas"
        >
          <Pipette size={14} />
        </button>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          {/* Barra de Hue */}
          <div
            onMouseDown={(e) => {
              isDraggingHue.current = true;
              const el = e.currentTarget;
              handleHueMove(e, el);
              const onMove = (ev: MouseEvent) => isDraggingHue.current && handleHueMove(ev, el);
              const onUp = () => {
                isDraggingHue.current = false;
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            style={{
              position: 'relative',
              width: '100%',
              height: 10,
              borderRadius: 5,
              background: 'linear-gradient(to right, #ff0000 0%, #ffff00 17%, #00ff00 33%, #00ffff 50%, #0000ff 67%, #ff00ff 83%, #ff0000 100%)',
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: `${(hue / 360) * 100}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                border: '1.5px solid #ffffff',
                pointerEvents: 'none',
              }}
            />
          </div>

          {/* Barra de Opacidade */}
          <div
            onMouseDown={(e) => {
              isDraggingAlpha.current = true;
              const el = e.currentTarget;
              handleAlphaMove(e, el);
              const onMove = (ev: MouseEvent) => isDraggingAlpha.current && handleAlphaMove(ev, el);
              const onUp = () => {
                isDraggingAlpha.current = false;
                window.removeEventListener('mousemove', onMove);
                window.removeEventListener('mouseup', onUp);
              };
              window.addEventListener('mousemove', onMove);
              window.addEventListener('mouseup', onUp);
            }}
            style={{
              position: 'relative',
              width: '100%',
              height: 10,
              borderRadius: 5,
              background: `linear-gradient(to right, transparent, ${color}), repeating-conic-gradient(#333 0% 25%, #222 0% 50%) 50% / 8px 8px`,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: `${alpha * 100}%`,
                top: '50%',
                transform: 'translate(-50%, -50%)',
                width: 12,
                height: 12,
                borderRadius: '50%',
                background: '#ffffff',
                boxShadow: '0 1px 3px rgba(0,0,0,0.5)',
                border: '1.5px solid #ffffff',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* INPUTS: FORMATO + VALOR + OPACIDADE                               */}
      {/* ----------------------------------------------------------------- */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 10px 10px 10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 2,
            background: bgSecondary,
            borderRadius: 6,
            padding: '2px 6px',
            height: 24,
            cursor: 'pointer',
          }}
        >
          <span style={{ fontSize: 10, color: textSecondary }}>{format}</span>
          <ChevronDown size={10} color={textSecondary} />
        </div>

        <div
          style={{
            flex: 1,
            display: 'flex',
            alignItems: 'center',
            background: bgSecondary,
            borderRadius: 6,
            padding: '2px 6px',
            height: 24,
          }}
        >
          <input
            type="text"
            value={currentHexClean}
            onChange={(e) => {
              const valClean = e.target.value.trim().toUpperCase();
              if (valClean.length <= 6) {
                const newRgb = hexToRgb(valClean);
                const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b);
                setHue(newHsv.h);
                setSat(newHsv.s);
                setVal(newHsv.v);
                onChange(`#${valClean}`, alpha);
              }
            }}
            style={{
              width: '100%',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: textPrimary,
              fontSize: 11,
              fontFamily: 'monospace',
            }}
          />
        </div>

        <ScrubbableNumberInput
          value={Math.round(alpha * 100)}
          min={0}
          max={100}
          suffix="%"
          onChange={(val) => {
            const nextAlpha = Math.max(0, Math.min(100, val)) / 100;
            setAlpha(nextAlpha);
            emitChange(hue, sat, val, nextAlpha);
          }}
          themeTokens={themeTokens}
          accentColor={accentColor}
          isEffectiveDark={true}
          style={{ width: 48, height: 24, borderRadius: 6, padding: '0 4px', background: bgSecondary }}
          inputStyle={{ textAlign: 'right' }}
        />
      </div>

      {/* ----------------------------------------------------------------- */}
      {/* PALETA DE CORES DO SISTEMA                                        */}
      {/* ----------------------------------------------------------------- */}
      <div style={{ padding: '8px 10px', borderTop: `1px solid ${divider}` }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, cursor: 'pointer' }}>
            <span style={{ fontSize: 11, fontWeight: 500, color: textPrimary }}>On this page</span>
            <ChevronDown size={11} color={textSecondary} />
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(7, 1fr)',
            gap: 6,
          }}
        >
          {DOCUMENT_PALETTE.map((hex, i) => (
            <div
              key={`${hex}-${i}`}
              onClick={() => {
                const palRgb = hexToRgb(hex);
                const palHsv = rgbToHsv(palRgb.r, palRgb.g, palRgb.b);
                setHue(palHsv.h);
                setSat(palHsv.s);
                setVal(palHsv.v);
                emitChange(palHsv.h, palHsv.s, palHsv.v, alpha);
              }}
              style={{
                width: 22,
                height: 22,
                borderRadius: 4,
                backgroundColor: hex,
                border: '1px solid rgba(255, 255, 255, 0.1)',
                cursor: 'pointer',
                transition: 'transform 0.1s ease',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.15)')}
              onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
              title={hex}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
