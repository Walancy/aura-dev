import { useEffect, useMemo, useRef, useState } from 'react';
import AutoAwesomeOutlined from '@mui/icons-material/AutoAwesomeOutlined';
import AutorenewRounded from '@mui/icons-material/AutorenewRounded';
import PictureAsPdfOutlined from '@mui/icons-material/PictureAsPdfOutlined';
import { DevFlowSelect } from '../ui/DevFlowSelect';
import { COVER_VARIANTS, DOC_FONTS, type DocTheme } from './figcraftDocs';

const PAGE_W = 794; // A4 a 96 dpi

interface Colors { bg: string; dark: boolean; accent: string; text: string; muted: string; card: string; canvas: string; line: string; field: string }

/** Previa da documentacao no centro: as paginas A4 renderizadas (mesmo HTML do PDF). */
export function DocPreview({ html, c, rect }: { html: string; c: Colors; rect: { x: number; y: number; w: number; h: number } }) {
  const ref = useRef<HTMLIFrameElement>(null);
  const [h, setH] = useState(1200);
  const [shown, setShown] = useState(html);
  useEffect(() => { const t = setTimeout(() => setShown(html), 120); return () => clearTimeout(t); }, [html]);
  const pad = 20;
  const scale = Math.min(1, (rect.w - pad * 2) / PAGE_W);
  return (
    <div style={{ position: 'absolute', top: rect.y, left: rect.x, width: rect.w, height: rect.h, background: c.canvas, borderRadius: 10, overflowY: 'auto', overflowX: 'hidden', zIndex: 190, padding: pad, boxSizing: 'border-box' }}>
      <div style={{ width: PAGE_W * scale, height: h * scale, margin: '0 auto', borderRadius: 6, overflow: 'hidden', transition: 'width .2s ease, height .2s ease' }}>
        <iframe
          ref={ref}
          title="Prévia da documentação"
          srcDoc={shown}
          sandbox="allow-same-origin"
          scrolling="no"
          onLoad={() => { const m = () => { const d = ref.current?.contentDocument; if (d) setH(Math.max(400, Math.ceil(d.body.getBoundingClientRect().height))); }; m(); setTimeout(m, 300); }}
          style={{ width: PAGE_W, height: h, border: 'none', background: '#fff', display: 'block', transform: `scale(${scale})`, transformOrigin: 'top left' }}
        />
      </div>
    </div>
  );
}

/** Cartao de chat com a IA no estilo do chat da IDE: fundo em degradê com o destaque, campo escuro, linha divisória e barra de ações. */
export function AiComposer({ c, title, value, onChange, placeholder, onSubmit, busy, disabled, status, error, icon, hint, rows = 3 }: {
  c: Colors; title: string; value: string; onChange: (v: string) => void; placeholder: string; onSubmit: () => void; busy: boolean; disabled?: boolean;
  status?: string; error?: boolean; icon: React.ReactNode; hint: string; rows?: number;
}) {
  const hex = c.accent.replace('#', '');
  const rgba = (a: number) => `rgba(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)}, ${a})`;
  const off = busy || disabled;
  return (
    <div style={{ flexShrink: 0, borderRadius: 10, padding: 8, display: 'flex', flexDirection: 'column', gap: 8, fontFamily: font, background: c.dark ? `radial-gradient(ellipse 120% 160% at 5.85% 100%, ${rgba(0.2)} 0%, #101010 100%)` : `radial-gradient(ellipse 120% 160% at 5.85% 100%, ${rgba(0.22)} 0%, #ffffff 100%)`, transition: 'background .2s ease' }}>
      <span style={{ fontSize: 12, color: c.text, padding: '2px 4px' }}>{title}</span>
      {status && <span style={{ fontSize: 11.5, lineHeight: 1.4, color: error ? '#f87171' : c.muted, padding: '0 4px', userSelect: 'text', wordBreak: 'break-word' }}>{status}</span>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, borderRadius: 8, padding: '8px 10px', background: c.dark ? 'rgba(0,0,0,0.35)' : 'rgba(0,0,0,0.04)' }}>
        <textarea
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { e.stopPropagation(); if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!off) onSubmit(); } }}
          placeholder={placeholder}
          disabled={busy}
          style={{ width: '100%', boxSizing: 'border-box', minHeight: rows * 20 + 12, resize: 'none', background: 'transparent', border: 'none', outline: 'none', color: c.text, fontSize: 13, lineHeight: 1.5, fontFamily: font, padding: 0, userSelect: 'text' }}
        />
        <div style={{ height: 1, background: c.line }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 11, color: c.muted }}>{hint}</span>
          <button type="button" onClick={onSubmit} disabled={off} title={title} style={{ width: 28, height: 28, border: 'none', borderRadius: 8, padding: 0, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: off ? c.field : c.accent, color: off ? c.muted : '#fff', cursor: busy ? 'wait' : off ? 'default' : 'pointer', transition: 'background .15s ease, transform .1s ease' }}>
            {busy ? <AutorenewRounded sx={{ fontSize: 15 }} className="animate-spin" /> : icon}
          </button>
        </div>
      </div>
    </div>
  );
}

