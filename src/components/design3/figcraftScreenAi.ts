import type { Shape, FillItem, EffectItem } from '../design2/types';
import type { FigcraftCall } from './figcraftAi';
import { FcSync } from './figcraftShapes';
import { AiJsonStream, type AiStreamEvent } from '../design2/aiJsonStream';
import { buildAiScreenPrompt, parseAiScreenResponse, requestAiScreenRaw, ScreenBuilder, guessScreenFormat } from '../design2/aiScreenFromLlm';
import { applyAiEdits, buildAiEditPrompt, editScope } from '../design2/aiEdit';
import { buildPlanPrompt, looksMultiScreen, parsePlan, screenPrompt } from '../design2/appPlan';
import { analyzeReferenceImages } from '../design2/referenceAnalysis';
import { listRefs, matchRefs, readRef, saveRefs } from '../design2/references';
import { buildProjectDigest } from '../design2/projectDigest';
import { listProjectAssets } from '../design2/projectAssets';
import { fetchStockImage } from '../design2/stockImage';
import { loadIcons } from '../design2/icons';
import { fixContrast } from '../design2/audit';
import { relayoutAll } from '../design2/autoLayout';
import { patternTile } from '../design2/pattern';
import { applyTextResize } from '../design2/textResize';
import { findFreeSpot } from '../design2/freeSpot';
import { STYLE_MODE_MARK, wantsNewScreens } from '../design2/screenFlow';
import { referenceIntent, selectionIntent } from './figcraftIntent';
import { describeScreenStyle } from '../design2/screenStyle';
import { lowEffortModel, resolveCliModel, visionModel } from '../design2/aiModel';
import { normalizeTokens, type DesignTokens } from '../design2/designTokens';
import { readProjectTokens } from '../design2/projectDoc';
import { getActiveBrainContextSync, generateBrainAiContext } from '../../utils/brainService';

const NEUTRAL_CWD = '/tmp';

