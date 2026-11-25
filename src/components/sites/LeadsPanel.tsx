import React, { useRef, useState } from 'react';
import { ExternalLink, LayoutTemplate, Loader2, MapPin, MoreHorizontal, Search, Sparkles, Square, Trash2, Wand2 } from 'lucide-react';
import { PopupPortal, popupColors } from '../ui/PopupPortal';
import { ConfirmDeleteModal } from '../modals/ConfirmDeleteModal';

const SKIP_CLEAR_KEY = 'aura_sites_leads_skip_clear';
import { runSiteAi } from './siteAi';
import { buildLeadsPrompt, parseCandidateUrls, readLeads, writeLeads, whatsappUrl, hostOf, type SiteLead } from './siteLeads';
import { getContrastTextColor } from '../../utils/color';

const WaIcon: React.FC<{ size?: number }> = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12.04 2a9.9 9.9 0 0 0-8.5 14.9L2 22l5.25-1.38A9.9 9.9 0 1 0 12.04 2Zm5.8 14.1c-.25.7-1.4 1.34-1.95 1.4-.5.07-1.13.1-1.82-.12a16.7 16.7 0 0 1-1.65-.61c-2.9-1.25-4.78-4.17-4.92-4.36-.14-.2-1.17-1.55-1.17-2.96s.74-2.1 1-2.39c.26-.29.57-.36.76-.36h.55c.18 0 .42-.07.65.5.25.6.84 2.05.92 2.2.07.14.12.32.02.5-.1.2-.14.32-.29.5-.14.17-.3.38-.43.5-.14.15-.29.3-.12.6.17.3.75 1.23 1.6 2 1.1.98 2.03 1.28 2.32 1.43.29.14.46.12.63-.07.17-.2.73-.85.92-1.14.2-.29.4-.24.66-.14.27.1 1.7.8 2 .95.29.14.48.22.55.34.07.12.07.7-.18 1.4Z" />
  </svg>
);

interface Tokens { textPrimary: string; textSecondary: string; textMuted: string }

