import React, { useEffect, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronRight, ExternalLink, SquareTerminal } from 'lucide-react';
import { AI_PROVIDERS, formatModelDisplayName } from '../../constants/ai';
import { hexToRgba } from '../../utils/color';
import { renderAiIcon } from '../icons/AiProviderIcons';

interface Props {
  tokens: Record<string, any>;
  isDark: boolean;
  accentColor: string;
  selectedAiProvider?: string;
  selectedModel?: string;
  activeModels?: Record<string, { currentModel?: string; currentModelId?: string; models?: Array<{ id: string; label: string }> } | undefined>;
  installedClis?: Record<string, boolean>;
  onSelectAiProvider?: (providerId: string) => void;
  onSelectModel?: (modelItem: { id: string; label: string }, providerId?: string) => void;
  onInstallAiCli?: (provider: any) => void;
}

/**
 * Seletor de IA + modelo igual ao da caixa de chat da IDE (mesmo botão, mesma lista de IAs com "Local"/"Instalar"
 * e o submenu de modelos ao lado). Abre para cima.
 */
export default function AiModelSelect({ tokens: th, isDark, accentColor, selectedAiProvider = 'claude', selectedModel, activeModels = {}, installedClis = {}, onSelectAiProvider, onSelectModel, onInstallAiCli }: Props) {
  const [open, setOpen] = useState(false);
  const [submenu, setSubmenu] = useState<string | null>(null);
  const [submenuOnLeft, setSubmenuOnLeft] = useState(true);
  const ref = useRef<HTMLDivElement>(null);
  const bgMenu = th.bgCardSecondary || (isDark ? '#1a1a1c' : '#ffffff');
  const hover = isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.04)';

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) { setOpen(false); setSubmenu(null); } };
    window.addEventListener('mousedown', close);
    return () => window.removeEventListener('mousedown', close);
  }, [open]);

  const place = () => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setSubmenuOnLeft(window.innerWidth - (r.left + 220) < 240);
  };
  const modelsOf = (p: (typeof AI_PROVIDERS)[number]) => {
    const dyn = activeModels[p.id]?.models || [];
    return dyn.length > 0 ? dyn : (p.models || []).map((m) => ({ id: m, label: m }));
  };
  const providerName = AI_PROVIDERS.find((p) => p.id === selectedAiProvider)?.name || 'Claude';
  const shownModel = activeModels[selectedAiProvider]?.currentModel || selectedModel;

  return (
    <div style={{ position: 'relative', minWidth: 0 }} ref={ref}>
      <div
        onClick={() => {
          const willOpen = !open;
          setOpen(willOpen);
          if (willOpen) { place(); setSubmenu((installedClis[selectedAiProvider] ?? true) ? selectedAiProvider : null); } else setSubmenu(null);
        }}
        style={{
          height: 26, paddingLeft: 7, paddingRight: 7, borderRadius: 5,
          background: open ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)') : (isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'),
          justifyContent: 'flex-start', alignItems: 'center', gap: 5, display: 'flex', cursor: 'pointer', whiteSpace: 'nowrap', transition: 'background 0.15s ease', maxWidth: 190, minWidth: 0, overflow: 'hidden',
        }}
      >
        <div style={{ flexShrink: 0, display: 'flex', alignItems: 'center' }}>{renderAiIcon(selectedAiProvider, 13.5)}</div>
        <div style={{ color: th.textPrimary, fontSize: 11.5, fontFamily: 'Poppins, sans-serif', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 0 }}>{providerName}</div>
        {shownModel && (
          <div style={{ color: th.textSecondary, opacity: 0.85, fontSize: 10.5, fontFamily: 'Poppins, sans-serif', fontWeight: 400, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0, flexShrink: 1 }}>
            {formatModelDisplayName(shownModel) || shownModel}
          </div>
        )}
        <ChevronDown size={10} color={th.textSecondary} style={{ flexShrink: 0 }} />
      </div>

      {open && (
        <div style={{ position: 'absolute', bottom: 34, left: 0, background: bgMenu, borderRadius: 10, border: `1px solid ${th.border}`, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 9999, whiteSpace: 'nowrap', minWidth: 190 }}>
          {AI_PROVIDERS.map((p) => {
            const isInstalled = installedClis[p.id] ?? true;
            const isSelected = selectedAiProvider === p.id;
            const isOpen = submenu === p.id;
            const list = modelsOf(p);
            return (
              <div
                key={p.id}
                onClick={() => {
                  if (!isInstalled) { onInstallAiCli?.(p); return; }
                  onSelectAiProvider?.(p.id);
                  if (list.length > 0) { place(); setSubmenu((prev) => (prev === p.id ? null : p.id)); } else { setOpen(false); setSubmenu(null); }
                }}
                title={!isInstalled ? `CLI "${p.cliCommand}" não instalado. Clique para instalar no terminal (${p.installGuide})` : undefined}
                style={{ padding: '7px 10px', color: th.textPrimary, fontSize: 12, fontFamily: 'Poppins, sans-serif', fontWeight: isSelected ? 600 : 400, cursor: 'pointer', borderRadius: 6, whiteSpace: 'nowrap', background: isSelected ? hexToRgba(accentColor, 0.15) : isOpen ? (isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)') : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, opacity: isInstalled ? 1 : 0.7, transition: 'background 0.15s ease, opacity 0.15s ease' }}
                onMouseEnter={(e) => { if (!isSelected && !isOpen) e.currentTarget.style.background = hover; }}
                onMouseLeave={(e) => { if (!isSelected && !isOpen) e.currentTarget.style.background = 'transparent'; }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                  {renderAiIcon(p.id, 15)}
                  <span>{p.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {isInstalled && !p.requiresLogin && (
                    <span style={{ fontSize: 9.5, padding: '2px 6px', borderRadius: 4, background: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.05)', color: th.textSecondary, fontFamily: 'Poppins, sans-serif' }} title="Roda localmente sem necessidade de login na nuvem">Local</span>
                  )}
                  {!isInstalled && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <button onClick={(e) => { e.stopPropagation(); onInstallAiCli?.(p); }} title={`Executar instalação no terminal: ${p.installGuide}`} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: accentColor, border: 'none', color: '#fff', display: 'flex', alignItems: 'center', gap: 4, fontWeight: 500, fontFamily: 'Poppins, sans-serif', cursor: 'pointer', boxShadow: `0 2px 6px ${hexToRgba(accentColor, 0.3)}` }}>
                        <SquareTerminal size={10} /><span>Instalar</span>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); (window as any).electronAPI?.shell?.openExternal?.(p.installUrl); }} title="Abrir página oficial de download no navegador" style={{ fontSize: 10, padding: '3px 5px', borderRadius: 4, background: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)', border: 'none', color: th.textSecondary, display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                        <ExternalLink size={10} />
                      </button>
                    </div>
                  )}
                  {isInstalled && list.length > 0 && (
                    <div
                      onClick={(e) => { e.stopPropagation(); place(); setSubmenu((prev) => (prev === p.id ? null : p.id)); }}
                      title="Ver opções de modelos"
                      style={{ padding: '2px 3px', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', background: isOpen ? (isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.08)') : 'transparent', cursor: 'pointer', transition: 'all 0.15s ease' }}
                    >
                      <ChevronRight size={11} color={isOpen ? th.textPrimary : th.textSecondary} style={{ opacity: isOpen ? 1 : 0.6, transform: isOpen ? 'rotate(90deg)' : (submenuOnLeft ? 'rotate(180deg)' : 'none'), transition: 'transform 0.15s ease' }} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {(() => {
            if (!submenu) return null;
            const target = AI_PROVIDERS.find((p) => p.id === submenu);
            if (!target || !(installedClis[target.id] ?? true)) return null;
            const list = modelsOf(target);
            if (!list.length) return null;
            return (
              <div
                style={{ position: 'absolute', left: submenuOnLeft ? 'auto' : 'calc(100% + 4px)', right: submenuOnLeft ? 'calc(100% + 4px)' : 'auto', bottom: 0, background: bgMenu, borderRadius: 10, border: `1px solid ${th.border}`, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)', padding: 6, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 100002, minWidth: 160, width: 'max-content', maxWidth: 240, maxHeight: 'min(360px, calc(100vh - 120px))', overflowY: 'auto' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div style={{ padding: '3px 8px 5px', fontSize: 10, fontWeight: 600, color: th.textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Modelos {target.name}</div>
                {list.map((m) => {
                  const currentId = activeModels[target.id]?.currentModelId;
                  const currentLabel = activeModels[target.id]?.currentModel;
                  const isCurrent = target.id === selectedAiProvider && (currentId === m.id || currentLabel === m.label || (!!selectedModel && (selectedModel === m.id || selectedModel === m.label)));
                  return (
                    <div
                      key={m.id}
                      onClick={() => { onSelectAiProvider?.(target.id); onSelectModel?.(m, target.id); setOpen(false); setSubmenu(null); }}
                      style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', background: isCurrent ? hexToRgba(accentColor, 0.15) : 'transparent', display: 'flex', alignItems: 'center', gap: 8, transition: 'background 0.15s ease', whiteSpace: 'nowrap' }}
                      onMouseEnter={(e) => { if (!isCurrent) e.currentTarget.style.background = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)'; }}
                      onMouseLeave={(e) => { if (!isCurrent) e.currentTarget.style.background = 'transparent'; }}
                    >
                      {isCurrent ? <Check size={12} color={accentColor} style={{ flexShrink: 0 }} /> : <div style={{ width: 12, flexShrink: 0 }} />}
                      <span style={{ fontSize: 12, fontFamily: 'Poppins, sans-serif', fontWeight: isCurrent ? 500 : 400, color: isCurrent ? accentColor : th.textPrimary, whiteSpace: 'nowrap' }}>{formatModelDisplayName(m.label) || m.label}</span>
                    </div>
                  );
                })}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
