import React, { useState, useRef, useEffect } from 'react';
import {
  X,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  ChevronRight,
  ChevronDown,
  List,
  ListOrdered,
} from 'lucide-react';
import { Shape } from './types';
import ScrubbableNumberInput from './ScrubbableNumberInput';

interface FigmaTypeSettingsModalProps {
  shape: Shape;
  themeTokens?: any;
  accentColor?: string;
  isEffectiveDark?: boolean;
  onChange: (patch: Partial<Shape>) => void;
  onClose: () => void;
}

// Ícones SVG estilo Figma
const FigmaTrimCapHeightIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor">
    <line x1="2" y1="2.5" x2="14" y2="2.5" strokeWidth="1.5" strokeLinecap="round" />
    <line x1="2" y1="13.5" x2="14" y2="13.5" strokeWidth="1.5" strokeLinecap="round" />
    <text x="8" y="11" textAnchor="middle" fontSize="8.5" fontWeight="600" fill="currentColor" stroke="none" fontFamily="sans-serif">
      Ag
    </text>
  </svg>
);

const FigmaTrimStandardIcon = () => (
  <svg width="15" height="15" viewBox="0 0 16 16" fill="currentColor">
    <text x="8" y="11.5" textAnchor="middle" fontSize="9" fontWeight="600" fill="currentColor" fontFamily="sans-serif">
      Ag
    </text>
  </svg>
);

