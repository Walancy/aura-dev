import React, { useState } from 'react';
import FigmaColorPicker from './FigmaColorPicker';
import { ScrubbableNumberInput } from './ScrubbableNumberInput';
import type { SelectionColor } from './selectionColors';

interface Props {
  colors: SelectionColor[];
  onReplace: (from: SelectionColor, to: { hex: string; opacity: number }) => void;
  themeTokens: Record<string, any>;
  accentColor: string;
  isEffectiveDark: boolean;
  divider: string;
  textPrimary: string;
  textSecondary: string;
  bgSecondary: string;
  inputBorder: string;
}

const CHECKER = 'conic-gradient(#8884 25%, transparent 0 50%, #8884 0 75%, transparent 0) 0 0 / 8px 8px';

/** "Selection colors" (como no Figma): todas as cores sólidas das camadas da seleção; editar uma troca em todas as camadas. */
export default function SelectionColorsSection({ colors, onReplace, themeTokens, accentColor, isEffectiveDark, divider, textPrimary, textSecondary, bgSecondary, inputBorder }: Props) {
  // cor em edição no seletor: guarda a cor de partida (a troca é contínua) e as linhas usam chave estável para o seletor não fechar
  const [active, setActive] = useState<SelectionColor | null>(null);
  const [expanded, setExpanded] = useState(false);
  const shown = expanded ? colors : colors.slice(0, 3);
  const pick = (hex: string, op: number) => {
    if (!active) return;
    const to = { hex: hex.toUpperCase(), opacity: Math.round(op * 100) };
    onReplace(active, to);
    setActive({ ...active, ...to });
  };
  return (
    <div style={{ padding: '10px 12px', borderBottom: `1px solid ${divider}`, display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: textPrimary }}>Cores da seleção</span>
      {shown.map((c, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }} title={`Usada em ${c.count} lugar${c.count > 1 ? 'es' : ''} da seleção`}>
          <button type="button" onClick={() => setActive(c)} style={{ width: 24, height: 24, padding: 0, borderRadius: 5, border: `1px solid ${inputBorder}`, background: c.opacity < 100 ? `linear-gradient(${c.hex}${Math.round((c.opacity / 100) * 255).toString(16).padStart(2, '0')}, ${c.hex}${Math.round((c.opacity / 100) * 255).toString(16).padStart(2, '0')}), ${CHECKER}` : c.hex, cursor: 'pointer', flexShrink: 0 }} />
          <input
            key={c.key}
            defaultValue={c.hex.slice(1)}
            maxLength={6}
            spellCheck={false}
            onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            onBlur={(e) => {
              const v = e.target.value.trim().replace('#', '').toUpperCase();
              if (/^[0-9A-F]{6}$/.test(v) && '#' + v !== c.hex) onReplace(c, { hex: '#' + v, opacity: c.opacity });
              else e.target.value = c.hex.slice(1);
            }}
            style={{ flex: 1, minWidth: 0, height: 26, background: bgSecondary, border: `1px solid ${inputBorder}`, borderRadius: 5, color: textPrimary, fontSize: 11.5, padding: '0 8px', outline: 'none', fontFamily: "'Poppins', sans-serif", textTransform: 'uppercase' }}
          />
          <ScrubbableNumberInput
            value={c.opacity}
            min={0}
            max={100}
            pixelsPerStep={2}
            onChange={(v) => { const o = Math.max(0, Math.min(100, Math.round(v))); if (o !== c.opacity) onReplace(c, { hex: c.hex, opacity: o }); }}
            themeTokens={themeTokens}
            accentColor={accentColor}
            isEffectiveDark={isEffectiveDark}
            style={{ width: 52, flexShrink: 0 }}
          />
          <span style={{ fontSize: 11, color: textSecondary, width: 12 }}>%</span>
        </div>
      ))}
      {colors.length > 3 && (
        <button type="button" onClick={() => setExpanded((v) => !v)} style={{ alignSelf: 'flex-start', background: 'transparent', border: 'none', color: accentColor, fontSize: 11, cursor: 'pointer', padding: '2px 0' }}>
          {expanded ? 'Ver menos' : `Ver mais (${colors.length - 3})`}
        </button>
      )}
      {active && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 1000, pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'auto' }}>
            <FigmaColorPicker color={active.hex} opacity={active.opacity / 100} themeTokens={themeTokens} accentColor={accentColor} onChange={pick} onClose={() => setActive(null)} />
          </div>
        </div>
      )}
    </div>
  );
}
