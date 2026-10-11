import React, { useEffect, useRef, useState } from 'react';
import { ArrowUp, Check, Settings, Shuffle, Sparkles, Paperclip, Plus, Wand2, X } from 'lucide-react';
import { AI_BRAND_COLORS } from '../../constants/ai';
import { DEFAULT_TOKENS, randomizePalette, type DesignTokens, type TokenSection } from './designTokens';
import AiModelSelect from './AiModelSelect';
import { ensureGoogleFont } from './fonts';
import FontPicker from './FontPicker';
import { ScrubbableNumberInput } from './ScrubbableNumberInput';

interface Props {
  tokens: Record<string, any>;
  accentColor: string;
  value: DesignTokens | null;
  onChange: (t: DesignTokens | null) => void;
  /** Deduz do design atual (sem IA). Devolve false se não houver o que extrair. */
  onExtract: () => boolean;
  onBack: () => void;
  isDark?: boolean;
  /** última troca em massa (extrair/gerar): mostra a barra para reverter */
  undoInfo?: { label: string; hadBefore: boolean; section: 'all' | 'colors' | TokenSection } | null;
  onUndo?: () => void;
  onDismissUndo?: () => void;
  /** troca em massa (randomizar paleta, seção gerada pela IA) com opção de reverter */
  onReplace?: (next: DesignTokens, label: string, section?: 'all' | 'colors' | TokenSection) => void;
  /** pede à IA uma nova versão de uma seção; devolve a mensagem de erro, se houver */
  onAiSection?: (section: TokenSection) => Promise<string | null>;
}

/** Imagem anexada → JPEG de até 1280px (leve para a CLI abrir). */
function downscale(file: File): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onerror = () => rej(r.error);
    r.onload = () => {
      const im = new Image();
      im.onerror = () => rej(new Error('imagem inválida'));
      im.onload = () => {
        const k = Math.min(1, 1280 / Math.max(im.width, im.height));
        const c = document.createElement('canvas');
        c.width = Math.round(im.width * k);
        c.height = Math.round(im.height * k);
        c.getContext('2d')!.drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/jpeg', 0.8));
      };
      im.src = String(r.result);
    };
    r.readAsDataURL(file);
  });
}