const FIELD = 28; // mesma altura dos dropdowns, botoes e campos
const PAD = 12;   // padding e gap iguais

const font = "'Poppins', sans-serif";

/** Rotulo acima do campo, como no painel de propriedades. */
function Field({ label, children, c, span = 1 }: { label?: string; children: React.ReactNode; c: Colors; span?: 1 | 2 }) {
  return (
    <div style={{ gridColumn: `span ${span}`, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {label && <span style={{ fontSize: 11.5, color: c.muted }}>{label}</span>}
      {children}
    </div>
  );
}

function Box({ c, children, style }: { c: Colors; children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ height: FIELD, borderRadius: 6, background: c.field, display: 'flex', alignItems: 'center', gap: 8, padding: '0 8px', minWidth: 0, ...style }}>{children}</div>;
}

function SliderField({ value, min, max, step, onChange, unit = '', c }: { value: number; min: number; max: number; step: number; onChange: (v: number) => void; unit?: string; c: Colors }) {
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <Box c={c}>
      <input
        type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        style={{ flex: 1, minWidth: 0, height: 4, margin: 0, cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', borderRadius: 2, outline: 'none', accentColor: c.accent, background: `linear-gradient(90deg, ${c.accent} ${pct}%, ${c.dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)'} ${pct}%)` }}
      />
      <span style={{ flex: '0 0 auto', minWidth: 34, textAlign: 'right', fontSize: 12, color: c.text }}>{Number.isInteger(step) ? value : value.toFixed(2)}{unit}</span>
    </Box>
  );
}

function ColorField({ value, onChange, c, allowEmpty }: { value: string; onChange: (v: string) => void; c: Colors; allowEmpty?: boolean }) {
  return (
    <Box c={c} style={{ position: 'relative' }}>
      <label style={{ width: 16, height: 16, borderRadius: 4, background: value || (c.dark ? '#2a2a2a' : '#cbd5e1'), flexShrink: 0, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
        <input type="color" value={value || '#000000'} onChange={(e) => onChange(e.target.value)} style={{ position: 'absolute', inset: -4, opacity: 0, cursor: 'pointer' }} />
      </label>
      <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: value ? c.text : c.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value ? value.replace('#', '').toUpperCase() : 'Padrão'}</span>
      {allowEmpty && value && (
        <button type="button" onClick={() => onChange('')} title="Voltar ao padrão do layout" style={{ border: 'none', background: 'transparent', color: c.muted, cursor: 'pointer', padding: 0, display: 'flex', fontSize: 14, lineHeight: 1 }}>−</button>
      )}
    </Box>
  );
}

function Toggle({ on, onChange, c }: { on: boolean; onChange: (v: boolean) => void; c: Colors }) {
  return (
    <button type="button" onClick={() => onChange(!on)} style={{ width: 34, height: 20, borderRadius: 10, border: 'none', background: on ? c.accent : c.dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.18)', position: 'relative', cursor: 'pointer', transition: 'background .15s ease', padding: 0, flexShrink: 0 }}>
      <span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: 8, background: '#fff', transition: 'left .15s ease' }} />
    </button>
  );
}

function Section({ title, c, children, last }: { title: string; c: Colors; children: React.ReactNode; last?: boolean }) {
  return (
    <>
      <div style={{ padding: PAD, display: 'flex', flexDirection: 'column', gap: PAD }}>
        <span style={{ fontSize: 13, color: c.text }}>{title}</span>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: PAD }}>{children}</div>
      </div>
      {!last && <div style={{ height: 1, background: c.line, flexShrink: 0 }} />}
    </>
  );
}

/** Coluna direita: opcoes de estilo da documentacao e pedido de visual para a IA (mesmo padrao do painel de propriedades). */
export function DocStylePanel({ theme, setTheme, onAi, aiBusy, aiStatus, aiError, onExport, canExport, c, themeTokens, rect }: {
  theme: DocTheme; setTheme: (t: DocTheme) => void; onAi: (request: string) => void; aiBusy: boolean; aiStatus: string; aiError: boolean;
  onExport: () => void; canExport: boolean; c: Colors; themeTokens: Record<string, string>; rect: { x: number; y: number; w: number; h: number };
}) {
  const [request, setRequest] = useState('');
  const set = <K extends keyof DocTheme>(k: K, v: DocTheme[K]) => setTheme({ ...theme, [k]: v });
  const sel = (v: any) => ({ value: v, themeTokens, isEffectiveDark: c.dark, accentColor: c.accent });
  const fontOpts = useMemo(() => DOC_FONTS.map((f) => ({ value: f.id, label: f.label })), []);
  const coverOpts = useMemo(() => COVER_VARIANTS.map((v) => ({ value: v.id, label: v.label })), []);
  return (
    <div style={{ position: 'absolute', top: rect.y, left: rect.x, width: rect.w, height: rect.h, background: c.bg, zIndex: 190, display: 'flex', flexDirection: 'column', gap: 5, fontFamily: font, fontWeight: 400, userSelect: 'none', overflow: 'hidden' }}>
      <div style={{ flexShrink: 0, background: c.card, borderRadius: 10, display: 'flex', alignItems: 'center', gap: PAD, padding: `0 ${PAD}px`, height: 48 }}>
        <span style={{ flex: 1, fontSize: 14, color: c.text }}>Estilo do documento</span>
        <button type="button" onClick={onExport} disabled={!canExport} title={canExport ? 'Exportar PDF' : 'Gere a documentação para exportar'} style={{ height: FIELD, border: 'none', borderRadius: 6, padding: '0 10px', background: canExport ? c.accent : c.field, color: canExport ? '#fff' : c.muted, fontSize: 12, cursor: canExport ? 'pointer' : 'default', display: 'flex', alignItems: 'center', gap: 6, fontFamily: font, transition: 'background .15s ease' }}>
          <PictureAsPdfOutlined sx={{ fontSize: 15 }} /> Exportar PDF
        </button>
      </div>
      <div style={{ flex: 1, minHeight: 0, background: c.card, borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
        <Section title="Tipografia" c={c}>
          <Field span={2} label="Fonte" c={c}><DevFlowSelect {...sel(theme.font)} options={fontOpts} onChange={(v) => set('font', String(v))} /></Field>
          <Field label="Tamanho" c={c}><SliderField c={c} value={theme.fontSize} min={9} max={18} step={0.5} onChange={(v) => set('fontSize', v)} /></Field>
          <Field label="Entrelinha" c={c}><SliderField c={c} value={theme.lineHeight} min={1.2} max={2.2} step={0.05} onChange={(v) => set('lineHeight', v)} /></Field>
          <Field label="Títulos" c={c}><SliderField c={c} value={theme.headingScale} min={0.7} max={1.8} step={0.05} onChange={(v) => set('headingScale', v)} unit="x" /></Field>
          <Field label="Peso dos títulos" c={c}>
            <DevFlowSelect {...sel(theme.headingWeight)} options={[{ value: 400, label: 'Regular' }, { value: 500, label: 'Médio' }, { value: 600, label: 'Semibold' }, { value: 700, label: 'Negrito' }]} onChange={(v) => set('headingWeight', Number(v))} />
          </Field>
        </Section>

        <Section title="Espaçamento" c={c}>
          <Field label="Margem (mm)" c={c}><SliderField c={c} value={theme.margin} min={8} max={36} step={1} onChange={(v) => set('margin', v)} /></Field>
          <Field label="Entre blocos" c={c}><SliderField c={c} value={theme.blockGap} min={4} max={48} step={1} onChange={(v) => set('blockGap', v)} /></Field>
          <Field label="Raio das telas" c={c}><SliderField c={c} value={theme.imageRadius} min={0} max={32} step={1} onChange={(v) => set('imageRadius', v)} /></Field>
        </Section>

        <Section title="Cor e capa" c={c}>
          <Field label="Destaque" c={c}><ColorField c={c} value={theme.accent} onChange={(v) => set('accent', v)} /></Field>
          <Field label="Alinhamento" c={c}>
            <DevFlowSelect {...sel(theme.coverAlign)} options={[{ value: 'left', label: 'À esquerda' }, { value: 'center', label: 'Centralizado' }]} onChange={(v) => set('coverAlign', v as DocTheme['coverAlign'])} />
          </Field>
          <Field span={2} label="Layout da capa" c={c}><DevFlowSelect {...sel(theme.coverVariant)} options={coverOpts} onChange={(v) => set('coverVariant', v as DocTheme['coverVariant'])} /></Field>
          <Field label="Fundo da capa" c={c}><ColorField c={c} allowEmpty value={theme.coverBg} onChange={(v) => set('coverBg', v)} /></Field>
          <Field label="Texto da capa" c={c}><ColorField c={c} allowEmpty value={theme.coverFg} onChange={(v) => set('coverFg', v)} /></Field>
        </Section>

        <Section title="Conteúdo" c={c} last>
          {([['showIntro', 'Apresentação'], ['showScreens', 'Telas']] as const).map(([k, l]) => (
            <div key={k} style={{ gridColumn: 'span 2', height: FIELD, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: c.muted }}>{l}</span>
              <Toggle c={c} on={theme[k]} onChange={(v) => set(k, v)} />
            </div>
          ))}
          {theme.customCss && (
            <div style={{ gridColumn: 'span 2', height: FIELD, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: c.muted }}>Ajustes extras da IA</span>
              <button type="button" onClick={() => set('customCss', '')} style={{ border: 'none', background: 'transparent', color: c.accent, fontSize: 12, cursor: 'pointer', padding: 0, fontFamily: font }}>Remover</button>
            </div>
          )}
        </Section>
      </div>
      </div>
      <AiComposer c={c} title="Estilizar com IA" value={request} onChange={setRequest} placeholder="Ex.: visual corporativo azul, capa centralizada, fonte serifada e mais respiro..." onSubmit={() => onAi(request.trim())} busy={aiBusy} disabled={!request.trim()} status={aiStatus} error={aiError} icon={<AutoAwesomeOutlined sx={{ fontSize: 16 }} />} hint="Enter para aplicar o visual" />
    </div>
  );
}