const lum = (hex: string): number | null => {
  const m = /^#([0-9a-f]{6})/i.exec(String(hex || '').trim());
  if (!m) return null;
  const c = [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
};
const ratio = (a: number, b: number) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

/** Cor média das paradas do degradê (ou a cor sólida) de um fundo. */
const avgHex = (s: Shape): string | undefined => {
  const f = s.fills?.filter((x) => x.visible !== false);
  const layer = f?.[f.length - 1] ?? f?.[0];
  const stops = layer?.gradientStops?.length ? layer.gradientStops.map((x) => x.color) : layer ? [layer.color] : s.fill && s.fill !== 'none' ? [s.fill] : [];
  const rgb = stops.map((c) => /^#([0-9a-f]{6})/i.exec(c)?.[1]).filter(Boolean).map((h) => [0, 2, 4].map((i) => parseInt(h!.slice(i, i + 2), 16)));
  if (!rgb.length) return undefined;
  return '#' + [0, 1, 2].map((i) => Math.round(rgb.reduce((a, c) => a + c[i], 0) / rgb.length).toString(16).padStart(2, '0')).join('');
};

/** Texto cujo fundo é um degradê/foto (o contraste do Design não julga): compara com a cor média do fundo da tela e vira preto/branco se ficar ilegível. */
export function fixTextOnGradient(shapes: Shape[]): Shape[] {
  const byId = new Map(shapes.map((s) => [s.id, s]));
  const rootOf = (s: Shape) => { let c: Shape = s; for (let n = 0; c.parentId && byId.get(c.parentId) && n < 20; n++) c = byId.get(c.parentId)!; return c; };
  return shapes.map((s) => {
    if (s.type !== 'text' || s.visible === false || !/^#[0-9a-f]{6}/i.test(s.fill)) return s;
    // fundo mais próximo: o primeiro ancestral com fundo sólido opaco; sem ele, o fundo da tela
    let bg: string | undefined; let c = s.parentId ? byId.get(s.parentId) : undefined; let unknown = false;
    for (let n = 0; c && n < 12; n++, c = c.parentId ? byId.get(c.parentId) : undefined) {
      const f = c.fills?.find((x) => x.visible !== false);
      const isRoot = !c.parentId || !byId.get(c.parentId);
      if (f && f.type && f.type !== 'solid') { if (isRoot) { bg = avgHex(c); } else unknown = true; break; } // degradê da própria tela: usa a cor média
      if (c.type === 'image' || c.imageUrl) { unknown = true; break; }
      const col = f ? f.color : c.fill;
      if (col && col !== 'none' && col !== 'transparent' && /^#[0-9a-f]{6}/i.test(col) && (f ? f.opacity : 1) > 0.5) { bg = col; break; }
    }
    if (unknown) return s;
    if (!bg) bg = avgHex(rootOf(s));
    const fg = lum(s.fill), bl = bg ? lum(bg) : null;
    if (fg === null || bl === null || ratio(fg, bl) >= 3) return s;
    return { ...s, fill: ratio(0, bl) >= ratio(1, bl) ? '#000000' : '#FFFFFF' };
  });
}

/**
 * Cor da barra de status e do indicador home pelo fundo que REALMENTE aparece atrás deles (o frame de conteúdo da tela costuma cobrir
 * o fundo declarado): fundo claro = preto, fundo escuro = branco. Foto ou imagem atrás: mantém a cor que já estava.
 */
export function fixStatusBarInk(shapes: Shape[]): Shape[] {
  const chromeNames = new Set(['Hora', 'SignalCellularAlt', 'Wifi', 'Battery5Bar']);
  const out = shapes.slice();
  const idx = new Map(out.map((s, i) => [s.id, i]));
  const roots = out.filter((s) => s.type === 'frame' && !s.parentId && out.some((c) => c.deviceChrome && c.parentId === s.id));
  for (const root of roots) {
    const inkAt = (px: number, py: number): string | undefined => {
      // o item mais alto na pilha que cobre o ponto, tem fundo e não é parte do aparelho
      const cover = out
        .filter((c) => c.id !== root.id && !c.deviceChrome && c.visible !== false && c.type !== 'text' && c.type !== 'path' && px >= c.x && px <= c.x + c.width && py >= c.y && py <= c.y + c.height && isInside(c, root))
        .sort((a, b) => b.zIndex - a.zIndex);
      for (const c of [...cover, root]) {
        if (c.type === 'image' || c.imageUrl) return undefined;
        const f = c.fills?.filter((x) => x.visible !== false);
        const layer = f?.[0];
        if (layer && layer.type === 'image') return undefined;
        if ((c.opacity ?? 1) < 0.5) continue;
        const bg = f?.length ? avgHex(c) : c.fill && c.fill !== 'none' && c.fill !== 'transparent' ? c.fill : undefined;
        const opaque = f?.length ? (layer?.opacity ?? 1) > 0.4 : true;
        if (!bg || !opaque) continue;
        const l = lum(bg);
        if (l === null) continue;
        return l > 0.45 ? '#000000' : '#FFFFFF';
      }
      return undefined;
    };
    const isInside = (c: Shape, r: Shape) => c.x >= r.x - 1 && c.y >= r.y - 1 && c.x + c.width <= r.x + r.width + 1 && c.y + c.height <= r.y + r.height + 1;
    const top = inkAt(root.x + 30, root.y + 28);
    const bottom = inkAt(root.x + root.width / 2, root.y + root.height - 10);
    for (const c of out) {
      if (!c.deviceChrome || (c.parentId !== root.id)) continue;
      const ink = chromeNames.has(c.name || '') || c.name === 'Hora' ? top : c.name === 'Indicador home' ? bottom : undefined;
      if (ink) out[idx.get(c.id)!] = { ...c, fill: ink };
    }
  }
  return out;
}

/**
 * Frames com cantos arredondados que contêm foto (cards, capas, avatares) recortam o conteúdo: a foto não passa dos cantos.
 * Frames com selos/etiquetas sobrepostos (que saem pela borda) não recortam.
 */
export function fixClip(shapes: Shape[]): Shape[] {
  const kids = new Map<string, Shape[]>();
  for (const s of shapes) if (s.parentId) kids.set(s.parentId, [...(kids.get(s.parentId) || []), s]);
  const hasImage = (id: string, d = 0): boolean => d < 6 && (kids.get(id) || []).some((c) => c.type === 'image' || c.imageUrl || hasImage(c.id, d + 1));
  return shapes.map((s) => {
    if (s.type !== 'frame' || s.clipContent || s.deviceChrome) return s;
    const round = (s.cornerRadius ?? 0) > 0 || s.independentCorners;
    if (!round) return s;
    const overlays = (kids.get(s.id) || []).some((c) => c.layoutAbsolute || c.overlayAnchor);
    if (overlays || !hasImage(s.id)) return s;
    return { ...s, clipContent: true };
  });
}

// ---------------------------------------------------------------- texturas

const tileCache = new Map<string, string>();
const Q = 4; // a peça é desenhada 4x maior e exibida em escala 1/4 (nítida no zoom)

/** Peça (PNG com transparência) de uma textura: grade, pontos, linhas ou xadrez; `cell` é o lado da peça em px da tela. */
function tileDataUrl(kind: 'grid' | 'dots' | 'lines' | 'checker', cell: number, color: string, bg?: string): string | null {
  const key = `${kind}|${cell}|${color}|${bg || ''}`;
  const hit = tileCache.get(key);
  if (hit) return hit;
  const t = patternTile(kind, cell, color, bg);
  const cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.round(t.w * Q));
  cv.height = Math.max(1, Math.round(t.h * Q));
  const g = cv.getContext('2d');
  if (!g) return null;
  for (const it of t.items) {
    if (it.tag === 'rect') { g.fillStyle = it.fill; g.fillRect(it.x * Q, it.y * Q, it.w * Q, it.h * Q); }
    else if (it.tag === 'circle') { g.fillStyle = it.fill; g.beginPath(); g.arc(it.cx * Q, it.cy * Q, it.r * Q, 0, Math.PI * 2); g.fill(); }
  }
  const url = cv.toDataURL('image/png');
  tileCache.set(key, url);
  return url;
}

/**
 * Preenchimentos "pattern" (textura) viram uma camada de mosaico por cima da cor (um retângulo com a peça repetida, fora do
 * fluxo do auto layout, sob o conteúdo); granulado vira efeito de ruído do próprio quadro.
 */
export function expandTextures(shapes: Shape[]): Shape[] {
  const out: Shape[] = [];
  for (const s of shapes) {
    const pats = (s.fills || []).filter((f) => f.type === 'pattern' && f.visible !== false);
    if (!pats.length) { out.push(s); continue; }
    const rest = (s.fills || []).filter((f) => !(f.type === 'pattern'));
    let cur: Shape = { ...s, fills: rest.length ? rest : undefined };
    if (!rest.length) cur = { ...cur, fill: cur.fill && cur.fill !== 'none' ? cur.fill : 'none' };
    const overlays: Shape[] = [];
    pats.forEach((f, i) => {
      const kind = f.patternKind || 'grid';
      if (kind === 'noise') {
        cur = { ...cur, effects: [...(cur.effects || []), { id: `${s.id}~fx${i}`, type: 'noise', color: f.color, opacity: f.opacity, x: 0, y: 0, blur: 0, spread: 0, visible: true, noiseMode: 'mono', noiseSizeX: 1, noiseSizeY: 1, density: 0.5 } as any] };
        return;
      }
      const cell = Math.max(2, Math.round(f.patternScale || 8));
      const url = tileDataUrl(kind as 'grid' | 'dots' | 'lines' | 'checker', cell, f.color, f.patternBg);
      if (!url) return;
      overlays.push({
        id: `${s.id}~tex${i}`, name: `Textura ${kind}`, type: 'image', parentId: s.id, pageId: s.pageId, x: s.x, y: s.y, width: s.width, height: s.height, rotation: 0,
        fill: 'none', stroke: 'none', strokeWidth: 0, opacity: f.opacity, cornerRadius: s.cornerRadius, independentCorners: s.independentCorners,
        topLeftRadius: s.topLeftRadius, topRightRadius: s.topRightRadius, bottomRightRadius: s.bottomRightRadius, bottomLeftRadius: s.bottomLeftRadius,
        imageUrl: url, imageTile: Q, layoutAbsolute: true, zIndex: (s.zIndex ?? 0) + 0.0001, visible: true,
      } as Shape);
    });
    out.push(cur, ...overlays);
  }
  return out;
}

/**
 * Painel de cantos arredondados (folha branca) que começa onde um bloco com degradê/cor termina: atrás dos cantos aparecia o preto
 * do fundo da tela. Um retângulo da cor da borda de baixo do bloco entra atrás dos cantos do painel.
 */
export function fixSheetCorners(shapes: Shape[]): Shape[] {
  const out: Shape[] = [];
  const bottomColor = (g: Shape): string | undefined => {
    const f = g.fills?.filter((x) => x.visible !== false);
    const layer = f?.[0];
    if (layer && layer.type && layer.type !== 'solid' && layer.gradientStops?.length) {
      const st = [...layer.gradientStops].sort((a, b) => a.position - b.position);
      return (layer.type === 'linear' ? st[st.length - 1] : st[st.length - 1]).color;
    }
    const c = layer ? layer.color : g.fill;
    return c && c !== 'none' && c !== 'transparent' ? c : undefined;
  };
  for (const s of shapes) {
    const r = s.type === 'frame' && !s.deviceChrome ? (s.independentCorners ? Math.min(s.topLeftRadius ?? 0, s.topRightRadius ?? 0) : s.cornerRadius ?? 0) : 0;
    if (r >= 10 && s.parentId) {
      const above = shapes.find((g) => g.id !== s.id && g.parentId === s.parentId && g.type !== 'text' && !g.layoutAbsolute && Math.abs(g.y + g.height - s.y) <= 3 && Math.min(g.x + g.width, s.x + s.width) - Math.max(g.x, s.x) >= s.width * 0.7);
      const col = above ? bottomColor(above) : undefined;
      if (above && col && /^#[0-9a-f]{6}/i.test(col)) {
        out.push({
          id: `${s.id}~corners`, name: 'Fundo dos cantos', type: 'rect', parentId: s.parentId, pageId: s.pageId, x: s.x, y: s.y - 1, width: s.width, height: Math.min(r + 1, s.height), rotation: 0,
          fill: col, stroke: 'none', strokeWidth: 0, opacity: 1, zIndex: (s.zIndex ?? 0) - 0.0001, visible: true, layoutAbsolute: true,
        } as Shape);
      }
    }
    out.push(s);
  }
  return out;
}

/**
 * Texto curto que o Design quebrou em várias linhas porque era "fill" numa coluna que se ajusta ao conteúdo ("Debit\ncard"):
 * volta ao texto original, numa linha, com a largura do conteúdo (como no navegador).
 */
export function fixShortText(shapes: Shape[]): Shape[] {
  const byId = new Map(shapes.map((x) => [x.id, x]));
  return shapes.map((t) => {
    if (t.type !== 'text' || !t.parentId) return t;
    const src = (t.wrapSource ?? t.text ?? '').replace(/\s*\n\s*/g, ' ').trim();
    const parent = byId.get(t.parentId);
    const broke = /\n/.test(t.text ?? '') || (t.height ?? 0) > (t.fontSize || 16) * 1.9;
    const shortLabel = src.length <= 28;
    const hugParent = parent?.widthMode === 'hug';
    if (!broke || !(shortLabel || (hugParent && src.length <= 48))) return t;
    return { ...t, text: src, wrapSource: undefined, widthMode: 'hug', textResize: 'auto-width', height: Math.round((t.fontSize || 16) * 1.35) };
  });
}

/**
 * Cor da barra de status e do indicador home a partir do que REALMENTE aparece atrás (pixels do quadro já desenhado): vale mais do que
 * estimar pelas camadas de fundo (degradês empilhados). Claro = preto, escuro = branco.
 */
async function fixInkFromPixels(call: FigcraftCall, sync: FcSync, rootShapeIds: string[], shapes: Shape[]): Promise<void> {
  const luminanceOf = (img: HTMLImageElement, y0: number, y1: number): number => {
    const cv = document.createElement('canvas');
    cv.width = img.width; cv.height = Math.max(1, Math.round((y1 - y0) * img.height));
    const g = cv.getContext('2d');
    if (!g) return 0.5;
    g.drawImage(img, 0, Math.round(y0 * img.height), img.width, cv.height, 0, 0, cv.width, cv.height);
    const d = g.getImageData(0, 0, cv.width, cv.height).data;
    let sum = 0, n = 0;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i + 3] < 8) continue;
      sum += 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
      n++;
    }
    return n ? sum / n / 255 : 0.5;
  };
  for (const rid of rootShapeIds) {
    const root = shapes.find((x) => x.id === rid);
    const fc = sync.idOf(rid);
    if (!root || fc === undefined) continue;
    const chrome = shapes.filter((c) => c.deviceChrome && c.parentId === rid);
    if (!chrome.length) continue;
    try {
      const e = await call('engine.execute', { command: 'file.export', params: { ids: [fc], format: 'png', scale: 0.5 } });
      if (!e?.data) continue;
      const img = await new Promise<HTMLImageElement>((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = `data:image/png;base64,${e.data}`; });
      const top = luminanceOf(img, 0.01, Math.min(0.08, 54 / Math.max(1, root.height)));
      const bottom = luminanceOf(img, Math.max(0.9, 1 - 24 / Math.max(1, root.height)), 0.995);
      for (const [names, lum] of [[['Hora', 'SignalCellularAlt', 'Wifi', 'Battery5Bar'], top], [['Indicador home'], bottom]] as Array<[string[], number]>) {
        const ids = chrome.filter((c) => names.includes(c.name || '')).map((c) => sync.idOf(c.id)).filter((x): x is number => x !== undefined);
        if (ids.length) await call('engine.execute', { command: 'node.set', params: { ids, props: { fills: [{ type: 'solid', color: lum > 0.5 ? '#000000' : '#FFFFFF', opacity: 1 }] } } }).catch(() => {});
      }
    } catch { /* mantém a cor estimada */ }
  }
}

