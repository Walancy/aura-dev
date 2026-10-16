import { useEffect, useMemo, useState } from 'react';
import CloseRounded from '@mui/icons-material/CloseRounded';
import CheckRounded from '@mui/icons-material/CheckRounded';
import AutorenewRounded from '@mui/icons-material/AutorenewRounded';
import VisibilityOutlined from '@mui/icons-material/VisibilityOutlined';
import VisibilityOffOutlined from '@mui/icons-material/VisibilityOffOutlined';
import DescriptionOutlined from '@mui/icons-material/DescriptionOutlined';
import { logSystemActivity } from '../../utils/brainService';
import { DevFlowSelect } from '../ui/DevFlowSelect';
import { DOC_STYLES, buildDocHtml, buildDocPrompt, buildThemePrompt, collectFrameInfo, coverCss, defaultTheme, parseDoc, sampleDoc, sanitizeTheme, type CoverVariant, type DocResult, type DocStyle, type DocTheme, type FrameInfo } from './figcraftDocs';
import { AiComposer, DocPreview, DocStylePanel } from './FigcraftDocsStyle';
import type { FigcraftCall } from './figcraftAi';

interface Props {
  call: FigcraftCall;
  /** corpo do cartao da coluna esquerda do FigCraft (medido por ele): o painel e o conteudo desse cartao */
  rect: { x: number; y: number; w: number; h: number };
  /** largura das colunas do FigCraft e tamanho da janela: o centro e a direita sao calculados a partir delas */
  shell: { l: number; r: number; w: number; h: number; cx: number };
  onClose: () => void;
  themeTokens: Record<string, string>;
  accentColor: string;
  isEffectiveDark: boolean;
  projectName?: string;
  workspacePath: string;
  selectedAiProvider: string;
  selectedModel: string;
}

interface Frame { id: number; name: string }
interface DocEntry { id: string; style: DocStyle; screens: number; ts: number; message: string }

/** Telas da página: quadros no topo e, quando têm moldura de dispositivo, o quadro de dentro do grupo "Moldura: ...". */
const screensOf = (page: any): Array<{ frame: any; top: any }> => {
  const out: Array<{ frame: any; top: any }> = [];
  const inner = (n: any, d = 0): any | null => (n?.type === 'FRAME' ? n : d > 4 ? null : (n?.children || []).map((c: any) => inner(c, d + 1)).find(Boolean) || null);
  for (const top of page?.children || []) {
    if (top.type === 'SLICE' || top.type === 'SECTION') continue;
    const frame = top.type === 'FRAME' ? top : top.type === 'GROUP' ? inner(top) : null;
    if (frame) out.push({ frame, top });
  }
  return out;
};

/** A tela (quadro) que contém o nó `id`: o próprio quadro, o grupo da moldura ou algo dentro deles. */
const frameOf = (page: any, id: number): any | null => {
  const hit = (n: any): boolean => n.id === id || (n.children || []).some(hit);
  for (const s of screensOf(page)) if (hit(s.top)) return s.frame;
  return null;
};

/** Miniatura da capa do estilo (o mesmo visual da capa do PDF). */
function CoverPreview({ style, accent }: { style: CoverVariant; accent: string }) {
  const c = coverCss(style, accent, '3px');
  const bar = (w: number, h = 3, o = 0.9) => <span style={{ display: 'block', width: w, height: h, borderRadius: 2, background: 'currentColor', opacity: o }} />;
  return (
    <span
      style={{ position: 'relative', flexShrink: 0, width: 15, height: 21, borderRadius: 2, background: c.background, color: c.color, boxShadow: c.shadow === 'none' ? 'none' : c.shadow.replace(/9mm/g, '3px'), overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: `3px 2px 3px ${style === 'bar' ? 5 : style === 'duo' ? 7 : 2}px`, boxSizing: 'border-box' }}
    >
      {bar(5, 1, 0.6)}
      <span style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
        {bar(8, 1.5)}
        {bar(6, 1.5)}
        {bar(7, 1, 0.55)}
      </span>
    </span>
  );
}

