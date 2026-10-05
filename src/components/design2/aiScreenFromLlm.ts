import type { Shape } from './types';
import { COMMON_ICON_NAMES, iconShape, resolveIconName, type IconCatalog } from './icons';
import { fitText } from './textFit';
import { buildDevice, MOBILE_SAFE } from './devices';
import { referenceHints } from './designReferences';
import { relayoutAll } from './autoLayout';

/** Entrada para pedir uma tela à IA e converter a resposta em shapes do canvas. */
export interface AiScreenRequest {
  prompt: string;
  pageId: string;
  startX: number;
  startY: number;
  accentColor: string;
  isDark: boolean;
  targetFrame?: Shape | null;
  projectContext?: string;
  /** Catálogo de ícones Material (para itens type:"icon") */
  icons?: IconCatalog;
  /** O agente pode ler arquivos do projeto (cwd) para entender o contexto */
  canReadProject?: boolean;
  /** Caminhos locais de imagens de referência anexadas pelo usuário */
  referenceImages?: string[];
}

const MAX_SHAPES = 150;
const ALLOWED = new Set(['rect', 'ellipse', 'text', 'line', 'icon', 'image', 'frame']);
const MAX_SCREENS = 12;
const SCREEN_GAP = 120;

let counter = 0;
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

/** Bloco do prompt para imagens anexadas (as CLIs abrem os arquivos pelo caminho). */
export function referenceBlock(paths?: string[]): string {
  if (!paths?.length) return '';
  return `IMAGENS DE REFERÊNCIA ANEXADAS PELO USUÁRIO (arquivos locais; ABRA e ANALISE cada uma antes de desenhar e use como referência de estrutura, layout, componentes, hierarquia, estilo visual e paleta de cores; não copie logos nem textos de marcas):
${paths.map((p) => `- ${p}`).join('\n')}
`;
}