/** Ícone (e forma de ícone) com a cor do fundo do próprio círculo/cartão: troca por preto ou branco, o que contrastar mais. */
export function fixIconContrast(shapes: Shape[]): Shape[] {
  const byId = new Map(shapes.map((s) => [s.id, s]));
  const bgOf = (s: Shape): string | undefined => {
    let c = s.parentId ? byId.get(s.parentId) : undefined;
    for (let n = 0; c && n < 12; n++, c = c.parentId ? byId.get(c.parentId) : undefined) {
      const f = c.fills?.find((x) => x.visible !== false);
      if (f && f.type && f.type !== 'solid') return undefined; // degradê/imagem: fundo desconhecido
      const col = f ? f.color : c.fill;
      if (col && col !== 'none' && col !== 'transparent' && /^#[0-9a-f]{6}/i.test(col) && (f ? f.opacity : 1) > 0.5 && (c.opacity ?? 1) > 0.5) return col;
    }
    return undefined;
  };
  return shapes.map((s) => {
    if (s.type !== 'path' || !s.iconName || s.visible === false) return s;
    const fg = lum(s.fill), bgHex = bgOf(s), bg = bgHex ? lum(bgHex) : null;
    if (fg === null || bg === null || ratio(fg, bg) >= 2) return s;
    return { ...s, fill: ratio(0, bg) >= ratio(1, bg) ? '#000000' : '#FFFFFF' };
  });
}

/** Pedidos extras à análise das referências (réplica fiel): recortes, barra de status, pilhas de avatares, centralização, anéis. */
const ANALYSIS_EXTRA = `
RÉPLICA (extra obrigatório): as imagens são numeradas [0], [1], [2]… na lista abaixo. No INVENTÁRIO: (1) para cada foto, avatar, miniatura ou ilustração informe "img N, região x,y,w,h em FRAÇÃO 0–1 DA IMAGEM (não da tela)", e se há botões/textos/ícones por cima dela (então não serve para recorte); descreva também o ASSUNTO exato (pessoa, roupa, cenário, objeto, cores) para o caso de precisar de uma foto parecida; (2) a barra de status (hora, sinal, wifi, bateria) e a ilha dinâmica; (3) toda pilha de avatares com seus contadores ("+1K"); (4) o nome do ícone Material mais próximo de cada ícone e se ele é fino/contorno ou preenchido; (5) escreva CENTRALIZADO em todo elemento que esteja centralizado horizontalmente na tela, e a margem lateral dos demais; (6) anéis/arcos de progresso: diâmetro, espessura, cor do arco e do trilho, fração preenchida e onde o arco começa.
`;
const PAGE = 'page-1';

export interface FigAiOptions {
  call: FigcraftCall;
  sync: FcSync;
  prompt: string;
  /** imagens de referência anexadas (data URL) */
  images: string[];
  ws: string;
  projectName?: string;
  /** o brain e os arquivos do projeto entram no contexto da IA */
  useCtx: boolean;
  /** a IA segue os design tokens salvos do projeto */
  useTokens: boolean;
  fastMode: boolean;
  provider: string;
  model?: string;
  accentColor: string;
  isDark: boolean;
  /** ids do FigCraft selecionados ao enviar o pedido */
  selection: number[];
  onProgress: (m: string) => void;
  signal: { cancelled: boolean };
  onToast?: (m: string) => void;
}

export interface FigAiResult { message: string; layers: number; rootIds: number[] }

const fsApi = () => (window as any).electronAPI?.fs;

/** Recorta um trecho (frações 0–1) de uma imagem de referência e devolve como data URL JPEG. */
function cropRef(src: string | undefined, c: { x: number; y: number; w: number; h: number }, outW: number, outH: number): Promise<string | null> {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => {
      const sx = Math.round(c.x * img.width), sy = Math.round(c.y * img.height);
      const sw = Math.max(1, Math.min(img.width - sx, Math.round(c.w * img.width))), sh = Math.max(1, Math.min(img.height - sy, Math.round(c.h * img.height)));
      // resolução do recorte, no máximo 2x o tamanho que ele terá na tela
      const k = Math.min(1, (Math.max(outW, outH) * 2) / Math.max(sw, sh));
      const cv = document.createElement('canvas');
      cv.width = Math.max(1, Math.round(sw * k)); cv.height = Math.max(1, Math.round(sh * k));
      cv.getContext('2d')?.drawImage(img, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
      resolve(cv.toDataURL('image/jpeg', 0.9));
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Brain do projeto + resumo dos arquivos (README, package.json, estrutura, cores). */
export async function getProjectContext(ws: string, name?: string): Promise<string | undefined> {
  const digest = await buildProjectDigest(ws).catch(() => '');
  let brainText = '';
  try {
    const brain = ws ? getActiveBrainContextSync(ws) : null;
    brainText = brain ? generateBrainAiContext(brain).replace(/\s+/g, ' ').slice(0, 1500) : '';
  } catch { /* sem brain */ }
  return [name ? `Projeto: ${name}.` : '', brainText, digest].filter(Boolean).join('\n').slice(0, 9500) || undefined;
}

// ---------------------------------------------------------------- FigCraft -> Shape (para editar o que ja existe)

const hexOf = (c: unknown, fb = '#000000') => (typeof c === 'string' && /^#/.test(c) ? c.slice(0, 7) : fb);
const alphaOf = (c: unknown) => (typeof c === 'string' && c.length === 9 ? parseInt(c.slice(7), 16) / 255 : 1);

function fillsFromFc(list: any[] | undefined): FillItem[] {
  const out: FillItem[] = [];
  let n = 0;
  for (const f of [...(list || [])].reverse()) {
    if (f.visible === false) continue;
    if (f.type === 'solid') out.push({ id: `f${n++}`, color: hexOf(f.color), opacity: (f.opacity ?? 1) * alphaOf(f.color), visible: true, type: 'solid' });
    else if (f.type === 'gradient' && Array.isArray(f.stops)) {
      const from = f.from || [0.5, 0], to = f.to || [0.5, 1];
      const ang = Math.round((Math.atan2(to[0] - from[0], -(to[1] - from[1])) * 180) / Math.PI + 360) % 360;
      out.push({
        id: `f${n++}`, color: hexOf(f.stops[0]?.color), opacity: f.opacity ?? 1, visible: true,
        type: f.kind === 'radial' || f.kind === 'angular' || f.kind === 'diamond' ? f.kind : 'linear',
        gradientStops: f.stops.map((s: any) => ({ position: s.position, color: hexOf(s.color), opacity: alphaOf(s.color) })), gradientAngle: ang,
        gradientCenter: { x: from[0], y: from[1] }, gradientRadius: Math.abs((to[1] ?? 1) - (from[1] ?? 0.5)) || 0.5,
      });
    }
  }
  return out;
}

const WEIGHTS: Record<string, number> = { thin: 100, extralight: 200, light: 300, regular: 400, medium: 500, semibold: 600, bold: 700, extrabold: 800, black: 900 };

/** Nó do FigCraft (document.inspect) como shape do Design, com id `fc:<id>` (coordenadas absolutas). */
export function nodeToShapes(node: any, parentId?: string, out: Shape[] = [], z = { n: 1 }): Shape[] {
  const T = String(node.type);
  const id = `fc:${node.id}`;
  const b = node.absoluteBounds || { x: node.x || 0, y: node.y || 0, width: node.width || 0, height: node.height || 0 };
  const fillsRaw = node.fills as any[] | undefined;
  const hasImage = (fillsRaw || []).some((f) => f.type === 'image');
  const type: Shape['type'] =
    T === 'FRAME' || T === 'COMPONENT' || T === 'COMPONENT_SET' || T === 'INSTANCE' || T === 'SECTION' ? 'frame'
    : T === 'GROUP' ? 'group' : T === 'ELLIPSE' ? 'ellipse' : T === 'TEXT' ? 'text' : T === 'LINE' ? 'line' : T === 'POLYGON' ? 'polygon' : T === 'STAR' ? 'star'
    : T === 'VECTOR' || T === 'BOOLEAN_OPERATION' ? 'path' : hasImage ? 'image' : 'rect';
  const fills = fillsFromFc(fillsRaw);
  const s: any = {
    id, name: node.name, type, x: b.x, y: b.y, width: b.width, height: b.height, rotation: node.rotation || 0,
    fill: fills[fills.length - 1]?.color ?? (type === 'text' ? '#000000' : 'none'), stroke: 'none', strokeWidth: 0, opacity: node.opacity ?? 1, zIndex: z.n++,
    parentId, pageId: PAGE, visible: node.visible !== false, fills,
  };
  if (node.fills?.length === 0) s.fill = 'none';
  if (node.strokes?.length) {
    s.stroke = hexOf(node.strokes[0].color); s.strokeWidth = node.strokeWeight || 1; s.strokePosition = node.strokeAlign || 'inside';
    s.strokes = node.strokes.map((p: any, i: number) => ({ id: `s${i}`, color: hexOf(p.color), opacity: p.opacity ?? 1, visible: true, width: node.strokeWeight }));
  }
  if (Array.isArray(node.cornerRadius)) {
    s.independentCorners = true;
    [s.topLeftRadius, s.topRightRadius, s.bottomRightRadius, s.bottomLeftRadius] = node.cornerRadius;
  } else if (typeof node.cornerRadius === 'number') s.cornerRadius = node.cornerRadius;
  if (Array.isArray(node.effects)) {
    s.effects = node.effects.map((e: any, i: number): EffectItem | null => {
      const type = e.type === 'dropShadow' ? 'drop-shadow' : e.type === 'innerShadow' ? 'inner-shadow' : e.type === 'layerBlur' ? 'layer-blur' : e.type === 'backgroundBlur' ? 'background-blur' : null;
      if (!type) return null;
      return { id: `e${i}`, type, color: hexOf(e.color), opacity: alphaOf(e.color), x: e.offset?.[0] ?? 0, y: e.offset?.[1] ?? 0, blur: e.radius ?? 0, spread: e.spread ?? 0, visible: e.visible !== false } as EffectItem;
    }).filter(Boolean);
  }
  if (type === 'frame' || type === 'group') {
    s.clipContent = !!node.clip;
    const l = node.layout;
    if (l && l.mode && l.mode !== 'none') {
      s.hasAutoLayout = true;
      s.layoutFlow = l.mode === 'grid' ? 'grid' : l.mode;
      s.layoutGap = l.gap ?? 0;
      const p = l.padding || [0, 0, 0, 0];
      [s.paddingTop, s.paddingRight, s.paddingBottom, s.paddingLeft] = p;
      s.independentPadding = true;
      s.layoutGapAuto = l.mainAlign === 'spaceBetween';
      const main = l.mainAlign === 'max' ? 'max' : l.mainAlign === 'center' ? 'center' : 'min';
      const cross = l.crossAlign === 'max' ? 'max' : l.crossAlign === 'center' ? 'center' : 'min';
      const [v, h] = l.mode === 'horizontal' ? [cross, main] : [main, cross];
      s.layoutAlign = `${v === 'min' ? 'top' : v === 'max' ? 'bottom' : 'middle'}-${h === 'min' ? 'left' : h === 'max' ? 'right' : 'center'}`.replace('middle-left', 'left').replace('middle-right', 'right').replace('middle-center', 'center');
      if (l.mode === 'grid') s.gridCols = l.gridColumns;
    }
  }
  if (node.sizing) { s.widthMode = node.sizing.horizontal; s.heightMode = node.sizing.vertical; }
  if (node.absolute) s.layoutAbsolute = true;
  if (type === 'text') {
    s.text = node.characters ?? '';
    s.fontFamily = node.fontFamily;
    s.fontSize = node.fontSize;
    s.fontWeight = WEIGHTS[String(node.fontStyle || 'Regular').replace(/\s|italic/gi, '').toLowerCase()] ?? 400;
    s.textAlign = node.textAlign === 'justified' ? 'justify' : node.textAlign || 'left';
    s.textResize = node.textAutoResize === 'widthAndHeight' ? 'auto-width' : node.textAutoResize === 'height' ? 'auto-height' : 'fixed';
    const lh = String(node.lineHeight ?? '');
    if (/%$/.test(lh)) s.lineHeight = parseFloat(lh) / 100;
    else if (/px$/.test(lh)) s.lineHeight = parseFloat(lh);
    const ls = String(node.letterSpacing ?? '');
    if (/px$/.test(ls)) s.letterSpacing = parseFloat(ls);
  }
  if (type === 'polygon') s.polygonSides = node.pointCount;
  if (type === 'star') { s.starPoints = node.pointCount; s.starInnerRatio = node.innerRadius; }
  if (node.minWidth !== undefined) s.minW = node.minWidth;
  if (node.maxWidth !== undefined) s.maxW = node.maxWidth;
  if (node.minHeight !== undefined) s.minH = node.minHeight;
  if (node.maxHeight !== undefined) s.maxH = node.maxHeight;
  out.push(s as Shape);
  for (const c of node.children || []) nodeToShapes(c, id, out, z);
  return out;
}

const fcIdOf = (shapeId: string) => (shapeId.startsWith('fc:') ? Number(shapeId.slice(3)) : undefined);

// ---------------------------------------------------------------- orquestracao

/**
 * Gerador de telas do Design no Design 2: o MESMO prompt (conhecimento de UX/UI, direcao de arte, icones Material,
 * logo do projeto, design tokens, referencias, fotos), o mesmo ScreenBuilder (auto layout, hierarquia, contraste) e a
 * mesma edicao por selecao; o resultado e espelhado no documento do FigCraft.
 */
interface Live { glow: Set<number>; placeholders: Map<number, number> }

export async function runFigcraftAi(o: FigAiOptions): Promise<FigAiResult> {
  const gs: Live = { glow: new Set(), placeholders: new Map() };
  try {
    return await runFigcraftAiInner(o, gs);
  } finally {
    // o brilho some e o quadro vazio que sobrou (erro, cancelamento) é removido
    const left = [...gs.placeholders.values()];
    if (left.length) await o.call('engine.execute', { command: 'edit.delete', params: { ids: left } }).catch(() => {});
    await o.call('ui.glow', { ids: [] }).catch(() => {});
  }
}

async function runFigcraftAiInner(o: FigAiOptions, gs: Live): Promise<FigAiResult> {
  const { call, sync, signal } = o;
  const setGlow = () => call('ui.glow', { ids: [...gs.glow] }).catch(() => {});
  /** Quadro vazio no lugar da tela que vai nascer: aparece na hora, com o contorno brilhando até a tela ficar pronta. */
  const makePlaceholder = async (key: number, name: string, x: number, y: number, w: number, h: number, mobile: boolean) => {
    const r = await call('engine.execute', { command: 'node.create', params: { type: 'frame', name, x, y, width: w, height: h, props: { fills: [{ type: 'solid', color: o.isDark ? '#18181B' : '#F4F4F5', opacity: 1 }], cornerRadius: mobile ? 55 : 12, clip: true }, select: false } }).catch(() => null);
    if (r?.id === undefined) return;
    gs.placeholders.set(key, r.id);
    gs.glow.add(r.id);
    await call('engine.execute', { command: 'view.zoomFit', params: {} }).catch(() => {});
    await setGlow();
  };
  const dropPlaceholder = async (key: number) => {
    const id = gs.placeholders.get(key);
    if (id === undefined) return;
    gs.placeholders.delete(key);
    gs.glow.delete(id);
    await call('engine.execute', { command: 'edit.delete', params: { ids: [id] } }).catch(() => {});
  };
  o.onProgress('Lendo o documento e o contexto do projeto…');
  const clean = o.prompt.trim();
  const cliModel = resolveCliModel(o.provider, o.model);
  const genModel = o.fastMode ? lowEffortModel(o.provider, cliModel) : cliModel;
  // chamadas auxiliares (entender o pedido, analisar a referência, planejar as telas) são curtas e estruturadas: sempre no modelo de esforço baixo (o "High" leva de 2,5x a 7x mais)
  const quickModel = lowEffortModel(o.provider, cliModel);
  const cwd = o.useCtx && o.ws ? o.ws : NEUTRAL_CWD;
  const icons = await loadIcons().catch(() => undefined);
  const projTokens: DesignTokens | null = o.useTokens ? (() => { const t = normalizeTokens(null); void t; return null; })() : null;
  const tokens = o.useTokens ? await readProjectTokens(o.ws).then((r) => { const t = normalizeTokens(r); return t && t.enabled !== false ? t : null; }).catch(() => null) : projTokens;
  const projectContext = o.useCtx ? await getProjectContext(o.ws, o.projectName) : undefined;
  const projectAssets = o.useCtx ? await listProjectAssets(o.ws).catch(() => []) : [];

  // ---- estado atual da pagina
  const readPage = async () => {
    const d = await call('document.inspect', { depth: 14 });
    const page = (d.pages || []).find((p: any) => p.id === d.currentPage) || d.pages?.[0];
    return { doc: d, page, shapes: (page?.children || []).flatMap((c: any) => nodeToShapes(c, undefined, [], { n: 1 })) as Shape[] };
  };
  const cur = await readPage();
  const pageShapes = cur.shapes;
  const byId = new Map(pageShapes.map((s) => [s.id, s]));
  const rootOf = (id: string) => { let c = byId.get(id); while (c?.parentId && byId.get(c.parentId)) c = byId.get(c.parentId); return c?.id ?? id; };
  const liveIds = o.selection.map((i) => `fc:${i}`).filter((id) => byId.has(id) && byId.get(id)!.visible !== false);
  const firstSel = byId.get(liveIds[0]);
  const selFrame = firstSel ? (firstSel.type === 'frame' ? firstSel : pageShapes.find((s) => s.id === firstSel.parentId && s.type === 'frame') || null) : null;
  const hasContent = !!selFrame && pageShapes.some((s) => s.parentId === selFrame.id);
  // com telas selecionadas: criar outras telas (a selecionada vira referência de design) ou alterar a seleção? A IA decide
  const needsIntent = liveIds.length > 0 && (!selFrame || liveIds.length > 1 || hasContent);
  const rootsSel = [...new Set(liveIds.map(rootOf))].map((id) => byId.get(id)?.name || 'tela');
  const selIntent = needsIntent ? await selectionIntent(clean, rootsSel, { provider: o.provider, model: quickModel, onProgress: o.onProgress }) : wantsNewScreens(clean) ? 'new' : 'edit';
  if (needsIntent) o.onProgress(selIntent === 'new' ? 'Pedido entendido: criar novas telas usando a selecionada como referência de design.' : 'Pedido entendido: alterar as telas selecionadas.');
  const fromSelection = liveIds.length > 0 && selIntent === 'new';
  const editsSelection = !fromSelection && liveIds.length > 0 && (!selFrame || liveIds.length > 1 || hasContent);
  const genTarget = !fromSelection && !editsSelection && selFrame ? selFrame : null;

  // ---- tela nova: o quadro vazio brilhando aparece já, antes de ler referências e pensar no layout
  const newMode = !editsSelection && !genTarget;
  if (newMode) {
    let preDims: { w: number; h: number } | null = null;
    let preRight = 0, preTop = 0;
    if (fromSelection) {
      const roots = [...new Set(liveIds.map(rootOf))].map((id) => byId.get(id)!).sort((a, b) => a.x - b.x).slice(0, 3);
      if (roots[0]) { preDims = { w: Math.round(roots[0].width), h: Math.round(roots[0].height) }; preRight = Math.max(...roots.map((r) => r.x + r.width)); preTop = roots[0].y; }
    }
    const f0 = preDims ? { mobile: preDims.w <= 500 && preDims.h >= 600, width: preDims.w, height: preDims.h } : guessScreenFormat(clean, undefined);
    const s0 = preDims ? findFreeSpot(pageShapes, preRight + 160, preTop, preDims.w + 80, preDims.h + 80) : findFreeSpot(pageShapes, 100, 100, f0.width + 80, f0.height + 80);
    await makePlaceholder(0, 'Gerando a tela…', s0.x, s0.y, f0.width, f0.height, f0.mobile);
  } else if (genTarget || editsSelection) {
    // edição: as telas que a IA está mexendo brilham
    for (const id of editsSelection ? new Set(liveIds.map(rootOf)) : [genTarget!.id]) { const n = fcIdOf(id); if (n !== undefined) gs.glow.add(n); }
    await setGlow();
  }

  // imagem anexada: replicar a referência fielmente ou criar telas novas com o design dela?
  const refMode: 'replicate' | 'style' = o.images.length && !fromSelection && !editsSelection
    ? await referenceIntent(clean, { provider: o.provider, model: quickModel, onProgress: o.onProgress })
    : fromSelection ? 'style' : 'replicate';
  if (o.images.length && !fromSelection && !editsSelection) o.onProgress(refMode === 'replicate' ? 'Pedido entendido: replicar a referência o mais fiel possível.' : 'Pedido entendido: criar tela(s) nova(s) usando a referência só como guia de design.');
  const refStyle = refMode === 'style';

  // ---- imagens de referencia: viram arquivos temporarios que a CLI abre pelo caminho
  const refs: string[] = [];
  /** imagens de referência (data URL) na mesma ordem de `refs`: o `refCrop` da IA aponta para elas */
  const refData: string[] = [];
  const save = fsApi()?.saveTempImage;
  for (const dataUrl of o.images) {
    if (!save) break;
    const r = await save(dataUrl.split(',')[1], 'jpg').catch(() => null);
    if (r?.path) { refs.push(r.path); refData.push(dataUrl); }
  }
  if (o.images.length > refs.length) throw new Error('Não consegui salvar as imagens de referência. Reinicie o app e envie de novo.');
  let refDirs = [...new Set(refs.map((p) => p.slice(0, p.lastIndexOf('/'))))];

  // telas selecionadas + "crie outras telas": viram guia de estilo (exporta como imagem)
  let baseDims: { w: number; h: number } | null = null;
  let selStyle = '';
  let baseRight = 0, baseTop = 0;
  if (fromSelection) {
    o.onProgress('Lendo a tela selecionada como guia de estilo…');
    const roots = [...new Set(liveIds.map(rootOf))].map((id) => byId.get(id)!).sort((a, b) => a.x - b.x).slice(0, 3);
    try { selStyle = describeScreenStyle(pageShapes, roots[0]); } catch { /* sem resumo de estilo */ }
    for (const r of roots) {
      if (!baseDims) baseDims = { w: Math.round(r.width), h: Math.round(r.height) };
      baseRight = Math.max(baseRight, r.x + r.width);
      baseTop = baseTop || r.y;
      try {
        const e = await call('engine.execute', { command: 'file.export', params: { ids: [fcIdOf(r.id)], format: 'png', scale: 1 } });
        const saved = e?.data ? await save?.(e.data, 'png') : null;
        if (saved?.path) { refs.push(saved.path); refData.push(`data:image/png;base64,${e.data}`); }
      } catch { /* sem a imagem desta tela */ }
    }
    if (!refs.length) throw new Error('Não consegui ler a tela selecionada como referência.');
    refDirs = [...new Set(refs.map((p) => p.slice(0, p.lastIndexOf('/'))))];
  }

  // biblioteca local de referências: o que você anexa é guardado; sem anexo, as mais parecidas voltam como inspiração
  const refFs = fsApi();
  const inspiration: string[] = [];
  if (o.ws && refFs?.readFile && refFs?.writeFile) {
    if (o.images.length) {
      saveRefs(o.ws, o.images, clean, refFs).then((l) => l.length && o.onToast?.(`${l.length} referência(s) na biblioteca`)).catch(() => {});
    } else if (!refs.length) {
      try {
        for (const h of matchRefs(await listRefs(o.ws, refFs), clean, 2)) {
          const url = await readRef(o.ws, h, refFs);
          const r = url && (await refFs.saveTempImage?.(url.split(',')[1], 'jpg').catch(() => null));
          if (r?.path) inspiration.push(r.path);
        }
        if (inspiration.length) refDirs = [...new Set([...refDirs, ...inspiration.map((p) => p.slice(0, p.lastIndexOf('/')))])];
      } catch { /* sem inspiracao */ }
    }
  }

  // etapa 1: uma chamada so para olhar as imagens e descrever a interface (a geracao recebe isso como regra)
  let spec: string | undefined;
  // a análise em separado de uma imagem leva de 2,5 a 5 min na CLI e costuma estourar o limite: no modo rápido a imagem vai direto para a geração
  if (refs.length && !o.fastMode) {
    o.onProgress(`Analisando ${refs.length} imagem(ns) de referência…`);
    const t0a = Date.now();
    const tick = setInterval(() => o.onProgress(`Analisando ${refs.length} imagem(ns) de referência… ${Math.round((Date.now() - t0a) / 1000)}s`), 2000);
    spec = await analyzeReferenceImages(refs, o.provider, visionModel(o.provider, cliModel), cwd || undefined, refDirs, refStyle ? '' : ANALYSIS_EXTRA, 150000, true).finally(() => clearInterval(tick)).catch((e) => { o.onProgress(`A análise da imagem falhou (${String(e?.message || e).slice(0, 80)})…`); return undefined; });
    if (signal.cancelled) throw new Error('cancelado');
    if (!spec) o.onProgress('Não consegui resumir as imagens; vou anexá-las direto…');
  }

  let lastShapes: Shape[] = [];
  const finish = async (rootShapeIds: string[], msg: string, layers: number): Promise<FigAiResult> => {
    const rootIds = rootShapeIds.map((id) => sync.idOf(id)).filter((x): x is number => x !== undefined);
    o.onProgress('Conferindo o alinhamento do auto layout…');
    const all0 = [...parts.values()].flat().length ? [...parts.values()].flat() : lastShapes;
    // barra de status e indicador home ficam por cima de fotos e cartões
    const chrome = all0.filter((x) => x.deviceChrome).map((x) => sync.idOf(x.id)).filter((x): x is number => x !== undefined);
    if (chrome.length) await call('engine.execute', { command: 'arrange.front', params: { ids: chrome } }).catch(() => {});
    gs.glow.clear();
    await setGlow();
    const allFinal = [...parts.values()].flat().length ? [...parts.values()].flat() : lastShapes;
    o.onProgress('Ajustando a cor da barra de status…');
    await fixInkFromPixels(call, sync, rootShapeIds, allFinal).catch(() => {});
    o.onProgress('Ajustando quebras de texto…');
    await sync.fixTextWrap(allFinal).catch(() => 0);
    await sync.verify(allFinal).catch(() => 0);
    if (rootIds.length) {
      // a moldura do dispositivo liga sozinha ao selecionar o quadro (painel de propriedades): um por vez
      for (const id of rootIds) {
        await call('engine.execute', { command: 'select.set', params: { ids: [id] } }).catch(() => {});
        await new Promise((r) => setTimeout(r, 700));
      }
      await call('engine.execute', { command: 'select.set', params: { ids: rootIds } }).catch(() => {});
      await call('engine.execute', { command: 'view.zoomFit', params: {} }).catch(() => {});
    }
    return { message: msg, layers, rootIds };
  };

  // ======================================================== editar o que esta selecionado
  if (editsSelection) {
    const groups = new Map<string, string[]>();
    for (const id of liveIds) { const r = rootOf(id); groups.set(r, [...(groups.get(r) || []), id]); }
    sync.adopt(pageShapes);
    const applyEdit = async (ids: string[], text: string): Promise<{ changed: number; added: number; removed: number } | null> => {
      const scope0 = editScope(pageShapes, ids);
      o.onProgress(`Pedindo para ${o.provider || 'a IA'} editar ${ids.length} elemento(s) selecionado(s)...`);
      const raw = await requestAiScreenRaw(
        buildAiEditPrompt({ prompt: text, accentColor: o.accentColor, isDark: o.isDark, referenceImages: refs, referenceSpec: spec, tokens }, scope0, ids),
        o.provider, genModel, cwd || undefined, 480000, undefined, refDirs
      );
      if (signal.cancelled) throw new Error('cancelado');
      const fresh = (await readPage()).shapes;
      const edited = applyAiEdits(raw, fresh, editScope(fresh, ids), ids, { pageId: PAGE, isDark: o.isDark, accentColor: o.accentColor, icons, tokens });
      if (!edited) return null;
      let shapes = edited.shapes;
      if (edited.pending.length) {
        const imgs = await Promise.all(edited.pending.map((j) => fetchStockImage(j.query, j.width, j.height, { person: j.person }).then((r) => [j.id, r] as const).catch(() => [j.id, null] as const)));
        shapes = shapes.map((s) => { const hit = imgs.find(([id]) => id === s.id)?.[1]; return hit ? { ...s, imageUrl: hit.dataUrl } : s; });
      }
      sync.adopt(fresh);
      const done = relayoutAll(applyTextResize(shapes));
      await sync.sync(done);
      await sync.verify(done).catch(() => 0);
      return { changed: edited.changed, added: edited.added, removed: edited.removed };
    };
    if (groups.size >= 2) {
      // varias telas selecionadas: a mesma instrucao em cada tela, uma por vez sobre o estado mais recente
      const list = [...groups.entries()].sort((a, b) => (byId.get(a[0])?.x ?? 0) - (byId.get(b[0])?.x ?? 0));
      let ok = 0; let layers = 0;
      for (const [, ids] of list) {
        if (signal.cancelled) throw new Error('cancelado');
        const r = await applyEdit(ids, `${clean}\n\n(Esta é uma das ${list.length} telas selecionadas: aplique exatamente esta mudança nesta tela, de forma coerente com as demais.)`).catch(() => null);
        if (r) { ok++; layers += r.changed + r.added + r.removed; }
        o.onProgress(`Editando as telas selecionadas: ${ok} de ${list.length}…`);
      }
      if (!ok) throw new Error('A IA não devolveu alterações válidas em nenhuma tela. Tente descrever a mudança de outra forma.');
      return { message: `Alterações aplicadas em ${ok} de ${list.length} telas`, layers, rootIds: [] };
    }
    const r = await applyEdit(liveIds, clean);
    if (!r) throw new Error('A IA não devolveu alterações válidas. Tente descrever a mudança de outra forma.');
    const n = r.changed + r.added + r.removed;
    return { message: `${r.changed} alterado(s), ${r.added} adicionado(s), ${r.removed} removido(s)`, layers: n, rootIds: [] };
  }

  // ======================================================== preencher um frame vazio
  if (genTarget) {
    sync.adopt([genTarget]);
    const aiReq = { tokens, projectAssets: projectAssets.length ? projectAssets : undefined, prompt: clean, pageId: PAGE, startX: genTarget.x, startY: genTarget.y, accentColor: o.accentColor, isDark: o.isDark, targetFrame: genTarget, icons, projectContext, canReadProject: o.useCtx && !!o.ws && !refs.length, useProjectContext: o.useCtx, referenceImages: refs, referenceSpec: spec, inspirationImages: inspiration, replicaMode: refs.length > 0 && !refStyle };
    o.onProgress(`Pedindo o layout para ${o.provider || 'a IA'}...`);
    const generated = parseAiScreenResponse(await requestAiScreenRaw(buildAiScreenPrompt(aiReq), o.provider, genModel, cwd || undefined, 480000, undefined, refDirs), aiReq);
    if (signal.cancelled) throw new Error('cancelado');
    if (!generated) throw new Error('A IA não devolveu um layout válido. Tente descrever a tela com mais detalhes ou escolha outro modelo.');
    let shapes = relayoutAll(applyTextResize(generated.shapes));
    await sync.sync(shapes);
    await loadPhotos(shapes, generated.pending, async (next) => { shapes = next; await sync.sync(shapes); });
    lastShapes = shapes;
    return finish([genTarget.id], 'Conteúdo da tela gerado', shapes.length);
  }

  // ======================================================== telas novas
  const fmt = baseDims ? { mobile: baseDims.w <= 500 && baseDims.h >= 600, width: baseDims.w, height: baseDims.h } : guessScreenFormat(clean, undefined);
  let hinted = clean;
  if (baseDims) hinted = `${clean}\n\n${STYLE_MODE_MARK} As imagens anexadas são telas JÁ EXISTENTES deste sistema/app; crie as telas pedidas no MESMO padrão de design delas. Tamanho: ${baseDims.w}x${baseDims.h} (${fmt.mobile ? 'MOBILE' : 'DESKTOP'}); escreva exatamente esse tamanho em "width"/"height".${selStyle ? `\n\nPADRÃO DE DESIGN DA TELA SELECIONADA (reaproveite): ${selStyle}` : ''}`;
  else if (refStyle && refs.length) hinted = `${clean}\n\n${STYLE_MODE_MARK} As imagens anexadas são REFERÊNCIA DE DESIGN, não a tela a copiar: crie o que o pedido descreve (assunto, telas e estrutura próprios do pedido) no MESMO padrão visual delas — paleta, tipografia, raios, espaçamentos, estilo dos componentes e clima — sem repetir o conteúdo nem a composição das imagens. (Formato: ${fmt.mobile ? 'MOBILE 393x852' : 'DESKTOP 1440x900'}.)`;
  else hinted = `${clean}\n\n(Formato detectado: ${fmt.mobile ? 'MOBILE 393x852' : 'DESKTOP 1440x900'}. Use esse tamanho em "width"/"height".)`;
  const spot = baseDims
    ? findFreeSpot(pageShapes, baseRight + 160, baseTop, baseDims.w + 80, baseDims.h + 80)
    : findFreeSpot(pageShapes, 100, 100, fmt.width + 80, fmt.height + 80);

  /** Mesclagem de varias geracoes simultaneas (uma por tela): cada uma publica o proprio conjunto de shapes. */
  const parts = new Map<number, Shape[]>();
  const publish = () => sync.sync([...parts.values()].flat());
  const frameRoots: string[] = [];

  const generateOne = async (key: number, prompt: string, startX: number, startY: number, maxScreens?: number): Promise<number> => {
    const aiReq = { tokens, projectAssets: projectAssets.length ? projectAssets : undefined, prompt, pageId: PAGE, startX, startY, accentColor: o.accentColor, isDark: o.isDark, icons, projectContext, canReadProject: o.useCtx && !!o.ws && !(refs.length || spec), useProjectContext: o.useCtx, maxScreens, plainDevice: true, replicaMode: refs.length > 0 && !refStyle, referenceImages: refs, referenceSpec: spec, inspirationImages: inspiration };
    const builder = new ScreenBuilder(aiReq);
    const stream = new AiJsonStream();
    const queue: AiStreamEvent[] = [];
    let streamDone = false;
    let screenCount = 0;
    let swapped = false;
    let imgStarted = 0;
    let imgFailed = 0;
    const jobs: Promise<void>[] = [];
    const live = () => { parts.set(key, builder.all); void publish(); };
    const startImages = () => {
      while (imgStarted < builder.pending.length) {
        const job = builder.pending[imgStarted++];
        if (job.refCrop) {
          // foto da própria referência: recorta o trecho que a IA indicou
          jobs.push(cropRef(refData[job.refCrop.img] ?? refData[0], job.refCrop, job.width, job.height).then((url) => { if (signal.cancelled || !url) return; builder.patch(job.id, { imageUrl: url }); live(); }).catch(() => { imgFailed++; }));
          continue;
        }
        if (job.assetPath) {
          // logo/ícone do projeto: lê o arquivo (sem Unsplash)
          jobs.push(Promise.resolve(fsApi()?.readFileDataUrl?.(job.assetPath)).then((r: any) => { if (signal.cancelled || !r?.dataUrl) return; builder.patch(job.id, { imageUrl: r.dataUrl }); live(); }).catch(() => {}));
          continue;
        }
        jobs.push(fetchStockImage(job.query, job.width, job.height, { person: job.person }).then((r) => {
          if (!r) { imgFailed++; return; }
          if (signal.cancelled) return;
          const c = builder.all.find((s) => s.id === job.id);
          builder.patch(job.id, { imageUrl: r.dataUrl, name: r.credit ? `${c?.name || 'Foto'} · Foto: ${r.credit} (Unsplash)` : c?.name });
          live();
        }).catch(() => { imgFailed++; }));
      }
    };
    const handle = (ev: AiStreamEvent) => {
      if (ev.kind === 'screen') {
        const shapes = builder.startScreen(ev.header);
        if (!shapes.length) return;
        live();
        screenCount++;
        o.onProgress(`Criando a tela "${shapes[0].name}"…`);
      } else {
        const shape = builder.addItem(ev.item);
        if (!shape) return;
        builder.settle(); // auto layout: hug/fill/posições
        live();
        startImages();
        o.onProgress(`Criando ${shape.name || shape.type}… (${builder.itemCount} elementos)`);
      }
    };
    let wake: (() => void) | null = null;
    const poke = () => { const w = wake; wake = null; w?.(); };
    const consumer = (async () => {
      while (!signal.cancelled) {
        const ev = queue.shift();
        if (!ev) {
          if (streamDone) break;
          await new Promise<void>((r) => { wake = r; if (queue.length || streamDone || signal.cancelled) poke(); });
          continue;
        }
        handle(ev);
        await sync.sync(parts.get(key) || []); // um elemento por vez: a tela aparece sendo montada
        if (!swapped && builder.frameIds.length) {
          // a tela de verdade nasceu: o quadro vazio sai e o brilho passa para ela
          swapped = true;
          await dropPlaceholder(key);
          for (const sid of builder.frameIds) { const fid = sync.idOf(sid); if (fid !== undefined) gs.glow.add(fid); }
          await setGlow();
        }
      }
    })();
    o.onProgress(`Pedindo o layout para ${o.provider || 'a IA'}${o.useCtx && o.ws ? ' (analisando o projeto)' : ''}...`);
    const startedAt = Date.now();
    const wait = setInterval(() => { if (builder.itemCount === 0 && screenCount === 0) o.onProgress(`${o.provider || 'A IA'} está ${refs.length ? `analisando ${refs.length} imagem(ns) e ` : ''}pensando no layout… ${Math.round((Date.now() - startedAt) / 1000)}s`); }, 1000);
    let final = '';
    let failure: any = null;
    try {
      // vigia: sem nenhum elemento depois de 3,5 min a chamada é interrompida (a CLI "pensando" para sempre); a nova tentativa usa o modelo rápido
      const ask = (model: string | undefined) => {
        const ctl: { abort?: (why?: string) => void } = {};
        const started = Date.now();
        const dog = setInterval(() => { if (builder.itemCount === 0 && Date.now() - started > 210000) ctl.abort?.('STALL: a IA não devolveu nenhum elemento em 3,5 minutos'); }, 5000);
        let closing = false;
        return requestAiScreenRaw(buildAiScreenPrompt(aiReq), o.provider, model, cwd || undefined, 480000, (chunk) => {
          queue.push(...stream.push(chunk));
          poke();
          // o JSON fechou: a CLI ainda leva minutos para encerrar sozinha; interrompe depois de uma folga curta
          if (!closing && stream.complete) { closing = true; setTimeout(() => ctl.abort?.('DONE'), 1200); }
        }, refDirs, 150000, ctl).finally(() => clearInterval(dog));
      };
      final = await ask(genModel).catch((e) => {
        if (String(e?.message) === 'DONE') return stream.raw;
        if (!/^STALL/.test(String(e?.message)) || signal.cancelled || builder.itemCount > 0) throw e;
        const quick = lowEffortModel(o.provider, cliModel);
        o.onProgress(quick && quick !== genModel ? `A IA travou (${String(e?.message).replace(/^STALL:\s*/, '')}); tentando de novo com o modelo rápido…` : 'A IA travou; tentando de novo…');
        return ask(quick && quick !== genModel ? quick : genModel).catch((e2) => { if (String(e2?.message) === 'DONE') return stream.raw; throw e2; });
      });
      if (stream.consumed === 0 && final) queue.push(...stream.push(final)); // CLIs que só devolvem no fim
    } catch (e) { failure = e; }
    clearInterval(wait);
    streamDone = true;
    poke();
    await consumer;
    if (signal.cancelled) { parts.delete(key); await publish(); throw new Error('cancelado'); }
    if (builder.itemCount === 0 && final) {
      const whole = parseAiScreenResponse(final, aiReq);
      if (whole) { builder.all = whole.shapes; builder.pending.push(...whole.pending); startImages(); builder.frameIds.push(whole.mainFrameId); live(); }
    }
    if (jobs.length) o.onProgress(`Carregando ${jobs.length} foto(s)/logo(s)…`);
    await Promise.all(jobs);
    if (imgFailed) o.onToast?.(`${imgFailed} foto(s) não carregaram (ficaram como placeholder cinza)`);
    const ids = builder.frameIds.length ? builder.frameIds : builder.all.filter((s) => s.type === 'frame' && !s.parentId).map((s) => s.id);
    if (!builder.all.length) throw new Error(failure?.message || 'A IA não devolveu um layout válido. Tente descrever a tela com mais detalhes ou escolha outro modelo.');
    if (failure) o.onToast?.(`${failure?.message || 'A IA parou antes do fim'}; mantive o que já foi criado`);
    builder.all = fixSheetCorners(expandTextures(fixClip(fixStatusBarInk(fixTextOnGradient(fixIconContrast(fixContrast(fixShortText(builder.all)))))))); // título escuro em fundo escuro, ícone branco em círculo branco etc.
    parts.set(key, relayoutAll(applyTextResize(builder.all))); // o mesmo acabamento que o Design aplica ao confirmar
    await publish();
    frameRoots.push(...ids);
    return ids.length;
  };

  // pedido de varias telas (fluxo / app completo): planeja as telas + design system e gera UMA tela por chamada, em paralelo
  if (looksMultiScreen(clean) || (fromSelection && /(telas|sequ[eê]ncia|fluxo|jornada|outras|pr[oó]ximas|etapas)/i.test(clean))) {
    o.onProgress('Planejando as telas do app…');
    const planRaw = await requestAiScreenRaw(buildPlanPrompt(clean, projectContext, spec, tokens), o.provider, quickModel, cwd || undefined, 120000).catch(() => null);
    if (signal.cancelled) throw new Error('cancelado');
    const plan = planRaw ? parsePlan(planRaw) : null;
    if (plan && baseDims) { plan.width = baseDims.w; plan.height = baseDims.h; }
    if (plan && plan.screens.length >= 2) {
      const N = plan.screens.length;
      const step = plan.width + 200;
      // um quadro vazio brilhando por tela planejada, lado a lado (o primeiro quadro, provisório, sai)
      await dropPlaceholder(0);
      o.onProgress(`${N} telas planejadas: ${plan.screens.map((x) => x.name).join(', ')}`);
      const mobilePlan = plan.width <= 500 && plan.height >= 600;
      for (let i = 0; i < N; i++) await makePlaceholder(i, plan.screens[i].name, spot.x + i * step, spot.y, plan.width, plan.height, mobilePlan);
      let done = 0, next = 0;
      const errors: string[] = [];
      const worker = async () => {
        while (next < N && !signal.cancelled) {
          const i = next++;
          try {
            await generateOne(i, screenPrompt(hinted, plan, i), spot.x + i * step, spot.y, 1);
          } catch (e: any) {
            if (signal.cancelled) return;
            errors.push(`${plan.screens[i].name}: ${e?.message || 'falhou'}`);
          } finally {
            done++;
            o.onProgress(`Tela ${Math.min(done + 1, N)} de ${N}…`);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(3, N) }, worker));
      if (signal.cancelled) throw new Error('cancelado');
      if (errors.length === N) throw new Error(errors[0] || 'A IA não gerou nenhuma tela.');
      if (errors.length) o.onToast?.(`${errors.length} tela(s) falharam: ${errors.map((x) => x.split(':')[0]).join(', ')}`);
      return finish(frameRoots, errors.length ? `${N - errors.length} de ${N} telas geradas (${errors.length} falharam)` : `${N} telas geradas e prontas para revisar`, [...parts.values()].flat().length);
    }
  }

  // nada selecionado: cria telas novas, em tempo real
  const count = await generateOne(0, hinted, spot.x, spot.y);
  return finish(frameRoots, count === 1 ? 'Tela gerada e pronta para revisar' : `${count} telas geradas e prontas para revisar`, [...parts.values()].flat().length);

  /** Fotos (Unsplash) e arquivos do projeto (logo) que a IA pediu num conteudo gerado de uma vez. */
  async function loadPhotos(shapes: Shape[], pending: Array<{ id: string; query: string; width: number; height: number; assetPath?: string; person?: boolean; refCrop?: { img: number; x: number; y: number; w: number; h: number } }>, apply: (next: Shape[]) => Promise<void>) {
    if (!pending.length) return;
    const imgs = await Promise.all(pending.map((j) =>
      (j.refCrop ? cropRef(refData[j.refCrop.img] ?? refData[0], j.refCrop, j.width, j.height).then((url) => (url ? { dataUrl: url } : null)) : j.assetPath ? Promise.resolve(fsApi()?.readFileDataUrl?.(j.assetPath)).then((r: any) => (r?.dataUrl ? { dataUrl: r.dataUrl } : null)) : fetchStockImage(j.query, j.width, j.height, { person: j.person })).then((r) => [j.id, r] as const).catch(() => [j.id, null] as const)
    ));
    await apply(shapes.map((s) => { const hit = imgs.find(([id]) => id === s.id)?.[1]; return hit ? { ...s, imageUrl: hit.dataUrl } : s; }));
  }
}
