import React, { useEffect, useMemo, useRef, useState } from 'react';

export interface OrchestrationPaletteItem {
  id: string;
  label: string;
  sublabel?: string;
  icon?: React.ReactNode;
  keywords?: string;
  onSelect: () => void;
}

export interface OrchestrationCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  items: OrchestrationPaletteItem[];
  accentColor: string;
  isEffectiveDark: boolean;
  bgCard: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  hoverBg?: string;
}

// "Batuta Search": command palette da Orquestração (Ctrl/Cmd+K).
export const OrchestrationCommandPalette: React.FC<OrchestrationCommandPaletteProps> = ({
  isOpen,
  onClose,
  items,
  accentColor,
  isEffectiveDark,
  bgCard,
  border,
  textPrimary,
  textSecondary,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  const filteredItems = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) =>
      `${item.label} ${item.sublabel || ''} ${item.keywords || ''}`.toLowerCase().includes(q)
    );
  }, [items, query]);

  useEffect(() => {
    setSelectedIndex((prev) => Math.max(0, Math.min(prev, filteredItems.length - 1)));
  }, [filteredItems]);

  useEffect(() => {
    if (filteredItems.length > 0 && itemRefs.current[selectedIndex]) {
      itemRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex, filteredItems.length]);

  if (!isOpen) return null;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, Math.min(prev + 1, filteredItems.length - 1)));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(0, Math.min(prev - 1, filteredItems.length - 1)));
    } else if (e.key === 'Enter') {
      if ((e.nativeEvent as any).isComposing) return;
      e.preventDefault();
      const item = filteredItems[selectedIndex];
      if (item) {
        item.onSelect();
        onClose();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.55)',
          zIndex: 999998,
          backdropFilter: 'blur(3px)',
        }}
      />
      <div
        onClick={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Paleta de Comandos da Orquestração"
        style={{
          position: 'fixed',
          top: '14%',
          left: '50%',
          transform: 'translateX(-50%)',
          width: 560,
          maxWidth: 'calc(100vw - 32px)',
          maxHeight: '60vh',
          background: bgCard,
          border: `1px solid ${border}`,
          borderRadius: 12,
          boxShadow: isEffectiveDark ? '0 24px 64px rgba(0, 0, 0, 0.8)' : '0 24px 64px rgba(0, 0, 0, 0.2)',
          zIndex: 999999,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '10px 12px', borderBottom: `1px solid ${border}` }}>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Buscar ações, agentes, criar nó…"
            aria-label="Buscar na paleta de comandos"
            style={{
              width: '100%',
              padding: '8px 10px',
              borderRadius: 8,
              border: 'none',
              outline: 'none',
              background: isEffectiveDark ? '#0f0f0f' : '#f1f5f9',
              color: textPrimary,
              fontSize: 13,
            }}
          />
        </div>
        <div style={{ overflowY: 'auto', padding: '4px 6px' }} role="menu">
          {filteredItems.length === 0 ? (
            <div style={{ padding: '16px 10px', fontSize: 12, color: textSecondary, textAlign: 'center' }}>
              Nenhum resultado
            </div>
          ) : (
            filteredItems.map((item, index) => {
              const isSelected = index === selectedIndex;
              return (
                <button
                  key={item.id}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  role="menuitem"
                  onMouseEnter={() => setSelectedIndex(index)}
                  onClick={() => {
                    item.onSelect();
                    onClose();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    width: '100%',
                    padding: '8px 10px',
                    borderRadius: 6,
                    border: 'none',
                    background: isSelected ? `${accentColor}18` : 'transparent',
                    color: isSelected ? accentColor : textPrimary,
                    fontSize: 12.5,
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  {item.icon}
                  <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                    {item.sublabel && (
                      <span style={{ fontSize: 10, color: textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.sublabel}
                      </span>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </>
  );
};
