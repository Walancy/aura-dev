import React, { useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Check, Loader2 } from 'lucide-react';
import { GroupedModelMenu } from './GroupedModelMenu';
import { getFieldTokens } from '../../utils/fieldTokens';
import { hexToRgba } from '../../utils/color';
import { renderAiIcon } from '../icons/AiProviderIcons';

/** Botão "Gerar com [IA]" com seta para trocar a IA e o modelo (mesmo seletor da header). Durante a geração o ícone da IA vira um loading. */
export const AiGenerateButton: React.FC<{
  verb: string;
  title: string;
  loading: boolean;
  onGenerate: () => void;
  providers: Array<{ id: string; name: string }>;
  modelsByProvider: Record<string, Array<{ id: string; label: string }>>;
  provider: string;
  model?: string;
  onChangeProvider: (id: string) => void;
  onChangeModel: (id: string) => void;
  accentColor: string;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  fieldBg: string;
  fieldBgHover: string;
}> = ({ verb, title, loading, onGenerate, providers, modelsByProvider, provider, model, onChangeProvider, onChangeModel, accentColor, isDark, textPrimary, textSecondary, fieldBg, fieldBgHover }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<string | null>(null);
  const ft = getFieldTokens(isDark);
  const hoverBg = isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)';
  const close = () => { setOpen(false); setSub(null); };
  const name = providers.find((p) => p.id === provider)?.name || provider;

  const target = providers.find((p) => p.id === sub);
  const targetModels = target ? modelsByProvider[target.id] || [] : [];
  const isCurrentModel = (pid: string, m: { id: string; label: string }) => pid === provider && (model === m.id || model === m.label);
  const pickModel = (pid: string, m: { id: string }) => { if (pid !== provider) onChangeProvider(pid); onChangeModel(m.id); close(); };

  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', height: 30, borderRadius: 6, background: fieldBg, overflow: 'hidden' }}>
        <button
          type="button"
          className="df-pressable"
          title={loading ? 'Cancelar' : title}
          onClick={onGenerate}
          onMouseEnter={(e) => (e.currentTarget.style.background = fieldBgHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          style={{ height: '100%', padding: '0 10px', border: 'none', background: 'transparent', color: textPrimary, display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', transition: 'background-color 140ms var(--ease-out)' }}
        >
          {loading ? <Loader2 size={13} color={accentColor} style={{ animation: 'spin 0.9s linear infinite' }} /> : renderAiIcon(provider, 13)}
          <span>{loading ? 'Gerando...' : `${verb} com ${name}`}</span>
        </button>
        <div style={{ width: 1, alignSelf: 'stretch', margin: '6px 0', background: textSecondary, opacity: 0.25 }} />
        <button
          type="button"
          className="df-pressable"
          title="Escolher IA e modelo"
          onClick={() => { if (open) close(); else { setOpen(true); setSub(provider); } }}
          onMouseEnter={(e) => (e.currentTarget.style.background = fieldBgHover)}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          style={{ height: '100%', width: 26, border: 'none', background: 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', transition: 'background-color 140ms var(--ease-out)' }}
        >
          <ChevronDown size={12} color={open ? accentColor : textSecondary} style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 160ms var(--ease-out)' }} />
        </button>
      </div>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 2000000, background: 'transparent' }} onClick={close} onContextMenu={(e) => { e.preventDefault(); close(); }} />
          <div
            className="df-dropdown-menu df-popover-right"
            style={{ position: 'absolute', top: 36, right: 0, background: ft.dropdownMenuBg, borderRadius: 10, border: ft.dropdownBorder, boxShadow: 'none', padding: 6, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 2000001, minWidth: 265, userSelect: 'none' }}
          >
            <div style={{ padding: '6px 8px', fontSize: 10.5, fontWeight: 500, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 2 }}>Selecionar IA & Modelo</div>
            {providers.map((p) => {
              const isSelected = p.id === provider;
              const isSub = sub === p.id;
              const models = modelsByProvider[p.id] || [];
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    if (!isSelected) onChangeProvider(p.id);
                    if (models.length) setSub(p.id);
                    else close();
                  }}
                  onMouseEnter={(e) => { if (models.length) setSub(p.id); if (!isSelected && !isSub) e.currentTarget.style.background = hoverBg; }}
                  onMouseLeave={(e) => { if (!isSelected && !isSub) e.currentTarget.style.background = 'transparent'; }}
                  style={{ padding: '7px 10px', color: textPrimary, fontSize: 12, fontFamily: 'Poppins, sans-serif', fontWeight: isSelected ? 500 : 400, cursor: 'pointer', borderRadius: 6, whiteSpace: 'nowrap', background: isSelected ? hexToRgba(accentColor, 0.16) : isSub ? hoverBg : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, transition: 'background 0.12s ease' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
                    {renderAiIcon(p.id, 16)}
                    <span style={{ color: isSelected ? accentColor : textPrimary }}>{p.name}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                    {isSelected && <Check size={13} color={accentColor} />}
                    {models.length > 0 && <ChevronRight size={13} color={textSecondary} />}
                  </div>
                </div>
              );
            })}

            {target && targetModels.length > 0 && (target.id === 'antigravity' ? (
              <div style={{ position: 'absolute', right: 'calc(100% + 4px)', top: 0, zIndex: 2000002 }}>
                <GroupedModelMenu
                  providerName={target.name}
                  models={targetModels}
                  isCurrent={(m) => isCurrentModel(target.id, m)}
                  onSelect={(m) => pickModel(target.id, m)}
                  accentColor={accentColor}
                  isDark={isDark}
                  textPrimary={textPrimary}
                  textSecondary={textSecondary}
                  border={isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}
                  menuBg={ft.dropdownMenuBg}
                  menuBorder={ft.dropdownBorder}
                  hexToRgba={hexToRgba}
                />
              </div>
            ) : (
              <div
                className="no-scrollbar"
                onClick={(e) => e.stopPropagation()}
                style={{ position: 'absolute', right: 'calc(100% + 4px)', top: 0, background: ft.dropdownMenuBg, borderRadius: 10, border: ft.dropdownBorder, boxShadow: 'none', padding: 6, display: 'flex', flexDirection: 'column', gap: 2, zIndex: 2000002, minWidth: 170, maxWidth: 260, maxHeight: 'min(420px, calc(100vh - 60px))', overflowY: 'auto' }}
              >
                <div style={{ padding: '3px 8px 5px', fontSize: 10, fontWeight: 500, color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 3 }}>Modelos {target.name}</div>
                {targetModels.map((m) => {
                  const cur = isCurrentModel(target.id, m);
                  return (
                    <div
                      key={m.id}
                      onClick={() => pickModel(target.id, m)}
                      onMouseEnter={(e) => { if (!cur) e.currentTarget.style.background = hoverBg; }}
                      onMouseLeave={(e) => { if (!cur) e.currentTarget.style.background = 'transparent'; }}
                      style={{ padding: '6px 10px', borderRadius: 6, cursor: 'pointer', background: cur ? hexToRgba(accentColor, 0.16) : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, transition: 'background 0.12s ease', whiteSpace: 'nowrap' }}
                    >
                      <span style={{ fontSize: 12, fontWeight: cur ? 500 : 400, color: cur ? accentColor : textPrimary, overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.label}</span>
                      {cur && <Check size={12} color={accentColor} style={{ flexShrink: 0 }} />}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
