import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, CalendarClock, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { hexToRgba } from '../../utils/color';

const POPUP_WIDTH = 240;
const POPUP_HEIGHT_ESTIMATE = 320;

export interface DatePickerFieldProps {
  value: string; // 'YYYY-MM-DD' ou ''
  onChange: (value: string) => void;
  min?: string; // 'YYYY-MM-DD'
  placeholder?: string;
  accentColor: string;
  isEffectiveDark: boolean;
  inputBg: string;
  inputBorder: string;
  textPrimary: string;
  textSecondary: string;
  dropdownBg: string;
  dropdownShadow: string;
  dropdownBorder: string;
  dropdownItemHover: string;
  /** Mostra um ícone de atalho no campo para selecionar a data de hoje sem abrir o calendário */
  showTodayShortcut?: boolean;
}

const WEEKDAY_LABELS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

function toDateOnly(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export const DatePickerField: React.FC<DatePickerFieldProps> = ({
  value,
  onChange,
  min,
  placeholder = 'Selecionar data',
  accentColor,
  isEffectiveDark,
  inputBg,
  inputBorder,
  textPrimary,
  textSecondary,
  dropdownBg,
  dropdownShadow,
  dropdownBorder,
  dropdownItemHover,
  showTodayShortcut = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [popupPos, setPopupPos] = useState<{ top: number; left: number } | null>(null);
  const selectedDate = value ? toDateOnly(value) : null;
  const minDate = min ? toDateOnly(min) : null;
  const [viewMonth, setViewMonth] = useState(() => selectedDate || new Date());
  const containerRef = useRef<HTMLDivElement>(null);
  const popupRef = useRef<HTMLDivElement>(null);

  const selectToday = () => {
    const t = new Date();
    t.setHours(0, 0, 0, 0);
    if (minDate && t.getTime() < minDate.getTime()) return;
    onChange(toIsoDate(t));
    setViewMonth(t);
  };

  useEffect(() => {
    if (selectedDate) setViewMonth(selectedDate);
  }, [value]);

  const updatePopupPosition = () => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    let left = rect.left;
    if (left + POPUP_WIDTH > window.innerWidth - 8) {
      left = window.innerWidth - POPUP_WIDTH - 8;
    }
    if (left < 8) left = 8;

    let top = rect.bottom + 6;
    if (top + POPUP_HEIGHT_ESTIMATE > window.innerHeight - 8) {
      const above = rect.top - POPUP_HEIGHT_ESTIMATE - 6;
      top = above < 8 ? 8 : above;
    }

    setPopupPos({ top, left });
  };

  const handleTriggerClick = () => {
    if (!isOpen) updatePopupPosition();
    setIsOpen((prev) => !prev);
  };

  // Reposiciona (ou fecha, via clique fora) enquanto o popup estiver aberto, inclusive
  // ao rolar o modal que o contém, já que o popup é renderizado via portal.
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (containerRef.current?.contains(target)) return;
      if (popupRef.current?.contains(target)) return;
      setIsOpen(false);
    };
    const handleReposition = () => updatePopupPosition();

    document.addEventListener('mousedown', handleClickOutside);
    window.addEventListener('scroll', handleReposition, true);
    window.addEventListener('resize', handleReposition);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      window.removeEventListener('scroll', handleReposition, true);
      window.removeEventListener('resize', handleReposition);
    };
  }, [isOpen]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
  const startWeekday = monthStart.getDay();
  const daysInMonth = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0).getDate();
  const gridStart = new Date(monthStart);
  gridStart.setDate(gridStart.getDate() - startWeekday);

  const cells: Date[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    cells.push(d);
  }

  const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const isDisabled = (d: Date) => !!minDate && d.getTime() < minDate.getTime();

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={handleTriggerClick}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          width: '100%',
          background: inputBg,
          border: inputBorder,
          borderRadius: 6,
          padding: '7px 10px',
          color: value ? textPrimary : textSecondary,
          fontSize: 12.5,
          fontWeight: '300',
          outline: 'none',
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        <Calendar size={13} color={isOpen ? accentColor : textSecondary} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {selectedDate
            ? selectedDate.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
            : placeholder}
        </span>
        {showTodayShortcut && (
          <span
            title="Selecionar hoje"
            onClick={(e) => {
              e.stopPropagation();
              selectToday();
            }}
            style={{ display: 'flex', alignItems: 'center', flexShrink: 0, borderRadius: 4, padding: 2 }}
            onMouseEnter={(e) => (e.currentTarget.style.background = dropdownItemHover)}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <CalendarClock size={13} color={textSecondary} />
          </span>
        )}
        {value && (
          <X
            size={12}
            color={textSecondary}
            style={{ flexShrink: 0 }}
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
            }}
          />
        )}
      </button>

      {isOpen && popupPos && createPortal(
        <div
          ref={popupRef}
          onClick={(e) => e.stopPropagation()}
          style={{
            position: 'fixed',
            top: popupPos.top,
            left: popupPos.left,
            zIndex: 100000,
            width: POPUP_WIDTH,
            background: dropdownBg,
            borderRadius: 10,
            padding: 10,
            boxShadow: dropdownShadow,
            border: dropdownBorder,
          }}
        >
          {/* Cabeçalho: mês/ano + navegação */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, padding: '0 2px' }}>
            <div
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() - 1, 1))}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 5, cursor: 'pointer', color: textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.background = dropdownItemHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <ChevronLeft size={14} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 500, color: textPrimary, textTransform: 'capitalize' }}>
              {viewMonth.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}
            </span>
            <div
              onClick={() => setViewMonth(new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 1))}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 22, height: 22, borderRadius: 5, cursor: 'pointer', color: textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.background = dropdownItemHover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
            >
              <ChevronRight size={14} />
            </div>
          </div>

          {/* Dias da semana */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 2 }}>
            {WEEKDAY_LABELS.map((w, i) => (
              <div key={i} style={{ textAlign: 'center', fontSize: 10, color: textSecondary, padding: '2px 0' }}>
                {w}
              </div>
            ))}
          </div>

          {/* Grade de dias */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((d, i) => {
              const inCurrentMonth = d.getMonth() === viewMonth.getMonth();
              const isSelected = selectedDate && isSameDay(d, selectedDate);
              const isToday = isSameDay(d, today);
              const disabled = isDisabled(d);
              return (
                <div
                  key={i}
                  onClick={() => {
                    if (disabled) return;
                    onChange(toIsoDate(d));
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: 26,
                    borderRadius: 6,
                    fontSize: 11.5,
                    cursor: disabled ? 'default' : 'pointer',
                    color: disabled
                      ? (isEffectiveDark ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.15)')
                      : isSelected
                      ? '#ffffff'
                      : !inCurrentMonth
                      ? textSecondary
                      : textPrimary,
                    background: isSelected ? accentColor : 'transparent',
                    opacity: !inCurrentMonth && !isSelected ? 0.4 : 1,
                    border: isToday && !isSelected ? `1px solid ${accentColor}` : '1px solid transparent',
                    fontWeight: isToday || isSelected ? 600 : 400,
                    transition: 'background 0.1s ease',
                  }}
                  onMouseEnter={(e) => {
                    if (!disabled && !isSelected) e.currentTarget.style.background = dropdownItemHover;
                  }}
                  onMouseLeave={(e) => {
                    if (!disabled && !isSelected) e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {d.getDate()}
                </div>
              );
            })}
          </div>

          {/* Rodapé: atalhos */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, paddingTop: 8, borderTop: `1px solid ${hexToRgba(textSecondary, 0.15)}` }}>
            <button
              type="button"
              onClick={() => {
                selectToday();
                setIsOpen(false);
              }}
              style={{ background: 'none', border: 'none', color: accentColor, fontSize: 11, cursor: 'pointer', padding: 0 }}
            >
              Hoje
            </button>
            {value && (
              <button
                type="button"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
                style={{ background: 'none', border: 'none', color: textSecondary, fontSize: 11, cursor: 'pointer', padding: 0 }}
              >
                Limpar
              </button>
            )}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};