export function buildAiScreenPrompt(req: AiScreenRequest): string {
  const target = req.targetFrame;
  const size = target
    ? `O frame já existe com ${Math.round(target.width)}x${Math.round(target.height)} px: gere somente o CONTEÚDO dele (não mude o tamanho).`
    : 'Escolha o tamanho: MOBILE 393x852 (padrão para apps/celular; o app desenha o aparelho iPhone em volta) ou desktop 1440x900 (ou 1280x800), conforme o pedido.';
  const refs = referenceHints(req.prompt);
  return `Você é um designer de interfaces sênior. Crie o layout de uma ou mais telas e responda SOMENTE com JSON válido (sem markdown, sem texto antes ou depois).
${referenceBlock(req.referenceImages)}${req.canReadProject ? 'Você está na pasta do projeto do usuário e já recebeu abaixo um resumo dele. Só leia arquivos se faltar algo essencial para o design (somente LEITURA), no MÁXIMO 4 arquivos pequenos (ex.: README, tema/cores, uma página existente) e rápido — NUNCA varra o projeto inteiro nem rode buscas amplas, pois a resposta tem tempo limite. Reflita no design o domínio, o vocabulário e a identidade visual. NUNCA edite, crie ou apague arquivos. Responda apenas o JSON.' : `NÃO edite arquivos${req.referenceImages?.length ? ' (apenas abra as imagens de referência para vê-las)' : ' nem leia outros arquivos'}; responda apenas o JSON.`}

PEDIDO: ${req.prompt}
${req.projectContext ? `CONTEXTO DO PROJETO:\n${req.projectContext}\n` : ''}${size}

PALETA E TEMA: defina você mesmo uma paleta coerente com o PEDIDO — nunca com o tema ou a cor do aplicativo onde você está rodando. Prioridade: (1) o que o usuário pediu (ex.: "lightmode", "escuro", cores citadas); (2) a identidade da marca/app de referência citado (ex.: iFood = vermelho #EA1D2C); (3) as cores do projeto, só se o pedido for sobre esse projeto; (4) o que combina com o segmento (saúde = verdes/azuis, finanças = roxo/azul-escuro, beleza = tons suaves…). Sem pedido de tema, use tema claro em apps de consumo. Use 1 cor primária, 1 secundária opcional, neutros (fundo, superfície, borda, texto) e cores semânticas (verde/vermelho/amarelo) só onde fizer sentido. Informe SEMPRE "fill" (e "background" na tela) em todo elemento, com contraste adequado (texto legível sobre o fundo) e a mesma paleta em todas as telas.

REFERÊNCIAS DE MERCADO: se o pedido citar um app/sistema conhecido (iFood, Uber, Nubank, Airbnb, Spotify, Notion…) ou um tipo de produto consolidado, siga os padrões reais de UI dele (estrutura de navegação, hierarquia, componentes típicos, proporções, paleta e tom de voz), adaptados ao que foi pedido — sem copiar logos nem marcas. Mesmo sem citação, use como base os padrões estabelecidos de apps do mesmo tipo.
${refs ? `Padrões conhecidos do que foi citado:\n${refs}\n` : ''}
FORMATO (uma tela). ATENÇÃO: o exemplo abaixo mostra APENAS a sintaxe; os valores, textos, cores, tamanhos e a composição são fictícios. NÃO copie o conteúdo nem o layout do exemplo.
{"name":"<nome da tela>","width":393,"height":852,"background":"#RRGGBB","shapes":[
  {"type":"frame","id":"raiz","name":"Conteúdo","layout":"vertical","gap":16,"padding":[54,16,34,16],"x":0,"y":0,"width":393,"height":852,"fill":"transparent"},
  {"type":"frame","id":"c1","parent":"raiz","name":"<card>","layout":"horizontal","gap":12,"padding":12,"align":"left","width":"fill","height":"hug","fill":"#RRGGBB","cornerRadius":16},
  {"type":"image","parent":"c1","name":"<foto>","query":"<foto em inglês>","width":64,"height":64,"cornerRadius":12},
  {"type":"frame","id":"c1t","parent":"c1","name":"<textos>","layout":"vertical","gap":4,"width":"fill","height":"hug"},
  {"type":"text","parent":"c1t","name":"<título>","text":"<texto real>","width":"fill","fontSize":16,"fontWeight":600,"fill":"#RRGGBB"},
  {"type":"icon","parent":"c1t","name":"<MaterialIcon>","size":18,"fill":"#RRGGBB"},
  {"type":"ellipse","name":"<sobreposição>","x":300,"y":120,"width":12,"height":12,"fill":"#RRGGBB"}
]}

AUTO LAYOUT (OBRIGATÓRIO): estruture a tela como um designer no Figma, com frames de Auto Layout aninhados — NÃO posicione tudo com x/y absolutos.
- Um frame com "layout":"horizontal" ou "vertical" organiza os filhos sozinho: "gap" (espaço entre itens), "padding" (número, ou [topo,direita,base,esquerda]; também "paddingX"/"paddingY"), "align" (top-left, top-center, top-right, left, center, right, bottom-left, bottom-center, bottom-right).
- Cada item declara o pai com "parent":"<id do frame>" (o pai precisa ter sido declarado ANTES, com "id"). Sem "parent" = direto na tela. Filhos de um frame com layout NÃO levam x/y.
- Tamanhos: número, "fill" (ocupa o espaço disponível do pai) ou "hug" (se ajusta ao conteúdo). Use "hug" na altura de cards/botões/listas, "fill" na largura de itens que ocupam a linha, textos de uma linha curta com "width":"hug".
- Estruture: um frame raiz vertical (cabeçalho, conteúdo rolável, barra inferior), seções, listas e grades (linhas horizontais de cards), cards (imagem + coluna de textos), chips, botões (frame com texto/ícone centralizado), barras de navegação e abas.
- Use x/y absolutos (sem layout) apenas para sobreposições: badges, botão flutuante, indicadores, elementos decorativos.
- Cores em "fill"/"stroke"; "cornerRadius" nos frames para cards e botões.

PROJETO SOB MEDIDA: projete especificamente o que foi pedido — as telas, as seções, os componentes, os textos, os dados fictícios e a hierarquia devem nascer do pedido (e das imagens/projeto/referências fornecidos), como um designer faria para esse produto. Não use um esqueleto genérico repetido (cabeçalho + 3 cards + botão) nem conteúdo de outro segmento; cada tela deve ter composição própria, adequada ao seu objetivo.

VÁRIAS TELAS: se o pedido envolver mais de uma tela (fluxo, jornada, "telas de login e cadastro", "app com 4 telas"), responda {"screens":[{"name":"...","width":393,"height":852,"background":"#...","shapes":[...]}, ...]} com telas do mesmo tamanho e visual coerente (até ${MAX_SCREENS}). Quando o usuário pedir um FLUXO sem dizer quantas telas, VOCÊ decide a quantidade necessária para cobrir a jornada completa do início ao fim (normalmente 5 a 10: ex. abertura, cadastro/login, home, listagem, detalhe, seleção, confirmação, sucesso, acompanhamento), sem pedir confirmação e sem se limitar a poucas telas. Se o usuário disser o número, siga-o. Nomeie cada tela de forma curta e na ordem do fluxo, e mantenha os mesmos componentes de navegação, cabeçalhos e paleta entre elas. Em cada tela, escreva "name","width","height","background" ANTES de "shapes".

REGRAS:
- x e y (quando usados) são relativos ao canto superior esquerdo do pai; tudo deve caber dentro de width x height da tela.
- Em telas mobile NÃO desenhe barra de status, ilha/notch nem indicador home (o app já desenha). Reserve ${MOBILE_SAFE.top}px no topo e ${MOBILE_SAFE.bottom}px na base e use margens laterais de 16 a 24px.
- Tipos permitidos: frame, rect, ellipse, text, line, icon, image. Cores em hexadecimal (#RRGGBB).
- Ordem do array = ordem de criação e empilhamento: declare cada frame ANTES dos seus filhos; dentro de um layout, os filhos aparecem na ordem em que forem listados. Gere de cima para baixo.
- TEXTOS: o texto precisa caber DENTRO do card/área onde está. Textos curtos (títulos, botões, rótulos, preços) devem caber em UMA linha: dê largura suficiente e não os quebre. Só use mais linhas em descrições, com a largura do card menos 16px de margem interna. Nunca deixe texto passar da borda do card.
- ÍCONES: use SEMPRE type "icon" com "name" de um Material Icon em PascalCase (ex.: ${COMMON_ICON_NAMES.slice(0, 60).join(', ')}, ou outro) e "size" em px; "fill" define a cor. Nunca desenhe ícones com formas.
- IMAGENS: para fotos reais (perfil de usuário, banners, capas, fotos de produtos/lugares/comida) use type "image" com "query" em INGLÊS descrevendo a foto (ex.: "smiling woman portrait", "burger on table", "modern apartment living room"). Avatares: width = height e "cornerRadius" = metade do tamanho (círculo). Cantos arredondados com "cornerRadius".
- Use no máximo ${MAX_SHAPES} elementos por tela, hierarquia visual clara, espaçamento consistente (múltiplos de 4 ou 8) e textos reais em português do Brasil (nada de "Lorem ipsum").`;
}

