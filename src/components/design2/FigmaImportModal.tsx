import React, { useRef, useState } from 'react';
import { applyImageUrls, convertFigmaDocument, parseFigmaUrl, type FigmaImportResult } from './figmaImport';
import type { Page, Shape } from './types';

interface Props {
  tokens: Record<string, any>;
  accentColor: string;
  onClose: () => void;
  /** Recebe páginas novas e shapes já prontos (ids únicos, imagens resolvidas). */
  onImport: (pages: Page[], shapes: Shape[], note: string) => void;
}

const TOKEN_KEY = 'design_figma_token';
const readToken = () => {
  try { return localStorage.getItem(TOKEN_KEY) || ''; } catch { return ''; }
};

export default function FigmaImportModal({ tokens, accentColor, onClose, onImport }: Props) {
  const [tab, setTab] = useState<'url' | 'json'>('url');
  const [url, setUrl] = useState('');
  const [token, setToken] = useState(readToken);
  const [json, setJson] = useState('');
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ r: FigmaImportResult; imgUrls: Record<string, string> } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const fsApi = window.electronAPI?.fs;

  const fail = (m: string) => { setError(m); setBusy(''); };

  /** Baixa as imagens referenciadas (preenchimentos de imagem) via API de imagens do arquivo. */
  const fetchImages = async (fileKey: string, r: FigmaImportResult): Promise<Record<string, string>> => {
    if (!Object.keys(r.imageRefs).length || !fsApi?.figmaFetch || !fsApi.figmaDownloadImages) return {};
    const res = await fsApi.figmaFetch(token, `/v1/files/${fileKey}/images`);
    const meta: Record<string, string> = res.data?.meta?.images || {};
    return fsApi.figmaDownloadImages(meta);
  };

  const runUrl = async () => {
    setError('');
    const parsed = parseFigmaUrl(url);
    if (!parsed) return fail('URL do Figma inválida');
    if (!token.trim()) return fail('Informe o token de acesso pessoal');
    if (!fsApi?.figmaFetch) return fail('Disponível apenas no app desktop');
    try { localStorage.setItem(TOKEN_KEY, token.trim()); } catch {}
    setBusy('Baixando arquivo do Figma…');
    const path = parsed.nodeId
      ? `/v1/files/${parsed.fileKey}/nodes?ids=${encodeURIComponent(parsed.nodeId)}&geometry=paths`
      : `/v1/files/${parsed.fileKey}?geometry=paths`;
    const res = await fsApi.figmaFetch(token.trim(), path);
    if (res.error) return fail(res.error);
    const r = convertFigmaDocument(res.data);
    setBusy('Baixando imagens…');
    const imgUrls = await fetchImages(parsed.fileKey, r);
    setResult({ r, imgUrls });
    setBusy('');
  };

  const runJson = (text: string) => {
    setError('');
    try {
      const r = convertFigmaDocument(JSON.parse(text));
      setResult({ r, imgUrls: {} });
    } catch {
      fail('JSON inválido');
    }
  };

  const confirm = () => {
    if (!result) return;
    const { shapes } = applyImageUrls(result.r, result.imgUrls);
    onImport(result.r.pages, shapes, `${result.r.stats.imported} elementos importados do Figma`);
    onClose();
  };

  const inp: React.CSSProperties = { width: '100%', boxSizing: 'border-box', background: tokens.bgInput || tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: 6, color: tokens.textPrimary, fontSize: 11, padding: '7px 9px', outline: 'none', fontFamily: "'Poppins', sans-serif" };
  const btn = (primary?: boolean): React.CSSProperties => ({ background: primary ? accentColor : 'transparent', border: primary ? 'none' : `1px solid ${tokens.border}`, borderRadius: 6, color: primary ? '#fff' : tokens.textPrimary, fontSize: 11, padding: '6px 12px', cursor: 'pointer', fontFamily: "'Poppins', sans-serif" });

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 460, maxHeight: '80vh', overflowY: 'auto', background: tokens.bgCard, border: `1px solid ${tokens.border}`, borderRadius: 12, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, color: tokens.textPrimary, fontFamily: "'Poppins', sans-serif" }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Importar do Figma</span>
          <button type="button" onClick={onClose} style={{ background: 'transparent', border: 'none', color: tokens.textSecondary, cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {(['url', 'json'] as const).map((t) => (
            <button key={t} type="button" onClick={() => { setTab(t); setResult(null); setError(''); }} style={{ ...btn(tab === t), flex: 1 }}>
              {t === 'url' ? 'URL + token' : 'Arquivo JSON'}
            </button>
          ))}
        </div>

        {!result && tab === 'url' && (
          <>
            <input style={inp} placeholder="https://www.figma.com/design/ABC123/Nome?node-id=1-2" value={url} onChange={(e) => setUrl(e.target.value)} />
            <input style={inp} type="password" placeholder="Token de acesso pessoal (figd_…)" value={token} onChange={(e) => setToken(e.target.value)} />
            <span style={{ fontSize: 10, color: tokens.textSecondary }}>Gere em Figma → Settings → Security → Personal access tokens (leitura de arquivos). Com node-id na URL, importa só aquele elemento; sem, o arquivo inteiro.</span>
            <button type="button" disabled={!!busy} onClick={runUrl} style={btn(true)}>{busy || 'Buscar'}</button>
          </>
        )}

        {!result && tab === 'json' && (
          <>
            <textarea style={{ ...inp, height: 120, resize: 'vertical' }} placeholder='Cole aqui o JSON da API (GET /v1/files/:key?geometry=paths)' value={json} onChange={(e) => setJson(e.target.value)} />
            <div style={{ display: 'flex', gap: 6 }}>
              <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={async (e) => { const f = e.target.files?.[0]; if (f) runJson(await f.text()); e.target.value = ''; }} />
              <button type="button" style={btn()} onClick={() => fileRef.current?.click()}>Escolher arquivo…</button>
              <button type="button" style={btn(true)} disabled={!json.trim()} onClick={() => runJson(json)}>Analisar</button>
            </div>
          </>
        )}

        {result && (
          <>
            <div style={{ fontSize: 12 }}>
              {result.r.pages.length} página(s) · {result.r.stats.imported} elementos
              {result.r.stats.skipped ? ` · ${result.r.stats.skipped} ignorados` : ''}
              {Object.keys(result.r.imageRefs).length ? ` · ${Object.keys(result.imgUrls).length}/${new Set(Object.values(result.r.imageRefs)).size} imagens` : ''}
            </div>
            {result.r.warnings.length > 0 && (
              <ul style={{ margin: 0, paddingLeft: 16, fontSize: 10, color: tokens.textSecondary }}>
                {result.r.warnings.map((w) => <li key={w}>{w}</li>)}
              </ul>
            )}
            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
              <button type="button" style={btn()} onClick={() => setResult(null)}>Voltar</button>
              <button type="button" style={btn(true)} disabled={!result.r.stats.imported} onClick={confirm}>Importar</button>
            </div>
          </>
        )}
        {error && <span style={{ fontSize: 11, color: '#f87171' }}>{error}</span>}
      </div>
    </div>
  );
}
