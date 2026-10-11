import React, { useState, useRef, useEffect } from 'react';
import { X, FlipHorizontal, GripVertical } from 'lucide-react';
import { Shape } from './types';
import { WIDTH_PROFILE_LABEL, type WidthProfile } from './widthProfile';
import ScrubbableNumberInput from './ScrubbableNumberInput';

interface FigmaStrokeSettingsModalProps {
  shape: Shape;
  themeTokens?: any;
  accentColor?: string;
  isEffectiveDark?: boolean;
  onChange: (patch: Partial<Shape>) => void;
  onClose: () => void;
}

export default function FigmaStrokeSettingsModal({
  shape,
  themeTokens,
  accentColor = '#007acc',
  isEffectiveDark = true,
  onChange,
  onClose,
}: FigmaStrokeSettingsModalProps) {
  const [tab, setTab] = useState<'basic' | 'dynamic' | 'brush'>('basic');
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const bgElevated = themeTokens?.bgCard || (isEffectiveDark ? '#1e1e1e' : '#ffffff');
  const bgSecondary = themeTokens?.bgSecondary || (isEffectiveDark ? '#2a2a2a' : '#f0f0f0');
  const bgCard = themeTokens?.bgPrimary || (isEffectiveDark ? '#141414' : '#e4e4e4');
  const textPrimary = themeTokens?.textPrimary || (isEffectiveDark ? '#ffffff' : '#111111');
  const textSecondary = themeTokens?.textSecondary || (isEffectiveDark ? '#888888' : '#666666');
  const textMuted = themeTokens?.textMuted || (isEffectiveDark ? '#555555' : '#999999');
  const divider = themeTokens?.borderSubtle && themeTokens.borderSubtle !== 'transparent'
    ? themeTokens.borderSubtle
    : (isEffectiveDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.08)');

  // Fechar ao pressionar Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Arrastar pelo cabeçalho
  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    if ((e.target as HTMLElement).closest('button, input, select')) return;
    e.preventDefault();

    const modalEl = modalRef.current;
    if (!modalEl) return;
    const parentEl = modalEl.parentElement;
    const parentRect = parentEl
      ? parentEl.getBoundingClientRect()
      : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const modalRect = modalEl.getBoundingClientRect();

    const currentX = modalRect.left - parentRect.left;
    const currentY = modalRect.top - parentRect.top;

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
      const maxX = Math.max(10, parentW - modalRect.width - 10);
      const maxY = Math.max(10, parentH - modalRect.height - 10);

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

  const inputStyle: React.CSSProperties = {
    background: bgSecondary,
    border: '1px solid transparent',
    borderRadius: 5,
    height: 26,
    display: 'flex',
    alignItems: 'center',
    padding: '0 8px',
    boxSizing: 'border-box',
  };

  return (
    <div
      ref={modalRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        ...(pos ? { left: pos.x, top: pos.y } : { top: 80, right: 24 }),
        width: 250,
        background: bgElevated,
        border: `1px solid ${divider}`,
        borderRadius: 8,
        boxShadow: '0 14px 40px rgba(0, 0, 0, 0.55)',
        padding: 12,
        zIndex: 180,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      {/* Cabeçalho arrastável */}
      <div
        onMouseDown={handleHeaderMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: isDragging ? 'grabbing' : 'grab',
          paddingBottom: 4,
          borderBottom: `1px solid ${divider}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <GripVertical size={13} color={textMuted} />
          <span style={{ fontSize: 12, fontWeight: 600, color: textPrimary }}>Stroke settings</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: textSecondary,
            cursor: 'pointer',
            padding: 3,
            display: 'flex',
            borderRadius: 4,
          }}
          title="Fechar"
        >
          <X size={13} />
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', background: bgSecondary, borderRadius: 6, padding: 2 }}>
        {(['basic', 'dynamic', 'brush'] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            style={{
              flex: 1,
              background: tab === t ? bgCard : 'transparent',
              color: tab === t ? textPrimary : textSecondary,
              border: 'none',
              borderRadius: 4,
              padding: '4px 0',
              fontSize: 11,
              fontWeight: 500,
              cursor: 'pointer',
              textTransform: 'capitalize',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'basic' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Estilo (Solid / Dashed) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Style</span>
            <div style={{ ...inputStyle, width: 140 }}>
              <select
                value={shape.strokeStyle || 'solid'}
                onChange={(e) => onChange({ strokeStyle: e.target.value as any })}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: textPrimary,
                  fontSize: 11,
                  fontFamily: "'Poppins', sans-serif",
                  cursor: 'pointer',
                }}
              >
                <option value="solid" style={{ background: bgCard, color: textPrimary }}>— Solid</option>
                <option value="dashed" style={{ background: bgCard, color: textPrimary }}>--- Dashed</option>
              </select>
            </div>
          </div>

          {/* Se Dashed, inputs de Dash e Gap */}
          {shape.strokeStyle === 'dashed' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, color: textSecondary }}>Dash / Gap</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, width: 140 }}>
                <ScrubbableNumberInput
                  label="Dash"
                  min={1}
                  value={shape.strokeDash ?? 6}
                  onChange={(val) => onChange({ strokeDash: Math.max(1, val) })}
                  themeTokens={themeTokens}
                  accentColor={accentColor}
                  isEffectiveDark={isEffectiveDark}
                  style={{ flex: 1, height: 26, borderRadius: 5 }}
                />
                <ScrubbableNumberInput
                  label="Gap"
                  min={0}
                  value={shape.strokeGap ?? 6}
                  onChange={(val) => onChange({ strokeGap: Math.max(0, val) })}
                  themeTokens={themeTokens}
                  accentColor={accentColor}
                  isEffectiveDark={isEffectiveDark}
                  style={{ flex: 1, height: 26, borderRadius: 5 }}
                />
              </div>
            </div>
          )}

          {shape.strokeStyle === 'dashed' && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
              <span style={{ fontSize: 11, color: textSecondary }}>Padrão</span>
              <input
                defaultValue={shape.strokeDashArray || ''}
                placeholder="ex.: 8 4 2 4"
                title="Números separados por espaço: traço, vão, traço, vão… (vazio usa Dash / Gap)"
                onKeyDown={(e) => e.stopPropagation()}
                onBlur={(e) => onChange({ strokeDashArray: e.target.value.trim() || undefined })}
                style={{ ...inputStyle, width: 140, color: textPrimary, fontSize: 11, border: 'none', outline: 'none' }}
              />
            </div>
          )}

          {/* Width profile: vale para caminhos (caneta/lápis) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Width profile</span>
            <div style={{ ...inputStyle, width: 140, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <select
                value={shape.widthProfile || 'uniform'}
                disabled={shape.type !== 'pen' && shape.type !== 'pencil'}
                title={shape.type === 'pen' || shape.type === 'pencil' ? 'Perfil de largura do traço' : 'Só para caminhos (caneta/lápis)'}
                onChange={(e) => onChange({ widthProfile: e.target.value === 'uniform' ? undefined : (e.target.value as WidthProfile) })}
                style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', color: textPrimary, fontSize: 11, cursor: 'pointer', outline: 'none' }}
              >
                {(Object.keys(WIDTH_PROFILE_LABEL) as WidthProfile[]).map((k) => <option key={k} value={k} style={{ background: bgCard, color: textPrimary }}>{WIDTH_PROFILE_LABEL[k]}</option>)}
              </select>
              <button
                type="button"
                onClick={() => {
                  const flip: Record<string, WidthProfile | undefined> = { 'taper-end': 'taper-start', 'taper-start': 'taper-end' };
                  const next = flip[shape.widthProfile || ''];
                  if (next) onChange({ widthProfile: next });
                }}
                style={{ background: 'transparent', border: 'none', color: textSecondary, cursor: 'pointer', padding: 2, display: 'flex' }}
                title="Inverter perfil"
              >
                <FlipHorizontal size={12} />
              </button>
            </div>
          </div>

          {/* Join */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Join</span>
            <div style={{ display: 'flex', background: bgSecondary, borderRadius: 6, padding: 2, gap: 2 }}>
              {[
                { id: 'miter', icon: '⌝', title: 'Miter' },
                { id: 'bevel', icon: '◿', title: 'Bevel' },
                { id: 'round', icon: '◜', title: 'Round' },
              ].map((j) => (
                <button
                  key={j.id}
                  type="button"
                  onClick={() => onChange({ strokeJoin: j.id as any })}
                  style={{
                    background: (shape.strokeJoin || 'miter') === j.id ? bgCard : 'transparent',
                    color: (shape.strokeJoin || 'miter') === j.id ? accentColor : textSecondary,
                    border: 'none',
                    borderRadius: 4,
                    padding: '3px 10px',
                    fontSize: 12,
                    cursor: 'pointer',
                    transition: 'all 0.12s ease',
                  }}
                  title={j.title}
                >
                  {j.icon}
                </button>
              ))}
            </div>
          </div>

          {/* Miter angle */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Miter angle</span>
            <ScrubbableNumberInput
              label="∠"
              suffix="°"
              value={shape.strokeMiterAngle ?? 28.96}
              min={0}
              step={0.5}
              allowDecimals={true}
              onChange={(val) => onChange({ strokeMiterAngle: val })}
              themeTokens={themeTokens}
              accentColor={accentColor}
              isEffectiveDark={isEffectiveDark}
              style={{ width: 140, height: 26, borderRadius: 5 }}
            />
          </div>

          {/* Position (Inside / Center / Outside) */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 11, color: textSecondary }}>Position</span>
            <div style={{ ...inputStyle, width: 140 }}>
              <select
                value={shape.strokePosition || 'inside'}
                onChange={(e) => onChange({ strokePosition: e.target.value as any })}
                style={{
                  width: '100%',
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: textPrimary,
                  fontSize: 11,
                  fontFamily: "'Poppins', sans-serif",
                  cursor: 'pointer',
                }}
              >
                <option value="inside" style={{ background: bgCard, color: textPrimary }}>Inside</option>
                <option value="center" style={{ background: bgCard, color: textPrimary }}>Center</option>
                <option value="outside" style={{ background: bgCard, color: textPrimary }}>Outside</option>
              </select>
            </div>
          </div>
        </div>
      )}

      {tab === 'dynamic' && (
        <div style={{ padding: '16px 8px', textAlign: 'center', color: textMuted, fontSize: 11 }}>
          Dynamic stroke presets and pressure simulation enabled.
        </div>
      )}

      {tab === 'brush' && (
        <div style={{ padding: '16px 8px', textAlign: 'center', color: textMuted, fontSize: 11 }}>
          Custom vector brush tip textures will be displayed here.
        </div>
      )}
    </div>
  );
}
