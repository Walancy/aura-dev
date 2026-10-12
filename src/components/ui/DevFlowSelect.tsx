import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check } from 'lucide-react';
import { hexToRgba } from '../../utils/color';

export interface DevFlowSelectOption<T = string | number> {
  value: T;
  label: string;
  description?: string;
  icon?: React.ReactNode;
}

export interface DevFlowSelectProps<T = string | number> {
  value: T;
  onChange: (value: T) => void;
  options: DevFlowSelectOption<T>[];
  placeholder?: string;
  isEffectiveDark: boolean;
  accentColor: string;
  themeTokens?: {
    textPrimary?: string;
    textSecondary?: string;
    bgCardSecondary?: string;
    [key: string]: any;
  };
  width?: number | string;
  minWidth?: number | string;
  maxWidth?: number | string;
  disabled?: boolean;
}

export const DevFlowSelect = <T extends string | number>({
  value,
  onChange,
  options,
  placeholder = 'Selecione...',
  isEffectiveDark,
  accentColor,
  themeTokens,
  width = '100%',
  minWidth,
  maxWidth,
  disabled = false,
}: DevFlowSelectProps<T>) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  const selectedOption = options.find((opt) => opt.value === value);

  const updatePosition = () => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    const dropdownHeight = Math.min(options.length * 32 + 8, 220);
    const spaceBelow = window.innerHeight - rect.bottom;
    const placeAbove = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

    setDropdownPos({
      top: placeAbove ? rect.top - dropdownHeight - 4 : rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
  };

  const handleToggle = () => {
    if (disabled) return;
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen((prev) => !prev);
  };

  useEffect(() => {
    if (!isOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };

    const handleReposition = () => updatePosition();

    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);

    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen, options.length]);

  const textColor = themeTokens?.textPrimary || (isEffectiveDark ? '#ffffff' : '#0f172a');
  const secondaryColor = themeTokens?.textSecondary || (isEffectiveDark ? '#94a3b8' : '#64748b');
  const menuBg = isEffectiveDark ? '#17171a' : '#ffffff';

  return (
    <div
      style={{
        position: 'relative',
        display: 'inline-flex',
        width,
        minWidth,
        maxWidth,
        boxSizing: 'border-box',
      }}
    >
      <button
        ref={triggerRef}
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        style={{
          width: '100%',
          height: 28,
          padding: '0 8px',
          gap: 8,
          borderRadius: 6,
          border: 'none',
          boxShadow: 'none',
          background: isEffectiveDark ? 'rgba(255, 255, 255, 0.04)' : 'rgba(0, 0, 0, 0.04)',
          color: selectedOption ? textColor : secondaryColor,
          fontSize: 11.5,
          fontWeight: 400,
          cursor: disabled ? 'not-allowed' : 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          outline: 'none',
          opacity: disabled ? 0.5 : 1,
          transition: 'background 0.15s ease, color 0.15s ease',
          boxSizing: 'border-box',
        }}
        onMouseEnter={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = isEffectiveDark
              ? 'rgba(255, 255, 255, 0.07)'
              : 'rgba(0, 0, 0, 0.07)';
          }
        }}
        onMouseLeave={(e) => {
          if (!disabled) {
            e.currentTarget.style.background = isEffectiveDark
              ? 'rgba(255, 255, 255, 0.04)'
              : 'rgba(0, 0, 0, 0.04)';
          }
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            minWidth: 0,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {selectedOption?.icon && (
            <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {selectedOption.icon}
            </span>
          )}
          <span
            style={{
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              fontSize: 11.5,
              fontWeight: 400,
            }}
          >
            {selectedOption ? selectedOption.label : placeholder}
          </span>
        </div>

        <ChevronDown
          size={12}
          color={secondaryColor}
          style={{
            flexShrink: 0,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.15s ease',
          }}
        />
      </button>

      {isOpen &&
        createPortal(
          <div
            ref={dropdownRef}
            style={{
              position: 'fixed',
              top: dropdownPos.top,
              left: dropdownPos.left,
              width: Math.max(dropdownPos.width, 140),
              maxHeight: 220,
              overflowY: 'auto',
              background: menuBg,
              border: 'none',
              boxShadow: 'none',
              borderRadius: 6,
              padding: 4,
              display: 'flex',
              flexDirection: 'column',
              gap: 4,
              zIndex: 9999999,
              boxSizing: 'border-box',
              animation: 'fadeIn 0.12s ease-out',
            }}
          >
            {options.map((opt) => {
              const isSelected = opt.value === value;
              return (
                <button
                  key={String(opt.value)}
                  type="button"
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                  }}
                  style={{
                    width: '100%',
                    height: 28,
                    padding: '0 8px',
                    gap: 8,
                    borderRadius: 4,
                    border: 'none',
                    boxShadow: 'none',
                    background: isSelected
                      ? hexToRgba(accentColor, 0.16)
                      : 'transparent',
                    color: isSelected
                      ? (isEffectiveDark ? '#ffffff' : accentColor)
                      : textColor,
                    fontSize: 11.5,
                    fontWeight: 400,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    outline: 'none',
                    textAlign: 'left',
                    boxSizing: 'border-box',
                    transition: 'background 0.12s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = isEffectiveDark
                        ? 'rgba(255, 255, 255, 0.06)'
                        : 'rgba(0, 0, 0, 0.05)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) {
                      e.currentTarget.style.background = 'transparent';
                    }
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                      minWidth: 0,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {opt.icon && (
                      <span style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                        {opt.icon}
                      </span>
                    )}
                    <span
                      style={{
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {opt.label}
                    </span>
                    {opt.description && (
                      <span
                        style={{
                          fontSize: 10,
                          color: secondaryColor,
                          marginLeft: 4,
                          opacity: 0.7,
                        }}
                      >
                        {opt.description}
                      </span>
                    )}
                  </div>

                  {isSelected && (
                    <Check
                      size={12}
                      color={isEffectiveDark ? '#ffffff' : accentColor}
                      strokeWidth={2.5}
                      style={{ flexShrink: 0, marginLeft: 6 }}
                    />
                  )}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </div>
  );
};