export default function FigmaTypeSettingsModal({
  shape,
  themeTokens,
  accentColor = '#0d99ff',
  isEffectiveDark = true,
  onChange,
  onClose,
}: FigmaTypeSettingsModalProps) {
  const [tab, setTab] = useState<'basics' | 'variable'>('basics');
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef<{
    startMouseX: number;
    startMouseY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const bgElevated = themeTokens?.bgCard || (isEffectiveDark ? '#222222' : '#ffffff');
  const bgSecondary = themeTokens?.bgSecondary || (isEffectiveDark ? '#2c2c2c' : '#f0f0f0');
  const bgCard = themeTokens?.bgPrimary || (isEffectiveDark ? '#1a1a1a' : '#e6e6e6');
  const textPrimary = themeTokens?.textPrimary || (isEffectiveDark ? '#ffffff' : '#111111');
  const textSecondary = themeTokens?.textSecondary || (isEffectiveDark ? '#8e8e8e' : '#666666');
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

  // Valores atuais com fallbacks padrão Figma
  const currentFontFamily = shape.fontFamily || 'Inter, sans-serif';
  const currentWeight = typeof shape.fontWeight === 'number' ? shape.fontWeight : (shape.fontWeight === 'Bold' ? 700 : 400);
  const currentSlant = shape.slant ?? 0;
  const currentAlign = shape.textAlign || 'left';
  const currentDecoration = shape.textDecoration || 'none';
  const currentCase = shape.textCase || 'none';
  const currentTrim = shape.verticalTrim || 'standard';
  const currentList = shape.listStyle || 'none';
  const currentParagraphSpacing = shape.paragraphSpacing ?? 0;
  const currentTruncate = shape.textTruncate || 'none';
  const currentWrap = shape.wrapStyle || 'auto';

  // Transformação de texto para o preview
  let previewTextTransform: any = 'none';
  let previewFontVariant: any = 'normal';
  if (currentCase === 'uppercase') previewTextTransform = 'uppercase';
  else if (currentCase === 'lowercase') previewTextTransform = 'lowercase';
  else if (currentCase === 'title') previewTextTransform = 'capitalize';
  else if (currentCase === 'small-caps') previewFontVariant = 'small-caps';

  // Estilo de botões de grupo/segmento
  const getSegmentBtnStyle = (isActive: boolean): React.CSSProperties => ({
    background: isActive ? (isEffectiveDark ? '#383838' : '#e0e0e0') : 'transparent',
    border: 'none',
    borderRadius: 4,
    color: isActive ? textPrimary : textSecondary,
    height: 24,
    minWidth: 26,
    padding: '0 6px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: 11,
    fontWeight: isActive ? 600 : 400,
    transition: 'background 0.15s, color 0.15s',
  });

  const segmentContainerStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    background: bgSecondary,
    borderRadius: 5,
    padding: 2,
    gap: 1,
  };

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: 11,
  };

  return (
    <div
      ref={modalRef}
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        ...(pos ? { left: pos.x, top: pos.y } : { top: 90, right: 268 }),
        width: 254,
        background: bgElevated,
        border: `1px solid ${divider}`,
        borderRadius: 8,
        boxShadow: '0 14px 40px rgba(0, 0, 0, 0.55)',
        padding: 12,
        zIndex: 190,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      {/* Cabeçalho com Abas e Fechar */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button
            onClick={() => setTab('basics')}
            style={{
              background: tab === 'basics' ? (isEffectiveDark ? '#333333' : '#e2e2e2') : 'transparent',
              border: 'none',
              borderRadius: 4,
              color: tab === 'basics' ? textPrimary : textSecondary,
              fontSize: 11,
              fontWeight: 500,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            Basics
          </button>
          <button
            onClick={() => setTab('variable')}
            style={{
              background: tab === 'variable' ? (isEffectiveDark ? '#333333' : '#e2e2e2') : 'transparent',
              border: 'none',
              borderRadius: 4,
              color: tab === 'variable' ? textPrimary : textSecondary,
              fontSize: 11,
              fontWeight: 500,
              padding: '4px 8px',
              cursor: 'pointer',
            }}
          >
            Variable
          </button>
        </div>

        <button
          onClick={onClose}
          title="Fechar"
          style={{
            background: 'none',
            border: 'none',
            color: textSecondary,
            cursor: 'pointer',
            padding: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: 4,
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = textPrimary)}
          onMouseLeave={(e) => (e.currentTarget.style.color = textSecondary)}
        >
          <X size={14} />
        </button>
      </div>

      {/* ===================================================================== */}
      {/* ABA: BASICS (IMAGEM 2)                                                */}
      {/* ===================================================================== */}
      {tab === 'basics' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          {/* Caixa de Preview */}
          <div
            style={{
              background: bgCard,
              border: `1px solid ${divider}`,
              borderRadius: 6,
              height: 100,
              display: 'flex',
              alignItems: 'center',
              justifyContent:
                currentAlign === 'center'
                  ? 'center'
                  : currentAlign === 'right'
                  ? 'flex-end'
                  : 'flex-start',
              padding: '12px 14px',
              overflow: 'hidden',
              boxSizing: 'border-box',
            }}
          >
            <span
              style={{
                fontFamily: currentFontFamily,
                fontWeight: currentWeight,
                fontStyle: currentSlant !== 0 ? `oblique ${currentSlant}deg` : (shape.fontStyle || 'normal'),
                letterSpacing: shape.letterSpacing || 'normal',
                lineHeight: shape.lineHeight && shape.lineHeight !== 'Auto' ? shape.lineHeight : 1.2,
                textDecoration: currentDecoration === 'none' ? 'none' : currentDecoration,
                textTransform: previewTextTransform,
                fontVariant: previewFontVariant,
                textAlign: currentAlign,
                color: textSecondary,
                fontSize: 18,
                maxWidth: '100%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: currentTruncate === 'truncate' ? 'ellipsis' : 'clip',
              }}
            >
              {shape.text && shape.text.length < 30 ? shape.text : 'Preview'}
            </span>
          </div>

          {/* Alignment */}
          <div style={rowStyle}>
            <span style={{ color: textSecondary }}>Alignment</span>
            <div style={segmentContainerStyle}>
              <button
                onClick={() => onChange({ textAlign: 'left' })}
                style={getSegmentBtnStyle(currentAlign === 'left')}
                title="Align left"
              >
                <AlignLeft size={13} />
              </button>
              <button
                onClick={() => onChange({ textAlign: 'center' })}
                style={getSegmentBtnStyle(currentAlign === 'center')}
                title="Align center"
              >
                <AlignCenter size={13} />
              </button>
              <button
                onClick={() => onChange({ textAlign: 'right' })}
                style={getSegmentBtnStyle(currentAlign === 'right')}
                title="Align right"
              >
                <AlignRight size={13} />
              </button>
              <button
                onClick={() => onChange({ textAlign: 'justify' })}
                style={getSegmentBtnStyle(currentAlign === 'justify')}
                title="Justify"
              >
                <AlignJustify size={13} />
              </button>
            </div>
          </div>

          {/* Decoration */}
          <div style={rowStyle}>
            <span style={{ color: textSecondary }}>Decoration</span>
            <div style={segmentContainerStyle}>
              <button
                onClick={() => onChange({ textDecoration: 'none' })}
                style={getSegmentBtnStyle(currentDecoration === 'none')}
                title="None"
              >
                —
              </button>
              <button
                onClick={() => onChange({ textDecoration: 'underline' })}
                style={getSegmentBtnStyle(currentDecoration === 'underline')}
                title="Underline"
              >
                <span style={{ textDecoration: 'underline' }}>U</span>
              </button>
              <button
                onClick={() => onChange({ textDecoration: 'line-through' })}
                style={getSegmentBtnStyle(currentDecoration === 'line-through')}
                title="Strikethrough"
              >
                <span style={{ textDecoration: 'line-through' }}>S</span>
              </button>
              <button
                style={{ ...getSegmentBtnStyle(false), cursor: 'default', opacity: 0.6 }}
                title="More"
              >
                <ChevronRight size={11} />
              </button>
            </div>
          </div>

          {/* Case */}
          <div style={rowStyle}>
            <span style={{ color: textSecondary }}>Case</span>
            <div style={segmentContainerStyle}>
              <button
                onClick={() => onChange({ textCase: 'none' })}
                style={getSegmentBtnStyle(currentCase === 'none')}
                title="Original"
              >
                —
              </button>
              <button
                onClick={() => onChange({ textCase: 'uppercase' })}
                style={getSegmentBtnStyle(currentCase === 'uppercase')}
                title="Uppercase"
              >
                AG
              </button>
              <button
                onClick={() => onChange({ textCase: 'lowercase' })}
                style={getSegmentBtnStyle(currentCase === 'lowercase')}
                title="Lowercase"
              >
                ag
              </button>
              <button
                onClick={() => onChange({ textCase: 'title' })}
                style={getSegmentBtnStyle(currentCase === 'title')}
                title="Title Case"
              >
                Ag
              </button>
              <button
                onClick={() => onChange({ textCase: 'small-caps' })}
                style={getSegmentBtnStyle(currentCase === 'small-caps')}
                title="Small Caps"
              >
                <span style={{ fontVariant: 'small-caps', fontSize: 10 }}>ᴀɢ</span>
              </button>
            </div>
          </div>

          {/* Divisor */}
          <div style={{ height: 1, background: divider, margin: '2px 0' }} />

          {/* Vertical trim */}
          <div style={rowStyle}>
            <span style={{ color: textSecondary }}>Vertical trim</span>
            <div style={segmentContainerStyle}>
              <button
                onClick={() => onChange({ verticalTrim: 'standard' })}
                style={getSegmentBtnStyle(currentTrim === 'standard')}
                title="Standard"
              >
                <FigmaTrimStandardIcon />
              </button>
              <button
                onClick={() => onChange({ verticalTrim: 'cap-height' })}
                style={getSegmentBtnStyle(currentTrim === 'cap-height')}
                title="Cap-height"
              >
                <FigmaTrimCapHeightIcon />
              </button>
            </div>
          </div>

          {/* List style */}
          <div style={rowStyle}>
            <span style={{ color: textSecondary }}>List style</span>
            <div style={segmentContainerStyle}>
              <button
                onClick={() => onChange({ listStyle: 'none' })}
                style={getSegmentBtnStyle(currentList === 'none')}
                title="None"
              >
                —
              </button>
              <button
                onClick={() => onChange({ listStyle: 'bullet' })}
                style={getSegmentBtnStyle(currentList === 'bullet')}
                title="Bullet"
              >
                <List size={13} />
              </button>
              <button
                onClick={() => onChange({ listStyle: 'numbered' })}
                style={getSegmentBtnStyle(currentList === 'numbered')}
                title="Numbered"
              >
                <ListOrdered size={13} />
              </button>
            </div>
          </div>

          {/* Paragraph spacing */}
          <div style={rowStyle}>
            <span style={{ color: textSecondary }}>Paragraph spacing</span>
            <ScrubbableNumberInput
              value={currentParagraphSpacing}
              min={0}
              onChange={(val) => onChange({ paragraphSpacing: Math.max(0, val) })}
              themeTokens={themeTokens}
              accentColor={accentColor}
              isEffectiveDark={isEffectiveDark}
              style={{ width: 58, height: 24, borderRadius: 5 }}
            />
          </div>

          {/* Truncate text */}
          <div style={rowStyle}>
            <span style={{ color: textSecondary }}>Truncate text</span>
            <div style={segmentContainerStyle}>
              <button
                onClick={() => onChange({ textTruncate: 'none' })}
                style={getSegmentBtnStyle(currentTruncate === 'none')}
                title="None"
              >
                —
              </button>
              <button
                onClick={() => onChange({ textTruncate: 'truncate' })}
                style={getSegmentBtnStyle(currentTruncate === 'truncate')}
                title="Truncate text"
              >
                A...
              </button>
            </div>
          </div>

          {/* Wrap style */}
          <div style={rowStyle}>
            <span style={{ color: textSecondary }}>Wrap style</span>
            <div
              style={{
                position: 'relative',
                display: 'flex',
                alignItems: 'center',
                width: 80,
                background: bgSecondary,
                borderRadius: 5,
                height: 24,
                boxSizing: 'border-box',
              }}
            >
              <select
                value={currentWrap}
                onChange={(e) => onChange({ wrapStyle: e.target.value as 'auto' | 'balance' })}
                style={{
                  width: '100%',
                  height: '100%',
                  appearance: 'none',
                  background: 'transparent',
                  border: 'none',
                  color: textPrimary,
                  fontSize: 11,
                  padding: '0 20px 0 8px',
                  cursor: 'pointer',
                  outline: 'none',
                }}
              >
                <option value="auto" style={{ background: bgElevated, color: textPrimary }}>Auto</option>
                <option value="balance" style={{ background: bgElevated, color: textPrimary }}>Balance</option>
              </select>
              <ChevronDown
                size={12}
                color={textSecondary}
                style={{ position: 'absolute', right: 6, pointerEvents: 'none' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* ABA: VARIABLE (IMAGEM 3)                                              */}
      {/* ===================================================================== */}
      {tab === 'variable' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {/* Caixa de Preview Ampla com 3 R's */}
          <div
            style={{
              background: bgCard,
              border: `1px solid ${divider}`,
              borderRadius: 6,
              height: 120,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 28,
              boxSizing: 'border-box',
            }}
          >
            {/* R Thin */}
            <span
              style={{
                fontFamily: currentFontFamily,
                fontWeight: 200,
                fontStyle: currentSlant !== 0 ? `oblique ${currentSlant}deg` : 'normal',
                fontSize: 52,
                color: textPrimary,
                lineHeight: 1,
              }}
            >
              R
            </span>
            {/* R Regular / Current dynamic */}
            <span
              style={{
                fontFamily: currentFontFamily,
                fontWeight: currentWeight,
                fontStyle: currentSlant !== 0 ? `oblique ${currentSlant}deg` : 'normal',
                fontSize: 52,
                color: textPrimary,
                lineHeight: 1,
                transition: 'font-weight 0.1s ease',
              }}
            >
              R
            </span>
            {/* R Bold */}
            <span
              style={{
                fontFamily: currentFontFamily,
                fontWeight: 900,
                fontStyle: currentSlant !== 0 ? `oblique ${currentSlant}deg` : 'normal',
                fontSize: 52,
                color: textPrimary,
                lineHeight: 1,
              }}
            >
              R
            </span>
          </div>

          {/* Slant */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={rowStyle}>
              <span style={{ color: textSecondary }}>Slant</span>
              <ScrubbableNumberInput
                value={currentSlant}
                min={-20}
                max={20}
                onChange={(val) => onChange({ slant: val })}
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ width: 58, height: 24, borderRadius: 5 }}
              />
            </div>

            {/* Slider de Slant */}
            <div style={{ position: 'relative', width: '100%', display: 'flex', alignItems: 'center' }}>
              <input
                type="range"
                min={-20}
                max={20}
                step={1}
                value={currentSlant}
                onChange={(e) => onChange({ slant: parseInt(e.target.value) || 0 })}
                style={{
                  width: '100%',
                  appearance: 'none',
                  background: `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${
                    ((currentSlant + 20) / 40) * 100
                  }%, ${isEffectiveDark ? '#3a3a3a' : '#cccccc'} ${
                    ((currentSlant + 20) / 40) * 100
                  }%, ${isEffectiveDark ? '#3a3a3a' : '#cccccc'} 100%)`,
                  height: 6,
                  borderRadius: 3,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>

          {/* Weight */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={rowStyle}>
              <span style={{ color: textSecondary }}>Weight</span>
              <ScrubbableNumberInput
                value={currentWeight}
                min={100}
                max={900}
                step={100}
                onChange={(val) => onChange({ fontWeight: val })}
                themeTokens={themeTokens}
                accentColor={accentColor}
                isEffectiveDark={isEffectiveDark}
                style={{ width: 58, height: 24, borderRadius: 5 }}
              />
            </div>

            {/* Slider de Weight com 9 Dots Discretos */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                height: 18,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {/* Pontos discretos */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0 5px',
                  pointerEvents: 'none',
                  zIndex: 2,
                }}
              >
                {[100, 200, 300, 400, 500, 600, 700, 800, 900].map((step) => {
                  const isPassed = step <= currentWeight;
                  return (
                    <div
                      key={step}
                      style={{
                        width: 3.5,
                        height: 3.5,
                        borderRadius: '50%',
                        background: isPassed ? '#ffffff' : (isEffectiveDark ? '#666666' : '#999999'),
                        opacity: step === currentWeight ? 0 : 0.8,
                      }}
                    />
                  );
                })}
              </div>

              {/* Slider nativo estilizado */}
              <input
                type="range"
                min={100}
                max={900}
                step={100}
                value={currentWeight}
                onChange={(e) => onChange({ fontWeight: parseInt(e.target.value) || 400 })}
                style={{
                  width: '100%',
                  appearance: 'none',
                  background: `linear-gradient(to right, ${accentColor} 0%, ${accentColor} ${
                    ((currentWeight - 100) / 800) * 100
                  }%, ${isEffectiveDark ? '#3a3a3a' : '#cccccc'} ${
                    ((currentWeight - 100) / 800) * 100
                  }%, ${isEffectiveDark ? '#3a3a3a' : '#cccccc'} 100%)`,
                  height: 6,
                  borderRadius: 3,
                  outline: 'none',
                  cursor: 'pointer',
                  zIndex: 3,
                }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