/** Fundo escuro? (luminância do hex; padrão: claro) */
export function isDarkColor(hex: string | undefined): boolean {
  const m = /^#([0-9a-f]{3}|[0-9a-f]{6})/i.exec((hex || '').trim());
  if (!m) return false;
  const h = m[1].length === 3 ? m[1].replace(/./g, (c) => c + c) : m[1];
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.45;
}

const COLOR = /^(#[0-9a-fA-F]{3,8}|rgba?\([\d\s.,%]+\)|transparent|none)$/;
const color = (v: unknown, fallback: string) => (typeof v === 'string' && COLOR.test(v.trim()) ? v.trim() : fallback);
const num = (v: unknown, fallback: number, min: number, max: number) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v));
  return Number.isFinite(n) ? Math.max(min, Math.min(max, n)) : fallback;
};

/** Quebra o texto por palavras para caber na largura (mantido por compatibilidade; o ajuste fino é do fitText). */
export function wrapText(text: string, width: number, fontSize: number): string {
  const perLine = Math.max(1, Math.floor(width / (fontSize * 0.55)));
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      if (line && (line + ' ' + word).length > perLine) {
        lines.push(line);
        line = word;
      } else {
        line = line ? `${line} ${word}` : word;
      }
    }
    lines.push(line);
  }
  return lines.join('\n');
}

