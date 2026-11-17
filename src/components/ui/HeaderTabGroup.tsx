import React, { useRef, useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { PopupPortal, popupColors } from './PopupPortal';

export interface TabGroupItem { id: string; label: string; icon: React.ComponentType<{ size?: number; color?: string }> }

const Dot: React.FC<{ color: string }> = ({ color }) => <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />;

/** Aba única da header que reúne várias telas: mostra a ativa (ou a última usada) e abre um popup para trocar. */
export const HeaderTabGroup: React.FC<{
  items: TabGroupItem[];
  activeId: string;
  onSelect: (id: string) => void;
  /** ids com IA que terminou e ainda não foi vista */
  pending?: string[];
  accentColor: string;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
}> = ({ items, activeId, onSelect, pending = [], accentColor, isDark, textPrimary, textSecondary }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [hot, setHot] = useState(false);
  const [last, setLast] = useState(items[0].id);
  const inGroup = items.some((i) => i.id === activeId);
  const shown = items.find((i) => i.id === (inGroup ? activeId : last)) || items[0];
  const colors = popupColors(isDark);

  return (
    <>
      <div
        ref={ref}
        className="skin-tab df-pressable"
        data-on={inGroup ? '1' : undefined}
        onClick={() => { setOpen(false); onSelect(shown.id); }}
        style={{
          padding: '5px 0 5px 14px',
          background: inGroup ? (isDark ? '#2E2E2E' : '#e4e7eb') : 'transparent',
          borderRadius: 5,
          display: 'flex',
          alignItems: 'center',
          gap: 6,
          cursor: 'pointer',
          whiteSpace: 'nowrap',
          flexShrink: 0,
          transition: 'background-color 150ms var(--ease-out), transform 140ms var(--ease-out)',
        }}
      >
        {pending.some((id) => id !== activeId) && <Dot color={accentColor} />}
        <div style={{ color: inGroup ? textPrimary : textSecondary, fontSize: 12, fontFamily: 'Poppins', fontWeight: 400 }}>{shown.label}</div>
        <div style={{ width: 1, alignSelf: 'stretch', margin: '-5px -6px -5px 4px', background: textSecondary, opacity: 0.25 }} />
        <div
          className="df-pressable"
          onClick={(e) => { e.stopPropagation(); setOpen((o) => !o); }}
          onMouseEnter={(e) => { setHot(true); e.currentTarget.style.background = colors.hover; }}
          onMouseLeave={(e) => { setHot(false); e.currentTarget.style.background = 'transparent'; }}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', alignSelf: 'stretch', margin: '-5px 0', padding: '0 8px', borderRadius: '0 5px 5px 0', cursor: 'pointer', transition: 'background-color 120ms var(--ease-out)' }}
        >
          <ChevronDown size={10} className="df-chevron" color={hot || open ? accentColor : textSecondary} style={{ transform: open ? 'rotate(180deg)' : 'none' }} />
        </div>
      </div>
      <PopupPortal anchor={ref.current} open={open} onClose={() => setOpen(false)} width={150} isDark={isDark}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {items.map((i) => {
            const on = i.id === activeId;
            return (
              <div
                key={i.id}
                className="df-pressable"
                onClick={() => {
                  setLast(i.id);
                  onSelect(i.id);
                  setOpen(false);
                }}
                onMouseEnter={(e) => (e.currentTarget.style.background = colors.hover)}
                onMouseLeave={(e) => (e.currentTarget.style.background = on ? colors.hover : 'transparent')}
                style={{
                  padding: '5px 10px',
                  borderRadius: 5,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: 5,
                  cursor: 'pointer',
                  fontSize: 12,
                  fontFamily: 'Poppins',
                  fontWeight: on ? 500 : 400,
                  color: colors.text,
                  background: on ? colors.hover : 'transparent',
                  transition: 'background-color 120ms var(--ease-out)',
                }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {pending.includes(i.id) && !on && <Dot color={accentColor} />}
                  <i.icon size={13} color={on ? accentColor : colors.sub} />
                  {i.label}
                </span>
                {on && <Check size={12} />}
              </div>
            );
          })}
        </div>
      </PopupPortal>
    </>
  );
};
