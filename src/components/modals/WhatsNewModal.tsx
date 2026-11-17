import React, { useEffect, useState } from 'react';
import { Sparkles, TrendingUp, Wrench, X } from 'lucide-react';
import type { ChangelogRelease } from '../../changelog/parseChangelog';
import { ImageLightbox } from '../ui/ImageLightbox';
import { getContrastTextColor } from '../../utils/color';

const SECTION_ICON: Record<string, React.ComponentType<{ size?: number; color?: string }>> = {
  novidades: Sparkles,
  melhorias: TrendingUp,
  'correções': Wrench,
  correcoes: Wrench,
};

const resolveSrc = (src: string) => (/^(https?:|data:|file:)/.test(src) ? src : `./${src.replace(/^\.?\//, '')}`);

/** Novidades da versão: abre na primeira vez que o app roda depois de instalar ou atualizar, com o texto do CHANGELOG.md e prints de referência. */
export const WhatsNewModal: React.FC<{
  releases: ChangelogRelease[];
  onClose: () => void;
  accentColor: string;
  isDark: boolean;
  themeTokens: any;
}> = ({ releases, onClose, accentColor, isDark, themeTokens }) => {
  const [zoom, setZoom] = useState<string | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setShown(true));
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !zoom) onClose(); };
    window.addEventListener('keydown', onKey);
    return () => { cancelAnimationFrame(id); window.removeEventListener('keydown', onKey); };
  }, [onClose, zoom]);

  if (!releases.length) return null;
  const bg = themeTokens?.modalBg || themeTokens?.bgCard || (isDark ? '#161616' : '#ffffff');
  const text = themeTokens?.textPrimary || (isDark ? '#f4f4f5' : '#0f172a');
  const sub = themeTokens?.textSecondary || (isDark ? '#a1a1aa' : '#64748b');
  const field = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)';
  const divider = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.08)';
  const latest = releases[0];

  return (
    <div
      className="df-modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 100010, background: themeTokens?.modalOverlay || 'rgba(0,0,0,0.65)', backdropFilter: 'blur(6px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, WebkitAppRegion: 'no-drag' as any }}
    >
      <div
        className="df-modal-content"
        style={{ width: '100%', maxWidth: 680, maxHeight: 'min(780px, calc(100vh - 40px))', background: bg, borderRadius: 12, display: 'flex', flexDirection: 'column', overflow: 'hidden', fontFamily: 'Poppins, sans-serif', color: text, opacity: shown ? 1 : 0, transform: shown ? 'none' : 'translateY(8px)', transition: 'opacity 220ms var(--ease-out), transform 260ms var(--ease-out)' }}
      >
        <div style={{ padding: 16, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 36, height: 36, borderRadius: 9, background: accentColor, color: getContrastTextColor(accentColor), display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 500, letterSpacing: '-0.01em' }}>Novidades do Aura Dev</div>
              <div style={{ fontSize: 12, color: sub }}>Versão {latest.version}{latest.date ? ` · ${latest.date.split('-').reverse().join('/')}` : ''}</div>
            </div>
          </div>
          <button type="button" className="df-pressable" title="Fechar (Esc)" onClick={onClose} style={{ width: 30, height: 30, borderRadius: 6, border: 'none', background: 'transparent', color: sub, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <X size={16} />
          </button>
        </div>

        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {releases.map((rel, ri) => (
            <div key={rel.version} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {releases.length > 1 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: sub, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  <span>Versão {rel.version}</span>
                  <span style={{ flex: 1, height: 1, background: divider }} />
                </div>
              )}
              {rel.sections.filter((s) => s.items.length).map((sec, si) => {
                const Icon = SECTION_ICON[sec.title.toLowerCase()] || Sparkles;
                return (
                  <div key={sec.title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 500 }}>
                      <Icon size={13} color={accentColor} />
                      {sec.title}
                    </div>
                    {sec.items.map((it, ii) => (
                      <div key={ii} style={{ padding: 12, borderRadius: 8, background: field, display: 'flex', flexDirection: 'column', gap: 8, animation: `brainFadeUp 260ms var(--ease-out) ${Math.min(ri * 3 + si * 2 + ii, 10) * 40}ms both` }}>
                        <div style={{ fontSize: 12.5, lineHeight: 1.55 }}>
                          {it.title && <span style={{ fontWeight: 500 }}>{it.title}</span>}
                          {it.title && it.text ? <span style={{ color: sub }}>{': '}</span> : null}
                          <span style={{ color: it.title ? sub : text }}>{it.text}</span>
                        </div>
                        {it.images.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                            {it.images.map((im, k) => (
                              <img
                                key={k}
                                src={resolveSrc(im.src)}
                                alt={im.alt}
                                title="Clique para ampliar"
                                onClick={() => setZoom(resolveSrc(im.src))}
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
                                style={{ maxWidth: '100%', maxHeight: 220, borderRadius: 6, cursor: 'zoom-in', objectFit: 'contain', background: isDark ? '#0d0d0d' : '#f1f1f2', transition: 'transform 160ms var(--ease-out)' }}
                                onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.01)')}
                                onMouseLeave={(e) => (e.currentTarget.style.transform = 'none')}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <div style={{ padding: 16, display: 'flex', justifyContent: 'flex-end', flexShrink: 0, borderTop: `1px solid ${divider}` }}>
          <button type="button" className="df-pressable" onClick={onClose} style={{ height: 30, padding: '0 16px', borderRadius: 6, border: 'none', background: accentColor, color: getContrastTextColor(accentColor), fontSize: 12, fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>
            Entendi
          </button>
        </div>
      </div>
      <ImageLightbox src={zoom} onClose={() => setZoom(null)} />
    </div>
  );
};