/** Extrai o objeto JSON da resposta (aceita cercas ``` e texto em volta). */
export function extractJson(raw: string): any | null {
  const text = (raw || '').replace(/\x1b\[[0-9;?]*[a-zA-Z]/g, '').trim();
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
  const candidates = [fenced?.[1], text, text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1)].filter(Boolean) as string[];
  for (const c of candidates) {
    try {
      const parsed = JSON.parse(c);
      if (parsed && typeof parsed === 'object') return parsed;
    } catch {}
  }
  return null;
}

interface Box { x: number; y: number; width: number; height: number }
export interface PendingImage { id: string; query: string; width: number; height: number }
interface TextMeta { raw: string; size: number; weight: number; align: 'left' | 'center' | 'right'; singleLine: boolean }
type ItemCtx = {
  frameId: string; originX: number; originY: number; width: number; height: number; pageId: string; isDark: boolean; accentColor: string;
  icons?: IconCatalog;
  /** Retângulos já criados (relativos à tela): textos se ajustam ao menor que os contém */
  containers?: Box[];
  /** Imagens a resolver depois (Unsplash) */
  pending?: PendingImage[];
  /** Resolve o id declarado pela IA ("parent") para o shape atual */
  lookup?: (aiId: string) => Shape | undefined;
  /** Textos "fill": reajustados depois que o auto layout define a largura final */
  textMeta?: Map<string, TextMeta>;
};

const ALIGNS = new Set(['top-left', 'top-center', 'top-right', 'left', 'center', 'right', 'bottom-left', 'bottom-center', 'bottom-right']);

/** Menor retângulo que contém o ponto; senão a própria tela. */
function containerFor(ctx: ItemCtx, x: number, y: number): { right: number; bottom: number; card: boolean } {
  let best: Box | null = null;
  for (const b of ctx.containers || []) {
    if (x >= b.x - 0.5 && y >= b.y - 0.5 && x < b.x + b.width && y < b.y + b.height && (!best || b.width * b.height < best.width * best.height)) best = b;
  }
  return best ? { right: best.x + best.width, bottom: best.y + best.height, card: best.width < ctx.width * 0.98 } : { right: ctx.width, bottom: ctx.height, card: false };
}

type Dim = { v: number; mode: 'fixed' | 'fill' | 'hug' };
function parsePadding(item: any) {
  let t = 0, r = 0, b = 0, l = 0;
  const p = item.padding;
  const n = (v: unknown) => num(v, 0, 0, 300);
  if (Array.isArray(p)) {
    if (p.length === 2) [t, r] = [n(p[0]), n(p[1])], (b = t), (l = r);
    else if (p.length >= 4) [t, r, b, l] = [n(p[0]), n(p[1]), n(p[2]), n(p[3])];
    else if (p.length === 1) t = r = b = l = n(p[0]);
  } else if (p != null) t = r = b = l = n(p);
  if (item.paddingX != null) l = r = n(item.paddingX);
  if (item.paddingY != null) t = b = n(item.paddingY);
  return { t, r, b, l };
}

