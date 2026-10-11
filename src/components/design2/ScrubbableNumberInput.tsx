import React, { useState, useRef, useEffect } from 'react';

export interface ScrubbableNumberInputProps {
  label?: React.ReactNode;
  value: number | string;
  onChange: (value: number) => void;
  onStringChange?: (value: string) => void;
  min?: number;
  max?: number;
  step?: number;
  suffix?: string;
  placeholder?: string;
  themeTokens?: any;
  accentColor?: string;
  isEffectiveDark?: boolean;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
  rightElement?: React.ReactNode;
  allowDecimals?: boolean;
  className?: string;
  title?: string;
  /** quantos pixels de arrasto valem 1 "step" (padrão 1; maior = menos sensível) */
  pixelsPerStep?: number;
}

export const ScrubbableNumberInput: React.FC<ScrubbableNumberInputProps> = ({
  label,
  value,
  onChange,
  onStringChange,
  min,
  max,
  step = 1,
  suffix = '',
  placeholder,
  accentColor = '#007acc',
  themeTokens,
  isEffectiveDark = true,
  style,
  inputStyle,
  rightElement,
  allowDecimals = false,
  className,
  title,
  pixelsPerStep = 1,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState('');
  const [isHovered, setIsHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const isNumeric = typeof value === 'number' || (!isNaN(Number(value)) && value !== '' && value !== null && value !== undefined);
  const numericValue = isNumeric ? Number(value) : 0;

  const displayVal = isNumeric
    ? (allowDecimals || step < 1 ? Math.round(numericValue * 100) / 100 : Math.round(numericValue))
    : String(value ?? '');

  const handleMouseDown = (e: React.MouseEvent) => {
    if (isEditing) return;
    if (e.button !== 0) return; // apenas botão esquerdo principal

    // Ignora se o clique foi em dropdown select, botão ou elemento com clique próprio
    const target = e.target as HTMLElement;
    if (
      target.tagName === 'SELECT' ||
      target.tagName === 'BUTTON' ||
      target.closest('select, button, [data-no-scrub]')
    ) {
      return;
    }

    e.preventDefault();
    const startX = e.clientX;
    const startVal = isNumeric ? numericValue : (min ?? 0);
    let hasDragged = false;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      if (!hasDragged && Math.abs(deltaX) > 2) {
        hasDragged = true;
        document.body.style.cursor = 'ew-resize';
        document.body.style.userSelect = 'none';
      }

      if (hasDragged) {
        let mult = step;
        if (moveEvent.shiftKey) mult = step * 10;
        else if (moveEvent.altKey || moveEvent.metaKey) mult = step < 1 ? step * 0.1 : 0.1;

        let next = startVal + (deltaX / Math.max(0.1, pixelsPerStep)) * mult;
        if (allowDecimals || step < 1 || mult < 1) {
          next = Math.round(next * 100) / 100;
        } else {
          next = Math.round(next);
        }

        if (min !== undefined) next = Math.max(min, next);
        if (max !== undefined) next = Math.min(max, next);

        onChange(next);
        if (onStringChange) {
          onStringChange(String(next));
        }
      }
    };

    const onMouseUp = () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';

      if (!hasDragged) {
        setIsEditing(true);
        setEditText(isNumeric ? String(displayVal) : String(value ?? ''));
        setTimeout(() => {
          if (inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
          }
        }, 10);
      }
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  };

  const handleCommit = () => {
    setIsEditing(false);
    const trimmed = editText.trim();

    // Se suportar string (ex: 'Auto') e não for puramente numérico
    if (onStringChange && isNaN(Number(trimmed)) && trimmed !== '') {
      onStringChange(trimmed);
      return;
    }

    const parsed = parseFloat(trimmed);
    if (!isNaN(parsed)) {
      let finalVal = allowDecimals || step < 1 ? Math.round(parsed * 100) / 100 : Math.round(parsed);
      if (min !== undefined) finalVal = Math.max(min, finalVal);
      if (max !== undefined) finalVal = Math.min(max, finalVal);
      onChange(finalVal);
      if (onStringChange) {
        onStringChange(String(finalVal));
      }
    } else if (onStringChange && trimmed !== '') {
      onStringChange(trimmed);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommit();
    } else if (e.key === 'Escape') {
      setIsEditing(false);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const current = parseFloat(editText) || (isNumeric ? numericValue : 0);
      const inc = e.shiftKey ? step * 10 : step;
      let next = current + inc;
      if (max !== undefined) next = Math.min(max, next);
      if (!allowDecimals && step >= 1) next = Math.round(next);
      setEditText(String(next));
      onChange(next);
      if (onStringChange) onStringChange(String(next));
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const current = parseFloat(editText) || (isNumeric ? numericValue : 0);
      const dec = e.shiftKey ? step * 10 : step;
      let next = current - dec;
      if (min !== undefined) next = Math.max(min, next);
      if (!allowDecimals && step >= 1) next = Math.round(next);
      setEditText(String(next));
      onChange(next);
      if (onStringChange) onStringChange(String(next));
    }
  };

  const textPrimary = themeTokens?.textPrimary || '#ffffff';
  const textSecondary = themeTokens?.textSecondary || '#8e8e8e';
  const bgSecondary = themeTokens?.bgCardSecondary || (isEffectiveDark ? '#2c2c2c' : '#f0f0f0');

  return (
    <div
      className={className}
      title={title}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: 'flex',
        alignItems: 'center',
        background: isEditing
          ? (isEffectiveDark ? '#222222' : '#ffffff')
          : isHovered
            ? (isEffectiveDark ? '#363636' : '#e4e4e4')
            : bgSecondary,
        border: isEditing ? `1px solid ${accentColor}` : '1px solid transparent',
        borderRadius: 5,
        padding: '0 6px',
        height: 24,
        boxSizing: 'border-box',
        cursor: isEditing ? 'text' : 'ew-resize',
        userSelect: 'none',
        transition: 'border-color 0.12s ease, background 0.12s ease, border-radius 0.22s ease',
        overflow: 'hidden',
        position: 'relative',
        ...style,
      }}
    >
      {label && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            color: textSecondary,
            fontSize: 10,
            fontWeight: 400,
            marginRight: 4,
            flexShrink: 0,
            cursor: 'ew-resize',
          }}
        >
          {label}
        </div>
      )}

      {isEditing ? (
        <div style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 0 }}>
          <input
            ref={inputRef}
            type="text"
            value={editText}
            placeholder={placeholder}
            onChange={(e) => setEditText(e.target.value)}
            onBlur={handleCommit}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              width: '100%',
              minWidth: 0,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: textPrimary,
              fontSize: 11,
              fontFamily: 'inherit',
              padding: 0,
              cursor: 'text',
              ...inputStyle,
            }}
          />
          {suffix && (
            <span style={{ fontSize: 10, color: textSecondary, marginLeft: 2, flexShrink: 0 }}>
              {suffix}
            </span>
          )}
        </div>
      ) : (
        <span
          style={{
            flex: 1,
            color: textPrimary,
            fontSize: 11,
            fontFamily: 'inherit',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            cursor: 'ew-resize',
            ...inputStyle,
          }}
        >
          {displayVal}{suffix}
        </span>
      )}

      {rightElement && (
        <div
          data-no-scrub
          style={{
            display: 'flex',
            alignItems: 'center',
            marginLeft: 4,
            flexShrink: 0,
          }}
        >
          {rightElement}
        </div>
      )}
    </div>
  );
};

export default ScrubbableNumberInput;