/** Painel "Gerar documentacao com IA": estilo, telas selecionadas e o campo de instrucoes (design da tela Design, no Design 2). */
export default function FigcraftDocsPanel({ call, rect, shell, onClose, themeTokens, accentColor, isEffectiveDark, projectName, workspacePath, selectedAiProvider, selectedModel }: Props) {
  const accent = accentColor.length === 7 ? accentColor : '#f97316';
  const [style, setStyle] = useState<DocStyle>('proposta');
  const themeKey = `design2_docs_theme:${workspacePath}`;
  const [theme, setThemeState] = useState<DocTheme>(() => {
    const base = defaultTheme('proposta', accent);
    try { return sanitizeTheme(JSON.parse(localStorage.getItem(themeKey) || 'null'), base); } catch { return base; }
  });
  const setTheme = (t: DocTheme) => { setThemeState(t); try { localStorage.setItem(themeKey, JSON.stringify(t)); } catch { /* sem armazenamento */ } };
  const [previewOpen, setPreviewOpen] = useState(false);
  const [doc, setDoc] = useState<DocResult | null>(null);
  const [images, setImages] = useState<Record<number, string>>({});
  const [infos, setInfos] = useState<FrameInfo[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiStatus, setAiStatus] = useState('');
  const [aiError, setAiError] = useState(false);
  const [notes, setNotes] = useState('');
  const [selected, setSelected] = useState<Frame[]>([]);
  const [all, setAll] = useState<Frame[]>([]);
  const [useAll, setUseAll] = useState(false);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const [error, setError] = useState(false);
  const histKey = `design2_docs:${workspacePath}`;
  const [history, setHistory] = useState<DocEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem(histKey) || '[]'); } catch { return []; }
  });
  useEffect(() => { try { localStorage.setItem(histKey, JSON.stringify(history.slice(0, 20))); } catch { /* sem armazenamento */ } }, [history, histKey]);

  // telas (quadros) selecionadas no canvas, atualizadas enquanto o painel esta aberto
  useEffect(() => {
    let alive = true;
    const read = async () => {
      try {
        const d = await call('document.inspect', { depth: 8 });
        const page = (d.pages || []).find((p: any) => p.id === d.currentPage);
        const frames = screensOf(page).map((x) => x.frame);
        const picked = new Map<number, Frame>();
        for (const id of d.selection || []) {
          const f = frameOf(page, id);
          if (f && f.type === 'FRAME') picked.set(f.id, { id: f.id, name: f.name });
        }
        if (alive) {
          setAll(frames.map((f: any) => ({ id: f.id, name: f.name })));
          setSelected([...picked.values()]);
        }
      } catch { /* FigCraft ainda carregando */ }
    };
    read();
    const t = setInterval(read, 1500);
    return () => { alive = false; clearInterval(t); };
  }, [call]);

  const targets = useMemo(() => (useAll || selected.length === 0 ? (useAll ? all : []) : selected), [useAll, all, selected]);
  const st = DOC_STYLES.find((s) => s.id === style) || DOC_STYLES[0];

  // miniaturas das telas para a previa (reexporta so quando a selecao muda)
  const targetsKey = targets.map((t) => t.id).join(',');
  useEffect(() => {
    if (!targets.length) { setInfos([]); setImages({}); return; }
    let alive = true;
    const t = setTimeout(async () => {
      try {
        const d = await call('document.inspect', { depth: 10 });
        const page = (d.pages || []).find((p: any) => p.id === d.currentPage);
        const nodes = targets.slice(0, 6).map((x) => screensOf(page).find((sc) => sc.frame.id === x.id)?.frame).filter(Boolean);
        const imgs: Record<number, string> = {};
        for (const n of nodes) {
          const r = await call('engine.execute', { command: 'file.export', params: { ids: [n.id], format: 'jpg', scale: 0.8 } });
          if (r?.data) imgs[n.id] = `data:image/jpeg;base64,${r.data}`;
        }
        if (alive) { setInfos(nodes.map(collectFrameInfo)); setImages(imgs); }
      } catch { /* FigCraft ainda carregando */ }
    }, 500);
    return () => { alive = false; clearTimeout(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetsKey, call]);

  const shown: DocResult = useMemo(() => doc || sampleDoc(style, infos), [doc, style, infos]);
  const html = useMemo(() => buildDocHtml(shown, images, infos, { style, project: projectName, theme, preview: true }), [shown, images, infos, style, projectName, theme]);

  const pickStyle = (id: DocStyle) => {
    setStyle(id);
    const d = DOC_STYLES.find((x) => x.id === id) || DOC_STYLES[0];
    setTheme({ ...theme, coverVariant: d.cover, coverBg: '', coverFg: '' });
    setDoc(null);
  };

  const generate = async () => {
    if (busy) return;
    if (!targets.length) { setError(true); setStatus('Selecione uma ou mais telas no canvas, ou use todas as telas da página.'); return; }
    setBusy(true);
    setError(false);
    logSystemActivity('design', `Iniciou geracao de documentacao (${st.label}) no Design 2`, projectName || 'Estudio de Design', { telas: targets.length });
    try {
      setStatus('Renderizando as telas...');
      const d = await call('document.inspect', { depth: 10 });
      const page = (d.pages || []).find((p: any) => p.id === d.currentPage);
      const nodes = targets.map((t) => screensOf(page).find((sc) => sc.frame.id === t.id)?.frame).filter(Boolean);
      const imgs: Record<number, string> = {};
      for (const n of nodes) {
        const r = await call('engine.execute', { command: 'file.export', params: { ids: [n.id], format: 'jpg', scale: 1.5 } });
        if (r?.data) imgs[n.id] = `data:image/jpeg;base64,${r.data}`;
      }
      const frames = nodes.map(collectFrameInfo);
      setStatus(`${selectedAiProvider || 'A IA'} está analisando as telas...`);
      const res = await window.electronAPI.ai.prompt(buildDocPrompt({ style, frames, notes: notes.trim() || undefined, projectName }), selectedModel, workspacePath, selectedAiProvider, 240000);
      if (res.error || !res.response) throw new Error(res.error || 'Sem resposta da IA');
      const parsed = parseDoc(res.response, frames);
      if (!parsed) throw new Error('A IA não devolveu uma documentação válida. Tente novamente.');
      setImages(imgs);
      setInfos(frames);
      setDoc(parsed);
      setPreviewOpen(true);
      const message = 'Documentação gerada. Ajuste o estilo à direita e exporte o PDF.';
      setStatus(message);
      setHistory((h) => [{ id: `d${Date.now()}`, style, screens: frames.length, ts: Date.now(), message }, ...h]);
      logSystemActivity('design', `Concluiu geracao de documentacao (${st.label}) no Design 2`, projectName || 'Estudio de Design', { telas: frames.length });
    } catch (e: any) {
      setError(true);
      setStatus(e?.message || 'Falha ao gerar a documentação');
      logSystemActivity('design', 'Erro na geracao de documentacao no Design 2', projectName || 'Estudio de Design', { erro: e?.message || String(e) });
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    const api = (window as any).electronAPI?.fs;
    if (!doc || !api?.exportPdf) return;
    try {
      const out = await api.exportPdf(buildDocHtml(doc, images, infos, { style, project: projectName, theme }), doc.title);
      if (out.error) throw new Error(out.error);
      setError(false);
      setStatus(out.canceled ? 'Salvamento cancelado' : `Documento salvo em ${out.path}`);
      logSystemActivity('design', `Exportou documentacao em PDF (${st.label}) no Design 2`, projectName || 'Estudio de Design', {});
    } catch (e: any) {
      setError(true);
      setStatus(e?.message || 'Falha ao exportar o PDF');
    }
  };

  const aiStyle = async (request: string) => {
    setAiBusy(true);
    setAiError(false);
    setAiStatus(`${selectedAiProvider || 'A IA'} está criando o visual...`);
    logSystemActivity('design', 'Pediu estilo de documentacao para a IA no Design 2', projectName || 'Estudio de Design', { pedido: request.slice(0, 120) });
    try {
      const res = await window.electronAPI.ai.prompt(buildThemePrompt(request, theme, st.label, shown.title), selectedModel, workspacePath, selectedAiProvider, 120000);
      if (res.error || !res.response) throw new Error(res.error || 'Sem resposta da IA');
      const m = res.response.match(/\{[\s\S]*\}/);
      const next = sanitizeTheme(m ? JSON.parse(m[0]) : null, theme);
      if (JSON.stringify(next) === JSON.stringify(theme)) throw new Error('A IA não alterou nada. Descreva melhor o visual desejado.');
      setTheme(next);
      setAiStatus('Visual aplicado. Ajuste os controles abaixo se quiser.');
    } catch (e: any) {
      setAiError(true);
      setAiStatus(e?.message || 'Falha ao criar o visual');
    } finally {
      setAiBusy(false);
    }
  };

  const g = 5;
  const rightRect = { x: shell.w - shell.r, y: g, w: shell.r, h: shell.h - g };
  // o centro fica a 5px do cartao da esquerda e do cartao da direita
  const cx = shell.cx + g;
  const centerRect = { x: cx, y: g, w: Math.max(200, rightRect.x - g - cx), h: shell.h - g * 2 };
  const leftCol = { x: shell.cx - g - shell.l, y: rect.y, w: shell.l, h: shell.h - rect.y };
  const colors = {
    dark: isEffectiveDark, accent, text: themeTokens.textPrimary, muted: themeTokens.textMuted,
    card: isEffectiveDark ? '#101010' : '#ffffff', canvas: isEffectiveDark ? '#181818' : '#f1f5f9',
    bg: isEffectiveDark ? '#000000' : '#eaedf1', line: isEffectiveDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)', field: isEffectiveDark ? '#181818' : '#f1f5f9',
  };

  const soft = isEffectiveDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
  const label: React.CSSProperties = { fontSize: 11, fontWeight: 600, color: themeTokens.textPrimary, margin: '4px 0 6px' };

  return (
    <>
    {previewOpen && <DocPreview html={html} c={colors} rect={centerRect} />}
    {previewOpen && <DocStylePanel theme={theme} setTheme={setTheme} onAi={aiStyle} aiBusy={aiBusy} aiStatus={aiStatus} aiError={aiError} onExport={exportPdf} canExport={!!doc} c={colors} themeTokens={themeTokens} rect={rightRect} />}
    <div
      id="design2-docs-panel"
      style={{ position: 'absolute', top: leftCol.y, left: leftCol.x, width: leftCol.w, height: leftCol.h, background: colors.bg, display: 'flex', flexDirection: 'column', gap: g, zIndex: 200, fontFamily: "'Poppins', sans-serif", userSelect: 'none', overflow: 'hidden' }}
    >
      <div style={{ flex: 1, minHeight: 0, background: colors.card, borderRadius: 10, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '0 12px', height: 44, flexShrink: 0 }}>
          <DescriptionOutlined sx={{ fontSize: 16, color: accentColor }} />
          <span style={{ fontSize: 12, color: themeTokens.textPrimary, flex: 1 }}>Documentação com IA</span>
          <button type="button" onClick={onClose} title="Fechar" style={{ width: 26, height: 26, border: 'none', borderRadius: 6, background: 'transparent', color: themeTokens.textMuted, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CloseRounded sx={{ fontSize: 16 }} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '0 12px 12px', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <div style={label}>Estilo da documentação</div>
        <DevFlowSelect
          value={style}
          onChange={(v) => pickStyle(v as DocStyle)}
          options={DOC_STYLES.map((d) => ({ value: d.id, label: d.label, icon: <CoverPreview style={d.cover} accent={accent} /> }))}
          isEffectiveDark={isEffectiveDark}
          accentColor={accentColor}
          themeTokens={themeTokens}
        />
        <span style={{ fontSize: 10.5, lineHeight: 1.4, color: themeTokens.textSecondary, margin: '4px 0 6px' }}>{st.description}</span>
        <button
          type="button"
          onClick={() => setPreviewOpen((v) => !v)}
          style={{ height: 28, border: 'none', borderRadius: 6, marginBottom: 6, background: previewOpen ? colors.field : accentColor, color: previewOpen ? themeTokens.textPrimary : '#fff', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: "'Poppins', sans-serif", transition: 'background .15s ease' }}
        >
          {previewOpen ? <VisibilityOffOutlined sx={{ fontSize: 15 }} /> : <VisibilityOutlined sx={{ fontSize: 15 }} />}
          {previewOpen ? 'Fechar preview' : 'Ver preview e estilo'}
        </button>

        <div style={label}>Telas</div>
        <div style={{ background: soft, borderRadius: 8, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 12, color: themeTokens.textPrimary }}>
            {targets.length} {targets.length === 1 ? 'tela selecionada' : 'telas selecionadas'}
          </span>
          {targets.length > 0 ? (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {targets.slice(0, 8).map((f) => (
                <span key={f.id} style={{ fontSize: 10.5, color: themeTokens.textSecondary, background: isEffectiveDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)', borderRadius: 5, padding: '2px 6px' }}>{f.name}</span>
              ))}
              {targets.length > 8 && <span style={{ fontSize: 10.5, color: themeTokens.textMuted }}>+{targets.length - 8}</span>}
            </div>
          ) : (
            <span style={{ fontSize: 10.5, lineHeight: 1.4, color: themeTokens.textMuted }}>Selecione quadros no canvas para documentar.</span>
          )}
          <button
            type="button"
            onClick={() => setUseAll((v) => !v)}
            style={{ alignSelf: 'flex-start', border: 'none', background: 'transparent', padding: 0, cursor: 'pointer', fontSize: 11, color: useAll ? accentColor : themeTokens.textSecondary, fontFamily: "'Poppins', sans-serif" }}
          >
            {useAll ? `Usando todas as telas da página (${all.length})` : `Usar todas as telas da página (${all.length})`}
          </button>
        </div>

        {history.length > 0 && (
          <>
            <div style={{ ...label, marginTop: 10 }}>Gerados</div>
            {history.slice(0, 6).map((h) => (
              <div key={h.id} style={{ background: soft, borderRadius: 8, padding: '6px 10px', marginBottom: 4, userSelect: 'text' }}>
                <div style={{ fontSize: 11.5, color: themeTokens.textPrimary }}>{DOC_STYLES.find((s) => s.id === h.style)?.label} · {h.screens} {h.screens === 1 ? 'tela' : 'telas'}</div>
                <div style={{ fontSize: 10, color: themeTokens.textMuted, wordBreak: 'break-all' }}>{new Date(h.ts).toLocaleString()} — {h.message}</div>
              </div>
            ))}
          </>
        )}
        </div>
      </div>
      <AiComposer c={colors} title="Instruções para a IA" value={notes} onChange={setNotes} placeholder="Contexto extra: público, tom, objetivos, o que destacar..." onSubmit={generate} busy={busy} status={status} error={error} icon={<DescriptionOutlined sx={{ fontSize: 16 }} />} hint="Enter para gerar a documentação" rows={4} />
    </div>
    </>
  );
}