/** Converte um item vindo da IA em shape (coordenadas relativas ao pai -> absolutas). Null se inválido. */
export function convertAiItem(item: any, ctx: ItemCtx, z: number): Shape | null {
  if (!item || typeof item !== 'object' || !ALLOWED.has(item.type)) return null;
  // pai declarado pela IA (frame/section) ou a própria tela
  const declared = typeof item.parent === 'string' && item.parent !== 'root' ? ctx.lookup?.(item.parent) : undefined;
  const pShape = declared && (declared.type === 'frame' || declared.type === 'section') ? declared : undefined;
  const autoParent = !!pShape?.hasAutoLayout && (pShape.layoutFlow === 'horizontal' || pShape.layoutFlow === 'vertical');
  const parentId = pShape ? pShape.id : ctx.frameId;
  const ox = pShape ? pShape.x : ctx.originX;
  const oy = pShape ? pShape.y : ctx.originY;
  const width = pShape ? pShape.width : ctx.width;
  const height = pShape ? pShape.height : ctx.height;
  const horizontal = pShape?.layoutFlow === 'horizontal';
  // filho de auto layout entra no fim do fluxo (o layout o posiciona); senão posição absoluta no pai
  const place = (relX: number, relY: number) => (autoParent ? (horizontal ? { x: ox + width + 1, y: oy } : { x: ox, y: oy + height + 1 }) : { x: ox + relX, y: oy + relY });
  const dim = (v: unknown, fb: number, max: number): Dim => {
    if (v === 'fill') return { v: autoParent ? Math.max(24, Math.min(fb, max)) : max, mode: autoParent ? 'fill' : 'fixed' };
    if (v === 'hug') return { v: fb, mode: autoParent ? 'hug' : 'fixed' };
    return { v: num(v, fb, 0, max), mode: 'fixed' };
  };

  if (item.type === 'icon') {
    const name = ctx.icons ? resolveIconName(ctx.icons, item.name) : null;
    if (!ctx.icons || !name) return null;
    const size = num(item.size ?? item.width, 24, 8, 256);
    const pos = place(num(item.x, 0, 0, Math.max(0, width - size)), num(item.y, 0, 0, Math.max(0, height - size)));
    return iconShape(ctx.icons, name, { id: uid('ai-icon'), pageId: ctx.pageId, parentId, x: pos.x, y: pos.y, size, fill: color(item.fill, ctx.isDark ? '#FFFFFF' : '#0F172A'), zIndex: z });
  }

  const isText = item.type === 'text';
  const isFrame = item.type === 'frame';
  // pais com auto layout ainda podem crescer (hug): o limite dos filhos é o tamanho da tela, não o do pai atual
  const capW = autoParent ? Math.max(width, ctx.width) : width;
  const capH = autoParent ? Math.max(height, ctx.height) : height;
  const wDim = dim(item.width, item.type === 'line' ? 100 : isFrame ? width : 40, capW);
  const hDim = dim(item.height ?? (isFrame ? 'hug' : undefined), item.type === 'line' ? 0 : 40, capH);
  const w = wDim.v;
  const h = hDim.v;
  const relX = num(item.x, 0, 0, Math.max(0, width - (isText ? 24 : w)));
  const relY = num(item.y, 0, 0, Math.max(0, height - (isText ? 12 : h)));
  const pos = place(relX, relY);
  const base: any = {
    id: uid(`ai-${item.type}`),
    parentId,
    name: typeof item.name === 'string' ? item.name.slice(0, 60) : item.type,
    type: item.type,
    pageId: ctx.pageId,
    x: pos.x,
    y: pos.y,
    width: w,
    height: h,
    rotation: 0,
    opacity: num(item.opacity, 1, 0, 1),
    zIndex: z,
    visible: true,
    stroke: color(item.stroke, 'none'),
    strokeWidth: num(item.strokeWidth, 0, 0, 40),
  };
  if (autoParent || isFrame) {
    base.widthMode = wDim.mode;
    base.heightMode = hDim.mode;
  }

  if (isFrame) {
    const layout = item.layout === 'horizontal' || item.layout === 'vertical' ? item.layout : undefined;
    const pad = parsePadding(item);
    base.fill = color(item.fill, 'transparent');
    base.cornerRadius = num(item.cornerRadius, 0, 0, 400);
    if (item.clip === true || item.clip === 'true') base.clipContent = true;
    if (layout) {
      Object.assign(base, {
        hasAutoLayout: true,
        layoutFlow: layout,
        layoutGap: num(item.gap, 0, 0, 200),
        independentPadding: true,
        paddingTop: pad.t,
        paddingRight: pad.r,
        paddingBottom: pad.b,
        paddingLeft: pad.l,
        layoutAlign: ALIGNS.has(item.align) ? item.align : 'top-left',
      });
    }
    if (!autoParent && base.fill !== 'transparent' && w > 24 && h > 14) ctx.containers?.push({ x: relX, y: relY, width: w, height: h });
    return base as Shape;
  }

  if (isText) {
    const size = num(item.fontSize, 16, 8, 160);
    const weight = num(item.fontWeight, 400, 100, 900);
    const align = ['left', 'center', 'right'].includes(item.textAlign) ? item.textAlign : 'left';
    const raw = String(item.text ?? '').slice(0, 300);
    let maxW: number;
    let maxH: number;
    if (pShape && autoParent) {
      const padL = pShape.independentPadding ? pShape.paddingLeft ?? 0 : pShape.paddingHorizontal ?? 0;
      const padR = pShape.independentPadding ? pShape.paddingRight ?? 0 : pShape.paddingHorizontal ?? 0;
      // pai "hug" ainda não tem largura final: limita pela tela
      maxW = Math.max(24, (pShape.widthMode === 'hug' ? ctx.width - 32 : width) - padL - padR);
      maxH = 800;
    } else if (pShape) {
      maxW = Math.max(24, width - 16 - relX);
      maxH = Math.max(size * 1.25, height - 4 - relY);
    } else {
      const box = containerFor(ctx, relX, relY);
      const pad = box.card ? 8 : 16;
      maxW = Math.max(24, box.right - pad - relX);
      maxH = Math.max(size * 1.25, box.bottom - pad / 2 - relY);
    }
    const hugW = wDim.mode === 'hug';
    // largura "fill" quebra linha como no Figma (não encolhe a fonte); "hug" é sempre uma linha
    const singleLine = hugW || (wDim.mode !== 'fill' && !raw.includes('\n') && (item.height == null || h <= size * 1.25 * 1.6));
    const fit = fitText({ text: raw, width: hugW ? 16 : Math.min(Math.max(w, 16), maxW), fontSize: size, weight, align, maxWidth: maxW, maxHeight: maxH, singleLine });
    base.text = fit.text;
    base.fontSize = fit.fontSize;
    base.width = fit.width;
    base.height = fit.height;
    base.fontWeight = weight;
    base.fontFamily = 'Inter';
    base.textAlign = align;
    base.fill = color(item.fill, ctx.isDark ? '#FFFFFF' : '#0F172A');
    if (autoParent) {
      base.widthMode = hugW ? 'hug' : wDim.mode;
      base.heightMode = 'hug';
      if (wDim.mode === 'fill') ctx.textMeta?.set(base.id, { raw, size, weight, align, singleLine });
    }
    return base as Shape;
  }

  if (item.type === 'image') {
    base.fill = '#D4D4D8';
    base.imageFit = 'fill';
    base.imageCrop = { x: 0, y: 0, w: 1, h: 1 }; // habilita o recorte com cantos arredondados
    base.cornerRadius = num(item.cornerRadius, item.circle ? Math.min(w, h) / 2 : 0, 0, 1000);
    ctx.pending?.push({ id: base.id, query: String(item.query || item.name || 'abstract').slice(0, 80), width: Math.round(w), height: Math.round(h) });
  } else {
    base.fill = color(item.fill, item.type === 'line' ? 'none' : ctx.isDark ? '#27272A' : '#E4E4E7');
    if (item.type === 'rect') base.cornerRadius = num(item.cornerRadius, 0, 0, 400);
    if (item.type === 'line' && base.stroke === 'none') base.stroke = ctx.isDark ? '#3F3F46' : '#CBD5E1';
    if (item.type === 'line' && base.strokeWidth === 0) base.strokeWidth = 1;
  }
  if (!autoParent && !pShape && (item.type === 'rect' || item.type === 'image') && w > 24 && h > 14) ctx.containers?.push({ x: relX, y: relY, width: w, height: h });
  return base as Shape;
}

