import React, { useEffect, useState } from 'react';
import { PopupPortal, popupColors } from '../ui/PopupPortal';
import { InfoTip } from '../ui/InfoTip';
import { normalizeClarityId, normalizeDomain, normalizeGaId, validateSettings, type SiteSettings } from './siteSeo';

const FIELDS = [
  { key: 'domain', label: 'Domínio', placeholder: 'meusite.com.br', tip: 'Domínio onde o site vai ficar. Entra como endereço canônico (canonical e og:url) no HTML baixado. Depois, aponte o DNS do domínio para a hospedagem onde você publicar o arquivo.' },
  { key: 'gaId', label: 'Google Analytics (GA4)', placeholder: 'G-ABC123XYZ4', tip: 'ID de métricas do GA4: Admin > Fluxos de dados > seu site > ID da métrica. A tag só vai no HTML baixado, não no preview.' },
  { key: 'clarityId', label: 'Microsoft Clarity', placeholder: 'abcdefghij', tip: 'ID do projeto no Clarity: Configurações > Visão geral > ID do projeto. A tag só vai no HTML baixado, não no preview.' },
] as const;

type Key = (typeof FIELDS)[number]['key'];

/** Domínio, Google Analytics e Microsoft Clarity do site (guardados no site.json; as tags entram no HTML baixado). */
export const SiteSettingsPopup: React.FC<{
  anchor: HTMLElement | null;
  open: boolean;
  onClose: () => void;
  isDark: boolean;
  accentColor: string;
  accentTextColor: string;
  value: SiteSettings;
  onSave: (v: SiteSettings) => void;
}> = ({ anchor, open, onClose, isDark, accentColor, accentTextColor, value, onSave }) => {
  const pc = popupColors(isDark);
  const [draft, setDraft] = useState<Record<Key, string>>({ domain: '', gaId: '', clarityId: '' });
  const [errors, setErrors] = useState<Partial<Record<Key, string>>>({});

  useEffect(() => {
    if (open) {
      setDraft({ domain: value.domain || '', gaId: value.gaId || '', clarityId: value.clarityId || '' });
      setErrors({});
    }
  }, [open, value.domain, value.gaId, value.clarityId]);

  const save = () => {
    const errs = validateSettings(draft);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    onSave({
      domain: normalizeDomain(draft.domain) || undefined,
      gaId: normalizeGaId(draft.gaId) || undefined,
      clarityId: normalizeClarityId(draft.clarityId) || undefined,
    });
    onClose();
  };

  return (
    <PopupPortal anchor={anchor} open={open} onClose={onClose} width={320} align="right" maxHeight={420} isDark={isDark}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 6 }}>
        <div style={{ fontSize: 13, fontWeight: 500, color: pc.text }}>Configurações do site</div>
        {FIELDS.map((f) => (
          <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: pc.sub }}>
              {f.label}
              <InfoTip text={f.tip} isDark={isDark} />
            </div>
            <input
              value={draft[f.key]}
              onChange={(e) => setDraft((d) => ({ ...d, [f.key]: e.target.value }))}
              onKeyDown={(e) => e.key === 'Enter' && save()}
              placeholder={f.placeholder}
              spellCheck={false}
              style={{ height: 30, boxSizing: 'border-box', width: '100%', padding: '0 10px', borderRadius: 6, border: 'none', outline: 'none', background: pc.field, color: pc.text, fontSize: 12, fontFamily: 'inherit', transition: 'background-color 0.15s ease' }}
            />
            {errors[f.key] && <div style={{ fontSize: 11, color: '#e5484d' }}>{errors[f.key]}</div>}
          </div>
        ))}
        <button
          type="button"
          onClick={save}
          style={{ height: 30, border: 'none', borderRadius: 6, background: accentColor, color: accentTextColor, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer', transition: 'opacity 0.15s ease' }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = '0.85')}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = '1')}
        >
          Salvar
        </button>
      </div>
    </PopupPortal>
  );
};