/** Painel "Design tokens" (ocupa a coluna da direita no lugar das propriedades). Mesmo padrão visual do inspetor. */
export default function DesignTokensPanel({ tokens: th, accentColor, value, onChange, onExtract, onBack, isDark = true, undoInfo, onUndo, onDismissUndo, onReplace, onAiSection }: Props) {
  const [msg, setMsg] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busySection, setBusySection] = useState<TokenSection | null>(null);
  const t = value;
  const fam = t?.fontFamily;
  useEffect(() => {
    if (!fam) return;
    const id = setTimeout(() => ensureGoogleFont(fam), 350); // espera terminar de digitar o nome
    return () => clearTimeout(id);
  }, [fam]);
  const set = (patch: Partial<DesignTokens>) => t && onChange({ ...t, ...patch });
  const divider = th.border;
  const field: React.CSSProperties = { background: th.bgApp, border: `1px solid ${th.border}`, borderRadius: 6, color: th.textPrimary, fontSize: 11, height: 26, padding: '0 8px', outline: 'none', minWidth: 0, fontFamily: "'Poppins', sans-serif", boxSizing: 'border-box' };
  const ghost: React.CSSProperties = { background: 'transparent', border: `1px solid ${th.border}`, borderRadius: 6, color: th.textSecondary, fontSize: 11, height: 26, padding: '0 9px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: "'Poppins', sans-serif" };
  const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: th.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 3, borderRadius: 4 };
  const section = (title: string, children: React.ReactNode, action?: React.ReactNode) => (
    <div style={{ padding: '12px 14px', borderBottom: `1px solid ${divider}`, display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <span style={{ fontSize: 11, fontWeight: 600, color: th.textPrimary, flex: 1 }}>{title}</span>
        {action}
      </div>
      {children}
    </div>
  );
  const add = (onClick: () => void, title: string) => (
    <button type="button" onClick={onClick} title={title} style={iconBtn}><Plus size={13} /></button>
  );

  const aiBtn = (section: TokenSection, title: string) => (
    <button
      type="button"
      disabled={!!busySection}
      onClick={async () => {
        setBusySection(section);
        setMsg(null);
        const err = await onAiSection?.(section);
        setBusySection(null);
        if (err) setMsg(err);
      }}
      title={title}
      style={{ ...iconBtn, color: accentColor, opacity: busySection && busySection !== section ? 0.4 : 1 }}
    >
      {busySection === section ? <span style={{ width: 12, height: 12, border: `2px solid ${accentColor}55`, borderTopColor: accentColor, borderRadius: 6, animation: 'spin 0.8s linear infinite', display: 'block' }} /> : <Sparkles size={13} />}
    </button>
  );
  // aceitar (✓) / desfazer (✗) a última troca em massa: só ícones, sempre à direita do ícone da IA daquela seção
  const undoIcons = (sec: 'all' | 'colors' | TokenSection) =>
    undoInfo && undoInfo.section === sec ? (
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 4px', borderRadius: 8, background: 'rgba(128,128,128,0.2)' }}>
        <button type="button" onClick={onDismissUndo} title="Manter" style={{ ...iconBtn, color: accentColor }}><Check size={14} strokeWidth={2.6} /></button>
        <button type="button" onClick={onUndo} title={undoInfo.hadBefore ? 'Reverter' : 'Desfazer'} style={{ ...iconBtn, color: th.textSecondary }}><X size={14} strokeWidth={2.4} /></button>
      </div>
    ) : null;
  const row2 = (...nodes: React.ReactNode[]) => <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>{nodes}</div>;

  const modeBtn = (m: 'dark' | 'light', label: string) => (
    <button type="button" onClick={() => t && onChange({ ...t, mode: m })} title={`A IA usa o modo ${label.toLowerCase()}`} style={{ border: 'none', background: t?.mode === m ? accentColor : 'transparent', color: t?.mode === m ? '#fff' : th.textSecondary, fontSize: 10.5, fontWeight: 600, padding: '3px 9px', borderRadius: 5, cursor: 'pointer', fontFamily: "'Poppins', sans-serif" }}>{label}</button>
  );
  const swatch = (hex: string, onPick: (v: string) => void, title: string) => (
    <label title={title} style={{ width: '100%', height: 30, borderRadius: 6, background: hex, border: `1px solid ${th.border}`, cursor: 'pointer', display: 'block', position: 'relative', overflow: 'hidden' }}>
      <input type="color" value={hex.slice(0, 7)} onChange={(e) => onPick(e.target.value.toUpperCase())} style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer' }} />
    </label>
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: th.bgCard, color: th.textPrimary, fontFamily: "'Poppins', sans-serif" }} onKeyDown={(e) => e.stopPropagation()}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderBottom: `1px solid ${divider}`, flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, flex: 1 }}>Design tokens</span>
        {undoIcons('all')}
        <div style={{ position: 'relative' }}>
          <button type="button" onClick={() => setMenuOpen((v) => !v)} title="Opções dos tokens" style={{ ...iconBtn, background: menuOpen ? 'rgba(128,128,128,0.2)' : 'transparent' }}><Settings size={15} /></button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setMenuOpen(false)} />
              <div style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, background: th.bgCardElevated || th.bgApp, border: `1px solid ${th.border}`, borderRadius: 8, boxShadow: '0 8px 24px rgba(0,0,0,0.5)', padding: '4px 0', minWidth: 210, zIndex: 100, whiteSpace: 'nowrap' }}>
                {[
                  { label: 'Extrair do design', run: () => { setMenuOpen(false); setMsg(onExtract() ? null : 'Não há design suficiente para extrair os tokens.'); }, disabled: false, danger: false },
                  { label: 'Remover tokens', run: () => { setMenuOpen(false); onChange(null); }, disabled: !t, danger: true },
                ].map((it) => (
                  <div
                    key={it.label}
                    onClick={() => { if (!it.disabled) it.run(); }}
                    style={{ padding: '7px 12px', fontSize: 11, color: it.danger ? '#EF4444' : th.textPrimary, opacity: it.disabled ? 0.4 : 1, cursor: it.disabled ? 'default' : 'pointer', fontFamily: "'Poppins', sans-serif" }}
                    onMouseEnter={(e) => { if (!it.disabled) e.currentTarget.style.background = th.hoverBg; }}
                    onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                  >
                    {it.label}
                  </div>
                ))}
                <div style={{ height: 1, background: 'rgba(128,128,128,0.35)', margin: '6px 0' }} />
                <div
                  onClick={() => t && onChange({ ...t, enabled: t.enabled === false ? true : false })}
                  style={{ padding: '7px 12px', display: 'flex', alignItems: 'center', gap: 10, fontSize: 11, color: th.textPrimary, opacity: t ? 1 : 0.4, cursor: t ? 'pointer' : 'default', fontFamily: "'Poppins', sans-serif" }}
                  title="Quando desligado, a IA ignora os tokens (eles continuam salvos)"
                >
                  <span style={{ flex: 1 }}>IA segue</span>
                  <span style={{ position: 'relative', width: 28, height: 16, borderRadius: 8, background: t && t.enabled !== false ? accentColor : 'rgba(128,128,128,0.35)', flexShrink: 0, transition: 'background 0.15s ease' }}>
                    <span style={{ position: 'absolute', top: 2, left: t && t.enabled !== false ? 14 : 2, width: 12, height: 12, borderRadius: 6, background: '#fff', transition: 'left 0.15s ease' }} />
                  </span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overflowX: 'hidden' }}>
        {!t && (
          <div style={{ padding: '24px 18px', display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 12, fontWeight: 600 }}>Nenhum token definido</span>
            <span style={{ fontSize: 11, color: th.textSecondary, lineHeight: 1.55 }}>Com tokens (cores nos modos escuro e claro, tipografia, espaçamentos e raios), tudo que a IA criar ou alterar neste projeto segue o mesmo sistema. Descreva o estilo ou cole uma tela de outro projeto (Ctrl+V) na caixa de baixo, ou comece por aqui:</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button type="button" style={ghost} onClick={() => setMsg(onExtract() ? null : 'Não há design suficiente para extrair os tokens.')}><Wand2 size={12} />Extrair do design</button>
              <button type="button" style={ghost} onClick={() => onChange(DEFAULT_TOKENS)}>Começar do padrão</button>
            </div>
          </div>
        )}

        {t && (
          <>
            {section('Cores', (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 64px 64px 16px', gap: 8, alignItems: 'center' }}>
                  <span />
                  <span style={{ fontSize: 10, color: th.textMuted, textAlign: 'center' }}>Escuro</span>
                  <span style={{ fontSize: 10, color: th.textMuted, textAlign: 'center' }}>Claro</span>
                  <span />
                  {t.colors.map((c, i) => (
                    <React.Fragment key={i}>
                      <input value={c.name} onChange={(e) => set({ colors: t.colors.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)) })} style={{ background: 'transparent', border: 'none', outline: 'none', color: th.textPrimary, fontSize: 11, fontWeight: 500, padding: 0, minWidth: 0, fontFamily: "'Poppins', sans-serif" }} />
                      {swatch(c.dark, (v) => set({ colors: t.colors.map((x, j) => (j === i ? { ...x, dark: v } : x)) }), `Escuro ${c.dark}`)}
                      {swatch(c.light, (v) => set({ colors: t.colors.map((x, j) => (j === i ? { ...x, light: v } : x)) }), `Claro ${c.light}`)}
                      <button type="button" onClick={() => set({ colors: t.colors.filter((_, j) => j !== i) })} title="Remover cor" style={{ ...iconBtn, padding: 1 }}><X size={11} /></button>
                    </React.Fragment>
                  ))}
                </div>
              </>
            ), (
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: th.textMuted }}>IA usa</span>
                <div style={{ display: 'flex', background: th.bgApp, border: `1px solid ${th.border}`, borderRadius: 7, padding: 2 }}>{modeBtn('dark', 'Escuro')}{modeBtn('light', 'Claro')}</div>
                {undoIcons('colors')}
                <button type="button" onClick={() => onReplace?.(randomizePalette(t), 'Paleta randomizada', 'colors')} title="Randomizar paleta (esquemas harmônicos, estilo Coolors)" style={{ ...iconBtn, color: accentColor }}><Shuffle size={14} /></button>
                                {add(() => set({ colors: [...t.colors, { name: `cor-${t.colors.length + 1}`, dark: '#888888', light: '#888888' }] }), 'Adicionar cor')}
              </div>
            ))}

            {section('Tipografia', (
              <>
                <FontPicker value={t.fontFamily} onChange={(f) => set({ fontFamily: f })} tokens={th} accentColor={accentColor} />
                {t.type.map((x, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span style={{ width: 34, textAlign: 'center', fontFamily: `'${t.fontFamily}', sans-serif`, fontSize: Math.min(x.size, 24), fontWeight: x.weight, color: th.textPrimary, flexShrink: 0, lineHeight: 1 }}>Aa</span>
                    <input value={x.name} onChange={(e) => set({ type: t.type.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })} style={{ ...field, flex: 1 }} />
                    <ScrubbableNumberInput pixelsPerStep={4} value={x.size} min={8} max={120} title="Tamanho (px) — arraste para ajustar" themeTokens={th} accentColor={accentColor} isEffectiveDark={isDark} style={{ width: 56, flexShrink: 0 }} onChange={(v) => set({ type: t.type.map((y, j) => (j === i ? { ...y, size: Math.round(v) } : y)) })} />
                    <ScrubbableNumberInput pixelsPerStep={28} value={x.weight} min={100} max={900} step={100} title="Peso — arraste para ajustar" themeTokens={th} accentColor={accentColor} isEffectiveDark={isDark} style={{ width: 62, flexShrink: 0 }} onChange={(v) => set({ type: t.type.map((y, j) => (j === i ? { ...y, weight: Math.min(900, Math.max(100, Math.round(v / 100) * 100)) } : y)) })} />
                    <button type="button" onClick={() => set({ type: t.type.filter((_, j) => j !== i) })} title="Remover nível" style={iconBtn}><X size={11} /></button>
                  </div>
                ))}
              </>
            ), row2(undoIcons('type'), aiBtn('type', 'Gerar nova tipografia com IA'), add(() => set({ type: [...t.type, { name: `nivel-${t.type.length + 1}`, size: 16, weight: 400 }] }), 'Adicionar nível')))}

            {section('Espaçamentos', (
              <>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexWrap: 'wrap' }}>
                  {t.spacing.map((n) => (
                    <div key={n} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                      <span style={{ width: Math.min(n, 48), height: 8, background: accentColor, opacity: 0.8, borderRadius: 2, display: 'block' }} />
                      <span style={{ fontSize: 10, color: th.textSecondary }}>{n}</span>
                    </div>
                  ))}
                </div>
                <input
                  defaultValue={t.spacing.join(', ')}
                  key={t.spacing.join(',')}
                  onBlur={(e) => { const list = [...new Set(e.target.value.split(/[,\s]+/).map(Number).filter((n) => n > 0 && n <= 200))].sort((a, b) => a - b); if (list.length) set({ spacing: list }); }}
                  title="Valores em px separados por vírgula"
                  style={field}
                />
              </>
            ), row2(undoIcons('spacing'), aiBtn('spacing', 'Gerar nova escala de espaçamentos com IA')))}

            {section('Raios', (
              <>
                {t.radii.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <span title={`Canto com raio ${r.value}px`} style={{ width: 40, height: 40, borderTop: `2px solid ${accentColor}`, borderLeft: `2px solid ${accentColor}`, borderTopLeftRadius: Math.min(r.value, 40), background: `linear-gradient(135deg, ${accentColor}22, transparent 60%)`, flexShrink: 0, boxSizing: 'border-box' }} />
                    <input value={r.name} onChange={(e) => set({ radii: t.radii.map((y, j) => (j === i ? { ...y, name: e.target.value } : y)) })} style={{ ...field, flex: 1 }} />
                    <ScrubbableNumberInput pixelsPerStep={3} value={r.value} min={0} max={999} title="Raio (px) — arraste para ajustar" themeTokens={th} accentColor={accentColor} isEffectiveDark={isDark} style={{ width: 70, flexShrink: 0 }} onChange={(v) => set({ radii: t.radii.map((y, j) => (j === i ? { ...y, value: Math.round(v) } : y)) })} />
                    <button type="button" onClick={() => set({ radii: t.radii.filter((_, j) => j !== i) })} title="Remover raio" style={iconBtn}><X size={11} /></button>
                  </div>
                ))}
              </>
            ), row2(undoIcons('radii'), aiBtn('radii', 'Gerar novos raios com IA'), add(() => set({ radii: [...t.radii, { name: `r${t.radii.length + 1}`, value: 16 }] }), 'Adicionar raio')))}

            {msg && <div style={{ padding: '0 14px', fontSize: 10.5, color: '#EF4444' }}>{msg}</div>}
          </>
        )}
      </div>

    </div>
  );
}