/**
 * Monta telas aos poucos: startScreen() cria o frame (e o aparelho, se mobile) e addItem() cada elemento.
 * `all` guarda tudo o que foi criado, já com o auto layout aplicado (settle). Serve à criação em tempo real
 * e ao parse da resposta completa.
 */
export class ScreenBuilder {
  readonly pending: PendingImage[] = [];
  readonly frameIds: string[] = [];
  /** tudo o que o builder criou (aparelhos + conteúdo), sempre atualizado */
  all: Shape[] = [];
  /** tela de cada frame raiz (para regerar com o mesmo tamanho) */
  readonly screens_: Array<{ rootId: string; width: number; height: number }> = [];
  private cursorX: number;
  private z: number;
  private ctx: ItemCtx | null = null;
  private screens = 0;
  private items = 0;
  private aiIds = new Map<string, string>();
  private textMeta = new Map<string, TextMeta>();
  totalWidth = 0;
  maxHeight = 0;

  constructor(private req: Pick<AiScreenRequest, 'pageId' | 'startX' | 'startY' | 'isDark' | 'accentColor' | 'targetFrame' | 'icons'> & { maxScreens?: number }) {
    this.cursorX = req.startX;
    this.z = (req.targetFrame ? req.targetFrame.zIndex + 1 : 100);
  }