export const LeadsPanel: React.FC<{
  tokens: Tokens;
  fieldBg: string;
  hover: string;
  divider: string;
  accentColor: string;
  provider: string;
  model?: string;
  getCwd: () => Promise<string>;
  previewId?: string;
  onPreview: (l: SiteLead) => void;
  onOpen: (url: string) => void;
  isDark: boolean;
  themeTokens: any;
  /** coloca o site como referência no chat com o prompt pronto; o usuário só aperta Enter */
  onAsk: (l: SiteLead, kind: 'redesign' | 'modernize') => void;
  onToast?: (m: string) => void;
}> = ({ tokens, fieldBg, hover, divider, accentColor, provider, model, getCwd, previewId, onPreview, onOpen, isDark, themeTokens, onAsk, onToast }) => {
  const [confirmClear, setConfirmClear] = useState(false);
  const [menu, setMenu] = useState<{ lead: SiteLead; anchor: HTMLElement } | null>(null);
  const pc = popupColors(isDark);
  const [leads, setLeads] = useState<SiteLead[]>(readLeads);
  const [niche, setNiche] = useState('');
  const [region, setRegion] = useState('');
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState('');
  const [count, setCount] = useState(0);
  const [checked, setChecked] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const ctl = useRef<{ abort?: (why?: string) => void; onActivity?: (text: string) => void }>({});

  const save = (l: SiteLead[]) => {
    setLeads(l);
    writeLeads(l);
  };

  const search = async () => {
    if (busy) return;
    setBusy(true);
    setLive('');
    setCount(0);
    setChecked(0);
    setElapsed(0);
    const started = Date.now();
    const tick = setInterval(() => setElapsed(Math.round((Date.now() - started) / 1000)), 1000);
    // vários trabalhadores em paralelo, cada um com um recorte diferente: a busca acaba bem mais rápido
    const angles = region.trim()
      ? ['bairros e áreas centrais da região', 'termos de busca como "orçamento", "agendar" e "fale conosco"', 'negócios menores e cidades vizinhas da região']
      : ['São Paulo, Rio de Janeiro e Belo Horizonte', 'Curitiba, Porto Alegre, Florianópolis e Brasília', 'Salvador, Recife, Fortaleza, Goiânia e interior'];
    const ctls = angles.map(() => ({}) as { abort?: (why?: string) => void; onActivity?: (text: string) => void });
    ctl.current = {
      abort: (why) => ctls.forEach((c) => c.abort?.(why)),
    };
    try {
      // sites já listados nesta busca (e antes dela): cada endereço novo é conferido na hora pelo app
      const seen = new Set(leads.map((l) => hostOf(l.url)));
      const asked = new Set<string>();
      let total = 0;
      let acc = leads;
      const pendingChecks: Promise<void>[] = [];
      const check = (url: string) => {
        const host = hostOf(url);
        if (!host || seen.has(host) || asked.has(host)) return;
        asked.add(host);
        setChecked(asked.size);
        pendingChecks.push(
          (async () => {
            const lead = await (window as any).electronAPI?.fs?.analyzeLead?.(url, niche.trim()).catch(() => null);
            if (!lead) return;
            const h = hostOf(lead.url);
            if (seen.has(h)) return;
            seen.add(h);
            total++;
            setCount(total);
            acc = [{ ...lead, id: `l${Date.now().toString(36)}${total}`, city: region.trim() || undefined, foundAt: Date.now() } as SiteLead, ...acc];
            save(acc);
          })(),
        );
      };
      const cwd = await getCwd();
      const known = leads.map((l) => hostOf(l.url));
      const results = await Promise.allSettled(
        angles.map((angle, i) => {
          let streamed = '';
          ctls[i].onActivity = (t) => setLive(t);
          return runSiteAi({
            prompt: buildLeadsPrompt({ niche: niche.trim(), region: region.trim(), count: 14, known, angle }),
            provider,
            model,
            cwd,
            effort: 'low',
            ctl: ctls[i],
            onText: (t) => {
              streamed += t;
              parseCandidateUrls(streamed).forEach(check);
            },
          }).then((answer) => parseCandidateUrls(answer || streamed).forEach(check));
        }),
      );
      setLive('Conferindo os últimos sites...');
      await Promise.all(pendingChecks);
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected' && !/cancelad/i.test(String(r.reason?.message || r.reason)));
      if (total) {
        onToast?.(`${total} ${total === 1 ? 'site encontrado' : 'sites encontrados'}.`);
      } else if (failed.length === results.length) {
        onToast?.(`A busca falhou: ${failed[0].reason?.message || 'erro desconhecido'}`);
      } else if (!results.every((r) => r.status === 'rejected')) {
        onToast?.('Não encontrei sites novos com WhatsApp confirmado. Tente outro nicho ou região, ou uma IA com busca na web.');
      }
    } catch (e: any) {
      if (!/cancelad/i.test(e?.message || '')) onToast?.(`A busca falhou: ${e?.message || 'erro desconhecido'}`);
    } finally {
      clearInterval(tick);
      setBusy(false);
      setLive('');
      ctl.current = {};
    }
  };

  const clearAll = () => {
    save([]);
    onToast?.('Lista limpa.');
  };
  const askClear = () => {
    let skip = false;
    try {
      skip = localStorage.getItem(SKIP_CLEAR_KEY) === '1';
    } catch {}
    if (skip) clearAll();
    else setConfirmClear(true);
  };

  const field = (value: string, set: (v: string) => void, placeholder: string, icon: React.ReactNode) => (
    <div className="df-search-box" style={{ flex: 'none', width: '100%', boxSizing: 'border-box', height: 30, display: 'flex', alignItems: 'center', gap: 6, padding: '0 8px', borderRadius: 6, background: fieldBg }}>
      {icon}
      <input
        value={value}
        onChange={(e) => set(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && search()}
        placeholder={placeholder}
        style={{ flex: 1, minWidth: 0, width: '100%', background: 'transparent', border: 'none', outline: 'none', color: tokens.textPrimary, fontSize: 12, fontFamily: 'inherit', padding: 0 }}
      />
    </div>
  );

  const small = (title: string, onClick: () => void, child: React.ReactNode, danger = false, withEl?: (el: HTMLElement) => void) => (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); if (withEl) withEl(e.currentTarget); else onClick(); }}
      className="df-pressable"
      style={{ width: 26, height: 26, border: 'none', background: 'transparent', color: tokens.textSecondary, borderRadius: 5, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0, transition: 'color 150ms var(--ease-out), background-color 150ms var(--ease-out)' }}
      onMouseEnter={(e) => { e.currentTarget.style.color = danger ? '#ef4444' : accentColor; e.currentTarget.style.background = hover; }}
      onMouseLeave={(e) => { e.currentTarget.style.color = tokens.textSecondary; e.currentTarget.style.background = 'transparent'; }}
    >
      {child}
    </button>
  );

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {field(niche, setNiche, 'Nicho (opcional)', <Search size={12} color={tokens.textSecondary} />)}
        {field(region, setRegion, 'Cidade ou região (opcional)', <MapPin size={12} color={tokens.textSecondary} />)}
        {busy ? (
          <div style={{ position: 'relative', flex: 'none', display: 'flex', alignItems: 'center', gap: 8, padding: 8, borderRadius: 8, background: `${accentColor}1f`, overflow: 'hidden', animation: 'fadeIn 0.2s ease-out' }}>
            <Loader2 size={16} className="spin-animate" color={accentColor} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, color: tokens.textPrimary }}>
                Procurando sites{checked ? ` · ${checked} conferidos` : ''}{count ? ` · ${count} ${count === 1 ? 'encontrado' : 'encontrados'}` : ''}{elapsed >= 5 ? ` · ${elapsed}s` : ''}
              </div>
              <div style={{ fontSize: 10.5, color: tokens.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: 15 }}>{live || 'Iniciando as buscas...'}</div>
            </div>
            <button
              type="button"
              className="df-pressable"
              title="Parar a busca (os sites já encontrados ficam na lista)"
              onClick={() => ctl.current.abort?.('cancelado')}
              style={{ width: 28, height: 28, flexShrink: 0, border: 'none', borderRadius: 6, background: 'rgba(239, 68, 68, 0.18)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'background-color 150ms var(--ease-out)' }}
              onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.3)')}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(239, 68, 68, 0.18)')}
            >
              <Square size={10} fill="currentColor" />
            </button>
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 2, background: `linear-gradient(90deg, transparent, ${accentColor}, transparent)`, backgroundSize: '200% 100%', animation: 'dfShimmer 1.2s linear infinite' }} />
          </div>
        ) : (
        <div style={{ display: 'flex', gap: 6 }}>
          <button
            type="button"
            className="df-pressable"
            title="A IA procura sites antigos ou mal feitos com WhatsApp de contato"
            onClick={search}
            style={{ flex: 1, minWidth: 0, boxSizing: 'border-box', height: 30, border: 'none', borderRadius: 6, background: accentColor, color: getContrastTextColor(accentColor), display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, fontFamily: 'inherit', cursor: 'pointer' }}
          >
            <Sparkles size={13} />
            <span>{leads.length ? 'Buscar mais sites' : 'Captar sites'}</span>
          </button>
          {leads.length > 0 && (
            <button
              type="button"
              className="df-pressable"
              title="Limpar a lista de sites"
              onClick={askClear}
              style={{ flex: 'none', width: 30, height: 30, border: 'none', borderRadius: 6, background: hover, color: tokens.textSecondary, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'color 150ms var(--ease-out)' }}
              onMouseEnter={(e) => (e.currentTarget.style.color = '#ef4444')}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.textSecondary)}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
        )}
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
        {leads.length === 0 ? (
          <div style={{ fontSize: 12, color: tokens.textMuted, textAlign: 'center', padding: '24px 12px', lineHeight: 1.6 }}>Os sites encontrados aparecem aqui, com o botão para abrir o WhatsApp do negócio.</div>
        ) : (
          leads.map((l) => {
            const on = previewId === l.id;
            return (
              <div
                key={l.id}
                className="df-pressable"
                title={l.problems.length ? `${l.problems.map((p) => `- ${p}`).join('\n')}` : l.url}
                onClick={() => onPreview(l)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 6, borderRadius: 8, background: on ? hover : fieldBg, cursor: 'pointer', animation: 'fadeIn 0.2s ease-out', transition: 'background-color 150ms var(--ease-out)' }}
                onMouseEnter={(e) => { if (!on) e.currentTarget.style.background = hover; }}
                onMouseLeave={(e) => { if (!on) e.currentTarget.style.background = fieldBg; }}
              >
                <div style={{ flex: 1, minWidth: 0, padding: '0 2px' }}>
                  <div style={{ fontSize: 12, color: tokens.textPrimary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{l.name}</div>
                  <div style={{ fontSize: 10.5, color: tokens.textSecondary, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{hostOf(l.url)}</div>
                </div>
                <button
                  type="button"
                  className="df-pressable"
                  title={`Abrir o WhatsApp de ${l.name} (+${l.whatsapp})`}
                  onClick={(e) => { e.stopPropagation(); onOpen(whatsappUrl(l)); }}
                  style={{ width: 28, height: 28, flexShrink: 0, border: 'none', borderRadius: 6, background: '#1faa59', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', padding: 0, transition: 'filter 150ms var(--ease-out)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.filter = 'brightness(1.12)')}
                  onMouseLeave={(e) => (e.currentTarget.style.filter = 'none')}
                >
                  <WaIcon size={14} />
                </button>
                {small('Mais opções: pedir para a IA deixar o site bonito, abrir no navegador, remover', () => {}, <MoreHorizontal size={14} />, false, (el) => setMenu((m) => (m?.lead.id === l.id ? null : { lead: l, anchor: el }))) }
              </div>
            );
          })
        )}
      </div>
      <ConfirmDeleteModal
        isOpen={confirmClear}
        title="Limpar a lista"
        message={`Os ${leads.length} ${leads.length === 1 ? 'site da lista será removido' : 'sites da lista serão removidos'}.`}
        itemDescription="Esta ação não pode ser desfeita."
        confirmLabel="Limpar"
        themeTokens={themeTokens}
        accentColor={accentColor}
        onConfirm={() => {
          setConfirmClear(false);
          clearAll();
        }}
        onDontAskAgain={() => {
          try {
            localStorage.setItem(SKIP_CLEAR_KEY, '1');
          } catch {}
        }}
        onClose={() => setConfirmClear(false)}
      />
      <PopupPortal anchor={menu?.anchor || null} open={!!menu} onClose={() => setMenu(null)} width={250} isDark={isDark}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {([
            { Icon: Wand2, label: 'Deixar bonito: recriar com design novo', hint: 'Reaproveita textos, dados e mídias', run: () => onAsk(menu!.lead, 'redesign') },
            { Icon: LayoutTemplate, label: 'Modernizar mantendo a estrutura', hint: 'Mesmas páginas e ordem das seções', run: () => onAsk(menu!.lead, 'modernize') },
            { Icon: ExternalLink, label: 'Abrir no navegador', run: () => onOpen(menu!.lead.url) },
            { Icon: Trash2, label: 'Remover da lista', danger: true, run: () => save(leads.filter((x) => x.id !== menu!.lead.id)) },
          ] as Array<{ Icon: React.ComponentType<{ size?: number; color?: string }>; label: string; hint?: string; danger?: boolean; run: () => void }>).map((o) => (
            <div
              key={o.label}
              className="df-pressable"
              onClick={() => { const r = o.run; setMenu(null); r(); }}
              onMouseEnter={(e) => (e.currentTarget.style.background = pc.hover)}
              onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 10px', borderRadius: 5, cursor: 'pointer', fontSize: 12, fontFamily: 'Poppins', color: o.danger ? '#ef4444' : pc.text, transition: 'background-color 120ms var(--ease-out)' }}
            >
              <o.Icon size={13} color={o.danger ? '#ef4444' : pc.sub} />
              <span style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span>{o.label}</span>
                {o.hint && <span style={{ fontSize: 10.5, color: pc.sub }}>{o.hint}</span>}
              </span>
            </div>
          ))}
        </div>
      </PopupPortal>
    </>
  );
};