interface ComposerProps {
  tokens: Record<string, any>;
  accentColor: string;
  hasTokens: boolean;
  onGenerate: (o: { prompt: string; images: string[] }) => Promise<string | null>;
  isDark?: boolean;
  selectedAiProvider?: string;
  selectedModel?: string;
  activeModels?: Record<string, any>;
  installedClis?: Record<string, boolean>;
  onSelectAiProvider?: (providerId: string) => void;
  onSelectModel?: (modelItem: { id: string; label: string }, providerId?: string) => void;
  onInstallAiCli?: (provider: any) => void;
}

/** Caixa de prompt da IA dos tokens (card próprio abaixo da lista): cor da IA, prompt, seletor de IA, Ctrl+V de imagens. */
export function DesignTokensComposer({ tokens: th, accentColor, hasTokens, onGenerate, isDark = true, selectedAiProvider, selectedModel, activeModels, installedClis, onSelectAiProvider, onSelectModel, onInstallAiCli }: ComposerProps) {
  const brand = AI_BRAND_COLORS[selectedAiProvider || 'claude'] || accentColor;
  const [prompt, setPrompt] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const iconBtn: React.CSSProperties = { background: 'transparent', border: 'none', color: th.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', padding: 3, borderRadius: 4 };
  const addFiles = async (files: File[]) => {
    const urls = await Promise.all(files.filter((f) => f.type.startsWith('image/')).slice(0, 3 - images.length).map((f) => downscale(f).catch(() => '')));
    setImages((p) => [...p, ...urls.filter(Boolean)].slice(0, 3));
  };
  const canGenerate = !busy && (!!prompt.trim() || images.length > 0);
  const generate = async () => {
    setBusy(true);
    setMsg(null);
    const err = await onGenerate({ prompt: prompt.trim(), images });
    setBusy(false);
    setMsg(err);
    if (!err) { setImages([]); setPrompt(''); }
  };
  return (
    <div style={{ fontFamily: "'Poppins', sans-serif" }} onKeyDown={(e) => e.stopPropagation()}>
        {msg && <div style={{ fontSize: 10.5, color: '#EF4444', padding: '0 4px 6px' }}>{msg}</div>}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { const f = [...e.dataTransfer.files]; if (f.some((x) => x.type.startsWith('image/'))) { e.preventDefault(); addFiles(f); } }}
          style={{ border: 'none', background: brand + '1A', borderRadius: 14, padding: 10, display: 'flex', flexDirection: 'column', gap: 8 }}
        >
          {images.length > 0 && (
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {images.map((u, i) => (
                <span key={i} style={{ position: 'relative', display: 'inline-flex' }}>
                  <img src={u} alt="" style={{ width: 44, height: 44, objectFit: 'cover', borderRadius: 8, border: `1px solid ${th.border}` }} />
                  <button type="button" onClick={() => setImages((p) => p.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -5, right: -5, width: 16, height: 16, borderRadius: 8, border: 'none', background: th.bgCardElevated || th.bgApp, color: th.textPrimary, cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={10} /></button>
                </span>
              ))}
            </div>
          )}
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onPaste={(e) => {
              const files = Array.from(e.clipboardData?.files || []).filter((f) => f.type.startsWith('image/'));
              if (files.length) { e.preventDefault(); addFiles(files); }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (canGenerate) generate(); } }}
            placeholder={hasTokens ? 'Peça ajustes nos tokens… (Ctrl+V para colar imagens)' : 'Descreva o estilo ou cole uma tela de referência (Ctrl+V)…'}
            rows={3}
            style={{ background: 'transparent', border: 'none', outline: 'none', resize: 'none', color: th.textPrimary, fontSize: 12, lineHeight: 1.5, fontFamily: "'Poppins', sans-serif", padding: 0 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input ref={fileRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={(e) => { addFiles([...(e.target.files || [])]); e.target.value = ''; }} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy || images.length >= 3} title="Anexar imagem de referência (até 3)" style={{ ...iconBtn, color: images.length ? brand : th.textMuted }}><Paperclip size={15} /></button>
            <AiModelSelect tokens={th} isDark={isDark} accentColor={accentColor} selectedAiProvider={selectedAiProvider} selectedModel={selectedModel} activeModels={activeModels} installedClis={installedClis} onSelectAiProvider={onSelectAiProvider} onSelectModel={onSelectModel} onInstallAiCli={onInstallAiCli} />
            <span style={{ flex: 1 }} />
            <button type="button" onClick={generate} disabled={!canGenerate} title={hasTokens ? 'Refinar tokens com IA' : 'Gerar tokens com IA'} style={{ width: 28, height: 28, borderRadius: 14, border: 'none', background: brand, color: '#111', cursor: canGenerate ? 'pointer' : 'default', opacity: canGenerate ? 1 : 0.4, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              {busy ? <span style={{ width: 12, height: 12, border: '2px solid #1118', borderTopColor: '#111', borderRadius: 6, animation: 'spin 0.8s linear infinite', display: 'block' }} /> : <ArrowUp size={15} strokeWidth={2.6} />}
            </button>
          </div>
        </div>
    </div>
  );
}