  get itemCount() { return this.items; }

  private lookup = (aiId: string) => {
    const id = this.aiIds.get(aiId);
    return id ? this.all.find((s) => s.id === id) : undefined;
  };

  startScreen(header: Record<string, any>): Shape[] {
    const target = this.req.targetFrame || null;
    if (this.screens >= (this.req.maxScreens ?? MAX_SCREENS) || (target && this.screens >= 1)) {
      this.ctx = null;
      return [];
    }
    this.screens++;
    this.aiIds.clear(); // ids declarados valem só dentro da própria tela
    const width = target ? target.width : num(header.width, 393, 200, 3000);
    const height = target ? target.height : num(header.height, 852, 200, 3000);
    const originX = target ? target.x : this.cursorX;
    const originY = target ? target.y : this.req.startY;
    let out: Shape[] = [];
    let rootId: string;
    let frameId: string;
    let ox = originX;
    let oy = originY;
    if (target) {
      frameId = rootId = target.id;
      out = [target];
    } else {
      const mobile = width <= 500 && height >= 600;
      const name = typeof header.name === 'string' && header.name.trim() ? header.name.trim().slice(0, 60) : 'Tela gerada por IA';
      const bg = color(header.background, '#FFFFFF');
      const dev = buildDevice(
        { name, width, height, kind: mobile ? 'iphone-island' : 'plain', radius: mobile ? 55 : 0 },
        { idGen: () => uid('dev'), pageId: this.req.pageId, x: originX, y: originY, z: this.z, isDark: isDarkColor(bg), name, icons: this.req.icons, background: bg }
      );
      out = dev.shapes;
      rootId = dev.rootId;
      frameId = dev.screenId; // o conteúdo da IA entra na tela, dentro do aparelho
      ox = dev.screenX;
      oy = dev.screenY;
      this.z = dev.zNext;
      this.cursorX += dev.rootWidth + SCREEN_GAP;
      this.totalWidth = this.cursorX - SCREEN_GAP - this.req.startX;
      this.maxHeight = Math.max(this.maxHeight, dev.rootHeight);
    }
    this.frameIds.push(rootId);
    this.screens_.push({ rootId, width, height });
    this.all.push(...out);
    // o tema vem do fundo que a IA escolheu, não do tema do app
    const bg = target ? target.fill : color(header.background, '#FFFFFF');
    this.ctx = { frameId, originX: ox, originY: oy, width, height, pageId: this.req.pageId, isDark: isDarkColor(bg), accentColor: this.req.accentColor, icons: this.req.icons, containers: [], pending: this.pending, lookup: this.lookup, textMeta: this.textMeta };
    return out;
  }

  addItem(item: any): Shape | null {
    if (!this.ctx) this.startScreen({});
    if (!this.ctx || this.items >= MAX_SCREENS * MAX_SHAPES) return null;
    const shape = convertAiItem(item, this.ctx, this.z);
    if (shape) {
      this.z++;
      this.items++;
      this.all.push(shape);
      if (typeof item.id === 'string') this.aiIds.set(item.id, shape.id);
    }
    return shape;
  }

  /** Aplica o auto layout (hug/fill/posições) e reajusta os textos "fill" à largura final. */
  settle(): void {
    for (let i = 0; i < 3; i++) {
      this.all = relayoutAll(this.all);
      let changed = false;
      this.all = this.all.map((s) => {
        const m = this.textMeta.get(s.id);
        if (!m || s.widthMode !== 'fill') return s;
        const fit = fitText({ text: m.raw, width: s.width, fontSize: m.size, weight: m.weight, align: m.align, maxWidth: s.width, maxHeight: 800, singleLine: m.singleLine });
        if (fit.text === s.text && fit.height === s.height && fit.fontSize === s.fontSize) return s;
        changed = true;
        return { ...s, text: fit.text, fontSize: fit.fontSize, height: fit.height };
      });
      if (!changed) break;
    }
  }

  patch(id: string, fields: Partial<Shape>): void {
    this.all = this.all.map((s) => (s.id === id ? { ...s, ...fields } : s));
  }
}

/** Valida e converte a resposta da IA em shapes (coordenadas absolutas no canvas). Aceita uma tela ({shapes}) ou várias ({screens}). Null se inutilizável. */
export function parseAiScreenResponse(
  raw: string,
  req: Pick<AiScreenRequest, 'pageId' | 'startX' | 'startY' | 'isDark' | 'accentColor' | 'targetFrame' | 'icons'>
): { shapes: Shape[]; mainFrameId: string; width: number; height: number; pending: PendingImage[] } | null {
  const data = extractJson(raw);
  if (!data) return null;
  const target = req.targetFrame || null;
  const screens: any[] = Array.isArray(data.screens) && !target ? data.screens.slice(0, MAX_SCREENS) : Array.isArray(data.shapes) ? [data] : [];
  if (!screens.length) return null;
  const b = new ScreenBuilder(req);
  for (const screen of screens) {
    if (!screen || !Array.isArray(screen.shapes) || screen.shapes.length === 0) continue;
    b.startScreen(screen);
    // settle a cada item, como no streaming: cada novo filho entra no fim do fluxo já com os tamanhos finais dos anteriores
    for (const item of screen.shapes.slice(0, MAX_SHAPES)) if (b.addItem(item)) b.settle();
  }
  if (b.itemCount === 0) return null;
  return { shapes: b.all, mainFrameId: b.frameIds[0], width: target ? target.width : b.totalWidth, height: target ? target.height : b.maxHeight, pending: b.pending };
}

const CLI_BY_PROVIDER: Record<string, string> = { claude: 'claude', antigravity: 'agy', agy: 'agy', codex: 'codex', gemini: 'gemini', ollama: 'ollama' };

/**
 * Pede o layout à CLI de IA escolhida e devolve o texto bruto. `onText` recebe os trechos conforme chegam
 * (a CLI do Claude é executada em stream-json). Lança erro em falha ou timeout.
 */
export async function requestAiScreenRaw(
  prompt: string,
  provider: string | undefined,
  model: string | undefined,
  cwd: string | undefined,
  timeoutMs = 480000,
  onText?: (chunk: string) => void,
  additionalDirs?: string[]
): Promise<string> {
  const api = (window as any).electronAPI?.ai;
  if (!api?.runCli) throw new Error('CLI de IA indisponível');
  const cliCmd = CLI_BY_PROVIDER[(provider || 'claude').toLowerCase()] || 'claude';
  let timer: any;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      api.cancel?.(undefined, cwd);
      reject(new Error('A IA demorou demais para responder'));
    }, timeoutMs);
  });
  const off = onText && api.onOrchestratorEvent
    ? api.onOrchestratorEvent((e: any) => {
        if (e?.kind === 'progress' && e.message === 'stdout' && typeof e.payload?.text === 'string' && e.provider === cliCmd) onText(e.payload.text);
      })
    : null;
  try {
    const res = await Promise.race([api.runCli({ cliCmd, prompt, model, cwd, additionalDirs, streamText: !!onText }), timeout]);
    if (res?.exitCode && res.exitCode !== 0 && !res.stdout) throw new Error(res.stderr || 'A CLI de IA falhou');
    return String(res?.stdout || '');
  } finally {
    clearTimeout(timer);
    off?.();
  }
}
